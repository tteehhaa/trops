/*
 * 랜딩 섹션 순서 · 배경 교차 테스트
 *   〔landing-flow-restructure-s9 · 신설 2026-08-14〕
 *
 *   npm test        (node --test test/)
 *
 * 왜 있는가: 이 페이지는 2026-08 한 달 동안 섹션이 다섯 번 옮겨졌습니다. 옮길 때마다
 * 「왜 이 순서인가」가 주석으로만 남아서, 다음 사람이 한 섹션을 옮기면 감정선이 조용히
 * 뒤집혔습니다 — 실제로 신뢰증명이 상품소개 뒤로 밀려 「확신을 만든 뒤 상품을 보여준다」가
 * 정확히 반대가 된 채 배포돼 있었습니다. 이 파일이 그 순서를 코드로 못질합니다.
 *
 * 정본: docs/02-design/features/landing-flow-restructure-s9.design.md §1 배치표.
 * ⚠️ 섹션을 넣거나 옮길 때 **그 표와 이 파일을 함께** 고치십시오. 한쪽만 고치면 다음
 *    사람이 어느 쪽이 정본인지 알 수 없습니다.
 *
 * ⚠️ 모든 검사는 **주석을 걷어낸 마크업**에 대해 합니다(이 저장소의 공통 규칙 —
 *    주석을 인수인계 수단으로 쓰고 빌드가 떼어냅니다). 배경 검사만 <style> 원문을 봅니다.
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
/*
 * 문장 검사 전용 사본 — `<br>` 을 걷습니다 〔2026-08-24〕.
 * `<br>` 은 **줄바꿈 지정이지 문구가 아닙니다**(index.html `.act h2 br` 주석 참조).
 * 이걸 걷지 않으면 「줄을 어디서 끊을지」를 고칠 때마다 문장 검사가 깨지고, 다음
 * 사람은 문구가 사라진 줄 알고 리스트의 문자열을 고치게 됩니다 — 그러면 이 검사가
 * 지키려던 것(원문 보존)이 조용히 풀립니다.
 * ⚠️ 공백이 아니라 **빈 문자열**로 걷습니다 — 마크업이 `건부터 <br>등록해` 처럼
 *    공백을 이미 `<br>` **앞**에 두고 있기 때문입니다(그래야 `<br>` 이 숨겨지는 좁은
 *    화면에서도 어절이 붙지 않습니다). 공백으로 바꾸면 두 칸이 되어 되레 어긋납니다.
 */
const BT = B.replace(/<br\s*\/?>/g, '');

