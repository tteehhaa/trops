'use strict';

/**
 * disclaimer-parity.test.js — 면책 셋이 «여러 자리에서 같은 것을 말하는가» 〔신설 2026-09-20〕
 *
 * 🔴 **왜 이 파일이 생겼나** — 2026-09-20 에 `/about` 이 서면서 같은 면책을 드는 자리가
 *    넷이 됐습니다. 넷이 **서로 다른 문장**으로 같은 셋을 말합니다:
 *
 *      랜딩 푸터   「법률 자문과 계약서에 대한 법률적 검토를 제공하지 않습니다(…)」
 *      랜딩 FAQ    「… 법률 자문과 계약서에 대한 법률적 검토도 제공하지 않으며 …」
 *      회사 소개   「법률 자문 및 개별 계약서 검토를 제공하지 않습니다.」
 *      (영문 두 자리도 같은 구조)
 *
 *    문장이 달라도 되는 자리입니다 — 푸터는 한 문단, FAQ 는 답변, 회사 소개는 목록이라
 *    말투가 같을 이유가 없습니다. 갈리면 안 되는 것은 **문장이 아니라 «무엇을 부정하는가»**
 *    입니다. 그래서 이 검사는 글자 일치를 보지 않고 **세 축이 다 있는가**를 봅니다.
 *
 * 🔴 **축이 셋인 이유** — 세 법·계약 위험이 각각 다릅니다.
 *      ① 법률 자문·계약서 검토      변호사법 · 외국법자문사법
 *      ② 보험 인수·지급 심사, 가입 대행, 특정 상품 추천   보험업법 · 모집 자격
 *      ③ 미수금 회수 보장            지킬 수 없는 결과 약속
 *    하나가 빠지면 나머지 둘이 있어도 그 자리는 «덜 부정한» 문면이 됩니다.
 *
 * ⚠️ **모든 페이지가 셋을 다 들어야 하는 것은 아닙니다.** 일부만 드는 자리가 있고, 그것은
 *    의도입니다 — `/precheck` 본문은 보험 축과 회수 축만, `refund`·`privacy` 푸터는
 *    「법률 자문 서비스가 아닙니다」 한 줄만 듭니다. 그 자리들은 «완전한 면책»을 표방하지
 *    않습니다. 그래서 대상은 아래 `SURFACES` 에 **선언**된 넷뿐입니다.
 *    ⛔ 부분 면책 자리를 여기에 더하지 마십시오 — 더하는 순간 그 페이지에 세 축을 전부
 *       적어야 하고, 그것은 이 검사가 화면 구성을 대신 정하는 일이 됩니다.
 *
 * 🔜 이 파일이 맡지 «않는» 것: 랜딩 FAQ 본문 ↔ JSON-LD 글자 일치는
 *    `test/faq-structured-data.test.js` 가 봅니다. 두 곳에 같은 검사를 두지 마십시오.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { STATIC } = require('../scripts/build-static.js');
const LIVE = STATIC.html.map((e) => e.file);

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** 인수인계 메모는 「화면이 말하는 것」이 아닙니다 — 걷고 봅니다(빌드도 걷습니다). */
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '');
/** 태그를 지우고 공백을 하나로 접습니다 — 줄바꿈·들여쓰기는 뜻이 아닙니다. */
const textOf = (h) => strip(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/* ══ 축 — 무엇을 부정해야 하는가 ═══════════════════════════════════════
 *
 * 🔴 한 축은 «전부 맞아야» 인정합니다(AND). 「보험 인수·지급 심사는 안 한다」만 적고
 *    가입 대행과 상품 추천을 빼면, 그 자리는 셋 중 하나를 말하다 만 것입니다.
 * ⚠️ 낱말이 아니라 **뜻**으로 잡되, 정규식이 감당할 만큼만 느슨하게 둡니다. 문장을
 *    바꿔 쓸 자유는 남기고(푸터·FAQ·목록이 서로 다르게 씁니다), 축이 사라지는 것만 막습니다.
 * ⚠️ 영문의 `’` 는 **U+2019** 입니다(en.html 이 그렇게 씁니다). 곧은 따옴표도 함께 받습니다.
 */
const AXES = {
  ko: [
    { key: '법률자문', re: [/법률 자문/, /(법률적 검토|계약서 검토)/, /제공하지 않/] },
    {
      key: '보험대행',
      re: [/인수·지급 심사/, /가입 대행/, /특정 상품(을)?\s*추천/, /하지 않/],
    },
    { key: '회수보장', re: [/미수금 회수를 보장하지 않/] },
  ],
  en: [
    { key: 'legal-advice', re: [/(don|doesn)[’']t provide legal advice/, /legal review of contracts/] },
    {
      key: 'insurance-agency',
      re: [
        /(don|doesn)[’']t underwrite insurance/,
        /apply for coverage on your behalf/,
        /recommend specific products/,
      ],
    },
    { key: 'no-recovery', re: [/(don|doesn)[’']t guarantee that receivables will be collected/] },
  ],
};

/* ══ 대상 — 「완전한 면책」을 표방하는 자리 ═══════════════════════════ */

/** 푸터의 「하지 않는 일」 한 문단. 안에 다른 `div` 가 없어 첫 닫기가 제 짝입니다. */
const pickNd = (html) => (strip(html).match(/<div class="nd">[\s\S]*?<\/div>/) || [])[0];

/** 회사 소개 02 블록. 안에 `b·ul·li·p` 뿐이라 같은 방식으로 집힙니다. */
const pickDeny = (html) => (strip(html).match(/<div class="deny">[\s\S]*?<\/div>/) || [])[0];

/**
 * FAQ 한 문항의 «답». 질문 글자로 찾습니다 — 순서에 기대면 문항이 하나 끼어들 때
 * 조용히 다른 답을 재게 됩니다. 질문 자체는 faq-structured-data 가 붙들고 있습니다.
 */
const pickFaq = (q) => (html) => {
  const re = new RegExp(
    '<details><summary>' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '</summary>\\s*<div class="a">([\\s\\S]*?)</div>'
  );
  const m = strip(html).match(re);
  return m && m[1];
};

/*
 * 🔴 **손으로 적는 표입니다** — 「완전한 면책을 표방하는가」는 파일 이름이나 클래스에서
 *    파생되지 않는 판단이라, 사람이 선언하고 아래 [대조] 가 그 선언이 살아 있는지 잽니다.
 * ⚠️ 새 페이지가 이 셋을 «전부» 말하기 시작하면 여기 한 줄을 더하십시오.
 *    ⛔ 부분 면책 자리는 더하지 마십시오(파일 머리주석 참조).
 */
const SURFACES = [
  { file: 'index.html', locale: 'ko', name: '랜딩 푸터 「TROPS가 하지 않는 일」', pick: pickNd },
  {
    file: 'index.html',
    locale: 'ko',
    name: '랜딩 FAQ 「가입을 대신해 줍니까」',
    pick: pickFaq('TROPS가 무역보험 가입을 대신해 줍니까?'),
  },
  { file: 'en.html', locale: 'en', name: '영문 랜딩 푸터 「What TROPS doesn’t do」', pick: pickNd },
  {
    file: 'en.html',
    locale: 'en',
    name: '영문 랜딩 FAQ 「apply … on my behalf」',
    pick: pickFaq('Does TROPS apply for trade insurance on my behalf?'),
  },
  { file: 'about.html', locale: 'ko', name: '회사 소개 02 「선을 긋는 영역」', pick: pickDeny },
];

/* ══ ① 선언한 자리가 실제로 있다 ═════════════════════════════════════ */

test('🔴 면책 자리가 전부 «집힌다» — 못 집으면 그 자리가 사라졌거나 구조가 바뀐 것이다', () => {
  /*
   * 🔴 이 검사가 첫째인 이유 — 아래 ② 는 「집힌 글자 안에 축이 있는가」를 봅니다.
   *    집기에 실패하면 ② 가 빈 문자열을 재며 **거짓 red** 를 내거나, 검출기를 느슨하게
   *    고치고 싶어집니다. 「없다」와 「못 찾았다」를 여기서 갈라 둡니다.
   */
  const missing = [];
  for (const s of SURFACES) {
    if (!LIVE.includes(s.file)) {
      missing.push(`${s.file}: 배포 목록에 없습니다 — 페이지를 내렸으면 SURFACES 에서도 빼십시오`);
      continue;
    }
    if (!s.pick(read(s.file))) missing.push(`${s.file} · ${s.name}: 블록을 찾지 못했습니다`);
  }
  assert.deepStrictEqual(missing, [], '면책 자리를 못 찾았습니다: ' + missing.join(' · '));
});

/* ══ ② 그 자리가 세 축을 «다» 든다 ═══════════════════════════════════ */

test('🔴 면책 자리마다 세 축이 모두 있다 — 하나가 빠지면 덜 부정한 문면이 된다', () => {
  const offenders = [];
  for (const s of SURFACES) {
    const body = textOf(s.pick(read(s.file)) || '');
    for (const axis of AXES[s.locale]) {
      const absent = axis.re.filter((r) => !r.test(body));
      if (absent.length) {
        offenders.push(
          `${s.file} · ${s.name}: 「${axis.key}」 축이 빕니다(못 찾은 것: ` +
            absent.map((r) => r.source).join(' , ') + ')'
        );
      }
    }
  }
  assert.deepStrictEqual(offenders, [], '면책 축이 빠졌습니다: ' + offenders.join(' · '));
});

/* ══ ③ 어느 페이지도 «반대»를 말하지 않는다 ══════════════════════════ */

/*
 * 🔴 여기부터는 **살아 있는 전 페이지**가 대상입니다. ② 는 「선언한 자리가 부정하는가」를
 *    보고, 이 축은 「다른 데서 그 부정을 뒤집지 않았는가」를 봅니다. 면책이 무너지는 길은
 *    둘인데(빼는 것 · 반대를 약속하는 것), ② 는 앞엣것만 막습니다.
 * ⚠️ 「하지 않습니다」를 «포함»하는 문장에 걸리지 않도록, 약속하는 어미만 집습니다.
 */
const PROMISES = [
  { key: '법률 자문 제공', re: /법률 자문[^.。]{0,20}?(제공합니다|해 드립니다|드립니다)/ },
  { key: '계약서 법률 검토 제공', re: /계약서[^.。]{0,24}?(법률적 )?검토(를 제공합니다|해 드립니다)/ },
  { key: '보험 가입 대행', re: /가입(을 )?대행(합니다|해 드립니다)/ },
  { key: '회수 보장', re: /회수를 보장(합니다|해 드립니다|해 드립니다\.)/ },
  { key: 'legal advice offered', re: /we provide legal advice/i },
  { key: 'apply on behalf', re: /we apply for (trade )?insurance on your behalf/i },
  { key: 'guarantee recovery', re: /we guarantee[^.]{0,40}(receivables|collected)/i },
];

test('🔴 살아 있는 어느 페이지도 면책의 «반대»를 약속하지 않는다', () => {
  const offenders = [];
  for (const file of LIVE) {
    /*
     * 🔴 **`<script>` 까지 봅니다.** 랜딩의 JSON-LD 가 FAQ 답변을 한 벌 더 들고 있어서,
     *    화면 글자만 보면 기계가 읽는 쪽에 들어온 약속을 놓칩니다.
     * ⚠️ 그래서 `textOf` 가 아니라 `strip` 층입니다(주석만 걷습니다).
     */
    const src = strip(read(file));
    for (const p of PROMISES) {
      if (p.re.test(src)) offenders.push(`${file}: 「${p.key}」`);
    }
  }
  assert.deepStrictEqual(offenders, [],
    '면책과 반대되는 약속이 있습니다 — 방침을 먼저 고치십시오: ' + offenders.join(' · '));
});

/* ══ ④ [대조] 검출기가 실제로 문다 ═══════════════════════════════════ */

test('[대조] 대상이 0건이 아니고 두 언어를 다 본다 — 빈 목록은 조용한 초록이다', () => {
  assert.ok(SURFACES.length >= 5, `면책 자리를 ${SURFACES.length}곳만 선언했습니다`);
  for (const locale of ['ko', 'en']) {
    assert.ok(
      SURFACES.some((s) => s.locale === locale),
      `${locale} 자리가 0곳입니다 — AXES.${locale} 이 한 번도 쓰이지 않습니다`
    );
    assert.strictEqual(AXES[locale].length, 3, `${locale} 축이 3개가 아닙니다`);
  }
  assert.ok(LIVE.length >= 8, `배포 페이지를 ${LIVE.length}장만 찾았습니다 — ③ 이 헛돕니다`);
});

test('[대조] 축 검출기가 «빠진 것»을 실제로 잡는다', () => {
  const full =
    '법률 자문과 계약서에 대한 법률적 검토를 제공하지 않습니다. ' +
    '보험 인수·지급 심사나 가입 대행, 특정 상품 추천을 하지 않으며 ' +
    '미수금 회수를 보장하지 않습니다.';
  const ok = (body) => AXES.ko.every((a) => a.re.every((r) => r.test(body)));

  assert.ok(ok(full), '온전한 문면이 통과하지 못합니다 — 검출기가 너무 빡빡합니다');
  // 축 하나씩 걷어내면 반드시 red 여야 합니다.
  assert.ok(!ok(full.replace('미수금 회수를 보장하지 않습니다.', '')), '회수 축이 빠져도 통과합니다');
  assert.ok(!ok(full.replace('가입 대행, ', '')), '가입 대행이 빠져도 통과합니다');
  assert.ok(!ok(full.replace('특정 상품 추천을 ', '')), '상품 추천이 빠져도 통과합니다');
  // 조사가 붙은 꼴(「특정 상품을 추천」 — FAQ 가 그렇게 씁니다)도 인정해야 합니다.
  assert.ok(ok(full.replace('특정 상품 추천을 하지 않으며', '특정 상품을 추천하지 않으며')),
    '조사가 붙은 꼴을 못 잡습니다 — FAQ 문면이 그것입니다');
  assert.ok(!ok(full.replace(/법률 자문[^.]*\. /, '')), '법률 자문 축이 빠져도 통과합니다');

  const fullEn =
    'We don’t provide legal advice or legal review of contracts. ' +
    'We don’t underwrite insurance, review claims, apply for coverage on your behalf ' +
    'or recommend specific products. ' +
    'We don’t guarantee that receivables will be collected.';
  const okEn = (b) => AXES.en.every((a) => a.re.every((r) => r.test(b)));
  assert.ok(okEn(fullEn), '영문 온전한 문면이 통과하지 못합니다');
  assert.ok(!okEn(fullEn.replace('or recommend specific products. ', '')), '영문 상품 추천이 빠져도 통과합니다');
  // 주어가 TROPS 일 때는 `doesn’t` 입니다 — FAQ 답변이 그 꼴입니다.
  assert.ok(okEn(fullEn.replace(/We don’t/g, 'TROPS doesn’t')), '영문 doesn’t 꼴을 못 잡습니다');
});

test('[대조] 반대 약속 검출기가 실제로 문다', () => {
  const bites = (s) => PROMISES.some((p) => p.re.test(s));
  assert.ok(bites('TROPS가 법률 자문을 제공합니다.'), '법률 자문 약속을 못 잡습니다');
  assert.ok(bites('보험 가입을 대행해 드립니다.'), '가입 대행 약속을 못 잡습니다');
  assert.ok(bites('미수금 회수를 보장합니다.'), '회수 보장 약속을 못 잡습니다');
  assert.ok(bites('We provide legal advice for your contracts.'), '영문 약속을 못 잡습니다');

  // 부정문에는 물면 안 됩니다 — 물면 라이브 다섯 자리가 전부 red 가 됩니다.
  assert.ok(!bites('법률 자문과 계약서에 대한 법률적 검토를 제공하지 않습니다.'), '부정문을 잘못 잡습니다');
  assert.ok(!bites('보험 인수·지급 심사나 가입 대행을 하지 않으며'), '부정문을 잘못 잡습니다');
  assert.ok(!bites('미수금 회수를 보장하지 않습니다.'), '부정문을 잘못 잡습니다');
  assert.ok(!bites('We don’t guarantee that receivables will be collected.'), '영문 부정문을 잘못 잡습니다');
});
