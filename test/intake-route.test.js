/*
 * 처리 가능 여부 읽기 · 문면 테스트 〔M-2 · 2026-08-11〕
 *
 *   npm test        (node --test test/)
 *
 * 여기서 지키는 것은 넷입니다. 순서가 중요도 순입니다.
 *
 *   1. **표가 없어도 접수 확인이 200 으로 뜬다.** 표는 다른 저장소(trops_a) 소관이고
 *      이 글을 쓰는 시점에 아직 없습니다. 부속 정보 하나가 접수 내용 전체를
 *      잃게 하면, 얻은 것보다 잃은 것이 큽니다.
 *   2. **문면 규칙(C2).** 「등급」·「부분」을 쓰지 않고, 언어 이름과
 *      「지원하지 않습니다」를 쓰지 않으며, route='ok' 는 아무 문면도 갖지 않습니다.
 *      이건 취향이 아니라 지시입니다 — 문장이 바뀌면 red 를 내야 합니다.
 *   3. **append-only 의 마지막 행만 본다.** 뒤집힘이 새 행으로 오기 때문입니다.
 *   4. **문면이 M-1 과 어긋나지 않는다.** 업로드 시점과 확인 시점이 같은 사실을
 *      다른 문장으로 말하면 이용자는 다른 일이 생긴 줄 압니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

/* ── _notify.js 대역 (모듈을 읽는 순간 Resend 를 만들므로 먼저 꽂습니다) ────── */

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
    sendRouteRefundMail: async () => ({ sent: true, error: null }),
  },
};

const ROUTE = require('../api/_intake-route.js');
const intake = require('../api/intake.js');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = {
  restUrl: 'https://example.supabase.co/rest/v1',
  headers: { apikey: 'k', Authorization: 'Bearer k' },
};

function okJson(json) {
  return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
}

function errJson(status, text) {
  return { ok: false, status: status, json: async () => ({}), text: async () => text || '' };
}

/** fetch 를 갈아 끼우고 되돌립니다. handler(url) 이 응답을 돌려줍니다. */
async function withFetch(handler, run) {
  const original = globalThis.fetch;
  const originalError = console.error;
  const calls = [];
  console.error = () => {};
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    return handler(String(url), init);
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
    console.error = originalError;
  }
}

/* ── 1. 문면 규칙 (C2) ─────────────────────────────────────────────────────── */

test('route=ok 은 대외 문면이 없다 — 진행 가능하면 표시하지 않는다', () => {
  assert.strictEqual(ROUTE.noticeFor('ok', null), null);
  assert.strictEqual(ROUTE.noticeFor('ok', 'scan-only'), null);
  // 모르는 route 도 문면이 없습니다 — 아는 값만 문면을 갖습니다.
  assert.strictEqual(ROUTE.noticeFor('partial', null), null);
  assert.strictEqual(ROUTE.noticeFor(null, null), null);
});

test('blocked 는 사유를 몰라도 문면이 있다 — 그리고 그 문면이 언어 사유와 같다', () => {
  // 모르는 사유에 다른 문장을 쓰면 그 차이 자체가 무슨 일이 있었는지를 흘립니다.
  assert.strictEqual(ROUTE.noticeFor('blocked', null), ROUTE.FALLBACK_NOTICE);
  assert.strictEqual(ROUTE.noticeFor('blocked', 'something-new'), ROUTE.FALLBACK_NOTICE);
  assert.strictEqual(ROUTE.FALLBACK_NOTICE, ROUTE.NOTICES['unsupported-language']);
});

test('문면에 「등급」·「부분」이 없다 (C2 규칙)', () => {
  for (const [reason, text] of Object.entries(ROUTE.NOTICES)) {
    assert.ok(text.indexOf('등급') === -1, reason + ' 문면에 「등급」이 있습니다: ' + text);
    assert.ok(text.indexOf('부분') === -1, reason + ' 문면에 「부분」이 있습니다: ' + text);
  }
});

test('언어 사유 문면에 언어 이름도 「지원하지 않습니다」도 없다', () => {
  const text = ROUTE.NOTICES['unsupported-language'];

  // 판정층 문면(「v1이 지원하지 않는 언어입니다」)을 가져오지 않았다는 단정입니다.
  // 두 문면을 「통일」하는 순간 이 테스트가 red 를 냅니다 — 그것이 의도입니다.
  for (const banned of ['지원하지 않', '지원 안', 'v1']) {
    assert.ok(text.indexOf(banned) === -1, '금지 표현 「' + banned + '」 가 있습니다: ' + text);
  }
  for (const language of ['아랍', '중국', '일본', '태국', '히브리', '러시아', '베트남', '언어']) {
    assert.ok(text.indexOf(language) === -1, '언어를 가리키는 낱말이 있습니다: ' + language);
  }

  // 무엇을 말해야 하는가 — 「지금 확인할 수 있는 범위 밖」 계열 (재착수 결정 ③).
  assert.match(text, /범위 밖/);
});

