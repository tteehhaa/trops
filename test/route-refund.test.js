/*
 * 「범위 밖」 자동 환불 테스트 〔M-2 · api/_route-refund.js · api/cron/refund-blocked.js〕
 *
 *   npm test        (node --test test/)
 *
 * 이 배치는 **돈을 움직입니다.** 그래서 재는 것의 순서가 「돌아가는가」가 아니라
 * 「틀린 건에 돈을 움직이지 않는가」입니다.
 *
 *   ① 안 움직이는 경우   표를 못 읽음 · 환불 컬럼 없음 · 되돌려짐 · 전달 완료 ·
 *                        --apply 없음  → 취소 호출 **0건**
 *   ② 움직이는 경우      blocked + 유상 + 결제완료 + 미환불 + 미전달 → 1건 · 안내메일 1통
 *   ③ 멱등              같은 날 두 번 돌아도 이미 환불된 건을 다시 취소하지 않음
 *   ④ 라우트            인증·미설정·부분 실패의 응답 (cron 공통 규칙은
 *                        test/cron-registration.test.js 가 전 라우트에 겁니다)
 *
 * 🔴 「취소 호출 0건」은 응답 코드가 아니라 **가짜 토스로 나간 요청 수**로 셉니다.
 *    응답만 보면 「막았다고 말하면서 이미 취소한」 상태를 지나칩니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

/* ── _notify.js 대역 ───────────────────────────────────────────────────────── */

const notifyPath = path.join(__dirname, '..', 'api', '_notify.js');
const mails = [];
let mailFails = false;

/**
 * 취소 호출 수. 메일 대역이 **보내는 순간의 값**을 함께 기록합니다 —
 * 「환불 뒤에 메일」이라는 순서를 응답이 아니라 이 숫자로 단정합니다.
 */
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

const ROUTE_REFUND = require('../api/_route-refund.js');
const ROUTE = require('../api/_intake-route.js');
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
 *   missingColumns  0-F 미실행 (환불 컬럼 없음)
 *   routeTableFails 표가 없음 · 컬럼 이름이 다름
 *   blockedIds      route='blocked' 로 기록된 id 목록
 *   latest          intake_id → 현재 행 (되돌림을 만들 때 씁니다)
 *   candidates      접수 조회가 돌려줄 행 목록
 *   alreadyRefunded 이미 환불된 건으로 돌려줍니다
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

    // ② 처리 가능 여부 표
    if (call.url.indexOf('/precheck_intake_route') !== -1) {
      if (opts.routeTableFails) return fail(404, 'relation "precheck_intake_route" does not exist');

      if (call.url.indexOf('route=eq.blocked') !== -1) {
        const ids = opts.blockedIds || ['intake-1'];
        return okJson(ids.map((id) => ({ intake_id: id, decided_at: '2026-08-12T00:00:00Z' })));
      }
      // 건별 현재 상태
      const match = call.url.match(/intake_id=eq\.([^&]+)/);
      const id = match ? decodeURIComponent(match[1]) : '';
      const latest = (opts.latest || {})[id] ||
        { route: 'blocked', reason: 'scan-only', decided_at: '2026-08-12T00:00:00Z' };
      return okJson(latest === null ? [] : [latest]);
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

test('🔴 표를 못 읽으면 한 건도 환불하지 않는다 — 「표가 없다」는 「환불할 것이 없다」가 아니다', async () => {
  await withFakes({ routeTableFails: true }, async (calls) => {
    const result = await ROUTE_REFUND.refundBlockedRoutes(CONFIG, { apply: true });

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
      () => ROUTE_REFUND.refundBlockedRoutes(CONFIG, { apply: true }),
      /0-F|환불 기록 컬럼/
    );
    assert.strictEqual(cancelCalls(calls).length, 0, '컬럼도 없는데 취소를 불렀습니다');
    // 표를 읽으러 가기도 전에 멈춰야 합니다 — 순서가 설계입니다.
    assert.strictEqual(
      calls.filter((c) => c.url.indexOf('/precheck_intake_route') !== -1).length, 0,
      '선행 검사보다 표 조회가 먼저 나갔습니다'
    );
  });
});

