-- ============================================================================
--  TROPS /precheck — 앞단 전용 Supabase 스키마
--
--  ⚠️ 이 스크립트는 "앞단 전용 신규 Supabase 프로젝트" 에서 실행하십시오.
--     뒷단(trops_a) 프로젝트와 같은 곳에 만들면 리포 경계와 데이터 경계가 어긋납니다.
--
--  실행 방법
--    1) Supabase 대시보드에서 새 프로젝트를 만듭니다.
--    2) SQL Editor 에 이 파일 전체를 붙여넣고 실행합니다.
--    3) Project Settings → API 에서 URL·service_role key 를 복사해
--       Vercel 환경변수에 등록합니다 (Production·Preview 양쪽):
--
--         INTAKE_SUPABASE_URL                = https://<project-ref>.supabase.co
--         INTAKE_SUPABASE_SERVICE_ROLE_KEY   = <service_role key>
--         PRECHECK_ORIGIN                    = https://trops.kr        (선택)
--
--       anon key 는 서버에서 쓰지 않습니다. 브라우저는 Supabase 에 직접 접근하지
--       않고 /api/intake · /api/slots 만 호출하므로 등록하지 않아도 됩니다.
--
--       기존 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY(=/uae 조회 로그용)는
--       건드리지 마십시오. 이름을 일부러 다르게 둔 것입니다.
--
--    4) 결제(₩99,000 건별)를 쓰려면 결제위젯 키도 등록합니다.
--       넣지 않으면 토스 공식 문서의 테스트 키로 동작하며, 화면에 "테스트 결제"가 표시됩니다.
--
--         PRECHECK_TOSS_CLIENT_KEY  = test_gck_… 또는 live_gck_…
--         PRECHECK_TOSS_SECRET_KEY  = test_gsk_… 또는 live_gsk_…
--
--       ⚠️ 결제위젯 연동이므로 gck/gsk 계열이 필요합니다(API 개별연동 ck/sk 가 아닙니다).
--       뒷단(trops_a)의 NEXT_PUBLIC_TOSS_CLIENT_KEY / TOSS_SECRET_KEY 와는 별개의
--       환경변수입니다. 같은 상점의 키를 양쪽에 넣을 수는 있습니다.
--
-- ⚠️ 이미 이 파일을 한 번 실행한 프로젝트라면, 아래 "이미 실행한 경우" 절만 실행하십시오.
-- ============================================================================


-- ── 0. 이미 실행한 경우 — 결제 컬럼만 추가 (2026-08-08) ──────────────────────
--
-- 아래 블록만 따로 실행하면 기존 intake 테이블에 결제 경로가 붙습니다.
-- 처음 만드는 프로젝트라면 이 절을 건너뛰고 1번부터 실행하십시오.
--
--   alter table public.intake
--     add column if not exists intake_path    text        not null default 'free',
--     add column if not exists order_id       text,
--     add column if not exists amount         integer     not null default 0,
--     add column if not exists payment_status text        not null default 'none',
--     add column if not exists payment_key    text,
--     add column if not exists paid_at        timestamptz;
--
--   create unique index if not exists intake_order_id_key on public.intake (order_id);
--   create index if not exists intake_payment_idx on public.intake (payment_status)
--     where intake_path = 'paid';
--
--   alter table public.intake drop constraint if exists intake_status_allowed;
--   alter table public.intake add  constraint intake_status_allowed
--     check (status in ('awaiting_payment','received','in_progress','delivered','cancelled'));
--
--   alter table public.intake add constraint intake_path_allowed
--     check (intake_path in ('free','paid'));
--   alter table public.intake add constraint intake_payment_status_allowed
--     check (payment_status in ('none','pending','paid','failed','refunded'));
--   alter table public.intake add constraint intake_free_is_zero
--     check (intake_path <> 'free' or (amount = 0 and order_id is null and payment_status = 'none'));
--   alter table public.intake add constraint intake_paid_has_order
--     check (intake_path <> 'paid' or (amount > 0 and order_id is not null));


-- ── 0-B. 삭제 요청 컬럼 — 환불규정 05 (2026-08-08 승인 ③) ────────────────────
--
-- 이용자가 확인 화면에서 "자료 즉시 삭제" 를 요청한 시점을 남깁니다.
-- api/erasure.js 가 이 컬럼을 읽고 씁니다. 없으면 그 엔드포인트가 502 로 떨어집니다.
--
-- 가산 변경만 합니다 — 기존 컬럼을 지우거나 형을 바꾸지 않습니다.
--
--   alter table public.intake
--     add column if not exists erasure_requested_at timestamptz,
--     add column if not exists files_deleted_at     timestamptz;
--
--   create index if not exists intake_erasure_idx on public.intake (erasure_requested_at)
--     where erasure_requested_at is not null;


-- ── 0-C. 자사 서식 컬럼 — 기준 우선순위 (2026-08-08) ─────────────────────────
--
-- 고객이 보유한 자사 서식이 1순위 기준입니다(PRD-62 §3-3).
-- 있으면 무조건 그것과 대조하고, 없을 때만 공개 표준 서식을 2순위 대체 기준으로 씁니다.
-- 이 컬럼은 "이 건을 무엇과 대조해야 하는가" 를 뒷단·운영자에게 알려 줍니다.
--
-- 가산 변경만 합니다 — 기존 컬럼을 지우거나 형을 바꾸지 않습니다.
--
--   alter table public.intake
--     add column if not exists own_form_path text;
--
--   create index if not exists intake_own_form_idx on public.intake (own_form_path)
--     where own_form_path is not null;


