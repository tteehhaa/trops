#!/usr/bin/env node
/*
 * 배포된 사이트가 소스와 같은 것을 내놓는지 HTTP 로 확인합니다.
 *
 *   node scripts/verify-deployment.js https://www.trops.kr
 *   node scripts/verify-deployment.js https://trops-xxxx.vercel.app
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────────────────────
 *   테스트(npm test)는 **로컬 dist/** 를 봅니다. 「빌드하면 맞게 나온다」까지입니다.
 *   그 dist 가 실제로 그 주소에 올라갔는지는 다른 질문이고, 그 사이에는
 *   프리뷰/프로덕션 승격 · cleanUrls · 캐시 · 빌드 실패 후 이전 배포 유지가 있습니다.
 *
 *   2026-08-11 C-1 확인에서 필요해졌습니다 — 「V5·패딩·en·법인명이 프로덕션에
 *   반영됐는가」를 눈으로 보는 대신 단정으로 남깁니다. 눈으로 본 것은 기록이
 *   남지 않고, 다음에 같은 질문이 오면 처음부터 다시 봐야 합니다.
 *
 * ── 무엇을 확인하는가 ───────────────────────────────────────────────────────
 *   화면을 그리는 값 중 **회귀하면 조용한 것**만 고릅니다. 문구 전수 대조는
 *   npm test 가 dist 로 이미 합니다 — 여기서 반복하지 않습니다.
 *
 *   ⚠️ 기대값을 여기 하드코딩하지 마십시오. 대부분 소스/설정에서 읽어 옵니다 —
 *      하드코딩하면 소스를 고칠 때 이 파일이 조용히 낡습니다.
 *
 * 종료코드: 0 전부 통과 · 1 실패 있음 · 2 사용법 오류
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

/**
 * 소스 파일 — **주석을 뺀** 상태로 읽습니다.
 *
 * ⚠️ 이걸 빼먹으면 검사가 조용히 틀립니다. 실제로 겪었습니다:
 *    index.html 주석에 「clamp(60px, 8vw, 96px) 였는데 …」라는 설명이 있어서
 *    소스 11곳 · 배포본 10곳으로 세어져 통과할 것이 실패로 나왔습니다.
 *    배포본은 주석이 없으니(빌드가 뗍니다) 소스도 같은 상태로 봐야 합니다.
 */
