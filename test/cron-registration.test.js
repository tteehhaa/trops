'use strict';

/**
 * Vercel Cron 라우트 가드레일 (2026-08-11).
 *
 * 왜 필요한가: cron 은 **아무도 안 볼 때 돕니다.** 잘못 서 있어도 증상이
 * 몇 주 뒤에 「30일 지난 파일이 아직 있다」로만 나타납니다. 그래서 라우트가
 * 갖춰야 할 조건을 코드가 아니라 테스트가 단정합니다.
 *
 * 여기서 지키는 것:
 *   1. vercel.json 등재 ↔ 실제 파일 — 양방향 (한쪽만 있으면 조용히 안 돕니다)
 *   2. 전 라우트가 CRON_SECRET 을 검사한다
 *   3. 인증 불일치 · CRON_SECRET 미설정 → 404 (401 도 200 도 아님)
 *   4. env 미등록(configured:false) 상태에서 아무것도 지우지 않는다
 *   5. 스케줄이 Vercel 이 받는 꼴이고, Hobby 제약(하루 1회 · 2개)을 넘지 않는다
 *
 * 3·4 는 실제로 핸들러를 불러 확인합니다 — 소스에 문자열이 있는지가 아니라
 * 응답이 무엇인지가 지켜야 할 약속입니다.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CRON_DIR = path.join(ROOT, 'api', 'cron');

/** Hobby 플랜 제약. 플랜을 올리면 이 값을 함께 올리십시오. */
const MAX_CRONS_HOBBY = 2;

function vercelJson() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
}

/** api/cron/ 아래 실제 라우트 파일 → "/api/cron/<name>" */
function routeFiles() {
  if (!fs.existsSync(CRON_DIR)) return [];
  return fs
    .readdirSync(CRON_DIR)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
    .map((f) => ({ file: path.join(CRON_DIR, f), route: '/api/cron/' + f.replace(/\.js$/, '') }));
}

/** 응답을 담아 두는 최소 res 목. Vercel 의 res 는 Node 응답 + json/status 입니다. */
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

/** 핸들러를 env 를 바꿔 끼우고 한 번 부릅니다. 원래 env 는 반드시 되돌립니다. */
async function invoke(file, { env, headers, method }) {
  const saved = {};
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }

  try {
    delete require.cache[require.resolve(file)];
    const handler = require(file);
    const { res, captured } = mockRes();
    await handler({ method: method || 'GET', headers: headers || {} }, res);
    return captured;
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    delete require.cache[require.resolve(file)];
  }
}

/** 접속이 절대 성립하지 않는 env — configured:false 경로를 강제합니다. */
const UNCONFIGURED = {
  INTAKE_SUPABASE_URL: undefined,
  INTAKE_SUPABASE_SECRET_KEY: undefined,
  INTAKE_SUPABASE_SERVICE_ROLE_KEY: undefined,
};

const SECRET = 'test-cron-secret-0123456789';

test('vercel.json 의 cron 경로가 전부 실재한다', () => {
  const crons = vercelJson().crons || [];
  assert.ok(crons.length > 0, 'vercel.json 에 crons 가 없습니다');

  const existing = new Set(routeFiles().map((r) => r.route));
  for (const cron of crons) {
    assert.ok(
      existing.has(cron.path),
      `vercel.json 이 ${cron.path} 를 등재했는데 api/cron/ 에 파일이 없습니다`
    );
  }
});

test('api/cron/ 의 라우트가 전부 vercel.json 에 등재돼 있다', () => {
  // 이 방향이 더 조용한 실패입니다 — 파일만 있으면 아무 일도 일어나지 않습니다.
  const registered = new Set((vercelJson().crons || []).map((c) => c.path));
  for (const { route } of routeFiles()) {
    assert.ok(
      registered.has(route),
      `${route} 파일이 있는데 vercel.json 의 crons 에 없습니다 — 영원히 안 돕니다`
    );
  }
});

test('정리 배치가 등재돼 있다', () => {
  // 이름을 박아 둡니다. 위 두 검사는 「목록이 서로 맞는가」만 보므로
  // 둘 다 비어 있어도 통과합니다.
  const registered = (vercelJson().crons || []).map((c) => c.path);
  assert.ok(
    registered.includes('/api/cron/cleanup-expired'),
    '/precheck 30일 정리 배치가 vercel.json 에 없습니다'
  );
});

