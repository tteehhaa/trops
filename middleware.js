/**
 * 랜딩 언어 분기 — 기본은 국문, `lang=en` 쿠키가 있을 때만 영문으로 돌려보낸다.
 * 〔2026-08-30 · 대표 지시 — 영어 우선 접속 철회, 국문 우선으로 되돌림〕
 * (이전: 〔2026-08-21 · 창업자 지시 — 랜딩 영어 우선 접속 + 비영어권 방문자 언어 선택〕)
 *
 * 쿠키는 `lang`(ko|en) 값 하나뿐이고 기능성(언어 선택 기억) 목적이다 — 광고·분석이
 * 아니다(privacy.html §01 예외 참조, 2026-08-21). 검색엔진 크롤러는 이제 쿠키 없이
 * 국문을 그대로 받는다 — 국문 홈의 검색 노출을 지키는 쪽으로 되돌린 것이다.
 *
 * ⚠️ 아래 PAIRS 는 `assets/lang-switch.js` 의 같은 이름 표와 짝이다. 한쪽만 고치면
 *    리다이렉트가 가리키는 상대와 배너·전환 링크가 가리키는 상대가 갈라진다.
 */

const PAIRS = [
  ['/', '/en'],
  ['/refund', '/en-refund'],
  ['/privacy', '/en-privacy'],
];

const KO_TO_EN = new Map(PAIRS);

export default function middleware(request) {
  const url = new URL(request.url);
  const enPath = KO_TO_EN.get(url.pathname);
  if (!enPath) return; // matcher 범위 밖 — 원래는 여기까지 오지 않는다

  const cookieHeader = request.headers.get('cookie') || '';
  const chosenEn = /(?:^|;\s*)lang=en(?:;|$)/.test(cookieHeader);
  if (!chosenEn) return; // 기본값 — 국문 그대로 서빙

  url.pathname = enPath;
  return new Response(null, {
    status: 307,
    headers: {
      Location: url.toString(),
      // 브라우저가 이 리다이렉트를 캐시하면, 나중에 lang=ko 쿠키가 생겨도 서버에
      // 다시 물어보지 않고 캐시된 응답으로 튕긴다 — 언어 전환이 막혀 버린다.
      'Cache-Control': 'no-store',
    },
  });
}

/*
 * 🔄 **matcher 에서 죽은 세 항목을 걷었다** 〔2026-09-05 · 랜딩→앱 지연 정리〕.
 *
 * `/precheck`·`/nda`·`/uae` 는 **PAIRS 에 짝이 없어** 여기까지 와서 `enPath` 가 없다는
 * 이유로 그대로 통과하던 경로다(2026-08-30 6장 제거 때 PAIRS 에서만 빠졌다). 결과가
 * 같으니 무해하다고 남겨 두었는데, 무해한 것과 «공짜»인 것은 다르다 — matcher 에 있으면
 * 그 경로의 모든 요청이 **edge 함수를 한 번 깨우고** 통과한다. `/precheck` 는 1분 진단
 * 페이지이고 랜딩 CTA 가 전부 그리로 간다. 가장 바쁜 길에 아무 일도 하지 않는 홉이
 * 하나 붙어 있었다.
 *
 * 🔴 **되살리는 조건은 그대로다** — 영문판 `en-precheck.html` 이 서는 날 PAIRS 에 그 짝을
 *    한 줄 더하고, **여기 matcher 에도 `/precheck` 를 함께 넣으십시오.** PAIRS 에만
 *    넣으면 요청이 이 파일에 오지 않아 조용히 동작하지 않는다.
 * ⚠️ `/nda`·`/uae` 는 vercel.json 이 리다이렉트로 먼저 잡는다 — 영문 짝을 가질 경로가
 *    아니다.
 *
 * ⛔ **여기에 짝을 «배열 리터럴 꼴»로 예시하지 마십시오** 〔2026-09-01 실측〕.
 *    `scripts/verify-deployment.js` 가 이 파일을 정규식으로 훑어 PAIRS 를 읽는다.
 *    주석에 적은 예시도 그대로 잡혀서 **있지도 않은 짝이 표에 하나 더 생긴다** —
 *    실제로 3개가 4개로 읽혔다.
 */
export const config = {
  matcher: ['/', '/refund', '/privacy'],
  runtime: 'edge',
};
