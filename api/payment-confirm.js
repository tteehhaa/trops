/*
 * /precheck 결제 승인 (토스페이먼츠 confirm).
 *
 * ⚠️ 경계: 이 폴더(main_web_page)는 접수·저장·알림·결제 처리만 담당합니다.
 *    LLM 호출·상태 판정 코드를 두지 않습니다. 여기서 하는 판단은
 *    "이 결제가 승인됐는가" 하나뿐이고, 서비스 판정과는 무관합니다.
 *
 * POST /api/payment-confirm
 *   body: { paymentKey, orderId, amount }
 *   → 200 { ok:true, token, intakeId, status:'received', amount, alreadyConfirmed? }
 *
 * ⚠️ intakeId(= intake.id, uuid) 는 2026-08-13 추가 — trops_a 결과 미리보기
 *    (app.trops.kr/c/{intakeId})로 리다이렉트하기 위한 값입니다. token(access_token)과는
 *    다른 식별자입니다 — token 은 이 저장소 자신의 공식 접수 확인/매직링크(§/precheck?r=)에
 *    쓰이고, intakeId 는 trops_a 쪽 NDA 대조 미리보기 링크를 만드는 데만 씁니다. 둘을 섞지
 *    않습니다 — 미리보기는 delivered_at(환불 기준선)을 움직이지 않는 별개의 경로입니다.
 *   → 400 { error:'invalid input' | 'amount-mismatch' }
 *   → 404 { error:'order-not-found' }
 *   → 409 { error:'already-failed' }
 *   → 402 { error:'confirm-failed', code, message }   토스가 승인을 거절
 *
 * 흐름
 *   위젯 requestPayment → 토스 결제창 → successUrl 로 리다이렉트(paymentKey·orderId·amount)
 *   → 이 엔드포인트가 시크릿 키로 승인 → intake 행을 'received' 로 올리고 확인메일 발송
 *
 * ⚠️ 금액은 **DB 에 저장된 값**으로만 승인합니다.
 *    브라우저가 보낸 amount 는 대조용으로만 쓰고, 토스에 넘기지 않습니다.
 *    넘기면 위젯 요청 금액을 고쳐 싸게 결제할 수 있습니다.
 *
 * ⚠️ 승인 전에는 확인메일을 보내지 않습니다.
 *    결제를 그만둔 사람에게 "접수되었습니다" 가 가면 안 됩니다.
 */

const { readConfig, safeText } = require('./_supabase.js');
const { confirmPayment } = require('./_payment.js');
const { rejectIfChargeBlocked } = require('./_precheck-charge-gate.js');
const { buildMagicLink, sendIntakeMails } = require('./_notify.js');