/* ── 2. M-1 문장과 어긋나지 않는다 ─────────────────────────────────────────── */

test('scan-only 문면이 업로드 시점 M-1 문장과 글자 그대로 같다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');
  const match = html.match(/<p id="textlayer-msg">([^<]*)<\/p>/);
  assert.ok(match, 'precheck.html 에서 #textlayer-msg 를 찾지 못했습니다');

  assert.strictEqual(
    ROUTE.NOTICES['scan-only'],
    match[1].trim(),
    '업로드 안내와 확인 화면 안내가 갈라졌습니다 — 같은 사실을 두 문장으로 말하면 ' +
    '이용자는 다른 일이 생긴 줄 압니다. 두 자리를 함께 고치십시오.'
  );
});

test('사유 코드가 판정층 정본 2종과 같다', () => {
  // trops_a lib/rules/l1/preflight.ts 의 PreflightStop.
  // 늘어나면 NOTICES 와 함께 늘리십시오(늘리지 않아도 FALLBACK 으로 안전히 떨어집니다).
  assert.deepStrictEqual(ROUTE.REASONS, ['scan-only', 'unsupported-language']);
  assert.deepStrictEqual(ROUTE.ROUTES, ['ok', 'blocked']);
  for (const reason of ROUTE.REASONS) {
    assert.ok(ROUTE.NOTICES[reason], reason + ' 의 문면이 없습니다');
  }
});

/* ── 3. 읽기 — 아는 값만 · 마지막 행만 ─────────────────────────────────────── */

test('아는 값만 통과한다 — 모르는 route 는 없는 것으로 둔다', () => {
  assert.strictEqual(ROUTE.readRow({ route: 'partial' }), null);
  assert.strictEqual(ROUTE.readRow({ route: '' }), null);
  assert.strictEqual(ROUTE.readRow({}), null);
  assert.strictEqual(ROUTE.readRow(null), null);

  // 모르는 사유는 버리지만 route 는 살립니다 — 막힌 사실 자체는 참입니다.
  const row = ROUTE.readRow({ route: 'blocked', reason: 'brand-new', decided_at: 'x' });
  assert.strictEqual(row.route, 'blocked');
  assert.strictEqual(row.reason, null);
});

test('append-only 표에서 마지막 행만 본다', async () => {
  await withFetch(
    () => okJson([{ route: 'ok', reason: null, decided_at: '2026-08-12T00:00:00Z' }]),
    async (calls) => {
      const got = await ROUTE.readLatestRoute(CONFIG, 'abc');
      assert.strictEqual(got.available, true);
      assert.strictEqual(got.row.route, 'ok');

      const url = calls[0];
      assert.match(url, /order=decided_at\.desc/, '내림차순 정렬이 없습니다 — 과거 행을 볼 수 있습니다');
      assert.match(url, /limit=1/);
      assert.match(url, /precheck_intake_route\?intake_id=eq\.abc/);
    }
  );
});

test('표가 없으면 available:false — 「행이 없다」와 섞지 않는다', async () => {
  await withFetch(() => errJson(404, 'relation does not exist'), async () => {
    const got = await ROUTE.readLatestRoute(CONFIG, 'abc');
    assert.strictEqual(got.available, false);
    assert.match(got.error, /precheck_intake_route/);
  });

  // 표는 읽혔고 이 건에 대한 판단이 아직 없는 경우 — 이쪽은 available:true 입니다.
  await withFetch(() => okJson([]), async () => {
    const got = await ROUTE.readLatestRoute(CONFIG, 'abc');
    assert.strictEqual(got.available, true);
    assert.strictEqual(got.row, null);
  });
});

test('접속이 던져도 던지지 않는다 — 확인 화면을 잃지 않기 위한 계약입니다', async () => {
  await withFetch(() => { throw new Error('ECONNREFUSED'); }, async () => {
    const got = await ROUTE.readLatestRoute(CONFIG, 'abc');
    assert.strictEqual(got.available, false);
    assert.match(got.error, /ECONNREFUSED/);
  });
});

test('blocked 후보 목록은 중복을 지운다', async () => {
  await withFetch(
    () => okJson([
      { intake_id: 'a', decided_at: '3' },
      { intake_id: 'b', decided_at: '2' },
      { intake_id: 'a', decided_at: '1' },
      { intake_id: null, decided_at: '0' },
    ]),
    async (calls) => {
      const got = await ROUTE.readBlockedIntakeIds(CONFIG);
      assert.strictEqual(got.available, true);
      assert.deepStrictEqual(got.ids, ['a', 'b']);
      assert.match(calls[0], /route=eq\.blocked/);
    }
  );
});

