/*
 * 명칭·상태배지·정보정합 테스트 〔naming-consistency-s9 · 신설 2026-08-13〕
 *
 *   npm test        (node --test test/)
 *
 * 왜 있는가: 이 저장소는 같은 상품을 세 자리(04 2층카드 · 05 WHAT WE CHECK · 로드맵)에서
 * 말합니다. 한 곳만 고치는 일이 반복돼 「NDA 비교 / 문서 대조」, 「거래 절차 트래킹 /
 * 기한 관리」처럼 한 페이지가 같은 것을 두 이름으로 부르는 상태가 됐습니다.
 * 이 파일은 그 용어표(docs/02-design/features/naming-consistency-s9.design.md §1)를
 * 코드로 고정합니다.
 *
 * ⚠️ 모든 검사는 **주석을 걷어낸 마크업**에 대해 합니다. 이 저장소는 주석을 인수인계
 *    수단으로 쓰고(빌드가 떼어냅니다), 그 주석에 「…로 되돌리지 마십시오」 형태로 옛
 *    문자열을 인용하므로 그대로 두면 전부 오탐이 됩니다.
 *    (test/landing-flow-s9.test.js 가 같은 이유로 같은 처리를 합니다.)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** 주석 없는 마크업. 위 ⚠️ 참조. */
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
/** 사람 눈에 보이는 본문만 — <style>·<script> 안의 주석까지 걷어냅니다. */
const body = (s) =>
  strip(s)
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');

const RAW = {
  index: read('index.html'),
  en: read('en.html'),
  precheck: read('precheck.html'),
};
const M = {
  index: strip(RAW.index),
  en: strip(RAW.en),
  precheck: strip(RAW.precheck),
};
const B = {
  index: body(RAW.index),
  en: body(RAW.en),
  precheck: body(RAW.precheck),
};

/** 한 섹션 블록을 잘라냅니다. */
function section(markup, className) {
  const start = markup.indexOf('<section class="' + className);
  assert.ok(start !== -1, className + ' 섹션을 찾지 못했습니다');
  const end = markup.indexOf('</section>', start);
  return markup.slice(start, end);
}

/* ══ 0. 최우선 제약 — 무료 접수 경로 ═══════════════════════════════════════
 *
 * 유상 과금이 법적 게이트로 닫혀 있어 **현재 동작하는 유일한 접수 경로**입니다.
 * 이 묶음이 깨지면 서비스가 완전히 멈춥니다. 어떤 개편도 여기를 건드리지 않습니다.
 */

test('무료 접수 경로가 살아 있다 — 라디오·기본선택·선착순 표기', () => {
  const m = M.precheck;

  assert.ok(
    /<input type="radio" name="plan" value="free" id="plan-free" checked>/.test(m),
    '무료 플랜 라디오가 없거나 기본 checked 가 아닙니다 — 접수가 통째로 멈춥니다'
  );
  assert.ok(m.indexOf('id="plan-free-card"') !== -1, '무료 플랜 카드 id 가 없습니다');
  assert.ok(m.indexOf('id="plan-free-tag"') !== -1, 'JS 가 마감 문구를 쓸 태그 id 가 없습니다');
  assert.ok(m.indexOf('id="plan-free-desc"') !== -1, 'JS 가 마감 문구를 쓸 설명 id 가 없습니다');
  assert.ok(B.precheck.indexOf('선착순 20건') !== -1, '선착순 표기가 사라졌습니다');
  assert.ok(B.precheck.indexOf('₩0') !== -1, '무료 가격 표기가 사라졌습니다');
});

test('무료 경로를 읽는 JS 가 그대로다', () => {
  const js = RAW.precheck;
  assert.ok(js.indexOf("getElementById('plan-free')") !== -1, 'freeRadio 참조가 없습니다');
  assert.ok(/paidRadio\.checked \? 'paid' : 'free'/.test(js),
    'plan 값 판정이 바뀌었습니다 — 무료 경로가 paid 로 새어 나갈 수 있습니다');
  assert.ok(js.indexOf('if (freeAvailable) freeRadio.checked = true;') !== -1,
    '자리 확인 후 무료로 되돌리는 코드가 없습니다');
});

