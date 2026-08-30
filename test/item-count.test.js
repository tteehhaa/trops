'use strict';

/**
 * 대조 항목 수(「N개 항목」)의 단일소스화를 지키는 테스트 (2026-08-11).
 *
 * 🔄 2026-08-23 〔PRD v2.1 B1-1〕 값이 18 → 17 로 바뀌었습니다(판정 엔진 UK IPO 17항목).
 *    이 파일이 지키는 것은 값 자체가 아니라 **값이 한 곳뿐이다** 입니다.
 *
 * 왜 필요한가: 이 숫자가 5곳에 하드코딩돼 있었습니다 —
 *   nda.html 2곳(본문 · QnA) · uae.html 1곳(CTA 노트) · refund.html 2곳(01 적용대상 · 04 표)
 *   〔2026-08-30〕 앞의 둘은 페이지가 삭제돼 사라졌고, 대신 **en-refund.html 2곳**이
 *   표에 들어왔습니다(여태 세지 않던 자리입니다). 지금 자리 수는 **4** 입니다.
 *
 * 값의 정본은 이 저장소가 아니라 판정층 trops_a 이고, 거기서 파생됩니다:
 *   ICC_ITEM_IDS − V1_EXCLUDED_ITEM_IDS (2026-08-23 기준 17)
 *
 * 자동 연동은 불가능합니다(정적 HTML · 판정층 코드를 가져오면 경계 위반).
 * 그래서 여기서 지킬 수 있는 것은 「이 저장소 안에서 값이 한 곳뿐이다」입니다:
 *
 *   1. 소스 HTML 에 숫자가 없다 (토큰만 있다)
 *   2. site.config.json 한 줄을 바꾸면 5곳이 전부 따라온다
 *   3. 지금 값이 5곳에 그대로 나온다 — 토큰화가 화면을 바꾸지 않았다
 *   4. 값이 양의 정수가 아니면 빌드가 선다
 *
 * ⚠️ 이 파일은 site-config.test.js · build-static.test.js 와 같은 dist/ 를 만들고
 *    검사 도중 site.config.json 을 잠깐 바꿨다 되돌립니다.
 *    package.json 의 --test-concurrency=1 을 지우면 세 파일이 서로를 밟습니다.
 */

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CONFIG = path.join(ROOT, 'site.config.json');

/**
 * 항목 수가 화면에 찍히는 페이지와 그 자리 수.
 *
 * 자리 수까지 적는 이유: 토큰 하나를 실수로 지워도 「값이 들어 있다」만 보는 검사는
 * 통과합니다. 5곳이 5곳으로 남아 있는지를 함께 셉니다.
 */
/*
 * 🔄 **2026-08-30 — 다섯 자리가 네 자리가 됐습니다**(대표 지시 · 낡은 기대 정리).
 *    `nda.html`(2) · `uae.html`(1) 이 2026-08-30 에 삭제됐습니다. 그리고 그때
 *    **`en-refund.html` 이 이 표에 아예 없던 것**이 드러났습니다 — 영문 환불 페이지의
 *    토큰 자리는 여태 아무도 세지 않았습니다(`build-static` 이 `en.html` 을 빠뜨렸던 것과
 *    같은 형태). 넣습니다.
 *
 * 🔴 **이 수는 «손으로» 유지합니다 — 파생으로 바꾸지 마십시오.**
 *    자리 수를 파일에서 세어 오면 「토큰 하나를 실수로 지웠다」를 **구조적으로 못 잡습니다**
 *    (재려는 대상에서 기대를 뽑는 순환이 됩니다). 이 표가 래칫인 것이 이 검사의 전부입니다.
 *    ⚠️ 대신 아래 「메타」 검사가 **표와 배포 목록이 어긋나는 것**을 legible 하게 잡습니다 —
 *       종전에는 그 어긋남이 ENOENT 로 나타났습니다.
 */
const PAGES = {
  'refund.html': 2,
  'en-refund.html': 2,
};

/**
 * 항목 수가 나오지 않아야 하는 페이지 — 여기 숫자가 생기면 새 하드코딩입니다.
 * 🔴 **파생입니다** — 배포되는 페이지 중 위 표에 없는 전부. 새 페이지가 생기면 자동으로
 *    감시 대상이 됩니다(종전에는 손으로 적어서 `sample.html` 두 장이 빠져 있었습니다).
 */
