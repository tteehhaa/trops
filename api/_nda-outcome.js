/*
 * NDA 대조 결과 읽기 〔E5 · 신설 2026-08-12〕
 *
 * ⚠️ 경계 (반드시 지킬 것)
 *   이 파일은 **읽기만** 합니다. 「과금해도 되는가」를 여기서 정하지 않습니다.
 *   정본은 판정층 trops_a 의 precheck_nda_run 표(PR9/PR10)이고, NDA 대조 엔진이
 *   실행된 뒤에만 이 행이 생깁니다. 이 저장소는 그 표를 select 만 합니다.
 *
 * 파일명이 밑줄로 시작하므로 Vercel 은 이 파일을 엔드포인트로 만들지 않습니다.
 *
 * ── 🔴 route(api/_intake-route.js)와 다른 독립 축입니다 ─────────────────────
 *   route(ok/blocked)   접수 시점 문서 자체(스캔본·언어)만 봄. NDA 엔진과 무관.
 *   outcome_kind        NDA 대조 엔진이 **실제로 문서를 처리한 뒤**에만 생김.
 *   두 표는 조인 관계가 아닙니다 — 각자 독립된 실행 경로의 산출물입니다
 *   (trops_a 조사 회신 · 2026-08-12: route 는 outcome_kind 의 파생값이 아님).
 *
 * ── 🔴 결제보다 항상 뒤입니다 (E5 조사 결론 · 2026-08-12) ────────────────────
 *   트리거 배치(trops_a app/api/cron/precheck-nda-run · 22:20 UTC, PR10 · Option B)
 *   가 그 자체로 intake.payment_status='paid' 인 건만 골라 엔진을 돌립니다.
 *   그래서 outcome_kind 는 결제 승인 **전에는 존재할 수 없습니다** — 사전 차단
 *   (intakeIneligibilityBlockers 확장)이 아니라 사후 환불로만 쓸 수 있는 이유가
 *   이것입니다(api/_nda-outcome-refund.js 가 그 자리입니다).
 *
 * ── run_id = intake.id (컬럼 추가 없음) ──────────────────────────────────────
 *   trops_a PR10 설계: precheck_nda_run 에 intake_id 컬럼을 새로 만들지 않고,
 *   run_id(PK)에 intake.id 값을 그대로 넣습니다. FK 는 걸지 않습니다 — route 와
 *   같은 이유로, 판정층 표에 이 저장소가 제약을 걸면 그 표의 소유권이 흔들립니다.
 *
 * ── append-only 가 아닙니다 ──────────────────────────────────────────────────
 *   run_id 이 PK 라 건마다 행이 하나뿐입니다. route 처럼 「뒤집힘」을 다시 확인할
 *   필요가 없습니다 — 있으면 그것이 곧 현재 상태입니다.
 */

'use strict';

const { safeText } = require('./_supabase.js');

/** trops_a 소유 표. 이 저장소는 select 만 합니다. */
const TABLE = 'precheck_nda_run';

/**
 * 아는 값만 통과시킵니다 — api/_intake-route.js ROUTES 와 같은 규칙입니다.
 * 모르는 문자열을 통과시키면, trops_a 가 값을 늘렸을 때 이 저장소가 그 뜻을
 * 모르는 채로 환불을 돌립니다. 모르는 값은 **없는 것으로 둡니다**.
 */
const OUTCOMES = ['ok', 'not_supported', 'failed'];

/** 표에서 읽어 온 행을 아는 값만 남기고 걸러냅니다. 모르면 null. */
function readRow(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const outcomeKind = typeof raw.outcome_kind === 'string' ? raw.outcome_kind : '';
  if (OUTCOMES.indexOf(outcomeKind) === -1) return null;

  return {
    outcomeKind: outcomeKind,
    runId: typeof raw.run_id === 'string' ? raw.run_id : null,
  };
}

/**
 * 접수 한 건의 NDA 대조 결과. run_id = intake.id 로 조회합니다.
 *
 * 던지지 않습니다. 못 읽은 경우와 「아직 안 정해진 경우」를 구분해 돌려줍니다:
 *   { available:false, error }        표가 없다 · 컬럼이 다르다 · 접속 실패
 *   { available:true, row:null }      표는 읽었고 이 건에 대한 행이 아직 없다
 *   { available:true, row:{…} }       현재 상태
 */
