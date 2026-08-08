/*
 * api/intake.js 테스트 — 거래 정보(선택) 접수. 협정 세율 함께 보기.
 *
 *   npm test        (node --test test/)
 *
 * 가장 먼저 보는 것은 "안 넣어도 접수가 그대로 되는가" 입니다.
 * 이 두 칸은 NDA 대조와 아무 상관이 없는 부속 항목입니다. 여기서 접수가
 * 한 건이라도 막히면, 부속 기능 하나 때문에 본래 팔던 것을 잃습니다.
 *
 * 그 다음이 "틀린 값을 조용히 버리지 않는가" 입니다.
 * 조용히 버리면 이용자는 세율이 나올 줄 알고 기다리다가 빈 화면을 봅니다.
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
const agreements = require('../api/_agreements.js');

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

    const okJson = (json) => ({
      ok: true, status: 200,
      json: async () => json, text: async () => JSON.stringify(json),
    });

    if (call.url.indexOf('/rpc/claim_slot') !== -1) {
      return okJson([{ claimed: true, used: 3, slot_limit: 20 }]);
    }
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

/* ── 안 넣어도 접수가 그대로 된다 (가장 중요) ──────────────────────────────── */

test('거래 정보를 안 보내도 접수는 그대로 된다 — 두 컬럼은 null', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    await intake(post(base()), res);

    assert.strictEqual(res.statusCode, 201);
    const row = insertedRow(calls);
    assert.strictEqual(row.target_country, null);
    assert.strictEqual(row.hs_code, null);
  });
});

test('null · 빈 문자열은 "안 보냈다" 로 읽는다 — 선택 항목이므로 오류가 아니다', async () => {
  for (const value of [null, undefined, '']) {
    await withFakeSupabase(async (calls) => {
      const res = fakeRes();
      await intake(post(base({ targetCountry: value, hsCode: value })), res);

      assert.strictEqual(res.statusCode, 201, String(value) + ' 를 오류로 봤습니다');
      const row = insertedRow(calls);
      assert.strictEqual(row.target_country, null);
      assert.strictEqual(row.hs_code, null);
    });
  }
});

test('한쪽만 넣어도 접수를 막지 않는다 — 조회는 못 해도 접수는 접수다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    await intake(post(base({ targetCountry: 'AE' })), res);

    assert.strictEqual(res.statusCode, 201);
    const row = insertedRow(calls);
    assert.strictEqual(row.target_country, 'AE');
    assert.strictEqual(row.hs_code, null);
  });
});

/* ── 넣으면 그대로 남는다 ──────────────────────────────────────────────────── */

test('국가와 HS 코드를 넣으면 그대로 저장하고 메일에도 넘긴다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    await intake(post(base({ targetCountry: 'AE', hsCode: '09011100' })), res);

    assert.strictEqual(res.statusCode, 201);
    const row = insertedRow(calls);
    assert.strictEqual(row.target_country, 'AE');
    assert.strictEqual(row.hs_code, '09011100');

    assert.strictEqual(mails.length, 1);
    assert.strictEqual(mails[0].targetCountry, 'AE');
    assert.strictEqual(mails[0].hsCode, '09011100');
  });
});

test('구분기호가 섞여 들어와도 숫자 8자리로 정돈한다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    await intake(post(base({ targetCountry: 'ae', hsCode: '0901.11-00' })), res);

    assert.strictEqual(res.statusCode, 201);
    const row = insertedRow(calls);
    // 국가 코드는 대문자로 맞춥니다(DB check 제약이 대문자만 받습니다).
    assert.strictEqual(row.target_country, 'AE');
    assert.strictEqual(row.hs_code, '09011100');
  });
});

test('선행 0 을 잃지 않는다 — 01류~09류가 통째로 어긋납니다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    await intake(post(base({ targetCountry: 'AE', hsCode: '01012100' })), res);

    assert.strictEqual(insertedRow(calls).hs_code, '01012100');
  });
});

/* ── 틀린 값은 조용히 버리지 않는다 ────────────────────────────────────────── */

test('서비스하지 않는 나라는 400 으로 알린다 — 조용히 무시하지 않는다', async () => {
  await withFakeSupabase(async (calls) => {
    const res = fakeRes();
    await intake(post(base({ targetCountry: 'US', hsCode: '09011100' })), res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.field, 'targetCountry');
    assert.strictEqual(res.body.detail, 'unsupported-country');
    // 검사에서 막혔으므로 슬롯을 점유하지도, 파일을 올리지도 않아야 합니다.
    assert.strictEqual(calls.length, 0);
  });
});

