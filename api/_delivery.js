/*
 * 요약 자료 전달 — status → 'delivered' · delivered_at 기록.
 *
 * ⚠️ 경계: 이 폴더는 접수·저장·알림만 담당합니다. 여기서도 대조하거나
 *    판정하지 않습니다. 하는 일은 "사람이 만든 자료의 링크를 보내고,
 *    보내는 데 성공했으면 그 시각을 남기기" 까지입니다.
 *
 * ── 왜 이 기록이 필요한가 (환불규정 §02) ────────────────────────────────────
 *   "자료는 이메일로 보내드리는 링크를 통해 전달됩니다.
 *    링크를 보내드린 시점을 전달 시점으로 봅니다."
 *
 *   규정은 전달 전/후로 환불을 가릅니다. 그런데 코드에는 "전달했다" 는
 *   기록이 없어 모든 접수가 영원히 received 에 머물러 있었습니다.
 *   분쟁이 나면 회사가 아무것도 제시하지 못합니다.
 *
 *   그래서 기준을 규정 문언과 글자 그대로 같은 것으로 잡습니다 —
 *   메일 발송 성공 시각. 사람이 착수한 시각도, 자료를 다 만든 시각도
 *   아닙니다. 파이프라인 내부 진행도를 기준으로 하면 규정이 가리키는
 *   시점과 어긋납니다.
 *
 * ── 순서가 뒤집혀 있습니다 (api/erasure.js 와 반대) ─────────────────────────
 *   삭제는 "지우고 나서 표시" 였습니다. 전달은 "보내고 나서 기록" 입니다.
 *   보내기 전에 기록하면, 발송이 실패한 건이 전달 완료로 남고 그 순간
 *   이용자는 전액 환불 구간에서 밀려납니다. 회사에 유리한 방향으로
 *   틀리는 것이라 더 나쁩니다.
 *
 *   반대로 "보냈는데 기록에 실패" 하면 회사에 불리한 쪽으로 틀립니다
 *   (전달했는데 기록상 전달 전 = 전액 환불). 둘 중 하나를 골라야 한다면
 *   이쪽입니다. 대신 사람이 손으로 맞출 수 있게 크게 남깁니다.
 *
 * ── 왜 API route 가 아닌가 ──────────────────────────────────────────────────
 *   scripts/cleanup-expired.js 와 같은 이유입니다. service_role 키가 필요하고,
 *   이 경로는 고객에게 메일을 보내고 환불 기준선을 움직입니다. 그런 것을
 *   공개 주소에 두면 토큰 하나가 새는 순간 임의의 링크를 고객에게 보낼 수
 *   있게 됩니다. 사람이 손으로(scripts/deliver.js) 돌립니다.
 */

'use strict';

const { safeText } = require('./_supabase.js');
const { buildMagicLink, sendDeliveryMail } = require('./_notify.js');

// 전달을 시작할 수 있는 상태. 이 밖의 상태는 이유를 붙여 거절합니다.
const DELIVERABLE = ['received', 'in_progress'];

const SELECT = 'id,email,status,delivered_at,own_form_path,received_at,' +
  'intake_path,order_id,amount,payment_status,erasure_requested_at,access_token';

/*
 * 접수한 화면의 언어 〔2026-08-17 · 영문 접수 경로〕.
 *
 * 🔴 **SELECT 에 그냥 붙이지 않습니다.** 컬럼이 아직 없는 DB 에서 이 조회가 통째로
 *    실패하면 **전달이 멈춥니다** — delivered_at 이 환불규정 §02 의 기산점이라
 *    전달이 멈추는 것은 이 파일에서 가장 나쁜 결과입니다. 그래서 붙여서 한 번,
 *    없으면 떼고 한 번 조회합니다(api/intake.js 접수 확인 조회와 같은 처리).
 * ⚠️ 떼고 조회하면 locale 을 모르므로 국문으로 나갑니다. 접수는 이미 끝났고
 *    자료도 전달됩니다 — 잃는 것은 메일 언어 하나입니다.
 */
const OPTIONAL_SELECT = ['locale'];

/* ──────────────────────────────────────────────────────────────
 * 순수 함수 — 테스트가 여기를 봅니다
 * ────────────────────────────────────────────────────────────── */

/**
 * 보낼 수 있는 건인지 판단합니다. 보내기 전에 부릅니다.
 * @returns {{ok: true} | {ok: false, reason: string, message: string}}
 */
