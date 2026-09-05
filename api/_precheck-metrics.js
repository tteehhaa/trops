/*
 * 사전 확인(/check) 퍼널 측정 — 집계 본체
 * 〔2026-08-15 · doc/s10 설계서 v3 §6-1 「A/B 없음을 전제한 단일 지표」 · §6-2 「판정 분모를 반드시 가를 것」〕
 *
 * ── 이 파일이 있는 이유 ─────────────────────────────────────────────────────
 *   precheck_prestep_session 은 지금까지 **쓰기만 하는 표**였습니다. 문항마다
 *   api/prestep.js 가 trops_a 로 넘기고, trops_a 가 그 표에 쌓습니다. 읽는 코드는
 *   어디에도 없었습니다 — 설계서 §6-1 이 전제한 지표가 하나도 존재하지 않았습니다.
 *   측정 없는 퍼널은 롤백 조건(§6-3)을 판단할 수단이 없다는 뜻입니다.
 *
 * ── 왜 api/ 밑의 밑줄 파일인가 ──────────────────────────────────────────────
 *   밑줄로 시작하므로 Vercel 이 엔드포인트로 만들지 않습니다(api/_supabase.js 와 같은
 *   자리). 지금은 scripts/precheck-metrics.js 만 이 파일을 부르지만, 2단계에서
 *   관리자 화면을 세울 때 그 라우트가 **같은 함수를 require** 하도록 여기에 둡니다.
 *   ⛔ 화면을 만들 때 집계를 다시 짜지 마십시오 — 그 순간 CLI 가 내는 숫자와
 *      화면이 내는 숫자가 갈리고, 어느 쪽이 맞는지 아무도 모르게 됩니다.
 *
 * ── 🔴 분모를 가르는 것이 이 파일의 중심입니다 (설계서 §6-2 · T6) ───────────
 *   랜딩 후킹을 「해외 거래」로 넓혔으므로 **서류 없는 방문자가 분모에 들어옵니다.**
 *   전체를 분모로 접수 전환율을 재면, 설계가 좋아져도 숫자는 떨어집니다. 그 숫자를
 *   보고 롤백하면 멀쩡한 설계를 되돌립니다 — 설계서가 명시적으로 경고한 사고입니다.
 *
 *   그래서 docs(Q2) 응답을 세 갈래로 가릅니다. 세 갈래는 서로 겹치지 않고 합이 진입 수입니다.
 *
 *     holders      docs 에 'none' 아닌 값이 하나라도 있음 → **접수 전환율의 분모**
 *     nonHolders   docs 를 답했지만 전부 'none'(또는 빈 배열) → **알림 등록률의 분모**
 *     unanswered   docs 가 null — Q2 까지 못 갔거나 답 없이 지나감(0008 원칙 1)
 *
 *   ⛔ 접수 전환율의 분모를 전체(entered)로 되돌리지 마십시오. 되돌리는 순간
 *      §6-3 롤백 판단이 「문서 보유자 기준」이라는 전제를 잃습니다.
 *
 * ── 🔴 추론값을 만들지 않습니다 ─────────────────────────────────────────────
 *   0008 스키마가 D1/D2 판정을 저장하지 않는 것과 같은 이유로, 이 파일도 판정을
 *   내지 않습니다. 세는 것은 사람이 고른 값과 어디까지 갔는가라는 **사실**뿐입니다.
 *   「30% 초과면 문항이 무겁다」 같은 읽는 법은 설계서 §6-1 표에 있고, 판단은 사람이 합니다.
 *
 * ── ⚠️ 분모가 0 이면 비율은 0 이 아니라 null 입니다 ─────────────────────────
 *   rate: null 은 「잴 수 없다」이고 rate: 0 은 「쟀더니 없다」입니다. 둘을 같은
 *   0% 로 찍으면 데이터가 없는 초기와 진짜 0% 를 구분할 수 없습니다.
 *
 * ── ⚠️ intake_id 는 trops_a 가 채웁니다 ─────────────────────────────────────
 *   접수 전환율의 분자입니다. 이 저장소는 api/intake.js 에서 pre_session_key 를
 *   trops_a 로 넘길 뿐이고, 그 키로 intake_id 를 되채우는 것은 저쪽 몫입니다
 *   (api/intake.js 머리주석 · test/intake-pre-session.test.js). 그래서 홀더는
 *   있는데 intake_id 가 전부 null 이면 「전환 0%」가 아니라 **인계가 아직 안 붙은 것**일
 *   수 있습니다 — computeMetrics 가 그 경우 warnings 에 한 줄 남깁니다.
 *   (api/prestep.js 가 fail-open 을 200 으로 덮지 않는 것과 같은 자세입니다.)
 */

