/*
 * GET /api/cron/cleanup-expired — /precheck 30일 경과분 정리 (Vercel Cron · 2026-08-11 신설)
 *
 * 배치 본체는 api/_cleanup.js 입니다. 여기는 「누가 부를 수 있는가」와
 * 「붙어 있지 않을 때 무엇을 하는가」만 정합니다.
 *
 * vercel.json 의 crons 에 등재돼 있습니다. 등재와 파일이 어긋나면
 * test/cron-registration.test.js 가 양방향으로 잡습니다.
 *
 * ── 스케줄: 20 21 * * * (UTC) = 매일 06:20 KST ──────────────────────────────
 *   vercel.json 은 JSON 이라 주석을 달 수 없어 여기 적습니다.
 *
 *   판정층 trops_a 의 cron 3개와 **시(hour)를 겹치지 않게** 골랐습니다
 *   (trops_a: 00:00 l1-notify · 00:30 l1-retention · 20:00 precheck-retention UTC).
 *   ⚠️ 분 단위로 피하는 것으로는 부족합니다 — Hobby 플랜은 지정한 **시각의 시(hour)
 *      안에서** 부르고 분을 보장하지 않습니다. 그래서 21시대를 단독으로 씁니다.
 *
 *   Hobby 플랜 제약 2개를 함께 적어 둡니다:
 *     · 프로젝트당 cron 2개까지 — 이것이 이 프로젝트의 첫 번째입니다
 *     · 하루 1회까지 — 30일 보관 배치라 하루 1회로 충분합니다
 *       (하루 밀려도 다음 실행이 같은 행을 다시 집습니다 — 멱등)
 *
 * ── 🔴 기본은 닫힘 (fail-safe closed) ───────────────────────────────────────
 *   두 겹입니다. 어느 쪽이든 안 갖춰지면 **한 건도 지우지 않습니다.**
 *
 *   ① 인증 — Authorization: Bearer <CRON_SECRET> 이 맞지 않으면 **404**.
 *      401 이 아니라 404 인 이유: 401 은 「여기 뭔가 있다」를 알려 줍니다.
 *      service_role 급 키로 삭제하는 경로라 존재 자체를 알리지 않습니다.
 *      CRON_SECRET 이 **비어 있어도** 404 입니다 — 미설정을 통과로 읽으면
 *      env 를 안 넣은 상태가 곧 무인증 삭제 엔드포인트가 됩니다.
 *      (Vercel Cron 은 CRON_SECRET 이 설정돼 있으면 이 헤더를 자동으로 붙입니다.)
 *
 *   ② 설정 — INTAKE_SUPABASE_URL · SECRET_KEY 가 없으면 configured:false 로
 *      **아무것도 하지 않고** 200 을 돌려줍니다.
 *
 *      왜 500 이 아닌가: 매일 500 이 나면 경보가 무뎌지고 진짜 실패가 같은 색으로
 *      묻힙니다. 「돌았고 붙어 있지 않았다」와 「돌다가 죽었다」를 응답으로 가릅니다.
 *      (판정층 trops_a app/api/cron/precheck-retention 과 같은 처리입니다)
 *
 * ── 두 잡을 뭉치지 않습니다 ─────────────────────────────────────────────────
 *   expired  기한 지난 접수 행 + 그 파일
 *   orphans  행 없이 남은 Storage 폴더 (업로드 중간에 실패한 접수)
 *
 *   한 숫자로 합치면 「행은 지웠는데 고아 파일이 남은」 상태가 묻힙니다.
 *   따로 부르고 따로 보고합니다. 한쪽이 죽어도 다른 쪽은 돕니다 —
 *   한 건 때문에 그날 전체가 밀리면 밀린 날들이 쌓여 30일 약속이 조용히 깨집니다.
 *
 *   ⚠️ orphans 를 cron 에 포함한 이유: 이건 CLI 에서 --orphans 로만 돌던 일이라
 *      아무도 손으로 돌리지 않으면 고아 파일이 영구히 남습니다. 삭제 판단이
 *      보수적이라(행 목록 조회 실패 → 한 건도 안 지움 · 시각 못 읽음 → 폴더 건너뜀)
 *      정기 실행에 올려도 안전합니다 — 근거는 api/_cleanup.js 머리주석.
 *
 * ── 이 라우트가 지우지 않는 것 ──────────────────────────────────────────────
 *   판정층 스키마(precheck_case 원문·span)는 trops_a 소관입니다
 *   (app/api/cron/precheck-retention). 같은 Supabase 프로젝트가 아니고,
 *   두 곳에서 지우면 어느 쪽이 지웠는지 아무도 모르게 됩니다.
 *   응답에 그 사실을 문자열로 남깁니다.
 *
 * ── 응답 ────────────────────────────────────────────────────────────────────
 *   200 { ok:true,  configured:false, note }           env 미등록 — 무동작
 *   200 { ok:true,  configured:true, expired, orphans } 전건 성공
 *   502 { ok:false, configured:true, expired, orphans } 부분 실패 (ok 는 「전건 성공」입니다)
 *   404 (본문 없음)                                     인증 불일치 · CRON_SECRET 미설정
 *   405 { error }                                       인증은 통과했고 메서드가 GET 이 아님
 */

