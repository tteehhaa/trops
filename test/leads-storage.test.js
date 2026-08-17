'use strict';

/**
 * api/leads.js 의 저장 경로(2026-08-18 신설) — `public.leads` 에 실제로 남는지,
 * 그리고 **저장 실패가 접수 응답을 막지 않는지**를 확인한다.
 *
 * ⚠️ `test/leads-consent.test.js` 는 검증 실패 경로만 본다(성공 경로는 실제 메일이
 *    나가므로 그 파일에 추가하지 말라고 못 박혀 있다). 이 파일은 Resend 를 통째로
 *    가짜로 바꿔치기해 **성공 경로**를 안전하게 돈다 — 실제 메일도, 실제 Supabase
 *    호출도 나가지 않는다.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

/* ── Resend 를 통째로 가짜로 바꾼다 ── */
const resendPath = require.resolve('resend');
const sentEmails = [];
require.cache[resendPath] = {
  id: resendPath,
  filename: resendPath,
  loaded: true,
  exports: {
    Resend: class {
      constructor() {
        this.emails = {
          send: async (payload) => {
            sentEmails.push(payload);
            return { data: { id: 'fake-email-id' }, error: null };
          },
        };
      }
    },
  },
};

const handler = require('../api/leads.js');

function fakeRes() {
  const captured = { statusCode: null, body: null };
  return {
    captured,
    status(code) { captured.statusCode = code; return this; },
    json(payload) { captured.body = payload; return this; },
  };
}

async function post(body, run) {
  sentEmails.length = 0;
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

const VALID = {
  name: '홍길동',
  email: 'test@example.com',
  company: 'ACME',
  consentPrivacy: true,
  consentMarketing: false,
};

test('제출이 성공하면 메일 두 통 + leads 저장 1건이 나간다', async () => {
  const { captured, calls } = await post({ ...VALID, inquiry: '가격이 궁금합니다' });
  assert.equal(captured.statusCode, 200);
  assert.equal(captured.body.ok, true);
  assert.equal(sentEmails.length, 2, '담당자 알림 + 신청자 확인 두 통이어야 합니다');

  const leadsCalls = calls.filter((c) => c.url.indexOf('/leads') !== -1);
  assert.equal(leadsCalls.length, 1, 'leads 저장 호출이 정확히 1건이어야 합니다');
  const row = JSON.parse(leadsCalls[0].body);
  assert.equal(row.name, '홍길동');
  assert.equal(row.email, 'test@example.com');
  assert.equal(row.company, 'ACME');
  assert.equal(row.inquiry, '가격이 궁금합니다');
  assert.equal(row.consent_privacy, true);
  assert.equal(row.consent_marketing, false);
});

test('문의 내용이 없으면 inquiry 가 null 로 저장된다 — 빈 문자열이 아니다', async () => {
  const { calls } = await post({ ...VALID });
  const row = JSON.parse(calls.filter((c) => c.url.indexOf('/leads') !== -1)[0].body);
  assert.equal(row.inquiry, null);
});

test('🔴 Supabase 미설정이어도 접수 응답은 그대로 200이다 — 메일이 우선이다', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('호출되면 안 됩니다 — 미설정이면 시도조차 하지 않습니다'); };
  try {
    const res = fakeRes();
    await handler({ method: 'POST', body: { ...VALID } }, res);
    assert.equal(res.captured.statusCode, 200, 'Supabase 미설정이 접수 자체를 막았습니다');
    assert.equal(res.captured.body.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('🔴 leads 저장이 실패해도 접수 응답은 그대로 200이다', async () => {
  process.env.INTAKE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  console.error = () => {};
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  try {
    const res = fakeRes();
    await handler({ method: 'POST', body: { ...VALID } }, res);
    assert.equal(res.captured.statusCode, 200, 'leads 저장 실패가 접수 응답을 막았습니다');
    assert.equal(res.captured.body.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    delete process.env.INTAKE_SUPABASE_URL;
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
  }
});
