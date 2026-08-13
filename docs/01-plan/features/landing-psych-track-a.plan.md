# landing-psych-track-a Planning Document

> **Summary**: 랜딩(index.html)에 인터뷰 심리기법(경험담 선행 · 자각 유도)을 이식하고, CTA 위계·메타 카피를 스펙문서 결정대로 재정비한다.
>
> **Project**: main_web_page (TROPS 랜딩)
> **Version**: package.json 기준
> **Author**: Haname (via Claude Code / bkit PDCA)
> **Date**: 2026-08-13
> **Status**: Approved (체크포인트 1~5 사용자 지시로 자동승인 — "중간에 질문하지 말고")

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 랜딩이 "무엇을 하는 서비스인가"는 설명하지만 "왜 지금 나에게 필요한가"를 만들어주지 못한다. 인터뷰 채널에서 효과가 검증된 기법(직접 자료요청 금지 → 경험담 선행 → 스스로 역요청)이 셀프서브 랜딩에는 전혀 이식되지 않았고, 주 CTA가 5회 남발돼 위계가 무너져 있다. |
| **Solution** | 감정선(기-히어로 / 승-경험담 / 전-신뢰증명 / 결-행동)을 실제 10개 정본 섹션 리듬 안에 배치한다. 경험담 좌우비교 + "모르시는 게 당연합니다"를 기존 `#how` 섹션 안에 삽입(배경 리듬 무손상), 핵심기능 3분류 아코디언과 "결" 섹션을 신규 추가, 신뢰 다크섹션의 빈 통계자리(미결 L-1)를 무보 문장으로 닫는다. |
| **Function/UX Effect** | 주 CTA 5회 → 2회(히어로·결)로 위계 회복. "거래 절차 트래킹 알림 받기"(기능설명적, 훅 없음) → "기한관리 미리보기"(같은 페이지 인라인 확장, 이탈 0). "문의하기" 보조 CTA 신규로 인터뷰 채널 진입로 확보. title/meta에서 "NDA" 제거로 자료제출 방어기제 해제. |
| **Core Value** | 랜딩이 "설명하는 페이지"에서 "스스로 확인하고 싶게 만드는 페이지"로 전환 — 판정하지 않고 사례와 질문만으로 자각을 유도한다는 §109 원칙을 카피 레벨에서 구현. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 랜딩에 자각 유도 장치가 없어 "이미 의문 있는 고객"만 전환된다. 의문을 만들어주는 장치가 필요하다. |
| **WHO** | 첫 수출을 앞둔 한국 중소기업 대표 (거래처 1~2곳, 무역서류 경험 없음, 무지 노출에 대한 창피함 + 기밀누출 우려 동시 보유) |
| **RISK** | ① 플레이스홀더 사례가 실제 사례로 오독될 위험 ② 섹션 3개 추가로 `--bg`/`--surface` 교차 리듬 붕괴 ③ 히어로 확정본 원문(`한 글자도 바꾸지 마십시오` 가드)을 실수로 건드릴 위험 |
| **SUCCESS** | Check 90점 이상 — 토큰 재사용 20 / 리듬·배경 20 / 스코프 6개 30 / 반응형 15 / 기존자산 보존 15 |
| **SCOPE** | 트랙A 6개 (index.html 단일 파일 + api/leads.js 선택필드 1개). 트랙B(trops_a)·진단리포트 모듈·가격표기·en.html 은 제외. |

---

## 1. Overview

### 1.1 Purpose

`doc/s9/TROPS_user_flow_2026-08-13.md` §7 "트랙A" 6개 항목을 index.html 에 구현한다. 시각작업(색토큰·버튼3종·타이포)은 §6-1에서 이미 100% 완료로 판정됐으므로 **카피와 신규 블록만** 다룬다.

### 1.2 Background

