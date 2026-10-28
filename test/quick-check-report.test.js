/**
 * quick-check-report.test.js — 1분 진단이 «앱으로 옮겨간» 상태를 잠근다 〔재조준 2026-09-21〕
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **이 파일은 두 번 축을 바꿨습니다.**
 *    ⓐ 2026-09-20 — 이 페이지가 답과 점수를 앱으로 «보내는» 것을 확인했습니다.
 *    ⓑ 2026-09-21(배치 6) — 전송을 껐고, 검사를 지우지 않고 «안 보낸다»로 뒤집었습니다.
 *    ⓒ 2026-09-21(이 배치) — **`precheck.html` 자체가 삭제됐습니다.** 그래서 그 파일의
 *       소스를 읽던 절 셋(① 전송 코드 0건 · ② `<form action>` 0건 · ③ `.disc` 문안)이
 *       내려갔습니다 — **잴 대상이 없어진 것**이지 규칙이 완화된 것이 아닙니다.
 *
 * 🔴 **왜 지웠나** — 그 페이지는 308 로 닫혀 진입원이 0 이었고, 남겨 둔 유일한 사유는
 *    「앱 저장소의 배점표 대조가 이 파일을 읽는다」였습니다. 2026-09-21 에 앱이 그 원본을
 *    **자기 안으로 동결해 들였습니다**(`trops_a@11d3699f` ·
 *    `tests/fixtures/quick-check/landing-score-source.js`). 그 인계 문서가 적어 둔 조건
 *    「지워도 되는 날 = 앱이 랜딩 원본과의 대조를 그만두는 날」이 충족된 것입니다.
 *
 *    ⓓ 2026-10-28 — **1분 수출 준비 진단 자체가 제품에서 없어졌습니다**(대표 결정). 앱
 *       `/quick-check` 도 같은 날 내려가고 그 옛 주소는 앱 홈으로 넘어갑니다. 그래서 ⑥ 의
 *       목적지를 앱 홈으로 바꿨고, «보이는 자리»(소개 · 바닥글 · `llms.txt`)에 그 이름과
 *       주소가 0 인지를 ⑦ 이 잽니다. ④ 는 그대로입니다 — 방침 본문은 시행일이 붙은 문안이라
 *       대표가 따로 고치며, 그때 ④ 를 함께 고치십시오.
 *
 * ⛔ **되살리려면 순서가 있습니다** — 페이지를 다시 세우기 전에 앱 `/quick-check` 를 먼저
 *    끄십시오(두 지면이 같은 표에 쓰면 「앱 1분 진단 응답 수」를 셀 수 없습니다). 전송을
 *    다시 켤 때는 앱 `tests/quick-check/landing-contract.test.ts` 를 먼저 읽으십시오 —
 *    그 문서가 수신 계약(되살릴 셋)을 기록으로 갖습니다. 옛 판은 git 이 갖습니다.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **주소 계약(`query()`)은 그대로입니다** — 그 축은 `test/precheck-handoff.test.js` 가
 *    재며 ⛔ 이 파일과 합치지 않습니다.
 * ⚠️ **랜딩 계측(`assets/track.js`)은 함께 끄지 않았습니다** — 조회·클릭·영역이 그 축이고
 *    문도 표도 다릅니다. ⑤ 가 그 사실을 양의 방향으로 잠급니다.
 */'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** 읽는 사람에게 «보이는» 글만 — 이 저장소는 주석에 옛 문장을 그대로 인용합니다. */
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '');

/* ══ ④ 방침이 «과거의 사실»을 적는다 ═════════════════════════════════════ */

