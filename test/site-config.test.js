'use strict';

/**
 * 사업자정보 단일소스화를 지키는 테스트 (2026-08-11).
 *
 * 왜 필요한가: 전에는 사업자정보 6항목이 6개 HTML 에 각자 하드코딩돼 있었고,
 * 통신판매업신고번호가 확정되면 6곳을 손으로 고쳐야 하는 상태였습니다.
 * 지금은 site.config.json 한 곳이 원본입니다. 누군가 편의로 HTML 에 값을 다시
 * 적어 넣으면 그 순간 원래 상태로 돌아가고, 아무 증상 없이 조용히 갈라집니다.
 *
 * 여기서 지키는 것 셋:
 *   1. 소스에 값이 없다 (토큰만 있다)
 *   2. 설정값 하나를 바꾸면 산출물 전부가 따라온다
 *   3. 오타 난 토큰은 빌드를 세운다
 */

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CONFIG = path.join(ROOT, 'site.config.json');

/*
 * 🔴 **페이지 목록을 손으로 적지 않습니다** 〔2026-08-30 복구〕.
 *
 * 종전에는 여덟 장을 배열에 박아 뒀고 그중 셋(`nda.html`·`precheck.html`·`uae.html`)이
 * 2026-08-30 에 삭제되면서 이 파일이 ENOENT 로 무너졌습니다. 「새 페이지를 만들면 여기에도
 * 넣으십시오」라는 주석은 **지우는 경우를 말하지 않았습니다.**
 *
 * 이제 **빌드 분류표**(`scripts/build-static.js` `STATIC.html`)에서 읽습니다 — 그 표가
 * 「무엇이 배포되는가」의 정본이고, `locale` 칸이 ko/en 을 이미 가르고 있습니다(사본 0).
 * ⛔ 여기에 파일 이름을 다시 적지 마십시오.
 */
const { STATIC } = require('../scripts/build-static.js');

/** 배포되는 전 페이지. 하드코딩 검사는 **여기 전부**를 봅니다. */
const PAGES = STATIC.html.map((e) => e.file);
const KO_PAGES = STATIC.html.filter((e) => e.locale === 'ko').map((e) => e.file);
const EN_PAGES = STATIC.html.filter((e) => e.locale === 'en').map((e) => e.file);

/**
 * 🔴 **사업자정보를 «싣는» 페이지 — 빌드 분류표의 `footer:` 선언에서 읽습니다**
 *    〔2026-09-04 교체〕.
 *
 * ⚠️ 종전에는 `carriesBiz = (f) => /\{\{biz\./.test(source)` 로, 「소스가 토큰을 쓰는가」를
 *    **추측**했습니다. 그 주석은 「값이 아니라 «의도»를 축으로 삼습니다」라고 적고 있었지만,
 *    정규식이 읽는 것은 의도가 아니라 **흔적**입니다 — 토큰을 두 개만 쓰는 페이지도
 *    똑같이 통과합니다. 실제로 `precheck.html`·`contact.html` 이 `companyName`·`ceo`
 *    둘만 싣고 통과하고 있었습니다(2026-09-04 실측: 그 두 장의 푸터 93px · 정책 4장 355~377px).
 * 🔴 의도는 이제 `scripts/build-static.js` 의 `FOOTER_TIERS` 에 **선언**으로 있습니다.
 *    추측하지 않고 읽습니다(사본 0). `footer: 'none'` 이 종전 주석이 걱정한 「푸터 없는
 *    페이지에서 거짓 red」를 선언으로 해결합니다 — 그래서 추측할 이유가 사라졌습니다.
 * ⛔ 여기에 페이지 이름이나 항목 목록을 다시 적지 마십시오.
 */
const { FOOTER_TIERS } = require('../scripts/build-static.js');
const FOOTER_DECL = STATIC.html.filter((e) => FOOTER_TIERS[e.footer] !== null);
const KO_BIZ_PAGES = () => FOOTER_DECL.filter((e) => e.locale === 'ko').map((e) => e.file);
const EN_BIZ_PAGES = () => FOOTER_DECL.filter((e) => e.locale === 'en').map((e) => e.file);

function build() {
  execFileSync('node', [path.join(ROOT, 'scripts', 'build-static.js')], {
    cwd: ROOT,
    stdio: 'pipe',
  });
}

