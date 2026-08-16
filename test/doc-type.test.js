/*
 * 서류 종류 파라미터 테스트 〔S5 · 흐름 md §5 「확장 구조」 · 신설 2026-08-13〕
 *
 *   npm test        (node --test test/)
 *
 * 여기서 보는 것은 넷입니다.
 *
 *   ① 아는 값만 통과하는가 — 그리고 **모르는 값을 조용히 눕히지 않는가**.
 *      이것이 이 파일의 중심입니다. 다른 allowlist(readDeclaration 등)와 달리
 *      docType 은 틀리면 400 이어야 합니다 — 조용히 'nda' 로 눕히면 계약서를
 *      보낸 사람의 서류가 NDA 기준으로 대조되고 아무 흔적도 남지 않습니다.
 *   ② **실제로 저장되는가** — insert 행에 doc_type 이 실리는지. 「판정 함수가 있다」
 *      는 것으로는 부족합니다. 배선이 끊기면 화면만 바뀌고 값은 사라집니다.
 *   ③ 화면·서버·DB 세 목록이 갈리지 않는가 — 세 파일을 실제로 읽어 대조합니다.
 *   ④ 로그인 필드가 새로 들어오지 않았는가 — 접수흐름 「회원가입 불요」는
 *      흐름 md §1 이 이번에도 유지 결정한 설계원칙입니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/* ── _notify.js 대역 (test/intake-own-form.test.js 와 같은 이유) ───────────── */

const notifyPath = path.join(ROOT, 'api', '_notify.js');
const mails = [];

require.cache[notifyPath] = {
  id: notifyPath,
  filename: notifyPath,
  loaded: true,
  exports: {
    RETENTION_DAYS: 30,
    buildMagicLink: (t) => 'https://trops.kr/precheck?r=' + t,
    sendIntakeMails: async (info) => { mails.push(info); return { confirmationSent: true }; },
    sendErasureMails: async () => ({ confirmationSent: true }),
  },
};

const intake = require('../api/intake.js');

/* ── 도구 ──────────────────────────────────────────────────────────────────── */

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

function file(name) {
  return { name: name, type: 'application/pdf', size: 8, data: Buffer.alloc(8, 0x41).toString('base64') };
}

function withFakeSupabase(run) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  console.error = () => {};

  process.env.INTAKE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), method: (init && init.method) || 'GET', body: init && init.body };
    calls.push(call);
    const okJson = (json) => ({ ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) });
    if (call.url.indexOf('/rpc/claim_slot') !== -1) return okJson([{ claimed: true, used: 3, slot_limit: 20 }]);
    return okJson({});
  };

  mails.length = 0;

  return Promise.resolve(run(calls)).finally(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    delete process.env.INTAKE_SUPABASE_URL;
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
  });
}

function post(body) {
  return { method: 'POST', body: body, query: {} };
}

function base(overrides) {
  return Object.assign({
    email: 'buyer@example.com',
    consentTerms: true,
    files: [file('nda.pdf')],
  }, overrides || {});
}

function insertedRow(calls) {
  const call = calls.find((c) => c.method === 'POST' && /\/rest\/v1\/intake(\?|$)/.test(c.url));
  assert.ok(call, 'intake insert 요청이 없습니다');
  return JSON.parse(call.body);
}

/* ── ① 판정 ────────────────────────────────────────────────────────────────── */

test('지금 받는 서류 종류는 nda 하나다', () => {
  assert.deepStrictEqual(intake.DOC_TYPES, ['nda']);
});

test('nda 는 통과한다', () => {
  assert.deepStrictEqual(intake.parseDocType('nda'), { ok: true, docType: 'nda' });
});

test('대소문자·공백은 정돈해서 받는다 — 사람이 손으로 부르는 API 도 있다', () => {
  assert.deepStrictEqual(intake.parseDocType(' NDA '), { ok: true, docType: 'nda' });
});

test('값이 없으면 nda 다 — 선택 상자가 없던 캐시 화면도 접수돼야 한다', () => {
  for (const empty of [undefined, null, '']) {
    assert.deepStrictEqual(intake.parseDocType(empty), { ok: true, docType: 'nda' },
      JSON.stringify(empty) + ' 를 기본값으로 받지 않았습니다');
  }
});

test('🔴 준비중인 종류는 조용히 눕히지 않고 거절한다', () => {
  // 이것이 이 파일에서 가장 중요한 단정입니다.
  // 'nda' 로 눕히면 계약서를 보낸 사람의 서류가 NDA 기준으로 대조되고,
  // 화면·메일·DB 어디에도 어긋난 흔적이 남지 않습니다.
  for (const value of ['contract', 'quotation', 'po']) {
    const got = intake.parseDocType(value);
    assert.strictEqual(got.ok, false, value + ' 가 통과했습니다');
    assert.strictEqual(got.error, 'unsupported-doc-type');
    assert.strictEqual(got.docType, undefined, value + ' 를 값으로 눕혔습니다');
  }
});

