/*
 * /precheck 자료 즉시 삭제 (환불규정 05 · 2026-08-08 승인 ③).
 *
 * ⚠️ 경계 (반드시 지킬 것)
 *   이 폴더(main_web_page)는 접수·결제·삭제 처리만 담당합니다.
 *   LLM 호출·상태 판정 코드를 여기에 두지 않습니다.
 *   여기서 하는 판단은 "이 토큰의 주인이 삭제를 요청했는가" 하나뿐입니다.
 *
 * POST /api/erasure
 *   body: { token, confirmNoReissue: true }
 *   → 200 { ok:true, filesDeleted, alreadyErased? }
 *   → 400 { error:'invalid token' }        토큰 형식 오류
 *   → 400 { error:'consent-required' }     재발급 불가 동의 없음
 *   → 404 { error:'not-found' }
 *   → 502 { error:'delete failed' | 'store failed' }
 *   → 503 { error:'not-configured' }
 *
 * ── 무엇을 지우고 무엇을 남기는가 ───────────────────────────────────────────
 *   지금 지움 : Storage 의 접수 파일 전부 (되돌릴 수 없습니다 — 재발급 불가)
 *   지금 표시 : erasure_requested_at · files_deleted_at · file_paths=[] · file_count=0
 *              own_form_path=null (자사 서식도 file_paths 에 들어 있어 함께 지워집니다)
 *              delete_after=now() → 접수 행 자체는 정리 배치가 다음 실행에서 지웁니다
 *   남김     : email · 결제 기록 — 행이 지워질 때까지만. 환불을 함께 신청한 건의
 *              환불 처리에 필요하고, 법정 보존 대상인 결제 기록은 결제대행사에 남습니다.
 *
 * 접수 상태는 아직 진행 중인 건만 'cancelled' 로 내립니다.
 * 이미 'delivered' 인 건은 서비스가 이행된 뒤의 삭제이므로 상태를 바꾸지 않습니다 —
 * 바꾸면 이행하지 않은 건처럼 보입니다.
 *
 * 같은 요청을 두 번 보내도 안전합니다(멱등). 두 번째부터는 alreadyErased 로 돌려줍니다.
 *
 * ⚠️ 삭제는 환불이 아닙니다. 돈은 여기서 건드리지 않습니다 —
 *    환불은 토스 대시보드에서 사람이 처리하고 payment_status 를 손으로 맞춥니다.
 *    이 엔드포인트가 환불까지 하면, 자료를 이미 받은 사람의 클릭 한 번으로 환불이 나갑니다.
 *
 * 스키마: precheck-schema.sql 의 "0-B. 삭제 요청 컬럼" 절을 먼저 실행하십시오.
 */

const { readConfig, safeText, storageKey, removeObjects } = require('./_supabase.js');
const { sendErasureMails } = require('./_notify.js');

const STORAGE_BUCKET = 'intake';
const TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/;

