/*
 * 결제 미완료 리마인드 — 배치 본체 〔흐름 md §3 · §5-1 6번 · 신설 2026-08-13〕
 *
 * ⚠️ 경계 (반드시 지킬 것)
 *   이 파일은 **돈을 움직이지 않습니다.** 결제를 대신 하지도, 취소하지도, 환불하지도
 *   않습니다. 「결제가 멈춘 채 남아 있다」는 사실을 읽어 메일 한 통을 보내고, 보낸
 *   사실을 기록하는 것이 전부입니다. 판정·과금·환불은 각각 trops_a · api/_precheck-
 *   charge-gate.js · api/_refund.js 소관입니다.
 *
 * 파일명이 밑줄로 시작하므로 Vercel 은 이 파일을 엔드포인트로 만들지 않습니다.
 * cron 라우트(api/cron/refund-blocked.js)와 CLI(scripts/payment-reminder.js)가
 * **같은 이 함수**를 부릅니다 — 복제하면 한쪽만 고쳐집니다.
 *
 * ── 무엇을 회수하는가 ───────────────────────────────────────────────────────
 *   유료 경로로 접수해 **파일까지 올렸는데 결제창에서 그만둔 건**입니다.
 *   api/intake.js 가 그 상태를 status='awaiting_payment' · payment_status='pending'
 *   으로 남기고 확인메일도 보내지 않습니다(결제 전에 「접수되었습니다」를 보내면
 *   그만둔 사람에게도 가버리므로). 그래서 이 사람은 **지금 아무 접점도 없습니다.**
 *   md 근거: 「이미 파일 업로드까지 한 고성의도 이탈자 회수」.
 *
 * ── 순서가 설계다 ───────────────────────────────────────────────────────────
 *   ① 후보 수집   아래 다섯 조건을 **전부** 만족하는 행만
 *   ② 메일 발송   api/_notify.js sendPaymentReminderMail
 *   ③ 발송 성공한 건에만 payment_reminder_sent_at = now
 *
 * ── 🔴 ②→③ 순서를 뒤집지 마십시오 ──────────────────────────────────────────
 *   먼저 표시하고 나중에 보내면, 발송이 실패한 건이 「보냈음」으로 굳어 **영구히
 *   회수 대상에서 빠집니다.** 지금 순서라면 반대 사고가 가능합니다 — 발송은 됐는데
 *   표시가 실패해 다음 실행이 한 번 더 보내는 경우. 「1회」의 위반이지만, 두 번 오는
 *   메일과 영원히 안 오는 메일 중에서는 전자가 낫습니다.
 *   ⚠️ 이 트레이드오프를 「멱등하게 고친다」며 순서를 뒤집지 마십시오. 진짜 해결은
 *      발송 전 예약(claim) → 발송 → 확정 3단이고, 그건 메일 한 통에 과한 구조입니다.
 *
 * ── 후보 다섯 조건 (하나라도 빠지면 잘못된 사람에게 갑니다) ─────────────────
 *   ① intake_path='paid'                  무상 건은 결제할 것이 없습니다
 *   ② payment_status='pending'            승인·실패·환불된 건은 대상이 아닙니다
 *   ③ status='awaiting_payment'           결제가 끝난 건은 'received' 로 올라갑니다
 *   ④ payment_reminder_sent_at is null    「1회」의 근거 — 멱등
 *   ⑤ received_at 이 [now-MAX_AGE_HOURS, now-REMIND_AFTER_HOURS] 구간
 *
 * ── 🔴 ⑤ 왜 아래쪽 상한(MAX_AGE_HOURS)까지 두는가 ───────────────────────────
 *   payment_reminder_sent_at 컬럼이 **나중에 추가**됩니다. 그래서 컬럼이 붙는 순간
 *   기존 awaiting_payment 잔행 **전부**가 ④를 만족합니다 — 상한이 없으면 첫 실행에서
 *   몇 주 전에 그만둔 사람들에게 한꺼번에 독촉메일이 나갑니다. 그게 이 배치가 낼 수
 *   있는 가장 나쁜 결과입니다(스팸 신고 · 발신 도메인 평판).
 *   72시간을 고른 이유: 3일이 지난 이탈은 회수 대상이 아니라 이미 결정입니다.
 *   ⚠️ 이 상한을 지우거나 늘리지 마십시오. 늘리려면 먼저 잔행 수를 세어 보십시오
 *      (scripts/payment-reminder.js 를 --apply 없이 돌리면 셉니다).
 *
 * ── 🔴 왜 「3시간」이 정확히 3시간이 아닌가 ──────────────────────────────────
 *   REMIND_AFTER_HOURS 는 **후보 적격 임계값**이고, 배치가 도는 주기는 하루 1회입니다
 *   (Hobby 플랜 cron 은 분·시 고정 — test/cron-registration.test.js 가 단정합니다).
 *   그래서 실제 발송은 「접수 +3시간」이 아니라 「접수 +3시간이 지난 뒤 오는 첫 실행」
 *   이고, 최악의 경우 24시간 남짓 늦습니다. md §3 의 「N시간(예 3시간) 후」를 이 제약
 *   아래에서 구현할 수 있는 형태가 이것입니다.
 *   ⛔ 이걸 고치려고 cron 을 여러 개로 늘리지 마십시오 — 상한 2개를 이미 다 씁니다.
 *      정확한 +3h 발송이 필요해지면 플랜을 올리거나 큐/외부 스케줄러가 선행입니다.
 *
 * ── 표가 없으면 (fail-safe closed) ──────────────────────────────────────────
 *   payment_reminder_sent_at 컬럼이 없으면 후보 조회가 실패합니다. 그때는
 *   available:false 로 **0건**을 돌려주고 던지지 않습니다 — 「아직 안 붙었다」와
 *   「붙었는데 부서졌다」를 가리는 이 저장소의 기존 처리(api/_intake-route.js ·
 *   api/_nda-outcome.js)와 같습니다. 접수·결제는 이 컬럼 없이도 그대로 돕니다.
 */

