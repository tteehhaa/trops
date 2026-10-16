/*
 * 메뉴 · 화면 이동 점검(IA v4) 피드백 반영 검사 〔신설 2026-10-16 · 대표 승인 «추천한대로»〕
 *
 *   npm test        (node --test test/)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **무엇을 지키는가 — 누른 이름대로 가고, 같은 곳은 같은 이름으로 부른다**
 * ══════════════════════════════════════════════════════════════════════════════
 * 2026-10-16 아침 점검 보고서(`trops-ia-v4-easy-report.pdf` · 수정 전 라이브)가 trops.kr 쪽에서 짚은 것을
 * 랜딩만으로 고칠 수 있는 범위에서 고쳤고, 이 파일이 그 상태를 잠급니다. 축은 여덟입니다.
 *   ① 맨 위 메뉴 순서 = 페이지 순서(이용 방법 → 제품 → 수출 자료 → 자주 묻는 질문 → 문의). 종전에는 메뉴가
 *      「제품 → 이용 방법」인데 페이지는 그 반대였습니다(보고서 개선 7).
 *      ⚠️ 순서는 **본문에서 파생**해 맞댑니다 — 기대값을 두 번 적으면 한쪽만 고쳐도 초록이 됩니다.
 *   ② 지금 보는 구획 표시 — `assets/nav-current.js` 가 보이는 구획의 메뉴에 `aria-current` 를 답니다(개선 7).
 *   ③ 맨 아래 중복 링크 — 「개인정보처리방침 ↗」·「이용약관 ↗」 줄(`trust-line`)을 걷어, 정책 링크가 한 번씩만 섭니다.
 *      「↗」가 붙어 있어도 같은 탭에서 열렸으므로 표시도 함께 걷었습니다(개선 7).
 *   ④ 자료 카드 — 세 장 가운데 두 장이 같은 `/guide` 로 갔습니다(처음에 헷갈리는 메뉴). 이제 세 장이 **서로 다른**
 *      안내서 화면으로 가고, 카드 이름은 열리는 화면의 제목과 같습니다(2026-10-16 운영 앱 안내서의 h1 실측).
 *      영문 카드는 한국어 화면으로 넘어간다는 것을 「(Korean)」으로 미리 알립니다(개선 6).
 *   ⑤ FAQ 앱 링크 — 요금 답의 「앱에서 확인하기 →」가 요금이 없는 「오늘」 화면을 열었습니다(개선 1 · 흐름 끊김).
 *      링크 이름에 실제로 가야 할 자리(로그인 후 계정 메뉴 «요금제»)를 적었습니다 — 주소는 그대로 앱 루트입니다
 *      (보고서 «고친 예시» T01). 시작 답의 링크는 앱 입구 이름 「TROPS 시작하기」로 맞췄습니다(개선 3).
 *      ⚠️ 영문은 「«요금제»」를 쓰지 않고 «the plan page» 로 적었습니다 — 영문 화면에 한글 0
 *         (`i18n-parity.test.js` ②)이 먼저 선 규칙이고, 예외는 언어 전환 링크 하나뿐입니다.
 *   ⑥ 영문 업무 카드의 「The app interface is in Korean.」 — PR #32 가 국문 안내 한 줄을 걷으며 영문 짝도 함께 걷었는데,
 *      영문에서는 그 문장이 «한국어로 넘어간다»는 예고였습니다. 그 예고만 되살렸습니다(국문에는 없습니다).
 *   ⑦ 영문 「Contact」 — 메일 프로그램이 열리는데 이름은 «문의 화면»처럼 보였습니다(개선 6). 목적지(메일)는
 *      `pilot-apply-form.test.js` 「문의·교육·파트너 입구」가 잠근 결정이라 그대로 두고, 이름을 «Email us» 로 바꿨습니다.
 *   ⑧ 앱 입구 이름 하나 — 회사 소개 「신청하기」·「앱 열기 ↗」, 문의 「앱 열기 ↗」가 모두 같은 앱 루트로 갔습니다(개선 3).
 *      한 이름 「TROPS 시작하기」로 맞췄습니다. ⚠️ 집계 이름(`nav-join` · `nav-app`)은 **그대로**입니다 — 이름을 바꾸면
 *      그 시계열이 끊깁니다(`assets/track.js` 머리주석).
 *   ⑨ 회사 소개 큰 제목 〔🔄 2026-10-17 · 다시 점검한 뒤 대표 승인〕 — 「회사 소개」를 누르면 큰 제목이
 *      「수출 실무를 더 쉽게, TROPS AI」였습니다(작은 꼬리표만 「회사 소개」 · «누른 이름과 열린 화면 제목»).
 *      큰 제목을 「회사 소개」로, 한 줄 약속(`publicCopy.headline`)은 바로 아래 부제로 옮겼습니다.
 *   ⑩ 영문 마감 «Start with TROPS» 옆 한국어 예고 〔🔄 2026-10-17〕 — ⑥의 예고는 업무 카드에만 있어 마지막 버튼은
 *      아무 말 없이 한국어 화면으로 갔습니다(개선 6). ⚠️ 맨 위 메뉴 버튼에는 싣지 않았습니다 — 자리가 좁고 그 치수는
 *      앱 저장소 `landing-entry-header` 가 잽니다. ⛔ `hreflang="ko"` 로 대신하지 마십시오 — 그 속성을 누르면
 *      `assets/lang-switch.js` 가 국문 쿠키를 심습니다(언어 전환 링크 전용 · `i18n-parity.test.js`).
 *
 * ⛔ **이 저장소에서 할 수 없는 것 — 앱 쪽 작업입니다(이 파일이 재지 않습니다)**
 *    · 요금을 누구나 볼 수 있는 화면(보고서 개선 1 의 근본 해결) — 랜딩은 금액을 직접 싣지 않습니다(`price-exposure.test.js`).
 *    · 안내서(app.trops.kr/guide) 머리의 홈페이지 메뉴 · 로고 · 현재 위치(개선 2).
 *    그 둘이 앱에 서는 날, ⑤의 요금 링크 목적지와 ④의 카드 설명을 함께 다시 보십시오.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** 사람 눈에 보이는 마크업만 — 주석 · `<style>` · `<script>` 를 걷습니다(이 저장소는 주석에 옛 문자열을 인용합니다). */
