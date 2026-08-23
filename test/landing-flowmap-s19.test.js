/*
 * 흐름도 섹션 검사 — PRD v2.1 §5-19 〔신설 2026-08-24〕
 *
 *   npm test        (node --test test/)
 *
 * 왜 있는가: 이 섹션은 「인라인 SVG 여야 한다」·「SVG 를 고치지 마라」·「도입부는 SVG
 * 밖이어야 한다」처럼 **마크업의 모양 자체가 요구사항**입니다. 눈으로 보면 <img> 로
 * 바꿔도 똑같이 보이고, 그 순간 텍스트 선택·검색·번역이 조용히 사라집니다. 이 파일이
 * 그 차이를 코드로 붙듭니다.
 *
 * 정본: docs/prd/PRD_landing_v2.1_main_web_page.md §5-19.
 * ⚠️ 섹션 배경(surface)과 그로 인한 하류 8행 밀림은 여기서 보지 않습니다 —
 *    test/landing-order-s9.test.js 의 LAYOUT·O6·O7 과 test/landing-b3b.test.js 가 봅니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** 주석 없는 마크업 — 이 저장소 공통 규칙(주석은 인수인계 수단, 빌드가 떼어냄). */
const markup = (f) => read(f).replace(/<!--[\s\S]*?-->/g, '');

const PAGES = ['index.html', 'en.html'];
const SVG_FILE = 'assets/img/flow-how.svg';

/** 페이지에서 흐름도 <section> 만 잘라냅니다. */
function flowSection(f) {
  const m = markup(f);
  const at = m.indexOf('<section class="flowmap-sec');
  assert.ok(at !== -1, f + ' 에 흐름도 섹션이 없습니다 (§5-19)');
  const end = m.indexOf('</section>', at);
  return m.slice(at, end + 10);
}

/** SVG 안 <text> 의 내용만 순서대로. */
function svgWords(svg) {
  return (svg.match(/<text[^>]*>([^<]*)<\/text>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').trim());
}

/* ── 자산 ─────────────────────────────────────────────────────────────────── */

test('S19-1 흐름도 자산 두 개가 저장소에 있다 — svg 는 인라인용, jpg 는 폴백용', () => {
  for (const f of [SVG_FILE, 'assets/img/flow-how.jpg']) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), f + ' 이 없습니다');
  }
  /* 🔴 jpg 는 **어디에서도 참조하지 않는 것이 정상입니다** 〔§5-19 · 사용자 지시〕.
     폴백용으로 저장소에만 둡니다. 랜딩이 이걸 <img> 로 쓰기 시작하면 인라인 SVG 의
     이유(텍스트 선택·검색·번역)가 사라지므로, 참조가 생기면 여기서 걸립니다. */
  for (const f of PAGES) {
    assert.ok(!markup(f).includes('flow-how.jpg'),
      f + ' 이 flow-how.jpg 를 참조합니다 — 폴백 자산이고 랜딩은 인라인 SVG 를 씁니다');
  }
});

/* ── 삽입 방식 ────────────────────────────────────────────────────────────── */

test('S19-2 인라인 SVG 다 — <img> 가 아니고, 글자가 진짜 텍스트로 들어 있다', () => {
  for (const f of PAGES) {
    const sec = flowSection(f);
    assert.ok(/<svg[\s>]/.test(sec), f + ' 흐름도가 인라인 SVG 가 아닙니다');
    assert.ok(!/<img[^>]*flow-how/.test(sec),
      f + ' 흐름도를 <img> 로 넣었습니다 — 확대·선택·검색이 막힙니다 (§5-19 구현 1)');

    /* 텍스트 선택이 가능하다 = 글자가 <text> 노드로 살아 있다.
       래스터로 굽거나 <path> 로 아웃라인화하면 여기서 걸립니다. */
    assert.strictEqual(svgWords(sec).length, 7,
      f + ' 흐름도 SVG 의 <text> 가 7개가 아닙니다 — 글자가 도형으로 바뀌었을 수 있습니다');
  }
});

test('S19-3 SVG 내부 문구가 원본 파일과 100% 일치한다', () => {
  /* 🔴 원본 파일을 정본으로 삼아 대조합니다 — 페이지에 적힌 값을 서로 비교하면
     둘 다 같이 틀렸을 때 통과합니다. */
  const origin = svgWords(read(SVG_FILE));
  assert.deepStrictEqual(origin,
    ['계약서', '증권', '품목', 'TROPS', '기한', '요건', '근거'],
    SVG_FILE + ' 의 낱말이 §5-19 가 적은 일곱 개와 다릅니다');

  for (const f of PAGES) {
    assert.deepStrictEqual(svgWords(flowSection(f)), origin,
      f + ' 의 인라인 SVG 문구가 원본과 다릅니다 — §5-19 는 「SVG 내용을 수정하지 마라」입니다');
  }
});

