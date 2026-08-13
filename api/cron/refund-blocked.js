/*
 * GET /api/cron/refund-blocked — 일 1회 사후 배치 3종 (Vercel Cron)
 * 〔M-2 · 신설 2026-08-11 · E5 후속 2026-08-12 병합 · S9 리마인드 2026-08-13 병합〕
 *
 * 배치 본체는 셋입니다 — 이름은 옛날 그대로지만 이제 세 가지를 함께 돌립니다:
 *   api/_route-refund.js         route(ok/blocked) 축 환불 〔M-2〕
 *   api/_nda-outcome-refund.js   outcome_kind(ok/not_supported/failed) 축 환불 〔E5〕
 *   api/_payment-reminder.js     결제 미완료 리마인드 메일 〔S9 · 흐름 md §5-1 6번〕
 *
 * 🔴 **왜 파일을 새로 안 만들고 여기 합쳤는가.** Hobby 플랜 cron 상한(2개)을
 *    cleanup-expired · 이 라우트가 이미 다 씁니다(아래 스케줄 절 참조). 세 번째
 *    배치(E5)가 생겨서 플랜을 올리는 대신 이 라우트 안에서 두 번째 잡으로
 *    돌립니다 — 이 파일이 스스로 예고했던 대로입니다(🔴 표 아래 옛 문단).
 *    2026-08-13 의 리마인드 배치도 **같은 이유로 세 번째 잡**이 됐습니다.
 *
 * 🔴 **리마인드는 환불이 아닙니다 — 그런데 왜 「refund-blocked」 라우트에 있는가.**
 *    이 라우트는 이제 이름보다 넓습니다. 이름을 바꾸지 않은 이유는 vercel.json 의
 *    crons 경로 · test/cron-registration.test.js 의 단정 · 운영 기록의 로그 접두어가
 *    모두 이 경로에 묶여 있어서입니다 — 이름 하나를 고치려고 그 넷을 함께 흔드는 것이
 *    더 위험합니다. **하는 일의 정본은 이 머리주석**이고, 이름은 역사적 유물입니다.
 *    ⚠️ 네 번째 잡을 여기 더 붙이기 전에 플랜 상향을 먼저 검토하십시오. 한 라우트가
 *       서로 무관한 일을 계속 받으면 실패 원인을 응답에서 가려내기 어려워집니다.
 *    시각도 리마인드에 나쁘지 않습니다 — 22:40 UTC = **07:40 KST**, 업무 시작 무렵입니다
 *    (cleanup-expired 쪽 06:20 KST 보다 메일 받는 시각으로 적절합니다).
 *
 * 세 잡은 **서로 독립**입니다 — 한쪽이 죽어도 다른 쪽은 돕니다
 * (api/cron/cleanup-expired.js guarded() 와 같은 양식). 판정 표가 다르고
 * (precheck_intake_route ↔ precheck_nda_run), 후보 집합도 겹칠 수 있지만
 * api/_refund.js refundOrder() 자체가 「이미 환불됨」을 멱등으로 걸러 두
 * 배치가 우연히 같은 건을 집어도 두 번 취소되지 않습니다.
 *
 * 여기는 「누가 부를 수 있는가」와 「붙어 있지 않을 때 무엇을 하는가」만 정합니다
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
 *   · 「처리 가능한가」·「과금 대상인가」를 정하지 않습니다
 *     (정본: trops_a intake-route.ts · precheck-paid-gate.ts)
 *   · 자료를 **이미 전달한 건**은 자동 환불하지 않습니다 — 환불규정 §02·§03 의
 *     판단이 필요해 사람에게 넘깁니다. 두 결과의 deferred 에 각각 실려 나옵니다.
 *   · 무상 건은 다루지 않습니다 (환불할 돈이 없습니다 — 문면은 확인 화면이 합니다)
 *
 * ── 응답 (result = route 축, ndaOutcome = outcome_kind 축, paymentReminder = S9) ──
 *   200 { ok:true,  configured:false, note }                             env 미등록 — 무동작
 *   200 { ok:true,  configured:true, result, ndaOutcome, paymentReminder } 셋 다 전건 성공(0건 포함)
 *   502 { ok:false, configured:true, result, ndaOutcome, paymentReminder } 하나라도 실패
 *   404 (본문 없음)                                                      인증 불일치 · 미설정
 *   405 { error }                                                        인증 통과 · GET 아님
 *
 *   각 결과 객체 자체는 available:false(표 없음/읽기 실패)여도 200 입니다 —
 *   「표가 없다」는 실패가 아니라는 원칙은 두 축 모두 같습니다. hardError:true 는
 *   그 결과 객체를 만드는 함수가 **던졌을 때**(예: 환불 컬럼 0-F 미실행)만 붙고,
 *   이때는 실패로 셉니다 — 「아직 안 붙었다」와 「붙었는데 부서졌다」를 가릅니다.
 */

'use strict';

const { readConfig } = require('../_supabase.js');
const ROUTE_REFUND = require('../_route-refund.js');
const OUTCOME_REFUND = require('../_nda-outcome-refund.js');
// 세 번째 잡 〔S9〕. 환불이 아니라 메일 한 통입니다 — 위 🔴 참조.
const PAYMENT_REMINDER = require('../_payment-reminder.js');

