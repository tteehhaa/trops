/*
 * lang-switch.js — 랜딩 언어 전환 배너·링크 〔2026-08-21 · 창업자 지시〕
 *
 * 기본은 영어(middleware.js 가 국문 경로를 /en* 로 리다이렉트한다). 이 파일이 하는 일은
 * 둘뿐이다 — ① 영문 페이지에서, 브라우저 언어가 한국어인 방문자에게 "한국어로 보기"
 * 배너를 보여준다. ② 국문 페이지에서(이미 lang=ko 를 고른 뒤에만 올 수 있다), 다시
 * 영어로 돌아갈 작은 링크를 둔다.
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
  } else {
    // 국문 페이지 — lang=ko 를 고른 뒤에만 여기 올 수 있다(middleware.js). 되돌아갈
    // 링크 하나를 작게 둔다.
    var back = document.createElement('a');
    back.href = enPath;
    back.textContent = 'English';
    back.style.cssText =
      'position:fixed;right:10px;bottom:10px;z-index:2147483000;background:#111827;color:#fff;' +
      'font:12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'padding:6px 10px;border-radius:999px;text-decoration:none;opacity:.85;';
    back.addEventListener('click', function () {
      setCookie('lang', 'en');
    });
    document.body.appendChild(back);
  }
})();
