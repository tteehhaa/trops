# Design — landing-b1-facts-freecopy (PRD v2.1 · B1)

| 항목 | 내용 |
|---|---|
| Plan | `docs/01-plan/features/landing-b1-facts-freecopy.plan.md` |
| 작성일 | 2026-08-23 |

## Context Anchor

| 축 | 내용 |
|---|---|
| **WHY** | 랜딩의 사실 오류 2건 + 종료된 무상 제공 문구 제거 (PRD §1). |
| **WHO** | 랜딩 방문자 + **토스 결제 심사자**. |
| **RISK** | 가격·결제 diff 1줄 = fail. `#slots-badge` 엘리먼트/`.plans` 2겹 잠금 훼손 = 접수 정지. |
| **SUCCESS** | 절대 조건 5개 + 기존 검사 green + Match Rate ≥ 90. |
| **SCOPE** | 정적 문구 · 설정 1값 · 테스트 3파일 · 문서 문자열. Supabase 무변경. |

## 1. Overview

문구 치환 배치입니다. 실행 로직은 **한 줄도** 바뀌지 않습니다 — 바뀌는 것은 (a) HTML 텍스트 노드와 주석, (b) `site.config.json` 의 숫자 한 개, (c) 그 두 가지를 못질하는 테스트 기대값입니다.

## 2. Architecture Options

| | A. 문구만 최소 치환 | B. 슬롯 UI 전면 제거 | C. 최소 치환 + 게이트 스크립트 신설 |
|---|---|---|---|
| 변경 범위 | HTML 텍스트만 | HTML + CSS + JS + 상태머신 | HTML 텍스트 + `scripts/check-b1-gates.js` |
| 접수 정지 위험 | 낮음 | **높음** (`setSlotText` 대입 실패 → `lockFreePlan` 중단) | 낮음 |
| AC-1 보증 | 사람 눈 | 사람 눈 | **기계 검증 (HEAD 대비 보호구간 바이트 비교)** |
| 회귀 방지 | 테스트 1건 | 테스트 다수 재작성 | 테스트 + 재실행 가능 게이트 |
| 공수 | 30분 | 3시간+ | 50분 |

**선택: C.** PRD B1-5 는 「슬롯 UI 전면 제거」라 적었지만, `precheck.html:783-786`·CSS `.slots{display:none}` 주석이 **엘리먼트 삭제 금지**를 명시적으로 경고합니다(`setSlotText` 가 여기에 대입하고, 지우면 `lockFreePlan`·`blockEverything` 까지 끊깁니다). 슬롯은 **이미 화면에 보이지 않으므로**(`display:none`) 「UI 제거」의 이용자 효과는 이미 달성돼 있고, 남은 것은 **문구**뿐입니다. B 는 이득 없이 접수를 멈출 위험만 삽니다. AC-1 은 사람 눈으로 지킬 수 없으므로 게이트를 기계화합니다.

## 3. 보호 구간 정의 (AC-1)

`scripts/check-b1-gates.js` 가 `git show HEAD:<file>` 과 작업본에서 아래 둘을 뽑아 **바이트 비교**합니다.

1. **패턴 줄** — `plan-price` | `pay-summary-value` | `pay-vat` | `₩330,000` 을 포함하는 모든 줄
2. **결제 폼 블록** — `<div class="pay-area"` 로 시작해 `id="intake-submit"` 을 포함하는 줄까지 (결제 폼 + 결제 버튼 전체)

한 바이트라도 다르면 게이트가 비영 종료합니다.

## 4. 문구 매핑

