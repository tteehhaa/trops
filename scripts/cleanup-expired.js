#!/usr/bin/env node
/*
 * /precheck 30일 경과분 정리 배치 — CLI 진입점.
 *
 * 배치 본체는 api/_cleanup.js 입니다. 여기는 실행 껍데기입니다
 * (인자 해석 · 설정 확인 · 콘솔 출력 · 종료코드).
 *
 * ── ⛔ 이 스크립트를 없애지 마십시오 ────────────────────────────────────────
 *   2026-08-11 부터 정기 실행은 api/cron/cleanup-expired.js(Vercel Cron)가 합니다.
 *   그래도 이 스크립트가 남는 이유는 라우트가 할 수 없는 일이 둘 있기 때문입니다:
 *
 *     미리보기   --apply 없이 「오늘 무엇이 지워질 예정인가」만 봅니다.
 *                라우트는 정기 실행이라 항상 --apply 상당으로 돕니다.
 *     수동 복구   cron 이 며칠 밀렸을 때 · 한 번 더 돌려야 할 때.
 *
 *   지우면 「지금 뭐가 지워질 예정인가」를 실제로 지우지 않고 볼 수단이 사라집니다.
 *
 * ── 왜 라우트를 열게 됐는가 ─────────────────────────────────────────────────
 *   전에 이 자리에는 「API route 가 아닌 이유」가 적혀 있었습니다 —
 *   "삭제는 service_role 키가 필요하고, 그 키를 쥔 경로를 공개 주소에 두면
 *    토큰 하나가 새는 순간 전체 삭제가 가능해진다. 키 회전이 끝나기 전까지는
 *    공개 표면을 늘리지 않는다. Vercel Cron 으로 옮기는 판단은 키 회전 후에 다시 한다."
 *
 *   그 조건이 충족됐습니다:
 *     · 키 회전 완료 — INTAKE_SUPABASE_SECRET_KEY(신규 sb_secret_… 체계)로 이행됨.
 *       api/_supabase-keys.js 가 이름·값 체계 불일치를 신호로 잡습니다.
 *     · 공개 표면 — 라우트는 CRON_SECRET 불일치를 **404** 로 답합니다.
 *       존재 자체를 알리지 않으므로 노출면이 실질적으로 늘지 않습니다.
 *       판정층 trops_a 가 같은 패턴으로 3개 cron 라우트를 이미 운영합니다.
 *     · 안 열어 두면 생기는 손해 — 사람이 손으로 돌리지 않는 날은 30일 약속이
 *       그냥 깨집니다. 이용자에게 한 약속(환불규정·개인정보처리방침 「30일 보관」)이라
 *       실행을 사람의 기억에 매달아 두는 것이 더 큰 위험입니다.
 *
 * ── 실행 ────────────────────────────────────────────────────────────────────
 *   node --env-file=.env.local scripts/cleanup-expired.js              미리보기(기본)
 *   node --env-file=.env.local scripts/cleanup-expired.js --apply      실제 삭제
 *   node --env-file=.env.local scripts/cleanup-expired.js --apply --orphans
 *                                                                     고아 파일까지
 *
 *   기본이 미리보기입니다. --apply 없이는 아무것도 지우지 않습니다.
 *   (package.json 의 cleanup:preview · cleanup:apply 가 앞 둘을 감싸 둡니다)
 *
 *   필요한 환경변수 · 무엇을 어떤 순서로 지우는가 · 고아 파일 처리는
 *   전부 api/_cleanup.js 머리주석에 있습니다.
 */

'use strict';

const { readConfig } = require('../api/_supabase.js');
const CLEANUP = require('../api/_cleanup.js');

async function main(argv) {
  const apply = argv.indexOf('--apply') !== -1;
  const orphans = argv.indexOf('--orphans') !== -1;

  const config = readConfig();
  if (!config.ok) {
    console.error('설정 오류 — ' + config.error);
    return 2;
  }

  const options = { apply: apply, orphans: orphans, now: Date.now(), log: (m) => console.log(m) };

  console.log((apply ? '[삭제] ' : '[미리보기] ') + config.baseUrl);

  try {
    await CLEANUP.cleanupExpired(config, options);
    if (orphans) await CLEANUP.cleanupOrphans(config, options);
  } catch (err) {
    console.error('정리 실패: ' + (err && err.message ? err.message : err));
    return 1;
  }

  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

/*
 * 배치 본체를 다시 내보냅니다.
 *
 * test/cleanup-expired.test.js 가 이 경로를 봅니다. 옮긴 것은 코드가 사는 곳이지
 * 무엇을 하는지가 아니므로, 테스트가 따라 움직여야 할 이유가 없습니다.
 */
module.exports = {
  BUCKET: CLEANUP.BUCKET,
  RETENTION_DAYS: CLEANUP.RETENTION_DAYS,
  DELETE_CHUNK: CLEANUP.DELETE_CHUNK,
  summarize: CLEANUP.summarize,
  chunk: CLEANUP.chunk,
  isOrphanExpired: CLEANUP.isOrphanExpired,
  cleanupExpired: CLEANUP.cleanupExpired,
  cleanupOrphans: CLEANUP.cleanupOrphans,
  main: main,
};