const STORAGE_BUCKET = 'intake';
const ORDER_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const PAYMENT_KEY_RE = /^[A-Za-z0-9_-]{1,200}$/;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const body = parseBody(req.body);
  const paymentKey = typeof body.paymentKey === 'string' ? body.paymentKey.trim() : '';
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  const clientAmount = Number(body.amount);

  if (!PAYMENT_KEY_RE.test(paymentKey) || !ORDER_ID_RE.test(orderId) || !Number.isFinite(clientAmount)) {
    res.status(400).json({ error: 'invalid input' });
    return;
  }

  const config = readConfig();
  if (!config.ok) {
    console.error('payment-confirm config error: ' + config.error);
    res.status(503).json({ error: 'not-configured' });
    return;
  }

  // 1) 주문을 찾습니다.
  let row;
  try {
    row = await findOrder(config, orderId);
  } catch (err) {
    console.error('payment-confirm lookup failed:', err && err.message ? err.message : err);
    res.status(502).json({ error: 'lookup failed' });
    return;
  }
  if (!row) {
    res.status(404).json({ error: 'order-not-found' });
    return;
  }

  // 2) 이미 승인된 주문. 토스가 같은 successUrl 로 두 번 보내거나
  //    이용자가 화면을 새로고침하면 여기로 옵니다 — 두 번 승인하지 않고 같은 결과를 돌려줍니다.
  //    단, 결제키가 맞는 사람에게만 돌려줍니다(주문번호만으로는 토큰을 내주지 않습니다).
  if (row.payment_status === 'paid') {
    if (row.payment_key !== paymentKey) {
      res.status(400).json({ error: 'invalid input' });
      return;
    }
    res.status(200).json({
      ok: true,
      alreadyConfirmed: true,
      token: row.access_token,
      intakeId: row.id,
      status: row.status,
      amount: row.amount,
    });
    return;
  }

  if (row.payment_status !== 'pending') {
    // 'failed' 로 떨어진 주문은 다시 살리지 않습니다. 새로 접수해야 합니다.
    res.status(409).json({ error: 'already-failed', paymentStatus: row.payment_status });
    return;
  }

  // 3) 신뢰 금액은 DB 값입니다. 클라이언트 값이 다르면 승인하지 않습니다.
  const trustedAmount = Number(row.amount);
  if (clientAmount !== trustedAmount) {
    console.error('payment-confirm amount mismatch: orderId=' + orderId +
      ' | db=' + trustedAmount + ' | client=' + clientAmount);
    res.status(400).json({ error: 'amount-mismatch' });
    return;
  }

  // 🔴 과금 게이트 — 게이트웨이를 부르기 **직전** 자리입니다 〔R-2〕.
  //
  // api/intake.js 가 이미 막고 있으므로 정상 흐름은 여기까지 오지 않습니다.
  // 그런데도 여기 한 번 더 두는 이유는, 이 엔드포인트가 **직접 호출 가능**하기
  // 때문입니다 — 앞의 관문을 지나지 않고 온 요청에도 같은 답을 해야 합니다.
  // (게이트가 하나면 그 하나를 우회하는 경로가 곧 구멍입니다.)
  //
  // ⚠️ 자리가 중요합니다. 위쪽 '이미 승인된 주문' 분기보다 **뒤**입니다 —
  //    이미 돈이 오간 건의 토큰 반환까지 막으면, 결제를 마친 분이 접수 내용을
  //    못 보게 됩니다. 막아야 하는 것은 **새 청구**이지 지난 청구의 조회가 아닙니다.
  //
  // ⚠️ 알고 감수하는 것 — 결제가 **진행 중일 때** 게이트를 닫으면, 토스에서 승인(authorize)
  //    까지 갔는데 여기서 확정(confirm)을 안 하는 건이 생깁니다. 그 건은 확정되지 않은 채
  //    남고 토스가 일정 시간 뒤 자동 취소하므로 돈은 돌아갑니다. 통과시키는 쪽을 고르면
  //    차단 스위치가 「지금부터」 막지 못하게 되므로, 닫는 쪽을 택했습니다.
  if (rejectIfChargeBlocked(res, 'api/payment-confirm.js')) return;

  // 4) 승인.
  const result = await confirmPayment({
    paymentKey: paymentKey,
    orderId: orderId,
    amount: trustedAmount,
  });

  if (!result.ok) {
    console.error('payment-confirm rejected: orderId=' + orderId +
      ' | code=' + result.code + ' | message=' + result.message);
    try {
      await patchOrder(config, orderId, { payment_status: 'failed' });
    } catch (err) {
      // 여기서 실패하면 주문이 pending 으로 남아 재시도가 가능해집니다.
      // 승인이 거절된 건이라 과금 사고는 나지 않으므로 로그만 남깁니다.
      console.error('payment-confirm mark-failed error:', err && err.message ? err.message : err);
    }
    res.status(402).json({ error: 'confirm-failed', code: result.code, message: result.message });
    return;
  }

  // 5) 승인됨 — 이제부터 접수입니다.
  const paidAt = result.payment.approvedAt || new Date().toISOString();
  try {
    await patchOrder(config, orderId, {
      status: 'received',
      payment_status: 'paid',
      payment_key: result.payment.paymentKey,
      paid_at: paidAt,
    });
  } catch (err) {
    // 돈은 이미 받았는데 기록이 안 된 상태 — 사람이 반드시 손으로 맞춰야 합니다.
    console.error('payment-confirm store failed (결제는 승인됨 · 수동 확인 필요): orderId=' + orderId +
      ' | paymentKey=' + result.payment.paymentKey +
      ' | ' + (err && err.message ? err.message : err));
    res.status(502).json({ error: 'store failed', paid: true });
    return;
  }

  // 6) 알림. 실패해도 결제·접수를 되돌리지 않습니다.
  const mail = await sendIntakeMails({
    email: row.email,
    magicLink: buildMagicLink(row.access_token),
    fileCount: row.file_count,
    // 자사 서식은 file_paths 에도 들어 있습니다(삭제 경로가 그것만 훑기 때문).
    // 목록에 두 번 나오지 않도록 여기서 걷어내고 대조 기준으로만 넘깁니다.
    fileNames: (row.file_paths || []).filter((p) => p !== row.own_form_path).map(basename),
    ownFormName: row.own_form_path ? basename(row.own_form_path) : null,
    // 유료 건도 무상 건과 같은 확인메일을 받습니다. 접수 때 거래 정보를 넣으셨다면
    // 여기서도 협정 세율 항목이 붙어야 합니다 — 넘기지 않으면 결제한 쪽만 빠집니다.
    targetCountry: row.target_country || null,
    hsCode: row.hs_code || null,
    consentTraining: row.consent_training === true,
    receivedAt: row.received_at,
    intakeId: row.id,
    storageBucket: STORAGE_BUCKET,
    path: 'paid',
    amount: trustedAmount,
    orderId: orderId,
    paymentKey: result.payment.paymentKey,
    method: result.payment.method,
  });

  res.status(200).json({
    ok: true,
    token: row.access_token,
    intakeId: row.id,
    status: 'received',
    amount: trustedAmount,
    mailed: mail.confirmationSent,
  });
};

/* ────────────────────────────────────────────────────────────── */

async function findOrder(config, orderId) {
  const select = 'id,email,file_count,file_paths,own_form_path,consent_training,received_at,' +
    'access_token,status,amount,payment_status,payment_key,target_country,hs_code';
  const response = await fetch(
    config.restUrl + '/intake?order_id=eq.' + encodeURIComponent(orderId) + '&select=' + select,
    { headers: config.headers }
  );

  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' | ' + (await safeText(response)).slice(0, 300) +
      ' | order_id 컬럼이 없으면 precheck-schema.sql 의 결제 컬럼 추가분을 실행하십시오.');
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function patchOrder(config, orderId, patch) {
  const response = await fetch(
    config.restUrl + '/intake?order_id=eq.' + encodeURIComponent(orderId),
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

function basename(path) {
  const parts = String(path).split('/');
  return parts[parts.length - 1] || String(path);
}

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return {}; }
}
