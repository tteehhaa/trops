# landing-psych-track-a Design Document

> **Project**: main_web_page (TROPS 랜딩)
> **Date**: 2026-08-13
> **Plan**: `docs/01-plan/features/landing-psych-track-a.plan.md`
> **Spec (결정 원본)**: `doc/s9/TROPS_user_flow_2026-08-13.md`
> **Visual Spec**: `docs/design-master/trops_landing_visual_spec_v1.md`
> **Status**: Approved (체크포인트 3 사용자 지시로 자동승인)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 랜딩에 자각 유도 장치가 없어 "이미 의문 있는 고객"만 전환된다 |
| **WHO** | 첫 수출 앞둔 한국 중소기업 대표 (거래처 1~2곳, 무역서류 경험 없음) |
| **RISK** | 플레이스홀더 사례 오독 / 배경 교차 리듬 붕괴 / 히어로 확정본 훼손 |
| **SUCCESS** | Check 90점 이상 (토큰20 · 리듬20 · 스코프30 · 반응형15 · 보존15) |
| **SCOPE** | index.html 단일 파일 + api/leads.js optional 필드 1개 |

---

## 1. Overview

### 1.1 Design Goals

1. 신규 콘텐츠 6종을 **기존 토큰·컴포넌트·타이포 스케일만으로** 구성한다 (리터럴 색상 0건)
2. 배경 교차(`--bg`/`--surface`)와 `--surface-dark` 본문 1회 상한을 깨지 않는다
3. 주 CTA 를 페이지당 2회로 되돌리되 기존 클릭 경로는 강등으로 보존한다
4. `<title>`/메타에서 "NDA" 를 제거해 자료제출 방어기제를 해제한다

### 1.2 Design Principles

- **강등 > 삭제**: 남는 주버튼은 지우지 않고 `btn-secondary`/`btn-text` 로 내린다
- **삽입 > 신설**: 배경 리듬을 깨는 신규 섹션 대신 기존 섹션 내부 블록으로 넣는다
- **단일 패널**: 기한관리 미리보기 패널은 페이지에 하나만 두고 여러 트리거가 공유한다
- **주석에 근거를 남긴다**: 이 레포의 최강 관례. 신규 블록도 "왜 이 값인지 · 무엇을 하지 말 것인지"를 남긴다
- **금지 어휘 준수**: 자문·판단·검토·평가·진단 (§4-7 금지 동사 5) / "판단하지 않습니다"는 전면 카피에서 제외(§4-1) / "무료"는 기한관리에만, 바이어확인은 "포함"

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| | **A — 최소변경** | **B — 완전분리** | **C — 실용균형 (선택)** |
|---|---|---|---|
| 경험담·무지 블록 | `#how` 내부 삽입 | 독립 섹션 2개 신설 | **`#how` 내부 삽입 (1개 래퍼 `.stories` 안에 2블록)** |
| 핵심기능 아코디언 | 기존 `.cards-sec` 확장 | 독립 섹션 + 별도 CSS 체계 | **독립 섹션 `.feats-sec`, 기존 `.card`/`.qbtn` 패턴 차용** |
| 결 섹션 | 신설 없이 `.close-cta` 재활용 | 신설 | **신설 `.act`** |
| 기한관리 패널 | 히어로에 직접 인라인 | 트리거별 패널 복제 | **아코디언 카드 1곳 공유 + `[data-timeline-open]` 트리거** |
| 문의 채널 | mailto | 신규 모달 + 신규 API | **기존 `#interest` 폼 + optional `purpose`** |
| 섹션 수 | 10 (변동 없음) | 14 | **12** |
| 배경 교차 | 유지 | **붕괴** (bg→bg 2곳 발생) | **완전 유지** |
| 신규 CSS 라인 | ~90 | ~300 | ~210 |
| 위험 | 아코디언이 2층카드와 뒤섞여 "무엇을 파는가"가 흐려짐 | 리듬 붕괴 + 유지보수 이원화 | 낮음 |
| 스코프 충족 | 부분 (결 섹션 미충족 → 주버튼 3회) | 전체 | **전체** |