/* ══ 1. 상태 배지 — 생애주기만 ══════════════════════════════════════════════
 *
 * 05 WHAT WE CHECK 세 카드의 .feat-meta 는 「거래 시작 전/후」만 말합니다.
 * 개발상태(준비 중)도 가격(지금은 무료)도 이 자리에 넣지 않습니다 — 축이 하나여야
 * 세 배지를 나란히 읽을 수 있습니다.
 */

test('05 배지 3개가 생애주기만 말한다', () => {
  const metas = (M.index.match(/<span class="feat-meta">([^<]*)<\/span>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').trim());

  assert.deepStrictEqual(metas, ['거래 시작 전', '거래 시작 전', '거래 시작 후'],
    '배지에 생애주기 아닌 값이 섞였습니다: ' + JSON.stringify(metas));
});

test('바이어확인 카드에 「준비 중」이 없다 — 라우트가 이미 돈다', () => {
  const start = M.index.indexOf('id="feat-buyer"');
  const block = M.index.slice(start, M.index.indexOf('<div class="feat" id=', start + 10));
  assert.ok(!/준비\s*중/.test(block),
    '「준비 중」이 남아 있습니다 — 같은 카드가 「바로 확인하실 수 있습니다」라고도 말합니다');
});

test('기한관리 「지금은 무료」가 배지에서 빠지고 본문에 남았다', () => {
  const start = M.index.indexOf('id="feat-timeline"');
  const block = M.index.slice(start, M.index.indexOf('</section>', start));

  assert.ok(!/<span class="feat-meta">[^<]*무료/.test(block), '배지에 가격이 남아 있습니다');
  // 흐름 md §4 Give/Get 은 「무료임을 밝히되 유료화 여지를 남기는 문구로」를 요구합니다.
  // 배지에서 뺀 것이지 정책을 지운 것이 아니므로 본문에는 반드시 남아 있어야 합니다.
  assert.ok(/class="feat-desc"[^>]*>[^<]*지금은 무료/.test(block),
    '본문에서도 「지금은 무료」가 사라졌습니다 — 흐름 md §4 요구가 깨집니다');
});

/* ══ 2. 04 2층카드 ↔ 05 아코디언 명칭 통일 ══════════════════════════════════ */

/*
 * 🔄 **상품명이 「문서 대조」→「수출 사전점검」으로 바뀌었습니다**
 *    〔2026-08-13 · 흐름 md §1 「상위 카테고리명은 '수출 사전점검'으로 통일」〕.
 *
 * 「문서 대조」는 **하는 일**의 서술이었고 상품명이 아니었습니다. 그래서 같은 상품이
 * 세 이름으로 불렸습니다 — 랜딩은 「문서 대조」, /precheck 는 「바이어 서류 사전 확인」,
 * 흐름 md 는 「수출 사전점검」. 이 사이클이 셋을 하나로 모았습니다.
 *
 * ⛔ 폐기 문자열을 되살리지 마십시오: 문서 대조 · 바이어 서류 사전 확인 ·
 *    Document comparison · Buyer document pre-check.
 */
const RETIRED_KO = ['문서 대조', '바이어 서류 사전 확인'];
const RETIRED_EN = ['Document comparison', 'Buyer document pre-check'];

test('04 카드가 05 와 같은 이름을 쓴다', () => {
  const cards = section(M.index, 'cards-sec');

  assert.ok(cards.indexOf('거래 시작 전 · 수출 사전점검') !== -1,
    '01 카드가 「수출 사전점검」이 아닙니다 (구 「문서 대조」 · 구구 「NDA 비교」)');
  assert.ok(cards.indexOf('거래 시작 후 · 기한 관리') !== -1,
    '02 카드가 「기한 관리」가 아닙니다 (구 「거래 절차 트래킹」)');
  assert.ok(cards.indexOf('NDA 비교') === -1, '옛 이름 「NDA 비교」가 남아 있습니다');
  assert.ok(cards.indexOf('거래 절차 트래킹') === -1, '옛 이름 「거래 절차 트래킹」이 남아 있습니다');
});

test('05 아코디언 01 카드 제목이 04 와 같은 이름이다', () => {
  const titles = (M.index.match(/<span class="feat-title">([^<]*)<\/span>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').trim());
  assert.deepStrictEqual(titles, ['수출 사전점검', '바이어 확인', '기한 관리'],
    '05 세 카드 제목이 용어 정본과 다릅니다: ' + JSON.stringify(titles));
});

test('🔴 폐기된 상품명이 어느 페이지 본문에도 없다', () => {
  for (const [file, text] of [['index.html', B.index], ['precheck.html', B.precheck]]) {
    for (const w of RETIRED_KO) {
      assert.ok(text.indexOf(w) === -1,
        file + ' 에 폐기된 상품명 「' + w + '」이 남아 있습니다 — 한 상품이 다시 두 이름이 됩니다');
    }
  }
  for (const w of RETIRED_EN) {
    assert.ok(B.en.indexOf(w) === -1, 'en.html 에 폐기된 상품명 「' + w + '」이 남아 있습니다');
  }
});

test('/precheck 의 title·og:title·플랜명이 랜딩과 같은 이름이다', () => {
  const head = RAW.precheck.slice(0, RAW.precheck.indexOf('</head>'));
  const title = (head.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const og = (head.match(/property="og:title" content="([^"]*)"/) || [])[1] || '';

  assert.strictEqual(title, '수출 사전점검 — TROPS', '<title> 이 상품명 정본과 다릅니다: ' + title);
  assert.strictEqual(og, '수출 사전점검 — TROPS', 'og:title 이 <title> 과 다릅니다: ' + og);
  // 결제창·카드 명세서에 찍히는 주문명도 같은 이름이어야 합니다.
  const payment = require('../api/_payment.js');
  assert.strictEqual(payment.ORDER_NAME, '수출 사전점검',
    '결제창 주문명이 화면의 상품명과 다릅니다: ' + payment.ORDER_NAME);
  assert.ok(payment.ORDER_NAME.indexOf('NDA') === -1,
    '주문명에 NDA 가 들어왔습니다 — 카드 명세서까지 노출됩니다 (흐름 md §1)');
});

test('푸터 /precheck 링크 라벨이 그 페이지 이름과 같다 — 전 페이지', () => {
  const files = ['index.html', 'nda.html', 'uae.html', 'refund.html', 'privacy.html'];
  for (const f of files) {
    const m = strip(read(f));
    const labels = (m.match(/<a href="\/precheck">([^<]*)<\/a>/g) || [])
      .map((s) => s.replace(/<[^>]*>/g, '').trim());
    assert.ok(labels.length > 0, f + ' 에 /precheck 링크가 없습니다');
    for (const l of labels) {
      assert.strictEqual(l, '수출 사전점검',
        f + ' 의 /precheck 링크 라벨이 「' + l + '」입니다 — 페이지 이름과 갈립니다');
    }
  }
});

test('04 기한관리 카드에 「준비 중」 배지가 없다', () => {
  const cards = section(M.index, 'cards-sec');
  assert.ok(cards.indexOf('badge-soon') === -1,
    '「준비 중」 배지가 남아 있습니다 — app.trops.kr 은 이미 무로그인으로 열립니다');
});

test('04 두 카드 모두 상태줄을 갖는다 — 배지를 지운 자리를 비워두지 않는다', () => {
  // 「준비 중」 배지가 .card-title 자리를 쓰고 있었습니다. 지우고 비워 두면 두 가지가
  // 한꺼번에 깨집니다: ① 두 카드의 첫 줄 높이가 어긋나고 ② 01 에만 「지금 쓸 수
  // 있습니다」가 남아 02 는 못 쓴다는 뜻이 되어 방금 지운 배지가 암시로 되살아납니다.
  for (const [file, markup] of [['index.html', M.index], ['en.html', M.en]]) {
    const cards = section(markup, 'cards-sec');
    const titles = (cards.match(/<span class="card-title">([^<]*)<\/span>/g) || []);
    assert.strictEqual(titles.length, 2,
      file + ' 의 04 카드 상태줄이 ' + titles.length + '개입니다 — 두 카드 모두 필요합니다');
  }
});

test('04 기한관리 버튼이 인라인 확장이다 — 페이지 이동이 아니다', () => {
  const cards = section(M.index, 'cards-sec');

  assert.ok(cards.indexOf('기한관리 미리보기') !== -1, '버튼 라벨이 「기한관리 미리보기」가 아닙니다');
  assert.ok(cards.indexOf('알림 받기') === -1, '옛 라벨 「알림 받기」가 남아 있습니다');
  assert.ok(/<button[^>]*data-timeline-open/.test(cards),
    '<button data-timeline-open> 이 아닙니다 — <a href> 면 페이지 이동이 됩니다');
  assert.ok(!/<a[^>]*href="#interest"[^>]*>\s*알림/.test(cards), '사전등록 폼으로 보내는 링크가 남아 있습니다');
});

test('기한관리 패널은 페이지에 하나뿐이다 — 트리거만 늘린다', () => {
  const panels = (M.index.match(/id="feat-timeline-panel"/g) || []).length;
  assert.strictEqual(panels, 1,
    '패널이 ' + panels + '개입니다 — 복제하면 지도 에셋이 여러 번 로드되고 상태가 갈립니다');

  const triggers = (M.index.match(/data-timeline-open/g) || []).length;
  assert.ok(triggers >= 4,
    '트리거가 ' + triggers + '개입니다 — 히어로·04 카드·로드맵·마감 CTA 네 곳이어야 합니다');
});

test('04 h2 아래 층위 구분 한 줄이 있다 — 05 와 중복으로 읽히지 않게', () => {
  const cards = section(M.index, 'cards-sec');
  assert.ok(cards.indexOf('class="cards-lead"') !== -1,
    '.cards-lead 가 없습니다 — 04 와 05 가 다시 같은 말의 반복으로 읽힙니다');
  assert.ok(cards.indexOf('href="#feats"') !== -1, '05 아코디언으로 넘기는 링크가 없습니다');
  assert.ok(M.index.indexOf('id="feats"') !== -1, '#feats 앵커가 없습니다 — 죽은 링크가 됩니다');
});

/* ══ 3. 정보 불일치 해소 ═════════════════════════════════════════════════════ */

test('nav 앱 링크에 「준비중」이 없다 — 실측으로 열리는 것을 확인했다', () => {
  const nav = M.index.slice(M.index.indexOf('<nav class="nav">'), M.index.indexOf('</nav>'));
  assert.ok(nav.indexOf('app.trops.kr') !== -1, '앱 링크가 사라졌습니다');
  assert.ok(!/준비\s*중/.test(nav),
    '「준비중」이 남아 있습니다 — 루트는 로그인 없이 열리고 예시 지도가 그려집니다');
});

test('로드맵 두 항목이 지금 파는 상품과 어떻게 다른지 밝힌다', () => {
  const next = M.index.slice(M.index.indexOf('id="next"'));
  const block = next.slice(0, next.indexOf('</section>'));

  const diffs = (block.match(/class="rm-diff"/g) || []).length;
  assert.strictEqual(diffs, 2, '구분 문구가 ' + diffs + '개입니다 — 두 항목 모두에 필요합니다');

  assert.ok(block.indexOf('「수출 사전점검」과는 다른 상품입니다') !== -1,
    '「확인 항목 요약 자료」가 「수출 사전점검」과 다른 상품이라는 문구가 없습니다 — ' +
    '지금 파는 상품 이름이 바뀌면 이 구분 문구도 함께 바뀝니다(안 바꾸면 없는 상품과 비교합니다)');
  assert.ok(block.indexOf('「기한 관리」의 확장판입니다') !== -1,
    '「거래 운영」과 「기한 관리」의 관계(확장판)가 명시되지 않았습니다');
});

test('「거래 운영」과 「기한 관리」는 이름이 겹치지 않는다', () => {
  const next = M.index.slice(M.index.indexOf('id="next"'));
  const block = next.slice(0, next.indexOf('</section>'));
  const names = (block.match(/<p class="rm-name">[\s\S]*?<\/p>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').replace(/^\d+/, '').trim());

  assert.ok(names.indexOf('거래 운영') !== -1, '로드맵 02 이름이 「거래 운영」이 아닙니다: ' + names);
  assert.ok(names.indexOf('기한 관리') === -1,
    '로드맵이 지금 파는 상품과 같은 이름을 씁니다 — 같은 페이지가 두 상품을 한 이름으로 부릅니다');
});

test('푸터 태그라인이 index 와 precheck 에서 같다', () => {
  const pick = (s) => (s.match(/<span class="footer-meta">([^<]*)<\/span>/) || [])[1];
  const ko = pick(M.index);
  const pre = pick(M.precheck);

  assert.ok(ko, 'index.html 푸터 태그라인을 찾지 못했습니다');
  assert.strictEqual(pre, ko,
    '두 페이지가 다른 태그라인을 씁니다 — 같은 회사의 두 페이지가 다른 회사처럼 읽힙니다\n' +
    '  index:    ' + ko + '\n  precheck: ' + pre);

  // 3기능을 아우르는지 — 한 기능 이름만 박아 두면 나머지 둘이 부록이 됩니다.
  assert.ok(/확인/.test(ko) && /기한/.test(ko),
    '태그라인이 3기능(문서대조·바이어확인·기한관리)을 아우르지 않습니다: ' + ko);
});

test('precheck 의 description 류에 「NDA」가 없다', () => {
  const head = RAW.precheck.slice(0, RAW.precheck.indexOf('</head>'));
  const metas = head.match(/<meta[^>]*(?:name="description"|property="og:description")[^>]*>/g) || [];
  assert.strictEqual(metas.length, 2, 'description·og:description 이 둘 다 있어야 합니다');

  for (const m of metas) {
    assert.ok(m.indexOf('NDA') === -1,
      '검색결과·공유카드에 「NDA」가 노출됩니다 — 자료제출 방어기제를 부릅니다:\n  ' + m);
  }
  const title = (head.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  assert.ok(title.indexOf('NDA') === -1, '<title> 에 NDA 가 들어왔습니다: ' + title);
});

test('접수 화면 안의 「NDA」는 그대로 남아 있다 — 범위 명시는 여기서 한다', () => {
  // 흐름 md §1: 「접수 화면 안에서만 '현재는 NDA만 지원'으로 범위 명시」.
  // 메타에서 뺀 것을 화면 안에서까지 지우면 무엇을 올리는지 알 수 없게 됩니다.
  assert.ok(B.precheck.indexOf('지금은 NDA만 대조할 수 있습니다') !== -1,
    '접수 폼의 범위 안내가 사라졌습니다');
});

/* ══ 4. 안심 문구 위치 ══════════════════════════════════════════════════════
 *
 * 흐름 md §1 감정선: 기(히어로) - 승(경험담) - 전(신뢰증명) - 결(행동).
 * 방어 문구가 기와 승 사이에 있으면 감정이 붙기 전에 선긋기를 먼저 합니다.
 */

test('안심 문구가 경험담 뒤에 있다 — 히어로 직하가 아니다', () => {
  const b = B.index;
  const hero = b.indexOf('<section class="container hero">');
  const stories = b.indexOf('class="stories"');
  const assure = b.indexOf('id="assure-title"');
  const how = b.indexOf('HOW IT WORKS');

  assert.ok(hero !== -1 && stories !== -1 && assure !== -1 && how !== -1, '기준 블록을 찾지 못했습니다');
  assert.ok(assure > stories,
    '안심 문구가 아직 경험담보다 앞에 있습니다 — 감정몰입 전에 방어를 먼저 마주칩니다');
  assert.ok(assure < how, '안심 문구가 HOW 설명보다 뒤로 밀렸습니다');
});

test('안심 문구가 하나뿐이다 — 옛 자리에 남기지 않았다', () => {
  const n = (B.index.match(/결정은 언제나 대표님 것입니다/g) || []).length;
  assert.strictEqual(n, 1, '같은 선언이 ' + n + '번 나옵니다');
});

test('법적 문구가 페이지에 남아 있다 — 위치와 무관하게 필수', () => {
  assert.ok(B.index.indexOf('법률 자문 서비스가 아닙니다') !== -1,
    'index.html 에서 「법률 자문 서비스가 아닙니다」가 사라졌습니다');
  assert.ok(B.en.indexOf('not a legal advisory service') !== -1,
    'en.html 에서 같은 문구가 사라졌습니다');
});

/* ══ 5. 영문판 동기화 ═══════════════════════════════════════════════════════ */

test('en.html 04 카드가 국문과 같은 이름을 쓴다', () => {
  const cards = section(M.en, 'cards-sec');

  assert.ok(cards.indexOf('Before the deal · Export pre-check') !== -1,
    '01 카드가 Export pre-check 이 아닙니다 (구 Document comparison · 구구 NDA comparison)');
  assert.ok(cards.indexOf('After the deal starts · Deadline management') !== -1,
    '02 카드가 Deadline management 가 아닙니다 (구 Trade procedure tracking)');
  assert.ok(cards.indexOf('NDA comparison') === -1, '옛 이름이 남아 있습니다');
  assert.ok(cards.indexOf('badge-soon') === -1, 'COMING SOON 배지가 남아 있습니다');
});

test('en.html 기한관리 버튼이 인라인 확장이다', () => {
  const cards = section(M.en, 'cards-sec');
  assert.ok(/<button[^>]*class="[^"]*feat-btn[^"]*"[^>]*aria-controls="feat-timeline-panel"/.test(cards),
    '펼침 버튼이 없습니다');
  assert.ok(cards.indexOf('id="feat-timeline-panel"') !== -1, '인라인 패널이 없습니다');
  assert.ok(!/href="#interest"[^>]*>\s*Get notified\s*</.test(cards),
    '카드에 [ Get notified ] 링크가 남아 있습니다 — 인라인 확장으로 교체돼야 합니다');
});

test('en.html 패널이 접힌 채로 내려오고 슬라이드로 열린다', () => {
  const m = M.en;
  assert.ok(/<div class="card feat" id="feat-timeline" data-open="0">/.test(m),
    '카드가 접힌 상태(data-open="0")로 내려오지 않습니다 — JS 가 죽으면 펼친 채 굳습니다');

  const css = RAW.en.match(/<style[\s\S]*?<\/style>/g).join('');
  assert.match(css, /\.feat-panel \{[^}]*grid-template-rows: 0fr/, '접힘이 0fr 이 아닙니다');
  assert.match(css, /\.feat\[data-open="1"\] \.feat-panel \{[^}]*grid-template-rows: 1fr/,
    '펼침이 1fr 이 아닙니다');
  assert.ok(!/\.feat-panel \{[^}]*display: none/.test(css),
    'display:none 방식이면 슬라이드가 불가능합니다');
});

test('en.html 에서 「Trade procedure tracking」이 완전히 사라졌다', () => {
  assert.ok(B.en.indexOf('Trade procedure tracking') === -1,
    '옛 이름이 남아 있습니다 — 04 카드와 07 로드맵이 같은 이름을 쓰던 충돌의 원인입니다');
  assert.ok(B.en.indexOf('Trade operations') !== -1,
    '로드맵 02 가 Trade operations 로 갈라지지 않았습니다');
});

test('en.html 로드맵 이름이 04 카드와 겹치지 않는다', () => {
  const next = M.en.slice(M.en.indexOf('id="next"'));
  const block = next.slice(0, next.indexOf('</section>'));
  const names = (block.match(/<p class="rm-name">[\s\S]*?<\/p>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').replace(/^\d+/, '').trim());

  assert.ok(names.indexOf('Deadline management') === -1,
    '로드맵이 지금 쓸 수 있는 상품과 같은 이름을 씁니다: ' + names);
  assert.strictEqual((block.match(/class="rm-diff"/g) || []).length, 2,
    '구분 문구가 두 항목 모두에 있어야 합니다');
});

test('en.html 안심 문구가 히어로 직하가 아니다', () => {
  const b = B.en;
  const cards = b.indexOf('id="cards-title"');
  const assure = b.indexOf('id="assure-title"');
  assert.ok(cards !== -1 && assure !== -1, '기준 블록을 찾지 못했습니다');
  assert.ok(assure > cards,
    '안심 문구가 아직 04 카드보다 앞에 있습니다 — 무엇을 파는지 보기 전에 선긋기를 합니다');
  assert.strictEqual((b.match(/The decision is always yours/g) || []).length, 1,
    '같은 선언이 두 번 나옵니다');
});

test('en.html 푸터 태그라인이 한 기능만 말하지 않는다', () => {
  const tag = (M.en.match(/<span class="footer-meta">([^<]*)<\/span>/) || [])[1] || '';
  assert.ok(tag.indexOf('Buyer document pre-check') === -1,
    '태그라인이 3기능 중 하나만 말합니다: ' + tag);
  assert.ok(/check/i.test(tag) && /deadline/i.test(tag),
    '확인(문서대조·바이어확인)과 기한관리를 함께 담고 있지 않습니다: ' + tag);
});