async function readOutcome(config, intakeId) {
  if (!intakeId) return { available: true, row: null };

  const query = '?run_id=eq.' + encodeURIComponent(intakeId) + '&select=run_id,outcome_kind&limit=1';

  try {
    const response = await fetch(config.restUrl + '/' + TABLE + query, { headers: config.headers });
    if (!response.ok) {
      return {
        available: false,
        error: TABLE + ' 읽기 실패 (HTTP ' + response.status + ') — ' +
          (await safeText(response)).slice(0, 200),
      };
    }
    const rows = await response.json();
    const raw = Array.isArray(rows) ? rows[0] : null;
    return { available: true, row: raw ? readRow(raw) : null };
  } catch (err) {
    return { available: false, error: err && err.message ? err.message : String(err) };
  }
}

/**
 * outcome_kind 가 'ok' 가 아닌 것으로 기록된 run_id(= intake.id) 목록.
 * 환불 배치의 1차 후보입니다(api/_intake-route.js readBlockedIntakeIds 와 같은 자리).
 *
 * ⚠️ 한 번에 가져오는 행 수에 상한이 있습니다. 상한에 닿으면 truncated:true 로
 *    알립니다 — 조용히 자르면 오래된 건이 아무도 모르는 사이 환불되지 않습니다.
 */
const NON_CHARGEABLE_SCAN_LIMIT = 500;

async function readNonChargeableRunIds(config, limit) {
  const max = limit || NON_CHARGEABLE_SCAN_LIMIT;
  const query = '?outcome_kind=in.(not_supported,failed)&select=run_id&limit=' + String(max);

  try {
    const response = await fetch(config.restUrl + '/' + TABLE + query, { headers: config.headers });
    if (!response.ok) {
      return {
        available: false,
        error: TABLE + ' 읽기 실패 (HTTP ' + response.status + ') — ' +
          (await safeText(response)).slice(0, 200),
      };
    }

    const rows = await response.json();
    const list = Array.isArray(rows) ? rows : [];
    const ids = [];
    const seen = Object.create(null);
    for (const row of list) {
      const id = row && row.run_id;
      if (typeof id !== 'string' || !id || seen[id]) continue;
      seen[id] = true;
      ids.push(id);
    }
    return { available: true, ids: ids, truncated: list.length >= max, limit: max };
  } catch (err) {
    return { available: false, error: err && err.message ? err.message : String(err) };
  }
}

/**
 * 이용자에게 보여줄 문장. 'not_supported'·'failed' 모두 이용자 관점에선 같은
 * 사실(처리를 마치지 못했다)이라 사유별로 문장을 가르지 않습니다 — route 판
 * NOTICES 와 달리 사유가 늘어도 문면을 늘릴 이유가 없습니다.
 *
 * 아직 이 자리로 환불규정 조항을 못박습니다 — 결제 후 · 자료 전달 **전**이면
 * 사유를 불문하고 전액 환불한다는 것이 이미 있는 규정입니다(refund.html §02).
 * 새 사유 범주를 만드는 것이 아니라 그 규정을 outcome_kind 축에도 적용하는
 * 것뿐이라, 새 고객 문안을 짓지 않았습니다.
 */
const NOTICE =
  '대조 처리를 완료하지 못해 전액 환불해 드립니다. 자료를 전달하기 전이라 ' +
  '별도 사유 확인 없이 환불됩니다(환불규정 02).';

function noticeFor(outcomeKind) {
  if (OUTCOMES.indexOf(outcomeKind) === -1 || outcomeKind === 'ok') return null;
  return NOTICE;
}

module.exports = {
  TABLE: TABLE,
  OUTCOMES: OUTCOMES,
  NON_CHARGEABLE_SCAN_LIMIT: NON_CHARGEABLE_SCAN_LIMIT,
  NOTICE: NOTICE,
  readRow: readRow,
  readOutcome: readOutcome,
  readNonChargeableRunIds: readNonChargeableRunIds,
  noticeFor: noticeFor,
};
