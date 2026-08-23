# Handoff: /uae 조회 결과 화면 (TROPS · 한-UAE CEPA 세율 조회)

## Overview
trops.kr에 추가할 새 페이지 `/uae` 의 **조회 결과 화면**입니다.
사용자가 랜딩에서 국가(아랍에미리트)와 HS 8단위를 입력하고 확인을 누르면 도달합니다.
**로그인 없이 접근**하며, 화면의 목적은 두 가지입니다.

1. 한-UAE CEPA 부속서의 양허 내용을 **근거와 함께** 보여준다 (판정하지 않는다).
2. 확인이 필요한 항목을 드러내고 **유료 사전 점검 리포트(99,000원)** 로 전환시킨다.

제품 톤의 핵심: *확신을 주는 디자인이 아니라, 근거와 출처가 분명해 보이는 디자인.*
숫자를 자랑하듯 크게 쓰지 말고, 각 값 아래 조문 근거가 함께 읽히게 합니다.

## About the Design Files
이 번들의 HTML/CSS는 **HTML로 만든 디자인 레퍼런스**입니다. 의도한 모습과 동작을 보여주는
프로토타입이며, 그대로 배포할 프로덕션 코드가 아닙니다. 작업은 이 디자인을 **대상 코드베이스의
기존 환경**(현재 trops.kr 랜딩은 정적 HTML + `<style>` 단일 블록 + vanilla JS)에서 재현하는 것입니다.

단, 이 화면은 **기존 `index.html`의 CSS를 그대로 상속**하도록 설계되었기 때문에,
`uae-result.css` 는 예외적으로 **`index.html` 의 `<style>` 블록 맨 아래에 그대로 붙여넣어
사용할 수 있습니다.** 새 변수·새 폰트·새 radius를 도입하지 않았고, 기존 셀렉터를 재정의하지 않습니다.

## Fidelity
**High-fidelity (hifi).** 색상·타이포그래피·간격·상태가 모두 최종값입니다.
모든 색은 `index.html` 의 `:root` 변수만 사용하며 새 색을 만들지 않았습니다.
픽셀 그대로 재현해 주십시오.