**선택: C.** A는 "결" 섹션을 만들지 않아 주버튼 위계 요구(FR-11/12)를 못 채우고, B는 채점표 20점 항목인 배경 리듬을 스스로 깬다. C는 신규 섹션을 2개로 억제해 `surface → bg → dark → surface → bg` 완전 교차를 유지한다.

### 2.1 최종 섹션 배치와 배경

| # | 섹션 | 배경 | 변경 |
|---:|---|---|---|
| — | `nav.nav` 헤더 | `--bg` | — |
| 1 | `.hero` | `--bg` | **`.cta-row` 교체** (h1·lead·note 무수정) |
| 2 | `.assure` 안심문구 | `--surface` | — |
| 3 | `.cards-sec#service` 2층카드 | `--bg` | 카드01 CTA `primary→secondary` |
| 4 | `.how#how` HOW | `--surface` | **`.stories` 삽입(S1+S2)** · 하단 CTA `primary→text` |
| 5 | **`.feats-sec#feats` 핵심기능 3분류** | **`--bg`** | **신설 (S4)** |
| 6 | `.trust` 신뢰 | `--surface-dark` | **통계블록 삽입 (S3)** |
| 7 | **`.act` 결** | **`--surface`** | **신설 (S5)** |
| 8 | `.how#next` 로드맵 | `--bg` | **기한관리 훅 추가** |
| 9 | `.qna#qna` FAQ | `--surface` | — (무수정) |
| 10 | `.close-cta` 마감CTA | `--bg` | **주버튼 제거, 보조 2개** |
| 11 | `.interest#interest` 폼 | `--surface` | **목적 선택 추가** |
| 12 | `.orgs-sec#orgs` 기관 | `--bg` | — |
| — | `footer.footer` | `--surface-dark` | — |

교차 검증: `bg, bg, surface, bg, surface, bg, dark, surface, bg, surface, bg, surface, bg, dark`
→ 인접 동색 0건 (헤더+히어로는 기존과 동일한 의도적 연속). `--surface-dark` 본문 1회(`.trust`) + 푸터. ✅

### 2.2 Data Flow

```
[data-timeline-open]  (히어로 · 마감CTA · 로드맵 3곳)
        │  click
        ▼
featAccordion IIFE ── setOpen('#feat-timeline', true) ──▶ .feat-panel  grid-template-rows 0fr→1fr
        │                                                  (지도 샘플 + [계약 등록해보기])
        └── scrollIntoView({block:'center'}) + focus(.feat-btn)
            ※ 페이지 이동 없음 = FR-09 "인라인 확장" 충족

[data-purpose="inquiry"]  (문의하기 2곳)
        │  click
        ▼
formPurpose IIFE ── radio[name=purpose][value=inquiry].checked = true
        │            submitBtn.textContent = '문의 보내기'
        └── 앵커 기본동작으로 #interest 이동
                    │  submit
                    ▼
            POST /api/leads  { name, email, company, purpose?, consent* }
                    ▼
            Resend → contact@theo-ne.com (제목·본문에 목적 표기)
```

### 2.3 Dependencies

신규 의존성 0. 외부 라이브러리·빌드 단계 추가 없음. `package.json` 무변경.

---

## 3. Data Model

DB 변경 없음. **Supabase 스키마 마이그레이션 없음** — `api/leads.js` 는 Resend 메일 전송 전용이며 저장소를 쓰지 않는다(`api/leads.js:6-11` 주석).

---

## 4. API Specification

### 4.1 Endpoint List

| Method | Path | 변경 |
|---|---|---|
| POST | `/api/leads` | **optional `purpose` 필드 추가** |

### 4.2 `POST /api/leads`

```
Request (변경 후)
{
  name: string            (required)
  email: string           (required, EMAIL_RE)
  company?: string
  purpose?: 'tracking' | 'inquiry'    ← 신규. 미전송 시 'tracking' 취급
  consentPrivacy: true    (required, === true)
  consentMarketing?: boolean
}
```

| 규칙 | 값 |
|---|---|
| 화이트리스트 | `'tracking'` \| `'inquiry'` 외 값은 **거부하지 않고 `'tracking'` 으로 폴백** — 목적 표기가 접수 자체를 막아선 안 된다 |
| 하위호환 | `en.html` 은 `purpose` 를 보내지 않음 → 기존 동작 그대로 200 |
| 메일 반영 | 제목 `[TROPS] 문의 - {name}` / `[TROPS] 관심 등록 - {name}` 분기, 본문에 `목적` 행 추가 |

