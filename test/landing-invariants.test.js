/*
 * 랜딩 불변 검사 〔신설 2026-08-30 · 랜딩 4파일을 대체〕
 *
 *   npm test        (node --test test/)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **왜 네 파일을 하나로 합쳤는가**
 * ══════════════════════════════════════════════════════════════════════════════
 * `landing-b3b` · `landing-basis-stack` · `landing-emphasis-s10` · `landing-flow-s9` ·
 * `landing-order-s9` 다섯 파일이 **2026-08-29 랜딩 전면교체**(213KB → 18.7KB)로 함께
 * 무너졌습니다(합계 fail 56). 그 검사들이 재던 것은 대부분 **그 개편이 걷어낸 섹션**입니다 —
 * 3탭 카드 · FAQ 아코디언 · 근거 스택 3장 · 로드맵 · 진단범위 입력폼 · `#interest` 폼 ·
 * 스크롤 등장 애니메이션 · 17행 배치표. 지킬 대상이 없는 검사는 되살릴 수 없습니다.
 *
 * 🔴 **그러나 «지우기만» 하지 않았습니다**(대표 지시). 살아남은 축을 여기 모읍니다:
 *   ① 페이지 전역 «부재» 단정 — 문구가 되살아나는 것을 막는 축(대상이 없어도 유효)
 *   ② 마감 CTA — 개편 뒤에도 `.close-cta` 로 살아 있습니다(단 `<section>` → `<div>`)
 *   ③ 크기 위계 — 새 통계 인용 블록(`.stat-*`)이 같은 성격의 자리입니다
 *   ④ 샘플 2종 — 페이지가 실재하므로 그대로 잽니다
 *   ⑤ 배경 토큰 — `--surface`·`--line-on-surface` 가 새 랜딩에도 있습니다
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **거짓 green 세 건을 함께 걷었습니다** — 통과하고 있었으나 «아무것도 재지 않았습니다»
 * ══════════════════════════════════════════════════════════════════════════════
 *   · `landing-order-s9` **O7** — 하드코딩된 `LAYOUT` 상수 배열만 순회. HTML 을 읽지 않아
 *     페이지가 무엇이든 통과했습니다.
 *   · `landing-emphasis-s10` **E1** — `indexOf('class="stories-sec')` 가 −1 이라
 *     `slice(-1, …)` 이 **문자 1개**를 검사했습니다.
 *   · `landing-flow-s9` **#18**(「상담 신청」 문항 0건) — `<section class="qna"` 가 없어
 *     **빈 문자열**을 검사했습니다(실측: 잘라낸 길이 0).
 * ⛔ 「green 이니 살려 두자」로 판단하지 마십시오 — 이 셋이 그 판단의 반례입니다.
 *    ⚠️ #18 의 축은 살릴 수 있어 아래 ①로 **페이지 전역**으로 옮겼습니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** 🔴 랜딩 두 장을 **함께** 잽니다 — 한쪽만 고치는 것이 이 저장소의 반복 사고입니다. */
const LANDINGS = ['index.html', 'en.html'];

/** 주석·스타일·스크립트를 뺀 «보이는» 마크업. */
const body = (f) =>
  read(f)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');

/** `.close-cta` 블록. ⚠️ 개편으로 `<section>` 이 아니라 `<div>` 입니다. */
function closeCta(f) {
  const m = body(f).match(/<div class="close-cta">([\s\S]*?)<\/div>/);
  return m ? m[1] : null;
}

/* ══ ① 되살아나면 안 되는 문구 — 페이지 전역 ═══════════════════════════════ */

test('🔴 KOTRA 신뢰신호 문구가 랜딩 어디에도 없다', () => {
  /*
   * ⚠️ 「KOTRA」 자체를 셀 수는 없습니다 — 기관 안내의 「KOTRA 해외무역관」은 별개 항목이라
   *    그대로 남아 있어야 합니다. 지워야 하는 것은 **신뢰신호로 쓰이던 그 문구**입니다.
   */
  for (const f of LANDINGS) {
    const hits = (body(f).match(/KOTRA 멘토 네트워크/g) || []).length;
    assert.strictEqual(hits, 0, f + ' 에 KOTRA 신뢰신호 문구가 ' + hits + '번 남아 있습니다');
  }
});

