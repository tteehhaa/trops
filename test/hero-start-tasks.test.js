/*
 * 히어로 «어떤 업무부터 시작할까요?» 세 갈래 검사 〔신설 2026-10-16 · 대표 결정〕
 *
 *   npm test        (node --test test/)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **무엇을 지키는가 — 랜딩에서 고른 업무가 앱에서 «그 업무»로 이어진다**
 * ══════════════════════════════════════════════════════════════════════════════
 * 대표 결정(2026-10-16): uibowl 레퍼런스 가운데 **토스페이먼츠형 히어로**를 골랐습니다 — 첫 화면에서
 * 질문 하나(「어떤 업무부터 시작할까요?」)에 답하면 바로 시작하는 모양입니다. 같은 배치에서 제품 탭 세 개를
 * 01·02·03 기능 블록으로 펼쳤습니다(그 축은 `pilot-apply-form.test.js` · `landing-invariants.test.js` ⑥).
 *
 * 세 갈래는 **앱 비로그인 홈이 내보내는 링크와 글자 하나 다르지 않게** 적었습니다 — 2026-10-16 운영
 * `https://app.trops.kr/` 비로그인 홈이 실제로 내보낸 `href` 세 개를 그대로 옮겼습니다(견적서 만들기 ·
 * 지원사업 보기 · 자료 올리기). 모양은 `/login?next=/?go=<고른 일>` 이고:
 *   · 로그인 전 → 로그인(가입) → 홈이 `go` 를 그 회사 id 로 채워 보냅니다(회사가 없으면 «회사 만들기» 뒤).
 *   · 이미 로그인 → `/login` 이 곧바로 `next` 로 보냅니다(`app/login/page.tsx` · `safeNextPath`).
 * 그래서 **앱을 고치지 않고** 랜딩만으로 이어집니다.
 *
 * ⚠️ **지원사업 갈래는 앱 환경값에 기대고 있습니다** — 앱의 `startTaskTarget("support")` 는
 *    `SELF15_SUPPORT_ENABLED`(또는 `SELF15_SUPPORT_REVIEW_ENABLED`)가 켜져 있으면 회사 안 화면
 *    (`/organizations/{org}/support`), 꺼져 있으면 공개 안내(`/guide/support`)를 돌려줍니다.
 *    2026-10-16 운영은 **켜져 있었습니다**(비로그인 홈이 회사 안 경로를 내보냈습니다).
 *    🔴 **그 스위치가 꺼지는 날 랜딩 링크를 `/guide/support` 로 바꾸십시오** — 그대로 두면 로그인 뒤
 *       회사 안 화면이 `notFound()` 로 404 입니다. 랜딩은 앱 환경값을 읽을 수 없어 이 검사가 그걸 대신
 *       재지 못합니다(아래 ③은 «코드의 두 갈래»만 맞댑니다).
 *
 * ⛔ 히어로 안에 입력칸 · 단추 · 폼은 여전히 0 입니다(`pilot-apply-form.test.js` 「화면 예시는 입력 없는
 *    이미지」). 세 갈래는 **링크**입니다 — 자유 입력은 앱이 받을 자리가 없고, 적은 글이 주소에 남아
 *    기록에 찍히므로 이번에 싣지 않았습니다.
 * ⚠️ 시작 버튼 `hero-start` 는 앱 루트 그대로입니다(`landing-invariants.test.js` · `from-source.test.js`).
 *
 * 🔄 **세 갈래를 바꿨습니다** 〔2026-10-28 · 대표 결정 — IR 덱 «수출팀 없는 회사의 AI 수출팀»에 맞춤〕
 *    수출 1건 올리기(회사 홈) · 받을 돈 보기(받을 돈) · 서류 만들기(견적서) 순서입니다. 지원사업은 카드에서
 *    내려 **카드 아래 작은 링크**가 됐습니다(같은 링크 · 같은 집계 이름 `hero-task-support`).
 *    · 받을 돈(`/organizations/{org}/receivables`)은 앱 비로그인 홈 카드에는 없지만 앱 «대금·보험» 메뉴의 주소라
 *      앱 `guestGoTarget` 이 그대로 받고, 로그인 화면이 «대금·보험» 화면으로 간다고 알려 줍니다(앱 수정 0).
 *    · 링크 모양은 여전히 앱 `guestLoginHrefFor` 와 같습니다(아래 ①). 다만 **카드 구성은 이제 앱 홈과 다릅니다** —
 *      앱 `START_TASKS` 를 이 순서로 맞추고 히어로 아래 화면 사진을 다시 찍는 일은 앱 저장소 몫으로 남았습니다.
 *      그날 아래 ③에 «앱 START_TASKS 순서 = 랜딩 순서» 검사를 되살리십시오.
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

const LANDINGS = ['index.html', 'en.html'];
const APP = 'https://app.trops.kr';

/**
 * 🔴 **글자 그대로의 정본** — 2026-10-16 운영 앱 비로그인 홈이 내보낸 링크입니다(앞에 앱 오리진만 붙였습니다).
 * `target` 은 그 링크가 싣는 «고른 일»입니다. 둘이 서로 맞는지는 아래 ①이 잽니다(손으로 적은 두 값이 갈리지 않게).
 */