## Design constraints (반드시 유지)
- 강조색은 `--accent` (#0F172A) 하나뿐. 잉크색과 동일. **파란색·초록색·보라색 금지.**
- `--warning` (#DC2626)은 **금지품목(PH)에만**. 양허제외(X)는 오류가 아니므로 중립색.
- radius: 버튼 6px / 패널·카드·표 8px / 배지 4px
- 폰트: Pretendard Variable, 본문 16.5px / line-height 1.76
- **그라데이션·그림자 금지.** 면(`--surface`)과 선(`--line`)으로만 위계를 만듭니다.
- 애니메이션은 기존 `trops-pulse`(opacity) 외 추가 금지. 이 화면은 애니메이션을 쓰지 않습니다.
- 배지는 기존 `.wf-badge` 패턴 재사용 (border 1px rgba(15,23,42,.28), radius 4px, 11.5px, 600)

## Screens / Views

문서(`UAE 조회 결과.dc.html`)에는 5개 목업이 들어 있습니다. **화면은 1종**이고,
데이터 상태에 따른 분기를 보여주는 것입니다.

| id | 폭 | 상태 | 확인 포인트 |
|---|---|---|---|
| 1a | 데스크톱 | 즉시(A) · PSR 확인됨 | 연도별 표 **없음** |
| 1b | 데스크톱 | 5년(B) · PSR 확인 중 | 연도별 표 5행 |
| 1c | 데스크톱 | 양허제외(X) | 도달일 "해당없음", 표 없음, 중립 배지 |
| 1d | 모바일 390px | 즉시(A) · PSR 확인됨 | 카드 1열 |
| 1e | 모바일 390px | 10년(C) · PSR 확인 중 | 표 10행 |

### Purpose
사용자는 여기서 (1) 내 품목의 세율이 어떻게 되는지 확인하고, (2) 확인되지 않은 것이
무엇인지 알고, (3) 사전 점검 리포트를 신청합니다.

### Layout — 전체 골격 (위에서 아래)
`.uae-page` (컨테이너 쿼리 기준점) 안에:

```
nav.nav                              (index.html 상속, 그대로)
main.uae-main
  .container.uae-topbar              ← 다시 조회
  header.container.uae-head          1. 조회한 품목 헤더
  .container > .uae-rates            2. 세율 카드 3개 (grid 1fr 1fr 1fr, gap 12px)
  section.container.uae-block        3. 연도별 세율 표   (B/C 트랙에서만 렌더)
  section.container.uae-block        4. 원산지 결정기준(PSR)
  section.container.uae-check        5. 확인 항목 + 유일한 primary CTA
.uae-disclaimer                       6. 면책 4문장 (position: sticky; bottom: 0)
```

`.container` 는 상속: `max-width:1200px; margin:0 auto; padding-inline:clamp(24px,5vw,64px)`.
블록 구분선은 모두 `border-top: 1px solid var(--line)` — 카드 그림자를 쓰지 않습니다.

### Components

**내비게이션 (`.nav` 상속)**
랜딩과 동일하지만 **오른쪽 버튼을 `.btn-primary` → `.btn-secondary` 로 낮춥니다.**
이 화면에서 primary는 "사전 점검 리포트 신청" 하나여야 합니다.

**1. 조회한 품목 헤더 `.uae-head`** (padding-block 26px 32px, 하단 1px `--line`)
- `.uae-head-kicker` — "아랍에미리트 · 한-UAE CEPA" / 12.5px, 700, letter-spacing .14em, `--muted`
- `.uae-hs` — HS 8단위. 30px / 600 / letter-spacing .06em / `font-variant-numeric: tabular-nums`.
  **새 mono 폰트를 넣지 않고** Pretendard의 tabular-nums로 등폭을 만듭니다.
  4자리씩 두 개의 `.uae-hs-g` 로 끊고, 두 번째에 `margin-left: .34em` (예: `3304` `1000`).
- `.uae-hs-note` — "HS 8단위 · 6단위 330410 · 제3304호" / 12.5px `--muted`
- `.uae-item-name` — 품목명. `<h1>`, 21px / 700 / -0.02em / max-width 34ch.
  **양허표(JSON `name`)의 문구를 그대로** 씁니다. 의역하지 마십시오.
- `.uae-item-parent` — "제33류 · 정유와 레지노이드, 조제향료와 화장품·화장용품" / 14.5px `--ink-64`
- `.uae-badge-row` — flex, gap 8px, margin-top 18px
  - 트랙 배지: `.wf-badge` (강조) — "즉시 철폐 / 5년 철폐 / 10년 철폐 / 양허제외 / 금지품목 / 특별관심품목"
  - 보조 배지: `.wf-badge.uae-badge-quiet` (`--ink-64`, border `--line`) — "양허유형 A", "부속서 2-가-2"
  - `.uae-badge-warning` (`--warning`) 은 **금지품목(PH) 전용.** 양허제외에는 쓰지 않습니다.

**2. 세율 카드 3개 `.uae-rates`** (grid 3열 / gap 12px / padding-block 28px 4px)
각 `.uae-rate`: border 1px `--line`, radius 8px, padding 20px 22px 18px.
가운데(현재 세율)만 `.uae-rate-now` → 배경 `--surface`.
- `.uae-rate-label` 13px / 600 / `--ink-62`. 현재 세율에는 "2026-08 기준" quiet 배지를 붙입니다.
- `.uae-rate-value` 34px / 600 / -0.01em / tabular-nums
- 값이 없을 때 `.uae-rate-value.uae-rate-value-na` → 19px / `--muted` / "해당없음"
- `.uae-rate-src` — **조문 근거 1–2문장.** margin-top 14px, padding-top 11px, 상단 1px `--line`,
  12.5px `--muted`. 이 줄이 이 제품의 핵심입니다. 값만 있고 근거가 없는 카드는 만들지 마십시오.

카드 3개: `기준세율` / `현재 세율` / `무관세 도달일`.

**3. 연도별 세율 표 `.uae-block` + `.uae-table-wrap`**
- **B(5년) 또는 C(10년) 트랙일 때만 렌더.** A(즉시)는 이 블록이 **DOM에 아예 없습니다.**
  X/PH/SG는 블록 제목 + `.uae-block-note` 설명만 두고 표를 그리지 않습니다.
- `.uae-table-wrap` — max-width 430px, border 1px, radius 8px, `overflow:hidden`
  (표에 radius를 주기 위한 래퍼. `<table>` 자체에는 radius를 넣지 않습니다.)
- `th` — `--surface` 배경, 12px / 700 / .08em / `--ink-62`, padding 9px 18px
- `td` — 15.5px, `--ink-70`, tabular-nums, padding 10px 18px, 하단 1px `--line`, 마지막 행은 border 0
- 두 번째 열은 우측 정렬 (`th:last-child, td:last-child { text-align:right }`)
- 현재 연차 행에 `.uae-row-current` → 배경 `--surface`, `--ink`, 600
- `.uae-row-mark` — 행 안의 작은 주석 ("발효 · 현재", "무관세") 11.5px / `--muted`
- 최대 10행.

**4. 원산지 결정기준(PSR) `.uae-psr`** — **두 상태를 색이 아니라 면과 선으로 구분합니다.**

| | 확인됨 | 원문 확인 중 |
|---|---|---|
| 클래스 | `.uae-psr` | `.uae-psr.uae-psr-pending` |
| 배경 | `--surface` | `--bg` (흰색) |
| 테두리 | 1px solid `--line` | 1px **dashed** `--line` |
| 마커 | `.uae-psr-mark` 채운 원 `--accent` | `+ .uae-psr-mark-pending` 빈 원, border 1.5px `--muted` |
| 본문 | `.uae-psr-text` `--ink` | `+ .uae-psr-text-pending` `--ink-64` |

**"확인 중"은 오류나 경고가 아닙니다.** 경고색·아이콘·느낌표를 넣지 마십시오. 중립이어야 합니다.
- 확인 중 문구(고정): `원문 확인 중 — 정확한 기준은 담당 관세사에게 문의하십시오`
- 확인됨 예시: `6단위 세번변경기준 또는 인정가치포함비율 40% 이상`
- `.uae-psr-meta` — 출처 문구. **확인된 품목에만** "부속서 3-가 제33류 · 소호 330410 기재 기준을
  그대로 옮긴 것입니다" 형태로 붙입니다. 확인되지 않은 품목에는 소호 출처를 붙이지 마십시오.

> ⚠ **현재 원문 확인이 완료된 류는 제33류 하나뿐입니다.** 나머지 전 품목은 "원문 확인 중"입니다.
> 제33류의 기준(인정가치포함비율 40%)을 다른 류에 복사하지 마십시오. 예를 들어 부속서 3-가의
> 제2류는 "완전생산기준 · 선택기준 해당없음"입니다.

**5. 확인 항목 `.uae-check`** — 리포트 전환 지점
- `.uae-check-count` — "확인이 필요한 항목이 6개 있습니다" / 24px / 700 / -0.025em
- `.uae-check-sub` — "원산지증명서 · 소급발급 기한 등 협정상 확인 대상입니다." / 16.5px `--ink-64`
- `.uae-check-list` — grid 2열(모바일 1열), gap 9px 28px, max-width 760px.
  각 항목 `.uae-check-item` = `20px | 1fr` grid, `.uae-check-num` 은 01–06 / 12.5px `--muted`
- `.uae-check-cta` — `.btn.btn-primary` "사전 점검 리포트 신청 · 99,000원" +
  `.uae-check-cta-note` "품목별 원문 확인 후, 확인 항목별 근거와 함께 문서로 발급합니다."
- **이 버튼이 화면에서 유일한 primary 액션입니다.**

**확인 항목 파생 규칙 (중요 — 구현 시 반드시 지킬 것)**
확인 항목은 두 종류로만 파생시킵니다.
1. **트랙(A/B/C/X/PH/SG) 기반** — 확인된 데이터이므로 분기 허용.
   예: 양허제외(X) → "양허제외 지정 범위 — 8단위 전체 여부", "대체 적용 가능한 특혜세율 유무"
2. **PSR 기반** — PSR이 "원문 확인됨"인 품목에만 추가.
   PSR이 "원문 확인 중"이면 PSR을 전제한 항목(세번변경·인정가치포함비율·허용치 등)을 **넣지 않습니다.**
   대신 "원산지 판정 근거서류 구비 여부" 처럼 기준과 무관한 항목을 씁니다.

용어는 협정문 한글본을 따릅니다: "미소기준/De Minimis"(X) → **"허용치"**(O, 제3.7조).

**6. 면책 문구 `.uae-disclaimer`** — `position: sticky; bottom: 0; z-index: 10`,
배경 `--surface`, 상단 1px `--line`, 13px / line-height 1.78 / `--ink-64` / max-width 82ch.
다음 4문장이 **항상, 글자 그대로** 노출됩니다:

> 이 결과는 한-UAE CEPA 부속서의 양허 내용을 표시한 것입니다. 실제 납부 세액과 다를 수 있습니다.
> 원산지 결정기준은 품목별로 다르며 원문 확인이 필요합니다. TROPS는 품목분류·원산지를 판정하지 않습니다.

**7. 다시 조회 `.uae-topbar` / `.uae-back`** — 화면 최상단, `←` + "다시 조회",
14px / 500 / `--ink-62`, hover `--ink`. `/uae` 로 돌아갑니다.

## Interactions & Behavior
- 애니메이션·트랜지션 없음. 상속된 `.btn`의 `background-color/border-color .14s ease` hover만 유지.
- 링크 hover: `.uae-back` `--ink-62` → `--ink`.
- 포커스: 상속된 `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }`.
- 리포트 CTA → 결제/신청 플로우 (`/uae/diagnosis?hs=<hs8>`). 이 문서 범위 밖입니다.
- 로딩/에러 상태는 이 화면에 없습니다 (결과는 서버 렌더 또는 조회 직후 렌더 가정).
  HS 미존재 시의 "결과 없음" 화면은 아직 디자인되지 않았습니다 — 필요하면 요청해 주십시오.
- **반응형**: 미디어쿼리 대신 `.uae-page { container-type: inline-size }` +
  `@container (max-width: 680px)`. 기존 `index.html` 의 900px/640px 미디어쿼리와 충돌하지 않습니다.
  좁은 폭에서: 세율 카드 3열 → 1열, 확인 항목 2열 → 1열, CTA 버튼 100% 폭,
  `.uae-hs` 30 → 25px, `.uae-rate-value` 34 → 29px.

## State Management
서버가 넘겨주는 값만으로 렌더됩니다. 클라이언트 상태 없음.

렌더에 필요한 데이터 (전량 `uploads/uae_tariff_schedule.json` 에서 옴, 8단위 키 조회):

```
hs8            "33041000"
hs4            "3304"
name           "- 입술화장용 제품류"      ← 선행 하이픈만 정리, 문구는 유지
base_rate_raw  "5%"
base_rate_num  5.0
conc           "A" | "B" | "C" | "X" | "PH" | "SG"
track          "즉시" | "5년" | "10년" | "양허제외" | "금지품목" | "특별관심품목"
zero_date      "2026-05-01 (발효일)" | "2030-01-01" | "—"
```

파생 로직:
- **현재 세율** = 오늘 날짜 기준 해당 연차의 세율.
  A → 0%. B → 기준세율을 5회 균등 인하(1년차는 발효일부터, 이후 매년 1월 1일).
  C → 10회 균등 인하. X/PH/SG → 기준세율 유지 또는 "해당없음".
- **연도별 표** = B/C에서만 생성. 행 수 = 5 또는 10.
- **PSR** = 별도 테이블. 확인 여부 플래그 + 기준 원문. 현재 제33류만 확인됨.
  플래그가 없으면 항상 "원문 확인 중" 문구로 폴백합니다. **추정하지 마십시오.**
- **확인 항목** = 위 "확인 항목 파생 규칙" 참조. 현재 목업은 6개.

부속서 번호는 협정문 한글본 표기를 씁니다: **부속서 2-가-2** (양허표), **부속서 3-가** (품목별 원산지 기준).

## Design Tokens
전부 `index.html` 의 `:root` 에서 상속 — 새 토큰 없음.

| 토큰 | 값 | 이 화면에서의 용도 |
|---|---|---|
| `--ink` | #0F172A | 본문, 세율 값 |
| `--ink-70` | rgba(15,23,42,.7) | 표 본문 셀 |
| `--ink-64` | rgba(15,23,42,.64) | 보조 설명, 면책, PSR 확인 중 본문 |
| `--ink-62` | rgba(15,23,42,.62) | 라벨, 다시 조회 |
| `--accent` | #0F172A | primary 버튼, PSR 확인 마커 (잉크색과 동일) |
| `--accent-press` | #1E293B | primary hover |
| `--muted` | #94A3B8 | 근거 문구, kicker, 빈 마커, "해당없음" |
| `--line` | #E2E8F0 | 모든 테두리·구분선 |
| `--surface` | #F8FAFC | 현재 세율 카드, 표 헤더, PSR 확인됨, 면책 바 |
| `--bg` | #FFFFFF | 페이지, PSR 확인 중 |
| `--warning` | #DC2626 | **금지품목(PH) 배지 전용** |

- 타이포 스케일(이 화면): 34 / 30 / 24 / 21 / 16.5 / 15.5 / 15 / 14.5 / 14 / 13 / 12.5 / 12 / 11.5px
- 간격: 4 / 8 / 9 / 10 / 11 / 12 / 14 / 18 / 20 / 22 / 26 / 28 / 32 / 34 / 38px
- radius: 6px(버튼) / 8px(카드·패널·표 래퍼) / 4px(배지) / 50%(작은 마커)
- shadow: **없음**

## Assets
없음. 아이콘·이미지 0개. `←` 는 텍스트 문자입니다.
폰트는 상속: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css`

## Files

| 파일 | 내용 |
|---|---|
| `uae-result.css` | **붙여넣을 신규 CSS 전문.** `index.html` 의 `<style>` 맨 아래에 그대로 추가. |
| `UAE-result-mockups.dc.html` | 목업 5종(1a–1e) + 클래스 인수인계 섹션. 브라우저에서 바로 열립니다. |
| `../uploads/index.html` | 현재 운영 중인 랜딩. 상속 원본. |
| `../uploads/uae_tariff_schedule.json` | 양허표 원본 데이터 (8단위 전량). |

### 상속 클래스 (그대로 사용, 수정 금지)
`.container` · `.nav .nav-inner .wordmark .nav-links .nav-right` · `.btn .btn-primary .btn-secondary .btn-nav` ·
`.wf-badge` · `:root` 변수 전체

### 신규 클래스 (`.uae-` 접두사)
`.uae-page .uae-main` · `.uae-topbar .uae-back .uae-back-mark` ·
`.uae-head .uae-head-kicker .uae-hs .uae-hs-g .uae-hs-note .uae-item-name .uae-item-parent` ·
`.uae-badge-row .uae-badge-quiet .uae-badge-warning` ·
`.uae-rates .uae-rate .uae-rate-now .uae-rate-label .uae-rate-value .uae-rate-value-na .uae-rate-src` ·
`.uae-block .uae-block-head .uae-block-title .uae-block-src .uae-block-note` ·
`.uae-table-wrap .uae-table .uae-row-current .uae-row-mark` ·
`.uae-psr .uae-psr-pending .uae-psr-state .uae-psr-mark .uae-psr-mark-pending .uae-psr-text .uae-psr-text-pending .uae-psr-meta` ·
`.uae-check .uae-check-count .uae-check-sub .uae-check-list .uae-check-item .uae-check-num .uae-check-cta .uae-check-cta-note` ·
`.uae-disclaimer .uae-disclaimer-inner`

목업 파일의 `.dv-*` / `.mk-*` 클래스는 **목업 셸 전용**입니다. 프로덕션에 옮기지 마십시오.