const { STATIC } = require('../scripts/build-static.js');
const LIVE_PAGES = STATIC.html.map((e) => e.file);
/*
 * ⚠️ **예시 리포트 예외가 사라졌습니다** 〔2026-08-31 · D-5〕 — `sample.html`·
 *    `en-sample.html` 이 유입 링크 0건으로 내려가면서 뺄 대상이 없어졌습니다.
 *    그 둘은 **가상 기업의 숫자**를 실어서 이 검사의 대상이 될 수 없었습니다 —
 *    ⛔ 예시 페이지를 다시 세우면 그때 예외도 함께 되살리십시오(배너 확인과 함께).
 */
const PAGES_WITHOUT = LIVE_PAGES.filter((f) => !(f in PAGES));

const TOKEN = '{{precheck.itemCount}}';

/**
 * 「N개 항목」 꼴. 숫자만 찾으면 CSS 의 18px 에 걸리므로 단위까지 묶어 봅니다.
 *
 * 🔴 **로케일마다 «다른 말»입니다** 〔2026-08-30〕 — 영문 페이지는 「17 items」로 씁니다.
 *    종전에는 국문 꼴 하나로만 재서, 표에 영문 페이지를 넣는 순간 「0곳」으로 나왔습니다.
 *    ⛔ 그때 「영문은 빼자」로 접지 않았습니다 — 그러면 영문 환불 페이지의 항목 수가
 *    계속 아무 검사도 받지 않습니다(그것이 이 배치가 발견한 결손입니다).
 */
const COUNT_PHRASE_BY_LOCALE = {
  ko: () => /(\d+)\s*개 항목/g,
  /*
   * ⚠️ **`the` 를 요구합니다** — 그냥 `N items` 로 두면 예시 리포트의 「19 items · 7 to
   *    handle first」(가상 기업의 **요건 수**이지 대조 항목 수가 아닙니다)가 걸립니다.
   *    국문 꼴이 `개 항목` 으로 단위를 묶는 것과 같은 층의 좁히기입니다.
   */
  en: () => /\bthe\s+(\d+)\s+items\b/g,
};
const LOCALE_OF = Object.fromEntries(
  require('../scripts/build-static.js').STATIC.html.map((e) => [e.file, e.locale])
);
const phraseRe = (page) => (COUNT_PHRASE_BY_LOCALE[LOCALE_OF[page]] || COUNT_PHRASE_BY_LOCALE.ko)();

function build() {
  execFileSync('node', [path.join(ROOT, 'scripts', 'build-static.js')], {
    cwd: ROOT,
    stdio: 'pipe',
  });
}

/**
 * 주석을 뺀 소스. 인수인계 메모는 값이 아니라 설명이고 빌드가 어차피 걷어냅니다 —
 * 예: nda.html 의 「이전 리드("AI가 18개 항목을 측정해 대조하고")를 되살리지 마십시오」.
 * HTML 주석뿐 아니라 <style>·<script> 안(=CSS·JS 주석이 사는 곳)도 함께 뺍니다.
 *
 * ⚠️ <script> 를 통째로 빼므로 uae.html 의 JS 리터럴 자리는 이 검사에서 안 보입니다.
 *    그 자리는 아래 「토큰이 자리 수만큼 있다」와 dist 검사가 지킵니다.
 */
function strippedSource(page) {
  return fs
    .readFileSync(path.join(ROOT, page), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
}

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
}

function countTokens(text) {
  return text.split(TOKEN).length - 1;
}

test('🔴 [메타] 자리 표가 배포 목록과 어긋나지 않는다 — ENOENT 로 죽지 않는다', () => {
  for (const page of Object.keys(PAGES)) {
    assert.ok(LIVE_PAGES.includes(page),
      page + ' 이 배포 목록에 없습니다 — 페이지가 삭제됐으면 위 PAGES 표에서 빼십시오');
  }
  assert.ok(PAGES_WITHOUT.length > 0, '감시 대상 페이지가 0장입니다 — 검사가 헛돕니다');
});

test('소스 HTML 에 항목 수가 하드코딩돼 있지 않다', () => {
  for (const page of Object.keys(PAGES).concat(PAGES_WITHOUT)) {
    const found = strippedSource(page).match(phraseRe(page)) || [];
    assert.deepEqual(
      found,
      [],
      `${page}: 항목 수 ${JSON.stringify(found)} 가 하드코딩돼 있습니다. ${TOKEN} 를 쓰십시오`
    );
  }
});

test('토큰이 페이지마다 자리 수만큼 있다', () => {
  for (const [page, expected] of Object.entries(PAGES)) {
    const raw = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.equal(
      countTokens(raw),
      expected,
      `${page}: ${TOKEN} 가 ${expected}곳 있어야 하는데 ${countTokens(raw)}곳입니다`
    );
  }

  const total = Object.values(PAGES).reduce((a, b) => a + b, 0);
  assert.equal(total, 4, '자리 수 합이 4가 아닙니다 — 목록을 다시 세십시오');
});

