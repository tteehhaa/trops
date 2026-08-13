# Design — price-300k-naming-map-s9

Plan: `docs/01-plan/features/price-300k-naming-map-s9.plan.md`

## 1. 용어 정본 (앞 사이클 표를 갱신한다)

`docs/02-design/features/naming-consistency-s9.design.md §1` 의 표에서 **첫 행만** 바뀐다.

| 개념 | 국문 정본 | 영문 정본 | 생애주기 배지 |
|---|---|---|---|
| ~~문서 대조~~ → **수출 사전점검** | **수출 사전점검** | **Export pre-check** | 거래 시작 전 / Before the deal |
| 바이어 확인 | 바이어 확인 | Buyer check | 거래 시작 전 / Before the deal |
| 기한 관리 | 기한 관리 | Deadline management | 거래 시작 후 / After the deal starts |
| 로드맵 (확장판) | 거래 운영 | Trade operations | — |
| 로드맵 (요약자료) | 확인 항목 요약 자료 | Item comparison sheet | — |

폐기 문자열 3종 — 어느 페이지에도 남기지 않는다:
`문서 대조` · `바이어 서류 사전 확인` · `Document comparison` · `Buyer document pre-check`

> ⚠️ **「대조」라는 **동사**는 폐기 대상이 아니다.** 폐기하는 것은 **상품명**이다.
> 「공개된 서식과 하나씩 **대조**합니다」 같은 서술은 그대로 둔다 — 그것은 이름이 아니라
> 무엇을 하는지에 대한 설명이고, 지우면 서비스 약속이 사라진다.

## 2. 가격 — 5개 좌표를 순서대로 (P1~P5)

| # | 저장소 | 파일 | before | after |
|---|---|---|---|---|
| P1 | trops_a | `lib/payment/precheck-paid-gate.ts:54` | `launchKrw: 99_000` | `launchKrw: 300_000` |
| P2 | trops_a | `lib/config/cross-repo-values.ts` | 원장 note `PRICE=99000` · RESOLVED `₩99,000` | `PRICE=300000` · 흐름 md §4 재결정 기록 |
| P3 | 이 저장소 | `api/_payment.js:41` | `const PRICE = 99000` | `const PRICE = 300000` |
| P4 | 이 저장소 | `precheck.html` ×3 | `₩99,000` | `₩300,000` + VAT 병기 |
| P5 | 이 저장소 | `scripts/verify-deployment.js:320` | `/₩99,000/` 존재 단정 | `/₩300,000/` |

### P1 부수효과 — 축 충돌 단언이 뒤집힌다

trops_a `tests/payment/precheck-paid-gate.test.ts:169` 가
`PRECHECK_PRICE.launchKrw === VERIFY_TIERS.standard.krw` 를 단정한다. §8-4 가 경고한
**삼중 사용**(앞단 런칭가 · 뒷단 Standard · UAE 진단서)이 「같은 숫자」였기 때문이다.

앞단만 ₩300,000 으로 움직이므로 **그 충돌이 해소된다.** 단언을 지우지 않고 **뒤집는다** —
「같다」가 아니라 「**갈라졌다**」를 단정한다. 지우면 다음에 누가 다시 붙여도 아무도 모른다.

### P4 — 가격이 보이는 자리 (노출 시점)

```
#intake 섹션
├─ .plans  ← display:none (CSS) + hidden (속성)   ⟵ 두 겹으로 닫는다
│   ├─ 무료 카드   ₩0
│   └─ 유료 카드   ₩300,000        ← 화면에 안 나온다
└─ form
    ├─ 문서종류 · 이메일 · 파일 · 자사서식 · 거래정보 · 동의
    ├─ #pay-area  hidden           ⟵ 유료 경로를 고른 뒤에만 열린다
    │   └─ .pay-summary  ₩300,000  ← 가격이 실제로 보이는 **유일한** 자리
    │       + .pay-vat  부가세(VAT) 별도입니다.
    └─ 제출 버튼  '서류 보내기' | '₩300,000 결제하고 보내기'(유료 선택 시)
```

