/*
 * 랜딩 강약·배치 검사 〔landing-emphasis-s10 · 신설 2026-08-14〕
 *
 *   npm test        (node --test test/)
 *
 * 정본: docs/02-design/features/landing-emphasis-s10.design.md
 *
 * 왜 있는가: s9 가 섹션의 **순서**를 못질했다면(test/landing-order-s9.test.js), 이 파일은
 * 섹션 **안의 강약**을 못질합니다. 강약은 주석으로만 남으면 다음 사람이 값 하나를 고칠 때
 * 조용히 평평해집니다 — 실제로 신뢰증명에서 「제일 중요한 한마디」가 섹션 제목보다 작은
 * 상태로 배포돼 있었습니다.
 *
 * ⚠️ 모든 마크업 검사는 **주석을 걷어낸 뒤** 합니다(이 저장소의 공통 규칙 — 주석을
 *    인수인계 수단으로 쓰고 빌드가 떼어냅니다). CSS 검사만 <style> 원문을 봅니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
/** 주석 없는 마크업. */
const M = RAW.replace(/<!--[\s\S]*?-->/g, '');
/** 사람 눈에 보이는 본문만 — <style>·<script> 안 주석까지 걷습니다. */
const B = M.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
/** <style> 안의 CSS(주석 제거). */
const CSS = RAW.match(/<style[\s\S]*?<\/style>/)[0].replace(/\/\*[\s\S]*?\*\//g, '');

/** 선택자 하나의 선언 블록. 없으면 실패시킵니다. */
function rule(selector) {
  const at = CSS.indexOf(selector + ' {');
  assert.ok(at !== -1, '규칙을 찾지 못했습니다: ' + selector);
  return CSS.slice(at, CSS.indexOf('}', at));
}

/* ══ E1 경험담 — 관할조항 ═══════════════════════════════════════════════════ */

test('E1 경험담 우측 카드가 「관할조항」이라는 이름부터 말한다', () => {
  const at = B.indexOf('story-side is-case');
  assert.ok(at !== -1, '경험담 우측 카드를 찾지 못했습니다');
  const body = (B.slice(at).match(/<p class="story-body">([^<]*)<\/p>/) || [])[1];
  assert.ok(body, '우측 카드에 본문이 없습니다');

  assert.ok(body.startsWith('관할조항'),
    '우측 카드가 조항의 이름으로 시작하지 않습니다. 바로 다음 질문(「이 조항, 본 적 ' +
    '있으신가요?」)의 「이 조항」이 가리킬 낱말이 앞에 없으면, 읽는 사람이 자기 계약서에서 ' +
    '찾아볼 검색어를 못 얻습니다:\n  ' + body);

  // 이름을 말하는 것과 판정을 내리는 것은 다릅니다 — 평가어 금지는 그대로입니다.
  for (const word of ['위험', '불리', '문제', '잘못']) {
    assert.ok(body.indexOf(word) === -1,
      '평가어 「' + word + '」가 들어갔습니다 — 사례는 조항이 무엇이라 적혀 있었고 그 뜻이 ' +
      '무엇인지까지만 씁니다(우리가 먼저 판정을 선언하지 않습니다)');
  }
});

test('E1-a 「이 조항, 본 적 있으신가요?」가 그 문장 바로 뒤에 온다', () => {
  const body = B.indexOf('관할조항이 있는데');
  const ask = B.indexOf('이 조항, 본 적 있으신가요?');
  const common = B.indexOf('관할조항을 처음 들어보신');
  assert.ok(body !== -1 && ask !== -1 && common !== -1, '세 문장 중 빠진 것이 있습니다');
  assert.ok(body < ask && ask < common,
    '읽는 순서가 「이름 → 질문 → 안심」이 아닙니다 — 이름이 질문보다 뒤에 있으면 ' +
    '2026-08-14 이전 상태로 되돌아간 것입니다');
});

/* ══ E2~E5 신뢰증명 — 한마디와 근거 디테일 ═════════════════════════════════ */

test('E2 인용문이 h2 보다 앞에 있다 — 제일 중요한 한마디가 먼저', () => {
  const trust = M.slice(M.indexOf('<section class="trust"'));
  const block = trust.slice(0, trust.indexOf('</section>'));
  const quote = block.indexOf('class="stat-line');
  const h2 = block.indexOf('id="trust-title"');
  assert.ok(quote !== -1 && h2 !== -1, '인용문이나 h2 를 찾지 못했습니다');
  assert.ok(quote < h2,
    'h2 가 인용문 위로 다시 올라갔습니다 — 그 h2(「무엇을 근거로 비교하는지 밝힙니다」)가 ' +
    '소개하는 것은 인용문이 아니라 아래 근거 3줄과 캡처입니다');

  // 자리만 옮긴 것이지 섹션 제목이 사라진 것이 아닙니다.
  assert.ok(/aria-labelledby="trust-title"/.test(block), '섹션이 제목을 잃었습니다');
  assert.ok(block.indexOf('class="trust-detail"') !== -1, '근거 디테일 묶음이 없습니다');
});

test('E3 인용문이 헤드라인급이다 — 섹션 제목보다 크다', () => {
  const quote = rule('.stat-line');
  const hero = rule('.hero h1');

  const size = (quote.match(/font-size:\s*([^;]+);/) || [])[1];
  assert.ok(size, '.stat-line 에 font-size 가 없습니다');
  assert.ok(hero.indexOf(size) !== -1,
    '.stat-line 이 .hero h1 과 다른 스케일을 씁니다(' + size + ') — 신규 타이포 값을 ' +
    '만들지 않는다는 원칙(시각사양 3-1)에 걸립니다');
  assert.ok(/font-weight:\s*700/.test(quote), '인용문이 700 이 아닙니다');

  // h2(40)보다 작으면 「제일 중요한 한마디」가 제목에 눌립니다.
  const h2max = 2.5;   // clamp(1.75rem, 3vw, 2.5rem)
  const qmax = parseFloat((size.match(/,\s*([\d.]+)rem\s*\)/) || [])[1]);
  assert.ok(qmax > h2max,
    '인용문 상한(' + qmax + 'rem)이 h2(' + h2max + 'rem) 이하입니다 — 제일 중요한 ' +
    '한마디가 섹션 제목보다 크지 않습니다');

  assert.ok(!/class="[^"]*\bh3\b[^"]*stat-line/.test(M),
    '.stat-line 에 h3 클래스가 다시 붙었습니다 — 크기를 전부 덮어쓰므로 남기면 다음 ' +
    '사람이 이 문장을 H3 계층으로 읽습니다');
});