/** <style> 안의 CSS(주석 제거). */
const CSS = RAW.match(/<style[\s\S]*?<\/style>/)[0].replace(/\/\*[\s\S]*?\*\//g, '');

/* ── 배치표 정본 ─────────────────────────────────────────────────────────────
 * key   — 이 섹션을 찾는 문자열(마크업에 실제로 있는 것)
 * bg    — 'bg' | 'surface' | 'dark'
 */
/*
 * 🔄 **경고와 근거가 갈라졌고, 그 사이에 상품이 들어왔습니다** 〔2026-08-14 · basis-split-s13〕.
 *    종전 3행 「신뢰증명(전) → 상품소개 → 결 CTA」가 4행이 됐습니다:
 *      경고(무보 인용문 · 다크)  →  상품소개  →  근거(영국 OGL · 캡처)  →  결 CTA
 *    한 섹션이 심박을 올렸다(경고) 내리는(근거) 일을 하지 않게 갈랐고, 「무엇을 근거로
 *    비교하는지」가 **비교를 설명한 뒤**에 오도록 근거를 상품 뒤로 내렸습니다.
 */
/*
 * 🔴 **두 섹션이 자리를 바꿨습니다** 〔2026-08-16 · docs/a3/trops_A3_최종구조_정리.md §2〕.
 *      상품소개(3탭 카드)  스토리 직후  →  안심문구 **뒤**
 *      HOW IT WORKS       안심문구 뒤  →  경고 **직후**
 *    A3 §2 가 정한 최종 순서(헤더→히어로→스토리→HOW→근거→안심→3탭카드→QnA→…)를 그대로
 *    옮긴 것이고, **문구는 한 글자도 바꾸지 않았습니다 — 이동만** 했습니다(A3 §2 명시).
 *
 *    왜 이 조합인가: 「무엇을 파는가」의 상세(3탭)는 한 줄기 서사(경고→HOW→근거→결→안심)가
 *    끝난 뒤 궁금해진 사람이 읽는 것입니다. 서사 한가운데 카탈로그가 있으면 감정선이 거기서
 *    끊깁니다. 상품 이름이 페이지 앞쪽에서 아주 사라지지 않도록 히어로에 미니 신호
 *    (A3 §3 · .hero-signal)를 같은 배치에서 신설해 세 탭으로 앵커를 걸었습니다.
 *
 * ⚠️ **배경 규칙은 한 줄도 고치지 않았습니다.** 두 섹션이 **서로** 자리를 바꾸면서 아래
 *    bg 열이 저절로 맞아떨어졌기 때문입니다. 둘 중 **하나만** 옮기면 그 자리에서 연속
 *    배경이 생기고, 그 아래 6개 섹션(HOW·로드맵·FAQ·마감CTA·폼·기관안내)의 배경을 전부
 *    뒤집어야 O7 이 다시 통과합니다. 한쪽만 되돌리지 마십시오.
 */
const LAYOUT = [
  { name: '히어로',        key: '<section class="container hero">',        bg: 'bg' },
  { name: '경험담(승)',    key: '<section class="stories-sec',             bg: 'surface' },
  { name: '경고(전)',      key: '<section class="trust"',                  bg: 'dark' },
  { name: 'HOW IT WORKS',  key: '<section class="how" id="how">',          bg: 'bg' },
  { name: '근거(전)',      key: '<section class="basis',                   bg: 'surface' },
  { name: '결 CTA',        key: '<section class="act"',                    bg: 'bg' },
  { name: '안심문구',      key: '<section class="assure',                  bg: 'surface' },
  { name: '상품소개',      key: '<section class="cards-sec" id="service"', bg: 'bg' },
  /* 🔄 **흐름도(§5-19)가 여기 새로 들어왔습니다** 〔2026-08-24〕. 상품 셋을 「따로」 보여
     준 직후 「그래서 서로 어떻게 이어지는가」에 답하는 자리입니다(PRD §5-19 배치).
     ⛔ **홀수 삽입이라 하류 8행의 bg 가 통째로 뒤집혔습니다.** 앞이 상품소개(bg)·뒤가
        진단 범위(surface)였으므로 그 사이에 들어갈 배경이 수학적으로 없습니다 —
        bg 면 앞과 연속, surface 면 뒤와 연속이고, 다크는 O9 가 막습니다. 그래서 흐름도를
        surface 로 두고 아래 여덟 행을 한 칸씩 밀었습니다. 문구는 하나도 바뀌지 않았고
        마크업에서도 sec-surface 클래스만 옮겼습니다.
        흐름도를 지우려면 아래 여덟 행도 함께 되돌리십시오. */
  { name: '흐름도',        key: '<section class="flowmap-sec',             bg: 'surface' },
  /* 🔄 **무료·유료(§5-13)가 여기 새로 들어왔습니다** 〔2026-08-23 · B3-a〕. 이 페이지는
     bg↔surface 완전 교차라 섹션 하나를 끼우면 하류가 통째로 뒤집힙니다 — 아래 다섯 행의
     bg 가 한 칸씩 밀린 것이 그 결과입니다. 문구는 하나도 바뀌지 않았고 sec-surface 만
     옮겼습니다. ⛔ 무료·유료만 지우지 마십시오. 지우려면 다섯 행도 함께 되돌려야 합니다. */
  /* 🔄 **진단 가능 범위 · 샘플이 여기 새로 들어왔습니다** 〔2026-08-23 · B3-b〕.
     B3-a 는 하나(무료·유료)를 끼워 하류 다섯 행을 통째로 뒤집어야 했지만, 이번에는
     **둘**입니다 — 짝수라서 아래 무료·유료부터 푸터까지 bg 가 **한 칸도 밀리지 않습니다**.
     ⛔ 둘 중 하나만 지우지 마십시오. 홀수가 되면 다시 하류 전체를 뒤집어야 합니다. */
  { name: '진단 가능 범위', key: '<section class="scope-sec',                bg: 'bg' },
  { name: '샘플',          key: '<section class="sample-sec',              bg: 'surface' },
  { name: '무료·유료',     key: '<section class="pricing-sec',             bg: 'bg' },
  { name: '로드맵',        key: 'id="next"',                               bg: 'surface' },
  { name: 'FAQ',           key: '<section class="qna',                     bg: 'bg' },
  { name: '마감CTA',       key: '<section class="close-cta',               bg: 'surface' },
  { name: '사전등록폼',    key: '<section class="interest',                bg: 'bg' },
  { name: '기관안내',      key: '<section class="orgs-sec',                bg: 'surface' },
  { name: '푸터',          key: '<footer class="footer">',                 bg: 'dark' },
];

/* ── O1 순서 ─────────────────────────────────────────────────────────────── */

test('O1 섹션 순서가 배치표와 정확히 일치한다', () => {
  const found = LAYOUT.map((s) => {
    const at = M.indexOf(s.key);
    assert.ok(at !== -1, s.name + ' 섹션을 찾지 못했습니다 (' + s.key + ')');
    return { name: s.name, at };
  });

  const sorted = found.slice().sort((a, b) => a.at - b.at).map((s) => s.name);
  assert.deepStrictEqual(sorted, LAYOUT.map((s) => s.name),
    '섹션 순서가 배치표와 다릅니다.\n  실제: ' + sorted.join(' → ') +
    '\n  정본: ' + LAYOUT.map((s) => s.name).join(' → '));
});

/*
 * 이 사이클이 고친 문제 그 자체입니다. 위 O1 이 이미 잡지만, 뒤집혔을 때
 * **무엇이 왜 잘못인지**를 실패 메시지로 남기려고 따로 둡니다.
 *
 * 🔄 **단언이 두 걸음이 됐습니다** 〔2026-08-14 · basis-split-s13〕. 종전에는
 *    「신뢰증명 < 상품소개」 하나였고, 그때 신뢰증명은 경고와 근거를 **함께** 지고
 *    있었습니다. 둘을 가르고 나니 두 블록이 상품을 사이에 두고 갈라 앉습니다.
 */
/*
 * 🔄 **가운데 한 칸이 상품소개에서 HOW 로 바뀌었습니다** 〔2026-08-16 · A3 §2〕.
 *    s13 이 세운 것은 「근거 h2 의 **「비교」가 가리킬 대상이 앞에 있어야 한다**」였고,
 *    그때 그 선행사는 상품 탭1 의 요약이었습니다. A3 §2 가 상품소개를 안심문구 뒤로
 *    내리면서 그 짝이 끊겼고, **바로 위로 올라온 HOW 02 가 같은 낱말을 이어받았습니다**:
 *        HOW 02   「공개된 서식과 항목별로 **비교**해서 다른 부분을 표시합니다.」
 *        근거 h2  「무엇을 근거로 **비교**하는지 밝힙니다.」
 *    한 섹션 건너가 아니라 **바로 앞 문장**이 선행사가 됐으므로 s13 이 지키려던 것은
 *    더 짧은 거리로 지켜집니다. 그래서 단언 대상만 갈아 끼우고 사유는 그대로 둡니다.
 */
test('O2 경고 → HOW → 근거 순이다 — 각성시킨 뒤 답을 주고, 그 답의 기준을 밝힌다', () => {
  const warn = M.indexOf('<section class="trust"');
  const how = M.indexOf('<section class="how" id="how">');
  const basis = M.indexOf('<section class="basis');
  const cards = M.indexOf('<section class="cards-sec" id="service"');
  assert.ok(warn !== -1 && how !== -1 && basis !== -1 && cards !== -1,
    '기준 섹션을 찾지 못했습니다');

  assert.ok(warn < how,
    '경고(무보 인용문)가 HOW 뒤에 있습니다 — 감정선(기-승-전-결)이 뒤집혀 「방법을 ' +
    '설명한 뒤 각성시킨다」가 됩니다. 그 각성 없이 읽는 방법 설명은 그냥 절차 안내입니다.');

  assert.ok(how < basis,
    '근거 섹션(「무엇을 근거로 비교하는지 밝힙니다」)이 HOW 보다 앞에 있습니다 — 그 h2 의 ' +
    '「비교」가 가리킬 대상이 아직 화면에 없습니다. 읽는 사람은 「무슨 비교?」를 안은 채 ' +
    '근거 3줄과 캡처를 지나게 됩니다. HOW 02 가 「공개된 서식과 항목별로 비교해서」라고 ' +
    '말한 **뒤**라야 이 h2 가 그 문장에 대한 대답이 됩니다.');

  assert.ok(basis < cards,
    '상품소개(3탭 카드)가 근거 섹션보다 앞에 있습니다 — A3 §2 는 3탭 카드를 안심문구 ' +
    '**뒤**에 둡니다. 서사(경고→HOW→근거→결→안심) 한가운데로 되돌리면 감정선이 ' +
    '카탈로그에서 끊깁니다.');
});

test('O2-b 경고 섹션은 한 문장짜리다 — 근거가 다시 붙지 않았다', () => {
  /*
   * 가른 이유는 두 블록이 심박을 **반대 방향**으로 움직이기 때문입니다. 인용문은 올리고
   * (「우리 얘기일 수 있다」), 근거는 내립니다(「함부로 판단하지 않는다」).
   * landing-emphasis-s10 이 그 어긋남을 헤어라인 + 큰 여백(.trust-detail)으로 한 번
   * 덮었고, **구획선으로 가려야 했다는 것 자체가** 두 블록이 한 섹션에 있으면 안 된다는
   * 신호였습니다. 그래서 이 검사는 「무엇이 없는가」를 봅니다.
   */
  const trust = M.slice(M.indexOf('<section class="trust"'));
  const block = trust.slice(0, trust.indexOf('</section>'));

  assert.ok(block.indexOf('trust-detail') === -1,
    '경고 섹션에 .trust-detail 구획이 돌아왔습니다 — 근거를 다시 안으로 들였다는 뜻입니다');
  assert.ok(!/<h[1-6]/.test(block),
    '경고 섹션에 제목이 생겼습니다 — 이 섹션의 제목은 05 근거가 가져갔고, 여기 이름은 ' +
    'aria-label 이 집니다. h2 를 만들면 같은 문장이 페이지에 두 번 있게 됩니다');
  assert.ok(!/<img/.test(block),
    '경고 섹션에 캡처가 돌아왔습니다 — 캡처는 05 근거의 것입니다');
  assert.ok(/aria-label="[^"]+"/.test(block.slice(0, block.indexOf('>') + 1)),
    '경고 섹션이 이름을 잃었습니다 — h2 가 없으므로 aria-label 이 유일한 이름입니다');

  // 본문은 인용문 한 문장 + 출처 한 줄, 딱 둘입니다.
  const ps = (block.match(/<p /g) || []).length;
  assert.strictEqual(ps, 2,
    '경고 섹션의 <p> 가 ' + ps + '개입니다 — 인용문과 출처 둘뿐인 것이 이 섹션의 설계입니다');
});