test('🔴 방침이 「지금은 보내지 않는다」와 「그때는 보냈다」를 함께 적는다', () => {
  const ko = strip(read('privacy.html'));
  for (const must of [
    '1분 수출 준비 진단',
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
    '1-minute export readiness check',
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
  /*
   * ⚠️ **종전에는 「`precheck.html` 이 track.js 를 함께 걷지 않았다」도 함께 쟀습니다** —
   *    그 파일이 사라져 잴 대상이 없습니다. 남은 것은 계측 «자체»가 사는가이며, 그것은
   *    살아 있는 8장이 쓰는 축이라 이 결정과 무관하게 유효합니다.
   */
  const t = read('assets/track.js');
  assert.ok(t.includes('window.tropsVisit'), 'track.js 의 방문 열쇠 손잡이가 사라졌습니다');
  assert.ok(
    t.includes("url.searchParams.set('from'"),
    'track.js 가 앱 링크에 유입원을 붙이지 않습니다 — 랜딩 방문과 앱에서 한 일이 끊깁니다'
  );
});

/* ══ ⑥ 주소 처분 — /precheck 는 앱 홈으로 넘어간다 ══════════════════════════ */

const VERCEL = JSON.parse(read('vercel.json'));
const APP_QUICK = 'https://app.trops.kr/quick-check';
/** 🔄 2026-10-28 — 1분 진단이 없어져 옛 주소 둘의 목적지가 앱 홈이 됐습니다. */
const APP_HOME = 'https://app.trops.kr/';

test('🔴 `/precheck` 가 앱 홈으로 «영구» 이동한다 — 옛 메일 링크도 어딘가에 닿는다', () => {
  /*
   * 🔴 **`permanent: true` 가 이 파일에서 이 규칙뿐이다**(나머지는 `false`).
   *    같은 배치에서 `llms.txt`·JSON-LD 두 장의 주소도 함께 옮겼으므로, 검색·AI 가
   *    옛 주소를 계속 물어 오지 않게 «영구»가 맞습니다.
   * 🔄 **목적지가 앱 1분 진단 → 앱 홈** 〔2026-10-28 · 대표 결정〕. 진단 화면이 없어졌지만
   *    확인 메일의 `/precheck?r=<token>` 같은 옛 링크가 남아 있어, 규칙은 지우지 않고
   *    목적지만 옮겼습니다. ⛔ 규칙을 지우지 마십시오 — 지우면 그 링크가 404 에 닿습니다.
   * ⚠️ 영구는 브라우저가 캐시합니다 — 되돌리려면 `false` 판을 한 번 배포해야 합니다.
   */
  const r = (VERCEL.redirects || []).find((x) => x.source === '/precheck');
  assert.ok(r, 'vercel.json 에 /precheck 리다이렉트가 없습니다 — 옛 링크가 404 에 닿습니다');
  assert.strictEqual(r.destination, APP_HOME, '/precheck 의 목적지가 앱 홈이 아닙니다');
  assert.strictEqual(r.permanent, true, '/precheck 는 영구 이동이어야 합니다(색인을 옮깁니다)');

  const c = (VERCEL.redirects || []).find((x) => x.source === '/check');
  assert.ok(c && c.destination === APP_HOME,
    '/check 가 앱 홈을 가리키지 않습니다 — 없어진 화면이나 이중 리다이렉트로 갑니다');

  assert.ok(!(VERCEL.redirects || []).some((x) => x.destination === APP_QUICK),
    'vercel.json 이 아직 없어진 앱 1분 진단 주소로 보냅니다 — 앱이 한 번 더 튕깁니다');
});

test('🔴 `precheck.html` 이 «배포에서도 저장소에서도» 사라졌다', () => {
  /*
   * 🔄 **2026-09-21 — 「파일은 남는다」에서 뒤집혔습니다.** 남겨 둔 유일한 사유가
   *    「앱 배점표 대조가 읽는다」였는데, 앱이 그 원본을 자기 안으로 동결해 들이면서
   *    (`trops_a@11d3699f`) 그 사유가 사라졌습니다.
   * 🔴 **셋을 함께 잽니다** — 배포 목록 · 분류표 · 파일. 하나라도 되살아나면 그 페이지가
   *    다시 설 수 있고, 그때 같은 제품이 두 주소에 섭니다.
   * ⛔ 되살리려면 머리주석의 순서를 먼저 읽으십시오.
   */
  const { STATIC, NOT_DEPLOYED } = require('../scripts/build-static.js');
  assert.ok(!STATIC.html.some((e) => e.file === 'precheck.html'),
    'precheck.html 이 배포 목록에 되살아났습니다 — 같은 제품이 두 주소에 섭니다');
  assert.ok(!NOT_DEPLOYED.has('precheck.html'),
    'precheck.html 이 아직 분류표에 있습니다 — 없는 파일을 「배포 안 함」으로 세고 있습니다');
  assert.ok(!fs.existsSync(path.join(ROOT, 'precheck.html')),
    'precheck.html 이 되살아났습니다 — 진입원 0 인 페이지가 다시 섰습니다');
});

test('🔴 검색·AI 가 보는 목록에 옛 주소도 없어진 진단도 없다', () => {
  /*
   * 🔄 2026-10-28 — 종전에는 「앱 1분 진단 주소가 «있다»」를 쟀습니다. 진단이 없어져
   *    방향을 뒤집었습니다: 남아 있으면 AI 가 없는 화면을 계속 권합니다.
   */
  for (const [f, what] of [['llms.txt', 'AI 인용 목록']]) {
    const s = read(f);
    assert.ok(!s.includes('https://trops.kr/precheck'),
      `${f}(${what})이 아직 옛 주소를 가리킵니다`);
    assert.ok(!s.includes('quick-check'), `${f}(${what})이 아직 없어진 앱 1분 진단 주소를 싣습니다`);
    assert.ok(!s.includes('1분 수출 준비 진단'), `${f}(${what})이 아직 없어진 1분 진단을 소개합니다`);
  }
});

/* ══ ⑦ 보이는 자리에 없어진 진단이 없다 〔2026-10-28〕 ══════════════════════════ */

test('🔴 배포되는 어느 페이지도 없어진 앱 1분 진단으로 링크하지 않는다', () => {
  /*
   * 🔴 페이지 목록은 빌드 분류표에서 읽습니다(사본 0). 주석은 걷습니다 — 이 저장소는
   *    주석에 옛 주소를 기록으로 인용합니다.
   * ⚠️ 방침 본문(privacy · en-privacy · refund · en-refund)의 «이름»은 이 검사가 보지
   *    않습니다 — 시행일이 붙은 문안이라 대표가 따로 고칩니다(머리주석 ⓓ). 주소는 그
   *    본문에도 0 이라 함께 잽니다.
   */
  const { STATIC } = require('../scripts/build-static.js');
  const offenders = STATIC.html.map((e) => e.file).filter((f) => strip(read(f)).includes('quick-check'));
  assert.deepStrictEqual(offenders, [],
    '없어진 앱 1분 진단으로 가는 링크가 남았습니다: ' + offenders.join(' · '));
});

test('🔴 회사 소개와 바닥글이 없어진 진단을 소개하지 않는다', () => {
  const about = strip(read('about.html'));
  assert.ok(!about.includes('1분 수출 준비 진단'), 'about.html 이 아직 1분 진단을 «함께 제공하는 것»으로 소개합니다');

  /* 바닥글 태그라인 — 정책 페이지 넷만 싣습니다(랜딩 · 소개 · 문의는 0). */
  const META = /<span class="footer-meta">([^<]*)<\/span>/;
  for (const f of ['privacy.html', 'refund.html', 'en-privacy.html', 'en-refund.html']) {
    const m = strip(read(f)).match(META);
    assert.ok(m, f + ' 의 바닥글 태그라인을 찾지 못했습니다 — 이 검사가 아무것도 재지 않습니다');
    assert.ok(!/1분|1-minute/i.test(m[1]), f + ' 바닥글 태그라인에 없어진 진단이 남았습니다: ' + m[1]);
  }
});
