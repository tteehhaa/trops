/*
 * api/intake.js 테스트 — 사전 확인(/check) 세션 연결 〔bkit-7 · doc/s10 §5-3〕.
 *
 *   npm test        (node --test test/)
 *
 * `/check` 를 거쳐 `/precheck?pre=<session_key>` 로 온 사람만 preSessionKey 가
 * 있습니다. 이 필드는 부가 필드입니다 — 없다고 접수를 막으면 안 되고, 값이
 * 이상해도 접수를 막으면 안 됩니다. trops_a 가 이 값으로 자기 쪽
 * precheck_prestep_session.intake_id 를 채우는 것은 이 저장소 범위 밖입니다.
 *
 * 실제 Supabase 를 부르지 않고 globalThis.fetch 를 가짜로 바꿉니다.
 * api/_notify.js 는 모듈을 읽는 순간 Resend 클라이언트를 만들므로
 * require 캐시에 가짜를 먼저 꽂아 둡니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

/* ── _notify.js 대역 ───────────────────────────────────────────────────────── */

const notifyPath = path.join(__dirname, '..', 'api', '_notify.js');

require.cache[notifyPath] = {
  id: notifyPath,
  filename: notifyPath,
  loaded: true,
  exports: {
    RETENTION_DAYS: 30,
    buildMagicLink: (t) => 'https://trops.kr/precheck?r=' + t,
    sendIntakeMails: async () => ({ confirmationSent: true }),
    sendErasureMails: async () => ({ confirmationSent: true }),
  },
};

const intake = require('../api/intake.js');

/* ── 도구 ──────────────────────────────────────────────────────────────────── */

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

function file(name, bytes) {
  return {
    name: name,
    type: 'application/pdf',
    size: bytes || 8,
    data: Buffer.alloc(bytes || 8, 0x41).toString('base64'),
  };
}

function post(body) {
  return { method: 'POST', body: body, query: {} };
}

function base(overrides) {
  return Object.assign({
    email: 'buyer@example.com',
    consentTerms: true,
    files: [file('nda.pdf')],
  }, overrides || {});
}

function withFakeSupabase(run) {
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
    const okJson = (json) => ({ ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) });

    if (call.url.indexOf('/rpc/claim_slot') !== -1) {
      return okJson([{ claimed: true, used: 3, slot_limit: 20 }]);
    }
    return okJson({});
  };

  return Promise.resolve(run(calls, errors)).finally(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    delete process.env.INTAKE_SUPABASE_URL;
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
  });
}

function insertedRow(calls) {
  const call = calls.find((c) => c.method === 'POST' && /\/rest\/v1\/intake(\?|$)/.test(c.url));
  assert.ok(call, 'intake insert 요청이 없습니다');
  return JSON.parse(call.body);
}

/* ── 값이 있을 때 그대로 저장되는가 ───────────────────────────────────────── */

test('preSessionKey 를 보내면 pre_session_key 컬럼에 그대로 저장된다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    await intake(post(base({ preSessionKey: 'abc-123-session' })), res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(insertedRow(calls).pre_session_key, 'abc-123-session');
  });
});

/* ── 없어도 접수는 그대로 성공하는가 (부가 필드) ─────────────────────────── */

test('/check 를 거치지 않고 바로 온 사람은 preSessionKey 가 없어도 접수가 성공한다', async () => {
  for (const value of [undefined, null, '']) {
    await withFakeSupabase(async (calls) => {
      const res = fakeRes();
      await intake(post(base({ preSessionKey: value })), res);

      assert.strictEqual(res.statusCode, 201, String(value) + ' 를 오류로 봤습니다');
      assert.strictEqual(insertedRow(calls).pre_session_key, null);
    });
  }
});

test('공백만 있는 값도 "없다" 로 읽는다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    await intake(post(base({ preSessionKey: '   ' })), res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(insertedRow(calls).pre_session_key, null);
  });
});

test('문자열이 아닌 값(숫자·배열·객체)은 조용히 무시한다 — 접수를 막지 않는다', async () => {
  for (const value of [12345, ['a'], { x: 1 }, true]) {
    await withFakeSupabase(async (calls) => {
      const res = fakeRes();
      await intake(post(base({ preSessionKey: value })), res);

      assert.strictEqual(res.statusCode, 201, JSON.stringify(value) + ' 를 오류로 봤습니다');
      assert.strictEqual(insertedRow(calls).pre_session_key, null);
    });
  }
});

test('지나치게 긴 값은 200자로 잘라서 저장한다 — 손상된 값이 접수를 막지 않는다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    const long = 'x'.repeat(500);
    await intake(post(base({ preSessionKey: long })), res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(insertedRow(calls).pre_session_key.length, 200);
  });
});

/* ── 스키마 마이그레이션 순서에 의존하지 않는가 ──────────────────────────── */

test('🔴 pre_session_key 컬럼이 아직 없어도 접수는 성공한다 — 502 를 내지 않는다', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args.map(String).join(' '));

  process.env.INTAKE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

  let inserts = 0;
  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), method: (init && init.method) || 'GET', body: init && init.body };
    calls.push(call);
    const okJson = (json) => ({ ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) });

    if (call.url.indexOf('/rpc/claim_slot') !== -1) return okJson([{ claimed: true, used: 3, slot_limit: 20 }]);

    const isInsert = call.method === 'POST' && /\/rest\/v1\/intake(\?|$)/.test(call.url);
    if (isInsert) {
      inserts += 1;
      if (inserts === 1) {
        return {
          ok: false, status: 400,
          json: async () => ({}),
          text: async () => JSON.stringify({
            code: 'PGRST204',
            message: "Could not find the 'pre_session_key' column of 'intake' in the schema cache",
          }),
        };
      }
    }
    return okJson({});
  };

  try {
    const res = fakeRes();
    await intake(post(base({ preSessionKey: 'sess-1' })), res);

    assert.strictEqual(res.statusCode, 201,
      '컬럼 하나가 없어서 접수 전체를 잃었습니다: ' + JSON.stringify(res.body));
    assert.strictEqual(inserts, 2, '떼고 한 번 더 넣는 재시도가 없습니다');

    const bodies = calls
      .filter((c) => c.method === 'POST' && /\/rest\/v1\/intake(\?|$)/.test(c.url))
      .map((c) => JSON.parse(c.body));
    assert.ok('pre_session_key' in bodies[0], '첫 시도는 pre_session_key 를 넣어야 합니다');
    assert.ok(!('pre_session_key' in bodies[1]), '재시도가 pre_session_key 를 떼지 않았습니다');
    // 접수 성립에 필요한 값은 그대로 남아야 합니다.
    assert.strictEqual(bodies[1].email, 'buyer@example.com');
    assert.ok(Array.isArray(bodies[1].file_paths) && bodies[1].file_paths.length > 0);

    const note = errors.join('\n');
    assert.match(note, /pre_session_key/, '어느 컬럼이 없었는지가 로그에 없습니다');
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    delete process.env.INTAKE_SUPABASE_URL;
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
  }
});
