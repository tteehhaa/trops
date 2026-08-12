#!/usr/bin/env node
/*
 * NDA 대조 결과가 과금 대상이 아닌 유상 건 환불 — CLI 진입점 〔E5 · 신설 2026-08-12〕
 *
 * 배치 본체는 api/_nda-outcome-refund.js 입니다. 여기는 실행 껍데기입니다
 * (인자 해석 · 설정 확인 · 콘솔 출력 · 종료코드) — scripts/refund-blocked.js 와 같은 꼴.
 *
 * ── ⛔ 이 스크립트를 없애지 마십시오 ────────────────────────────────────────
 *   정기 실행은 api/cron/refund-blocked.js(Vercel Cron — route 축과 이 축을
 *   같은 라우트에서 함께 돕니다·Hobby cron 상한 때문)가 합니다. 그래도 이것이
 *   남는 이유는 라우트가 할 수 없는 일이 둘 있기 때문입니다:
 *
 *     미리보기   --apply 없이 「오늘 무엇이 환불될 예정인가」만 봅니다.
 *                🔴 **돈을 움직이는 배치입니다.** 처음 붙일 때·표 모양이 바뀐 뒤에는
 *                반드시 이것으로 먼저 보십시오.
 *     수동 복구   cron 이 밀렸을 때 · 한 번 더 돌려야 할 때.
 *
 * ── 실행 ────────────────────────────────────────────────────────────────────
 *   node --env-file=.env.local scripts/refund-nda-outcome.js              미리보기(기본)
 *   node --env-file=.env.local scripts/refund-nda-outcome.js --apply      실제 환불
 *
 *   package.json 에 감싼 것도 있습니다:
 *     npm run refund:nda-outcome:preview
 *     npm run refund:nda-outcome:apply
 *
 * ── 이것과 scripts/refund-blocked.js 의 차이 ────────────────────────────────
 *   refund-blocked.js       판정층이 precheck_intake_route 에 route='blocked' 로
 *                           적은 건을 찾아서 환불합니다.
 *   refund-nda-outcome.js   판정층이 precheck_nda_run 에 outcome_kind 를
 *                           'not_supported'·'failed' 로 적은 건을 찾아서 환불합니다.
 *   두 표는 서로 다른 독립 축입니다(api/_nda-outcome.js 머리주석).
 *
 *   자료를 이미 전달한 건은 이 배치가 건드리지 않고 목록으로만 알립니다.
 *   그 건들은 환불규정 §03 해당 여부를 사람이 판단해 refund.js 로 처리하십시오.
 *
 * ── 선행 ────────────────────────────────────────────────────────────────────
 *   precheck-schema.sql 의 「0-F. 환불 기록 컬럼」 절을 먼저 실행해야 합니다.
 *   실행하지 않았으면 **돈을 건드리기 전에** 멈추고 그렇게 말합니다.
 *
 *   precheck_nda_run 표(판정층 trops_a 소관 · PR9/PR10)가 없으면 0건으로
 *   끝냅니다 — 오류가 아니라 「아직 판정이 없다」입니다.
 *
 *   필요한 환경변수: INTAKE_SUPABASE_* · PRECHECK_TOSS_SECRET_KEY · RESEND_API_KEY
 *   ⚠️ 테스트 키로 돌리면 실결제 건은 취소되지 않습니다(다른 상점이라 주문을 못 찾습니다).
 */

'use strict';

const { readConfig } = require('../api/_supabase.js');
const OUTCOME_REFUND = require('../api/_nda-outcome-refund.js');

async function main(argv) {
  const apply = argv.indexOf('--apply') !== -1;

  const config = readConfig();
  if (!config.ok) {
    console.error('설정 오류 — ' + config.error);
    return 2;
  }

  console.log((apply ? '[환불] ' : '[미리보기] ') + config.baseUrl);

  let result;
  try {
    result = await OUTCOME_REFUND.refundNonChargeableOutcomes(config, {
      apply: apply,
      log: (m) => console.log(m),
    });
  } catch (err) {
    console.error('환불 실패: ' + (err && err.message ? err.message : err));
    return 1;
  }

  console.log(
    '요약 — 확인 ' + result.checked + '건 · 후보 ' + result.candidates +
    '건 · 환불 ' + result.refunded + '건 · 이미환불 ' + result.already +
    '건 · 되돌려짐 ' + result.reversed + '건 · 사람몫 ' + result.deferred.length +
    '건 · 실패 ' + result.failed.length + '건'
  );

  // 표를 못 읽은 것은 「환불할 것이 없다」가 아닙니다 — 성공으로 끝내지 않습니다.
  if (!result.available) return 1;
  if (result.failed.length > 0 || result.errors.length > 0) return 1;
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

/* 배치 본체를 다시 내보냅니다 — scripts/refund-blocked.js 와 같은 이유입니다. */
module.exports = {
  refundNonChargeableOutcomes: OUTCOME_REFUND.refundNonChargeableOutcomes,
  refundReasonText: OUTCOME_REFUND.refundReasonText,
  main: main,
};
