/*
 * GET /api/cron/refund-blocked — 「범위 밖」으로 뒤집힌 유상 건 환불 (Vercel Cron)
 * 〔M-2 · 신설 2026-08-11〕
 *
 * 배치 본체는 api/_route-refund.js 입니다. 여기는 「누가 부를 수 있는가」와
 * 「붙어 있지 않을 때 무엇을 하는가」만 정합니다
 * (api/cron/cleanup-expired.js 와 같은 꼴 — 두 라우트가 같은 규칙을 씁니다).
 *
 * vercel.json 의 crons 에 등재돼 있습니다. 등재와 파일이 어긋나면
 * test/cron-registration.test.js 가 양방향으로 잡습니다.
 *
 * ── 스케줄: 40 22 * * * (UTC) = 매일 07:40 KST ──────────────────────────────
 *   vercel.json 은 JSON 이라 주석을 달 수 없어 여기 적습니다.
 *
 *   시(hour)가 겹치지 않는 자리를 골랐습니다 — Hobby 플랜은 지정한 시각의 **시
 *   안에서** 부르고 분을 보장하지 않으므로 분만 피하는 것으로는 부족합니다.
 *     trops_a  00:00 l1-notify · 00:30 l1-retention · 20:00 precheck-retention (UTC)
 *     이 저장소 21:20 cleanup-expired
 *     여기      22:40
 *
 *   ⚠️ 위 「미결」(처리 가능 여부를 채우는 trops_a cron 의 시각)은 2026-08-12 에
 *      **22:00 UTC 로 확정**됐습니다. 그래서 이 자리에 적혀 있던 「← 단독」을
 *      **뗍니다 — 22시대는 더 이상 단독이 아닙니다.**
 *
 *   🔴 **그 결과 이 스케줄은 이 주석이 스스로 「부족하다」고 적은 분 단위 회피로
 *      되돌아갔습니다.** 22:00 과 22:40 은 같은 시(hour)이므로 Hobby 에서는
 *      순서가 보장되지 않습니다. 실측(2026-08-12)으로 이쪽은 22:40 이 아니라
 *      **22:47:12 UTC** 에 돌았습니다(+7분). trops_a 가 같은 폭으로 흔들려
 *      22:50 에 돌면 순서가 뒤집힙니다.
 *
 *      ⚠️ 「어제도 오늘도 순서가 맞았다」는 관측이지 보장이 아닙니다. 이 줄을
 *         지우고 「순서 맞음」으로 적지 마십시오 — 내일 뒤집힐 수 있습니다.
 *
 *   ✅ **그래도 옮기지 않기로 했습니다** 〔2026-08-12 판단〕. 근거:
 *      ① 뒤집혀도 **틀리지 않습니다.** 「전날 판단」을 잡아 환불이 하루 늦을 뿐이고,
 *         다음 실행이 같은 행을 다시 집습니다(멱등).
 *      ② Hobby 에서는 **어느 분을 골라도 같은 시간대 안**이라 분 조정으로는
 *         해결되지 않습니다. 22시대를 피하려면 시(hour)를 옮겨야 합니다.
 *      ③ 23시대로 옮기면 08:40 KST 가 되어 실행이 더 늦어지는 방향입니다 —
 *         지연을 줄이려는 변경이 지연을 늘립니다.
 *
 *      ⛔ 순서를 **보장**해야 하는 요구가 생기면 분 조정으로 덮지 마십시오.
 *         그때는 (a) 플랜을 올려 분을 보장받거나, (b) 이 배치가 실행 시점에
 *         「처리 가능 여부가 오늘 채워졌는가」를 읽고 아니면 건너뛰게 만드는 것이
 *         맞습니다. 후자가 시각 의존을 아예 없앱니다.
 *
 *   🔴 **Hobby 플랜 cron 상한 2개를 이것으로 다 씁니다.** 세 번째 배치가
 *      필요해지면 플랜을 올리거나 두 배치를 한 라우트에 합쳐야 합니다.
 *      합칠 때는 한쪽 실패가 다른 쪽을 멈추지 않게 두십시오
 *      (cleanup-expired.js 의 guarded() 가 그 양식입니다).
 *
 * ── 🔴 기본은 닫힘 (fail-safe closed) ───────────────────────────────────────
 *   세 겹입니다. 어느 쪽이든 안 갖춰지면 **한 건도 환불하지 않습니다.**
 *
 *   ① 인증 — Authorization: Bearer <CRON_SECRET> 이 맞지 않으면 **404**.
 *      401 이 아니라 404 인 이유: 401 은 「여기 뭔가 있다」를 알려 줍니다.
 *      돈을 움직이는 경로라 존재 자체를 알리지 않습니다.
 *      CRON_SECRET 이 **비어 있어도** 404 입니다 — 미설정을 통과로 읽으면
 *      env 를 안 넣은 상태가 곧 무인증 환불 엔드포인트가 됩니다.
 *
 *   ② 설정 — INTAKE_SUPABASE_* 가 없으면 configured:false 로 **아무것도 하지
 *      않고** 200 을 돌려줍니다. 매일 500 이 나면 경보가 무뎌집니다.
 *
 *   ③ 표 — precheck_intake_route 를 못 읽으면 available:false 로 **0건**이고
 *      200 을 돌려줍니다〔2026-08-12 정정〕. 표는 판정층 trops_a 소관이고 아직
 *      없거나 만드는 중일 수 있습니다 — 그 상태는 ②(env 미등록)와 같은 「아직
 *      붙어 있지 않다」이지 「돌다가 죽었다」가 아닙니다. 매일 502 가 나면
 *      경보가 무뎌지고, 표가 실제로 생긴 뒤에 생기는 진짜 실패(개별 건 실패 ·
 *      환불 오류)가 같은 색에 묻힙니다. 「표가 없다」를 「환불할 것이 없다」로
 *      읽지 않는다는 원칙은 그대로입니다 — 0건으로 끝내되 성공으로 보고합니다.
 *
 * ── 이 라우트가 하지 않는 것 ────────────────────────────────────────────────
 *   · 「처리 가능한가」를 정하지 않습니다 (정본: trops_a intake-route)
 *   · 자료를 **이미 전달한 건**은 자동 환불하지 않습니다 — 환불규정 §02·§03 의
 *     판단이 필요해 사람에게 넘깁니다. 응답 deferred 에 실려 나옵니다.
 *   · 무상 건은 다루지 않습니다 (환불할 돈이 없습니다 — 문면은 확인 화면이 합니다)
 *
 * ── 응답 ────────────────────────────────────────────────────────────────────
 *   200 { ok:true,  configured:false, note }                    env 미등록 — 무동작
 *   200 { ok:true,  configured:true, result:{available:false} } 표 없음/읽기 실패 — 0건
 *   200 { ok:true,  configured:true, result }                   전건 성공(0건 포함)
 *   502 { ok:false, configured:true, result }                    표는 있는데 한 건이라도 실패
 *   404 (본문 없음)                                              인증 불일치 · 미설정
 *   405 { error }                                                인증 통과 · GET 아님
 */

