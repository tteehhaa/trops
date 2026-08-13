/*
 * /precheck 결제 설정 · 토스페이먼츠 승인 헬퍼.
 *
 * ⚠️ 경계: 이 폴더(main_web_page)는 접수·저장·알림·결제 처리만 담당합니다.
 *    LLM 호출·상태 판정 코드를 두지 않습니다. 결제는 "얼마를 받았는가"만 다루고
 *    서비스 판정과는 무관합니다. (판정층은 trops_a 에 분리되어 있습니다.)
 *
 * 파일명이 밑줄로 시작하므로 Vercel 은 이 파일을 엔드포인트로 만들지 않습니다.
 *
 * ── 키 (앞단 전용) ──────────────────────────────────────────────────────────
 *   PRECHECK_TOSS_CLIENT_KEY    결제위젯 클라이언트 키 (test_gck_… / live_gck_…)
 *   PRECHECK_TOSS_SECRET_KEY    결제위젯 시크릿 키    (test_gsk_… / live_gsk_…)
 *
 * 뒷단(trops_a)은 NEXT_PUBLIC_TOSS_CLIENT_KEY / TOSS_SECRET_KEY 를 씁니다.
 * 이름을 일부러 다르게 둡니다 — 별개의 Vercel 프로젝트라 값이 섞이지는 않지만,
 * 같은 이름을 쓰면 한쪽을 바꿀 때 다른 쪽도 바꿔야 하는 줄 착각하게 됩니다.
 * (같은 상점의 키를 양쪽에 넣을 수는 있습니다. 다만 연동 방식이 달라
 *  뒷단은 ck/sk 계열, 여기는 결제위젯이라 gck/gsk 계열이 필요합니다.)
 *
 * 키를 넣지 않으면 토스 공식 문서에 공개된 테스트 키로 동작합니다.
 * 실제 돈이 오가지 않으며, 화면에 "테스트 결제" 로 표시됩니다.
 * ────────────────────────────────────────────────────────────────────────────
 */

/*
 * ⛔ **폐기된 정가.** 〔2026-08-13 정리 · 이름을 「정가」로 부르지 마십시오〕
 *
 * ── 두 번에 걸쳐 쓸 수 없는 값이 됐습니다 ──────────────────────────────────
 * ① 2026-08-11 〔R-1〕 **표시 폐기.** precheck.html 의 플랜 카드·결제 요약에 취소선으로
 *    붙어 있었는데, ₩290,000 은 **실제 판매 이력이 없어** 「종전거래가격」 표시 요건을
 *    채우지 못합니다. 취소선은 「그 값에 팔았다」는 진술이라 걸 수 없습니다.
 * ② 2026-08-13 〔흐름 md §4〕 **값 자체 폐기.** 판매가가 ₩300,000 이 되면서 이 값이
 *    판매가보다 **낮아졌습니다**(290,000 < 300,000). 게시하면 앵커가 아니라 **역앵커**가
 *    됩니다 — 「원래 더 싸게 팔았다」로 읽히는 숫자입니다.
 *
 * ── 그래서 지금 이 상수의 역할은 하나뿐입니다 ─────────────────────────────
 * **사본 좌표.** trops_a 정본(`lib/payment/precheck-paid-gate.ts` `PRECHECK_PRICE.listKrw`)과
 * 대조되는 짝이라, 지우면 대장(`lib/config/cross-repo-values.ts`)이 가리키는 좌표가
 * 사라지고 드리프트 검출이 **조용히** 죽습니다. 그래서 값은 남기고 **길을 끊었습니다**:
 *
 *   · `api/payment-config.js` 가 더 이상 `listPrice` 로 내려보내지 않습니다(2026-08-13)
 *   · 어느 페이지에도 문자열이 없습니다 — `verify-deployment.js` 「R1-비교표기」가
 *     8페이지에서 「정가」·「런칭가」·290,000 을 0건으로 단정합니다
 *   · `test/price-exposure.test.js` 가 응답에 다시 실리지 않았는지 봅니다
 *
 * ⛔ 화면·응답 어디로도 되살리지 마십시오. 되살리려면 그것이 결정 사안입니다
 *    (판매 이력이 없는 값을 종전가로 표시하는 문제가 먼저 해소돼야 합니다).
 * ⚠️ 값을 **바꾸지도** 마십시오. 290,000 은 이제 이력이고, 판매가를 따라 올리면
 *    「팔지 않은 값을 팔았다고 적는」 형태가 그대로 돌아옵니다.
 */
