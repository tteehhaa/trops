'use strict';
/*
 * track-section.test.js — 영역 계측 〔신설 2026-09-04〕
 *
 * 🔴 이 검사가 지키는 것은 **두 갈래**입니다.
 *    ① 보내는 값이 실제로 나가는가(영역·체류·스크롤·다음 걸음·맥락)
 *    ② **누구인지 알아내는 값이 늘지 않았는가** — 그리고 방침이 그 사실을 적는가
 *
 * ⚠️ 브라우저를 띄우지 않습니다 — 이 저장소에 DOM 실행 환경이 없습니다. 여기서 재는 것은
 *    **소스의 사실**이고, 실제 왕복은 사람이 확인합니다.
 */
const test = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
/* 주석을 걷은 코드 — 머리말의 인용이 단정을 대신하지 않게 합니다. */
const code = (f) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const TRACK = 'assets/track.js';
const LANDING = 'index.html';

/* ══ ① 보내는 곳이 둘이다 ══════════════════════════════════════════════ */

test('앱 계측으로도 보낸다 — 그러지 않으면 영역 집계에 영원히 닿지 않는다', () => {
  const s = code(TRACK);
  assert.ok(s.includes("'https://app.trops.kr/api/track'"), '앱 엔드포인트가 없습니다');
  assert.ok(s.includes("'/api/track'"), '종전 같은-오리진 경로가 사라졌습니다');
});

test('🔴 종전 표에는 칸 3개만 보낸다 — 그 표에 맥락 칸이 없다', () => {
  const s = code(TRACK);
  /* ⚠️ 한 줄 함수입니다 — 여러 줄로 읽으면 다음 함수까지 삼켜 이 검사가 무의미해집니다. */
  const m = s.match(/function sendLegacy\(payload\) \{[^\n]*\}/);
  assert.ok(m, 'sendLegacy 를 못 찾았습니다');
  for (const k of ['sessionKey', 'section', 'dwellMs', 'scrollDepth', 'isReturn']) {
    assert.ok(!m[0].includes(k), 'sendLegacy 가 ' + k + ' 를 보냅니다');
  }
  /* 부르는 자리가 넘기는 것도 칸 3개뿐이다. */
  for (const call of s.match(/sendLegacy\(\{[^}]*\}\)/g) || []) {
    for (const k of ['sessionKey', 'section', 'dwellMs', 'scrollDepth', 'isReturn']) {
      assert.ok(!call.includes(k), 'sendLegacy 호출이 ' + k + ' 를 넘깁니다');
    }
  }
});

test('🔴 본문 형식이 보내는 곳마다 다르다 — 하나로 통일하면 한쪽이 죽는다', () => {
  /*
   * 🔴 **이 검사의 초판이 실제 사고를 «통과시켰다»**〔2026-09-04 실측〕. 초판은
   *    「`application/json` 이 소스에 0건」을 단정했고, 그래서 같은-오리진 경로까지
   *    `text/plain` 으로 보내는 코드가 green 으로 배포됐다 — 그 함수(`api/track.js`)는
   *    JSON 으로 선언된 본문만 객체로 풀어 주므로 **모든 레거시 전송이 400** 이었다.
   * 🔴 그래서 지금은 **어느 쪽에 무엇을 쓰는지**를 자리별로 잰다.
   */
  const s = code(TRACK);
  const legacy = s.match(/function sendLegacy\(payload\) \{[^\n]*\}/);
  assert.ok(legacy, 'sendLegacy 를 못 찾았습니다');
  assert.ok(
    legacy[0].includes("'application/json'"),
    '같은 오리진에 text/plain 으로 보내면 그 함수가 본문을 못 풀어 400 입니다'
  );

  const app = s.match(/post\(APP_ENDPOINT[^\n]*\)/);
  assert.ok(app, '앱 전송 자리를 못 찾았습니다');
  assert.ok(
    app[0].includes("'text/plain;charset=UTF-8'"),
    '다른 오리진에 json 으로 보내면 preflight 가 붙고 sendBeacon 이 조용히 죽습니다'
  );

  /* ⛔ 형식을 함수 안에 다시 박지 않는다 — 인자로 받아야 두 자리가 갈린다. */
  const fn = s.match(/function post\(url, payload, beacon, contentType\)[\s\S]*?\n  \}/);
  assert.ok(fn, 'post 가 형식을 인자로 받지 않습니다');
  assert.ok(!/'(application\/json|text\/plain)/.test(fn[0]), 'post 안에 형식이 박혀 있습니다');
});

/* ══ ② 개인 식별자가 늘지 않았다 ═══════════════════════════════════════ */

test('🔴 쿠키·IP·User-Agent 를 만들지도 읽지도 않는다', () => {
  const s = code(TRACK);
  for (const bad of ['document.cookie', 'userAgent', 'navigator.platform', 'X-Forwarded']) {
    assert.ok(!s.includes(bad), '개인 식별자를 만졌습니다: ' + bad);
  }
});