'use strict';

const TABLE = 'precheck_prestep_session';

/**
 * 집계에 필요한 칸만 가져옵니다. session_key·referrer 는 지표에 쓰이지 않으므로
 * 뽑지 않습니다 — referrer 는 유입 경로 분석용이고 그건 이 파일의 범위가 아닙니다.
 */
const SELECT_COLUMNS = [
  'created_at',
  'situation',
  'docs',
  'experience',
  'completed_step',
  'exited_via',
  'cta_clicked',
  'intake_id',
].join(',');

/**
 * 한 번에 가져오는 행 수. PostgREST 는 요청하지 않으면 서버 기본 상한(대개 1000)에서
 * 조용히 자릅니다 — 잘린 줄 모르고 집계하면 숫자가 작게 나옵니다. 그래서 페이지 크기를
 * 명시하고, 페이지가 가득 차면 다음 장을 계속 부릅니다.
 */
const PAGE_SIZE = 1000;

/**
 * 폭주 방지. 이 표는 퍼널 세션이라 수십만 행이 될 일이 당분간 없습니다.
 * 상한에 닿으면 조용히 자르지 않고 warnings 로 알립니다(잘린 집계는 틀린 집계입니다).
 */
const MAX_PAGES = 200;

/**
 * 🔴 Q2 보기 영문 병기(F-8) 도입 시각 — other_doc 비중을 전/후로 가르는 경계입니다.
 *
 * 값의 근거: 커밋 4d236cf「feat(check): /check 사전 확인 3문항 화면과 전달 프록시를
 * 세운다」(2026-08-14 20:38:30 +09:00). check.html 의 Q2 보기가 처음부터
 * (Sales Contract / Purchase Agreement) 식 병기를 달고 나갔습니다.
 *
 * ⚠️ 그래서 지금은 「전」 구간이 비어 있는 것이 정상입니다 — 병기 없이 나간 기간이
 *    없기 때문입니다. 그래도 전/후 두 숫자를 내는 모양을 유지하는 이유는, 나중에
 *    보기 문구를 다시 손볼 때(§7-12 는 추론 규칙 재검토를 요구합니다) 그 날짜만
 *    갈아 끼우면 같은 비교가 되게 하기 위해서입니다.
 *
 * 바꾸는 법: 이 상수를 고치지 말고 실행할 때 --gloss-date 또는
 *            PRECHECK_GLOSS_INTRODUCED_AT 로 넘기십시오.
 */
const GLOSS_INTRODUCED_AT = '2026-08-14T20:38:30+09:00';

/** 서류 보유 판정에서 「없음」으로 치는 값. 0008 스키마의 docs CHECK 목록 중 하나입니다. */
const DOC_NONE = 'none';

/** 로드맵 「준비중」 상품과 짝지어진 서류 값 (설계서 §6 밖 · 작업 3 수요 신호). */
const ROADMAP_DOCS = ['sales_contract', 'quote_pi'];

/* ══════════════════════════════════════════════════════════════════════════
 * 읽는 자리 — Supabase REST
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * 창(window) 조건을 PostgREST 질의문자열로 만듭니다.
 * from 은 이상(gte), to 는 **미만**(lt) 입니다 — 경계 행이 두 창에 겹쳐 세어지지 않게.
 */
function windowFilters(options) {
  const parts = [];
  if (options && options.from) parts.push('created_at=gte.' + encodeURIComponent(options.from));
  if (options && options.to) parts.push('created_at=lt.' + encodeURIComponent(options.to));
  return parts;
}

/**
 * 창 안의 세션 행을 전부 가져옵니다(페이지 단위로 이어서).
 *
 * config 는 api/_supabase.js readConfig() 결과입니다 — 비밀 키로 나가므로 RLS 전면
 * 차단(0008)을 우회합니다. 공개 키로는 이 표가 한 줄도 보이지 않는 것이 정상입니다.
 *
 * 정렬을 created_at,id 로 고정합니다. 정렬 없이 offset 페이징을 하면 페이지 사이에서
 * 같은 행이 두 번 나오거나 빠질 수 있습니다.
 */
