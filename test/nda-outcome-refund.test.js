/*
 * NDA 판정 결과 기반 자동 환불 테스트 〔E5 · api/_nda-outcome-refund.js ·
 * api/cron/refund-blocked.js〕
 *
 *   npm test        (node --test test/)
 *
 * api/_route-refund.js 와 같은 이유로 재는 것의 순서가 「돌아가는가」가 아니라
 * 「틀린 건에 돈을 움직이지 않는가」입니다. test/route-refund.test.js 와 같은
 * 구조를 그대로 따르되, 판정 표만 precheck_nda_run(outcome_kind)입니다.
 *
 *   ① 안 움직이는 경우   표를 못 읽음 · 환불 컬럼 없음 · 과금 대상으로 바뀜(reversed) ·
 *                        전달 완료 · --apply 없음  → 취소 호출 **0건**
 *   ② 움직이는 경우      not_supported/failed + 유상 + 결제완료 + 미환불 + 미전달
 *                        → 1건 · 안내메일 1통
 *   ③ 멱등              같은 날 두 번 돌아도 이미 환불된 건을 다시 취소하지 않음
 *   ④ 병합 cron          api/cron/refund-blocked.js 가 route 축과 이 축을 함께
 *                        돌리고, 한쪽이 죽어도 다른 쪽은 돈다(cron-registration
 *                        공통 규칙은 test/route-refund.test.js 쪽에서 검증됨)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

/* ── _notify.js 대역 ───────────────────────────────────────────────────────── */

const notifyPath = path.join(__dirname, '..', 'api', '_notify.js');
const mails = [];
let mailFails = false;
let cancelCount = 0;

require.cache[notifyPath] = {
  id: notifyPath,
  filename: notifyPath,
  loaded: true,
  exports: {
    RETENTION_DAYS: 30,
    buildMagicLink: (t) => 'https://trops.kr/precheck?r=' + t,
    sendIntakeMails: async () => ({ confirmationSent: true }),
    sendErasureMails: async () => ({ confirmationSent: true }),
    sendRouteRefundMail: async (info) => {
      mails.push(Object.assign({ cancelsAtSend: cancelCount }, info));
      if (mailFails) return { sent: false, error: 'resend down' };
      return { sent: true, error: null };
    },
  },
};

const OUTCOME_REFUND = require('../api/_nda-outcome-refund.js');
const OUTCOME = require('../api/_nda-outcome.js');
const cronRoute = require('../api/cron/refund-blocked.js');

const CONFIG = {
  ok: true,
  baseUrl: 'https://example.supabase.co',
  restUrl: 'https://example.supabase.co/rest/v1',
  headers: { apikey: 'k', Authorization: 'Bearer k' },
};

const PAID_ROW = {
  id: 'intake-1',
  email: 'buyer@example.com',
  access_token: 'tok_abcdefghijklmnopqrstuv',
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
 * options:
 *   missingColumns    0-F 미실행 (환불 컬럼 없음)
 *   outcomeTableFails 표가 없음 · 컬럼 이름이 다름
 *   nonChargeableIds  outcome_kind ∈ {not_supported,failed} 로 기록된 run_id 목록
 *   current           run_id → 현재 행(과금 대상으로 바뀐 상태를 만들 때 씁니다)
 *   candidates        접수 조회가 돌려줄 행 목록
 *   alreadyRefunded   이미 환불된 건으로 돌려줍니다
 */
function withFakes(options, run) {
  const opts = options || {};
  const calls = [];
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  console.error = () => {};

  const okJson = (json) => ({ ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) });
  const fail = (status, text) => ({ ok: false, status: status, json: async () => ({}), text: async () => text });

  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), method: (init && init.method) || 'GET', body: init && init.body };
    calls.push(call);

    // ① 환불 컬럼 선행 검사
    if (call.url.indexOf('select=refunded_at,refund_reason') !== -1) {
      return opts.missingColumns
        ? fail(400, '{"code":"42703","message":"column intake.refunded_at does not exist"}')
        : okJson([]);
    }

    // ② NDA 판정 결과 표
    if (call.url.indexOf('/precheck_nda_run') !== -1) {
      if (opts.outcomeTableFails) return fail(404, 'relation "precheck_nda_run" does not exist');

      if (call.url.indexOf('outcome_kind=in.') !== -1) {
        const ids = opts.nonChargeableIds || ['intake-1'];
        return okJson(ids.map((id) => ({ run_id: id })));
      }
      // 건별 현재 상태
      const match = call.url.match(/run_id=eq\.([^&]+)/);
      const id = match ? decodeURIComponent(match[1]) : '';
      const current = (opts.current || {})[id] ||
        { run_id: id, outcome_kind: 'not_supported' };
      return okJson(current === null ? [] : [current]);
    }

    // ③ 후보 접수 행 (id=in.(…))
    if (call.method === 'GET' && call.url.indexOf('/intake?id=in.') !== -1) {
      return okJson(opts.candidates === undefined ? [PAID_ROW] : opts.candidates);
    }

    // ④ api/_refund.js 의 단건 조회
    if (call.method === 'GET' && call.url.indexOf('/intake?order_id=') !== -1) {
      const row = opts.alreadyRefunded
        ? Object.assign({}, PAID_ROW, { payment_status: 'refunded', refunded_at: '2026-08-12T01:00:00Z' })
        : (opts.orderRow || PAID_ROW);
      return okJson([row]);
    }

    // ⑤ 토스 취소
    if (call.url.indexOf('/cancel') !== -1) {
      cancelCount += 1;
      return okJson({
        paymentKey: 'pk_test_1', orderId: 'precheck_abcdef', status: 'CANCELED',
        cancels: [{ cancelAmount: 99000, canceledAt: '2026-08-12T10:00:00+09:00' }],
      });
    }

    if (call.method === 'PATCH') return okJson({});
    return okJson({});
  };

  mails.length = 0;
  mailFails = false;
  cancelCount = 0;

  return Promise.resolve(run(calls)).finally(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    mailFails = false;
  });
}