test('8자리가 아닌 HS 코드는 400 — 10단위를 잘라 쓰지 않는다', async () => {
  for (const value of ['0901110000', '090111', 'abcdefgh']) {
    await withFakeSupabase(async (calls) => {
      const res = fakeRes();
      await intake(post(base({ targetCountry: 'AE', hsCode: value })), res);

      assert.strictEqual(res.statusCode, 400, value + ' 를 통과시켰습니다');
      assert.strictEqual(res.body.field, 'hsCode');
      assert.strictEqual(res.body.detail, 'not-8-digits');
      assert.strictEqual(calls.length, 0);
    });
  }
});

test('문자열이 아닌 형은 거른다', async () => {
  await withFakeSupabase(async () => {
    const res = fakeRes();
    await intake(post(base({ hsCode: 9011100 })), res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.field, 'hsCode');
    assert.strictEqual(res.body.detail, 'bad-hs-code');
  });
});

/* ── 목록이 화면과 어긋나지 않는가 ─────────────────────────────────────────── */

test('AGREEMENTS 의 국가 코드는 DB check 제약과 같은 모양이다 (대문자 2자리)', () => {
  Object.keys(agreements.AGREEMENTS).forEach((code) => {
    assert.match(code, /^[A-Z]{2}$/, code + ' 가 ISO 2자리 대문자가 아닙니다');
    assert.strictEqual(agreements.AGREEMENTS[code].code, code);
    assert.ok(agreements.AGREEMENTS[code].lookupPath, code + ' 에 조회 경로가 없습니다');
  });
});

/* ── "표에 없는 코드" 와 "표를 못 읽음" 을 섞지 않는가 ──────────────────────── */
/*
 * 섞으면 잠깐 장애가 났을 때 이용자에게 "그런 코드는 없습니다" 라고 말하게 되고,
 * 이용자는 멀쩡한 HS 코드를 의심하게 됩니다. 이 구분이 무너지면 접수 확인 화면과
 * 확인메일이 함께 거짓말을 합니다.
 */

function withFakeTariff(reply, run) {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  console.error = () => {};
  globalThis.fetch = async () => reply;
  return Promise.resolve(run()).finally(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  });
}

test('양허표에 있는 코드는 그 줄을 그대로 돌려준다', async () => {
  const rows = [{ hs8: '09011100', name: '- - 카페인을 제거하지 않은 것', baseRateRaw: '0%' }];
  await withFakeTariff({ ok: true, status: 200, json: async () => rows }, async () => {
    const result = await agreements.fetchTariffRecord('https://trops.kr', 'AE', '09011100');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.record.hs8, '09011100');
  });
});

test('없는 류(404)는 장애가 아니라 "표에 없는 코드" 다', async () => {
  await withFakeTariff({ ok: false, status: 404, json: async () => null }, async () => {
    const result = await agreements.fetchTariffRecord('https://trops.kr', 'AE', '77010000');
    assert.strictEqual(result.ok, true, '404 를 장애로 봤습니다');
    assert.strictEqual(result.record, null);
  });
});

test('통신 실패·5xx 는 "표를 못 읽음" 이다 — 코드가 없다고 말하지 않는다', async () => {
  await withFakeTariff({ ok: false, status: 503, json: async () => null }, async () => {
    const result = await agreements.fetchTariffRecord('https://trops.kr', 'AE', '09011100');
    assert.strictEqual(result.ok, false);
  });
});

test('예외가 나도 던지지 않는다 — 부속 항목이 확인메일을 막으면 안 된다', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  console.error = () => {};
  globalThis.fetch = async () => { throw new Error('network down'); };
  try {
    const result = await agreements.fetchTariffRecord('https://trops.kr', 'AE', '09011100');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.record, null);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test('조회 링크는 협정 화면을 그대로 가리킨다', () => {
  assert.strictEqual(
    agreements.lookupUrl('https://trops.kr/', 'AE', '09011100'),
    'https://trops.kr/uae?hs=09011100'
  );
  assert.strictEqual(agreements.lookupUrl('https://trops.kr', 'US', '09011100'), null);
  assert.strictEqual(agreements.lookupUrl('https://trops.kr', 'AE', '090111'), null);
});

test('면책은 4문장이며 협정 이름이 들어간다 — /uae 의 문구와 같아야 한다', () => {
  const lines = agreements.tariffDisclaimer('AE');
  assert.strictEqual(lines.length, 4);
  assert.strictEqual(lines[0], '이 결과는 한-UAE CEPA 부속서의 양허 내용을 표시한 것입니다.');
  assert.strictEqual(lines[1], '실제 납부 세액과 다를 수 있습니다.');
  assert.strictEqual(lines[2], '원산지 결정기준은 품목별로 다르며 원문 확인이 필요합니다.');
  assert.strictEqual(lines[3], 'TROPS는 품목분류·원산지를 판정하지 않습니다.');
});
