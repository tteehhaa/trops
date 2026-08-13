# landing-psych-track-a 완료 보고서

> **Date**: 2026-08-13
> **Feature**: landing-psych-track-a (인터뷰 심리기법 → 셀프서브 랜딩 이식, 트랙A 6개)
> **Spec**: `doc/s9/TROPS_user_flow_2026-08-13.md` §7 트랙A
> **Check 결과**: **96 / 100** — 통과 (기준 90, Act 1회전)
> **최종 상태**: 프로덕션 배포 완료 · 라이브 검증 완료

---

## 1. PDCA 사이클 요약

| 단계 | 산출물 | 결과 |
|---|---|---|
| Plan | `docs/01-plan/features/landing-psych-track-a.plan.md` | 스코프 6개 · 채점기준 5축(20/20/30/15/15) 확정 |
| Design | `docs/02-design/features/landing-psych-track-a.design.md` | 10개 정본 리듬 안에서의 삽입 위치 · 배경 교차 설계 |
| Do | `index.html` · `api/leads.js` · `scripts/build-static.js` · `.vercelignore` | 커밋 `9058214` |
| Check | `docs/03-analysis/landing-psych-track-a.analysis.md` | 1회차 지적 5건(F1~F5) |
| Act | 위 5건 해소 후 재검 | **96/100** |

---

## 2. 스코프 6개 이행 결과

| # | 스코프 | 구현 | 비고 |
|---|---|:--:|---|
| 1 | 경험담 좌우비교 | ✅ | `.story-cmp` — `#how` **내부** 블록(섹션으로 빼면 `--bg`/`--surface` 교차가 끊김). 마무리 질문 「이 조항, 본 적 있으신가요?」. `TODO-REAL-CASE` |
| 2 | 「모르시는 게 당연합니다」 | ✅ | 1번과 붙여 `#how` 내부. `TODO-REAL-CASE` |
| 3 | 신뢰 다크섹션 통계블록 | ✅ | `.stat-line` — 무보 인용 문장형. 카운트업 없음(확인된 % 없음) |
| 4 | 핵심기능 3분류 아코디언 | ✅ | `.feats-sec#feats` 신설. 3카드 동일 슬라이드 확장. 사전점검·바이어확인 실행버튼 없음, 기한관리만 [계약 등록해보기] |
| 5 | CTA 명칭/문구 정리 | ✅ | 「거래 절차 트래킹 알림 받기」→「기한관리 미리보기」(인라인 확장). 「문의하기」 보조 CTA 신설(「상담」 금지어). 주버튼 = 히어로 + 신규 `.act`(결) **2회**, 마감CTA는 문의하기만 |
| 6 | title/meta/og 「NDA」 제거 | ✅ | 4줄 재작성 + `.hero-lead` 1낱말(D-1). 가격표기(99,000원·확인 항목 요약 자료·9월 오픈 예정) **무수정** |

## 3. 라이브 검증 (https://www.trops.kr/)

| 항목 | 결과 |
|---|---|
| HTTP | 200 (trops.kr → www 308 정상) |
| `<title>` | `TROPS — 첫 수출, 무엇부터 봐야 할지 모르겠다면` |
| title/meta/og 내 「NDA」 | **0건** |
| 신규 마커 | `story-cmp` · `feats-sec` · `feat-panel` · `stat-line` · `.act` 전부 출력 확인 |
| 문구 | 기한관리 미리보기 3 · 문의하기 3 · 「이 조항, 본 적 있으신가요」 1 · 「모르시는 게 당연」 1 · 한국무역보험공사 1 · 계약 등록해보기 1 |
| 보존 확인 | 30일 삭제 2 · 환불 1 · 99,000 1 · 9월 오픈 1 · 「무엇을 근거로」 1 — **삭제 0건** |

## 4. 테스트·빌드·배포

| 항목 | 결과 |
|---|---|
| `npm test` | **244 pass / 0 fail** |
| `node scripts/build-static.js` | 성공 (8페이지 + data/ + img/, 주석 131,691자 제거) |
| Push | `0f6709f..9058214 main → main` (pre-push main 가드는 사용자 배포 지시에 따라 `ALLOW_MAIN_PUSH=1` 로 통과) |
| Vercel | `trops-pwb1d4yzk` **Ready** · Production |
| Supabase | **스키마 변경 없음** — 순수 프론트 작업, 마이그레이션 파일 0건 |

## 5. 남은 항목 (이번 스코프 밖)

| ID | 내용 | 필요 조치 |
|---|---|---|
| **G-1** | 기한관리 카드의 app.trops.kr 대시보드 세계지도 마스킹 캡처 부재 → 토큰 기반 자리표시(`.feat-map`) + `TODO-ASSET`. 핀 순차 애니메이션도 함께 보류 | 캡처 1장 확보 시 마크업 교체만으로 닫힘 |
| **G-2** | 경험담·무지 사례 전부 플레이스홀더(`TODO-REAL-CASE` 2곳, 화면에 「예시입니다」 명시) | 실제 인터뷰 사례 확보 |
| **G-3** | Playwright 미설치로 379~1125px 실브라우저 렌더 검증 미실시(미디어쿼리 코드 경로까지만 확인) | 육안 확인 또는 Playwright 설치 |
| **작업분리** | 워킹트리의 `precheck.html` 수정은 **트랙B B-2**(결제 직후 app.trops.kr 리다이렉트 제거)로, 이 스코프와 무관해 커밋하지 않음 | 트랙B 사이클에서 별도 처리 |
