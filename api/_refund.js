/*
 * /precheck 환불 실행 — 배치 본체 〔M-3 · 신설 2026-08-11〕
 *
 * ⚠️ 경계 (반드시 지킬 것)
 *   이 폴더(main_web_page)는 접수·저장·알림·결제 처리만 담당합니다.
 *   **이 파일에는 「환불해야 하는가」가 없습니다.** 그 판단은 사람이 하고,
 *   그 사람이 근거로 삼는 「판별이 뒤집혔다」는 사실은 뒷단(trops_a)·검수에서
 *   나옵니다. 여기 있는 것은 시키는 환불을 **틀리지 않게 실행하는 순서**뿐입니다.
 *
 * 파일명이 밑줄로 시작하므로 Vercel 은 이 파일을 엔드포인트로 만들지 않습니다.
 *
 * ── 🔴 왜 자동이 아니라 수동인가 〔환불 트리거 설계 · 결정 근거〕 ───────────────
 *
 * 「접수 후 판별이 뒤집혀 불가가 드러나면 환불한다」를 **자동**으로 하려면 이
 * 저장소가 「뒤집혔다」를 알아야 합니다. 그것을 알 방법이 지금 없습니다 —
 * 처리 등급을 받아오는 인터페이스가 trops_a 와 아직 없습니다(같은 이유로 M-2 가
 * 스코프 아웃됐습니다 · docs/verify/2026-08-11-batch-c2.md).
 *
 * 없는 인터페이스를 메우려고 이 저장소가 「불가인지」를 스스로 정하기 시작하면
 * 그것이 곧 이중구현이고 경계 위반입니다. 그래서 **판단은 사람, 실행은 코드**로
 * 갈랐습니다.
 *
 * ⛔ 그렇다고 「토스 대시보드에서 손으로 취소」로 두지 않았습니다. 그렇게 하면
 *    돈은 돌아가지만 우리 DB 는 여전히 payment_status='paid' 입니다 —
 *    이용자의 접수 확인 화면이 「결제 완료」를 계속 보여 주고(api/intake.js
 *    handleReceipt), 30일 정리·환불 이력 어디에도 근거가 남지 않습니다.
 *    **돈과 기록이 갈라지는 것이 수동 취소의 실제 위험입니다.** 이 스크립트가
 *    그 둘을 한 번에 묶습니다.
 *
 * ── 트리거 지점 ─────────────────────────────────────────────────────────────
 *   node --env-file=.env.local scripts/refund.js <orderId> --reason "…"
 *   node --env-file=.env.local scripts/refund.js <orderId> --reason "…" --apply
 *
 *   --apply 없이는 아무것도 취소하지 않습니다(scripts/cleanup-expired.js 와 같은 양식).
 *
 * ── 순서가 설계다 ───────────────────────────────────────────────────────────
 *   ① 선행 검사  환불 컬럼(refunded_at·refund_reason)이 있는지 **돈을 건드리기
 *                전에** 확인합니다. 뒤에 두면 「취소는 됐는데 기록이 안 되는」
 *                상태가 만들어집니다.
 *   ② 상태 확인  payment_status='paid' 이고 payment_key 가 있는 건만.
 *                이미 'refunded' 면 아무것도 하지 않고 그렇게 말합니다.
 *   ③ 취소       토스에 멱등키를 붙여 전액 취소.
 *   ④ 기록       payment_status='refunded' · refunded_at · refund_reason ·
 *                status='cancelled'.
 *   ⑤ 남는 일    이용자에게 보내는 안내 메일은 아직 자동이 아닙니다 —
 *                스크립트가 출력으로 그 사실을 알립니다.
 */

'use strict';

const { safeText } = require('./_supabase.js');
const { cancelPayment } = require('./_payment.js');

/** 환불 기록 컬럼이 있는지 확인합니다. 없으면 돈을 건드리지 않고 멈춥니다. */
async function assertRefundColumns(config) {
  const response = await fetch(
    config.restUrl + '/intake?select=refunded_at,refund_reason&limit=1',
    { headers: config.headers }
  );
  if (response.ok) return;

  const detail = (await safeText(response)).slice(0, 300);
  throw new Error(
    '환불 기록 컬럼을 읽지 못했습니다 (HTTP ' + response.status + ') — ' + detail +
    '\n   precheck-schema.sql 의 「0-F. 환불 기록 컬럼」 절을 Supabase SQL Editor 에서 먼저 실행하십시오.' +
    '\n   (돈을 건드리기 전에 멈췄습니다 — 취소는 아직 하지 않았습니다)'
  );
}

