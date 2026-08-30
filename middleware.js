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
 * ⚠️ matcher 에 남은 `/precheck`·`/nda`·`/uae` 는 **PAIRS 에 없는 죽은 항목**이다
 *    (2026-08-30 6장 제거 때 PAIRS 에서만 빠졌다). 지금은 무해하다 — 그 셋은
 *    vercel.json 리다이렉트가 먼저 잡고, 여기까지 와도 enPath 가 없어 그대로 통과한다.
 *    이번 커밋 범위 밖이라 손대지 않았다. 정리할 때 PAIRS 와 함께 보십시오.
 */
export const config = {
  matcher: ['/', '/precheck', '/refund', '/nda', '/uae', '/privacy'],
  runtime: 'edge',
};
