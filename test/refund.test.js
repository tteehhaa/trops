/*
 * 환불 실행 테스트 〔M-3 · api/_refund.js · scripts/refund.js〕
 *
 *   npm test        (node --test test/)
 *
 * 접수 뒤에 판별이 「불가」로 뒤집힌 건을 환불하는 경로입니다.
 * **판단은 사람이 하고 실행은 코드가 합니다** — 그래서 여기서 재는 것은
 * 「환불해야 하는가」가 아니라 「시킨 환불이 틀리지 않게 실행되는가」입니다.
 *
 * 재는 것 넷:
 *   ① 순서    환불 컬럼이 없으면 **돈을 건드리기 전에** 멈추는가
 *   ② 실행    취소 API 를 정확히 한 번 부르고, DB 에 사유·시각을 남기는가
 *   ③ 멱등    이미 환불된 건에 다시 돌려도 취소 호출이 0건인가
 *   ④ 안전    --apply 없이는 아무것도 취소하지 않는가 ·
 *             전달된 건의 status 를 덮지 않는가
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const REFUND = require('../api/_refund.js');

const CONFIG = {
  ok: true,
  baseUrl: 'https://example.supabase.co',
  restUrl: 'https://example.supabase.co/rest/v1',
  headers: { apikey: 'k', Authorization: 'Bearer k' },
};

const PAID_ROW = {
  id: 'row-1',
  email: 'buyer@example.com',
  order_id: 'precheck_abcdef',
  amount: 99000,
  status: 'received',
  payment_status: 'paid',
  payment_key: 'pk_test_1',
  paid_at: '2026-08-11T00:00:00+09:00',
  delivered_at: null,
  refunded_at: null,
  refund_reason: null,
};

/**
 * 가짜 Supabase · 가짜 토스.
 *
 * ⚠️ 토스 취소 URL 로 나가는 요청을 따로 셉니다 — 「돈이 움직였나」를
 *    응답 코드가 아니라 그 숫자로 말합니다.
 */
function withFakes(run, options) {
  const opts = options || {};
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), method: (init && init.method) || 'GET', body: init && init.body,
      headers: (init && init.headers) || {} };
    calls.push(call);

    const okJson = (json) => ({ ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) });
    const fail = (status, text) => ({ ok: false, status: status, json: async () => ({}), text: async () => text });

    // 선행 검사 — 환불 컬럼 존재 확인
    if (call.url.indexOf('select=refunded_at,refund_reason') !== -1) {
      return opts.missingColumns
        ? fail(400, '{"code":"42703","message":"column intake.refunded_at does not exist"}')
        : okJson([]);
    }
    if (call.method === 'GET' && call.url.indexOf('/intake?order_id=') !== -1) {
      return okJson(opts.row === null ? [] : [opts.row || PAID_ROW]);
    }
    if (call.url.indexOf('/cancel') !== -1) {
      if (opts.cancelRejects) return fail(400, '{"code":"ALREADY_CANCELED_PAYMENT","message":"이미 취소된 결제입니다."}');
      return okJson({
        paymentKey: 'pk_test_1', orderId: 'precheck_abcdef', status: 'CANCELED',
        cancels: [{ cancelAmount: 99000, canceledAt: '2026-08-11T10:00:00+09:00' }],
      });
    }
    if (call.method === 'PATCH') {
      return opts.patchFails ? fail(400, 'patch failed') : okJson({});
    }
    return okJson({});
  };

  return Promise.resolve(run(calls)).finally(() => { globalThis.fetch = originalFetch; });
}

const cancelCalls = (calls) => calls.filter((c) => c.url.indexOf('/cancel') !== -1);
const patchCalls = (calls) => calls.filter((c) => c.method === 'PATCH');
const logs = () => { const out = []; out.log = (m) => out.push(String(m)); return out; };

/* ── ① 순서 — 돈을 건드리기 전에 멈춘다 ───────────────────────────────────── */

test('환불 컬럼이 없으면 취소하기 전에 멈춘다', async () => {
  await withFakes(async (calls) => {
    const out = logs();
    await assert.rejects(
      () => REFUND.refundOrder(CONFIG, { orderId: PAID_ROW.order_id, reason: '판별 불가', apply: true, log: out.log }),
      (err) => /0-F/.test(err.message)
    );
    // 🔴 이 단정이 핵심입니다. 선행 검사가 뒤에 있으면 「취소는 됐는데
    //    기록이 안 되는」 상태가 만들어집니다.
    assert.deepStrictEqual(cancelCalls(calls), [], '컬럼도 없는데 돈을 먼저 움직였습니다');
  }, { missingColumns: true });
});

/* ── ② 실행 ───────────────────────────────────────────────────────────────── */

