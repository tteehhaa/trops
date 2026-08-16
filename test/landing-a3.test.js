/*
 * 랜딩 A3 구조 정리 테스트
 *   〔신설 2026-08-16 · docs/a3/trops_A3_최종구조_정리.md〕
 *
 *   npm test        (node --test test/)
 *
 * A3 의 결정 중 **다른 파일이 세지 않는 것**만 여기서 셉니다. 겹치는 것은 그쪽에
 * 그대로 둡니다 — 섹션 순서·배경 교차는 test/landing-order-s9.test.js, QnA 문항 수는
 * test/landing-emphasis-s10.test.js, 안심문구 위치와 상품명 문면은
 * test/naming-consistency.test.js 입니다.
 *
 * ⚠️ 모든 검사는 **주석을 걷어낸 마크업**에 대해 합니다(이 저장소의 공통 규칙 —
 *    주석을 인수인계 수단으로 쓰고 빌드가 떼어냅니다).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
/** 주석 없는 마크업. */
const M = RAW.replace(/<!--[\s\S]*?-->/g, '');

const texts = (re) => [...M.matchAll(re)].map((m) => m[1].trim());

/* ── A3 §5 · 로드맵 두 항목 각 2줄 ──────────────────────────────────────────
 *
 * A3 §5 원문: 「「확인 항목 대조표」·「거래 운영」 설명을 각 2줄로 축소. 현재는
 * 팔 수 없는(준비중) 상품 설명이 파는 상품 설명보다 긴 상태.」
 *
 * 한 항목의 「설명」은 두 문단입니다 — .rm-desc(무엇인가) + .rm-diff(파는 상품과
 * 무엇이 다른가). 1280px 실측:
 *     종전  .rm-desc 1줄 + .rm-diff 3줄(96자·89자) = 4줄
 *     지금  .rm-desc 1줄 + .rm-diff 1줄(45자·45자) = 2줄
 *
 * 줄 수는 브라우저 없이 셀 수 없으므로 **글자 수 상한**으로 대신 못질합니다. 상한은
 * 실측으로 잡았습니다 — .rm-diff(52ch/14.5px)는 1280px 에서 45자까지 한 줄이고
 * 46자부터 접힙니다. .rm-desc 는 44ch/16.5px 에 30자·36자로 한 줄입니다.
 *
 * ⛔ 검사가 걸린다고 아래 숫자를 올리지 마십시오. 올리는 순간 항목이 3줄이 되고
 *    A3 §5 가 깨집니다. 폭이나 글꼴이 바뀌어 상한 자체가 달라졌다면 **다시 재서**
 *    이 주석의 실측값과 함께 고치십시오.
 */
const RM_DIFF_MAX = 45;
const RM_DESC_MAX = 40;

test('A3 §5 로드맵 두 항목이 각 2줄이다 — 준비중이 파는 것보다 말이 많지 않다', () => {
  const desc = texts(/<p class="rm-desc">([\s\S]*?)<\/p>/g);
  const diff = texts(/<p class="rm-diff">([\s\S]*?)<\/p>/g);

  assert.strictEqual(desc.length, 2, '로드맵 설명(.rm-desc)이 2개가 아닙니다');
  assert.strictEqual(diff.length, 2, '로드맵 구분 문구(.rm-diff)가 2개가 아닙니다');

  for (const [i, t] of desc.entries()) {
    assert.ok(t.length <= RM_DESC_MAX,
      `로드맵 0${i + 1} .rm-desc 가 ${t.length}자입니다 — ${RM_DESC_MAX}자를 넘으면 한 줄에 ` +
      '들어가지 않아 항목이 3줄이 됩니다(A3 §5 「각 2줄」)');
  }
  for (const [i, t] of diff.entries()) {
    assert.ok(t.length <= RM_DIFF_MAX,
      `로드맵 0${i + 1} .rm-diff 가 ${t.length}자입니다 — 1280px 에서 ${RM_DIFF_MAX}자까지가 ` +
      '한 줄이고, 넘으면 항목이 3줄이 됩니다(A3 §5 「각 2줄」)');
  }
});

/*
 * 줄인 뒤에도 **가르는 축**이 남아 있어야 합니다. 두 항목이 존재하는 이유가 「지금
 * 파는 상품과 무엇이 다른가」이고, 그 구절이 사라지면 준비중 항목이 파는 상품의
 * 유료판처럼 읽힙니다(2026-08-13 신설 사유).
 *
 * 문면 자체(「「수출 사전점검」과는 다른 상품입니다」·「「기한 관리」의 확장판입니다」)는
 * test/naming-consistency.test.js 가 이미 셉니다 — 여기서는 **줄이는 과정에서 뒷문장이
 * 통째로 날아가지 않았는지**만 봅니다.
 */
