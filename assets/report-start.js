/*
 * report-start.js — 첫 화면 «우리 회사 수출 리포트» 입구 〔신설 2026-11-03 · 대표 결정〕
 *
 * 앱(app.trops.kr) 비로그인 홈이 «홈페이지 주소 한 칸 + [리포트 받기]»로 바뀌어, 랜딩 첫 화면도
 * 같은 입구를 둡니다. 넣은 주소를 회사 도메인으로 다듬어 앱 비로그인 첫 화면으로 보냅니다.
 *
 * 🔄 2026-11-05 대표 «고쳐» — 앱 로그인(`/login`)으로 바로 보내던 것을 앱 비로그인 첫 화면
 *    `https://app.trops.kr/?site=<도메인>&from=landing` 으로 바꿨습니다. 앱이 그 주소를 칸에 채우고
 *    맛보기(읽는 중 → 맛보기 → 카카오 · Google로 계속하기)를 저절로 시작합니다. 로그인 뒤 리포트는 앱이 이어 만듭니다.
 *    ⚠️ 앱 쪽 고침(`?site=` 저절로 시작 · 꼬리표 `landing`)이 운영에 나간 뒤에 이 고침이 나갑니다.
 *
 * 🔴 링크 모양은 `/?site=` + encodeURIComponent(도메인)입니다 — `test/report-start.test.js` 가 foreon1.com 의 결과를 글자 그대로 잽니다.
 *    앱은 받는 쪽에서 주소를 다시 거릅니다(모양이 아니면 종전 첫 화면 그대로).
 * 🔴 유입원(`from`) · 방문 열쇠(`vs`)는 여기서 만들지 않습니다 — `assets/track.js` 의
 *    `window.tropsAppHref` 가 앱 링크와 같은 규칙으로 붙입니다(두 번째 장치를 두지 않습니다 · 이 방문의 값이 없으면 `landing`).
 *    track.js 가 막힌 브라우저에서는 다듬은 주소를 칸에 넣고 폼을 그대로 보냅니다 — 폼의 숨은 칸(`from=landing`)이 실려
 *    자바스크립트가 없을 때와 같은 주소가 됩니다.
 * ⚠️ 자바스크립트가 없으면 폼이 앱 첫 화면으로 그대로 제출됩니다(`?site=<넣은 글>&from=landing` · 앱이 다듬어 받습니다).
 * ⛔ 넣은 주소를 저장하거나 집계로 보내지 않습니다 — 클릭 집계는 `data-track` 이름만 갑니다.
 */
(function () {
  'use strict';

  var APP = 'https://app.trops.kr';

  /* 기관 · 공공 주소의 끝자리 — 이 주소로는 «그 기관»을 회사로 읽게 됩니다. */
  var PUBLIC_SUFFIXES = ['.go.kr', '.or.kr', '.ac.kr', '.re.kr', '.mil.kr', '.gov'];
  /* 포털 · 사회망 · 블로그 · 홈페이지 짓기 서비스 자체 주소. */
  var PORTAL_HOSTS = [
    'naver.com', 'daum.net', 'kakao.com', 'google.com', 'youtube.com', 'instagram.com', 'facebook.com',
    'blog.naver.com', 'smartstore.naver.com', 'tistory.com', 'notion.site', 'wixsite.com', 'modoo.at'
  ];
  /*
   * 하위 주소까지 막는 포털 — 이 아래 주소(m.facebook.com · cafe.naver.com 등)는 회사 홈페이지일 수 없습니다.
   * ⚠️ tistory · notion.site · wixsite · modoo.at 은 넣지 않습니다 — 그 하위 주소는 실제 회사 홈페이지일 수 있습니다.
   */
  var PORTAL_FAMILIES = ['naver.com', 'daum.net', 'kakao.com', 'google.com', 'youtube.com', 'instagram.com', 'facebook.com'];

  function endsWith(s, tail) {
    return s.length >= tail.length && s.slice(s.length - tail.length) === tail;
  }

  /** 넣은 글 → 회사 도메인(소문자 · 주소 꼴이 아니면 null). */
  function normalizeSite(raw) {
    var s = String(raw == null ? '' : raw).replace(/^\s+|\s+$/g, '').toLowerCase();
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^\/\//, '');
    s = s.split(/[\/?#]/)[0];
    s = s.replace(/:\d*$/, '').replace(/\.$/, '');
    s = s.replace(/^www2?\./, '');
    if (!s || s.length > 253) return null;
    if (!/^[a-z0-9.-]+$/.test(s) || s.indexOf('.') === -1) return null;
    if (!/\.[a-z]{2,}$/.test(s)) return null;
    var labels = s.split('.');
    for (var i = 0; i < labels.length; i++) {
      var l = labels[i];
      if (!l || l.length > 63 || l.charAt(0) === '-' || l.charAt(l.length - 1) === '-') return null;
    }
    return s;
  }

  /** 회사 홈페이지가 아닌 주소인가 — 기관 · 공공 끝자리 또는 포털. */
  function isPortal(domain) {
    var i;
    for (i = 0; i < PUBLIC_SUFFIXES.length; i++) if (endsWith(domain, PUBLIC_SUFFIXES[i])) return true;
    for (i = 0; i < PORTAL_HOSTS.length; i++) if (domain === PORTAL_HOSTS[i]) return true;
    for (i = 0; i < PORTAL_FAMILIES.length; i++) if (endsWith(domain, '.' + PORTAL_FAMILIES[i])) return true;
    return false;
  }

  /** 앱 비로그인 첫 화면 → 이 도메인으로 맛보기를 저절로 시작한다(로그인 뒤 리포트는 앱이 이어 만든다). */
  function reportHref(domain) {
    return APP + '/?site=' + encodeURIComponent(domain);
  }

  /** 'format' · 'portal' · 도메인(문자열) 가운데 하나. */
  function check(raw) {
    var domain = normalizeSite(raw);
    if (!domain) return { error: 'format' };
    if (isPortal(domain)) return { error: 'portal' };
    return { domain: domain, href: reportHref(domain) };
  }

  var api = { normalizeSite: normalizeSite, isPortal: isPortal, reportHref: reportHref, check: check };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  var form = document.querySelector('form[data-report-start]');
  if (!form) return;
  var input = form.querySelector('#report-start-url');
  var status = form.querySelector('[data-report-start-msg]');
  var reasons = status ? status.querySelectorAll('[data-reason]') : [];

  function show(reason) {
    for (var i = 0; i < reasons.length; i++) {
      reasons[i].hidden = reasons[i].getAttribute('data-reason') !== reason;
    }
    if (input) {
      if (reason) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  if (input) input.addEventListener('input', function () { show(null); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var result = check(input ? input.value : '');
    if (result.error) {
      show(result.error);
      if (input) input.focus();
      return;
    }
    show(null);
    var href = null;
    try { if (typeof window.tropsAppHref === 'function') href = window.tropsAppHref(result.href) || null; } catch (err) { href = null; }
    if (href) { window.location.assign(href); return; }
    /* track.js 가 막혔으면 다듬은 주소로 폼을 그대로 보냅니다(숨은 칸이 함께 실립니다 · submit 사건은 다시 일지 않습니다). */
    if (input) input.value = result.domain;
    form.submit();
  });
})();