test('🔴 「상담 신청」을 되살리지 않았다 — 명칭은 「문의하기」로 확정됐다', () => {
  /*
   * 🔴 **스코프를 페이지 전역으로 넓혔습니다** — 종전에는 FAQ 섹션 안만 봤고, 그 섹션이
   *    사라지자 **빈 문자열을 검사하며 통과**했습니다(위 「거짓 green」).
   * ⚠️ 「상담」 단독은 세지 않습니다 — 새 통계 섹션이 중기부 프로그램을 인용하며
   *    「서류·통관 관련 상담 중」·「우수 상담 사례 500건」을 씁니다. 그것은 **인용**이지
   *    우리가 유상 자문을 제안하는 말이 아니라 이 규칙의 취지와 다른 용법입니다.
   */
  for (const f of LANDINGS) {
    assert.ok(!/상담\s*신청/.test(body(f)), f + ' 에 「상담 신청」이 있습니다');
  }
});

/* ══ ② 마감 CTA ═══════════════════════════════════════════════════════════ */

test('마감 CTA 에는 버튼이 정확히 하나다', () => {
  /*
   * 🔴 **기대를 좁혔습니다** — 종전 단정(`data-purpose="inquiry"` · `data-timeline-open`
   *    부재)은 그 속성이 개편으로 사라져 잴 수 없습니다. 남은 축은 **「버튼이 하나다」**이며,
   *    그것이 원래 이 검사의 본론이었습니다(둘이 되면 무엇을 누를지 갈립니다).
   */
  for (const f of LANDINGS) {
    const close = closeCta(f);
    assert.ok(close, f + ' 에 .close-cta 가 없습니다');
    const buttons = (close.match(/class="btn[ "]/g) || []).length;
    assert.strictEqual(buttons, 1, f + ' 의 마감 CTA 버튼이 ' + buttons + '개입니다');
  }
});

test('마감 CTA 가 「상담」이라는 낱말을 쓰지 않는다 — 유상 자문 오인 이력', () => {
  for (const f of LANDINGS) {
    assert.ok(!/상담/.test(closeCta(f) || ''), f + ' 의 마감 CTA 에 「상담」이 있습니다');
  }
});

/* ══ ③ 크기 위계 ══════════════════════════════════════════════════════════ */

test('🔴 인용 출처가 본문보다 작다 — 출처가 본문만큼 크면 인용이 주장이 된다', () => {
  /*
   * 🔴 **retarget** — 종전 대상 `.basis-list p` 가 사라졌고, 같은 성격의 자리가
   *    새 통계 섹션의 `.stat-src` 입니다(출처 표기). 축은 그대로 「본문보다 작다」입니다.
   * ⚠️ 실측 기준값: `.stat-src` 14.5px · 본문 16.5px.
   */
  const css = read('index.html');
  const src = Number((css.match(/\.stat-quote \.stat-src\{[^}]*font-size:([\d.]+)px/) || [])[1]);
  const bodySize = Number((css.match(/body\{[^}]*font-size:([\d.]+)px/) || [])[1]);
  assert.ok(src > 0 && bodySize > 0, '크기 값을 읽지 못했습니다 (src=' + src + ' body=' + bodySize + ')');
  assert.ok(src < bodySize, '인용 출처(' + src + 'px)가 본문(' + bodySize + 'px)보다 작지 않습니다');
});

