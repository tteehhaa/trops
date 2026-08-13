/*
 * 진행상태 3단계 테스트 〔S7 · 흐름 md §5-1 10번 · 신설 2026-08-13〕
 *
 *   npm test        (node --test test/)
 *
 * 여기서 보는 것은 셋입니다.
 *
 *   ① **2단계(검토중)를 status 로 정하지 않는가.** 이것이 중심입니다.
 *      `status='in_progress'` 는 접수만 되고 사람이 아직 손을 대지 않은 건에도
 *      붙습니다(precheck.html statusLabel 주석의 실측). 그것으로 「검토중」을 말하면
 *      아무도 안 보고 있는데 보고 있다고 말하는 것이 됩니다 — 이 저장소가 반복해서
 *      지켜 온 「실제로 일어난 일보다 앞서 말하지 않는다」 원칙의 위반입니다.
 *   ② 결제 전·취소된 건에 트래커가 아예 없는가 (null).
 *   ③ 화면이 서버가 준 숫자만 그리는가 — 단계 판단을 화면에 복제하지 않았는지.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/* ── _notify.js 대역 (Resend 키 없이 require 하려고) ─────────────────────── */

const notifyPath = path.join(ROOT, 'api', '_notify.js');
require.cache[notifyPath] = {
  id: notifyPath,
  filename: notifyPath,
  loaded: true,
  exports: {
    RETENTION_DAYS: 30,
    buildMagicLink: (t) => 'https://trops.kr/precheck?r=' + t,
    sendIntakeMails: async () => ({ confirmationSent: true }),
    sendErasureMails: async () => ({ confirmationSent: true }),
  },
};

const intake = require('../api/intake.js');
const stage = intake.progressStage;

/* ── ① 2단계의 근거 ───────────────────────────────────────────────────────── */

test('🔴 in_progress 만으로는 검토중이 되지 않는다 — 사람이 손대지 않은 건에도 붙는 상태다', () => {
  assert.strictEqual(stage('in_progress', false), 1,
    'in_progress 를 곧 「검토중」으로 읽으면, 아무도 안 보고 있는데 보고 있다고 말합니다');
});

test('🔴 대조 실행 증적이 있으면 검토중이다 — status 가 아니라 그 행이 근거다', () => {
  assert.strictEqual(stage('received', true), 2);
  assert.strictEqual(stage('in_progress', true), 2);
});

test('접수만 된 건은 1단계다', () => {
  assert.strictEqual(stage('received', false), 1);
});

test('전달된 건은 3단계다 — 대조 완료가 아니라 발송이 근거다', () => {
  // 운영자 검수가 대조와 발송 사이에 있습니다. 검수 전에 「전달완료」를 그리면
  // 환불규정 §02 의 전달 시점을 화면이 먼저 앞질러 말하게 됩니다.
  assert.strictEqual(stage('delivered', false), 3);
  assert.strictEqual(stage('delivered', true), 3);
});

/* ── ② 트래커가 없어야 하는 상태 ──────────────────────────────────────────── */

test('결제 전에는 트래커를 그리지 않는다 (null)', () => {
  assert.strictEqual(stage('awaiting_payment', false), null);
  assert.strictEqual(stage('awaiting_payment', true), null,
    '결제 전인데 대조 행이 있는 상태는 정상이 아닙니다 — 그래도 진행처럼 그리지 않습니다');
});

test('취소된 건에는 트래커를 그리지 않는다 (null)', () => {
  assert.strictEqual(stage('cancelled', false), null);
  assert.strictEqual(stage('cancelled', true), null);
});

test('모르는 status 는 null 이다 — 지어내지 않는다', () => {
  for (const unknown of ['', 'refunded', 'pending', undefined, null]) {
    assert.strictEqual(stage(unknown, false), null, JSON.stringify(unknown) + ' 에 단계를 붙였습니다');
    assert.strictEqual(stage(unknown, true), null, JSON.stringify(unknown) + ' 에 단계를 붙였습니다');
  }
});

test('돌려주는 값은 1·2·3·null 뿐이다 — 화면이 그 넷만 처리한다', () => {
  const statuses = ['awaiting_payment', 'received', 'in_progress', 'delivered', 'cancelled', 'unknown'];
  for (const s of statuses) {
    for (const hasRun of [true, false]) {
      const got = stage(s, hasRun);
      assert.ok(got === null || got === 1 || got === 2 || got === 3,
        s + '/' + hasRun + ' → ' + JSON.stringify(got) + ' (1·2·3·null 이 아님)');
    }
  }
});

/* ── ③ 화면이 판단을 복제하지 않았는가 ───────────────────────────────────── */

