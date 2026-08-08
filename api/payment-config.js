/*
 * /precheck 결제 화면이 필요로 하는 공개 설정.
 *
 * ⚠️ 경계: 접수·저장·알림·결제 처리만. LLM 호출·상태 판정 코드 없음.
 *
 * GET /api/payment-config
 *   → { ok, clientKey, mode, amount, listPrice, orderName }
 *
 * clientKey 는 브라우저에 노출되는 것이 정상입니다(결제위젯이 쓰는 공개 키).
 * 시크릿 키는 이 응답에 절대 넣지 않습니다 — 승인은 서버(api/payment-confirm.js)에서만 합니다.
 *
 * 키를 HTML 에 박지 않고 여기서 내려주는 이유:
 * 실키로 바꿀 때 Vercel 환경변수만 고치면 되고, 페이지를 다시 배포하지 않아도 됩니다.
 */

const { PRICE, LIST_PRICE, ORDER_NAME, readTossConfig } = require('./_payment.js');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const toss = readTossConfig();

  res.status(200).json({
    ok: true,
    clientKey: toss.clientKey,
    // 'live' | 'test' | 'test-docs'
    // 화면은 live 가 아닐 때 "테스트 결제" 를 표시합니다.
    // 실키를 넣었는데 test-docs 가 내려온다면 키 형식이 틀린 것입니다(서버 로그에 원인이 남습니다).
    mode: toss.mode,
    amount: PRICE,
    listPrice: LIST_PRICE,
    orderName: ORDER_NAME,
  });
};
