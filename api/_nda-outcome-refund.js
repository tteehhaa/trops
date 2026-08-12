/*
 * NDA 대조 결과가 「과금 대상이 아님」으로 나온 유상 건 환불 — 배치 본체
 * 〔E5 · 신설 2026-08-12〕
 *
 * ⚠️ 경계 (반드시 지킬 것)
 *   이 파일에도 **「환불해야 하는가」가 없습니다.** 판단은 판정층 trops_a 가
 *   precheck_nda_run 에 outcome_kind 를 적은 것이고(엔진 실행 결과), 이 파일은
 *   그것을 읽어 isNdaOutcomeChargeable() 사본으로 「과금 대상인가」만 가른 뒤
 *   **환불 실행 순서를 밟을 뿐**입니다. api/_route-refund.js 와 같은 성격입니다 —
 *   다만 판정 표가 다릅니다(precheck_intake_route → precheck_nda_run).
 *
 * 파일명이 밑줄로 시작하므로 Vercel 은 이 파일을 엔드포인트로 만들지 않습니다.
 *
 * ── 왜 새 파일인가 — route 축과 합치지 않은 이유 ─────────────────────────────
 *   route(ok/blocked) 와 outcome_kind(ok/not_supported/failed) 는 서로 다른
 *   독립 축입니다(api/_nda-outcome.js 머리주석). 한 함수에서 두 표를 같이
 *   읽으면 「어느 표가 왜 이 건을 걸렀는지」가 로그에서 갈리지 않습니다.
 *   호출 순서(cron)는 api/cron/refund-blocked.js 가 두 배치를 함께 부릅니다 —
 *   Hobby 플랜 cron 상한(2개)을 이미 다 썼기 때문입니다(그 파일 머리주석 참조).
 *
 * ── 트리거 지점 ─────────────────────────────────────────────────────────────
 *   node --env-file=.env.local scripts/refund-nda-outcome.js              미리보기
 *   node --env-file=.env.local scripts/refund-nda-outcome.js --apply      실제 환불
 *   api/cron/refund-blocked.js 가 정기적으로 이 함수를 그대로 부릅니다.
 *
 * ── 순서가 설계다 ───────────────────────────────────────────────────────────
 *   ① 선행 검사     환불 컬럼(refunded_at·refund_reason)이 있는지 — **돈을
 *                   건드리기 전에** 확인합니다(api/_refund.js 와 공용).
 *   ② 후보 수집     precheck_nda_run 에서 outcome_kind ∈ {not_supported,failed}
 *                   (못 읽으면 **0건 환불**로 끝냅니다 — 표가 없다≠환불할 것이 없다)
 *   ③ 결제 상태로 좁힘   intake_path=paid · payment_status=paid · refunded_at is null
 *   ④ 현재 상태 재확인   건마다 **현재** outcome_kind 를 다시 읽습니다(아래 🔴)
 *   ⑤ 전달된 건은 비켜둠   delivered_at 이 있으면 사람에게 넘깁니다(아래 🔴)
 *   ⑥ 환불          api/_refund.js refundOrder 를 **그대로** 재사용합니다
 *   ⑦ 안내메일       환불이 끝난 건에만. 실패해도 환불을 되돌리지 않습니다
 *
 * ── 🔴 ④ 왜 다시 읽는가 ─────────────────────────────────────────────────────
 *   run_id 은 PK 라 append-only 는 아니지만(api/_nda-outcome.js 참조), 벌크
 *   조회(②)와 개별 환불(⑥) 사이에 시간이 걸립니다. 그 사이 엔진이 같은 건을
 *   재처리해 outcome_kind 가 바뀌었을 수 있습니다 — 그 경우 돈을 움직이지
 *   않습니다. route 판의 「뒤집힘」과는 원인이 다르지만 방어는 같은 모양입니다.
 *
 * ── 🔴 ⑤ 왜 전달된 건을 자동으로 환불하지 않는가 ────────────────────────────
 *   환불규정 §02 는 「전달 전 전액 환불」이고, 전달 **후** 전액 환불은 §03 의
 *   네 가지 경우로 한정돼 있습니다. 이미 전달된 건이 뒤늦게 처리 불가로
 *   확인된 상태가 그 네 가지 중 무엇인지는 코드가 정할 수 없습니다 — 사람이
 *   봐야 합니다. 그래서 목록으로 남기고 넘깁니다(scripts/refund.js 가 그 자리).
 */

'use strict';

const { safeText } = require('./_supabase.js');
const REFUND = require('./_refund.js');
const OUTCOME = require('./_nda-outcome.js');
const GATE = require('./_precheck-charge-gate.js');
const { buildMagicLink, sendRouteRefundMail } = require('./_notify.js');

