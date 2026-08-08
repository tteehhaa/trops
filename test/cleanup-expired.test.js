/*
 * scripts/cleanup-expired.js 테스트.
 *
 *   npm test        (node --test test/)
 *
 * 실제 Supabase 를 부르지 않습니다. globalThis.fetch 를 가짜로 바꿔
 * "어떤 요청을 어떤 순서로 보내는가" 를 봅니다. 이 배치에서 틀리면 안 되는 것은
 * 지우는 대상(상태를 가리지 않는가)과 순서(파일 → 행)이고, 둘 다 요청에 드러납니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const cleanup = require('../scripts/cleanup-expired.js');

const CONFIG = {
  ok: true,
  baseUrl: 'https://example.supabase.co',
  restUrl: 'https://example.supabase.co/rest/v1',
  storageUrl: 'https://example.supabase.co/storage/v1',
  key: 'test-key',
  headers: { apikey: 'test-key', Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
};

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-08-08T00:00:00.000Z');

/** fetch 를 가짜로 바꾸고, 오간 요청을 기록해 돌려줍니다. */
function withFakeFetch(handler, run) {
  const calls = [];
  const original = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), method: (init && init.method) || 'GET', body: init && init.body };
    calls.push(call);
    const result = handler(call) || {};
    return {
      ok: result.ok !== false,
      status: result.status || 200,
      json: async () => (result.json === undefined ? [] : result.json),
      text: async () => JSON.stringify(result.json === undefined ? [] : result.json),
    };
  };

  return Promise.resolve(run(calls)).finally(() => { globalThis.fetch = original; });
}

/* ──────────────────────────────────────────────────────────────
 * summarize — 지울 대상 뽑기
 * ────────────────────────────────────────────────────────────── */

test('summarize: file_paths 에서 버킷 접두사를 떼어 Storage 키로 만든다', () => {
  const plan = cleanup.summarize([
    { id: 'a', status: 'received', file_paths: ['intake/a/01-x.pdf', 'intake/a/02-y.pdf'] },
  ], 'intake');

  assert.deepStrictEqual(plan.keys, ['a/01-x.pdf', 'a/02-y.pdf']);
  assert.deepStrictEqual(plan.ids, ['a']);
  assert.strictEqual(plan.count, 1);
});

test('summarize: 미결제 이탈 건(awaiting_payment)도 상태로 걸러내지 않는다', () => {
  const plan = cleanup.summarize([
    { id: 'a', status: 'awaiting_payment', file_paths: ['intake/a/01-x.pdf'] },
    { id: 'b', status: 'received', file_paths: ['intake/b/01-y.pdf'] },
    { id: 'c', status: 'delivered', file_paths: [] },
    { id: 'd', status: 'cancelled', file_paths: ['intake/d/01-z.pdf'] },
  ], 'intake');

  assert.strictEqual(plan.count, 4);
  assert.strictEqual(plan.byStatus.awaiting_payment, 1);
  assert.deepStrictEqual(plan.ids, ['a', 'b', 'c', 'd']);
  assert.strictEqual(plan.keys.length, 3);
});

test('summarize: 파일이 없는 행(즉시 삭제를 이미 거친 건)도 행은 지운다', () => {
  const plan = cleanup.summarize([
    { id: 'a', status: 'cancelled', file_paths: [], erasure_requested_at: '2026-08-01T00:00:00Z' },
  ], 'intake');

  assert.deepStrictEqual(plan.ids, ['a']);
  assert.deepStrictEqual(plan.keys, []);
});

test('summarize: id 가 없는 행은 건너뛴다', () => {
  const plan = cleanup.summarize([{ status: 'received', file_paths: ['intake/x/1.pdf'] }, null], 'intake');
  assert.strictEqual(plan.count, 0);
  assert.deepStrictEqual(plan.keys, []);
});

