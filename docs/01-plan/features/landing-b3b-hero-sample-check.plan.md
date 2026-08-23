# Plan — landing-b3b-hero-sample-check (PRD v2.1 · B3 잔여 6항목 · B3-b)

| 항목 | 내용 |
|---|---|
| Feature | `landing-b3b-hero-sample-check` |
| 출처 | PRD §5-1 · §5-4 · §5-5 · §5-6 · §5-11 · §5-18 |
| 작성일 | 2026-08-23 |
| 선행 | B1 `a1925ae` · B2 `ad1a4e1` · B3-a `061da9f` 배포 완료 |
| 대응 작업 ID | B3-1 · B3-2 · B3-3 · B3-4 · B3-5 · B3-8 |

## Executive Summary

| 관점 | 내용 |
|---|---|
| **Problem** | B3-a 로 근거·과금·서사까지 왔지만 **페이지의 첫 화면이 아직 옛 판**입니다. 히어로·HOW·탭① 은 「NDA 를 표준 서식과 비교한다」를 팔고 있고, 앱은 이미 **품목·국가만으로 사전 점검 리포트**를 냅니다. 「받아보는 것이 무엇인지」를 보여줄 자리(샘플)도, 「내 품목이 되는가」를 물을 자리(진단 가능 범위)도 없습니다. |
| **Solution** | §5-1·§5-4·§5-5·§5-6·§5-11 을 한 글자도 바꾸지 않고 이식하고, `sample.html`·`en-sample.html` 을 STATIC 에 등재해 `/sample`·`/en-sample` 로 띄웁니다. `check.html` 3문항을 §5-18 신규 문항으로 갈고, 랜딩이 보내는 `/api/prestep` 페이로드를 신 어휘(`stage`·`docs`·`management`)로 바꿉니다. |
| **Function UX Effect** | 히어로에서 「무엇을 받는지」를 클릭 한 번으로 볼 수 있고(→`/sample`), 「내 품목이 되는가」를 입력창으로 물을 수 있습니다(→`app.trops.kr/precheck`). `/check` 는 서류 유무가 아니라 **수출 진행 단계와 관리 방식**을 묻습니다. |
| **Core Value** | **파는 것을 앱이 실제로 하는 것과 일치시킵니다.** 가격·결제 표면은 B1·B2·B3-a 와 동일하게 1줄도 건드리지 않습니다. |

## Context Anchor

| 축 | 내용 |
|---|---|
| **WHY** | 랜딩 첫 화면이 앱보다 한 세대 뒤에 있습니다(PRD §1). |
| **WHO** | 랜딩 방문자 · **토스 결제 심사자** · `/admin/funnel` 집계. |
| **RISK** | 🔴 가격·결제 diff 1줄 = fail(P-1 유효). 🔴 `/check` 문항 값이 바뀌는데 받는 쪽이 그대로면 **화면은 멀쩡한 채 퍼널만 조용히 비어** 갑니다. 🔴 `/sample` 이 없으면 히어로 CTA2 가 404 입니다(PRD §4 「B3-1은 B3-5 없이 배포 불가」). 🔴 배경 교차 불변식(O7) — 섹션을 2개 끼우면 하류가 연쇄로 뒤집힙니다. |
| **SUCCESS** | 필수 조건 9개 + 기존 테스트 전량 green + Match Rate ≥ 90. |
| **SCOPE** | 정적 문구 · 정적 페이지 2종 등재 · `/check` 문항과 그 전송 페이로드. **Supabase 무변경.** `trops_a` 무변경(수신부가 이미 하위호환). |

## 1. 선행 확인 (착수 전 실측 · 2026-08-23)

