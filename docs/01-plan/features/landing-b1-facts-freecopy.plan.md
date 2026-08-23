# Plan — landing-b1-facts-freecopy (PRD v2.1 · B1 배치)

| 항목 | 내용 |
|---|---|
| Feature | `landing-b1-facts-freecopy` |
| 출처 | `docs/prd/PRD_landing_v2.1_main_web_page.md` §4 B1 |
| 작성일 | 2026-08-23 |
| 배치 | B1 — 사실 정정 · 무상 문구 제거 |
| 선행 조건 | 없음 (`trops_a` 무관) |

## Executive Summary

| 관점 | 내용 |
|---|---|
| **Problem** | 랜딩이 **사실과 다른 숫자 2건**(대조 항목 18 vs 엔진 17, 알림 주기 7·1일 vs 코드 30·7·1)을 말하고, **종료된 무상 제공**(초기 20건 무상 · 로그인 없음)을 아직 약속하고 있습니다. |
| **Solution** | 정적 HTML·설정·테스트만 손대어 ① 항목 수를 17로, ② 알림 주기를 30·7·1일로 고치고, ③ 종료된 무상 제공 문구를 저장소 전체에서 걷어냅니다. 회귀는 `price-exposure.test.js` 의 신설 부재 검사가 막습니다. |
| **Function UX Effect** | 이용자가 랜딩에서 읽는 숫자와 약속이 제품이 실제로 하는 일과 일치합니다. 지킬 수 없는 무상 약속이 사라져 접수 후 기대 불일치가 없어집니다. |
| **Core Value** | **말한 것과 하는 것을 맞춥니다.** 토스 결제 심사 중이므로 가격·결제 표면은 1줄도 건드리지 않은 채 이것을 해냅니다. |

## Context Anchor

| 축 | 내용 |
|---|---|
| **WHY** | 앱이 앞서 나갔고 랜딩이 못 따라왔습니다. 사실 오류 2건 + 종료된 무상 제공 문구가 라이브입니다 (PRD §1). |
| **WHO** | 랜딩 방문자(수출 준비 기업), 그리고 **토스 결제 심사자** — 후자 때문에 가격·결제 diff 가 0줄이어야 합니다. |
| **RISK** | 🔴 가격·결제 요소 1줄이라도 바뀌면 심사 fail. 🔴 `precheck.html` 의 `.plans` 2겹 잠금(CSS+`hidden`)·`#slots-badge` 엘리먼트를 지우면 접수가 통째로 멈춥니다. |
| **SUCCESS** | 절대 조건 5개 전부 통과 + 기존 검사 전량 green + Match Rate ≥ 90. |
| **SCOPE** | 정적 HTML 문구 · `site.config.json` 한 값 · `test/` 3개 파일 · `docs/` 문자열 정리. **Supabase 스키마·데이터 변경 없음.** API·JS 로직 변경 없음. |

## 1. 요구사항 (절대 조건)

| # | 요구사항 | 검증 방법 |
|---|---|---|
| **AC-1** | `precheck.html`·`en-precheck.html` 의 가격·결제 요소 **diff 0줄** — `plan-price`, `pay-summary-value`, `pay-vat`, 결제 버튼, 결제 폼, `₩330,000` 포함 줄 | `git diff` 를 라인 단위로 필터링하는 전용 게이트 스크립트 |
| **AC-2** | 금지 문자열 5종이 저장소 전체(`dist/`·`node_modules/`·`.git/` 제외)에서 **0건** | `grep -r` 게이트 + `price-exposure.test.js` 신설 케이스 |
| **AC-3** | `site.config.json` 의 `precheck.itemCount` = **17** | `item-count.test.js` |
| **AC-4** | `index.html`·`en.html` 의 알림 주기 표기 = **「30일 전, 7일 전, 1일 전」** | 게이트 스크립트 + 육안 |
| **AC-5** | 기존 검사 전량 green + `price-exposure.test.js` 에 AC-2 부재 검사 추가 | `npm test` |

**금지 문자열 5종**: 종료된 무상 제공을 약속하던 영문 CTA 노트 2종 · 로그인 불필요 표기 · 잔여 슬롯 표기 · 「초기 접수 순번」 표기 · 무상 실증 표기.
정확한 리터럴은 `scripts/check-b1-gates.js` 의 `BANNED` 와 `test/price-exposure.test.js` 의 `RETIRED_OFFER_PHRASES` 가 조각으로 들고 있습니다 — ⛔ 이 문서에 리터럴로 적으면 이 문서 자신이 검사에 걸립니다.

## 2. 작업 항목 (PRD §4 대응)

| ID | 대상 | 작업 |
|---|---|---|
| B1-1 | `site.config.json:74` | `itemCount: 18 → 17` + 주석의 파생 근거 갱신 |
| B1-2 | `index.html:2022`, `en.html:2007` (+ 양쪽 주석 1곳씩) | 알림 주기 7·1일 → 30·7·1일 |
| B1-3 | `nda.html:211`, `en-nda.html:211` | 무상·로그인없음 `cta-note` → 가입 유도 카피(핸드오프 3b 문안) |
| B1-3b | `nda.html:267` | 「얼마인가요」 QnA 에서 초기 무상 프레이밍 제거 (금액은 계속 미노출) |
| B1-3c | `refund.html:266`, `en-refund.html:262` | 무상 건 환불 제외 조항에서 초기 무상 프레이밍 제거 (**법적 진술은 보존**) |
| B1-4 | `en.html` 주석 3곳 | 금지 문자열을 인용한 인수인계 주석 문면 교체 |
| B1-5 | `precheck.html`·`en-precheck.html` | 슬롯 **문구**만 교체 — `#slots-badge`·`#slots-text`·`#slots-mark` 엘리먼트와 JS 는 **그대로** |
| B1-6 | `test/price-exposure.test.js` | 금지 문자열 부재 검사 신설 (리터럴을 파일에 남기지 않는 방식) |
| B1-7 | `test/naming-consistency.test.js`, `test/item-count.test.js` | 옛 기대값(초기 무상 표기 존재 · itemCount 18) 갱신 |
| B1-8 | `docs/` 12개 파일 | 금지 문자열 문자 치환 (의미 보존 · 삭제 아님) |
| B1-9 | `scripts/check-b1-gates.js` (신설) | AC-1·AC-2·AC-4 를 재실행 가능한 게이트로 고정 |

## 3. 범위 밖 (의도적)

- **`en-precheck.html:1070` `.pay-note`** — PRD B1-4 는 이 줄을 지목하지만, 실제 문면은 `No login or account required.` 로 금지 문자열(`No sign-in needed`)과 **다르고**, 이 줄은 `#pay-area`(결제 폼) 안입니다. **AC-1(결제 폼 diff 0줄)이 PRD B1-4 보다 우선**하므로 손대지 않습니다.
- **「알려드립니다」 표현**(PRD P-3) — B2 수용 기준입니다. B1 에서는 주기 숫자만 고칩니다.
- `.plans` 컨테이너의 `plan-price`(₩0 · ₩330,000) 두 줄 — AC-1 보호 대상.

## 4. Success Criteria

- [ ] SC-1 `node scripts/check-b1-gates.js` → 전 게이트 PASS
- [ ] SC-2 `npm test` → 전량 green
- [ ] SC-3 `npm run build` 성공, `dist/` 에도 금지 문자열 0건
- [ ] SC-4 배포 후 `https://www.trops.kr/precheck` 에서 ₩330,000·결제 버튼 정상 노출
