/*
 * Supabase 키 이름 해석 가드레일.
 *
 *   npm test        (node --test test/)
 *
 * 회전 중에 실제로 나는 사고는 「연결이 안 된다」가 아닙니다.
 * 레거시가 살아 있는 동안은 잘못 넣어도 전부 통과하기 때문에,
 * 사고는 **레거시를 끄는 순간** 처음 드러납니다. 그때는 이미 늦습니다.
 *
 * 그래서 여기서 보는 것은 연결이 아니라 **이름과 값의 관계**입니다.
 *
 * 가장 먼저 보는 것은 「두 쌍이 서로 섞이지 않는가」입니다.
 * 두 쌍은 서로 다른 Supabase 프로젝트를 보므로, 한쪽 이름이 다른 쪽 폴백으로
 * 새는 순간 조용히 엉뚱한 프로젝트에 씁니다 — 응답은 계속 정상입니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const KEYS = require('../api/_supabase-keys.js');

const NEW = 'sb_secret_AbCdEf0123456789';
const LEGACY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig';
const PUBLISHABLE = 'sb_publishable_AbCdEf0123456789';

/* ── 경계: 두 쌍이 섞이지 않는가 ──────────────────────────────────────────── */

test('두 쌍은 이름을 하나도 공유하지 않는다', () => {
  const intake = [
    KEYS.INTAKE_ENV_NAMES.url.current, KEYS.INTAKE_ENV_NAMES.url.legacy,
    KEYS.INTAKE_ENV_NAMES.key.current, KEYS.INTAKE_ENV_NAMES.key.legacy,
  ].filter(Boolean);
  const uae = [
    KEYS.UAE_LOG_ENV_NAMES.url.current, KEYS.UAE_LOG_ENV_NAMES.url.legacy,
    KEYS.UAE_LOG_ENV_NAMES.key.current, KEYS.UAE_LOG_ENV_NAMES.key.legacy,
  ].filter(Boolean);

  const shared = intake.filter((n) => uae.indexOf(n) !== -1);
  assert.deepStrictEqual(shared, [],
    '두 쌍이 이름을 공유하면 한쪽 값만 바꿔도 다른 쪽이 조용히 따라 움직입니다: ' + shared.join(', '));
});

test('앞단 쌍은 INTAKE_ 접두사를 유지한다', () => {
  assert.ok(KEYS.INTAKE_ENV_NAMES.key.current.indexOf('INTAKE_') === 0);
  assert.strictEqual(KEYS.INTAKE_ENV_NAMES.key.legacy, 'INTAKE_SUPABASE_SERVICE_ROLE_KEY');
});

test('/uae 로그 쌍의 구 이름은 종전 그대로여서 폴백이 실제로 동작한다', () => {
  // 이 두 이름은 지금 Vercel 에 설정돼 있는 이름입니다.
  // 오타가 나면 회전 전에 이미 로그가 끊기는데, 응답은 200 이라 아무도 모릅니다.
  assert.strictEqual(KEYS.UAE_LOG_ENV_NAMES.url.legacy, 'SUPABASE_URL');
  assert.strictEqual(KEYS.UAE_LOG_ENV_NAMES.key.legacy, 'SUPABASE_SERVICE_ROLE_KEY');
});

/* ── 체계 판정 ──────────────────────────────────────────────────────────── */

test('값의 생김새로 체계를 가른다', () => {
  assert.strictEqual(KEYS.classify(NEW), 'new');
  assert.strictEqual(KEYS.classify(LEGACY), 'legacy');
  assert.strictEqual(KEYS.classify(PUBLISHABLE), 'publishable');
  assert.strictEqual(KEYS.classify('nonsense'), 'unrecognized');
  assert.strictEqual(KEYS.classify(''), 'unrecognized');
});

test('publishable 은 new 로 오인되지 않는다', () => {
  // 둘 다 "sb_" 로 시작하므로 접두사를 대충 보면 통과합니다.
  assert.notStrictEqual(KEYS.classify(PUBLISHABLE), 'new');
});