function checkDeliverable(row) {
  if (!row) {
    return { ok: false, reason: 'not-found', message: '그 토큰으로 접수를 찾지 못했습니다.' };
  }

  // 이미 전달한 건. 다시 보내지 않습니다 — delivered_at 을 덮어쓰면
  // 환불 기준선이 뒤로 밀려 이용자가 환불 구간에서 밀려납니다.
  if (row.delivered_at) {
    return {
      ok: false,
      reason: 'already-delivered',
      message: '이미 전달한 건입니다 (' + row.delivered_at + '). ' +
        '전달 시각은 환불 기준선이라 덮어쓰지 않습니다. ' +
        '다시 보내야 한다면 메일로 직접 보내시고 이 시각은 그대로 두십시오.',
    };
  }

  // 자료를 지운 건. 지운 자료를 전달할 수는 없습니다.
  if (row.erasure_requested_at) {
    return {
      ok: false,
      reason: 'erased',
      message: '이용자가 자료 즉시 삭제를 요청한 건입니다 (' + row.erasure_requested_at + ').',
    };
  }

  // 결제가 끝나지 않은 건. 결제 전에 자료를 보내면 받고 결제를 그만둘 수 있습니다.
  if (row.status === 'awaiting_payment') {
    return {
      ok: false,
      reason: 'awaiting-payment',
      message: '결제가 끝나지 않은 건입니다. 결제 승인 후에 보내십시오.',
    };
  }

  if (DELIVERABLE.indexOf(row.status) === -1) {
    return {
      ok: false,
      reason: 'bad-status',
      message: '지금 상태(' + row.status + ')에서는 전달할 수 없습니다.',
    };
  }

  return { ok: true };
}

/**
 * 이용자에게 보낼 링크인지 확인합니다.
 *
 * https 만 받습니다. 이 주소는 고객 메일에 그대로 들어가므로,
 * 잘못 넣으면 우리 이름으로 엉뚱한 곳을 링크하게 됩니다.
 */
function checkSummaryUrl(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    return { ok: false, message: '요약 자료 주소(--url)를 넣으십시오.' };
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch (e) {
    return { ok: false, message: '주소 형식이 아닙니다: ' + value };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, message: 'https 주소만 보냅니다: ' + value };
  }

  return { ok: true, url: parsed.toString() };
}

function basename(path) {
  const parts = String(path || '').split('/');
  return parts[parts.length - 1] || '';
}

/* ──────────────────────────────────────────────────────────────
 * Supabase 접근
 * ────────────────────────────────────────────────────────────── */

async function findByToken(config, token) {
  const ask = (select) => fetch(
    config.restUrl + '/intake?access_token=eq.' + encodeURIComponent(token) + '&select=' + select,
    { headers: config.headers }
  );

  let response = await ask(SELECT + ',' + OPTIONAL_SELECT.join(','));
  if (!response.ok) {
    const text = (await safeText(response)).slice(0, 300);
    if (isUnknownColumnError(response.status, text)) {
      console.error('delivery: ' + OPTIONAL_SELECT.join(', ') +
        ' 컬럼이 없어 그 값 없이 조회했습니다 — 전달 메일이 국문으로 나갑니다. ' +
        'precheck-schema.sql 「0-K」 절을 실행하십시오.');
      response = await ask(SELECT);
    } else {
      throw new Error('HTTP ' + response.status + ' | ' + text +
        ' | delivered_at 컬럼이 없으면 precheck-schema.sql 의 "0-E. 전달 시점 컬럼" 절을 실행하십시오.');
    }
  }

  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' | ' + (await safeText(response)).slice(0, 300) +
      ' | delivered_at 컬럼이 없으면 precheck-schema.sql 의 "0-E. 전달 시점 컬럼" 절을 실행하십시오.');
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

/** 「그런 칸 없다」인가. api/intake.js 의 같은 이름 함수와 같은 판정입니다. */
function isUnknownColumnError(status, text) {
  if (status !== 400 && status !== 404) return false;
  return /PGRST204|42703|could not find|does not exist/i.test(String(text || ''));
}

/**
 * 전달 기록.
 *
 * delivered_at is null 조건을 URL 에 함께 겁니다. 두 사람이 동시에 돌려도
 * 나중 것이 앞선 전달 시각을 덮어쓰지 못하게 하기 위해서입니다.
 * 조건에 걸려 한 행도 바뀌지 않으면 그것을 실패로 봅니다.
 */
