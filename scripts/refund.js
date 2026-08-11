#!/usr/bin/env node
/*
 * /precheck 환불 — CLI 진입점 〔M-3 · 신설 2026-08-11〕
 *
 * 본체는 api/_refund.js 입니다. 여기는 실행 껍데기입니다
 * (인자 해석 · 설정 확인 · 콘솔 출력 · 종료코드) — scripts/cleanup-expired.js 와 같은 꼴.
 *
 * ── 이것이 환불 트리거입니다 ────────────────────────────────────────────────
 *   접수 뒤에 판별이 「불가」로 뒤집힌 건을 환불하는 자리입니다.
 *   **판단은 사람이 하고 실행은 이 스크립트가 합니다** — 왜 자동이 아닌지는
 *   api/_refund.js 머리주석에 있습니다(요지: 「뒤집혔다」를 알려 주는 인터페이스가
 *   trops_a 와 아직 없고, 없는 것을 이 저장소가 스스로 정하면 경계 위반입니다).
 *
 * ── 실행 ────────────────────────────────────────────────────────────────────
 *   node --env-file=.env.local scripts/refund.js <orderId> --reason "판별 불가"
 *   node --env-file=.env.local scripts/refund.js <orderId> --reason "판별 불가" --apply
 *
 *   --apply 없이는 아무것도 취소하지 않습니다. 무엇을 취소할지만 보여 줍니다.
 *
 *   package.json 에 감싼 것도 있습니다(.env.local 을 자동으로 물립니다):
 *     npm run refund:preview -- <orderId> --reason "판별 불가"
 *     npm run refund:apply   -- <orderId> --reason "판별 불가"
 *
 * ── 선행 ────────────────────────────────────────────────────────────────────
 *   precheck-schema.sql 의 「0-F. 환불 기록 컬럼」 절을 먼저 실행해야 합니다.
 *   실행하지 않았으면 이 스크립트가 **돈을 건드리기 전에** 멈추고 그렇게 말합니다.
 *
 *   필요한 환경변수: INTAKE_SUPABASE_* · PRECHECK_TOSS_SECRET_KEY
 *   ⚠️ 테스트 키로 돌리면 실결제 건은 취소되지 않습니다(다른 상점이라 주문을 못 찾습니다).
 */

'use strict';

const { readConfig } = require('../api/_supabase.js');
const REFUND = require('../api/_refund.js');

function usage() {
  console.error('사용법: node --env-file=.env.local scripts/refund.js <orderId> --reason "사유" [--apply]');
  console.error('  예:   node --env-file=.env.local scripts/refund.js precheck_ab12… --reason "판별 불가 — 대조 불가로 확인" --apply');
}

/**
 * 인자를 한 번 훑어 나눕니다.
 *
 * `--reason` 다음 낱말은 사유이므로 주문번호 후보에서 빼야 합니다.
 * 위치를 세어 가며 훑는 것이 filter+indexOf 보다 짧고, 같은 낱말이 두 번
 * 나올 때도 어긋나지 않습니다.
 */
function parseArgs(argv) {
  let apply = false;
  let reason = '';
  let orderId = '';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') { apply = true; continue; }
    if (arg === '--reason') {
      const value = argv[i + 1];
      reason = typeof value === 'string' ? value.trim() : '';
      i += 1;
      continue;
    }
    if (arg.indexOf('--') === 0) continue;
    if (!orderId) orderId = arg;
  }

  return { apply: apply, reason: reason, orderId: orderId };
}

async function main(argv) {
  const args = parseArgs(argv);
  const apply = args.apply;
  const orderId = args.orderId;
  const reason = args.reason;

  if (!orderId) {
    usage();
    return 2;
  }
  /*
   * 사유를 요구합니다. 빈 사유를 허용하면 나중에 「왜 돌려줬는지」를 아무도 모르고,
   * 그것이 이 스크립트를 만든 이유(돈과 기록을 함께 남긴다)를 반쯤 무너뜨립니다.
   */
  if (!reason) {
    console.error('--reason 이 필요합니다. 환불 사유가 refund_reason 에 그대로 남습니다.');
    usage();
    return 2;
  }

  const config = readConfig();
  if (!config.ok) {
    console.error('설정 오류 — ' + config.error);
    return 2;
  }

  console.log((apply ? '[환불] ' : '[미리보기] ') + config.baseUrl);

  let result;
  try {
    result = await REFUND.refundOrder(config, {
      orderId: orderId,
      reason: reason,
      apply: apply,
      log: (m) => console.log(m),
    });
  } catch (err) {
    console.error('환불 실패: ' + (err && err.message ? err.message : err));
    return 1;
  }

  // 'store-failed' 는 돈이 나간 뒤의 실패라 성공으로 끝내지 않습니다.
  if (result.outcome === 'store-failed' || result.outcome === 'cancel-failed') return 1;
  if (result.outcome === 'not-found') return 1;
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

module.exports = { main: main, parseArgs: parseArgs };