/* ── 4. 🔴 접수 확인 화면이 표 없이도 뜬다 (가장 중요) ─────────────────────── */

function receiptReq() {
  return { method: 'GET', query: { r: 'A'.repeat(24) }, url: '/api/intake?r=' + 'A'.repeat(24) };
}

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

const INTAKE_ROW = {
  id: 'intake-1',
  status: 'received',
  received_at: '2026-08-11T00:00:00Z',
  file_count: 1,
  slot_no: 3,
  delete_after: '2026-09-10T00:00:00Z',
  intake_path: 'paid',
  amount: 99000,
  payment_status: 'paid',
};

/** 접수 조회 응답은 항상 같고, route 표 응답만 갈아 끼웁니다. */
async function receiptWith(routeResponse) {
  process.env.INTAKE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

  try {
    return await withFetch(
      (url) => {
        if (url.indexOf('/precheck_intake_route') !== -1) return routeResponse();
        return okJson([INTAKE_ROW]);
      },
      async () => {
        const res = fakeRes();
        await intake(receiptReq(), res);
        return res;
      }
    );
  } finally {
    delete process.env.INTAKE_SUPABASE_URL;
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
  }
}

test('🔴 표가 없어도 접수 확인은 200 으로 뜬다 — routeNotice 만 null', async () => {
  const res = await receiptWith(() => errJson(404, 'relation "precheck_intake_route" does not exist'));

  assert.strictEqual(res.statusCode, 200, '표 하나 없다고 접수 내용을 잃었습니다');
  assert.strictEqual(res.body.ok, true);
  assert.strictEqual(res.body.routeNotice, null);
  // 종전 항목이 그대로 있는지 — 이 절이 다른 값을 건드리지 않았다는 단정입니다.
  assert.strictEqual(res.body.paymentStatus, 'paid');
  assert.strictEqual(res.body.fileCount, 1);
});

test('접수 직후처럼 행이 아직 없으면 아무 문면도 없다 — 「확인 중」을 두지 않는다', async () => {
  const res = await receiptWith(() => okJson([]));
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.routeNotice, null);
});

test('route=ok 이면 문면이 없다', async () => {
  const res = await receiptWith(() => okJson([{ route: 'ok', reason: null, decided_at: 'x' }]));
  assert.strictEqual(res.body.routeNotice, null);
});

test('route=blocked 이면 사유 문면이 실린다 — route 코드 자체는 내보내지 않는다', async () => {
  const res = await receiptWith(() =>
    okJson([{ route: 'blocked', reason: 'scan-only', decided_at: 'x' }]));

  assert.strictEqual(res.body.routeNotice, ROUTE.NOTICES['scan-only']);

  // 응답 본문에 내부 식별자를 흘리지 않습니다 — 화면이 쓸 것은 문장뿐입니다.
  const keys = Object.keys(res.body);
  assert.ok(keys.indexOf('route') === -1, '응답에 route 코드가 실렸습니다');
  assert.ok(keys.indexOf('routeReason') === -1, '응답에 사유 코드가 실렸습니다');
  assert.ok(keys.indexOf('id') === -1, '응답에 접수 id 가 실렸습니다');
});

/* ── 5. 화면 — 줄이 아니라 카드 · 등급 낱말 없음 ───────────────────────────── */

test('확인 화면이 문면을 만들지 않고 서버 문장을 그대로 쓴다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');
  const start = html.indexOf('function addRouteNotice');
  assert.ok(start !== -1, 'precheck.html 에 addRouteNotice 가 없습니다');
  const body = html.slice(start, html.indexOf('function addRow', start));

  // 사유 코드로 분기하면 문면 정본이 둘로 갈립니다.
  for (const code of ['scan-only', 'unsupported-language']) {
    assert.ok(body.indexOf(code) === -1, '화면이 사유 코드로 분기합니다: ' + code);
  }
  // 「처리 가능 여부: …」 같은 줄을 만들면 등급 축이 화면에 생깁니다.
  assert.ok(body.indexOf('addRow(') === -1, '안내를 접수 항목 줄로 만들었습니다');

  // 화면이 직접 쓰는 문장(따옴표 안)에 금지 낱말이 없는지. 주석은 배포본에서
  // 떼어지므로(scripts/build-static.js) 문자열만 봅니다.
  for (const literal of body.match(/'[^']*'/g) || []) {
    assert.ok(literal.indexOf('등급') === -1 && literal.indexOf('부분') === -1,
      '화면 문장에 「등급」·「부분」이 있습니다: ' + literal);
  }
});