-- ── 0-D. 거래 정보 컬럼 — 협정 세율 함께 보기 (2026-08-09) ───────────────────
--
-- 접수 시 거래 상대국·HS 코드를 "선택" 으로 받습니다.
-- 두 값이 모두 있으면 접수 확인 화면과 확인메일에 해당국 협정 세율을 함께 보여 줍니다.
--
-- ⚠️ 반드시 null 을 허용해야 합니다. 이 두 칸은 NDA 대조와 아무 상관이 없습니다 —
--    필수로 만드는 순간 "NDA 하나 보내려는데 HS 코드를 왜 묻지" 가 되어
--    접수 자체를 잃습니다. 그래서 not null 도, 기본값도 두지 않습니다.
--
-- 가산 변경만 합니다 — 기존 컬럼을 지우거나 형을 바꾸지 않습니다.
--
-- ⚠️ 이 절만 따로 실행하십시오. 파일 전체를 붙여넣으면 아래 1번의
--    create table public.intake 에서 42P07 (relation "intake" already exists)
--    로 멈춥니다. 이미 만들어 둔 프로젝트에 두 번 만들려 하기 때문입니다.
--
-- 제약조건에는 add constraint if not exists 가 없습니다(Postgres 문법에 없음).
-- 그래서 drop constraint if exists 를 앞에 붙여 몇 번을 실행해도 같은 결과가
-- 되게 합니다 — 0-A 의 intake_status_allowed 와 같은 방식입니다.
--
--   alter table public.intake
--     add column if not exists target_country text,
--     add column if not exists hs_code        text;
--
--   alter table public.intake drop constraint if exists intake_target_country_shape;
--   alter table public.intake add  constraint intake_target_country_shape
--     check (target_country is null or target_country ~ '^[A-Z]{2}$');
--
--   alter table public.intake drop constraint if exists intake_hs_code_shape;
--   alter table public.intake add  constraint intake_hs_code_shape
--     check (hs_code is null or hs_code ~ '^[0-9]{8}$');
--
--   create index if not exists intake_hs_code_idx on public.intake (hs_code)
--     where hs_code is not null;


-- ── 0-E. 전달 시점 컬럼 — 환불 기준선 (2026-08-09) ───────────────────────────
--
-- 환불규정 §02 가 기준 시점을 이렇게 정의합니다:
--   "자료는 이메일로 보내드리는 링크를 통해 전달됩니다.
--    링크를 보내드린 시점을 전달 시점으로 봅니다."
--
-- 그 시점을 담는 자리가 없었습니다. 규정은 전달 전/후로 환불을 가르는데
-- 코드에는 "전달했다" 는 기록 자체가 없어, 모든 접수가 영원히 received 로
-- 남아 있었습니다. 분쟁이 나면 회사가 아무것도 제시하지 못합니다.
--
-- delivered_at 은 "요약 자료 링크 메일을 실제로 보내는 데 성공한 시각" 입니다.
-- 사람이 착수한 시각도, 자료를 다 만든 시각도 아닙니다 — 규정 문언이
-- 가리키는 것이 발송 시점이므로 그것만 담습니다.
--
-- ⚠️ 한 번 들어간 값을 덮어쓰지 마십시오. 덮어쓰면 환불 기준선이 뒤로 밀립니다.
--    scripts/deliver.js 는 이미 값이 있으면 발송 자체를 거절합니다.
--
-- ⚠️ 이 절만 따로 실행하십시오(0-D 와 같습니다). 파일 전체를 붙여넣으면
--    아래 1번의 create table public.intake 에서 42P07 로 멈춥니다.
--
-- 가산 변경만 합니다 — 기존 컬럼을 지우거나 형을 바꾸지 않습니다.
--
--   alter table public.intake
--     add column if not exists delivered_at timestamptz;
--
--   create index if not exists intake_delivered_idx on public.intake (delivered_at)
--     where delivered_at is not null;


