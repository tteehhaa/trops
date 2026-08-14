# basis-split-s13 — Design

Plan: `docs/01-plan/features/basis-split-s13.plan.md`

---

## D-1. 배치표 (정본)

`test/landing-order-s9.test.js` 의 `LAYOUT` 상수가 이 표의 **코드판**입니다.
⚠️ 섹션을 넣거나 옮길 때 **이 표와 그 상수를 함께** 고치십시오.

| # | 섹션 | key | 배경 | 감정선 |
|---|---|---|---|---|
| 1 | 히어로 | `<section class="container hero">` | `bg` | 기 — 문제제기 |
| 2 | 경험담 + 모르시는게당연 | `<section class="stories-sec` | `surface` | 승 — 공감 |
| 3 | **무보 통계(단독)** | `<section class="trust"` | `dark` | 전 — 경고 |
| 4 | **상품소개 탭 3종** | `<section class="cards-sec" id="service"` | `bg` | 전 — 해결책 |
| 5 | **근거 (영국 OGL · 캡처)** 🆕 | `<section class="basis` | `surface` | 전 — 근거 |
| 6 | 결 CTA | `<section class="act"` | `bg` | 결 — 행동 |
| 7 | 안심문구 | `<section class="assure` | `surface` | — |
| 8 | HOW IT WORKS | `<section class="how" id="how">` | `bg` | — |
| 9 | 로드맵 | `id="next"` | `surface` | — |
| 10 | FAQ | `<section class="qna"` | `bg` | — |
| 11 | 마감 CTA | `<section class="close-cta` | `surface` | — |
| 12 | 사전등록 폼 | `<section class="interest"` | `bg` | — |
| 13 | 기관안내 | `<section class="orgs-sec` | `surface` | — |
| 14 | 푸터 | `<footer class="footer">` | `dark` | — |

### 배경 교차 — 연속 쌍이 **0** 이 됩니다

종전에는 「상품소개 → 결 CTA」 한 쌍이 의도된 연속(`bg → bg`)이었습니다.
사유는 「감정선과 무관한 기능섹션 없이 곧바로 행동으로 잇는다」였는데, 지시가 그 사이에
**감정선 안의** 근거 섹션을 넣습니다. 끼어드는 것이 기능섹션이 아니라 「전」의 마지막
조각이므로 원래 사유가 지키려던 것은 유지되고, 배경은 완전 교차가 됩니다.

```
bg  surface  dark  bg  surface  bg  surface  bg  surface  bg  surface  bg  surface  dark
```

⚠️ O7 단언을 `['상품소개 → 결 CTA']` → `[]` 로 갱신합니다. 다크 본문 섹션은 여전히
`.trust` 하나뿐입니다(O9 불변).

---

## D-2. `.trust` 를 어디서 자르는가

```html
<section class="trust">                    ← 남습니다 (다크 · 경고)
  <p class="stat-line reveal">거래처 한두 곳에…</p>
  <p class="stat-src  reveal reveal-late">— 한국무역보험공사</p>
</section>                                 ← .trust-detail 통째로 나갑니다
```

`.trust-detail`(h2 + 근거 3줄 + 캡처)이 새 `<section class="basis sec-surface">` 가 됩니다.

| 종전 | 새 이름 | 사유 |
|---|---|---|
| `.trust-detail` | **폐기** | 한마디와 디테일을 갈라 놓던 구획선입니다. 섹션이 갈렸으므로 구획선이 할 일이 없습니다 — 남기면 「왜 선이 두 번인가」가 됩니다 |
| `.trust-list` | `.basis-list` | 다크 전용 색(`--d-ink-*`)에서 밝은 섹션 색으로 |
| `.shot` / `.shot-caption` | `.basis-shot` / `.basis-cap` | 다크 헤어라인 액자 → `.feat-shot` 과 같은 **밝은 액자** |
| `.shot-stack` / `.shot-second` | **삭제** | 2026-08-14 에 단일 컷으로 되돌아가며 죽은 규칙입니다(index.html 한정 — en.html 은 아직 씁니다) |
| `id="trust-title"` | `id="basis-title"` | `.trust` 밖으로 나간 제목이 `trust-` 접두어를 달고 있으면 다음 사람이 섹션을 잘못 찾습니다 |

`.stat-line` · `.stat-src` · `.reveal` 계열은 **손대지 않습니다.**

### 왜 `.basis-shot` 이 `.feat-shot` 과 같은 액자인가