const body = (f) => read(f).replace(/<!--[\s\S]*?-->/g, '').replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/g, '');
const block = (html, re, label) => {
  const m = html.match(re);
  assert.ok(m, label + ' 을(를) 찾지 못했습니다 — 검사가 낡았습니다');
  return m[0];
};
const count = (s, needle) => s.split(needle).length - 1;

const APP = 'https://app.trops.kr/';
const LANDINGS = {
  'index.html': {
    nav: ['이용 방법', '제품', '수출 자료', '자주 묻는 질문', '문의하기'],
    contact: '/contact',
    cards: ['수출절차 안내서', '지자체 수출보험료 지원사업', '헷갈리는 용어'],
    footerGuide: '수출절차 안내서',
    faq: ['TROPS 시작하기 →', '로그인 후 계정 메뉴 «요금제»에서 확인하기 →'],
    retired: '앱에서 확인하기',
  },
  'en.html': {
    nav: ['How it works', 'Product', 'Resources', 'FAQ', 'Email us'],
    contact: 'mailto:contact@theo-ne.com',
    cards: ['Export procedure guide', 'Local export insurance premium support', 'Confusing export terms'],
    footerGuide: 'Export procedure guide (Korean)',
    faq: ['Start with TROPS →', 'Sign in, then open the plan page in your account menu →'],
    retired: 'Open the app',
  },
};
/** 맨 위 메뉴가 가리키는 구획 — 순서는 본문에서 파생해 맞댑니다(아래 ①). */
const SECTION_IDS = ['workspace-flow', 'product', 'resources', 'faq'];
/** 자료 카드 세 장 — 서로 다른 안내서 화면 · 집계 이름. */
const CARDS = [
  { href: APP + 'guide', track: 'resource-documents' },
  { href: APP + 'guide/support', track: 'resource-support' },
  { href: APP + 'guide/glossary', track: 'resource-glossary' },
];

