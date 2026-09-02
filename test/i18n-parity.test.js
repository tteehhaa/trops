/*
 * 국·영문 대응 검사 〔신설 2026-08-30 · naming-consistency.test.js 에서 구조〕
 *
 *   npm test        (node --test test/)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **왜 옮겨 왔는가 — 살아 있는 검사가 «죽은 파일 안»에 갇혀 있었습니다**
 * ══════════════════════════════════════════════════════════════════════════════
 * `naming-consistency.test.js` 는 39개 검사 중 대부분이 2026-08-29 랜딩 전면교체로
 * 사라진 구조(상품 카드 3장 · 로드맵 · 기한관리 패널 · 탭 · FAQ · `/precheck`)를 쟀고,
 * **모듈 최상단에서 `read('precheck.html')` 을 하다가 ENOENT 로 죽었습니다.**
 *
 * 🔴 **그 파일 안에 «지금도 유효하고 지금도 필요한» 축이 갇혀 있었습니다** — 아래 ④가
 *    그것입니다. 그 검사는 「영문 페이지가 국문 페이지로 새지 않는가」를 재는데, 파일이
 *    로드조차 못 해 **실제로 새고 있는 것을 아무도 못 봤습니다**(2026-08-30 실측:
 *    `en.html` 푸터 → `/privacy.html`·`/refund.html`). 같은 배치에서 고쳤습니다.
 *
 * ⛔ **「red 인가」로 지울 것을 고르지 마십시오** — 이 파일이 그 반례입니다. 기준은
 *    「지킬 대상이 남았는가」입니다(대표 지시).
 *
 * ── 옮겨 오지 «않은» 것과 사유 ──────────────────────────────────────────────
 * 상품 카드 3장 · 로드맵 2행 · 기한관리 패널·트리거 · 탭 3개 · FAQ · 안심 문구 위치 ·
 * `/precheck` 이름 대조 · 푸터 태그라인(`footer-meta` 가 랜딩에서 0건이 됐습니다) —
 * 전부 잴 대상이 사라졌습니다. 원본: `git show ca47218:test/naming-consistency.test.js`.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** 주석 없는 마크업. 이 저장소는 주석에 옛 문자열을 인용하므로 그대로 두면 오탐입니다. */
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
/** 사람 눈에 보이는 본문만 — `<style>`·`<script>` 안까지 걷습니다. */
const body = (s) =>
  strip(s).replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');

/**
 * 🔴 **페이지 목록은 빌드 분류표에서 읽습니다**(사본 0) — 「STATIC.html 에 `locale:'en'`
 *    으로 있는데 이 목록에는 없는」 상태를 **표현할 수 없게** 만듭니다.
 */
const STATIC_PAGES = require('../scripts/build-static.js').STATIC.html;
const EN_PAGES = STATIC_PAGES.filter((p) => p.locale === 'en').map((p) => p.file);

/**
 * 🔴 **샘플 리포트 2종은 랜딩이 아닙니다** — 사이트 헤더·푸터가 없고, em dash 는 그 문서가
 *    표에서 「값 없음」을 적는 방식(`<div class="vl">—</div>`)이라 문장 부호가 아닙니다.
 * 🔴 **필터이지 손으로 적은 목록이 아닙니다** — 샘플이 늘어도 여기를 고칠 일이 없습니다.
 */
const SAMPLE_PAGES = STATIC_PAGES.map((p) => p.file).filter((f) => /(^|-)sample\.html$/.test(f));
const EN_LANDING_PAGES = EN_PAGES.filter((f) => !SAMPLE_PAGES.includes(f));

/* ══ ① 목록이 비면 아래가 전부 «조용한 초록»이 된다 ═══════════════════════ */

test('영문 페이지가 STATIC.html 에서 실제로 잡힌다 — 빈 목록은 조용한 초록불이다', () => {
  /*
   * `locale` 표기가 바뀌거나(`'en'` → `'en-US'`) 구조가 달라지면 EN_PAGES 가 **빈 배열**이
   * 되고, 그러면 아래 검사가 **한 바퀴도 안 돌면서 전부 초록**입니다. 가장 나쁜 실패 형태라
   * 하한을 따로 셉니다.
   */
  assert.ok(EN_PAGES.length >= 3, '영문 페이지가 ' + EN_PAGES.length + '장뿐입니다: ' + EN_PAGES.join(', '));
  assert.ok(EN_LANDING_PAGES.length >= 2, '영문 랜딩 페이지가 너무 적습니다');
});

/* ══ ② 번역 누락 ═══════════════════════════════════════════════════════════ */