`landing-emphasis-s10` E10-a 가 「캡처는 정식 화면이 아니라 **참고 이미지**로 보인다」를
못질하고 있습니다(폭 상한 · 여백 · 테두리 · 그림자 · 액자 안 캡션). 근거 섹션의 캡처도
같은 성격이므로 같은 액자를 씁니다. 다만 **클래스는 따로** 둡니다 — E10-a 가
`figcaption.feat-cap` 을 **정확히 3개**(탭 3장)로 세기 때문입니다.

배경만 다릅니다: `.feat-shot` 은 `--bg` 섹션 위라 `--surface`, `.basis-shot` 은
`--surface` 섹션 위라 `--bg` 입니다. (O6 의 「배경을 직접 칠하지 마라」는 **섹션 배경**
규칙이고, 액자·카드 같은 「면」은 예외 목록에 있습니다 — `.basis-shot` 은 `--bg` 라
애초에 걸리지도 않습니다.)

---

## D-3. h2 — 문구를 바꾸지 않는 이유

```
탭1 요약 : 「… 공개된 서식과 하나씩 **비교**해서 다른 부분을 표시해 드립니다.」
            ↓  바로 다음 섹션
h2      : 「무엇을 근거로 **비교**하는지 밝힙니다.」
```

같은 낱말이 **주장과 근거**로 이어집니다. 종전에는 이 h2 가 상품소개보다 앞이라
「비교」가 가리킬 대상이 아직 없었습니다 — 재배치가 그 결손을 고칩니다.
⛔ 리드 문장을 새로 붙이지 마십시오. 앞 섹션의 마지막 문장이 이미 리드 역할을 합니다.

---

## D-4. 캡처 4장의 자리와 액자

| 자리 | 파일 | 크기 | 노출 |
|---|---|---|---|
| 탭1 수출 사전점검 | `c03-result.jpg` | 1383×904 | 기본 노출(첫 탭) |
| 탭2 바이어 확인 | **`buyer-guard.jpg`** 🆕 | 1512×1110 | `[hidden]` |
| 탭3 기한 관리 | `timeline-map.jpg`(액자 추가) | 1632×884 | `[hidden]` |
| 근거 섹션 | `c03-result-detail.jpg` | 1487×523 | 기본 노출 |

**기본 노출 이미지에 중복이 0** 입니다 → `landing-order-s9` O4-b 의
`ALLOWED_REUSE` 를 **빈 배열**로 되돌립니다(s11 이 남긴 예외가 닫힙니다).

### D-4-1. 톤 통일 — 창틀을 그립니다 (`scripts/frame-shot.py`)

`c03-result*.jpg` 는 macOS 브라우저 창틀(신호등 + 주소창)이 **이미지 안에** 찍혀 있고,
`timeline-map.jpg` 는 패널만 잘라 찍혀 있었습니다. 탭은 **같은 자리에서 그림만 바꾸므로**
창틀이 나타났다 사라지면 상품이 셋이 아니라 화면이 셋으로 보입니다.

그래서 `c03-result.jpg` 실측값을 정본으로 창틀을 그리는 도구를 만들었습니다.

| 항목 | 실측(폭 1383 기준) |
|---|---|
| 창틀 높이 | 57px (맨 아래 1px 구획선 포함) |
| 창틀 색 / 구획선 | `#E1E8F0` / `#CFD2D7` |
| 신호등 | 지름 14 · 중심 y=28 · x=26·48·70 · `#FF5C55` `#F9C234` `#30CD48` |
| 주소창 | x 98 ~ (폭−42) · y 13~43 · 반경 15 · 흰색 · 테두리 `#CFD2D9` |
| 주소 글자 | Menlo 14px · `#36353A` · 자물쇠 x=107 |

폭이 다르면 전부 `폭/1383` 으로 비례합니다. 세 캡처의 페이지 배경도 이미 같습니다
(`#F8FAFC` ±1).

⛔ **CSS 로 창틀 목업을 덧씌우지 마십시오** — `landing-emphasis-s10` E10-a 주석이 경고하는
「크롬 두 겹」이 그것입니다. 여기서는 **이미지 파일 안에** 굽습니다. 한 이미지에 창틀은
하나뿐입니다.
⛔ `img/c03-result.jpg` 에 이 도구를 다시 쓰지 마십시오 — 그 파일이 치수의 정본이고,
   이미 창틀을 갖고 있습니다.

