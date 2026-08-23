# Design — landing-b3b-hero-sample-check (PRD v2.1 · B3-b)

| 항목 | 내용 |
|---|---|
| Plan | `docs/01-plan/features/landing-b3b-hero-sample-check.plan.md` |
| 정본 문구 | PRD §5-1 · §5-4 · §5-5 · §5-6 · §5-11 · §5-18 (**한 글자도 바꾸지 않습니다**) |
| 작성일 | 2026-08-23 |

## 1. 배치표 변경 — 짝수 삽입으로 하류를 건드리지 않는다

이 페이지는 `bg ↔ surface` **완전 교차**입니다(`test/landing-order-s9.test.js` O7 · 연속 쌍 0).
B3-a 가 섹션 하나(무료·유료)를 끼웠을 때 하류 다섯 행의 배경이 통째로 밀렸습니다.

이번에는 **두 개**를 끼웁니다. 짝수라서 **삽입 지점 아래가 한 칸도 움직이지 않습니다**.

```
  상품소개        bg        ← 그대로
+ 진단 가능 범위  surface    ← 신설 (.scope-sec.sec-surface)
+ 샘플            bg        ← 신설 (.sample-sec)
  무료·유료      surface    ← 그대로 (밀리지 않음)
  로드맵          bg        ← 그대로
  …
```

🔴 **자리 근거** — 상품소개가 「무엇을 해 주는가」를 말한 직후입니다.
진단 가능 범위가 「내 품목이 되는가」를, 샘플이 「그래서 무엇을 받는가」를 이어 답합니다.
그다음 무료·유료가 「얼마인가」를 답하므로, 네 섹션이 한 사람의 질문 순서와 같아집니다.
⛔ 둘 중 **하나만** 지우지 마십시오 — 홀수가 되는 순간 하류 다섯 행이 전부 뒤집힙니다.

## 2. 문구 이식 — 원문 대조표

| 대상 | 정본 | 마크업 |
|---|---|---|
| `.hero` | §5-1 | `.eyebrow` = 「해외 거래를 앞두고」 · `h1` 2행 · `.hero-lead` 3행 · `.cta-row` 2버튼 · `.hero-note` |
| `#how` | §5-4 | `.kicker` = 「HOW IT WORKS」 · `h2` 2행 · `.flow-row` ×3 · `.cta-row` 1버튼 |
| 탭① 패널 | §5-5 | `.feat-avail` · `.feat-sum` · `.feat-desc` · CTA. `<figure>` 는 **B3-a 산출물이라 유지** |
| `.scope-sec` | §5-6 | `h2` · `p` 3행 · 입력 폼 3요소 · `.scope-note` |
| `.sample-sec` | §5-11 | `h2` · 3열 구성표 · CTA · `.sample-note` 3행 |
| `check.html` S1~S3 · 블록3 | §5-18 | `<h2>` 3개 · 보기 17개 · 분기 2갈래 |

⚠️ 히어로 `.hero-note` 「* 계약서가 없어도 조회하실 수 있습니다 · 점검 결과 확인은 무료입니다」는
§5-1 원문의 마지막 줄입니다. 종전 「신용카드 없이 가입 · 진단 결과 저장 무료」를 대체합니다.

## 3. 링크 매핑 (PRD §6-1)

| 위치 | 라벨 | 목적지 |
|---|---|---|
| 히어로 1 | 무료로 시작하기 | `https://app.trops.kr/account/password` |
| 히어로 2 | 샘플 리포트 보기 | `/sample` |
| HOW 하단 | 무료로 시작하기 | `https://app.trops.kr/account/password` |
| 탭① | 수출 사전점검 시작하기 | `https://app.trops.kr/precheck` |
| 진단 범위 | 점검 범위 확인하기 | `https://app.trops.kr/precheck` (GET) |
| 샘플 | 샘플 리포트 보기 | `/sample` |
| `/check` 서류 있음 | 거래 등록하고 시작하기 | `https://app.trops.kr/procedures/new` |
| `/check` 서류 없음 | 무료로 사전점검 시작하기 | `https://app.trops.kr/precheck` |
| `/check` 문의 안내 | 문의하기 | `/?focus=inquiry#interest` |

