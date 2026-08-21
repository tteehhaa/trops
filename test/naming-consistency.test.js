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
  // 🔄 카드 <div> → 탭 패널 〔2026-08-14 · cards-tabs-s12〕.
  const start = M.index.indexOf('<div class="feat-panel" id="feat-buyer-panel"');
  const block = M.index.slice(start, M.index.indexOf('<div class="feat-panel" id=', start + 10));
  assert.ok(!/준비\s*중/.test(block),
    '「준비 중」이 남아 있습니다 — 같은 카드가 「바로 확인하실 수 있습니다」라고도 말합니다');
});

test('기한관리 「지금은 무료」가 배지에서 빠지고 본문에 남았다', () => {
  // 🔄 카드 <div> → 탭 패널 〔2026-08-14 · cards-tabs-s12〕.
  const start = M.index.indexOf('<div class="feat-panel" id="feat-timeline-panel"');
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

/*
 * 🔄 **단언을 새 구조 위에 다시 적었습니다** 〔2026-08-14 · landing-flow-restructure-s9〕.
 *
 * 종전 이름은 「04 카드가 05 와 같은 이름을 쓴다」였고, 04 2층카드의 .eyebrow-quiet
 * (「거래 시작 전 · 수출 사전점검」)과 05 아코디언의 .feat-title 이 같은 상품을 같은
 * 이름으로 부르는지 봤습니다. **04 와 05 가 한 섹션으로 합쳐지면서 그 대조쌍이
 * 사라졌습니다** — 지금은 한 카드가 생애주기(.feat-meta)와 상품명(.feat-title)을
 * 나란히 갖습니다. 그래서 「두 자리가 같은 이름인가」가 아니라 「한 자리가 용어
 * 정본과 같은가」를 봅니다. 지키려는 것은 그대로입니다: **한 상품을 두 이름으로
 * 부르지 않는다.**
 * ⛔ 이 검사를 04/05 두 섹션 대조로 되돌리지 마십시오. 되돌리려면 섹션을 먼저 다시
 *    갈라야 하고, 그것은 이 사이클이 없앤 중복을 되살리는 일입니다.
 */
test('상품 카드가 용어 정본대로 생애주기 + 상품명을 갖는다', () => {
  const cards = section(M.index, 'cards-sec');

  const metas = (cards.match(/<span class="feat-meta">([^<]*)<\/span>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').trim());
  assert.deepStrictEqual(metas, ['거래 시작 전', '거래 시작 전', '거래 시작 후'],
    '생애주기 축이 용어 정본과 다릅니다: ' + JSON.stringify(metas));

  assert.ok(cards.indexOf('NDA 비교') === -1, '옛 이름 「NDA 비교」가 남아 있습니다');
  assert.ok(cards.indexOf('거래 절차 트래킹') === -1, '옛 이름 「거래 절차 트래킹」이 남아 있습니다');

  // 상품명이 카드마다 한 번씩만 나오는지 — 머리와 패널이 이름을 두 번 말하면
  // 통합의 목적(한 상품 = 한 번의 설명)이 카드 안에서 다시 깨집니다.
  for (const name of ['수출 사전점검', '바이어 확인', '기한 관리']) {
    const hits = (cards.match(new RegExp(name, 'g')) || []).length;
    assert.strictEqual(hits, 1,
      '「' + name + '」이 상품소개 섹션에 ' + hits + '번 나옵니다 (1번이어야 합니다)');
  }
});

test('상품 카드 3장의 제목이 용어 정본과 같다', () => {
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

test('기한관리 카드에 「준비 중」 배지가 없다', () => {
  const cards = section(M.index, 'cards-sec');
  assert.ok(cards.indexOf('badge-soon') === -1,
    '「준비 중」 배지가 남아 있습니다 — app.trops.kr 은 이미 무로그인으로 열립니다');
});

/*
 * 🔄 **단언 대상이 .card-title 에서 .feat-avail 로 바뀌었습니다**
 *    〔2026-08-14 · landing-flow-restructure-s9〕. 상태줄이 옛 04 2층카드에서 통합
 *    카드의 머리로 옮겨 갔고, 카드 수도 2 → 3 이 됐습니다(바이어 확인이 합류).
 *    en.html 은 이번 배치 밖이라 옛 구조(.card-title × 2) 그대로입니다.
 *
 * 지키려는 것은 그대로입니다: **상태줄이 빠진 카드를 만들지 않는다.** 「준비 중」
 * 배지를 걷어낸 자리를 비워 두면 ① 카드 첫 줄 높이가 어긋나고 ② 상태줄이 있는
 * 카드만 쓸 수 있다는 뜻이 되어 방금 지운 배지가 암시로 되살아납니다.
 */
test('상품 카드 3장이 모두 상태줄을 갖는다 — 배지를 지운 자리를 비워두지 않는다', () => {
  const cards = section(M.index, 'cards-sec');
  const avails = (cards.match(/<span class="feat-avail">([^<]*)<\/span>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').trim());
  assert.strictEqual(avails.length, 3,
    'index.html 의 상태줄이 ' + avails.length + '개입니다 — 세 카드 모두 필요합니다');
  assert.strictEqual(new Set(avails).size, 3,
    '상태줄 3개가 서로 다르지 않습니다 — 세 상품의 실제 상태가 다릅니다: ' + JSON.stringify(avails));
  // 「무료」는 덤처럼 보여 가치를 저평가시킵니다(흐름 md §4 Give/Get 은 「포함」 계열).
  assert.ok(!avails.some((a) => /무료/.test(a)), '상태줄에 「무료」가 들어왔습니다: ' + JSON.stringify(avails));

  // 🔄 en.html 이 같은 구조가 됐습니다 〔2026-08-16 · 영문화〕. 종전에는 옛 04 2층카드
  //    (.card-title × 2)를 단언하고 있었고, 그것이 en.html 이 다섯 커밋 뒤에 남아 있던
  //    상태를 못질하고 있었습니다. 이제 국문과 같은 조건을 같은 방식으로 봅니다.
  const enAvails = (section(M.en, 'cards-sec').match(/<span class="feat-avail">([^<]*)<\/span>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').trim());
  assert.strictEqual(enAvails.length, 3,
    'en.html 의 상태줄이 ' + enAvails.length + '개입니다 — 세 카드 모두 필요합니다');
  assert.strictEqual(new Set(enAvails).size, 3,
    'en.html 상태줄 3개가 서로 다르지 않습니다: ' + JSON.stringify(enAvails));
  // 국문의 「무료」와 같은 이유 — 덤처럼 보이면 가치가 저평가됩니다.
  assert.ok(!enAvails.some((a) => /\bfree\b/i.test(a)),
    'en.html 상태줄에 「free」가 들어왔습니다: ' + JSON.stringify(enAvails));
});

/*
 * 🔄 **「04 카드의 [기한관리 미리보기] 버튼」이 사라졌습니다** 〔2026-08-14〕.
 *    그 카드가 아코디언 카드로 흡수됐고, 자기 자신을 펼치는 버튼은 뜻이 없기 때문입니다.
 *    지키려던 것(= 기한관리 소개가 페이지 이동이 아니라 그 자리 확장이다)은 이제
 *    카드 자신의 .feat-btn 이 집니다. 그것을 확인합니다.
 */
test('기한관리가 그 자리에서 열린다 — 페이지 이동이 아니다', () => {
  /*
   * 🔄 **아코디언 → 탭** 〔2026-08-14 · cards-tabs-s12〕. 지키려던 것은 그대로입니다:
   *    기한관리 소개가 **다른 페이지로 보내는 것이 아니라 이 자리에서 열린다.**
   *    그것을 이제 탭 라벨과 패널의 짝이 집니다.
   */
  const cards = section(M.index, 'cards-sec');
  assert.ok(cards.indexOf('알림 받기') === -1, '옛 라벨 「알림 받기」가 남아 있습니다');
  assert.ok(!/<a[^>]*href="#interest"[^>]*>\s*알림/.test(cards), '사전등록 폼으로 보내는 링크가 남아 있습니다');

  const at = cards.indexOf('id="feat-timeline"');
  assert.ok(at !== -1, '기한관리 탭이 상품소개 섹션 안에 없습니다');
  const tag = cards.slice(cards.lastIndexOf('<', at), cards.indexOf('>', at) + 1);
  assert.ok(/role="tab"/.test(tag) && /aria-controls="feat-timeline-panel"/.test(tag),
    '기한관리 탭이 자기 패널을 가리키지 않습니다: ' + tag);
  assert.ok(cards.indexOf('id="feat-timeline-panel"') !== -1, '인라인 패널이 없습니다');
});

test('기한관리 패널은 페이지에 하나뿐이다 — 트리거만 늘린다', () => {
  const panels = (M.index.match(/id="feat-timeline-panel"/g) || []).length;
  assert.strictEqual(panels, 1,
    '패널이 ' + panels + '개입니다 — 복제하면 지도 에셋이 여러 번 로드되고 상태가 갈립니다');

  /*
   * 🔄 3 → 2 → 1 〔2026-08-16 · v-next 전면교체 + 대표 수정안 3차〕. 히어로 CTA 가
   *    3개→2개로 줄면서 히어로의 [기한관리 미리보기] 트리거가 사라졌고, 이어서
   *    마감 CTA 의 [기한관리 미리보기] 버튼도 삭제되며 로드맵 한 곳만 남았습니다.
   * ⚠️ **B.index(본문)로 셉니다.** M.index 는 HTML 주석만 걷으므로 <style>·<script>
   *    안의 주석에 인용된 [data-timeline-open] 이 그대로 섞여 들어옵니다 — 그러면
   *    트리거를 지워도 이 검사가 통과합니다(실제로 그런 상태였습니다).
   */
  const triggers = (B.index.match(/data-timeline-open/g) || []).length;
  assert.strictEqual(triggers, 1,
    '트리거가 ' + triggers + '개입니다 — 로드맵 한 곳이어야 합니다(히어로·마감 CTA는 삭제)');
});

/*
 * 🔄 **「04→05 로 넘기는 링크」 단언을 걷었습니다** 〔2026-08-14〕. 넘길 05 가 없습니다.
 *    .cards-lead 는 남습니다 — 역할이 「두 섹션은 중복이 아니다」라는 변명에서
 *    「카드를 펼쳐 보라」는 조작 안내로 바뀌었고, 옛 05 h2 의 문면을 흡수했습니다.
 *    id="feats" 앵커도 남깁니다(과거 링크가 죽지 않도록).
 */
test('상품소개 h2 아래 조작 안내 한 줄이 있고, 옛 앵커가 살아 있다', () => {
  const cards = section(M.index, 'cards-sec');
  assert.ok(cards.indexOf('class="cards-lead"') !== -1, '.cards-lead 가 없습니다');
  /* 🔄 「펼쳐보세요」 → 「눌러보세요」 〔2026-08-14 · cards-tabs-s12〕. 펼칠 것이 없어졌고,
     조작 안내가 화면과 다르면 안내가 아니라 오안내입니다. */
  assert.ok(cards.indexOf('눌러보세요') !== -1,
    '리드가 탭을 눌러보라고 안내하지 않습니다 — 옛 05 h2 가 하던 일을 이 줄이 받았습니다');
  assert.ok(cards.indexOf('펼쳐보세요') === -1,
    '아코디언 시절 안내(「펼쳐보세요」)가 남아 있습니다 — 화면에 펼칠 것이 없습니다');
  // ⚠️ B(본문)로 봅니다. M 은 HTML 주석만 걷으므로 CSS 주석의 「<a href="#feats"> 를
  //    되살리지 마십시오」가 그대로 오탐이 됩니다(파일 머리 ⚠️ 와 같은 이유).
  assert.ok(!/href="#feats"/.test(B.index),
    '자기 섹션 안으로 가는 링크(#feats)가 남아 있습니다 — 넘길 「아래」가 없습니다');
  assert.ok(M.index.indexOf('id="feats"') !== -1, 'feats 앵커가 없습니다 — 과거 링크가 죽습니다');
});

/* ══ 3. 정보 불일치 해소 ═════════════════════════════════════════════════════ */

/*
 * 🔴 **아래 테스트를 제거했습니다** 〔2026-08-16 · 대표 지시〕. [트롭스 앱 미리보기]
 * nav 링크(app.trops.kr) 자체를 삭제했으므로 "그 링크에 준비중 표기가 없다"는
 * 전제가 성립하지 않습니다. 기한관리 탭·로드맵의 [미리보기]는 이 삭제와 무관하게
 * 그대로 남아 있습니다(다른 테스트가 봅니다).
 */
test('nav 에 app.trops.kr 링크가 없다', () => {
  const nav = M.index.slice(M.index.indexOf('<nav class="nav">'), M.index.indexOf('</nav>'));
  assert.ok(nav.indexOf('app.trops.kr') === -1,
    'nav 에 app.trops.kr 링크가 남아 있습니다 — [트롭스 앱 미리보기]는 삭제 대상입니다');
});

/*
 * 🔄 **로드맵 구분 문구(.rm-diff)를 걷었습니다** 〔2026-08-16 · v-next 전면교체〕.
 *    로드맵 두 행이 기존 3상품명 중 두 개(「수출 사전점검」·「기한 관리」)를 그대로
 *    재사용하는 쪽으로 대표가 확정했습니다 — 이제 이름 자체가 "지금 쓸 수 있는
 *    상품의 확장분"임을 말하므로, 별도 구분 문구가 필요 없어졌습니다.
 *    아래 옛 두 테스트(구분 문구 존재 확인 / 이름 비충돌 확인)는 전제가 반대로
 *    뒤집혀 제거했습니다 — 지금은 로드맵이 기존 상품명을 재사용하는 것 자체가
 *    승인된 설계입니다.
 * 🔄 대표 수정안(2026-08-16, 같은 날 2차) — 01행 배지가 「준비 중」→「현재 일부
 *    동작 및 추가 개발 중」으로 바뀌었습니다. 02행은 「준비 중」 그대로입니다.
 * 🔄 대표 수정안(같은 날 4차) — 01행에 잠깐 붙었던 보충 문구(.rm-note)를 FAQ
 *    「법률 자문인가요?」 답변으로 옮겼습니다 — 원래 그 문항의 맺음말이었습니다.
 *    .rm-note 클래스는 이제 마크업에서 쓰지 않습니다.
 */
test('로드맵 두 행이 기존 상품명을 재사용한다', () => {
  const next = M.index.slice(M.index.indexOf('id="next"'));
  const block = next.slice(0, next.indexOf('</section>'));
  const names = (block.match(/<p class="rm-name">[\s\S]*?<\/p>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').replace(/^\d+/, '').trim());

  assert.deepStrictEqual(names, ['수출 사전점검', '기한 관리'],
    '로드맵 두 행의 이름이 상품명 정본과 다릅니다: ' + JSON.stringify(names));

  const metas = (block.match(/<p class="rm-meta">([^<]*)<\/p>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').trim());
  assert.deepStrictEqual(metas, ['현재 일부 동작 및 추가 개발 중', '준비 중'],
    '로드맵 배지가 예상 문구와 다릅니다: ' + JSON.stringify(metas));
  assert.ok(!/가격|₩|원\b|미정/.test(block), '로드맵에 가격 관련 표기가 남아 있습니다');
  assert.ok(!/class="rm-note"/.test(block),
    '.rm-note 가 로드맵에 남아 있습니다 — FAQ 「법률 자문인가요?」로 옮겨간 문구입니다');
});

/*
 * 🔄 **검사 대상이 두 페이지에서 배포되는 전 페이지로 넓어졌습니다** 〔2026-08-17〕.
 *
 * 종전에는 index·precheck **둘만** 봤습니다. 그 사이 나머지가 조용히 갈라져
 * 2026-08-17 실측에서 **네 페이지가 옛 값**을 들고 있었습니다:
 *   refund · nda · uae  「수출 거래 운영」        (2026-08-13 이전 표현)
 *   privacy             「수출 사전점검」          (셋째 값 — 3기능 중 하나만)
 * 같은 회사의 페이지들이 서로 다른 회사를 소개하던 상태입니다.
 *
 * 두 곳만 보는 검사는 **두 곳만 지킵니다.** 그래서 목록을 손으로 적지 않고
 * scripts/build-static.js 의 STATIC.html 에서 읽습니다 — 페이지를 새로 만들면
 * 다음 실행부터 저절로 검사 대상이 됩니다(cron 라우트 탐지와 같은 태도).
 */
const STATIC_PAGES = require('../scripts/build-static.js').STATIC.html;

/*
 * 🔴 **영문 페이지 목록은 여기 한 곳에서만 만듭니다** 〔통합 2026-08-17〕.
 *
 * 종전에는 세 검사(한글 잔류 · em dash · 국문 링크 누출)가 **같은 다섯 이름을 각자
 * 손으로** 적고 있었습니다. 목록이 셋이면 새 영문 페이지를 넣을 때 **셋 다 고쳐야**
 * 하고, 하나를 빠뜨려도 나머지 둘이 초록이라 빠뜨린 사실이 안 보입니다.
 * 실제로 「국문 링크 누출」 목록에서 en-privacy.html 하나가 빠져 있었고, 그 페이지가
 * `/precheck` · `/refund` 로 새는 동안 검사가 조용히 통과했습니다.
 *
 * 이제 세 검사가 이 상수 하나를 봅니다. **손으로 적는 목록이 아니라 필터**이므로
 * 「STATIC.html 에 locale:'en' 으로 있는데 이 목록에는 없는」 상태를 만들 수 없습니다 —
 * 빠뜨림이 고쳐야 할 실수가 아니라 **표현할 수 없는 상태**가 됩니다.
 */
const EN_PAGES = STATIC_PAGES.filter((p) => p.locale === 'en').map((p) => p.file);

/*
 * 필터가 아무것도 못 잡는 반대 방향 사고를 막습니다. `locale` 표기가 바뀌거나
 * (`'en'` → `'en-US'`) STATIC.html 구조가 달라지면 EN_PAGES 가 **빈 배열**이 되고,
 * 그러면 아래 세 검사가 **한 바퀴도 안 돌면서 전부 초록**입니다. 가장 나쁜 실패 형태라
 * 하한을 따로 셉니다.
 */
test('영문 페이지가 STATIC.html 에서 실제로 잡힌다 — 빈 목록은 조용한 초록불이다', () => {
  assert.ok(EN_PAGES.length >= 5,
    'STATIC.html 에서 잡힌 영문 페이지가 ' + EN_PAGES.length + '개입니다(5개 이상이어야 합니다): ' +
    JSON.stringify(EN_PAGES) + '\n' +
    '  영문 페이지를 지우신 것이 아니라면 locale 표기나 STATIC.html 구조가 바뀐 것입니다 — ' +
    '이 목록을 쓰는 세 검사가 한 바퀴도 안 돌게 됩니다');
});

test('푸터 태그라인이 배포되는 전 페이지에서 같다', () => {
  const pick = (s) => (s.match(/<span class="footer-meta">([^<]*)<\/span>/) || [])[1];
  const ko = pick(M.index);
  assert.ok(ko, 'index.html 푸터 태그라인을 찾지 못했습니다');

  /* 국문·영문은 값이 다릅니다(번역). 각 묶음 안에서 하나여야 합니다. */
  const seen = { ko: new Map(), en: new Map() };
  for (const { file, locale } of STATIC_PAGES) {
    const tag = pick(strip(read(file)));
    assert.ok(tag, file + ' 에 푸터 태그라인이 없습니다');
    if (!seen[locale].has(tag)) seen[locale].set(tag, []);
    seen[locale].get(tag).push(file);
  }
  for (const locale of ['ko', 'en']) {
    const got = [...seen[locale].entries()];
    assert.strictEqual(got.length, 1,
      locale + ' 페이지들이 서로 다른 태그라인을 씁니다 — 같은 회사의 페이지가 다른 회사처럼 읽힙니다\n' +
      got.map(([tag, files]) => '  ' + JSON.stringify(tag) + '\n    └ ' + files.join(' · ')).join('\n'));
  }
  const pre = pick(M.precheck);
  assert.strictEqual(pre, ko, 'index 와 precheck 이 다릅니다: ' + ko + ' / ' + pre);

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

/*
 * 🔄 **기준이 「경험담 뒤」에서 「결 CTA 뒤」로 바뀌었습니다** 〔2026-08-14 · 재배치〕.
 *
 * 종전 단언은 `stories < assure < HOW` 였습니다. 그때는 감정선(기-승-전-결)의 「전」과
 * 「결」이 아직 페이지 뒤쪽에 있어서, 경험담 직후가 감정선 밖의 유일한 안전지대였습니다.
 * 재배치로 감정선 넷이 히어로~결 CTA 로 앞당겨 모였으므로, 방어 문구가 들어갈 수 있는
 * 자리는 **감정선이 끝난 다음**뿐입니다.
 *
 * 지키려는 것은 그대로입니다: **감정이 붙기 전에 선을 긋지 않는다.**
 * ⛔ 히어로 직하로 되돌리지 마십시오. 그것이 2026-08-13 에 한 번 고쳐진 상태입니다.
 */
test('안심 문구가 결 CTA 뒤에 있다 — 감정선 안에 끼지 않는다', () => {
  const b = B.index;
  const hero = b.indexOf('<section class="container hero">');
  const stories = b.indexOf('class="stories"');
  /*
   * 🔄 「전」의 기준점을 `id="trust-title"` 에서 **인용문 자신**으로 바꿨습니다
   *    〔2026-08-14 · basis-split-s13〕. 그 id 는 「무엇을 근거로 비교하는지 밝힙니다」
   *    h2 의 것이고, 그 h2 는 상품소개 **뒤**의 05 근거 섹션으로 내려갔습니다
   *    (지금 이름은 basis-title). 감정선의 「전」이 시작되는 지점은 경고 인용문입니다.
   */
  const warn = b.indexOf('class="stat-line');
  const act = b.indexOf('id="act-title"');
  const assure = b.indexOf('id="assure-title"');
  /*
   * 🔄 **하한 기준이 HOW 에서 FAQ 로 바뀌었습니다** 〔2026-08-16 · A3 §2〕.
   *
   * 종전 단언은 `assure < how` 였고, 뜻은 「안심 문구가 하단 작은 글씨로 밀리지
   * 않는다」였습니다(섹션 머리주석의 「FAQ 쪽으로 더 내리지 마십시오」). 그때 HOW 가
   * 안심 문구 바로 다음이었으므로 HOW 가 편의상의 하한선 노릇을 했을 뿐입니다.
   * A3 §2 가 HOW 를 경고 직후로 **올렸으므로** 그 문면은 그대로 쓸 수 없습니다 —
   * 지키려던 것을 원문 그대로 적으면 기준은 FAQ 입니다.
   * ⛔ `assure < how` 로 되돌리지 마십시오. 되돌리려면 HOW 를 다시 내려야 하고,
   *    그것은 A3 §2 배치를 되감는 일입니다(test/landing-order-s9.test.js LAYOUT).
   */
  const qna = b.indexOf('id="qna-title"');

  for (const [n, v] of [['hero', hero], ['stories', stories], ['warn', warn],
    ['act', act], ['assure', assure], ['qna', qna]]) {
    assert.ok(v !== -1, '기준 블록을 찾지 못했습니다: ' + n);
  }
  // 감정선 기 - 승 - 전 - 결이 끊기지 않고 이어지는가.
  assert.ok(hero < stories && stories < warn && warn < act,
    '감정선 순서가 기(히어로) - 승(경험담) - 전(경고) - 결(행동)이 아닙니다');
  assert.ok(assure > act,
    '안심 문구가 감정선 안에 끼어 있습니다 — 결(행동) 다음이어야 방어가 아니라 안심으로 읽힙니다');
  assert.ok(assure < qna,
    '안심 문구가 FAQ 뒤로 밀렸습니다 — 하단 작은 글씨가 되면 「본문 크기로 한 번 제대로 ' +
    '말한다」는 차별점(정본 §2-2 우선순위 1번)이 사라집니다');
});

/* 🔄 h2 문구가 v-next 전면교체(2026-08-16)와 같은 날 대표 수정안으로 세 번
   바뀌었습니다 — 「결정은 언제나 대표님 것입니다」→「무엇을 더 확인할지, 먼저
   찾을 수 있습니다.」→「무엇을 먼저 확인할지, 먼저 알아 볼 수 있습니다.」→
   「무엇을 먼저 확인해야 하는지, 빠르게 알아 볼 수 있습니다.」 */
test('안심 문구가 하나뿐이다 — 옛 자리에 남기지 않았다', () => {
  const n = (B.index.match(/지금 놓치기 쉬운 것이 무엇인지, 30초 만에 확인해보세요/g) || []).length;
  assert.strictEqual(n, 1, '같은 선언이 ' + n + '번 나옵니다');
});

test('법적 문구가 페이지에 남아 있다 — 위치와 무관하게 필수', () => {
  assert.ok(B.index.indexOf('법률 자문 서비스가 아닙니다') !== -1,
    'index.html 에서 「법률 자문 서비스가 아닙니다」가 사라졌습니다');
  assert.ok(B.en.indexOf('not a legal advisory service') !== -1,
    'en.html 에서 같은 문구가 사라졌습니다');
});

/* ══ 5. 영문판 동기화 ═══════════════════════════════════════════════════════
 *
 * 🔴 **이 묶음이 통째로 다시 쓰였습니다** 〔2026-08-16 · 영문화 4종〕.
 *
 * 종전 단언은 **옛 en.html**(04 2층카드 · 아코디언 `data-open` · 「Trade operations」)
 * 을 그대로 못질하고 있었습니다. 그 구조는 국문이 2026-08-14 에 탭으로 바뀌면서
 * 이미 사라졌고, en.html 만 다섯 커밋 뒤에 남아 있던 상태였습니다 —
 * 즉 이 테스트들은 「영문판 동기화」라는 이름으로 **비동기 상태를 지키고** 있었습니다.
 *
 * 지금 지키는 것은 하나입니다:
 *
 *   🔴 **영문 페이지는 국문 페이지의 문구만 옮긴 것이다 — 구조는 1:1 이다.**
 *      id 순서가 같아야 하고, 클래스 순서가 같아야 하고, 이름은 같은 것을 가리켜야 합니다.
 *      이 규칙이 있어야 국문을 고칠 때 영문에서 **같은 자리**만 찾으면 됩니다.
 *
 * ⚠️ 의도된 차이는 아래 STRUCT_DELTA 에 **개수로** 적혀 있습니다. 새 차이를 만들면
 *    여기 숫자부터 고쳐야 하고, 그 순간 「왜 갈라졌는가」를 적게 됩니다. 그것이 목적입니다.
 */

const EN_PAIRS = [
  ['index.html', 'en.html'],
  ['check.html', 'en-check.html'],
  ['precheck.html', 'en-precheck.html'],
  ['refund.html', 'en-refund.html'],
  // 영문 2종 추가 〔2026-08-20〕. nda.html · uae.html 의 형제 파일입니다.
  ['nda.html', 'en-nda.html'],
  ['uae.html', 'en-uae.html'],
];

/**
 * 의도된 구조 차이. `[클래스 속성 수 차이, 태그 수 차이]` — 영문 − 국문.
 *
 *   en.html          +2 / +4  히어로 리드 <p> 한 개(초안이 국문보다 한 문장 깁니다)와
 *                             05 근거 CTA 앞의 <span class="cta-row-note"> 한 개.
 *   en-precheck.html −2 / −4  `.lang-notice`(「이 폼은 한국어 전용」 안내). 이 페이지가
 *                             그 영문판이므로 안내할 대상이 없습니다.
 *   en-refund.html    0 / 0   차이 없음.
 *                             🔄 종전에는 +0/+4 였습니다 — 국문 refund.html 의 푸터가
 *                             드리프트했다고 보고 나머지 영문 4개에 맞춰 [TROPS home]
 *                             링크와 법적 고지 <p> 를 하나씩 더 갖고 있었습니다.
 *                             2026-08-17 에 국문 7개를 실측해 보니 **어긋난 것은 태그라인
 *                             하나뿐**이었고(링크 3개·법적 고지 2줄은 precheck·privacy·
 *                             nda·uae 와 같은 다수 형태), 태그라인은 국문에서 고쳤으므로
 *                             여기서 맞출 것이 없어졌습니다.
 */
const STRUCT_DELTA = {
  'en.html': [2, 4],
  'en-check.html': [0, 0],
  'en-precheck.html': [-2, -4],
  'en-refund.html': [0, 0],
  // 영문 2종 추가 〔2026-08-20〕. 문구만 옮겼고 구조를 더하지 않았습니다 — 둘 다 0/0.
  'en-nda.html': [0, 0],
  'en-uae.html': [0, 0],
};

/** 주석을 걷은 마크업에서 id 를 나타난 순서대로. */
function idSeq(html) {
  return [...strip(html).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
}
/** <style>·<script> 를 뺀 마크업의 class 속성을 나타난 순서대로. */
function classSeq(html) {
  return [...body(html).matchAll(/\sclass="([^"]+)"/g)].map((m) => m[1]);
}
/**
 * 태그 이름 순서열. <style>·<script> 안쪽은 비웁니다.
 *
 * ⚠️ `<br>` 은 **빼고 셉니다.** 줄바꿈 자리는 언어마다 달라야 하는 것이기 때문입니다 —
 *    국문 기준으로 잡힌 max-width(ch 단위)에 영문 문장을 그대로 넣으면 마지막 줄이
 *    낱말 하나짜리 고아가 됩니다(en.html .hero-lead 위 주석). 문구를 바꾸는 것이
 *    아니라 마크업만 바꾸는 것이라 정본 §2-3 이 허용하는 자리입니다.
 */
function tagSeq(html) {
  const m = strip(html).replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '<$1></$1>');
  return (m.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g) || [])
    .map((t) => t.toLowerCase())
    .filter((t) => t !== '<br');
}

/*
 * 🔴 **id 는 한 칸도 어긋나면 안 됩니다.** 문구만 옮긴 것이므로 id 는 손댈 이유가
 *    없고, 어긋났다면 그 순간 「같은 자리」라는 전제가 깨진 것입니다. JS 가 잡는
 *    엘리먼트(#intake-doc-type · #erase-btn · #feat-timeline-panel …)도 전부 여기입니다.
 */
test('영문 4종이 국문과 같은 id 를 같은 순서로 갖는다', () => {
  for (const [ko, en] of EN_PAIRS) {
    const a = idSeq(read(ko));
    const b = idSeq(read(en));
    assert.deepStrictEqual(b, a,
      en + ' 의 id 순서가 ' + ko + ' 와 다릅니다 — 문구만 옮기는 것이 규칙입니다');
  }
});

test('영문 4종의 구조 차이가 적어 둔 것뿐이다', () => {
  for (const [ko, en] of EN_PAIRS) {
    const [dc, dt] = STRUCT_DELTA[en];
    const ca = classSeq(read(ko)).length;
    const cb = classSeq(read(en)).length;
    assert.strictEqual(cb - ca, dc,
      en + ' 의 class 속성 수 차이가 ' + (cb - ca) + ' 입니다 (적어 둔 값 ' + dc + ') — ' +
      '구조를 바꾸셨다면 STRUCT_DELTA 에 사유와 함께 적어 주십시오');
    const ta = tagSeq(read(ko)).length;
    const tb = tagSeq(read(en)).length;
    assert.strictEqual(tb - ta, dt,
      en + ' 의 태그 수 차이가 ' + (tb - ta) + ' 입니다 (적어 둔 값 ' + dt + ')');
  }
});

/*
 * 국문에만 있고 영문에 없는 한글. 영문 페이지의 **화면 문구**에 한글이 남아 있으면
 * 그 자리는 번역이 안 된 것입니다.
 * ⚠️ 주석은 걷고 봅니다 — 이 저장소는 주석을 인수인계 수단으로 쓰고 빌드가 떼어냅니다.
 * ⚠️ nav 의 언어 전환 링크(「한국어」)만 예외입니다. 그 글자가 한글인 것이 그 링크의 일입니다.
 */
test('영문 페이지의 화면 문구에 한글이 남아 있지 않다', () => {
  for (const en of EN_PAGES) {
    const text = body(read(en))
      .replace(/<a class="nav-quiet"[^>]*>[^<]*<\/a>/g, '')
      .replace(/<[^>]+>/g, ' ');
    const hit = text.match(/[가-힣][가-힣\s·]*/g);
    assert.ok(!hit, en + ' 에 번역되지 않은 한글이 있습니다: ' + JSON.stringify(hit && hit.slice(0, 5)));
  }
});

/*
 * 🔴 **영문 화면 문구에 em dash(—)를 쓰지 않습니다** 〔2026-08-17 · 대표 지시〕.
 *
 * 국문은 그대로 씁니다 — 이 규칙은 영문 문면에만 걸립니다. 영문 원고를 처음 옮길 때
 * 국문의 「—」 자리를 그대로 따라가 문장마다 붙어 있었고, 영문에서는 그 빈도가
 * 기계가 쓴 문장처럼 읽힙니다.
 *
 * 지울 때 **글자만 빼지 마십시오.** 자리마다 뜻이 다릅니다:
 *   문장 안의 삽입    → 마침표로 끊거나 쉼표로 잇습니다
 *   타이틀·옵션 구분  → 이 저장소가 이미 쓰는 가운뎃점(·)
 *   기관명 동격       → 쉼표
 *   대체 텍스트 설명  → 콜론
 *
 * ⚠️ en dash(–)는 **그대로 둡니다.** 숫자 범위(3–5 business days)에 쓰는 것이
 *    영문에서 옳은 표기이고, 지시하신 「—」와 다른 글자입니다.
 */
test('영문 화면 문구에 em dash 가 없다', () => {
  for (const f of EN_PAGES) {
    /* 주석은 뺍니다 — 인수인계 주석은 국문이고 거기 「—」가 자유롭게 쓰입니다. */
    const code = strip(read(f))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const hit = code.split('\n').filter((l) => l.includes('—'));
    assert.strictEqual(hit.length, 0,
      f + ' 에 em dash 가 있습니다:\n' + hit.map((l) => '    ' + l.trim().slice(0, 120)).join('\n'));
  }
  /* 고객에게 나가는 영문 메일·문면도 같은 규칙입니다 — 화면과 메일이 다른 문체를
     쓰면 같은 서비스로 안 읽힙니다. 국문 줄은 이 검사에서 뺍니다. */
  for (const f of ['api/_notify.js', 'api/_intake-route.js']) {
    const hit = read(f).split('\n')
      .filter((l) => l.includes('—') && !/[가-힣]/.test(l));
    assert.strictEqual(hit.length, 0,
      f + ' 의 영문 문면에 em dash 가 있습니다:\n' + hit.map((l) => '    ' + l.trim().slice(0, 120)).join('\n'));
  }
});

/* ── 이름 ─────────────────────────────────────────────────────────────────── */

test('en.html 상품 탭 3개가 국문 3상품과 1:1 로 대응한다', () => {
  const cards = section(M.en, 'cards-sec');
  const titles = (cards.match(/<span class="feat-title">([^<]*)<\/span>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').trim());
  assert.deepStrictEqual(titles, ['Export pre-check', 'Buyer check', 'Deadline tracking'],
    '상품 탭 이름이 다릅니다: ' + JSON.stringify(titles));

  /* 옛 **상품명** — 상품소개 섹션 안에 하나라도 살아 있으면 한 상품이 두 이름이 됩니다.
     ⚠️ 섹션 안으로만 봅니다. 「NDA comparison」은 05 근거 섹션의 캡션
        (「Current NDA comparison standard」)에서 **비교 기준의 이름**으로 쓰이는 정상
        문구이고, 그것까지 막으면 상품명이 아닌 서술을 상품명 규칙으로 잡게 됩니다. */
  for (const old of ['NDA comparison', 'Document comparison', 'Deadline management', 'badge-soon']) {
    assert.ok(cards.indexOf(old) === -1, '상품소개에 옛 이름이 남아 있습니다: ' + old);
  }
  /* 이 둘은 어디에도 쓸 데가 없습니다 — 04 카드와 07 로드맵이 같은 이름을 쓰던
     충돌의 원인이었고, 지금 이름 체계에 자리가 없습니다. */
  for (const old of ['Trade procedure tracking', 'Trade operations']) {
    assert.ok(B.en.indexOf(old) === -1, '옛 이름이 남아 있습니다: ' + old);
  }
});

test('en.html 기한관리가 그 자리에서 열린다 — 페이지 이동이 아니다', () => {
  const m = M.en;
  assert.ok(/<button[^>]*data-timeline-open[^>]*aria-controls="feat-timeline-panel"/.test(m),
    '기한관리 패널을 여는 트리거가 없습니다');
  assert.strictEqual((m.match(/id="feat-timeline-panel"/g) || []).length, 1,
    '기한관리 패널은 페이지에 하나뿐이어야 합니다');
  assert.ok(!/href="#interest"[^>]*>\s*Get notified\s*</.test(m),
    '옛 [ Get notified ] 링크가 남아 있습니다 — 인라인 확장으로 교체된 자리입니다');
});

/*
 * JS 가 죽어도 **상품 이름 3개와 첫 상품 설명**이 보여야 합니다 — 국문과 같은 조건입니다
 * (index.html `.feats` 머리주석). 탭 구조라 첫 탭이 선택된 채, 나머지 패널은 [hidden] 으로
 * 내려옵니다. ⛔ 옛 아코디언(`data-open` · grid-template-rows 0fr↔1fr)으로 되돌리지 마십시오.
 */
test('en.html 탭이 첫 탭 선택 + 나머지 hidden 으로 내려온다', () => {
  const cards = section(M.en, 'cards-sec');
  assert.strictEqual((cards.match(/aria-selected="true"/g) || []).length, 1,
    '기본 선택 탭이 하나가 아닙니다');
  assert.strictEqual((cards.match(/role="tabpanel"/g) || []).length, 3, '패널이 3개가 아닙니다');
  assert.strictEqual((cards.match(/role="tabpanel"[^>]*hidden/g) || []).length, 2,
    '첫 패널만 열린 채로 내려와야 합니다');
  assert.ok(cards.indexOf('data-open=') === -1,
    '옛 아코디언 속성(data-open)이 남아 있습니다');
});

test('en.html 로드맵 두 행이 기존 상품명을 재사용한다 — 국문과 같은 규칙', () => {
  const next = M.en.slice(M.en.indexOf('id="next"'));
  const block = next.slice(0, next.indexOf('</section>'));
  const names = (block.match(/<p class="rm-name">[\s\S]*?<\/p>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').replace(/^\d+/, '').trim());
  assert.deepStrictEqual(names, ['Export pre-check', 'Deadline tracking'],
    '로드맵 두 행이 상품명 재사용이 아닙니다: ' + JSON.stringify(names));
  /* 금액·오픈월 금지는 국문과 같습니다(test/roadmap-no-price.test.js 와 같은 취지). */
  assert.ok(!/₩|\$|\d+\s*월/.test(block), '로드맵에 금액·오픈월이 들어왔습니다');
});

test('en.html 안심 문구가 결 CTA 뒤, 상품소개 앞이다 — 국문과 같은 순서', () => {
  const b = B.en;
  const act = b.indexOf('id="act-title"');
  const assure = b.indexOf('id="assure-title"');
  const cards = b.indexOf('id="cards-title"');
  assert.ok(act !== -1 && assure !== -1 && cards !== -1, '기준 블록을 찾지 못했습니다');
  assert.ok(act < assure && assure < cards,
    '순서가 결 CTA → 안심 문구 → 상품소개 가 아닙니다');
  assert.strictEqual((b.match(/Find out what to check first/g) || []).length, 1,
    '같은 선언이 두 번 나옵니다');
});

test('en.html 푸터 태그라인이 한 기능만 말하지 않는다', () => {
  const tag = (M.en.match(/<span class="footer-meta">([^<]*)<\/span>/) || [])[1] || '';
  assert.ok(tag.indexOf('Buyer document pre-check') === -1,
    '태그라인이 3기능 중 하나만 말합니다: ' + tag);
  assert.ok(/check/i.test(tag) && /deadline/i.test(tag),
    '확인(문서대조·바이어확인)과 기한관리를 함께 담고 있지 않습니다: ' + tag);
});

/*
 * 🔴 **랜딩의 주 CTA 는 사전 확인(/en-check)을 경유합니다** 〔구조결정 A안 · 2026-08-16〕.
 *    옛 en.html 은 `/precheck?lang=en` 으로 **국문 접수 폼**에 곧장 보냈고, 도착지에서
 *    「이 폼은 한국어 전용」 안내를 만나는 흐름이었습니다. 이제 영문 경로가 끝까지
 *    영문입니다. ⛔ `?lang=en` 을 영문 페이지에 되살리지 마십시오.
 *
 * 🔄 **대상을 손으로 적지 않고 EN_PAGES 를 씁니다** 〔2026-08-17〕.
 *    종전에는 영문 4개를 손으로 적었고 `en-privacy.html` 하나가 빠져 있었습니다.
 *    그 빠진 페이지에서 실제로 두 링크가 국문으로 새고 있었는데도(`/precheck` ·
 *    `/refund`) 검사가 조용히 통과했습니다 — 목록에서 빠진 페이지는 검사받지 않습니다.
 *    상수의 유래와 왜 손목록을 없앴는지는 이 파일 EN_PAGES 정의부를 보십시오.
 */
test('영문 경로가 끝까지 영문이다 — 국문 페이지로 새지 않는다', () => {
  const KO_ONLY = ['/precheck', '/check', '/refund', '/privacy'];
  for (const en of EN_PAGES) {
    /*
     * ⚠️ **언어 전환 링크(`hreflang="ko"`)만 예외입니다** 〔2026-08-21〕. 그 링크가 국문
     *    짝을 가리키는 것이 **그 링크의 일**입니다 — en.html 의 「한국어」가 `/` 를 가리켜
     *    통과하던 것과 같은 자리이고, 하위 6쌍에 헤더 언어 전환을 넣으면서(우하단에 떠
     *    있던 [English] 알약 대체 · assets/lang-switch.js) 그 링크가 `/privacy`·`/check`
     *    처럼 KO_ONLY 목록에 든 경로를 직접 가리키게 됐습니다.
     * 🔴 **클래스가 아니라 `hreflang` 으로 가립니다.** `.nav-quiet` 로 가리면 그 클래스를
     *    입은 아무 링크나 이 검사를 빠져나갑니다. `hreflang="ko"` 는 「이것은 이 페이지의
     *    국문판이다」라는 선언이고, 아래 hreflang 검사가 그 선언이 실제로 짝을 이루는지
     *    따로 단정합니다 — 두 검사가 서로를 받칩니다.
     * ⛔ 예외를 KO_ONLY 에서 경로를 빼는 방식으로 만들지 마십시오. 그러면 본문 링크가
     *    국문으로 새는 것까지 같이 통과합니다(이 검사의 본래 목적입니다).
     */
    const scanned = strip(read(en)).replace(/<a[^>]*hreflang="ko"[^>]*>[^<]*<\/a>/g, '');
    const hrefs = [...scanned.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
    for (const h of hrefs) {
      const path = h.split(/[?#]/)[0];
      assert.ok(!KO_ONLY.includes(path),
        en + ' 에 국문 페이지로 가는 링크가 있습니다: ' + h);
    }
    /* ⚠️ CSS·JS 주석까지 걷고 봅니다. en-precheck.html 은 `.lang-notice` **CSS 규칙**을
          국문과 1:1 로 두려고 남겨 뒀고, 그 블록의 주석이 `?lang=en` 을 인용합니다 —
          주석을 안 걷으면 그 인용이 오탐이 됩니다(이 파일 머리 ⚠️ 와 같은 이유). */
    const code = strip(read(en))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.ok(code.indexOf('lang=en') === -1,
      en + ' 에 `?lang=en`(국문 폼 안내 배너 스위치)이 남아 있습니다');
  }
  /* 히어로·결 CTA 둘 다 사전 확인을 지납니다 — 국문(/check)과 같은 배선입니다. */
  const heroCta = /<a id="hero-cta"[^>]*href="\/en-check"/.test(M.en);
  assert.ok(heroCta, 'en.html 히어로 CTA 가 /en-check 로 가지 않습니다');
  assert.ok(/<a class="btn btn-primary btn-full" href="\/en-check">/.test(section(M.en, 'act')),
    'en.html 결 CTA 가 /en-check 로 가지 않습니다');
});

/*
 * 🔴 **로그인 영역의 색·크기는 페이지의 `.nav-quiet` 가 갖습니다** 〔2026-08-21〕.
 *
 * `assets/auth.js` 는 헤더 링크 3개(로그인 · 나의 대시보드 · 로그아웃)를
 * `class="nav-quiet ta-link"` 로 그립니다 — 색과 글자 크기 사본을 auth.css 에 두지 않아서
 * 같은 줄 왼쪽의 [EN]·[한국어] 와 회색이 갈리지 않습니다. 대신 **의존이 파일을 건넙니다**:
 * 규칙은 각 페이지의 <style> 안에 있고, 쓰는 곳은 별 파일(auth.js)입니다.
 *
 * 이 검사가 막는 것은 **조용한 실패**입니다. `.nav-quiet` 를 지우면 링크 3개가 색·크기를
 * 잃고 브라우저 기본 파란 링크로 돌아가는데, 그 상태는 **로그인한 사람에게만** 보여서
 * 개발 중에 눈에 띄지 않습니다. 실제로 check.html 이 2026-08-19 에 「쓰는 자리가 없어졌다」며
 * 이 규칙을 걷은 전례가 있습니다(그때는 로그인 영역이 그 페이지에 없어서 무해했습니다).
 */
test('로그인 영역을 싣는 페이지는 .nav-quiet 규칙을 갖는다 — auth.js 가 그 클래스로 그린다', () => {
  const authJs = read('assets/auth.js');
  assert.ok(authJs.indexOf("'nav-quiet ta-link'") !== -1 ||
    authJs.indexOf('class="nav-quiet ta-link"') !== -1,
    'auth.js 가 더는 .nav-quiet 를 쓰지 않습니다 — 그렇다면 이 검사와 두 페이지의 주석을 ' +
    '같이 걷으십시오(auth.css 가 색·크기를 되찾아야 합니다)');

  const pages = STATIC_PAGES.map((p) => p.file).filter((f) => read(f).indexOf('/assets/auth.js') !== -1);
  assert.ok(pages.length >= 2,
    '로그인 영역을 싣는 페이지가 ' + pages.length + '개입니다(index·en 최소 2개) — ' +
    '목록이 비면 이 검사가 한 바퀴도 안 돌면서 초록이 됩니다: ' + JSON.stringify(pages));

  for (const f of pages) {
    const css = read(f);
    assert.ok(/\.nav-quiet\s*\{[^}]*font-size:\s*14px/.test(css),
      f + ' 에 `.nav-quiet` 규칙이 없습니다 — 로그인 영역의 링크 3개가 색·크기를 잃습니다');
    assert.ok(/\.nav-quiet:hover\s*\{/.test(css),
      f + ' 에 `.nav-quiet:hover` 가 없습니다 — 링크 3개가 hover 를 잃습니다');
  }
});

/*
 * 언어 짝 — hreflang 은 **양쪽이 서로를 가리켜야** 검색엔진이 인정합니다.
 * 한쪽만 넣으면 무시되고, 그 실패는 화면이 멀쩡해서 몇 주 뒤에 발견됩니다.
 */
test('국문·영문이 hreflang 으로 서로를 가리킨다', () => {
  const PAIRS = [
    ['index.html', 'en.html', 'https://trops.kr/', 'https://trops.kr/en'],
    ['check.html', 'en-check.html', 'https://trops.kr/check', 'https://trops.kr/en-check'],
    ['precheck.html', 'en-precheck.html', 'https://trops.kr/precheck', 'https://trops.kr/en-precheck'],
    ['refund.html', 'en-refund.html', 'https://trops.kr/refund', 'https://trops.kr/en-refund'],
    // 영문 2종 추가 〔2026-08-20〕.
    ['nda.html', 'en-nda.html', 'https://trops.kr/nda', 'https://trops.kr/en-nda'],
    ['uae.html', 'en-uae.html', 'https://trops.kr/uae', 'https://trops.kr/en-uae'],
  ];
  for (const [ko, en, koUrl, enUrl] of PAIRS) {
    for (const [file, label] of [[ko, '국문'], [en, '영문']]) {
      const m = strip(read(file));
      for (const [lang, url] of [['ko', koUrl], ['en', enUrl], ['x-default', koUrl]]) {
        assert.ok(
          m.indexOf('<link rel="alternate" hreflang="' + lang + '" href="' + url + '">') !== -1,
          file + '(' + label + ') 에 hreflang="' + lang + '" → ' + url + ' 이 없습니다'
        );
      }
    }
  }
});

/*
 * 🔴 **접수 폼의 계약은 언어와 무관합니다** — `name=` 은 서버(api/intake.js)가 읽는
 *    이름이고, `data-doctype` 은 사전 확인이 넘기는 값을 받는 자리이며, 문서 종류
 *    <option> 의 `value`·`disabled` 는 서버 목록(DOC_TYPES)과 짝입니다.
 *    영문판에서 **라벨만** 바뀌어야 하고, 하나라도 옮기면 영문 접수만 조용히 400 이 됩니다.
 */
test('en-precheck 의 폼 계약이 국문과 글자 그대로 같다', () => {
  const ko = strip(read('precheck.html'));
  const en = strip(read('en-precheck.html'));

  const names = (s) => (s.match(/\sname="[^"]+"/g) || []);
  assert.deepStrictEqual(names(en), names(ko), 'name= 이 다릅니다');

  const doctypes = (s) => (s.match(/\sdata-doctype="[^"]+"/g) || []);
  assert.deepStrictEqual(doctypes(en), doctypes(ko), 'data-doctype 이 다릅니다');

  /* <option> 의 value·selected·disabled. 라벨(텍스트)만 떼고 비교합니다. */
  const opts = (s) => (s.match(/<option[^>]*>/g) || []);
  assert.deepStrictEqual(opts(en), opts(ko), '<option> 의 value·selected·disabled 가 다릅니다');

  assert.ok(en.indexOf('name="preSessionKey"') !== -1, '사전 확인 세션키 필드가 사라졌습니다');
});

/*
 * 가격 노출 위치 — 국문과 **같은 자리**여야 합니다. `.pay-area` 는 유료 경로를 고른
 * 뒤에만 열리므로, 이용자가 금액을 보는 시점은 결제수단을 입력하는 화면 하나뿐입니다
 * (흐름 md §0-2 「비용 노출 없음」). ⛔ 이 영역 밖으로 옮기지 마십시오.
 */
test('en-precheck 의 가격이 국문과 같은 자리에만 있다', () => {
  const en = body(read('en-precheck.html'));
  const payArea = en.slice(en.indexOf('id="pay-area"'), en.indexOf('id="intake-submit"'));
  assert.ok(payArea.indexOf('₩330,000') !== -1, '결제 영역에 금액이 없습니다');

  /* 화면에 보이는 곳은 결제 영역과, 두 겹으로 닫힌 .plans 카드뿐입니다. */
  const outside = en.replace(payArea, '').replace(/<div class="plans"[\s\S]*?<\/div>\s*<\/label>\s*<\/div>/, '');
  assert.ok(outside.indexOf('₩330,000') === -1,
    '가격이 결제 영역 밖에 노출됐습니다 — 접수를 시작하기도 전에 금액을 마주칩니다');
});
