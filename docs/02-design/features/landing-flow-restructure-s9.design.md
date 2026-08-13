# landing-flow-restructure-s9 — 설계 (Design)

Plan: `docs/01-plan/features/landing-flow-restructure-s9.plan.md`

---

## 1. 섹션 배치표 (정본)

이 표가 이 사이클의 **정본**입니다. index.html `<main>` 의 자식 순서와 1:1 대응하고,
`test/landing-order-s9.test.js` 가 이 순서를 코드로 못질합니다.

| # | 요소 | 셀렉터 | 배경 | 감정선 | 비고 |
|---|---|---|---|---|---|
| 0 | 헤더 | `nav.nav` | `--bg` | — | `<main>` 밖 |
| 0' | 접수완료 배너 | `#intake-return` | `--accent-soft` | — | 기본 `hidden` |
| 1 | 히어로 | `section.hero` | `--bg` | **기** | |
| 2 | 경험담 + 「모르시는 게 당연합니다」 | `section.stories-sec` | `--surface` | **승** | 신설 섹션(승격) |
| 3 | 신뢰증명 | `section.trust` | `--surface-dark` | **전** | 페이지 유일 다크 본문 |
| 4 | **상품소개 통합** | `section.cards-sec#service` | `--bg` | | 04⊕05 |
| 5 | 결 CTA | `section.act` | `--bg` | **결** | md §1 이 지정한 연속 |
| 6 | 안심문구 | `section.assure` | `--surface` | | 신설 섹션(승격) |
| 7 | HOW IT WORKS | `section.how#how` | `--bg` | | 존치·이동 |
| 8 | 로드맵 | `section.how#next` | `--surface` | | |
| 9 | FAQ | `section.qna#qna` | `--bg` | | |
| 10 | 마감 CTA | `section.close-cta` | `--surface` | | |
| 11 | 사전등록폼 | `section.interest#interest` | `--bg` | | |
| 12 | 기관안내 | `section.orgs-sec#orgs` | `--surface` | | |
| 13 | 푸터 | `footer.footer` | `--surface-dark` | | `<main>` 밖 |

**교차 검산**: bg → surface → dark → bg → bg → surface → bg → surface → bg → surface →
bg → surface → dark. `#4→#5` 하나만 연속이고 나머지는 전부 교차합니다.

**nav 앵커 3종 도착지**: `#service` → #4, `#how` → #7, `#qna` → #9. 전부 살아 있습니다.

---

## 2. 상품소개 통합 섹션 설계

### 2-1. 구조

```
<section class="cards-sec" id="service" aria-labelledby="cards-title">   ← --bg
  <div class="container cards-inner">
    <h2 id="cards-title">거래를 시작하기 전에 한 번, 시작한 후에 한 번.</h2>
    <p class="cards-lead">…</p>
    <div class="feats" id="feats">                                        ← #feats 앵커 존치
      <div class="feat" id="feat-precheck" data-open="0">
        <button class="feat-btn" type="button" aria-expanded="false" aria-controls="feat-precheck-panel">
          <span class="feat-head">
            <span class="feat-meta">거래 시작 전</span>            ← 생애주기 (구 .eyebrow-quiet)
            <span class="feat-title">수출 사전점검</span>          ← 상품명 (용어 정본)
            <span class="feat-sum">…</span>                        ← 한 줄 요약 (구 .card-body)
            <span class="feat-avail">지금 쓸 수 있습니다</span>     ← 상태줄 (구 .card-title)
            <span class="feat-bullets"><span>· 로그인 없이 바로</span></span>  ← 구 .card-bullets
          </span>
          <span class="feat-chev">…</span>
        </button>
        <div class="feat-panel" id="feat-precheck-panel">…상세…</div>
      </div>
      … feat-buyer … feat-timeline …
    </div>
  </div>
</section>
```

**접힌 상태 = 옛 2층카드, 펼친 상태 = 옛 아코디언.** 한 상품 = 한 카드 = 한 번의 설명.

`<button>` 안이므로 블록 요소는 전부 `<span>` 입니다(`<p>` 를 넣으면 인터랙티브 콘텐츠
안 문단이 되어 브라우저가 DOM 을 재구성합니다). CSS 로 `display:block` 을 줍니다.

### 2-2. 3카드 내용 정본