test('환불 배치가 등재돼 있다 〔M-2〕', () => {
  // 이것이 빠지면 「범위 밖」으로 뒤집힌 유상 건의 돈이 조용히 남습니다 —
  // 아무 화면도 깨지지 않으므로 증상이 「환불이 안 됐다」로만 나타납니다.
  const registered = (vercelJson().crons || []).map((c) => c.path);
  assert.ok(
    registered.includes('/api/cron/refund-blocked'),
    '「범위 밖」 자동 환불 배치가 vercel.json 에 없습니다'
  );
});

test('cron 이 같은 시(hour)에 겹치지 않는다', () => {
  /*
   * Hobby 플랜은 지정한 시각의 **시 안에서** 부르고 분을 보장하지 않습니다.
   * 그래서 분만 다르게 두면 두 배치가 같은 시각에 겹칠 수 있고, 하나는
   * 삭제하고 하나는 환불하는 배치가 같은 행을 동시에 보게 됩니다.
   * (판정층 trops_a 의 cron 3개와도 시를 겹치지 않게 골랐습니다 —
   *  근거는 각 라우트 머리주석에 있습니다.)
   */
  const hours = (vercelJson().crons || []).map((c) => String(c.schedule).trim().split(/\s+/)[1]);
  assert.strictEqual(new Set(hours).size, hours.length, '같은 시에 도는 cron 이 있습니다: ' + hours.join(', '));
});

test('스케줄이 Hobby 제약을 지킨다 — 하루 1회 · 프로젝트당 2개', () => {
  const crons = vercelJson().crons || [];
  assert.ok(
    crons.length <= MAX_CRONS_HOBBY,
    `cron ${crons.length}개 — Hobby 플랜 상한 ${MAX_CRONS_HOBBY}개를 넘습니다`
  );

  for (const cron of crons) {
    const fields = String(cron.schedule || '').trim().split(/\s+/);
    assert.equal(fields.length, 5, `${cron.path}: cron 식이 5필드가 아닙니다 — ${cron.schedule}`);

    const [minute, hour] = fields;
    // 분·시에 * 이나 목록/스텝이 있으면 하루 여러 번입니다 (Hobby 는 하루 1회).
    assert.match(minute, /^\d{1,2}$/, `${cron.path}: 분이 고정값이 아닙니다 — 하루 여러 번 돕니다`);
    assert.match(hour, /^\d{1,2}$/, `${cron.path}: 시가 고정값이 아닙니다 — 하루 여러 번 돕니다`);
    assert.ok(Number(minute) <= 59 && Number(hour) <= 23, `${cron.path}: 분·시 범위를 넘습니다`);
  }
});

test('전 라우트가 CRON_SECRET 을 읽는다', () => {
  const routes = routeFiles();
  assert.ok(routes.length > 0, 'api/cron/ 에 라우트가 없습니다');

  for (const { file, route } of routes) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(src.includes('process.env.CRON_SECRET'), `${route}: CRON_SECRET 검사가 없습니다`);
  }
});

test('CRON_SECRET 이 맞지 않으면 404 — 존재를 알리지 않는다', async () => {
  for (const { file, route } of routeFiles()) {
    const wrong = await invoke(file, {
      env: Object.assign({ CRON_SECRET: SECRET }, UNCONFIGURED),
      headers: { authorization: 'Bearer wrong-secret' },
    });
    assert.equal(wrong.code, 404, `${route}: 틀린 secret 에 ${wrong.code} 를 줬습니다 (404 이어야 함)`);
    assert.equal(wrong.body, undefined, `${route}: 404 에 본문을 실었습니다`);

    const none = await invoke(file, {
      env: Object.assign({ CRON_SECRET: SECRET }, UNCONFIGURED),
      headers: {},
    });
    assert.equal(none.code, 404, `${route}: 헤더 없는 호출에 ${none.code} 를 줬습니다`);
  }
});