**Breaking change 없음.** 기존 테스트가 `purpose` 없이 호출하므로 회귀 0 예상.

---

## 5. UI/UX Design

### 5.1 S1 — 경험담 좌우비교 (`#how` 내부)

```
┌ .stories ─────────────────────────────────────────────┐
│ .eyebrow-quiet   먼저, 있었던 이야기부터              │
│ ┌ .story-cmp (grid 1fr 1fr) ────────────────────────┐ │
│ │ .story-side              │ .story-side.is-case    │ │
│ │ .story-label             │ .story-label           │ │
│ │  처음엔 이렇게 생각하셨습니다 │  그런데 실제로는       │ │
│ │ .story-quote (20px/600)  │ .story-body (16.5px)   │ │
│ │  "표준 양식이겠지,        │  분쟁이 생기면 상대     │ │
│ │   다들 이렇게 쓰니까."    │  국가 법원에서 …        │ │
│ └──────────────────────────┴────────────────────────┘ │
│ .story-ask (h3 스케일)  이 조항, 본 적 있으신가요?    │
│ .story-note  ※ 이해를 돕기 위한 예시입니다…           │
└───────────────────────────────────────────────────────┘
  ─────── hairline (--line) ───────
│ .kicker  HOW IT WORKS   ← 기존 블록 그대로 이어짐
```

**확정 카피**

| 요소 | 텍스트 |
|---|---|
| eyebrow | `먼저, 있었던 이야기부터` |
| 좌 label | `처음엔 이렇게 생각하셨습니다` |
| 좌 quote | `"표준 양식이겠지, 다들 이렇게 쓰니까."` |
| 우 label | `그런데 실제로는` |
| 우 body | `분쟁이 생기면 상대 국가 법원에서 다투기로 적혀 있었습니다. 소송을 하려면 그 나라까지 가야 한다는 뜻이었는데, 서명할 때는 그 한 줄을 아무도 읽지 않았습니다.` |
| 마무리 질문 | `이 조항, 본 적 있으신가요?` |
| 캡션 | `※ 이해를 돕기 위해 만든 예시입니다. 특정 기업의 실제 사례가 아닙니다.` |

- 우측은 **관할조항** 사례 (사용자 지시). 평가어(위험·불리·문제) 미사용 — 조항이 무엇이라 적혀 있었고 그 뜻이 무엇인지만 서술
- 코드주석 `TODO-REAL-CASE` 필수

### 5.2 S2 — "모르시는 게 당연합니다" (`.stories` 내부, S1 바로 아래)

| 요소 | 텍스트 |
|---|---|
| 제목 (`.h3` 재사용) | `모르시는 게 당연합니다.` |
| 본문 (스펙 지정, 그대로) | `관할조항을 처음 들어보신 대표님도 계셨고, 손해배상 조항에 상한선이 없다는 걸 계약 체결 후에 알게 되신 분도 계셨습니다. 첫 수출이라면 원래 다 낯선 것들입니다.` |

- S1 과 같은 `.stories` 래퍼 안, `.story-common` 블록으로 붙인다 (FR: "붙여서 배치")
- `TODO-REAL-CASE` 주석

### 5.3 S3 — 신뢰 통계블록 (`.trust` 내부, h2 직하)

| 요소 | 클래스 | 텍스트 / 값 |
|---|---|---|
| 문장 | `p.h3.stat-line` | `거래처 한두 곳에 매출이 집중된 수출 초기 기업은, 대금 미회수 단 한 번으로 자금난에 빠질 수 있습니다.` |
| 출처 | `p.stat-src` | `— 한국무역보험공사` |

- `.h3` 전역 규칙(28px/600/1.35/−0.025em) 재사용 → 신규 타이포 값 0. `--d-ink-primary` 로 색만 덮음
- 출처는 `--d-ink-tertiary` (5.23:1, AA 통과)
- **카운트업 없음** (사용자 지시). 정확한 %가 없어 문장형 유지
- 기존 `.trust-list` 3줄 · 캡처 2컷 무수정. 기존 "카운터 자리 비워둠" 주석은 **L-1 해소**로 갱신
- `<figure>/<blockquote>` 대신 `<p>` 2개 — 기존 `.trust-list` 가 `<p>` 체계라 일관