test('환불 — 취소 1회 · 사유와 시각을 남긴다', async () => {
  await withFakes(async (calls) => {
    const out = logs();
    const result = await REFUND.refundOrder(CONFIG, {
      orderId: PAID_ROW.order_id, reason: '판별 불가 — 대조할 글자가 없음', apply: true, log: out.log,
    });

    assert.strictEqual(result.outcome, 'refunded');
    assert.strictEqual(cancelCalls(calls).length, 1, '취소 호출이 정확히 한 번이어야 합니다');

    const cancel = cancelCalls(calls)[0];
    assert.match(cancel.url, /\/payments\/pk_test_1\/cancel$/);
    assert.strictEqual(JSON.parse(cancel.body).cancelReason, '판별 불가 — 대조할 글자가 없음');
    assert.ok(cancel.headers['Idempotency-Key'], '멱등키가 없으면 두 번 돌릴 때 두 번 취소됩니다');

    const patch = JSON.parse(patchCalls(calls)[0].body);
    assert.strictEqual(patch.payment_status, 'refunded');
    assert.strictEqual(patch.refunded_at, '2026-08-11T10:00:00+09:00');
    assert.strictEqual(patch.refund_reason, '판별 불가 — 대조할 글자가 없음');
    assert.strictEqual(patch.status, 'cancelled');

    // 이용자 안내가 아직 자동이 아니라는 사실을 사람이 보게 남깁니다.
    assert.ok(out.some((m) => m.indexOf('buyer@example.com') !== -1),
      '누구에게 알려야 하는지 출력에 남지 않았습니다');
  });
});

test('전달까지 끝난 건은 status 를 덮지 않는다 — 환불 기준선이 지워진다', async () => {
  await withFakes(async (calls) => {
    const result = await REFUND.refundOrder(CONFIG, {
      orderId: PAID_ROW.order_id, reason: '판별 불가', apply: true, log: logs().log,
    });
    assert.strictEqual(result.outcome, 'refunded');
    const patch = JSON.parse(patchCalls(calls)[0].body);
    assert.strictEqual(patch.status, undefined, '「보냈다」는 사실을 지우면 §02 기준선이 사라집니다');
    assert.strictEqual(patch.payment_status, 'refunded');
  }, {
    row: Object.assign({}, PAID_ROW, { status: 'delivered', delivered_at: '2026-08-11T09:00:00+09:00' }),
  });
});

test('취소가 거절되면 기록을 건드리지 않는다', async () => {
  await withFakes(async (calls) => {
    const result = await REFUND.refundOrder(CONFIG, {
      orderId: PAID_ROW.order_id, reason: '판별 불가', apply: true, log: logs().log,
    });
    assert.strictEqual(result.outcome, 'cancel-failed');
    assert.deepStrictEqual(patchCalls(calls), [], '취소가 안 됐는데 환불로 기록했습니다');
  }, { cancelRejects: true });
});

test('취소는 됐는데 기록이 실패하면 크게 남긴다 — 사람이 맞춰야 하는 상태', async () => {
  await withFakes(async () => {
    const out = logs();
    const result = await REFUND.refundOrder(CONFIG, {
      orderId: PAID_ROW.order_id, reason: '판별 불가', apply: true, log: out.log,
    });
    assert.strictEqual(result.outcome, 'store-failed');
    assert.ok(out.some((m) => m.indexOf('pk_test_1') !== -1),
      '수동으로 맞출 때 필요한 결제키가 출력에 없습니다');
  }, { patchFails: true });
});

/* ── ⑤ 안내메일 〔M-3 후속 · 2026-08-12〕 ──────────────────────────────────── */

test('환불 완료 뒤 이용자에게 안내 메일을 보낸다', async () => {
  const NOTIFY = require('../api/_notify.js');
  const original = NOTIFY.sendManualRefundMail;
  const sent = [];
  NOTIFY.sendManualRefundMail = async (info) => { sent.push(info); return { sent: true, error: null }; };

  try {
    await withFakes(async () => {
      const result = await REFUND.refundOrder(CONFIG, {
        orderId: PAID_ROW.order_id, reason: '판별 불가 — 이용자 요청', apply: true, log: logs().log,
      });
      assert.strictEqual(result.outcome, 'refunded');
      assert.strictEqual(result.notified, true);
    });
    assert.strictEqual(sent.length, 1, '환불 완료 뒤 안내 메일 발송을 부르지 않았습니다');
    assert.strictEqual(sent[0].email, 'buyer@example.com');
    assert.strictEqual(sent[0].orderId, 'precheck_abcdef');
    assert.strictEqual(sent[0].reason, '판별 불가 — 이용자 요청');
  } finally {
    NOTIFY.sendManualRefundMail = original;
  }
});

test('notify:false 로 부르면 안내 메일을 보내지 않는다 — api/_route-refund.js 가 자체 메일을 쓰는 경로', async () => {
  const NOTIFY = require('../api/_notify.js');
  const original = NOTIFY.sendManualRefundMail;
  const sent = [];
  NOTIFY.sendManualRefundMail = async (info) => { sent.push(info); return { sent: true, error: null }; };

  try {
    await withFakes(async () => {
      const result = await REFUND.refundOrder(CONFIG, {
        orderId: PAID_ROW.order_id, reason: '판별 불가', apply: true, notify: false, log: logs().log,
      });
      assert.strictEqual(result.outcome, 'refunded');
      assert.strictEqual(result.notified, undefined);
    });
    assert.strictEqual(sent.length, 0, 'notify:false 인데 안내 메일을 보냈습니다');
  } finally {
    NOTIFY.sendManualRefundMail = original;
  }
});