'use strict';

const { safeText } = require('./_supabase.js');
const { sendPaymentReminderMail } = require('./_notify.js');

/** 접수 후 이 시간이 지나야 후보입니다. md §3 의 「N시간(예 3시간)」. */
const REMIND_AFTER_HOURS = 3;

/**
 * 이보다 오래된 건은 회수 대상이 아닙니다. 위 🔴 참조 —
 * 컬럼이 나중에 붙으므로 이 상한이 없으면 첫 실행이 잔행 전체에 메일을 뿌립니다.
 */
const MAX_AGE_HOURS = 72;

/** 한 번 실행에서 보낼 상한. 닿으면 truncated 로 **말합니다**(조용히 자르지 않습니다). */
const MAX_PER_RUN = 50;

const HOUR_MS = 60 * 60 * 1000;

/**
 * 후보 행을 읽습니다. 던지지 않습니다 — 못 읽은 것과 0건을 가려 돌려줍니다.
 *
 * ⚠️ where 조건은 precheck-schema.sql 의 intake_payment_reminder_idx 부분색인과
 *    **같아야** 합니다. 한쪽만 고치면 색인을 타지 않습니다.
 */
async function readCandidates(config, now) {
  const notBefore = new Date(now - MAX_AGE_HOURS * HOUR_MS).toISOString();
  const notAfter = new Date(now - REMIND_AFTER_HOURS * HOUR_MS).toISOString();

  const query =
    '?intake_path=eq.paid' +
    '&payment_status=eq.pending' +
    '&status=eq.awaiting_payment' +
    '&payment_reminder_sent_at=is.null' +
    // 자료를 이미 지워 달라고 한 사람에게 결제를 권하지 않습니다.
    '&erasure_requested_at=is.null' +
    '&received_at=gte.' + encodeURIComponent(notBefore) +
    '&received_at=lte.' + encodeURIComponent(notAfter) +
    '&select=id,email,order_id,received_at' +
    '&order=received_at.asc' +
    // 상한에 닿았는지 알기 위해 한 건 더 받아 봅니다.
    '&limit=' + (MAX_PER_RUN + 1);

  try {
    const response = await fetch(config.restUrl + '/intake' + query, { headers: config.headers });
    if (!response.ok) {
      return {
        available: false,
        error: 'intake 후보 조회 실패 (HTTP ' + response.status + ') — ' +
          (await safeText(response)).slice(0, 200) +
          ' | payment_reminder_sent_at 컬럼이 없으면 precheck-schema.sql 「0-H」 절을 먼저 실행하십시오.',
      };
    }
    const rows = await response.json();
    const list = Array.isArray(rows) ? rows : [];
    return {
      available: true,
      rows: list.slice(0, MAX_PER_RUN),
      truncated: list.length > MAX_PER_RUN,
    };
  } catch (err) {
    return {
      available: false,
      error: 'intake 후보 조회 예외 — ' + (err && err.message ? err.message : String(err)),
    };
  }
}

/**
 * 보낸 사실을 기록합니다. **발송 성공 뒤에만** 부릅니다(위 🔴).
 * 실패하면 던집니다 — 부르는 쪽이 errors 에 실어 다음 실행이 재시도하게 합니다.
 */
