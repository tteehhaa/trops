# Handoff: TROPS 랜딩페이지 (AI 수출 거래 운영 서비스)

## Overview
TROPS의 마케팅 랜딩페이지 리디자인. 타깃 독자는 일반 소비자가 아니라 **VC / B2B SaaS 투자자와 수출 중소기업 의사결정자**다. 페이지의 유일한 목적은 5초 안에 "TROPS는 기능 모음이 아니라, 하나의 수출 거래를 시작부터 대금 회수까지 운영하는 AI SaaS"라는 인상을 만드는 것. 따라서 구조가 기능 나열이 아니라 **거래(Transaction) 하나의 라이프사이클**을 따라간다.

톤 레퍼런스: Notion / Linear / Stripe / Rippling. 절대 피해야 하는 인상: 보험사, 관공서, ERP, 무역대행.

## About the Design Files
이 번들에 담긴 HTML은 **디자인 레퍼런스(프로토타입)** 다 — 의도한 레이아웃·색·타이포·인터랙션을 보여주기 위한 것이며, 그대로 프로덕션에 붙여 쓸 코드가 아니다.

작업 내용은 이 HTML을 **타깃 코드베이스의 기존 환경(React/Next.js, Vue, SwiftUI 등)에서 그 코드베이스의 관례와 라이브러리로 재구현**하는 것이다. 아직 프론트엔드 환경이 없다면, 프로젝트에 가장 적합한 프레임워크를 선택해 구현한다. 마크업 구조 자체(아래 문서화된 grid/flex 구조)는 그대로 옮겨도 되지만, 인라인 스타일은 그 코드베이스의 스타일링 방식(CSS Modules, Tailwind, styled-components 등)으로 옮긴다.

`TROPS 랜딩페이지.dc.html`은 프리뷰 런타임(`support.js`)에 의존한다. 브라우저에서 파일을 직접 열면 렌더된다. 템플릿 문법 주의:
- `{{ x }}` 는 값 바인딩 홀
- `<sc-for list="{{ steps }}" as="s">` 는 반복 (React의 `.map`)
- `<sc-if value="{{ flag }}">` 는 조건부 렌더
- 파일 하단 `<script data-dc-script>` 안의 `class Component`가 로직(히어로 타임라인의 스텝 배열/스타일 계산)

## Fidelity
**High-fidelity (hifi).** 색상 hex, 폰트, 사이즈, 라인하이트, 여백, hover 상태가 모두 최종값이다. 픽셀 단위로 재현할 것. 특히 다음은 브랜드 규정 사항이라 임의 변경 금지:
- 색상은 아래 Design Tokens의 5색(+경고색)만 사용
- 폰트는 Pretendard
- **금지: gradient, glassmorphism, box-shadow, green/teal/emerald 계열, 네온, 과한 일러스트, 복잡한 3D 아이콘**
- 카드 사용 최소화, 여백 넉넉히, 플랫 디자인, 모든 텍스트 flush-left(중앙정렬 금지)
- 아이콘이 필요하면 outline / simple line style만 (현재 디자인에는 아이콘이 없다 — 점·선만으로 타임라인을 그린다)

## Screens / Views

단일 스크롤 페이지, 6개 블록. 공통 컨테이너: `max-width: 1200px; margin: 0 auto; padding-inline: clamp(24px, 5vw, 64px)`.

### 1. Nav (sticky header)
- **Purpose**: 브랜드 각인 + 상시 CTA.
- **Layout**: `position: sticky; top: 0; z-index: 20; background: #FFFFFF; border-bottom: 1px solid #E2E8F0`. 내부: 컨테이너, `height: 64px; display: flex; align-items: center; gap: 40px`.
- **Components**:
  - 워드마크 `TROPS` — 19px / 700 / letter-spacing -0.02em / #0F172A.
  - 링크 그룹 — `display: flex; gap: 28px`, 각 14.5px / 500 / `rgba(15,23,42,.62)`. 텍스트: `작동 방식` (→ `#how`), `거래 흐름` (→ `#flow`), `문의` (→ `#start`).
  - 오른쪽 그룹 — `margin-left: auto; display: flex; align-items: center; gap: 12px`: 텍스트 링크 `관심 등록` (14.5px / 500 / `rgba(15,23,42,.62)`), 그리고 primary 버튼 `수출 시작하기` — `height: 36px; padding-inline: 16px; border-radius: 6px; background: #0369A1; color: #FFFFFF; font: 600 14.5px`. hover: `background: #02537F`.