test('A3 §5 로 줄이면서 구분 문구의 뒷받침 문장이 남아 있다', () => {
  const diff = texts(/<p class="rm-diff">([\s\S]*?)<\/p>/g);
  for (const [i, t] of diff.entries()) {
    const sentences = t.split('.').map((s) => s.trim()).filter(Boolean);
    assert.ok(sentences.length >= 2,
      `로드맵 0${i + 1} 구분 문구가 한 문장뿐입니다 — 「무엇과 다른가」만 남고 ` +
      '「어떻게 다른가」가 사라지면 줄인 것이 아니라 뜻을 지운 것입니다');
  }
});

/* ── A3 §6 · 법률자문 오인 재프레이밍 ────────────────────────────────────────
 *
 * ⚠️⚠️ **[초안-대표확인필요]** — 아래 두 검사가 지키는 문장은 **승인 전 초안**입니다.
 *      A3 §6 이 「최종 문구는 2단계(마케팅팀 원칙) 작업」이라고 못 박아 뒀습니다.
 *
 * 그래서 이 검사들은 **문면을 하드코딩하지 않습니다.** 두 자리에 같은 문장이 있는지,
 * 그 문장이 금지 규칙을 지키는지만 봅니다 — 2단계에서 문구가 통째로 바뀌어도 이
 * 파일은 고칠 것이 없고, 한쪽만 고치면 그때 걸립니다. 그것이 이 검사의 존재 이유입니다.
 * ⛔ 초안이 기각돼 두 줄을 **걷어내기로** 결정되면, 그때는 아래 두 test 도 함께
 *    지우십시오 — 문장이 사라지면 이 검사는 뜻 없이 실패합니다.
 *
 * 왜 두 자리인가(A3 §6): 안심문구 섹션은 CTA 를 보고 **누르지 않은 사람**에게,
 * QnA「법률 자문인가요」는 「아닙니다」로 끊긴 답을 닫는 데 같은 말이 필요합니다.
 */
const between = (re, what) => {
  const m = M.match(re);
  assert.ok(m, `${what} 를 찾지 못했습니다`);
  return [...m[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((x) => x[1].trim());
};

test('A3 §6 재프레이밍 한 줄이 안심문구·QnA 두 곳에 같은 문장으로 있다', () => {
  const assure = between(/<div class="assure-lines">([\s\S]*?)<\/div>/, '안심문구 본문(.assure-lines)');
  const qa12 = between(/<div class="qans" id="qa-12">([\s\S]*?)<\/div>/, 'QnA 「법률 자문인가요」(#qa-12)');

  assert.strictEqual(assure.length, 3,
    `안심문구 본문이 ${assure.length}줄입니다 — 재프레이밍 한 줄을 더해 3줄이어야 합니다(A3 §6)`);
  assert.strictEqual(qa12.length, 2,
    `#qa-12 답변이 ${qa12.length}줄입니다 — 「아닙니다…」 뒤에 재프레이밍 한 줄이 붙어 2줄이어야 합니다(A3 §6)`);

  assert.strictEqual(assure.at(-1), qa12.at(-1),
    '안심문구와 #qa-12 의 재프레이밍 문장이 서로 다릅니다 — A3 §6 은 두 자리에 ' +
    '**같은 문장**을 지정했습니다. 한쪽만 고치면 같은 방어선이 두 가지 말을 합니다');
});

test('A3 §6 재프레이밍 문장이 금지 규칙을 지킨다', () => {
  const assure = between(/<div class="assure-lines">([\s\S]*?)<\/div>/, '안심문구 본문(.assure-lines)');
  const line = assure.at(-1);

  /* 금지 동사 5 — v4.0 정본 §0-4. 「이 서비스가 판단한다」로 읽히는 낱말들입니다. */
  for (const w of ['자문', '판단', '검토', '평가', '진단']) {
    assert.ok(!line.includes(w),
      `재프레이밍 문장에 금지 동사 「${w}」가 있습니다(정본 §0-4)`);
  }
  /* 「상담」 — 유상 자문 오인 이력으로 헤더·CTA·QnA 어디에도 쓰지 않기로 한 낱말입니다.
     A3 §6 원문(「전문가 상담이 더 빠르고 저렴해짐」)을 그대로 옮길 수 없던 이유입니다. */
  assert.ok(!line.includes('상담'),
    '재프레이밍 문장에 「상담」이 있습니다 — 유상 자문 오인 이력으로 금지된 낱말입니다(정본 §0-4)');
  /* 숫자가 들어오는 순간 「얼마나 빨라지는지·싸지는지」를 약속하게 됩니다. 남의 수임료가
     얼마나 줄어드는지는 재본 적이 없는 값이고, 성능수치·가격 노출 금지에 걸립니다. */
  assert.ok(!/\d/.test(line),
    '재프레이밍 문장에 숫자가 있습니다 — 성능수치·가격 노출 금지(정본 §0-2)');
});
