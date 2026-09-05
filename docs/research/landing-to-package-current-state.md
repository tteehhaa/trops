# 랜딩 → 무역보험 준비패키지 현재 상태 조사

조사일: 2026-09-04
조사 범위: 코드 읽기 전용 (수정 없음, UI/카피 변경 없음, DB migration 없음, 신규 기능 구현 없음)

## 0. 저장소 지도

이 목표 흐름(랜딩→사전점검→준비패키지→주문→결제→Admin→서류→전달)은 **하나의 저장소에 있지 않다.** 실제로는 3개 저장소로 나뉘어 있고, 그중 2개가 이 흐름에 관여한다.

| 저장소 | 정체 | 이 조사에서의 역할 |
|---|---|---|
| `main_web_page` (現 세션 cwd, "trops-landing") | Next.js가 아니라 **정적 HTML + Vercel serverless(api/*.js)**. 빌드(`scripts/build-static.js`)가 `dist/`를 만든다 | 랜딩 화면, 리드 접수(`/contact`), 구 유료상품("서류 사전 확인"/NDA) 결제 후처리 잔재 |
| `trops_a` (`/Users/hanabeom00/Projects/dev/trops_a`, 도메인 `app.trops.kr`) | 실제 Next.js 14 App Router 앱. 사전점검 실행, 로그인, 보험 준비패키지 주문, Admin 전부 여기 있음 | 이 조사의 핵심 대상 |
| `trops_x` | `class/` 폴더 하나뿐, 이 서비스와 무관 | 조사 제외 |

두 저장소는 `main_web_page/vercel.json`의 redirect로만 연결된다(예: `/precheck?r=토큰` → `https://app.trops.kr/c/:token`). **코드 레벨 공유는 없다** — `site.config.json` 주석이 스스로 "자동 연동은 이 저장소 구조상 불가능하다"고 명시한다.

---

## 1. 랜딩 관련 전체 Route/Component 조사

### 1-A. 랜딩 저장소 (`main_web_page`)

| Route | 화면 목적 | 주요 CTA | CTA 목적지 | 로그인 필요 | 실제 동작 | 상태 |
|---|---|---|---|---|---|---|
| `/` (`index.html`) | 메인 랜딩. "①사전점검 ②무역보험 준비패키지 ③수출대금 관리" 3단계 스토리 | "1분 무료 진단(시작)"(`:359,369,588`), "상담 문의"(`:370,589`), "사전점검 시작하기"(`:423`), "무역보험 준비 패키지 확인"(`:441`), "출시 알림 받기"(`:453`) | `/precheck`, `/contact?type=consult`, `https://app.trops.kr/insurance/quick?from=landing`, `/contact?type=notify` | 불필요 | LIVE | LIVE |
| `/precheck` (`precheck.html`, `/check`는 이곳으로 redirect) | 5문항 클라이언트 계산 미니진단(서버 저장 없음, `:420` "입력값을 저장하지 않습니다") | "이어서 작성하기"(`:470`) → `https://app.trops.kr/export-precheck/new`, "무역보험 준비 패키지 확인"(`:473`) → `https://app.trops.kr/insurance/quick?from=precheck` | 위 2곳 (다른 저장소) | 불필요(진단까지). 제출 시 trops_a가 계정 요구 | LIVE (계산 로직) / 목적지는 저장소 밖 | LIVE→PARTIAL(경계 넘어가면 판정 불가, §4 참조) |
| `/contact?type=consult\|quote\|notify` | 상담/견적/알림 접수 폼 | "보내기"(`data-track="contact-submit"`) | 폼 제출 (intake API 추정) | 불필요 | LIVE이나 `quote`는 고아(§3) | LIVE(consult/notify) / DEAD(quote, 아래 §2 참조) |
| `/en` | 영문 랜딩 | 국문과 동형 | `https://app.trops.kr/export-precheck/new` (redirect가 직결) | 불필요 | LIVE | LIVE |
| `/privacy`, `/en-privacy` | 개인정보처리방침 | — | — | — | LIVE | LIVE |
| `/refund`, `/en-refund` | 환불정책. **대상 상품이 "서류 사전 확인(2026-08-20 접수분까지)"** — 스스로 종료 상품이라고 명시(`refund.html:29,229-241`) | 이메일(mailto) | — | 불필요 | 문서는 살아있으나 대상 상품 없음 | LIVE 문서 / DEAD 상품 |
| `/nda`, `/uae`, `/en-nda`, `/en-uae` | 구 상품 페이지 | — | `vercel.json` redirect → `/` 또는 `/en` | — | 파일 자체 삭제됨 | DEAD |

### 1-B. 앱 저장소 (`trops_a`) — 사전점검·보험·로그인·결제·Admin

⚠️ 아래 표를 읽기 전에 반드시 알아야 할 것: **"사전점검"이라는 이름이 이 저장소에서 서로 무관한 두 제품을 가리킨다.**

| 트랙 | Route | 실체 |
|---|---|---|
| **트랙 A** (구 유료상품) | `/precheck`, `/precheck/diagnose`, `/precheck/results[/id]`, `/c/[token]`, `/c/[token]/buyer\|expert` | 계약서(NDA)를 올리면 내부 콘솔이 대조하는 서비스. 로그인 필요, 결과는 토큰 링크로 고객에게 공개. **무역보험/준비패키지와 무관** |
| **트랙 B** (신규, 이 조사의 목표 흐름) | `/export-precheck`, `/export-precheck/new`, `/export-precheck/[runId]/*` | 바이어·결제조건·HS코드 진단 → 결과 리포트에 "대금·보험" 섹션 존재. **보험 준비패키지로 이어지는 트랙은 이쪽** |

랜딩의 국문 기본 CTA(`/precheck` → precheck.html → "이어서 작성하기")는 실제로는 **트랙 B(export-precheck)로 간다** — 링크가 `https://app.trops.kr/export-precheck/new`이기 때문이다. 다만 `main_web_page/vercel.json`의 `/precheck?r=토큰` redirect(쿼리 `r`이 있는 경우)는 트랙 A(`/c/:token`)로 간다 — 이건 과거 트랙 A 상품을 쓰던 고객이 결과 링크를 열 때 쓰는 경로로 보인다. 즉 **두 트랙이 같은 `/precheck` 경로를 공유하며 쿼리 유무로 갈린다.**

| Route | 목적 | 로그인 필요 | 주요 CTA | 다음 route | 상태 |
|---|---|---|---|---|---|
| `/export-precheck/new` | 수출 사전점검 입력 폼(14항목) | **아니오**(미들웨어 exempt) — 제출(서버액션)만 로그인 필요 | "제출" | 비로그인→`/login?next=...`, 로그인→`/export-precheck/[runId]/execution` | LIVE |
| `/export-precheck/[runId]/{buyer,contract,customs,execution,payment,shipping,source,report}` | 단계별 실행 파이프라인 | 예 | 단계 진행 | report(결과) | LIVE |
| `/export-precheck/report` | 비로그인용 공개 리포트(브라우저 sessionStorage만 읽음, DB 조회 없음) | 아니오 | — | — | PARTIAL |
| `/precheck/diagnose` (트랙 A) | NDA 진단 내부 콘솔 | 예(즉시 `/login` redirect) | "진단서 제출" | 결과 | LIVE(운영용) |
| `/c/[token]`, `/c/[token]/buyer\|expert` (트랙 A) | 고객용 공개 NDA 대조 결과지 | 아니오(토큰) | PDF/보정요청 | — | LIVE |
| `/login`, `/auth/callback`, `/reset-password[/done]` | 로그인/가입/비밀번호 재설정 | — | 로그인 | `next` 목적지 | LIVE |
| `/account/setup[/contact,/signature]`, `/account/password` | 자사정보 온보딩(선택), 비밀번호 설정 | 예(강제 게이트 아님) | — | `/profile` | LIVE |
| `/insurance/quick` | **보험 준비패키지 "확인"** — 무료 판정 입력(7칸) | 아니오(공개 퍼널 입구로 미들웨어에서 의도적으로 제외) | "요청 확정하러 가기"류 | `/insurance/order` | LIVE |
| `/insurance/order` | **보험 준비패키지 "주문"** — 로그인 후 확정 | 예(`/login?next=/insurance/order`) | "요청 확정" | 접수 완료 화면 | LIVE(실제 DB insert) |
| `/pay`, `/pay/select`, `/pay/success`, `/pay/fail` | **다른 상품**(buyer-check "공개정보 조회") 결제 — 준비패키지와 무관 | 예(보호 접두어) | 결제 | 성공/실패 화면 | LIVE(buyer-check 한정) |
| `/admin/insurance-orders`, `/admin/insurance-orders/[id]` | 운영자용 준비패키지 주문 목록/상세 | 예(관리자 이메일 화이트리스트) | 상태 전이, 메모 | — | LIVE |
| `/admin/funnel`, `/admin/analytics`, `/admin/signals` | 운영 대시보드 | 예 | — | — | LIVE(단, §14 blind spot 참조) |
| `/profile/insurance`, `/profile/insurance/upload` | **준비패키지와 무관** — 기존 가입 보험상품의 채권잔액(AR) 업로드 | 예 | 파일 업로드 | — | LIVE(다른 기능) |
| `/share/l1/[token]`, `/reports/[id]`, `/verify/[id]` | 수출채권관리(L1)·자가진단서 공개 전달 화면 — **준비패키지와 무관** | 아니오(토큰) | — | — | LIVE(다른 기능) |

---

## 2. 랜딩에서 현재 실제로 판매하는 상품 조사

| 랜딩 상품명 | 설명 | 가격 노출 | CTA | 실제 연결 기능 | DB/Product 연결 |
|---|---|---|---|---|---|
| "수출 사전점검" (1단계, 무료) | 무료 미니진단 → 본진단 | "무료" | `/precheck` → `export-precheck/new` | LIVE, 다단계 실행 파이프라인 | `export_precheck_run` 등 7개 테이블(0043~0058), **company/deal FK 없음, user_id만** |
| "무역보험 준비 패키지" (2단계, 유료) | "거래 한 건 단위" | **가격 미노출**(숫자 없음) | `/insurance/quick?from=landing\|precheck` | `/insurance/quick`(확인, 미저장)→`/insurance/order`(로그인, DB insert) | `export_insurance_order`(0052~0057). **product는 `post_shipment_individual`/`direct_post_shipment` 2종 하드코딩 TS 유니온, DB product table 없음, 가격 컬럼 자체가 없음** |
| "수출대금 관리" (3단계) | "준비 중" | — | "출시 알림 받기" → `/contact?type=notify` | 미출시 | 없음 |
| "서류 사전 확인" (구 유료상품, 예전엔 "수출 사전점검"과 이름 충돌했다가 개명) | NDA/계약서 대조 | 과거 `LIST_PRICE=290000`/`PRICE=330000`(`api/_payment.js:51,76`) | **없음 — 어떤 활성 CTA도 안 가리킴** | **DEAD**: 2026-08-20 접수 마감(오늘 기준 이미 지남), 프런트엔드 연결 0개. Toss 연동은 환불 처리용으로만 생존 | `payments`류 (main_web_page 자체 API), trops_a `/pay/*`와는 다른 키 세트 |
| "견적 요청"(`/contact?type=quote`) | 예전 유료 견적 접수 창구 | — | **없음(고아)** | 코드 주석 스스로 "`/insurance/order` 생기면 삭제 예정"이라 선언(`contact.html:353-369`) | 없음 |

**저장소 간 명칭 불일치**
- 랜딩 "무역보험 준비 패키지"는 하나의 이름이지만, trops_a에서는 `/insurance/quick`(확인)·`/insurance/order`(주문) **두 화면**으로 나뉘고, 랜딩은 앞쪽(quick)까지만 연결한다.
- "수출 사전점검"이라는 한 이름이 trops_a 안에서 **완전히 다른 두 제품**(구 NDA 콘솔 트랙 A / 신규 export-precheck 트랙 B)을 가리킨다. 과거엔 유료상품 쪽도 이 이름을 썼다가 "서류 사전 확인"으로 개명해 분리했지만(`refund.html:229-234`), 앱 내부 route 이름(`/precheck`)에는 그 흔적(트랙 A)이 그대로 남아 있다.
- Admin 화면 이름은 "보험서류 서비스" 류가 아니라 코드/화면 모두 `insurance-orders`(영문)로 일관되어 있음 — 이 부분은 명칭 불일치 없음.

---

## 3. 모든 CTA 조사

| 위치 | 문구 | data-track | destination | 로그인 | DB 오브젝트 | 최종 도달 지점 | 비고 |
|---|---|---|---|---|---|---|---|
| index.html nav/hero | 1분 무료 진단(시작) | `nav-precheck`/`hero-precheck`/`final-precheck` | `/precheck` | 불필요 | `page_events` | precheck.html 미니진단 | LIVE |
| index.html hero/final | 상담 문의 | `hero-consult`/`final-consult` | `/contact?type=consult` | 불필요 | `page_events`+intake(추정) | 접수 후 이메일 회신 | **문의만 남기고 끝나는 CTA** |
| index.html 1단계 카드 | 사전점검 시작하기 | `step1-precheck` | `/precheck` | 불필요 | `page_events` | precheck.html | LIVE |
| index.html 2단계 카드 | 무역보험 준비 패키지 확인 | `step2-quote` | `https://app.trops.kr/insurance/quick?from=landing` | 앱 쪽에서 결정 | `page_events`(라벨만) | **저장소 경계를 넘어감 — 사전점검을 거치지 않고 직행** | `from=landing`이 유일한 유입 출처 단서 |
| index.html 3단계 카드 | 출시 알림 받기 | `step3-notify` | `/contact?type=notify` | 불필요 | intake/leads(추정) | 이메일 알림 등록 | 기능 미출시 → **의도된 dead-end** |
| precheck.html 결과 | 이어서 작성하기 | `precheck-diagnosis` | `https://app.trops.kr/export-precheck/new` | 제출 시까지 불필요 | `export_precheck_run` | 트랙 B 전체 진단 진입 | LIVE, 크로스레포 |
| precheck.html 결과 | 무역보험 준비 패키지 확인 | `precheck-pack` | `https://app.trops.kr/insurance/quick?from=precheck` | 앱 쪽에서 결정 | `page_events` | 위 step2-quote와 동일 목적지 | 사전점검 응답값(점수 등)은 전달 안 됨 |
| contact.html | 보내기 | `contact-submit` | 폼 제출 | 불필요 | intake/leads(추정) | 접수 확인+이메일 | `type=quote`는 사람이 회신하고 끝 — 결제/주문 자동 연결 없음 |
| **(앱 내부)** `/insurance/quick` | "요청 확정하러 가기"류 | — | `/insurance/order`(로그인 게이트) | 예 | 없음(quick 단계는 클라이언트 계산만, DB 미저장) | 로그인 후 order 화면 | 값은 세션 안에서만 이동, quick 단계 자체는 저장 안 됨 |
| **(앱 내부)** `/insurance/order` | "요청 확정" | — | 접수 완료 | (이미 로그인) | `export_insurance_order` INSERT | Admin `/admin/insurance-orders`에 노출 | **실제 DB insert가 도는 LIVE 지점 — 이번 조사에서 확인된 유일한 "진짜 주문 생성" CTA** |
| **(앱 내부, MISSING)** `/export-precheck/[runId]/report` | — | — | **없음** | — | — | — | 사전점검 결과 화면에는 보험/준비패키지로 가는 CTA(버튼·링크)가 **0건**(grep 확인) — "보험 축" 정보는 표시되지만 클릭할 것이 없다 |

**Dead-end / 연결 끊김 요약**
- `/contact?type=quote`: 고아 CTA(§2).
- `main_web_page/api/_payment.js`, `payment-confirm.js`: 프런트엔드 연결 0개, 환불 처리 전용 잔재.
- "무역보험 준비 패키지" CTA 2곳 모두 `/insurance/quick`(확인)까지만 — **랜딩 관점에서는 실제 주문(`/insurance/order`)이나 결제로 이어지는지 알 수 없다** (§5, §8에서 앱 내부까지 추적).
- 앱 내부에서 가장 심각한 dead-end: **사전점검 결과 리포트 → 준비패키지 CTA가 없음** (§5).

---

## 4. 랜딩 → 수출 사전점검

```
LANDING(en 전용 CTA / ko precheck.html "이어서 작성하기") → /export-precheck/new(공개, LIVE)
  → 폼 입력(바이어/결제조건/품목/HS/운송 등 14항목, 파일 업로드는 로그인시만 노출)
  → 제출:
     • 로그인 상태 → startExportPrecheck 서버액션 → createExportPrecheckRun(DB insert, user_id 귀속) → /export-precheck/[runId]/execution
     • 비로그인 상태 → AnonymousDraft(클라이언트)가 제출을 가로채 sessionStorage에 폼 값 저장
       → /login?next=/export-precheck/new(쿼리 포함) → 로그인/가입 성공 → next 복귀
       → mount 시 sessionStorage 값을 폼에 자동 복원(네이티브 setter+이벤트 디스패치) → 재제출
  → 다단계 실행(buyer→contract→customs→execution→payment→shipping) → report(결과)
```

| 질문 | 판정 | 근거 |
|---|---|---|
| 비로그인 상태에서 시작 가능한가? | **LIVE** | `/export-precheck/new`가 미들웨어 exempt(`lib/auth/protected-routes.ts`) |
| 어떤 데이터를 먼저 입력하는가? | 바이어·결제조건·품목·HS코드·운송 등 14항목 | `app/export-precheck/new/page.tsx` |
| draft가 만들어지는가? | **LIVE(비로그인=클라이언트 sessionStorage) / LIVE(로그인=DB row)** | `AnonymousDraft`, `startExportPrecheck` |
| 로그인 전 입력값이 로그인 후 유지되는가? | **LIVE — 유실 없음**(파일 제외) | sessionStorage 캡처/복원 메커니즘이 이 문제를 정면으로 해결하도록 설계됨(2026-08-30 주석) |
| 사전점검 결과가 trade(거래/deal)와 연결되는가? | **MISSING** | `export_precheck_run` 테이블에 `user_id`만 있고 `deal_id`/`company_id` 컬럼 자체가 없음(직접 확인, `supabase/migrations/0043_export_precheck.sql:63-102`) |
| company와 연결되는가? | **MISSING** | 이 저장소 전체에 `companies` 류 전용 테이블이 없음 — "회사"는 프로필의 자유 텍스트(`company_name`)로만 존재 |
| 결과를 저장할 수 있는가? | LIVE | run이 user_id에 귀속되어 DB에 남음 |
| 결과 PDF가 생성되는가? | **PARTIAL** | 서버가 파일을 만들어 저장/이메일 발송하는 방식이 아니라 **브라우저 인쇄(`@media print` + `PrintButton`)로 그때그때 PDF화**하는 구조(`app/export-precheck/[runId]/report/page.tsx:65,196,264-268`) — 재발급·이메일 첨부 가능한 저장된 PDF 자산은 아님 |
| 재방문 시 동일 결과에 접근 가능한가? | LIVE(추정) | `/export-precheck/[runId]`, `/export-precheck`(목록) route 존재 |

**흐름 판정**
```
LANDING(PARTIAL — ko 기본 CTA는 아래 참고) → CHECK(LIVE) → PRECHECK INPUT(LIVE) → RESULT(LIVE)
→ LOGIN(LIVE, 무손실) → TRADE SAVE(MISSING — company/deal 연결 없음) → PDF(PARTIAL — 브라우저 인쇄뿐)
```

⚠️ **국문 랜딩의 실질 위험**: `main_web_page/vercel.json`의 `/precheck?r=토큰` redirect는 트랙 A(`/c/:token`, 구 NDA 콘솔 결과지)로 간다. 사용자가 과거 발급받은 결과 링크(`r=` 쿼리 포함)로 재방문하면 무역보험과 무관한 화면에 떨어진다. 반면 랜딩의 **일반 CTA**(쿼리 없는 `/precheck`)는 트랙 B(export-precheck)로 정상 연결된다.

---

## 5. 사전점검 결과 → 준비패키지 전환 (가장 중요)

**결론: 앱 내부(사전점검 결과 화면)에는 준비패키지로 가는 CTA가 없다.** 대신 랜딩이 사전점검을 거치지 않고 별도로 `/insurance/quick`에 직접 CTA를 쏜다.

| 단계 | 상태 | 근거 |
|---|---|---|
| 수출 사전점검 완료 → 결과 확인 | LIVE | `app/export-precheck/[runId]/report/page.tsx`(908줄) |
| 결과 화면 안 "무역보험 필요/축" 표시 | LIVE(정보 표시만) | `report/page.tsx:78-96`이 `lib/constants/insurance.ts`, `INSURANCE_AXIS_STATUS`를 import해 보험 축 상태를 보여줌 — **판정 결과 표시일 뿐, 클릭 가능한 요소 아님** |
| 결과 화면 → 준비패키지 CTA(버튼/링크) | **MISSING** | `report/page.tsx` 전체(908줄)에 `insurance` 관련 `href`/`Link` 참조 **0건**(grep 확인). `prep-pack-quick.tsx`/`prep-pack-order.tsx`는 오직 `app/insurance/quick`, `app/insurance/order`, `app/admin/insurance-orders*`에서만 import됨 — report 페이지는 참조하지 않음 |
| "거래관리에서 trade_id를 실어 `/insurance/quick`로 보낸다" | **MISSING(설계만, 미구현/롤백됨)** | `components/nav/app-shell.tsx:55` 주석에 의도는 적혀 있으나, 실제로 이 쿼리를 만드는 코드는 0건. `lib/constants/tabs.ts:940-949`: "2026-09-03 메뉴 항목으로 하루 등재됐다가, trade_id를 실어 나를 수 없어 예시 거래가 뜨는 바람에 되돌려졌다" — **한 번 시도했다가 롤백된 상태** |
| 상품 선택(`/insurance/quick`) | LIVE(별도 진입점) | 로그인 불필요, `searchParams.from`(landing/precheck/app)만 기록. 랜딩 `index.html:441`이 사전점검을 거치지 않고 직접 연결 |
| 주문(`/insurance/order`, 로그인 필요) | LIVE | `/login?next=/insurance/order`로 게이트 |
| 결제 | **MISSING(의도적으로 미구현)** | `supabase/migrations/0052_export_insurance_order.sql:65-66` 주석: "금액 칸이 없다 — 요금은 요청 뒤 사람이 안내한다. 표에 금액 칸을 두면 화면이 그것을 읽어 표시하는 길이 열린다" → 가격 자동화를 **의도적으로** 만들지 않은 것으로 코드가 스스로 밝힘 |

**요약**: "결과 확인 → 준비패키지 CTA 클릭" 구간이 코드상 끊겨 있다. 현재 살아있는 유일한 경로는 **"랜딩 → (사전점검을 거치지 않고) → `/insurance/quick` → `/insurance/order`(로그인) → 수동 견적/결제 안내"** 이다.

---

## 6. 준비패키지 신청/주문 Form

`/insurance/quick`이 판정 입력(7칸)을 받고, 그 결과(draft, 클라이언트 상태로만 존재·DB 미저장)를 `/insurance/order`(로그인 후)에서 "요청 확정"한다.

| 입력값 | 사용자 입력 | 기존 TROPS 데이터 자동사용 | DB 저장 위치 | Admin 전달 |
|---|---|---|---|---|
| 금액/결제기간/목적국/결제방식/기업규모/거래종류/소재지(판정 7칸) | O | 거래관리에서 `trade_id`로 들어오면 프리필하는 **설계는 있으나 실제 진입 경로가 없어(§5) 사실상 항상 신규 입력** | `export_insurance_order.input_snapshot`(jsonb) | 상세 화면 |
| 판정 결과(verdicts) | 자동 계산(quick 단계) | 서버가 재계산하지 않고 draft 그대로 저장 | `export_insurance_order.findings_snapshot` | 상세 화면 |
| 회사명 | 입력/정정 가능 | **자동 프리필됨**(내정보 쿠키 값, `0057_export_insurance_order_names.sql:444`) | `export_insurance_order.company_name`(스냅샷, nullable) | 목록·상세 |
| 상대방(거래처) | 입력(선택) | 없음 | `counterparty_name`(nullable) | 목록·상세 |
| user_id / from_source | 시스템이 채움 | 로그인 세션 / `?from=` 쿼리 | 동명 컬럼 | 상세("유입원") |
| deal_id | 사용자 지정 불가 | draft에 기존 거래가 연결돼 있으면 자동 채움(실질적으로 발생 안 함, §5) | `deal_id`(nullable FK, `0056` NOT VALID) | 상세 |
| 파일(발주서 등) | **없음 — 업로드 칸 자체가 없음** | — | — | — |
| 금액/가격 | **없음(의도적)** | — | 컬럼 자체 없음 | 견적은 요청 후 사람이 별도 안내(채널 미확인) |

**재입력 문제(핵심 질문에 대한 답)**: 회사명은 자동 프리필(재입력 아님). 반면 **사전점검에서 이미 입력한 목적국/금액/결제조건 등 7칸은, 결과에서 곧장 넘어오는 경로가 없어(§5) 대부분의 사용자가 `/insurance/quick`에서 처음부터 다시 입력**한다. 이것이 "TROPS에 이미 있는 데이터를 다시 입력시키는" 사례다.

---

## 7. 상품 선택 구조

- **Product 정의**: `lib/insurance/products.2026-09.ts:47` — `type ProductId = "post_shipment_individual" | "direct_post_shipment"` (TS 유니온 **하드코딩**, DB product table·SKU·price_id 없음).
  - `post_shipment_individual` ≈ K-SURE 단기수출보험(선적후) 개별보험, `direct_post_shipment` ≈ "다이렉트 선적후"(청약서 없이 온라인 가입).
- **지원사업 매핑**: `lib/insurance/supportPrograms.2026-09.ts` — 지자체별 보험료 지원사업과 두 product id의 지원 가능 여부(yes/no/unverified)를 매핑한 하드코드 배열.
- **"보험상품 → 준비패키지 → 필요서류" 관계**: **존재함(LIVE, 코드 레벨)**. `lib/constants/insurance-prep-pack.ts`(약 671줄 부근)에 `post_shipment_individual: [...]` 형태로 상품별 필요서류 목록이 정의되고 `components/insurance/prep-pack-doc-list.tsx`가 렌더링. `direct_post_shipment`는 `DIRECT_DOCS`로 별도(수출통지 생략).
- **가격**: 상품별 가격 정의 자체가 코드 어디에도 없음(§5의 "금액 칸 없음" 설계와 일치).
- **주문 상태 8값**: `lib/insurance/prep-pack-status.ts` — `requested → quoted → paid → in_progress_1 → delivered_1 → awaiting_shipment → in_progress_2 → delivered_2`(다이렉트 상품은 `delivered_1`에서 종료). 이 상태 컬럼이 사실상 "생산 파이프라인" 역할까지 겸한다.

---

## 8. 가격/결제 구조

이 코드베이스에는 **서로 완전히 독립적인 결제 컨텍스트가 3개** 있다.

1. `main_web_page`의 구 "서류 사전 확인"(NDA) 선결제 — Toss, `PRECHECK_TOSS_*` 키.
2. `trops_a`의 `/pay/*` buyer-check(공개정보 조회) 결제 — Toss, `payments` 테이블. **보험/준비패키지와 무관.**
3. `trops_a`의 `export_insurance_order`(준비패키지) — **결제 게이트웨이가 전혀 없다.**

| 기능 | 구현 | 파일 | DB | 상태 | 문제 |
|---|---|---|---|---|---|
| Toss 결제 승인(buyer-check) | `confirmTossPayment()` 서버측 confirm | `lib/payment/toss.ts:33-75` | `payments` insert | LIVE(다른 상품) | 준비패키지와 무관 |
| 결제 성공 콜백 | `/pay/success`(paymentKey/orderId/amount, 멱등 처리) | `app/pay/success/page.tsx:71-110` | `payments`,`audit_log` | LIVE | 준비패키지 주문에는 이 콜백으로 오는 경로 자체가 없음 |
| 결제 실패/취소 | `/pay/fail` | `app/pay/fail/page.tsx` | 기록 안 함 | PARTIAL | 실패 사유 미보존 |
| 가격표(등급) | `VERIFY_TIERS`, 임의 금액 거부 | `lib/config/pricing.ts`, `lib/payment/tier-view.ts` | 코드 상수 | LIVE | buyer-check 전용 |
| **준비패키지 가격/결제** | **없음** | `lib/insurance/prep-pack-store.ts:107-156`(금액·결제수단 칸 자체가 insert 목록에 없음) | `export_insurance_order` | **MISSING** | 가격이 코드/DB 어디에도 없음 |
| 준비패키지 "결제" | 상태값(`paid`)일 뿐, 운영자가 수동 전이 | `lib/insurance/prep-pack-status.ts:38-90` | `.status` | MOCK(수기) | 어떤 PG 콜백과도 연결 안 됨 |
| 견적("quoted") | 라벨만 존재, 금액을 저장하는 칸 없음(코드 주석이 스스로 인정) | `app/admin/insurance-orders/page.tsx:39-40` | 없음 | MISSING | 운영자가 얼마를 안내했는지 시스템 기록 없음 |
| 주문 생성 순서 | **Order(요청) → (오프라인 견적/결제) → 운영자가 상태만 전이** | `prep-pack-store.ts` 주석 | `export_insurance_order` | 확정 | Order가 결제보다 먼저, 결제 자체가 시스템 밖 |

---

## 9. 로그인/회원가입 전환

- **가입 방식**: 매직링크는 폐기됨(`app/auth/callback/route.ts:11`). 현재는 **비밀번호 기반 + 이메일 검증 메일**(`/account/password` → `signUp({emailRedirectTo:/auth/callback})` → PKCE 코드 교환).
- **`next` 파라미터**: `/login`, `/auth/callback`, `resolvePostAuth` 전체가 오픈리다이렉트 방지 검증(`next.startsWith("/") && !"//"`)을 거쳐 안전하게 보존한다(`app/auth/post-auth.ts:18`).
- **미들웨어 게이트**: `middleware.ts:116-146` — `/pay`, `/profile/billing`, `/profile/insurance`, `/procedures`, `/export-precheck`, `/policies`, `/log`, `/buyer-check`, `/insurance/order`에 비로그인 접근 시 `/login?next=원경로`로 307. `/insurance/quick`은 **의도적으로 이 목록에서 제외**되어 공개 퍼널 입구를 유지한다.
- **draft 유실 여부(핵심 질문)**: `/export-precheck/new`는 **유실되지 않는다** — sessionStorage 캡처/복원이 정확히 이 문제를 해결하려고 설계됨(2026-08-30 주석). `/insurance/order`도 같은 패턴을 쓴다고 주석에 명시되어 있으나, **쿼리스트링은 리다이렉트 과정에서 잘린다**고 같은 주석이 밝힘(`lib/auth/protected-routes.ts:76`) — 즉 쿼리로만 전달되는 값(예: run_id)이 있다면 로그인 왕복에서 유실될 수 있다.
- **익명 데이터 계정 연결(범용 메커니즘)**: `/auth/link-data`는 **폐기됨**(`app/auth/callback/route.ts:51-56`, 판정 함수만 남고 소비처 0). 지금은 화면별 개별 sessionStorage 패치로만 대응 — 구조적 일반화가 안 되어 있다.
- **이메일 인증**: 가입 시 검증 메일 발송, 미검증 시 비밀번호 설정 불가 → 사실상 필수.
- **중복 trade 방지**: 미조사(company/deal 엔티티 자체가 없어 이 질문이 성립하지 않음, §10 참조).

---

## 10. 랜딩 → 주문 데이터 계보

```
Visitor            ──(pageview/click, page_events·precheck_app_event, PII 없음)──┐
                                                                                  │
User (auth.users)  ──LIVE, Supabase Auth──────────────────────────────────────┐  │
                                                                               │  │
Company            ──MISSING: 전용 테이블 없음. "회사"는 profile의 자유텍스트  │  │
                       company_name 필드로만 존재(여러 곳에 각자 스냅샷)      │  │
                                                                               │  │
Precheck (export_precheck_run) ──LIVE, user_id FK만 있음──────────────────────┤  │
      │  company_id/deal_id 컬럼 없음(0043 migration 확인)                    │  │
      ▼                                                                       │  │
Trade/Deal (deals/l1_deal) ──MISSING 연결: export_precheck_run → deal 로 이어지는│  │
      FK/코드 경로가 없음. "deals"는 수출채권관리(L1) 트랙 전용으로 별도 존재  │  │
                                                                               │  │
Insurance Preparation Need ──LIVE이나 "표시"일 뿐: report 페이지가 보험 축    │  │
      상태를 보여주지만, 이걸 저장하거나 다음 단계로 넘기는 오브젝트가 없음   │  │
                                                                               │  │
Package(선택, /insurance/quick) ──LIVE, 그러나 DB row 아님(클라이언트 draft) │  │
                                                                               │  │
Order (export_insurance_order) ──LIVE, 실제 INSERT. user_id 귀속, deal_id는  │  │
      nullable FK지만 실질적으로 항상 null(§5)                               │  │
                                                                               │  │
Payment ──MISSING: 이 테이블에 금액/결제 컬럼 자체가 없음. status='paid'는   │  │
      운영자가 손으로 바꾸는 라벨, 어떤 payments 레코드와도 FK 없음          │  │
                                                                               │  │
Admin Production Job ──별도 엔티티 아님: export_insurance_order.status       │  │
      (8값 상태기계)가 사실상 production job 겸용                            │  │
```

**정리**: `Visitor → User`는 LIVE, `User → Company`부터 이미 끊긴다(Company 엔티티 부재). `Precheck → Trade`, `Insurance Need → Package`, `Order → Payment`가 각각 별도로 끊겨 있어, 랜딩에서 시작한 한 사람의 데이터가 사전점검·주문·결제 단계를 거치며 **최소 3번 서로 다른 지점에서 연결이 끊긴다.**

---

## 11. 랜딩과 Admin의 연결

**"고객이 오늘 랜딩에서 준비패키지를 주문하면, 운영자는 현재 어느 화면에서 그 사실을 알 수 있는가?" → `/admin/insurance-orders`에서 확인 가능 (LIVE).**

- 목록 컬럼(`app/admin/insurance-orders/page.tsx:208-289`): 요청일, 회사(주문시점 스냅샷 또는 계정 이메일 폴백), 상대방, 목적국+거래금액(고객 입력값), 상품, 유입원(`from_source` — 여기서 `from=landing`/`from=precheck` 값이 보인다), 상태(8값), 경과일수+"우리 차례/고객 차례".
- 상태별 필터 + "우리 차례로 2일 넘게 멈춘 주문" 경고 배너 존재.
- 상세 화면에서 상태 전이(1칸씩만, 낙관적 잠금으로 경합 방지)와 운영 메모(`admin_note`, 비공개) 가능.
- **없는 것**: 결제 확인 증빙, 견적 금액, 첨부 서류, **새 주문 자동 알림**(운영자가 직접 페이지를 열어야 앎 — "파일은 메일로 보내고 여기서 상태를 넘긴다"는 문구가 스스로 이 구조를 설명, `page.tsx:147-148`).

결론: **주문 존재 자체는 LIVE, 결제·견적·서류는 시스템 밖(이메일/오프라인) → 종합 PARTIAL.**

---

## 12. 고객에게 추가 자료를 받는 흐름

- 준비패키지 주문에 연결된 파일 업로드/추가자료 요청 기능은 **없음(MISSING)**.
- `/profile/insurance/upload`는 겉보기엔 관련 있어 보이지만 **완전히 다른 기능**(이미 가입한 보험상품의 채권잔액 엑셀 업로드, `app/erp-upload/actions.ts` 재사용) — `export_insurance_order`와 무관.
- 서류 왕복은 전부 "이메일로 보낸다"(운영자 코멘트, `app/admin/insurance-orders/page.tsx:147`)로만 확인됨 — 업로드 링크, missing-document 상태, 재입력 방지 장치 없음.

---

## 13. 고객 전달까지 이어지는 공개 화면

기존에 이미 구현된 "서명 토큰 공개 URL" 패턴 2종이 있으나 **둘 다 준비패키지와 무관한 다른 기능**용이다.

- `/share/l1/[token]` — 수출채권관리(l1_deal) 진행상황 공유. 서명 토큰 판정(`verifyShareToken`), 로그인 불필요.
- `/reports/[id]` — 자가진단서(self-report) 진위확인 공개 페이지. 리포트 내용은 비노출, 발급 사실만 응답.
- `/verify/[id]`, `/verify/korea` — 별도 검증 화면(상세 미조사).

**평가(구현 아님)**: `export_insurance_order`에는 서명 토큰/공개 링크 컬럼이 전혀 없다(0052~0058 마이그레이션에 share_token류 없음). 다만 `l1-share`가 쓰는 패턴(랜덤 토큰 발급→DB 저장→서명 검증 후 공개 조회)은 구조적으로 재사용 가능해 보인다 — `deal_id`를 통해 `deals`와 연결되면 기존 `/share/l1/[token]`을 태울 수도, 준비패키지 전용 새 토큰을 만들 수도 있다(설계 결정 필요).

---

## 14. Analytics / Funnel Tracking

두 저장소 모두 **개인 식별자 없는 자체 집계**(`{kind, path, label}` 3필드)만 쓴다. GA4/GTM/Segment/Amplitude 등 외부 SDK는 **전혀 없음**(grep 0건).

| Funnel 단계 | 현재 이벤트(실제 이름) | 데이터 수집 | 분석 가능(Admin) | 추가 Tracking 필요 |
|---|---|---|---|---|
| landing_view | `pageview` | `page_events`(main_web_page) | O — `/admin/analytics` 일별 그래프 | 방문자 수 아님(새로고침마다 중복) |
| CTA click(랜딩) | `hero-precheck`,`step2-quote`,`precheck-pack` 등 11개 라벨 | `page_events` | O — `/admin/analytics` topClicks(라벨 랭킹만) | 시계열 아님 |
| check_start | `pageview` path=`/precheck`계열 | `page_events` | O — `/admin/funnel` 회원가입 퍼널 1단계 | — |
| login_start/complete | `signup_completed`, path=`/account/password` | `precheck_app_event` | O — `/admin/funnel` 2~3단계 | "login"이 아니라 "signup" 기준 |
| check_complete | `diagnosis_submitted`,`ruleset_intake_submitted` | `precheck_app_event` | O — `/admin/funnel` 4단계 | — |
| trade_save | **대응 이벤트 없음** | — | — | 신규 필요 |
| pdf_generate | **대응 이벤트 없음** | — | — | 신규 필요 |
| package_view/click | `insurance_status_viewed`,`prep_pack_clicked`,`policy_trade_linked` 등 | `precheck_app_event` | **X — 집계 화면 없음**(grep 0건) | **데이터는 쌓이는데 아무도 안 봄** |
| order_start/payment_start/payment_complete | **전무** | — | — | 결제 계측 전체가 블랙박스 |

**가장 큰 blind spot**
1. 결제/주문 단계가 완전히 미계측 — 사전점검 이후 어디서 이탈하는지 결제 직전까지는 보이지만 그 뒤는 안 보임.
2. `prep_pack_clicked` 등 보험 전환 이벤트는 이미 기록되지만 Admin 어느 화면도 집계하지 않음 — 전환율을 물으면 SQL을 직접 짜야 한다.
3. 랜딩 클릭 라벨(`precheck-pack`)과 앱 이벤트(`prep_pack_clicked`)가 이름·테이블이 달라(`page_events` vs `precheck_app_event`) 하나로 이어보는 로직이 signup 퍼널 외엔 없다.

---

## 15. End-to-End Funnel 판정

| 단계 | 상태 | 실제 Route/Object | 다음 단계 연결 | 핵심 문제 |
|---|---|---|---|---|
| LANDING | LIVE | `index.html` | O | — |
| PRECHECK | PARTIAL | `precheck.html` → `export-precheck/new`(정상 CTA는 트랙 B로 감; `?r=` 쿼리 딸린 구링크는 트랙 A로 감) | O(분기) | 두 트랙 공존, 재방문 링크가 다른 제품으로 갈 수 있음 |
| RESULT | LIVE | `export-precheck/[runId]/report` | X(다음 단계 없음) | 결과는 나오지만 "보험 축" 표시가 끝 |
| SAVE | PARTIAL | `export_precheck_run`(user_id만) | X | company/deal 연결 없음 |
| PDF | PARTIAL | 브라우저 `@media print` | — | 저장/이메일 가능한 서버 PDF 아님 |
| PACKAGE CTA(전환) | **MISSING** | 없음(report 페이지에 링크 0건) | X | **가장 핵심적인 단절 지점** |
| PACKAGE | LIVE(우회 경로로만) | `/insurance/quick`(랜딩에서 직접 진입) | O | 사전점검을 거치지 않고 도달 |
| ORDER | LIVE | `/insurance/order` → `export_insurance_order` INSERT | O | 실제 동작 확인됨 |
| PAYMENT | **MISSING** | 없음(가격 컬럼 자체 없음) | X | 결제 게이트웨이 없음, `paid`는 수기 라벨 |
| ADMIN | LIVE(가시성만) | `/admin/insurance-orders` | O | 결제증빙/견적금액/서류 미보유, 신규주문 알림 없음 |
| PRODUCTION | PARTIAL | `export_insurance_order.status`(8값) | O | 상태기계는 있으나 서류 제작 자체는 완전 오프라인 |
| DELIVERY | **MISSING** | 없음(prep-pack 전용 공개 전달 화면 없음) | — | `/share/l1`, `/reports/[id]` 패턴은 있으나 연결 안 됨 |

---

## 16. Conversion Blocker (최대 10개)

**P0**
1. 사전점검 결과 화면 → 준비패키지 CTA 자체가 없음(§5) — 목표 흐름 전체에서 가장 핵심적인 단절.
2. 준비패키지 주문에 결제 자동화·가격 컬럼이 전혀 없음(§8) — "돈을 받는" 절차 자체가 시스템 밖.
3. 국문 랜딩 재방문 경로(`/precheck?r=토큰`)가 보험과 무관한 트랙 A(NDA 콘솔)로 갈 수 있음(§4) — 의도한 국문 경로가 물리적으로 불완전.

**P1**
4. 사전점검에서 입력한 목적국/금액/결제조건 등을 준비패키지 신청 시 다시 입력해야 함(§6).
5. 랜딩/앱 클릭 이벤트 이름·테이블이 서로 달라 지금 당장 전환율을 측정할 수 없음(§14).
6. `prep_pack_clicked` 등 이벤트는 쌓이지만 Admin 어디에도 집계 화면이 없음(§14).
7. 새 주문 발생 시 운영자에게 자동 알림이 없음 — 직접 열어봐야 앎(§11).
8. 견적 금액을 시스템에 기록하는 칸이 없어 회계 추적이 안 됨(§8).

**P2**
9. `/contact?type=quote`(견적 요청)가 고아 CTA로 남아 혼선 소지(§2, §3).
10. "수출 사전점검"이라는 이름이 두 제품(구 NDA 트랙 / 신규 export-precheck 트랙)에 걸쳐 있어 route 레벨에서는 아직 완전히 정리되지 않음(§4).

---

## 17. KEEP / IMPROVE / REMOVE / NEW

| 랜딩 요소 | 현재 역할 | 판정 | 이유 | 준비패키지 Funnel과의 관계 |
|---|---|---|---|---|
| index.html 3단계 스토리(사전점검/보험준비/채권관리) | 랜딩 메인 내러티브 | KEEP | 스토리라인 자체는 명확, 배선만 필요 | 퍼널 진입점 |
| `/precheck` 미니진단 | 무료 후킹 장치 | KEEP | 실제 계산 로직 있고 잘 동작 | 1단계 |
| "무역보험 준비 패키지 확인" CTA(step2-quote/precheck-pack) | `/insurance/quick`로 연결 | IMPROVE | 사전점검 결과와 연결되지 않고 항상 새로 시작함 | 2→3단계 배선 |
| `/contact?type=quote` | 견적 접수(구) | REMOVE | 코드 스스로 폐기 예정 선언, 어떤 CTA도 연결 안 됨 | 무관(고아) |
| 구 "서류 사전 확인"/NDA 결제 잔재(main_web_page `api/_payment*.js` 등) | 프런트 연결 0개 백엔드 잔재 | REMOVE(정리 대상, 단 환불 처리 스크립트는 당분간 유지 필요) | 판매 종료 상품 | 무관 |
| export-precheck report의 "대금·보험" 섹션 | 정보 표시 | IMPROVE→NEW | 표시만 있고 행동(CTA) 연결이 없음 | **핵심 연결점** |
| `/insurance/order` 결제 필드/게이트웨이 | 없음 | NEW | 가격 저장·PG 연동 자체가 없음 | 4단계 |
| Admin 새 주문 알림 | 없음 | NEW | 운영자가 직접 열어봐야 앎 | 5단계 |
| 사전점검→`/insurance/quick` 자동 프리필(trade_id 등) | 한 번 시도 후 롤백 | NEW(재설계 필요) | 예시 거래가 뜨는 버그로 롤백됨 | 2→3단계 |
| 준비패키지 전환 이벤트 Admin 집계 | 데이터는 쌓이나 화면 없음 | NEW | 전환율을 알 수 없음 | 측정 |

---

## 18. V0 판매 가능성

| 구간 | 판정 |
|---|---|
| 고객: 랜딩 → 사전점검 | **PARTIAL** (국문 재방문 경로 혼선 있으나, 기본 신규 CTA는 정상 동작) |
| 고객: 사전점검 → 준비패키지 신청 | **MISSING** (CTA 없음. 단, `/insurance/quick` 우회 경로는 READY) |
| 고객: 결제 | **MISSING**(시스템) / 운영으로 우회 가능(계좌이체 등 오프라인 안내 + 수기 상태 전이는 이미 지원됨) |
| 운영자: 주문 확인 | **READY** (`/admin/insurance-orders`) |
| 운영자: 수기 서류 제작 | **PARTIAL** (상태 전이 도구는 있음, 서류 제작 자체는 완전 오프라인) |
| 운영자: 고객 전달 | **PARTIAL/MISSING** (이메일 수동, 서명 URL 전달 구조 미연결) |

**최소 연결 지점(코드 재사용 관점)**

기존 코드를 최대한 유지한다고 가정할 때, 실제 첫 유료 주문을 받기 위해 필요한 최소 작업은 다음 2가지로 좁혀진다:

1. **`export-precheck/[runId]/report` 페이지에 준비패키지로 가는 버튼 1개 추가** — 이미 보험 축 정보를 표시하고 있으므로, 그 옆에 `/insurance/quick?from=precheck&...`(가능하면 목적국/금액 등 기존 입력값을 쿼리로 프리필)로 가는 링크만 배선하면 §5의 단절이 해소된다.
2. **국문 랜딩의 재방문 경로(`/precheck?r=` redirect)를 트랙 B로도 커버**하거나, 최소한 어느 트랙으로 가는지 사용자에게 혼선이 없도록 정리.

나머지(주문 폼, `export_insurance_order` 테이블, 8단계 상태기계, Admin 목록/상세, 낙관적 잠금 상태 전이)는 **이미 구현되어 있고 실제로 동작한다.** 결제는 V0 단계에서 자동화할 필요가 없다 — 이미 "quoted → paid 수기 전이" 구조가 있으므로 계좌이체 안내 + 운영자 수동 확인만으로 첫 주문을 받는 것이 코드 변경 없이도 가능하다. 단, Admin에 새 주문 알림이 없다는 점(§11)은 V0 운영 리스크로 남는다 — 운영자가 주기적으로 화면을 확인해야 한다.

---

## Executive Summary

1. **랜딩에서 현재 실제로 판매(=결제까지 완결)하고 있는 것은 없다.** 과거 유료상품("서류 사전 확인"/NDA 대조, Toss 결제)은 2026-08-20 접수 마감으로 종료됐고, 무역보험 준비패키지는 주문까지는 되지만 결제 자동화가 없다.
2. **준비패키지로 전환되는 현재 경로는 "사전점검 결과 화면"이 아니라 "랜딩의 별도 CTA"뿐이다.** 사전점검을 정상적으로 마쳐도 결과 화면에는 준비패키지로 가는 버튼이 없다(§5) — 랜딩의 `step2-quote`/`precheck-pack` CTA가 사전점검을 건너뛰고 `/insurance/quick`으로 직행하는 것이 유일하게 살아있는 길이다.
3. **실제 Order는 생성된다.** `/insurance/order` 제출 시 `export_insurance_order` 테이블에 실제 INSERT가 일어나는 것을 코드로 확인했다(mock 아님, Server Action).
4. **실제 Payment는 연결되어 있지 않다.** 이 주문 테이블에는 금액·결제수단 컬럼 자체가 없고, `status='paid'`는 운영자가 손으로 바꾸는 라벨일 뿐 PG/웹훅과 무관하다. 결제는 설계상 의도적으로 시스템 밖(오프라인)에 남아 있다.
5. **Admin까지는 주문이 도달한다.** `/admin/insurance-orders`에서 오늘 들어온 주문을 목록·상세로 볼 수 있다(LIVE). 다만 새 주문 자동 알림, 결제 증빙, 견적 금액 기록은 없다.
6. **가장 큰 P0 blocker는 "사전점검 결과 → 준비패키지 CTA 부재"**다(설계는 있었으나 롤백된 상태). 그다음이 "준비패키지 결제 자동화 부재", 그다음이 "국문 재방문 경로가 다른 제품(트랙 A)으로 갈 수 있음"이다.
7. **이미 재사용 가능한 코드**: `/insurance/quick`→`/insurance/order` 주문 흐름 전체(폼, DB, Server Action), `export_insurance_order`의 8단계 상태기계, `/admin/insurance-orders` 목록/상세/낙관적 잠금, "상품→필요서류" 매핑(`lib/constants/insurance-prep-pack.ts`), 로그인 왕복 무손실 sessionStorage 패턴(export-precheck에서 검증됨), 서명 토큰 공개 전달 패턴(`/share/l1`, `/reports/[id]`).
8. **새로 필요한 최소 기능**: (a) 사전점검 결과 화면의 준비패키지 CTA 배선(값 프리필 포함), (b) Admin 신규 주문 알림, (c) 준비패키지 전환 이벤트(이미 수집 중)를 보여주는 집계 화면. 결제 게이트웨이 자동화는 V0에는 불필요.
9. **현재 코드로 가능한 V0**: "고객: 랜딩→사전점검→(별도 CTA로)준비패키지 신청→오프라인 결제 안내" / "운영자: `/admin/insurance-orders`에서 확인→오프라인 서류 제작→이메일 전달"은 **오늘 코드 그대로도 사람이 개입하면 작동한다.** 진짜 병목은 "사전점검을 정상적으로 마친 고객"을 준비패키지로 자동으로 넘기지 못한다는 것뿐이다.
10. **추천 다음 작업(구현 아님, 다음 단계 논의용)**: §18의 최소 연결 지점 2가지(결과 화면 CTA 배선, 국문 재방문 경로 정리)부터 검토하고, 그다음 Admin 알림과 전환 이벤트 집계 화면을 붙이는 순서를 제안한다.