const source = (name) =>
  fs
    .readFileSync(path.join(ROOT, name), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

/* ──────────────────────────────────────────────────────────────
 * 확인 항목
 *
 * { id, label, page, check(html, ctx) → true | 실패이유 문자열 }
 * page 는 배포 경로입니다(cleanUrls 라 확장자가 없습니다).
 * ────────────────────────────────────────────────────────────── */

/**
 * CSS 규칙 하나를 선택자로 찾습니다.
 *
 * ⚠️ 선택자를 문자열로 찾으면 안 됩니다 — 빌드의 CSS 처리가 **선택자 목록을
 *    정렬**합니다. `h3, .h3` 가 배포본에서 `.h3,h3` 로 나옵니다(뜻은 같습니다).
 *    실제로 이걸 모르고 「배포본에 h3, .h3 규칙이 없습니다」라는 오탐을 봤습니다.
 *    그래서 쉼표로 갈라 **집합으로** 대조합니다.
 */
function findRule(css, selector) {
  const want = selector.split(',').map((s) => s.trim()).sort().join(',');
  const re = /([^{}@;]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const got = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')).sort().join(',');
    if (got === want) return m[2];
  }
  return null;
}

/**
 * 소스의 CSS 선언 블록을 통째로 꺼냅니다 — 기대값의 출처를 소스로 둡니다.
 *
 * 🔴 **던지지 않습니다** 〔2026-09-01 · 대표 지시〕. 종전에는 규칙을 못 찾으면 `throw` 했고,
 *    러너에 try/catch 가 없어서 **그 한 줄이 확인 전체를 끝냈습니다.** 실측: 20개 중
 *    2개만 돌고 18개가 한 번도 실행되지 않았습니다(2026-09-01, `V5-h3-정의` 에서 중단).
 *    ⚠️ 그 18개에는 법인명·항목수·주석제거·과금게이트·cron 비공개가 들어 있었습니다 —
 *       「확인했다」고 적힌 로그가 실은 아무것도 안 본 상태였습니다.
 * 🔴 이제 `null` 을 돌려주고 **부르는 쪽이 실패로 «적습니다»**. 한 항목의 실패는 그 항목만
 *    빨갛게 만들고 나머지는 계속 돕니다(러너의 try/catch 와 짝입니다).
 */
function ruleFrom(file, selector) {
  return findRule(source(file), selector);
}

/** 선언 목록을 { prop: value } 로. 배포본은 공백이 줄어 있을 수 있어 정규화합니다. */
function decls(body) {
  const out = {};
  for (const part of body.split(';')) {
    const i = part.indexOf(':');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim().replace(/\s+/g, ' ');
  }
  return out;
}

/** 배포본에서 같은 선택자의 선언을 꺼내 소스와 대조합니다. */
function sameRule(html, file, selector, props) {
  /*
   * 🔴 **소스에 그 선택자가 없는 것은 «검사가 낡은» 것이지 배포 사고가 아닙니다.**
   *    실제 사례: 2026-08-29 랜딩 전면교체가 `h3, .h3` 를 `.h3` 단독으로 바꿨는데
   *    이 검사만 옛 선택자를 들고 있었습니다. 그때 던지는 대신 **그 사실을 적습니다** —
   *    선택자로 규칙을 찾는 방식 자체가 부서지기 쉬우므로, 실패 문구가 「어디를 고쳐야
   *    하는지」를 말하게 합니다.
   */
  const sourceBody = ruleFrom(file, selector);
  if (sourceBody === null) {
    return `소스 ${file} 에 ${selector} 규칙이 없습니다 — 검사가 낡았습니다 ` +
      '(선택자가 바뀌었는지 보고, 바뀐 것이면 이 항목의 선택자를 함께 고치십시오)';
  }
  const expected = decls(sourceBody);
  const body = findRule(html, selector);
  if (body === null) return `배포본에 ${selector} 규칙이 없습니다`;
  const got = decls(body);

  for (const prop of props) {
    if (!(prop in expected)) return `소스에 ${selector} { ${prop} } 가 없습니다 — 목록이 낡았습니다`;
    if (got[prop] !== expected[prop]) {
      return `${selector} { ${prop} } 가 다릅니다 — 배포 ${JSON.stringify(got[prop])} / 소스 ${JSON.stringify(expected[prop])}`;
    }
  }
  return true;
}

const TYPO = ['font-size', 'font-weight', 'line-height', 'letter-spacing'];

/**
 * api/cron/ 을 훑어 실재하는 cron 라우트를 찾습니다 〔2026-08-12 · 하드코딩 제거〕.
 *
 * ⚠️ 전에는 '/api/cron/cleanup-expired' 하나만 박아 뒀습니다 — refund-blocked 가
 *    생긴 뒤에도 이 검사는 그것을 모른 채로 남았고, 새 cron 라우트가 또 생겨도
 *    이 파일을 손으로 고치지 않으면 조용히 검사에서 빠집니다.
 *
 *    test/cron-registration.test.js 의 routeFiles() 와 같은 규칙(밑줄로 시작하는
 *    파일은 Vercel 이 엔드포인트로 만들지 않으므로 제외)을 씁니다.
 */
const CRON_DIR = path.join(ROOT, 'api', 'cron');
const CRON_ROUTES = fs.existsSync(CRON_DIR)
  ? fs.readdirSync(CRON_DIR)
      .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
      .map((f) => '/api/cron/' + f.replace(/\.js$/, ''))
      .sort()
  : [];

// 조용히 0개로 빠지면 "전부 통과"로 보입니다 — 탐지가 깨진 것과 검사할 게
// 없는 것을 구분하지 못하므로 여기서 죽입니다(이 저장소는 cron 이 최소 1개입니다).
if (CRON_ROUTES.length === 0) {
  throw new Error('api/cron/ 에서 cron 라우트를 하나도 찾지 못했습니다 — CRON_DIR 탐지가 깨졌을 수 있습니다: ' + CRON_DIR);
}

/**
 * cron 라우트는 전부 같은 약속을 지켜야 합니다 — 무인증 호출에 404, 본문 없음.
 * 라우트마다 배치 결과 필드 이름이 다르므로(expired/orphans · checked/refunded …)
 * 필드 이름을 나열하는 대신 **본문이 비어 있는가**로 봅니다 — 새 라우트가 생겨도
 * 이 검사를 손보지 않아도 됩니다.
 */
function cronPrivacyCheck(res) {
  if (res.status === 401) return '401 을 줬습니다 — 경로의 존재가 드러납니다 (404 이어야 함)';
  if (res.status !== 404) return `무인증 호출에 ${res.status} 를 줬습니다 (404 이어야 함)`;
  if (res.body) return `무인증 호출에 본문이 있습니다 — 배치 결과가 샐 수 있습니다: ${res.body.slice(0, 100)}`;
  return true;
}

/*
 * 국문↔영문 짝 표 — **middleware.js 소스에서 읽습니다.**
 *
 * ⚠️ 여기에 표를 다시 적지 않습니다. 같은 표가 이미 두 곳(middleware.js · lang-switch.js)에
 *    있고 둘 다 「한쪽만 고치면 갈라진다」고 적어 뒀습니다 — 세 번째 사본을 만들면 그 경고를
 *    이 파일이 어기는 셈입니다. 경로를 추가하면 middleware 만 고치면 이 검사가 따라옵니다.
 */
const LANG_PAIRS = [...source('middleware.js').matchAll(/\['(\/[^']*)',\s*'(\/en[^']*)'\]/g)]
  .map((m) => [m[1], m[2]]);

/* ──────────────────────────────────────────────────────────────
 * 🔴 **표가 옳은지는 «숫자»가 아니라 «배포되는 페이지»로 잽니다** 〔2026-09-01 · 대표 지시〕
 * ──────────────────────────────────────────────────────────────
 * 종전에는 `LANG_PAIRS.length < 7` 이면 실패였습니다. 그 7 은 2026-08-16 당시의 장수였고,
 * 2026-08-30 6장 제거로 짝이 **7 → 3** 이 되면서 기대만 남았습니다 — 라이브는 멀쩡한데
 * 확인이 빨갛고, 그 빨강이 진짜 회귀를 가렸습니다.
 *
 * ⛔ 숫자를 3으로 다시 박지 않습니다. 페이지가 늘거나 줄면 또 틀립니다.
 * 🔴 대신 **파생합니다** — 「영문 짝이 실제로 배포되는 국문 페이지」가 PAIRS 에 있어야 할
 *    전부이고, 그것이 곧 「짝 없음이 의도된 페이지는 PAIRS 에 없어야 한다」이기도 합니다.
 *    두 방향을 다 봅니다:
 *      · 짝이 있는데 PAIRS 에 없다  → 그 페이지는 `lang=en` 을 골라도 국문에 머무른다
 *      · PAIRS 에 있는데 짝이 없다  → 배포되지 않는 주소로 307 을 쏜다(404)
 *
 * ⚠️ 장수 표는 `scripts/build-static.js` `STATIC.html` 하나뿐입니다 — 여기에 사본을
 *    만들지 않습니다(그 표가 「무엇이 배포되는가」의 정본입니다).
 * ⚠️ 짝 이름 규칙은 `test/i18n-parity.test.js` 의 파생과 같습니다
 *    (`index.html` ↔ `en.html` · `<이름>.html` ↔ `en-<이름>.html`).
 */
const { STATIC } = require('./build-static.js');

/** 배포 경로. `index.html` → `/`, 그 밖에는 확장자를 뗀 clean URL 입니다(vercel.json). */
const routeOf = (file) => (file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, ''));
/** 국문 파일의 영문 짝 «이름». 실제로 배포되는지는 따로 봅니다. */
const enSiblingOf = (koFile) => (koFile === 'index.html' ? 'en.html' : 'en-' + koFile);

const DEPLOYED_FILES = new Set(STATIC.html.map((e) => e.file));
const KO_FILES = STATIC.html.filter((e) => e.locale === 'ko').map((e) => e.file);

/** PAIRS 에 있어야 할 전부 — 영문 짝이 «실제로 배포되는» 국문 페이지. */
const EXPECTED_LANG_PAIRS = KO_FILES
  .filter((f) => DEPLOYED_FILES.has(enSiblingOf(f)))
  .map((f) => [routeOf(f), routeOf(enSiblingOf(f))]);

/* ──────────────────────────────────────────────────────────────
 * 🔴 **장수 표는 여기 하나뿐입니다** 〔2026-09-01 · 대표 지시 「7건을 개별로 고치지 말고
 *    뿌리 하나를 고쳐라」〕
 * ──────────────────────────────────────────────────────────────
 * 종전에는 검사 일곱이 각자 `['/', '/en', '/nda', '/precheck', '/refund', '/uae', …]` 를
 * 손으로 들고 있었고, 2026-08-30 6장 제거 뒤 **일곱 곳이 한꺼번에 낡았습니다**(전부 307).
 * 같은 목록을 일곱 벌 두면 지우는 날 일곱 곳을 고쳐야 하고, 그날 아무도 그러지 않습니다.
 *
 * ⛔ 아래 검사에 `pages: [...]` 를 손으로 적지 마십시오. 페이지가 늘거나 줄면
 *    `scripts/build-static.js` `STATIC.html` 한 곳만 고치면 확인이 따라옵니다.
 * ⚠️ `sourceOf` 도 적지 않습니다 — 경로에서 소스 파일을 되찾습니다(아래 `PAGE_FILES`).
 */