'use strict';

const { readConfig } = require('../_supabase.js');
const ROUTE_REFUND = require('../_route-refund.js');

/** 다음 사람이 「이거 하나면 되는구나」로 읽지 않도록 응답에 박아 둡니다. */
const NOT_OURS =
  '처리 가능 여부의 정본은 판정층 trops_a(lib/precheck/intake-route.ts · ' +
  'precheck_intake_route)입니다 — 이 배치는 읽어서 환불만 실행합니다';

const NOT_CONFIGURED =
  'INTAKE_SUPABASE_URL · INTAKE_SUPABASE_SECRET_KEY 가 이 환경에 없습니다. ' +
  '돌았지만 아무것도 환불하지 않았습니다.';

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

  // ② 설정. 없으면 무동작.
  const config = readConfig();
  if (!config.ok) {
    console.error('refund-blocked cron config error: ' + config.error);
    res.status(200).json({
      ok: true,
      configured: false,
      reason: config.reason,
      note: NOT_CONFIGURED + ' | ' + NOT_OURS,
    });
    return;
  }

  let result;
  try {
    result = await ROUTE_REFUND.refundBlockedRoutes(config, {
      apply: true,          // 정기 실행입니다. 미리보기는 scripts/refund-blocked.js 몫입니다.
      log: (m) => console.log('[refund-blocked-cron] ' + m),
    });
  } catch (err) {
    // 환불 컬럼 선행 검사(0-F 미실행) 등이 여기로 옵니다 — 돈을 건드리기 전에 멈춘 상태입니다.
    const message = err && err.message ? err.message : String(err);
    console.error('refund-blocked cron failed: ' + message);
    res.status(502).json({ ok: false, configured: true, error: message, note: NOT_OURS });
    return;
  }

  /*
   * 표를 못 읽은 것은 ②(env 미등록)와 같은 「아직 붙어 있지 않다」입니다 —
   * ①②와 다른 상한을 매길 이유가 없습니다. 0건으로 200 을 돌려줍니다.
   */
  if (!result.available) {
    console.error('refund-blocked cron table unavailable: ' + result.error);
    res.status(200).json({ ok: true, configured: true, result: result, note: NOT_OURS });
    return;
  }

  /*
   * ok 는 「돌았다」가 아니라 「전건 성공했다」입니다.
   *
   * ⚠️ deferred(전달 완료분)는 실패가 아닙니다 — 설계대로 사람에게 넘긴 것입니다.
   *    그것 때문에 502 를 내면 매일 빨간불이 켜지고 진짜 실패가 같은 색에 묻힙니다.
   *    대신 사람이 봐야 하는 건이 남았다는 사실은 응답과 로그에 남습니다.
   */
  const failed = result.failed.length > 0 || result.errors.length > 0;
  if (failed) {
    console.error('refund-blocked cron partial failure: ' +
      JSON.stringify({ available: result.available, failed: result.failed, errors: result.errors }));
  }

  res.status(failed ? 502 : 200).json({
    ok: !failed,
    configured: true,
    result: result,
    note: NOT_OURS,
  });
};
