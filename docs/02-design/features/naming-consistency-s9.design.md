# Design — naming-consistency-s9

Plan: `docs/01-plan/features/naming-consistency-s9.plan.md`

## 1. 용어 정본 (이 표가 기준이다)

| 개념 | 국문 정본 | 영문 정본 | 생애주기 배지 |
|---|---|---|---|
| 문서 대조 (사전점검) | 문서 대조 | Document comparison | 거래 시작 전 / Before the deal |
| 바이어 확인 | 바이어 확인 | Buyer check | 거래 시작 전 / Before the deal |
| 기한 관리 | 기한 관리 | Deadline management | 거래 시작 후 / After the deal starts |
| 로드맵 상품 (확장판) | 거래 운영 | Trade operations | — |
| 로드맵 상품 (요약자료) | 확인 항목 요약 자료 | Item comparison sheet | — |

**배지 규칙**: `.feat-meta` / `.eyebrow-quiet` 의 배지 자리에는 **생애주기만** 넣는다.
개발상태(준비 중)도, 가격(지금은 무료)도 배지에 넣지 않는다. 개발상태는 실제로 못 쓰는
것에만(로드맵 `.rm-meta`), 가격은 본문에 쓴다.

> ⚠️ 「지금은 무료」는 흐름 md §4 Give/Get 이 요구하는 문면이므로 **사라지면 안 된다**.
> `#feat-timeline` 패널의 `.feat-desc` 가 계속 진다 — 배지에서 본문으로 옮기는 것뿐이다.

## 2. index.html 변경 (9건)

| # | 위치 | before | after |
|---|---|---|---|
| K1 | `:1132` nav | 트롭스 앱 살펴보기(준비중) | 트롭스 앱 미리보기 |
| K2 | `:1205-1214` `.assure` | 히어로 직하 | `.stories` 블록 **뒤**로 이동 |
| K3 | `:1231` 04 카드 01 eyebrow | 거래 시작 전 · NDA 비교 | 거래 시작 전 · 문서 대조 |
| K4 | `:1249-1250` 04 카드 02 | `<span class="badge-soon">준비 중</span>` + 거래 시작 후 · 거래 절차 트래킹 | 배지 삭제 + 거래 시작 후 · 기한 관리 |
| K5 | `:1257` 04 카드 02 버튼 | `<a href="#interest">알림 받기</a>` | `<button data-timeline-open>기한관리 미리보기</button>` |
| K6 | `:1225` 04 h2 아래 | — | 층위 구분 리드 1줄 신설 (`.cards-lead`) |
| K7 | `:1412` 05 바이어확인 meta | 거래 시작 전 · 준비 중 | 거래 시작 전 |
| K8 | `:1435` 05 기한관리 meta | 거래 시작 후 · 지금은 무료 | 거래 시작 후 |
| K9 | `:1586`,`:1591` 로드맵 desc | — | C-2/C-3 구분 문구 추가 |
| K10 | `:1964`,`:1967` 푸터 | 바이어 서류 사전 확인 | 수출 거래 확인과 기한 관리 |

### K2 — 안심문구 이동 (D)

흐름 md §1 감정선: 기(히어로) - 승(경험담) - 전(신뢰증명) - 결(행동).
현재 `.assure`(방어 문구)가 기와 승 **사이**에 끼어 감정이 붙기 전에 방어가 먼저 온다.

```
before                          after
  hero                            hero
  assure        ← 방어 먼저        how ┬ stories (경험담 좌우비교)
  cards-sec                           │ story-common (모르시는 게 당연)
  how ┬ stories                       └ assure   ← 감정 뒤 방어
      └ flow                      cards-sec
```

**이동 방식**: `.assure` 섹션을 통째로 옮기지 않는다. `#how` 안 `.stories` 바로 뒤에
넣으면 `--surface` 위에서 중앙정렬 블록이 되고, 04 카드가 `--bg` 라 `--bg/--surface`
교차가 유지된다. 독립 `<section>` 으로 빼면 04(`--bg`)와 #how(`--surface`) 사이에서
어느 배경을 골라도 한쪽 이웃과 같은 색이 된다 — `index.html:1266-1271` 이 `.stories` 에
대해 이미 내린 판단과 같은 이유다.

