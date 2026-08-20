'use strict';

/**
 * Supabase URL 정규화 — http→https 다운그레이드 사고 전용 테스트.
 *
 * 왜 필요한가: Supabase REST 는 http:// 요청에 301 로 https:// 를 돌려주고,
 * fetch 는 그 리다이렉트에서 POST 를 GET 으로 깎고 본문을 버립니다(fetch 스펙의
 * 301/302 규칙). 결과는 error: null · status 200 · 빈 배열 — 성공처럼 보이는데
 * 행이 안 생깁니다. trops_a 에서 2026-08-13 에 실측된 사고이고(precheck_nda_run
 * 삽입이 배포에서만 죽어 있었습니다), 이 저장소의 api/_supabase.js ·
 * api/lookup-log.js 가 같은 모양(`/^https?:/` 허용)으로 열려 있었습니다.
 *
 * 정규화 단일 출처는 api/_supabase-keys.js 의 normalizeSupabaseUrl 이며,
 * trops_a lib/supabase/keys.ts 의 같은 이름 함수와 같은 규칙입니다.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const KEYS = require('../api/_supabase-keys.js');
const { normalizeSupabaseUrl } = KEYS;

test('http:// 실 도메인은 https 로 올린다 — 다운그레이드가 쓰기를 조용히 삼킨다', () => {
  assert.strictEqual(
    normalizeSupabaseUrl('http://abcdefghijklmnopqrst.supabase.co'),
    'https://abcdefghijklmnopqrst.supabase.co'
  );
  // 대소문자 스킴도 같은 판정
  assert.strictEqual(
    normalizeSupabaseUrl('HTTP://abcdefghijklmnopqrst.supabase.co'),
    'https://abcdefghijklmnopqrst.supabase.co'
  );
});

test('로컬 Supabase CLI 만 http 그대로 둔다', () => {
  assert.strictEqual(
    normalizeSupabaseUrl('http://localhost:54321'),
    'http://localhost:54321'
  );
  assert.strictEqual(
    normalizeSupabaseUrl('http://127.0.0.1:54321'),
    'http://127.0.0.1:54321'
  );
  // localhost 로 시작하는 실 도메인은 로컬이 아니다
  assert.strictEqual(
    normalizeSupabaseUrl('http://localhost.example.com'),
    'https://localhost.example.com'
  );
});

test('읽을 수 있는 형태는 채워 준다 — ref 단독 · 스킴 누락 · 꼬리 슬래시', () => {
  assert.strictEqual(
    normalizeSupabaseUrl('abcdefghijklmnopqrst'),
    'https://abcdefghijklmnopqrst.supabase.co'
  );
  assert.strictEqual(
    normalizeSupabaseUrl('abcdefghijklmnopqrst.supabase.co'),
    'https://abcdefghijklmnopqrst.supabase.co'
  );
  assert.strictEqual(
    normalizeSupabaseUrl('https://abcdefghijklmnopqrst.supabase.co///'),
    'https://abcdefghijklmnopqrst.supabase.co'
  );
});

test('못 읽는 값에는 null 로 답한다', () => {
  assert.strictEqual(normalizeSupabaseUrl(''), null);
  assert.strictEqual(normalizeSupabaseUrl('   '), null);
  assert.strictEqual(normalizeSupabaseUrl(null), null);
  assert.strictEqual(normalizeSupabaseUrl(undefined), null);
  assert.strictEqual(normalizeSupabaseUrl('nonsense'), null);
});

test('readConfig 가 http:// env 를 https baseUrl 로 올린다 (배선 확인)', () => {
  const saved = {
    url: process.env.INTAKE_SUPABASE_URL,
    key: process.env.INTAKE_SUPABASE_SECRET_KEY,
    legacy: process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY,
  };
  try {
    process.env.INTAKE_SUPABASE_URL = 'http://abcdefghijklmnopqrst.supabase.co';
    process.env.INTAKE_SUPABASE_SECRET_KEY = 'sb_secret_test_value_not_real';
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;

    const { readConfig } = require('../api/_supabase.js');
    const config = readConfig();
    assert.strictEqual(config.ok, true);
    assert.strictEqual(config.baseUrl, 'https://abcdefghijklmnopqrst.supabase.co');
    assert.strictEqual(config.restUrl, 'https://abcdefghijklmnopqrst.supabase.co/rest/v1');
  } finally {
    if (saved.url === undefined) delete process.env.INTAKE_SUPABASE_URL;
    else process.env.INTAKE_SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.INTAKE_SUPABASE_SECRET_KEY;
    else process.env.INTAKE_SUPABASE_SECRET_KEY = saved.key;
    if (saved.legacy === undefined) delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
    else process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = saved.legacy;
  }
});

test('두 소비처(_supabase.js · lookup-log.js)가 정규화 단일 출처를 거친다', () => {
  const root = path.resolve(__dirname, '..');
  for (const file of ['api/_supabase.js', 'api/lookup-log.js']) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(
      /KEYS\.normalizeSupabaseUrl\(/.test(src),
      file + ' 이 KEYS.normalizeSupabaseUrl 을 거치지 않습니다 — ' +
        'http:// 값이 그대로 통과하면 쓰기가 조용히 유실됩니다.'
    );
    assert.ok(
      !/\^https\?:\\\/\\\//.test(src),
      file + ' 에 http 를 허용하는 스킴 정규식(`^https?:`)이 남아 있습니다.'
    );
  }
});