-- ── 0-F. 환불 기록 컬럼 — 판별 뒤집힘 환불 (2026-08-11 · M-3) ────────────────
--
-- 접수 뒤에 「불가」로 뒤집힌 건은 환불합니다. payment_status 에는 'refunded' 가
-- 이미 있었지만 **언제·왜** 를 담을 자리가 없었습니다. 그 두 칸이 없으면
-- 환불한 건과 환불하지 않은 건을 구분만 할 수 있고, 분쟁이 나면 회사가
-- "언제 무슨 사유로 돌려드렸다" 를 제시하지 못합니다(0-E 와 같은 형태의 공백).
--
-- 쓰는 곳은 셋입니다 — scripts/refund.js(사람이 판단) ·
-- scripts/refund-blocked.js · api/cron/refund-blocked.js(판정층 판단 · 2026-08-11 M-2).
--
-- ⚠️ 이 줄에는 「라우트는 이 컬럼을 쓰지 않습니다 — 돈을 되돌리는 경로를 공개 주소에
--    두지 않는다」가 적혀 있었습니다. M-2 재착수로 **뒤집혔습니다**: 판정층이
--    precheck_intake_route(아래 0-G)에 route='blocked' 를 적어 주게 되어 「뒤집혔다」를
--    기계가 알 수 있게 됐고, 사람의 기억에 환불을 매달아 두는 편이 더 큰 위험이라고
--    보았습니다. 노출면은 실질적으로 늘지 않습니다 — 그 라우트는 CRON_SECRET
--    불일치에 **404** 로 답해 존재 자체를 알리지 않습니다
--    (scripts/cleanup-expired.js 가 같은 판단을 같은 근거로 먼저 했습니다).
--
-- ⚠️ **이 절을 실행하지 않아도 접수·결제는 그대로 동작합니다.** 환불 스크립트와
--    환불 cron 만 선행 검사에서 멈추고 이 절을 실행하라고 말합니다. 접수 경로가
--    이 컬럼을 쓰지 않게 둔 것이 의도입니다 — 마이그레이션을 잊었을 때 깨지는 것이
--    운영 도구 하나이지 접수 전체가 아니어야 합니다.
--
-- ⚠️ 이 절만 따로 실행하십시오(0-D·0-E 와 같습니다). 파일 전체를 붙여넣으면
--    아래 1번의 create table public.intake 에서 42P07 로 멈춥니다.
--
-- 가산 변경만 합니다 — 기존 컬럼을 지우거나 형을 바꾸지 않습니다.
--
--   alter table public.intake
--     add column if not exists refunded_at    timestamptz,
--     add column if not exists refund_reason  text;
--
--   create index if not exists intake_refunded_idx on public.intake (refunded_at)
--     where refunded_at is not null;


-- ── 0-H. 서류 종류 + 결제 미완료 리마인드 (2026-08-13 · 흐름 md §5 · §5-1 6번) ──
--
-- 🔴 **이 절은 배포보다 먼저 실행하십시오.** 다른 0-* 절과 성질이 다릅니다:
--    doc_type 은 **접수 경로가 실제로 insert 하는 컬럼**입니다(api/intake.js). 컬럼이
--    없으면 PostgREST 가 PGRST204 로 거절하고 **접수 전체가 502 가 됩니다.** 0-F(환불
--    컬럼)처럼 "운영 도구만 멈춘다" 가 아닙니다.
--    payment_reminder_sent_at 쪽은 반대로 없어도 접수·결제가 그대로 돕니다 —
--    리마인드 배치만 후보 조회에 실패해 0건으로 끝냅니다(fail-safe closed).
--
-- ⚠️ 이 절만 따로 실행하십시오(0-D·0-E·0-F 와 같습니다). 파일 전체를 붙여넣으면
--    아래 1번의 create table public.intake 에서 42P07 로 멈춥니다.
--
-- 가산 변경만 합니다 — 기존 컬럼을 지우거나 형을 바꾸지 않습니다.
--
--   alter table public.intake
--     add column if not exists doc_type                  text not null default 'nda',
--     add column if not exists payment_reminder_sent_at   timestamptz;
--
--   alter table public.intake drop constraint if exists intake_doc_type_allowed;
--   alter table public.intake add  constraint intake_doc_type_allowed
--     check (doc_type in ('nda'));
--
--   create index if not exists intake_payment_reminder_idx
--     on public.intake (received_at)
--     where intake_path = 'paid'
--       and payment_status = 'pending'
--       and payment_reminder_sent_at is null;
--
-- ⚠️ check 를 ('nda') 로 **좁게** 둔 것이 의도입니다. 화면의 준비중 옵션이 실수로
--    disabled 를 잃어도 DB 가 막습니다. 서류 종류를 늘릴 때 고칠 곳은 셋입니다 —
--    이 check · api/intake.js DOC_TYPES · precheck.html 의 <option disabled>.
--    한 곳만 고치면 화면·서버·DB 가 서로 다른 목록을 말합니다.
--
-- ⚠️ default 'nda' 를 지우지 마십시오. 이 컬럼이 붙기 전에 들어온 기존 행 전부가
--    NDA 접수라 그 값이 사실이고, not null 을 붙일 수 있는 근거도 그것입니다.


-- ── 0-I. 환불 피드백 후속 컨택 컬럼 (2026-08-14 · 흐름 md §5-1 14번) ──────────
--
-- 환불(요청형·자동형 모두)이 끝난 뒤 "괜찮으시다면 왜 환불하셨는지 알려주시면
-- 도움이 됩니다" 한 줄을 안내메일에 실습니다(api/_notify.js sendManualRefundMail ·
-- sendRouteRefundMail). 이 컬럼은 그 줄을 실은 시각을 남깁니다 — 지금 단계
-- (가격·상품 검증 초기)는 "몇 건에 물었는가"조차 값진 데이터입니다.
--
-- 쓰는 곳은 하나입니다 — api/_refund.js refundOrder(). ⚠️ **환불 기록(payment_status·
-- refunded_at·refund_reason)과 **같은 PATCH 에 넣지 않습니다** — 이 컬럼이 아직
-- 없는 환경에서 같은 요청에 함께 넣으면 PostgREST 가 그 요청 전체를 거절하고
-- **환불 기록 자체가 안 됩니다.** 그래서 별도의, 실패해도 무해한 PATCH 로 둡니다
-- (0-F 의 환불 컬럼과 같은 "이 절 없어도 접수·결제·환불은 그대로 돈다" 원칙).
--
-- ⚠️ 이 절만 따로 실행하십시오(0-D·0-E·0-F·0-H 와 같습니다). 파일 전체를
--    붙여넣으면 아래 1번의 create table public.intake 에서 42P07 로 멈춥니다.
--
-- 가산 변경만 합니다 — 기존 컬럼을 지우거나 형을 바꾸지 않습니다.
--
--   alter table public.intake
--     add column if not exists refund_feedback_requested_at timestamptz;