const cancelCalls = (calls) => calls.filter((c) => c.url.indexOf('/cancel') !== -1);
const patchCalls = (calls) => calls.filter((c) => c.method === 'PATCH');

/* ── ① 안 움직이는 경우 ────────────────────────────────────────────────────── */

test('🔴 표를 못 읽으면 한 건도 환불하지 않는다', async () => {
  await withFakes({ outcomeTableFails: true }, async (calls) => {
    const result = await OUTCOME_REFUND.refundNonChargeableOutcomes(CONFIG, { apply: true });

    assert.strictEqual(result.available, false);
    assert.strictEqual(result.refunded, 0);
    assert.strictEqual(cancelCalls(calls).length, 0, '표를 못 읽었는데 취소를 불렀습니다');
    assert.strictEqual(patchCalls(calls).length, 0, '표를 못 읽었는데 기록을 고쳤습니다');
    assert.strictEqual(mails.length, 0);
  });
});

test('🔴 환불 컬럼(0-F)이 없으면 돈을 건드리기 전에 멈춘다', async () => {
  await withFakes({ missingColumns: true }, async (calls) => {
    await assert.rejects(
      () => OUTCOME_REFUND.refundNonChargeableOutcomes(CONFIG, { apply: true }),
      /0-F|환불 기록 컬럼/
    );
    assert.strictEqual(cancelCalls(calls).length, 0, '컬럼도 없는데 취소를 불렀습니다');
    assert.strictEqual(
      calls.filter((c) => c.url.indexOf('/precheck_nda_run') !== -1).length, 0,
      '선행 검사보다 표 조회가 먼저 나갔습니다'
    );
  });
});

test('🔴 과금 대상으로 바뀐 건은 환불하지 않는다 — 벌크 조회와 개별 환불 사이 재처리', async () => {
  await withFakes({
    nonChargeableIds: ['intake-1'],
    // 벌크 조회 때는 not_supported 였다가, 재확인 시점엔 ok 로 재처리된 상태.
    current: { 'intake-1': { run_id: 'intake-1', outcome_kind: 'ok' } },
  }, async (calls) => {
    const result = await OUTCOME_REFUND.refundNonChargeableOutcomes(CONFIG, { apply: true });

    assert.strictEqual(result.reversed, 1);
    assert.strictEqual(result.refunded, 0);
    assert.strictEqual(cancelCalls(calls).length, 0, '과금 대상으로 바뀐 건에 돈을 움직였습니다');
  });
});