test('CRON_SECRET 이 아예 없으면 404 — 미설정을 통과로 읽지 않는다', async () => {
  // 이것이 이 파일에서 가장 중요한 단정입니다.
  // 미설정을 통과로 읽으면 env 를 안 넣은 상태가 곧 무인증 삭제 엔드포인트가 됩니다.
  for (const { file, route } of routeFiles()) {
    for (const headers of [{}, { authorization: 'Bearer ' }, { authorization: 'Bearer undefined' }]) {
      const got = await invoke(file, {
        env: Object.assign({ CRON_SECRET: undefined }, UNCONFIGURED),
        headers: headers,
      });
      assert.equal(
        got.code,
        404,
        `${route}: CRON_SECRET 미설정 + ${JSON.stringify(headers)} 에 ${got.code} 를 줬습니다`
      );
    }
  }
});

test('env 미등록이면 configured:false 로 아무것도 지우지 않는다', async () => {
  const file = path.join(CRON_DIR, 'cleanup-expired.js');
  const got = await invoke(file, {
    env: Object.assign({ CRON_SECRET: SECRET }, UNCONFIGURED),
    headers: { authorization: 'Bearer ' + SECRET },
  });

  // 500 이 아닙니다 — 매일 500 이 나면 경보가 무뎌지고 진짜 실패가 묻힙니다.
  assert.equal(got.code, 200, `configured:false 인데 ${got.code} 를 줬습니다`);
  assert.equal(got.body.configured, false, 'configured 가 false 가 아닙니다');
  assert.equal(got.body.ok, true, '「돌았고 붙어 있지 않았다」는 실패가 아닙니다');

  // 삭제 결과 자체가 없어야 합니다 — 있으면 배치가 돌았다는 뜻입니다.
  assert.equal(got.body.expired, undefined, 'configured:false 인데 배치가 돌았습니다');
  assert.equal(got.body.orphans, undefined, 'configured:false 인데 고아 정리가 돌았습니다');

  // 경계를 응답에 남기는지 — 다음 사람이 「이거 하나면 되는구나」로 읽지 않도록.
  assert.match(String(got.body.note), /trops_a/, '판정층 소관 경계가 응답에 없습니다');
});

test('인증을 통과해도 GET 이 아니면 405', async () => {
  const file = path.join(CRON_DIR, 'cleanup-expired.js');
  const got = await invoke(file, {
    env: Object.assign({ CRON_SECRET: SECRET }, UNCONFIGURED),
    headers: { authorization: 'Bearer ' + SECRET },
    method: 'POST',
  });
  assert.equal(got.code, 405, `POST 에 ${got.code} 를 줬습니다`);
});

test('cron 라우트가 캐시되지 않는다', () => {
  // 보관 배치가 캐시된 응답을 돌려주면 「지웠다」고 보고하고 아무것도 안 지운
  // 상태가 됩니다. 이 저장소의 다른 라우트(api/erasure.js)와 같은 처리입니다.
  for (const { file, route } of routeFiles()) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(
      /Cache-Control['"]?\s*,\s*['"]no-store/.test(src),
      `${route}: Cache-Control: no-store 가 없습니다`
    );
  }
});

test('배치 본체가 api/ 에 있다 — 함수 번들이 scripts/ 에 의존하지 않는다', () => {
  // scripts/ 는 buildCommand 때문에 업로드됩니다. 함수가 거기를 require 하면
  // .vercelignore 한 줄이 배포된 함수를 조용히 깨뜨릴 수 있습니다.
  for (const { file, route } of routeFiles()) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(
      !/require\(['"][^'"]*scripts\//.test(src),
      `${route}: scripts/ 를 require 합니다. 공유 코드는 api/_*.js 로 옮기십시오`
    );
  }
});

test('CLI 스크립트와 cron 라우트가 같은 배치 본체를 본다', () => {
  // 복제하면 한쪽만 고쳐지고 다른 쪽이 조용히 옛 방식으로 남습니다.
  const shared = require('../api/_cleanup.js');
  const script = require('../scripts/cleanup-expired.js');

  assert.equal(script.cleanupExpired, shared.cleanupExpired, 'CLI 가 다른 cleanupExpired 를 씁니다');
  assert.equal(script.cleanupOrphans, shared.cleanupOrphans, 'CLI 가 다른 cleanupOrphans 를 씁니다');

  const routeSrc = fs.readFileSync(path.join(CRON_DIR, 'cleanup-expired.js'), 'utf8');
  assert.match(routeSrc, /require\(['"]\.\.\/_cleanup\.js['"]\)/, '라우트가 _cleanup.js 를 안 씁니다');
});
