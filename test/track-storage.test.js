'use strict';

/**
 * api/track.js — 페이지 조회·버튼 클릭 익명 집계 (2026-08-18 신설).
 *
 * ⚠️ 이 요청은 항상 202 로 답한다(집계 실패가 페이지 동작을 막으면 안 된다는 게 이
 *    엔드포인트의 존재 이유다) — 입력이 아예 형식을 벗어난 경우만 400.
 */

const test = require('node:test');
const assert = require('node:assert');

const handler = require('../api/track.js');

function fakeRes() {
  const captured = { statusCode: null, body: null };
  return {
    captured,
    status(code) { captured.statusCode = code; return this; },
    json(payload) { captured.body = payload; return this; },
  };
}

async function post(body, run) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: (init && init.method) || 'GET', body: init && init.body });
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  };
  process.env.INTAKE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  try {
    const res = fakeRes();
    await handler({ method: 'POST', body }, res);
    return { captured: res.captured, calls };
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.INTAKE_SUPABASE_URL;
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
  }
}

test('POST 가 아니면 405', async () => {
  const res = fakeRes();
  await handler({ method: 'GET' }, res);
  assert.equal(res.captured.statusCode, 405);
});

test('kind 가 pageview/click 이 아니면 400', async () => {
  const { captured } = await post({ kind: 'bogus', path: '/' });
  assert.equal(captured.statusCode, 400);
  assert.equal(captured.body.field, 'kind');
});

test('path 가 없으면 400', async () => {
  const { captured } = await post({ kind: 'pageview' });
  assert.equal(captured.statusCode, 400);
  assert.equal(captured.body.field, 'path');
});

test('click 인데 label 이 없으면 400 — 어느 버튼인지 몰라서는 안 된다', async () => {
  const { captured } = await post({ kind: 'click', path: '/' });
  assert.equal(captured.statusCode, 400);
  assert.equal(captured.body.field, 'label');
});

test('pageview 는 label 없이도 통과하고 page_events 에 저장된다', async () => {
  const { captured, calls } = await post({ kind: 'pageview', path: '/precheck' });
  assert.equal(captured.statusCode, 202);
  const stored = calls.filter((c) => c.url.indexOf('/page_events') !== -1);
  assert.equal(stored.length, 1);
  const row = JSON.parse(stored[0].body);
  assert.equal(row.kind, 'pageview');
  assert.equal(row.path, '/precheck');
  assert.equal(row.label, null);
});

test('click 은 label 을 그대로 저장한다', async () => {
  const { calls } = await post({ kind: 'click', path: '/', label: 'inquiry_cta' });
  const row = JSON.parse(calls.filter((c) => c.url.indexOf('/page_events') !== -1)[0].body);
  assert.equal(row.kind, 'click');
  assert.equal(row.label, 'inquiry_cta');
});

test('🔴 개인 식별자를 저장하지 않는다 — 저장 행에 kind·path·label 세 칸뿐이다', async () => {
  const { calls } = await post({ kind: 'click', path: '/precheck', label: 'precheck_submit' });
  const row = JSON.parse(calls.filter((c) => c.url.indexOf('/page_events') !== -1)[0].body);
  assert.deepStrictEqual(Object.keys(row).sort(), ['kind', 'label', 'path']);
});

test('🔴 Supabase 미설정이어도 202 — 집계 실패가 페이지 동작을 막지 않는다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('호출되면 안 됩니다 — 미설정이면 시도조차 하지 않습니다'); };
  try {
    const res = fakeRes();
    await handler({ method: 'POST', body: { kind: 'pageview', path: '/' } }, res);
    assert.equal(res.captured.statusCode, 202);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('🔴 저장 실패해도 202 — 집계는 부가 기능이다', async () => {
  process.env.INTAKE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  console.error = () => {};
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  try {
    const res = fakeRes();
    await handler({ method: 'POST', body: { kind: 'pageview', path: '/' } }, res);
    assert.equal(res.captured.statusCode, 202);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    delete process.env.INTAKE_SUPABASE_URL;
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
  }
});

test('경로 길이 상한을 넘으면 400', async () => {
  const { captured } = await post({ kind: 'pageview', path: '/' + 'a'.repeat(301) });
  assert.equal(captured.statusCode, 400);
  assert.equal(captured.body.field, 'path');
});