-- ── 0-J. 사전 확인 세션 연결 컬럼 (2026-08-14 · bkit-7 · doc/s10 §5-3 「세션 연결」) ──
--
-- `/check` 사전 확인을 거쳐 `/precheck?pre=<session_key>` 로 온 사람의 접수 건에,
-- 어느 사전 확인 세션에서 왔는지를 남깁니다. api/intake.js 가 요청 본문의
-- `preSessionKey` 를 그대로 옮겨 담을 뿐이고, 값을 검증하거나 매칭하지 않습니다.
--
-- 🔴 **읽는 쪽은 이 저장소가 아니라 trops_a 입니다** — 크로스 레포 인계.
--    trops_a 가 이 값으로 자기 쪽 `precheck_prestep_session.intake_id` 를 채워야
--    사전 확인 세션과 접수 건이 이어집니다. 그 수신 로직은 이 절 범위 밖입니다
--    (0-G 와 같은 "계약만 여기 적어 둔다" 성격 — 단, 방향이 반대입니다: 0-G 는
--    trops_a 가 쓰고 여기서 읽고, 이 컬럼은 여기서 쓰고 trops_a 가 읽습니다).
--
-- ⚠️ 이 절만 따로 실행하십시오(0-D·0-E·0-F·0-H·0-I 와 같습니다). 파일 전체를
--    붙여넣으면 아래 1번의 create table public.intake 에서 42P07 로 멈춥니다.
--
-- 가산 변경만 합니다 — 기존 컬럼을 지우거나 형을 바꾸지 않습니다.
--
--   alter table public.intake
--     add column if not exists pre_session_key text;
--
-- ⚠️ 이 컬럼은 **배포보다 먼저 실행할 필요가 없습니다**(0-H 의 doc_type 과 다릅니다).
--    api/intake.js 의 OPTIONAL_COLUMNS 에 들어 있어, 컬럼이 없으면 그 값만 빼고
--    한 번 더 저장합니다 — 접수 전체가 502 가 되지 않습니다. 잃는 것은
--    `pre_session_key` 값 하나이고(=그 건의 intake_id 역기입이 안 됨), 접수
--    사실(이메일·파일·동의)은 어긋나지 않습니다.
-- ⚠️ /check 를 거치지 않고 바로 온 사람은 이 값이 null 입니다 — 정상입니다.
--    NOT NULL 제약을 걸지 마십시오.


-- ── 0-K. 접수 화면의 언어 (2026-08-17 · 영문 접수 경로) ──────────────────────
--
-- 영문 랜딩(/en → /en-check → /en-precheck)이 열리면서, 영문으로 접수한 분에게
-- 영문 메일이 나가야 합니다. 접수 **당시의 화면 언어**를 여기 남깁니다.
--
-- 왜 컬럼이 필요한가: 확인메일은 접수와 **같은 요청 안에서** 나가므로 컬럼이 없어도
-- 영문으로 갑니다. 그런데 자료 전달 메일(scripts/deliver.js)과 삭제 확인 메일
-- (api/erasure.js)은 **한참 뒤에** 나갑니다 — 그때는 요청이 끝나 화면을 물어볼 수
-- 없고, 행에 적힌 것만이 근거입니다.
--
-- ⚠️ 이 절은 **없어도 접수가 멈추지 않습니다.** 0-H(doc_type)와 성질이 다릅니다:
--    locale 은 api/intake.js 의 OPTIONAL_COLUMNS 에 있어, 컬럼이 없으면 그 값만 빼고
--    저장하고 접수는 201 로 끝납니다. 조회 쪽(전달·삭제)도 붙여서 한 번, 없으면 떼고
--    한 번 조회합니다. 실행 전까지 잃는 것은 **나중에 나가는 메일의 언어** 하나이고,
--    그때는 국문으로 나갑니다.
--    ⛔ 그렇다고 미루지 마십시오 — 실행 전까지 영문 접수자는 영문 확인메일을 받고
--       국문 전달 메일을 받습니다. 한 건 안에서 언어가 바뀌는 것이 가장 이상합니다.
--
-- ⚠️ 이 절만 따로 실행하십시오(0-D·0-E·0-F·0-H·0-I·0-J 와 같습니다). 파일 전체를
--    붙여넣으면 아래 1번의 create table public.intake 에서 42P07 로 멈춥니다.
--
-- 가산 변경만 합니다 — 기존 컬럼을 지우거나 형을 바꾸지 않습니다.
-- 기본값을 'ko' 로 둡니다: 이 절을 실행하기 전에 쌓인 행은 전부 국문 접수입니다
-- (영문 접수 경로가 그때는 없었습니다). 그 사실을 기본값으로 적습니다.
--
--   alter table public.intake
--     add column if not exists locale text not null default 'ko';
--
--   alter table public.intake drop constraint if exists intake_locale_allowed;
--   alter table public.intake add  constraint intake_locale_allowed
--     check (locale in ('ko', 'en'));
--
-- ⚠️ 아는 값만 통과시킵니다. 화면이 보내는 값은 api/intake.js parseLocale 이 이미
--    한 번 거릅니다(모르는 값 → 'ko'). 여기 제약은 그 뒤의 두 번째 그물입니다 —
--    배치나 손 UPDATE 로 엉뚱한 값이 들어가는 것을 막습니다.
--    ⛔ 언어를 늘리실 때 세 곳을 함께 늘리십시오:
--       api/intake.js LOCALES · api/_intake-route.js NOTICE_SETS · 이 제약.