| # | 확인 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | `app.trops.kr/precheck` 가 파일 업로드 없이 도는가 | **✅ 돈다** | 라이브 제출 실측. 계약서 칸 = 「선택 · 없으면 비워두세요」, 폼 전체 `required` 0. `middleware.ts` `PROTECTED_PREFIXES` 에 `/precheck` 없음 |
| 2 | 룰셋 밖 품목이 에러가 아니라 대기 등록인가 | **✅ 대기 등록** | 일본 + 화장품 + HS 3304991000 실측 → 「접수 내용을 대기 목록에 남겼습니다」(`lib/rulesets/coverage-notice.ts` `HS_UNCOVERED_NOTICE`) |
| 3 | 토스 심사가 끝났는가 | **❌ 진행 중** | PRD §2 P-1 · §8-2 미결 4번 미해소. 종료 기록 두 저장소 0건 → 가격·결제 미접촉 유지 |
| 4 | `/api/prestep` 이 구·신 형식을 모두 받는가 | **✅ 받는다** | `trops_a/lib/precheck/prestep.ts` — `PRESTEP_STAGES`·`PRESTEP_DOC_KINDS`·`PRESTEP_MANAGEMENTS` 가 구 어휘 **옆에** 서 있고, `formatOf()` 가 필드 이름으로 가릅니다 |
| 5 | 3탭 이미지가 플레이스홀더인가 | **❌ 실제 캡처** | `assets/img/precheck-report.jpg` 142KB, 실제 제품 화면(문언 대조 결과). **교체하지 않습니다** |

## 2. 필수 조건 (AC)

| # | 조건 | 검증 |
|---|---|:--|
| **AC-1** | `/sample`·`/en-sample` 이 빌드 산출물에 포함 · 200 | G1 · 배포 후 실측 |
| **AC-2** | 히어로 CTA2 = 국문 `/sample`, 영문 `/en-sample` | G2 |
| **AC-3** | 두 샘플 파일에 등급·위험 점수·「즉시 조치 필요」/"immediate action required" **0건** | G3 |
| **AC-4** | 두 샘플 파일에 예시 표기(워터마크·상단 바·하단 고지) 전부 잔존 | G4 |
| **AC-5** | `en-sample.html` 하단 CTA = `[ Contact ] → /en#interest`, 무료시작 계열 0건 | G5 |
| **AC-6** | 저장소 전체에서 **폐기된 산출물 명칭** 0건 (「진단」은 동사로만) | G6 |
| **AC-7** | `precheck.html`·`en-precheck.html` 가격·결제 **diff 0줄** | G7 (바이트 비교) |
| **AC-8** | 국문·영문 양쪽 반영 | G8 (영문은 §4 제약 범위에서) |
| **AC-9** | 기존 테스트 전량 green | `npm test` |

## 3. 작업 항목

| ID | 대상 | 작업 |
|---|---|---|
| B3b-1 | `index.html` `.hero` | §5-1 로 교체 · CTA1 `app.trops.kr/account/password` · CTA2 `/sample` |
| B3b-2 | `index.html` `#how` | §5-4 로 교체 · CTA `app.trops.kr/account/password` |
| B3b-3 | `index.html` 탭① 패널 | §5-5 로 교체 · CTA `app.trops.kr/precheck` |
| B3b-4 | `index.html` **신설** | 진단 가능 범위 (§5-6) · CTA `app.trops.kr/precheck` |
| B3b-5 | `index.html` **신설** | 샘플 (§5-11) · CTA `/sample` |
| B3b-6 | 루트 · `scripts/build-static.js` | `sample.html`·`en-sample.html` 이식 + STATIC 등재 + `:root` 브랜드 정렬 |
| B3b-7 | `check.html` | §5-18 3문항 + 분기 결과 교체 · 전송 페이로드 신 어휘 |
| B3b-8 | `test/` · `scripts/` | `check-b3b-gates.js` 신설 · 구 어휘 기대값 갱신 |

## 4. 원본 부재로 건너뛴 항목 〔사용자 지정 「원본 규칙」〕

| 항목 | 부재한 원본 | 근거 |
|---|---|---|
| **영문 히어로 (§5-1 en)** | PRD §5 **영문 확정본** | PRD 본문에 영문 §5 가 0건. `docs/copy/trops_en_랜딩문구_v2.md` 는 **국문 v3.1(2026-08-11) 기준**이라 §5 를 담지 않습니다 |
| **영문 HOW (§5-4 en)** | 〃 | 〃 |
| **영문 탭① (§5-5 en)** | 〃 | 〃 |
| **영문 진단 가능 범위 (§5-6 en)** | 〃 | 〃 |
| **영문 샘플 섹션 (§5-11 en)** | 〃 | 〃 |
| **영문 `/check` 3문항 (§5-18 en)** | 〃 | 〃 |

