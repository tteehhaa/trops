/*
 * 결제 미완료 리마인드 테스트 〔S9 · 흐름 md §3 · §5-1 6번 · 신설 2026-08-13〕
 *
 *   npm test        (node --test test/)
 *
 * 여기서 보는 것은 다섯입니다.
 *
 *   ① **후보 조건 다섯 개가 실제로 걸리는가.** 하나라도 빠지면 잘못된 사람에게
 *      메일이 갑니다 — 이미 결제한 사람에게 독촉이, 자료 지워 달라던 사람에게
 *      결제 권유가 갑니다. 조건은 조회 URL 로 확인합니다.
 *   ② **72시간 상한이 있는가.** 이 컬럼이 나중에 붙으므로, 상한이 없으면 첫
 *      실행에서 몇 주 전에 그만둔 사람들에게 한꺼번에 나갑니다. 이 배치가 낼 수
 *      있는 가장 나쁜 결과입니다.
 *   ③ **멱등** — 발송 성공한 건에만 표시하고, 표시된 건은 다시 후보가 되지 않는가.
 *   ④ **발송 실패 시 표시하지 않는가.** 먼저 표시하면 실패한 건이 영구히
 *      회수 대상에서 빠집니다.
 *   ⑤ 미리보기(--apply 없음)가 한 통도 보내지 않는가.
 *
 * 실제 Supabase·Resend 를 부르지 않습니다 — globalThis.fetch 와 _notify.js 를
 * 가짜로 바꿉니다(test/intake-own-form.test.js 와 같은 방식).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/* ── _notify.js 대역 ───────────────────────────────────────────────────────── */

const notifyPath = path.join(ROOT, 'api', '_notify.js');
const sentMails = [];
let mailFails = false;

require.cache[notifyPath] = {
  id: notifyPath,
  filename: notifyPath,
  loaded: true,
  exports: {
    RETENTION_DAYS: 30,
    sendPaymentReminderMail: async (info) => {
      if (mailFails) return { sent: false, error: 'resend down' };
      sentMails.push(info);
      return { sent: true, error: null };
    },
  },
};

const REMINDER = require('../api/_payment-reminder.js');

/* ── 도구 ──────────────────────────────────────────────────────────────────── */

const NOW = Date.parse('2026-08-13T12:00:00.000Z');

function config() {
  return {
    ok: true,
    restUrl: 'https://example.supabase.co/rest/v1',
    baseUrl: 'https://example.supabase.co',
    headers: { apikey: 'k', Authorization: 'Bearer k' },
  };
}

/**
 * @param {object} opts
 *   rows        후보 조회가 돌려줄 행
 *   selectFails 후보 조회를 HTTP 500 으로 (컬럼 미생성 상황)
 *   patchFails  발송 기록 PATCH 를 HTTP 500 으로
 */
function withFakeSupabase(opts, run) {
  const options = opts || {};
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), method: (init && init.method) || 'GET', body: init && init.body };
    calls.push(call);

    const fail = () => ({ ok: false, status: 500, json: async () => ({}), text: async () => 'boom' });
    const okJson = (json) => ({ ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) });

    if (call.method === 'PATCH') return options.patchFails ? fail() : okJson({});
    if (options.selectFails) return fail();
    return okJson(options.rows || []);
  };

  sentMails.length = 0;
  mailFails = Boolean(options.mailFails);

  return Promise.resolve(run(calls)).finally(() => {
    globalThis.fetch = originalFetch;
    mailFails = false;
  });
}

function row(overrides) {
  return Object.assign({
    id: '11111111-1111-4111-8111-111111111111',
    email: 'buyer@example.com',
    order_id: 'trops_20260813_0001',
    received_at: '2026-08-13T06:00:00.000Z',
  }, overrides || {});
}

function selectCall(calls) {
  const call = calls.find((c) => c.method === 'GET');
  assert.ok(call, '후보 조회 요청이 없습니다');
  return decodeURIComponent(call.url);
}

const run = (extra) => Object.assign({ now: NOW, log: () => {} }, extra || {});

/* ── ① 후보 조건 다섯 개 ──────────────────────────────────────────────────── */

test('유료·결제대기·접수대기·미발송 네 조건이 모두 조회에 걸린다', () =>
  withFakeSupabase({ rows: [] }, async (calls) => {
    await REMINDER.remindUnpaidIntakes(config(), run());
    const url = selectCall(calls);

    assert.match(url, /intake_path=eq\.paid/, '무상 건이 후보에 섞입니다');
    assert.match(url, /payment_status=eq\.pending/, '이미 결제·환불된 건이 후보에 섞입니다');
    assert.match(url, /status=eq\.awaiting_payment/, '접수 확정된 건이 후보에 섞입니다');
    assert.match(url, /payment_reminder_sent_at=is\.null/, '이미 보낸 건에 또 보냅니다');
  }));

