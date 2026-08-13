# landing-psych-track-a Gap Analysis (Check)

> **Date**: 2026-08-13
> **Plan**: `docs/01-plan/features/landing-psych-track-a.plan.md`
> **Design**: `docs/02-design/features/landing-psych-track-a.design.md`
> **결과**: **96 / 100** — 통과 (기준 90)
> **Act 반복**: 1회 (Act-1 에서 5건 수정 후 재검)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 랜딩에 자각 유도 장치가 없어 "이미 의문 있는 고객"만 전환된다 |
| **SUCCESS** | 토큰20 · 리듬20 · 스코프30 · 반응형15 · 보존15 |
| **SCOPE** | index.html + api/leads.js + (Act 추가) scripts/build-static.js · .vercelignore |

---

## 1. 채점표

| # | 항목 | 배점 | 획득 | 근거 |
|---|---|---:|---:|---|
| 1 | 기존 색토큰/버튼/타이포 재사용, ad-hoc 스타일 없음 | 20 | **20** | 신규 CSS 리터럴 색상 **0건**(`#`/`rgba(` grep). 유일한 `#FFFFFF`는 기존 `.skip`(index.html:134). 신규 타이포는 전부 승인 스케일(12.5/16.5/18/20/28 · `clamp(1.75rem,3vw,2.5rem)`). 전역 `.h3` 를 3곳(`.stat-line`·`.story-ask`·모르시는게당연합니다)에서 재사용 |
| 2 | 10개 정본 리듬 + 배경 교차 규칙 | 20 | **20** | 아래 §2. Act-1 에서 인접규칙 3건 복구 후 인접 동색 0건 |
| 3 | 스코프 6개 전부 구현 | 30 | **29** | 6개 전부 구현. −1: 기한관리 대시보드 세계지도 **실캡처 에셋 부재**로 자리표시 대체(§4 G-1) |
| 4 | 모바일 반응형 379~1125px | 15 | **12** | 신규 블록 전부 미디어쿼리 커버(§3). −3: Playwright 미설치로 **실브라우저 렌더 검증 미실시** — 코드 경로 검증까지만 |
| 5 | 기존 신뢰섹션/FAQ/환불/가격 보존 | 15 | **15** | 보호대상 삭제 **0건**. `npm test` **244/244 pass** |
| | **합계** | **100** | **96** | |

---

## 2. 섹션 리듬 검증

| # | 섹션 | 배경 | 신규 |
|---:|---|---|:--:|
| — | `nav.nav` | `--bg` | |
| 1 | `.hero` | `--bg` | |
| 2 | `.assure` | `--surface` | |
| 3 | `.cards-sec#service` | `--bg` | |
| 4 | `.how#how` (＋`.stories` 내부 삽입) | `--surface` | 내부 |
| 5 | `.feats-sec#feats` | `--bg` | ✅ |
| 6 | `.trust` | `--surface-dark` | |
| 7 | `.act` | `--surface` | ✅ |
| 8 | `.how#next` | `--bg` | |
| 9 | `.qna#qna` | `--surface` | |
| 10 | `.close-cta` | `--bg` | |
| 11 | `.interest#interest` | `--surface` | |
| 12 | `.orgs-sec#orgs` | `--bg` | |
| — | `footer.footer` | `--surface-dark` | |

- 배경열: `bg bg surface bg surface bg dark surface bg surface bg surface bg dark`
- **인접 동색 0건** (헤더+히어로 연속은 개편 전과 동일한 기존 의도)
- `--surface-dark` 본문 **1회**(`.trust`) + 푸터 — 시각사양 4-1 상한 준수
- 정본 10개 섹션 **삭제·재배치 0건**. 신규는 2개(5·7)뿐이고, 경험담·무지 2블록은 섹션이 아니라 `#how` 내부 블록

---

## 3. 반응형 커버리지

| 브레이크포인트 | 신규 규칙 |
|---|---|
| ≤900px | `.feats` 3열 → 1열 (내용폭 200px 미만 방지) |
| ≤768px | `.story-cmp` 2열 → 1열 · `.story-side` padding 22 · `.stories` gap 28 · `.feat-btn` padding 22 · `.feat-panel-pad` padding 22 · `.act-row` 세로 스택 + 버튼 100% |
| ≤640px | `.form-purpose` 세로 스택 |
| ≥769px | `.feats-sec h2` · `.act h2` 에 `text-wrap: balance` 추가 |
| reduced-motion | `.feat-chev` · `.feat-panel` transition 제거 |

379px 기준: `.h3`(28px 고정)는 시각사양 3-4 「H1·H2만 스케일」에 따라 의도적 고정. `.story-quote`(20px)·`.feat-title`(20px)은 기존 `.card-title` 과 같은 값이라 기존 검증 범위 안.

---

## 4. Gap