async function markDelivered(config, token, deliveredAt) {
  const response = await fetch(
    config.restUrl + '/intake' +
      '?access_token=eq.' + encodeURIComponent(token) +
      '&delivered_at=is.null',
    {
      method: 'PATCH',
      headers: Object.assign({}, config.headers, { Prefer: 'return=representation' }),
      body: JSON.stringify({ status: 'delivered', delivered_at: deliveredAt }),
    }
  );

  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' | ' + (await safeText(response)).slice(0, 300));
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('전달 시각이 기록되지 않았습니다 — 그 사이에 다른 실행이 먼저 기록했을 수 있습니다.');
  }
}

/* ──────────────────────────────────────────────────────────────
 * 전달
 * ────────────────────────────────────────────────────────────── */

/**
 * 접수 1건에 요약 자료 링크를 보내고 전달 시각을 남깁니다.
 *
 * @param config   readConfig() 결과
 * @param options  { token, summaryUrl, apply, now, log }
 * @returns {Promise<{ok: boolean, reason?: string, message?: string, deliveredAt?: string}>}
 */
async function deliver(config, options) {
  const apply = options.apply === true;
  const log = options.log || (() => {});

  const link = checkSummaryUrl(options.summaryUrl);
  if (!link.ok) return { ok: false, reason: 'bad-url', message: link.message };

  const row = await findByToken(config, options.token);
  const gate = checkDeliverable(row);
  if (!gate.ok) return gate;

  log('접수 ' + row.id + ' · ' + row.email + ' · 현재 상태 ' + row.status);
  log('보낼 링크: ' + link.url);

  if (!apply) {
    log('미리보기입니다. 실제로 보내려면 --apply 를 붙이십시오.');
    return { ok: true, applied: false, intakeId: row.id, email: row.email };
  }

  // 1) 보냅니다. 여기서 실패하면 아무 기록도 남기지 않습니다 —
  //    보내지 않은 건이 "전달 완료" 로 남는 것이 이 기능에서 가장 나쁜 결과입니다.
  const deliveredAt = new Date(options.now || Date.now()).toISOString();
  const mail = await sendDeliveryMail({
    email: row.email,
    intakeId: row.id,
    summaryUrl: link.url,
    magicLink: buildMagicLink(row.access_token),
    ownFormName: row.own_form_path ? basename(row.own_form_path) : null,
    path: row.intake_path,
    amount: row.amount,
    orderId: row.order_id,
    deliveredAt: deliveredAt,
    // 접수한 화면의 언어. 컬럼이 없거나 옛 행이면 undefined → 국문입니다.
    locale: row.locale,
  });

  if (!mail.sent) {
    return {
      ok: false,
      reason: 'mail-failed',
      message: '메일을 보내지 못했습니다. 전달로 기록하지 않았습니다. ' +
        (mail.error || ''),
    };
  }

  // 2) 기록. 메일은 이미 나갔습니다.
  //    여기서 실패하면 "보냈는데 기록상 전달 전" 이 됩니다. 회사에 불리한
  //    방향이라 이용자를 해치지는 않지만, 사람이 손으로 맞춰야 합니다.
  try {
    await markDelivered(config, options.token, deliveredAt);
  } catch (err) {
    console.error('deliver 기록 실패 (메일은 이미 발송됨 · 수동 확인 필요): id=' + row.id +
      ' | 발송 시각 ' + deliveredAt +
      ' | ' + (err && err.message ? err.message : err));
    return {
      ok: false,
      reason: 'store-failed',
      mailed: true,
      deliveredAt: deliveredAt,
      message: '메일은 보냈지만 전달 시각을 기록하지 못했습니다. ' +
        'Supabase 에서 delivered_at 을 ' + deliveredAt + ' 로, status 를 delivered 로 ' +
        '직접 맞춰 주십시오.',
    };
  }

  log('전달로 기록했습니다: ' + deliveredAt);
  return { ok: true, applied: true, intakeId: row.id, email: row.email, deliveredAt: deliveredAt };
}

module.exports = {
  DELIVERABLE: DELIVERABLE,
  checkDeliverable: checkDeliverable,
  checkSummaryUrl: checkSummaryUrl,
  findByToken: findByToken,
  markDelivered: markDelivered,
  deliver: deliver,
};
