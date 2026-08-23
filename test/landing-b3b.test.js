'use strict';

/*
 * B3-b 회귀 검사 〔landing-b3b-hero-sample-check · 신설 2026-08-23〕
 *
 * 정본: docs/prd/PRD_landing_v2.1_main_web_page.md §5-1 · §5-4 · §5-5 · §5-6 · §5-11
 *       docs/02-design/features/landing-b3b-hero-sample-check.design.md
 *
 * ── 왜 있는가 ───────────────────────────────────────────────────────────────
 * `scripts/check-b3b-gates.js` 는 **배치 시점**의 게이트입니다(baseRef 대조가 들어 있어
 * 다음 배치에서는 의미가 달라집니다). 여기 있는 것은 **그 뒤로도 계속 지켜야 하는 것**만
 * 골라 담은 것이고, 셋 다 화면이 멀쩡한 채 깨지는 종류입니다:
 *
 *   ① 짝수 삽입 — 진단 범위·샘플 둘 중 하나만 지우면 아래 다섯 섹션의 배경이 통째로
 *      뒤집혀야 하는데, 안 뒤집어도 페이지는 그냥 그려집니다(경계만 사라집니다).
 *   ② §5-6 입력 폼의 국가 값 — 앱의 목적국 축(ISO-2)과 어긋나면 넘어간 뒤에 층이
 *      안 붙습니다. 폼은 정상 제출되고 화면도 멀쩡합니다.
 *   ③ 샘플 CTA 의 목적지 — `/sample` 등재가 빠지면 404 인데, 그것은 배포에서만 납니다.
 *
 * ⚠️ 마크업 검사는 **주석을 걷어낸 뒤** 합니다(이 저장소 공통 규칙 — 주석을 인수인계
 *    수단으로 쓰고 빌드가 떼어냅니다). 이 파일의 주석에도 옛 문구가 인용돼 있습니다.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/** 주석 없는 마크업. */
