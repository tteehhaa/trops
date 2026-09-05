/*
 * 사전 확인 퍼널 지표 테스트 〔S10 · 설계서 v3 §6-1 · §6-2 · 신설 2026-08-15〕
 *
 *   npm test        (node --test test/)
 *
 * 표본이 작아 숫자가 0 인 시기에 이 파일이 유일한 검증 수단입니다 — 라이브 숫자가
 * 0 이면 「집계가 맞는데 데이터가 없는 것」인지 「집계가 틀린 것」인지 구분되지 않으므로,
 * 여기서는 답을 아는 가짜 행을 넣어 산식 자체를 잠급니다.
 *
 * 여기서 보는 것은 다섯입니다.
 *
 *   ① 🔴 분모가 갈려 있는가 (§6-2 · T6) — 이 파일의 중심입니다.
 *      접수 전환율의 분모가 진입 전체로 되돌아가면 설계서가 명시적으로 경고한 사고
 *      (설계가 좋아져도 숫자가 나빠 보여 멀쩡한 설계를 롤백하는 것)가 재현됩니다.
 *      그래서 「전체를 분모로 썼다면 나왔을 값」과 다르다는 것까지 확인합니다.
 *   ② docs 세 갈래가 서로 겹치지 않고 합이 진입 수인가.
 *      null(안 물어봤다) · ['none'](없다고 답했다) · 그 외(보유)를 접으면 안 됩니다.
 *   ③ 분모 0 이 0% 가 아니라 null 인가 — 「잴 수 없다」와 「쟀더니 0」의 구분.
 *   ④ other_doc 이 도입 경계로 정확히 갈리는가(경계값 포함/미포함까지).
 *   ⑤ 지표 9개가 전부 존재하는가 — 하나가 빠져도 화면은 조용히 그 칸만 비웁니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const METRICS = require('../api/_precheck-metrics.js');

const GLOSS = '2026-08-14T20:38:30+09:00';

/** 가짜 행 한 줄. 지정하지 않은 칸은 null 입니다(0008 「결측이 정상 상태」). */
function row(overrides) {
  return Object.assign({
    created_at: '2026-08-15T00:00:00+09:00',
    situation: null,
    docs: null,
    experience: null,
    completed_step: 0,
    exited_via: null,
    cta_clicked: null,
    intake_id: null,
  }, overrides);
}

function compute(rows) {
  return METRICS.computeMetrics(rows, { glossIntroducedAt: GLOSS });
}

/* ── ① 🔴 분모 분할 (§6-2) ───────────────────────────────────────────────── */

test('접수 전환율의 분모는 서류 보유자다 — 진입 전체가 아니다', () => {
  const rows = [
    // 서류 보유 2명 중 1명이 접수까지 갔다 → 1/2 = 50%
    row({ docs: ['nda'], intake_id: '11111111-1111-1111-1111-111111111111' }),
    row({ docs: ['sales_contract'] }),
    // 서류 없는 방문자 6명. 랜딩 후킹을 넓혀 들어온 쪽이다 — 분모에 들어가면 안 된다.
    row({ docs: ['none'] }), row({ docs: ['none'] }), row({ docs: ['none'] }),
    row({ docs: ['none'] }), row({ docs: ['none'] }), row({ docs: ['none'] }),
  ];

  const m = compute(rows).metrics.intakeConversion;

  assert.strictEqual(m.denominator, 2, '분모는 서류 보유자 2명이어야 합니다');
  assert.strictEqual(m.numerator, 1);
  assert.strictEqual(m.rate, 0.5);

  // 전체(8명)를 분모로 썼다면 12.5% 였을 것입니다. 그 값이 나오면 분모가 무너진 것입니다.
  assert.notStrictEqual(m.rate, 1 / 8,
    '분모가 진입 전체로 되돌아갔습니다 — 설계서 §6-2 가 경고한 사고입니다');
});

test('알림 등록률의 분모는 서류 미보유자다', () => {
  const rows = [
    row({ docs: ['none'], cta_clicked: 'notify_me' }),
    row({ docs: ['none'], cta_clicked: 'none' }),
    // 보유자가 notify_me 를 눌러도 이 지표에는 들어가지 않습니다.
    row({ docs: ['nda'], cta_clicked: 'notify_me' }),
    // Q2 미응답도 들어가지 않습니다.
    row({ cta_clicked: 'notify_me' }),
  ];

  const m = compute(rows).metrics.notifyRate;
  assert.strictEqual(m.denominator, 2);
  assert.strictEqual(m.numerator, 1);
  assert.strictEqual(m.rate, 0.5);
});

/* ── ② docs 세 갈래 ─────────────────────────────────────────────────────── */

