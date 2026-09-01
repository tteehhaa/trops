'use strict';

/**
 * §10 사전등록 필수 동의를 서버가 실제로 막는지 확인하는 테스트 (2026-08-11).
 *
 * 클라이언트(index.html · en.html)에도 같은 검사가 있지만 그것은 사용자 안내용입니다.
 * 브라우저를 거치지 않는 요청(curl · 스크립트 · 폼 스크립트를 지운 브라우저)은
 * 여기를 지나가므로, 동의 없는 접수를 실제로 막는 것은 서버뿐입니다.
 *
 * ⚠️ 이 테스트는 메일을 보내지 않습니다. 대부분의 요청은 입력 검증 단계에서 끊기고,
 *    Resend 호출은 그 뒤에 있습니다. RESEND_API_KEY 없이 돌아갑니다.
 *
 * 🔄 **성공 경로 둘이 생겼습니다** 〔2026-09-01 · 이름을 선택으로 열면서〕. 종전 머리주석은
 *    「성공 경로를 여기에 추가하지 마십시오 — 실제 메일이 나갑니다」였습니다. 그 금지가
 *    지키려던 것은 **메일이 나가지 않는 것**이지 「성공 경로를 재지 않는 것」이 아닙니다.
 * 🔴 그래서 금지를 푸는 대신 **나갈 길을 막았습니다** — resend 클라이언트는 전역 `fetch`
 *    로 나가므로(node_modules/resend `fetchRequest`), 그 두 검사가 `globalThis.fetch` 를
 *    가로채고 `finally` 에서 되돌립니다. 네트워크로 나가는 것이 없습니다.
 * ⛔ 가로채기 없이 성공 경로를 추가하지 마십시오 — 그때는 정말로 메일이 나갑니다.
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

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **이메일은 필수, 이름은 선택** 〔2026-09-01 · 대표 지시로 종전 「이름·이메일 검증은
 *    종전대로 동작한다」를 대체〕
 * ══════════════════════════════════════════════════════════════════════════════
 * 종전 검사는 「이름이 없으면 400」을 잠그고 있었습니다. 그 잠금 때문에
 * `/contact?type=notify`(이메일 한 칸)가 이 엔드포인트를 쓰려면 **없는 이름을 지어내야**
 * 했고, 첫 판이 이메일 주소를 이름 자리에 넣었습니다(확인 메일이
 * 「someone@example.com님, 안녕하세요」로 나갑니다). 계약을 열고 그 우회를 걷었습니다.
 *
 * ⛔ **여기서 「이름 없으면 400」을 되살리지 마십시오** — 되살리면 notify 접수가 전부
 *    막히거나, 다시 이름을 지어내는 우회가 생깁니다.
 */

test('이메일 형식이 틀리면 400 — 이메일은 여전히 필수다', async () => {
  const badEmail = await post({ name: '홍길동', email: 'nope', consentPrivacy: true });
  assert.equal(badEmail.statusCode, 400);

  const noEmail = await post({ name: '홍길동', consentPrivacy: true });
  assert.equal(noEmail.statusCode, 400);
});

test('이름이 문자열이 아니면 400 — .trim() 이 터져 500 이 되는 것을 막는다', async () => {
  for (const bad of [123, {}, []]) {
    const out = await post({ name: bad, email: 'a@b.co', consentPrivacy: true });
    assert.equal(out.statusCode, 400, `name=${JSON.stringify(bad)} 가 통과했습니다`);
    assert.equal(out.body.field, 'name');
  }
});

/*
 * 🔴 **여기부터는 «성공 경로»입니다** — 파일 머리주석의 금지를 이 검사만 예외로 둡니다.
 *
 * ⚠️ 머리주석이 「성공 경로를 추가하지 마십시오 — 실제 메일이 나갑니다」라고 적은 이유는
 *    resend 클라이언트가 **전역 `fetch`** 로 나가기 때문입니다(node_modules/resend
 *    `fetchRequest`). 그래서 **그 `fetch` 를 가로챕니다.** 네트워크로 나가는 것이 없으므로
 *    메일도 나가지 않고, 그 상태에서 상태코드를 실측할 수 있습니다.
 * ⛔ `globalThis.fetch` 복원을 `finally` 밖으로 빼지 마십시오 — 복원을 놓치면 이 파일
 *    뒤의 검사와 다른 테스트 파일이 가짜 fetch 를 물려받습니다.
 * ⚠️ `saveLeadRow` 도 fetch 를 쓰지만 Supabase 설정이 없어 그 앞에서 멈춥니다(로그만).
 */
test('🔴 이름 없이 제출해도 200 이다 — 이름은 선택 항목이다', async () => {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: options && options.body });
    return new Response(JSON.stringify({ id: 'stub-no-mail' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  let out;
  try {
    out = await post({ email: 'noname@example.com', consentPrivacy: true });
  } finally {
    globalThis.fetch = realFetch;
  }

  assert.equal(out.statusCode, 200, '이름 없이 제출했는데 ' + out.statusCode + ' 입니다');
  assert.deepStrictEqual(out.body, { ok: true });

  /* 실제로 메일 API 를 두드렸는지(=가로채기가 헛돌지 않았는지) 확인합니다. */
  const mail = calls.filter((c) => /resend/i.test(c.url));
  assert.ok(mail.length >= 1, 'resend 호출이 0건입니다 — 가로채기가 엉뚱한 곳을 잡았습니다');

  /* 🔴 인사말에 이름이 없어야 합니다 — 이메일 주소로 부르지 않습니다. */
  const confirm = mail.map((c) => String(c.body)).find((b) => b.includes('안녕하세요'));
  assert.ok(confirm, '확인 메일 본문을 찾지 못했습니다');
  assert.ok(
    confirm.includes('안녕하세요.') && !confirm.includes('님, 안녕하세요'),
    '이름이 없는데 「…님, 안녕하세요」로 부릅니다'
  );
  assert.ok(!confirm.includes('noname@example.com님'), '이메일 주소를 이름처럼 부릅니다');
});

test('이름을 주면 인사말이 그 이름을 부른다', async () => {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: options && options.body });
    return new Response(JSON.stringify({ id: 'stub-no-mail' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  let out;
  try {
    out = await post({ name: '홍길동', email: 'named@example.com', consentPrivacy: true });
  } finally {
    globalThis.fetch = realFetch;
  }

  assert.equal(out.statusCode, 200);
  const confirm = calls.map((c) => String(c.body)).find((b) => b.includes('안녕하세요'));
  assert.ok(confirm && confirm.includes('홍길동님, 안녕하세요'), '이름을 부르지 않습니다');
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