const PAGE_FILES = new Map(STATIC.html.map((e) => [routeOf(e.file), e.file]));
const LOCALE_OF = new Map(STATIC.html.map((e) => [routeOf(e.file), e.locale]));
const ALL_PAGES = [...PAGE_FILES.keys()];
const EN_PAGES = STATIC.html.filter((e) => e.locale === 'en').map((e) => routeOf(e.file));
/** 경로 → 소스 파일. 러너의 `sourceOf` 자리에 그대로 넣습니다. */
const SOURCE_OF = Object.fromEntries(PAGE_FILES);

/**
 * 그 CSS 규칙을 «가진» 페이지만 고릅니다.
 *
 * 🔴 「배포되는 전 페이지」로 잡으면 그 규칙이 없는 페이지에서 거짓 red 가 납니다.
 *    규칙을 가진 페이지끼리 값이 같은지가 이 검사의 질문이므로, 대상도 그렇게 좁힙니다.
 * ⚠️ 대상이 0장이 되면 러너가 실패로 셉니다(조용한 초록 방지).
 */
const pagesWithRule = (selector) =>
  ALL_PAGES.filter((p) => findRule(source(PAGE_FILES.get(p)), selector) !== null);

/**
 * 그 토큰을 «쓰는» 페이지와 자리 수. 「N개 항목」 검사의 대상입니다.
 *
 * ⚠️ `test/item-count.test.js` 는 자리 수를 **손으로** 유지합니다 — 그래야 「토큰 하나를
 *    실수로 지웠다」를 잡습니다. 여기서 파생하는 것은 그 래칫을 무르는 것이 «아닙니다»:
 *    이 스크립트의 질문은 「소스에 있는 자리가 배포본에도 그대로 나왔는가」이고,
 *    소스의 자리 수가 옳은지는 그 단위 테스트가 이미 잠급니다. 층이 다릅니다.
 */
const ITEM_TOKEN = '{{precheck.itemCount}}';
const ITEM_COUNT_PAGES = ALL_PAGES.filter((p) => source(PAGE_FILES.get(p)).includes(ITEM_TOKEN));
const ITEM_COUNT_PER = Object.fromEntries(
  ITEM_COUNT_PAGES.map((p) => [p, source(PAGE_FILES.get(p)).split(ITEM_TOKEN).length - 1])
);
/**
 * 「N개 항목」이 로케일마다 **다른 말**입니다 — `test/item-count.test.js` 의 표를 그대로 씁니다.
 * ⚠️ 영문은 `the` 를 요구합니다(그쪽 주석 참조). 국문 꼴 하나로만 재면 영문 자리가 0곳으로
 *    나오고, 그러면 이 검사가 영문 환불 페이지를 통과시켜 버립니다.
 */
const COUNT_PHRASE = {
  ko: () => /(\d+)\s*개 항목/g,
  en: () => /\bthe\s+(\d+)\s+items\b/g,
};

/**
 * hreflang 을 «선언한» 국·영 짝. 양쪽이 배포되고, 국문 소스가 실제로 hreflang 을 든 것만입니다.
 * ⚠️ privacy 쌍은 아직 hreflang 이 없어 여기서 자동으로 빠집니다(인계 메모 §4). 그것은 이
 *    스크립트가 잴 일이 아니라 **아직 안 한 일**이고, 짝이 서면 여기에 저절로 들어옵니다.
 */
const HREFLANG_PAIRS = EXPECTED_LANG_PAIRS.filter(([ko]) =>
  /<link rel="alternate" hreflang=/.test(source(PAGE_FILES.get(ko)))
);

