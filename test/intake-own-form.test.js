/*
 * api/intake.js 테스트 — 자사 서식(선택) 접수. 기준 우선순위 PRD-62 §3-3.
 *
 *   npm test        (node --test test/)
 *
 * 가장 먼저 보는 것은 "삭제 경로가 이 파일을 놓치지 않는가" 입니다.
 * 삭제 경로(api/erasure.js · scripts/cleanup-expired.js)는 file_paths 만 훑으므로,
 * 자사 서식이 own_form_path 에만 들어가면 30일 삭제와 즉시 삭제가 그 파일을 지나칩니다.
 * 지워지지 않는 고객 문서가 남는 것이 이 기능에서 가장 나쁜 결과입니다.
 *
 * 실제 Supabase 를 부르지 않고 globalThis.fetch 를 가짜로 바꿉니다.
 * api/_notify.js 는 모듈을 읽는 순간 Resend 클라이언트를 만들므로
 * require 캐시에 가짜를 먼저 꽂아 둡니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

/* ── _notify.js 대역 ───────────────────────────────────────────────────────── */

const notifyPath = path.join(__dirname, '..', 'api', '_notify.js');
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

function file(name, bytes) {
  return {
    name: name,
    type: 'application/pdf',
    size: bytes || 8,
    data: Buffer.alloc(bytes || 8, 0x41).toString('base64'),
  };
}

/**
 * 접수 1건을 처리하는 가짜 Supabase.
 * 저장소 업로드(POST /object/...) · 슬롯 점유(rpc/claim_slot) · insert 를 모두 받습니다.
 */
function withFakeSupabase(run, opts) {
  const options = opts || {};
  const calls = [];
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args.map(String).join(' '));

  process.env.INTAKE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.INTAKE_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), method: (init && init.method) || 'GET', body: init && init.body };
    calls.push(call);

    const okJson = (json) => ({
      ok: true, status: 200,
      json: async () => json, text: async () => JSON.stringify(json),
    });

    if (call.url.indexOf('/rpc/claim_slot') !== -1) {
      return okJson([{ claimed: true, used: 3, slot_limit: 20 }]);
    }
    if (call.url.indexOf('/object/') !== -1) {
      if (options.uploadFails) {
        return { ok: false, status: 500, json: async () => ({}), text: async () => 'upload error' };
      }
      return okJson({});
    }
    return okJson({});
  };

  mails.length = 0;

  return Promise.resolve(run(calls, errors)).finally(() => {
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

/** insert 로 보낸 행을 꺼냅니다. */
function insertedRow(calls) {
  const call = calls.find((c) => c.method === 'POST' && /\/rest\/v1\/intake(\?|$)/.test(c.url));
  assert.ok(call, 'intake insert 요청이 없습니다');
  return JSON.parse(call.body);
}

function uploadedPaths(calls) {
  return calls.filter((c) => c.url.indexOf('/object/') !== -1)
    .map((c) => decodeURI(c.url.split('/object/')[1]));
}

/* ── 삭제 경로가 자사 서식을 놓치지 않는가 (가장 중요) ───────────────────────── */

test('자사 서식 경로가 file_paths 에도 들어간다 — 삭제 경로가 file_paths 만 훑는다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    await intake(post(base({ ownForm: file('our-form.docx') })), res);

    assert.strictEqual(res.statusCode, 201);
    const row = insertedRow(calls);
    assert.ok(row.own_form_path, 'own_form_path 가 비었습니다');
    assert.ok(
      row.file_paths.indexOf(row.own_form_path) !== -1,
      'own_form_path 가 file_paths 에 없습니다 — 30일 삭제와 즉시 삭제가 이 파일을 지나칩니다'
    );
    assert.strictEqual(row.file_count, row.file_paths.length);
  });
});

test('자사 서식이 없으면 own_form_path 는 null · 파일 목록도 그대로다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    await intake(post(base()), res);

    assert.strictEqual(res.statusCode, 201);
    const row = insertedRow(calls);
    assert.strictEqual(row.own_form_path, null);
    assert.strictEqual(row.file_paths.length, 1);
    assert.strictEqual(row.file_count, 1);
  });
});

/* ── 저장 위치 ─────────────────────────────────────────────────────────────── */

test('자사 서식은 이름으로 구분되게 올린다 — 운영자가 기준 파일을 알아야 한다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    await intake(post(base({ ownForm: file('our-form.docx') })), res);

    const own = uploadedPaths(calls).filter((p) => p.indexOf('own-form-') !== -1);
    assert.strictEqual(own.length, 1, '자사 서식이 구분되는 이름으로 올라가지 않았습니다');
  });
});