/*
 * ══════════════════════════════════════════════════════════════════════════
 * 🔴 **site.config.json 오염 방지** 〔신설 2026-08-30 · 대표 지적〕
 * ══════════════════════════════════════════════════════════════════════════
 * 아래 「한 곳에서 바꾸면 전 페이지가 따라온다」 검사는 **진짜 설정 파일을 고쳤다가
 * 되돌립니다.** `finally` 가 그것을 되돌리지만 **Ctrl-C 로 죽이면 `finally` 가 돌지 않고**
 * 프로브 값(`2026-서울강남-00000`)이 그대로 남습니다. 검사가 오래 red 였던 동안 사람들이
 * 중간에 끊는 일이 잦았고, 그래서 오염이 되풀이됐습니다.
 *
 * 🔴 그래서 **원본을 파일 밖에 붙들고 종료 경로마다 되돌립니다.** `exit` 는 동기 훅이라
 *    `writeFileSync` 가 돕니다. ⛔ 이 장치를 지우지 마십시오.
 * ⚠️ `SIGKILL` 은 못 막습니다 — 막을 수 있는 것이 없습니다(그때는 `git checkout` 하십시오).
 */
let configBackup = null;
function guardConfig() {
  if (configBackup === null) configBackup = fs.readFileSync(CONFIG, 'utf8');
}
function restoreConfig() {
  if (configBackup === null) return;
  if (fs.readFileSync(CONFIG, 'utf8') !== configBackup) fs.writeFileSync(CONFIG, configBackup);
}
process.on('exit', restoreConfig);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { restoreConfig(); process.exit(130); });
}

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
}

test('소스 HTML 에 사업자정보 값이 하드코딩돼 있지 않다', () => {
  const config = readConfig();
  // 주석 안의 언급은 셈에서 뺍니다 — 「"주식회사 테오네"를 "(주)테오네"로 줄여 쓰지
  // 마십시오」 같은 인수인계 메모는 값이 아니라 설명이고, 빌드가 어차피 걷어냅니다.
  // HTML 주석뿐 아니라 <style>·<script> 안(=CSS·JS 주석이 사는 곳)도 함께 뺍니다.
  const stripComments = (h) =>
    h
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');

  for (const page of KO_PAGES) {
    const html = stripComments(fs.readFileSync(path.join(ROOT, page), 'utf8'));
    for (const [key, value] of Object.entries(config.biz.ko)) {
      if (key.startsWith('_')) continue;
      assert.ok(
        !html.includes(value),
        `${page}: 사업자정보 "${value}" 가 하드코딩돼 있습니다. {{biz.${key}}} 를 쓰십시오`
      );
    }
  }

  for (const page of EN_PAGES) {
    const html = stripComments(fs.readFileSync(path.join(ROOT, page), 'utf8'));
    for (const [key, value] of Object.entries(config.biz.en)) {
      if (key.startsWith('_')) continue;
      assert.ok(
        !html.includes(value),
        `${page}: 사업자정보 "${value}" 가 하드코딩돼 있습니다. {{biz.${key}}} 를 쓰십시오`
      );
    }
  }
});

test('빌드 산출물에 미치환 토큰이 남지 않는다', () => {
  build();
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(DIST, page), 'utf8');
    const left = html.match(/\{\{[\s\S]{0,40}?\}\}/g) || [];
    assert.deepEqual(left, [], `${page}: 치환되지 않은 토큰이 남았습니다`);
  }
});

