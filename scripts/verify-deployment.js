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

/** 소스의 CSS 선언 블록을 통째로 꺼냅니다 — 기대값의 출처를 소스로 둡니다. */
function ruleFrom(file, selector) {
  const body = findRule(source(file), selector);
  if (body === null) throw new Error(`소스 ${file} 에 ${selector} 규칙이 없습니다`);
  return body;
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
  const expected = decls(ruleFrom(file, selector));
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

const CHECKS = [
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
    check: (res, target) => {
      if (LANG_PAIRS.length < 7) {
        return `middleware.js 에서 읽은 짝이 ${LANG_PAIRS.length}개입니다 — 표 파싱이 깨졌습니다`;
      }
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
    label: 'V5 · h3/.h3 계층이 정의돼 있다 (28/600/1.35/−0.025em)',
    page: '/',
    check: (html) => sameRule(html, 'index.html', 'h3, .h3', TYPO),
  },
  {
    id: 'V5-로드맵헤딩',
    label: 'V5 · 로드맵 헤딩이 H3 계층으로 렌더된다 (700→600 · clamp 해제)',
    page: '/',
    check: (html) => {
      const same = sameRule(html, 'index.html', '.how h2.rm-h2', TYPO);
      if (same !== true) return same;
      // 회귀 형태를 직접 막습니다 — clamp 가 돌아오면 H2 스케일로 다시 커집니다.
      const d = decls(findRule(html, '.how h2.rm-h2'));
      if (/clamp/.test(d['font-size'])) return `font-size 에 clamp 가 돌아왔습니다: ${d['font-size']}`;
      if (d['font-weight'] !== '600') return `font-weight 가 ${d['font-weight']} 입니다 (600 이어야 함)`;
      return true;
    },
  },

  /* ── C-1 ② 패딩 통일 ────────────────────────────────────────────── */
  {
    id: '패딩-컨테이너',
    label: '패딩 · 6페이지 .container 좌우가 같다 (상한 48px)',
    page: null,   // 여러 페이지 — pages 로 따로 돕니다
    pages: ['/', '/en', '/nda', '/precheck', '/refund', '/uae'],
    sourceOf: { '/': 'index.html', '/en': 'en.html', '/nda': 'nda.html',
      '/precheck': 'precheck.html', '/refund': 'refund.html', '/uae': 'uae.html' },
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
    label: '패딩 · 섹션 상하가 한 값으로 통일됐다 (clamp 60/8vw/96)',
    page: '/',
    check: (html) => {
      const norm = (s) => s.replace(/\s+/g, '');
      const expected = (source('index.html').match(/clamp\(\s*60px\s*,\s*8vw\s*,\s*96px\s*\)/g) || []).length;
      const got = (norm(html).match(/clamp\(60px,8vw,96px\)/g) || []).length;
      if (expected === 0) return '소스에 섹션 패딩 값이 없습니다 — 검사가 낡았습니다';
      if (got !== expected) return `섹션 패딩 자리가 ${got}곳입니다 (소스 ${expected}곳)`;
      // V7 이전 값들. 한 페이지 안에서 96·104·108·112 로 갈려 있던 상태입니다.
      for (const stale of ['108px', '112px', '104px']) {
        if (norm(html).includes('padding-block:' + stale)) return `V7 이전 값 ${stale} 가 남아 있습니다`;
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
    label: '영문 5개가 서고 영문으로 렌더된다',
    /* 🔄 `/en-check` 를 뺐습니다 〔2026-08-30 · 사전 확인 3문항 제거〕.
       ⚠️ `/en-precheck` 는 **이 커밋 범위 밖**입니다 — 2026-08-30 6장 제거(ca47218) 때
          여기서 빠지지 않아 이미 낡은 항목이고, `en-precheck.html` 이 없어
          `npm run verify:prod` 가 지금도 이 자리에서 넘어집니다. 함께 정리하십시오. */
    pages: ['/en', '/en-precheck', '/en-refund', '/en-privacy'],
    sourceOf: {
      '/en': 'en.html',
      '/en-precheck': 'en-precheck.html',
      '/en-refund': 'en-refund.html',
      '/en-privacy': 'en-privacy.html',
    },
    check: (html, ctx) => {
      if (!/<html[^>]+lang=["']en["']/.test(html)) return 'html lang="en" 이 아닙니다';

      const want = (source(ctx.sourceFile).match(/<title>([^<]*)<\/title>/) || [])[1];
      if (!want) return `소스 ${ctx.sourceFile} 에 <title> 이 없습니다 — 검사가 낡았습니다`;
      const got = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
      if (got !== want) return `<title> 이 다릅니다 — 배포 ${JSON.stringify(got)} / 소스 ${JSON.stringify(want)}`;

      /* 화면에 보이는 한글. 국문판이 영문 주소로 올라가거나 번역이 빠진 자리를 잡습니다.
         ⚠️ nav 의 언어 전환 링크(「한국어」)만 예외입니다 — 그 글자가 한글인 것이 그 링크의 일입니다. */
      const text = html
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<a class="nav-quiet"[^>]*>[^<]*<\/a>/g, '')
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
  ...[
    ['/', '/en', 'index.html'],
    /* ⚠️ `/precheck` 쌍은 위와 같은 이유로 남아 있습니다 — 이 커밋 범위 밖입니다. */
    ['/precheck', '/en-precheck', 'precheck.html'],
    ['/refund', '/en-refund', 'refund.html'],
  ].map(([ko, en, koFile]) => ({
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
  })),
  /*
   * 🔴 영문 경로가 **끝까지 영문**인지. 라이브에서 봐야 하는 이유는, 마크업의 href
   *    만으로는 안 걸리는 자리가 있기 때문입니다 — replaceState 목적지와 토스
   *    결제 복귀 주소(successUrl·failUrl)는 스크립트 안 문자열입니다.
   *    2026-08-16 에 실제로 셋 다 국문(/precheck)을 가리킨 채였습니다.
   */
  {
    id: 'en-경로누수',
    label: '영문 4개가 국문 페이지로 새지 않는다',
    pages: ['/en', '/en-check', '/en-precheck', '/en-refund'],
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
      for (const ko of ['/precheck', '/check', '/refund', '/privacy']) {
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
    check: (html) => {
      for (const key of ['companyName', 'ceo', 'registrationNo', 'ecommerceNo', 'address', 'phone']) {
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
    label: '대조 항목 수가 5곳에 설정값으로 나온다',
    page: null,
    pages: ['/nda', '/uae', '/refund'],
    expectedPer: { '/nda': 2, '/uae': 1, '/refund': 2 },
    check: (html, ctx) => {
      const count = config.precheck.itemCount;
      const found = [...html.matchAll(/(\d+)\s*개 항목/g)].map((m) => m[1]);
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
    pages: ['/', '/en', '/nda', '/precheck', '/refund', '/uae', '/privacy', '/en-privacy'],
    check: (html) => {
      const left = (html.match(/<!--(?!!)/g) || []).length;
      if (left) return `HTML 주석 ${left}개가 남았습니다`;
      for (const word of ['정본 §', 'PRD-', '미결 L-', '와이어프레임']) {
        if (html.includes(word)) return `내부 표기 "${word}" 가 남았습니다`;
      }
      return true;
    },
  },
  /* ── R-1 정가 취소선 제거 (2026-08-11) ──────────────────────────── */
  {
    id: 'R1-취소선',
    label: '/precheck 에 정가 취소선이 없다 (판매가 총액 하나만 보인다)',
    page: '/precheck',
    check: (html) => {
      // 세 겹으로 봅니다 — 마크업 · CSS · 값. 하나만 보면 되살아나는 형태를 놓칩니다.
      const tags = (html.match(/<s[\s>]/g) || []).length;
      if (tags) return `s 태그가 ${tags}개 남아 있습니다`;
      if (/line-through/.test(html)) return 'line-through CSS 가 배포본에 있습니다';
      if (/290,000/.test(html)) return '₩290,000 이 화면에 렌더되고 있습니다';

      /*
       * 🔴 **기대값을 `api/_payment.js` 에서 읽습니다** 〔2026-08-21〕 — 하드코딩을 걷었습니다.
       *
       * 종전에는 이 줄이 `₩300,000` 을 직접 들고 있었고, 2026-08-17 에 판매가가
       * **₩330,000(VAT 포함 총액)** 으로 바뀌면서 **조용히 낡았습니다.** 이 파일 머리의
       * 「⚠️ 기대값을 여기 하드코딩하지 마십시오 — 소스를 고칠 때 이 파일이 조용히
       * 낡습니다」를 정작 이 검사가 어기고 있었던 자리입니다.
       *
       * ⚠️ 그 실패가 오래 안 보인 이유가 하나 더 있습니다 — 영어 우선 접속(2026-08-21)
       *    이후로 이 검사가 `/precheck` 에 **닿지도 못했습니다**(HTTP 307). 두 고장이
       *    겹치면 하나가 다른 하나를 가립니다(위 `get()` 쿠키 주석과 같은 사건).
       * 🔴 `PRICE` 는 **서버가 신뢰하는 그 값**입니다(결제 요청 금액과 같은 상수) —
       *    화면 표기가 그 값과 갈라지는 순간이 이 검사가 잡아야 하는 순간입니다.
       */
      const price = require(path.join(ROOT, 'api', '_payment.js')).PRICE;
      const priceText = '₩' + price.toLocaleString('en-US');
      if (!new RegExp(priceText).test(html)) {
        return `${priceText} 이 없습니다 — 판매가 표기가 배포되지 않았습니다 ` +
          '(api/_payment.js PRICE 기준)';
      }
      /*
       * 🔴 **폐기가가 남아 있지 않은지도 봅니다.** md §4 가 「99,000원 헤드라인 폐기 확정」을
       *    적었고, 값을 옮길 때 화면 3자리 중 하나만 고치는 것이 이 저장소에서 반복된 실수입니다.
       */
      if (/₩99,000/.test(html)) return '폐기된 ₩99,000 이 아직 렌더되고 있습니다 — 고친 자리가 일부뿐입니다';
      /*
       * 부가세 병기 — **문구도 소스(precheck.html)에서 읽습니다** 〔2026-08-21〕.
       *
       * 종전에는 `부가세(VAT) 별도` 를 하드코딩했습니다. 2026-08-17 에 판매가가 VAT 포함
       * 총액(₩330,000)이 되면서 화면 문구가 **「부가세(VAT) 포함」으로 뒤집혔고**, 이 줄만
       * 「별도」에 남아 있었습니다 — 위 금액과 **같은 한 번의 변경에서 같이 낡은** 자리입니다.
       *
       * 🔴 이 검사가 지켜야 하는 것은 「별도」라는 낱말이 아니라 **병기가 사라지지 않는 것**과
       *    **배포본이 소스와 같은 말을 하는 것**입니다. 그래서 소스에서 찾은 그 문장을
       *    배포본에 요구합니다 — 대표가 어느 쪽으로 정하든 검사가 따라갑니다.
       */
      const vat = (source('precheck.html').match(/부가세\(VAT\) (포함|별도)/) || [])[0];
      if (!vat) {
        return '소스 precheck.html 에서 부가세 병기를 찾지 못했습니다 — 병기가 사라졌습니다';
      }
      if (!html.includes(vat)) {
        return `배포본에 「${vat}」 병기가 없습니다 (소스 precheck.html 기준)`;
      }
      return true;
    },
  },

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
    pages: ['/', '/en', '/nda', '/precheck', '/refund', '/uae', '/privacy', '/en-privacy'],
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
       영문선택-리다이렉트). */
    const targets = item.raw ? [].concat(item.raw) : (item.pages || [item.page]);
    const results = [];

    for (const target of targets) {
      /* `noCookie` — 쿠키 없는 첫 방문을 재는 검사(국문우선)만 씁니다.
         `item.cookie` — 특정 쿠키를 골라 보내는 검사(영문선택-리다이렉트)만 씁니다.
         둘 다 없으면 기본값 `lang=ko` 를 보냅니다(위 `get()` 주석 참조). */
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
        sourceFile: item.sourceOf && item.sourceOf[target],
        expected: item.expectedPer && item.expectedPer[target],
      })]);
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

  console.log(`\n  ${passed}개 통과 · ${failed}개 실패  (${base})\n`);
  return failed === 0 ? 0 : 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

module.exports = { CHECKS: CHECKS, main: main };
