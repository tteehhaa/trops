# cards-tabs-s12 — Design

Plan: `docs/01-plan/features/cards-tabs-s12.plan.md`

---

## D-1. 구조 — 탭 줄 + 패널 3개

```html
<div class="feats" id="feats">
  <div class="tabs" role="tablist" aria-label="상품 3종">
    <button class="tab" role="tab" id="feat-precheck" aria-controls="feat-precheck-panel"
            aria-selected="true"  tabindex="0">   <span class="feat-meta">거래 시작 전</span>
                                                  <span class="feat-title">수출 사전점검</span></button>
    …  feat-buyer  …  feat-timeline (aria-selected="false" tabindex="-1")
  </div>

  <div class="feat-panel" id="feat-precheck-panel" role="tabpanel"
       aria-labelledby="feat-precheck" tabindex="0">        <!-- 나머지 둘은 [hidden] -->
    <div class="feat-panel-pad">
      <div class="feat-body">  상태줄 · 요약 · 설명 · 불릿 · (안내문/실행버튼)  </div>
      <figure class="feat-shot"> <img> <figcaption class="feat-cap">…</figcaption> </figure>
    </div>
  </div>
</div>
```

### 🔴 탭 id 가 `tab-*` 가 아니라 `feat-*` 인 이유 — 이미 나간 메일

`api/_notify.js` 의 `buildTimelinePreviewLink()` 가 **`https://www.trops.kr/#feat-timeline`**
을 만들고, 그 링크가 실린 결제확인 메일이 이미 발송돼 있습니다
(`test/waiting-room-mail.test.js` 가 이 계약을 못질합니다).

그래서 `id="feat-timeline"` 은 **살아 있어야 하고, 항상 보이는 요소에 있어야** 합니다.

| 후보 | 판정 |
|---|---|
| 패널에 부여 | ⛔ 선택되지 않은 패널은 `[hidden]` — **앵커가 도착할 대상이 없어집니다** |
| 탭 버튼에 부여 | ✅ 탭은 언제나 보입니다 |

여기에 두 가지를 더했습니다:
- **`scroll-margin-top: 84px` 을 `.tab`(버튼)에** — 이 속성은 **스크롤 목표가 된 요소 자신**
  에만 듣습니다. 처음에 `.tabs`(줄)에 걸었더니 실측 도착 위치가 `top=0`, 즉 탭이 sticky
  nav(64px) **뒤에 깔렸습니다**. Check 단계에서 잡은 실제 결함입니다.
- **해시로 탭 열기** — 브라우저는 앵커까지 데려다줄 뿐 열려 있는 것은 첫 탭입니다.
  기한관리를 보러 온 사람에게 사전점검을 보여주게 되므로, 로드 시와 `hashchange` 에
  해당 탭을 선택합니다. 링크는 살아 있는데 엉뚱한 탭이 열리는 실패는 **화면이 깨지지
  않아서 가장 늦게 발견됩니다.**

---

## D-2. 왜 탭이 스크롤 문제를 「고치는」 게 아니라 「없애는」가

아코디언은 펼치면 카드가 전폭(`grid-column: 1 / -1`)이 되며 **줄이 재배치**됐습니다.
s11 은 그 뒤를 스크롤로 쫓아다녔습니다(`revealFeat`). 탭은 패널 자리가 고정입니다.

| | 아코디언(s11) | 탭(s12) |
|---|---|---|
| 전환 시 스크롤 | 260ms 뒤 보정 필요 | **델타 0px** |
| 탭/머리 위치 | 재배치로 이동(접으면 `top=-238`) | **불변(315px)** |
| 패널 가시율 1440×900 | 100 / 72.5 / 77% | **전부 한 화면**(아래끝 671·751·833 < 900) |
| 보정 코드 | `revealFeat` | **없음** |

⛔ 탭 전환에 스크롤 코드를 다시 넣지 마십시오 — 넣는 순간 「같은 영역에서 내용만 바뀐다」는
전제가 깨집니다.

---

## D-3. 기한관리 왼쪽 굵은 선 — **제거** (지시가 맡긴 판단)

**제거합니다.** 탭은 선택 상태를 스스로 표시하므로, 그 위에 굵은 선을 얹으면 s11 에서
걷어낸 혼동(「선택됨처럼 보인다」)이 탭 안에서 그대로 되살아납니다.

다만 그 선이 지고 있던 뜻 — **생애주기 축이 전 2 · 후 1 로 갈린다** — 은 지켜야 합니다.
**항상 보이는 두 가지**가 대신합니다:

| 대체물 | 설명 |
|---|---|
| 탭마다 붙는 `.feat-meta` | 「거래 시작 전 / 전 / 후」. 옛 카드에서는 **접힌 상태에서만** 보였는데 이제 항상 보입니다 |
| 탭 2↔3 의 빈 거터 | 3열 카드가 쓰던 `1fr 1fr [거터] 1fr` 트랙을 탭 줄이 그대로 물려받음. **실측 16px vs 54px** |

즉 **선을 지우되 뜻은 남기고, 오히려 더 자주 보이게** 했습니다.

⚠️ 거터는 **CSS 트랙**이지 DOM 요소가 아닙니다. `role=tablist` 안에 빈 `<div>` 를 넣으면
읽어주는 도구에 뜻 없는 요소가 잡히고 탭 관계가 깨집니다.

---

## D-4. 캡처 액자 — 「정식 화면」에서 「참고 이미지」로

세 가지를 **함께** 씁니다. 하나만 지키면 신호가 약해집니다.

| # | 조치 | 값 |
|---|---|---|
| ① | 폭 상한 | `max-width: 560px` (종전 전폭 1104px) |
| ② | 매트 액자 | 여백 10px + 1px 테두리 + `0 10px 28px rgba(15,23,42,.10)` |
| ③ | 캡션을 액자 안으로 | `<figure>` / `<figcaption>` — 이미지와 **0px** 간격 |

⛔ **브라우저 창 목업을 덧씌우지 않습니다.** `c03-result.jpg` · `c03-result-detail.jpg` 는
신호등 + 주소창이 **이미 이미지 안에 찍혀** 있습니다 — 또 두르면 크롬이 두 겹이 됩니다.

패널을 **본문 왼쪽 / 캡처 오른쪽 두 열**로 나눈 것도 같은 목적입니다. 캡처가 본문 옆
「참고 그림」 자리에 앉고, 패널이 낮아져 세 패널 모두 한 화면에 들어옵니다.
⚠️ 캡처를 왼쪽으로 옮기지 마십시오 — 읽는 순서가 그림부터가 되면 상태줄·요약이 그림의
캡션처럼 읽힙니다.

---

## D-5. 접근성과 JS 없는 환경

- **WAI-ARIA Tabs 패턴**: `role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls` ↔
  `aria-labelledby` 상호 참조, **roving tabindex**(0 / −1 / −1), ←→↑↓ · Home · End.
- 선택되지 않은 패널은 `[hidden]` 입니다 — `visibility` 와 달리 **감춘 패널의 링크·버튼이
  Tab 으로 잡히지 않습니다.**
- **JS 가 죽어도** 상품 이름 3개 + 첫 상품 패널 전체가 그대로 보입니다(실측 350자).
  옛 아코디언은 이름 3개만 보였으므로 **후퇴가 아니라 개선**입니다.
- 선택 표시에 `--accent` 를 쓰지 않습니다. 액센트는 「눌러서 어디론가 가는 것」의 색이고,
  탭 선택은 **현재 위치 표시**입니다. 페이지에서 파란 것은 CTA 뿐이어야 합니다.

---

## D-6. 검사 갱신 (9건 · 전부 사유 기록 + 변이 검사)

| 검사 | 종전 → 지금 |
|---|---|
| `E9` | `.feats` 4트랙 → **`.tabs`** 4트랙 |
| `E10` | 펼친 카드 전폭 → **패널 2열**(본문 + 최대 560px 캡처) |
| `E10-a` | **신설** — 액자 폭 상한 · 매트/테두리/그림자 · 캡션이 `<figure>` 안 |
| `E11` | 왼쪽 굵은 선 존재 → **선 제거 + 생애주기 축이 탭 줄에 남음 + 판정색 금지** |
| `E12` | `.feat-btn` 3개 → `role="tab"` 3개 (⚠️ `B` 로 셉니다 — CSS/JS 의 같은 문자열이 섞입니다) |
| `아코디언 슬라이드` | `0fr→1fr` 요구 → **금지** + `[hidden]` + `@keyframes tab-in` |
| `세 카드 같은 인터랙션` | `data-open`/`.feat-btn` → **탭 3종 ARIA 짝 + roving tabindex + 기본 노출** |
| `메일 앵커` | **신설** — `#feat-timeline` 이 `role=tab` 이고 `[hidden]` 이 아님 |
| `O4·O4-a·O4-b·인터랙션·조작안내` | 카드 `<div>` 슬라이스 → **탭 패널** 슬라이스 |

⚠️ 변이 검사에서 **캡처 폭 상한만 안 걸렸고**, 그래서 `E10-a` 를 신설했습니다.
검사가 형식만 통과하는지 확인하지 않으면 이런 구멍이 남습니다.