test('문자열이 아니면 거절한다', () => {
  for (const value of [1, true, {}, []]) {
    assert.strictEqual(intake.parseDocType(value).ok, false, JSON.stringify(value) + ' 가 통과했습니다');
  }
});

test('표기는 코드값을 그대로 노출하지 않는다', () => {
  assert.strictEqual(intake.docTypeLabel('nda'), '비밀유지계약서(NDA)');
});

test('모르는 코드값은 지어내지 않고 그대로 돌려준다', () => {
  assert.strictEqual(intake.docTypeLabel('contract'), 'contract');
});

/* ── ② 배선 — 실제로 저장되는가 ───────────────────────────────────────────── */

test('접수하면 doc_type 이 insert 행에 실린다', () => withFakeSupabase(async (calls) => {
  const res = fakeRes();
  await intake(post(base({ docType: 'nda' })), res);

  assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
  assert.strictEqual(insertedRow(calls).doc_type, 'nda');
}));

test('docType 을 안 보내도 doc_type 은 nda 로 저장된다', () => withFakeSupabase(async (calls) => {
  const res = fakeRes();
  await intake(post(base()), res);

  assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
  assert.strictEqual(insertedRow(calls).doc_type, 'nda',
    'doc_type 이 없으면 DB not null 제약에 걸립니다');
}));

test('준비중 종류로 접수하면 400 이고 아무것도 저장되지 않는다', () => withFakeSupabase(async (calls) => {
  const res = fakeRes();
  await intake(post(base({ docType: 'contract' })), res);

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.field, 'docType');
  assert.ok(
    !calls.some((c) => c.method === 'POST' && /\/rest\/v1\/intake(\?|$)/.test(c.url)),
    '거절했는데 행이 저장됐습니다'
  );
  assert.ok(
    !calls.some((c) => c.url.indexOf('/object/') !== -1),
    '거절했는데 파일이 업로드됐습니다'
  );
}));

test('거절은 슬롯을 쓰지 않는다 — 20건이 잘못 소진되면 안 된다', () => withFakeSupabase(async (calls) => {
  const res = fakeRes();
  await intake(post(base({ docType: 'quotation' })), res);

  assert.strictEqual(res.statusCode, 400);
  assert.ok(
    !calls.some((c) => c.url.indexOf('/rpc/claim_slot') !== -1),
    '거절했는데 슬롯을 점유했습니다'
  );
}));

test('운영자 알림에 서류 종류 표기가 실린다', () => withFakeSupabase(async () => {
  const res = fakeRes();
  await intake(post(base({ docType: 'nda' })), res);

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(mails.length, 1);
  assert.strictEqual(mails[0].docTypeLabel, '비밀유지계약서(NDA)');
}));

/* ── ③ 세 목록이 갈리지 않는가 ────────────────────────────────────────────── */

test('DB check 가 서버 목록과 같은 종류만 허용한다', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'precheck-schema.sql'), 'utf8');
  // create table 안의 제약과 0-H 절의 alter, 둘 다 있어야 합니다 —
  // 새로 만드는 프로젝트와 이미 만든 프로젝트가 같은 규칙을 가져야 합니다.
  const occurrences = sql.match(/check \(doc_type in \(([^)]*)\)\)/g) || [];
  assert.ok(occurrences.length >= 2,
    'doc_type check 가 create table · 0-H 두 곳에 다 있어야 합니다 — 찾은 수: ' + occurrences.length);

  for (const found of occurrences) {
    const listed = found.match(/'([a-z_]+)'/g).map((s) => s.replace(/'/g, ''));
    assert.deepStrictEqual(listed, intake.DOC_TYPES,
      'DB check 목록이 api/intake.js DOC_TYPES 와 다릅니다: ' + found);
  }
});

/*
 * 🔴 `value="other"`(그 외 서류)를 이 대조에서 제외합니다 〔2026-08-16 · 대표 지시〕.
 * disabled 도 아니고 서버 DOC_TYPES 에도 없는 **세 번째 부류**입니다 — 고를 수는
 * 있지만 제출 값이 아니라 [문의하기]로 돌리는 스위치입니다. 아래 두 번째 테스트가
 * 그 스위치가 실제로 제출을 막는지(JS 정적 확인)를 봅니다.
 */
