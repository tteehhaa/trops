/*
 * 가격 표기와 **노출 시점** 검사 〔price-300k-naming-map-s9 · 신설 2026-08-13〕
 *
 *   npm test        (node --test test/)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔄 **2026-08-30 — 이 파일이 «죽어 있었습니다**〔대표 지시로 되살림〕
 * ══════════════════════════════════════════════════════════════════════════════
 * 첫 줄이 `read('precheck.html')` 이었고 그 페이지가 2026-08-30 에 삭제되면서
 * **모듈 로드가 ENOENT 로 죽었습니다.** 그래서 여기 있던 검사 여덟이 전부 「실패」로
 * 뜬 것이 아니라 **아무것도 재지 않았습니다** — 그중 하나가 대표가 지목한
 * 「FAQ·환불 페이지에 원화 금액 0건」입니다.
 *
 * 🔴 **왜 스스로 낡았는가 — 페이지 이름을 손으로 적었기 때문입니다.**
 *    `['nda.html','refund.html','en-refund.html']` 처럼 목록을 박아 두면 페이지가
 *    사라지는 날 검사가 조용히(또는 요란하게) 무너집니다. 이제 **살아 있는 페이지 목록을
 *    빌드 분류표(`scripts/build-static.js` `STATIC.html`)에서 읽습니다** — 그 표가
 *    「무엇이 배포되는가」의 정본이고, 페이지가 늘거나 줄면 검사가 **자동으로 따라옵니다**.
 *    ⛔ 목록을 다시 손으로 적지 마십시오(아래 「메타」 검사가 그것을 막습니다).
 *
 * ── 🔴 무엇을 지우고 무엇을 고쳤는가 ────────────────────────────────────────
 * **고침(지금도 지켜야 하는 것)**
 *   · 폐기 금액(₩99,000 · ₩300,000)이 화면에 없다 → 대상을 **살아 있는 전 페이지**로
 *   · 🔴 원화 금액이 화면에 없다 → 종전 3장 한정에서 **살아 있는 전 페이지**로 **넓혔다**
 *   · 종료된 무상 제공 문구가 저장소 어디에도 없다 → 그대로(페이지와 무관한 검사다)
 *   · 서버 청구 금액 · payment-config 의 amount → 그대로(접수 32건의 환불 근거다)
 *
 * **지움(지킬 대상이 사라진 것)** — ⛔ 「검사가 불편해서」가 아니라 **그 화면이 없어서**다:
 *   · 「결제 요약·제출 버튼·서버 금액이 같은 말을 한다」 — 금액을 손으로 적던 화면 두 자리가
 *     함께 사라졌다. **금액을 든 자리가 서버 하나**라 갈릴 대상이 없다. ⚠️ 그 사실 자체는
 *     아래 「원화 금액 0건」이 **더 강하게** 지킨다(어느 페이지에도 금액이 없어야 한다).
 *   · 「부가세 포함 병기」·「플랜 컨테이너 두 겹」·「금액이 결제 영역 안에만」·
 *     「결제 영역이 접힌 채로 내려온다」 — 전부 `precheck.html` 의 결제 폼 구조다.
 *     그 폼이 없으므로 **접수 전 노출**이라는 위험 자체가 없다.
 * 🔴 되살릴 조건: 이 저장소에 결제 폼이 다시 서면 그때 함께 되살린다.
 *    (커밋 `ca47218` 「안 쓰는 6장을 내린다」의 `precheck.html` 이 그 원본이다)
 *
 * ⚠️ 이 검사는 **문자열 대조**입니다. 금액 정본은 trops_a
 *    `lib/payment/precheck-paid-gate.ts` `PRECHECK_PRICE.launchKrw` 이고, 그쪽과의
 *    드리프트는 test/precheck-charge-gate.test.js 「정가·런칭가가 정본과 같다」가 봅니다.
 * ⛔ 기대값을 `require('../api/_payment.js').PRICE` 로 바꾸지 마십시오. 그러면 서버 값을
 *    고치는 순간 검사도 함께 통과해 「고칠 곳이 더 있다」는 사실이 사라집니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** 주석 없는 원문. 이 저장소는 주석에 옛 값을 인용하므로 그대로 두면 전부 오탐입니다. */
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * 🔴 **살아 있는 페이지 — 빌드 분류표에서 읽습니다**(사본 0).
 * ⛔ 여기에 파일 이름을 적지 마십시오. 이 파일이 2026-08-30 에 죽은 원인이 그것입니다.
 */