### 5.4 S4 — 핵심기능 3분류 아코디언 (신설 `.feats-sec`)

```
┌ .feats-sec (--bg, border-top) ───────────────────────┐
│ .kicker  WHAT WE CHECK                               │
│ h2  무엇을 확인해 드리는지, 하나씩 펼쳐보세요.        │
│ ┌ .feats (grid 3col) ───────────────────────────────┐│
│ │ .feat#feat-precheck │ .feat#feat-buyer │ .feat#feat-timeline
│ │  button.feat-btn    │  ...             │  ...      ││
│ │   .feat-title  문서 대조                           ││
│ │   .feat-meta   거래 시작 전                        ││
│ │   .feat-chev   ▾ (--muted, rotate 180 on open)     ││
│ │  .feat-panel  (grid-template-rows 0fr→1fr)         ││
│ │   .feat-panel-inner (overflow:hidden)              ││
│ └────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

| 카드 | id | title / meta | 확장 내용 | 실행버튼 |
|---|---|---|---|---|
| 사전점검 | `feat-precheck` | `문서 대조` / `거래 시작 전` | 설명 + 예시화면(`/img/c03-result.jpg` 재사용) | **없음** (FR-06 · 결 섹션 CTA와 중복 방지) |
| 바이어확인 | `feat-buyer` | `바이어 확인` / `거래 시작 전 · 준비 중` | 설명 + `.feat-note` 안내 | **없음** (FR-07) |
| 기한관리 | `feat-timeline` | `기한 관리` / `거래 시작 후 · 지금은 무료` | 훅 + 지도 샘플 + 설명 | `[계약 등록해보기]` **`btn-secondary`** → `https://app.trops.kr/` |

**확정 카피**

| 위치 | 텍스트 |
|---|---|
| 사전점검 설명 | `받으신 서류를 공개된 표준 서식과 항목별로 맞춰보고, 다른 부분의 위치를 표시해 드립니다. 확인하신 시점도 함께 기록해 둡니다.` |
| 바이어확인 설명 | `거래 상대가 실제로 있는 회사인지, 공개된 정보를 기준으로 맞춰봅니다.` |
| 바이어확인 안내 | `사전점검 결과화면에서 바로 확인하실 수 있습니다.` |
| 기한관리 훅 | `계약서 하나에 기한이 몇 개나 숨어있는지 아세요?` |
| 기한관리 설명 | `계약서에 적힌 기한과 통관·외환 절차를 한 화면에 모아 남은 날짜로 보여드립니다. 기한 7일 전과 1일 전에 메일로 알려드립니다. 지금은 무료입니다.` |
| 지도 캡션 | `실제 기한관리 화면입니다. 표시된 거래는 예시 데이터입니다.` |

**⚠️ 에셋 갭**: `img/` 에는 `c03-result.jpg` · `c03-result-detail.jpg` 뿐이고 app.trops.kr 대시보드 세계지도 캡처가 **없다**. 깨진 `<img>` 를 내보내지 않기 위해 `.feat-map` 을 토큰 기반 자리표시 `<figure>`(`--surface` 배경 + `--line` 테두리 + 안내문)로 구현하고, 실제 캡처 확보 시 `<img>` 한 줄로 교체하도록 `TODO-ASSET` 주석과 대기 마크업을 함께 둔다. **핀 순차 애니메이션도 에셋 종속이라 함께 보류** (스펙 §"다이나믹함" 2번).

**인터랙션 (3장 동일 — FR-05)**
- `button.feat-btn` + `aria-expanded` + `aria-controls`
- 슬라이드: `.feat-panel { grid-template-rows: 0fr; transition: grid-template-rows .24s ease, visibility .24s; visibility: hidden }` → `[data-open="1"]` 에서 `1fr` / `visible`
- `visibility: hidden` 으로 접힌 패널 내부 포커스 차단 (접근성)
- **동시 다중 펼침 허용** — 기존 FAQ(C-3 "하나만 열리는 방식 금지")와 같은 정책
- 기본값 전부 접힘. JS 실패 시에도 제목 3개는 보임
- ⚠️ 기존 FAQ 아코디언(`display:none` 방식)은 **무수정** — 별 IIFE·별 셀렉터