-- ── 0-L. 문의·출시 알림 등록(leads) 표 — admin 조회용 (2026-08-18) ───────────
--
-- 종전에는 api/leads.js 가 메일 두 통(담당자 알림·신청자 확인)만 보내고 저장하지
-- 않았습니다(그 파일 머리주석 「저장소가 없습니다」). trops_a admin 화면에서
-- 문의·출시 알림 신청 이력을 조회하려면 저장이 필요해 이 표를 추가합니다.
--
-- 🔴 **삭제 배치를 두지 않습니다** — public.intake(§5)와 다른 판단입니다. 이 표는
--    두 가지 목적을 함께 담습니다: ① 문의 응대(1회성) ② 출시 알림 신청(응답까지
--    기간이 정해지지 않음 — 출시 시점까지 남아 있어야 실제로 알릴 수 있습니다).
--    30일로 자동 삭제하면 ②의 목적 자체가 깨집니다. 삭제는 목적 달성(출시 안내 발송
--    완료·문의 응대 완료) 또는 이용자 요청 시 **사람이** 합니다(§5 이용자 요구 대응).
--
-- 이미 실행한 프로젝트라면 아래만 실행하면 됩니다(신규 표라 안전 — 기존 표에 영향 없음).

create table if not exists public.leads (
  id                 uuid        primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),

  name               text        not null,
  email              text        not null,
  company            text,
  -- 값이 있으면 「문의」, 비어 있으면 「출시 알림 신청」 — api/leads.js 의 hasInquiry 와
  -- 같은 구분이다. 여기서 별도 종류 컬럼을 두지 않는다(같은 사실이 두 곳에 있으면 갈린다).
  inquiry            text,

  consent_privacy    boolean     not null,
  consent_marketing  boolean     not null default false
);

comment on table public.leads is
  'trops.kr 랜딩 [문의하기/출시 알림 신청] 폼(interest-form → api/leads.js) 저장. 30일 자동 삭제 없음(§0-L 참조) — 목적 달성·요청 시 수동 삭제.';

alter table public.leads enable row level security;


-- ── 0-G. 처리 가능 여부 표 — ⛔ **이 저장소 소관이 아닙니다** (2026-08-11 · M-2) ──
--
-- 🔴 **여기서 실행하지 마십시오. 참조본입니다.**
--    precheck_intake_route 는 판정층 trops_a 가 만들고 쓰는 표입니다
--    (정본 함수: trops_a lib/precheck/intake-route.ts · cron 이 1일 1회 채웁니다).
--    이 저장소는 **select 만** 합니다 — api/_intake-route.js 한 곳에서.
--
--    그런데도 모양을 여기 적어 두는 이유는, 우리가 무엇을 읽고 있는지가 이 파일에
--    없으면 컬럼 이름 하나가 바뀌었을 때 「왜 안내가 안 뜨는지」를 아무도 못 찾기
--    때문입니다. 읽는 쪽의 계약을 읽는 쪽 저장소에 남깁니다.
--
-- ── 왜 intake 에 컬럼을 더하지 않았는가 (재착수 결정 ②) ──────────────────────
--    intake 는 접수 사실의 표이고 이 저장소가 소유합니다. 거기에 판정층이 쓰는 칸을
--    두면 한 표를 두 저장소가 쓰게 되고, 「누가 이 값을 정하는가」가 흐려집니다.
--    별 표로 두면 소유가 갈리고, 이 저장소는 읽기 권한만으로 충분해집니다.
--
-- ── append-only 인 것이 설계입니다 (재착수 결정 ⑤) ──────────────────────────
--    뒤집힘(ok → blocked · 그 반대)이 UPDATE 가 아니라 **새 행**으로 옵니다.
--    그래서 읽는 쪽은 언제나 decided_at 내림차순 첫 행만 봅니다. 과거 행을 보고
--    환불하면 이미 되돌려진 판단으로 돈을 움직입니다.
--
-- ── 우리가 읽는 것 (이 넷이 이름·형까지 맞아야 합니다) ──────────────────────
--
--   create table public.precheck_intake_route (
--     id          bigserial   primary key,
--     intake_id   uuid        not null,          -- public.intake.id
--     route       text        not null check (route in ('ok','blocked')),
--     reason      text        null,              -- trops_a PreflightStop
--                                                --   'scan-only' | 'unsupported-language'
--                                                --   route='ok' 이면 null
--     decided_at  timestamptz not null default now()
--   );
--
--   -- 읽기가 언제나 「한 건의 마지막 행」이라 이 색인이 필요합니다.
--   create index if not exists precheck_intake_route_latest_idx
--     on public.precheck_intake_route (intake_id, decided_at desc);
--
--   -- 환불 배치의 1차 후보 수집(route='blocked' 전체 훑기)용.
--   create index if not exists precheck_intake_route_blocked_idx
--     on public.precheck_intake_route (decided_at desc) where route = 'blocked';
--
-- ⚠️ **없어도 접수·결제·확인 화면은 그대로 동작합니다.** 못 읽으면 확인 화면은
--    아무것도 그리지 않고, 환불 배치는 0건으로 끝냅니다(fail-safe closed).
--    이 글을 쓰는 시점에 표는 **아직 없습니다** — trops_a 미착수입니다.
--
-- ⚠️ 외래키(references public.intake)를 우리가 요구하지 않습니다. 30일 정리 배치가
--    intake 행을 지우므로, on delete 규칙을 잘못 걸면 지워진 접수 때문에 판정층
--    배치가 멈추거나 이력이 함께 사라집니다. 참조 무결성보다 **두 배치가 서로를
--    멈추지 않는 것**이 여기서는 더 중요합니다(우리는 없는 intake_id 를 만나면
--    조용히 후보에서 뺍니다).


