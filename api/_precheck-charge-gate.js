/*
 * /precheck 과금 게이트 — **실제 청구를 막는 자리** 〔R-2 · 신설 2026-08-11〕
 *
 * ⚠️ 경계: 이 폴더(main_web_page)는 접수·저장·알림·결제 처리만 담당합니다.
 *    이 파일도 판정을 하지 않습니다 — 「유상 판매를 개시해도 되는가」라는
 *    **이미 내려진 결정을 읽어서 실행을 막을 뿐**입니다.
 *
 * 파일명이 밑줄로 시작하므로 Vercel 은 이 파일을 엔드포인트로 만들지 않습니다.
 *
 * ── 🔴 왜 이 파일이 생겼는가 ────────────────────────────────────────────────
 * 실측(2026-08-11) 결과 이 저장소의 결제 플로우에는 **「팔아도 되는가」를 묻는 조건이
 * 하나도 없었습니다.** 있던 것은 전부 「입력이 올바른가 · 이미 처리됐나 · 금액이 맞나」
 * 였고, 그것들은 결제를 **바르게** 처리할 뿐 **열지 말지**를 정하지 않습니다.
 *
 * 그래서 `PRECHECK_TOSS_*` 에 실키를 넣는 순간 아무 확인 없이 실제 과금이 열리는
 * 상태였습니다. 이 파일이 그 사이에 섭니다.
 *
 * ── 정본은 여기가 아닙니다 ─────────────────────────────────────────────────
 * 결정의 정본은 **trops_a `lib/payment/precheck-paid-gate.ts`** 입니다.
 * 이 파일은 그 값을 **옮겨 적은 사본**이며, 어긋나면 test/precheck-charge-gate.test.js
 * 가 red 를 냅니다(양방향 · 옆 저장소가 있을 때만).
 *
 * 🔴 **왜 사본인가 — 직접 참조를 검토한 결과** 〔실측 2026-08-11〕
 *   ① 같은 Supabase 프로젝트를 봅니다(양쪽 다 `iyvdoqwqwyyrlwtrhxsh` · 이름만 다릅니다
 *      — 여기는 `INTAKE_SUPABASE_*`, trops_a 는 `PRECHECK_SUPABASE_*`).
 *      그러나 **게이트 값은 그 DB 에 없습니다.** trops_a 가 의도적으로 코드 상수로
 *      두었습니다 — 「env 로 옮기면 대시보드에서 조용히 켜지는 경로가 생기고,
 *      그것이 이 파일이 애초에 없애려던 것이다」(정본 머리말).
 *      DB 에 새로 넣으면 정본이 보지 않는 **10번째 사본**이 생길 뿐입니다.
 *   ② trops_a 에 이 값을 내주는 API 가 없습니다. 만들려면 남의 저장소를 고쳐야 하고,
 *      만들어도 런타임 교차 의존(그쪽이 죽으면 이쪽 결제가 멈춤)이 생깁니다.
 *   ③ 그래서 **값을 옮겨 적고 어긋남을 검출**합니다. 이 저장소가 `_payment.js` 에서
 *      토스 키 형식 규칙에 대해 이미 쓰고 있는 방식과 같습니다 —
 *      「코드를 공유하지 않고 규칙만 옮겨 적습니다」.
 *
 * ⛔ **값을 여기서 바꾸지 마십시오.** 순서는 trops_a `lib/config/cross-repo-values.ts`
 *    의 SYNC_ORDER 를 따릅니다 — ① 원장(PRD) 등재 → ② trops_a 정본 → ③ 이 사본.
 */

'use strict';

/**
 * 정본 좌표. 테스트가 이 좌표로 옆 저장소를 읽습니다.
 * 여기를 고치면 대조 대상이 바뀌므로, 정본이 옮겨갔을 때만 고칩니다.
 */
const CANON = {
  repo: 'trops_a',
  file: 'lib/payment/precheck-paid-gate.ts',
  ledger: 'PRD-62 §7 원장 · S62-44 · S62-03',
  gate: 'PRD-62 §8-2 게이트① (법)',
};

/**
 * **앞단 유상 축의 플래그 2개** — 정본 `PRECHECK_PAID_FLAGS` 사본.
 *
 * 🔴 노출과 과금이 갈려 있는 것이 설계입니다. Toss 심사는 상품이 화면에 보일 것을
 *    요구하는데, 한 값에 묶으면 심사를 맞추려고 노출을 켜는 순간 과금까지 열립니다.
 *    되돌리는 비용이 다릅니다 — 노출은 화면을 내리면 끝이고, 과금은 **이미 나간 돈**입니다.
 */
const PRECHECK_PAID_FLAGS = {
  /** 상품 노출 — 가격·플랜 카드·결제 진입을 화면에 그리는가. */
  paid_display_enabled: true,
  /** 과금 실행 — 결제 게이트웨이를 실제로 호출하는가. */
  paid_charge_enabled: false,
};

/**
 * 법 게이트 — 정본 `LAWYER_CONFIRMATION` 사본.
 *
 * ⛔ **`true` 로 조용히 바꾸지 않습니다.** 켜려면 한국 변호사 확인 결과 + 원장 갱신이
 *    먼저이고, 그 다음이 정본(trops_a), 이 파일은 마지막입니다.
 *    여기만 바꾸면 테스트가 red 를 냅니다 — 그게 이 구조의 목적입니다.
 */