test('🔴 자료를 이미 전달한 건은 자동 환불하지 않고 사람에게 넘긴다 (환불규정 §02·§03)', async () => {
  await withFakes({
    candidates: [Object.assign({}, PAID_ROW, { delivered_at: '2026-08-11T09:00:00Z', status: 'delivered' })],
  }, async (calls) => {
    const result = await OUTCOME_REFUND.refundNonChargeableOutcomes(CONFIG, { apply: true });

    assert.strictEqual(result.refunded, 0);
    assert.strictEqual(result.deferred.length, 1);
    assert.strictEqual(result.deferred[0].orderId, 'precheck_abcdef');
    assert.strictEqual(cancelCalls(calls).length, 0, '전달된 건을 코드가 판단해 환불했습니다');
    assert.strictEqual(result.failed.length, 0);
  });
});

test('--apply 없이는 아무것도 취소하지 않는다', async () => {
  await withFakes({}, async (calls) => {
    const result = await OUTCOME_REFUND.refundNonChargeableOutcomes(CONFIG, { apply: false });

    assert.strictEqual(result.candidates, 1, '미리보기인데 후보를 세지 못했습니다');
    assert.strictEqual(result.refunded, 0);
    assert.strictEqual(cancelCalls(calls).length, 0);
    assert.strictEqual(patchCalls(calls).length, 0);
    assert.strictEqual(mails.length, 0, '미리보기인데 메일이 나갔습니다');
  });
});

test('처리 불가로 기록된 건이 없으면 조회도 더 하지 않는다', async () => {
  await withFakes({ nonChargeableIds: [] }, async (calls) => {
    const result = await OUTCOME_REFUND.refundNonChargeableOutcomes(CONFIG, { apply: true });

    assert.strictEqual(result.checked, 0);
    assert.strictEqual(result.candidates, 0);
    assert.strictEqual(calls.filter((c) => c.url.indexOf('/intake?id=in.') !== -1).length, 0);
  });
});

/* ── ② 후보를 좁히는 조건 ──────────────────────────────────────────────────── */

test('후보 조회가 유상·결제완료·미환불만 고른다 — 무상 건은 애초에 안 걸린다', async () => {
  await withFakes({}, async (calls) => {
    await OUTCOME_REFUND.refundNonChargeableOutcomes(CONFIG, { apply: false });

    const query = calls.find((c) => c.url.indexOf('/intake?id=in.') !== -1);
    assert.ok(query, '후보 조회가 없습니다');
    assert.match(query.url, /intake_path=eq\.paid/);
    assert.match(query.url, /payment_status=eq\.paid/);
    assert.match(query.url, /refunded_at=is\.null/);
  });
});

/* ── ③ 움직이는 경우 ───────────────────────────────────────────────────────── */

test('not_supported · 유상 · 미전달 건을 환불하고 안내메일을 보낸다', async () => {
  await withFakes({}, async (calls) => {
    const result = await OUTCOME_REFUND.refundNonChargeableOutcomes(CONFIG, { apply: true });

    assert.strictEqual(result.refunded, 1);
    assert.strictEqual(result.notified, 1);
    assert.strictEqual(cancelCalls(calls).length, 1, '취소를 한 번만 불러야 합니다');

    const patch = JSON.parse(patchCalls(calls)[0].body);
    assert.strictEqual(patch.payment_status, 'refunded');
    assert.match(patch.refund_reason, /precheck_nda_run\.outcome_kind=not_supported/);
    assert.ok(patch.refund_reason.indexOf('등급') === -1);
    assert.ok(patch.refund_reason.indexOf('부분') === -1);
  });
});

test('안내메일은 내부 사유(outcome_kind)를 노출하지 않는 plain 문장을 쓴다', async () => {
  await withFakes({}, async () => {
    await OUTCOME_REFUND.refundNonChargeableOutcomes(CONFIG, { apply: true });

    assert.strictEqual(mails.length, 1);
    assert.strictEqual(mails[0].notice, OUTCOME.NOTICE);
    assert.strictEqual(mails[0].notice.indexOf('outcome_kind'), -1, '이용자 메일에 내부 컬럼명이 샜습니다');
    assert.strictEqual(mails[0].email, 'buyer@example.com');
    assert.match(mails[0].magicLink, /precheck\?r=tok_/);
    assert.strictEqual(mails[0].canonTable, 'precheck_nda_run');
    assert.strictEqual(mails[0].canonSourceFile, 'api/_nda-outcome-refund.js');
  });
});

test('🔴 안내메일이 실패해도 환불을 되돌리지 않는다 — 보고만 한다', async () => {
  await withFakes({}, async (calls) => {
    mailFails = true;
    const result = await OUTCOME_REFUND.refundNonChargeableOutcomes(CONFIG, { apply: true });

    assert.strictEqual(result.refunded, 1, '메일 실패로 환불이 사라졌습니다');
    assert.strictEqual(result.notified, 0);
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(cancelCalls(calls).length, 1);
  });
});