test('S19-4 도입부 문구가 SVG 밖 HTML 텍스트다', () => {
  for (const f of PAGES) {
    const sec = flowSection(f);
    const svg = sec.slice(sec.indexOf('<svg'));
    const outside = sec.slice(0, sec.indexOf('<svg'));

    assert.ok(/<h2[^>]*id="flowmap-title"/.test(outside),
      f + ' 흐름도 제목이 SVG 밖에 없습니다 (§5-19 구현 3)');
    assert.ok(/<p class="flowmap-lead">/.test(outside),
      f + ' 흐름도 도입부 문단이 SVG 밖에 없습니다 (§5-19 구현 3)');
    /* SVG 안에는 도형 낱말 일곱 개 말고 문장이 들어가면 안 됩니다. */
    assert.ok(!svgWords(svg).some((w) => w.length > 6),
      f + ' 도입부 문구가 SVG 안으로 들어갔습니다 — 번역·검색·선택이 막힙니다');
  }
});

test('S19-5 가로 스크롤 래퍼가 없고, 비율을 지키며 폭에 맞춰 줄어든다', () => {
  /* 🔴 §5-19 결정: 이 SVG 는 낱말 일곱 개뿐이고 조문 번호·확인 기준일 표기가 없어
     축소해도 읽힙니다. 스크롤을 달지 않습니다. */
  for (const f of PAGES) {
    const sec = flowSection(f);
    assert.ok(!/overflow-x/.test(sec),
      f + ' 흐름도에 가로 스크롤 래퍼가 붙었습니다 — §5-19 는 넣지 않기로 정했습니다');
    assert.ok(/viewBox="0 0 1600 480"/.test(sec),
      f + ' 흐름도 SVG 의 viewBox 가 원본과 다릅니다 — 비율이 깨집니다');

    const css = read(f).match(/<style[\s\S]*?<\/style>/)[0];
    assert.ok(/\.flowmap-fig svg\s*\{[^}]*width:\s*100%/.test(css),
      f + ' 에 `.flowmap-fig svg { width:100% }` 가 없습니다 — 컨테이너 폭을 안 따라갑니다');
    /* ⚠️ height:auto 가 없으면 SVG 의 height="480" 속성이 남아 그림이 납작해집니다. */
    assert.ok(/\.flowmap-fig svg\s*\{[^}]*height:\s*auto/.test(css),
      f + ' 에 `.flowmap-fig svg { height:auto }` 가 없습니다 — 폭만 줄고 높이가 480px 로 남습니다');
  }
});

/* ── 접근성 ───────────────────────────────────────────────────────────────── */

test('S19-6 대체 텍스트가 §5-19 원문이고, 국문·영문이 각자 제 언어로 붙어 있다', () => {
  const KO = '수출 계약서·보험 증권·품목 정보가 TROPS 로 모이고, 약관과 규정을 조문 단위로 ' +
    '대조한 뒤 기한·요건·근거 세 가지로 정리되어 나오는 흐름도.';
  const EN = 'A flow diagram: export contracts, insurance policies and item details feed into ' +
    'TROPS, which compares them against policy terms and regulations clause by clause, ' +
    'and returns deadlines, requirements and sources.';

  for (const [f, alt] of [['index.html', KO], ['en.html', EN]]) {
    const sec = flowSection(f);
    /* 인라인 SVG 에는 alt 속성이 없습니다 — role="img" + aria-label 이 그 자리입니다. */
    assert.ok(/<svg[^>]*role="img"/.test(sec),
      f + ' 흐름도 SVG 에 role="img" 가 없습니다 — 스크린리더가 도형 낱말을 하나씩 읽습니다');
    assert.ok(sec.includes('aria-label="' + alt + '"'),
      f + ' 흐름도의 aria-label 이 §5-19 alt 원문과 다릅니다');
  }
});

/* ── 배치 ─────────────────────────────────────────────────────────────────── */

test('S19-7 상품 3종 섹션 «바로» 다음이다 — 사이에 낀 섹션이 없다', () => {
  for (const f of PAGES) {
    const m = markup(f);
    const cards = m.indexOf('<section class="cards-sec');
    const flow = m.indexOf('<section class="flowmap-sec');
    assert.ok(cards !== -1 && flow !== -1, f + ' 에 상품소개 또는 흐름도 섹션이 없습니다');
    assert.ok(cards < flow, f + ' 흐름도가 상품 3종보다 앞에 있습니다');

    const between = m.slice(m.indexOf('</section>', cards), flow);
    assert.ok(!/<section[\s>]/.test(between),
      f + ' 의 상품 3종과 흐름도 사이에 다른 섹션이 끼었습니다 — §5-19 는 「바로 다음」입니다');
  }
});