const { STATIC } = require('../scripts/build-static.js');
const LIVE_PAGES = STATIC.html.map((e) => e.file);

/**
 * 흐름 md §4 가 확정한 1차 테스트가 — **VAT 포함 총액**〔2026-08-17 · 300,000 → 330,000〕.
 * ⛔ 상수 참조로 바꾸지 마십시오(위 주석).
 */
const PRICE_TEXT = '₩330,000';
const RETIRED_TEXT = '₩99,000';
/** 폐기된 종전 판매가(VAT 미포함 시절) — 화면 어디에도 남아 있으면 안 된다. */
const RETIRED_PRE_VAT_TEXT = '₩300,000';

/**
 * 🔴 **원화 금액 검출기 — 한 벌입니다** 〔2026-09-01 · 사본 둘을 합쳤습니다〕.
 *
 * 종전에는 이 정규식이 **두 곳에 각자** 적혀 있었습니다(노출 검사 하나, [대조] 검사 하나).
 * 그러면 [대조] 가 재는 것이 「검출기가 문다」가 아니라 「검출기의 «사본»이 문다」가 됩니다 —
 * 노출 검사만 넓히고 대조를 안 고치면 그 사실이 조용히 통과합니다. 한 곳에서 읽습니다.
 *
 * ── 세 갈래를 봅니다 ────────────────────────────────────────────────────────
 *   ₩330,000 · ₩ 330,000    기호 표기
 *   33만원 · 33만 원          🔴 **만원 표기** 〔2026-09-01 추가 · 대표 지적〕
 *   330,000원                🔴 **원 표기** 〔2026-09-01 추가〕
 *
 * 🔴 **왜 넓혔는가** — 종전 검출기는 `₩` 로 시작하는 것만 물었습니다. 그런데 금액이
 *    화면으로 돌아오는 가장 흔한 길은 기호가 아니라 **국문 관용 표기**입니다
 *    (「33만원」·「30만원」). 실측 2026-09-01: 그 둘은 이 파일의 어느 검사에도 걸리지
 *    않았습니다 — 「금액이 화면에 없다」가 절반만 지켜지고 있었습니다.
 *
 * ⚠️ **₩0 은 그대로 예외입니다** — 「무료」를 설명하는 표기(en-refund.html 의 「Free (₩0)」)
 *    이지 가격 정보를 새지 않습니다.
 * ⚠️ 「원」 갈래는 **숫자 3자 이상**을 요구합니다. 그러지 않으면 「20원」 같은 낱말 조각과
 *    본문의 우연한 숫자를 뭅니다. 「지원」·「복원」·「2026년」은 숫자가 «앞»에 붙지 않아
 *    애초에 걸리지 않습니다(아래 [대조] 가 그것을 단정합니다).
 * ⚠️ 실측 2026-09-01: 살아 있는 7장 전부에 대해 **오탐 0건**입니다.
 * ⛔ 페이지를 늘릴 때 이 검출기가 물면 「검사를 좁히지」 말고 **금액을 지우십시오** —
 *    결제 폼이 없는 지금 금액이 있어도 되는 자리는 0 입니다.
 */
const AMOUNT_RE = /₩\s?(?!0\b)[\d,]+|\d[\d,]*\s*만\s?원|\d[\d,]{2,}\s*원/;