- 스펙문서 §1 "인터뷰 진행 원칙": 직접 자료요청은 방어기제를 부른다. 경험담을 먼저 공유해 상대가 스스로 역요청하게 만드는 것이 검증된 기법.
- 스펙문서 §1 "랜딩 심리설계": 이 기법을 셀프서브 채널로 확장 — 경험담 좌우비교 섹션 + 무지 안전장치 섹션 신설.
- 스펙문서 §6-2: 해당 3개 블록 모두 코드에 0건. 신뢰 다크섹션 통계자리는 의도적 공백(미결 L-1).
- 스펙문서 §1 "NDA 노출" 원칙의 진짜 이유: 타이틀·메타에 "NDA"가 보이면 "기밀서류를 대놓고 요구하는 곳"으로 읽혀 **자료제출 자체가 막힌다**. 확장성 논리가 아니라 전환율 논리.

### 1.3 Related Documents

- 스펙(결정 원본): `doc/s9/TROPS_user_flow_2026-08-13.md`
- 시각사양: `docs/design-master/trops_landing_visual_spec_v1.md`
- 확정 문구: `docs/copy/trops_랜딩_최종문구_확정본_v3.1.md`

---

## 2. Scope

### 2.1 In Scope

- [ ] **S1** 경험담 좌우비교 블록 신규 (`#how` 섹션 내부 최상단)
- [ ] **S2** "모르시는 게 당연합니다" 블록 신규 (S1 바로 아래, 붙여서)
- [ ] **S3** `.trust` 다크섹션에 무보 통계 문장 블록 삽입 (미결 L-1 해소, 카운트업 없음)
- [ ] **S4** 핵심기능 3분류 아코디언 섹션 신규 (사전점검 / 바이어확인 / 기한관리, 슬라이드 확장)
- [ ] **S5** CTA 재정비 — 주버튼 2회 제한, "기한관리 미리보기" 교체 + 인라인 확장, "문의하기" 신규, "결" 섹션 신규
- [ ] **S6** title / meta description / og:title / og:description 에서 "NDA" 제거 및 현재 헤드라인 톤으로 재작성

### 2.2 Out of Scope