test('docs 는 보유·미보유·미응답 세 갈래로 갈리고 합이 진입 수다', () => {
  const rows = [
    row({ docs: ['nda', 'none'] }),   // 어긋난 행 — 보유 쪽으로 봅니다
    row({ docs: ['other_doc'] }),
    row({ docs: ['none'] }),
    row({ docs: [] }),                // 「전부 해제했다」는 결측이 아니라 답입니다
    row({ docs: null }),              // 「안 물어봤다」
  ];

  const p = compute(rows).population;
  assert.strictEqual(p.entered, 5);
  assert.strictEqual(p.docsHolders, 2);
  assert.strictEqual(p.docsNonHolders, 2);
  assert.strictEqual(p.docsUnanswered, 1);
  assert.strictEqual(p.docsHolders + p.docsNonHolders + p.docsUnanswered, p.entered);
  assert.strictEqual(p.docsAnswered, p.docsHolders + p.docsNonHolders);
});

test('docsGroup 판정 — none 만 있으면 미보유, 하나라도 다르면 보유', () => {
  assert.strictEqual(METRICS.docsGroup({ docs: null }), 'unanswered');
  assert.strictEqual(METRICS.docsGroup({}), 'unanswered');
  assert.strictEqual(METRICS.docsGroup({ docs: [] }), 'nonHolder');
  assert.strictEqual(METRICS.docsGroup({ docs: ['none'] }), 'nonHolder');
  assert.strictEqual(METRICS.docsGroup({ docs: ['none', 'nda'] }), 'holder');
  assert.strictEqual(METRICS.docsGroup({ docs: ['other_doc'] }), 'holder');
});

/* ── ③ 분모 0 은 null 이다 ──────────────────────────────────────────────── */

test('분모가 0 이면 비율은 0 이 아니라 null 이다', () => {
  const result = compute([]);
  const m = result.metrics;

  assert.strictEqual(m.entered.count, 0);
  assert.strictEqual(m.skipRate.rate, null);
  assert.strictEqual(m.intakeConversion.rate, null);
  assert.strictEqual(m.notifyRate.rate, null);
  assert.strictEqual(m.roadmapDemand.either.rate, null);
  assert.strictEqual(METRICS.ratio(0, 0), null);
  assert.strictEqual(METRICS.ratio(0, 4), 0, '쟀더니 0 은 0 이어야 합니다');
});

/* ── ④ other_doc 전/후 · 나머지 산식 ────────────────────────────────────── */

test('other_doc 비중이 영문 병기 도입 경계로 전/후 두 숫자로 갈린다', () => {
  const rows = [
    // 도입 전 4명 중 2명이 other_doc → 50%
    row({ created_at: '2026-08-10T00:00:00+09:00', docs: ['other_doc'] }),
    row({ created_at: '2026-08-11T00:00:00+09:00', docs: ['other_doc', 'nda'] }),
    row({ created_at: '2026-08-12T00:00:00+09:00', docs: ['nda'] }),
    row({ created_at: '2026-08-13T00:00:00+09:00', docs: ['none'] }),
    // 경계 **정각은 「후」** 입니다(전 = created_at < gloss)
    row({ created_at: GLOSS, docs: ['nda'] }),
    // 도입 후 나머지 3명 중 1명 → 1/4 = 25%
    row({ created_at: '2026-08-15T00:00:00+09:00', docs: ['other_doc'] }),
    row({ created_at: '2026-08-15T01:00:00+09:00', docs: ['quote_pi'] }),
    row({ created_at: '2026-08-15T02:00:00+09:00', docs: ['none'] }),
    // Q2 미응답은 어느 쪽 분모에도 들어가지 않습니다
    row({ created_at: '2026-08-15T03:00:00+09:00', docs: null }),
  ];

  const m = compute(rows).metrics.otherDocShare;
  assert.strictEqual(m.boundary, GLOSS);
  assert.strictEqual(m.before.numerator, 2);
  assert.strictEqual(m.before.denominator, 4);
  assert.strictEqual(m.before.rate, 0.5);
  assert.strictEqual(m.after.numerator, 1);
  assert.strictEqual(m.after.denominator, 4);
  assert.strictEqual(m.after.rate, 0.25);
});