-- ── 1. 접수 ──────────────────────────────────────────────────────────────────
--
-- 이 테이블에는 판정 결과를 두지 않습니다. 접수 사실만 기록합니다.
-- 측정·대조 결과는 뒷단(trops_a)에서 다루고, 처리는 사람이 손으로 합니다.

create table public.intake (
  id                uuid        primary key,
  email             text        not null,
  file_paths        text[]      not null default '{}',
  file_count        smallint    not null default 0,

  -- ── 대조 기준 (2026-08-08 추가 · PRD-62 §3-3) ─────────────────────────────
  -- 이용자가 함께 올린 자사 NDA 서식의 저장 경로. 선택 항목이라 null 이 정상입니다.
  --   null 아님 → 이 서식이 1순위 기준. 무조건 이것과 대조합니다.
  --   null      → 자사 서식을 받지 못한 건. 공개 표준 서식을 2순위 대체 기준으로 씁니다.
  -- ⚠️ 이 경로는 file_paths 에도 함께 들어갑니다. 삭제 경로(api/erasure.js ·
  --    scripts/cleanup-expired.js)가 file_paths 만 훑기 때문입니다 —
  --    여기에만 두면 30일 삭제와 즉시 삭제가 이 파일을 지나칩니다.
  own_form_path     text,

  -- ── 서류 종류 (2026-08-13 추가 · 흐름 md §5 「확장 구조」) ────────────────
  -- 무슨 서류를 대조하는가. 지금은 'nda' 하나뿐이지만 **값으로 남깁니다** —
  -- md §5 가 「"NDA 전용" 하드코딩이 아니라 "문서유형 파라미터" 구조로」를 요구하고,
  -- 계약서·견적서를 붙일 때 새 페이지도 새 컬럼도 없이 옵션만 늘어나야 합니다.
  -- ⚠️ check 를 좁게 둡니다(아래 intake_doc_type_allowed). 화면의 준비중 옵션이
  --    실수로 열려도 DB 가 막습니다. 늘릴 때 고칠 곳 셋: 이 check ·
  --    api/intake.js DOC_TYPES · precheck.html 의 <option disabled>.
  doc_type          text        not null default 'nda',

  -- ── 사전 확인 세션 연결 (2026-08-14 추가 · bkit-7 · doc/s10 §5-3) ─────────
  -- `/check` 를 거쳐 온 접수 건만 값이 있습니다. trops_a 가 이 값으로 자기 쪽
  -- precheck_prestep_session.intake_id 를 채웁니다(크로스 레포 인계) — 이
  -- 저장소는 옮겨 담기만 하고 매칭하지 않습니다. null 이 정상입니다(0-J 참조).
  pre_session_key   text,

  -- ── 거래 정보 (2026-08-09 추가 · 선택) ────────────────────────────────────
  -- 접수 시 이용자가 골라 넣은 거래 상대국(ISO 2자리)과 HS 8단위입니다.
  -- NDA 대조와는 무관한 부속 항목이라 둘 다 null 이 정상이고, 그 편이 더 흔합니다.
  --   둘 다 있음 → 접수 확인 화면·확인메일에 해당국 협정 세율을 함께 보여 줍니다.
  --   하나라도 없음 → 세율 섹션을 아예 그리지 않습니다(빈 섹션을 띄우지 않습니다).
  -- ⚠️ 여기에 세율이나 판정 결과를 저장하지 않습니다. 양허표는 data/tariff/ 의
  --    정적 파일이 원본이며, 값을 복사해 두면 표가 개정될 때 조용히 어긋납니다.
  target_country    text,
  hs_code           text,

  -- 동의 1 [필수] 서비스 이용약관 및 문서 대조 요청 동의
  consent_terms     boolean     not null,
  -- 동의 2 [선택] AI 성능 고도화를 위한 비식별 데이터 활용 동의
  --   2026-08-08 정책 개정: 이 값이 true 인 접수분에 한해 비식별 데이터의
  --   학습 활용을 허용합니다. (개정 전 원칙: 동의해도 학습 재사용 하지 않음)
  consent_training  boolean     not null default false,
  consent_at        timestamptz not null,

  slot_no           smallint,
  access_token      text        not null unique,
  status            text        not null default 'received',

  -- ── 결제 (2026-08-08 추가) ────────────────────────────────────────────────
  -- 'free' 선착 20건 무상 실증 (slot_no 를 씁니다 · amount 0)
  -- 'paid' 런칭가 건별 결제      (slot_no 없음 · amount 99000)
  intake_path       text        not null default 'free',
  order_id          text        unique,
  amount            integer     not null default 0,
  payment_status    text        not null default 'none',
  payment_key       text,
  paid_at           timestamptz,

  -- ── 자료 즉시 삭제 (2026-08-08 추가 · 환불규정 05) ────────────────────────
  -- 이용자가 확인 화면에서 즉시 삭제를 요청한 시점. api/erasure.js 가 씁니다.
  -- 요청하지 않으면 둘 다 null 이고, delete_after 의 30일 원칙이 그대로 적용됩니다.
  erasure_requested_at timestamptz,
  files_deleted_at     timestamptz,

  -- ── 전달 시점 (2026-08-09 추가 · 환불규정 §02 기준선) ─────────────────────
  -- 요약 자료 링크 메일을 실제로 보내는 데 성공한 시각. 규정 문언이
  -- "링크를 보내드린 시점을 전달 시점으로 봅니다" 이므로 발송 시점만 담습니다.
  -- null 이면 아직 전달 전 = 전액 환불 구간입니다.
  -- ⚠️ 덮어쓰지 마십시오. 덮어쓰면 환불 기준선이 뒤로 밀립니다.
  delivered_at      timestamptz,

  -- ── 환불 기록 (2026-08-11 추가 · M-3 「불가」 비과금) ──────────────────────
  -- 접수 뒤에 판별이 「불가」로 뒤집힌 건을 환불한 기록입니다.
  -- payment_status='refunded' 와 함께 scripts/refund.js 가 씁니다.
  -- 사유를 남기는 이유는 환불이 두 갈래이기 때문입니다 —
  -- 이용자 요청(환불규정 §02)과 우리 쪽 사유(판별 뒤집힘)는 성질이 다릅니다.
  refunded_at       timestamptz,
  refund_reason     text,

  -- ── 결제 미완료 리마인드 (2026-08-13 추가 · 흐름 md §3 · §5-1 6번) ────────
  -- 파일까지 올리고 결제만 안 한 건에 1회 보내는 회수 메일의 발송 시각입니다.
  -- 🔴 **이 컬럼이 「1회」의 근거이자 멱등의 근거입니다.** null 이면 아직 안 보냈고,
  --    값이 있으면 다시 보내지 않습니다 — 배치가 두 번 돌아도 두 번 가지 않습니다.
  -- ⚠️ 발송에 **성공한 뒤에만** 채웁니다(api/_payment-reminder.js). 미리 채우면
  --    발송 실패한 건이 영구히 회수 대상에서 빠집니다.
  payment_reminder_sent_at timestamptz,

  received_at       timestamptz not null default now(),
  -- 30일 보관 후 삭제. 확인메일에 PDF 를 첨부하지 않는 이유이기도 합니다
  -- (첨부한 파일에는 이 삭제 정책을 적용할 수 없습니다).
  -- 환불하더라도 이 시점은 그대로입니다 — 환불이 곧 즉시 삭제는 아닙니다(환불규정 05).
  -- 이용자가 즉시 삭제를 요청하면 api/erasure.js 가 이 값을 now() 로 당깁니다.
  delete_after      timestamptz not null,

  constraint intake_consent_terms_required check (consent_terms is true),
  constraint intake_email_shape  check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  -- 유료 건은 결제가 끝나야 접수입니다. 그전 상태가 'awaiting_payment' 입니다.
  constraint intake_status_allowed
    check (status in ('awaiting_payment', 'received', 'in_progress', 'delivered', 'cancelled')),
  constraint intake_path_allowed
    check (intake_path in ('free', 'paid')),
  constraint intake_payment_status_allowed
    check (payment_status in ('none', 'pending', 'paid', 'failed', 'refunded')),
  -- 무상 건에 금액이 붙거나 유료 건이 주문번호 없이 들어오는 일을 막습니다.
  constraint intake_free_is_zero
    check (intake_path <> 'free' or (amount = 0 and order_id is null and payment_status = 'none')),
  constraint intake_paid_has_order
    check (intake_path <> 'paid' or (amount > 0 and order_id is not null)),
  -- 선택 항목이지만 형식은 느슨하게 두지 않습니다. 서버(api/intake.js)가 이미
  -- 같은 조건으로 거르며, 여기서 한 번 더 막아 손으로 넣은 행도 어긋나지 않게 합니다.
  constraint intake_target_country_shape
    check (target_country is null or target_country ~ '^[A-Z]{2}$'),
  constraint intake_hs_code_shape
    check (hs_code is null or hs_code ~ '^[0-9]{8}$'),
  -- 지금 대조할 수 있는 서류 종류만 받습니다 〔흐름 md §5〕. 좁게 두는 것이 의도입니다 —
  -- 화면·서버가 뚫려도 여기서 막습니다. 늘릴 때 세 곳(이 줄 · DOC_TYPES · <option>)을 함께.
  constraint intake_doc_type_allowed
    check (doc_type in ('nda'))
);

