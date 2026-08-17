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
/**
 * 🔴 **`paid_charge_enabled: true`** 〔정본 전환 2026-08-17 · 사본 반영 2026-08-17〕.
 *
 * 순서 ①원장 → ②정본(trops_a `PRECHECK_PAID_FLAGS`) → ③이 사본 중 ③입니다 — 새 판단이
 * 아니라 정본을 옮겨 적은 것입니다. 목적은 전환 데이터 수집 — 실제 판매가(₩330,000)로
 * 결제 흐름을 형식적으로 거치게 합니다.
 *
 * ⚠️ **이 값이 실제 과금을 열지 않습니다.** Toss 는 아직 심사 전이라 라이브 키가 없고,
 *    `readTossConfig()`(`api/_payment.js`)가 그 경우 자동으로 테스트 키로 떨어집니다 —
 *    화면에 "테스트 결제"로 표시되고 실제 돈은 오가지 않습니다. 이 플래그는 심사 통과 후
 *    라이브 키가 들어가는 순간부터 실제로 과금을 엽니다.
 */
const PRECHECK_PAID_FLAGS = {
  /** 상품 노출 — 가격·플랜 카드·결제 진입을 화면에 그리는가. */
  paid_display_enabled: true,
  /** 과금 실행 — 결제 게이트웨이를 실제로 호출하는가. */
  paid_charge_enabled: true,
};

/**
 * 법 게이트 — 정본 `LAWYER_CONFIRMATION` 사본.
 *
 * ⛔ **`true` 로 조용히 바꾸지 않습니다.** 켜려면 한국 변호사 확인 결과 + 원장 갱신이
 *    먼저이고, 그 다음이 정본(trops_a), 이 파일은 마지막입니다.
 *    여기만 바꾸면 테스트가 red 를 냅니다 — 그게 이 구조의 목적입니다.
 *
 * ── 🔴 **현재 상태 — 둘 다 확인됨** 〔정본 전환 2026-08-16 · 사본 반영 2026-08-17〕 ──
 *
 * 정본이 `trops_a@68d1d35`(「앞단 변호사 게이트 S62-44·S62-03 확인됨으로 전환」)에서
 * 대표 결정으로 두 마커를 켰고, 이 파일은 **그 결정을 옮겨 적은 것**입니다.
 * ⚠️ 새 판단이 아닙니다 — 순서 ①원장 → ②정본 → ③사본 중 ③입니다.
 *
 * ⚠️ **정식 서면이 아니라 카톡·구두 확인입니다.** 매출 발생 전 소규모 시작 단계라는
 *    이유로 대표가 비례성 있는 결정으로 판단해 진행했습니다 — **매출 발생 시점에
 *    정식 서면 검토로 재확인 예정**이며 그 트리거 기준은 아직 미정입니다(별도 결정).
 *    이 값이 `true` 인 것은 「법적으로 완전히 정리됐다」가 아니라 **「이 비례성 판단
 *    아래 유상 개시가 열렸다」**는 뜻입니다.
 *
 * ⚠️ **S62-44 는 다섯 항목(12-11·12-12·12-13·12-17·12-19)을 세분화 없이 대표합니다.**
 *    그중 **12-13(게이트① 검증방식)은 미확인 상태로 대표 판단으로 진행**했고,
 *    12-12(면책 문구 최종본)는 **간접 확인**입니다. 정식 서면 검토 시 다섯을 개별로
 *    다시 엽니다. 내역은 정본 주석이 듭니다 — 여기서 요약을 늘리지 않습니다
 *    (사본이 정본보다 길어지면 어느 쪽이 정본인지 흐려집니다).
 *
 * 🔴 **2026-08-17 — `PRECHECK_PAID_FLAGS.paid_charge_enabled` 도 `true` 로 열렸습니다**(위
 *    참조). `precheckChargeBlockers()` 는 이제 빈 배열을 돌려줍니다 — 코드 판정 기준으로는
 *    두 축(법 게이트 · 운영 플래그) 모두 열려 있습니다. 실제 과금이 나가는지는 여전히
 *    Toss 라이브 키 유무가 가릅니다(위 `PRECHECK_PAID_FLAGS` 주석).
 */