/* ── 우선순위와 폴백 ────────────────────────────────────────────────────── */

const KEY_NAMES = KEYS.INTAKE_ENV_NAMES.key;

test('신규 이름이 있으면 신규 이름이 이긴다', () => {
  const env = {};
  env[KEY_NAMES.current] = NEW;
  env[KEY_NAMES.legacy] = LEGACY;

  const r = KEYS.resolveKey(KEY_NAMES, env);
  assert.strictEqual(r.value, NEW);
  assert.strictEqual(r.source, KEY_NAMES.current);
  assert.strictEqual(r.scheme, 'new');
  assert.strictEqual(r.legacyStillSet, true, '구 이름이 남아 있으면 그렇다고 알려야 합니다');
  assert.strictEqual(r.warning, null);
});

test('신규 이름이 없으면 구 이름으로 떨어진다 — 회전 전에도 그대로 돈다', () => {
  const env = {};
  env[KEY_NAMES.legacy] = LEGACY;

  const r = KEYS.resolveKey(KEY_NAMES, env);
  assert.strictEqual(r.value, LEGACY);
  assert.strictEqual(r.source, KEY_NAMES.legacy);
  assert.strictEqual(r.scheme, 'legacy');
});

test('둘 다 없으면 값이 없다', () => {
  const r = KEYS.resolveKey(KEY_NAMES, {});
  assert.strictEqual(r.value, undefined);
  assert.strictEqual(r.source, null);
  assert.strictEqual(r.scheme, null);
  assert.strictEqual(r.legacyStillSet, false);
});

test('구 이름을 지우면 legacyStillSet 이 내려간다 — 이행 완료의 판정 근거', () => {
  const env = {};
  env[KEY_NAMES.current] = NEW;

  const r = KEYS.resolveKey(KEY_NAMES, env);
  assert.strictEqual(r.legacyStillSet, false);
});

/* ── 이행 중 사고 ───────────────────────────────────────────────────────── */

test('신규 이름에 레거시 값을 넣으면 경고가 난다', () => {
  // 뒷단 이행에서 실제로 났던 사고입니다. 연결 검사는 전부 통과했습니다
  // — 레거시가 아직 살아 있었기 때문입니다. 잡아낸 것은 이 신호뿐이었습니다.
  const env = {};
  env[KEY_NAMES.current] = LEGACY;

  const r = KEYS.resolveKey(KEY_NAMES, env);
  assert.ok(r.warning, '신규 이름에 구 값이 들어가면 반드시 경고해야 합니다');
  assert.ok(r.warning.indexOf(KEY_NAMES.current) !== -1, '어느 변수인지 이름을 적어야 합니다');
});

test('경고 문구에 키 값이 새지 않는다', () => {
  const env = {};
  env[KEY_NAMES.current] = LEGACY;

  const r = KEYS.resolveKey(KEY_NAMES, env);
  assert.strictEqual(r.warning.indexOf(LEGACY), -1, '경고에 키 값을 담으면 로그로 유출됩니다');
});

test('아는 체계가 아닌 값도 경고한다', () => {
  const env = {};
  env[KEY_NAMES.current] = 'oops-pasted-the-wrong-thing';

  const r = KEYS.resolveKey(KEY_NAMES, env);
  assert.ok(r.warning);
  assert.strictEqual(r.scheme, 'unrecognized');
});

test('구 이름에 남아 있는 레거시 값은 경고 대상이 아니다', () => {
  // 회전 전의 정상 상태입니다. 여기서 경고하면 회전 중 내내 시끄러워집니다.
  const env = {};
  env[KEY_NAMES.legacy] = LEGACY;

  const r = KEYS.resolveKey(KEY_NAMES, env);
  assert.strictEqual(r.warning, null);
});

/* ── 리더 배선 ──────────────────────────────────────────────────────────── */