async function fetchSessions(config, options) {
  const opts = options || {};
  const fetchImpl = opts.fetch || fetch;
  const base = config.restUrl + '/' + TABLE;
  const filters = windowFilters(opts);

  const rows = [];
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = [
      'select=' + SELECT_COLUMNS,
      'order=created_at.asc,id.asc',
      'limit=' + PAGE_SIZE,
      'offset=' + page * PAGE_SIZE,
    ].concat(filters).join('&');

    const response = await fetchImpl(base + '?' + query, { headers: config.headers });
    if (!response.ok) {
      const body = await response.text().catch(() => '<no body>');
      throw new Error(TABLE + ' 조회 HTTP ' + response.status + ' | ' + body.slice(0, 300));
    }

    const batch = await response.json();
    if (!Array.isArray(batch)) {
      throw new Error(TABLE + ' 조회 응답이 배열이 아닙니다');
    }

    for (const row of batch) rows.push(row);
    if (batch.length < PAGE_SIZE) return { rows: rows, truncated: false };

    truncated = page === MAX_PAGES - 1;
  }

  return { rows: rows, truncated: truncated };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 세는 자리 — 순수 함수 (네트워크 없음 · test/precheck-metrics.test.js 가 여기를 봅니다)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * 🔴 분모 분할의 핵심 판정 (§6-2).
 *
 * docs 가 null → 「안 물어봤다/답 없이 지나갔다」. 셋 중 어디에도 넣지 않습니다.
 * docs 에 'none' 아닌 값이 하나라도 있으면 보유자입니다 — 'none' 과 다른 값이 함께
 * 온 어긋난 행이 와도 **보유 쪽으로** 봅니다(서류가 있다고 말한 것이 더 강한 신호).
 */
function docsGroup(row) {
  const docs = row && row.docs;
  if (!Array.isArray(docs)) return 'unanswered';
  return docs.some((d) => d !== DOC_NONE) ? 'holder' : 'nonHolder';
}

/** 분모 0 이면 null. 「잴 수 없다」와 「쟀더니 0」을 가릅니다. */
function ratio(numerator, denominator) {
  if (!denominator) return null;
  return numerator / denominator;
}

function measure(numerator, denominator, note) {
  const out = { numerator: numerator, denominator: denominator, rate: ratio(numerator, denominator) };
  if (note) out.denominatorNote = note;
  return out;
}

function countWhere(rows, predicate) {
  let n = 0;
  for (const row of rows) if (predicate(row)) n += 1;
  return n;
}

function hasDoc(row, value) {
  return Array.isArray(row.docs) && row.docs.indexOf(value) !== -1;
}

/**
 * other_doc 비중 · 로드맵 수요 신호의 분모는 **Q2 응답자**입니다(진입 수가 아닙니다).
 * Q2 까지 오지 않은 사람은 other_doc 을 고를 기회 자체가 없었으므로, 진입 수를
 * 분모로 잡으면 「보기가 부족한가」(F-8)가 아니라 「Q2 까지 오는가」를 재게 됩니다.
 */
function docShare(rows, value) {
  return measure(countWhere(rows, (r) => hasDoc(r, value)), rows.length, 'Q2 응답자');
}

/** ISO 문자열을 밀리초로. 못 읽으면 던집니다 — 조용히 NaN 으로 비교하면 전/후가 뒤섞입니다. */
function toTime(value, what) {
  const t = Date.parse(value);
  if (Number.isNaN(t)) throw new Error(what + ' 를 시각으로 읽을 수 없습니다: ' + JSON.stringify(value));
  return t;
}

/**
 * 지표 9개를 한 번에 셉니다.
 *
 * rows      fetchSessions() 가 준 행(또는 같은 모양의 배열)
 * options   { glossIntroducedAt, from, to }
 *
 * 반환 모양은 화면(2단계)이 그대로 받아 쓸 것을 전제로 합니다 — 숫자와 함께
 * numerator/denominator 를 같이 실어, 화면이 「3/17」처럼 분수를 보일 수 있게 합니다.
 * 비율만 주면 분모가 2인 50% 와 분모가 200인 50% 가 화면에서 같아 보입니다.
 */