### 2. Hero
- **Purpose**: 한 문장으로 제품 정의 + 오른쪽에서 "거래 하나"의 실제 진행 상태를 보여줌.
- **Layout**: `display: grid; grid-template-columns: minmax(0,1.02fr) minmax(0,0.98fr); gap: clamp(40px,6vw,88px); align-items: center; padding: clamp(56px,8vw,104px) 0 clamp(64px,8vw,112px)`.
- **좌측 컴포넌트 (위→아래)**:
  1. 아이브로우 — `수출 중소기업을 위한 AI 거래 운영 서비스`. 13.5px / 600 / letter-spacing .02em / **#0369A1** / `margin-bottom: 20px`.
  2. H1 — `수출 거래를` `<br>` `끝까지 운영합니다.` — `font-size: clamp(38px,4.6vw,58px); line-height: 1.16; letter-spacing: -0.035em; font-weight: 700; color: #0F172A`. 줄바꿈은 명시적(`<br>`).
  3. 리드 문장 — `바이어 확인부터 계약, 수출 절차, 대금 회수까지.` — 17.5px / 500 / line-height 1.72 / #0F172A / `white-space: nowrap` (**한 줄 유지 요구사항**; 좁은 폭에서 줄바꿈이 필요하면 폰트 크기를 줄이지 말고 이 문장만 별도 처리) / `margin-top: 24px`.
  4. 서브 문장 — `흩어진 거래 정보와 업무를 하나의 거래 흐름으로 연결하여, 거래 진행을 한눈에 관리합니다.` — 16.5px / line-height 1.76 / `rgba(15,23,42,.64)` / `max-width: 36ch` / `margin-top: 14px`.
  5. 버튼 행 — `display: flex; gap: 10px; flex-wrap: wrap; margin-top: 36px`, 버튼 높이 46px / `padding-inline: 22px` / `border-radius: 6px` / 15.5px 600:
     - Primary `수출 시작하기` — `background: #0369A1; color: #FFFFFF`; hover `#02537F`.
     - Secondary `관심 등록하기` — `border: 1px solid #E2E8F0; color: #0F172A; background: transparent`; hover `border-color: #94A3B8`.
- **우측 컴포넌트 — "거래 하나" Workflow Visualization** (이 페이지의 핵심 비주얼):
  - 패널: `background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 28px clamp(24px,3vw,36px) 30px`. **그림자 없음.**
  - 패널 헤더(옵션, prop `showTxnMeta`): `display: flex; justify-content: space-between; align-items: center; padding-bottom: 18px; margin-bottom: 22px; border-bottom: 1px solid #E2E8F0`.
    - 좌: `거래 TR-2026-0412 · 프랑스` — 13px / 600 / `rgba(15,23,42,.7)`.
    - 우: `AI 운영 중` — 12px / 600 / #0369A1, 앞에 6px 원형 점(#0369A1)이 `trops-pulse` 애니메이션(2.2s ease-in-out infinite, opacity 1 → .45 → 1)으로 깜빡인다.
  - 스텝 7개(순서 고정): `거래 생성`, `바이어 확인`, `계약`, `수출 절차`, `진행 추적`, `대금 회수`, `완료`.
  - 각 행: `display: grid; grid-template-columns: 16px minmax(0,1fr); gap: 16px`. 왼쪽 셀은 `position: relative; display: flex; justify-content: center; align-self: stretch` (**stretch 필수** — 연결선이 행 전체 높이를 타야 끊기지 않는다). 오른쪽 셀은 `display: flex; align-items: center; gap: 10px; padding-bottom: 20px; min-height: 22px`.
  - 연결선: 왼쪽 셀 안의 `position: absolute; width: 1px; background: #E2E8F0`. 첫 행 `top: 10.5px; bottom: 0`, 중간 행 `top: 0; bottom: 0`, 마지막 행 `top: 0; height: 10.5px` (10.5px = 점의 중심 오프셋). 결과적으로 첫 점 중심 → 마지막 점 중심까지 한 줄로 이어진다.
  - 점(상태별):
    - **완료된 단계** (index < active): 7×7px, `border-radius: 50%`, `background: #94A3B8`, `margin-top: 7px`.
    - **현재 단계** (active): 11×11px, `background: #0369A1`, `outline: 4px solid rgba(3,105,161,.12)`, `margin-top: 5px`.
    - **미래 단계**: 7×7px, `background: #F8FAFC` (패널 배경과 동일 — 선을 가림), `border: 1.5px solid #E2E8F0`, `margin-top: 7px`.
  - 레이블: 15.5px / letter-spacing -0.01em. 현재 단계만 `font-weight: 600; color: #0369A1`, 나머지는 `font-weight: 500; color: #94A3B8` (**"현재 진행 중인 단계만 브랜드 블루, 나머지는 light gray"** 규칙).
  - 현재 단계 옆 배지 `진행 중` — 11.5px / 600 / #0369A1 / `border: 1px solid rgba(3,105,161,.28); border-radius: 4px; padding: 2px 7px`.
  - 기본 active 단계는 4번(`수출 절차`).

