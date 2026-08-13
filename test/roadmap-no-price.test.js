/*
 * 로드맵(준비 중인 것)에 가격·오픈월을 적지 않는다 〔신설 2026-08-13 · 대표 결정〕
 *
 *   npm test        (node --test test/)
 *
 * ── 왜 있는가 ───────────────────────────────────────────────────────────────
 * 「확인 항목 요약 자료」 행이 **「99,000원 · 9월 오픈 예정」** 이었다. 두 가지가 동시에
 * 문제였다:
 *
 * ① **없는 가격을 적고 있었다.** 이 모듈은 실체(무엇을 담는 자료인가)가 결정되지 않았다.
 *    정확한 가격이 있을 수 없는 단계인데 화면에 숫자가 서 있었다.
 * ② **역앵커였다.** 옆에서 실제로 파는 수출 사전점검이 ₩300,000 인데 준비 중인 항목이
 *    99,000원으로 **더 싸 보였다** — 「기다리면 싸게 사는 것이 나온다」로 읽히는 배치다.
 *    판매가가 ₩99,000 이던 동안에는 두 값이 같아 이 문제가 보이지 않았고, 판매가를 올린
 *    2026-08-13 에 드러났다. 즉 **판매가를 다시 움직일 때 이 자리를 함께 봐야 한다.**
 *
 * 그래서 두 행 모두 「가격 미정 · 준비중」(en: Pricing to follow · Coming soon)이다.
 *
 * ⛔ 이 검사를 지우고 금액을 되돌리지 마십시오. 실체와 가격이 확정되면 **그때 결정
 *    사안으로 올리십시오** — 그 시점에는 이 파일도 함께 고치는 것이 맞습니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** 주석 없는 마크업 — 이 저장소는 주석에 옛 문자열을 인용한다(그대로 두면 전부 오탐). */
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

/** `#next` 섹션 블록만 잘라낸다. */
function roadmap(file) {
  const m = strip(read(file));
  const start = m.indexOf('id="next"');
  assert.ok(start !== -1, file + ' 에 로드맵 섹션(#next)이 없습니다');
  return m.slice(start, m.indexOf('</section>', start));
}

const KO = roadmap('index.html');
const EN = roadmap('en.html');

test('국문 로드맵 두 행이 「가격 미정 · 준비중」이다', () => {
  const metas = (KO.match(/<p class="rm-meta">([^<]*)<\/p>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').trim());

  assert.strictEqual(metas.length, 2, '로드맵 행이 ' + metas.length + '개입니다');
  assert.deepStrictEqual(metas, ['가격 미정 · 준비중', '가격 미정 · 준비중'],
    '로드맵 표기가 바뀌었습니다: ' + JSON.stringify(metas));
});

test('영문 로드맵 두 행이 같은 뜻으로 맞춰져 있다', () => {
  const metas = (EN.match(/<p class="rm-meta">([^<]*)<\/p>/g) || [])
    .map((s) => s.replace(/<[^>]*>/g, '').trim());

  assert.strictEqual(metas.length, 2, '영문 로드맵 행이 ' + metas.length + '개입니다');
  assert.deepStrictEqual(metas, ['Pricing to follow · Coming soon', 'Pricing to follow · Coming soon'],
    '영문 로드맵 표기가 국문과 갈렸습니다: ' + JSON.stringify(metas));
});

test('🔴 로드맵에 금액이 없다 — 파는 상품의 역앵커를 만들지 않는다', () => {
  for (const [file, block] of [['index.html', KO], ['en.html', EN]]) {
    // 원화 표기·세 자리 구분 숫자·「원」 접미 전부를 봅니다. 하나만 보면 다른 형태로 돌아옵니다.
    const hits = block.match(/₩\s?[\d,]+|[\d]{2,3},[\d]{3}\s?원?|\bKRW\b/g) || [];
    assert.deepStrictEqual(hits, [],
      file + ' 로드맵에 금액 표기가 있습니다: ' + JSON.stringify(hits) +
      ' — 준비 중인 항목의 가격이 파는 상품(₩300,000)의 역앵커가 됩니다');
  }
});

test('🔴 로드맵에 오픈 시점이 없다 — 실체가 정해지지 않은 것에 날짜를 약속하지 않는다', () => {
  assert.ok(!/\d+월 오픈|\d+월 공개|\d+월 예정/.test(KO),
    '국문 로드맵에 오픈월이 있습니다 — 실체가 결정되지 않은 모듈에 시점을 약속합니다');
  assert.ok(!/Opens? (January|February|March|April|May|June|July|August|September|October|November|December)/.test(EN),
    '영문 로드맵에 오픈월이 있습니다');
});

test('리드 문장이 「가격을 적어둔다」고 말하지 않는다 — 화면이 하지 않는 약속', () => {
  /*
   * 리드와 .rm-meta 는 한 묶음입니다. 종전 리드는 「오픈 시점과 가격을 함께 적어둡니다」
   * 였고, 표기를 「미정」으로 바꾼 뒤에도 리드가 남으면 **리드가 거짓말이 됩니다.**
   */
  const lead = (KO.match(/<p class="rm-lead">([^<]*)<\/p>/) || [])[1] || '';
  assert.ok(lead.length > 0, '국문 리드를 찾지 못했습니다');
  assert.ok(!/가격/.test(lead), '리드가 아직 가격 표기를 약속합니다: ' + lead);

  const enLead = (EN.match(/<p class="rm-lead">([^<]*)<\/p>/) || [])[1] || '';
  assert.ok(enLead.length > 0, '영문 리드를 찾지 못했습니다');
  assert.ok(!/price/i.test(enLead), '영문 리드가 아직 가격 표기를 약속합니다: ' + enLead);
});

test('🔴 폐기된 정가(290,000)가 어느 페이지에도 없다', () => {
  /*
   * verify-deployment.js 「R1-비교표기」가 배포본을 보지만, 그것은 **배포 후**입니다.
   * 여기서 소스를 함께 보아 커밋 전에 잡습니다 — 두 검사의 시점이 다릅니다.
   */
  const files = ['index.html', 'en.html', 'nda.html', 'precheck.html', 'refund.html',
    'uae.html', 'privacy.html', 'en-privacy.html'];
  for (const f of files) {
    const body = strip(read(f)).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/290,000|290000/.test(body), f + ' 에 폐기된 정가가 렌더됩니다');
    assert.ok(!/정가|런칭가/.test(body), f + ' 에 「정가」·「런칭가」 표기가 있습니다');
  }
});

test('🔴 폐기된 정가가 브라우저로 내려가지 않는다 — 응답에서 뺐다', () => {
  const cfg = read('api/payment-config.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/listPrice\s*:/.test(cfg),
    'payment-config 응답에 listPrice 가 되살아났습니다 — 폐기된 정가가 브라우저까지 갑니다');

  // 값 자체는 남아 있어야 합니다 — 대장(trops_a cross-repo-values.ts)이 가리키는 사본 좌표입니다.
  const payment = require('../api/_payment.js');
  assert.strictEqual(payment.LIST_PRICE, 290000,
    'LIST_PRICE 상수가 사라졌습니다 — 지우면 옆 저장소 드리프트 검출이 조용히 죽습니다');
});
