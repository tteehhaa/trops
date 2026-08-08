/*
 * /precheck 선착 무상 실증 슬롯 카운터 (한도 20건)
 *
 * ⚠️ 경계: 이 폴더(main_web_page)는 접수·저장·알림만 담당합니다.
 *    LLM 호출·상태 판정 코드를 두지 않습니다. (판정층은 trops_a 에 분리되어 있습니다.)
 *
 * GET /api/slots
 *   → { ok, limit, used, remaining, open }
 *
 * 카운터를 읽지 못하면 open:false 로 접수를 닫습니다.
 * "선착 20건" 은 카운터가 살아 있을 때만 지킬 수 있는 약속이라,
 * 설정 오류·장애 상태에서 접수를 열어두면 약속을 어기게 됩니다. (fail-safe closed)
 *
 * 환경변수·스키마 안내는 api/_supabase.js 와 저장소 루트 precheck-schema.sql 을 보십시오.
 */

const { readConfig, safeText } = require('./_supabase.js');

const SLOT_ROW_ID = 1;

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const state = await readSlots();

  // 잔여 수량은 접수 화면이 매번 새로 읽어야 합니다.
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(state);
};

// 슬롯 상태를 읽어 요약합니다.
// 실제 점유는 여기서 하지 않습니다 — 읽기와 점유 사이의 경합을 막기 위해
// 점유는 api/intake.js 가 claim_slot() 함수 한 번으로 원자적으로 처리합니다.
async function readSlots() {
  const config = readConfig();
  if (!config.ok) {
    console.error('slots config error: ' + config.error);
    return closed(config.reason);
  }

  try {
    const response = await fetch(
      config.restUrl + '/slots?id=eq.' + SLOT_ROW_ID + '&select=slot_limit,used',
      { headers: config.headers }
    );

    if (!response.ok) {
      console.error('slots supabase error: HTTP ' + response.status +
        ' | 응답: ' + (await safeText(response)).slice(0, 300) +
        ' | 테이블이 없으면 precheck-schema.sql 을 먼저 실행하십시오.');
      return closed('supabase-http-' + response.status);
    }

    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      console.error('slots row missing: slots 테이블에 id=' + SLOT_ROW_ID + ' 행이 없습니다. ' +
        'precheck-schema.sql 의 insert 문을 실행하십시오.');
      return closed('slot-row-missing');
    }

    return summarize(row.slot_limit, row.used);
  } catch (err) {
    console.error('slots request failed:', err && err.message ? err.message : err);
    return closed('request-failed');
  }
}

function summarize(rawLimit, rawUsed) {
  const limit = Math.max(0, Number(rawLimit) || 0);
  const used = Math.min(limit, Math.max(0, Number(rawUsed) || 0));
  const remaining = limit - used;
  return { ok: true, limit: limit, used: used, remaining: remaining, open: remaining > 0 };
}

// 카운터를 신뢰할 수 없을 때의 상태. 접수를 닫고 원인을 함께 돌려줍니다.
function closed(reason) {
  return { ok: false, limit: null, used: null, remaining: null, open: false, reason: reason };
}
