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

/* ══ 0. 메타 — 이 검사가 다시 낡지 않게 ══════════════════════════════════════ */

test('🔴 대상 페이지를 빌드 분류표에서 읽는다 — 목록을 손으로 적지 않는다', () => {
  assert.ok(LIVE_PAGES.length >= 6,
    '살아 있는 페이지가 ' + LIVE_PAGES.length + '장뿐입니다 — 목록이 비면 아래 검사가 전부 무의미해집니다');
  for (const f of LIVE_PAGES) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), '분류표에 있는데 파일이 없습니다: ' + f);
  }
  // ⛔ 삭제된 페이지가 목록에 되살아나면 즉시 red — 조용한 ENOENT 로 죽지 않는다.
  for (const gone of ['precheck.html', 'nda.html', 'uae.html', 'check.html']) {
    assert.ok(!LIVE_PAGES.includes(gone), '삭제된 페이지가 분류표에 있습니다: ' + gone);
  }
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
  const AMOUNT_RE = /₩\s?(?!0\b)[\d,]+/;
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
   *    막습니다. 같은 정규식에 실제 금액을 먹여 잡히는지 봅니다.
   */
  const AMOUNT_RE = /₩\s?(?!0\b)[\d,]+/;
  assert.ok(AMOUNT_RE.test('결제 금액은 ' + PRICE_TEXT + ' 입니다'), '검출기가 금액을 놓칩니다');
  assert.ok(AMOUNT_RE.test('종전가 ' + RETIRED_TEXT), '검출기가 폐기 금액을 놓칩니다');
  assert.ok(!AMOUNT_RE.test('Free (₩0)'), '₩0 예외가 깨졌습니다');
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
