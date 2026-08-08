/*
 * /precheck 결제 승인 (토스페이먼츠 confirm).
 *
 * ⚠️ 경계: 이 폴더(main_web_page)는 접수·저장·알림·결제 처리만 담당합니다.
 *    LLM 호출·상태 판정 코드를 두지 않습니다. 여기서 하는 판단은
 *    "이 결제가 승인됐는가" 하나뿐이고, 서비스 판정과는 무관합니다.
 *
 * POST /api/payment-confirm
 *   body: { paymentKey, orderId, amount }
 *   → 200 { ok:true, token, status:'received', amount, alreadyConfirmed? }
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
    status: 'received',
    amount: trustedAmount,
    mailed: mail.confirmationSent,
  });
};

/* ────────────────────────────────────────────────────────────── */

async function findOrder(config, orderId) {
  const select = 'id,email,file_count,file_paths,own_form_path,consent_training,received_at,' +
    'access_token,status,amount,payment_status,payment_key';
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