### 3. HOW IT WORKS (`id="how"`, 타임라인 `id="flow"`)
- **Purpose**: 기능 소개가 아니라 "거래가 시작되면 AI가 무엇을 운영하는가"의 흐름. **동일 카드 5개 나열 금지 — 수직 타임라인.**
- **Layout**: 섹션 `border-top: 1px solid #E2E8F0`, 컨테이너 `padding: clamp(64px,8vw,112px) 0 clamp(56px,7vw,96px)`.
- **헤더**: 키커 `HOW IT WORKS` — 12.5px / 700 / letter-spacing .14em / **#94A3B8** / `margin-bottom: 18px`. H2 `거래가 시작되면 TROPS도 시작됩니다.` — `clamp(28px,3.2vw,40px)` / 700 / line-height 1.28 / letter-spacing -0.03em / `max-width: 24ch`.
- **타임라인** (`margin-top: clamp(44px,5vw,64px)`): 6개 행, 각 행 `display: grid; grid-template-columns: 16px minmax(0,1fr); gap: clamp(20px,3vw,32px)`; 왼쪽 셀 `position: relative; display: flex; justify-content: center; align-self: stretch`.
  - **행 1 — 엔드포인트 `거래 시작`**: 점 9×9px `#0369A1`, `margin-top: 2px`. 선 `top: 6.5px; bottom: 0`. 텍스트 14px / 700 / letter-spacing .1em / #0369A1 / `padding-bottom: 24px`.
  - **행 2~5 — 스텝**: 점 7×7px `background: #F8FAFC; border: 1.5px solid #94A3B8`. 선 `top: 0; bottom: 0`. 오른쪽 셀은 `border-bottom: 1px solid #E2E8F0`이 그려진 2열 그리드 `grid-template-columns: minmax(0,320px) minmax(0,1fr); gap: 8px clamp(24px,4vw,64px); align-items: baseline`.
    - 제목(h3): 21px / 700 / line-height 1.4 / letter-spacing -0.02em. 앞에 번호(옵션 prop `flowNumbers`) `01`~`04` — 14px / 600 / #94A3B8 / line-height 1.85, 제목과 `gap: 14px`.
    - 설명: 16.5px / line-height 1.76 / `rgba(15,23,42,.64)` / `max-width: 44ch`.
    - 스텝 내용(정확한 카피):
      1. `업무 생성` — 거래에 필요한 업무를 정리합니다. (오른쪽 셀 `padding: 0 0 40px`, 점 `margin-top: 11px`)
      2. `진행 추적` — 거래 진행 상황을 단계별로 추적합니다. (`padding: 40px 0`, 점 `margin-top: 51px`)
      3. `위험 확인` — 거래 진행 중 확인이 필요한 위험 요소를 알려드립니다. (동일)
      4. `전문가 연결` — 필요할 때 관세사·물류·금융 전문가와 연계할 수 있도록 안내합니다. (동일)
  - **행 6 — 엔드포인트 `거래 완료`**: 선 `top: 0; height: 38.5px`, 점 9×9px `#0369A1` `margin-top: 34px`, 텍스트 14px / 700 / letter-spacing .1em / #0369A1 / `padding-top: 30px`.
  - 참고: 점의 `margin-top`(11/51px)과 마지막 행의 38.5px는 각 행의 첫 줄 baseline에 점을 맞추기 위한 값이다. 재구현 시 프레임워크에 맞게 계산하되, **연결선은 반드시 끊김 없이** 첫 점 중심에서 마지막 점 중심까지 이어져야 한다(원본의 초기 버그 지점).

