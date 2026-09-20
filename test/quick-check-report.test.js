/**
 * quick-check-report.test.js — 1분 진단 «응답 전송»이 꺼져 있다 〔축 뒤집음 2026-09-21〕
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **이 파일은 «있다»를 재다가 «없다»를 재는 쪽으로 뒤집혔습니다.**
 *    2026-09-20 에는 이 페이지가 고른 답과 점수를 앱 `POST /api/quick-check` 로 보냈고
 *    이 파일이 그 몸통을 Blob 에서 열어 확인했습니다. 2026-09-21(배치 6 L2)에 그 전송을
 *    껐습니다 — 1분 진단의 자리가 `app.trops.kr/quick-check` 로 옮겨(L1) 이 페이지의
 *    버튼 진입원이 0 이 됐고, 두 지면이 같은 표(`web_quick_check`)에 쓰면 「앱 1분 진단
 *    응답 수」를 셀 수 없기 때문입니다.
 * 🔴 **검사를 지우지 않고 뒤집었습니다** — 지우면 전송이 조용히 되살아나도 아무도 모릅니다.
 *    되살리는 것은 결정 사안이며, 그때 이 파일도 함께 되돌립니다(옛 판은 git 이 갖습니다).
 * ⛔ 되살리기 전에 앱 `/quick-check` 를 먼저 끄십시오.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **주소 계약(`query()`)은 그대로입니다** — 「다음」을 누르신 분의 고른 답은 여전히
 *    주소에 실려 앱으로 갑니다(점수는 담지 않습니다). 그 축은
 *    `test/precheck-handoff.test.js` 가 재며 ⛔ 이 파일과 합치지 않습니다.
 * ⚠️ **랜딩 계측(`assets/track.js`)은 함께 끄지 않았습니다** — 조회·클릭·영역이 그 축이고
 *    문도 표도 다릅니다. ⑤ 가 그 사실을 양의 방향으로 잠급니다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** 읽는 사람에게 «보이는» 글만 — 이 저장소는 주석에 옛 문장을 그대로 인용합니다. */
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '');

const source = read('precheck.html');
/**
 * 스크립트 블록의 «코드»만.
 * 🔴 블록 주석을 걷는 것이 이 검사의 전부입니다 — 폐기 기록이 `report()`·`sendBeacon` 을
 *    이름으로 적고 있어, 주석을 남겨 두면 ① 이 자기 기록을 위반으로 셉니다.
 */
const SCRIPT = source
  .match(/<script>\s*(\(function\(\)\{[\s\S]*?\n\}\)\(\);)\s*<\/script>/)[1]
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/* ══ ① 보내는 코드가 0건이다 ═════════════════════════════════════════════ */