**왜 두 겹인가**: 지금은 `.plans { display: none }` **한 겹**이다. 그 한 줄을 지우면
선택 전 가격이 되살아나고, 그것을 잡는 검사가 없다. `hidden` 속성을 함께 붙이고
`test/price-exposure.test.js` 가 **두 겹 모두**와 「가격 문자열이 그 두 자리 밖에
없다」를 단정한다. 과금 게이트를 여는 사람은 두 겹을 다 떼야 하고, 그때 검사가 빨개져서
「가격 노출 자리를 다시 결정해야 한다」는 사실을 마주친다 — 조용히 열리지 않는다.

⛔ `#pay-area` 밖으로 가격을 옮기지 않는다. 옮기면 접수 전에 가격을 보는 구조로 되돌아간다.

## 3. 지도 — trops_a 정책으로 되돌림 (M1~M5)

대상 2파일: `index.html`(국문) · `en.html`(영문). **한쪽만 고치면 언어별로 예시가 갈린다.**

| # | 무엇 | before | after |
|---|---|---|---|
| M1 | 핀 개수 | 프랑스 · 아랍에미리트 · **베트남** 3건 | 프랑스 · 아랍에미리트 **2건** |
| M2 | 핀 캡션 | `<span class="feat-pin-meta">선적 기한 D-12</span>` ×3 | 전부 삭제 (국가명만) |
| M3 | 등장 순서 | `style="--i:0|1|2"` | 삭제 (순서 개념 자체가 없어진다) |
| M4 | 애니메이션 | `@keyframes pin-drop` + `.feat[data-open="1"] .feat-pin { animation: … }` | 둘 다 삭제 |
| M5 | 축소모션 예외 | `@media (prefers-reduced-motion) { .feat-pin { animation: none } }` | 삭제 (끌 애니메이션이 없다) |

`.feat-pin-meta` CSS 규칙도 함께 지운다 — 쓰는 곳이 0이 되면 다음 사람이 「이 자리에
무엇을 적으라는 뜻」으로 읽고 D-day 를 되돌린다.

**남기는 것**(⛔ 지우지 않는다):
- `.feat-cap` 「예시로 만든 표기입니다. 실제 고객 거래가 아닙니다.」 —
  trops_a ③ 「예시임을 밝힌다」에 대응하는 문면
- `.feat-map-note` 「실제 기한관리 화면 캡처를 준비하고 있습니다」 — TODO-ASSET 자리표시
- 아코디언 슬라이드 전환(`grid-template-rows`) · `.reveal` 스크롤 등장 —
  **지도 애니메이션이 아니다.** trops_a 정책은 **지도 패널**에 대한 것이고,
  흐름 md §1 「다이나믹함」 1·3번(카운트업 대체 페이드 · 아코디언 슬라이드)은 유효하다

## 4. 검사 변경

| 파일 | 변경 |
|---|---|
| `test/naming-consistency.test.js` | 04·05·로드맵·en 의 기대 문자열을 §1 표로 교체 + 폐기 4종 0건 단언 신설 |
| `test/landing-flow-s9.test.js` | 「핀이 순차로 등장한다」 → 「**핀이 2개이고 애니메이션·수치가 없다**」로 교체. 축소모션 단언에서 `.feat-pin` 항목 제거 |
| `test/price-exposure.test.js` | **신설** — ₩300,000 표기 · VAT 병기 · 노출 자리 2곳 · `.plans` 두 겹 닫힘 |
| `test/precheck-charge-gate.test.js` | 손대지 않는다 — 정본(P1)을 읽으므로 자동으로 맞는다 |
| `scripts/verify-deployment.js` | P5 |

## 5. 별건으로 올리는 것

`docs/03-analysis/price-gate-teaser-restructure.md` — 「접수 → 대조 → 결과 티저 → 결제」
전체 재구조화. 흐름 md §3(결제는 AI 실행 전)과 반대 방향이고 trops_a 파이프라인이
티저를 되돌려줘야 하므로 이번 사이클에서 하지 않는다.