### 5.5 S5 — CTA 재정비

**주버튼 인벤토리 (before → after)**

| 위치 | before | after | 근거 |
|---|---|---|---|
| 히어로 | `btn-primary btn-full` 비교해 보기 | **유지** | 주 1/2 |
| 카드01 | `btn-primary` 비교해 보기 → | `btn-secondary` | 강등(경로 보존) |
| `#how` 하단 | `btn-primary` 비교해 보기 | `btn-text` | 섹션 내 이동 위계 |
| **결(신설)** | — | `btn-primary btn-full` 비교해 보기 | 주 2/2 |
| 마감CTA | `btn-primary btn-full` 비교해 보기 | **제거** | FR-11 |
| `#interest` 제출 | `btn-primary` (submit) | **유지** | 폼 제출은 페이지 CTA가 아니라 폼 내부 최강 요소. 주석으로 명시 |

**히어로 `.cta-row`**
```
[비교해 보기]  btn-primary btn-full   → /precheck
[문의하기]     btn-secondary btn-full → #interest  (data-purpose="inquiry")
 기한관리 미리보기  btn-text          → [data-timeline-open]  (button, 페이지이동 없음)
.hero-note  로그인 없이 바로   ← 무수정
```

**마감CTA `.close-cta`**
```
h2  확인이 더 필요하시면, 편하게 물어보세요.   ← 교체
[문의하기]     btn-secondary btn-full → #interest (data-purpose="inquiry")
 기한관리 미리보기  btn-text          → [data-timeline-open]
.close-cta-note  보내주시면 순서대로 메일로 회신드립니다.   ← 교체
```
> h2 교체 근거: 주버튼을 뺀 뒤 "점검하세요"만 남으면 실행 수단 없는 명령이 된다. 금지 동사 5(자문·판단·검토·평가·진단) 미사용. 기존 h2 도 2026-08-13 에 한 번 교체된 이력이 있어 확정본 원문 가드 대상이 아니다.

**결 섹션 `.act`** (`--surface`, `.close-cta-inner` 와 같은 중앙정렬 구조)
```
h2  받으신 서류부터, 하나 확인해 보세요.
[비교해 보기]  btn-primary btn-full → /precheck
.act-note  로그인 없이 바로
```

**로드맵 `#next`** — `.rm` 뒤에 훅 추가
```
.rm-hook  계약서 하나에 기한이 몇 개나 숨어있는지 아세요?
[기한관리 미리보기]  btn-text  → [data-timeline-open]
```

**`#interest` 폼**
```
h2  출시 알림 신청과 문의, 여기서 받습니다.        ← 교체
.interest-sub  초기 서비스는 KOTRA 멘토 네트워크에…  ← 무수정 (스펙 §4가 지정한 문의 자리)
.form-purpose (radiogroup)
  ( ) 기한관리 출시 알림 받기   value=tracking  checked
  ( ) 문의하기                 value=inquiry
… 기존 이름/이메일/회사명/동의2종 무수정 …
[사전 등록하기 | 문의 보내기]  ← purpose 에 따라 JS 가 라벨 동기화
```

### 5.6 S6 — 메타 (`<head>`)

| 항목 | after | "NDA" |
|---|---|---|
| `<title>` | `TROPS — 첫 수출, 무엇부터 봐야 할지 모르겠다면` | 없음 ✅ |
| `description` | `첫 수출이라 무엇부터 봐야 할지 모르겠다면. 바이어에게 받은 서류를 올려보세요. 공개된 서식과 하나씩 비교해서 다른 부분을 표시해 드리고, 무엇을 더 확인하시면 되는지도 함께 알려드립니다.` | 없음 ✅ |
| `og:title` | `TROPS — 첫 수출, 무엇부터 봐야 할지 모르겠다면` | 없음 ✅ |
| `og:description` | `바이어에게 받은 서류를 올려보세요. 공개된 서식과 하나씩 비교해서 다른 부분을 표시해 드립니다.` | 없음 ✅ |

