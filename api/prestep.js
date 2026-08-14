/*
 * §4-2 사전 확인 세션 저장 — 판정층(trops_a) 전달 프록시
 * 〔2026-08-14 · doc/s10 구현계획서 §4-2 · 1단계 작업 3〕
 *
 * /check(사전 확인 3문항)가 문항마다 한 번씩 두드리는 자리입니다. 이 파일이 하는 일은
 * 하나뿐입니다 — 받은 body 를 그대로 trops_a 의 POST /api/prestep 으로 넘기고,
 * 그쪽 응답을 그대로 돌려줍니다. **여기서 검증하지도, 저장하지도 않습니다.**
 *
 * 🔴 왜 브라우저가 app.trops.kr 을 직접 두드리지 않는가 (§4-2 표 · A/B/C 중 B 채택)
 *    화면은 trops.kr, 저장소는 app.trops.kr 로 도메인이 다릅니다. 브라우저가 앱
 *    도메인을 직접 부르면 CORS 설정이 따라오고, 방문자 브라우저가 앱 도메인을 두드리는
 *    모양이 됩니다. 서버가 한 홉 대신 받으면 브라우저는 trops.kr 만 상대하므로
 *    CORS 가 아예 필요 없습니다 — 기존 api/leads.js 와 같은 모양입니다.
 *    ⛔ 이 프록시를 걷어내고 check.html 이 app.trops.kr 을 직접 부르게 바꾸지 마십시오.
 *       그 순간 CORS·프리플라이트가 살아나고, 인입 비밀값(아래)이 브라우저로 내려갑니다.
 *
 * 🔴 인입 비밀값 x-prestep-secret
 *    trops_a 의 수신 엔드포인트는 이 헤더로 「trops.kr 서버가 보낸 것」을 가립니다.
 *    ⛔ 이 값을 클라이언트로 내려보내지 마십시오. 서버에서만 붙이라고 이 프록시가
 *       있는 것이고, 브라우저에 노출되는 순간 누구나 남의 세션 행을 덮어쓸 수 있습니다.
 *    양쪽 저장소 env 에 같은 값이 등록되어 있습니다(PRESTEP_INGEST_SECRET).
 *    한쪽만 갈면 전달이 전부 401 이 됩니다 — 함께 갈으십시오.
 *
 * ⚠️ fail-open 은 **화면 쪽 원칙**입니다 (§9).
 *    저장 실패로 사용자를 막으면 이탈 방지 설계가 자기모순이 되므로, check.html 은
 *    이 호출의 성패와 무관하게 다음 문항으로 넘어갑니다(작업 7). 그렇다고 이 파일이
 *    실패를 200 으로 덮으면 안 됩니다 — 그러면 전달이 통째로 끊겨도 로그에 아무것도
 *    남지 않아, 지표가 0 인 것이 「이탈이 없다」인지 「전달이 죽었다」인지 구분되지
 *    않습니다. 여기서는 사실대로 상태코드를 돌려주고, 무시하는 것은 화면의 몫입니다.
 *
 * ⚠️ 400 을 만들지 마십시오. 값 검증은 trops_a 몫이고(§4-2 「enum 밖의 값은 해당
 *    필드만 버리고 나머지는 저장. 400 을 던지지 않음」), 이 프록시에 같은 화이트리스트를
 *    한 벌 더 두면 두 저장소가 조용히 어긋납니다. 이 파일은 봉투만 나릅니다.
 *
 * 응답: trops_a 의 { ok: true } 를 그대로 (상태코드 포함).
 */

/**
 * 판정층(trops_a) 주소. api/_notify.js 의 appOrigin() 과 **같은 env·같은 기본값**입니다.
 * 두 곳이 다른 이름을 쓰면 프리뷰 환경에서 한쪽만 옮겨 갑니다 — 이름을 바꾸려면 함께.
 */
const DEFAULT_APP_ORIGIN = 'https://app.trops.kr';
const UPSTREAM_PATH = '/api/prestep';

/**
 * 전달 제한시간. 화면은 이 응답을 기다리지 않지만(§4-2 「화면은 서버 응답을 기다리지
 * 않음」), 함수 자체는 응답이 올 때까지 살아 있습니다. trops_a 가 멈추면 문항마다
 * 하나씩 함수가 매달리므로 짧게 끊습니다.
 */
const UPSTREAM_TIMEOUT_MS = 5000;

function upstreamUrl() {
  const origin = (process.env.PRECHECK_APP_ORIGIN || DEFAULT_APP_ORIGIN).trim().replace(/\/+$/, '');
  return origin + UPSTREAM_PATH;
}

/**
 * Vercel 은 content-type: application/json 일 때만 req.body 를 객체로 파싱합니다.
 * 문자열로 들어온 것을 그대로 JSON.stringify 하면 따옴표가 한 겹 더 붙어
 * trops_a 가 객체 대신 문자열을 받습니다 — 파싱을 여기서 한 번 정리합니다.
 */
function requestPayload(body) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (body && typeof body === 'object') return body;
  return {};
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const secret = (process.env.PRESTEP_INGEST_SECRET || '').trim();
  if (!secret) {
    // 비밀값 없이 보내면 trops_a 가 401 로 떨굽니다. 그 401 을 「인증 실패」로 읽으면
    // 원인을 저쪽에서 찾게 되므로, 설정 누락은 여기서 이름을 대고 끊습니다.
    console.error('prestep proxy: PRESTEP_INGEST_SECRET 이 없습니다 — 전달하지 않았습니다');
    res.status(503).json({ error: 'not configured' });
    return;
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-prestep-secret': secret,
      },
      body: JSON.stringify(requestPayload(req.body)),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    // 네트워크 단절·제한시간 초과. 화면은 이 응답을 무시하고 진행합니다(§9).
    console.error('prestep proxy: 전달 실패', err && err.message ? err.message : err);
    res.status(502).json({ error: 'upstream unreachable' });
    return;
  }

  // 본문을 해석하지 않고 그대로 넘깁니다. trops_a 가 { ok: true } 말고 다른 것을
  // 돌려주게 되더라도 이 파일을 고칠 일이 없어야 합니다.
  const text = await upstream.text();

  if (!upstream.ok) {
    console.error('prestep proxy: upstream ' + upstream.status + ' ' + text.slice(0, 200));
  }

  res.status(upstream.status);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  // 빈 본문(204 등)일 때 res.send('') 가 아니라 최소 JSON 을 둡니다 —
  // 화면이 res.json() 을 부르다 파싱 오류로 죽는 경로를 만들지 않습니다.
  res.send(text || '{}');
};