| | 수출 사전점검 | 바이어 확인 | 기한 관리 |
|---|---|---|---|
| `.feat-meta` | 거래 시작 전 | 거래 시작 전 | 거래 시작 후 |
| `.feat-title` | 수출 사전점검 | 바이어 확인 | 기한 관리 |
| `.feat-avail` | 지금 쓸 수 있습니다 | 사전점검에 포함되어 있습니다 | 지금 둘러보실 수 있습니다 |
| `.feat-sum` | 받으신 NDA를 공개된 서식과 하나씩 비교해서 다른 부분을 표시해 드립니다. | 거래 상대가 실제로 있는 회사인지 공개된 정보를 기준으로 맞춰봅니다. | 거래 문서의 기한과 통관·외환 절차를 한 화면에 모아 남은 날짜로 보여드립니다. |
| `.feat-bullets` | · 로그인 없이 바로 | (없음) | · 계약서만 있으면 시작 / · 기한 7일 전, 1일 전 메일 |
| 패널 실행버튼 | **없음** | **없음** | `[계약 등록해보기]` btn-secondary → app.trops.kr |
| 패널 예시화면 | `c03-result-detail.jpg` | 없음(`.feat-note`) | `.feat-map` 자리표시 |

`.feat-avail` 3줄이 서로 다른 이유는 **상태가 실제로 다르기 때문**입니다 —
사전점검은 바로 쓰고, 바이어 확인은 사전점검 결과화면 안에서만 나오고, 기한관리는
미리보기까지가 무로그인입니다. 세 줄을 같게 만들면 셋 중 둘이 거짓이 됩니다.

⚠️ 바이어 확인의 「포함되어 있습니다」는 md §4 Give/Get 표가 지정한 표현입니다.
「무료」로 바꾸지 마십시오 — 덤처럼 보여 가치가 저평가됩니다.

### 2-3. 레이아웃

`.feats` 를 3열 그리드 → **1열 세로 목록**으로 바꿉니다.

| | 3열(현재) | 1열(신규) |
|---|---|---|
| 머리에 담을 정보 | 제목+생애주기 2줄 | 생애주기·제목·요약·상태·불릿 5요소 |
| 패널 안 스크린샷 폭 | 컨테이너의 1/3 | 컨테이너 전폭 |
| 접힌 높이 | 낮음 | 낮음(요약 1줄이라 유지) |

머리가 5요소로 무거워지면 3열에서는 카드 하나가 세로로 길어져 「카드」가 아니라
「기둥」이 됩니다. 1열에서는 좌(생애주기·제목·요약) / 우(상태줄·셰브론) 2단으로 펼쳐
한 줄 리듬이 살고, 패널의 결과지 캡처도 전폭으로 읽힙니다.

`.feat-btn` 내부 그리드:
```
[ .feat-head (1fr) ][ .feat-side (auto) ][ .feat-chev (20px) ]
        ↓ 720px 이하에서는 세로 1열로 접음
```

---

## 3. 색 토큰

```css
--surface:          #E6ECF3;   /* was #F1F5F9 */
--line-on-surface:  #CBD5E1;   /* 신설 */
```

| 쌍 | ΔL* | 판정 |
|---|---:|---|
| `--bg #FFFFFF` ↔ `--surface #F1F5F9` (구) | 3.65 | 안 보임 |
| `--bg #FFFFFF` ↔ `--surface #E6ECF3` (신) | **6.86** | 보임 |
| `--line #E2E8F0` on `--bg` | 8.24 | 기준 |
| `--line #E2E8F0` on `--surface #E6ECF3` | 1.38 | **선이 사라짐** |
| `--line-on-surface #CBD5E1` on `--surface` | **8.29** | 기준과 동일 무게 |

### 3-1. 적용 방식 — 커스텀 프로퍼티 재정의

```css
.sec-surface {
  background: var(--surface);
  /* --surface 위에서는 구획선을 한 단계 진하게. 하위 전체가 자동으로 따라옵니다 —
     규칙마다 --line-on-surface 를 손으로 갈아 끼우면 새 규칙이 추가될 때 빠집니다. */
  --line: var(--line-on-surface);
}
```

