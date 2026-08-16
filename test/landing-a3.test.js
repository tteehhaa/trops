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
 * 🔴 **아래 두 테스트를 제거했습니다** 〔2026-08-16 · v-next 전면교체〕. A3 §5 가
 * 못질하던 .rm-diff(구분 문구)를 이번 전면교체로 완전히 걷어냈습니다 — 로드맵
 * 두 행이 기존 3상품명 중 두 개를 재사용하는 쪽으로 바뀌면서, "지금 파는 상품과
 * 무엇이 다른가"를 별도 문장으로 설명할 필요가 없어졌습니다(이름 자체가 그 상품의
 * 확장분임을 말합니다). 새 로드맵 행 구조(이름 + .rm-desc 2문장 + 「준비 중」 배지)는
 * test/naming-consistency.test.js 「로드맵 두 행이 기존 상품명을 재사용하고
 * 「준비 중」 배지를 갖는다」가 검사합니다.
 */

/* ── A3 §6 · 법률자문 오인 재프레이밍 ────────────────────────────────────────
 *
 * 🔴 **아래 두 테스트를 제거했습니다** 〔2026-08-16 · v-next 전면교체〕. A3 §6 이
 * 지정했던 재프레이밍 문장("전문가를 찾으시기 전에…")을 안심문구·QnA 두 곳에서
 * 모두 삭제했습니다(대표 확정 변화). 대신 그 문장이 실제로 사라졌는지를
 * 아래에서 확인합니다.
 */
test('A3 §6 재프레이밍 문장이 안심문구·QnA 두 곳 모두에서 삭제됐다', () => {
  const body = M.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  assert.ok(body.indexOf('전문가를 찾으시기 전에') === -1,
    '재프레이밍 문장이 아직 남아 있습니다 — v-next 전면교체로 삭제된 문장입니다');
});