/** 다음 사람이 「이거 하나면 되는구나」로 읽지 않도록 응답에 박아 둡니다. */
const NOT_OURS =
  '처리 가능 여부·과금 대상 여부의 정본은 판정층 trops_a(lib/precheck/intake-route.ts · ' +
  'precheck_intake_route · lib/payment/precheck-paid-gate.ts · precheck_nda_run)입니다 — ' +
  '이 배치는 읽어서 환불만 실행합니다';

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

  /*
   * 한 잡이 던져도 다른 잡을 막지 않습니다(cleanup-expired.js guarded() 와 같은
   * 이유) — 두 축은 서로 다른 표를 보고, 한쪽 표가 부서졌다고 다른 쪽 환불까지
   * 멈출 이유가 없습니다. 던진 경우만 hardError:true 를 붙여 구분합니다 —
   * 함수가 정상 반환한 available:false(표 없음)와 실패 신호를 섞지 않습니다.
   */
  async function runGuarded(promise, label) {
    try {
      return await promise;
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      console.error(label + ' failed: ' + message);
      return {
        available: false, hardError: true, error: message,
        checked: 0, candidates: 0, refunded: 0, already: 0, reversed: 0,
        deferred: [], failed: [], notified: 0, errors: [],
      };
    }
  }

  const result = await runGuarded(
    ROUTE_REFUND.refundBlockedRoutes(config, {
      apply: true,          // 정기 실행입니다. 미리보기는 scripts/refund-blocked.js 몫입니다.
      log: (m) => console.log('[refund-blocked-cron] ' + m),
    }),
    'refund-blocked(route) cron'
  );

  const ndaOutcome = await runGuarded(
    OUTCOME_REFUND.refundNonChargeableOutcomes(config, {
      apply: true,          // 정기 실행입니다. 미리보기는 scripts/refund-nda-outcome.js 몫입니다.
      log: (m) => console.log('[refund-nda-outcome-cron] ' + m),
    }),
    'refund-blocked(nda-outcome) cron'
  );

  /*
   * 세 번째 잡 〔S9 · 흐름 md §5-1 6번〕. 위 둘과 성질이 다릅니다 —
   * 돈을 움직이지 않고 메일 한 통을 보냅니다. 그래서 결과 모양도 다릅니다
   * (deferred·reversed·refunded 가 없고 candidates·sent 만 있습니다).
   * ⚠️ runGuarded 의 폴백 모양을 이 잡에 맞춰 쓰지 마십시오 — 아래 별도 폴백을 씁니다.
   *    한 모양으로 억지로 합치면 「환불 0건」과 「메일 0통」이 같은 칸에 섞입니다.
   */
  let paymentReminder;
  try {
    paymentReminder = await PAYMENT_REMINDER.remindUnpaidIntakes(config, {
      apply: true,          // 정기 실행입니다. 미리보기는 scripts/payment-reminder.js 몫입니다.
      log: (m) => console.log('[payment-reminder-cron] ' + m),
    });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.error('refund-blocked(payment-reminder) cron failed: ' + message);
    paymentReminder = {
      available: false, hardError: true, error: message,
      truncated: false, candidates: 0, sent: 0, errors: [],
    };
  }

  if (!result.available) {
    console.error('refund-blocked cron route-table unavailable: ' + result.error);
  }
  if (!ndaOutcome.available) {
    console.error('refund-blocked cron nda-outcome-table unavailable: ' + ndaOutcome.error);
  }
  if (!paymentReminder.available) {
    // 컬럼이 아직 없으면 여기로 옵니다 — 「아직 안 붙었다」이지 실패가 아닙니다.
    console.error('refund-blocked cron payment-reminder unavailable: ' + paymentReminder.error);
  }

  /*
   * ok 는 「돌았다」가 아니라 「둘 다 전건 성공했다」입니다.
   *
   * ⚠️ deferred(전달 완료분)는 실패가 아닙니다 — 설계대로 사람에게 넘긴 것입니다.
   *    그것 때문에 502 를 내면 매일 빨간불이 켜지고 진짜 실패가 같은 색에 묻힙니다.
   *    hardError(표가 부서짐이 아니라 배치 자체가 던짐)만 실패로 셉니다.
   */
  const failed =
    Boolean(result.hardError) || result.failed.length > 0 || result.errors.length > 0 ||
    Boolean(ndaOutcome.hardError) || ndaOutcome.failed.length > 0 || ndaOutcome.errors.length > 0 ||
    /*
     * 리마인드 쪽은 failed 배열이 없습니다(건별 실패가 errors 한 곳에 모입니다).
     * available:false(컬럼 미생성)는 **실패로 세지 않습니다** — 위 두 축의
     * 「표가 없다」와 같은 처리입니다. hardError(함수가 던짐)만 실패입니다.
     */
    Boolean(paymentReminder.hardError) || paymentReminder.errors.length > 0;
  if (failed) {
    console.error('refund-blocked cron partial failure: ' + JSON.stringify({
      route: { hardError: result.hardError, failed: result.failed, errors: result.errors },
      ndaOutcome: { hardError: ndaOutcome.hardError, failed: ndaOutcome.failed, errors: ndaOutcome.errors },
      paymentReminder: { hardError: paymentReminder.hardError, errors: paymentReminder.errors },
    }));
  }

  res.status(failed ? 502 : 200).json({
    ok: !failed,
    configured: true,
    result: result,
    ndaOutcome: ndaOutcome,
    paymentReminder: paymentReminder,
    note: NOT_OURS,
  });
};