const LIST_PRICE = 290000;
/*
 * 판매가 — **실제 결제 금액**. 서버가 가진 이 값만 신뢰합니다(클라이언트 전달값 신뢰 금지).
 *
 * 🔴 **₩99,000 → ₩300,000** 〔2026-08-13 · 흐름 md §4 · 1차 테스트가〕.
 *    md 근거: 「셀프서브는 지금부터 ₩300,000(VAT별도)을 쓴다」 + 「99,000원 헤드라인 폐기
 *    확정 — legal-adjacent 카테고리에서 저가는 신뢰저하 리스크가 더 크다」.
 *    영구 확정가가 아니라 **첫 전환 데이터를 만들기 위한 시작가**입니다.
 *
 * ⚠️ 정본은 여기가 아닙니다 — trops_a `lib/payment/precheck-paid-gate.ts`
 *    `PRECHECK_PRICE.launchKrw` 입니다. 고치는 순서는 ① 원장(cross-repo-values.ts)
 *    ② trops_a 정본 ③ 이 사본 ④ precheck.html 표시 ⑤ verify-deployment 기대값 입니다.
 *    `test/precheck-charge-gate.test.js` 「정가·런칭가가 정본과 같다」가 ②↔③ 을 대조합니다.
 * ⚠️ 그 검사는 **옆 저장소가 있을 때만** 돕니다(CI 에서는 skip). 여기만 고치면 로컬만
 *    빨개지고 CI 는 조용히 통과합니다 — 순서를 지키는 이유가 그것입니다.
 */
const PRICE = 300000;
/*
 * 결제창·카드 명세서에 찍히는 주문명입니다 — 이용자가 보는 문자열입니다.
 * 「수출 사전점검」으로 통일 〔2026-08-13 · 흐름 md §1 상위 카테고리명〕.
 * ⛔ 「NDA」를 넣지 마십시오(md §1 비노출 원칙). 서류 종류는 접수 화면 안에서만 말합니다.
 */
const ORDER_NAME = '수출 사전점검';

const CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';
/** 취소(환불). `{paymentKey}/cancel` 로 붙입니다 〔M-3 · 2026-08-11〕. */
const PAYMENT_URL_BASE = 'https://api.tosspayments.com/v1/payments/';

// 토스 공식 문서에 공개된 결제위젯 테스트 키.
// 비밀이 아니며, 실제 매출이 발생하지 않습니다. 심사용 결제창을 띄우기 위한 기본값입니다.
const DOCS_TEST_CLIENT_KEY = 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
const DOCS_TEST_SECRET_KEY = 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';

/*
 * 키 형식. trops_a 의 lib/payment/toss-key.ts 와 같은 규칙을 씁니다 —
 * 「키 형식임을 증명한 값만 통과」(모르면 막는다).
 *
 * 두 저장소를 일부러 분리해 두었으므로 코드를 공유하지 않고 규칙만 옮겨 적습니다.
 * 형식이 바뀌면 양쪽을 함께 고쳐야 합니다.
 */
const KEY_PATTERN = {
  client: /^(test|live)_g?ck_[A-Za-z0-9]{20,}$/,
  secret: /^(test|live)_g?sk_[A-Za-z0-9]{20,}$/,
};

function classifyKey(value, role) {
  if (value == null) return 'missing';
  const v = String(value).trim();
  if (v === '') return 'missing';
  return KEY_PATTERN[role].test(v) ? 'valid' : 'placeholder';
}

/**
 * 쓸 키를 정합니다.
 *
 * 실키가 둘 다 valid 일 때만 실결제로 갑니다.
 * 한쪽만 붙은 상태는 결제가 중간에 실패하는 상태이지 "열림"이 아니므로,
 * 그 경우 테스트 키로 되돌리고 원인을 로그에 남깁니다.
 */
function readTossConfig() {
  const rawClient = process.env.PRECHECK_TOSS_CLIENT_KEY;
  const rawSecret = process.env.PRECHECK_TOSS_SECRET_KEY;

  const clientState = classifyKey(rawClient, 'client');
  const secretState = classifyKey(rawSecret, 'secret');

  if (clientState === 'valid' && secretState === 'valid') {
    const live = String(rawClient).trim().indexOf('live_') === 0;
    return {
      clientKey: String(rawClient).trim(),
      secretKey: String(rawSecret).trim(),
      mode: live ? 'live' : 'test',
    };
  }

  // 값을 로그에 남기지 않습니다 — 상태만 남깁니다.
  if (clientState !== 'missing' || secretState !== 'missing') {
    console.error('payment key error: client=' + clientState + ', secret=' + secretState +
      ' | 둘 다 valid 일 때만 실결제로 갑니다. 지금은 문서 테스트 키로 동작합니다.' +
      ' | 형식: client=(test|live)_g?ck_영숫자20자이상, secret=(test|live)_g?sk_영숫자20자이상');
  }

  return { clientKey: DOCS_TEST_CLIENT_KEY, secretKey: DOCS_TEST_SECRET_KEY, mode: 'test-docs' };
}