test('🔴 되돌려진 건은 환불하지 않는다 — append-only 라 blocked 행이 남아 있다', async () => {
  await withFakes({
    blockedIds: ['intake-1'],
    // 어제 blocked 였다가 오늘 ok 로 되돌려진 상태.
    latest: { 'intake-1': { route: 'ok', reason: null, decided_at: '2026-08-12T09:00:00Z' } },
  }, async (calls) => {
    const result = await ROUTE_REFUND.refundBlockedRoutes(CONFIG, { apply: true });

    assert.strictEqual(result.reversed, 1);
    assert.strictEqual(result.refunded, 0);
    assert.strictEqual(cancelCalls(calls).length, 0, '되돌려진 건에 돈을 움직였습니다');
  });
});

test('🔴 자료를 이미 전달한 건은 자동 환불하지 않고 사람에게 넘긴다 (환불규정 §02·§03)', async () => {
  await withFakes({
    candidates: [Object.assign({}, PAID_ROW, { delivered_at: '2026-08-11T09:00:00Z', status: 'delivered' })],
  }, async (calls) => {
    const result = await ROUTE_REFUND.refundBlockedRoutes(CONFIG, { apply: true });

    assert.strictEqual(result.refunded, 0);
    assert.strictEqual(result.deferred.length, 1);
    assert.strictEqual(result.deferred[0].orderId, 'precheck_abcdef');
    assert.strictEqual(cancelCalls(calls).length, 0, '전달된 건을 코드가 판단해 환불했습니다');
    // deferred 는 실패가 아닙니다 — 설계대로 넘긴 것입니다.
    assert.strictEqual(result.failed.length, 0);
  });
});

test('--apply 없이는 아무것도 취소하지 않는다', async () => {
  await withFakes({}, async (calls) => {
    const result = await ROUTE_REFUND.refundBlockedRoutes(CONFIG, { apply: false });

    assert.strictEqual(result.candidates, 1, '미리보기인데 후보를 세지 못했습니다');
    assert.strictEqual(result.refunded, 0);
    assert.strictEqual(cancelCalls(calls).length, 0);
    assert.strictEqual(patchCalls(calls).length, 0);
    assert.strictEqual(mails.length, 0, '미리보기인데 메일이 나갔습니다');
  });
});

test('처리 불가로 기록된 건이 없으면 조회도 더 하지 않는다', async () => {
  await withFakes({ blockedIds: [] }, async (calls) => {
    const result = await ROUTE_REFUND.refundBlockedRoutes(CONFIG, { apply: true });

    assert.strictEqual(result.checked, 0);
    assert.strictEqual(result.candidates, 0);
    assert.strictEqual(calls.filter((c) => c.url.indexOf('/intake?id=in.') !== -1).length, 0);
  });
});

test('상한까지 찬 날은 그 사실을 말한다 — 조용히 자르지 않는다', async () => {
  const many = Array.from({ length: 4 }, (_, i) => 'intake-' + i);
  const lines = [];

  await withFakes({ blockedIds: many, candidates: [] }, async () => {
    // 상한을 4로 낮춰 「상한에 닿은 날」을 만듭니다.
    const result = await ROUTE_REFUND.refundBlockedRoutes(CONFIG, {
      apply: true, limit: 4, log: (m) => lines.push(m),
    });
    assert.strictEqual(result.truncated, true);
    assert.ok(lines.some((l) => l.indexOf('상한') !== -1), '상한에 닿은 사실을 말하지 않았습니다');
  });

  // 상한에 닿지 않은 날은 조용합니다.
  await withFakes({ blockedIds: ['intake-1'], candidates: [] }, async () => {
    const result = await ROUTE_REFUND.refundBlockedRoutes(CONFIG, { apply: true, limit: 4 });
    assert.strictEqual(result.truncated, false);
  });
});