/* ══ 0. 메타 — 이 검사가 다시 낡지 않게 ══════════════════════════════════════ */

test('🔴 대상 페이지를 빌드 분류표에서 읽는다 — 목록을 손으로 적지 않는다', () => {
  assert.ok(LIVE_PAGES.length >= 6,
    '살아 있는 페이지가 ' + LIVE_PAGES.length + '장뿐입니다 — 목록이 비면 아래 검사가 전부 무의미해집니다');
  for (const f of LIVE_PAGES) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), '분류표에 있는데 파일이 없습니다: ' + f);
  }
  // ⛔ 삭제된 페이지가 목록에 되살아나면 즉시 red — 조용한 ENOENT 로 죽지 않는다.
  for (const gone of ['nda.html', 'uae.html', 'check.html']) {
    assert.ok(!LIVE_PAGES.includes(gone), '삭제된 페이지가 분류표에 있습니다: ' + gone);
  }
});

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **`precheck.html` 을 위 목록에서 뺐습니다** 〔2026-09-01 · 대표 지시로 새 페이지 배포〕
 * ══════════════════════════════════════════════════════════════════════════════
 * 위 래칫이 막던 것은 **이름이 아니라 «그 화면»** 입니다 — 2026-08-30 에 내린
 * `precheck.html` 은 **접수·결제 폼**이었고(실측: `<form` 1 · `TossPayments` 3 ·
 * `requestPayment` 1 · `payment-config` 3 · `₩330,000` 4 · `₩300,000` 1), 이 파일 머리주석의
 * 「결제 폼이 다시 서면 그때 함께 되살린다」가 가리키던 대상이 정확히 그것입니다.
 *
 * 2026-09-01 에 **같은 이름의 다른 페이지**가 섰습니다 — 입력값만으로 점수를 내는 정적
 * 한 장이고, 위 여섯 표지가 **0건**입니다(서버 호출 0 · 저장 0 · 결제 0).
 *
 * ⛔ **그래서 「이름이 목록에 있는가」를 «지우기만» 하지 않았습니다**(대표 지시:
 *    「기대를 지우기만 하지 마십시오」). 이름 대조를 **표면 대조**로 바꿉니다 — 결제 폼이
 *    어떤 이름으로 돌아오든, 어느 페이지에 서든 잡힙니다. 종전보다 넓습니다.
 * 🔴 red 가 되는 날: 이 저장소에 결제 폼이 다시 섰다는 뜻입니다. 그때 이 파일 머리주석의
 *    「되살릴 조건」대로 결제 노출 검사 넷을 함께 되살리십시오
 *    (원본: `git show ca47218:test/price-exposure.test.js`).
 */
test('🔴 살아 있는 어느 페이지에도 결제 표면이 없다 — 결제 폼은 이 저장소에 없다', () => {
  const PAYMENT_MARKS = ['TossPayments', 'tosspayments', 'requestPayment', 'payment-config'];
  const offenders = [];
  for (const f of LIVE_PAGES) {
    const s = strip(read(f));
    for (const mark of PAYMENT_MARKS) if (s.includes(mark)) offenders.push(f + ': ' + mark);
  }
  assert.deepStrictEqual(offenders, [],
    '결제 표면이 화면에 있습니다: ' + offenders.join(' · ') +
    ' — 접수·결제 흐름은 2026-08-30 에 내렸습니다. 되살린 것이면 머리주석의 「되살릴 조건」을 보십시오');
});