| 파일 | 전 | 후 |
|---|---|---|
| `site.config.json` | `"itemCount": 18` | `"itemCount": 17` |
| `index.html` `.feat-desc` | 기한 **7일 전과 1일 전에** 메일로 | 기한 **30일 전, 7일 전, 1일 전**에 메일로 |
| `en.html` `.feat-desc` | We email you **7 days and 1 day** before | We email you **30 days, 7 days, and 1 day** before |
| `index.html`·`en.html` 주석 | 「기한 7일 전과 1일 전에 …」 | 「기한 30일 전, 7일 전, 1일 전에 …」 |
| `nda.html` `.cta-note` | 무상·로그인없음 약속 | `신용카드 없이 가입 · 결과 저장 무료` |
| `en-nda.html` `.cta-note` | 〃 (영문) | `Sign up with no credit card · Results saved free` |
| `nda.html` 「얼마인가요」 | 「지금은 …20건에 한해 무료로」 | 「지금은 무상으로 진행하며」 |
| `refund.html`·`en-refund.html` | 「…20건 무료(0원)로 접수하신 건은」 | 「무상(0원)으로 접수하신 건은」 (**법적 진술 보존**) |
| `precheck.html` `#slots-text` | 잔여 수량 안내 문구 | `접수 가능 여부를 확인하는 중입니다…` |
| `en-precheck.html` `#slots-text` | 〃 | `Checking whether submissions are open…` |
| `precheck.html` `#plan-free-tag` | 20건 프로모션 태그 | `무상 접수` |
| `precheck.html` `#plan-free-desc`·`#plan-paid-desc` | 잔여 자리 프레이밍 | 자리 언급 없이 동일 사실 진술 |
| `en.html` 주석 3곳 · 양 `precheck` 주석 | 금지 문자열 인용 | 의미 동일한 우회 표기 |
| `docs/**` 12파일 | 금지 문자열 | 의미 보존 치환 (삭제 아님 · 원문은 git 이력에 보존) |

## 5. 테스트 설계

### 5.1 `test/price-exposure.test.js` — 신설 케이스

금지 문자열을 **리터럴로 파일에 적지 않습니다.** 적는 순간 이 파일 자신이 AC-2 위반이 되어 검사가 스스로를 잡습니다. `['First 20 submissions','free'].join(' ')` 형태로 런타임에 조립합니다.

검사 범위: 저장소 전체에서 `dist/` · `node_modules/` · `.git/` 제외. `git ls-files` 로 추적 파일 목록을 얻어 텍스트 파일만 읽습니다.

### 5.2 기존 테스트 갱신

| 파일 | 갱신 |
|---|---|
| `naming-consistency.test.js:66,76` | 「초기 무상 표기 존재」 단정 삭제 — `plan-free-tag` id 존재 단정이 이미 같은 것을 지킵니다 |
| `item-count.test.js:135` | 기대값 `18 → 17` + 근거 문구 갱신 |

## 6. Error Handling

- 게이트 스크립트는 `git show HEAD:` 실패(파일 신규 등) 시 명시적 메시지로 fail — 조용히 통과하지 않습니다.
- `npm run build` 는 `itemCount` 가 양의 정수가 아니면 이미 실패합니다(기존 동작).

## 7. Security / Data

변경 없음. Supabase 스키마·데이터·API 무변경. 정적 자산만 재배포됩니다.

## 8. Test Plan

| L | 항목 |
|---|---|
| L1 | `npm test` 전량 green |
| L2 | `node scripts/check-b1-gates.js` 전 게이트 PASS |
| L3 | `npm run build` → `dist/` 금지 문자열 0건 |
| L4 | 배포 후 `https://www.trops.kr/precheck` 에서 ₩330,000·결제 버튼 노출 확인 |

## 9. Implementation Guide

1. `scripts/check-b1-gates.js` 신설 → 현재 상태에서 baseline 확인
2. B1-1 설정값 · B1-7 테스트 기대값
3. B1-2 알림 주기
4. B1-3/3b/3c 무상 문구 (nda · en-nda · refund · en-refund)
5. B1-4/B1-5 주석·슬롯 문구 (en · precheck · en-precheck)
6. B1-8 docs 치환
7. B1-6 `price-exposure.test.js` 신설 케이스
8. `npm test` + 게이트 + build