/** 한 번에 물어보는 id 수 — api/_route-refund.js 와 같은 이유(URL 길이). */
const ID_CHUNK = 50;

/**
 * refund_reason 에 그대로 남는 문자열. sendRouteRefundMail 에는 넘기지 않습니다
 * (아래 ⑦에서 이용자에게는 OUTCOME.NOTICE 라는 별도의 plain 문장을 보냅니다) —
 * 이 문자열은 DB 기록과 토스 취소 사유(내부용)에만 씁니다.
 */
function refundReasonText(outcomeKind) {
  return 'NDA 대조 처리 불가 — ' + OUTCOME.TABLE + '.outcome_kind=' + (outcomeKind || '미기재');
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** 과금 대상이 아닌 후보 id 로 유상·결제완료·미환불 접수 행만 골라 옵니다. */
async function findPaidCandidates(config, ids) {
  const select = 'id,order_id,email,access_token,amount,status,payment_status,' +
    'payment_key,paid_at,delivered_at,refunded_at';
  const rows = [];

  for (const group of chunk(ids, ID_CHUNK)) {
    const filter = '?id=in.(' + group.map(encodeURIComponent).join(',') + ')' +
      '&intake_path=eq.paid&payment_status=eq.paid&refunded_at=is.null' +
      '&select=' + select;

    const response = await fetch(config.restUrl + '/intake' + filter, { headers: config.headers });
    if (!response.ok) {
      throw new Error('접수 조회 실패 (HTTP ' + response.status + ') — ' +
        (await safeText(response)).slice(0, 300));
    }
    const body = await response.json();
    if (Array.isArray(body)) rows.push.apply(rows, body);
  }

  return rows;
}

/**
 * NDA 대조 결과가 과금 대상이 아닌 유상 건을 환불합니다.
 *
 * options: { apply, log, limit }
 *   apply=false 면 **아무것도 취소하지 않습니다** — 무엇을 취소할지만 셉니다.
 *
 * 돌려주는 값:
 *   { available, checked, candidates, refunded, already, reversed, deferred, failed, notified, errors }
 *
 *   available:false  표를 못 읽었습니다 — **한 건도 환불하지 않았습니다**
 *   reversed         non-chargeable 후보였지만 현재 outcome_kind 가 'ok' 로 바뀜(또는 사라짐)
 *   deferred         자료를 이미 전달한 건 — 사람에게 넘깁니다(위 🔴 ⑤)
 */
async function refundNonChargeableOutcomes(config, options) {
  const opts = options || {};
  const log = opts.log || (() => {});
  const apply = opts.apply === true;

  // ① 돈을 건드리기 전에. 컬럼이 없으면 여기서 던지고 아무것도 하지 않습니다.
  await REFUND.assertRefundColumns(config);

  // ② 못 읽으면 0건. 「표가 없다」를 「환불할 것이 없다」로 읽지 않습니다.
  const nonChargeable = await OUTCOME.readNonChargeableRunIds(config, opts.limit);
  if (!nonChargeable.available) {
    log('NDA 대조 결과 표를 읽지 못했습니다 — 한 건도 환불하지 않았습니다.' +
      '\n   ' + nonChargeable.error +
      '\n   표는 판정층 trops_a 소관입니다(' + OUTCOME.TABLE + ').');
    return {
      available: false, error: nonChargeable.error,
      checked: 0, candidates: 0, refunded: 0, already: 0,
      reversed: 0, deferred: [], failed: [], notified: 0, errors: [],
    };
  }

  if (nonChargeable.truncated) {
    log('⚠️ 처리 불가 기록이 상한(' + nonChargeable.limit + '행)까지 찼습니다 — ' +
      '그보다 오래된 건은 이번 실행에서 보지 못했습니다.');
  }

  const result = {
    available: true,
    truncated: Boolean(nonChargeable.truncated),
    checked: nonChargeable.ids.length,
    candidates: 0,
    refunded: 0,
    already: 0,
    reversed: 0,
    deferred: [],
    failed: [],
    notified: 0,
    errors: [],
  };

  if (nonChargeable.ids.length === 0) {
    log('NDA 대조 처리 불가로 기록된 건이 없습니다.');
    return result;
  }

  // ③ 돈이 걸린 건만 남깁니다. 무상 건은 환불할 것이 없어 여기서 사라집니다.
  const candidates = await findPaidCandidates(config, nonChargeable.ids);
  result.candidates = candidates.length;
  log('처리 불가 기록 ' + nonChargeable.ids.length + '건 중 유상·결제완료·미환불 ' +
    candidates.length + '건이 후보입니다.');

  for (const row of candidates) {
    // ④ 현재 outcome_kind 를 다시 읽습니다. 재처리로 바뀐 건에 돈을 움직이지 않습니다.
    const now = await OUTCOME.readOutcome(config, row.id);
    if (!now.available) {
      result.errors.push({ orderId: row.order_id, error: now.error });
      log('현재 상태를 다시 읽지 못해 건너뜁니다 — ' + row.order_id + ' | ' + now.error);
      continue;
    }
    if (!now.row || GATE.isNdaOutcomeChargeable(now.row.outcomeKind)) {
      result.reversed += 1;
      log('과금 대상으로 바뀐(또는 기록이 사라진) 건이라 환불하지 않습니다 — ' + row.order_id +
        ' | 현재=' + (now.row ? now.row.outcomeKind : '기록없음'));
      continue;
    }

    // ⑤ 전달까지 끝난 건은 사람이 봅니다(환불규정 §02·§03).
    if (row.delivered_at) {
      result.deferred.push({ orderId: row.order_id, deliveredAt: row.delivered_at });
      log('자료를 이미 전달한 건입니다 — ' + row.order_id +
        ' | 전달=' + row.delivered_at +
        '\n   환불규정 §03 해당 여부를 사람이 판단해야 합니다. 자동으로 환불하지 않았습니다.' +
        '\n   판단이 끝나면: npm run refund:apply -- ' + row.order_id + ' --reason "…"');
      continue;
    }

    if (!apply) {
      log('[미리보기] 환불 대상 — ' + row.order_id + ' | ' + row.amount + '원 | outcome=' +
        now.row.outcomeKind);
      continue;
    }

    // ⑥ 실행은 기존 본체를 그대로 씁니다. 여기에 취소 순서를 다시 쓰지 않습니다.
    let outcome;
    try {
      outcome = await REFUND.refundOrder(config, {
        orderId: row.order_id,
        reason: refundReasonText(now.row.outcomeKind),
        apply: true,
        // 이 파일 아래 ⑦이 sendRouteRefundMail 로 자체 안내메일을 보냅니다 —
        // refundOrder 의 기본 발송(sendManualRefundMail)까지 켜 두면 두 통이 갑니다.
        notify: false,
        log: (m) => log('  ' + m),
      });
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      result.failed.push({ orderId: row.order_id, error: message });
      log('🔴 환불 중 오류 — ' + row.order_id + ' | ' + message);
      continue;
    }

    if (outcome.outcome === 'refunded') {
      result.refunded += 1;
    } else if (outcome.outcome === 'already') {
      result.already += 1;
      continue;
    } else {
      result.failed.push({ orderId: row.order_id, outcome: outcome.outcome });
      log('환불되지 않았습니다 — ' + row.order_id + ' | outcome=' + outcome.outcome);
      continue;
    }

    /*
     * ⑦ 안내메일. 🔴 **환불 뒤에** 보냅니다 — 먼저 보내면 취소가 거절됐을 때
     * 「환불했습니다」만 남습니다. 실패해도 환불은 되돌리지 않습니다.
     *
     * 이용자에게는 OUTCOME.NOTICE(plain 문장)만 보입니다 — outcome_kind 값이나
     * 표 이름 같은 내부 사실은 이용자 메일에 넣지 않습니다(위 refundReasonText
     * 와 역할을 가른 이유). canonTable·canonSourceFile 로 운영자 알림만
     * 이 배치 소관임을 밝힙니다.
     */
    try {
      const sent = await sendRouteRefundMail({
        email: row.email,
        magicLink: row.access_token ? buildMagicLink(row.access_token) : null,
        notice: OUTCOME.noticeFor(now.row.outcomeKind),
        amount: row.amount,
        orderId: row.order_id,
        canonTable: OUTCOME.TABLE,
        canonSourceFile: 'api/_nda-outcome-refund.js',
      });
      if (sent && sent.sent) result.notified += 1;
      else result.errors.push({ orderId: row.order_id, error: '안내메일 미발송' });
    } catch (err) {
      result.errors.push({
        orderId: row.order_id,
        error: '안내메일 실패 — ' + (err && err.message ? err.message : String(err)),
      });
    }
  }

  if (!apply) {
    log('[미리보기] --apply 를 붙이면 위 건을 전액 취소하고 환불로 기록합니다.');
  }
  if (result.deferred.length > 0) {
    log('⚠️ 사람이 봐야 하는 건 ' + result.deferred.length + '건이 남았습니다(전달 완료분).');
  }

  return result;
}

module.exports = {
  refundNonChargeableOutcomes: refundNonChargeableOutcomes,
  refundReasonText: refundReasonText,
};