### D-4-2. 바이어확인 캡처의 상호 치환

원본: `app.trops.kr/deals/cd479790-…/buyer-guard` (실재 프랑스 기업 · 공개 접근 가능).
캡처 직전 DOM 텍스트를 치환했습니다.

| 원본 | 캡처 |
|---|---|
| 실재 상호 | `ALPHA TRADING CO.` |
| 실재 EU VAT 번호 | `FR12345678901` |
| 실재 도메인 | `alpha-trading.example` |
| 실재 거래 UUID(주소창) | `1a4c7e02-5b93-4d18-9f60-c2e7a5d31b84` |

`c03-result*.jpg` 가 처음부터 가상 NDA(Alpha Trading Co./Beta Sourcing Inc.)로 만들어진
것과 **같은 규칙**입니다. 랜딩 캡션이 「가상의 거래로 만든 예시 화면」이라고 다시 밝힙니다.
⚠️ 실명이 든 캡처로 갈아 끼우지 마십시오 — 「제재·수출통제 추가 확인 필요」가 실명 기업에
   붙은 그림이 됩니다.

---

## D-5. 앵커 무결성 (지시 4)

이번 이동으로 **id 는 하나도 사라지지 않습니다.** 섹션이 통째로 옮겨질 뿐입니다.

| 앵커 | 출처 | 도착지 | 이동 영향 |
|---|---|---|---|
| `/#feat-timeline` | **발송된 결제확인 메일** (`api/_notify.js buildTimelinePreviewLink`) | 기한관리 **탭 버튼**(항상 보임) | 없음 — id 는 `.cards-sec` 안에서 함께 이동 |
| `/#service` | precheck.html 헤더 · index 헤더 | `.cards-sec` | 없음 |
| `/#how` | precheck.html 헤더 · index 헤더 | `.how` | 없음 |
| `/#interest` | precheck.html 하단 버튼 | `.interest` | 없음 |
| `#qna` | index 헤더 | `.qna` | 없음 |
| `#feats` | 옛 05 섹션의 외부·과거 링크 | 탭 줄 맨 위 | 없음 |
| `#trust-title` | **없음**(문서 내 `aria-labelledby` 전용) | → `#basis-title` 로 개명 | 외부 참조 0 이라 안전 |

`scroll-margin-top: 84px` 목록(`#how, #next, #interest, #service, #qna, #orgs`)과
`.tab { scroll-margin-top: 84px }` 는 그대로입니다. 새 섹션은 앵커 도착지가 아니므로
id 를 만들지 않습니다(쓰지 않는 id 를 남기지 않는다 — 이 파일의 규칙).

**검사로 못질**: `test/waiting-room-mail.test.js`(메일 링크 ↔ 실재 앵커) ·
`landing-flow-s9` 「메일 앵커가 항상 보이는 요소에 붙어 있다」 · `landing-order-s9` O8.
이번에 O8 에 **재배치 후에도 도착지가 각각 다른 섹션인가**를 더합니다.

---

## D-6. 검사 갱신 목록

| 파일 | 검사 | 변경 |
|---|---|---|
| `landing-order-s9` | `LAYOUT` | 근거 섹션 1줄 추가 · 순서 교체 |
| `landing-order-s9` | O2 | 「신뢰증명 → 상품소개」 → **「경고(무보) → 상품 → 근거」 3단** |
| `landing-order-s9` | O4-b | `ALLOWED_REUSE` → `[]` |
| `landing-order-s9` | O7 | 연속 쌍 `['상품소개 → 결 CTA']` → `[]` |
| `landing-order-s9` | 무손실 | 근거 3줄을 MUST 에 추가 |
| `landing-emphasis-s10` | E2 | `.trust` 안의 h2·`.trust-detail` 검사 → **분리됐는지** 검사 |
| `landing-emphasis-s10` | E4 | `.trust-list` → `.basis-list` · 구획선 검사는 섹션 분리로 대체 |
| `landing-emphasis-s10` | E5 | `<details>` 금지 대상 섹션을 `.basis` 로 |
| `naming-consistency` | 감정선 순서 | 「전」의 기준점을 `id="trust-title"` → `class="stat-line` |

⚠️ 검사를 **느슨하게** 바꾸는 변경은 하지 않습니다. E2·E4·E5 는 지키려던 뜻
(한마디가 먼저 · 근거는 접지 않는다 · 위계가 보인다)을 새 구조에서 다시 못질합니다.