const TASKS = [
  {
    key: 'upload',
    target: '/organizations/{org}/home',
    href: APP + '/login?next=%2F%3Fgo%3D%252Forganizations%252F%257Borg%257D%252Fhome',
  },
  {
    key: 'receivables',
    target: '/organizations/{org}/receivables',
    href: APP + '/login?next=%2F%3Fgo%3D%252Forganizations%252F%257Borg%257D%252Freceivables',
  },
  {
    key: 'quote',
    target: '/organizations/{org}/documents/proforma',
    href: APP + '/login?next=%2F%3Fgo%3D%252Forganizations%252F%257Borg%257D%252Fdocuments%252Fproforma',
  },
];

/** 지원사업 — 카드가 아니라 카드 아래 작은 링크입니다(2026-10-28). 링크 모양과 집계 이름은 카드 시절 그대로입니다. */
const SUPPORT = {
  key: 'support',
  target: '/organizations/{org}/support',
  href: APP + '/login?next=%2F%3Fgo%3D%252Forganizations%252F%257Borg%257D%252Fsupport',
};

/** 앱 `guestLoginHrefFor(target)` 과 같은 만들기 — `/login?next=` + `encodeURIComponent('/?go=' + encodeURIComponent(target))`. */
const hrefFor = (target) => APP + '/login?next=' + encodeURIComponent('/?go=' + encodeURIComponent(target));