test('화면은 서버가 준 stage 만 그린다 — 단계 판단을 복제하지 않았다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');
  const markup = html.replace(/<!--[\s\S]*?-->/g, '');

  const fn = markup.match(/function addProgress\(box, stage\)[\s\S]*?\n    }\n/);
  assert.ok(fn, 'precheck.html 에 addProgress 가 없습니다');

  // 단계 판단의 재료(status 값 · 대조 실행 여부)가 이 함수에 나타나면 판단이 두 곳으로 갈립니다.
  for (const leaked of ['in_progress', 'delivered', 'awaiting_payment', 'outcome', 'nda_run']) {
    assert.ok(fn[0].indexOf(leaked) === -1,
      'addProgress 안에 "' + leaked + '" 가 있습니다 — 단계 판단이 서버·화면 두 곳으로 갈립니다');
  }

  assert.ok(markup.indexOf('addProgress(box, r.body.stage)') !== -1,
    '화면이 서버의 stage 를 쓰지 않습니다');
});

test('3단계 라벨이 흐름 md 문구와 같다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');
  const line = html.match(/var PROGRESS_STEPS = \[([^\]]*)\]/);
  assert.ok(line, 'PROGRESS_STEPS 를 찾지 못했습니다');
  const labels = line[1].match(/'([^']+)'/g).map((s) => s.replace(/'/g, ''));
  assert.deepStrictEqual(labels, ['접수됨', '검토중', '전달완료'],
    '흐름 md §5-1 10번이 지정한 3단계 문구입니다');
});

test('완료 표시에 판정색(초록)·경고색을 쓰지 않는다', () => {
  // 흐름 md §1 이 색 토큰 레벨에서 초록·주황을 배제한 이유와 같습니다 —
  // 「판정하지 않는다」가 색상까지 적용됩니다.
  const html = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');
  const css = html.match(/\.progress \{[\s\S]*?\.progress-step\.is-now \.progress-label[^}]*\}/);
  assert.ok(css, '진행상태 CSS 블록을 찾지 못했습니다');
  // 주석은 걷어냅니다 — 「경고색을 쓰지 마십시오」라고 적은 주석 자체가 걸립니다.
  const rules = css[0].replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/green|--warning/i.test(rules), '진행상태에 초록·경고색이 들어갔습니다');
});

test('🔴 진행상태 클래스가 「이용 방법」 3단계와 충돌하지 않는다', () => {
  /*
   * 이 단정이 실제로 버그를 잡았습니다(2026-08-13).
   * 처음 이 블록을 `.steps`/`.step` 으로 썼는데, 그 두 이름은 이 페이지 위쪽
   * 「이용 방법」 섹션이 이미 쓰고 있습니다(`.step { display:grid; … }`).
   * 나중에 선언된 `display:flex` 가 그쪽 그리드를 덮어써 레이아웃이 깨졌습니다.
   * 증상이 접수확인 화면이 아니라 **관계없는 섹션**에서 나타나는 종류의 사고라
   * 눈으로 보고 찾기 어렵습니다 — 그래서 테스트로 박아 둡니다.
   */
  const html = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');
  const markup = html.replace(/<!--[\s\S]*?-->/g, '');
  const js = markup.match(/function addProgress[\s\S]*?\n    }\n/)[0];

  /*
   * className 대입만 봅니다. `aria-current` 의 값도 문자열 'step' 이지만 그것은
   * ARIA 명세가 정한 값이라 클래스 충돌과 무관합니다 — 이 구분을 안 하면
   * 정상 코드가 red 를 냅니다(실제로 처음 그렇게 걸렸습니다).
   */
  const assigned = (js.match(/className = '([^']*)'/g) || [])
    .map((s) => s.replace(/^className = '|'$/g, ''))
    .flatMap((s) => s.split(/\s+/))
    // is-done / is-now 는 상태 클래스라 접두어 규칙 대상이 아닙니다.
    .filter((c) => c && c.indexOf('is-') !== 0);

  assert.ok(assigned.length > 0, 'addProgress 가 클래스를 붙이지 않습니다');
  for (const cls of assigned) {
    assert.ok(
      cls === 'progress' || cls.indexOf('progress-') === 0,
      'addProgress 가 "' + cls + '" 를 붙입니다 — 이 블록의 클래스는 progress/progress-* 만입니다. ' +
      '.step/.steps 는 「이용 방법」 섹션이 이미 씁니다'
    );
  }

  // 「이용 방법」 쪽 규칙이 살아 있는지도 함께 봅니다 — 지워서 충돌을 없애는 것은 해결이 아닙니다.
  assert.ok(/\.step \{\s*\n\s*display: grid;/.test(html),
    '「이용 방법」 .step 의 grid 레이아웃이 사라졌습니다');
});
