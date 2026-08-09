/*
 * api/_delivery.js 테스트 — 요약 자료 전달 · 환불 기준선 기록.
 *
 *   npm test        (node --test test/)
 *
 * 가장 먼저 보는 것은 "메일이 실패했는데 전달로 기록하지 않는가" 입니다.
 * 보내지 않은 건이 delivered 로 남으면, 이용자는 환불규정 §02 의 전액 환불
 * 구간에서 밀려납니다. 회사에 유리한 방향으로 틀리는 것이라 더 나쁩니다.
 *
 * 그 다음이 "이미 전달한 건의 시각을 덮어쓰지 않는가" 입니다.
 * 덮어쓰면 기준선이 뒤로 밀려 같은 일이 벌어집니다.
 *
 * 실제 Supabase·Resend 를 부르지 않습니다. api/_notify.js 는 모듈을 읽는
 * 순간 Resend 클라이언트를 만들므로 require 캐시에 가짜를 먼저 꽂아 둡니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

/* ── _notify.js 대역 ───────────────────────────────────────────────────────── */

const notifyPath = path.join(__dirname, '..', 'api', '_notify.js');
const mails = [];
let mailResult = { sent: true, error: null };

require.cache[notifyPath] = {
  id: notifyPath,
  filename: notifyPath,
  loaded: true,
  exports: {
    RETENTION_DAYS: 30,
    buildMagicLink: (t) => 'https://trops.kr/precheck?r=' + t,
    sendIntakeMails: async () => ({ confirmationSent: true }),
    sendErasureMails: async () => ({ confirmationSent: true }),
    sendDeliveryMail: async (info) => { mails.push(info); return mailResult; },
  },
};

const delivery = require('../api/_delivery.js');

/* ── 도구 ──────────────────────────────────────────────────────────────────── */

const NOW = Date.parse('2026-08-09T05:00:00.000Z');
const TOKEN = 'tok_abcdefghijklmnopqrstuv';
const URL_OK = 'https://trops.kr/summary/abc';

function row(overrides) {
  return Object.assign({
    id: 'uuid-1',
    email: 'buyer@example.com',
    status: 'received',
    delivered_at: null,
    own_form_path: 'intake/uuid-1/own-form-our.docx',
    received_at: '2026-08-09T01:00:00Z',
    intake_path: 'free',
    order_id: null,
    amount: 0,
    payment_status: 'none',
    erasure_requested_at: null,
    access_token: TOKEN,
  }, overrides || {});
}

/**
 * 접수 1건을 돌려주는 가짜 Supabase.
 * PATCH 는 delivered_at=is.null 조건이 URL 에 붙어 있을 때만 행을 돌려줍니다 —
 * 실제 PostgREST 와 같은 동작이라, 조건을 빼먹으면 테스트가 잡아냅니다.
 */
function withFakeSupabase(rowData, run, opts) {
  const options = opts || {};
  const calls = [];
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  console.error = () => {};

  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), method: (init && init.method) || 'GET', body: init && init.body };
    calls.push(call);

    if (call.method === 'PATCH') {
      if (options.patchFails) {
        return { ok: false, status: 500, json: async () => ({}), text: async () => 'patch error' };
      }
      // 조건에 걸리면 0행이 돌아옵니다(이미 누가 기록한 경우).
      const guarded = call.url.indexOf('delivered_at=is.null') !== -1;
      const hit = guarded && !rowData.delivered_at;
      return { ok: true, status: 200, json: async () => (hit ? [rowData] : []), text: async () => '[]' };
    }

    return { ok: true, status: 200, json: async () => (rowData ? [rowData] : []), text: async () => '[]' };
  };

  mails.length = 0;
  mailResult = { sent: true, error: null };

  const config = { ok: true, restUrl: 'https://x.supabase.co/rest/v1', headers: {}, baseUrl: 'https://x.supabase.co' };

  return Promise.resolve(run(config, calls)).finally(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  });
}

function opts(extra) {
  return Object.assign({ token: TOKEN, summaryUrl: URL_OK, apply: true, now: NOW, log: () => {} }, extra || {});
}

function patchBody(calls) {
  const call = calls.find((c) => c.method === 'PATCH');
  return call ? JSON.parse(call.body) : null;
}

/* ── 메일이 실패하면 전달로 기록하지 않는다 (가장 중요) ─────────────────────── */

test('메일 발송 실패 시 delivered 로 기록하지 않는다', async () => {
  await withFakeSupabase(row(), async (config, calls) => {
    mailResult = { sent: false, error: 'smtp down' };

    const result = await delivery.deliver(config, opts());

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'mail-failed');
    assert.ok(!calls.some((c) => c.method === 'PATCH'),
      '메일이 실패했는데 전달 기록을 남겼습니다 — 이용자가 환불 구간에서 밀려납니다');
  });
});

test('메일 발송 성공 시에만 status·delivered_at 을 남긴다', async () => {
  await withFakeSupabase(row(), async (config, calls) => {
    const result = await delivery.deliver(config, opts());

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.deliveredAt, new Date(NOW).toISOString());

    const body = patchBody(calls);
    assert.strictEqual(body.status, 'delivered');
    assert.strictEqual(body.delivered_at, new Date(NOW).toISOString());
  });
});

test('delivered_at 은 메일을 보낸 시각과 같다 — 규정이 발송 시점을 가리킨다', async () => {
  await withFakeSupabase(row(), async (config, calls) => {
    await delivery.deliver(config, opts());

    assert.strictEqual(mails.length, 1);
    assert.strictEqual(mails[0].deliveredAt, patchBody(calls).delivered_at);
  });
});

