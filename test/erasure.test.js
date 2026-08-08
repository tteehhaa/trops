/*
 * api/erasure.js 테스트 — 자료 즉시 삭제 (환불규정 05).
 *
 *   npm test        (node --test test/)
 *
 * 되돌릴 수 없는 경로이므로 "지우면 안 되는 때 지우지 않는가" 를 먼저 봅니다.
 * 실제 Supabase 를 부르지 않고 globalThis.fetch 를 가짜로 바꿉니다.
 *
 * api/_notify.js 는 모듈을 읽는 순간 Resend 클라이언트를 만들므로
 * require 캐시에 가짜를 먼저 꽂아 둡니다 — 테스트에서 메일을 보내지 않기 위해서이고,
 * resend 패키지가 설치되지 않은 환경에서도 이 테스트가 돌게 하기 위해서입니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

/* ── _notify.js 대역 ───────────────────────────────────────────────────────── */

const notifyPath = path.join(__dirname, '..', 'api', '_notify.js');
const mails = [];

require.cache[notifyPath] = {
  id: notifyPath,
  filename: notifyPath,
  loaded: true,
  exports: {
    RETENTION_DAYS: 30,
    buildMagicLink: (t) => 'https://trops.kr/precheck?r=' + t,
    sendIntakeMails: async () => ({ confirmationSent: true }),
    sendErasureMails: async (info) => { mails.push(info); return { confirmationSent: true }; },
  },
};

const erasure = require('../api/erasure.js');

/* ── 도구 ──────────────────────────────────────────────────────────────────── */

const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

function baseRow(overrides) {
  return Object.assign({
    id: 'intake-1',
    email: 'buyer@example.com',
    status: 'received',
    file_paths: ['intake/intake-1/01-nda.pdf', 'intake/intake-1/02-po.pdf'],
    file_count: 2,
    received_at: '2026-08-01T00:00:00.000Z',
    intake_path: 'paid',
    order_id: 'precheck_x',
    amount: 99000,
    payment_status: 'paid',
    erasure_requested_at: null,
  }, overrides || {});
}

/** row 를 돌려주는 가짜 Supabase. 오간 요청을 기록합니다. */
function withFakeSupabase(row, run, opts) {
  const options = opts || {};
  const calls = [];
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args.map(String).join(' '));

  process.env.INTAKE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), method: (init && init.method) || 'GET', body: init && init.body };
    calls.push(call);

    const fail = (status) => ({
      ok: false, status: status,
      json: async () => ({}), text: async () => 'error',
    });
    const okJson = (json) => ({
      ok: true, status: 200,
      json: async () => json, text: async () => JSON.stringify(json),
    });

    if (call.method === 'GET') {
      if (options.lookupFails) return fail(500);
      return okJson(row ? [row] : []);
    }
    if (call.method === 'DELETE') {
      if (options.storageFails) return fail(500);
      return okJson(JSON.parse(call.body).prefixes.map((p) => ({ name: p })));
    }
    if (call.method === 'PATCH') {
      if (options.patchFails) return fail(500);
      return okJson({});
    }
    return okJson({});
  };

  mails.length = 0;

  return Promise.resolve(run(calls, errors)).finally(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    delete process.env.INTAKE_SUPABASE_URL;
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
  });
}

function post(body) {
  return { method: 'POST', body: body, query: {} };
}

/* ── 지우면 안 되는 때 ─────────────────────────────────────────────────────── */

test('GET 은 받지 않는다 — 삭제는 POST 만', async () => {
  await withFakeSupabase(baseRow(), async (calls) => {
    const res = fakeRes();
    await erasure({ method: 'GET', query: {} }, res);
    assert.strictEqual(res.statusCode, 405);
    assert.strictEqual(calls.length, 0);
  });
});

test('재발급 불가 동의가 없으면 지우지 않는다', async () => {
  await withFakeSupabase(baseRow(), async (calls) => {
    const res = fakeRes();
    await erasure(post({ token: TOKEN }), res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error, 'consent-required');
    assert.strictEqual(calls.length, 0, '동의가 없으면 조회조차 하지 않습니다');
  });
});