/** 태그의 속성을 순서와 무관하게 읽습니다 — 속성 순서를 바꿨다고 red 가 되지 않게. */
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([a-z-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const count = (s, needle) => s.split(needle).length - 1;
const startTaskTags = (html) => [...html.matchAll(/<a\b[^>]*class="start-task"[^>]*>/g)].map((m) => m[0]);
const heroOf = (file) => body(file).match(/<header class="hero"[\s\S]*?<\/header>/)?.[0];

/* ══ ① 정본 표가 스스로 맞는다 ═══════════════════════════════════════════════ */

test('[대조] 세 갈래의 링크와 «고른 일»이 서로 맞는다 — 손으로 적은 두 값이 갈리지 않는다', () => {
  for (const t of [...TASKS, SUPPORT]) {
    assert.equal(hrefFor(t.target), t.href, t.key + ': 링크와 고른 일이 다릅니다');
    /* 앱 `guestGoTarget` 이 받는 모양 — 같은 사이트 상대 경로 · 홈 자체/쿼리/조각이 아님 · 300자 이하. */
    assert.ok(t.target.startsWith('/') && !t.target.startsWith('//'), t.key + ': 같은 사이트 상대 경로가 아닙니다');
    assert.ok(t.target !== '/' && !t.target.startsWith('/?') && !t.target.startsWith('/#'), t.key + ': 앱이 «고른 일 없음»으로 버립니다');
    assert.ok(t.target.length <= 300, t.key + ': 앱이 받는 길이(300자)를 넘습니다');
  }
  assert.deepEqual(TASKS.map((t) => t.key), ['upload', 'receivables', 'quote']);
});

/* ══ ② 국·영문 히어로가 세 갈래를 싣는다 ═════════════════════════════════════ */

for (const file of LANDINGS) {
  test(`🔴 ${file} 히어로에 세 갈래가 정본 링크 · 순서 그대로 있다`, () => {
    const hero = heroOf(file);
    assert.ok(hero, file + ': 히어로를 찾지 못했습니다');

    assert.match(hero, /<div class="start-picker"[^>]*role="group"[^>]*aria-labelledby="start-picker-title"/,
      file + ': 세 갈래 묶음(start-picker · role=group)이 없습니다');
    assert.match(hero, /\bid="start-picker-title"/, file + ': 묶음 제목(start-picker-title)이 없습니다 — aria-labelledby 가 허공을 가리킵니다');
    assert.match(hero, /<ul class="start-tasks"/, file + ': 세 갈래 목록(start-tasks)이 없습니다');

    const tags = startTaskTags(hero);
    assert.equal(tags.length, 3, file + ': 히어로의 갈래가 ' + tags.length + '개입니다');
    /* 히어로 밖에 같은 갈래가 따로 서지 않는다 — 클릭 집계가 두 자리로 갈리지 않게. */
    assert.equal(startTaskTags(body(file)).length, 3, file + ': 히어로 밖에도 갈래 링크가 있습니다');

    tags.forEach((tag, i) => {
      const a = attrs(tag);
      const want = TASKS[i];
      assert.equal(a['data-start-task'], want.key, file + ': ' + (i + 1) + '번째 갈래가 ' + want.key + ' 가 아닙니다');
      assert.equal(a.href, want.href, file + ': ' + want.key + ' 링크가 앱 정본과 다릅니다');
      assert.equal(a['data-track'], 'hero-task-' + want.key, file + ': ' + want.key + ' 의 클릭 이름이 다릅니다');
    });
  });

  test(`🔴 ${file} 의 세 갈래 next 를 풀면 «/?go=같은 사이트 경로»다`, () => {
    const tags = startTaskTags(heroOf(file) || '');
    assert.equal(tags.length, 3, file + ': 풀어 볼 갈래가 ' + tags.length + '개입니다 — 빈 목록은 조용한 초록입니다');
    for (const tag of tags) {
      const url = new URL(attrs(tag).href);
      assert.equal(url.origin, APP, '앱 오리진이 아닙니다: ' + url.origin);
      assert.equal(url.pathname, '/login');
      const next = url.searchParams.get('next');
      assert.ok(next && next.startsWith('/?go='), 'next 가 «/?go=» 가 아닙니다: ' + next);
      const go = new URL(next, APP).searchParams.get('go');
      assert.ok(go && go.startsWith('/') && !go.startsWith('//'), 'go 가 같은 사이트 상대 경로가 아닙니다: ' + go);
      assert.ok(TASKS.some((t) => t.target === go), '정본 표에 없는 고른 일입니다: ' + go);
    }
  });

  test(`🔴 ${file} 지원사업은 카드 아래 작은 링크 하나로 남는다 — 같은 링크 · 같은 집계 이름`, () => {
    const hero = heroOf(file) || '';
    const more = hero.match(/<p class="start-picker-more">[\s\S]*?<\/p>/)?.[0];
    assert.ok(more, file + ': 카드 아래 지원사업 링크(start-picker-more)가 없습니다');
    const links = [...more.matchAll(/<a\b[^>]*>/g)].map((m) => attrs(m[0]));
    assert.equal(links.length, 1, file + ': 작은 링크 줄의 링크가 ' + links.length + '개입니다');
    assert.equal(links[0].href, SUPPORT.href, file + ': 지원사업 링크가 앱 정본과 다릅니다');
    assert.equal(links[0]['data-track'], 'hero-task-support', file + ': 지원사업 집계 이름이 바뀌었습니다 — 시계열이 끊깁니다');
    assert.equal(count(body(file), 'data-track="hero-task-support"'), 1, file + ': 지원사업 링크가 두 자리에 있습니다');
  });

  test(`${file} 시작 버튼(hero-start)은 앱 루트 그대로다`, () => {
    const hero = heroOf(file) || '';
    assert.ok(/<a\b[^>]*href="https:\/\/app\.trops\.kr\/"[^>]*data-track="hero-start"/.test(hero),
      file + ': hero-start 가 앱 루트로 가지 않습니다');
  });
}

/* ══ ③ 앱 저장소와 맞댄다 (이웃 저장소가 있을 때만) ══════════════════════════ */

/*
 * 🔴 **정본은 앱입니다** — `../trops_a/lib/frame/start-tasks.ts` 의 `startTaskTarget` 과
 *    `../trops_a/lib/frame/guest-preview.ts` 의 `guestGoPath` · `guestLoginHrefFor` 입니다.
 *    앱이 갈래의 목적지나 링크 모양을 바꾸면 여기서 red 가 되어 랜딩이 따라갑니다.
 * ⚠️ 이웃 저장소가 없는 자리(깨끗한 체크아웃 · Vercel 빌드)에서는 **skip** 입니다 — 위 ①·②가 글자
 *    그대로의 정본을 계속 잽니다.
 * ⛔ 앱 코드의 모양이 바뀌어 아래 정규식이 못 읽으면 red 입니다 — 못 읽은 것을 «같다»로 넘기지 않습니다.
 */
const APP_ROOT = path.resolve(ROOT, '..', 'trops_a');
const START_TASKS_TS = path.join(APP_ROOT, 'lib', 'frame', 'start-tasks.ts');
const GUEST_PREVIEW_TS = path.join(APP_ROOT, 'lib', 'frame', 'guest-preview.ts');
const HAS_APP = fs.existsSync(START_TASKS_TS) && fs.existsSync(GUEST_PREVIEW_TS);
const SKIP = HAS_APP ? false : '이웃 저장소 ../trops_a 가 없습니다 — 앱 대조를 건너뜁니다';

const LEDGER_NAV_TS = path.join(APP_ROOT, 'lib', 'constants', 'ledger-nav.ts');
const byKey = (k) => TASKS.find((t) => t.key === k);

test('🔴 [앱 대조] 갈래의 목적지가 앱 startTaskTarget 과 같다 — 지원사업은 «켜짐» 갈래', { skip: SKIP }, () => {
  const src = fs.readFileSync(START_TASKS_TS, 'utf8');
  const fn = src.match(/export function startTaskTarget\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, 'startTaskTarget 를 찾지 못했습니다 — 앱 쪽 모양이 바뀌었습니다');
  const quote = fn.match(/if \(key === "quote"\) return "([^"]+)";/)?.[1];
  const support = fn.match(/if \(key === "support"\) return supportInsideOpen\(env\) \? "([^"]+)" : "([^"]+)";/);
  const upload = fn.match(/\n\s*return "([^"]+)";\s*\n\}$/)?.[1];
  assert.ok(quote && support && upload, '갈래 목적지 셋을 읽지 못했습니다 — 앱 쪽 모양이 바뀌었습니다');
  assert.equal(byKey('quote').target, quote, '서류 만들기 갈래가 앱 견적서 목적지와 다릅니다');
  assert.equal(SUPPORT.target, support[1], '지원사업 링크가 앱의 «켜짐» 목적지와 다릅니다');
  assert.equal(support[2], '/guide/support', '지원사업 «꺼짐» 갈래가 바뀌었습니다 — 머리주석의 대체 경로도 고치십시오');
  assert.equal(byKey('upload').target, upload, '수출 1건 올리기 갈래가 앱 자료 올리기 목적지와 다릅니다');
  /* ⚠️ 앱 START_TASKS 순서 대조는 걷었습니다(2026-10-28 · 머리주석 🔄) — 앱 카드를 맞추는 날 되살리십시오. */
});