/* ── 선택 항목이지만 검사는 느슨하지 않다 ──────────────────────────────────── */

test('허용하지 않는 확장자는 자사 서식으로도 못 들어온다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    const bad = file('form.exe');
    await intake(post(base({ ownForm: bad })), res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.field, 'ownForm');
    assert.strictEqual(res.body.detail, 'unsupported-type');
    // 검사에서 막혔으므로 슬롯을 점유하지도, 파일을 올리지도 않아야 합니다.
    assert.strictEqual(calls.length, 0);
  });
});

test('개당 10MB 한도는 자사 서식에도 똑같이 걸린다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    await intake(post(base({ ownForm: file('form.pdf', 10 * 1024 * 1024 + 1) })), res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.detail, 'file-too-large');
    assert.strictEqual(calls.length, 0);
  });
});

test('합계 20MB 한도를 자사 서식이 우회하지 못한다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    // 바이어 서류만으로 이미 20MB. 여기에 자사 서식을 더하면 넘습니다.
    const files = [
      file('a.pdf', 10 * 1024 * 1024),
      file('b.pdf', 10 * 1024 * 1024),
    ];
    await intake(post(base({ files: files, ownForm: file('form.pdf', 1024) })), res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.field, 'ownForm');
    assert.strictEqual(res.body.detail, 'total-too-large');
    assert.strictEqual(calls.length, 0);
  });
});

test('빈 파일은 자사 서식으로 받지 않는다', async () => {
  await withFakeSupabase(async () => {
    const res = fakeRes();
    await intake(post(base({ ownForm: { name: 'form.pdf', data: '' } })), res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.detail, 'empty-file');
  });
});

test('배열이나 엉뚱한 형을 보내면 거른다 — 조용히 무시하지 않는다', async () => {
  await withFakeSupabase(async () => {
    const res = fakeRes();
    await intake(post(base({ ownForm: [file('form.pdf')] })), res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.detail, 'bad-own-form');
  });
});

test('null · 빈 문자열은 "안 보냈다" 로 읽는다 — 선택 항목이므로 오류가 아니다', async () => {
  for (const value of [null, undefined, '']) {
    await withFakeSupabase(async (calls) => {
      const res = fakeRes();
      await intake(post(base({ ownForm: value })), res);

      assert.strictEqual(res.statusCode, 201, String(value) + ' 를 오류로 봤습니다');
      assert.strictEqual(insertedRow(calls).own_form_path, null);
    });
  }
});

/* ── 운영자 알림 ───────────────────────────────────────────────────────────── */

test('운영자 메일에 대조 기준을 넘긴다 — 무엇과 대조할지 사람이 알아야 한다', async () => {
  await withFakeSupabase(async () => {
    const res = fakeRes();
    await intake(post(base({ ownForm: file('our-form.docx') })), res);

    assert.strictEqual(mails.length, 1);
    assert.strictEqual(mails[0].ownFormName, 'our-form.docx');
    // 파일 건수는 자사 서식까지 포함한 실제 보낸 개수입니다.
    assert.strictEqual(mails[0].fileCount, 2);
  });
});

test('자사 서식이 없으면 ownFormName 은 null 로 넘어간다 (메일이 ICC 로 안내)', async () => {
  await withFakeSupabase(async () => {
    const res = fakeRes();
    await intake(post(base()), res);

    assert.strictEqual(mails.length, 1);
    assert.strictEqual(mails[0].ownFormName, null);
    assert.strictEqual(mails[0].fileCount, 1);
  });
});

/* ── 실패 처리 ─────────────────────────────────────────────────────────────── */

test('자사 서식 업로드가 실패하면 접수를 만들지 않고 슬롯을 돌려놓는다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    await intake(post(base({ ownForm: file('our-form.docx') })), res);

    assert.strictEqual(res.statusCode, 502);
    const released = calls.some((c) => c.url.indexOf('/rpc/release_slot') !== -1);
    assert.ok(released, '점유한 슬롯을 돌려놓지 않았습니다');
    const inserted = calls.some((c) => c.method === 'POST' && /\/rest\/v1\/intake(\?|$)/.test(c.url));
    assert.ok(!inserted, '업로드가 실패했는데 접수 행을 만들었습니다');
  }, { uploadFails: true });
});