/* ── ④ 멱등 ────────────────────────────────────────────────────────────────── */

test('이미 환불된 건은 다시 취소하지 않는다 — 같은 날 두 번 돌아도 안전하다', async () => {
  await withFakes({ alreadyRefunded: true }, async (calls) => {
    const result = await OUTCOME_REFUND.refundNonChargeableOutcomes(CONFIG, { apply: true });

    assert.strictEqual(result.already, 1);
    assert.strictEqual(result.refunded, 0);
    assert.strictEqual(result.failed.length, 0, '이미 환불된 건은 실패가 아닙니다');
    assert.strictEqual(cancelCalls(calls).length, 0);
    assert.strictEqual(mails.length, 0, '이미 환불된 건에 메일을 또 보냈습니다');
  });
});

test('CLI 와 이 모듈이 같은 배치 본체를 본다', () => {
  const script = require('../scripts/refund-nda-outcome.js');
  assert.strictEqual(script.refundNonChargeableOutcomes, OUTCOME_REFUND.refundNonChargeableOutcomes);
});

/* ── ⑤ 병합 cron ───────────────────────────────────────────────────────────── */

function mockRes() {
  const captured = { code: null, body: undefined, headers: {}, ended: false };
  const res = {
    setHeader: (k, v) => { captured.headers[k.toLowerCase()] = v; },
    status: (c) => { captured.code = c; return res; },
    json: (b) => { captured.body = b; captured.ended = true; return res; },
    end: () => { captured.ended = true; return res; },
  };
  return { res: res, captured: captured };
}

const SECRET = 'test-cron-secret-0123456789';

async function invokeCron(env, headers) {
  const saved = {};
  const keys = Object.keys(env);
  for (const key of keys) {
    saved[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  const originalError = console.error;
  const originalLog = console.log;
  console.error = () => {};
  console.log = () => {};
  try {
    const { res, captured } = mockRes();
    await cronRoute({ method: 'GET', headers: headers || {} }, res);
    return captured;
  } finally {
    console.error = originalError;
    console.log = originalLog;
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test('병합 cron — nda-outcome 축도 응답에 함께 실린다', async () => {
  await withFakes({}, async () => {
    const got = await invokeCron({
      CRON_SECRET: SECRET,
      INTAKE_SUPABASE_URL: 'https://example.supabase.co',
      INTAKE_SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    }, { authorization: 'Bearer ' + SECRET });

    assert.strictEqual(got.code, 200);
    assert.strictEqual(got.body.ok, true);
    assert.ok(got.body.ndaOutcome, 'ndaOutcome 결과가 응답에 없습니다');
    assert.strictEqual(got.body.ndaOutcome.refunded, 1);
    // route 축 응답 자리(result)는 하위 호환으로 그대로 남아 있어야 합니다.
    assert.ok(got.body.result, 'route 축 result 가 사라졌습니다 — 하위 호환이 깨졌습니다');
  });
});

test('🔴 nda-outcome 표를 못 읽어도(available:false) route 축은 그대로 돈다', async () => {
  // 이 파일의 가짜 fetch 는 /precheck_intake_route 를 따로 흉내내지 않으므로
  // (route-refund.test.js 쪽이 그 표를 검증합니다) 여기서 확인할 것은
  // 「nda-outcome 이 죽어도 route 호출 자체가 막히지 않는다」— hardError 없이
  // available:true(0건)로 정상 반환되는가입니다.
  await withFakes({ outcomeTableFails: true }, async () => {
    const got = await invokeCron({
      CRON_SECRET: SECRET,
      INTAKE_SUPABASE_URL: 'https://example.supabase.co',
      INTAKE_SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    }, { authorization: 'Bearer ' + SECRET });

    // 표가 없는 것은 실패가 아닙니다 — 200 이고, route 축은 방해받지 않습니다.
    assert.strictEqual(got.code, 200);
    assert.strictEqual(got.body.ndaOutcome.available, false);
    assert.strictEqual(got.body.ndaOutcome.hardError, undefined, '표 부재는 hardError 가 아닙니다');
    assert.strictEqual(got.body.result.available, true, 'nda-outcome 표 부재가 route 축까지 멈췄습니다');
    assert.strictEqual(got.body.result.hardError, undefined);
  });
});