create index intake_received_at_idx  on public.intake (received_at desc);
create index intake_status_idx       on public.intake (status);
create index intake_delete_after_idx on public.intake (delete_after);
create index intake_payment_idx      on public.intake (payment_status) where intake_path = 'paid';
create index intake_erasure_idx      on public.intake (erasure_requested_at)
  where erasure_requested_at is not null;
create index intake_own_form_idx     on public.intake (own_form_path)
  where own_form_path is not null;
-- 어떤 품목으로 들어오는지 세어 보기 위한 색인입니다. 대부분의 행이 null 이므로
-- 부분 색인으로 둡니다.
create index intake_hs_code_idx      on public.intake (hs_code)
  where hs_code is not null;
-- 환불 문의가 오면 "언제 보냈는가" 를 먼저 봅니다. 대부분의 행이 null 이므로
-- 부분 색인으로 둡니다.
create index intake_delivered_idx    on public.intake (delivered_at)
  where delivered_at is not null;
-- 환불한 건은 드뭅니다. 부분 색인으로 두고, 「환불 이력」 조회에만 씁니다.
create index intake_refunded_idx     on public.intake (refunded_at)
  where refunded_at is not null;
-- 결제 미완료 리마인드 배치의 후보 조회용 〔흐름 md §5-1 6번〕. 조건이 곧 후보 정의이고
-- 대부분의 행이 해당하지 않으므로 부분 색인으로 둡니다 — api/_payment-reminder.js 의
-- where 절과 **같은 조건**입니다. 한쪽만 고치면 색인을 타지 않습니다.
create index intake_payment_reminder_idx on public.intake (received_at)
  where intake_path = 'paid'
    and payment_status = 'pending'
    and payment_reminder_sent_at is null;

