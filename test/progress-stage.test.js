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

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ⚠️ **화면 축 4건을 걷었습니다** 〔2026-08-30 · 접수 화면 삭제 딸림〕
 * ══════════════════════════════════════════════════════════════════════════════
 * 걷은 것: 「화면은 서버가 준 stage 만 그린다」 · 「3단계 라벨이 흐름 md 문구와 같다」 ·
 * 「완료 표시에 판정색을 쓰지 않는다」 · 「진행상태 클래스가 이용 방법 3단계와 충돌하지
 * 않는다」 — 넷 다 `precheck.html` 의 `addProgress`·`PROGRESS_STEPS`·`.progress` 를 쟀고,
 * 그 페이지가 커밋 `ca47218` 에서 삭제됐습니다.
 *
 * 🔴 **그래서 잃은 보증을 적어 둡니다 — 되살릴 때 함께 되살리십시오.**
 *   · **단계 판단이 서버 한 곳에만 있다**(화면이 복제하지 않는다). 위 1~8 은 서버 함수가
 *     옳은지만 재고, 「화면이 그것을 다시 계산하지 않는가」는 **이제 아무도 재지 않습니다.**
 *   · 3단계 라벨 원문 · 판정색 금지 · `.step`/`.steps` 클래스 충돌(실제 버그를 잡았던 단정).
 * ⛔ 접수 화면을 다시 세우는 날 이 넷을 함께 세우십시오
 *    (원본: `git show ca47218^:test/progress-stage.test.js`).
 */