test('현재 설정값이 4곳 산출물에 그대로 들어간다', () => {
  const count = readConfig().precheck.itemCount;
  build();

  for (const [page, expected] of Object.entries(PAGES)) {
    const html = fs.readFileSync(path.join(DIST, page), 'utf8');
    const found = [...html.matchAll(phraseRe(page))].map((m) => m[1]);

    assert.equal(
      found.length,
      expected,
      `${page}: 「N개 항목」이 ${expected}곳 있어야 하는데 ${found.length}곳입니다`
    );
    for (const n of found) {
      assert.equal(n, String(count), `${page}: 항목 수가 ${n} 입니다 (설정값 ${count})`);
    }
  }
});

test('현재 확정값(17)이 설정에 들어 있다 — 엔진 항목 수와 맞는다', () => {
  // 이 테스트는 회귀 방지용입니다. 항목 수가 정말로 바뀌는 날 이 단정도 함께
  // 고쳐야 하고, 그때 「환불규정 04 의 근거가 바뀐다」는 것을 사람이 한 번 보게 됩니다.
  assert.equal(
    readConfig().precheck.itemCount,
    17,
    'precheck.itemCount 가 17 이 아닙니다. 판정 엔진(UK IPO 기준 17항목)과 맞는지 ' +
      '확인하고, 정말 바뀐 것이면 이 단정과 refund.html 04 의 환불 사유를 함께 검토하십시오.'
  );
});

test('항목 수를 한 곳에서 바꾸면 4곳이 전부 따라온다', () => {
  // 이 테스트가 본론입니다 — v1 항목이 늘거나 줄는 날 실제로 일어날 일을 그대로 해 봅니다:
  // site.config.json 한 줄만 고치고 빌드.
  const original = fs.readFileSync(CONFIG, 'utf8');
  const config = JSON.parse(original);

  const PROBE = 23;   // 17 과 겹치지 않고, 다른 숫자(20건·30일)와도 겹치지 않는 값
  config.precheck.itemCount = PROBE;

  try {
    fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2) + '\n');
    build();

    for (const [page, expected] of Object.entries(PAGES)) {
      const html = fs.readFileSync(path.join(DIST, page), 'utf8');
      const found = [...html.matchAll(phraseRe(page))].map((m) => m[1]);

      assert.equal(found.length, expected, `${page}: 자리 수가 ${expected} 가 아닙니다`);
      for (const n of found) {
        assert.equal(n, String(PROBE), `${page}: 바뀐 항목 수가 반영되지 않았습니다`);
      }
      assert.ok(!html.includes('17개 항목'), `${page}: 예전 값 17 이 남아 있습니다`);
    }
  } finally {
    fs.writeFileSync(CONFIG, original);
    build(); // 원상복구
  }
});

test('항목 수가 양의 정수가 아니면 빌드가 실패한다', () => {
  // 화면에 「0개 항목」·「null개 항목」이 찍히는 것보다 빌드가 깨지는 편이 낫습니다.
  const original = fs.readFileSync(CONFIG, 'utf8');

  for (const bad of [0, -1, '18', 18.5, null]) {
    const config = JSON.parse(original);
    config.precheck.itemCount = bad;
    try {
      fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2) + '\n');
      assert.throws(
        () => build(),
        `precheck.itemCount = ${JSON.stringify(bad)} 인데도 빌드가 성공했습니다`
      );
    } finally {
      fs.writeFileSync(CONFIG, original);
    }
  }

  build(); // 원상복구
});

test('site.config.json 에 precheck 묶음이 있다', () => {
  const config = readConfig();
  assert.ok(config.precheck, 'precheck 묶음이 없습니다');
  assert.equal(typeof config.precheck.itemCount, 'number', 'precheck.itemCount 가 없습니다');

  // 파생 근거가 주석으로 남아 있는지. 이 값은 손으로 동기화하는 값이라,
  // 「어디서 온 숫자인지」가 사라지면 다음 사람이 근거 없이 고칩니다.
  const note = JSON.stringify(config._comment_precheck || []);
  assert.match(note, /ICC_ITEM_IDS/, 'precheck 주석에 trops_a 파생 근거가 없습니다');
  assert.match(note, /V1_EXCLUDED_ITEM_IDS/, 'precheck 주석에 v1 제외 근거가 없습니다');
});