test('chunk: 남는 조각을 버리지 않는다', () => {
  assert.deepStrictEqual(cleanup.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepStrictEqual(cleanup.chunk([], 2), []);
});

/* ──────────────────────────────────────────────────────────────
 * cleanupExpired
 * ────────────────────────────────────────────────────────────── */

const EXPIRED_ROWS = [
  { id: 'aaa', status: 'awaiting_payment', file_paths: ['intake/aaa/01-x.pdf'] },
  { id: 'bbb', status: 'received', file_paths: ['intake/bbb/01-y.pdf', 'intake/bbb/02-z.pdf'] },
];

function expiredHandler(call) {
  if (call.method === 'GET' && call.url.indexOf('/intake?delete_after=lt.') !== -1) {
    return { json: EXPIRED_ROWS };
  }
  if (call.method === 'DELETE' && call.url.indexOf('/storage/v1/object/intake') !== -1) {
    return { json: JSON.parse(call.body).prefixes.map((p) => ({ name: p })) };
  }
  return { json: [] };
}

test('cleanupExpired: 기본은 미리보기 — 아무것도 지우지 않는다', async () => {
  await withFakeFetch(expiredHandler, async (calls) => {
    const result = await cleanup.cleanupExpired(CONFIG, { apply: false, now: NOW });

    assert.strictEqual(result.applied, false);
    assert.strictEqual(result.rows, 2);
    assert.strictEqual(result.files, 3);
    assert.strictEqual(calls.filter((c) => c.method === 'DELETE').length, 0);
  });
});

test('cleanupExpired: --apply 는 파일을 먼저 지운 뒤 행을 지운다', async () => {
  await withFakeFetch(expiredHandler, async (calls) => {
    const result = await cleanup.cleanupExpired(CONFIG, { apply: true, now: NOW });

    assert.strictEqual(result.applied, true);
    assert.strictEqual(result.rows, 2);
    assert.strictEqual(result.files, 3);

    const deletes = calls.filter((c) => c.method === 'DELETE');
    assert.strictEqual(deletes.length, 2);

    // 순서가 뒤집히면 파일 경로를 잃습니다 — 경로는 행에만 있습니다.
    assert.ok(deletes[0].url.indexOf('/storage/v1/object/intake') !== -1,
      '파일 삭제가 먼저여야 합니다');
    assert.ok(deletes[1].url.indexOf('/rest/v1/intake?id=in.') !== -1,
      '행 삭제가 나중이어야 합니다');

    assert.deepStrictEqual(JSON.parse(deletes[0].body).prefixes,
      ['aaa/01-x.pdf', 'bbb/01-y.pdf', 'bbb/02-z.pdf']);
    // 두 행 모두 한 번에 지웁니다.
    assert.ok(deletes[1].url.indexOf('aaa') !== -1 && deletes[1].url.indexOf('bbb') !== -1);
  });
});

test('cleanupExpired: 조회 시점은 now 옵션을 따른다', async () => {
  await withFakeFetch(expiredHandler, async (calls) => {
    await cleanup.cleanupExpired(CONFIG, { apply: false, now: NOW });
    assert.ok(calls[0].url.indexOf(encodeURIComponent('2026-08-08T00:00:00.000Z')) !== -1);
  });
});

test('cleanupExpired: 기한 경과분이 없으면 삭제 요청을 보내지 않는다', async () => {
  await withFakeFetch(() => ({ json: [] }), async (calls) => {
    const result = await cleanup.cleanupExpired(CONFIG, { apply: true, now: NOW });
    assert.strictEqual(result.rows, 0);
    assert.strictEqual(calls.filter((c) => c.method === 'DELETE').length, 0);
  });
});

test('cleanupExpired: 파일 삭제가 실패하면 행을 지우지 않고 멈춘다', async () => {
  await withFakeFetch((call) => {
    if (call.method === 'DELETE' && call.url.indexOf('/storage/v1/') !== -1) {
      return { ok: false, status: 500, json: { message: 'boom' } };
    }
    return expiredHandler(call);
  }, async (calls) => {
    await assert.rejects(
      () => cleanup.cleanupExpired(CONFIG, { apply: true, now: NOW }),
      /storage delete HTTP 500/
    );
    assert.strictEqual(calls.filter((c) => c.url.indexOf('/rest/v1/intake?id=in.') !== -1).length, 0);
  });
});

test('cleanupExpired: 조회가 실패하면 던진다', async () => {
  await withFakeFetch(() => ({ ok: false, status: 401, json: {} }), async () => {
    await assert.rejects(
      () => cleanup.cleanupExpired(CONFIG, { apply: true, now: NOW }),
      /expired select HTTP 401/
    );
  });
});

test('cleanupExpired: 행이 DELETE_CHUNK 보다 많으면 나눠 지운다', async () => {
  const many = [];
  for (let i = 0; i < cleanup.DELETE_CHUNK + 5; i += 1) {
    many.push({ id: 'id-' + i, status: 'awaiting_payment', file_paths: [] });
  }

  await withFakeFetch((call) => {
    if (call.method === 'GET' && call.url.indexOf('delete_after=lt.') !== -1) return { json: many };
    return { json: [] };
  }, async (calls) => {
    const result = await cleanup.cleanupExpired(CONFIG, { apply: true, now: NOW, limit: 1000 });
    assert.strictEqual(result.rows, many.length);
    const rowDeletes = calls.filter((c) => c.url.indexOf('/rest/v1/intake?id=in.') !== -1);
    assert.strictEqual(rowDeletes.length, 2);
  });
});

/* ──────────────────────────────────────────────────────────────
 * 고아 파일
 * ────────────────────────────────────────────────────────────── */

test('isOrphanExpired: 가장 최근 파일이 30일을 넘겼을 때만 참', () => {
  const old = [{ created_at: new Date(NOW - 40 * DAY).toISOString() }];
  const mixed = [
    { created_at: new Date(NOW - 40 * DAY).toISOString() },
    { created_at: new Date(NOW - 2 * DAY).toISOString() },
  ];

  assert.strictEqual(cleanup.isOrphanExpired(old, NOW, 30), true);
  assert.strictEqual(cleanup.isOrphanExpired(mixed, NOW, 30), false);
  assert.strictEqual(cleanup.isOrphanExpired([], NOW, 30), false);
  // 시각을 못 읽으면 지우지 않습니다.
  assert.strictEqual(cleanup.isOrphanExpired([{ created_at: 'nope' }], NOW, 30), false);
});

test('cleanupOrphans: 행이 있는 폴더는 건드리지 않는다', async () => {
  const handler = (call) => {
    if (call.url.indexOf('/intake?select=id') !== -1) return { json: [{ id: 'live' }] };
    if (call.url.indexOf('/object/list/intake') !== -1) {
      const prefix = JSON.parse(call.body).prefix;
      if (prefix === '') {
        return { json: [{ name: 'live', id: null }, { name: 'orphan', id: null }] };
      }
      return { json: [{ name: '01-x.pdf', id: 'obj', created_at: new Date(NOW - 40 * DAY).toISOString() }] };
    }
    return { json: [] };
  };

  await withFakeFetch(handler, async (calls) => {
    const result = await cleanup.cleanupOrphans(CONFIG, { apply: true, now: NOW });

    assert.strictEqual(result.folders, 1);
    assert.strictEqual(result.files, 1);

    const listed = calls
      .filter((c) => c.url.indexOf('/object/list/intake') !== -1)
      .map((c) => JSON.parse(c.body).prefix);
    assert.deepStrictEqual(listed, ['', 'orphan'], '살아 있는 폴더는 열어보지도 않습니다');

    const deletes = calls.filter((c) => c.method === 'DELETE');
    assert.strictEqual(deletes.length, 1);
    assert.deepStrictEqual(JSON.parse(deletes[0].body).prefixes, ['orphan/01-x.pdf']);
  });
});

test('cleanupOrphans: 행 목록 조회가 실패하면 한 건도 지우지 않는다', async () => {
  await withFakeFetch((call) => {
    if (call.url.indexOf('/intake?select=id') !== -1) return { ok: false, status: 500, json: {} };
    return { json: [] };
  }, async (calls) => {
    await assert.rejects(
      () => cleanup.cleanupOrphans(CONFIG, { apply: true, now: NOW }),
      /id select HTTP 500/
    );
    assert.strictEqual(calls.filter((c) => c.method === 'DELETE').length, 0);
  });
});

test('cleanupOrphans: 30일이 안 된 고아 폴더는 남긴다', async () => {
  const handler = (call) => {
    if (call.url.indexOf('/intake?select=id') !== -1) return { json: [] };
    if (call.url.indexOf('/object/list/intake') !== -1) {
      const prefix = JSON.parse(call.body).prefix;
      if (prefix === '') return { json: [{ name: 'fresh', id: null }] };
      return { json: [{ name: '01-x.pdf', id: 'obj', created_at: new Date(NOW - 3 * DAY).toISOString() }] };
    }
    return { json: [] };
  };

  await withFakeFetch(handler, async (calls) => {
    const result = await cleanup.cleanupOrphans(CONFIG, { apply: true, now: NOW });
    assert.strictEqual(result.folders, 0);
    assert.strictEqual(calls.filter((c) => c.method === 'DELETE').length, 0);
  });
});

test('cleanupOrphans: 미리보기는 세기만 한다', async () => {
  const handler = (call) => {
    if (call.url.indexOf('/intake?select=id') !== -1) return { json: [] };
    if (call.url.indexOf('/object/list/intake') !== -1) {
      const prefix = JSON.parse(call.body).prefix;
      if (prefix === '') return { json: [{ name: 'orphan', id: null }] };
      return { json: [{ name: '01-x.pdf', id: 'obj', created_at: new Date(NOW - 90 * DAY).toISOString() }] };
    }
    return { json: [] };
  };

  await withFakeFetch(handler, async (calls) => {
    const result = await cleanup.cleanupOrphans(CONFIG, { apply: false, now: NOW });
    assert.strictEqual(result.folders, 1);
    assert.strictEqual(result.files, 1);
    assert.strictEqual(calls.filter((c) => c.method === 'DELETE').length, 0);
  });
});

/* ──────────────────────────────────────────────────────────────
 * main
 * ────────────────────────────────────────────────────────────── */

test('main: 환경변수가 없으면 2 를 돌려주고 아무것도 부르지 않는다', async () => {
  const url = process.env.INTAKE_SUPABASE_URL;
  const key = process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.INTAKE_SUPABASE_URL;
  delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;

  const errors = [];
  const originalError = console.error;
  console.error = (m) => errors.push(String(m));

  try {
    await withFakeFetch(() => ({ json: [] }), async (calls) => {
      const code = await cleanup.main([]);
      assert.strictEqual(code, 2);
      assert.strictEqual(calls.length, 0);
      assert.ok(errors.join('\n').indexOf('INTAKE_SUPABASE_URL') !== -1);
    });
  } finally {
    console.error = originalError;
    if (url) process.env.INTAKE_SUPABASE_URL = url;
    if (key) process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = key;
  }
});

test('main: --apply 없이 부르면 삭제 요청이 나가지 않는다', async () => {
  process.env.INTAKE_SUPABASE_URL = CONFIG.baseUrl;
  process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  const logs = [];
  const originalLog = console.log;
  console.log = (m) => logs.push(String(m));

  try {
    await withFakeFetch(expiredHandler, async (calls) => {
      const code = await cleanup.main([]);
      assert.strictEqual(code, 0);
      assert.strictEqual(calls.filter((c) => c.method === 'DELETE').length, 0);
      assert.ok(logs[0].indexOf('[미리보기]') === 0);
    });
  } finally {
    console.log = originalLog;
    delete process.env.INTAKE_SUPABASE_URL;
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
  }
});

test('main: 서비스 키를 로그에 남기지 않는다', async () => {
  process.env.INTAKE_SUPABASE_URL = CONFIG.baseUrl;
  process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = 'super-secret-service-role-key';

  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (m) => logs.push(String(m));
  console.error = (m) => logs.push(String(m));

  try {
    await withFakeFetch(expiredHandler, async () => {
      await cleanup.main(['--apply']);
      assert.strictEqual(logs.join('\n').indexOf('super-secret-service-role-key'), -1);
    });
  } finally {
    console.log = originalLog;
    console.error = originalError;
    delete process.env.INTAKE_SUPABASE_URL;
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
  }
});

test('main: 정리가 실패하면 1 을 돌려준다', async () => {
  process.env.INTAKE_SUPABASE_URL = CONFIG.baseUrl;
  process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};

  try {
    await withFakeFetch(() => ({ ok: false, status: 500, json: {} }), async () => {
      assert.strictEqual(await cleanup.main(['--apply']), 1);
    });
  } finally {
    console.log = originalLog;
    console.error = originalError;
    delete process.env.INTAKE_SUPABASE_URL;
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
  }
});