test('동의 값이 true 가 아니면(문자열 "true" 포함) 지우지 않는다', async () => {
  for (const value of ['true', 1, {}, null]) {
    await withFakeSupabase(baseRow(), async (calls) => {
      const res = fakeRes();
      await erasure(post({ token: TOKEN, confirmNoReissue: value }), res);
      assert.strictEqual(res.statusCode, 400, JSON.stringify(value) + ' 는 동의가 아닙니다');
      assert.strictEqual(calls.length, 0);
    });
  }
});

test('토큰 형식이 틀리면 조회하지 않는다', async () => {
  for (const token of ['', 'short', 'has spaces in it and is long enough', undefined]) {
    await withFakeSupabase(baseRow(), async (calls) => {
      const res = fakeRes();
      await erasure(post({ token: token, confirmNoReissue: true }), res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error, 'invalid token');
      assert.strictEqual(calls.length, 0);
    });
  }
});

test('없는 토큰이면 404 · 삭제 요청을 보내지 않는다', async () => {
  await withFakeSupabase(null, async (calls) => {
    const res = fakeRes();
    await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(calls.filter((c) => c.method !== 'GET').length, 0);
  });
});

test('환경변수가 없으면 503 · 아무 요청도 보내지 않는다', async () => {
  const originalError = console.error;
  console.error = () => {};
  const originalFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = async () => { called += 1; throw new Error('불려서는 안 됩니다'); };
  delete process.env.INTAKE_SUPABASE_URL;
  delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;

  try {
    const res = fakeRes();
    await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);
    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(called, 0);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

/* ── 지우는 때 ─────────────────────────────────────────────────────────────── */

test('동의가 있으면 파일을 먼저 지우고 그 뒤에 기록을 표시한다', async () => {
  await withFakeSupabase(baseRow(), async (calls) => {
    const res = fakeRes();
    await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.filesDeleted, 2);

    const storage = calls.filter((c) => c.method === 'DELETE');
    const patch = calls.filter((c) => c.method === 'PATCH');
    assert.strictEqual(storage.length, 1);
    assert.strictEqual(patch.length, 1);
    // 순서가 뒤집히면 "지웠다" 고 표시한 채 파일이 남을 수 있습니다.
    assert.ok(calls.indexOf(storage[0]) < calls.indexOf(patch[0]));

    // 버킷 접두사를 뗀 키로 지웁니다.
    assert.deepStrictEqual(JSON.parse(storage[0].body).prefixes,
      ['intake-1/01-nda.pdf', 'intake-1/02-po.pdf']);
  });
});

test('표시 내용 — 파일 목록을 비우고 삭제 기한을 지금으로 당긴다', async () => {
  await withFakeSupabase(baseRow(), async (calls) => {
    const res = fakeRes();
    await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);

    const patch = JSON.parse(calls.find((c) => c.method === 'PATCH').body);
    assert.deepStrictEqual(patch.file_paths, []);
    assert.strictEqual(patch.file_count, 0);
    assert.ok(patch.erasure_requested_at);
    assert.ok(patch.files_deleted_at);
    // 정리 배치가 다음 실행에서 행을 지우도록 기한을 당깁니다.
    assert.strictEqual(patch.delete_after, patch.erasure_requested_at);
  });
});

test('돈은 건드리지 않는다 — 삭제는 환불이 아니다', async () => {
  await withFakeSupabase(baseRow(), async (calls) => {
    const res = fakeRes();
    await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);

    const patch = JSON.parse(calls.find((c) => c.method === 'PATCH').body);
    assert.ok(!('payment_status' in patch), 'payment_status 를 바꾸면 클릭 한 번으로 환불이 나갑니다');
    assert.ok(!('amount' in patch));
    assert.ok(!('order_id' in patch));
    assert.ok(!('payment_key' in patch));
  });
});

test('진행 중인 건은 cancelled 로 내린다', async () => {
  for (const status of ['awaiting_payment', 'received', 'in_progress']) {
    await withFakeSupabase(baseRow({ status: status }), async (calls) => {
      const res = fakeRes();
      await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);
      const patch = JSON.parse(calls.find((c) => c.method === 'PATCH').body);
      assert.strictEqual(patch.status, 'cancelled', status + ' → cancelled');
    });
  }
});

test('이미 전달한 건은 상태를 바꾸지 않는다 — 이행하지 않은 건처럼 보이면 안 된다', async () => {
  await withFakeSupabase(baseRow({ status: 'delivered' }), async (calls) => {
    const res = fakeRes();
    await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);
    const patch = JSON.parse(calls.find((c) => c.method === 'PATCH').body);
    assert.strictEqual(patch.status, 'delivered');
  });
});

