/*
 * 과금 게이트 테스트 〔R-2 · api/_precheck-charge-gate.js〕
 *
 *   npm test        (node --test test/)
 *
 * 여기서 보는 것은 셋입니다.
 *
 *   ① 판정이 맞는가        — 플래그와 법 게이트를 AND 로 보는가
 *   ② **실제로 막는가**    — 라우트를 불러서 결제가 실행되지 않는 것을 확인합니다.
 *                            「차단 함수가 있다」는 것으로는 부족합니다. 이 저장소는
 *                            직전까지 정확히 그 상태였습니다 — 막을 값도 부를 곳도 없었고,
 *                            trops_a 에는 판정 함수가 있는데 호출부가 0건이었습니다.
 *   ③ 정본과 어긋나지 않는가 — trops_a 사본이므로 값이 갈리면 red 를 냅니다(양방향).
 *
 * ⚠️ ②가 이 파일의 중심입니다. ①만 있으면 배선이 끊겨도 초록불이 납니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const gate = require('../api/_precheck-charge-gate.js');

/* ── ① 판정 ────────────────────────────────────────────────────────────────── */

test('지금은 막혀 있다 — 라이브 상수 기준', () => {
  assert.strictEqual(gate.isPrecheckPaidChargeEnabled(), false);
  assert.deepStrictEqual(gate.precheckChargeBlockers(),
    ['paid_charge_enabled', 'S62-44', 'S62-03']);
});

test('게시는 막지 않는다 — 노출과 과금은 별개 결정이다', () => {
  assert.strictEqual(gate.isPrecheckPaidDisplayEnabled(), true);
});

test('운영 플래그만 켜서는 열리지 않는다 — 법 게이트와 AND 다', () => {
  const open = { paid_display_enabled: true, paid_charge_enabled: true };
  assert.strictEqual(gate.isPrecheckPaidChargeEnabled(open), false,
    '플래그 하나로 변호사 확인을 우회할 수 있으면 게이트가 아닙니다');
  assert.deepStrictEqual(gate.precheckChargeBlockers(open), ['S62-44', 'S62-03']);
});

test('법 게이트만 통과해도 열리지 않는다 — 운영 플래그가 남는다', () => {
  const confirmed = { S62_44: true, S62_03: true };
  assert.deepStrictEqual(gate.precheckChargeBlockers(undefined, confirmed),
    ['paid_charge_enabled']);
});

test('셋이 모두 서면 열린다 — 상수를 뒤집지 않고도 검증된다', () => {
  const open = { paid_display_enabled: true, paid_charge_enabled: true };
  const confirmed = { S62_44: true, S62_03: true };
  assert.strictEqual(gate.isPrecheckPaidChargeEnabled(open, confirmed), true);
  assert.doesNotThrow(() => gate.assertPrecheckChargeAllowed(open, confirmed));
});

test('assert 는 boolean 을 돌려주지 않고 던진다 — 잊고 지나칠 수 없게', () => {
  assert.throws(() => gate.assertPrecheckChargeAllowed(),
    (err) => err instanceof gate.PrecheckChargeBlockedError &&
      err.statusCode === 403 &&
      err.blockers.indexOf('S62-44') !== -1);
});

/* ── ② 실제로 막는가 ───────────────────────────────────────────────────────── */

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
const paymentConfirm = require('../api/payment-confirm.js');
const paymentConfig = require('../api/payment-config.js');

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

/**
 * 가짜 Supabase · 가짜 토스.
 *
 * ⚠️ 토스 승인 URL 로 나가는 요청을 따로 셉니다 — 이 테스트의 결론이 그 숫자입니다.
 *    「막혔다」는 응답 코드가 아니라 **돈이 나가는 호출이 0건인 것**으로 말합니다.
 */