-- service role 로만 읽고 씁니다. anon/authenticated 접근은 막습니다.
-- (정책을 만들지 않으면 service role 외 모든 접근이 차단됩니다.)
alter table public.intake enable row level security;


-- ── 2. 슬롯 카운터 ───────────────────────────────────────────────────────────
--
-- 선착 무상 실증 한도 20건. 단일 행으로 관리합니다.

create table public.slots (
  id          smallint    primary key,
  slot_limit  smallint    not null,
  used        smallint    not null default 0,
  updated_at  timestamptz not null default now(),

  constraint slots_singleton  check (id = 1),
  constraint slots_used_range check (used >= 0 and used <= slot_limit)
);

insert into public.slots (id, slot_limit, used) values (1, 20, 0);

alter table public.slots enable row level security;


-- ── 3. 슬롯 점유 · 반납 ──────────────────────────────────────────────────────
--
-- 점유는 반드시 이 함수로 합니다.
-- "읽어서 20 미만이면 증가" 를 두 번의 요청으로 나누면 동시 접수 때 21건이 들어옵니다.
-- 단일 UPDATE 안에서 한도를 확인하므로 행 잠금이 순서를 갈라 줍니다.

create or replace function public.claim_slot()
returns table (claimed boolean, used smallint, slot_limit smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used  smallint;
  v_limit smallint;
begin
  update public.slots s
     set used = s.used + 1,
         updated_at = now()
   where s.id = 1
     and s.used < s.slot_limit
  returning s.used, s.slot_limit into v_used, v_limit;

  if found then
    return query select true, v_used, v_limit;
  else
    -- 소진됐거나 slots 행이 없는 경우. 현재 상태를 그대로 알려 줍니다.
    select s.used, s.slot_limit into v_used, v_limit from public.slots s where s.id = 1;
    return query select false, v_used, v_limit;
  end if;
end;
$$;

-- 점유 후 업로드·저장이 실패했을 때 되돌립니다.
-- 되돌리지 않으면 아무도 쓰지 않은 슬롯이 소진된 것으로 남습니다.
create or replace function public.release_slot()
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used smallint;
begin
  update public.slots s
     set used = greatest(s.used - 1, 0),
         updated_at = now()
   where s.id = 1
  returning s.used into v_used;

  return v_used;
end;
$$;

revoke all on function public.claim_slot()   from public, anon, authenticated;
revoke all on function public.release_slot() from public, anon, authenticated;
grant execute on function public.claim_slot()   to service_role;
grant execute on function public.release_slot() to service_role;


-- ── 4. 파일 저장소 ───────────────────────────────────────────────────────────
--
-- 비공개 버킷입니다. 정책을 만들지 않으므로 service role 로만 접근됩니다.

insert into storage.buckets (id, name, public)
values ('intake', 'intake', false)
on conflict (id) do nothing;


-- ── 5. 30일 경과분 삭제 ──────────────────────────────────────────────────────
--
-- 정리 배치를 저장소에 두었습니다. SQL 로 손으로 지우지 마십시오 —
-- 행만 지우면 Storage 파일이 남습니다(파일 경로가 행에만 있으므로 되찾을 수도 없습니다).
--
--   node --env-file=.env.local scripts/cleanup-expired.js            # 미리보기(기본)
--   node --env-file=.env.local scripts/cleanup-expired.js --apply    # 실제 삭제
--
-- 배치가 지우는 대상은 delete_after < now() 인 행 전부입니다 — 상태를 가리지 않습니다.
-- "접수일 +30일 삭제" 는 결제를 마치지 않고 떠난 건(status='awaiting_payment')에도
-- 똑같이 적용해야 하는 약속이므로, 상태로 걸러내지 않는 것이 핵심입니다.
--
-- 서버리스 API route 로 노출하지 않았습니다.
-- service_role 키를 쥔 삭제 경로를 공개 주소에 두지 않는다는 원칙 때문입니다.
-- (키 회전이 끝난 뒤 Vercel Cron 으로 옮기려면 그때 다시 판단하십시오.)
--
-- 현재 상태를 눈으로 확인하고 싶을 때만 아래를 씁니다(삭제는 하지 않는 조회입니다).
--
--   select status, count(*), min(delete_after)
--     from public.intake where delete_after < now() group by status;
