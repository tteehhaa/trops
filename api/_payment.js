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

/** 정가 — 화면에 취소선으로 노출합니다. */
const LIST_PRICE = 290000;
/** 런칭가 — 실제 결제 금액. 서버가 가진 이 값만 신뢰합니다(클라이언트 전달값 신뢰 금지). */
const PRICE = 99000;
const ORDER_NAME = '바이어 서류 사전 확인';

const CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';

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

module.exports = {
  LIST_PRICE: LIST_PRICE,
  PRICE: PRICE,
  ORDER_NAME: ORDER_NAME,
  readTossConfig: readTossConfig,
  classifyKey: classifyKey,
  makeOrderId: makeOrderId,
  confirmPayment: confirmPayment,
};