test('영문 페이지의 화면 문구에 한글이 남아 있지 않다', () => {
  for (const en of EN_PAGES) {
    const text = body(read(en))
      /* ⚠️ 언어 전환 링크는 예외입니다 — 「한국어」라고 «한글로» 적히는 것이 그 링크의 일입니다. */
      .replace(/<a[^>]*hreflang="ko"[^>]*>[^<]*<\/a>/g, '')
      .replace(/<[^>]+>/g, ' ');
    const hit = text.match(/[가-힣][가-힣\s·]*/g);
    assert.ok(!hit, en + ' 에 번역되지 않은 한글이 있습니다: ' + JSON.stringify(hit && hit.slice(0, 5)));
  }
});

test('영문 화면 문구에 em dash 가 없다', () => {
  /*
   * 〔2026-08-17 · 대표 지시〕 국문은 그대로 씁니다 — 영문 문면에만 걸립니다. 영문 원고를
   * 처음 옮길 때 국문의 「—」 자리를 그대로 따라가 문장마다 붙어 있었고, 영문에서는 그
   * 빈도가 기계가 쓴 문장처럼 읽힙니다.
   * ⚠️ en dash(–)는 그대로 둡니다 — 숫자 범위(3–5 business days)에 옳은 표기입니다.
   */
  for (const f of EN_LANDING_PAGES) {
    const text = body(read(f)).replace(/<[^>]+>/g, ' ');
    assert.ok(text.indexOf('—') === -1, f + ' 의 화면 문구에 em dash 가 있습니다');
  }
});

/* ══ ③ hreflang — 양쪽이 서로를 가리켜야 인정된다 ═════════════════════════ */

/**
 * 🔴 **짝을 «파생»합니다** — `en-<이름>.html` ↔ `<이름>.html`, `en.html` ↔ `index.html`.
 *    종전에는 6쌍을 손으로 적어 두었고 그중 넷이 2026-08-30 에 삭제됐습니다.
 */
function pairs() {
  const files = new Set(STATIC_PAGES.map((p) => p.file));
  const out = [];
  for (const en of EN_PAGES) {
    if (SAMPLE_PAGES.includes(en)) continue;
    const ko = en === 'en.html' ? 'index.html' : en.replace(/^en-/, '');
    if (files.has(ko)) out.push([ko, en]);
  }
  return out;
}

/** 배포 경로. `index.html` → `/`, 그 밖에는 확장자를 뗀 clean URL 입니다. */
const urlOf = (f) => (f === 'index.html' ? 'https://trops.kr/' : 'https://trops.kr/' + f.replace(/\.html$/, ''));

test('국문·영문이 hreflang 으로 서로를 가리킨다', () => {
  const list = pairs();
  assert.ok(list.length >= 2, '짝을 ' + list.length + '개만 찾았습니다 — 파생이 헛돕니다');

  const missing = [];
  for (const [ko, en] of list) {
    for (const file of [ko, en]) {
      const m = strip(read(file));
      for (const [lang, url] of [['ko', urlOf(ko)], ['en', urlOf(en)], ['x-default', urlOf(ko)]]) {
        const tag = '<link rel="alternate" hreflang="' + lang + '" href="' + url + '">';
        if (m.indexOf(tag) === -1) missing.push(file + ' → ' + lang);
      }
    }
  }
  assert.deepStrictEqual(missing, [],
    'hreflang 이 빠진 자리: ' + missing.join(' · ') +
    ' — 한쪽만 있으면 검색엔진이 «무시»합니다(짝을 이뤄야 인정됩니다)');
});

/* ══ ④ 🔴 영문 경로가 끝까지 영문이다 ═════════════════════════════════════ */

