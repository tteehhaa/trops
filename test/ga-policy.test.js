'use strict';
/*
 * ga-policy.test.js — Google Analytics 4 와 방침이 서로 어긋나지 않게 잰다 〔신설 2026-09-12〕
 *
 * 🔴 이 검사가 지키는 것은 **네 갈래**입니다.
 *    ① 측정 ID 가 «한 곳»인가 — 소스의 8장에는 토큰만 있고 값은 site.config.json 에만
 *    ② 8장이 **같은 블록을 문자 그대로** 싣는가 — 구글 스니펫은 페이지마다 복제되는
 *      형태라, 복제를 허용하는 대신 **갈리는 것을 검사로 막습니다**
 *    ③ 산출물에 감지 가능한 gtag.js 가 있는가 — 아래 「왜」 참조
 *    ④ **방침이 그 쿠키와 국외이전을 적는가** — 태그만 심고 방침을 안 고치면
 *      개인정보처리방침이 거짓 문장을 싣게 됩니다. 그 형태가 실제로 있었습니다:
 *      2026-09-12 에 태그를 먼저 넣었고, `privacy.html` §01 은 그때까지
 *      「분석 쿠키를 심지 않는다」였습니다.
 *
 * 🔴 **왜 공용 파일이 아니라 8장 복제인가** 〔2026-09-12 실측〕 — 처음에는
 *    `assets/ga.js` 가 gtag.js 를 주입하게 만들었습니다(측정 ID 한 곳 · 페이지당 한 줄).
 *    **수집은 정상이었습니다** — 프로덕션에서 `/g/collect` 가 `page_view` 로 204 를
 *    받았습니다. 그런데 GA 화면은 「웹사이트에서 Google 태그가 감지되지 않았습니다」
 *    였습니다. 구글의 감지기는 실행된 DOM 이 아니라 **HTML 소스**에서 gtag.js 를
 *    찾습니다. 그래서 스니펫을 8장에 되돌리고, 그때 잃는 「한 곳」을 ①②로 대신합니다.
 *    ⛔ 다시 공용 `.js` 로 빼지 마십시오 — 그 길은 이미 한 번 갔습니다.
 *
 * ⚠️ `test/track-section.test.js` 와 축이 다릅니다 — 그쪽은 **자체 집계**(assets/track.js,
 *    쿠키 없음)이고 이쪽은 **구글로 나가는 집계**(gtag, 쿠키 있음)입니다.
 *    ⛔ 두 검사를 한 파일로 합치지 마십시오. 방침 §01 이 그 둘을 «다른 예외»로 적고
 *       있어서, 한쪽을 걷을 때 다른 쪽 단정이 함께 흔들리면 안 됩니다.
 *
 * ⚠️ 브라우저를 띄우지 않습니다 — 재는 것은 **소스와 산출물의 사실**입니다. 실제 왕복은
 *    사람이 확인합니다(GA 실시간 보고서 · 요청의 `npa=1`).
 */
const test = require('node:test');
const assert = require('node:assert');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = join(__dirname, '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
/** 주석을 걷은 본문 — 주석의 인용이 단정을 대신하지 않게 합니다. */
const noComments = (f) => read(f).replace(/<!--[\s\S]*?-->/g, '');

/** 측정 ID 의 원본. ⛔ 여기 말고 어디에도 리터럴로 두지 마십시오. */
const GA_ID = JSON.parse(read('site.config.json')).analytics.gaId;
const PAGES = require('../scripts/build-static.js').STATIC.html.map((e) => e.file);

/** 산출물 검사는 dist/ 를 봅니다 — 없으면 빌드합니다(build-static.test.js 와 같은 방식). */
if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
  execFileSync('node', [join(ROOT, 'scripts', 'build-static.js')], { stdio: 'ignore' });
}

/**
 * 페이지의 GA 블록 — 주석을 걷은 뒤 gtag 두 태그를 통째로 집습니다.
 * 8장을 서로 비교하는 데 씁니다(② 갈림 방지).
 */