| 제외 항목 | 이유 |
|---|---|
| ₩99,000 · "확인 항목 요약 자료" · "9월 오픈 예정" | 사용자 지시 명시 제외. 별도 로드맵 상품이며 코드주석에 보존 근거 있음 |
| 히어로 h1 / `.hero-lead` 문구 | `index.html:829` "확정본 v3.1 §2 원문 · 한 글자도 바꾸지 마십시오" 가드. 스펙 §"재무 리스크 프레임"의 서브헤드라인 보강은 스코프 6개에 미포함 → 별도 배치로 이월 |
| en.html · nda.html · precheck.html | 스코프는 index.html. 기존 주석 다수가 "이번 배치는 국문 한정" 관례를 명시 |
| 색토큰 · 버튼3종 · H1/H2 clamp | §6-1 "전부 스펙과 100% 일치, 추가작업 불필요" |
| 기존 신뢰섹션 · 30일삭제 FAQ · 환불정책 | §5-1 12·15번 "보존 명시" |
| 트랙B (trops_a 매직링크 등) | 별 레포 |
| Supabase 스키마 | 순수 프론트 + 메일전송 API 1필드. DB 없음(`api/leads.js` 는 Resend 전용) |

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 좌측 "표준 양식이겠지, 다들 이렇게 쓰니까." / 우측 관할조항 문제 사례 / 마무리 질문 "이 조항, 본 적 있으신가요?" 3부 구조 | High | Pending |
| FR-02 | 사례는 전부 플레이스홀더. 코드주석에 `TODO-REAL-CASE` 표기 | High | Pending |
| FR-03 | "모르시는 게 당연합니다" 본문 = 스펙 지정 문장 그대로, `TODO-REAL-CASE` 주석 | High | Pending |
| FR-04 | `.trust` 에 무보 문장 삽입. 출처 "— 한국무역보험공사" 병기. 숫자 카운트업 **없음** | High | Pending |
| FR-05 | 3카드 아코디언. 셋 다 동일 인터랙션(같은 자리 슬라이드 확장), 동시 다중 펼침 허용 | High | Pending |
| FR-06 | 사전점검 확장 = 설명 + 예시화면, 실행버튼 **없음** | High | Pending |
| FR-07 | 바이어확인 확장 = 설명 + "사전점검 결과화면에서 바로 확인하실 수 있습니다" 안내, 실행버튼 **없음** | High | Pending |
| FR-08 | 기한관리 확장 = 대시보드 세계지도 샘플 + [계약 등록해보기] → app.trops.kr | High | Pending |
| FR-09 | "거래 절차 트래킹 알림 받기" 2곳(히어로·마감CTA) → "기한관리 미리보기", 클릭 시 페이지이동 없이 인라인 확장 | High | Pending |
| FR-10 | "문의하기" 보조버튼 신규 — 히어로·마감CTA. "상담" 단어 사용 금지 | High | Pending |
| FR-11 | 주버튼("비교해 보기") 페이지당 2회 = 히어로 + "결" 섹션. 마감CTA는 "문의하기"만 | High | Pending |
| FR-12 | "결" 섹션 신규 — 아코디언 다음, 로드맵 이전 | High | Pending |
| FR-13 | title/description/og:title/og:description 4곳 전부 "NDA" 미포함 + 현재 h1 톤 일치 | High | Pending |
| FR-14 | 신규 스타일은 기존 CSS 변수·버튼 클래스·타이포 스케일만 사용. ad-hoc 색·크기 금지 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 반응형 | 379px · 640px · 768px · 900px · 1125px 에서 레이아웃 붕괴 없음 | 기존 미디어쿼리 브레이크포인트에 신규 블록 규칙 추가 후 육안/코드 검증 |
| 접근성 | 아코디언 `aria-expanded`/`aria-controls`, 다크섹션 텍스트 대비 AA(4.5:1) 이상 | `--d-ink-*` 토큰만 사용(이미 AA 검증됨), 버튼 `min-height:44px` 상속 |
| 모션 | 확장은 슬라이드. `prefers-reduced-motion: reduce` 에서 전환 제거 | 기존 `@media (prefers-reduced-motion)` 블록 확장 |
| 정적 무의존 | 신규 외부 라이브러리 0. 인라인 `<style>`/`<script>` 유지 | package.json 변경 없음 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] FR-01 ~ FR-14 전부 구현
- [ ] `node --test test/` 기존 테스트 회귀 없음
- [ ] `scripts/verify-deployment.js` 통과 (있는 경우)
- [ ] 커밋 + 푸시 + Vercel 배포

### 4.2 Quality Criteria (Check 채점표 — 90점 미만 통과 금지)