### 4. Emphasis statement (밴드)
- `background: #F8FAFC; border-top: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0`, 컨테이너 `padding-block: clamp(56px,7vw,88px)`.
- 문장 (명시적 줄바꿈 포함): `흩어진 거래 정보와 업무를 하나의 거래 화면으로 연결하여,` `<br>` `완료 될 때까지 거래 진행과 필요한 업무를 관리합니다.`
- `font-size: clamp(21px,2.5vw,30px); line-height: 1.58; letter-spacing: -0.025em; font-weight: 600; max-width: 36ch; color: #0F172A`.

### 5. CTA (`id="start"`)
- 컨테이너 `padding-block: clamp(72px,9vw,120px)`.
- H2 `TROPS, 먼저 만나보시겠어요?` — `clamp(30px,3.6vw,46px)` / 700 / line-height 1.24 / letter-spacing -0.035em.
- 보조 문장 `진행 중인 수출 거래 하나를 등록하면, 남은 단계와 필요한 업무를 정리해 보여드립니다.` — 16.5px / line-height 1.76 / `rgba(15,23,42,.64)` / `max-width: 38ch` / `margin-top: 20px`.
- 버튼 행: Hero와 동일한 두 버튼(`수출 시작하기`, `관심 등록하기`), `margin-top: 32px`.
- 톤: 마케팅 과장 금지 — 감탄사·이모지·"지금 무료로!" 류 금지.

### 6. Footer
- `border-top: 1px solid #E2E8F0`, 컨테이너 `padding-block: 32px`, `display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap`.
- 좌: `TROPS` 14px / 600. 우: `수출 거래 운영 · contact@trops.kr` 13.5px / #94A3B8.

## Interactions & Behavior
- **내비게이션**: 모두 같은 페이지 앵커(`#how`, `#flow`, `#start`). 스무스 스크롤을 붙여도 좋다(`prefers-reduced-motion: reduce`일 때 비활성화).
- **Hover**: primary 버튼/링크 `#0369A1` → `#02537F`; secondary 버튼 `border-color: #E2E8F0` → `#94A3B8`; 내비 텍스트 링크는 `rgba(15,23,42,.62)` → `#0F172A`. 트랜지션은 넣더라도 120–160ms `ease` 수준으로 절제.
- **Focus**: 키보드 포커스 링을 브라우저 기본 파란색으로 두지 말 것 — `outline: 2px solid #0369A1; outline-offset: 2px`.
- **애니메이션**: `AI 운영 중` 점의 펄스(2.2s, opacity 1↔.45)가 유일한 모션. 그 외 스크롤 애니메이션·패럴랙스 없음.
- **Selection**: `::selection { background: rgba(3,105,161,.14) }`.
- **Responsive** (현재 프로토타입은 데스크톱 우선, 재구현 시 아래 권장):
  - ≤ 900px: Hero 2열 → 1열(카피 위, 워크플로 패널 아래), 워크플로 패널 `width: 100%`.
  - ≤ 900px: HOW IT WORKS의 제목/설명 2열 → 1열(제목 위, 설명 아래), 왼쪽 타임라인 레일(16px)은 유지.
  - ≤ 640px: 내비의 중앙 링크 그룹 숨김(브랜드 + primary 버튼만), H1 `clamp` 하단값(38px) 사용, 리드 문장의 `nowrap` 해제 필요 여부 확인.
- **폼 없음** — CTA는 아직 앵커. 실제 구현 시 `수출 시작하기` = 가입/온보딩, `관심 등록하기` = 이메일 수집(1필드 + 제출). 에러/로딩 상태는 코드베이스 관례를 따르되 경고색은 `#DC2626`(사고 표시 전용).

## State Management
프로토타입에 실제 앱 상태는 없다. 컴포넌트 prop(디자인 툴의 tweak)은 3개:
| Prop | 타입 | 기본값 | 역할 |
| --- | --- | --- | --- |
| `activeStep` | int 1–7 | `4` | Hero 워크플로에서 현재 진행 중인 단계. 이보다 앞은 완료(회색 채움), 뒤는 미래(빈 점) |
| `showTxnMeta` | boolean | `true` | Hero 패널 헤더(거래번호 + `AI 운영 중`) 표시 |
| `flowNumbers` | boolean | `true` | HOW IT WORKS 스텝 번호(01–04) 표시 |