/* ── O3·O4 상품소개 중복 제거 ───────────────────────────────────────────── */

test('O3 상품소개 섹션이 하나뿐이다 — 옛 05 껍데기가 없다', () => {
  assert.ok(!/class="[^"]*\bfeats-sec\b/.test(M),
    '.feats-sec 섹션이 남아 있습니다 — 상품소개가 다시 두 섹션으로 갈렸습니다');
  assert.ok(B.indexOf('WHAT WE CHECK') === -1,
    '옛 05 의 kicker(WHAT WE CHECK)가 화면에 남아 있습니다');
  assert.strictEqual((M.match(/<section class="cards-sec/g) || []).length, 1,
    '상품소개 섹션이 2개 이상입니다');

  // 옛 2층카드 마크업이 되살아나지 않았는지 — 되살아나면 개요를 두 번 말하게 됩니다.
  for (const cls of ['class="cards"', 'class="card"', 'class="card-head"',
    'class="card-title"', 'class="card-body"', 'class="card-bullets"']) {
    assert.ok(M.indexOf(cls) === -1,
      '옛 2층카드 마크업(' + cls + ')이 남아 있습니다 — 상품 개요가 두 번 나옵니다');
  }
});

test('O4 세 상품이 각각 한 번씩만 소개된다', () => {
  const cards = M.slice(M.indexOf('<section class="cards-sec" id="service"'));
  const block = cards.slice(0, cards.indexOf('</section>'));

  // 🔄 카드 3장 → **탭 3개 + 패널 3개** 〔2026-08-14 · cards-tabs-s12〕.
  //    「한 상품 = 한 번」이라는 뜻은 그대로이고, 세는 그릇만 바뀌었습니다.
  const tabs = (block.match(/<button class="tab"/g) || []).length;
  assert.strictEqual(tabs, 3, '상품 탭이 ' + tabs + '개입니다 — 3분류(사전점검·바이어확인·기한관리)입니다');
  const panels = (block.match(/<div class="feat-panel" id="/g) || []).length;
  assert.strictEqual(panels, 3, '상품 패널이 ' + panels + '개입니다');

  // 각 상품이 카드 머리에서 한 번만 이름 불린다.
  const titles = (block.match(/<span class="feat-title">([^<]*)<\/span>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').trim());
  /* 🔄 2026-08-23 〔PRD v2.1 B2〕 상품 3종이 확정 명칭으로 바뀌었습니다:
     수출 사전점검 · 수출 계약관리 · 수출 채권·보험관리. 종전 2번 상품은 랜딩에서
     빠졌고(PRD §8-1 결정 3), 3번은 이름만 바뀌었습니다(id 는 `feat-timeline` 유지 —
     나간 메일이 그 앵커로 들어옵니다). */
  assert.deepStrictEqual(titles, ['수출 사전점검', '수출 계약관리', '수출 채권·보험관리'],
    '상품 카드 제목이 용어 정본과 다릅니다: ' + JSON.stringify(titles));

  // 한 상품 안에서 개요(.feat-sum)와 상세(.feat-desc)가 층을 나눠 갖는가.
  // 🔄 요약은 카드 머리에서 **패널 안**으로 내려왔습니다(탭 라벨은 이름만 답니다).
  //    층 자체는 그대로입니다 — 그것을 O4-a 가 봅니다.
  assert.strictEqual((block.match(/class="feat-sum"/g) || []).length, 3,
    '한 줄 요약이 3개가 아닙니다 — 상품마다 개요 한 줄을 갖습니다');
});

test('O4-a 한 카드 안에서 머리와 패널이 같은 말을 하지 않는다', () => {
  /*
   * 두 섹션의 중복을 없애면서 한 카드 안에서 같은 중복을 남기면 아무것도 고치지 않은
   * 것입니다. 실제로 첫 구현에서 세 카드 모두 .feat-sum 의 문장이 .feat-desc 첫 문장으로
   * 그대로 반복됐습니다(2026-08-14 스크린샷 실측으로 발견).
   *
   * 층을 이렇게 나눕니다:
   *   카드 머리(.feat-sum)  — 무엇을 하는가
   *   패널(.feat-desc)      — 어디까지 · 무엇을 더
   */
  const cards = M.slice(M.indexOf('<section class="cards-sec" id="service"'));
  const block = cards.slice(0, cards.indexOf('</section>'));

  /** 문장 단위로 쪼갠 뒤 공백·기호를 지운 비교키. */
  const keys = (s) => (s || '').split(/(?<=\.)\s+/)
    .map((x) => x.replace(/[\s·,.]/g, ''))
    .filter((x) => x.length > 12);

  for (const id of ['feat-precheck', 'feat-contract', 'feat-timeline']) {
    // 🔄 카드 <div> → 탭 패널 〔2026-08-14 · cards-tabs-s12〕. 요약도 <span> 에서 <p> 로
    //    바뀌었습니다(버튼 밖으로 나왔으므로 문단을 쓸 수 있습니다). 층 검사는 그대로입니다.
    const at = block.indexOf('<div class="feat-panel" id="' + id + '-panel"');
    assert.ok(at !== -1, id + ' 패널을 찾지 못했습니다');
    const next = block.indexOf('<div class="feat-panel" id=', at + 10);
    const card = block.slice(at, next === -1 ? undefined : next);

    /* 🔄 `[^<]*` → `[\s\S]*?` + 태그 제거 〔2026-08-23 · B2〕. PRD §5-3 의 요약은 두 줄로
       확정돼 있어 <br> 가 들어갑니다 — 종전 정규식은 안쪽에 태그가 하나라도 있으면
       매칭에 실패해 「요약이 없다」고 잘못 말했습니다. 층 검사 자체는 그대로입니다. */
    const inner = (re) => {
      const m = card.match(re);
      return m ? m[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : undefined;
    };
    const sum = inner(/<p class="feat-sum">([\s\S]*?)<\/p>/);
    const desc = inner(/<p class="feat-desc">([\s\S]*?)<\/p>/);
    assert.ok(sum && desc, id + ' 에 요약이나 설명이 없습니다');

    const shared = keys(sum).filter((k) => keys(desc).includes(k));
    assert.deepStrictEqual(shared, [],
      id + ' 의 카드 머리와 패널이 같은 문장을 씁니다 — 한 카드 안에서 상품 설명이 두 번 나옵니다:\n' +
      '  ' + JSON.stringify(shared));
  }
});

test('O4-b 같은 스크린샷이 한 화면 거리에 두 번 나오지 않는다', () => {
  /*
   * 재배치로 신뢰증명과 상품소개가 이웃이 됐는데, 두 섹션이 같은 캡처 파일을 쓰고
   * 있어서 한 화면 거리에 같은 그림이 두 번 났습니다. 「중복 제거」 배치에서 그것을
   * 남기면 배치가 자기모순이라, 두 컷을 역할로 갈랐습니다:
   *   c03-result.jpg        → 신뢰증명. 「무엇을 근거로 비교하는가」 = 대조의 근거
   *   c03-result-detail.jpg → 사전점검 카드. 「무엇을 받는가」 = 대조의 결과물
   *
   * 🔄 **범위를 「기본 노출 이미지」로 좁혔습니다** 〔2026-08-14 · card-shot-reveal-s11〕.
   *
   * 이 검사가 지키려던 것은 문면 그대로의 「파일이 두 번 쓰이지 않는다」가 아니라
   * **「한 화면 거리에 같은 그림이 두 번 나지 않는다」**였습니다(위 문단이 그렇게
   * 적혀 있습니다). 접힌 아코디언 패널 안의 이미지는 **클릭해야 보이므로** 그 거리에
   * 놓이지 않습니다 — 열려면 이미 신뢰증명을 지나 상품 카드까지 내려온 뒤입니다.
   *
   * 좁힌 계기: 바이어확인 카드에 결과화면 캡처가 필요한데, 전용 화면
   * (trops_a 화면 C-06 `/c/[token]/buyer`)은 **유효한 접수 토큰이 있어야 열려서**
   * 지금 캡처를 뜰 수 없습니다. 그 카드가 주장하는 것이 「사전점검 결과화면 **안에서**
   * 진행된다」이므로, 뒷받침할 그림은 정확히 그 결과화면(c03-result.jpg)입니다.
   *
   * ⚠️ 예외는 **접힌 패널 안**이라는 조건에만 걸립니다. 기본 노출 자리(히어로·신뢰증명·
   *    로드맵 등)에서는 종전과 똑같이 중복이 금지입니다 — 아래가 그것을 봅니다.
   * ⏭️ C-06 전용 캡처를 받으면 바이어확인 카드를 그것으로 갈고 이 예외는 저절로
   *    필요 없어집니다(중복이 사라지므로 아래 검사는 손대지 않아도 통과합니다).
   */
  const imgs = (B.match(/<img[^>]*>/g) || []);
  const srcOf = (t) => (t.match(/src="([^"]*)"/) || [])[1];

  // ① 기본 노출 이미지 — 접힌 패널(.feat-panel) 밖에 있는 것들. 여기는 중복 0 입니다.
  /*
   * 🔄 **「접힌 패널」이 「선택되지 않은 탭 패널」이 됐습니다** 〔2026-08-14 · cards-tabs-s12〕.
   *    구조가 바뀌었을 뿐 사유는 같습니다 — 클릭해야 보이는 자리는 03 신뢰의 그림과
   *    한 화면에 함께 놓이지 않습니다. 이제는 [hidden] 이라 판정이 더 분명합니다.
   */
  const panels = (B.match(/<div class="feat-panel"[^>]*\shidden[^>]*>[\s\S]*?<\/figure>/g) || []).join('');
  const exposed = imgs.filter((t) => panels.indexOf(t) === -1).map(srcOf);
  const dup = exposed.filter((s, i) => exposed.indexOf(s) !== i);
  assert.deepStrictEqual(dup, [],
    '같은 이미지가 **기본 노출 상태에서** 두 번 이상 나옵니다: ' + JSON.stringify(dup) +
    '\n  접히지 않은 자리끼리는 한 화면 거리에 함께 놓일 수 있으므로 예외가 없습니다.');

  // ② 접힌 패널 안의 재등장은 허용하되, **아무거나 허용하지는 않습니다.**
  //    허용 목록을 명시해 두면 다음 사람이 「중복이 원래 되는구나」로 읽지 않습니다.
  /*
   * ✅ **목록이 비었습니다** 〔2026-08-14 · basis-split-s13〕. s11 이 예외를 연 이유는
   *    바이어확인 전용 캡처를 뜰 수 없었기 때문이고(위 문단), 그 미결이 닫혔습니다 —
   *    `/deals/[id]/buyer-guard`(A-2)는 접수 토큰 없이 열려서 찍을 수 있었습니다.
   *    지금 네 캡처는 전부 서로 다른 파일입니다.
   * ⚠️ 여기에 다시 파일을 올리기 전에 **정말 그 캡처를 못 찍는지** 확인하십시오.
   *    한 번 열린 예외는 다음 사람에게 「원래 되는 것」으로 읽힙니다.
   */
  const ALLOWED_REUSE = [];
  const inPanel = imgs.filter((t) => panels.indexOf(t) !== -1).map(srcOf);
  const reused = inPanel.filter((s) => exposed.indexOf(s) !== -1 || inPanel.indexOf(s) !== inPanel.lastIndexOf(s));
  for (const s of reused) {
    assert.ok(ALLOWED_REUSE.indexOf(s) !== -1,
      '접힌 패널이 다른 자리의 캡처(' + s + ')를 재사용합니다 — 허용 목록에 없습니다.\n' +
      '  재사용이 의도라면 ALLOWED_REUSE 에 사유와 함께 올리십시오. 목록 없이 늘리면 ' +
      '「중복 제거」 배치가 조용히 되돌아갑니다.');
  }
});

/* ── O5~O7 배경 교차 ─────────────────────────────────────────────────────── */

/** #RRGGBB → CIE L* (0~100). */
function lstar(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return y > 0.008856 ? 116 * Math.pow(y, 1 / 3) - 16 : 903.3 * y;
}
/** :root 에 선언된 토큰 값. */
function token(name) {
  const m = CSS.match(new RegExp('--' + name + ':\\s*(#[0-9A-Fa-f]{6})'));
  assert.ok(m, '--' + name + ' 토큰을 찾지 못했습니다');
  return m[1];
}

test('O5 --surface 와 --bg 의 명도차가 눈에 보이는 수준이다', () => {
  /*
   * 옛값 #F1F5F9 는 ΔL* 3.65 였고 「교차가 안 느껴진다」는 것이 이 사이클의 문제 4번
   * 이었습니다. 그 앞의 #F8FAFC(1.82)도 같은 이유로 한 번 기각된 적이 있습니다.
   * 5.5 는 그 두 값을 확실히 넘기는 하한선입니다.
   * ⚠️ 상한도 함께 봅니다 — 시각사양서가 「너무 진하면 얼룩져 보인다」고 경고했고,
   *    slate-200(#E2E8F0 · 8.24)이 그 경고 구간의 시작입니다.
   */
  const d = lstar(token('bg')) - lstar(token('surface'));
  assert.ok(d >= 5.5,
    '--surface 명도차가 ' + d.toFixed(2) + ' 입니다 — 5.5 미만이면 섹션 교차가 안 보입니다');
  assert.ok(d <= 8.3,
    '--surface 명도차가 ' + d.toFixed(2) + ' 입니다 — 너무 진하면 큰 면이 얼룩져 보입니다');
});

test('O5-b --surface 위 구획선이 --bg 위와 같은 무게다', () => {
  /*
   * --surface 를 진하게 내린 대가로 --line(#E2E8F0)이 그 위에서 사라집니다(Δ1.38).
   * .sec-surface 가 --line 을 --line-on-surface 로 갈아 끼우는 것이 그 대응이고,
   * 두 배경에서 선의 대비가 비슷해야 페이지 전체의 선 굵기가 같게 읽힙니다.
   */
  const onBg = lstar(token('bg')) - lstar(token('line'));
  const onSurface = lstar(token('surface')) - lstar(token('line-on-surface'));
  assert.ok(onSurface >= onBg * 0.8,
    '--surface 위 구획선 대비(' + onSurface.toFixed(2) + ')가 --bg 위(' + onBg.toFixed(2) +
    ')보다 크게 약합니다 — 그 섹션에서만 선이 사라집니다');

  assert.ok(/\.sec-surface\s*\{[^}]*--line:\s*var\(--line-on-surface\)/.test(CSS),
    '.sec-surface 가 --line 을 갈아 끼우지 않습니다 — 규칙마다 손으로 적는 방식은 빠집니다');
});

test('O6 --surface 섹션은 전부 .sec-surface 로 칠한다', () => {
  // 배경을 규칙에 직접 적으면 위 --line 교체가 함께 걸리지 않습니다.
  const direct = (CSS.match(/^\s*\.[\w-]+[^{]*\{[^}]*background:\s*var\(--surface\)[^}]*\}/gm) || [])
    .filter((r) => !/^\s*\.sec-surface/.test(r))
    // 배경이 아니라 「면」으로 쓰는 것들 — 카드·자리표시·hover 표식은 교차와 무관합니다.
    .filter((r) => !/\.feat-shot|\.feat-map|\.feat-avail|\.badge-soon|:hover/.test(r));
  assert.deepStrictEqual(direct, [],
    '섹션 배경을 .sec-surface 없이 직접 칠한 규칙이 있습니다:\n' + direct.join('\n'));

  for (const s of LAYOUT.filter((x) => x.bg === 'surface')) {
    const at = M.indexOf(s.key);
    // key 가 태그 중간(예: id="next")을 가리킬 수 있으므로 여는 태그 시작으로 되돌아갑니다.
    const open = M.lastIndexOf('<section', at);
    const tag = M.slice(open, M.indexOf('>', open));
    assert.ok(/\bsec-surface\b/.test(tag),
      s.name + ' 섹션에 .sec-surface 가 없습니다 — 배경도 구획선도 따라오지 않습니다');
  }
});

test('O7 배경이 연속인 이웃이 하나도 없다 — 페이지가 완전 교차다', () => {
  /*
   * 🔄 **연속 쌍이 1 → 0 이 됐습니다** 〔2026-08-14 · basis-split-s13〕.
   *    종전의 유일한 연속은 「상품소개 → 결 CTA」(둘 다 --bg)였고, 사유는 흐름 md §1 의
   *    「감정선과 무관한 기능섹션 없이 곧바로 행동으로 이어지도록」이었습니다.
   *    그 사이에 05 근거가 들어왔는데, 근거는 **기능섹션이 아니라 「전」의 마지막 조각**
   *    이므로 md 의 요구는 그대로 지켜집니다. 남은 선택은 배경뿐이었고 —
   *      --bg      → bg·bg·bg 3연속. 경계가 두 곳 사라집니다
   *      --surface → bg·surface·bg. 페이지 전체가 완전 교차가 됩니다   ← 이것을 골랐습니다
   * ⚠️ 다시 연속을 만들지 마십시오. 「여기만 예외」가 한 번 생기면 다음 섹션도 같은
   *    이유로 예외를 요구합니다.
   */
  const pairs = [];
  for (let i = 1; i < LAYOUT.length; i++) {
    if (LAYOUT[i].bg === LAYOUT[i - 1].bg) pairs.push(LAYOUT[i - 1].name + ' → ' + LAYOUT[i].name);
  }
  assert.deepStrictEqual(pairs, [],
    '배경이 같은 이웃이 배치표에 있습니다: ' + JSON.stringify(pairs) + '\n' +
    '  지금 페이지는 완전 교차입니다 — 연속을 만들려면 그 사유부터 여기 적으십시오.');

  // 배경이 갈리는데 선까지 그으면 경계가 두 겹이 됩니다.
  assert.ok(!/^\s*\.act\s*\{[^}]*border-top/m.test(CSS),
    '.act 에 border-top 이 붙었습니다 — 위가 --surface 라 경계가 이미 있습니다');
});

test('O9 다크 본문 섹션은 페이지에 하나뿐이다', () => {
  const dark = (CSS.match(/background:\s*var\(--surface-dark\)/g) || []).length;
  // 03 경고 · 푸터 두 곳입니다. (2026-08-14 까지 세 곳이었습니다 — .shot 이 다크 배경을
  //  이미지 뒤에 깔고 있었고, 그 규칙은 근거 블록이 밝은 섹션으로 나가면서 사라졌습니다.)
  assert.ok(dark <= 3, '--surface-dark 를 쓰는 규칙이 ' + dark + '개입니다 — 다크는 경고·푸터뿐입니다');
  assert.strictEqual((M.match(/<section class="trust"/g) || []).length, 1,
    '다크 본문 섹션이 하나가 아닙니다');
});

/* ── O8 앵커 ─────────────────────────────────────────────────────────────── */

test('O8 헤더 앵커 3종의 도착지가 살아 있다', () => {
  const nav = M.slice(M.indexOf('<nav class="nav">'), M.indexOf('</nav>'));
  const hrefs = (nav.match(/href="#([\w-]+)"/g) || []).map((s) => s.match(/#([\w-]+)/)[1]);
  assert.deepStrictEqual(hrefs, ['service', 'how', 'qna'],
    '헤더 앵커가 서비스·이용 방법·자주 묻는 질문 3종이 아닙니다: ' + JSON.stringify(hrefs));

  for (const id of hrefs) {
    assert.ok(M.indexOf('id="' + id + '"') !== -1, '앵커 #' + id + ' 의 도착지가 없습니다');
  }

  // 「서비스」와 「이용 방법」이 같은 곳으로 가면 앵커 하나가 죽은 것과 같습니다.
  assert.notStrictEqual(M.indexOf('id="service"'), M.indexOf('id="how"'),
    '두 앵커의 도착지가 같습니다');
});

test('O8-b 섹션을 옮겨도 밖에서 들어오는 앵커가 살아 있다', () => {
  /*
   * 🔴 **신설** 〔2026-08-14 · basis-split-s13〕. 이 저장소가 실제로 한 번 다친 실패입니다 —
   *    이미 발송된 결제확인 메일이 `https://www.trops.kr/#feat-timeline` 을 싣고 있어서,
   *    상품소개 안의 그 id 가 사라지거나 [hidden] 요소로 옮겨 가면 **링크는 살아 있는데
   *    화면은 아무 데도 가지 않습니다.** 화면이 깨지지 않아 가장 늦게 발견되는 실패입니다.
   *
   * 섹션을 통째로 옮기는 배치에서는 id 가 함께 따라가므로 깨지지 않아야 정상입니다.
   * 그 「정상」을 사람의 기억이 아니라 검사가 지킵니다.
   * ⚠️ 아래 목록은 **index.html 밖에서 들어오는 것**만입니다. 안에서 자기 페이지로 거는
   *    링크는 O8 이 봅니다. 새 유입 링크를 만들면 여기 한 줄을 더하십시오.
   */
  // 🔴 precheck.html 헤더의 「진행 방식」(#how)·「제공되는 것」(#service) 링크는
  // 대표 지시(2026-08-16)로 삭제됐습니다 — 그 출처가 없어져 아래 목록에서 뺐습니다.
  // #how·#service 자체는 index.html 자기 nav 가 여전히 쓰므로 O8 이 별도로 봅니다.
  const INBOUND = [
    ['#feat-timeline', '발송된 결제확인 메일(api/_notify.js buildTimelinePreviewLink)'],
    ['#interest', 'precheck.html 하단 「다음 회차 알림 받기」 · 헤더 [문의하기]'],
    ['#feats', '옛 05 섹션에 걸려 있을 수 있는 과거·외부 링크'],
  ];

  for (const [hash, from] of INBOUND) {
    const id = hash.slice(1);
    const at = M.indexOf('id="' + id + '"');
    assert.notStrictEqual(at, -1,
      '앵커 ' + hash + ' 의 도착지가 없습니다 — 출처: ' + from);

    /*
     * 도착지가 **항상 보이는 요소**여야 합니다. [hidden] 요소는 앵커 목표가 되지 못하고,
     * 브라우저는 조용히 페이지 맨 위에 떨어뜨립니다. 여는 태그 안에 hidden 이 있는지만
     * 봅니다 — 조상까지 볼 필요는 없습니다(탭 패널 3개가 유일한 hidden 이고 서로 형제).
     */
    const open = M.slice(M.lastIndexOf('<', at), M.indexOf('>', at) + 1);
    assert.ok(!/\shidden[\s>]/.test(open),
      '앵커 ' + hash + ' 가 [hidden] 요소를 가리킵니다 — 링크는 살아 있는데 화면은 ' +
      '아무 데도 가지 않습니다. 출처: ' + from + '\n  태그: ' + open);
  }

  // 기한관리 앵커는 **탭 버튼**에 있어야 합니다(패널은 선택 전까지 [hidden]).
  const tl = M.slice(M.lastIndexOf('<', M.indexOf('id="feat-timeline"')));
  assert.ok(/^<button[^>]*role="tab"/.test(tl),
    '#feat-timeline 이 탭 버튼이 아닌 요소로 옮겨 갔습니다 — 패널로 옮기면 [hidden] 이라 ' +
    '메일 링크가 죽습니다');
});

/* ── 무손실 ──────────────────────────────────────────────────────────────── */

/* 🔄 v-next 전면교체(2026-08-16)로 리스트를 새 원고 문구로 갱신했습니다. 스토리
   비교카드의 예시 고지·근거 5종 bullet 등, 이번 교체로 실제로 삭제된 항목은
   리스트에서 뺐습니다(승인된 삭제 — 위 index.html 해당 섹션 주석 참조). */
test('재배치로 콘텐츠가 사라지지 않았다 — 각 블록이 한 번씩 있다', () => {
  const MUST = [
    // 🔄 §5-1 로 교체 〔2026-08-23 · B3-b〕. 종전 「놓치면 안 되는 것부터 확인하세요.」는
    //    문서 대조가 상품의 전부였던 때의 헤드라인입니다.
    ['히어로 헤드라인', '사전 점검 리포트로 기준을 세우세요.'],
    // 🔄 §5-15 로 교체 〔2026-08-23 · B3-a〕.
    ['스토리 여는 문장', '수출은 계약서에 서명한 뒤부터'],
    ['스토리 닫는 문장', '오늘 처리하실 실무와 다가오는 기한을'],
    ['경고 인용', '위조서류로 접근하는 수출사기가 계속 발생하고 있어'],
    ['경고 출처', '한국무역보험공사'],
    // 🔄 §5-12 로 교체 〔2026-08-23 · B3-a〕. 마지막 줄은 사용자 지정 필수 문장입니다.
    ['근거 h2', '모든 점검 정보에는 근거 규정과 확인 기준일을 함께 표기합니다'],
    ['근거 맺음', '확인 기준일이 없는 항목은 화면에 표시하지 않습니다.'],
    ['무료·유료 h2', '확인은 무료, 발급은 유료입니다.'],
    ['WHAT\'S NEXT h2', '수출 업무 전 과정을 더 촘촘하게 연결해 나갑니다'],
    ['비교 기준(영국 OGL)', 'Open Government Licence v3.0'],
    ['상품소개 h2', '거래 전부터 거래 후까지, 놓치기 쉬운 것을 확인합니다.'],
    ['조작 안내', '거래 단계에 따라 확인할 수 있습니다'],
    // 🔄 §5-16 로 교체 〔2026-08-23 · B3-a〕.
    ['중간 CTA h2', '지금 검토 중이신 수출 건부터 등록해 보세요.'],
    ['안심 선언', '지금 놓치기 쉬운 것이 무엇인지, 30초 만에 확인해보세요.'],
    ['법적 고지', '법률 자문 서비스가 아닙니다'],
    // 🔄 §5-4 로 교체 〔2026-08-23 · B3-b〕.
    ['HOW h2', '품목과 국가를 입력하시면,'],
    // 🔄 §5-6 · §5-11 신설 〔2026-08-23 · B3-b〕.
    ['진단 가능 범위 h2', '계약 전 단계라면, 수출 사전점검부터 시작하세요'],
    ['샘플 h2', '받아보시는 리포트는 이렇게 구성됩니다'],
    ['샘플 고지', '가상의 기업 정보로 구성한 예시 문서입니다'],
    // 🔄 §5-5 로 교체 〔2026-08-23 · B3-b〕. B3-a 가 「탭① 문구는 B3-b 영역」으로
    //    남겨 둔 자리입니다.
    ['상품 ① 확정 문구', '이 품목을 이 국가로 수출할 때'],
    // 🔄 2026-08-23 〔B2〕 세 줄을 뺐습니다 — 전부 교체된 상품 ②③ 의 문면이고,
    //    PRD §5-2·§5-3 이 그 자리를 새 원고로 덮었습니다. 새 원고의 존재는
    //    scripts/check-b2-gates.js 와 아래 상품명 검사가 지킵니다.
    ['상품 ② 확정 문구', '계약서를 드라이브에 보관하는 것만으로는 부족합니다.'],
    ['상품 ③ 확정 문구', '가입하신 보험 상품을 등록하시면 약관이 정한 기한이 항목으로 정리됩니다.'],
  ];
  for (const [name, s] of MUST) {
    assert.ok(BT.indexOf(s) !== -1, name + ' 이(가) 페이지에서 사라졌습니다: 「' + s + '」');
  }

  // 🔴 KOTRA 신뢰신호 문구는 대표 수정안 3차(2026-08-16)로 완전히 삭제됐습니다 —
  //    반드시 없어야 합니다. 11 기관안내의 "KOTRA 해외무역관"은 별개 항목이라 제외합니다.
  assert.strictEqual((B.match(/KOTRA 멘토 네트워크/g) || []).length, 0, 'KOTRA 신뢰신호 문구가 아직 남아 있습니다');

  // 한 번만 나와야 하는 것들 — 재배치 중 복사가 남으면 여기서 걸립니다.
  for (const s of ['지금 놓치기 쉬운 것이 무엇인지, 30초 만에 확인해보세요.',
    '거래 전부터 거래 후까지, 놓치기 쉬운 것을 확인합니다.']) {
    const n = (B.match(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    assert.strictEqual(n, 1, '「' + s + '」이 ' + n + '번 나옵니다 (1번이어야 합니다)');
  }
});

test('인터랙션이 그대로다 — 탭 3개·FAQ·트리거·스크롤 등장', () => {
  // 🔄 아코디언 펼침 버튼 3개 → **탭 3개** 〔2026-08-14 · cards-tabs-s12〕.
  assert.strictEqual((M.match(/<button class="tab"/g) || []).length, 3, '상품 탭이 3개가 아닙니다');
  assert.strictEqual((M.match(/class="feat-panel"/g) || []).length, 3, '상품 패널이 3개가 아닙니다');
  // 🔄 14 → 10 〔2026-08-16 · A3 §4〕. 사유는 index.html QnA 섹션 머리주석 참조.
  assert.strictEqual((M.match(/aria-controls="qa-\d+"/g) || []).length, 15, 'FAQ 문항이 15개가 아닙니다');
  // 🔄 3 → 2 → 1 〔2026-08-16 · v-next 전면교체 + 대표 수정안 3차〕. 히어로 CTA 3→2 로
  //    히어로 트리거가, 이어서 마감 CTA 의 [기한관리 미리보기] 버튼 삭제로 그 트리거도
  //    빠졌습니다. 로드맵 한 곳만 남습니다.
  /* 🔄 1 → 0 〔2026-08-23 · B3-a〕. §5-14 에는 미리보기 훅·버튼이 없어 로드맵의 마지막
     트리거가 빠졌습니다. 패널은 탭으로 그대로 열리고, JS 는
     `if (!openers.length) return` 로 이미 막혀 있어 안전합니다.
     ⛔ 트리거를 되살리려면 §5-14 부터 고쳐야 합니다. */
  assert.strictEqual((B.match(/data-timeline-open/g) || []).length, 0,
    '기한관리 원격 트리거가 남아 있습니다 — §5-14 에는 없습니다');
  // 클래스 문자열 전체가 아니라 「stat-line 에 reveal 이 붙어 있는가」를 봅니다 —
  // 사유는 test/landing-flow-s9.test.js 의 같은 검사에 적어 두었습니다 (2026-08-14).
  assert.ok(/class="[^"]*\bstat-line\b[^"]*\breveal\b[^"]*"/.test(M),
    '신뢰 인용의 스크롤 등장이 사라졌습니다');
  assert.ok(/id="interest-form"/.test(M), '사전등록 폼이 사라졌습니다');
  assert.ok(/id="intake-return"/.test(M), '접수 완료 배너가 사라졌습니다');
});