/* ── 이미 전달한 건의 기준선을 덮어쓰지 않는다 ─────────────────────────────── */

test('이미 전달한 건은 다시 보내지 않는다 — 기준선이 뒤로 밀린다', async () => {
  const already = '2026-08-08T02:00:00Z';
  await withFakeSupabase(row({ status: 'delivered', delivered_at: already }), async (config, calls) => {
    const result = await delivery.deliver(config, opts());

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'already-delivered');
    assert.strictEqual(mails.length, 0, '이미 전달한 건에 메일을 또 보냈습니다');
    assert.ok(!calls.some((c) => c.method === 'PATCH'));
  });
});

test('PATCH 에 delivered_at is null 조건을 건다 — 동시 실행이 덮어쓰지 못하게', async () => {
  await withFakeSupabase(row(), async (config, calls) => {
    await delivery.deliver(config, opts());

    const call = calls.find((c) => c.method === 'PATCH');
    assert.ok(call.url.indexOf('delivered_at=is.null') !== -1,
      '조건 없이 PATCH 하면 나중 실행이 앞선 전달 시각을 덮어씁니다');
  });
});

/* ── 보내면 안 되는 건 ─────────────────────────────────────────────────────── */

test('결제가 끝나지 않은 건에는 보내지 않는다', async () => {
  await withFakeSupabase(row({ status: 'awaiting_payment' }), async (config) => {
    const result = await delivery.deliver(config, opts());
    assert.strictEqual(result.reason, 'awaiting-payment');
    assert.strictEqual(mails.length, 0);
  });
});

test('자료를 지운 건에는 보내지 않는다', async () => {
  await withFakeSupabase(row({ erasure_requested_at: '2026-08-09T03:00:00Z' }), async (config) => {
    const result = await delivery.deliver(config, opts());
    assert.strictEqual(result.reason, 'erased');
    assert.strictEqual(mails.length, 0);
  });
});

test('취소된 건에는 보내지 않는다', async () => {
  await withFakeSupabase(row({ status: 'cancelled' }), async (config) => {
    const result = await delivery.deliver(config, opts());
    assert.strictEqual(result.reason, 'bad-status');
    assert.strictEqual(mails.length, 0);
  });
});

test('없는 토큰이면 거절한다', async () => {
  await withFakeSupabase(null, async (config) => {
    const result = await delivery.deliver(config, opts());
    assert.strictEqual(result.reason, 'not-found');
    assert.strictEqual(mails.length, 0);
  });
});

test('in_progress 는 보낼 수 있다 — 사람이 손으로 옮겨 둔 상태다', async () => {
  await withFakeSupabase(row({ status: 'in_progress' }), async (config) => {
    const result = await delivery.deliver(config, opts());
    assert.strictEqual(result.ok, true);
  });
});

/* ── 미리보기 ──────────────────────────────────────────────────────────────── */

test('--apply 없이는 메일도 기록도 없다', async () => {
  await withFakeSupabase(row(), async (config, calls) => {
    const result = await delivery.deliver(config, opts({ apply: false }));

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.applied, false);
    assert.strictEqual(mails.length, 0);
    assert.ok(!calls.some((c) => c.method === 'PATCH'));
  });
});

/* ── 링크 검사 ─────────────────────────────────────────────────────────────── */

test('https 가 아닌 주소는 고객 메일에 넣지 않는다', async () => {
  for (const bad of ['http://trops.kr/s', 'javascript:alert(1)', 'ftp://x/y', '', '그냥 글자']) {
    const check = delivery.checkSummaryUrl(bad);
    assert.strictEqual(check.ok, false, bad + ' 를 통과시켰습니다');
  }
  assert.strictEqual(delivery.checkSummaryUrl(URL_OK).ok, true);
});

test('주소가 잘못되면 조회도 발송도 하지 않는다', async () => {
  await withFakeSupabase(row(), async (config, calls) => {
    const result = await delivery.deliver(config, opts({ summaryUrl: 'http://trops.kr/s' }));
    assert.strictEqual(result.reason, 'bad-url');
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(mails.length, 0);
  });
});

/* ── 기록만 실패한 경우 ────────────────────────────────────────────────────── */

test('메일은 갔는데 기록이 실패하면 사람이 손댈 수 있게 알린다', async () => {
  await withFakeSupabase(row(), async (config) => {
    const result = await delivery.deliver(config, opts());

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'store-failed');
    // 메일이 이미 나갔다는 사실과 그 시각을 반드시 함께 알려야 손으로 맞출 수 있습니다.
    assert.strictEqual(result.mailed, true);
    assert.strictEqual(result.deliveredAt, new Date(NOW).toISOString());
    assert.ok(result.message.indexOf(new Date(NOW).toISOString()) !== -1);
  }, { patchFails: true });
});

/* ── 상태 게이트 단위 ──────────────────────────────────────────────────────── */

test('checkDeliverable 은 received·in_progress 만 통과시킨다', () => {
  assert.strictEqual(delivery.checkDeliverable(row({ status: 'received' })).ok, true);
  assert.strictEqual(delivery.checkDeliverable(row({ status: 'in_progress' })).ok, true);
  for (const status of ['awaiting_payment', 'delivered', 'cancelled']) {
    assert.strictEqual(delivery.checkDeliverable(row({ status: status })).ok, false, status);
  }
});