async function markReminded(config, id, at) {
  const response = await fetch(
    config.restUrl + '/intake?id=eq.' + encodeURIComponent(id),
    {
      method: 'PATCH',
      headers: Object.assign({}, config.headers, { Prefer: 'return=minimal' }),
      body: JSON.stringify({ payment_reminder_sent_at: at }),
    }
  );
  if (!response.ok) {
    throw new Error('payment_reminder_sent_at PATCH HTTP ' + response.status +
      ' | ' + (await safeText(response)).slice(0, 200));
  }
}

/**
 * 결제 미완료 건에 리마인드 메일을 1회 보냅니다.
 *
 * @param {object} config  api/_supabase.js readConfig() 결과
 * @param {object} [options]
 * @param {boolean} [options.apply=false]  false 면 **보내지 않고** 후보만 셉니다
 * @param {number}  [options.now]          기준 시각(ms). 테스트가 넣습니다
 * @param {Function}[options.log]
 * @returns {Promise<{available:boolean, error?:string, truncated:boolean,
 *   candidates:number, sent:number, errors:Array}>}
 */
async function remindUnpaidIntakes(config, options) {
  const opts = options || {};
  const log = opts.log || (() => {});
  const apply = opts.apply === true;
  const now = typeof opts.now === 'number' ? opts.now : Date.now();

  const found = await readCandidates(config, now);
  if (!found.available) {
    log('결제 미완료 후보를 읽지 못했습니다 — 한 통도 보내지 않았습니다.\n   ' + found.error);
    return {
      available: false, error: found.error,
      truncated: false, candidates: 0, sent: 0, errors: [],
    };
  }

  const result = {
    available: true,
    truncated: Boolean(found.truncated),
    candidates: found.rows.length,
    sent: 0,
    errors: [],
  };

  /*
   * 상한에 닿았으면 말합니다 — 조용히 자르면 「전건 처리했다」로 읽힙니다
   * (api/_route-refund.js 의 truncated 처리와 같은 이유).
   */
  if (result.truncated) {
    log('⚠️ 후보가 상한(' + MAX_PER_RUN + '건)까지 찼습니다 — 나머지는 다음 실행이 봅니다.');
  }

  if (result.candidates === 0) {
    log('결제 미완료로 남은 건이 없습니다 (기준: 접수 후 ' + REMIND_AFTER_HOURS +
      '시간 경과 · ' + MAX_AGE_HOURS + '시간 이내 · 아직 안 보낸 건).');
    return result;
  }

  log('결제 미완료 ' + result.candidates + '건이 후보입니다.');

  for (const row of found.rows) {
    if (!apply) {
      log('[미리보기] ' + (row.order_id || '-') + ' · ' + maskEmail(row.email) +
        ' · 접수 ' + row.received_at);
      continue;
    }

    // ② 발송
    const mail = await sendPaymentReminderMail({ email: row.email });
    if (!mail.sent) {
      result.errors.push({ orderId: row.order_id, error: mail.error });
      log('발송 실패 — ' + (row.order_id || '-') + ' | ' + mail.error +
        ' | 표시하지 않았으므로 다음 실행이 다시 시도합니다.');
      continue;
    }

    // ③ 발송에 성공한 건만 표시
    try {
      await markReminded(config, row.id, new Date(now).toISOString());
      result.sent += 1;
      log('보냈습니다 — ' + (row.order_id || '-') + ' · ' + maskEmail(row.email));
    } catch (err) {
      /*
       * 메일은 이미 나갔습니다. 여기서 실패하면 다음 실행이 **한 번 더** 보낼 수
       * 있습니다 — 「1회」의 위반이라 크게 남깁니다. sent 는 올립니다(실제로 나갔으므로).
       */
      result.sent += 1;
      const message = err && err.message ? err.message : String(err);
      result.errors.push({ orderId: row.order_id, error: '발송됨 · 기록 실패: ' + message });
      log('⚠️ 메일은 나갔는데 발송 기록에 실패했습니다 — ' + (row.order_id || '-') +
        ' | ' + message + ' | 다음 실행이 같은 건에 한 번 더 보낼 수 있습니다.');
    }
  }

  if (!apply) {
    log('[미리보기] --apply 를 붙이면 위 건에 리마인드 메일을 1회 보냅니다.');
  }

  return result;
}

/**
 * 로그에 남는 주소를 가립니다. 배치 로그는 사람이 오래 들여다보는 자리라
 * 전체 주소를 그대로 적어 두지 않습니다.
 */
function maskEmail(email) {
  const value = String(email || '');
  const at = value.indexOf('@');
  if (at <= 1) return '***';
  return value.slice(0, 2) + '***' + value.slice(at);
}

module.exports = {
  remindUnpaidIntakes: remindUnpaidIntakes,
  maskEmail: maskEmail,
  REMIND_AFTER_HOURS: REMIND_AFTER_HOURS,
  MAX_AGE_HOURS: MAX_AGE_HOURS,
  MAX_PER_RUN: MAX_PER_RUN,
};