test('🔴 이 페이지는 답과 점수를 보내지 않는다 — 보내는 꼴 넷이 코드에 0건이다', () => {
  /*
   * ⚠️ 넷을 함께 봅니다 — 하나만 막으면 다른 꼴로 되살아납니다(`sendBeacon` 을 지우고
   *    `fetch` 로 되돌린 적이 실제로 있었습니다 · 그때는 폴백이었습니다).
   */
  for (const [re, name] of [
    [/sendBeacon/, 'navigator.sendBeacon'],
    [/XMLHttpRequest/, 'XMLHttpRequest'],
    [/\bfetch\s*\(/, 'fetch('],
    [/api\/quick-check/, '앱 수집 문 주소'],
  ]) {
    assert.ok(!re.test(SCRIPT), `precheck.html 스크립트에 ${name} 이 되살아났습니다 — 앱과 두 지면이 같은 표에 씁니다`);
  }
});

test('🔴 `<form action>` 으로도 보내지 않는다 — 스크립트 밖 경로까지 닫는다', () => {
  assert.ok(!/<form[^>]*\saction=/i.test(source), 'precheck.html 에 action 이 붙은 폼이 생겼습니다');
});

/* ══ ② 폐기 기록이 남아 있다 ═════════════════════════════════════════════ */

test('🔴 «껐다»는 기록과 되살리는 조건이 소스에 남아 있다 — 지우면 다음 사람이 이유를 모른다', () => {
  /*
   * 🔴 「없다」만 재면 **왜 없는지**가 사라집니다. 그러면 다음 사람이 「빠뜨린 것」으로 읽고
   *    선의로 되살립니다 — 그 순간 완료 수가 두 번 세어집니다.
   */
  for (const must of [
    '1분 진단 응답 전송을 «껐습니다»',
    'web_quick_check',
    '되살리는 조건',
    '앱 `/quick-check` 를 먼저 끄십시오',
  ]) {
    assert.ok(source.includes(must), 'precheck.html 의 전송 폐기 기록에서 사라졌습니다: ' + must);
  }
});

/* ══ ③ 화면이 사실을 적는다 ══════════════════════════════════════════════ */

test('🔴 `.disc` 가 지금의 사실을 적는다 — 보내지 않는다 · 점수는 주소에 담지 않는다', () => {
  const disc = strip(source).match(/<div class="disc">([\s\S]*?)<\/div>/);
  assert.ok(disc, '.disc 가 사라졌습니다');
  assert.ok(
    disc[1].includes('이 브라우저에서만 계산하며 보내지 않습니다'),
    '.disc 가 「보내지 않는다」를 적지 않습니다 — 전송을 껐으면 화면도 그렇게 말해야 합니다'
  );
  assert.ok(disc[1].includes('점수는 주소에 담지 않습니다'), '주소 계약 설명이 사라졌습니다');
});

test('⛔ 종전 문구 「입력값은 저장하지 않습니다」를 되살리지 않았다', () => {
  /*
   * 🔴 전송을 껐다고 그 문장이 참이 되는 것은 «아닙니다» — 같은 화면에서 `assets/track.js`
   *    가 조회·클릭을 여전히 보냅니다. 그 문장은 페이지 전체가 아무것도 안 보낸다는 뜻으로
   *    읽히므로, 축이 되돌아왔어도 이 금지는 그대로입니다.
   */
  assert.ok(
    !strip(source).includes('입력값은 저장하지 않습니다'),
    'precheck.html 이 페이지 전체가 아무것도 안 보낸다는 뜻으로 읽히는 문장을 되살렸습니다'
  );
});

/* ══ ④ 방침이 «과거의 사실»을 적는다 ═════════════════════════════════════ */

test('🔴 방침이 「지금은 보내지 않는다」와 「그때는 보냈다」를 함께 적는다', () => {
  const ko = strip(read('privacy.html'));
  for (const must of [
    '1분 진단',
    '이 브라우저에서만 계산하며 회사로 보내지 않습니다',
    '2026년 9월 20일부터 21일까지',
    'app.trops.kr 의 개인정보처리방침',
  ]) {
    assert.ok(ko.includes(must), 'privacy.html 이 안 적었습니다: ' + must);
  }
  /* ⛔ 현재형 수집 주장이 남아 있으면 방침이 거짓말을 합니다. */
  assert.ok(
    !ko.includes('도중에 그만두신 경우에도 그때까지 고르신 답이 함께 갑니다'),
    'privacy.html 에 현재형 수집 문장이 남아 있습니다'
  );
});

test('🔴 영어 방침도 같은 말을 한다', () => {
  const en = strip(read('en-privacy.html'));
  for (const must of [
    'one-minute check',
    'calculated in your browser only and are not sent to us',
    'Between <strong>September 20 and 21, 2026</strong>',
    'privacy notice of app.trops.kr',
  ]) {
    assert.ok(en.includes(must), 'en-privacy.html 이 안 적었습니다: ' + must);
  }
  assert.ok(
    !en.includes('the answers chosen so far are sent even if you leave part way through'),
    'en-privacy.html 에 현재형 수집 문장이 남아 있습니다'
  );
});

/* ══ ⑤ 랜딩 계측은 함께 끄지 않았다 ══════════════════════════════════════ */

test('🔴 `assets/track.js` 는 그대로 산다 — 전송을 껐다고 계측이 0 이 된 것이 아니다', () => {
  assert.ok(
    /<script[^>]+src="\/assets\/track\.js"/.test(source),
    'precheck.html 이 track.js 를 함께 걷었습니다 — 그 축(조회·클릭·영역)은 이 결정과 무관합니다'
  );
  const t = read('assets/track.js');
  assert.ok(t.includes('window.tropsVisit'), 'track.js 의 방문 열쇠 손잡이가 사라졌습니다');
  assert.ok(
    t.includes("url.searchParams.set('from'"),
    'track.js 가 앱 링크에 유입원을 붙이지 않습니다 — 랜딩 방문과 앱에서 한 일이 끊깁니다'
  );
});