test('🔴 통계 숫자가 그 설명보다 크다 — 「제일 중요한 한마디」가 작게 나간 사고 이력', () => {
  /*
   * ⚠️ 종전 E3 은 「인용문이 h2 보다 크다(헤드라인급)」였는데, 새 랜딩에서는 인용문이
   *    h2 보다 **작습니다**(clamp 상한 28px vs 40px). 그 기대를 그대로 옮기면 red 이고,
   *    그것은 **개편이 내린 결정**이지 결함이 아닙니다. 그래서 축을 같은 블록 «안»의
   *    위계로 좁혔습니다 — 숫자(`.stat-n`)가 라벨(`.stat-t`)보다 크다.
   */
  const css = read('index.html');
  const n = Number((css.match(/\.stat-n\{font-size:clamp\([\d.]+px,[^,]+,([\d.]+)px\)/) || [])[1]);
  const t = Number((css.match(/\.stat-t\{font-size:([\d.]+)px/) || [])[1]);
  assert.ok(n > 0 && t > 0, '크기 값을 읽지 못했습니다 (n=' + n + ' t=' + t + ')');
  assert.ok(n > t, '통계 숫자(' + n + 'px)가 설명(' + t + 'px)보다 크지 않습니다');
});

/* ══ ④ 샘플 2종 ═══════════════════════════════════════════════════════════ */

const SAMPLES = ['sample.html', 'en-sample.html'];

test('샘플 2종이 배포 목록에 있다 — 빠지면 404 가 배포에서만 난다', () => {
  const STATIC = require('../scripts/build-static.js').STATIC.html;
  for (const f of SAMPLES) {
    assert.ok(STATIC.some((r) => r.file === f), f + ' 이 STATIC.html 에 없습니다');
  }
});

test('샘플 2종의 :root 가 랜딩 브랜드 토큰과 같다', () => {
  const css = read('index.html');
  const ink = (css.match(/--ink:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
  const accent = (css.match(/--accent:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
  assert.ok(ink && accent, 'index.html 의 브랜드 토큰을 읽지 못했습니다');

  for (const f of SAMPLES) {
    const root = read(f).match(/:root\{[\s\S]*?\}/)[0];
    const a = (root.match(/--ink:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
    const b = (root.match(/--brand:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
    assert.strictEqual((a || '').toLowerCase(), ink.toLowerCase(), f + ' 의 --ink 가 랜딩과 다릅니다');
    assert.strictEqual((b || '').toLowerCase(), accent.toLowerCase(), f + ' 의 --brand 가 랜딩 액센트와 다릅니다');
  }
});

test('샘플 2종은 사이트 헤더·푸터를 갖지 않는다 — 랜딩이 아니라 문서다', () => {
  for (const f of SAMPLES) {
    const t = read(f);
    assert.ok(t.indexOf('class="footer-meta"') === -1, f + ' 에 사이트 푸터가 생겼습니다');
    assert.ok(t.indexOf('<nav class="nav">') === -1, f + ' 에 사이트 헤더가 생겼습니다');
  }
});

/* ══ ⑤ 배경 토큰 ══════════════════════════════════════════════════════════ */

test('표면 배경 토큰이 살아 있다 — 섹션 교차의 값이 흩어지지 않는다', () => {
  for (const f of LANDINGS) {
    const css = read(f);
    for (const token of ['--surface', '--line-on-surface']) {
      assert.ok(css.includes(token + ':'), f + ' 에 ' + token + ' 가 없습니다');
    }
  }
});

/* ══ ⑥ 결정 대기 ══════════════════════════════════════════════════════════ */

const D5_PENDING =
  '🔴 결정 대기(D-5) — sample.html·en-sample.html 이 «배포되는데 유입 링크가 0» 이다. ' +
  '랜딩에 /sample 링크 0건(실측). 의도면 이 검사를 지우고, 아니면 링크를 되살린다. ' +
  '⚠️ scripts/build-static.js 주석은 아직 「히어로 CTA2 가 이 경로를 가리킨다」로 낡아 있다.';

test('랜딩에 /sample 로 가는 링크가 있다', { skip: D5_PENDING }, () => {
  for (const f of LANDINGS) {
    assert.ok(/href="\/sample"/.test(body(f)), f + ' 에 /sample 링크가 없습니다');
  }
});