test('🔴 localStorage 에는 «표시»만 둔다 — 값이 "1" 하나이고 서버로 가지 않는다', () => {
  const s = code(TRACK);
  /* 저장하는 값이 문자열 '1' 뿐이다. */
  assert.ok(/localStorage\.setItem\(LS_SEEN, '1'\)/.test(s), '표시 값이 "1" 이 아닙니다');
  /* 보내는 몸통에 그 표시가 실리지 않는다 — 참/거짓만 나간다. */
  const body = s.match(/var body = \{[\s\S]*?\};/);
  assert.ok(body, '보내는 몸통을 못 찾았습니다');
  assert.ok(!body[0].includes('LS_SEEN'), '표시를 서버로 보냅니다');
  assert.ok(!body[0].includes('localStorage'), '표시를 서버로 보냅니다');
  assert.ok(body[0].includes('isReturn'), '재방문 여부가 안 나갑니다');
});

test('🔴 세션 열쇠는 sessionStorage 다 — localStorage 에 난수를 두지 않는다', () => {
  const s = code(TRACK);
  assert.ok(/ssSet\(SS_KEY, key\)/.test(s), '세션 열쇠가 sessionStorage 가 아닙니다');
  assert.ok(
    !/localStorage\.setItem\(\s*SS_KEY/.test(s),
    'localStorage 에 열쇠를 두면 방문들이 이어집니다'
  );
});

test('🔴 한 방문에서 「다시 옴」의 답이 바뀌지 않는다 — 표시를 만들 때 한 번만 읽는다', () => {
  const s = code(TRACK);
  const fn = s.match(/function identity\(\)[\s\S]*?\n  \}/);
  assert.ok(fn, 'identity 를 못 찾았습니다');
  /* 이미 열쇠가 있으면 표시를 읽지 않고 곧바로 돌아온다. */
  const early = fn[0].indexOf('if (key) {');
  const readFlag = fn[0].indexOf('localStorage.getItem');
  assert.ok(early > -1 && readFlag > early, '기존 방문에서도 표시를 다시 읽습니다');
});

/* ══ ③ 영역 · 체류 · 스크롤 · 다음 걸음 ═══════════════════════════════ */

test('🔴 영역을 「본 것」은 새 종류가 아니라 조회다 — kind 는 두 값 그대로다', () => {
  const s = code(TRACK);
  const kinds = (s.match(/kind: '([a-z_]+)'/g) || []).map((k) => k.split("'")[1]);
  for (const k of kinds) {
    assert.ok(k === 'pageview' || k === 'click', '새 kind 를 만들었습니다: ' + k);
  }
  assert.ok(kinds.includes('pageview') && kinds.includes('click'), '두 종류가 다 안 나갑니다');
});

test('영역·체류·스크롤·다음 걸음이 실제로 나간다', () => {
  const s = code(TRACK);
  assert.ok(s.includes('IntersectionObserver'), '영역 관찰이 없습니다');
  assert.ok(s.includes('section: name'), 'section_seen 이 없습니다');
  assert.ok(/dwellMs: ms/.test(s), 'section_dwell 이 없습니다');
  assert.ok(/scrollDepth: maxDepth/.test(s), 'scroll_depth 가 없습니다');
  assert.ok(s.includes("'next:'"), 'next_step 이 없습니다');
});

test('🔴 스쳐 지난 것을 「봤다」·「머물렀다」로 세지 않는다', () => {
  const s = code(TRACK);
  /* 화면 아래를 스치기만 해도 「봤다」가 되지 않게 문턱이 있다. */
  assert.ok(/threshold: 0\.3/.test(s), '영역 문턱이 0 입니다');
  /* 1초 미만 체류는 보내지 않는다. */
  assert.ok(/ms < 1000/.test(s), '1초 미만 체류를 보냅니다');
});

test('🔴 스크롤 관찰이 passive 다 — 스크롤을 막지 않는다', () => {
  assert.ok(
    /addEventListener\('scroll', measureDepth, \{ passive: true \}\)/.test(code(TRACK)),
    'passive 가 아닙니다'
  );
});

test('🔴 떠날 때 한 번만 보낸다 — pagehide 와 visibilitychange 가 겹쳐 두 번 세지 않는다', () => {
  const s = code(TRACK);
  assert.ok(s.includes("addEventListener('pagehide', flush)"), 'pagehide 가 없습니다');
  assert.ok(s.includes('visibilitychange'), 'visibilitychange 가 없습니다');
  assert.ok(/if \(flushed\) return;/.test(s), '두 번 보낼 수 있습니다');
});