function withFakes(run, options) {
  const opts = options || {};
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
    if (call.url.indexOf('tosspayments.com') !== -1) {
      return okJson({
        paymentKey: 'pk_test', orderId: 'precheck_x', totalAmount: 99000,
        status: 'DONE', method: '카드', approvedAt: '2026-08-11T00:00:00+09:00',
      });
    }
    // 주문 조회 — payment-confirm 이 먼저 부릅니다.
    if (call.method === 'GET' && call.url.indexOf('/rest/v1/intake?order_id=') !== -1) {
      return okJson([opts.orderRow || {
        id: 'row-1', email: 'buyer@example.com', file_count: 1, file_paths: [],
        own_form_path: null, consent_training: false, received_at: '2026-08-11T00:00:00Z',
        access_token: 'tok', status: 'awaiting_payment', amount: 99000,
        payment_status: 'pending', payment_key: null, target_country: null, hs_code: null,
      }]);
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

const tossCalls = (calls) => calls.filter((c) => c.url.indexOf('tosspayments.com') !== -1);
const writeCalls = (calls) => calls.filter((c) => c.method === 'POST' || c.method === 'PATCH');

test('유료 접수는 403 으로 막힌다 — 주문도 파일도 만들어지지 않는다', async () => {
  await withFakes(async (calls) => {
    const res = fakeRes();
    await intake({
      method: 'POST', query: {},
      body: { path: 'paid', email: 'buyer@example.com', consentTerms: true, files: [file('nda.pdf')] },
    }, res);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error, 'charge-not-open');
    assert.ok(Array.isArray(res.body.blockers) && res.body.blockers.length === 3,
      '왜 막혔는지가 응답에 남아야 합니다');

    // 🔴 이 단정이 핵심입니다. 게이트가 파일 업로드·주문 생성보다 뒤에 있으면
    //    여기서 쓰기가 잡히고, 결제하지 못할 주문이 DB 에 쌓이는 것을 뜻합니다.
    assert.deepStrictEqual(writeCalls(calls), [],
      'Supabase 쓰기가 일어났습니다 — 게이트가 저장보다 뒤에 있습니다');
    assert.strictEqual(mails.length, 0, '막힌 건에 메일이 나갔습니다');
  });
});

test('무상 접수는 그대로 지나간다 — 막는 것은 유상 개시이지 제품 제공이 아니다', async () => {
  await withFakes(async (calls) => {
    const res = fakeRes();
    await intake({
      method: 'POST', query: {},
      body: { path: 'free', email: 'buyer@example.com', consentTerms: true, files: [file('nda.pdf')] },
    }, res);

    assert.strictEqual(res.statusCode, 201, '무상 실증까지 막으면 확인에 필요한 실측이 안 쌓입니다');
    assert.ok(writeCalls(calls).length > 0);
  });
});

test('결제 승인은 토스를 부르기 전에 막힌다 — 승인 호출 0건', async () => {
  await withFakes(async (calls) => {
    const res = fakeRes();
    await paymentConfirm({
      method: 'POST',
      body: { paymentKey: 'pk_live_abc', orderId: 'precheck_abcdef', amount: 99000 },
    }, res);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error, 'charge-not-open');

    // 🔴 돈이 나가는 호출이 0건인 것으로 「막혔다」를 말합니다.
    assert.deepStrictEqual(tossCalls(calls), [],
      '토스 승인 API 가 호출됐습니다 — 게이트가 게이트웨이 호출을 막지 못했습니다');
  });
});

test('이미 승인된 건의 조회는 막지 않는다 — 지난 청구까지 막으면 낸 분이 못 봅니다', async () => {
  await withFakes(async (calls) => {
    const res = fakeRes();
    await paymentConfirm({
      method: 'POST',
      body: { paymentKey: 'pk_paid', orderId: 'precheck_abcdef', amount: 99000 },
    }, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.alreadyConfirmed, true);
    assert.deepStrictEqual(tossCalls(calls), [], '조회인데 새로 승인했습니다');
  }, {
    orderRow: {
      id: 'row-1', email: 'buyer@example.com', file_count: 1, file_paths: [],
      own_form_path: null, consent_training: false, received_at: '2026-08-11T00:00:00Z',
      access_token: 'tok', status: 'received', amount: 99000,
      payment_status: 'paid', payment_key: 'pk_paid', target_country: null, hs_code: null,
    },
  });
});