→ **결론: `.assure` 를 `<section>` 에서 `<div class="assure assure-inline">` 로 바꿔
`.stories` 바로 뒤 `#how` 안에 넣는다.** `h2#assure-title` 은 유지(id 참조 없음 확인 필요),
`aria-labelledby` 는 섹션이 아니게 되므로 제거.

⚠️ 「※ 법률 자문 서비스가 아닙니다」(`.assure-note`)는 블록과 **함께** 이동한다 —
페이지 어딘가에 반드시 남아야 한다는 제약을 이동으로 충족한다.

### K5 — 인라인 확장 (B-4)

`#feat-timeline` 패널은 페이지에 하나뿐이고 `[data-timeline-open]` 트리거가 공유한다
(index.html:1427-1429 가드). 04 카드는 **네 번째 트리거**가 되는 것이고, 패널을 복제하지
않는다. `.btn-secondary` 유지 — `<a>` 를 `<button type="button">` 으로 바꾸는 것이라
`.btn` 이 `<button>` 에도 걸리는지 CSS 확인 필요.

### K6 — 층위 구분 리드

```html
<p class="cards-lead">지금 쓸 수 있는 것부터 보여드립니다. 각각 무엇을 확인해 드리는지는
<a href="#feats">아래에서 하나씩 펼쳐</a> 보실 수 있습니다.</p>
```
04(무엇을 파는가) → 05(무엇을 확인하는가)로 넘기는 한 줄. 중복이 아니라 층위임을 문면화.

### K9 — 로드맵 구분 문구

```
01 확인 항목 요약 자료
   품목별 확인 항목을 근거와 함께 문서로 정리해 드립니다
   + 지금 하는 「문서 대조」와 다른 상품입니다 — 받으신 서류를 대조하는 것이 아니라,
     품목별로 무엇을 확인해야 하는지를 미리 정리한 자료입니다.

02 거래 운영
   계약이 성사된 뒤 통관·대금회수까지 거래 단위로 이어서 관리합니다
   + 지금 쓰실 수 있는 「기한 관리」의 확장판입니다. 기한 알림에 더해 통관·대금회수까지
     거래 단위로 이어 붙입니다.
```
⚠️ 가격·상품명은 `index.html:1570` 가드대로 손대지 않는다. 설명문만 덧댄다.

### K10 — 푸터 태그라인

| 파일 | 현재 | 통일값 |
|---|---|---|
| index.html `.footer-meta` | 바이어 서류 사전 확인 | 수출 거래 확인과 기한 관리 |
| precheck.html `.footer-meta` | 수출 거래 운영 | 수출 거래 확인과 기한 관리 |

3기능(문서대조·바이어확인·기한관리)을 아우른다: "확인"이 문서대조+바이어확인을,
"기한 관리"가 나머지를 받는다. `.footer-links` 의 `/precheck` 링크 라벨은 페이지
`<title>`(「바이어 서류 사전 확인」)과 맞춰야 하므로 **그대로 둔다** — 태그라인과
링크라벨은 역할이 다르다.

## 3. en.html 변경 (7건)

| # | 위치 | before | after |
|---|---|---|---|
| E1 | `:913-922` `.assure` | 히어로 직하 | `#how` 안 첫머리로 이동 |
| E2 | `:937` 04 카드 01 | Before the deal · NDA comparison | Before the deal · Document comparison |
| E3 | `:948-949` 04 카드 02 | COMING SOON 배지 + Trade procedure tracking | 배지 삭제 + After the deal starts · Deadline management |
| E4 | `:959` 04 카드 02 버튼 | `<a href="#interest">Get notified</a>` | `<button data-timeline-open>Preview deadline management</button>` |
| E5 | `:931` 04 h2 아래 | — | `.cards-lead` 신설 |
| E6 | `:1068` 로드맵 02 | Trade procedure tracking | Trade operations (+ 구분 문구) |
| E7 | `:1339` 푸터 | Buyer document pre-check | Export deal checks and deadlines |

### E1 — en.html 에는 `.stories` 가 없다