function gaBlock(file) {
  const m = noComments(file).match(
    /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js[\s\S]*?<\/script>\s*<script>[\s\S]*?<\/script>/
  );
  return m && m[0];
}

/* ══ ① 측정 ID 가 한 곳이다 ═══════════════════════════════════════════ */

test('측정 ID 의 원본이 site.config.json 에 있다', () => {
  assert.match(GA_ID, /^G-[A-Z0-9]{6,}$/, 'analytics.gaId 가 GA4 측정 ID 꼴이 아닙니다');
});

test('🔴 소스의 페이지에 측정 ID 가 «리터럴»로 없다 — 8벌이 되면 속성 교체 때 갈린다', () => {
  for (const f of PAGES) {
    assert.ok(
      !read(f).includes(GA_ID),
      f + ' 에 측정 ID 가 박혀 있습니다. `{{analytics.gaId}}` 토큰을 쓰십시오'
    );
  }
});

test('🔴 페이지가 토큰을 «두 자리»에 쓴다 — 로더 src 와 config 인자', () => {
  for (const f of PAGES) {
    const n = noComments(f).split('{{analytics.gaId}}').length - 1;
    assert.strictEqual(n, 2, f + ' 의 측정 ID 토큰이 ' + n + '개입니다(2여야 합니다)');
  }
});

/* ══ ② 8장이 «문자 그대로 같은» 블록을 싣는다 ═══════════════════════ */

test('🔴 배포되는 페이지 전부가 GA 블록을 «한 번» 싣는다', () => {
  assert.ok(PAGES.length >= 8, '페이지를 ' + PAGES.length + '장만 찾았습니다 — 검사가 헛돕니다');
  for (const f of PAGES) {
    const body = noComments(f);
    assert.ok(gaBlock(f), f + ' 에 GA 블록이 없습니다 — 이 페이지의 집계가 조용히 0 이 됩니다');
    const n = body.split('googletagmanager.com/gtag/js').length - 1;
    assert.strictEqual(n, 1, f + ' 의 gtag.js 로더가 ' + n + '개입니다(1이어야 합니다)');
  }
});

test('🔴 8장의 GA 블록이 문자 그대로 같다 — 복제를 허용하는 대신 갈림을 막는다', () => {
  const canon = gaBlock('index.html');
  for (const f of PAGES) {
    assert.strictEqual(
      gaBlock(f),
      canon,
      f + ' 의 GA 블록이 index.html 과 다릅니다. 8장을 함께 고치십시오'
    );
  }
});

/* ══ ③ 산출물이 «감지 가능»하다 ══════════════════════════════════════ */

/*
 * 🔴 이 검사가 있는 이유는 파일 머리주석의 실측입니다 — 수집이 정상인데 GA 화면이
 *    「감지되지 않았습니다」였습니다. 감지기는 HTML 소스를 봅니다.
 * ⚠️ 소스가 아니라 **dist/** 를 봅니다. 소스에는 토큰만 있고, 감지기가 읽는 것은
 *    치환이 끝난 산출물입니다.
 */
test('🔴 dist 의 8장에 측정 ID 가 «박힌» gtag.js 로더가 있다', () => {
  for (const f of PAGES) {
    const out = read(join('dist', f));
    assert.ok(
      out.includes('https://www.googletagmanager.com/gtag/js?id=' + GA_ID),
      'dist/' + f + ' 에 감지 가능한 gtag.js 로더가 없습니다'
    );
    assert.ok(!out.includes('{{analytics.'), 'dist/' + f + ' 에 치환되지 않은 토큰이 있습니다');
  }
});

/* ══ ④ 블록이 광고 기능을 «끈다» ════════════════════════════════════ */

/*
 * 🔴 방침 §01 이 「광고에 쓰지 않습니다 — 광고 기능을 켜지 않았고」라고 적습니다.
 * 🔴 **명시적으로 false 여야 합니다** 〔2026-09-12 실측〕. 처음에는 이 자리가
 *    「두 이름이 아예 없어야 한다」였는데, 그러면 «기본값»에 맡기는 것이 됩니다 —
 *    실제 프로덕션 요청에 `npa=0`(광고 맞춤설정 허용)이 붙어 나갔습니다.
 *    방침이 「켜지 않았다」를 단정하므로 코드가 그것을 직접 내려야 합니다.
 * ⚠️ 콘솔의 속성 설정으로도 켜집니다 — 그쪽은 사람이 봅니다(§08 미결).
 */