const M = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
/** 사람 눈에 보이는 본문만. */
const B = M.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
/** <style> 안의 CSS(주석 제거). */
const CSS = read('index.html').match(/<style[\s\S]*?<\/style>/)[0].replace(/\/\*[\s\S]*?\*\//g, '');

/** `<section class="x">` 한 덩이. */
function section(cls) {
  const a = M.indexOf('<section class="' + cls);
  assert.ok(a !== -1, cls + ' 섹션을 찾지 못했습니다');
  return M.slice(a, M.indexOf('</section>', a));
}

/* ══ 1. 짝수 삽입 — 배경 교차가 하류로 번지지 않았다 ═══════════════════════ */

test('진단 범위·샘플이 **둘 다** 있다 — 하나만 지우면 하류 배경이 전부 뒤집힌다', () => {
  const scope = M.indexOf('<section class="scope-sec');
  const sample = M.indexOf('<section class="sample-sec');
  const pricing = M.indexOf('<section class="pricing-sec');
  const cards = M.indexOf('<section class="cards-sec');

  assert.ok(scope !== -1, '진단 가능 범위 섹션이 없습니다 (§5-6)');
  assert.ok(sample !== -1, '샘플 섹션이 없습니다 (§5-11)');

  /* 자리도 함께 봅니다 — 상품소개(무엇을) → 진단범위(내 품목이) → 샘플(무엇을 받나)
     → 무료·유료(얼마) 가 한 사람의 질문 순서입니다(설계 §1). */
  /* 🔄 흐름도(§5-19)가 상품소개와 진단 범위 사이에 들어왔습니다 〔2026-08-24〕.
     「무엇을 파는가(상품 셋) → 그래서 서로 어떻게 이어지는가(흐름도) → 내 품목이
     되는가(진단 범위) → 무엇을 받는가(샘플) → 얼마인가(무료·유료)」 순입니다. */
  const flow = M.indexOf('<section class="flowmap-sec');
  assert.ok(flow !== -1, '흐름도 섹션이 없습니다 (§5-19)');
  assert.ok(cards < flow && flow < scope && scope < sample && sample < pricing,
    '섹션 순서가 설계와 다릅니다 — 상품소개 → 흐름도 → 진단 범위 → 샘플 → 무료·유료 여야 합니다');
});

/*
 * 🔄 **배경이 한 칸씩 밀렸습니다** 〔2026-08-24 · 흐름도 §5-19 신설〕.
 *
 * B3-b 는 섹션을 **둘**(진단 범위 + 샘플) 끼워 짝수였고, 그래서 하류가 안 밀린다는 것이
 * 이 검사의 원래 요지였습니다. §5-19 흐름도가 **하나** 더 들어오면서 홀수가 됐고,
 * 상품소개(bg) 와 진단 범위(surface) 사이에는 넣을 수 있는 배경이 수학적으로 없어
 * (bg 면 앞과 연속·surface 면 뒤와 연속·다크는 O9 가 금지) 흐름도를 surface 로 두고
 * 하류 여덟 섹션을 뒤집었습니다.
 *
 * 그래서 이 검사는 「안 밀렸다」가 아니라 **「정확히 한 칸 밀렸다」**를 봅니다.
 * 뜻은 그대로입니다 — 교차가 유지되는지, 그리고 다음 사람이 흐름도를 지웠을 때
 * 여기서 걸리는지. 완전 교차 자체는 landing-order-s9.test.js O7 이 LAYOUT 으로 봅니다.
 */
test('배경 교차 — 흐름도 삽입으로 한 칸 밀렸다 (흐름도 surface · 진단 범위 bg · 샘플 surface)', () => {
  const tag = (key) => M.slice(M.indexOf(key), M.indexOf('>', M.indexOf(key)));
  const has = (key) => /\bsec-surface\b/.test(tag(key));

  assert.ok(M.indexOf('<section class="flowmap-sec') !== -1,
    '흐름도 섹션이 없습니다 (§5-19) — 지웠다면 아래 여덟 섹션의 배경도 함께 되돌려야 합니다');
  assert.ok(has('<section class="flowmap-sec'),
    '흐름도에 .sec-surface 가 없습니다 — 위 상품소개(bg)와 배경이 연속이 됩니다');
  assert.ok(!has('<section class="scope-sec'),
    '진단 범위에 .sec-surface 가 남아 있습니다 — 위 흐름도와 배경이 연속이 됩니다');
  assert.ok(has('<section class="sample-sec'),
    '샘플에 .sec-surface 가 없습니다 — 위 진단 범위(bg)와 배경이 연속이 됩니다');
  assert.ok(!has('<section class="pricing-sec'),
    '무료·유료에 .sec-surface 가 남아 있습니다 — 흐름도 삽입으로 한 칸 밀렸어야 합니다');
});

test('새 섹션 셋에 세로 여백 규칙이 있다', () => {
  /* 🔴 B3-a 가 `.pricing-inner` 에 이 규칙을 빠뜨려 그 섹션만 여백 0 으로 나가 있었습니다.
     같은 실수를 두 번 하지 않도록 셋을 한 줄로 묶고 여기서 셉니다. */
  for (const cls of ['scope-inner', 'sample-inner', 'pricing-inner']) {
    assert.ok(new RegExp('\\.' + cls + '\\b[^{]*\\{[^}]*padding-block').test(CSS) ||
      new RegExp('\\.' + cls + '[^{]*,[^{]*\\{[^}]*padding-block').test(CSS),
      '.' + cls + ' 에 padding-block 이 없습니다 — 섹션이 위아래 여백 0 으로 붙습니다');
  }
});

/* ══ 2. §5-6 입력 폼 ══════════════════════════════════════════════════════ */

test('진단 범위는 목록이 아니라 **입력창**이다 (PRD §2 P-4)', () => {
  const s = section('scope-sec');
  assert.ok(/<form[^>]*class="scope-form"[^>]*method="get"/.test(s),
    '진단 범위가 GET 폼이 아닙니다 — JS 가 죽어도 버튼이 동작해야 합니다(fail-open)');
  assert.ok(/action="https:\/\/app\.trops\.kr\/precheck"/.test(s),
    '목적지가 PRD §6-1 이 정한 앱 진단 화면이 아닙니다');
  assert.ok(/name="product"/.test(s) && /name="destination"/.test(s),
    '품목·대상국 입력이 없습니다 — P-4 가 「커버리지를 목록이 아닌 입력창으로」로 정했습니다');

  /* ⛔ 지원 품목 목록을 만들면 그 목록이 곧 제품의 한계로 읽힙니다(룰셋 커버리지 1건). */
  assert.ok(s.indexOf('전동카트') === -1,
    '지원 품목명이 화면에 적혔습니다 — 커버리지가 1건이라 그 1건이 곧 한계로 읽힙니다');
});

test('대상국 값이 앱의 목적국 축(ISO-2)과 같은 형식이다', () => {
  const s = section('scope-sec');
  const sel = s.slice(s.indexOf('<select'), s.indexOf('</select>'));
  const values = [...sel.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);

  assert.ok(values[0] === '', '첫 보기가 빈 값(미선택)이 아닙니다');
  const codes = values.slice(1);
  assert.ok(codes.length >= 60,
    '국가가 ' + codes.length + '개입니다 — 앱의 목록(80개)을 비추는 자리라 크게 줄면 어긋난 것입니다');
  for (const c of codes) {
    assert.ok(/^[A-Z]{2}$/.test(c),
      '국가 값 「' + c + '」이 ISO-2 가 아닙니다 — 앱의 destination 축과 같은 값이어야 ' +
      '넘어간 뒤에 층이 붙습니다(정본: trops_a lib/constants/countries.ts)');
  }
  assert.strictEqual(new Set(codes).size, codes.length, '국가 코드에 중복이 있습니다');

  /* 라벨 없는 입력칸을 만들지 않습니다 — placeholder 는 라벨이 아닙니다(값을 넣으면 사라집니다). */
  for (const id of ['scope-product', 'scope-destination']) {
    assert.ok(new RegExp('<label class="sr-only" for="' + id + '"').test(s),
      id + ' 에 라벨이 없습니다 — placeholder 는 라벨이 아닙니다');
  }
  assert.ok(/\.sr-only\s*\{[^}]*clip-path/.test(CSS),
    '.sr-only 규칙이 없습니다 — display:none 으로 숨기면 보조기술에서도 사라집니다');
});

/* ══ 3. 샘플 ══════════════════════════════════════════════════════════════ */

test('샘플 CTA 와 히어로 CTA2 가 같은 곳(/sample)을 가리킨다', () => {
  assert.ok(/href="\/sample"/.test(section('sample-sec')), '샘플 섹션 CTA 가 /sample 이 아닙니다');
  const hero = M.slice(M.indexOf('<section class="container hero">'), M.indexOf('</section>', M.indexOf('<section class="container hero">')));
  assert.ok(/href="\/sample"/.test(hero), '히어로 CTA2 가 /sample 이 아닙니다');

  /* 🔴 `/sample` 은 STATIC 등재로만 존재합니다 — 등재가 빠지면 두 버튼이 함께 404 가
     되고, 그 404 는 **배포에서만** 납니다(PRD §4 「B3-1은 B3-5 없이 배포 불가」). */
  const STATIC = require('../scripts/build-static.js').STATIC.html;
  for (const f of ['sample.html', 'en-sample.html']) {
    assert.ok(STATIC.some((r) => r.file === f), f + ' 이 STATIC.html 에 없습니다 — 배포되지 않습니다');
  }
});

test('샘플 섹션이 예시 문서임을 화면에서 말한다', () => {
  const s = section('sample-sec');
  assert.ok(s.indexOf('가상의 기업 정보로 구성한 예시 문서입니다') !== -1,
    '예시 고지가 없습니다 — 실제 발급 문서로 읽힐 수 있습니다');
  assert.ok(s.indexOf('인증·허가·검사 결과가 아닙니다') !== -1, '§5-11 마지막 줄이 없습니다');
});

/* ══ 4. 샘플 페이지 2종 ═══════════════════════════════════════════════════ */

test('샘플 2종의 :root 가 랜딩 브랜드 토큰과 같다', () => {
  /* 지시: 「:root 색상 변수가 랜딩의 브랜드 컬러와 다르면 :root 블록의 값만 맞춘다.」
     랜딩 정본은 index.html 의 --ink · --accent 입니다. */
  const ink = (CSS.match(/--ink:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
  const accent = (CSS.match(/--accent:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
  assert.ok(ink && accent, 'index.html 의 브랜드 토큰을 읽지 못했습니다');

  for (const f of ['sample.html', 'en-sample.html']) {
    const root = read(f).match(/:root\{[\s\S]*?\}/)[0];
    const a = (root.match(/--ink:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
    const b = (root.match(/--brand:\s*(#[0-9A-Fa-f]{6})/) || [])[1];
    assert.strictEqual((a || '').toLowerCase(), ink.toLowerCase(), f + ' 의 --ink 가 랜딩과 다릅니다');
    assert.strictEqual((b || '').toLowerCase(), accent.toLowerCase(), f + ' 의 --brand 가 랜딩 액센트와 다릅니다');
  }
});

test('샘플 2종은 사이트 헤더·푸터를 갖지 않는다 — 랜딩이 아니라 문서다', () => {
  /* 이 성질이 `naming-consistency.test.js` 의 SAMPLE_PAGES 예외를 정당화합니다.
     둘 중 하나가 랜딩 껍데기를 갖게 되면 그 예외가 근거를 잃습니다. */
  for (const f of ['sample.html', 'en-sample.html']) {
    const t = read(f);
    assert.ok(t.indexOf('class="footer-meta"') === -1, f + ' 에 사이트 푸터가 생겼습니다');
    assert.ok(t.indexOf('<nav class="nav">') === -1, f + ' 에 사이트 헤더가 생겼습니다');
  }
});