> 🔴 히어로 CTA1 이 `/check` 에서 **앱 가입**으로 바뀝니다(§6-1 「히어로 1」).
> `id="hero-cta"` 는 그대로 둡니다 — `assets/track.js` 와 테스트가 이 id 로 클릭을 셉니다.

## 4. §5-6 입력 폼 — 왜 진짜 입력창인가

PRD §2 **P-4** 가 「커버리지를 목록이 아닌 **입력창**으로 처리」라고 정했습니다.
지원 품목이 P1 시점 1개(전동카트·전동차량)이므로 목록으로 보이면 그 1개가 곧 한계로 읽힙니다.

```html
<form class="scope-form" method="get" action="https://app.trops.kr/precheck">
  <input type="text" name="product" placeholder="수출 품목을 입력해 주세요">
  <select name="destination"> … 6 optgroup / 80 option … </select>
  <button type="submit">점검 범위 확인하기</button>
</form>
```

- 국가 목록은 **앱의 목적국 축과 같은 값**입니다(ISO-2). 원본은 `trops_a/lib/constants/countries.ts`
  이고, 이 파일은 그 값을 **비추기만** 합니다. 국가를 여기서 새로 만들지 마십시오.
- 🔴 **미결(보고 항목)**: 앱 `/precheck/diagnose` 는 지금 `?category=` 만 읽습니다.
  `product`·`destination` 쿼리를 읽는 것은 `trops_a` 후행 작업입니다. 그때까지 값은
  주소창까지만 갑니다 — 사용자가 적은 것이 화면에서 사라지지는 않습니다.
- ⚠️ 개인정보를 이 폼에 넣지 마십시오. 품목명·국가코드뿐이라 동의 대상이 아닙니다.

## 5. `check.html` — 문항 교체가 건드리는 여섯 자리

문항 값이 바뀌면 **화면은 멀쩡한 채 받는 쪽만 조용히 어긋납니다.** 아래 여섯을 한 배치에서 함께 고칩니다.

| # | 자리 | 구 → 신 |
|---|---|---|
| 1 | Q1 `<input name>` | `situation` → **`stage`** · 값 6개 전량 교체 |
| 2 | Q2 `<input value>` | `nda`·`sales_contract`·`quote_pi`·`service_license`·`other_doc`·`none` → `contract`·`quotation_pi`·`invoice_bl`·`insurance_policy`·`other`·`none` |
| 3 | Q3 `<input name>` | `experience` → **`management`** · 값 3개 → 5개 |
| 4 | `state` · `restore()` · `applySaved()` · `payload()` | 같은 세 이름 |
| 5 | `PLACE_OF` · `DOCTYPE_OF` | 아래 §5-1 |
| 6 | 블록3 두 갈래 | 라벨·목적지·보조문 교체 + 문의 안내 한 줄 신설 |

### 5-1. 위치 표시 매핑 — 임의 배정을 하지 않는다

블록2 의 세 칸은 문면이 이렇습니다: (1) NDA · (2) **견적서·PI·매매계약서** · (3) 유통·라이선스.

```js
var PLACE_OF = { contract: '(2)', quotation_pi: '(2)' };
```

- 이 둘만 **(2)번 칸이 이름으로 적고 있는 문서**입니다.
- `invoice_bl`(상업송장·B/L) · `insurance_policy`(무역보험 증권) 은 세 칸 어디에도 이름이 없습니다.
  `other` 와 함께 기존 미지 경로(「어느 자리인지는 서류를 봐야 알 수 있습니다」)로 보냅니다.
- ⛔ 없는 칸을 만들거나 임의 배정하지 마십시오 — 이 파일이 명시적으로 금지한 것이고,
  배정하는 순간 근거 없는 주장이 화면에 나갑니다.

### 5-2. `DOCTYPE_OF` 삭제