for (const [file, want] of Object.entries(LANDINGS)) {
  test(`① ${file} 맨 위 메뉴 순서가 페이지 순서와 같다 — 이름 · 목적지`, () => {
    const h = body(file);
    const menu = block(block(h, /<nav[\s\S]*?<\/nav>/, file + ' 의 nav'), /<div class="m">[\s\S]*?<\/div>/, file + ' 의 메뉴(.m)');
    const links = [...menu.matchAll(/<a\b([^>]*)>([^<]+)<\/a>/g)].map((m) => ({
      href: (m[1].match(/href="([^"]+)"/) || [])[1], attrs: m[1], text: m[2].trim(),
    }));
    assert.deepEqual(links.map((l) => l.text), want.nav, file + ': 메뉴 이름 · 순서가 다릅니다');
    assert.deepEqual(links.slice(0, 4).map((l) => l.href), SECTION_IDS.map((id) => '#' + id), file + ': 메뉴가 가리키는 구획이 다릅니다');
    assert.equal(links[4].href, want.contact, file + ': 문의 메뉴의 목적지가 다릅니다');
    assert.ok(links[4].attrs.includes('data-track="nav-contact"'), file + ': 문의 메뉴의 집계 이름이 빠졌습니다');
    /* 본문에서 그 구획들이 서는 순서 — 메뉴 순서와 같아야 합니다(기대값을 두 번 적지 않습니다). */
    const positions = SECTION_IDS.map((id) => {
      const at = h.indexOf('id="' + id + '"');
      assert.ok(at !== -1, file + ': 본문에 #' + id + ' 이 없습니다');
      return { id, at };
    });
    const bodyOrder = [...positions].sort((a, b) => a.at - b.at).map((p) => p.id);
    assert.deepEqual(links.slice(0, 4).map((l) => l.href.slice(1)), bodyOrder, file + ': 메뉴 순서가 본문 순서와 다릅니다');
  });

  test(`② ${file} 지금 보는 구획을 메뉴에 표시하는 스크립트를 싣는다`, () => {
    assert.ok(read(file).includes('<script defer src="/assets/nav-current.js"></script>'), file + ': nav-current.js 를 싣지 않습니다');
  });

  test(`③ ${file} 맨 아래 정책 링크가 한 번씩만 서고 「↗」가 없다`, () => {
    const footer = block(body(file), /<footer[\s\S]*?<\/footer\s*>/, file + ' 의 footer');
    assert.ok(!footer.includes('class="trust-line"'), file + ': 중복 정책 링크 줄(trust-line)이 남아 있습니다');
    assert.equal(count(footer, 'href="' + APP + 'privacy"'), 1, file + ': 개인정보처리방침 링크가 한 번이 아닙니다');
    assert.equal(count(footer, 'href="' + APP + 'terms"'), 1, file + ': 이용약관 링크가 한 번이 아닙니다');
    assert.ok(!footer.includes('↗'), file + ': 맨 아래에 「↗」가 남아 있습니다(같은 탭에서 열립니다)');
  });

  test(`④ ${file} 자료 카드 세 장이 서로 다른 안내서 화면으로 가고 이름이 그 화면 제목과 같다`, () => {
    const h = body(file);
    const res = block(h, /<section id="resources"[\s\S]*?<\/section>/, file + ' 의 자료 구획');
    const cards = [...res.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
      href: (m[1].match(/href="([^"]+)"/) || [])[1],
      track: (m[1].match(/data-track="([^"]+)"/) || [])[1],
      title: ((m[2].match(/<b>([^<]+)<\/b>/) || [])[1] || '').trim(),
      em: ((m[2].match(/<em>([^<]+)<\/em>/) || [])[1] || '').trim(),
    }));
    assert.equal(cards.length, 3, file + ': 자료 카드가 세 장이 아닙니다');
    assert.equal(new Set(cards.map((c) => c.href)).size, 3, file + ': 같은 곳으로 가는 카드가 있습니다');
    assert.deepEqual(cards.map((c) => c.href), CARDS.map((c) => c.href), file + ': 카드 목적지가 다릅니다');
    assert.deepEqual(cards.map((c) => c.track), CARDS.map((c) => c.track), file + ': 카드 집계 이름이 다릅니다');
    assert.deepEqual(cards.map((c) => c.title), want.cards, file + ': 카드 이름이 안내서 화면 제목과 다릅니다');
    if (file === 'en.html') {
      for (const c of cards) assert.ok(c.em.includes('(Korean)'), file + ': 한국어 화면으로 가는 카드에 「(Korean)」이 없습니다 — ' + c.title);
    }
    const footer = block(h, /<footer[\s\S]*?<\/footer\s*>/, file + ' 의 footer');
    assert.ok(footer.includes('<a href="' + APP + 'guide">' + want.footerGuide + '</a>'),
      file + ': 맨 아래 안내서 링크 이름이 「' + want.footerGuide + '」 가 아닙니다');
  });

  test(`⑤ ${file} FAQ 앱 링크 이름이 실제로 가야 할 자리를 말한다`, () => {
    const h = body(file);
    assert.ok(!h.includes(want.retired), file + ': 「' + want.retired + '」 링크가 남아 있습니다');
    const faq = block(h, /<section id="faq"[\s\S]*?<\/section>/, file + ' 의 FAQ');
    for (const text of want.faq) {
      assert.ok(faq.includes('<a href="' + APP + '">' + text + '</a>'), file + ': FAQ 링크 「' + text + '」 가 앱 루트로 서 있지 않습니다');
    }
  });
}

test('② 구획 표시 스크립트가 있고 aria-current 를 보이는 구획으로 단다', () => {
  const f = path.join(ROOT, 'assets', 'nav-current.js');
  assert.ok(fs.existsSync(f), 'assets/nav-current.js 가 없습니다');
  const s = fs.readFileSync(f, 'utf8');
  assert.ok(s.includes('aria-current'), 'nav-current.js 가 aria-current 를 쓰지 않습니다');
  assert.ok(s.includes('IntersectionObserver'), 'nav-current.js 가 IntersectionObserver 로 구획을 보지 않습니다');
});