test('🔴 [앱 대조] 받을 돈 갈래가 앱 «대금·보험» 메뉴 주소다 — 로그인 뒤 그 화면으로 이어진다', { skip: SKIP }, () => {
  const src = fs.readFileSync(LEDGER_NAV_TS, 'utf8');
  const O = src.match(/const O = "([^"]+)";/)?.[1];
  assert.ok(O, 'ledger-nav.ts 의 회사 자리표(O)를 읽지 못했습니다 — 앱 쪽 모양이 바뀌었습니다');
  const payment = src.match(/id: "ledgerPayment", label: "([^"]+)", group: "core", href: `\$\{O\}([^`]+)`/);
  assert.ok(payment, '«대금·보험» 메뉴 줄을 읽지 못했습니다 — 앱 쪽 모양이 바뀌었습니다');
  assert.equal(byKey('receivables').target, O + payment[2], '받을 돈 갈래가 앱 «' + payment[1] + '» 메뉴 주소와 다릅니다');
});

test('🔴 [앱 대조] 앱이 같은 모양으로 링크를 만든다 — /?go= · /login?next=', { skip: SKIP }, () => {
  const src = fs.readFileSync(GUEST_PREVIEW_TS, 'utf8');
  assert.ok(src.includes('export const GUEST_GO_PARAM = "go";'), '고른 일 이름(go)이 바뀌었습니다');
  assert.ok(src.includes('`/?${GUEST_GO_PARAM}=${encodeURIComponent(ok)}`'), 'guestGoPath 가 «/?go=» 를 만들지 않습니다');
  assert.ok(src.includes('`/login?next=${encodeURIComponent(home)}`'), 'guestLoginHrefFor 가 «/login?next=» 를 만들지 않습니다');
  const max = Number(src.match(/const GO_MAX = (\d+);/)?.[1]);
  assert.ok(max > 0, 'GO_MAX 를 읽지 못했습니다');
  for (const t of TASKS) assert.ok(t.target.length <= max, t.key + ': 앱이 받는 길이(' + max + ')를 넘습니다');
});