test('🔴 「다음 걸음」과 「어느 버튼」은 다른 물음이다 — 목적지에서 파생시킨다', () => {
  const s = code(TRACK);
  const fn = s.match(/function nextStepOf\(href\)[\s\S]*?\n  \}/);
  assert.ok(fn, 'nextStepOf 를 못 찾았습니다');
  for (const dest of ['prep-pack', 'export-precheck', 'precheck', 'contact']) {
    assert.ok(fn[0].includes("'" + dest + "'"), '목적지가 빠졌습니다: ' + dest);
  }
  /* 모르는 목적지는 보내지 않는다(짐작하지 않습니다). */
  assert.ok(fn[0].includes('return null'), '모르는 목적지를 지어냅니다');
});

/* ══ ④ 랜딩에 영역 이름이 실재한다 ════════════════════════════════════ */

test('🔴 주요 영역 전부에 이름이 붙어 있다 — 하나라도 빠지면 그 영역이 영원히 안 잡힌다', () => {
  const html = read(LANDING);
  const found = (html.match(/data-section="([a-z-]+)"/g) || []).map((m) => m.split('"')[1]);
  const want = [
    'nav', 'hero', 'problem', 'voice', 'steps',
    'demo', 'fit', 'faq', 'final', 'footer',
  ];
  for (const w of want) assert.ok(found.includes(w), '영역이 빠졌습니다: ' + w);
  assert.strictEqual(new Set(found).size, found.length, '같은 이름이 두 번 붙었습니다');
});

test('🔴 이름이 받는 쪽 모양을 지킨다 — 소문자·숫자·하이픈·밑줄 40자', () => {
  const html = read(LANDING);
  const found = (html.match(/data-section="([^"]+)"/g) || []).map((m) => m.split('"')[1]);
  for (const n of found) {
    assert.ok(/^[a-z0-9][a-z0-9_-]{0,39}$/.test(n), '받는 쪽이 버리는 이름입니다: ' + n);
  }
});

test('⚠️ #demo 앵커를 지우지 않았다 — 같은 문서 안에서 그리로 가는 링크가 있다', () => {
  const html = read(LANDING);
  assert.ok(html.includes('id="demo"'), '#demo 가 사라졌습니다');
  assert.ok(html.includes('href="#demo"'), '#demo 로 가는 링크가 사라졌습니다');
});

/* ══ ⑤ 방침이 그 사실을 적는다 ════════════════════════════════════════ */

test('🔴 방침이 늘어난 계측을 적는다 — 안 적으면 방침이 거짓말을 한다', () => {
  /*
   * 🔴 **읽는 사람에게 «보이는» 글만 잽니다** — 빌드가 HTML 주석을 걷어냅니다. 낡은 문장을
   *    이력으로 인용한 주석까지 세면, 「고쳤다」를 기록으로 남기는 것이 red 가 됩니다.
   */
  const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '');
  const ko = strip(read('privacy.html'));
  /*
   * 🔴 **낱말이 아니라 «약속»을 잽니다** — 음성 대조에서 「탭을 닫으면 사라지며」를 지워도
   *    `sessionStorage` 라는 낱말이 남아 통과했습니다. 낱말만 재면 방침이 약해져도 green 입니다.
   */
  const promises = [
    '영역',
    '머무셨는지',
    '아래로 내려',
    '탭을 닫으면 사라지며',
    '<code>sessionStorage</code>',
    '<code>trops_seen</code>',
    '회사 서버로 보내지 않습니다',
    '두 방문을 같은 분의 것으로 이을 수 없습니다',
    '참/거짓',
  ];
  for (const must of promises) {
    assert.ok(ko.includes(must), 'privacy.html 이 안 적었습니다: ' + must);
  }
  /* 「예외 1건」은 더는 사실이 아니다. */
  assert.ok(!ko.includes('예외 1건'), '「예외 1건」이 남아 있습니다 — 이제 둘입니다');
  /* 「페이지·버튼 단위로만」도 더는 사실이 아니다. */
  assert.ok(
    !ko.includes('페이지·버튼 단위로만'),
    '「페이지·버튼 단위로만」이 남아 있습니다 — 영역 단위로 셉니다'
  );
});

test('🔴 영어 방침도 같은 말을 한다', () => {
  const en = read('en-privacy.html').replace(/<!--[\s\S]*?-->/g, '');
  for (const must of [
    '<code>sessionStorage</code>',
    '<code>trops_seen</code>',
    'how far down you scrolled',
    'disappears when you close the tab',
    'never sent to our servers',
    'cannot join two visits to the same person',
  ]) {
    assert.ok(en.includes(must), 'en-privacy.html 이 안 적었습니다: ' + must);
  }
  assert.ok(
    !en.includes('One exception: a single functional cookie'),
    '「예외 하나」가 남아 있습니다 — 이제 둘입니다'
  );
});

test('🔴 방침이 «안 하는 것»도 그대로 적는다', () => {
  const ko = read('privacy.html').replace(/<!--[\s\S]*?-->/g, '');
  for (const must of ['쿠키·기기 식별자·IP 주소', '알 수 없습니다']) {
    assert.ok(ko.includes(must), '안 하는 것을 안 적었습니다: ' + must);
  }
});