test('🔴 자료 삭제를 요청한 사람에게는 결제를 권하지 않는다', () =>
  withFakeSupabase({ rows: [] }, async (calls) => {
    await REMINDER.remindUnpaidIntakes(config(), run());
    assert.match(selectCall(calls), /erasure_requested_at=is\.null/,
      '자료를 지워 달라던 사람에게 결제 독촉이 갑니다');
  }));

test('접수 후 3시간이 지난 건만 후보다', () =>
  withFakeSupabase({ rows: [] }, async (calls) => {
    await REMINDER.remindUnpaidIntakes(config(), run());
    const url = selectCall(calls);
    const notAfter = new Date(NOW - REMINDER.REMIND_AFTER_HOURS * 3600 * 1000).toISOString();
    assert.ok(url.indexOf('received_at=lte.' + notAfter) !== -1,
      '3시간 임계값이 조회에 없습니다 — 방금 접수한 사람에게 바로 갑니다. url=' + url);
  }));

/* ── ② 72시간 상한 ────────────────────────────────────────────────────────── */

test('🔴 오래된 건에는 보내지 않는다 — 컬럼 신설 첫 실행이 잔행 전체에 뿌리지 않게', () =>
  withFakeSupabase({ rows: [] }, async (calls) => {
    await REMINDER.remindUnpaidIntakes(config(), run());
    const url = selectCall(calls);
    const notBefore = new Date(NOW - REMINDER.MAX_AGE_HOURS * 3600 * 1000).toISOString();
    assert.ok(url.indexOf('received_at=gte.' + notBefore) !== -1,
      '아래쪽 상한이 없습니다 — 몇 주 전에 그만둔 사람들에게 한꺼번에 나갑니다. url=' + url);
  }));

test('상한 값이 3시간 / 72시간이다', () => {
  assert.strictEqual(REMINDER.REMIND_AFTER_HOURS, 3, '흐름 md §3 의 「N시간(예 3시간)」');
  assert.strictEqual(REMINDER.MAX_AGE_HOURS, 72);
  assert.ok(REMINDER.MAX_AGE_HOURS > REMINDER.REMIND_AFTER_HOURS,
    '구간이 뒤집히면 후보가 영원히 0건입니다');
});

/* ── ③ 발송·멱등 ─────────────────────────────────────────────────────────── */

test('후보가 있으면 보내고, 보낸 건만 표시한다', () =>
  withFakeSupabase({ rows: [row()] }, async (calls) => {
    const result = await REMINDER.remindUnpaidIntakes(config(), run({ apply: true }));

    assert.strictEqual(result.available, true);
    assert.strictEqual(result.candidates, 1);
    assert.strictEqual(result.sent, 1);
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(sentMails.length, 1);
    assert.strictEqual(sentMails[0].email, 'buyer@example.com');

    const patch = calls.find((c) => c.method === 'PATCH');
    assert.ok(patch, '발송 기록 PATCH 가 없습니다 — 다음 실행이 또 보냅니다');
    assert.deepStrictEqual(JSON.parse(patch.body),
      { payment_reminder_sent_at: new Date(NOW).toISOString() });
  }));

test('🔴 발송이 실패하면 표시하지 않는다 — 다음 실행이 재시도해야 한다', () =>
  withFakeSupabase({ rows: [row()], mailFails: true }, async (calls) => {
    const result = await REMINDER.remindUnpaidIntakes(config(), run({ apply: true }));

    assert.strictEqual(result.sent, 0);
    assert.strictEqual(result.errors.length, 1);
    assert.ok(
      !calls.some((c) => c.method === 'PATCH'),
      '보내지 못했는데 「보냈음」으로 표시했습니다 — 이 건은 영구히 회수 대상에서 빠집니다'
    );
  }));

test('메일은 나갔는데 기록이 실패하면 크게 남긴다 — sent 는 올린다', () =>
  withFakeSupabase({ rows: [row()], patchFails: true }, async () => {
    const result = await REMINDER.remindUnpaidIntakes(config(), run({ apply: true }));

    assert.strictEqual(result.sent, 1, '실제로 나간 메일은 세야 합니다');
    assert.strictEqual(result.errors.length, 1);
    assert.match(result.errors[0].error, /발송됨/,
      '「보냈지만 기록 실패」와 「못 보냄」이 로그에서 구분돼야 합니다');
  }));