/**
 * 옛 결제 폼 — **파일로 떠 둡니다**(`git show` 로 읽지 않습니다).
 *
 * 🔴 **왜 `git show` 를 버렸는가** 〔2026-09-01 · 대표 지적〕 — 처음에는
 *    `git show ca47218^:precheck.html` 로 읽었는데, **얕은 클론에서 죽습니다.**
 *    실측(2026-09-01, `git clone --depth 1`):
 *      `fatal: invalid object name 'ca47218^'` · exit 128
 *    CI·컨테이너 빌드는 `--depth 1` 이 기본입니다. 그러면 이 대조 검사가 「red」가
 *    아니라 **throw 로 무너지고**, 그것은 이 파일이 2026-08-30 에 ENOENT 로 죽은 것과
 *    같은 실패 형태입니다. 같은 실수를 두 번 하지 않습니다.
 *
 * ⚠️ **원본과 바이트가 같습니다** — 커밋 `07a5909`(= `ca47218^`)의 `precheck.html`,
 *    168,309 bytes, sha256 `ca72b741b97c1fe1744c26cf1df06bb5e11d167c…`.
 *    다시 뜨려면: `git show 07a5909:precheck.html > test/fixtures/precheck-payment-form-07a5909.html`
 * ⛔ 이 파일을 편집하지 마십시오. 「옛 판이 이러했다」는 사실 자체가 이 대조의 기준입니다.
 * ⚠️ `test/` 는 배포되지 않습니다(`.vercelignore` · build-static 의 NOT_DEPLOYED).
 *    저장소 전역 검사와의 충돌도 확인했습니다 — 금지된 무상 제공 문구 0건,
 *    `text-layer-wiring` 의 생산자 스캔은 `test/` 를 제외합니다.
 */
const OLD_PAYMENT_FORM = path.join(__dirname, 'fixtures', 'precheck-payment-form-07a5909.html');

test('[대조] 결제 표면 검출기가 실제로 문다 — 0건 통과 금지', () => {
  /* 🔴 위 검사가 «옛 결제 폼을 먹여도 통과하는» 상태를 막습니다. 삭제 직전 판을 씁니다. */
  assert.ok(fs.existsSync(OLD_PAYMENT_FORM),
    '옛 결제 폼 fixture 가 없습니다: ' + OLD_PAYMENT_FORM + ' — 머리주석의 재생성 명령을 보십시오');
  const old = fs.readFileSync(OLD_PAYMENT_FORM, 'utf8');
  const s = strip(old);
  for (const mark of ['TossPayments', 'requestPayment', 'payment-config']) {
    assert.ok(s.includes(mark), '옛 결제 폼에서 ' + mark + ' 를 못 찾습니다 — 검출기 기준이 틀렸습니다');
  }
  // 그리고 «지금» 그 이름을 쓰는 페이지에는 없어야 합니다.
  assert.ok(LIVE_PAGES.includes('precheck.html'),
    'precheck.html 이 분류표에 없습니다 — 이 대조가 재려는 대상이 사라졌습니다');
  assert.ok(!strip(read('precheck.html')).includes('TossPayments'),
    '새 precheck.html 에 결제 폼이 있습니다');
});

/* ══ 1. 값 ═══════════════════════════════════════════════════════════════════ */

test('서버가 가진 청구 금액이 ₩330,000(VAT 포함) 이다', () => {
  /*
   * ⚠️ 상품은 더는 팔지 않지만 이 값은 **남은 접수 32건의 환불 근거**입니다.
   *    `scripts/refund.js` 가 이 금액으로 취소를 겁니다 — 지우지 마십시오.
   */
  const payment = require('../api/_payment.js');
  assert.strictEqual(payment.PRICE, 330000,
    '실제 청구 금액이 ' + payment.PRICE + ' 입니다 — 2026-08-17 VAT 반영 결정은 ₩330,000 입니다');
});

test('금액을 대조 가능한 상태로 서버가 내려준다 — 화면이 정본을 참조할 길을 남긴다', () => {
  const cfg = read('api/payment-config.js');
  assert.ok(/amount: PRICE/.test(cfg), 'payment-config 가 amount 를 내려주지 않습니다');
});