test('⑥ 영문 업무 카드만 한국어 화면 예고를 싣는다', () => {
  const picker = (file) => block(block(body(file), /<header class="hero"[\s\S]*?<\/header>/, file + ' 의 hero'),
    /<div class="start-picker"[\s\S]*?<\/ul><\/div>/, file + ' 의 업무 카드');
  assert.ok(picker('en.html').includes('<p class="start-picker-note">The app interface is in Korean.</p>'),
    'en.html: 업무 카드에 한국어 화면 예고가 없습니다');
  assert.ok(!picker('index.html').includes('start-picker-note'), 'index.html: 업무 카드에 안내 줄이 되살아났습니다(PR #32 대표 지시로 걷음)');
});

test('⑦ 영문 맨 아래 문의 링크 이름이 «메일»을 말한다', () => {
  assert.ok(body('en.html').includes('<a href="mailto:contact@theo-ne.com" data-track="footer-contact">Email us · Training · Partners</a>'),
    'en.html: 맨 아래 문의 링크가 「Email us · Training · Partners」 가 아닙니다');
});

test('⑧ 회사 소개 · 문의 머리의 앱 입구가 「TROPS 시작하기」 하나다 — 집계 이름은 그대로', () => {
  const aboutNav = block(body('about.html'), /<nav[\s\S]*?<\/nav>/, 'about.html 의 nav');
  const aboutApp = [...aboutNav.matchAll(/<a\b[^>]*href="https:\/\/app\.trops\.kr\/"[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]);
  assert.equal(aboutApp.length, 1, 'about.html: 머리에 앱 입구가 ' + aboutApp.length + '개입니다(하나여야 합니다)');
  assert.ok(/class="btn btn-s"/.test(aboutApp[0]) && aboutApp[0].includes('data-track="nav-join"') && />TROPS 시작하기<\/a>$/.test(aboutApp[0]),
    'about.html: 앱 입구가 「TROPS 시작하기」(btn btn-s · nav-join) 가 아닙니다 — ' + aboutApp[0]);
  assert.ok(!/신청하기|앱 열기/.test(aboutNav), 'about.html: 머리에 옛 입구 이름이 남아 있습니다');

  const contactNav = block(body('contact.html'), /<nav[\s\S]*?<\/nav>/, 'contact.html 의 nav');
  assert.ok(contactNav.includes('<a class="nav-login" href="https://app.trops.kr/" data-track="nav-app">TROPS 시작하기</a>'),
    'contact.html: 머리의 앱 입구가 「TROPS 시작하기」(nav-login · nav-app) 가 아닙니다');
  assert.ok(!contactNav.includes('앱 열기'), 'contact.html: 머리에 「앱 열기」가 남아 있습니다');
});

test('⑨ 회사 소개의 큰 제목이 누른 이름 「회사 소개」다 — 한 줄 약속은 부제로 남는다', () => {
  const hero = block(body('about.html'), /<header class="hero"[\s\S]*?<\/header>/, 'about.html 의 첫 화면');
  const h1 = [...hero.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].trim());
  assert.deepEqual(h1, ['회사 소개'], 'about.html: 큰 제목이 「회사 소개」 하나가 아닙니다 — ' + JSON.stringify(h1));
  assert.ok(hero.includes('<p class="hero-sub">{{publicCopy.headline}}</p>'),
    'about.html: 한 줄 약속(publicCopy.headline)이 부제로 남아 있지 않습니다');
  assert.ok(!hero.includes('class="eyebrow"'), 'about.html: 큰 제목과 같은 말을 하는 작은 꼬리표가 되살아났습니다');
});

test('⑩ 영문 마감 «Start with TROPS» 옆에 한국어 화면 예고가 있다 — 국문에는 없다', () => {
  const fin = (file) => block(body(file), /<section class="fin"[\s\S]*?<\/section>/, file + ' 의 마감 CTA');
  assert.ok(fin('en.html').includes('<p class="final-note">The app interface is in Korean.</p>'),
    'en.html: 마감 CTA 에 한국어 화면 예고가 없습니다');
  assert.ok(!fin('index.html').includes('final-note'), 'index.html: 마감 CTA 에 영문 전용 예고가 들어왔습니다');
  assert.ok(!/<a[^>]*href="https:\/\/app\.trops\.kr\/"[^>]*hreflang=/.test(read('en.html')),
    'en.html: 앱 링크에 hreflang 이 붙었습니다 — 그 속성은 언어 전환 링크 전용입니다');
});