// 삭제 후 상태를 내릴 접수 상태. 'delivered' 는 일부러 빼 두었습니다.
const CANCELLABLE = ['awaiting_payment', 'received', 'in_progress'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const body = parseBody(req.body);
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  if (!TOKEN_RE.test(token)) {
    res.status(400).json({ error: 'invalid token' });
    return;
  }

  // 재발급 불가 동의가 없으면 지우지 않습니다.
  // 되돌릴 수 없는 일이므로 "눌렀다" 만으로는 부족합니다.
  if (body.confirmNoReissue !== true) {
    res.status(400).json({ error: 'consent-required' });
    return;
  }

  const config = readConfig();
  if (!config.ok) {
    console.error('erasure config error: ' + config.error);
    res.status(503).json({ error: 'not-configured' });
    return;
  }

  let row;
  try {
    row = await findByToken(config, token);
  } catch (err) {
    console.error('erasure lookup failed:', err && err.message ? err.message : err);
    res.status(502).json({ error: 'lookup failed' });
    return;
  }
  if (!row) {
    res.status(404).json({ error: 'not-found' });
    return;
  }

  // 이미 삭제한 건. 다시 지우지 않고 같은 결과를 돌려줍니다.
  if (row.erasure_requested_at) {
    res.status(200).json({
      ok: true,
      alreadyErased: true,
      filesDeleted: 0,
      erasureRequestedAt: row.erasure_requested_at,
    });
    return;
  }

  // 1) 파일을 먼저 지웁니다. 여기서 실패하면 아무 표시도 남기지 않고 멈춥니다 —
  //    "지웠다" 고 표시한 채 파일이 남는 상태가 가장 나쁩니다.
  const keys = (row.file_paths || []).map((p) => storageKey(p, STORAGE_BUCKET));
  let deleted = 0;
  try {
    const result = await removeObjects(config, STORAGE_BUCKET, keys);
    deleted = result.deleted;
  } catch (err) {
    console.error('erasure storage delete failed: id=' + row.id +
      ' | ' + (err && err.message ? err.message : err));
    res.status(502).json({ error: 'delete failed' });
    return;
  }

  // 2) 표시. 여기서 실패하면 파일은 이미 없고 기록만 남은 상태입니다.
  //    이용자에게는 실패로 알립니다 — 다시 눌러도 1)은 이미 없는 키를 지우므로 안전합니다.
  //    사람이 손으로 맞출 수 있도록 로그에 크게 남깁니다.
  const now = new Date().toISOString();
  const statusAfter = CANCELLABLE.indexOf(row.status) === -1 ? row.status : 'cancelled';
  try {
    await patchByToken(config, token, {
      file_paths: [],
      file_count: 0,
      // 파일이 사라졌으므로 자사 서식 경로도 비웁니다 —
      // 지워진 파일을 가리키는 경로를 남겨 두면 "무엇과 대조했는지" 를 잘못 읽습니다.
      own_form_path: null,
      status: statusAfter,
      erasure_requested_at: now,
      files_deleted_at: now,
      // 접수 행은 정리 배치가 지웁니다. 30일을 기다리지 않도록 기한을 지금으로 당깁니다.
      delete_after: now,
    });
  } catch (err) {
    console.error('erasure store failed (파일은 이미 삭제됨 · 수동 확인 필요): id=' + row.id +
      ' | 삭제한 파일 ' + deleted + '건 | ' + (err && err.message ? err.message : err));
    res.status(502).json({ error: 'store failed', filesDeleted: deleted });
    return;
  }

  // 3) 알림. 실패해도 삭제를 되돌리지 않습니다.
  await sendErasureMails({
    email: row.email,
    intakeId: row.id,
    receivedAt: row.received_at,
    filesDeleted: deleted,
    storageBucket: STORAGE_BUCKET,
    statusBefore: row.status,
    statusAfter: statusAfter,
    path: row.intake_path,
    amount: row.amount,
    orderId: row.order_id,
    paymentStatus: row.payment_status,
  });

  res.status(200).json({ ok: true, filesDeleted: deleted, erasureRequestedAt: now });
};

/* ────────────────────────────────────────────────────────────── */

async function findByToken(config, token) {
  const select = 'id,email,status,file_paths,file_count,received_at,' +
    'intake_path,order_id,amount,payment_status,erasure_requested_at';
  const response = await fetch(
    config.restUrl + '/intake?access_token=eq.' + encodeURIComponent(token) + '&select=' + select,
    { headers: config.headers }
  );

  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' | ' + (await safeText(response)).slice(0, 300) +
      ' | erasure_requested_at 컬럼이 없으면 precheck-schema.sql 의 "0-B. 삭제 요청 컬럼" 절을 실행하십시오.');
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function patchByToken(config, token, patch) {
  const response = await fetch(
    config.restUrl + '/intake?access_token=eq.' + encodeURIComponent(token),
    {
      method: 'PATCH',
      headers: Object.assign({}, config.headers, { Prefer: 'return=minimal' }),
      body: JSON.stringify(patch),
    }
  );

  if (!response.ok) {
    throw new Error('PATCH HTTP ' + response.status + ' | ' + (await safeText(response)).slice(0, 300));
  }
}

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return {}; }
}
