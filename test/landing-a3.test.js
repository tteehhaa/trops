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