const CHECKS = [
  /* ── 언어 짝 표가 배포되는 장수와 어긋나지 않는가 〔2026-09-01 신설〕 ─────────
   * 🔴 종전에는 이 축이 `국문우선` 안에 「짝이 7개 미만이면 실패」로 섞여 있었습니다.
   *    그래서 **표가 낡은 것**과 **라이브가 국문을 안 내주는 것**이 한 항목에서 같은
   *    빨강으로 나왔고, 앞의 것이 뒤의 것을 가렸습니다. 두 질문이라 두 항목으로 나눕니다.
   * ⚠️ 이 항목은 HTTP 를 쓰지 않습니다(`local`) — 소스끼리의 대조입니다.
   */
  {
    id: '언어짝-표',
    local: true,
    label: 'middleware PAIRS 가 「영문 짝이 배포되는 국문 페이지」 전부와 같다',
    check: () => {
      const fmt = (pairs) => pairs.map(([ko, en]) => ko + ' → ' + en).sort();
      const want = fmt(EXPECTED_LANG_PAIRS);
      const got = fmt(LANG_PAIRS);

      /* 0장은 「통과」가 아닙니다 — 파생이 깨지면 아래 비교가 조용히 전부 맞습니다. */
      if (want.length === 0) {
        return '영문 짝이 있는 국문 페이지가 0장입니다 — STATIC.html 파생이 깨졌습니다';
      }

      const missing = want.filter((x) => !got.includes(x));
      const extra = got.filter((x) => !want.includes(x));
      const why = [];
      if (missing.length) {
        why.push(`PAIRS 에 없습니다: ${missing.join(' · ')} — 그 페이지는 lang=en 을 골라도 국문에 머무릅니다`);
      }
      if (extra.length) {
        why.push(`PAIRS 에만 있습니다: ${extra.join(' · ')} — 배포되지 않는 주소로 307 을 쏩니다`);
      }
      return why.length ? why.join(' / ') : true;
    },
  },

  /* ── 현관 — 국문 우선 접속 〔2026-08-30 · 대표 지시로 영어 우선(2026-08-21) 철회〕 ──
   * 🔴 **이것이 지금 이 사이트의 첫 화면을 정합니다.** middleware.js 가 `lang=en` 쿠키가
   *    없는 방문자에게는 국문 경로를 그대로 200 으로 내줍니다. 이게 조용히 뒤집히면
   *    (matcher 오타 · 미들웨어 미배포 · 런타임 변경으로 다시 영문 리다이렉트가 살아나면)
   *    첫 화면이 영문으로 바뀌는데, **화면은 멀쩡해 보입니다** — 그래서 눈으로는 못 잡습니다.
   * ⚠️ 이 검사만 쿠키를 안 보냅니다(`noCookie`). 나머지 검사는 쿠키를 보내도 국문
   *    페이지에 닿습니다(기본이 국문이므로) — 위 `get()` 주석 참조.
   */
  {
    id: '국문우선',
    label: '쿠키 없는 첫 방문이 국문 그대로 200 으로 온다 (middleware.js PAIRS 전부)',
    page: null,
    noCookie: true,
    raw: LANG_PAIRS.map(([ko]) => ko),
    /*
     * 🔴 **표가 옳은지는 여기서 재지 않습니다** 〔2026-09-01〕 — 위 `언어짝-표` 가 봅니다.
     *    이 항목은 오직 「그 주소가 쿠키 없이 200 으로 오는가」 하나만 잽니다.
     *    ⚠️ 표가 비면 대상이 0개가 되는데, 그때는 러너가 「대상 0개」로 실패시킵니다
     *       (0개를 «통과»로 세지 않습니다).
     */
    check: (res, target) => {
      if (res.status !== 200) {
        return `${res.status} 로 답했습니다 (200 이어야 합니다 — 국문이 그대로 나와야 함, ${target})`;
      }
      return true;
    },
  },

  /* ── 현관 — 영문 선택 시 리다이렉트 〔2026-08-30 신설〕 ─────────────────────
   * 위 검사의 반대 방향이다 — `lang=en` 쿠키를 직접 고른 방문자는 여전히 영문 짝으로
   * 넘어가야 한다. 이게 조용히 사라지면 언어 전환 자체가 죽는데(눌러도 국문에 머무름),
   * 화면은 역시 멀쩡해 보인다.
   */
  {
    id: '영문선택-리다이렉트',
    label: '`lang=en` 쿠키를 보내면 영문 짝으로 307 된다 (middleware.js PAIRS 전부)',
    page: null,
    cookie: 'lang=en',
    raw: LANG_PAIRS.map(([ko]) => ko),
    check: (res, target) => {
      const expected = (LANG_PAIRS.find(([ko]) => ko === target) || [])[1];
      if (res.status !== 307) return `${res.status} 로 답했습니다 (307 이어야 합니다)`;
      if (!res.location.endsWith(expected)) {
        return `307 목적지가 ${res.location} 입니다 (${expected} 이어야 합니다)`;
      }
      return true;
    },
  },

  /* ── C-1 ① V5 (H3 계층) ─────────────────────────────────────────── */
  {
    id: 'V5-h3-정의',
    /*
     * 🔄 **선택자를 새 랜딩의 실제 규칙에 맞췄습니다** 〔2026-09-01 · v11 교체〕.
     *    종전 `h3, .h3` 는 2026-08-29 개편이 `.h3` 단독으로 바꾼 뒤 계속 낡아 있었고,
     *    v11 에는 `.h3` 도 없습니다. 실제로 존재하는 H3 계층은 3단계 카드의 `.sp h3` 입니다.
     * ⚠️ **`line-height` 를 재지 않습니다** — `.sp h3` 가 그 값을 선언하지 않습니다(상속).
     *    없는 속성을 요구하면 `sameRule` 이 「목록이 낡았습니다」로 red 가 됩니다.
     *    ⛔ 값을 억지로 넣으려고 랜딩 CSS 를 고치지 마십시오 — 검사가 화면을 따라갑니다.
     */
    label: 'V5 · H3 계층이 정의돼 있다 (.sp h3 · 20/700/−0.02em)',
    page: '/',
    check: (html) => sameRule(html, 'index.html', '.sp h3',
      ['font-size', 'font-weight', 'letter-spacing']),
  },
  /*
   * 🔴 **`V5-로드맵헤딩` 을 삭제했습니다** 〔2026-09-01 · 대표 지시〕.
   *
   * 그 검사는 `.how h2.rm-h2`(로드맵 헤딩)가 H3 계층으로 렌더되는지 봤습니다. **로드맵
   * 섹션은 2026-08-29 `7876e98`(랜딩 개편: 사전점검 진단 중심 구조로 전면 교체)이
   * 걷어냈고**, v11 에도 없습니다 — 잴 대상이 사라졌습니다.
   * ⚠️ `test/landing-invariants.test.js` 머리주석이 그 개편이 걷어낸 섹션으로 로드맵을
   *    명시합니다(같은 근거).
   * 🔴 되살릴 조건: 랜딩에 로드맵이 다시 서면 그때 함께 되살리십시오
   *    (원본: `git show 549794d:scripts/verify-deployment.js` 의 `V5-로드맵헤딩`).
   */

  /* ── C-1 ② 패딩 통일 ────────────────────────────────────────────── */
  {
    id: '패딩-컨테이너',
    label: '패딩 · .container 를 가진 전 페이지의 좌우가 같다 (상한 48px)',
    page: null,   // 여러 페이지 — pages 로 따로 돕니다
    pages: pagesWithRule('.container'),
    sourceOf: SOURCE_OF,
    check: (html, ctx) => {
      const same = sameRule(html, ctx.sourceFile, '.container', ['max-width', 'padding-inline']);
      if (same !== true) return same;
      const d = decls(findRule(html, '.container'));
      // 64px 는 V7 이전 값입니다. 되살아나면 페이지끼리 좌우 여백이 갈립니다.
      if (/64px/.test(d['padding-inline'])) return `V7 이전 값 64px 가 남아 있습니다: ${d['padding-inline']}`;
      if (!/48px/.test(d['padding-inline'])) return `상한 48px 가 아닙니다: ${d['padding-inline']}`;
      return true;
    },
  },
  {
    id: '패딩-섹션리듬',
    /*
     * 🔄 **세 번째 재조준** 〔2026-09-01 · v11 교체〕. 종전에는 `clamp(60px,8vw,96px)` 문자열을
     *    소스와 배포본에서 «세어» 비교했는데, v11 은 그 자리를 **고정값**으로 씁니다
     *    (`section{padding:96px 0}` + 860px 미만에서 `68px 0`). 문자열이 사라져 red 였습니다.
     * 🔴 축은 그대로입니다 — 「섹션 상하가 한 값으로 통일됐고, 소스가 정한 그 값이 그대로
     *    배포됐는가」. 문자열을 세는 대신 **규칙 자체를 소스와 대조**합니다. 값이 clamp 이든
     *    고정이든 따라가므로 다음 개편에서 또 낡지 않습니다.
     * ⚠️ V7 이전 값(108·112·104px) 회귀 금지는 그대로 둡니다 — 한 페이지 안에서 96·104·108·
     *    112 로 갈려 있던 상태가 실제로 있었습니다.
     */
    label: '패딩 · 섹션 상하가 소스와 같은 한 값이다',
    page: '/',
    check: (html) => {
      const same = sameRule(html, 'index.html', 'section', ['padding']);
      if (same !== true) return same;
      const norm = html.replace(/\s+/g, '');
      for (const stale of ['108px', '112px', '104px']) {
        if (norm.includes('padding:' + stale) || norm.includes('padding-block:' + stale)) {
          return `V7 이전 값 ${stale} 가 남아 있습니다`;
        }
      }
      return true;
    },
  },

  /* ── C-1 ③ 영문 페이지 ──────────────────────────────────────────────
   *
   * 🔄 **한 페이지에서 다섯으로 넓혔습니다** 〔2026-08-16 · 영문화〕.
   *    종전에는 `/en` 하나만 보면서 앵커 문구 두 개(「Item comparison sheet」·
   *    「What's next」)를 **하드코딩**하고 있었습니다. 그 두 문구는 en.html 이
   *    국문에서 다섯 커밋 뒤에 머무는 동안의 옛 원고였고, 이 파일 머리의
   *    「기대값을 여기 하드코딩하지 마십시오」를 그대로 어긴 자리였습니다 —
   *    문구가 바뀌면 라이브가 멀쩡해도 확인이 실패합니다.
   *
   * 그래서 기대값을 **소스에서 읽습니다**: <title> 이 그대로 나갔는가, 그리고
   * 화면 문구에 한글이 없는가. 후자가 「국문판이 영문 주소에 올라간」 사고를
   * 문구 목록 없이 잡습니다 — 문구가 바뀌어도 낡지 않습니다.
   */
  {
    id: 'en-페이지',
    label: '배포되는 영문 페이지가 전부 서고 영문으로 렌더된다',
    /* 🔴 목록을 걷고 빌드 분류표에서 파생합니다 〔2026-09-01〕 — 종전 목록은 2026-08-30
       6장 제거 뒤 `/en-precheck`(없는 페이지)를 물고 있었습니다. */
    pages: EN_PAGES,
    sourceOf: SOURCE_OF,
    check: (html, ctx) => {
      if (!/<html[^>]+lang=["']en["']/.test(html)) return 'html lang="en" 이 아닙니다';

      const want = (source(ctx.sourceFile).match(/<title>([^<]*)<\/title>/) || [])[1];
      if (!want) return `소스 ${ctx.sourceFile} 에 <title> 이 없습니다 — 검사가 낡았습니다`;
      const got = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
      if (got !== want) return `<title> 이 다릅니다 — 배포 ${JSON.stringify(got)} / 소스 ${JSON.stringify(want)}`;

      /*
       * 화면에 보이는 한글. 국문판이 영문 주소로 올라가거나 번역이 빠진 자리를 잡습니다.
       * ⚠️ 언어 전환 링크(「한국어」)만 예외입니다 — 그 글자가 한글인 것이 그 링크의 일입니다.
       *
       * 🔴 **가리는 축을 `hreflang="ko"` 로 바꿨습니다** 〔2026-09-01 · 대표 지시〕.
       *    종전에는 `<a class="nav-quiet">` 로 가렸는데 **en.html 에 그 클래스가 0건**이라
       *    실제로는 아무것도 가리지 못했고, 언어 전환 링크의 「한국어」가 그대로 잡혀
       *    라이브가 멀쩡한데 빨갰습니다.
       * ⚠️ `test/i18n-parity.test.js` 가 같은 자리를 `hreflang="ko"` 로 가리고, 그 주석이
       *    「클래스로 가리면 그 클래스를 입은 아무 링크나 이 검사를 빠져나갑니다」라고
       *    적어 두었습니다 — 이 파일의 `en-경로누수` 도 이미 그 축을 씁니다.
       *    한 파일 안에서 두 축이 갈려 있었습니다. ⛔ 클래스로 되돌리지 마십시오.
       */
      const text = html
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<a[^>]*hreflang="ko"[^>]*>[^<]*<\/a>/g, '')
        .replace(/<[^>]+>/g, ' ');
      const hangul = text.match(/[가-힣][가-힣\s·]*/g);
      if (hangul) return `화면에 한글이 있습니다: ${JSON.stringify(hangul.slice(0, 3))}`;
      return true;
    },
  },
  /*
   * 언어 짝 — hreflang 은 **양쪽이 서로를 가리켜야** 검색엔진이 인정합니다.
   * 한쪽만 있으면 무시되고, 그 실패는 화면이 멀쩡해서 몇 주 뒤에 발견됩니다.
   *
   * 🔄 짝이 하나(/ ↔ /en)에서 넷으로 늘었습니다 〔2026-08-16〕. 주소를 여기 적는
   *    대신 **소스 한쪽에서 3줄을 통째로 읽어** 양쪽에 있는지 봅니다 — 주소가
   *    바뀌어도 이 파일을 손대지 않습니다.
   * ⚠️ privacy 쌍은 아직 hreflang 이 없어 목록에 없습니다(인계 메모 §4).
   */
  ...HREFLANG_PAIRS.map(([ko, en]) => {
    const koFile = PAGE_FILES.get(ko);
    return {
    id: 'hreflang' + en.replace(/\//g, '-'),
    label: `${ko} 과 ${en} 이 서로 hreflang 으로 가리킨다`,
    pages: [ko, en],
    check: (html) => {
      const lines = source(koFile).match(/<link rel="alternate" hreflang="[^"]+" href="[^"]+">/g) || [];
      if (lines.length !== 3) return `소스 ${koFile} 의 hreflang 이 3줄이 아닙니다(${lines.length}) — 검사가 낡았습니다`;
      for (const line of lines) {
        if (!html.includes(line)) return `이 줄이 없습니다: ${line}`;
      }
      /* 두 벌이 되면 검색엔진이 무엇을 믿을지 알 수 없습니다 — 실제로 한 번 났습니다. */
      const n = (html.match(/rel="alternate"/g) || []).length;
      if (n !== 3) return `hreflang 이 ${n}줄입니다 — 3줄이어야 합니다`;
      return true;
    },
    };
  }),
  /*
   * 🔴 영문 경로가 **끝까지 영문**인지. 라이브에서 봐야 하는 이유는, 마크업의 href
   *    만으로는 안 걸리는 자리가 있기 때문입니다 — replaceState 목적지와 토스
   *    결제 복귀 주소(successUrl·failUrl)는 스크립트 안 문자열입니다.
   *    2026-08-16 에 실제로 셋 다 국문(/precheck)을 가리킨 채였습니다.
   */
  {
    id: 'en-경로누수',
    label: '배포되는 영문 페이지가 국문 페이지로 새지 않는다',
    pages: EN_PAGES,
    check: (html) => {
      /*
       * hreflang·canonical 은 국문 주소를 **가리켜야 하는** 자리라 뺍니다.
       * 🔴 **헤더의 언어 전환 링크(`<a hreflang="ko">`)도 같은 자리입니다** 〔2026-08-21〕 —
       *    국문 짝을 가리키는 것이 그 링크의 일입니다. 우하단에 떠 있던 [English] 알약을
       *    걷고 헤더 링크로 옮기면서 영문 하위 페이지들이 `/check`·`/precheck`·`/refund` 를
       *    직접 가리키게 됐습니다. test/naming-consistency.test.js 의 같은 규칙과 **같은
       *    방식으로** 가립니다(클래스가 아니라 `hreflang` — 클래스로 가리면 그 클래스를
       *    입은 아무 링크나 이 검사를 빠져나갑니다).
       */
      const body = html
        .replace(/<link[^>]+>/g, '')
        .replace(/<a[^>]*hreflang="ko"[^>]*>[^<]*<\/a>/g, '');
      /*
       * 🔴 국문 경로 목록도 파생입니다 〔2026-09-01〕 — 종전에는 `/check` 처럼 **이미 없는**
       *    경로를 세면서 정작 새로 선 국문 페이지는 못 봤습니다.
       * ⚠️ `/` 는 뺍니다 — 너무 넓게 물어 아무 상대경로나 잡습니다
       *    (`test/i18n-parity.test.js` 의 `koOnly` 도 `index.html` 을 같은 이유로 뺍니다).
       */
      const koOnly = ALL_PAGES.filter((p) => LOCALE_OF.get(p) === 'ko' && p !== '/');
      for (const ko of koOnly) {
        const re = new RegExp('["\'\\(]' + ko + '(["\'?#]|$)');
        if (re.test(body)) return `국문 경로 ${ko} 가 남아 있습니다`;
      }
      if (body.includes('lang=en')) return '`?lang=en`(국문 폼 안내 배너 스위치)이 남아 있습니다';
      return true;
    },
  },

  /* ── C-1 ④ 법인명 (확정 영문 표기) ──────────────────────────────── */
  {
    id: '법인명-en',
    label: '/en 법인명이 확정 표기 3곳에 들어갔다 (É = U+00C9 보존)',
    page: '/en',
    check: (html) => {
      const name = config.biz.en.companyName;
      const places = (source('en.html').match(/\{\{\s*biz\.companyName\s*\}\}/g) || []).length;
      if (places === 0) return '소스에 {{biz.companyName}} 토큰이 없습니다 — 검사가 낡았습니다';

      const got = html.split(name).length - 1;
      if (got !== places) return `법인명이 ${got}곳입니다 (소스 토큰 ${places}곳)`;

      // É 가 U+00C9 로 살아 있는지. 엔티티(&Eacute;)나 THEONE 으로 펴진 것을 잡습니다.
      if (!name.includes('É')) return '설정값에 É(U+00C9) 가 없습니다 — site.config.json 확인';
      if (/THEONE/.test(html)) return 'É 가 빠진 THEONE 표기가 남아 있습니다';
      if (/&Eacute;|&#201;/.test(html)) return 'É 가 HTML 엔티티로 바뀌었습니다';
      return true;
    },
  },
  {
    id: '법인명-ko',
    label: '/ 법인명·사업자정보가 site.config.json 값과 같다',
    page: '/',
    /*
     * 🔴 **판정 방식을 `test/site-config.test.js` 에서 그대로 가져왔습니다** 〔2026-09-01 · 대표 지시〕.
     *
     * 종전에는 여섯 항목을 **전부** 요구했습니다. 그런데 랜딩 푸터는 요약이라 상호·대표·
     * 등록번호·주소 **넷만** 싣고, 통신판매업신고번호·전화는 정책 페이지 푸터가 듭니다 —
     * 그래서 라이브가 멀쩡한데 「biz.ko.ecommerceNo 가 배포본에 없습니다」로 빨갰습니다.
     * ⚠️ 같은 문제를 `test/site-config.test.js` 가 2026-08-30 에 이미 고쳤고, 그 주석이
     *    「전 페이지가 여섯을 다 갖는다로 재면 랜딩이 거짓 red 가 됩니다」라고 적어 두었습니다.
     *    이 스크립트만 옛 축에 남아 있었습니다.
     * 🔴 그래서 **각 페이지가 «자기가 쓴 토큰의» 값을 갖는가**로 잽니다 — 값이 아니라 의도를
     *    축으로 삼습니다. 푸터 구성이 바뀌어도 이 검사는 낡지 않습니다.
     * ⛔ 여기에 키 목록을 다시 적지 마십시오.
     */
    check: (html) => {
      const used = new Set(
        [...source('index.html').matchAll(/\{\{\s*biz\.([a-zA-Z]+)\s*\}\}/g)].map((m) => m[1])
      );
      if (used.size === 0) {
        return '소스 index.html 에 {{biz.*}} 토큰이 없습니다 — 검사가 낡았습니다(0개는 통과가 아닙니다)';
      }
      for (const key of used) {
        if (!(key in config.biz.ko)) {
          return `소스가 쓰는 {{biz.${key}}} 가 site.config.json 의 biz.ko 에 없습니다`;
        }
        if (!html.includes(config.biz.ko[key])) {
          return `biz.ko.${key} 값(${config.biz.ko[key]})이 배포본에 없습니다`;
        }
      }
      return true;
    },
  },

  /* ── 곁들여: 이번 배치와 함께 지켜야 하는 것 ────────────────────── */
  {
    id: '항목수',
    label: '대조 항목 수가 토큰을 쓴 자리마다 설정값으로 나온다',
    page: null,
    /* 🔴 대상도 자리 수도 소스에서 파생합니다 〔2026-09-01〕 — 종전 표(`/nda` 2 · `/uae` 1)는
       그 두 장이 2026-08-30 에 삭제된 뒤로 없는 페이지를 세고 있었고, 그 사이 표에 들어온
       `en-refund.html` 2곳은 아무도 세지 않았습니다. */
    pages: ITEM_COUNT_PAGES,
    expectedPer: ITEM_COUNT_PER,
    sourceOf: SOURCE_OF,
    check: (html, ctx) => {
      const count = config.precheck.itemCount;
      const phrase = (COUNT_PHRASE[LOCALE_OF.get(ctx.target)] || COUNT_PHRASE.ko)();
      const found = [...html.matchAll(phrase)].map((m) => m[1]);
      if (found.length !== ctx.expected) {
        return `「N개 항목」이 ${found.length}곳입니다 (기대 ${ctx.expected}곳)`;
      }
      for (const n of found) {
        if (n !== String(count)) return `항목 수가 ${n} 입니다 (설정값 ${count})`;
      }
      if (/\{\{/.test(html)) return '치환되지 않은 토큰이 배포본에 있습니다';
      return true;
    },
  },
  {
    id: '주석제거',
    label: '배포본에 주석·내부 표기가 남지 않았다',
    page: null,
    /* 🔴 배포되는 전 페이지 〔2026-09-01 파생〕 — 손으로 적은 8장 중 둘이 이미 없었습니다. */
    pages: ALL_PAGES,
    check: (html) => {
      const left = (html.match(/<!--(?!!)/g) || []).length;
      if (left) return `HTML 주석 ${left}개가 남았습니다`;
      for (const word of ['정본 §', 'PRD-', '미결 L-', '와이어프레임']) {
        if (html.includes(word)) return `내부 표기 "${word}" 가 남았습니다`;
      }
      return true;
    },
  },
  /* ── R-1 정가 취소선 — **삭제했습니다** 〔2026-09-01 · 대표 지시〕 ─────────────
   *
   * 이 검사는 `/precheck` 에 **판매가 총액(₩330,000)이 «렌더돼 있는지»**를 요구했습니다.
   * 2026-08-30 에 접수·결제 폼을 내리면서 그 화면이 사라졌고, 지금 `/precheck` 에 금액이
   * 있으면 그것이 **사고**입니다 — 검사가 요구하던 것과 정반대가 됐습니다.
   *
   * 🔴 **지우기 전에 대체 그물을 확인했습니다**(대표 지시) — `test/price-exposure.test.js`
   *    가 살아 있는 전 페이지 소스에서 금액 재등장을 막습니다. 실측(2026-09-01):
   *      ₩330,000 ✅ · ₩300,000 ✅ · 33만원 ✅ · 30만원 ✅  (네 표기 모두 검출)
   *    소스에 없으면 dist 에도 없습니다(build-static 의 「화면 문구 불변」 검증이 그 둘을
   *    묶습니다). 그래서 배포 시점에 같은 것을 한 번 더 셀 필요가 없습니다.
   * ⚠️ 함께 사라진 축 셋: 취소선 태그/CSS · ₩290,000 · 부가세 병기. 앞의 둘은 아래
   *    `R1-비교표기` 가 **전 페이지**에서 계속 봅니다(더 넓습니다). 부가세 병기는 그 문구를
   *    든 화면 자체가 없어져 잴 대상이 없습니다.
   * 🔴 되살릴 조건: 이 저장소에 결제 폼이 다시 서면 그때 함께 되살리십시오
   *    (원본: `git show 5a74892:scripts/verify-deployment.js` 의 `R1-취소선`).
   */

  /* ── R-1 확장 · 「정가」 문자 표기 제거 (2026-08-12) ───────────────
   *
   * 🔴 R-1 은 /precheck 의 **취소선**만 걷어냈습니다. 실측(2026-08-12) 결과
   *    /nda 와 /refund 에 「정가 ₩290,000」이 **문자로** 남아 있었습니다 —
   *    취소선보다 직접적인 종전거래가격 표시입니다(단어를 그대로 씁니다).
   *
   * 그래서 확인을 페이지 하나가 아니라 **전 페이지**로 넓힙니다. 한 자리만 보면
   * 같은 표기가 다른 페이지에서 조용히 되살아납니다 — 실제로 그렇게 남았습니다.
   *
   * ⚠️ 2026-08-12 에 「런칭가」를 같은 항목에 넣었습니다 〔R-1 확장 2〕. 「정가」를
   *    없앤 뒤 「런칭가」만 남으면 비교 대상 없이 「원래 더 비쌌다」를 암시합니다 —
   *    같은 규칙(비교 표기 금지)이라 한 자리에서 함께 셉니다. 규칙을 쪼개 두면
   *    다음에 한쪽만 보게 됩니다. 이 항목이 넓어진 경위가 정확히 그것입니다.
   */
  {
    id: 'R1-비교표기',
    label: '어느 페이지에도 「정가」·「런칭가」·290,000 이 없다',
    /* 🔴 배포되는 전 페이지 〔2026-09-01 파생〕. 새 페이지가 서면 자동으로 대상이 됩니다. */
    pages: ALL_PAGES,
    check: (html) => {
      if (html.includes('정가')) return '「정가」 표기가 남아 있습니다';
      if (html.includes('런칭가')) return '「런칭가」 표기가 남아 있습니다';
      if (/290,000|290000/.test(html)) return '290,000 이 화면에 렌더되고 있습니다';
      return true;
    },
  },

  /* ── R-2 과금 게이트 (2026-08-11) ───────────────────────────────── */
  {
    id: 'R2-과금게이트',
    /*
     * 🔴 **배포 시 대조**입니다. 게이트 값은 코드 상수라 배포본에 굳습니다 —
     *    소스를 고치고 배포를 잊거나, 배포는 됐는데 다른 커밋이 올라간 경우
     *    라이브가 소스와 다른 답을 합니다. 그 침묵을 여기서 깹니다.
     *
     * ⚠️ 기대값을 하드코딩하지 않습니다. 이 저장소 소스에서 읽어 대조합니다 —
     *    하드코딩하면 게이트를 여는 날 이 파일이 조용히 낡습니다.
     */
    label: '/api/payment-config 의 과금 게이트가 소스와 같다',
    page: null,
    raw: '/api/payment-config',
    check: (res) => {
      if (res.status !== 200) return `HTTP ${res.status}`;
      let body;
      try { body = JSON.parse(res.body); } catch (e) { return '응답이 JSON 이 아닙니다'; }

      const gate = require(path.join(ROOT, 'api', '_precheck-charge-gate.js'));
      const expected = gate.isPrecheckPaidChargeEnabled();

      if (typeof body.chargeEnabled !== 'boolean') {
        return 'chargeEnabled 가 응답에 없습니다 — 게이트 배선이 배포되지 않았습니다';
      }
      if (body.chargeEnabled !== expected) {
        return `라이브 chargeEnabled=${body.chargeEnabled} · 소스=${expected} — 배포본이 소스와 다릅니다`;
      }
      if (!expected) {
        const want = gate.precheckChargeBlockers();
        const got = body.chargeBlockers || [];
        if (got.join(',') !== want.join(',')) {
          return `막힌 사유가 다릅니다 — 라이브 [${got}] · 소스 [${want}]`;
        }
      }
      // 게시는 과금과 별개로 계속 열려 있어야 합니다.
      if (body.displayEnabled !== true) return '게시(displayEnabled)까지 닫혔습니다';
      return true;
    },
  },
  /*
   * api/cron/ 의 라우트 수만큼 자동으로 만들어집니다 — 새 cron 파일을 추가하면
   * 이 배열을 손대지 않아도 다음 실행부터 검사 대상에 들어갑니다.
   */
  ...CRON_ROUTES.map((route) => ({
    id: 'cron-비공개' + route.replace(/\//g, '-'),
    label: `cron 라우트가 무인증 호출에 404 로 답한다 (${route})`,
    page: null,
    raw: route,
    check: cronPrivacyCheck,
  })),
];

/* ──────────────────────────────────────────────────────────────
 * 실행
 * ────────────────────────────────────────────────────────────── */

/*
 * 🔴 **기본으로 `lang=ko` 쿠키를 보냅니다** 〔2026-08-21 신설 · 2026-08-30 배경 갱신〕.
 *
 * 2026-08-30 대표 지시로 middleware.js 의 기본이 국문으로 되돌아갔다 — 이제는 쿠키가
 * 없어도 국문 경로가 그대로 200 으로 온다. 그래도 이 스크립트는 계속 `lang=ko` 를
 * 명시적으로 보낸다: (a) 우연히 국문이 나오는 것과 「국문 쿠키를 골라도 국문」이 맞는
 * 것을 구분해 두면 나중에 기본이 다시 바뀌어도 이 45개 검사는 영향을 안 받고, (b) 쿠키
 * 자체가 사라지거나(파싱 오류) 무시되는 회귀는 이 값으로도 여전히 잡힌다.
 *
 * ⚠️ 영문 경로에는 영향이 없습니다 — middleware 의 matcher 는 국문 경로만 잡고, 반대 방향
 *    (`/en*` → 국문) 리다이렉트는 없습니다. 그래서 전 요청에 같은 쿠키를 붙입니다.
 * 🔴 **국문 우선/영문 선택 리다이렉트 자체는 아래 `국문우선`·`영문선택-리다이렉트` 검사가
 *    따로 잽니다** — 쿠키로 우회한 동작을 이 검사들에서 지우지 않습니다(그 두 리다이렉트
 *    분기가 지금 이 사이트의 현관입니다).
 */
async function get(url, cookie = 'lang=ko') {
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      'Cache-Control': 'no-cache',
      'User-Agent': 'trops-verify-deployment',
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  return {
    status: response.status,
    body: await response.text(),
    location: response.headers.get('location') || '',
  };
}

async function main(argv) {
  const base = String(argv[0] || '').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) {
    console.error('사용법: node scripts/verify-deployment.js <https://주소>');
    return 2;
  }

  console.log('확인 대상: ' + base + '\n');

  const cache = new Map();
  /* 캐시 키에 쿠키를 넣습니다 — 같은 주소를 쿠키 있이/없이 두 번 재기 때문입니다. */
  const fetchPage = async (url, cookie = 'lang=ko') => {
    const key = (cookie || 'none') + ' ' + url;
    if (!cache.has(key)) cache.set(key, await get(url, cookie));
    return cache.get(key);
  };

  let failed = 0;
  let passed = 0;

  for (const item of CHECKS) {
    /* `raw` 는 문자열 하나 또는 여러 개 — 200 을 전제하지 않는 검사(cron 비공개 · 국문우선 ·
       영문선택-리다이렉트). `local` 은 HTTP 를 쓰지 않는 소스끼리의 대조입니다. */
    const targets = item.local
      ? ['(소스)']
      : (item.raw ? [].concat(item.raw) : (item.pages || [item.page]));

    /*
     * 🔴 **대상 0개는 «통과»가 아닙니다** 〔2026-09-01 신설〕. 목록을 파생으로 바꾼 뒤로는
     *    파생이 깨지면 대상이 비고, 그러면 아래 루프가 한 바퀴도 안 돌면서 초록이 됩니다 —
     *    이 저장소가 가장 싫어하는 실패 형태(조용한 초록)입니다.
     */
    if (targets.length === 0) {
      failed += 1;
      console.log(`  ❌ ${item.id.padEnd(16)} ${item.label}`);
      console.log('     └ 대상이 0개입니다 — 목록 파생이 깨졌습니다(0개를 통과로 세지 않습니다)');
      continue;
    }

    const results = [];

    for (const target of targets) {
      /*
       * 🔴 **한 항목이 던져도 나머지는 계속 돕니다** 〔2026-09-01 · 대표 지시〕.
       *    종전에는 try/catch 가 없어서 `check` 안의 예외 하나가 **확인 전체를 끝냈습니다.**
       *    실측(2026-09-01): 20개 중 2개만 돌고 18개가 한 번도 실행되지 않았습니다.
       *    ⛔ 이 try 를 걷지 마십시오 — 걷으면 새 검사 하나의 오타가 다시 전체를 세웁니다.
       *    ⚠️ 「던졌다」를 「통과」로 삼키지 않습니다. 실패로 «적고» 계속합니다.
       */
      try {
        /* `noCookie` — 쿠키 없는 첫 방문을 재는 검사(국문우선)만 씁니다.
           `item.cookie` — 특정 쿠키를 골라 보내는 검사(영문선택-리다이렉트)만 씁니다.
           둘 다 없으면 기본값 `lang=ko` 를 보냅니다(위 `get()` 주석 참조). */
        if (item.local) {
          results.push([target, item.check()]);
          continue;
        }

        const cookie = item.cookie !== undefined ? item.cookie : (item.noCookie ? null : 'lang=ko');
        const res = await fetchPage(base + target, cookie);

        if (item.raw) {
          results.push([target, item.check(res, target)]);
          continue;
        }

        if (res.status !== 200) {
          results.push([target, `HTTP ${res.status}`]);
          continue;
        }
        results.push([target, item.check(res.body, {
          /* `target` 도 넘깁니다 〔2026-09-01〕 — 로케일마다 다른 말을 재는 검사(항목수)가
             자기가 지금 어느 페이지를 보는지 알아야 합니다. */
          target,
          sourceFile: item.sourceOf && item.sourceOf[target],
          expected: item.expectedPer && item.expectedPer[target],
        })]);
      } catch (e) {
        results.push([target, `검사가 예외를 던졌습니다: ${(e && e.message) || e}`]);
      }
    }

    const bad = results.filter(([, r]) => r !== true);
    if (bad.length === 0) {
      passed += 1;
      console.log(`  ✅ ${item.id.padEnd(16)} ${item.label}`);
      if (targets.length > 1) console.log(`     └ ${targets.join(' · ')}`);
    } else {
      failed += 1;
      console.log(`  ❌ ${item.id.padEnd(16)} ${item.label}`);
      for (const [target, reason] of bad) console.log(`     └ ${target}: ${reason}`);
    }
  }

  /*
   * 🔴 **「정의된 것 중 몇 개를 실제로 봤는가」를 함께 적습니다** 〔2026-09-01 신설〕.
   *    2026-09-01 이전에는 20개 중 2개만 돌고도 마지막 줄이 아예 찍히지 않아, 로그만
   *    보면 「몇 개를 안 본 것인지」를 알 수 없었습니다. 이제 이 줄이 어긋나면
   *    (실행 ≠ 정의) 러너가 중간에 무언가를 건너뛴 것입니다.
   */
  const ran = passed + failed;
  console.log(`\n  ${passed}개 통과 · ${failed}개 실패  (정의 ${CHECKS.length}개 중 ${ran}개 실행)  ${base}`);
  if (ran !== CHECKS.length) {
    console.log(`  ⚠️ 정의된 ${CHECKS.length}개 중 ${CHECKS.length - ran}개가 실행되지 않았습니다 — 러너가 중간에 빠져나갔습니다`);
    console.log('');
    return 1;
  }
  console.log('');
  return failed === 0 ? 0 : 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

module.exports = { CHECKS: CHECKS, main: main };