test('readConfig 는 신규 이름을 먼저 읽고 구 이름으로 떨어진다', () => {
  const saved = {
    url: process.env.INTAKE_SUPABASE_URL,
    cur: process.env.INTAKE_SUPABASE_SECRET_KEY,
    leg: process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY,
  };
  delete require.cache[require.resolve('../api/_supabase.js')];
  const { readConfig } = require('../api/_supabase.js');

  try {
    process.env.INTAKE_SUPABASE_URL = 'https://example.supabase.co';

    delete process.env.INTAKE_SUPABASE_SECRET_KEY;
    process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = LEGACY;
    let c = readConfig();
    assert.strictEqual(c.ok, true, '회전 전(구 이름만)에도 그대로 돌아야 합니다');
    assert.strictEqual(c.keySource, 'INTAKE_SUPABASE_SERVICE_ROLE_KEY');
    assert.strictEqual(c.keyScheme, 'legacy');

    process.env.INTAKE_SUPABASE_SECRET_KEY = NEW;
    c = readConfig();
    assert.strictEqual(c.ok, true);
    assert.strictEqual(c.keySource, 'INTAKE_SUPABASE_SECRET_KEY', '신규 이름이 이겨야 합니다');
    assert.strictEqual(c.keyScheme, 'new');
    assert.strictEqual(c.headers.apikey, NEW);
    assert.strictEqual(c.legacyStillSet, true);
  } finally {
    if (saved.url === undefined) delete process.env.INTAKE_SUPABASE_URL;
    else process.env.INTAKE_SUPABASE_URL = saved.url;
    if (saved.cur === undefined) delete process.env.INTAKE_SUPABASE_SECRET_KEY;
    else process.env.INTAKE_SUPABASE_SECRET_KEY = saved.cur;
    if (saved.leg === undefined) delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
    else process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = saved.leg;
    delete require.cache[require.resolve('../api/_supabase.js')];
  }
});

test('readConfig 는 비밀 자리의 공개 키를 세운다', () => {
  const saved = {
    url: process.env.INTAKE_SUPABASE_URL,
    cur: process.env.INTAKE_SUPABASE_SECRET_KEY,
    leg: process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY,
  };
  delete require.cache[require.resolve('../api/_supabase.js')];
  const { readConfig } = require('../api/_supabase.js');

  try {
    process.env.INTAKE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.INTAKE_SUPABASE_SECRET_KEY = PUBLISHABLE;
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;

    const c = readConfig();
    assert.strictEqual(c.ok, false);
    assert.strictEqual(c.reason, 'publishable-key-in-secret-slot');
    assert.strictEqual(c.error.indexOf(PUBLISHABLE), -1, '오류 문구에 키 값을 담지 않습니다');
  } finally {
    if (saved.url === undefined) delete process.env.INTAKE_SUPABASE_URL;
    else process.env.INTAKE_SUPABASE_URL = saved.url;
    if (saved.cur === undefined) delete process.env.INTAKE_SUPABASE_SECRET_KEY;
    else process.env.INTAKE_SUPABASE_SECRET_KEY = saved.cur;
    if (saved.leg === undefined) delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
    else process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = saved.leg;
    delete require.cache[require.resolve('../api/_supabase.js')];
  }
});

test('api/lookup-log.js 는 앞단 쌍의 이름을 읽지 않는다', () => {
  // grep 으로 잡히는 주석이 아니라 실제 소스에서 확인합니다.
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'api', 'lookup-log.js'), 'utf8');

  assert.strictEqual(/process\.env\.INTAKE_/.test(src), false,
    '/uae 로그가 앞단 프로젝트를 보면 로그가 조용히 엉뚱한 곳에 쌓입니다');
});

test('api/_supabase.js 는 /uae 로그 쌍의 이름을 읽지 않는다', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'api', '_supabase.js'), 'utf8');

  assert.strictEqual(/process\.env\.(UAE_LOG_|SUPABASE_SERVICE_ROLE_KEY)/.test(src), false);
});