const LAWYER_CONFIRMATION = {
  /** S62-44 — 앞단 「기준 대비 차이 표시」의 자격 경계. §8-2 게이트① 명시 해제 조건. */
  S62_44: true,
  /** S62-03 — 확인 항목 문항 단위 검수. §7 원장이 전체 선행으로 건 항목. */
  S62_03: true,
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

/* ──────────────────────────────────────────────────────────────────────────────
 * 축 ② 「이 건이 불가인가」 〔M-3 · 신설 2026-08-11〕
 *
 * 위쪽(축 ①)은 **유상 판매를 개시해도 되는가**입니다 — 건별로 달라지지 않고,
 * trops_a 정본의 사본이라 값을 여기서 바꾸지 않습니다.
 * 아래(축 ②)는 **이 접수 한 건을 과금해도 되는가**입니다. 건마다 다릅니다.
 *
 * 🔴 **왜 새 게이트를 만들지 않고 여기 붙였는가.** 결제 경로에서 「막혔나」를 묻는
 *    자리가 둘이 되면, 새로 생기는 결제 경로가 한쪽만 부르고 지나갑니다.
 *    던지는 함수 하나(assertPrecheckChargeAllowed)가 두 축을 함께 보게 두면
 *    호출부는 이유를 몰라도 되고, 이유가 늘어도 호출부를 고치지 않습니다.
 *
 * ⚠️ **이것은 판정이 아닙니다.** 「불가」인지 정하는 것은 trops_a 소관이고,
 *    여기서 하는 일은 **브라우저가 신고한 기계적 사실을 차단 사유로 옮기는 것**뿐입니다.
 *    파일을 열지도, 파싱하지도, 등급을 계산하지도 않습니다.
 *
 * 🔴 **한 방향으로만 움직입니다.** 신고값은 차단 사유를 **더할** 수만 있고
 *    축 ①을 **열지는** 못합니다. 그래서 브라우저에서 고쳐 보내도 위험한 방향
 *    (막혀야 할 건이 과금되는 방향)으로는 가지 않습니다. 'absent' 를 지워 보내면
 *    축 ①이 그대로 막고 있고, 축 ①이 열린 뒤에는 「불가인데 결제됨」이 되지만
 *    그때는 아래 환불 경로(scripts/refund.js)가 받는 자리입니다.
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * 접수 단계에서 「불가」로 보는 사유.
 *
 * ⛔ 여기에 「판정으로 알 수 있는 것」을 넣지 마십시오. 기계적으로 확인되는 것만
 *    옵니다 — 지금은 하나입니다.
 *
 *   text-layer-absent  PDF 에 글자층이 없습니다(api/../precheck.html 의 감지 블록).
 *                      뒷단이 대조할 글자가 없으므로 유상으로 받지 않습니다.
 *
 * ⚠️ 'unknown' 은 사유가 아닙니다. 못 정한 것을 불가로 취급하면, 감지가 실패한
 *    모든 건의 과금이 조용히 멈춥니다.
 */
const INTAKE_INELIGIBLE_REASONS = {
  'text-layer-absent': 'PDF 에 텍스트 레이어가 없다고 신고된 건',
};

/**
 * 신고값을 차단 사유 목록으로 옮깁니다. 비어 있으면 이 건은 과금 대상입니다.
 *
 * 사유 코드에 `ineligible:` 을 붙여 축 ①의 항목(paid_charge_enabled · S62-44 …)과
 * 섞이지 않게 합니다 — 로그에서 「무엇이 막았나」가 갈려야 합니다.
 */
function intakeIneligibilityBlockers(declaration) {
  const d = declaration && typeof declaration === 'object' ? declaration : {};
  const out = [];
  if (d.pdfTextLayer === 'absent') out.push('ineligible:text-layer-absent');
  return out;
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
  constructor(blockers, kind) {
    super('앞단 과금이 막혀 있습니다 — 남은 항목: ' + blockers.join(', '));
    this.name = 'PrecheckChargeBlockedError';
    this.blockers = blockers;
    /**
     * 'launch'     유상 개시가 안 열렸습니다 — 모든 건에 걸립니다.
     * 'ineligible' 개시는 열렸고 이 건만 불가입니다.
     *
     * 🔴 이용자에게 할 말이 다릅니다. 「아직 안 열었습니다」와 「이 파일로는
     *    받지 않습니다」를 한 문장으로 합치면 둘 다 틀린 말이 됩니다.
     *    launch 가 우선입니다 — 안 열린 것이 더 앞선 사실입니다.
     */
    this.kind = kind || 'launch';
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
 *
 * 세 번째 인자가 축 ②입니다(브라우저 신고값). 넘기지 않으면 축 ①만 봅니다 —
 * 종전 호출부의 뜻이 바뀌지 않도록 뒤에 붙였습니다.
 */
function assertPrecheckChargeAllowed(flags, confirmation, declaration) {
  const launch = precheckChargeBlockers(flags, confirmation);
  const ineligible = intakeIneligibilityBlockers(declaration);
  const blockers = launch.concat(ineligible);
  if (blockers.length === 0) return;
  throw new PrecheckChargeBlockedError(blockers, launch.length > 0 ? 'launch' : 'ineligible');
}

/**
 * 라우트 공통 처리 — 막혔으면 403 을 쓰고 true 를 돌려줍니다.
 *
 * 각 라우트가 try/catch 를 따로 적으면 응답 모양이 갈라집니다.
 * 이용자에게 보이는 문장은 여기 한 곳에서만 정합니다.
 *
 * declaration 은 접수 본문의 detection 입니다(선택). 결제 승인처럼 신고값이
 * 없는 자리에서는 넘기지 않습니다 — 그 자리는 접수 때 이미 걸러진 뒤입니다.
 */
function rejectIfChargeBlocked(res, where, declaration) {
  try {
    assertPrecheckChargeAllowed(undefined, undefined, declaration);
    return false;
  } catch (err) {
    if (!(err instanceof PrecheckChargeBlockedError)) throw err;
    console.error('precheck charge blocked at ' + where + ': ' + err.blockers.join(', ') +
      ' | 사유종류=' + err.kind +
      ' | 정본=' + CANON.repo + ' ' + CANON.file + ' | 원장=' + CANON.ledger);

    if (err.kind === 'ineligible') {
      /*
       * 🔴 이 응답은 **접수 거절이 아니라 과금 거절**입니다 〔M-3〕.
       *    문장이 「무상으로 보내주시면 그대로 접수됩니다」로 끝나야 합니다 —
       *    여기서 말을 멈추면 이용자는 자기 서류를 받아주지 않는다고 읽습니다.
       *    화면은 이 문장을 그대로 씁니다(precheck.html onIneligible).
       */
      res.status(403).json({
        error: 'ineligible-not-charged',
        blockers: err.blockers,
        message: '이 파일에서는 글자를 읽을 수 없어 유상 접수로 진행하지 않습니다. 무상 실증으로 보내주시면 그대로 접수됩니다.',
      });
      return true;
    }

    res.status(403).json({
      error: 'charge-not-open',
      blockers: err.blockers,
      message: '유료 접수는 아직 열지 않았습니다. 지금은 무상 실증으로 신청해 주십시오.',
    });
    return true;
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 「이 건의 NDA 판정 결과가 과금 대상인가」〔E5 · 신설 2026-08-12〕
 *
 * ⚠️ 위 축①·②와 다른 자리에서 씁니다. 축①·②는 결제 승인 **전**
 *    (rejectIfChargeBlocked, api/intake.js)에서 묻는 것이고, 이건 결제 승인
 *    **후**에만 답이 생깁니다 — outcome_kind 는 NDA 대조 엔진이 실행된 뒤(트리거
 *    배치 자체가 payment_status='paid' 인 건만 고름 · api/_nda-outcome.js 머리주석)
 *    에야 나옵니다. 그래서 이 함수를 assertPrecheckChargeAllowed() 에 묶지
 *    않았습니다 — 묶으면 그 함수가 도는 시점엔 언제나 「아직 없음」만 보게 되어
 *    죽은 코드가 됩니다. 실제로 쓰는 자리는 api/_nda-outcome-refund.js
 *    (사후 환불 배치)뿐입니다.
 *
 * 정본은 위 CANON 과 같은 파일입니다 — trops_a lib/payment/precheck-paid-gate.ts
 * 의 isNdaOutcomeChargeable(). 값을 여기서 바꾸지 않습니다(위 CANON 규칙과 동일).
 * ────────────────────────────────────────────────────────────────────────────── */

/** 정본 isNdaOutcomeChargeable() 의 문자 그대로의 사본. 'ok' 만 과금 대상. */
function isNdaOutcomeChargeable(outcomeKind) {
  return outcomeKind === 'ok';
}

module.exports = {
  CANON: CANON,
  isNdaOutcomeChargeable: isNdaOutcomeChargeable,
  PRECHECK_PAID_FLAGS: PRECHECK_PAID_FLAGS,
  LAWYER_CONFIRMATION: LAWYER_CONFIRMATION,
  INTAKE_INELIGIBLE_REASONS: INTAKE_INELIGIBLE_REASONS,
  intakeIneligibilityBlockers: intakeIneligibilityBlockers,
  precheckChargeBlockers: precheckChargeBlockers,
  isPrecheckPaidChargeEnabled: isPrecheckPaidChargeEnabled,
  isPrecheckPaidDisplayEnabled: isPrecheckPaidDisplayEnabled,
  PrecheckChargeBlockedError: PrecheckChargeBlockedError,
  assertPrecheckChargeAllowed: assertPrecheckChargeAllowed,
  rejectIfChargeBlocked: rejectIfChargeBlocked,
};
