# Design — landing-b3a-basis-pricing (PRD v2.1 · B3-a)

| 항목 | 내용 |
|---|---|
| Plan | `docs/01-plan/features/landing-b3a-basis-pricing.plan.md` |
| 작성일 | 2026-08-23 |

## Context Anchor

| 축 | 내용 |
|---|---|
| **WHY** | 근거·과금·로드맵·서사가 상품 3종 개편을 못 따라왔습니다. |
| **WHO** | 랜딩 방문자 + 토스 결제 심사자. |
| **RISK** | 가격·결제 diff 1줄 = fail · 배경 교차 불변식 · 「사전 점검 리포트」 0건. |
| **SUCCESS** | 필수 조건 6개 + 검사 green + ≥ 90. |
| **SCOPE** | 정적 문구·이미지·배경 클래스. B3-b 불가침. Supabase 무변경. |

## 1. Overview

문구 이식 + 이미지 경로 고정입니다. 새 로직·새 라우트·새 의존성이 없습니다. 유일한 구조 변경은 **섹션 하나 신설**과 그로 인한 **배경 클래스 연쇄**입니다.

## 2. Architecture Options

| | A. 무료·유료를 맨 끝에 | B. 상품소개 뒤 + 배경 연쇄 | C. 상품소개 안에 블록으로 |
|---|---|---|---|
| 정보 구조 | 나쁨 — 기관 안내 뒤에 과금이 옵니다 | **좋음** — 3종 바로 뒤에서 값을 말합니다 | 보통 — 섹션이 아니라 카드 꼬리표가 됩니다 |
| 배경 교차(O7) | 연쇄 0 | 하류 5곳 `sec-surface` 뒤집기 | 연쇄 0 |
| 지시 부합 | △ | **○ 「섹션 신설」** | ✗ 섹션이 아님 |
| 위험 | 낮음 | 낮음(클래스만 이동) | 낮음 |

**선택: B.** 배경이 완전 교차(bg↔surface)라 어디에 끼워도 하류가 뒤집힙니다 — 이것은 회피할 수 있는 비용이 아니라 이 페이지 규칙의 대가입니다. **문구는 하나도 건드리지 않고 `sec-surface` 클래스만** 로드맵·FAQ·마감CTA·사전등록폼·기관안내에서 옮깁니다. `test/landing-order-s9.test.js` 의 `LAYOUT` 표가 새 순서·배경의 단일 정본입니다.

새 배경 순서:

```
상품소개(bg) → 무료·유료(surface) → 로드맵(bg) → FAQ(surface)
             → 마감CTA(bg) → 사전등록폼(surface) → 기관안내(bg) → 푸터(dark)
```

## 3. 이미지 계약

| 파일 | 출처 | 크기 |
|---|---|---|
| `assets/img/precheck-report.jpg` | `img/c03-result.jpg` 리캔버스 | 1600×1000 |
| `assets/img/contract-list.jpg` | 플레이스홀더 「예시 화면 준비 중」 | 1600×1000 |
| `assets/img/policy-deadlines.jpg` | `img/timeline-map.jpg` 리캔버스 | 1600×1000 |

마크업은 `width="1600" height="1000"` 을 박아 둡니다. **같은 파일명·같은 비율로 덮어쓰면 코드 수정 없이 교체**됩니다 — 그것이 이 작업의 목적이므로 비율을 바꾸는 교체는 금지입니다(게이트 G4 가 셋의 비율이 같은지 봅니다).

`img/` 의 원본 3장은 **지우지 않습니다**. `buyer-doc.jpg` 와 같은 이유이고, 리캔버스가 잘못됐을 때 되돌릴 자리입니다.

## 4. 보호 구간 (AC-1) — B1·B2 와 같은 정의

`scripts/check-b3a-gates.js` G1 이 `git show <base>:<file>` 과 작업본에서 ① `plan-price`\|`pay-summary-value`\|`pay-vat`\|`₩330,000` 포함 줄 ② `<div class="pay-area"` → `id="intake-submit"` 블록을 뽑아 바이트 비교합니다.

## 5. B2 게이트 G6 조정

B2 의 G6 은 「근거 섹션」과 「상품 탭 ①」을 통째로 못질했습니다. 이번 배치가 둘 다 **정당하게** 바꿉니다:

| 가드 | 조치 |
|---|---|
| 근거 섹션 | **제거** — B3-a 의 대상입니다. `check-b3a-gates.js` G2 가 §5-12 내용을 대신 지킵니다 |
| 상품 탭 ① | **문구 부분으로 축소** — `id="feat-precheck-panel"` → `<figure` 직전까지. 그림·캡션은 이번 배치가 바꿉니다 |
| 히어로 · HOW | 그대로 |

⛔ 조용히 지우지 않고 사유를 주석으로 남깁니다.

## 6. FAQ 「결과물의 성격」 3문항 — 출처 없음

PRD 어디에도 없고 저장소 전체에도 없습니다. **직접 작성하되 새 주장을 만들지 않습니다** — 세 답변이 각각 이미 확정된 문구에서만 나옵니다:

| 문항 | 근거 |
|---|---|
| 무엇을 받게 되는가 | §5-13 무료·유료 목록 · §8-1 결정 1(「사전 점검 리포트」) |
| 법적 효력이 있는가 | §5-16 법적 고지 · 기존 `.assure-note` |
| 내용을 어떻게 확인하는가 | §5-12 근거 규정·확인 기준일 |

**승인이 필요한 항목으로 보고서에 표시합니다.**

## 7. Error Handling

- 게이트는 `git show` 실패·블록 경계 소실·이미지 부재 시 명시 실패.
- 이미지 비율은 JPEG 헤더를 직접 읽어 비교합니다(의존성 추가 없이).

## 8. Security / Data

변경 없음. Supabase·`api/` 무변경.

## 9. Test Plan

| L | 항목 |
|---|---|
| L1 | `npm test` 전량 green |
| L2 | `check-b3a-gates.js` G1~G6 · `check-b2-gates.js` · `check-b1-gates.js` |
| L3 | `npm run build` 성공 |
| L4 | 배포 후 `/precheck` 결제 · 근거·무료유료 렌더 실측 |

## 10. Implementation Guide

1. 게이트 신설 → baseline
2. 이미지 3장 (완료)
3. `index.html`: 스토리 → 근거 → 중간CTA → 탭 figure → 무료·유료 신설 → 로드맵 → FAQ → 배경 연쇄
4. `en.html` 대응
5. `docs/` 「사전 점검 리포트」 치환
6. 테스트 기대값 갱신 (`LAYOUT` 표 포함)
7. `npm test` + 게이트 + build