| ID | 심각도 | 내용 | 상태 |
|---|---|---|---|
| **G-1** | Medium | app.trops.kr 대시보드 세계지도 마스킹 캡처가 `img/` 에 없음(`c03-result*.jpg` 2장뿐). 깨진 `<img>` 대신 토큰 기반 자리표시 `.feat-map` + 대기 `<img>` 주석 + `TODO-ASSET`. 핀 순차 애니메이션도 에셋 종속이라 함께 보류 | **미해소 — 에셋 확보 필요** |
| **G-2** | Low | 경험담·"모르시는 게 당연합니다" 사례가 전부 플레이스홀더. `TODO-REAL-CASE` 2곳 + 화면 캡션 「예시입니다」 명시 | 의도된 상태(사용자 지시) |
| **G-3** | Low | Playwright 미설치로 L2/L3 실브라우저 검증 미실시 | 배포 후 육안 확인으로 대체 |
| **G-4** | Info | `dist/index.html` 에 "NDA" 9건 잔존 — 전부 04카드·HOW·캡처 alt/캡션·FAQ 본문. `<title>`/meta/og/헤드라인/서브헤드라인 **0건**으로 스펙 §1 적용 범위는 충족 | 스코프 밖(의도) |

---

## 5. Act-1 수정 내역 (Check 1회차 지적 → 해소)

| ID | 지적 | 수정 |
|---|---|---|
| **F1** | `.act { border-top: 1px solid var(--line) }` 가 `--surface-dark`(신뢰) 바로 아래에 밝은 헤어라인을 그림 — 푸터가 같은 이유로 border-top 을 뺀 것과 모순 | `border-top` 제거 |
| **F2** | `#next { border-top: 0 }` 의 근거("위가 신뢰 --surface-dark")가 `.act` 삽입으로 무효 → `--surface`→`--bg` 경계에 선이 사라짐 | 규칙 삭제(`.how` 기본 border-top 사용) |
| **F3** | `.how-inner-tight`(상단 44/68)도 같은 무효 근거 → 다크가 아닌 `--surface` 아래에서 여백 부족 | 규칙·클래스 삭제, 기준값 60/96 복귀 |
| **F4** | `.hero-lead` 에 "NDA" 잔존 → 방금 재작성한 meta("바이어에게 받은 **서류**를")와 화면 첫 문장이 서로 다른 말을 함. 스펙 §1 은 비노출 범위에 **서브헤드라인**을 명시 | "NDA"→"서류" 1낱말 교체(§6 참조) |
| **F5** | `node scripts/build-static.js` 가 미분류 루트 항목 `doc/` 로 실패 → **Vercel 배포 차단**. 내 변경 이전부터 존재(stash 검증) | `NOT_DEPLOYED` 에 `doc` 추가 + `.vercelignore` 등재 |

부수 조치: `site.config.json` 이 `test/site-config.test.js:120` 프로브 값(`2026-서울강남-00000`)으로 오염돼 있어 `git checkout` 복구. 이전 중단된 테스트 실행의 누출분.

---

## 6. 판단이 필요한 결정 2건 (사용자 확인 권장)

| # | 결정 | 근거 | 되돌리는 법 |
|---|---|---|---|
| **D-1** | `.hero-lead` 「NDA」→「서류」 — `index.html` 의 "확정본 v3.1 §2 원문 · 한 글자도 바꾸지 마십시오" 가드를 넘은 **유일한** 예외 | 스펙 §1 이 비노출 범위를 헤드라인·서브헤드라인까지 명시 + meta 재작성과의 모순 제거 | 한 낱말이라 되돌리기 쉬움. 되돌릴 경우 meta 4줄도 함께 "NDA" 표기로 되돌려야 일관 |
| **D-2** | `.close-cta` h2 「수출 전에, 한 번 더 점검하세요.」→「확인이 더 필요하시면, 편하게 물어보세요.」 | 주버튼 제거 후 「점검하세요」만 남으면 실행 수단 없는 명령. 이 h2 는 확정본 원문이 아니라 2026-08-13 에 이미 한 번 교체된 이력 | h2 만 교체 |

---

## 7. 테스트

| 항목 | 결과 |
|---|---|
| `npm test` (`node --test --test-concurrency=1 test/`) | **244 pass / 0 fail** ✅ |
| `node scripts/build-static.js` | 성공 — 8개 페이지 + data/ + img/ 출력 |
| 참고 | `node --test test/`(병렬, 프로젝트 표준 아님)로 돌리면 4건 실패 — `site.config.json`·`nda.html` 을 동시 변형하는 테스트 간 경합. `package.json` 의 `test` 스크립트는 이미 `--test-concurrency=1` 이라 표준 경로에서는 발생하지 않음 |

---

## 8. 결론

**96 / 100 — 통과.** 6개 스코프 전부 구현됐고, Check 1회차에서 잡힌 배경 인접규칙 3건과 배포 차단 1건은 Act-1 에서 해소됐다. 남은 실질 갭은 G-1(지도 실캡처 에셋) 하나이며, 마크업·CSS·주석이 교체 대기 상태로 준비돼 있어 에셋만 넣으면 닫힌다.