test('무상 건도 같은 경로로 지운다', async () => {
  await withFakeSupabase(baseRow({ intake_path: 'free', amount: 0, order_id: null, payment_status: 'none' }),
    async (calls) => {
      const res = fakeRes();
      await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.filesDeleted, 2);
      assert.strictEqual(mails.length, 1);
      assert.strictEqual(mails[0].path, 'free');
    });
});

test('파일이 없는 건도 요청은 성공하고 기록을 표시한다', async () => {
  await withFakeSupabase(baseRow({ file_paths: [], file_count: 0 }), async (calls) => {
    const res = fakeRes();
    await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.filesDeleted, 0);
    // 지울 키가 없으면 Storage 요청 자체를 보내지 않습니다.
    assert.strictEqual(calls.filter((c) => c.method === 'DELETE').length, 0);
    assert.strictEqual(calls.filter((c) => c.method === 'PATCH').length, 1);
  });
});

test('JSON 문자열 본문도 받는다', async () => {
  await withFakeSupabase(baseRow(), async () => {
    const res = fakeRes();
    await erasure(post(JSON.stringify({ token: TOKEN, confirmNoReissue: true })), res);
    assert.strictEqual(res.statusCode, 200);
  });
});

/* ── 두 번 눌렀을 때 ───────────────────────────────────────────────────────── */

test('이미 지운 건은 다시 지우지 않고 같은 결과를 돌려준다', async () => {
  const at = '2026-08-05T10:00:00.000Z';
  await withFakeSupabase(baseRow({ erasure_requested_at: at, file_paths: [], file_count: 0 }),
    async (calls) => {
      const res = fakeRes();
      await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.alreadyErased, true);
      assert.strictEqual(res.body.erasureRequestedAt, at);
      assert.strictEqual(calls.filter((c) => c.method !== 'GET').length, 0);
      assert.strictEqual(mails.length, 0, '두 번째 요청에는 메일을 다시 보내지 않습니다');
    });
});

/* ── 실패했을 때 ───────────────────────────────────────────────────────────── */

test('파일 삭제가 실패하면 기록을 표시하지 않는다', async () => {
  await withFakeSupabase(baseRow(), async (calls) => {
    const res = fakeRes();
    await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);

    assert.strictEqual(res.statusCode, 502);
    assert.strictEqual(res.body.error, 'delete failed');
    assert.strictEqual(calls.filter((c) => c.method === 'PATCH').length, 0,
      '파일이 남았는데 "지웠다" 고 표시하면 가장 나쁩니다');
    assert.strictEqual(mails.length, 0);
  }, { storageFails: true });
});

test('표시가 실패하면 502 로 알리고 사람이 볼 수 있게 로그를 남긴다', async () => {
  await withFakeSupabase(baseRow(), async (calls, errors) => {
    const res = fakeRes();
    await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);

    assert.strictEqual(res.statusCode, 502);
    assert.strictEqual(res.body.error, 'store failed');
    assert.strictEqual(res.body.filesDeleted, 2);
    assert.ok(errors.join('\n').indexOf('수동 확인 필요') !== -1);
    assert.strictEqual(mails.length, 0);
  }, { patchFails: true });
});

test('조회가 실패하면 아무것도 지우지 않는다', async () => {
  await withFakeSupabase(baseRow(), async (calls) => {
    const res = fakeRes();
    await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);
    assert.strictEqual(res.statusCode, 502);
    assert.strictEqual(calls.filter((c) => c.method !== 'GET').length, 0);
  }, { lookupFails: true });
});

/* ── 로그 ──────────────────────────────────────────────────────────────────── */

test('서비스 키를 로그에 남기지 않는다', async () => {
  await withFakeSupabase(baseRow(), async (calls, errors) => {
    const res = fakeRes();
    await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);
    assert.strictEqual(errors.join('\n').indexOf('test-service-role-key'), -1);
  }, { patchFails: true });
});

test('응답은 캐시하지 않는다', async () => {
  await withFakeSupabase(baseRow(), async () => {
    const res = fakeRes();
    await erasure(post({ token: TOKEN, confirmNoReissue: true }), res);
    assert.strictEqual(res.headers['Cache-Control'], 'no-store');
  });
});
