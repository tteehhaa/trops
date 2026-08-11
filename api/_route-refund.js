/*
 * 「범위 밖」으로 뒤집힌 유상 건 환불 — 배치 본체 〔M-2 · 신설 2026-08-11〕
 *
 * ⚠️ 경계 (반드시 지킬 것)
 *   이 파일에도 **「환불해야 하는가」가 없습니다.** 판단은 판정층 trops_a 가
 *   precheck_intake_route 에 route='blocked' 로 적은 것이고, 이 파일은 그것을
 *   읽어 **환불 실행 순서를 밟을 뿐**입니다. 사유 코드도 문면도 만들지 않습니다.
 *
 * 파일명이 밑줄로 시작하므로 Vercel 은 이 파일을 엔드포인트로 만들지 않습니다.
 *
 * ── 🔴 웹훅이 아니라 폴링입니다 (재착수 결정 ⑤) ─────────────────────────────
 *   trops_a 가 표에 행을 **더하고**(append-only), 이 배치가 하루 한 번 그것을
 *   **보러 갑니다.** 통보를 받지 않습니다.
 *
 *   왜: 웹훅이면 이 저장소에 「판정층이 부르는 입구」가 생기고, 그 입구는 인증·
 *   재시도·순서 보장을 전부 갖춰야 합니다. 놓친 통보는 영구히 놓칩니다.
 *   폴링은 놓칠 것이 없습니다 — 오늘 못 잡으면 내일 같은 행을 다시 잡습니다(멱등).
 *   ⚠️ 대가는 지연입니다. 최악의 경우 「뒤집힘 → 환불」에 하루 남짓 걸립니다.
 *      돈이 늦게 돌아가는 것은 늦게라도 반드시 돌아가면 회복되는 종류의 문제이고,
 *      놓친 웹훅은 회복되지 않습니다.
 *
 * ── 순서가 설계다 ───────────────────────────────────────────────────────────
 *   ① 환불 컬럼 선행 검사   api/_refund.js assertRefundColumns — **돈을 건드리기 전에**
 *   ② blocked 후보 수집     precheck_intake_route (못 읽으면 **0건 환불**로 끝냅니다)
 *   ③ 결제 상태로 좁힘      intake_path=paid · payment_status=paid · refunded_at is null
 *   ④ 뒤집힘 재확인         건마다 **현재** route 를 다시 읽습니다 (아래 🔴)
 *   ⑤ 전달된 건은 비켜둠    delivered_at 이 있으면 사람에게 넘깁니다 (아래 🔴)
 *   ⑥ 환불                  api/_refund.js refundOrder 를 **그대로** 재사용합니다
 *   ⑦ 안내메일              환불이 끝난 건에만. 실패해도 환불을 되돌리지 않습니다
 *
 * ── 🔴 ④ 왜 다시 읽는가 ─────────────────────────────────────────────────────
 *   표가 append-only 라 route='blocked' 행은 **지워지지 않습니다.** 나중에 ok 로
 *   되돌려졌어도 그 행은 그대로 남아 있어 ②에 계속 걸립니다. 다시 읽지 않으면
 *   이미 되돌려진 판단으로 매일 환불을 시도합니다.
 *
 * ── 🔴 ⑤ 왜 전달된 건을 자동으로 환불하지 않는가 ────────────────────────────
 *   환불규정 §02 는 「전달 전 전액 환불」이고, 전달 **후** 전액 환불은 §03 의
 *   네 가지 경우로 한정돼 있습니다. 자료를 이미 보낸 건이 뒤늦게 blocked 로
 *   뒤집힌 상태는 그 네 가지 중 무엇인지 코드가 정할 수 없습니다 —
 *   보낸 자료가 쓸모없었는지, 일부만 담겼는지는 사람이 봐야 합니다.
 *   그래서 목록으로 남기고 넘깁니다(scripts/refund.js 가 그 자리입니다).
 */

'use strict';

