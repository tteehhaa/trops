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
-- 쓰는 곳은 scripts/refund.js 하나입니다. 라우트는 이 컬럼을 쓰지 않습니다 —
-- 돈을 되돌리는 경로를 공개 주소에 두지 않는다는 판단입니다.
--
-- ⚠️ **이 절을 실행하지 않아도 접수·결제는 그대로 동작합니다.** 환불 스크립트만
--    선행 검사에서 멈추고 이 절을 실행하라고 말합니다. 접수 경로가 이 컬럼을
--    쓰지 않게 둔 것이 의도입니다 — 마이그레이션을 잊었을 때 깨지는 것이
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
    check (hs_code is null or hs_code ~ '^[0-9]{8}$')
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
