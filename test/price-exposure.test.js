/*
 * 가격 표기와 **노출 시점** 검사 〔price-300k-naming-map-s9 · 신설 2026-08-13〕
 *
 *   npm test        (node --test test/)
 *
 * ── 왜 있는가 ───────────────────────────────────────────────────────────────
 * 두 가지가 조용히 깨지는 자리라 못질합니다.
 *
 * ① **금액이 세 곳에 손으로 적혀 있습니다** — 서버(api/_payment.js PRICE) · 결제 요약
 *    (.pay-summary-value) · 제출 버튼(JS 문자열). 앞 사이클 보고서(naming-consistency-s9
 *    미결 ①)가 「md 는 ₩300,000 인데 코드는 ₩99,000」을 잡아낸 것이 정확히 이 형태입니다.
 *    한 곳만 고치면 **화면이 말한 값과 청구된 값이 갈립니다.**
 *
 * ② **가격이 접수 전에 보이면 안 됩니다** 〔흐름 md §0-2 「비용 노출 없음」〕. 종전에는
 *    `.plans { display: none }` **한 줄**이 그것을 지탱했고, 그 한 줄을 지우는 것을 잡는
 *    검사가 없었습니다. 지금은 CSS + `hidden` 두 겹이고 이 파일이 둘 다 봅니다.
 *
 * ⚠️ 이 검사는 **문자열 대조**입니다. 금액 정본은 trops_a
 *    `lib/payment/precheck-paid-gate.ts` `PRECHECK_PRICE.launchKrw` 이고, 그쪽과의
 *    드리프트는 test/precheck-charge-gate.test.js 「정가·런칭가가 정본과 같다」가 봅니다.
 *    여기서 보는 것은 **이 저장소 안에서 세 자리가 같은 말을 하는가**입니다.
 * ⛔ 기대값을 `require('../api/_payment.js').PRICE` 로 바꾸지 마십시오. 그러면 서버 값을
 *    고치는 순간 화면 검사도 함께 통과해 「고칠 곳이 더 있다」는 사실이 사라집니다.
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

const RAW = read('precheck.html');
const SRC = strip(RAW);

/**
 * 흐름 md §4 가 확정한 1차 테스트가 — **VAT 포함 총액**〔2026-08-17 · 300,000 → 330,000〕.
 * ⛔ 상수 참조로 바꾸지 마십시오(위 주석).
 */
const PRICE_TEXT = '₩330,000';
const RETIRED_TEXT = '₩99,000';
/** 폐기된 종전 판매가(VAT 미포함 시절) — 화면 어디에도 남아 있으면 안 된다. */
const RETIRED_PRE_VAT_TEXT = '₩300,000';

/* ══ 1. 값 ═══════════════════════════════════════════════════════════════════ */

test('서버가 가진 청구 금액이 ₩330,000(VAT 포함) 이다', () => {
  const payment = require('../api/_payment.js');
  assert.strictEqual(payment.PRICE, 330000,
    '실제 청구 금액이 ' + payment.PRICE + ' 입니다 — 2026-08-17 VAT 반영 결정은 ₩330,000 입니다');
});

test('결제 요약·제출 버튼·서버 금액이 같은 말을 한다', () => {
  const summary = (SRC.match(/<span class="pay-summary-value">([^<]*)<\/span>/) || [])[1];
  assert.strictEqual(summary, PRICE_TEXT, '결제 요약 금액이 ' + summary + ' 입니다');

  const btn = (SRC.match(/submitBtn\.textContent = paid \? '([^']*)'/) || [])[1] || '';
  assert.ok(btn.indexOf(PRICE_TEXT) !== -1,
    '제출 버튼이 다른 금액을 말합니다: ' + btn);

  // 세 자리가 같은가 — 서버 값을 사람이 읽는 형식으로 만들어 대조합니다.
  const payment = require('../api/_payment.js');
  const formatted = '₩' + payment.PRICE.toLocaleString('en-US');
  assert.strictEqual(formatted, PRICE_TEXT,
    '서버 금액(' + formatted + ')과 화면 표기(' + PRICE_TEXT + ')가 갈렸습니다');
});