서류 보유 분기의 목적지가 랜딩 `/precheck` → **앱 `/procedures/new`** 로 바뀝니다.
`?pre=`·`?docs=` 를 읽는 쪽이 사라지므로 프리필 계산을 **함께 걷습니다**.

> 🔴 **퍼널 영향(보고 항목)** — `/check` 경유 접수의 `intake_id` 역기입
> (`trops_a/app/api/cron/precheck-prestep-link`)이 더 이상 발생하지 않습니다.
> `prestep_session` 행 자체는 그대로 쌓입니다(`stage`·`docs`·`management` 축).

### 5-3. 하위호환은 받는 쪽이 이미 갖고 있다

`trops_a/lib/precheck/prestep.ts` 가 신 어휘 3종을 **구 어휘 옆에** 두었고
(`PRESTEP_STAGES`·`PRESTEP_DOC_KINDS`·`PRESTEP_MANAGEMENTS`),
`formatOf()` 가 **값이 아니라 필드 이름**(`stage`/`management` ↔ `situation`/`experience`)으로 가릅니다.
→ 배포 순간 열려 있던 탭이 구 형식을 계속 보내도 그 세션의 계측이 끊기지 않습니다.
→ ⛔ 이 저장소에서 두 어휘를 섞어 보내지 마십시오. 한 세션은 한 형식입니다.

## 6. 샘플 페이지 2종

| 항목 | 처리 |
|---|---|
| 출처 | `trops_a/doc/self12/{sample,en-sample}.html` — **내용 무수정** |
| 등재 | `scripts/build-static.js` STATIC.html 에 `{file:'sample.html',locale:'ko'}` · `{file:'en-sample.html',locale:'en'}` |
| 경로 | `cleanUrls` 가 `/sample` · `/en-sample` 로 붙입니다 |
| `:root` | `--ink: #1f2937 → #0F172A` · `--brand: #075985 → #1D4ED8` **두 값만** |

`--ink-2`(#0f172a) · `--line`(#e2e8f0) 은 이미 랜딩과 같고, `--mut`·`--bg`·상태색 3쌍은
랜딩에 대응 브랜드 토큰이 없습니다 — 「브랜드 컬러가 다르면」의 범위 밖이라 두었습니다.
⛔ `:root` 밖 CSS 를 건드리지 마십시오(워터마크의 `rgba(7,89,133,.07)` 포함).

## 7. 게이트 (`scripts/check-b3b-gates.js`)

| # | 게이트 | 방법 |
|---|---|---|
| G1 | `/sample`·`/en-sample` 빌드 포함 | `npm run build` 후 `dist/` 존재 확인 |
| G2 | 히어로 CTA2 = `/sample` · `/en-sample` | 히어로 블록 안에서 href 대조 |
| G3 | 샘플 2종에 등급·위험 점수·「즉시 조치 필요」·"immediate action required" 0건 | 조각 조립 검색 |
| G4 | 예시 표기 3종 잔존(워터마크 · 상단 바 · 하단 고지) | 선택자·문구 존재 |
| G5 | `en-sample.html` 하단 CTA = `[Contact] → /en#interest` · 무료시작 계열 0 | 마지막 `.after` 블록 |
| G6 | 저장소 전체에서 **폐기된 산출물 명칭** 0건 | 추적 파일 전수 · 낱말은 게이트가 조각으로 조립 |
| G7 | `precheck.html`·`en-precheck.html` 가격·결제 diff 0줄 | baseRef 바이트 비교(B3-a G1 동일) |
| G8 | 국·영문 반영 | 국문 5종 + 영문(샘플 등재) |

⛔ G3 의 금지 문자열을 게이트 파일에 리터럴로 적지 마십시오 — G6 이 자기 자신을 잡습니다.

## 8. 하지 않는 것

- 영문 §5 문구 교체 (원본 부재 — Plan §4)
- `check.html` h1 「30초 사전 확인」 변경 (Plan §5 결정 3)
- 3탭 이미지 교체 (실제 캡처 · Plan §1 확인 5)
- `precheck.html`·`en-precheck.html` 가격·결제 (P-1 유효)
- Supabase · `trops_a` 코드