| 항목 | 배점 | 판정 방법 |
|---|---:|---|
| 기존 색토큰/버튼/타이포 재사용, 신규 ad-hoc 스타일 없음 | 20 | 신규 CSS 블록 내 리터럴 색상값 `grep`. `var(--*)` 외 색상 0건이어야 함 |
| 10개 정본 섹션 리듬 유지 + 배경 교차 규칙 | 20 | 섹션 순서·배경 나열해 `bg/surface` 교차 무붕괴 + `--surface-dark` 본문 1회 확인 |
| 스코프 6개 전부 구현 | 30 | FR-01~FR-13 개별 확인 |
| 모바일 반응형 379~1125px | 15 | 신규 블록별 미디어쿼리 존재 확인 |
| 기존 신뢰섹션/FAQ/환불/가격 보존 | 15 | `git diff --stat` + 삭제라인 검사 |

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 신규 섹션 3개 추가로 `bg/surface` 교차 리듬 붕괴 | High | High | 경험담·무지 블록은 **신규 섹션이 아니라 `#how` 내부 블록**으로 삽입(리듬 0 영향). 신규 섹션은 2개만(핵심기능 `--bg`, 결 `--surface`)이며 `#how(surface) → 핵심기능(bg) → trust(dark) → 결(surface) → #next(bg)` 로 교차 유지 |
| 플레이스홀더 사례가 실제 사례로 오독 | High | Medium | ① 코드주석 `TODO-REAL-CASE` ② 화면에 "예시입니다" 캡션 노출 ③ 특정 기업·국가 실명 미사용 |
| 히어로 확정본 원문 훼손 | High | Medium | h1/`.hero-lead`/`.hero-note` 3요소 **무수정**. 변경은 `.cta-row` 내부로만 한정 |
| 주버튼 감축이 전환 손실로 이어짐 | Medium | Medium | 제거가 아니라 강등 — `#how`·카드01의 주버튼은 `.btn-text`로 남겨 클릭 경로 유지 |
| 대시보드 세계지도 스크린샷 에셋 부재 | Medium | High | `img/` 에 `c03-result*.jpg` 2개뿐. 토큰 기반 자리표시 `<figure>` + `TODO-ASSET` 주석으로 구현하고, 깨진 이미지 노출 금지. 에셋 확보 시 `<img>` 한 줄 교체로 완료 |
| "문의하기"가 "사전 등록하기" 폼으로 이어져 문구 불일치 | Medium | High | `#interest` 폼에 목적 선택(문의/사전등록) 추가 + 제출버튼 라벨 동기화. `api/leads.js` 는 optional `purpose` 만 수용(하위호환) |
| 다크섹션 신규 텍스트가 AA 미달 | Medium | Low | `--d-ink-primary/secondary/tertiary` 만 사용. 이 3개는 `index.html:44-59` 에서 대비 실측 완료 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `index.html` `<head>` 메타 4줄 | HTML meta | title/description/og:title/og:description 재작성 |
| `index.html` `<style>` | CSS | 신규 블록 스타일 추가 (기존 규칙 수정 없음, 미디어쿼리에 규칙 추가) |
| `index.html` 히어로 `.cta-row` | HTML | 버튼 구성 교체 |
| `index.html` `#how` 섹션 | HTML | 내부 최상단에 블록 2개 삽입 + 하단 CTA 강등 |
| `index.html` `.trust` | HTML | 통계 블록 삽입 (기존 3줄 + 캡처 2컷 무수정) |
| `index.html` `.cards-sec` 카드01 CTA | HTML | `btn-primary` → `btn-text` 강등 |
| `index.html` `.close-cta` | HTML | 주버튼 제거, 보조 2개로 교체 |
| `index.html` `.interest` 폼 | HTML+JS | 목적 선택 필드 추가 |
| `index.html` `<script>` | JS | 아코디언 IIFE 신규, 폼 IIFE 확장 |
| `api/leads.js` | API | optional `purpose` 수용 + 알림메일 본문에 표기 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `api/leads.js` POST | CREATE | `index.html` 폼 IIFE (`API_URL`) | 변경 — `purpose` 추가 전송 |
| `api/leads.js` POST | CREATE | `en.html` 폼 IIFE (동일 엔드포인트 공용) | **None** — `purpose` optional 이라 미전송 시 기존 동작 |
| `api/leads.js` | TEST | `test/` 내 leads 관련 테스트 | 확인 필요 — optional 필드라 기존 케이스 통과 예상 |
| `.qgroups` 아코디언 IIFE | READ | `index.html` FAQ | **None** — 신규 아코디언은 별도 IIFE + 별도 셀렉터 |
| `#interest` 앵커 | READ | 카드02 `알림 받기`, 히어로/마감 기존 링크 | 변경 — 링크는 유지, 도착지 폼에 필드 1개 증가 |
| `--d-ink-*` 토큰 | READ | `.trust`, `.footer` | **None** — 읽기만 |
| `.btn*` 클래스 | READ | 6개 페이지 공용 정의(각자 인라인) | **None** — index.html 정의 무수정, 사용만 |

### 6.3 Verification

