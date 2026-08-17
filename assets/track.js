/*
 * track.js — 페이지 조회·버튼 클릭 익명 집계 〔2026-08-18 · 창업자 요청 「가벼운 쪽」〕
 *
 * 🔴 **개인을 식별하지 않는다.** 쿠키·localStorage·visitor id 를 만들지도 읽지도 않는다 —
 *    privacy.html §01 「행태정보 수집 도구를 쓰지 않는다」와 부딪히지 않는 것이 이 파일의
 *    존재 이유다. 보내는 값은 `{kind, path, label?}` 셋뿐이고 그중 어느 것도 「누구인지」를
 *    말하지 않는다.
 *
 * 히트맵·세션 재생이 아니다 — 페이지 로드 1건, 버튼 클릭 1건을 각각 익명 집계로 남길 뿐이다.
 *
 * 클릭 추적 대상은 `data-track="이름"` 을 붙인 요소만이다. 전체 클릭을 다 잡지 않는다 —
 * 「주요 버튼」만 세기로 했다(창업자 지시 · admin/analytics 화면 참조).
 */
(function () {
  'use strict';

  var ENDPOINT = '/api/track';

  function send(payload) {
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        var ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
        if (ok) return;
      }
    } catch (e) { /* sendBeacon 미지원·실패 — fetch 로 폴백 */ }

    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(function () { /* 집계 실패는 화면 동작에 영향을 주지 않는다 */ });
    } catch (e) { /* 조용히 포기 — 집계는 부가 기능이다 */ }
  }

  send({ kind: 'pageview', path: location.pathname });

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track]');
    if (!el) return;
    send({ kind: 'click', path: location.pathname, label: el.getAttribute('data-track') });
  });
})();