async function findOrder(config, orderId) {
  const select = 'id,email,order_id,amount,status,payment_status,payment_key,paid_at,' +
    'delivered_at,refunded_at,refund_reason';
  const response = await fetch(
    config.restUrl + '/intake?order_id=eq.' + encodeURIComponent(orderId) + '&select=' + select,
    { headers: config.headers }
  );
  if (!response.ok) {
    throw new Error('주문 조회 실패 (HTTP ' + response.status + ') — ' +
      (await safeText(response)).slice(0, 300));
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
    throw new Error('PATCH HTTP ' + response.status + ' | ' +
      (await safeText(response)).slice(0, 300));
  }
}

/**
 * 한 건을 환불합니다.
 *
 * options: { orderId, reason, apply, log }
 * 돌려주는 값의 outcome:
 *   'not-found'      그 주문번호가 없습니다
 *   'not-paid'       결제되지 않은 건입니다(환불할 것이 없습니다)
 *   'already'        이미 환불된 건입니다 — 아무것도 하지 않았습니다
 *   'would-refund'   --apply 없이 돌린 미리보기입니다
 *   'refunded'       취소와 기록이 모두 끝났습니다
 *   'cancel-failed'  토스가 취소를 거절했습니다(기록은 건드리지 않았습니다)
 *   'store-failed'   🔴 돈은 돌아갔는데 기록이 안 됐습니다 — 사람이 맞춰야 합니다
 */
async function refundOrder(config, options) {
  const log = options.log || (() => {});
  const orderId = options.orderId;
  const reason = options.reason;

  await assertRefundColumns(config);

  const row = await findOrder(config, orderId);
  if (!row) {
    log('그 주문번호가 없습니다: ' + orderId);
    return { outcome: 'not-found' };
  }

  if (row.payment_status === 'refunded' || row.refunded_at) {
    log('이미 환불된 건입니다 — ' + orderId +
      ' | 환불시각=' + (row.refunded_at || '기록없음') +
      ' | 사유=' + (row.refund_reason || '기록없음'));
    return { outcome: 'already', row: row };
  }

  if (row.payment_status !== 'paid' || !row.payment_key) {
    log('결제된 건이 아닙니다 — ' + orderId + ' | payment_status=' + row.payment_status +
      ' | 환불할 것이 없습니다.');
    return { outcome: 'not-paid', row: row };
  }

  log('대상 — ' + orderId + ' | 금액=' + row.amount + '원 | 결제시각=' + row.paid_at +
    ' | 전달시각=' + (row.delivered_at || '아직 전달 전'));

  if (!options.apply) {
    log('[미리보기] --apply 를 붙이면 위 건을 전액 취소하고 환불로 기록합니다.');
    return { outcome: 'would-refund', row: row };
  }

  const result = await cancelPayment({
    paymentKey: row.payment_key,
    reason: reason,
    // 부분 취소를 쓰지 않습니다 — 환불규정 §02 가 전액을 말합니다.
  });

  if (!result.ok) {
    log('취소가 거절됐습니다 — code=' + result.code + ' | ' + result.message +
      '\n   기록은 건드리지 않았습니다. 사유를 확인한 뒤 다시 돌리십시오.');
    return { outcome: 'cancel-failed', error: result };
  }

  const patch = {
    payment_status: 'refunded',
    refunded_at: result.cancel.cancelledAt,
    refund_reason: reason,
  };
  /*
   * 전달까지 끝난 건은 status 를 건드리지 않습니다.
   * 'delivered' 를 'cancelled' 로 덮으면 「보냈다」는 사실이 지워지고,
   * 그 사실이 환불규정 §02 의 기준선입니다(delivered_at 과 짝입니다).
   */
  if (row.status !== 'delivered') patch.status = 'cancelled';

  try {
    await patchOrder(config, orderId, patch);
  } catch (err) {
    log('🔴 취소는 됐는데 기록이 안 됐습니다 — 사람이 반드시 맞춰야 합니다.' +
      '\n   orderId=' + orderId + ' | paymentKey=' + row.payment_key +
      '\n   ' + (err && err.message ? err.message : err));
    return { outcome: 'store-failed', cancel: result.cancel, error: err };
  }

  log('환불 완료 — ' + orderId + ' | 취소금액=' +
    (result.cancel.cancelledAmount != null ? result.cancel.cancelledAmount + '원' : '전액') +
    ' | 시각=' + result.cancel.cancelledAt);
  log('⚠️ 이용자에게 보내는 안내 메일은 아직 자동이 아닙니다 — ' + row.email +
    ' 로 사유를 알려 주십시오.');

  return { outcome: 'refunded', row: row, cancel: result.cancel };
}

module.exports = {
  refundOrder: refundOrder,
  assertRefundColumns: assertRefundColumns,
};