/* ── ② 후보를 좁히는 조건 ──────────────────────────────────────────────────── */

test('후보 조회가 유상·결제완료·미환불만 고른다 — 무상 건은 애초에 안 걸린다', async () => {
  await withFakes({}, async (calls) => {
    await ROUTE_REFUND.refundBlockedRoutes(CONFIG, { apply: false });

    const query = calls.find((c) => c.url.indexOf('/intake?id=in.') !== -1);
    assert.ok(query, '후보 조회가 없습니다');
    assert.match(query.url, /intake_path=eq\.paid/);
    assert.match(query.url, /payment_status=eq\.paid/);
    assert.match(query.url, /refunded_at=is\.null/);
  });
});

/* ── ③ 움직이는 경우 ───────────────────────────────────────────────────────── */

test('blocked · 유상 · 미전달 건을 환불하고 안내메일을 보낸다', async () => {
  await withFakes({}, async (calls) => {
    const result = await ROUTE_REFUND.refundBlockedRoutes(CONFIG, { apply: true });

    assert.strictEqual(result.refunded, 1);
    assert.strictEqual(result.notified, 1);
    assert.strictEqual(cancelCalls(calls).length, 1, '취소를 한 번만 불러야 합니다');

    // 사유가 기록에 남는가 — 표 이름과 사유 코드가 함께 있어야 사람이 되짚을 수 있습니다.
    const patch = JSON.parse(patchCalls(calls)[0].body);
    assert.strictEqual(patch.payment_status, 'refunded');
    assert.match(patch.refund_reason, /precheck_intake_route\.reason=scan-only/);
    // 「등급」·「부분」은 내부 기록에도 쓰지 않습니다 (C2).
    assert.ok(patch.refund_reason.indexOf('등급') === -1);
    assert.ok(patch.refund_reason.indexOf('부분') === -1);
  });
});

test('안내메일에 사유 문면이 그대로 실린다 — 화면과 같은 문장이다', async () => {
  await withFakes({}, async () => {
    await ROUTE_REFUND.refundBlockedRoutes(CONFIG, { apply: true });

    assert.strictEqual(mails.length, 1);
    assert.strictEqual(mails[0].notice, ROUTE.NOTICES['scan-only']);
    assert.strictEqual(mails[0].email, 'buyer@example.com');
    assert.match(mails[0].magicLink, /precheck\?r=tok_/);
  });
});

test('🔴 안내메일이 실패해도 환불을 되돌리지 않는다 — 보고만 한다', async () => {
  await withFakes({}, async (calls) => {
    mailFails = true;
    const result = await ROUTE_REFUND.refundBlockedRoutes(CONFIG, { apply: true });

    assert.strictEqual(result.refunded, 1, '메일 실패로 환불이 사라졌습니다');
    assert.strictEqual(result.notified, 0);
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(cancelCalls(calls).length, 1);
  });
});

test('🔴 메일은 환불 뒤에 나간다 — 순서가 뒤집히면 못 돌려준 건에 「환불했습니다」가 갑니다', async () => {
  await withFakes({}, async (calls) => {
    await ROUTE_REFUND.refundBlockedRoutes(CONFIG, { apply: true });

    assert.strictEqual(cancelCalls(calls).length, 1);
    assert.strictEqual(mails.length, 1);
    // 메일 대역이 「보내는 순간 이미 취소가 끝나 있었는가」를 기록해 둡니다.
    assert.strictEqual(mails[0].cancelsAtSend, 1, '취소보다 메일이 먼저 나갔습니다');
  });
});

/* ── ④ 멱등 ────────────────────────────────────────────────────────────────── */

test('이미 환불된 건은 다시 취소하지 않는다 — 같은 날 두 번 돌아도 안전하다', async () => {
  await withFakes({ alreadyRefunded: true }, async (calls) => {
    const result = await ROUTE_REFUND.refundBlockedRoutes(CONFIG, { apply: true });

    assert.strictEqual(result.already, 1);
    assert.strictEqual(result.refunded, 0);
    assert.strictEqual(result.failed.length, 0, '이미 환불된 건은 실패가 아닙니다');
    assert.strictEqual(cancelCalls(calls).length, 0);
    assert.strictEqual(mails.length, 0, '이미 환불된 건에 메일을 또 보냈습니다');
  });
});

