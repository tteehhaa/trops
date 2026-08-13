/*
 * /precheck 결제 화면이 필요로 하는 공개 설정.
 *
 * ⚠️ 경계: 접수·저장·알림·결제 처리만. LLM 호출·상태 판정 코드 없음.
 *
 * GET /api/payment-config
 *   → { ok, clientKey, mode, amount, orderName, chargeEnabled, displayEnabled, … }
 *
 * 🔴 **`listPrice` 를 응답에서 뺐습니다** 〔2026-08-13〕. 화면은 이 값을 한 번도 쓰지
 *    않았고(R-1 이 2026-08-11 에 취소선 표기를 걷은 뒤로), ₩290,000 은 2026-08-13 에
 *    판매가(₩300,000)보다 **낮아졌습니다** — 「정가」로 쓸 수 없는 값이 됐습니다.
 *    ⛔ 되살리지 마십시오. 응답에 실려 브라우저까지 가 있으면 「이미 내려오는 값이니
 *       그려도 되겠지」로 읽힙니다. 값 자체는 api/_payment.js 에 사본 좌표로 남아
 *       있으므로 드리프트 검출은 그대로 삽니다 — 끊은 것은 **화면으로 가는 길**입니다.
 *    ⚠️ 다시 게시하려면 그것이 결정 사안입니다(종전거래가격 표시 요건).
 *
 * clientKey 는 브라우저에 노출되는 것이 정상입니다(결제위젯이 쓰는 공개 키).
 * 시크릿 키는 이 응답에 절대 넣지 않습니다 — 승인은 서버(api/payment-confirm.js)에서만 합니다.
 *
 * 키를 HTML 에 박지 않고 여기서 내려주는 이유:
 * 실키로 바꿀 때 Vercel 환경변수만 고치면 되고, 페이지를 다시 배포하지 않아도 됩니다.
 */

// LIST_PRICE 는 **일부러 가져오지 않습니다** — 응답에 실을 값이 아닙니다(머리주석).
const { PRICE, ORDER_NAME, readTossConfig } = require('./_payment.js');
const { precheckChargeBlockers, isPrecheckPaidDisplayEnabled } = require('./_precheck-charge-gate.js');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const toss = readTossConfig();
  const blockers = precheckChargeBlockers();

  /*
   * 🔴 실키가 붙었는데 과금이 막혀 있는 상태를 로그에 남깁니다 〔R-2〕.
   *
   * 둘 다 정상인 조합입니다(심사용으로 실키를 먼저 넣어 둘 수 있습니다).
   * 다만 「실키를 넣었으니 이제 팔리겠지」라고 생각한 채 안 팔리는 상태가
   * 조용히 유지되는 것이 위험합니다 — 그 침묵을 깨는 것이 이 줄입니다.
   * 반대 방향(게이트를 열었는데 키가 테스트)은 결제가 눈에 띄게 실패하므로
   * 굳이 여기서 말하지 않습니다.
   */
  if (toss.mode === 'live' && blockers.length > 0) {
    console.error('payment gate notice: 실키(live)가 붙어 있으나 과금은 막혀 있습니다 — 남은 항목: ' +
      blockers.join(', ') + ' | 의도한 상태가 아니라면 trops_a lib/payment/precheck-paid-gate.ts 를 먼저 보십시오.');
  }

  res.status(200).json({
    ok: true,
    clientKey: toss.clientKey,
    // 'live' | 'test' | 'test-docs'
    // 화면은 live 가 아닐 때 "테스트 결제" 를 표시합니다.
    // 실키를 넣었는데 test-docs 가 내려온다면 키 형식이 틀린 것입니다(서버 로그에 원인이 남습니다).
    mode: toss.mode,
    amount: PRICE,
    // ⛔ listPrice 를 여기 되살리지 마십시오 — 이 파일 머리주석 참조.
    orderName: ORDER_NAME,

    /*
     * 과금 게이트 상태 〔R-2 · api/_precheck-charge-gate.js〕.
     *
     * 화면이 이걸 보고 유료 플랜을 잠급니다. ⚠️ **이것이 차단은 아닙니다** —
     * 실제 차단은 api/intake.js · api/payment-confirm.js 가 서버에서 합니다.
     * 브라우저 값은 고쳐질 수 있으므로, 여기 내려가는 값은 「왜 잠겼는지 사람에게
     * 설명하기 위한 것」이고 안전은 서버가 듭니다.
     *
     * display 는 따로입니다 — 가격 게시는 과금이 아니라 계속 열려 있습니다.
     */
    chargeEnabled: blockers.length === 0,
    chargeBlockers: blockers,
    displayEnabled: isPrecheckPaidDisplayEnabled(),
  });
};