test('화면에서 고를 수 있는 종류가 서버 목록과 같다 (그 외 서류 제외)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');
  const select = html.match(/<select id="intake-doc-type"[\s\S]*?<\/select>/);
  assert.ok(select, 'precheck.html 에 문서 종류 선택 상자가 없습니다');

  const options = select[0].match(/<option[^>]*>/g) || [];
  const enabled = options
    .filter((o) => o.indexOf('disabled') === -1 && o.indexOf('value="other"') === -1)
    .map((o) => (o.match(/value="([^"]*)"/) || [])[1]);

  assert.deepStrictEqual(enabled, intake.DOC_TYPES,
    '화면에서 고를 수 있는 종류(그 외 서류 제외)가 서버가 받는 종류와 다릅니다');
  assert.ok(options.length > enabled.length + 1,
    '준비중 옵션이 하나도 없습니다 — 흐름 md §5 는 확장 예정을 이 자리에서 보여 주라고 합니다');
  assert.ok(select[0].indexOf('value="other"') !== -1,
    '[그 외 서류] 옵션이 없습니다');
  assert.ok(!/value="other"[^>]*disabled|disabled[^>]*value="other"/.test(select[0]),
    '[그 외 서류]가 disabled 입니다 — 활성화(선택 가능)가 요구사항입니다');
});

test('[그 외 서류]를 고르면 제출을 막고 문의하기로 안내한다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');
  assert.ok(/id="doc-type-other"[^>]*hidden[^>]*>[\s\S]*?문의하기/.test(html) ||
    /id="doc-type-other"[\s\S]{0,10}hidden[\s\S]*?문의하기/.test(html),
    '[그 외 서류] 선택 시 보일 문의하기 안내(#doc-type-other)가 없습니다');
  assert.ok(/purpose=inquiry#interest/.test(html),
    '문의하기 안내가 랜딩 §10 의 문의 목적(?purpose=inquiry)으로 연결되지 않습니다');

  const script = html.slice(html.indexOf('<script>'));
  assert.ok(/docType === 'other'/.test(script) || /docType==='other'/.test(script),
    'onSubmit 에 docType===\'other\' 방어선이 없습니다 — 버튼 잠금이 어떤 이유로 풀려도 ' +
    '서버가 400 으로 조용히 막는 대신, 여기서 사람이 알아볼 수 있는 안내로 막아야 합니다');
  assert.ok(/isOther/.test(script),
    '[그 외 서류] 선택 시 제출 버튼을 잠그는 처리가 없습니다');
});

/* ── ④ 로그인 필드가 들어오지 않았는가 ───────────────────────────────────── */

test('🔴 접수 화면에 로그인·계정 필드가 없다 — 회원가입 불요는 설계원칙이다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');
  // 주석은 걷어냅니다 — 주석에 「로그인」이라는 낱말이 (원칙을 설명하려고) 나옵니다.
  const markup = html.replace(/<!--[\s\S]*?-->/g, '');

  assert.ok(!/type="password"/.test(markup), '비밀번호 입력칸이 생겼습니다');
  for (const name of ['password', 'passwd', 'username', 'userId', 'signup', 'login']) {
    assert.ok(
      !new RegExp('name="' + name + '"', 'i').test(markup),
      'name="' + name + '" 필드가 생겼습니다 — 접수는 무로그인을 유지합니다'
    );
  }

  // 약속의 문면이 그대로 남아 있는지도 봅니다. 필드가 없는 것과
  // 「필요 없습니다」라고 말해 두는 것은 다른 일입니다.
  assert.ok(
    markup.indexOf('로그인이나 회원가입은 필요 없습니다') !== -1,
    '무로그인 약속 문면(.pay-note)이 사라졌습니다'
  );
});

/* ── ⑤ 마이그레이션 순서에 의존하지 않는가 ───────────────────────────────── */

/*
 * 🔴 이 절이 배포 안전장치입니다.
 *
 * doc_type 은 접수 경로가 **실제로 insert 하는** 컬럼입니다. 컬럼이 없는 환경에
 * 이 코드가 먼저 배포되면 PostgREST 가 PGRST204 로 거절하고 **모든 접수가 502** 가
 * 됩니다. precheck-schema.sql 「0-F」 절이 세워 둔 원칙이 그것을 금합니다 —
 * 「마이그레이션을 잊었을 때 깨지는 것이 운영 도구 하나이지 접수 전체가 아니어야
 * 합니다」. 그래서 「그런 칸 없다」는 응답에는 그 칸을 떼고 한 번 더 넣습니다.
 *
 * ⚠️ 이 테스트가 「스키마를 실행하지 않아도 된다」는 뜻은 아닙니다. 폴백으로 저장된
 *    행은 doc_type 이 DB 기본값으로 남습니다.
 */