- `description` = 헤드라인 + 리드, `og:description` = 리드 — **기존 관례 유지**(`index.html:7-9`)
- 현재 h1 "첫 수출이라 무엇부터 봐야 할지 모르겠다면." 과 톤 일치 (기존 불일치 해소)
- `index.html:7-9` 주석을 "index 는 §2 헤드라인 기준으로 분기됨" 으로 갱신 (nda·precheck 는 이번 스코프 아님)

### 5.7 Component List

| 신규 클래스 | 역할 | 재사용 자산 |
|---|---|---|
| `.stories` `.story-cmp` `.story-side` `.story-label` `.story-quote` `.story-body` `.story-ask` `.story-note` | S1+S2 | `.eyebrow-quiet` · `.h3` · `.card-*` 타이포 값 |
| `.story-common` | S2 | `.h3` |
| `.stat-line` `.stat-src` | S3 | `.h3` · `--d-ink-*` |
| `.feats-sec` `.feats-inner` `.feats` `.feat` `.feat-btn` `.feat-title` `.feat-meta` `.feat-chev` `.feat-panel` `.feat-panel-inner` `.feat-desc` `.feat-hook` `.feat-note` `.feat-map` `.feat-cap` | S4 | `.card` 테두리·radius · `.qbtn`/`.qchev` 패턴 · `.shot` |
| `.act` `.act-inner` `.act-note` | S5 | `.close-cta-inner` 구조 복제 |
| `.rm-hook` | S5 | `.rm-lead` |
| `.form-purpose` | S5 | `.form-row` · `.consent` |

**색·타이포 리터럴 0 규칙**: 신규 CSS 는 색을 `var(--*)` 로만, 폰트 크기를 기존 스케일 값(12.5 / 16.5 / 18 / 20 / 28px · `clamp(1.75rem,3vw,2.5rem)`)으로만 쓴다. 유일한 신규 수치는 레이아웃(gap/padding/grid) 과 `.24s` 전환시간.

---

## 6. Error Handling

| 상황 | 처리 |
|---|---|
| JS 실패 / 미로딩 | 아코디언 제목 3개는 마크업으로 노출(패널은 접힘). `[data-timeline-open]` 은 `<button>` 이라 아무 일도 하지 않고 페이지는 정상 |
| `#feat-timeline` 부재 | `setOpen` 호출 전 null 가드 → 트리거 무동작 |
| `purpose` 미지원 브라우저/미전송 | 서버가 `'tracking'` 폴백 |
| 지도 에셋 미확보 | `.feat-map` 자리표시가 정상 콘텐츠로 렌더 (깨진 이미지 없음) |
| `prefers-reduced-motion` | `.feat-panel` `.feat-chev` transition 제거 (즉시 토글) |

---

## 7. Security Considerations

- `purpose` 는 서버에서 화이트리스트 후 `escapeHtml` 을 거쳐 메일 본문에 삽입 — 기존 필드와 동일 경로
- 동의 검사(`consentPrivacy !== true`) 로직 **무수정**. `purpose` 는 동의 게이트 이후에만 쓰인다
- 외부 스크립트·CDN 추가 0 (Pretendard CSS 1건은 기존)
- `app.trops.kr` 링크는 `target="_self"` (기존 nav-quiet 관례와 동일)

---

## 8. Test Plan

### 8.1 Test Scope

이 레포는 `node --test` 기반 API 테스트만 보유하고 Playwright 가 없다. 랜딩은 정적 HTML 이라 **정적 검증(L0) + 기존 API 회귀(L1)** 로 구성하고, L2/L3 는 코드 기반 검증으로 대체한다.

### 8.2 L0 — 정적 검증 (Check 채점표 직결)

