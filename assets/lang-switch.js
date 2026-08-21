/*
 * lang-switch.js — 랜딩 언어 전환 배너·링크 〔2026-08-21 · 창업자 지시〕
 *
 * 기본은 영어(middleware.js 가 국문 경로를 /en* 로 리다이렉트한다). 이 파일이 하는 일은
 * 둘뿐이다 — ① 영문 페이지에서, 브라우저 언어가 한국어인 방문자에게 "한국어로 보기"
 * 배너를 보여준다. ② 기존 언어 전환 링크(`a[hreflang]`)에 lang 쿠키를 심는다.
 *
 * 🔴 **화면 우하단에 떠 있던 [English] 알약을 걷었다** 〔2026-08-21 · 대표 지시〕. 그 알약이
 *    하던 일(국문 페이지에서 영문으로 되돌아가기)은 이제 **헤더의 언어 전환 링크**가 한다 —
 *    index.html·en.html 이 이미 갖고 있던 `.nav-quiet` 링크를 나머지 12개 페이지(check ·
 *    precheck · refund · nda · uae · privacy 의 국문·영문)에도 같은 자리에 넣었다.
 *    종전에는 랜딩만 헤더에 [EN] 이 있고 나머지는 알약이라, **한 페이지에 언어 전환이 둘**
 *    (랜딩: 헤더 EN + 알약)이거나 **페이지마다 다른 자리**였다.
 * ⛔ 알약을 되살리지 마십시오. 되살리면 랜딩에서 다시 둘이 된다 — 헤더에 링크가 없는
 *    페이지를 새로 만들었다면, 알약을 부활시키는 대신 그 페이지 헤더에 링크를 넣으십시오.
 *
 * 🔴 쓰는 저장소는 쿠키 하나(`lang` = ko|en)뿐이다 — 광고·분석 목적이 아니고, 다른
 *    방문과 연결해 이용자를 식별하지 않는다(privacy.html §01 예외, 2026-08-21).
 *    track.js 와 같은 이유로 그 이상은 만들지도 읽지도 않는다.
 *
 * ⚠️ 아래 PAIRS 는 middleware.js 의 같은 이름 표와 짝이다. 한쪽만 고치면 리다이렉트가
 *    가리키는 상대와 이 파일의 배너·링크가 가리키는 상대가 갈라진다.
 */
(function () {
  'use strict';

  var PAIRS = [
    ['/', '/en'],
    ['/check', '/en-check'],
    ['/precheck', '/en-precheck'],
    ['/refund', '/en-refund'],
    ['/nda', '/en-nda'],
    ['/uae', '/en-uae'],
    ['/privacy', '/en-privacy'],
  ];

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  // 180일 · 값은 ko|en 뿐 — 기능성 예외 1건(privacy.html §01).
  function setCookie(name, value) {
    document.cookie = name + '=' + value + '; Path=/; Max-Age=15552000; SameSite=Lax';
  }

  /*
   * 기존 수동 전환 링크(예: index.html/en.html nav 의 「한국어」·「EN」, `a[hreflang]`)도
   * lang 쿠키를 심어야 한다 — 안 그러면 en.html 의 「한국어」(href="/")를 눌러도
   * middleware.js 가 쿠키 없음을 보고 다시 /en 으로 돌려보낸다.
   */
  var existingSwitchLinks = document.querySelectorAll('a[hreflang="ko"], a[hreflang="en"]');
  for (var j = 0; j < existingSwitchLinks.length; j++) {
    (function (a) {
      a.addEventListener('click', function () {
        setCookie('lang', a.getAttribute('hreflang'));
      });
    })(existingSwitchLinks[j]);
  }

  var path = location.pathname;
  var koPath = null;
  var enPath = null;
  for (var i = 0; i < PAIRS.length; i++) {
    if (PAIRS[i][0] === path || PAIRS[i][1] === path) {
      koPath = PAIRS[i][0];
      enPath = PAIRS[i][1];
      break;
    }
  }
  if (!koPath) return; // 이 표에 없는 페이지 — 아무것도 하지 않는다

  var barStyle =
    'position:fixed;left:0;right:0;top:0;z-index:2147483000;display:flex;align-items:center;' +
    'gap:10px;justify-content:center;flex-wrap:wrap;padding:10px 14px;background:#111827;' +
    'color:#fff;font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  if (path === enPath) {
    // 이미 한쪽을 골랐으면(ko 든 en 이든) 다시 묻지 않는다
    if (getCookie('lang')) return;

    var langs = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || ''];
    var looksKorean = langs.some(function (l) {
      return (l || '').toLowerCase().indexOf('ko') === 0;
    });
    if (!looksKorean) return;

    var bar = document.createElement('div');
    bar.setAttribute('role', 'note');
    bar.style.cssText = barStyle;

    var msg = document.createElement('span');
    msg.textContent = '이 페이지를 한국어로 보시겠어요?';
    bar.appendChild(msg);

    var switchLink = document.createElement('a');
    switchLink.href = koPath;
    switchLink.textContent = '한국어로 보기';
    switchLink.style.cssText =
      'color:#111827;background:#fff;padding:4px 10px;border-radius:6px;font-weight:600;text-decoration:none;';
    switchLink.addEventListener('click', function () {
      setCookie('lang', 'ko');
    });
    bar.appendChild(switchLink);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText =
      'background:none;border:none;color:#fff;font-size:16px;line-height:1;cursor:pointer;padding:2px 4px;';
    closeBtn.addEventListener('click', function () {
      setCookie('lang', 'en');
      bar.parentNode && bar.parentNode.removeChild(bar);
    });
    bar.appendChild(closeBtn);

    document.body.insertBefore(bar, document.body.firstChild);
  }
  /*
   * 국문 페이지에서는 이 파일이 아무것도 그리지 않는다 — 되돌아갈 [EN] 링크는 헤더에
   * 마크업으로 있고(위 🔴 참조), 위쪽 `a[hreflang]` 루프가 그 링크에 쿠키를 심어 둔다.
   * 그것이 없으면 middleware.js 가 쿠키 없음을 보고 다시 /en 으로 돌려보낸다.
   */
})();