en.html 은 s9 이전 판이라 경험담 블록이 없다. D 의 의도("감정몰입 전에 방어문구를
마주치지 않게")를 en.html 에서 성립시키는 최소 조치는 **`.assure` 를 히어로 직하에서
떼어 `#how`(How it works) 안 첫머리로 옮기는 것**이다. 히어로 → 카드 → 이용방법 순으로
읽는 사람이 "무엇을 파는지"를 먼저 보고 방어문구를 만난다. 경험담 블록을 en.html 에
새로 이식하는 것은 이번 스코프가 아니다(번역 확정본 v2 에 원문이 없어 새로 지어내야 함).

### E4 — en.html 에는 05 아코디언이 없다

index.html 의 `#feat-timeline` 에 해당하는 패널이 en.html 에 없으므로, **카드 안에
자체 인라인 패널을 둔다**. 마크업·CSS 는 index.html 의 `.feat-panel` 슬라이드 패턴을
그대로 옮긴다(`grid-template-rows: 0fr → 1fr`).

```html
<div class="card feat" id="feat-timeline" data-open="0">
  ...
  <div>
    <button class="btn btn-secondary feat-btn" type="button"
            aria-expanded="false" aria-controls="feat-timeline-panel">Preview deadline management</button>
  </div>
  <div class="feat-panel" id="feat-timeline-panel">
    <div class="feat-panel-inner">
      <div class="feat-panel-pad">
        <p class="feat-hook">Do you know how many deadlines are hidden in a single contract?</p>
        <ul class="feat-pins"> France / United Arab Emirates / Vietnam </ul>
        <p class="feat-cap">Sample entries. Not real customer deals.</p>
      </div>
    </div>
  </div>
</div>
```
⚠️ `[ Get notified ]` 를 앱으로 보내지 않는다는 en.html:927 가드는 **여전히 유효**하다.
이 버튼은 앱으로 보내지 않고 그 자리에서 펼치기만 하므로 가드를 어기지 않는다.
⚠️ 히어로·마감 CTA 의 `Get notified about trade procedure tracking` 은 사전등록 폼으로
가는 **유일한** 진입로라 링크는 그대로 두고, 용어만 `deadline management` 로 맞춘다.
en.html 히어로에 [문의하기]·[미리보기] 3단 CTA 를 이식하는 것은 스코프 밖(보고).

## 4. precheck.html 변경 (3건)

| # | 위치 | before | after |
|---|---|---|---|
| P1 | `:7` meta description | 「바이어가 보낸 NDA, …」 | NDA → 「서류」 |
| P2 | `:10` og:description | (NDA 없음 — 확인 결과 이미 없음) | 무변경 |
| P3 | `:1000` `.footer-meta` | 수출 거래 운영 | 수출 거래 확인과 기한 관리 |

⚠️ `<title>`·`og:title`(「바이어 서류 사전 확인」)에는 NDA 가 없다 — 무변경.
⚠️ 접수 화면 **안**의 "NDA"(`:833` option, `:837` field-hint, `:721`)는 **유지**한다.
흐름 md §1 이 「접수 화면 안에서만 「현재는 NDA만 지원」으로 범위 명시」로 명시했다.
⚠️ 무료 플랜 블록(`:762-787`)·plan JS 는 **한 글자도 건드리지 않는다**.

## 5. 회귀 위험과 방어

| 위험 | 방어 |
|---|---|
| `test/landing-flow-s9.test.js` 가 `#feat-timeline` 실행버튼 **1개**를 단정 | 04 카드의 새 버튼은 `.feats` **밖**이라 `card('feat-timeline')` 슬라이스에 안 들어감 |
| `test/waiting-room-mail.test.js` 가 `.feat-hook` 문장 동일성 단정 | `.feat-hook` 문구 무변경 |
| 같은 테스트가 「지금은 무료」를 단정 | 대상은 메일 HTML. 랜딩 `.feat-desc` 의 「지금은 무료입니다」도 유지 |
| `.assure` 이동으로 `aria-labelledby` 깨짐 | `<section aria-labelledby>` 제거, `<h2 id>` 는 유지 |
| `verify-deployment.js` R1 검사 | 가격 문자열 무변경 |

## 6. 검증

1. `npm test` — baseline 322 pass 유지
2. `npm run build` — dist 생성 확인
3. 신규 테스트 `test/naming-consistency.test.js` — 용어표(§1)를 코드로 고정