test('payment-config 는 게이트 상태를 알린다 — 화면이 잠글 근거', async () => {
  await withFakes(async () => {
    const res = fakeRes();
    await paymentConfig({ method: 'GET' }, res);

    assert.strictEqual(res.body.chargeEnabled, false);
    assert.strictEqual(res.body.displayEnabled, true, '게시는 계속 열려 있어야 합니다');
    /*
     * 🔄 99,000 → 300,000 〔2026-08-13 · 흐름 md §4 1차 테스트가〕. 화면이 이 값을 받아
     *    금액을 그리게 될 자리라, 낡으면 「보여준 값」과 「청구할 값」이 갈립니다.
     * ⚠️ 위 두 fixture(orderRow.amount = 99000)는 **지난 접수 건의 저장값**이므로 그대로
     *    둡니다 — 옛 가격으로 결제된 건의 조회가 계속 열려야 합니다.
     */
    assert.strictEqual(res.body.amount, 300000, '판매가가 흐름 md §4 값과 다릅니다');
    assert.strictEqual(res.body.listPrice, 290000, '정가 값을 지우지 않았습니다');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * 축 ② 「불가」 비과금 〔M-3 · 2026-08-11〕
 *
 * 🔴 **개시 게이트를 잠시 열고 잽니다.** 지금은 축 ①(paid_charge_enabled ·
 *    S62-44 · S62-03)이 모든 유상 건을 막고 있어서, 그 상태로는 「불가라서
 *    막혔다」와 「아직 안 열려서 막혔다」가 구분되지 않습니다. 구분이 안 되면
 *    개시가 열리는 날 이 기능이 동작하는지 아무도 모릅니다.
 *
 * ⚠️ 상수를 파일에서 고치는 것이 아니라 **객체 속성을 잠깐 뒤집고 되돌립니다.**
 *    (모듈이 상수를 참조로 들고 있어 같은 객체를 봅니다.) 파일을 고치면 정본
 *    드리프트 테스트가 red 를 내야 하고, 그건 이 테스트가 잴 것이 아닙니다.
 * ════════════════════════════════════════════════════════════════════════════ */

function withLaunchOpen(run) {
  const flags = gate.PRECHECK_PAID_FLAGS;
  const confirmation = gate.LAWYER_CONFIRMATION;
  const before = {
    charge: flags.paid_charge_enabled, s44: confirmation.S62_44, s03: confirmation.S62_03,
  };

  flags.paid_charge_enabled = true;
  confirmation.S62_44 = true;
  confirmation.S62_03 = true;

  return Promise.resolve()
    .then(run)
    .finally(() => {
      flags.paid_charge_enabled = before.charge;
      confirmation.S62_44 = before.s44;
      confirmation.S62_03 = before.s03;
    });
}

test('신고값이 차단 사유로 옮겨진다 — absent 하나만', () => {
  assert.deepStrictEqual(gate.intakeIneligibilityBlockers({ pdfTextLayer: 'absent' }),
    ['ineligible:text-layer-absent']);
  assert.deepStrictEqual(gate.intakeIneligibilityBlockers({ pdfTextLayer: 'present' }), []);
  assert.deepStrictEqual(gate.intakeIneligibilityBlockers({ pdfTextLayer: 'unknown' }), [],
    '못 정한 것을 불가로 취급하면 감지 실패한 모든 건의 과금이 조용히 멈춥니다');
  assert.deepStrictEqual(gate.intakeIneligibilityBlockers(null), []);
  assert.deepStrictEqual(gate.intakeIneligibilityBlockers({ pdfTextLayer: 'ABSENT' }), [],
    '아는 값만 통과시켜야 합니다');
});

test('신고값은 축 ①을 열지 못한다 — 한 방향으로만 움직인다', () => {
  // present 를 보내도 개시 게이트는 그대로 막혀 있습니다.
  assert.throws(() => gate.assertPrecheckChargeAllowed(undefined, undefined, { pdfTextLayer: 'present' }),
    (err) => err instanceof gate.PrecheckChargeBlockedError && err.kind === 'launch');
});

test('개시가 열려도 「불가」 건은 막힌다 — 사유종류가 갈린다', async () => {
  await withLaunchOpen(() => {
    assert.doesNotThrow(() => gate.assertPrecheckChargeAllowed(undefined, undefined, null),
      '개시가 열렸고 신고값도 없으면 통과해야 합니다');

    assert.throws(
      () => gate.assertPrecheckChargeAllowed(undefined, undefined, { pdfTextLayer: 'absent' }),
      (err) => err instanceof gate.PrecheckChargeBlockedError &&
        err.kind === 'ineligible' &&
        err.blockers.length === 1 &&
        err.blockers[0] === 'ineligible:text-layer-absent'
    );
  });
});

test('e2e — 「불가」 유상 접수는 403 · 주문도 파일도 만들어지지 않는다', async () => {
  await withLaunchOpen(() => withFakes(async (calls) => {
    const res = fakeRes();
    await intake({
      method: 'POST', query: {},
      body: {
        path: 'paid', email: 'buyer@example.com', consentTerms: true,
        files: [file('scan.pdf')],
        detection: { pdfTextLayer: 'absent' },
      },
    }, res);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error, 'ineligible-not-charged',
      '「아직 안 열었습니다」와 같은 답을 하면 이용자가 파일을 바꿔 볼 생각을 못 합니다');
    // 🔴 화면이 그대로 쓰는 문장입니다. 「접수됩니다」로 끝나야 합니다 —
    //    여기서 말을 멈추면 서류를 안 받아준다고 읽힙니다.
    assert.match(res.body.message, /무상 실증으로 보내주시면 그대로 접수됩니다/);

    assert.deepStrictEqual(writeCalls(calls), [],
      'Supabase 쓰기가 일어났습니다 — 게이트가 저장보다 뒤에 있습니다');
    assert.deepStrictEqual(tossCalls(calls), [], '결제 호출이 나갔습니다');
    assert.strictEqual(mails.length, 0);
  }));
});

test('e2e — 「불가」라도 무상 접수는 그대로 완료된다 〔M-1 · 접수 거부 금지〕', async () => {
  await withFakes(async (calls) => {
    const res = fakeRes();
    await intake({
      method: 'POST', query: {},
      body: {
        path: 'free', email: 'buyer@example.com', consentTerms: true,
        files: [file('scan.pdf')],
        detection: { pdfTextLayer: 'absent' },
      },
    }, res);

    // 🔴 이것이 M-1 의 「이대로 진행하기」가 실제로 통하는지에 대한 답입니다.
    //    글자를 읽을 수 없는 파일이라고 접수를 거절하면 안 됩니다 — 막는 것은 돈뿐입니다.
    assert.strictEqual(res.statusCode, 201, '「불가」를 접수 거절로 쓰면 안 됩니다');
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.path, 'free');
    assert.ok(writeCalls(calls).length > 0, '저장이 일어나지 않았습니다');
    assert.strictEqual(mails.length, 1, '확인메일이 나가지 않았습니다');
  });
});

test('e2e — 개시가 열린 뒤 「불가 아님」 유상 접수는 지나간다', async () => {
  await withLaunchOpen(() => withFakes(async (calls) => {
    const res = fakeRes();
    await intake({
      method: 'POST', query: {},
      body: {
        path: 'paid', email: 'buyer@example.com', consentTerms: true,
        files: [file('nda.pdf')],
        detection: { pdfTextLayer: 'present' },
      },
    }, res);

    assert.strictEqual(res.statusCode, 201, '막을 이유가 없는 건을 막았습니다');
    assert.strictEqual(res.body.path, 'paid');
    assert.ok(res.body.orderId, '주문번호가 발급되어야 합니다');
  }));
});

test('형식이 틀린 신고값은 접수를 막지 않는다 — 접수 요건이 아니다', async () => {
  await withFakes(async () => {
    const res = fakeRes();
    await intake({
      method: 'POST', query: {},
      body: {
        path: 'free', email: 'buyer@example.com', consentTerms: true,
        files: [file('nda.pdf')],
        detection: { pdfTextLayer: 12345 },
      },
    }, res);
    assert.strictEqual(res.statusCode, 201);
  });
});

/* ── 배선이 끊기면 알린다 ──────────────────────────────────────────────────── */

test('접수 경로가 신고값을 게이트에 넘긴다 — 넘기지 않으면 축 ②가 죽는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'api', 'intake.js'), 'utf8');
  assert.ok(/rejectIfChargeBlocked\(res, 'api\/intake\.js', declaration\)/.test(src),
    'api/intake.js 가 신고값을 게이트에 넘기지 않습니다 — 축 ②가 아무것도 막지 못합니다');
});

test('결제 경로 두 곳이 게이트를 부르고 있다 — 호출부가 사라지면 red', () => {
  const wired = ['api/intake.js', 'api/payment-confirm.js'];
  for (const rel of wired) {
    const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    assert.ok(/_precheck-charge-gate/.test(src), rel + ' 가 게이트를 require 하지 않습니다');
    assert.ok(/rejectIfChargeBlocked\s*\(/.test(src), rel + ' 가 게이트를 부르지 않습니다');
  }
});

/* ── ③ 정본과의 드리프트 ──────────────────────────────────────────────────── */

/*
 * ⚠️ 옆 저장소가 있을 때만 돕니다. Vercel 빌드·CI 에는 trops_a 가 없습니다 —
 *    없으면 건너뛰되 **건너뛴 사실이 보고에 남습니다**(조용한 초록불을 만들지 않습니다).
 *
 * 🔴 양방향입니다. 정본이 열렸는데 여기가 닫혀 있어도, 여기가 열렸는데 정본이
 *    닫혀 있어도 red 입니다. 「한쪽만 고쳤다」가 배포까지 가지 않게 하는 것이 목적입니다.
 */
const SIBLING = path.resolve(__dirname, '..', '..', 'trops_a');
const CANON_FILE = path.join(SIBLING, gate.CANON.file);
const hasCanon = fs.existsSync(CANON_FILE);

function canonSource() {
  return fs.readFileSync(CANON_FILE, 'utf8');
}

/** `export const NAME... = { ... }` 블록에서 `key: true|false` 를 읽습니다. */
function readCanonBool(src, constName, key) {
  const block = new RegExp('export const ' + constName + '[^{]*\\{([\\s\\S]*?)\\n\\}').exec(src);
  assert.ok(block, '정본에서 ' + constName + ' 를 찾지 못했습니다 — 정본 구조가 바뀌었습니다');
  const hit = new RegExp('\\b' + key + '\\s*:\\s*(true|false)').exec(block[1]);
  assert.ok(hit, '정본 ' + constName + ' 에 ' + key + ' 가 없습니다');
  return hit[1] === 'true';
}

test('정본 파일이 실재한다 — 좌표가 낡으면 대조가 조용히 죽는다', { skip: !hasCanon && '옆 저장소(trops_a) 없음 — 대조를 건너뜁니다' }, () => {
  assert.ok(fs.existsSync(CANON_FILE), gate.CANON.repo + ' ' + gate.CANON.file + ' 가 없습니다');
});

test('과금 플래그가 정본과 같다', { skip: !hasCanon && '옆 저장소(trops_a) 없음 — 대조를 건너뜁니다' }, () => {
  const src = canonSource();
  for (const key of ['paid_charge_enabled', 'paid_display_enabled']) {
    assert.strictEqual(
      gate.PRECHECK_PAID_FLAGS[key], readCanonBool(src, 'PRECHECK_PAID_FLAGS', key),
      key + ' 가 정본과 어긋났습니다 — 순서는 ① 원장 ② trops_a 정본 ③ 이 사본입니다'
    );
  }
});

test('법 게이트가 정본과 같다', { skip: !hasCanon && '옆 저장소(trops_a) 없음 — 대조를 건너뜁니다' }, () => {
  const src = canonSource();
  for (const key of ['S62_44', 'S62_03']) {
    assert.strictEqual(
      gate.LAWYER_CONFIRMATION[key], readCanonBool(src, 'LAWYER_CONFIRMATION', key),
      key + ' 가 정본과 어긋났습니다 — 여기만 바꿔서는 열 수 없습니다'
    );
  }
});

test('정본의 차단 함수 이름이 그대로다 — 바뀌면 사본이 낡은 것을 베낀 상태다', { skip: !hasCanon && '옆 저장소(trops_a) 없음 — 대조를 건너뜁니다' }, () => {
  const src = canonSource();
  assert.ok(/export function assertPrecheckChargeAllowed/.test(src),
    '정본에서 assertPrecheckChargeAllowed 가 사라졌습니다 — 정본을 다시 읽고 이 사본을 맞추십시오');
  assert.ok(/export function precheckChargeBlockers/.test(src),
    '정본에서 precheckChargeBlockers 가 사라졌습니다');
});

test('정가·런칭가가 정본과 같다 — 값 사본의 드리프트', { skip: !hasCanon && '옆 저장소(trops_a) 없음 — 대조를 건너뜁니다' }, () => {
  const src = canonSource();
  const payment = require('../api/_payment.js');
  const list = /listKrw:\s*([\d_]+)/.exec(src);
  const launch = /launchKrw:\s*([\d_]+)/.exec(src);
  assert.ok(list && launch, '정본 PRECHECK_PRICE 를 읽지 못했습니다');

  assert.strictEqual(payment.LIST_PRICE, Number(list[1].replace(/_/g, '')),
    'LIST_PRICE 가 정본과 다릅니다');
  assert.strictEqual(payment.PRICE, Number(launch[1].replace(/_/g, '')),
    'PRICE 가 정본과 다릅니다 — 실제 청구 금액입니다');
});

/* ── ④ isNdaOutcomeChargeable — 같은 정본 파일의 두 번째 함수 〔E5〕 ────────── */

test('정본에 isNdaOutcomeChargeable 이 그대로 있다 — 사라지면 사본이 낡은 것을 베낀 상태다', { skip: !hasCanon && '옆 저장소(trops_a) 없음 — 대조를 건너뜁니다' }, () => {
  const src = canonSource();
  assert.ok(/export function isNdaOutcomeChargeable/.test(src),
    '정본에서 isNdaOutcomeChargeable 이 사라졌습니다 — 정본을 다시 읽고 이 사본을 맞추십시오');
});

test('isNdaOutcomeChargeable 사본의 판정이 정본과 같다 — ok 만 과금 대상', () => {
  assert.strictEqual(gate.isNdaOutcomeChargeable('ok'), true);
  assert.strictEqual(gate.isNdaOutcomeChargeable('not_supported'), false);
  assert.strictEqual(gate.isNdaOutcomeChargeable('failed'), false);
});
