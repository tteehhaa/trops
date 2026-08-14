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

  // en.html 은 아직 04 2층카드 구조입니다 — 그쪽 단언은 옛 형태 그대로 둡니다.
  const enCards = section(M.en, 'cards-sec');
  const enTitles = (enCards.match(/<span class="card-title">([^<]*)<\/span>/g) || []);
  assert.strictEqual(enTitles.length, 2,
    'en.html 의 04 카드 상태줄이 ' + enTitles.length + '개입니다 — 두 카드 모두 필요합니다');
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
   * 🔄 4 → 3. 옛 04 2층카드의 트리거가 위 사유로 사라졌습니다.
   * ⚠️ **B.index(본문)로 셉니다.** M.index 는 HTML 주석만 걷으므로 <style>·<script>
   *    안의 주석에 인용된 [data-timeline-open] 이 그대로 섞여 들어옵니다 — 그러면
   *    트리거를 지워도 이 검사가 통과합니다(실제로 그런 상태였습니다).
   */
  const triggers = (B.index.match(/data-timeline-open/g) || []).length;
  assert.strictEqual(triggers, 3,
    '트리거가 ' + triggers + '개입니다 — 히어로·로드맵·마감 CTA 세 곳이어야 합니다');
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
  const how = b.indexOf('HOW IT WORKS');

  for (const [n, v] of [['hero', hero], ['stories', stories], ['warn', warn],
    ['act', act], ['assure', assure], ['how', how]]) {
    assert.ok(v !== -1, '기준 블록을 찾지 못했습니다: ' + n);
  }
  // 감정선 기 - 승 - 전 - 결이 끊기지 않고 이어지는가.
  assert.ok(hero < stories && stories < warn && warn < act,
    '감정선 순서가 기(히어로) - 승(경험담) - 전(경고) - 결(행동)이 아닙니다');
  assert.ok(assure > act,
    '안심 문구가 감정선 안에 끼어 있습니다 — 결(행동) 다음이어야 방어가 아니라 안심으로 읽힙니다');
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