test('E4 근거 디테일이 본문보다 한 단계 작다', () => {
  const list = rule('.trust-list p');
  const size = parseFloat((list.match(/font-size:\s*([\d.]+)px/) || [])[1]);
  assert.ok(size < 16.5,
    '근거 3줄이 본문(16.5px)과 같은 무게입니다(' + size + 'px) — 한마디와 디테일의 ' +
    '위계가 화면에 안 보입니다');
  assert.ok(size >= 14,
    '근거 3줄이 ' + size + 'px 입니다 — 캡션 단계(12.5)까지 내리면 근거가 각주처럼 읽혀 ' +
    '「근거를 밝힌다」는 이 섹션의 목적이 약해집니다');

  // 여백·헤어라인으로 갈라 놓았는가.
  const detail = rule('.trust-detail');
  assert.ok(/border-top:/.test(detail) && /margin-top:/.test(detail),
    '.trust-detail 이 한마디와 디테일을 갈라 놓지 않습니다(구분선·여백 없음)');
});

test('E5 근거 3줄이 화면에 그대로 있다 — 접지 않았다', () => {
  const MUST = [
    'Open Government Licence v3.0',
    '비교 항목은 저희가 만들지 않습니다',
    '관할 · 법령명 · 조문 · 시행일 · 확인일자',
  ];
  for (const s of MUST) {
    assert.ok(B.indexOf(s) !== -1, '근거 디테일이 사라졌습니다: 「' + s + '」');
  }
  const trust = B.slice(B.indexOf('<section class="trust"'));
  assert.ok(trust.slice(0, trust.indexOf('</section>')).indexOf('<details') === -1,
    '근거를 <details> 로 접었습니다 — 「비교 항목은 저희가 만들지 않습니다」는 이 페이지의 ' +
    '차별점이라 기본 화면에서 사라지면 안 됩니다');
});

/* ══ E6~E8 정렬 규칙 ═══════════════════════════════════════════════════════ */

test('E6 중앙정렬을 만드는 규칙은 .sec-center 하나뿐이다', () => {
  const centered = (CSS.match(/[^{}]+\{[^}]*text-align:\s*center[^}]*\}/g) || [])
    .map((r) => r.slice(0, r.indexOf('{')).trim());
  assert.deepStrictEqual(centered, ['.sec-center'],
    '중앙정렬이 여러 규칙에 흩어져 있습니다: ' + JSON.stringify(centered) + '\n' +
    '  복사본은 규칙이 아니라 우연입니다 — 한 곳을 고치면 나머지와 조용히 어긋납니다.');
});

