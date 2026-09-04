'use strict';

/**
 * 배포되는 **전 페이지**가 갖춰야 하는 공통 요소 (2026-09-04).
 *
 * 🔴 **왜 이 파일이 생겼나** — 같은 사고가 두 축에서 났습니다. 페이지를 새로 짓거나
 *    전면교체할 때 **구판에 있던 공통 요소가 안 따라옵니다.**
 *      · 푸터 — `/precheck`·`/contact` 가 한 줄만 싣고 배포됐습니다(앞 커밋에서 잡았습니다).
 *      · skip 링크 — 8장 중 **2장**(index·en)에만 있었습니다. `c592667`(v11 교체)이
 *        스스로 「v11 에는 skip 링크가 없다 — 구판에 있던 접근성 요소가 빠진다」라고
 *        적어 두었는데, 그 뒤 서거나 다시 지어진 여섯 장이 전부 같은 상태였습니다.
 *    ⚠️ 둘 다 **막을 검사가 없었습니다.** 푸터는 `FOOTER_TIERS` 선언이 맡았고,
 *       나머지 공통 요소를 여기서 전 페이지에 잽니다.
 *
 * 🔴 **페이지 목록은 빌드 분류표에서 읽습니다**(사본 0) — 새 페이지가 등재되는 순간
 *    이 검사의 대상이 됩니다. ⛔ 여기에 파일 이름을 적지 마십시오.
 *
 * 🔜 이 파일이 앞으로 받을 축: hreflang 짝(지금은 i18n-parity ③) · `track.js` 등재.
 *    ⚠️ 옮길 때는 **살아 있는 검사를 두 곳에 두지 마십시오** — 옮기고 그 자리에
 *       후임을 가리키는 주석을 남기는 것이 이 저장소의 방식입니다.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { STATIC } = require('../scripts/build-static.js');
const PAGES = STATIC.html;

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** HTML 주석은 걷습니다 — 인수인계 메모는 「갖춘 것」이 아닙니다. */
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '');

/** locale 별 문구. index.html · en.html 이 쓰던 값 그대로입니다. */
const SKIP_LABEL = { ko: '본문으로 건너뛰기', en: 'Skip to content' };

test('🔴 전 페이지가 skip 링크를 갖는다 — 도착지까지 이어진다', () => {
  for (const { file, locale } of PAGES) {
    const html = strip(read(file));

    const m = html.match(/<a class="skip" href="#([A-Za-z0-9_-]+)">([^<]*)<\/a>/);
    assert.ok(m, `${file}: skip 링크가 없습니다 — 키보드 사용자가 nav 를 건너뛸 수 없습니다`);

    /*
     * 🔴 **도착지가 실제로 있는가**까지 봅니다. 앵커만 있고 `id` 가 없으면 눌러도
     *    아무 일이 없고, 그 상태가 「있다」로 통과하면 검사가 거짓 초록입니다.
     *    ⚠️ 정책 4장이 실제로 그랬습니다 — `<main>` 에 `id` 가 없었습니다(2026-09-04).
     */
    const target = m[1];
    assert.match(
      html, new RegExp('id="' + target + '"'),
      `${file}: skip 링크가 #${target} 를 가리키는데 그 id 를 가진 요소가 없습니다`
    );

    assert.strictEqual(
      m[2], SKIP_LABEL[locale],
      `${file}: skip 문구가 ${locale} 표준과 다릅니다(있는 것: "${m[2]}")`
    );
  }
});

test('🔴 skip 링크가 포커스로 «닿을 수 있게» 숨어 있다', () => {
  /*
   * 🔴 이 검사의 요점 — `display:none` · `visibility:hidden` 으로 숨기면 **포커스가 아예
   *    닿지 않아** 링크가 있으나 없으나 같아집니다. 화면 밖으로 밀어내는 방식이어야
   *    Tab 이 잡고, `:focus` 가 그것을 되돌려 놓아야 눈에 보입니다.
   * ⚠️ 이 두 축이 함께 있어야 뜻이 있습니다 — 밀어내기만 하면 눌러도 보이지 않고,
   *    되돌리기만 하면 늘 보입니다.
   */
  for (const { file } of PAGES) {
    const css = strip(read(file));
    const rule = css.match(/\.skip\s*\{[^}]*\}/);
    assert.ok(rule, `${file}: .skip 규칙이 없습니다`);
    assert.match(rule[0], /left:\s*-9999px/, `${file}: .skip 이 화면 밖으로 밀려나 있지 않습니다`);
    assert.doesNotMatch(
      rule[0], /display:\s*none|visibility:\s*hidden/,
      `${file}: .skip 을 display:none / visibility:hidden 으로 숨기면 포커스가 닿지 않습니다`
    );
    const focus = css.match(/\.skip:focus\s*\{[^}]*\}/);
    assert.ok(focus, `${file}: .skip:focus 규칙이 없습니다 — 눌러도 보이지 않습니다`);
    assert.match(focus[0], /left:\s*16px/, `${file}: .skip:focus 가 링크를 화면으로 되돌리지 않습니다`);
  }
});

test('[대조] 공통요소 검사가 실제로 문다 — 0건 통과 금지', () => {
  /* 🔴 위 둘이 «아무것도 안 읽어서» 통과하는 상태를 막습니다. */
  assert.ok(PAGES.length >= 8, `분류표에서 ${PAGES.length}장만 찾았습니다 — 검사가 헛돕니다`);
  for (const locale of ['ko', 'en']) {
    assert.ok(
      PAGES.some((p) => p.locale === locale),
      `${locale} 페이지가 0장입니다 — SKIP_LABEL.${locale} 이 한 번도 쓰이지 않습니다`
    );
  }

  // 검출기가 무는지 직접 확인합니다 — 도착지 없는 앵커·못 닿는 숨김은 통과하면 안 됩니다.
  const anchor = /<a class="skip" href="#([A-Za-z0-9_-]+)">([^<]*)<\/a>/;
  assert.ok(anchor.test('<a class="skip" href="#main">본문으로 건너뛰기</a>'));
  assert.ok(!anchor.test('<a class="skipx" href="#main">본문으로 건너뛰기</a>'));
  assert.match('.skip{display:none;left:-9999px}'.match(/\.skip\s*\{[^}]*\}/)[0], /display:\s*none/);
});
