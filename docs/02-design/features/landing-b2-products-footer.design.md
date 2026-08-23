# Design — landing-b2-products-footer (PRD v2.1 · B2)

| 항목 | 내용 |
|---|---|
| Plan | `docs/01-plan/features/landing-b2-products-footer.plan.md` |
| 작성일 | 2026-08-23 |

## Context Anchor

| 축 | 내용 |
|---|---|
| **WHY** | 랜딩 상품 3종이 앱 실물과 다르고 증권 관리가 부재 (PRD §1). |
| **WHO** | 중소·중견 수출기업 + 토스 결제 심사자. |
| **RISK** | 가격·결제 diff 1줄 = fail · 기존 검사 3종이 옛 탭명을 못질 · P-3 「알려드립니다」 금지. |
| **SUCCESS** | 절대 조건 6개 + 검사 green + ≥ 90. |
| **SCOPE** | 정적 문구·링크·푸터. B3 영역 불가침. Supabase 무변경. |

## 1. Overview

**문구 이식 배치**입니다. PRD §5 의 확정 문구를 한 글자도 바꾸지 않고 마크업에 옮깁니다. 새 로직·새 라우트·새 의존성이 없습니다.

## 2. Architecture Options

| | A. 탭 3개를 새로 짜기 | B. 기존 탭 골격에 내용만 이식 | C. B + 게이트 스크립트 + solo 레이아웃 |
|---|---|---|---|
| 마크업 위험 | 높음 — `role="tab"`/`aria-controls` 짝, 4열 규칙, JS `querySelectorAll('[role=tab]')` 를 전부 다시 맞춰야 함 | 낮음 — id·ARIA·JS 계약 유지 | 낮음 |
| 기존 검사 | 다수 재작성 | 탭명 기대값만 갱신 | 〃 |
| AC-1 보증 | 사람 눈 | 사람 눈 | **기계 검증** |
| figure 없는 패널 | — | 본문이 절반 폭에 갇힘 | `.is-solo` 로 해결 |
| 공수 | 3시간+ | 1.5시간 | 1.8시간 |

**선택: C.** 탭 수가 3에서 3으로 그대로이므로 골격을 새로 짤 이유가 없습니다. `id="feat-buyer"`/`feat-buyer-panel` 같은 **식별자만 새 상품에 맞게 바꾸고 내용을 이식**하면 ARIA 짝·JS 순회·4열 규칙이 전부 유지됩니다. AC-1 은 B1 과 같은 이유로 기계화합니다.

## 3. 탭 매핑

| 자리 | 전 | 후 | 처리 |
|---|---|---|---|
| 탭 ① | `feat-precheck` 수출 사전점검 | **변경 없음** | B3 |
| 탭 ② | `feat-buyer` 바이어 확인 | `feat-contract` **수출 계약관리** | §5-2 원문 · CTA `https://app.trops.kr/procedures/new` · figure 주석+TODO |
| 탭 ③ | `feat-timeline` 기한 관리 | `feat-policy` **수출 채권·보험관리** | §5-3 원문 · CTA `https://app.trops.kr/profile/insurance` · `timeline-map.jpg` 유지 + §5-17 캡션 |

`.feat-meta`(생애주기 축)는 §5-2/§5-3 첫 줄을 그대로 씁니다 — 「계약 체결 단계」·「이행 및 사후관리 단계」.

## 4. 보호 구간 (AC-1) — B1 과 동일 정의

`scripts/check-b2-gates.js` G1 이 `git show <base>:<file>` 과 작업본에서 ① `plan-price`\|`pay-summary-value`\|`pay-vat`\|`₩330,000` 포함 줄, ② `<div class="pay-area"` → `id="intake-submit"` 블록을 뽑아 **바이트 비교**합니다. base 기본값은 B2 시작 커밋입니다.

## 5. 푸터 서비스명 — 국문/영문 분리

PRD §6-2 는 한 줄로 적었지만 영문 7개 파일은 **영문 이름**을 씁니다(`Export pre-check · Buyer check · Deadline tracking`). 영문 푸터에 국문을 넣으면 회귀이므로:

| 언어 | 전 | 후 |
|---|---|---|
| 국문 7 | 수출 사전점검 · 바이어 확인 · 기한 관리 | **수출 사전점검 · 수출 계약관리 · 수출 채권관리** |
| 영문 7 | Export pre-check · Buyer check · Deadline tracking | **Export pre-check · Export contract management · Export receivables management** |

국문 7 = `index`·`uae`·`nda`·`refund`·`precheck`·`check` + **`privacy`**(PRD 누락분). 게이트는 양쪽을 각각 단정하고 구 문자열 0건을 봅니다.

## 6. FAQ 재구성

현행 4그룹 11문항 → §5-8 의 **3그룹 12문항**. `qa-N` id 는 1..12 로 다시 매깁니다(아코디언 JS 는 `aria-controls` 로 짝을 찾으므로 번호 자체에 의미는 없습니다). `.qgroup`/`.qitem`/`.qbtn`/`.qans` 구조와 `qchev` SVG 는 그대로 재사용합니다.

## 7. Error Handling

- 게이트는 `git show` 실패·블록 경계 소실 시 명시 실패.
- 링크 게이트는 **정확한 절대 URL 문자열**을 봅니다 — 경로만 바뀌어도 잡힙니다.

## 8. Security / Data

변경 없음. Supabase 스키마·데이터·`api/` 무변경. 폼 필드명(`name`/`email`/`inquiry`/`company`/`consentPrivacy`/`consentMarketing`)은 `api/leads.js` 계약이므로 **유지**합니다 — §5-9 는 라벨 문구만 바꿉니다.

## 9. Test Plan

| L | 항목 |
|---|---|
| L1 | `npm test` 전량 green |
| L2 | `node scripts/check-b2-gates.js` G1~G6 PASS |
| L3 | `npm run build` 성공 |
| L4 | 배포 후 `/precheck` 결제 · 상품 ②③ CTA · `/check` 서류없음 분기 실측 |

## 10. Implementation Guide

1. `scripts/check-b2-gates.js` 신설 → baseline
2. 푸터 14개 파일 전수 치환 (B2-5)
3. `index.html` 탭 ②③ 교체 (B2-1·2·3·4·10) + `.is-solo` CSS
4. `index.html` 기관안내·FAQ·문의·푸터 (B2-6·7·8)
5. `en.html` 대응 (영문 이식)
6. `check.html` CTA (B2-9)
7. 테스트 기대값 갱신 (B2-11)
8. `npm test` + 게이트 + build