test('E7 가운데로 오는 것은 선언·행동 세 섹션뿐이다', () => {
  const users = (M.match(/<div class="[^"]*\bsec-center\b[^"]*"/g) || []);
  assert.strictEqual(users.length, 3,
    'sec-center 를 쓰는 곳이 ' + users.length + '곳입니다 — 결 CTA · 안심문구 · 마감 CTA ' +
    '셋뿐입니다. 설명·근거·목록 섹션은 좌측입니다.');

  for (const inner of ['act-inner', 'assure-inner', 'close-cta-inner']) {
    assert.ok(users.some((u) => u.indexOf(inner) !== -1),
      inner + ' 이 중앙정렬을 잃었습니다');
  }
});

test('E8 결 CTA 가 여백으로 자기 자리를 갖는다 — 배경·구분선이 아니라', () => {
  const act = rule('.act-inner');
  const pad = (act.match(/padding-block:\s*([^;]+);/) || [])[1];
  assert.ok(pad, '.act-inner 에 padding-block 이 없습니다');

  const tops = pad.match(/clamp\(([^)]*)\)/g) || [];
  assert.strictEqual(tops.length, 2,
    '위아래 여백이 같은 값입니다 — 위쪽만 키워야 합니다. 아래는 배경이 갈리는 이웃이라 ' +
    '더 벌릴 이유가 없고, 같이 키우면 페이지에 빈 구멍이 생깁니다: ' + pad);

  const topMax = parseFloat((tops[0].match(/,\s*(\d+)px\s*\)/) || [])[1]);
  assert.ok(topMax > 96,
    '위쪽 여백 상한이 ' + topMax + 'px 입니다 — 기준값(96)보다 커야 좌측정렬 카드 목록과 ' +
    '가운데 블록 사이에 경계가 생깁니다(이 자리는 배경도 구분선도 쓸 수 없습니다)');

  // s9 O7 의 결정이 이 사이클에서 우회되지 않았는지 다시 확인합니다.
  assert.ok(!/\.act\s*\{[^}]*border-top/.test(CSS), '.act 에 border-top 이 붙었습니다');
  assert.ok(!/\.act\s*\{[^}]*background/.test(CSS), '.act 에 배경이 붙었습니다');
});

/* ══ E9~E11 상품소개 3열 ═══════════════════════════════════════════════════ */

/** 3열 미디어쿼리 블록. */
function gridBlock() {
  const at = CSS.indexOf('@media (min-width: 1024px)');
  assert.ok(at !== -1, '3열 미디어쿼리(min-width: 1024px)가 없습니다');
  return CSS.slice(at, CSS.indexOf('\n  }', at));
}

test('E9 상품 카드가 넓은 화면에서 3열(2 + 거터 + 1)이다', () => {
  assert.ok(/\.feats\s*\{[^}]*flex-direction:\s*column/.test(CSS),
    '좁은 화면 기준값이 세로 1열이 아닙니다 — 모바일에서 3열이 되면 카드가 기둥이 됩니다');

  const grid = gridBlock();
  assert.ok(/\.feats\s*\{[^}]*display:\s*grid/.test(grid), '.feats 가 그리드가 아닙니다');

  const cols = (grid.match(/grid-template-columns:\s*([^;]+);/) || [])[1];
  assert.ok(cols, 'grid-template-columns 가 없습니다');
  const tracks = cols.split(/\)\s+(?=minmax|clamp)/).length;
  assert.strictEqual(tracks, 4,
    '트랙이 ' + tracks + '개입니다 — 카드 2 + **빈 거터** + 카드 1 로 4개여야 「앞 2개 / ' +
    '뒤 1개」가 보입니다: ' + cols);

  assert.ok(/\.feats > \.feat:last-child\s*\{[^}]*grid-column:\s*4/.test(grid),
    '기한관리가 4열(거터 건너)에 놓이지 않습니다 — 자동 배치되면 거터 트랙에 들어갑니다');
});

