#!/usr/bin/env node
/*
 * 요약 자료 전달 — 링크 메일 발송 + 전달 시각 기록.
 *
 * ⚠️ 경계 (반드시 지킬 것)
 *   이 폴더(main_web_page)는 접수·결제·삭제·알림만 담당합니다.
 *   대조도 판정도 여기서 하지 않습니다. 자료는 사람이 손으로 만들고,
 *   이 스크립트는 그 자료의 링크를 보내고 보낸 시각을 남기기만 합니다.
 *
 * ── 무엇을 남기는가 (환불규정 §02) ──────────────────────────────────────────
 *   "자료는 이메일로 보내드리는 링크를 통해 전달됩니다.
 *    링크를 보내드린 시점을 전달 시점으로 봅니다."
 *
 *   그래서 delivered_at 은 **메일 발송에 성공한 시각** 입니다.
 *   발송이 실패하면 아무 기록도 남기지 않습니다 — 보내지 않은 건이
 *   전달 완료로 남으면 이용자가 전액 환불 구간에서 밀려납니다.
 *
 * ── 왜 API route 가 아닌 스크립트인가 ───────────────────────────────────────
 *   scripts/cleanup-expired.js 와 같은 이유입니다. service_role 키가 필요하고,
 *   이 경로는 고객에게 메일을 보내고 환불 기준선을 움직입니다. 공개 주소에
 *   두면 토큰 하나가 새는 순간 임의의 링크를 우리 이름으로 고객에게 보낼 수
 *   있게 됩니다. 손으로(또는 사설 러너에서) 돌립니다.
 *
 * ── 실행 ────────────────────────────────────────────────────────────────────
 *   node --env-file=.env.local scripts/deliver.js \
 *     --token=<access_token> --url=https://... [--apply]
 *
 *   기본이 미리보기입니다. --apply 없이는 메일을 보내지 않습니다.
 *
 *   --token  접수 확인 링크(/precheck?r=…)의 그 토큰입니다.
 *            운영자 접수 알림메일에도 들어 있고, Supabase intake.access_token 에도 있습니다.
 *   --url    이용자에게 보낼 요약 자료 주소. https 만 받습니다.
 *
 *   필요한 환경변수 (api/_supabase.js · api/_notify.js 와 같습니다):
 *     INTAKE_SUPABASE_URL
 *     INTAKE_SUPABASE_SERVICE_ROLE_KEY
 *     RESEND_API_KEY
 *     PRECHECK_ORIGIN   (선택 · 기본 https://trops.kr)
 *
 * ── 거절하는 경우 ───────────────────────────────────────────────────────────
 *   이미 전달함    delivered_at 을 덮어쓰면 환불 기준선이 뒤로 밀립니다.
 *   자료 삭제됨    지운 자료를 전달할 수는 없습니다.
 *   결제 대기      결제 전에 보내면 받고 결제를 그만둘 수 있습니다.
 *   취소됨         전달할 건이 아닙니다.
 */

'use strict';

const { readConfig } = require('../api/_supabase.js');
const { deliver } = require('../api/_delivery.js');

function readArg(argv, name) {
  const prefix = '--' + name + '=';
  for (const arg of argv) {
    if (arg.indexOf(prefix) === 0) return arg.slice(prefix.length);
  }
  return '';
}

function usage() {
  console.error('사용법: node --env-file=.env.local scripts/deliver.js ' +
    '--token=<access_token> --url=https://... [--apply]');
}

async function main(argv) {
  const token = readArg(argv, 'token').trim();
  const url = readArg(argv, 'url').trim();
  const apply = argv.indexOf('--apply') !== -1;

  if (!token || !url) {
    usage();
    return 2;
  }

  const config = readConfig();
  if (!config.ok) {
    console.error('설정 오류 — ' + config.error);
    return 2;
  }

  console.log((apply ? '[전달] ' : '[미리보기] ') + config.baseUrl);

  let result;
  try {
    result = await deliver(config, {
      token: token,
      summaryUrl: url,
      apply: apply,
      now: Date.now(),
      log: (m) => console.log(m),
    });
  } catch (err) {
    console.error('전달 실패: ' + (err && err.message ? err.message : err));
    return 1;
  }

  if (!result.ok) {
    console.error('전달하지 않았습니다 (' + result.reason + ') — ' + result.message);
    // 메일은 나갔는데 기록만 실패한 경우는 사람이 반드시 손을 대야 합니다.
    // 다른 실패와 종료 코드를 갈라 둡니다.
    return result.reason === 'store-failed' ? 3 : 1;
  }

  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

module.exports = { readArg: readArg, main: main };