test('스킵률·우회율·완주율·이탈 스텝은 진입 전체를 분모로 쓴다', () => {
  const rows = [
    row({ completed_step: 0, exited_via: 'skip' }),
    row({ completed_step: 1, exited_via: 'bypass_link' }),
    row({ completed_step: 2 }),
    row({ completed_step: 3, exited_via: 'completed' }),
  ];

  const m = compute(rows).metrics;
  assert.strictEqual(m.entered.count, 4);
  assert.deepStrictEqual(
    [m.skipRate.numerator, m.skipRate.denominator, m.skipRate.rate], [1, 4, 0.25]);
  assert.deepStrictEqual(
    [m.bypassRate.numerator, m.bypassRate.denominator, m.bypassRate.rate], [1, 4, 0.25]);
  assert.deepStrictEqual(
    [m.completionRate.numerator, m.completionRate.denominator, m.completionRate.rate], [1, 4, 0.25]);

  // 스텝 0~3 은 값이 없어도 네 칸이 전부 나와야 합니다.
  assert.deepStrictEqual(Object.keys(m.exitStep.steps), ['0', '1', '2', '3']);
  for (const step of [0, 1, 2, 3]) {
    assert.strictEqual(m.exitStep.steps[step].count, 1);
    assert.strictEqual(m.exitStep.steps[step].rate, 0.25);
  }
});

test('로드맵 수요 신호 — sales_contract·quote_pi 비중을 Q2 응답자 위에서 잰다', () => {
  const rows = [
    row({ docs: ['sales_contract'] }),
    row({ docs: ['quote_pi'] }),
    row({ docs: ['sales_contract', 'quote_pi'] }),  // either 에서 한 번만 세어야 합니다
    row({ docs: ['nda'] }),
    row({ docs: null }),                            // 분모에서 빠집니다
  ];

  const m = compute(rows).metrics.roadmapDemand;
  assert.strictEqual(m.sales_contract.numerator, 2);
  assert.strictEqual(m.sales_contract.denominator, 4);
  assert.strictEqual(m.quote_pi.numerator, 2);
  assert.strictEqual(m.either.numerator, 3, '둘 다 고른 사람을 두 번 세면 안 됩니다');
  assert.strictEqual(m.either.denominator, 4);
});

/* ── ⑤ 지표가 하나도 빠지지 않았는가 ────────────────────────────────────── */

test('설계서 §6-1 지표 8개 + 로드맵 신호가 전부 나온다', () => {
  const keys = Object.keys(compute([row({ docs: ['nda'] })]).metrics);
  const expected = [
    'entered', 'skipRate', 'exitStep', 'bypassRate', 'completionRate',
    'intakeConversion', 'notifyRate', 'otherDocShare', 'roadmapDemand',
  ];
  for (const key of expected) {
    assert.ok(keys.indexOf(key) !== -1, key + ' 지표가 없습니다');
  }
  assert.strictEqual(keys.length, expected.length, '지표 수가 9개가 아닙니다');
});

test('대조용 SQL 9개가 지표 키와 짝을 이룬다', () => {
  const metricKeys = Object.keys(compute([]).metrics).sort();
  const sqlKeys = Object.keys(METRICS.SQL).sort();
  assert.deepStrictEqual(sqlKeys, metricKeys,
    'SQL 판과 함수 판의 지표 목록이 갈렸습니다 — 한쪽만 고치면 대조의 의미가 없습니다');

  // 접수 전환 SQL 의 분모가 보유자로 한정돼 있는가(§6-2). 문자열 검사지만,
  // 이 한 줄이 빠지면 SQL Editor 로 뽑은 숫자가 함수 판과 조용히 달라집니다.
  assert.match(METRICS.SQL.intakeConversion, /where is_holder/);
  assert.match(METRICS.SQL.notifyRate, /where docs_answered and not is_holder/);
});

/* ── 경계: 잘못된 시각은 조용히 넘어가지 않는다 ─────────────────────────── */

test('읽을 수 없는 시각은 던진다 — NaN 비교로 전/후가 뒤섞이지 않게', () => {
  assert.throws(() => METRICS.computeMetrics([], { glossIntroducedAt: '어제' }), /glossIntroducedAt/);
  assert.throws(
    () => METRICS.computeMetrics([row({ created_at: 'nope', docs: ['nda'] })], { glossIntroducedAt: GLOSS }),
    /created_at/
  );
});

/* ── warnings: 0 의 이유를 이름 대고 알리는가 ───────────────────────────── */

test('보유자는 있는데 intake_id 가 전부 null 이면 경고한다 (trops_a 인계 미연결)', () => {
  const warnings = compute([row({ docs: ['nda'] })]).warnings;
  assert.ok(warnings.some((w) => w.indexOf('intake_id') !== -1),
    '접수 전환 0% 와 「인계가 안 붙었다」를 구분할 단서가 없습니다');

  // 한 건이라도 이어져 있으면 그 경고는 사라져야 합니다.
  const linked = compute([row({ docs: ['nda'], intake_id: '11111111-1111-1111-1111-111111111111' })]);
  assert.ok(!linked.warnings.some((w) => w.indexOf('intake_id') !== -1));
});