/* ── ⑤ 라우트 ──────────────────────────────────────────────────────────────── */

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

test('env 미등록이면 configured:false 로 아무것도 환불하지 않는다', async () => {
  const got = await invokeCron({
    CRON_SECRET: SECRET,
    INTAKE_SUPABASE_URL: undefined,
    INTAKE_SUPABASE_SECRET_KEY: undefined,
    INTAKE_SUPABASE_SERVICE_ROLE_KEY: undefined,
  }, { authorization: 'Bearer ' + SECRET });

  // 500 이 아닙니다 — 매일 500 이 나면 경보가 무뎌지고 진짜 실패가 묻힙니다.
  assert.strictEqual(got.code, 200);
  assert.strictEqual(got.body.configured, false);
  assert.strictEqual(got.body.ok, true);
  assert.strictEqual(got.body.result, undefined, 'configured:false 인데 배치가 돌았습니다');
  assert.match(String(got.body.note), /trops_a/, '판정층 소관 경계가 응답에 없습니다');
});

test('표를 못 읽으면 라우트가 200 으로 말한다 — 「표가 없다」를 실패로 적지 않는다', async () => {
  await withFakes({ routeTableFails: true }, async () => {
    const got = await invokeCron({
      CRON_SECRET: SECRET,
      INTAKE_SUPABASE_URL: 'https://example.supabase.co',
      INTAKE_SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    }, { authorization: 'Bearer ' + SECRET });

    // env 미등록(configured:false)과 같은 원칙 — 매일 502 가 나면 경보가 무뎌집니다.
    assert.strictEqual(got.code, 200);
    assert.strictEqual(got.body.ok, true);
    assert.strictEqual(got.body.result.available, false);
    assert.strictEqual(got.body.result.refunded, 0);
  });
});

test('🔴 표는 있는데 개별 건이 실패하면 그대로 502 — 200 통일이 진짜 실패까지 가리면 안 된다', async () => {
  await withFakes({}, async () => {
    mailFails = true; // available:true 인 채로 errors 가 1건 생기게 만듭니다.
    const got = await invokeCron({
      CRON_SECRET: SECRET,
      INTAKE_SUPABASE_URL: 'https://example.supabase.co',
      INTAKE_SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    }, { authorization: 'Bearer ' + SECRET });

    assert.strictEqual(got.code, 502, '표는 읽었고 실제 실패가 있는데도 200 을 줬습니다');
    assert.strictEqual(got.body.ok, false);
    assert.strictEqual(got.body.result.available, true);
    assert.strictEqual(got.body.result.errors.length, 1);
  });
});

test('전달 완료분만 남은 날은 성공으로 끝낸다 — 매일 빨간불을 켜지 않는다', async () => {
  await withFakes({
    candidates: [Object.assign({}, PAID_ROW, { delivered_at: '2026-08-11T09:00:00Z' })],
  }, async () => {
    const got = await invokeCron({
      CRON_SECRET: SECRET,
      INTAKE_SUPABASE_URL: 'https://example.supabase.co',
      INTAKE_SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    }, { authorization: 'Bearer ' + SECRET });

    assert.strictEqual(got.code, 200);
    assert.strictEqual(got.body.ok, true);
    assert.strictEqual(got.body.result.deferred.length, 1);
  });
});

test('CLI 와 cron 라우트가 같은 배치 본체를 본다', () => {
  // 복제하면 한쪽만 고쳐지고 다른 쪽이 조용히 옛 방식으로 남습니다.
  const script = require('../scripts/refund-blocked.js');
  assert.strictEqual(script.refundBlockedRoutes, ROUTE_REFUND.refundBlockedRoutes);
});
