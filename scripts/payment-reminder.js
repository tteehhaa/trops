#!/usr/bin/env node
/*
 * 결제 미완료 리마인드 — CLI 진입점 〔S9 · 흐름 md §3 · §5-1 6번 · 신설 2026-08-13〕
 *
 * 배치 본체는 api/_payment-reminder.js 입니다. 여기는 실행 껍데기입니다
 * (인자 해석 · 설정 확인 · 콘솔 출력 · 종료코드) — scripts/refund-blocked.js 와 같은 꼴.
 *
 * ── ⛔ 이 스크립트를 없애지 마십시오 ────────────────────────────────────────
 *   정기 실행은 api/cron/refund-blocked.js 안의 세 번째 잡이 합니다. 그래도 이것이
 *   남는 이유는 라우트가 할 수 없는 일이 둘 있기 때문입니다:
 *
 *     미리보기   --apply 없이 「지금 누구에게 갈 예정인가」만 셉니다.
 *                🔴 **처음 켤 때 반드시 이것으로 먼저 보십시오.**
 *                payment_reminder_sent_at 컬럼이 새로 붙는 순간 기존
 *                awaiting_payment 잔행 전부가 후보 조건 ④를 만족합니다. 본체가
 *                MAX_AGE_HOURS(72h) 상한으로 막고 있지만, 그 상한이 실제로 몇 건을
 *                남기는지는 세어 보고 켜는 것이 맞습니다.
 *     수동 복구   cron 이 밀렸을 때 · 발송 기록 실패분을 확인할 때.
 *
 * ── 실행 ────────────────────────────────────────────────────────────────────
 *   node --env-file=.env.local scripts/payment-reminder.js            미리보기(기본)
 *   node --env-file=.env.local scripts/payment-reminder.js --apply    실제 발송
 *
 *   package.json 에 감싼 것도 있습니다(.env.local 을 자동으로 물립니다):
 *     npm run remind:preview
 *     npm run remind:apply
 *
 * ── 선행 ────────────────────────────────────────────────────────────────────
 *   precheck-schema.sql 의 「0-H」 절을 먼저 실행해야 합니다.
 *   실행하지 않았으면 후보 조회가 실패하고 **한 통도 보내지 않고** 그렇게 말합니다.
 *
 *   필요한 환경변수: INTAKE_SUPABASE_* · RESEND_API_KEY
 *   ⚠️ --apply 는 **실제 고객에게 메일을 보냅니다.** 미리보기로 대상을 먼저 확인하십시오.
 */

'use strict';

const { readConfig } = require('../api/_supabase.js');
const REMINDER = require('../api/_payment-reminder.js');

async function main(argv) {
  const apply = argv.indexOf('--apply') !== -1;

  const config = readConfig();
  if (!config.ok) {
    console.error('설정 오류 — ' + config.error);
    return 2;
  }

  console.log((apply ? '[발송] ' : '[미리보기] ') + config.baseUrl);
  console.log(
    '기준 — 접수 후 ' + REMINDER.REMIND_AFTER_HOURS + '시간 경과 · ' +
    REMINDER.MAX_AGE_HOURS + '시간 이내 · 아직 안 보낸 건 · 한 번에 최대 ' +
    REMINDER.MAX_PER_RUN + '건'
  );

  let result;
  try {
    result = await REMINDER.remindUnpaidIntakes(config, {
      apply: apply,
      log: (m) => console.log(m),
    });
  } catch (err) {
    console.error('리마인드 실패: ' + (err && err.message ? err.message : err));
    return 1;
  }

  console.log(
    '요약 — 후보 ' + result.candidates + '건 · 발송 ' + result.sent +
    '건 · 실패 ' + result.errors.length + '건'
  );

  // 후보를 못 읽은 것은 「보낼 것이 없다」가 아닙니다 — 성공으로 끝내지 않습니다.
  if (!result.available) return 1;
  if (result.errors.length > 0) return 1;
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

/* 배치 본체를 다시 내보냅니다 — scripts/refund-blocked.js 와 같은 이유입니다
   (test/cron-registration.test.js 가 CLI 와 cron 이 같은 본체를 보는지 단정합니다). */
module.exports = {
  remindUnpaidIntakes: REMINDER.remindUnpaidIntakes,
  main: main,
};