test('🔴 GA 블록이 광고 기능을 «끈다» — 켜면 방침 §01 이 거짓이 된다', () => {
  for (const f of PAGES) {
    const block = gaBlock(f) || '';
    for (const off of ['allow_google_signals: false', 'allow_ad_personalization_signals: false']) {
      assert.ok(block.includes(off), f + ' 의 GA 블록에 ' + off + ' 가 없습니다');
    }
    for (const on of ['allow_google_signals: true', 'allow_ad_personalization_signals: true', 'user_id']) {
      assert.ok(!block.includes(on), f + ' 의 GA 블록이 ' + on + ' 를 씁니다 — 방침을 먼저 고치십시오');
    }
  }
});

/* ══ ④ 방침이 그 쿠키와 국외이전을 적는다 ════════════════════════════ */

test('🔴 국문 방침이 GA 를 적는다 — 안 적으면 방침이 거짓말을 한다', () => {
  const ko = noComments('privacy.html');
  const musts = [
    '셋째 예외',                     // §01 — 예외가 셋이 됐다
    'Google Analytics 4',
    '<code>_ga</code>',              // 심는 쿠키를 이름으로 적는다
    '_ga_RQ1NWGK0KM',
    'tools.google.com/dlpage/gaoptout', // 빠지는 방법
    '방문 통계 집계',                 // §04 수탁
    '쿠키 식별자',                    // §04 국외이전 이전 항목
  ];
  for (const must of musts) {
    assert.ok(ko.includes(must), 'privacy.html 이 안 적었습니다: ' + must);
  }
  /* 🔴 §04 의 «두» 자리다 — 수탁만 적고 국외이전을 빠뜨리면 그 고지가 어디에도 없다. */
  assert.ok(
    ko.includes('Google LLC<br><span class="lead">(Google Analytics 4)'),
    '§04 수탁 표에 Google LLC 행이 없습니다'
  );
  assert.ok(
    ko.includes('<th scope="row">Google LLC</th>'),
    '§04 국외이전 표에 Google LLC 행이 없습니다'
  );
  /* 「예외 둘」은 더는 사실이 아니다. */
  assert.ok(!ko.includes('예외 둘 중 하나'), '「예외 둘 중 하나」가 남아 있습니다 — 이제 셋입니다');
});

test('🔴 영문 방침도 같은 말을 한다', () => {
  const en = noComments('en-privacy.html');
  const musts = [
    'third exception',
    'Google Analytics 4',
    '<code>_ga</code>',
    '_ga_RQ1NWGK0KM',
    'tools.google.com/dlpage/gaoptout',
    'Visit statistics',
    'United States',
  ];
  for (const must of musts) {
    assert.ok(en.includes(must), 'en-privacy.html 이 안 적었습니다: ' + must);
  }
  assert.ok(
    en.includes('Google LLC<br><span class="lead">(Google Analytics 4)'),
    '§04 processor 표에 Google LLC 행이 없습니다'
  );
  assert.ok(
    en.includes('<th scope="row">Google LLC</th>'),
    '§04 cross-border 표에 Google LLC 행이 없습니다'
  );
  assert.ok(
    !en.includes('One of two exceptions'),
    '「One of two exceptions」가 남아 있습니다 — 이제 셋입니다'
  );
});

test('🔴 두 방침이 같은 개정 시행일을 싣는다 — 한쪽만 고치면 갈린다', () => {
  assert.ok(
    noComments('privacy.html').includes('개정 &middot; 시행 2026년 9월 12일'),
    'privacy.html 의 개정 시행일이 2026-09-12 가 아닙니다'
  );
  assert.ok(
    noComments('en-privacy.html').includes('Amended and effective 12 September 2026'),
    'en-privacy.html 의 개정 시행일이 2026-09-12 가 아닙니다'
  );
});
