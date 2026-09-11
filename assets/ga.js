/*
 * ga.js — Google Analytics 4 (gtag.js) 부트스트랩 〔2026-09-12 신설〕
 *
 * 측정 ID 는 이 파일 안의 한 줄뿐입니다. 배포되는 8장은 <head> 에서 이 파일을
 * 한 줄로 불러오기만 합니다.
 *
 * 🔴 **왜 각 페이지에 스니펫을 붙여넣지 않는가** — 구글이 안내하는 형태는 페이지마다
 *    측정 ID 를 들고 있는 4줄 스니펫입니다. 이 저장소에서 그것은 같은 값 8벌이 되고,
 *    속성을 바꾸거나 설정을 더할 때 8곳이 갈립니다. 사업자정보(6곳) · 대조 항목 수
 *    (5곳)에서 같은 형태의 드리프트를 이미 겪었고, 그래서 화면에 나가는 값은 한 곳을
 *    원본으로 두는 것이 이 저장소의 규약입니다.
 *
 * ⚠️ `assets/` 는 빌드가 **통째로 복사**합니다 — 주석 제거도 토큰 치환도 없습니다
 *    (scripts/build-static.js 의 STATIC.dirs). 그래서 이 주석은 그대로 공개됩니다.
 *    밖에서 읽혀도 되는 말만 적으십시오. `{{biz.*}}` 같은 토큰도 쓰지 마십시오 —
 *    글자 그대로 나갑니다.
 *
 * ⚠️ `gtag` 를 window 에 올립니다. 구글 스니펫은 전역 함수 선언이라 다른 코드가
 *    `gtag(...)` 로 부를 수 있는데, 이 파일은 즉시실행함수 안이라 올려 주지 않으면
 *    페이지 쪽에서 부를 수 없습니다.
 * ⛔ `dataLayer.push(arguments)` 의 `arguments` 를 배열로 바꾸지 마십시오 —
 *    gtag.js 는 arguments 객체를 그대로 읽습니다.
 *
 * assets/track.js 와는 **별개**입니다. 그쪽은 자체 집계(app.trops.kr/api/track)이고
 * 이 파일은 구글로 보냅니다. 한쪽을 지워도 다른 쪽은 그대로 돕니다.
 */
(function () {
  'use strict';

  var ID = 'G-RQ1NWGK0KM';

  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(tag);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', ID);
})();