test('🔴 영문 페이지가 국문 페이지로 새지 않는다', () => {
  /*
   * 🔴 **이 검사가 「죽은 파일 안」에 갇혀 있는 동안 실제로 새고 있었습니다**
   *    (2026-08-30 실측: `en.html` 푸터 → `/privacy.html`·`/refund.html`). 같은 배치에서
   *    링크를 고쳤고, 이 검사를 살려 다시 새지 않게 합니다.
   *
   * 🔴 **확장자를 정규화합니다** 〔2026-08-30 수정〕 — 종전 목록은 clean URL(`/privacy`)만
   *    담았는데 새 랜딩은 `/privacy.html` 로 적었습니다. 둘 다 배포에서 열리므로
   *    **정규화하지 않으면 이 검사가 그 링크를 놓칩니다**(실제로 놓쳤습니다).
   * 🔴 **예외는 `hreflang="ko"` 하나입니다** — 「이것은 이 페이지의 국문판이다」라는 선언이고,
   *    위 ③이 그 선언이 실제로 짝을 이루는지 따로 단정합니다(두 검사가 서로를 받칩니다).
   * ⛔ 예외를 「클래스로 가리기」나 「목록에서 경로 빼기」로 만들지 마십시오 — 전자는 그
   *    클래스를 입은 아무 링크나 통과시키고, 후자는 본문 링크가 새는 것까지 통과시킵니다.
   */
  const koOnly = new Set(
    STATIC_PAGES.filter((p) => p.locale === 'ko')
      .map((p) => (p.file === 'index.html' ? null : '/' + p.file.replace(/\.html$/, '')))
      .filter(Boolean)
  );
  assert.ok(koOnly.size >= 2, '국문 전용 경로를 ' + koOnly.size + '개만 찾았습니다 — 검사가 헛돕니다');

  const offenders = [];
  for (const en of EN_LANDING_PAGES) {
    const scanned = strip(read(en)).replace(/<a[^>]*hreflang="ko"[^>]*>[\s\S]*?<\/a>/g, '');
    for (const m of scanned.matchAll(/href="(\/[^"]*)"/g)) {
      /* 🔴 `?`·`#` 를 떼고 `.html` 도 뗍니다 — 같은 문서의 두 표기입니다. */
      const p = m[1].split(/[?#]/)[0].replace(/\.html$/, '');
      if (koOnly.has(p)) offenders.push(en + ' → ' + m[1]);
    }
  }
  assert.deepStrictEqual(offenders, [],
    '영문 페이지가 국문 페이지로 갑니다: ' + offenders.join(' · '));
});

test('[대조] 검출기가 실제로 문다 — 0건 통과 금지', () => {
  /* 🔴 위 검사가 «아무 링크도 안 읽어서» 통과하는 상태를 막습니다. */
  const norm = (h) => h.split(/[?#]/)[0].replace(/\.html$/, '');
  assert.strictEqual(norm('/privacy.html'), '/privacy');
  assert.strictEqual(norm('/refund?x=1'), '/refund');
  assert.strictEqual(norm('/en-privacy'), '/en-privacy');

  const linked = [...strip(read('en.html')).matchAll(/href="(\/[^"]*)"/g)];
  assert.ok(linked.length >= 3, 'en.html 에서 내부 링크를 ' + linked.length + '개만 찾았습니다');
});

/* ══ ⑤ 폐기된 상품명 ══════════════════════════════════════════════════════ */

test('🔴 폐기된 상품명이 어느 페이지 본문에도 없다', () => {
  /*
   * 같은 상품을 두 이름으로 부르면 한 페이지가 두 회사처럼 읽힙니다. 페이지 «전역»으로
   * 봅니다 — 종전에는 섹션 안만 보던 검사들이 그 섹션이 사라지자 조용히 통과했습니다.
   *
   * 🔴 **`무역보험 서류 패키지` 를 더했습니다** 〔2026-09-01 · 대표 지시〕. 유료 상품의
   *    정본 이름은 `무역보험 준비팩` 하나이고, precheck 카드가 옛 이름을 들고 있었습니다.
   *
   * ⚠️ **`body()` 만으로는 그 자리를 못 봅니다** — `body()` 는 `<script>` 를 걷어내는데,
   *    precheck 의 두 카드는 **JS 가 조립**합니다(문자열 안에 `<h3>…</h3>` 가 들어 있음).
   *    목록에만 넣으면 정작 되살아날 자리를 감시하지 못하는 «조용한 초록»이 됩니다.
   * 🔴 그래서 **두 겹으로 봅니다** — 화면 마크업(`body`)과 스크립트를 포함한 소스(`strip`).
   *    `strip` 은 HTML 주석만 걷으므로 JS 문자열이 그대로 남습니다.
   * ⛔ **이 이름들을 주석에 «리터럴로» 적지 마십시오** — 아래가 JS 주석까지 봅니다.
   *    설명이 필요하면 「옛 상품명」처럼 풀어 쓰십시오(price-exposure 의 금지 문구와 같은 규약).
   */
  /*
   * 🔴 **`무역보험 준비팩` 을 더했습니다** 〔2026-09-03 · 대표 지시 — 상품명 3종 개편〕.
   *    유료 상품의 정본 이름은 이제 `무역보험 준비 패키지` 입니다.
   * ⚠️ 3단계(`수출 채권관리`·`수출채권 관리`)는 **넣을 수 없습니다** — privacy.html ·
   *    refund.html 푸터가 아직 그 이름을 들고 있습니다(정책 문서는 이번 범위 밖).
   * ⚠️ 1단계(`수출 사전점검`)도 넣을 수 없습니다 — 상품명 자리만 바꾸고 일반 서술은
   *    그 이름을 그대로 씁니다(무료인 것은 점검 자체이지 리포트가 아닙니다).
   */
  const RETIRED = ['NDA 비교', '문서 대조', '거래 절차 트래킹', '무역보험 서류 패키지', '무역보험 준비팩'];
  const offenders = [];
  for (const { file } of STATIC_PAGES) {
    const seen = new Set();
    for (const [where, text] of [['화면', body(read(file))], ['소스(JS 포함)', strip(read(file))]]) {
      for (const name of RETIRED) {
        const key = file + ': ' + name;
        if (text.includes(name) && !seen.has(key)) { seen.add(key); offenders.push(key + ' [' + where + ']'); }
      }
    }
  }
  assert.deepStrictEqual(offenders, [], '폐기된 상품명이 남아 있습니다: ' + offenders.join(' · '));
});