/* ══ 2. 노출 — 이제 «어느 페이지에도» 금액이 없다 ════════════════════════════
 *
 * 🔴 **종전보다 강한 규칙입니다.** 전에는 「결제 영역 안에서만 보인다」였고, 그 결제
 *    영역(`precheck.html`)이 사라지면서 **금액이 있어도 되는 자리가 0** 이 됐습니다.
 *    ⛔ 그래서 「FAQ·환불 3장」 한정을 풀고 살아 있는 전 페이지로 넓혔습니다.
 * ⚠️ **₩0 은 예외입니다** — 「무료」를 설명하는 표기(en-refund.html 의 「Free (₩0)」)이지
 *    가격 정보를 새지 않습니다. 0 이 아닌 금액만 봅니다.
 */

test('🔴 살아 있는 어느 페이지에도 원화 금액이 없다 — 파는 상품이 없다', () => {
  const offenders = [];
  for (const f of LIVE_PAGES) {
    const hit = AMOUNT_RE.exec(strip(read(f)));
    if (hit) offenders.push(f + ': ' + hit[0]);
  }
  assert.deepStrictEqual(offenders, [],
    '원화 금액이 화면에 남아 있습니다: ' + offenders.join(' · ') +
    ' — 결제 폼이 없어진 뒤로 금액이 있어도 되는 자리는 0 입니다');
});

test('🔴 폐기된 금액 표기(₩99,000 · ₩300,000)가 화면 어디에도 없다', () => {
  const offenders = [];
  for (const f of LIVE_PAGES) {
    const s = strip(read(f));
    for (const dead of [RETIRED_TEXT, RETIRED_PRE_VAT_TEXT, '99,000']) {
      if (s.indexOf(dead) !== -1) offenders.push(f + ': ' + dead);
    }
  }
  assert.deepStrictEqual(offenders, [],
    '폐기된 금액이 남아 있습니다: ' + offenders.join(' · ') +
    ' — 물어본 값과 청구된 값이 갈립니다');
});

test('[대조] 검출기가 실제로 문다 — 0건 통과 금지', () => {
  /*
   * 🔴 위 두 검사가 «아무 페이지도 안 읽어서» 통과하는 상태(2026-08-30 의 그것)를
   *    막습니다. **위 검사가 쓰는 바로 그 검출기**(사본 아님)에 실제 금액을 먹입니다.
   */
  const MUST_BITE = [
    '결제 금액은 ' + PRICE_TEXT + ' 입니다',   // ₩330,000
    '종전가 ' + RETIRED_TEXT,                  // ₩99,000
    '종전가 ' + RETIRED_PRE_VAT_TEXT,          // ₩300,000
    '이용료 33만원',                            // 🔴 만원 표기 — 2026-09-01 이전에는 놓쳤다
    '이용료 30만원',                            // 🔴 폐기가의 만원 표기
    '이용료 33만 원',                           // 만/원 사이 공백
    '이용료 330,000원',                         // 원 표기
  ];
  for (const s of MUST_BITE) {
    assert.ok(AMOUNT_RE.test(s), '검출기가 금액을 놓칩니다: ' + JSON.stringify(s));
  }

  /* ⚠️ 물면 «안» 되는 것 — 넓힌 검출기가 본문을 오탐하기 시작하면 여기가 먼저 red 가 된다. */
  const MUST_NOT_BITE = [
    'Free (₩0)',          // ₩0 예외
    '수출을 지원합니다',    // 「원」이 낱말 안에 있다
    '원본을 복원합니다',
    '2026년 8월 20일',
    '20원',               // 숫자 3자 미만 — 금액 표기로 보지 않는다
  ];
  for (const s of MUST_NOT_BITE) {
    assert.ok(!AMOUNT_RE.test(s), '검출기가 금액이 아닌 것을 뭅니다: ' + JSON.stringify(s));
  }
});

