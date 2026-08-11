'use strict';

/**
 * §10 사전등록 필수 동의를 서버가 실제로 막는지 확인하는 테스트 (2026-08-11).
 *
 * 클라이언트(index.html · en.html)에도 같은 검사가 있지만 그것은 사용자 안내용입니다.
 * 브라우저를 거치지 않는 요청(curl · 스크립트 · 폼 스크립트를 지운 브라우저)은
 * 여기를 지나가므로, 동의 없는 접수를 실제로 막는 것은 서버뿐입니다.
 *
 * ⚠️ 이 테스트는 메일을 보내지 않습니다. 아래 요청은 전부 입력 검증 단계에서
 *    끊기고, Resend 호출은 그 뒤에 있습니다. RESEND_API_KEY 없이 돌아갑니다.
 *    성공 경로를 여기에 추가하지 마십시오 — 실제 메일이 나갑니다.
 */

const test = require('node:test');
const assert = require('node:assert');

// api/leads.js 는 모듈을 읽는 시점에 new Resend(process.env.RESEND_API_KEY) 를 만들고,
// 키가 없으면 그 자리에서 던집니다. 아래 요청은 전부 검증 단계에서 끊겨 이 클라이언트를
// 쓰지 않으므로, 모듈을 읽히기 위한 자리표시자만 넣습니다.
// ⚠️ 실제 키를 넣지 마십시오. 넣으면 성공 경로가 열려 메일이 나갈 수 있습니다.
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_test_placeholder';

const handler = require('../api/leads.js');

/** Vercel 핸들러가 기대하는 최소 형태의 res 대역. */
function fakeRes() {
  const captured = { statusCode: null, body: null };
  return {
    captured,
    status(code) {
      captured.statusCode = code;
      return this;
    },
    json(payload) {
      captured.body = payload;
      return this;
    },
  };
}

async function post(body) {
  const res = fakeRes();
  await handler({ method: 'POST', body }, res);
  return res.captured;
}

const VALID = { name: '홍길동', email: 'test@example.com', company: 'ACME' };

test('필수 동의가 없으면 400 이고 어느 필드인지 알려준다', async () => {
  const out = await post({ ...VALID });
  assert.equal(out.statusCode, 400);
  assert.equal(out.body.field, 'consentPrivacy');
});

test('필수 동의가 false 면 400', async () => {
  const out = await post({ ...VALID, consentPrivacy: false });
  assert.equal(out.statusCode, 400);
  assert.equal(out.body.field, 'consentPrivacy');
});

test('문자열 "true" 는 동의로 치지 않는다', async () => {
  // === true 엄격 비교를 지킵니다. 느슨하게 받으면 체크 안 한 폼이
  // 'on' · 1 · 'false' 같은 값으로 통과하는 경로가 생깁니다.
  for (const value of ['true', 1, 'on', 'yes', {}]) {
    const out = await post({ ...VALID, consentPrivacy: value });
    assert.equal(out.statusCode, 400, `consentPrivacy=${JSON.stringify(value)} 가 통과했습니다`);
    assert.equal(out.body.field, 'consentPrivacy');
  }
});

test('선택 동의는 없어도 필수 동의 검사를 통과한다', async () => {
  // 선택 동의 누락이 400 을 만들면 안 됩니다. 필수 동의를 준 상태에서
  // 검증 단계를 넘어갔는지만 봅니다 — 넘어가면 그다음은 메일 발송이라
  // 여기서는 "consentPrivacy 로 막히지 않았다"까지만 확인합니다.
  const out = await post({ ...VALID, consentPrivacy: true, email: 'not-an-email' });
  assert.equal(out.statusCode, 400);
  assert.equal(out.body.field, undefined, '이메일 형식 오류인데 동의 필드로 막혔습니다');
});

test('이름·이메일 검증은 종전대로 동작한다', async () => {
  const noName = await post({ email: 'a@b.co', consentPrivacy: true });
  assert.equal(noName.statusCode, 400);

  const badEmail = await post({ name: '홍길동', email: 'nope', consentPrivacy: true });
  assert.equal(badEmail.statusCode, 400);
});

test('POST 가 아니면 405', async () => {
  const res = fakeRes();
  await handler({ method: 'GET' }, res);
  assert.equal(res.captured.statusCode, 405);
});

test('본문이 아예 없어도 터지지 않는다', async () => {
  const res = fakeRes();
  await handler({ method: 'POST' }, res);
  assert.equal(res.captured.statusCode, 400);
});