- [ ] `en.html` 이 `purpose` 없이 POST 해도 200 (하위호환)
- [ ] 기존 FAQ 아코디언 동작 무변화
- [ ] 히어로 h1/lead/note 3요소 `git diff` 무변화
- [ ] 가격·상품명 문구 `git diff` 무변화

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Selected |
|-------|:--------:|
| **Starter** (정적 HTML/CSS/JS 단일 파일) | ☑ 이 작업 |
| Dynamic | ☐ (레포 전체는 Dynamic이나 본 작업은 정적 랜딩 한정) |
| Enterprise | ☐ |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 경험담·무지 블록 배치 | 신규 섹션 / `#how` 내부 | **`#how` 내부** | 신규 섹션으로 빼면 `cards-sec(bg) → 신규(?) → #how(surface)` 에서 어떤 배경을 골라도 교차가 깨진다. 스펙문서가 "HOW 섹션 앞 **또는 안**"을 허용 |
| 아코디언 확장 방식 | `display:none` 토글 / `grid-template-rows 0fr→1fr` | **grid 0fr→1fr** | 스펙 §"다이나믹함"이 슬라이드 요구. 기존 FAQ는 `display:none`이나 그건 무수정 보존 |
| 기한관리 미리보기 패널 위치 | 히어로·마감·로드맵 각각 복제 / 아코디언 카드 1곳 | **아코디언 1곳 공유** | 지도 패널 3중 복제 방지. 히어로·마감·로드맵 링크는 해당 카드를 열고 스크롤 — 페이지이동 없음 = 인라인 확장 요건 충족 |
| "결" 섹션 배경 | `--bg`(스펙 스케치) / `--surface` | **`--surface`** | 스케치대로 `--bg`면 다음 `#next(--bg)`와 붙어 경계 소실. 사용자가 "스케치는 참고용"임을 명시 |
| 핵심기능/결 순서 | trust 이후 / trust 이전 | **`#how` → 핵심기능 → trust → 결 → `#next`** | 스펙 스케치가 "핵심기능 3분류 = 신뢰증명과 결 사이". 배경도 surface→bg→dark→surface→bg 로 완전 교차 |
| "문의하기" 도착지 | mailto / 신규 모달 / 기존 `#interest` | **기존 `#interest` + 목적 선택** | 스펙 §2 "폼/모달". 신규 모달은 과설계, mailto는 모바일 이탈. `#interest`는 이미 KOTRA 멘토 신뢰신호(스펙 §4가 문의 자리로 지정)를 갖고 있음 |
| Styling | 인라인 `<style>` 유지 | **유지** | 6개 페이지가 각자 인라인. 이 작업에서 빌드 파이프라인 도입은 스코프 밖 |

### 7.3 Clean Architecture Approach

```
정적 단일 파일 구조 유지:
  index.html
    ├─ <head>       메타 4줄            ← S6
    ├─ <style>      토큰 → 컴포넌트 → 섹션 → 반응형  (기존 순서 준수, 신규는 해당 구역 말미)
    ├─ <body>       12섹션 (정본 10 + 신규 2)
    └─ <script>     IIFE 3개 (FAQ / 신규 아코디언 / 폼)  ← IIFE 격리 원칙 준수
  api/leads.js      optional purpose
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] 인라인 `<style>` · `<script>` (외부 번들 없음)
- [x] `var(--token)` 만 사용, 리터럴 색상 금지
- [x] **결정 근거를 코드주석으로 남기는 강한 관례** — 신규 블록도 동일하게 근거·금지사항 주석 필수
- [x] `<script>` 는 기능별 IIFE 격리 (`index.html:1336-1342` 이 이유를 명시)
- [x] 6개 페이지 공용 값 변경 시 "한 곳만 고치지 마십시오" 경고 주석

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| 신규 블록 클래스 네이밍 | 섹션약어 기반(`.trust-*`, `.rm-*`, `.q*`) | `.story-*`(경험담) `.feat-*`(아코디언) `.act-*`(결) `.stat-*`(통계) | High |
| 플레이스홀더 표기 | 없음 | `TODO-REAL-CASE` / `TODO-ASSET` 주석 태그 | High |
| 미결 해소 표기 | `미결 L-n` 주석 관례 존재 | L-1 해소 시 기존 "카운터 비워둠" 주석 갱신 | Medium |

### 8.3 Environment Variables Needed

없음. `RESEND_API_KEY` 는 기존 사용.

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`landing-psych-track-a.design.md`)
2. [ ] Do — index.html 구현
3. [ ] Check — 채점표 90점 판정
4. [ ] Act — 미달 시 재수정
5. [ ] 커밋·푸시·Vercel 배포

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-13 | 초안 — 스펙문서 §7 트랙A 6개 스코프 기반 | Haname / Claude Code |