test('현재 설정값이 사업자정보를 싣는 페이지 산출물에 그대로 들어간다', () => {
  const config = readConfig();
  build();

  /*
   * ⚠️ **여섯 값을 «전부» 싣는 페이지만 봅니다** — 랜딩 푸터는 요약이라 상호·대표·등록번호·
   *    주소 넷만 싣고 통신판매업신고번호·전화는 정책 페이지 푸터가 듭니다. 「전 페이지가
   *    여섯을 다 갖는다」로 재면 랜딩이 거짓 red 가 됩니다.
   * 🔴 대신 **각 페이지가 «자기가 쓴 토큰의» 값을 갖는가**를 봅니다 — 그것이 이 검사가
   *    지키려던 것(설정 → 산출물 도달)이고 페이지 구성과 무관합니다.
   */
  const tokensOf = (src) => [...src.matchAll(/\{\{biz\.([a-zA-Z]+)\}\}/g)].map((m) => m[1]);

  for (const [pages, locale] of [[KO_BIZ_PAGES(), 'ko'], [EN_BIZ_PAGES(), 'en']]) {
    assert.ok(pages.length > 0, locale + ' 쪽에 사업자정보를 싣는 페이지가 0장입니다 — 검사가 헛돕니다');
    for (const page of pages) {
      const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
      const html = fs.readFileSync(path.join(DIST, page), 'utf8');
      for (const key of new Set(tokensOf(src))) {
        assert.ok(
          html.includes(config.biz[locale][key]),
          `${page}: biz.${locale}.${key} 값이 산출물에 없습니다`
        );
      }
    }
  }
});

test('통신판매업신고번호를 한 곳에서 바꾸면 전 페이지가 따라온다', () => {
  // 이 테스트가 A-1 의 본론입니다 — 신고번호가 확정되는 날 실제로 일어날 일을
  // 그대로 해 봅니다: site.config.json 한 줄만 고치고 빌드.
  guardConfig();
  const original = fs.readFileSync(CONFIG, 'utf8');
  const config = JSON.parse(original);

  const KO_PROBE = '2026-서울강남-00000';
  const EN_PROBE = '2026-Seoul-Gangnam-00000';
  config.biz.ko.ecommerceNo = KO_PROBE;
  config.biz.en.ecommerceNo = EN_PROBE;

  try {
    fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2) + '\n');
    build();

    /* ⚠️ 신고번호 토큰을 «쓰는» 페이지만 봅니다 — 랜딩 푸터는 그 항목을 싣지 않습니다. */
    const uses = (f) => /\{\{biz\.ecommerceNo\}\}/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    const koTargets = KO_PAGES.filter(uses);
    const enTargets = EN_PAGES.filter(uses);
    assert.ok(koTargets.length > 0 && enTargets.length > 0,
      '신고번호를 싣는 페이지가 없습니다 — 이 검사가 아무것도 재지 않습니다');

    for (const page of koTargets) {
      const html = fs.readFileSync(path.join(DIST, page), 'utf8');
      assert.ok(html.includes(KO_PROBE), `${page}: 바뀐 신고번호가 반영되지 않았습니다`);
      assert.ok(!html.includes('신청 중'), `${page}: 예전 값이 남아 있습니다`);
    }
    for (const page of enTargets) {
      const html = fs.readFileSync(path.join(DIST, page), 'utf8');
      assert.ok(html.includes(EN_PROBE), `${page}: 바뀐 신고번호가 반영되지 않았습니다`);
      assert.ok(!html.includes('Applied for'), `${page}: 예전 값이 남아 있습니다`);
    }
  } finally {
    fs.writeFileSync(CONFIG, original);
    build(); // 원상복구
  }
  // 🔴 되돌아왔는지 «확인»합니다 — 조용히 오염된 채 통과하지 않습니다.
  assert.strictEqual(fs.readFileSync(CONFIG, 'utf8'), original,
    'site.config.json 이 프로브 값인 채로 남았습니다 — git checkout site.config.json 하십시오');
});