/** 토스 orderId 제약: 6~64자, 영문 대소문자·숫자·`-`·`_`. */
function makeOrderId() {
  const rnd = require('crypto').randomUUID().replace(/-/g, '');
  return ('precheck_' + rnd).slice(0, 64);
}

/**
 * 결제 승인.
 *
 * amount 는 반드시 **서버가 가진 금액**을 넘깁니다.
 * 클라이언트가 보낸 금액을 그대로 넘기면 위젯 요청 금액을 바꿔 싸게 결제할 수 있습니다.
 */
async function confirmPayment(params) {
  const { secretKey } = readTossConfig();
  const auth = Buffer.from(secretKey + ':').toString('base64');

  try {
    const response = await fetch(CONFIRM_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey: params.paymentKey,
        orderId: params.orderId,
        amount: params.amount,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        code: data.code || String(response.status),
        message: data.message || '결제 승인에 실패했습니다.',
      };
    }

    return {
      ok: true,
      payment: {
        paymentKey: data.paymentKey,
        orderId: data.orderId,
        totalAmount: Number(data.totalAmount),
        status: data.status,
        method: data.method,
        approvedAt: data.approvedAt,
      },
    };
  } catch (err) {
    return {
      ok: false,
      code: 'NETWORK',
      message: err && err.message ? err.message : '네트워크 오류',
    };
  }
}

/**
 * 결제 취소(환불) 〔M-3 · 신설 2026-08-11〕.
 *
 * ⚠️ **여기에는 「환불해야 하는가」가 없습니다.** 그 판단은 사람이거나(scripts/refund.js)
 *    판정층이고(precheck_intake_route → api/_route-refund.js), 이 함수는 시키는 취소를
 *    실행하기만 합니다. 이 저장소의 경계가 그렇습니다 — 결제 처리는 하고 판정은 안 합니다.
 *
 * ⚠️ 여기에는 「라우트에서 부르지 마십시오 — 돈을 되돌리는 경로가 공개 주소에 서면
 *    안 됩니다」가 적혀 있었습니다. 2026-08-11 M-2 재착수로 뒤집혔습니다:
 *    api/cron/refund-blocked.js 가 이 경로를 씁니다. 근거는 그 파일 머리주석과
 *    precheck-schema.sql 「0-F」입니다(요지: CRON_SECRET 불일치에 404 로 답해
 *    존재를 알리지 않으므로 노출면이 실질적으로 늘지 않습니다).
 *    ⛔ **이용자가 부르는 라우트에서는 여전히 부르지 마십시오** — 취소를 요청으로
 *       열면 남의 주문번호를 넣어 보는 경로가 생깁니다.
 *
 * amount 를 넘기지 않으면 전액 취소입니다. 부분 취소는 지금 쓰지 않습니다
 * (환불규정 §02 가 요약 자료 전달 전 **전액**을 말합니다).
 */
async function cancelPayment(params) {
  const { secretKey } = readTossConfig();
  const auth = Buffer.from(secretKey + ':').toString('base64');

  const body = { cancelReason: params.reason };
  if (params.amount != null) body.cancelAmount = params.amount;

  try {
    const response = await fetch(
      PAYMENT_URL_BASE + encodeURIComponent(params.paymentKey) + '/cancel',
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + auth,
          'Content-Type': 'application/json',
          // 같은 건을 두 번 취소하지 않도록 멱등키를 붙입니다. 스크립트를 두 번
          // 돌려도 토스가 같은 결과를 돌려줍니다(재취소가 아닙니다).
          'Idempotency-Key': 'refund_' + params.paymentKey,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        code: data.code || String(response.status),
        message: data.message || '결제 취소에 실패했습니다.',
      };
    }

    const cancels = Array.isArray(data.cancels) ? data.cancels : [];
    const last = cancels.length > 0 ? cancels[cancels.length - 1] : {};
    return {
      ok: true,
      cancel: {
        paymentKey: data.paymentKey,
        orderId: data.orderId,
        status: data.status,
        cancelledAt: last.canceledAt || new Date().toISOString(),
        cancelledAmount: last.cancelAmount != null ? Number(last.cancelAmount) : null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      code: 'NETWORK',
      message: err && err.message ? err.message : '네트워크 오류',
    };
  }
}

module.exports = {
  LIST_PRICE: LIST_PRICE,
  PRICE: PRICE,
  ORDER_NAME: ORDER_NAME,
  readTossConfig: readTossConfig,
  classifyKey: classifyKey,
  makeOrderId: makeOrderId,
  confirmPayment: confirmPayment,
  cancelPayment: cancelPayment,
};
