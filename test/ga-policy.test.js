'use strict';
/*
 * ga-policy.test.js — Google Analytics 4 와 방침이 서로 어긋나지 않게 잰다 〔신설 2026-09-12〕
 *
 * 🔴 이 검사가 지키는 것은 **세 갈래**입니다.
 *    ① 측정 ID 가 «한 곳»인가 — 8장에 스니펫을 붙여넣는 형태로 돌아가지 않았는가
 *    ② 배포되는 페이지 전부가 실제로 GA 를 부르는가 — 한 장만 빠지면 그 페이지의
 *      집계가 조용히 0 이 됩니다(빠진 것은 화면에 보이지 않습니다)
 *    ③ **방침이 그 쿠키와 국외이전을 적는가** — 태그만 심고 방침을 안 고치면
 *      개인정보처리방침이 거짓 문장을 싣게 됩니다. 그 형태가 실제로 있었습니다:
 *      2026-09-12 에 태그를 먼저 넣었고, `privacy.html` §01 은 그때까지
 *      「분석 쿠키를 심지 않는다」였습니다.
 *
 * ⚠️ `test/track-section.test.js` 와 축이 다릅니다 — 그쪽은 **자체 집계**(assets/track.js,
 *    쿠키 없음)이고 이쪽은 **구글로 나가는 집계**(assets/ga.js, 쿠키 있음)입니다.
 *    ⛔ 두 검사를 한 파일로 합치지 마십시오. 방침 §01 이 그 둘을 «다른 예외»로 적고
 *       있어서, 한쪽을 걷을 때 다른 쪽 단정이 함께 흔들리면 안 됩니다.
 *
 * ⚠️ 브라우저를 띄우지 않습니다 — 재는 것은 **소스의 사실**입니다. 실제 수집 여부는
 *    GA 실시간 보고서로 사람이 확인합니다.
 */
const test = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
/** 주석을 걷은 본문 — 주석의 인용이 단정을 대신하지 않게 합니다. */
const noComments = (f) => read(f).replace(/<!--[\s\S]*?-->/g, '');

const GA = 'assets/ga.js';
/** 측정 ID. ⚠️ 쿠키 이름(`_ga_RQ1NWGK0KM`)에는 `G-` 접두가 없어 서로 안 걸립니다. */
const MEASUREMENT_ID = 'G-RQ1NWGK0KM';
const PAGES = require('../scripts/build-static.js').STATIC.html.map((e) => e.file);

/* ══ ① 측정 ID 가 한 곳이다 ═══════════════════════════════════════════ */

test('측정 ID 가 assets/ga.js 에 있다', () => {
  assert.ok(read(GA).includes("'" + MEASUREMENT_ID + "'"), GA + ' 에 측정 ID 가 없습니다');
});

test('🔴 측정 ID 가 페이지에 박혀 있지 않다 — 8벌이 되면 속성 교체 때 갈린다', () => {
  for (const f of PAGES) {
    assert.ok(
      !read(f).includes(MEASUREMENT_ID),
      f + ' 에 측정 ID 가 박혀 있습니다. 구글이 주는 gtag 스니펫을 붙여넣지 말고 ' +
        GA + ' 를 부르십시오'
    );
  }
});

test('🔴 페이지가 gtag.js 를 직접 부르지 않는다 — 부르면 위 단정을 우회한다', () => {
  for (const f of PAGES) {
    assert.ok(
      !noComments(f).includes('googletagmanager.com'),
      f + ' 가 gtag.js 를 직접 부릅니다'
    );
  }
});

/* ══ ② 배포되는 페이지 전부가 부른다 ══════════════════════════════════ */

test('🔴 배포되는 페이지 전부가 GA 를 «한 번» 부른다', () => {
  assert.ok(PAGES.length >= 8, '페이지를 ' + PAGES.length + '장만 찾았습니다 — 검사가 헛돕니다');
  const tag = '<script async src="/assets/ga.js"></script>';
  for (const f of PAGES) {
    const n = noComments(f).split(tag).length - 1;
    assert.strictEqual(n, 1, f + ' 의 GA 호출이 ' + n + '개입니다(1이어야 합니다)');
  }
});

/* ══ ③ 코드가 광고 기능을 켜지 않는다 ════════════════════════════════ */

/*
 * 🔴 방침 §01 이 「광고에 쓰지 않습니다 — 광고 기능을 켜지 않았고」라고 적습니다.
 * ⚠️ 그 둘은 **GA 속성 설정**이기도 해서 코드만으로는 다 잴 수 없습니다. 코드에서
 *    켜는 길만 막아 둡니다 — 속성 쪽은 사람이 봅니다(§08 에 미결로 적혀 있습니다).
 */
test('🔴 ga.js 가 광고 기능을 켜지 않는다 — 켜면 방침 §01 이 거짓이 된다', () => {
  const s = read(GA);
  for (const forbidden of ['allow_google_signals', 'allow_ad_personalization_signals', 'user_id']) {
    assert.ok(!s.includes(forbidden), GA + ' 가 ' + forbidden + ' 를 씁니다 — 방침을 먼저 고치십시오');
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