test('🔴 폐기된 ₩99,000 이 화면 문면에 남아 있지 않다', () => {
  assert.ok(SRC.indexOf(RETIRED_TEXT) === -1,
    '/precheck 에 폐기된 금액이 남아 있습니다 — 고친 자리가 일부뿐입니다');
  for (const f of ['nda.html', 'refund.html', 'en-refund.html']) {
    const s = strip(read(f));
    assert.ok(!/99,000/.test(s),
      f + ' 에 폐기된 금액(99,000)이 남아 있습니다 — FAQ·약관만 낡으면 물어본 값과 청구된 값이 갈립니다');
  }
});

/**
 * 🔴 **신설 〔2026-08-17〕 — 폐기된 VAT 미포함 표기(₩300,000)가 어디에도 없다.**
 * 판매가가 VAT 포함 총액(₩330,000)으로 바뀌었으므로, 종전 표기가 precheck.html 뿐
 * 아니라 FAQ·환불 페이지에도 남아 있으면 「물어본 값」과 「청구된 값」이 다시 갈립니다.
 */
test('🔴 폐기된 VAT 미포함 표기(₩300,000)가 화면 문면 어디에도 없다', () => {
  for (const f of ['precheck.html', 'en-precheck.html', 'nda.html', 'refund.html', 'en-refund.html']) {
    const s = strip(read(f));
    assert.ok(s.indexOf(RETIRED_PRE_VAT_TEXT) === -1,
      f + ' 에 VAT 미포함 시절 금액(₩300,000)이 남아 있습니다');
  }
});

/**
 * 🔴 **신설 〔2026-08-17 · 창업자 지시〕 — 가격은 결제 단계 마지막에만 보인다.**
 * FAQ(nda.html)·환불 규정(refund.html·en-refund.html)은 결제 흐름 밖의 일반 공개
 * 페이지입니다. 여기에 정확한 금액이 있으면 접수를 시작하기도 전에, 혹은 결제와
 * 무관한 문서를 읽다가 가격을 마주칩니다 — precheck.html 자체의 노출 시점 규칙
 * (아래 「2. 노출 시점」)과 같은 원칙을 이 세 페이지에도 적용합니다.
 *
 * ⚠️ 「원 단위 금액이 전혀 없다」를 봅니다(₩로 시작하는 숫자 전체) — 특정 값만 지우고
 *    다른 표기로 우회하는 것을 막습니다.
 * ⚠️ **₩0 은 예외입니다** — 「무료」를 설명하는 표기(en-refund.html 의 「Free (₩0)」)이지
 *    가격 정보를 새지 않습니다. 0 이 아닌 금액만 봅니다.
 */
test('🔴 FAQ·환불 페이지에 원화 금액이 전혀 없다 — 가격은 결제 단계에서만 보인다', () => {
  const AMOUNT_RE = /₩\s?(?!0\b)[\d,]+/;
  for (const f of ['nda.html', 'refund.html', 'en-refund.html']) {
    const s = strip(read(f));
    const hit = AMOUNT_RE.exec(s);
    assert.ok(!hit, f + ' 에 원화 금액이 남아 있습니다: ' + (hit && hit[0]));
  }
});

test('부가세 포함이 금액과 한 묶음으로 병기돼 있다 — 2026-08-17 VAT 반영 표기', () => {
  assert.ok(SRC.indexOf('부가세(VAT) 포함입니다.') !== -1, 'VAT 병기가 없습니다');

  // 금액 **바로 아래**여야 합니다. 환불·SLA 문구 사이로 밀리면 별개 안내로 읽힙니다.
  const at = SRC.indexOf('부가세(VAT) 포함입니다.');
  const priceAt = SRC.indexOf('class="pay-summary-value"');
  const refundAt = SRC.indexOf('class="pay-refund"');
  assert.ok(priceAt !== -1 && refundAt !== -1, '기준 블록을 찾지 못했습니다');
  assert.ok(at > priceAt && at < refundAt,
    'VAT 병기가 금액과 환불 문구 사이에 없습니다 — 금액과 한 묶음으로 읽혀야 합니다');
});