프로덕션에서 워크플로 패널을 실제 데이터로 구동한다면: `steps: {name, status: 'done'|'active'|'todo'}[]`, `transaction: {code, country}` 정도면 충분하다. 스텝 이름·순서는 도메인 상수로 고정.

## Design Tokens
색 (이 목록 외 색 사용 금지):
| 역할 | 값 | 용도 |
| --- | --- | --- |
| 텍스트 메인 | `#0F172A` | 제목, 본문, 워드마크 |
| 텍스트 보조 | `rgba(15,23,42,.64)` (문맥에 따라 .62 / .7) | 설명 문단, 내비 링크 — 메인 잉크의 투명도 변형이며 새 색이 아니다 |
| 악센트 | `#0369A1` | primary 버튼, 현재 단계, 아이브로우, 엔드포인트 |
| 악센트 hover/pressed | `#02537F` | primary 버튼 hover |
| 악센트 틴트 | `rgba(3,105,161,.12)` / `.28` / `.14` | 현재 단계 outline, 배지 보더, ::selection |
| 보조 | `#94A3B8` | 비활성 스텝 레이블·점, 키커, 푸터 메타 |
| 선 | `#E2E8F0` | 모든 구분선, 보더, 타임라인 레일 |
| 배경(면) | `#F8FAFC` | Hero 워크플로 패널, 강조 문장 밴드 |
| 배경(페이지) | `#FFFFFF` | body, 내비 |
| 경고 | `#DC2626` | **사고/위험 표시 전용** (현 페이지에는 미사용) |

타이포: **Pretendard** (`Pretendard Variable`, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif). CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css`. 프로덕션에서는 self-host 권장.

| 역할 | 크기 | 무게 | line-height | letter-spacing |
| --- | --- | --- | --- | --- |
| H1 | clamp(38px,4.6vw,58px) | 700 | 1.16 | -0.035em |
| H2 (섹션) | clamp(28px,3.2vw,40px) | 700 | 1.28 | -0.03em |
| H2 (CTA) | clamp(30px,3.6vw,46px) | 700 | 1.24 | -0.035em |
| 강조 문장 | clamp(21px,2.5vw,30px) | 600 | 1.58 | -0.025em |
| 스텝 제목 | 21px | 700 | 1.4 | -0.02em |
| 리드 문장 | 17.5px | 500 | 1.72 | 0 |
| 본문 | 16.5px | 400 | 1.76 | 0 |
| 스텝 레이블 | 15.5px | 500/600 | – | -0.01em |
| 버튼 | 15.5px (내비 14.5px) | 600 | – | 0 |
| 내비/메타 | 13.5–14.5px | 500/600 | – | 0 |
| 키커 | 12.5px | 700 | – | .14em |
| 엔드포인트 라벨 | 14px | 700 | – | .1em |
| 배지 | 11.5px | 600 | – | 0 |

여백/치수: 섹션 세로 패딩 `clamp(56px,7-9vw,88–120px)`, 컨테이너 좌우 `clamp(24px,5vw,64px)`, 컨테이너 폭 1200px, 그리드 gap `clamp(20–40px, 3–6vw, 32–88px)`, 버튼 높이 46px(내비 36px), 타임라인 레일 폭 16px(점 7/9/11px), 라인 두께 1px.

Radius: 버튼·패널 `6px`, 패널 `8px`, 배지 `4px`, 점 `50%`. **Shadow: 없음(전 페이지).** Gradient: 없음.

## Assets
이미지·아이콘·일러스트 **없음**. 모든 비주얼(타임라인, 점, 배지, 구분선)은 CSS 도형이다. 외부 의존성은 Pretendard 웹폰트 하나뿐. 아이콘을 추가해야 한다면 outline/line 스타일(예: Lucide) 1.5px stroke, `#0F172A` 또는 `#94A3B8`.

## Files
- `TROPS 랜딩페이지.dc.html` — 전체 랜딩페이지 디자인(마크업 + 인라인 스타일 + 히어로 타임라인 로직). 이 문서의 소스.
- `support.js` — 프리뷰 런타임(`{{ }}` / `<sc-for>` / `<sc-if>` 를 렌더). 디자인 파일을 브라우저에서 열어보기 위한 것이며 **프로덕션으로 옮기지 않는다.**