/** 첫 insert 만 「그런 칸 없다」로 거절하는 가짜 Supabase. */
function withMissingColumn(body, run) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args.map(String).join(' '));

  process.env.INTAKE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

  let inserts = 0;

  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), method: (init && init.method) || 'GET', body: init && init.body };
    calls.push(call);
    const okJson = (json) => ({ ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) });

    if (call.url.indexOf('/rpc/claim_slot') !== -1) return okJson([{ claimed: true, used: 3, slot_limit: 20 }]);

    const isInsert = call.method === 'POST' && /\/rest\/v1\/intake(\?|$)/.test(call.url);
    if (isInsert) {
      inserts += 1;
      if (inserts === 1) {
        return {
          ok: false, status: 400,
          json: async () => ({}),
          text: async () => JSON.stringify({
            code: 'PGRST204',
            message: "Could not find the 'doc_type' column of 'intake' in the schema cache",
          }),
        };
      }
    }
    return okJson({});
  };

  mails.length = 0;

  return Promise.resolve(run(calls, errors, () => inserts)).finally(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    delete process.env.INTAKE_SUPABASE_URL;
    delete process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY;
  });
}

test('🔴 doc_type 컬럼이 아직 없어도 접수는 성공한다 — 502 를 내지 않는다', () =>
  withMissingColumn(base(), async (calls, errors, insertCount) => {
    const res = fakeRes();
    await intake(post(base()), res);

    assert.strictEqual(res.statusCode, 201,
      '컬럼 하나가 없어서 접수 전체를 잃었습니다: ' + JSON.stringify(res.body));
    assert.strictEqual(insertCount(), 2, '떼고 한 번 더 넣는 재시도가 없습니다');

    const bodies = calls
      .filter((c) => c.method === 'POST' && /\/rest\/v1\/intake(\?|$)/.test(c.url))
      .map((c) => JSON.parse(c.body));
    assert.ok('doc_type' in bodies[0], '첫 시도는 doc_type 을 넣어야 합니다');
    assert.ok(!('doc_type' in bodies[1]), '재시도가 doc_type 을 떼지 않았습니다');
    // 접수 성립에 필요한 값은 그대로 남아야 합니다.
    assert.strictEqual(bodies[1].email, 'buyer@example.com');
    assert.ok(Array.isArray(bodies[1].file_paths) && bodies[1].file_paths.length > 0);
  }));

test('폴백으로 저장했으면 로그에 크게 남긴다 — 잊은 것을 조용히 넘기지 않는다', () =>
  withMissingColumn(base(), async (calls, errors) => {
    const res = fakeRes();
    await intake(post(base()), res);

    assert.strictEqual(res.statusCode, 201);
    const note = errors.join('\n');
    assert.match(note, /doc_type/, '어느 컬럼이 없었는지가 로그에 없습니다');
    assert.match(note, /0-H/, '무엇을 실행해야 하는지가 로그에 없습니다');
  }));

test('재시도는 한 번뿐이다 — 컬럼을 떼어 가며 성공을 쫓지 않는다', () => {
  // 무한 재시도는 「어느 칸이 사라졌는지 모르는 채 행이 저장되는」 상태를 만듭니다.
  // 재시도 대상 목록이 비어 있으면(=뗄 것이 없으면) 그대로 던져야 합니다.
  assert.deepStrictEqual(intake.OPTIONAL_COLUMNS, ['doc_type', 'pre_session_key'],
    '재시도 대상은 「없어도 사실이 어긋나지 않는」 컬럼만입니다');
});

test('「그런 칸 없다」와 진짜 실패를 가린다', () => {
  const missing = JSON.stringify({ code: 'PGRST204', message: "Could not find the 'doc_type' column" });
  assert.strictEqual(intake.isUnknownColumnError(400, missing), true);
  assert.strictEqual(intake.isUnknownColumnError(400, 'column intake.doc_type does not exist'), true);
  assert.strictEqual(intake.isUnknownColumnError(400, '{"code":"42703"}'), true);

  // 아래는 컬럼 문제가 아닙니다 — 떼고 다시 넣으면 안 됩니다.
  assert.strictEqual(intake.isUnknownColumnError(400, '{"code":"23505","message":"duplicate key"}'), false,
    '중복키 오류에 컬럼을 떼고 재시도하면 안 됩니다');
  assert.strictEqual(intake.isUnknownColumnError(500, missing), false, '서버 오류는 재시도 대상이 아닙니다');
  assert.strictEqual(intake.isUnknownColumnError(401, ''), false);
});