`.sec-surface` 를 붙이는 곳: `.stories-sec` · `.assure` · `#next` · `.close-cta` · `.orgs-sec`
(배치표 #2·#6·#8·#10·#12).

`background: var(--surface)` 를 **떼는** 곳: `#how` · `.act` · `.qna` · `.interest`
(배치표 #7·#5·#9·#11 — 전부 `--bg` 로 바뀜).

`--surface` 를 배경이 아니라 **면**으로 쓰는 곳(`.feat-shot` · `.feat-map` · `.badge-soon` ·
`a.rm-row:hover`)은 그대로 둡니다. 이들은 `--bg` 섹션 안에 있거나 hover 표식이라
교차와 무관하고, 값이 진해진 만큼 오히려 또렷해집니다.

---

## 4. 승격되는 두 블록

### 4-1. `.stories` → `<section class="stories-sec sec-surface">`

2026-08-13 주석이 「독립 `<section>` 으로 빼지 마십시오」라고 못질해 둔 블록입니다.
**그 금지의 사유가 이번 배치로 소멸합니다.**

- 옛 사유: 04 카드(`--bg`)와 `#how`(`--surface`) 사이에 끼는 자리라, 어느 배경을 골라도
  한쪽 이웃과 같은 색이 되어 교차가 끊긴다.
- 새 자리: 히어로(`--bg`)와 신뢰증명(`--surface-dark`) 사이. `--surface` 를 고르면
  **bg → surface → dark** 로 3단 교차가 오히려 완성됩니다.

주석을 지우지 않고 **왜 소멸했는지까지 적어** 갱신합니다.

### 4-2. `.assure.assure-inline` → `<section class="assure sec-surface">`

같은 사유로 같은 금지가 걸려 있었고, 같은 방식으로 소멸합니다. 결 CTA(`--bg`)와
HOW(`--bg`) 사이라 `--surface` 가 교차를 만듭니다.

`.assure-inline` 보정 클래스는 제거합니다(인라인이 아니게 되므로).
`.assure-note`(「※ 법률 자문 서비스가 아닙니다」)는 이 블록에 붙어 함께 이동합니다.

---

## 5. 사라지는 요소와 그 사유

| 요소 | 사유 | 그 역할은 어디로 |
|---|---|---|
| `.cards` 그리드 · `.card*` 마크업 | 카드가 아코디언 머리로 흡수 | `.feat-head` / `.feat-avail` / `.feat-sum` / `.feat-bullets` |
| 01 카드 `[비교해 보기 →]` | 주 CTA 는 히어로+결 2회 통일(md §1) | 결 CTA `.act` |
| 02 카드 `[기한관리 미리보기]` | 그 카드 자신이 아코디언 | `.feat-btn` |
| `.cards-lead` 의 `<a href="#feats">` | 넘길 「아래」 소멸 | — (문장은 존치) |
| `.feats-sec` 섹션 껍데기 + `WHAT WE CHECK` kicker + h2 | 통합으로 소멸 | `.cards-sec` h2 가 겸함 |
| `.trust` 의 `.shot-second` | 컷이 상품소개로 이동 | 사전점검 카드 패널 |
| `.badge-soon` CSS | 마크업이 이미 없음(2026-08-13 삭제) | — |

`.cards-sec` h2「거래를 시작하기 전에 한 번, 시작한 후에 한 번.」이 통합 섹션의 h2 로
남습니다. md §4-1 이 **이 h2 를 3분류 구조의 원문으로 지목**했으므로 정본입니다.
`.feats-sec` h2「무엇을 확인해 드리는지, 하나씩 펼쳐보세요.」는 리드(`.cards-lead`)로
내려 흡수합니다 — 「펼쳐보세요」라는 조작 안내가 카드 바로 위에 있는 편이 맞습니다.

---

## 6. 테스트 변경 설계

원칙: **삭제하지 않고, 같은 의도를 새 구조 위에서 다시 단정합니다.**

### 6-1. `test/naming-consistency.test.js` 갱신 6건

| 기존 단언 | 무엇을 지키려 했나 | 새 단언 |
|---|---|---|
| 04 카드가 05 와 같은 이름 (`거래 시작 전 · 수출 사전점검`) | 한 상품이 두 이름으로 불리지 않기 | 통합 섹션의 `.feat-title`×3 = 용어 정본, `.feat-meta`×3 = 생애주기 정본 |
| 04 두 카드 모두 상태줄(`.card-title`×2) | 배지를 지운 자리를 비워 두지 않기 | index: `.feat-avail`×3 / en: `.card-title`×2 (en 은 그대로) |
| 04 기한관리 버튼이 인라인 확장 | 페이지 이동이 아닐 것 | 기한관리 카드가 `.feat-btn` 으로 그 자리에서 펼쳐질 것 |
| `.cards-lead` + `href="#feats"` | 04·05 가 중복으로 안 읽히기 | `.cards-lead` 존치 + `#feats` 앵커 존치 + **04·05 두 섹션이 더는 없을 것** |
| 트리거 `>= 4` | 패널 1개를 여러 트리거가 공유 | 패널 1개 + 트리거 `>= 3` (04 카드분 소멸) |
| 안심문구가 경험담 뒤·HOW 앞 | 감정 붙기 전 선긋기 금지 | 안심문구가 **결 CTA 뒤·HOW 앞** |

### 6-2. `test/landing-order-s9.test.js` 신설

| ID | 단언 |
|---|---|
| O1 | `<main>` 섹션 순서가 §1 배치표와 정확히 일치 |
| O2 | 신뢰증명이 상품소개보다 **앞**에 있다 (감정선 전→결) |
| O3 | 상품소개 섹션이 **1개**다 — `.feats-sec` 껍데기가 없다 |
| O4 | 3상품 각각의 소개 블록이 페이지에 1개씩이다 |
| O5 | `--surface` ↔ `--bg` ΔL* ≥ 5.5 |
| O6 | `--surface` 섹션은 전부 `.sec-surface` 를 갖는다(선 토큰 누락 방지) |
| O7 | 배경이 연속인 이웃은 `상품소개→결` 한 쌍뿐이다 |
| O8 | nav 앵커 3종의 도착지가 존재한다 |
| O9 | 다크 본문 섹션은 페이지당 1회다 |

### 6-3. `test/landing-flow-s9.test.js`

`card()` 헬퍼와 3카드 단언은 구조가 유지되므로 **무변경**. 단 사전점검 카드의 예시화면이
`c03-result-detail.jpg` 로 바뀌므로 `src="/img/` 정규식은 그대로 통과합니다.

---

## 7. 무손실 대조표 (C4 채점 근거)

재배치 전 페이지에 있던 콘텐츠 블록과 새 자리. **버리는 문장은 §5 의 3개 CTA/링크뿐**이고,
그 셋은 전부 「가리킬 대상이 없어진 것」입니다.

| 옛 위치 | 콘텐츠 | 새 위치 |
|---|---|---|
| `.cards-sec` h2 | 거래를 시작하기 전에 한 번… | 통합 섹션 h2 (그대로) |
| `.cards-sec` 01 카드 본문·불릿·상태줄 | | `#feat-precheck` 머리 |
| `.cards-sec` 02 카드 본문·불릿·상태줄 | | `#feat-timeline` 머리 |
| `.feats-sec` h2 | 무엇을 확인해 드리는지, 하나씩 펼쳐보세요. | `.cards-lead` |
| `.feats-sec` 3패널 | 설명·예시화면·안내문·지도·버튼 | 그대로(통합 섹션 안) |
| `#how` `.stories` | 경험담 좌우비교·질문·모르시는 게 당연·예시 고지 | `.stories-sec` |
| `#how` `.assure` | 결정은 대표님 것·법률자문 아님 | `.assure` 섹션 |
| `#how` kicker/h2/flow/cta-row | HOW IT WORKS 3단계 | 그대로(자리만 이동) |
| `.trust` 전부 | 인용·출처·근거 3줄·캡처 | 그대로(자리만 이동, 캡처 1컷) |
| `.act` / `#next` / `.qna` / `.close-cta` / `.interest` / `.orgs-sec` | | 내용 무변경, 배경만 조정 |

인터랙션 무손실:
- 아코디언 3카드 클릭 확장 — 유지
- 동시 다중 펼침 — 유지
- `data-timeline-open` 원격 트리거 — 3곳(히어로·로드맵·마감CTA)에서 유지, 패널 1개 공유
- FAQ 14문항 아코디언 — 무변경
- `.reveal` 스크롤 등장 — 무변경
- 접수완료 배너 / 사전등록 폼 — 무변경