/* ══ 3. 무상 제공 문구 ═══════════════════════════════════════════════════════
 *
 * 🔴 **신설 〔2026-08-23 · PRD v2.1 B1-6 · landing-b1-facts-freecopy〕**
 *
 * 무상(초기 20건) 제공이 **끝났습니다** 〔PRD v2.1 P-2〕. 끝난 약속이 랜딩에 남아 있으면
 * 지킬 수 없는 약속을 계속 하는 것이고, 접수 뒤에 기대가 어긋납니다. 지우는 것은 한 번이면
 * 되지만 **되살아나는 것은 쉽습니다** — 이 문면은 옛 원고(docs/copy/·docs/wireframe/)에
 * 여러 벌 남아 있어서, 원고를 참고해 문구를 되돌리는 순간 조용히 되돌아옵니다.
 * 그래서 `*.html` 만이 아니라 **저장소 전체**를 봅니다.
 *
 * ⛔ **금지 문자열을 이 파일에 리터럴로 적지 마십시오.** 이 파일도 검사 대상이라,
 *    적는 순간 이 검사가 자기 자신을 잡습니다. 아래처럼 조각으로 조립합니다
 *    (scripts/check-b1-gates.js G2 도 같은 방식입니다 — 그쪽은 CI·수동 실행용).
 */

const { execFileSync } = require('node:child_process');

/** ⛔ 조각 조립 — 위 주석 참조. */
const RETIRED_OFFER_PHRASES = [
  ['First 20 submissions', 'free'].join(' '),
  ['No login', 'required'].join(' '),
  ['남은', '자리'].join(' '),
  '선' + '착순',
  ['무료', '실증'].join(' '),
];

/** 빌드 산출물·의존성·git 내부는 소스가 아닙니다. dist/ 는 소스에서 파생되므로 소스만 보면 됩니다. */
const NOT_SOURCE_RE = /^(dist|node_modules|\.git)\//;
const BINARY_RE = /\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf|eot|mp4|zip)$/i;

test('🔴 종료된 무상 제공 문구가 저장소 어디에도 없다 — PRD v2.1 P-2', () => {
  /*
   * ⚠️ -z (NUL 구분) 가 필수입니다. git 기본 출력은 한글 경로를 "…\353…" 로 따옴표
   *    인용해 내보내고, 그 문자열로 파일을 열면 ENOENT 가 나 **조용히 건너뜁니다** —
   *    이 저장소는 한글 경로 문서가 많아 그대로 두면 검사가 통과하는 척만 합니다.
   * ⚠️ --others --exclude-standard 로 아직 커밋되지 않은 새 파일도 봅니다.
   */
  const files = execFileSync(
    'git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  )
    .split('\0')
    .filter((f) => f && !NOT_SOURCE_RE.test(f) && !BINARY_RE.test(f));

  assert.ok(files.length > 50, 'git ls-files 가 ' + files.length + '개만 냈습니다 — 목록이 비면 검사가 무의미해집니다');

  const offenders = [];
  const unreadable = [];

  for (const f of files) {
    let text;
    try {
      if (!fs.statSync(path.join(ROOT, f)).isFile()) continue;
      text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    } catch (e) {
      // 못 읽은 파일은 「0건」의 근거가 될 수 없습니다 — 조용히 넘기지 않습니다.
      unreadable.push(f + '(' + e.code + ')');
      continue;
    }
    for (const phrase of RETIRED_OFFER_PHRASES) {
      let at = text.indexOf(phrase);
      while (at !== -1) {
        offenders.push(f + ':' + (text.slice(0, at).split('\n').length));
        at = text.indexOf(phrase, at + 1);
      }
    }
  }

  assert.deepStrictEqual(unreadable, [], '읽지 못한 소스 파일이 있습니다: ' + unreadable.join(', '));
  assert.deepStrictEqual(
    offenders,
    [],
    '종료된 무상 제공 문구가 ' + offenders.length + '곳에 남아 있습니다: ' + offenders.join(', ') +
    ' — PRD v2.1 P-2 로 무상 제공은 끝났습니다. 옛 원고를 참고해 되살리지 마십시오.'
  );
});