> 이 부재는 **이번에 발견된 것이 아닙니다** — `docs/04-report/landing-b2-products-footer.report.md` 와
> `landing-b3a-basis-pricing.report.md` 가 둘 다 이월 항목으로 「PRD §5 영문 확정본」을 적어 두었습니다.
> 🔴 **영문에서도 하는 것**: `en-sample.html` 이식·STATIC 등재·`:root` 정렬. 새 문구가 필요 없습니다.

## 5. 위임받은 의사결정

| # | 결정 | 근거 |
|---|---|---|
| 1 | `sample.html`·`en-sample.html` 은 **`trops_a/doc/self12/` 에서 그대로 가져온다** | 지시는 「저장소 루트에 이미 있다」였으나 이 저장소에 0건이고 git 이력에도 없습니다. 실물은 `trops_a` 에 있고 지시가 요구한 조건(등급·위험점수 0 · 워터마크 · en 하단 CTA)을 이미 충족합니다. **원본이 있으므로 건너뛰지 않고**, 내용 무수정으로 옮깁니다 |
| 2 | `:root` 정렬은 **`--ink`·`--brand` 두 값만** | 랜딩의 브랜드 토큰은 `--ink #0F172A` · `--accent #1D4ED8` 입니다. 샘플의 `--line`(#e2e8f0)·`--ink-2`(#0f172a)는 이미 같고, `--mut`·`--bg`·상태색 3쌍은 랜딩에 대응 토큰이 없습니다 — 「브랜드 컬러가 다르면」의 범위 밖이라 건드리지 않습니다 |
| 3 | `check.html` h1 은 **「30초 사전 확인」 유지** | §5-18 첫 줄 「30초 수출 업무 진단」은 명사 「진단」입니다. 사용자 지정 필수 조건 6이 「진단은 동사로만 허용」이고, `test/prestep-flow-s10.test.js:193` 이 이 페이지의 「진단」을 이미 못질하고 있습니다(필수 조건 9 = 전량 green). 지시받은 작업 단위는 **3문항 교체**이므로 문항과 분기만 갈고 페이지 제목은 그대로 둡니다 |
| 4 | 서류 보유 분기 목적지 = `app.trops.kr/procedures/new` | §5-18 이 라벨을 「거래 등록하고 시작하기」로 바꿨고, PRD §6-1 에서 **등록** 목적지는 이 경로 하나입니다(상품② 「수출 계약 등록하기」와 같은 문) |
| 5 | 서류 없음 분기 목적지 = `app.trops.kr/precheck` | §5-18 문안이 「품목과 국가 입력만으로 수출 사전점검」이라 §6-1 의 사전점검 목적지와 같은 곳입니다 |
| 6 | `?pre=`·`?docs=` 프리필 **제거** | 목적지가 랜딩 `/precheck` 에서 앱으로 바뀌면서 그 쿼리를 읽는 쪽이 없어졌습니다. 읽히지 않는 파라미터를 실어 보내면 「연결돼 있다」는 오해만 남습니다. 🔴 **퍼널 영향**: `/check` 경유 접수의 `intake_id` 역기입(`precheck-prestep-link` cron)이 더 이상 발생하지 않습니다 — 보고 항목 |
| 7 | 위치 표시(`PLACE_OF`) = `contract`·`quotation_pi` 두 값만 `(2)` | 블록2 의 (2)번 칸이 문면으로 「견적서·PI·매매계약서」라고 적고 있어 이 둘만 **글자로 대응**합니다. `invoice_bl`·`insurance_policy`·`other` 는 세 칸 어디에도 이름이 없어 기존 미지 경로(「어느 자리인지는 서류를 봐야」)로 보냅니다 — 임의 배정은 이 파일이 명시적으로 금지한 것입니다 |
| 8 | 3탭 이미지 **교체하지 않음** | 지시의 조건은 「플레이스홀더면」이었고 실측 결과 실제 제품 캡처입니다 |

## 6. Success Criteria

- G1~G8 전량 pass (`node scripts/check-b3b-gates.js`)
- `npm test` 전량 green
- Match Rate ≥ 90
- 배포 후 `/sample`·`/en-sample` 200 · 히어로 CTA2 국·영문 동작 · `/check` 문항 교체 반영 · `/precheck` 결제 화면 무변화

## 7. 범위 밖

`precheck.html`·`en-precheck.html` 가격·결제 · Supabase 스키마 · `trops_a` 코드 · 영문 §5 문구 · 3탭 이미지 파일.