test('🔴 안내 메일이 실패해도 환불 결과는 그대로다 — 돈은 이미 돌아갔다', async () => {
  const NOTIFY = require('../api/_notify.js');
  const original = NOTIFY.sendManualRefundMail;
  NOTIFY.sendManualRefundMail = async () => { throw new Error('resend down'); };

  try {
    await withFakes(async (calls) => {
      const out = logs();
      const result = await REFUND.refundOrder(CONFIG, {
        orderId: PAID_ROW.order_id, reason: '판별 불가', apply: true, log: out.log,
      });
      assert.strictEqual(result.outcome, 'refunded', '메일 실패가 환불 결과를 바꿨습니다');
      assert.strictEqual(result.notified, false);
      assert.strictEqual(patchCalls(calls).length, 1, '메일 실패로 기록까지 건너뛰면 안 됩니다');
      assert.ok(out.some((m) => m.indexOf('발송에 실패') !== -1));
    });
  } finally {
    NOTIFY.sendManualRefundMail = original;
  }
});

/* ── ③ 멱등 ───────────────────────────────────────────────────────────────── */

test('이미 환불된 건은 다시 취소하지 않는다', async () => {
  await withFakes(async (calls) => {
    const result = await REFUND.refundOrder(CONFIG, {
      orderId: PAID_ROW.order_id, reason: '판별 불가', apply: true, log: logs().log,
    });
    assert.strictEqual(result.outcome, 'already');
    assert.deepStrictEqual(cancelCalls(calls), []);
    assert.deepStrictEqual(patchCalls(calls), []);
  }, {
    row: Object.assign({}, PAID_ROW, {
      payment_status: 'refunded', refunded_at: '2026-08-11T10:00:00+09:00', refund_reason: '판별 불가',
    }),
  });
});

test('결제되지 않은 건에는 환불할 것이 없다', async () => {
  await withFakes(async (calls) => {
    const result = await REFUND.refundOrder(CONFIG, {
      orderId: 'precheck_free', reason: '판별 불가', apply: true, log: logs().log,
    });
    assert.strictEqual(result.outcome, 'not-paid');
    assert.deepStrictEqual(cancelCalls(calls), []);
  }, { row: Object.assign({}, PAID_ROW, { payment_status: 'none', payment_key: null, amount: 0 }) });
});

test('없는 주문번호는 not-found', async () => {
  await withFakes(async (calls) => {
    const result = await REFUND.refundOrder(CONFIG, {
      orderId: 'precheck_nope', reason: '판별 불가', apply: true, log: logs().log,
    });
    assert.strictEqual(result.outcome, 'not-found');
    assert.deepStrictEqual(cancelCalls(calls), []);
  }, { row: null });
});

/* ── ④ 안전 — 기본이 미리보기 ─────────────────────────────────────────────── */

test('--apply 없이는 아무것도 취소하지 않는다', async () => {
  await withFakes(async (calls) => {
    const out = logs();
    const result = await REFUND.refundOrder(CONFIG, {
      orderId: PAID_ROW.order_id, reason: '판별 불가', apply: false, log: out.log,
    });
    assert.strictEqual(result.outcome, 'would-refund');
    assert.deepStrictEqual(cancelCalls(calls), []);
    assert.deepStrictEqual(patchCalls(calls), []);
    assert.ok(out.some((m) => m.indexOf('[미리보기]') !== -1));
  });
});

/* ── CLI 껍데기 ───────────────────────────────────────────────────────────── */

test('CLI 인자 — 사유가 주문번호로 새지 않는다', () => {
  const { parseArgs } = require('../scripts/refund.js');

  assert.deepStrictEqual(parseArgs(['precheck_abcdef', '--reason', '판별 불가', '--apply']),
    { apply: true, reason: '판별 불가', orderId: 'precheck_abcdef' });

  // --reason 이 먼저 와도 그 다음 낱말은 사유입니다.
  assert.deepStrictEqual(parseArgs(['--reason', '판별 불가', 'precheck_abcdef']),
    { apply: false, reason: '판별 불가', orderId: 'precheck_abcdef' });

  // 사유와 같은 낱말이 두 번 나와도 어긋나지 않습니다.
  assert.deepStrictEqual(parseArgs(['--reason', 'precheck_abcdef', 'precheck_abcdef']),
    { apply: false, reason: 'precheck_abcdef', orderId: 'precheck_abcdef' });
});

test('CLI — 사유 없이 돌리면 거절한다 · 종료코드 2', async () => {
  const { main } = require('../scripts/refund.js');
  const originalError = console.error;
  const originalLog = console.log;
  console.error = () => {};
  console.log = () => {};
  try {
    assert.strictEqual(await main(['precheck_abcdef', '--apply']), 2,
      '사유 없는 환불을 허용하면 나중에 왜 돌려줬는지 아무도 모릅니다');
    assert.strictEqual(await main([]), 2);
  } finally {
    console.error = originalError;
    console.log = originalLog;
  }
});
