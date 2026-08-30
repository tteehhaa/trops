/*
 * 자료 즉시 삭제 CLI 테스트 〔scripts/erasure.js · 신설 2026-08-30〕
 *
 *   npm test        (node --test test/)
 *
 * 창구가 이메일이 되면서 **사람이 손으로 부르는 손잡이**가 생겼습니다. 되돌릴 수 없는
 * 일이므로 여기서 재는 것은 「지워야 하는가」가 아니라 **「시키지 않은 삭제가 일어나지
 * 않는가」**입니다.
 *
 * 재는 것 넷:
 *   ① 안전   `--apply` 없이는 본체를 **부르지 않는다**
 *   ② 경계   `--email` 로는 지우지 않는다(한 주소에 여러 건일 수 있다)
 *   ③ 형식   토큰이 아니면 조회조차 하지 않는다
 *   ④ 위임   `--apply` 면 본체를 **그대로** 부른다(사본 구현 0 · 동의 플래그 포함)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';

/* ── 대역 ─────────────────────────────────────────────────────────────────── */

const supabasePath = require.resolve('../api/_supabase.js');
const erasurePath = require.resolve('../api/erasure.js');

/** 본체 호출 기록 — ⓐ 몇 번 불렀나 ⓑ 무엇을 넘겼나. */
let handlerCalls = [];
/** REST 조회 기록. */
let queries = [];
/** 조회가 돌려줄 행. */
let rows = [];

function install(overrides) {
  handlerCalls = [];
  queries = [];
  rows = (overrides && overrides.rows) || [];

  require.cache[supabasePath] = {
    id: supabasePath, filename: supabasePath, loaded: true,
    exports: {
      readConfig: () => ({ ok: true, baseUrl: 'https://example.supabase.co', restUrl: 'REST', headers: {} }),
      safeText: async () => '',
      storageKey: (p) => p,
      removeObjects: async () => ({ deleted: 0 }),
      listObjects: async () => [],
    },
  };

  require.cache[erasurePath] = {
    id: erasurePath, filename: erasurePath, loaded: true,
    exports: async (req, res) => {
      handlerCalls.push(req.body);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ ok: true, filesDeleted: 2 });
    },
  };

  global.fetch = async (url) => {
    queries.push(String(url));
    return { ok: true, status: 200, json: async () => rows };
  };

  delete require.cache[require.resolve('../scripts/erasure.js')];
  return require('../scripts/erasure.js');
}

const ROW = {
  id: 'intake-1',
  email: 'buyer@example.com',
  status: 'received',
  file_paths: ['intake/intake-1/a.pdf', 'intake/intake-1/b.pdf'],
  file_count: 2,
  received_at: '2026-08-12T03:00:00Z',
  access_token: TOKEN,
  erasure_requested_at: null,
};

/* ── ① 안전 ───────────────────────────────────────────────────────────────── */

test('--apply 없이는 본체를 부르지 않는다 — 미리보기는 읽기 전용이다', async () => {
  const cli = install({ rows: [ROW] });
  const code = await cli.main([TOKEN]);
  assert.strictEqual(code, 0);
  assert.strictEqual(handlerCalls.length, 0, '미리보기가 삭제를 불렀다');
  assert.strictEqual(queries.length, 1, '조회는 한 번이다');
});

test('이미 삭제된 건도 미리보기가 본체를 부르지 않는다', async () => {
  const cli = install({ rows: [Object.assign({}, ROW, { erasure_requested_at: '2026-08-20T00:00:00Z' })] });
  await cli.main([TOKEN]);
  assert.strictEqual(handlerCalls.length, 0);
});

/* ── ② 경계 ───────────────────────────────────────────────────────────────── */

test('--email 로는 지우지 않는다 — 한 주소에 여러 건일 수 있다', async () => {
  const cli = install({ rows: [ROW] });
  const code = await cli.main(['--email', 'buyer@example.com', '--apply']);
  assert.strictEqual(code, 2, '거절해야 한다');
  assert.strictEqual(handlerCalls.length, 0, '이메일로 삭제가 일어났다');
});

test('--email 은 찾기만 하고 토큰을 보여 준다', async () => {
  const cli = install({ rows: [ROW] });
  const code = await cli.main(['--email', 'buyer@example.com']);
  assert.strictEqual(code, 0);
  assert.strictEqual(handlerCalls.length, 0);
  assert.ok(queries[0].includes('email=eq.'), '이메일 축으로 조회해야 한다');
});

test('맨 인자에 @ 가 있으면 이메일로 읽는다 — 토큰에는 @ 가 없다', async () => {
  const cli = install({ rows: [] });
  await cli.main(['buyer@example.com']);
  assert.ok(queries[0].includes('email=eq.'));
});

/* ── ③ 형식 ───────────────────────────────────────────────────────────────── */

test('토큰 형식이 아니면 조회조차 하지 않는다', async () => {
  const cli = install({ rows: [ROW] });
  const code = await cli.main(['짧음', '--apply']);
  assert.strictEqual(code, 2);
  assert.strictEqual(queries.length, 0, '형식 검사 전에 조회가 나갔다');
  assert.strictEqual(handlerCalls.length, 0);
});

test('인자가 없으면 사용법을 내고 멈춘다', async () => {
  const cli = install({ rows: [] });
  assert.strictEqual(await cli.main([]), 2);
  assert.strictEqual(queries.length, 0);
});

test('그 토큰의 기록이 없으면 실패로 끝난다', async () => {
  const cli = install({ rows: [] });
  assert.strictEqual(await cli.main([TOKEN, '--apply']), 1);
  assert.strictEqual(handlerCalls.length, 0);
});

/* ── ④ 위임 ───────────────────────────────────────────────────────────────── */

test('--apply 면 본체를 그대로 부른다 — 사본 구현 0 · 동의 플래그 포함', async () => {
  const cli = install({ rows: [ROW] });
  const code = await cli.main([TOKEN, '--apply']);
  assert.strictEqual(code, 0);
  assert.strictEqual(handlerCalls.length, 1, '본체를 정확히 한 번 부른다');
  assert.deepStrictEqual(handlerCalls[0], { token: TOKEN, confirmNoReissue: true });
});

test('🔴 스크립트가 파일을 스스로 지우지 않는다 — 삭제 코드는 본체에만 있다', () => {
  const src = require('node:fs').readFileSync(
    path.join(__dirname, '..', 'scripts', 'erasure.js'), 'utf8'
  );
  for (const forbidden of ['removeObjects', 'DELETE', 'patchByToken']) {
    assert.ok(!src.includes(forbidden), '스크립트가 삭제를 직접 한다: ' + forbidden);
  }
  assert.ok(src.includes("require('../api/erasure.js')"), '본체 위임이 사라졌다');
});

test('본체 응답이 실패면 종료코드가 1 이다 — 조용히 성공하지 않는다', async () => {
  const cli = install({ rows: [ROW] });
  require.cache[erasurePath].exports = async (req, res) => {
    handlerCalls.push(req.body);
    res.status(502).json({ error: 'delete failed' });
  };
  assert.strictEqual(await cli.main([TOKEN, '--apply']), 1);
});