test('사전에 없는 토큰이 있으면 빌드가 실패한다', () => {
  // 오타(biz.ecommerceNumber)가 나면 화면에 {{...}} 가 그대로 찍힙니다.
  // 조용히 나가는 것보다 빌드가 깨지는 편이 낫습니다.
  /* ⚠️ 대상을 손으로 고르지 않습니다 — 그 토큰을 «쓰는» 첫 페이지를 씁니다. */
  const target = KO_PAGES.find((f) =>
    /\{\{biz\.ecommerceNo\}\}/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  assert.ok(target, '신고번호 토큰을 쓰는 페이지가 없습니다');
  const page = path.join(ROOT, target);
  const original = fs.readFileSync(page, 'utf8');
  try {
    fs.writeFileSync(page, original.replace('{{biz.ecommerceNo}}', '{{biz.thisKeyDoesNotExist}}'));
    assert.throws(() => build(), '미치환 토큰이 있는데도 빌드가 성공했습니다');
  } finally {
    fs.writeFileSync(page, original);
    build(); // 원상복구
  }
});

test('site.config.json 이 두 언어 묶음을 모두 갖는다', () => {
  const config = readConfig();
  for (const locale of ['ko', 'en']) {
    for (const key of ['companyName', 'ceo', 'registrationNo', 'ecommerceNo', 'address', 'phone']) {
      const value = config.biz[locale][key];
      assert.equal(typeof value, 'string', `biz.${locale}.${key} 가 없습니다`);
      assert.ok(value.trim().length > 0, `biz.${locale}.${key} 가 비어 있습니다`);
    }
  }
  // 사업자등록번호는 언어와 무관한 같은 번호입니다. 갈라지면 둘 중 하나가 틀린 것입니다.
  assert.equal(config.biz.ko.registrationNo, config.biz.en.registrationNo);
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 * 🔴 **푸터 «구성» 검사** 〔신설 2026-09-04〕
 * ══════════════════════════════════════════════════════════════════════════
 * 위 검사들과 `scripts/verify-deployment.js` 의 `법인명-ko` 는 전부 **배선** 검사입니다 —
 * 「각 페이지가 «자기가 쓴» 토큰의 값을 갖는가」(설정 → 산출물이 이어져 있는가).
 * 그 축은 맞고, 두 주석이 스스로 「푸터 구성이 바뀌어도 이 검사는 낡지 않습니다」라고
 * 적어 두었습니다. **바로 그래서 푸터가 줄어드는 것을 볼 수 없었습니다.**
 *
 * 🔴 여기서 재는 것은 다른 축입니다 — 「이 페이지가 **실어야 하는 것을 싣는가**」.
 *    선언은 `scripts/build-static.js` 의 `FOOTER_TIERS` 가 갖고, 이 파일은 읽기만 합니다.
 * ⚠️ **`<footer>` 블록 안만 봅니다.** 페이지 본문이 우연히 같은 값을 담고 있어도
 *    푸터가 비어 있으면 red 여야 합니다 — 그게 이번에 새어 나간 형태입니다.
 */

/** 소스에서 `<footer>` 블록만 떼어 옵니다(주석은 남깁니다 — 토큰 셈에서 따로 뺍니다). */
function footerBlock(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const m = html.match(/<footer[\s\S]*?<\/footer\s*>/i);
  assert.ok(m, `${file}: <footer> 블록을 찾지 못했습니다`);
  // 주석 안의 인수인계 메모는 「싣는 것」이 아닙니다. 빌드가 어차피 걷어냅니다.
  return m[0].replace(/<!--[\s\S]*?-->/g, '');
}

/*
 * 🔴 **정책 경로도 손으로 적지 않습니다** — 분류표의 파일 이름에서 파생합니다.
 *    `(^|-)(privacy|refund).html` 이 정책 문서 두 장의 이름이고, `locale` 이 짝을 가릅니다.
 * ⚠️ 아래 [대조] 검사가 「locale 마다 정확히 2장」을 단정합니다 — 페이지 이름이 바뀌면
 *    이 파생이 조용히 0장이 되는 대신 red 가 납니다.
 */
const POLICY_PATHS = (locale) =>
  STATIC.html
    .filter((e) => e.locale === locale && /(^|-)(privacy|refund)\.html$/.test(e.file))
    .map((e) => '/' + e.file.replace(/\.html$/, ''));

/** `/privacy.html` · `/refund?x=1` 같은 표기를 한 형태로 모읍니다(i18n-parity ④ 와 같은 규칙). */
const normHref = (h) => h.split(/[?#]/)[0].replace(/\.html$/, '');

test('🔴 푸터가 선언한 티어대로 사업자정보를 싣는다', () => {
  const seen = [];
  for (const { file, locale, footer } of FOOTER_DECL) {
    const tier = FOOTER_TIERS[footer];
    const block = footerBlock(file);
    const used = new Set([...block.matchAll(/\{\{biz\.([a-zA-Z]+)\}\}/g)].map((m) => m[1]));

    /*
     * 🔴 **정확히 일치**를 봅니다 — 빠진 것은 「푸터가 새어 나갔다」, 더 있는 것은
     *    「티어를 잘못 골랐다」입니다. 둘 다 사람이 봐야 하는 신호라 함께 red 로 냅니다.
     * ⛔ 이것을 「선언한 것이 있으면 통과」(부분집합)로 느슨하게 하지 마십시오 —
     *    그러면 랜딩에 여섯 항목이 들어와도 초록입니다.
     */
    assert.deepStrictEqual(
      [...used].sort(),
      [...tier.biz].sort(),
      `${file}(footer: '${footer}') 의 푸터 항목이 선언과 다릅니다 — ` +
        `빠진 것: [${tier.biz.filter((k) => !used.has(k)).join(', ')}] · ` +
        `선언에 없는 것: [${[...used].filter((k) => !tier.biz.includes(k)).join(', ')}]`
    );
    seen.push(file);
  }
  assert.ok(seen.length >= 6, `푸터를 싣는 페이지를 ${seen.length}장만 찾았습니다 — 검사가 헛돕니다`);
});

test('🔴 푸터가 개인정보처리방침·환불규정으로 가는 길을 갖는다', () => {
  /*
   * 🔴 **이 검사가 없어서 `/contact` 가 방침 링크 0건으로 배포됐습니다.**
   *    `scripts/build-static.js` 의 그 페이지 주석이 스스로 「이 페이지는 **개인정보를
   *    새로 받습니다**」라고 적고 있는데, 그 페이지에서 방침으로 가는 길이 없었습니다.
   * ⚠️ 경로 표기가 페이지마다 갈려 있습니다(`/privacy.html` · `/privacy` · `/en-privacy`) —
   *    셋 다 배포에서 열리므로 정규화해서 봅니다. 정규화를 빼면 이 검사가 링크를 놓칩니다
   *    (i18n-parity ④ 가 2026-08-30 에 실제로 놓쳤습니다).
   */
  for (const { file, locale, footer } of FOOTER_DECL) {
    if (!FOOTER_TIERS[footer].policyLinks) continue;
    const linked = new Set(
      [...footerBlock(file).matchAll(/href="(\/[^"]*)"/g)].map((m) => normHref(m[1]))
    );
    for (const want of POLICY_PATHS(locale)) {
      assert.ok(
        linked.has(want),
        `${file}: 푸터에 ${want} 로 가는 링크가 없습니다(있는 것: ${[...linked].join(' ') || '없음'})`
      );
    }
  }
});

test('🔴 푸터가 저작권 표시를 갖는다', () => {
  for (const { file, footer } of FOOTER_DECL) {
    if (!FOOTER_TIERS[footer].copyright) continue;
    const block = footerBlock(file);
    // 문면이 아니라 «있는가»를 봅니다 — 정책 4장은 상호를 함께 적고 랜딩은 적지 않습니다.
    assert.match(block, /©/, `${file}: 푸터에 저작권 표시(©)가 없습니다`);
    assert.match(block, /All rights reserved/i, `${file}: 푸터에 저작권 문구가 없습니다`);
  }
});

test('[대조] 푸터 구성 검사가 실제로 문다 — 0건 통과 금지', () => {
  /* 🔴 위 셋이 «아무것도 안 읽어서» 통과하는 상태를 막습니다. */
  assert.ok(FOOTER_DECL.length >= 6, `푸터 선언이 ${FOOTER_DECL.length}장뿐입니다`);
  for (const locale of ['ko', 'en']) {
    assert.strictEqual(
      POLICY_PATHS(locale).length, 2,
      `${locale} 정책 경로를 ${POLICY_PATHS(locale).length}개 찾았습니다 — 페이지 이름이 바뀌었습니까?`
    );
  }
  assert.strictEqual(normHref('/privacy.html'), '/privacy');
  assert.strictEqual(normHref('/refund?x=1'), '/refund');

  // 티어가 셋이고 그중 하나는 「푸터 없음」입니다. 선언이 이 셋 밖으로 나가면 빌드가 섭니다.
  assert.deepStrictEqual(Object.keys(FOOTER_TIERS).sort(), ['full', 'none', 'summary']);
  assert.strictEqual(FOOTER_TIERS.none, null);

  // 검출기가 무는지 직접 확인합니다 — 요약 티어에서 주소를 뺀 푸터는 통과하면 안 됩니다.
  const fake = new Set(['companyName', 'ceo']);
  assert.notDeepStrictEqual([...fake].sort(), [...FOOTER_TIERS.summary.biz].sort());
});