| ID | 검증 | 방법 | 기준 |
|---|---|---|---|
| L0-1 | 신규 CSS 리터럴 색상 0건 | 신규 블록 구간에서 `#[0-9a-fA-F]{3,6}` / `rgba?(` grep | 0건 |
| L0-2 | 섹션 배경 교차 | 섹션 순서·배경 나열 | 인접 동색 0, dark 본문 1회 |
| L0-3 | 주버튼 2회 | `btn-primary` grep (submit 제외) | 히어로 + 결 = 2 |
| L0-4 | "NDA" 메타 부재 | `<title>`/description/og 4줄 grep | 0건 |
| L0-5 | 기존자산 보존 | `git diff` — 신뢰 3줄·캡처·FAQ 13문항·₩99,000·확인 항목 요약 자료·9월 오픈·h1·hero-lead | 전부 무변화 |
| L0-6 | 반응형 규칙 존재 | 신규 클래스별 미디어쿼리 | `.story-cmp`·`.feats`·`.close-cta-row`·`.form-purpose` 커버 |
| L0-7 | 접근성 속성 | 아코디언 3개 | `aria-expanded`/`aria-controls` 쌍 3세트 |
| L0-8 | 스코프 6개 | FR-01~FR-13 개별 | 전부 존재 |

### 8.3 L1 — API 회귀

```bash
node --test test/
```
| 기준 | `api/leads.js` 관련 테스트 전부 통과. `purpose` optional 이라 기존 케이스 무영향 |

### 8.4 L2/L3 대체

Playwright 미설치. 아코디언·트리거·폼 동기화는 **코드 경로 추적**으로 검증(IIFE 가드·셀렉터 존재·이벤트 위임 대상 일치) 후, 배포 뒤 실브라우저 육안 확인을 별도 기록.

---

## 9~10. Convention

- 인라인 `<style>` 구역 순서 준수: 토큰 → 공통 → 컴포넌트 → 섹션(문서 순) → 반응형 → reduced-motion. 신규 섹션 CSS 는 **해당 섹션이 등장하는 순서 자리**에 넣는다
- `<script>` 는 IIFE 격리. 신규 아코디언 IIFE 는 폼 IIFE 앞에 둔다 (폼 IIFE 는 `if (!form) return` 조기이탈이 있어 합치면 아코디언이 조용히 죽는다 — `index.html:1336-1342` 가 같은 이유를 기록)
- 신규 블록마다 근거 주석 필수. 플레이스홀더는 `TODO-REAL-CASE`, 미확보 에셋은 `TODO-ASSET`

---

## 11. Implementation Guide

### 11.1 변경 파일

| 파일 | 변경 |
|---|---|
| `index.html` | `<head>` 4줄 / `<style>` 신규 ~210줄 / `<body>` 6개 구간 / `<script>` IIFE 1개 신규 + 1개 확장 |
| `api/leads.js` | optional `purpose` (~10줄) |
| `docs/01-plan/features/…plan.md` | (작성 완료) |
| `docs/02-design/features/…design.md` | (이 문서) |

### 11.2 구현 순서

1. **M1** `<head>` 메타 4줄 + 주석 갱신 (S6)
2. **M2** `<style>` 신규 CSS 전량 (S1~S5 스타일 + 반응형 + reduced-motion)
3. **M3** 히어로 `.cta-row` 교체 (S5)
4. **M4** 카드01 CTA 강등 (S5)
5. **M5** `#how` 에 `.stories` 삽입 + 하단 CTA 강등 (S1·S2·S5)
6. **M6** `.feats-sec` 신설 (S4)
7. **M7** `.trust` 통계블록 삽입 + L-1 주석 갱신 (S3)
8. **M8** `.act` 결 섹션 신설 (S5)
9. **M9** `#next` 훅 추가 (S5)
10. **M10** `.close-cta` 교체 (S5)
11. **M11** `#interest` 목적 선택 + h2 (S5)
12. **M12** `<script>` 아코디언 IIFE + 폼 IIFE 확장 (S4·S5)
13. **M13** `api/leads.js` purpose (S5)

### 11.3 Session Guide

| Module | 의존 | 비고 |
|---|---|---|
| M1 | — | 독립 |
| M2 | — | M3~M11 의 전제 |
| M3~M11 | M2 | 마크업. 순서 무관하나 문서 순서대로 |
| M12 | M6, M11 | 셀렉터 존재 후 |
| M13 | — | 독립 |

단일 세션 처리 (총 변경 ~450줄, 1파일 집중).

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-08-13 | 초안 — 3안 비교 후 C(실용균형) 선택 |