'use strict';

const { readConfig } = require('../_supabase.js');
const CLEANUP = require('../_cleanup.js');

/** 다음 사람이 「이거 하나면 되는구나」로 읽지 않도록 응답에 박아 둡니다. */
const NOT_OURS =
  'precheck_case 원문·span 은 trops_a app/api/cron/precheck-retention 소관 — ' +
  '두 배치를 다 돌려야 30일 약속이 지켜집니다';

const NOT_CONFIGURED =
  'INTAKE_SUPABASE_URL · INTAKE_SUPABASE_SECRET_KEY 가 이 환경에 없습니다. ' +
  '돌았지만 아무것도 지우지 않았습니다.';

/** 한 잡이 죽어도 나머지를 돌립니다. 실패는 삼키지 않고 error 로 실어 보냅니다. */
function guarded(promise) {
  return promise.catch((err) => ({
    error: err && err.message ? err.message : String(err),
  }));
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  // ① 인증. 메서드 검사보다 앞입니다 — 405 를 먼저 주면 경로의 존재가 드러납니다.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers && req.headers.authorization;
  if (!secret || auth !== 'Bearer ' + secret) {
    res.status(404).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  // ② 설정. 없으면 무동작 — 500 을 매일 뱉지 않습니다.
  const config = readConfig();
  if (!config.ok) {
    console.error('cleanup cron config error: ' + config.error);
    res.status(200).json({
      ok: true,
      configured: false,
      reason: config.reason,
      note: NOT_CONFIGURED + ' | ' + NOT_OURS,
    });
    return;
  }

  const options = {
    apply: true,          // 정기 실행입니다. 미리보기는 scripts/cleanup-expired.js 몫입니다.
    now: Date.now(),
    log: (m) => console.log('[cleanup-cron] ' + m),
  };

  const expired = await guarded(CLEANUP.cleanupExpired(config, options));
  const orphans = await guarded(CLEANUP.cleanupOrphans(config, options));

  const failed = Boolean(expired.error) || Boolean(orphans.error);
  if (failed) {
    console.error('cleanup cron partial failure: ' +
      JSON.stringify({ expired: expired.error, orphans: orphans.error }));
  }

  res.status(failed ? 502 : 200).json({
    // ok 는 「돌았다」가 아니라 「전건 성공했다」입니다 — 부분 실패를 초록으로 적지 않습니다.
    ok: !failed,
    configured: true,
    expired: expired,
    orphans: orphans,
    note: NOT_OURS,
  });
};