function computeMetrics(rows, options) {
  const opts = options || {};
  const all = Array.isArray(rows) ? rows : [];
  const entered = all.length;

  const holders = [];
  const nonHolders = [];
  const answered = [];
  for (const row of all) {
    const group = docsGroup(row);
    if (group === 'unanswered') continue;
    answered.push(row);
    if (group === 'holder') holders.push(row);
    else nonHolders.push(row);
  }

  /* ③ 이탈 스텝 — 0~3 을 항상 네 칸 다 냅니다. 값이 없는 스텝을 빼면
     「0건인 스텝」과 「스텝이 없는 것」이 화면에서 같아 보입니다. */
  const steps = {};
  for (let step = 0; step <= 3; step += 1) {
    const count = countWhere(all, (r) => Number(r.completed_step) === step);
    steps[step] = { count: count, rate: ratio(count, entered) };
  }

  /* ⑧ other_doc 비중 — 영문 병기(F-8) 도입 시각으로 전/후를 가릅니다. */
  const glossIntroducedAt = opts.glossIntroducedAt || GLOSS_INTRODUCED_AT;
  const boundary = toTime(glossIntroducedAt, 'glossIntroducedAt');
  const before = [];
  const after = [];
  for (const row of answered) {
    (toTime(row.created_at, 'created_at') < boundary ? before : after).push(row);
  }

  const intakeLinked = countWhere(holders, (r) => r.intake_id !== null && r.intake_id !== undefined);

  const warnings = [];
  if (holders.length > 0 && intakeLinked === 0) {
    warnings.push(
      '서류 보유자 ' + holders.length + '건 중 intake_id 가 채워진 행이 0 입니다. ' +
      '접수 전환 0% 가 아니라 trops_a 의 pre_session_key→intake_id 인계가 아직 ' +
      '붙지 않은 것일 수 있습니다 — 저쪽을 먼저 확인하십시오.'
    );
  }
  if (before.length === 0) {
    warnings.push(
      'other_doc 「병기 도입 전」 구간이 비어 있습니다(경계 ' + glossIntroducedAt + '). ' +
      '영문 병기는 /check 첫 배포부터 들어 있었으므로 이것이 정상입니다 — ' +
      '비교가 필요하면 --gloss-date 로 경계를 옮기십시오.'
    );
  }

  return {
    window: {
      from: opts.from || null,
      to: opts.to || null,
      glossIntroducedAt: glossIntroducedAt,
    },

    /* 분모 분할 결과 자체를 드러냅니다 — 어떤 비율이 어느 모집단 위에서
       계산됐는지 숫자를 보는 사람이 직접 확인할 수 있어야 합니다(§6-2). */
    population: {
      entered: entered,
      docsAnswered: answered.length,
      docsHolders: holders.length,
      docsNonHolders: nonHolders.length,
      docsUnanswered: entered - answered.length,
    },

    metrics: {
      /* ① 진입 수 */
      entered: { count: entered },

      /* ② 스킵률 — 30% 초과면 문항이 무겁다 (§6-1) */
      skipRate: measure(countWhere(all, (r) => r.exited_via === 'skip'), entered, '진입 전체'),

      /* ③ 이탈 스텝 — 특정 문항에 몰리면 그 문항 문제 (§6-1) */
      exitStep: { denominator: entered, denominatorNote: '진입 전체', steps: steps },

      /* ④ 우회율 — 높으면 M1 이 잘 작동. 나쁜 신호가 아닙니다 (§6-1) */
      bypassRate: measure(countWhere(all, (r) => r.exited_via === 'bypass_link'), entered, '진입 전체'),

      /* ⑤ 완주율 — completed_step 은 greatest() 로 쌓인 최대 진행도입니다(0008) */
      completionRate: measure(countWhere(all, (r) => Number(r.completed_step) === 3), entered, '진입 전체'),

      /* ⑥ 🔴 접수 전환 — 분모는 서류 보유자입니다. 전체가 아닙니다 (§6-2) */
      intakeConversion: measure(intakeLinked, holders.length, '서류 보유자(docs 에 none 아닌 값 존재)'),

      /* ⑦ 알림 등록률 — 서류 없는 쪽의 별도 지표 (§6-2) */
      notifyRate: measure(
        countWhere(nonHolders, (r) => r.cta_clicked === 'notify_me'),
        nonHolders.length,
        '서류 미보유자(docs 가 none 뿐)'
      ),

      /* ⑧ other_doc 비중 — 보기 부족 여부 (F-8) */
      otherDocShare: {
        boundary: glossIntroducedAt,
        before: docShare(before, 'other_doc'),
        after: docShare(after, 'other_doc'),
      },

      /* ⑨ 로드맵 수요 신호 — 「준비중」 상품을 언제 열지 판단하는 유일한 데이터 신호 */
      roadmapDemand: {
        sales_contract: docShare(answered, 'sales_contract'),
        quote_pi: docShare(answered, 'quote_pi'),
        either: measure(
          countWhere(answered, (r) => ROADMAP_DOCS.some((d) => hasDoc(r, d))),
          answered.length,
          'Q2 응답자'
        ),
      },
    },

    warnings: warnings,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 같은 숫자의 SQL 판 — Supabase SQL Editor 에 그대로 붙여넣을 수 있습니다
 *
 * 위 순수 함수가 정본이고(화면·CLI 가 그것을 부릅니다), 이쪽은 **대조용**입니다.
 * 숫자가 이상할 때 「집계 코드가 틀렸나」와 「데이터가 그런가」를 가르는 수단입니다.
 * ⚠️ 한쪽만 고치지 마십시오 — 분모 정의가 갈리면 대조의 의미가 없어집니다.
 *
 * :from · :to · :gloss 는 실행 전에 값으로 바꿔 넣으십시오(psql 변수가 아닙니다).
 * ══════════════════════════════════════════════════════════════════════════ */

const SQL_PREAMBLE =
`with s as (
  select * from precheck_prestep_session
  where created_at >= :from and created_at < :to
), d as (
  select s.*,
         (docs is not null) as docs_answered,
         (docs is not null
          and exists (select 1 from unnest(docs) x where x <> 'none')) as is_holder
  from s
)`;

const SQL = {
  entered:
`-- ① 진입 수
${SQL_PREAMBLE}
select count(*) as entered from s;`,

  skipRate:
`-- ② 스킵률 — 분모 진입 전체
${SQL_PREAMBLE}
select count(*) filter (where exited_via = 'skip') as skipped,
       count(*) as entered,
       count(*) filter (where exited_via = 'skip')::numeric / nullif(count(*), 0) as rate
from s;`,

  exitStep:
`-- ③ 이탈 스텝 — completed_step 분포
${SQL_PREAMBLE}
select completed_step,
       count(*) as sessions,
       count(*)::numeric / nullif(sum(count(*)) over (), 0) as rate
from s group by completed_step order by completed_step;`,

  bypassRate:
`-- ④ 우회율 — 높은 것은 나쁜 신호가 아닙니다(M1 이 작동한 것)
${SQL_PREAMBLE}
select count(*) filter (where exited_via = 'bypass_link') as bypassed,
       count(*) as entered,
       count(*) filter (where exited_via = 'bypass_link')::numeric / nullif(count(*), 0) as rate
from s;`,

  completionRate:
`-- ⑤ 완주율
${SQL_PREAMBLE}
select count(*) filter (where completed_step = 3) as completed,
       count(*) as entered,
       count(*) filter (where completed_step = 3)::numeric / nullif(count(*), 0) as rate
from s;`,

  intakeConversion:
`-- ⑥ 접수 전환 — 🔴 분모는 서류 보유자입니다(설계서 §6-2). 전체로 되돌리지 마십시오.
${SQL_PREAMBLE}
select count(*) filter (where intake_id is not null) as converted,
       count(*) as doc_holders,
       count(*) filter (where intake_id is not null)::numeric / nullif(count(*), 0) as rate
from d where is_holder;`,

  notifyRate:
`-- ⑦ 알림 등록률 — 분모는 서류 미보유자(docs 가 none 뿐)
${SQL_PREAMBLE}
select count(*) filter (where cta_clicked = 'notify_me') as notified,
       count(*) as doc_non_holders,
       count(*) filter (where cta_clicked = 'notify_me')::numeric / nullif(count(*), 0) as rate
from d where docs_answered and not is_holder;`,

  otherDocShare:
`-- ⑧ other_doc 비중 — 영문 병기(F-8) 도입 :gloss 전/후. 분모는 Q2 응답자.
${SQL_PREAMBLE}
select case when created_at < :gloss then 'before' else 'after' end as bucket,
       count(*) filter (where 'other_doc' = any(docs)) as picked,
       count(*) as docs_answered,
       count(*) filter (where 'other_doc' = any(docs))::numeric / nullif(count(*), 0) as rate
from d where docs_answered group by 1 order by 1;`,

  roadmapDemand:
`-- ⑨ 로드맵 수요 신호 — 「준비중」 상품 개시 판단. 분모는 Q2 응답자.
${SQL_PREAMBLE}
select count(*) filter (where 'sales_contract' = any(docs)) as sales_contract,
       count(*) filter (where 'quote_pi' = any(docs)) as quote_pi,
       count(*) filter (where 'sales_contract' = any(docs) or 'quote_pi' = any(docs)) as either,
       count(*) as docs_answered
from d where docs_answered;`,
};

module.exports = {
  TABLE: TABLE,
  PAGE_SIZE: PAGE_SIZE,
  MAX_PAGES: MAX_PAGES,
  GLOSS_INTRODUCED_AT: GLOSS_INTRODUCED_AT,
  ROADMAP_DOCS: ROADMAP_DOCS,
  SQL: SQL,
  docsGroup: docsGroup,
  ratio: ratio,
  fetchSessions: fetchSessions,
  computeMetrics: computeMetrics,
};