test('E10 펼친 카드는 전폭이다 — 3열에서도 캡처가 읽힌다', () => {
  const grid = gridBlock();
  const open = (grid.match(/([^{}]*\[data-open="1"\])\s*\{[^}]*grid-column:\s*1 \/ -1/) || [])[1];
  assert.ok(open, '펼친 카드가 전폭이 되지 않습니다 — 사전점검 카드의 예시화면(1487×523)이 ' +
    '1/3 폭에서 높이 123px 라 글자가 읽히지 않습니다(3열이 한 번 기각된 사유)');

  /*
   * 특정도 함정: `.feat[data-open="1"]`(0,2,0)로 줄이면 바로 위
   * `.feats > .feat:last-child`(0,3,0)에 져서 기한관리만 안 펼쳐집니다.
   */
  assert.ok(open.trim().startsWith('.feats >'),
    '선택자가 `.feats >` 로 시작하지 않습니다(' + open.trim() + ') — 특정도가 모자라 ' +
    '기한관리 카드만 전폭이 되지 않습니다');

  const lastAt = grid.indexOf('.feats > .feat:last-child');
  assert.ok(lastAt < grid.indexOf(open.trim()),
    '펼침 규칙이 :last-child 규칙보다 앞에 있습니다 — 특정도가 같으므로 순서가 뒤집히면 ' +
    '기한관리가 안 펼쳐집니다');
});

test('E11 「거래 시작 후」 카드가 다른 강조를 갖는다 — 판정색은 아니다', () => {
  const mark = rule('.feats > .feat:last-child');
  const border = (mark.match(/border-left:\s*([^;]+);/) || [])[1];
  assert.ok(border, '마지막 카드(기한관리)에 구분 표시가 없습니다 — 생애주기가 갈리는 ' +
    '자리(전 2 · 후 1)가 화면에서 안 보입니다');
  assert.ok(/^3px/.test(border), '선이 1px 이면 다른 두 카드의 테두리와 구분되지 않습니다: ' + border);

  assert.ok(!/--accent|--warning/.test(border),
    '판정색을 썼습니다(' + border + ') — 액센트는 클릭 가능한 것에만, 경고색은 폼 오류에만 ' +
    '씁니다(시각사양 1-3). 경험담 .story-side.is-case 와 같은 --ink-70 을 쓰십시오.');
  assert.ok(!/\.feats > \.feat:last-child\s*\{[^}]*background/.test(CSS),
    '마지막 카드를 다른 배경으로 채웠습니다 — 세 카드의 「면」이 달라지면 이 카드만 다른 ' +
    '상품처럼 보입니다');
});

/* ══ E12 무손실 ════════════════════════════════════════════════════════════ */

test('E12 강약을 고치면서 콘텐츠·기능이 빠지지 않았다', () => {
  // 문장
  for (const s of [
    '거래처 한두 곳에 매출이 집중된 수출 초기 기업은',
    '한국무역보험공사',
    '무엇을 근거로 비교하는지 밝힙니다.',
    '이 조항, 본 적 있으신가요?',
    '모르시는 게 당연합니다.',
    '결정은 언제나 대표님 것입니다.',
    '받으신 서류부터, 하나 확인해 보세요.',
    '거래를 시작하기 전에 한 번, 시작한 후에 한 번.',
    '사전점검 결과화면에서 바로 확인하실 수 있습니다',
    '지금은 무료입니다.',
    'KOTRA 멘토 네트워크',
  ]) {
    assert.ok(B.indexOf(s) !== -1, '문장이 사라졌습니다: 「' + s + '」');
  }

  // 기능
  assert.strictEqual((M.match(/class="feat-btn"/g) || []).length, 3, '상품 카드가 3장이 아닙니다');
  assert.strictEqual((M.match(/class="feat-panel"/g) || []).length, 3, '카드 패널이 3개가 아닙니다');
  assert.strictEqual((B.match(/data-timeline-open/g) || []).length, 3, '기한관리 트리거가 3곳이 아닙니다');
  assert.strictEqual((M.match(/aria-controls="qa-\d+"/g) || []).length, 14, 'FAQ 가 14문항이 아닙니다');
  assert.ok(/id="interest-form"/.test(M), '사전등록 폼이 사라졌습니다');
  assert.ok(/class="btn btn-primary btn-full" href="\/precheck"/.test(M), '결 CTA 주버튼이 사라졌습니다');

  // 태그 짝 — 신뢰증명에 <div> 를 한 겹 더 씌웠으므로 여기서 셉니다.
  const trust = M.slice(M.indexOf('<section class="trust"'));
  const block = trust.slice(0, trust.indexOf('</section>'));
  assert.strictEqual((block.match(/<div/g) || []).length, (block.match(/<\/div>/g) || []).length,
    '신뢰증명 섹션의 <div> 짝이 맞지 않습니다');
});