/* ══ 2. 노출 시점 ════════════════════════════════════════════════════════════
 *
 * 흐름 md §0-2: 「결제는 AI 실행 전, 사전점검이라는 개별 상품에만 걸림 — **비용 노출 없음**」.
 *
 * 🔴 요청된 전체 재구조화(접수 → 대조 → 결과 티저 → 결제)는 이 저장소만으로 못 합니다 —
 *    대조 결과가 trops_a 에 있습니다. 그 설계·전제는
 *    docs/03-analysis/price-gate-teaser-restructure.md 가 듭니다. 여기서 지키는 것은
 *    **「선택 전에는 금액이 화면에 없다」** 한 가지입니다.
 */

test('🔴 플랜 컨테이너가 두 겹으로 닫혀 있다 — CSS 와 속성', () => {
  assert.match(RAW, /\.plans \{ display: none; \}/,
    'CSS 겹이 사라졌습니다 — .plans { display: none } 이 없습니다');
  assert.match(SRC, /<div class="plans" id="plans"[^>]*\shidden\b/,
    '속성 겹이 사라졌습니다 — #plans 에 hidden 이 없습니다');
});

test('🔴 금액이 결제 영역 안에만 있다 — 접수 전에 마주치지 않는다', () => {
  /*
   * 금액 문자열이 **마크업**에 나오는 자리를 전수로 셉니다. 허용되는 곳은 두 곳뿐입니다:
   *   ① 두 겹으로 닫힌 .plans 컨테이너 안 (화면에 없습니다)
   *   ② #pay-area 안 (유료 경로를 고른 뒤에만 열립니다)
   * 그 밖에 하나라도 있으면 접수를 시작하기 전에 금액을 보는 구조입니다.
   *
   * ⚠️ `<script>` 는 이 셈에서 뺍니다 — 그 안의 금액은 **유료 분기에서만** 버튼에 쓰이는
   *    값이고(onPlanChange), 자리가 아니라 조건으로 통제됩니다. 그 값이 화면 금액과 같은지는
   *    위 「결제 요약·제출 버튼·서버 금액이 같은 말을 한다」가 따로 봅니다.
   */
  const MARKUP = SRC.replace(/<script[\s\S]*?<\/script>/g, '');

  const plansStart = MARKUP.indexOf('<div class="plans"');
  // .plans 다음에 오는 첫 형제가 마감 알림(#closed-notice)이라 그것을 닫는 자리로 씁니다.
  const plansEnd = MARKUP.indexOf('id="closed-notice"');
  const payStart = MARKUP.indexOf('<div class="pay-area"');
  const payEnd = MARKUP.indexOf('id="intake-submit"');
  assert.ok(plansStart !== -1 && plansEnd > plansStart && payStart !== -1 && payEnd > payStart,
    '기준 블록을 찾지 못했습니다 — 마크업 순서가 바뀌었으면 이 좌표를 다시 잡으십시오');

  const inAllowed = (i) =>
    (i > plansStart && i < plansEnd) || (i > payStart && i < payEnd);

  const offenders = [];
  let at = MARKUP.indexOf(PRICE_TEXT);
  while (at !== -1) {
    if (!inAllowed(at)) offenders.push(at);
    at = MARKUP.indexOf(PRICE_TEXT, at + 1);
  }
  assert.deepStrictEqual(offenders, [],
    '금액이 결제 영역 밖 ' + offenders.length + '곳에 그려집니다(문자 위치 ' +
    offenders.join(', ') + ') — 흐름 md §0-2 「비용 노출 없음」이 깨집니다');
});

test('결제 영역이 접힌 채로 내려온다 — 유료 경로를 고른 뒤에만 열린다', () => {
  assert.match(SRC, /<div class="pay-area" id="pay-area" hidden>/,
    '#pay-area 가 hidden 으로 내려오지 않습니다 — 금액이 처음부터 보입니다');
  assert.match(RAW, /payArea\.hidden = !paid;/,
    '유료 선택 여부로 결제 영역을 여는 코드가 없습니다');
});

test('금액을 대조 가능한 상태로 서버가 내려준다 — 화면이 정본을 참조할 길을 남긴다', () => {
  // api/payment-config.js 가 amount 로 실제 청구액을 내려보냅니다. 지금 화면은 손으로 적은
  // 문자열을 쓰지만(위젯 전 고지), 이 응답이 있어야 나중에 파생으로 바꿀 수 있습니다.
  const cfg = read('api/payment-config.js');
  assert.ok(/amount: PRICE/.test(cfg), 'payment-config 가 amount 를 내려주지 않습니다');
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