const { safeText } = require('./_supabase.js');
const REFUND = require('./_refund.js');
const ROUTE = require('./_intake-route.js');
const { buildMagicLink, sendRouteRefundMail } = require('./_notify.js');

/** 한 번에 물어보는 id 수. URL 길이(대부분 게이트웨이가 8KB 근처)를 넘기지 않으려고 나눕니다. */
const ID_CHUNK = 50;

/**
 * refund_reason 에 그대로 남는 문자열.
 *
 * ⚠️ 사람이 나중에 읽는 자리입니다. 「어디를 보고 환불했는지」가 남아야 하므로
 *    표 이름과 사유 코드를 함께 적습니다. 「등급」·「부분」은 쓰지 않습니다(C2).
 */
function refundReasonText(reason) {
  return '처리 불가 — ' + ROUTE.TABLE + '.reason=' + (reason || '미기재');
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** blocked 후보 id 로 유상·결제완료·미환불 접수 행만 골라 옵니다. */
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
 * 「범위 밖」으로 뒤집힌 유상 건을 환불합니다.
 *
 * options: { apply, log, limit }
 *   apply=false 면 **아무것도 취소하지 않습니다** — 무엇을 취소할지만 셉니다
 *   (scripts/cleanup-expired.js · scripts/refund.js 와 같은 양식).
 *
 * 돌려주는 값:
 *   { available, checked, candidates, refunded, already, reversed, deferred, failed, notified, errors }
 *
 *   available:false  표를 못 읽었습니다 — **한 건도 환불하지 않았습니다**
 *   reversed         blocked 행은 있지만 현재 route 가 blocked 가 아닙니다(되돌려짐)
 *   deferred         자료를 이미 전달한 건 — 사람에게 넘깁니다(위 🔴 ⑤)
 */
async function refundBlockedRoutes(config, options) {
  const opts = options || {};
  const log = opts.log || (() => {});
  const apply = opts.apply === true;

  // ① 돈을 건드리기 전에. 컬럼이 없으면 여기서 던지고 아무것도 하지 않습니다.
  await REFUND.assertRefundColumns(config);

  // ② 못 읽으면 0건. 「표가 없다」를 「환불할 것이 없다」로 읽지 않습니다.
  const blocked = await ROUTE.readBlockedIntakeIds(config, opts.limit);
  if (!blocked.available) {
    log('처리 가능 여부 표를 읽지 못했습니다 — 한 건도 환불하지 않았습니다.' +
      '\n   ' + blocked.error +
      '\n   표는 판정층 trops_a 소관입니다(' + ROUTE.TABLE + ' · precheck-schema.sql 「0-G」 참조).');
    return {
      available: false, error: blocked.error,
      checked: 0, candidates: 0, refunded: 0, already: 0,
      reversed: 0, deferred: [], failed: [], notified: 0, errors: [],
    };
  }

  /*
   * ⚠️ 상한에 닿았으면 **말합니다.** 조용히 자르면 「전건 확인했다」로 읽히고,
   *    밀려난 오래된 건은 아무도 모르는 사이 환불되지 않은 채 남습니다.
   *    닿았다면 상한을 올리는 것보다 「왜 blocked 가 그렇게 쌓였는가」가 먼저입니다.
   */
  if (blocked.truncated) {
    log('⚠️ 처리 불가 기록이 상한(' + blocked.limit + '행)까지 찼습니다 — ' +
      '그보다 오래된 건은 이번 실행에서 보지 못했습니다.');
  }

  const result = {
    available: true,
    truncated: Boolean(blocked.truncated),
    checked: blocked.ids.length,
    candidates: 0,
    refunded: 0,
    already: 0,
    reversed: 0,
    deferred: [],
    failed: [],
    notified: 0,
    errors: [],
  };

  if (blocked.ids.length === 0) {
    log('처리 불가로 기록된 건이 없습니다.');
    return result;
  }

  // ③ 돈이 걸린 건만 남깁니다. 무상 건은 환불할 것이 없어 여기서 사라집니다
  //    (그 건의 안내는 접수 확인 화면이 합니다 — 문면만 있고 돈이 없습니다).
  const candidates = await findPaidCandidates(config, blocked.ids);
  result.candidates = candidates.length;
  log('처리 불가 기록 ' + blocked.ids.length + '건 중 유상·결제완료·미환불 ' +
    candidates.length + '건이 후보입니다.');

  for (const row of candidates) {
    // ④ 현재 route 를 다시 읽습니다. 되돌려진 건에 돈을 움직이지 않습니다.
    const now = await ROUTE.readLatestRoute(config, row.id);
    if (!now.available) {
      result.errors.push({ orderId: row.order_id, error: now.error });
      log('현재 상태를 다시 읽지 못해 건너뜁니다 — ' + row.order_id + ' | ' + now.error);
      continue;
    }
    if (!now.row || now.row.route !== 'blocked') {
      result.reversed += 1;
      log('되돌려진 건이라 환불하지 않습니다 — ' + row.order_id +
        ' | 현재=' + (now.row ? now.row.route : '기록없음'));
      continue;
    }

    // ⑤ 전달까지 끝난 건은 사람이 봅니다(환불규정 §02·§03 · 위 🔴).
    if (row.delivered_at) {
      result.deferred.push({ orderId: row.order_id, deliveredAt: row.delivered_at });
      log('자료를 이미 전달한 건입니다 — ' + row.order_id +
        ' | 전달=' + row.delivered_at +
        '\n   환불규정 §03 해당 여부를 사람이 판단해야 합니다. 자동으로 환불하지 않았습니다.' +
        '\n   판단이 끝나면: npm run refund:apply -- ' + row.order_id + ' --reason "…"');
      continue;
    }

    if (!apply) {
      log('[미리보기] 환불 대상 — ' + row.order_id + ' | ' + row.amount + '원 | 사유=' +
        (now.row.reason || '미기재'));
      continue;
    }

    // ⑥ 실행은 기존 본체를 그대로 씁니다. 여기에 취소 순서를 다시 쓰지 않습니다 —
    //    복제하면 한쪽만 고쳐지고 다른 쪽이 조용히 옛 순서로 남습니다.
    let outcome;
    try {
      outcome = await REFUND.refundOrder(config, {
        orderId: row.order_id,
        reason: refundReasonText(now.row.reason),
        apply: true,
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
      // 같은 날 두 번 돌았거나 사람이 먼저 처리한 경우입니다. 실패가 아닙니다.
      result.already += 1;
      continue;
    } else {
      result.failed.push({ orderId: row.order_id, outcome: outcome.outcome });
      log('환불되지 않았습니다 — ' + row.order_id + ' | outcome=' + outcome.outcome);
      continue;
    }

    /*
     * ⑦ 안내메일. 🔴 **환불 뒤에** 보냅니다.
     *
     * 메일을 먼저 보내면 취소가 거절됐을 때 「환불했습니다」만 남습니다.
     * 반대로 메일이 실패해도 환불은 되돌리지 않습니다 — 돈은 이미 돌아갔고,
     * 메일은 사람이 다시 보낼 수 있습니다. 실패는 errors 에 실어 보고합니다.
     *
     * (M-3 이 남겨 둔 「안내 메일이 아직 자동이 아니다」가 **이 경로에서만**
     *  닫힙니다. 사람이 직접 돌리는 scripts/refund.js 는 그대로입니다 —
     *  그쪽 사유는 코드가 모르는 것이라 문면을 만들 수 없습니다.)
     */
    try {
      const sent = await sendRouteRefundMail({
        email: row.email,
        magicLink: row.access_token ? buildMagicLink(row.access_token) : null,
        notice: ROUTE.noticeFor('blocked', now.row.reason),
        amount: row.amount,
        orderId: row.order_id,
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
  refundBlockedRoutes: refundBlockedRoutes,
  refundReasonText: refundReasonText,
};