const LAWYER_CONFIRMATION = {
  /** S62-44 — 앞단 「기준 대비 차이 표시」의 자격 경계. §8-2 게이트① 명시 해제 조건. */
  S62_44: false,
  /** S62-03 — 확인 항목 문항 단위 검수. §7 원장이 전체 선행으로 건 항목. */
  S62_03: false,
};

/**
 * **과금 실행을 막고 있는 항목 목록.** 비어 있으면 열립니다.
 *
 * 🔴 두 겹입니다 — 운영 플래그(`paid_charge_enabled`)와 법 게이트(S62-44 · S62-03)를
 *    **AND** 로 봅니다. 플래그 하나로 법 게이트를 우회할 수 없습니다.
 *
 * boolean 하나가 아니라 목록을 돌려주는 이유는 「왜 막혔나」에 답하기 위해서입니다.
 * 하나로 합치면 어느 것이 남았는지 화면·로그·테스트 어디서도 말할 수 없습니다.
 */
function precheckChargeBlockers(flags, confirmation) {
  const f = flags || PRECHECK_PAID_FLAGS;
  const c = confirmation || LAWYER_CONFIRMATION;

  const out = [];
  if (!f.paid_charge_enabled) out.push('paid_charge_enabled');
  if (!c.S62_44) out.push('S62-44');
  if (!c.S62_03) out.push('S62-03');
  return out;
}

/** 실제 과금을 실행할 수 있는가 — 게이트웨이 호출 직전에 묻는 값. */
function isPrecheckPaidChargeEnabled(flags, confirmation) {
  return precheckChargeBlockers(flags, confirmation).length === 0;
}

/**
 * 상품을 화면에 노출하는가 — 가격 게시·플랜 카드·결제 진입 버튼.
 * 게시는 과금이 아닙니다. 막히는 것은 과금 실행뿐입니다.
 */
function isPrecheckPaidDisplayEnabled(flags) {
  return (flags || PRECHECK_PAID_FLAGS).paid_display_enabled;
}

/** 차단 사유를 들고 다니는 오류 — 로그에서 「왜」가 사라지지 않게 합니다. */
class PrecheckChargeBlockedError extends Error {
  constructor(blockers) {
    super('앞단 과금이 막혀 있습니다 — 남은 항목: ' + blockers.join(', '));
    this.name = 'PrecheckChargeBlockedError';
    this.blockers = blockers;
    /** 라우트가 그대로 응답 코드로 씁니다. */
    this.statusCode = 403;
  }
}

/**
 * 🔴 **실제 차단점.** 결제 게이트웨이를 호출하기 **직전**에 부릅니다.
 *
 * ⚠️ **boolean 을 돌려주지 않고 던집니다.** 돌려주면 호출부가 잊거나 무시할 수 있고,
 *    실제로 이 저장소가 그 상태였습니다 — 판정할 값조차 없었습니다.
 *    던지는 함수는 「부르지 않은 것」과 「통과한 것」이 구분됩니다.
 *
 * ⛔ 노출 판정에 쓰지 않습니다 — 노출은 isPrecheckPaidDisplayEnabled() 입니다.
 */
function assertPrecheckChargeAllowed(flags, confirmation) {
  const blockers = precheckChargeBlockers(flags, confirmation);
  if (blockers.length > 0) throw new PrecheckChargeBlockedError(blockers);
}

/**
 * 라우트 공통 처리 — 막혔으면 403 을 쓰고 true 를 돌려줍니다.
 *
 * 각 라우트가 try/catch 를 따로 적으면 응답 모양이 갈라집니다.
 * 이용자에게 보이는 문장은 여기 한 곳에서만 정합니다.
 */
function rejectIfChargeBlocked(res, where) {
  try {
    assertPrecheckChargeAllowed();
    return false;
  } catch (err) {
    if (!(err instanceof PrecheckChargeBlockedError)) throw err;
    console.error('precheck charge blocked at ' + where + ': ' + err.blockers.join(', ') +
      ' | 정본=' + CANON.repo + ' ' + CANON.file + ' | 원장=' + CANON.ledger);
    res.status(403).json({
      error: 'charge-not-open',
      blockers: err.blockers,
      message: '유료 접수는 아직 열지 않았습니다. 지금은 무상 실증으로 신청해 주십시오.',
    });
    return true;
  }
}

module.exports = {
  CANON: CANON,
  PRECHECK_PAID_FLAGS: PRECHECK_PAID_FLAGS,
  LAWYER_CONFIRMATION: LAWYER_CONFIRMATION,
  precheckChargeBlockers: precheckChargeBlockers,
  isPrecheckPaidChargeEnabled: isPrecheckPaidChargeEnabled,
  isPrecheckPaidDisplayEnabled: isPrecheckPaidDisplayEnabled,
  PrecheckChargeBlockedError: PrecheckChargeBlockedError,
  assertPrecheckChargeAllowed: assertPrecheckChargeAllowed,
  rejectIfChargeBlocked: rejectIfChargeBlocked,
};