test('후보가 0건이면 아무것도 하지 않고 성공이다', () =>
  withFakeSupabase({ rows: [] }, async (calls) => {
    const result = await REMINDER.remindUnpaidIntakes(config(), run({ apply: true }));

    assert.strictEqual(result.available, true);
    assert.strictEqual(result.candidates, 0);
    assert.strictEqual(result.sent, 0);
    assert.strictEqual(sentMails.length, 0);
    assert.ok(!calls.some((c) => c.method === 'PATCH'));
  }));

/* ── ④ 표가 없을 때 (fail-safe closed) ───────────────────────────────────── */

test('컬럼이 없으면 available:false 로 0건이고 던지지 않는다', () =>
  withFakeSupabase({ selectFails: true }, async () => {
    const result = await REMINDER.remindUnpaidIntakes(config(), run({ apply: true }));

    assert.strictEqual(result.available, false);
    assert.strictEqual(result.sent, 0);
    assert.strictEqual(sentMails.length, 0);
    assert.match(String(result.error), /0-H/,
      '무엇을 실행해야 하는지가 오류 문면에 있어야 합니다');
  }));

/* ── ⑤ 미리보기 ──────────────────────────────────────────────────────────── */

test('--apply 없이는 한 통도 보내지 않고 표시도 하지 않는다', () =>
  withFakeSupabase({ rows: [row(), row({ id: 'x', order_id: 'b' })] }, async (calls) => {
    const result = await REMINDER.remindUnpaidIntakes(config(), run());

    assert.strictEqual(result.candidates, 2, '후보는 세야 합니다');
    assert.strictEqual(result.sent, 0);
    assert.strictEqual(sentMails.length, 0, '미리보기가 메일을 보냈습니다');
    assert.ok(!calls.some((c) => c.method === 'PATCH'), '미리보기가 DB 를 고쳤습니다');
  }));

/* ── 로그 위생 ───────────────────────────────────────────────────────────── */

test('로그에 전체 이메일 주소를 적지 않는다', () => {
  assert.strictEqual(REMINDER.maskEmail('buyer@example.com'), 'bu***@example.com');
  assert.strictEqual(REMINDER.maskEmail('a@b.com'), '***', '짧은 주소는 아예 가립니다');
  assert.strictEqual(REMINDER.maskEmail(''), '***');
  assert.strictEqual(REMINDER.maskEmail(undefined), '***');
});

/* ── 배선 — CLI 와 cron 이 같은 본체를 보는가 ─────────────────────────────── */

test('CLI 와 배치 본체가 같은 함수다 — 복제하면 한쪽만 고쳐진다', () => {
  const script = require('../scripts/payment-reminder.js');
  assert.strictEqual(script.remindUnpaidIntakes, REMINDER.remindUnpaidIntakes);
});

test('cron 라우트가 이 배치를 부른다 — 파일만 있으면 영원히 안 돕니다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'api', 'cron', 'refund-blocked.js'), 'utf8');
  assert.match(src, /require\(['"]\.\.\/_payment-reminder\.js['"]\)/,
    'cron 라우트가 _payment-reminder.js 를 require 하지 않습니다');
  assert.match(src, /remindUnpaidIntakes\(config, \{/, 'cron 라우트가 배치를 부르지 않습니다');
  assert.match(src, /paymentReminder: paymentReminder/, '응답에 결과가 실리지 않습니다');
});

test('package.json 에 미리보기·실행 스크립트가 있다', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['remind:preview'], 'remind:preview 가 없습니다');
  assert.ok(pkg.scripts['remind:apply'], 'remind:apply 가 없습니다');
  assert.ok(pkg.scripts['remind:preview'].indexOf('--apply') === -1,
    '미리보기 스크립트에 --apply 가 붙어 있습니다');
  assert.ok(pkg.scripts['remind:apply'].indexOf('--apply') !== -1);
});

/* ── 스키마 ──────────────────────────────────────────────────────────────── */

test('스키마에 발송 기록 컬럼과 부분색인이 있다', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'precheck-schema.sql'), 'utf8');
  assert.match(sql, /payment_reminder_sent_at\s+timestamptz/,
    'create table 에 컬럼이 없습니다 — 새로 만드는 프로젝트가 이 기능을 못 씁니다');
  assert.match(sql, /add column if not exists payment_reminder_sent_at/,
    '0-H 절에 alter 가 없습니다 — 이미 만든 프로젝트가 이 기능을 못 씁니다');
  assert.match(sql, /intake_payment_reminder_idx/, '후보 조회용 부분색인이 없습니다');
});
