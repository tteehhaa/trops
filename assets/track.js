/*
 * track.js — 페이지 조회·버튼 클릭·영역 계측 〔2026-08-18 신설 · 2026-09-04 영역 축 추가〕
 *
 * 보내는 곳이 둘입니다.
 *   · 같은 오리진 `/api/track` → `public.page_events`(칸 3개). 종전 그대로입니다.
 *   · 앱 `app.trops.kr/api/track` → `precheck_app_event`. 영역·체류·스크롤·세션이 그리로 갑니다.
 *
 * 왜 둘인가 — 운영 화면(`/admin/growth`)의 영역·방문·유입 집계는 **앱 표**를 읽습니다.
 * 랜딩이 자기 표에만 적으면 그 집계에 영원히 닿지 않습니다(랜딩 영역 체류가 「아직 측정
 * 안 함」으로 남아 있던 것이 그 이유입니다). 종전 경로를 지우지 않은 것은 그 표를 읽는
 * 화면이 따로 있기 때문입니다.
 *
 * 🔴 **누구인지는 여전히 모릅니다.** 쿠키·IP·User-Agent·광고 식별자를 만들지도 읽지도
 *    않습니다. 새로 생긴 것은 **한 번의 방문을 묶는 임시 열쇠**이며,
 *      · 탭을 닫으면 사라지고(sessionStorage)
 *      · 다시 온 방문인지는 **참/거짓 하나**로만 보냅니다
 *      · 그 참/거짓을 만드는 표시(localStorage `trops_seen`)는 값이 "1" 고정이고
 *        **서버로 가지 않습니다**
 *    그래서 서버에 쌓인 값만으로는 두 방문을 같은 사람으로 이을 수 없습니다.
 *    ⛔ localStorage 에 난수를 두고 그것을 보내는 형태로 바꾸지 마십시오.
 *
 * ⚠️ **개인정보처리방침 §01 이 이 범위를 적습니다** — 보내는 값을 늘리면 그 절을 함께
 *    고쳐야 합니다. 둘 중 하나만 고치면 방침이 사실이 아니게 됩니다.
 *
 * ⚠️ 본문을 `text/plain` 으로 보냅니다 — 다른 오리진이라 `application/json` 이면 preflight
 *    가 필요해지고 `sendBeacon` 은 preflight 를 못 해 **조용히** 실패합니다. 받는 쪽은
 *    선언된 타입과 무관하게 본문을 파싱합니다.
 *
 * 히트맵·세션 재생이 아닙니다. 클릭은 `data-track` 이 붙은 요소만 셉니다.
 */
(function () {
  'use strict';

  var SAME_ORIGIN = '/api/track';
  var APP_ENDPOINT = 'https://app.trops.kr/api/track';

  var SS_KEY = 'trops_vs';
  var SS_RET = 'trops_vs_r';
  var SS_SRC = 'trops_vs_s';
  var SS_REF = 'trops_vs_h';
  var LS_SEEN = 'trops_seen';

  var DWELL_MAX_MS = 30 * 60 * 1000;

  /* ── 저장소는 언제든 던질 수 있습니다(사생활 보호 모드·차단). 못 읽으면 「모른다」입니다. ── */
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* 접습니다 */ } }

  function makeKey() {
    var bytes = new Uint8Array(16), out = '', i;
    try { crypto.getRandomValues(bytes); }
    catch (e) { for (i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256); }
    for (i = 0; i < 16; i++) out += bytes[i].toString(36).length === 1
      ? '0' + bytes[i].toString(36) : bytes[i].toString(36);
    return out.slice(0, 24);
  }

  /*
   * 이 방문의 열쇠와 「다시 왔는가」.
   * 🔴 한 방문에서 답이 바뀌지 않습니다 — 표시는 열쇠를 «만들 때» 한 번만 읽습니다.
   *    매번 읽으면 첫 이벤트는 「처음」이고 두 번째부터 「다시 옴」이 되어 한 방문이 두 무리에
   *    걸칩니다.
   */
  function identity() {
    var key = ssGet(SS_KEY);
    if (key) {
      var f = ssGet(SS_RET);
      return { sessionKey: key, isReturn: f === null ? null : f === '1' };
    }
    var seen = null;
    try {
      seen = window.localStorage.getItem(LS_SEEN) === '1';
      window.localStorage.setItem(LS_SEEN, '1');
    } catch (e) { seen = null; }
    key = makeKey();
    ssSet(SS_KEY, key);
    if (seen !== null) ssSet(SS_RET, seen ? '1' : '0');
    return { sessionKey: key, isReturn: seen };
  }

  /* 어디서 왔는가 — 첫 진입에서 정합니다(우리 화면 사이를 옮기면 referrer 가 우리 자신입니다). */
  function source() {
    var cached = ssGet(SS_SRC);
    if (cached) return { bucket: cached, referrer: ssGet(SS_REF) };

    var ref = document.referrer || null;
    var host = null;
    try { if (ref) host = new URL(ref).hostname.toLowerCase(); } catch (e) { host = null; }

    var p = new URLSearchParams(location.search);
    var medium = (p.get('utm_medium') || '').toLowerCase();
    var bucket;
    if (medium === 'cpc' || medium === 'paid') bucket = 'other';
    else if (host === null) bucket = 'direct';
    else if (host === location.hostname) bucket = 'direct';
    else if (/(^|\.)(google|bing|naver|daum|duckduckgo|yahoo)\./.test(host)) bucket = 'search';
    else if (/(^|\.)(chatgpt|openai|perplexity|claude|anthropic|gemini|copilot)\./.test(host)) bucket = 'ai';
    else if (/(^|\.)(facebook|instagram|linkedin|twitter|x|threads|youtube|kakao)\./.test(host)) bucket = 'social';
    else bucket = 'referral';

    ssSet(SS_SRC, bucket);
    if (ref) ssSet(SS_REF, ref);
    return { bucket: bucket, referrer: ref };
  }

  var ID = identity();
  var SRC = source();

  function post(url, payload, beacon) {
    var body = JSON.stringify(payload);
    if (beacon) {
      try {
        /* text/plain 이라야 preflight 없이 나갑니다(위 머리말). */
        var blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
        if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
      } catch (e) { /* fetch 로 폴백합니다 */ }
    }
    try {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: body,
        keepalive: true,
        mode: 'cors',
      })['catch'](function () { /* 집계 실패는 화면 동작에 영향을 주지 않습니다 */ });
    } catch (e) { /* 조용히 포기합니다 — 집계는 부가 기능입니다 */ }
  }

  /* 종전 경로 — 칸 3개 그대로입니다. ⛔ 여기에 맥락을 얹지 마십시오(그 표에 칸이 없습니다). */
  function sendLegacy(payload) { post(SAME_ORIGIN, payload, true); }

  /* 앱 경로 — 맥락을 함께 보냅니다. */
  function sendApp(extra, beacon) {
    var body = {
      kind: extra.kind,
      path: location.pathname,
      label: extra.label || null,
      sessionKey: ID.sessionKey,
      isReturn: ID.isReturn,
      sourceBucket: SRC.bucket,
      referrer: SRC.referrer,
      section: extra.section || null,
      dwellMs: typeof extra.dwellMs === 'number' ? extra.dwellMs : null,
      scrollDepth: typeof extra.scrollDepth === 'number' ? extra.scrollDepth : null
    };
    post(APP_ENDPOINT, body, beacon !== false);
  }

  /* ── 페이지 조회 ── */
  sendLegacy({ kind: 'pageview', path: location.pathname });
  sendApp({ kind: 'pageview' }, false);

  /* ══════════════ 영역 — 본 것 · 머문 시간 ══════════════ */

  /*
   * 🔴 영역을 「본 것」은 **새 종류가 아니라 조회**입니다 — 받는 쪽 `kind` 는 두 값
   *    (`pageview`·`click`)이고 영역이 채워진 조회가 그것입니다. 새 종류를 만들면 그쪽
   *    스키마의 CHECK 을 갈아야 하고 그것은 파괴적 변경입니다.
   */
  var seen = {};           /* 한 방문에 영역당 한 번만 「봤다」를 보냅니다 */
  var enteredAt = {};      /* 지금 보이는 영역의 시작 시각 */
  var dwell = {};          /* 누적 체류(ms) */

  function nameOf(el) { return el.getAttribute('data-section'); }

  function enter(name) { if (!enteredAt[name]) enteredAt[name] = Date.now(); }
  function leave(name) {
    if (!enteredAt[name]) return;
    dwell[name] = (dwell[name] || 0) + (Date.now() - enteredAt[name]);
    enteredAt[name] = 0;
  }

  var targets = document.querySelectorAll('[data-section]');

  if (window.IntersectionObserver && targets.length) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var name = nameOf(entries[i].target);
        if (!name) continue;
        if (entries[i].isIntersecting) {
          if (!seen[name]) {
            seen[name] = 1;
            sendApp({ kind: 'pageview', section: name }, false);
          }
          enter(name);
        } else {
          leave(name);
        }
      }
      /*
       * ⚠️ **threshold 를 0 이 아니라 0.3 으로 둡니다** — 0 이면 화면 아래를 스치기만 해도
       *    「봤다」가 되어 그 수가 「본 사람」이 아니라 「지나간 사람」이 됩니다.
       */
    }, { threshold: 0.3 });
    for (var t = 0; t < targets.length; t++) io.observe(targets[t]);
  }

  /* ══════════════ 스크롤 깊이 ══════════════ */

  var maxDepth = 0;
  function measureDepth() {
    var doc = document.documentElement;
    var total = doc.scrollHeight - doc.clientHeight;
    /* 스크롤이 없는 짧은 화면은 100 입니다(전부 봤습니다 — 0 이 아닙니다). */
    var pct = total <= 0 ? 100 : Math.round(((window.scrollY || 0) / total) * 100);
    if (pct > maxDepth) maxDepth = pct > 100 ? 100 : pct;
  }
  measureDepth();
  /* passive — 스크롤을 막지 않습니다. */
  window.addEventListener('scroll', measureDepth, { passive: true });

  /* ══════════════ 떠날 때 한 번에 ══════════════ */

  var flushed = false;
  function flush() {
    if (flushed) return;
    flushed = true;

    for (var name in enteredAt) if (enteredAt[name]) leave(name);

    sendApp({ kind: 'pageview', scrollDepth: maxDepth });

    for (var s in dwell) {
      if (!Object.prototype.hasOwnProperty.call(dwell, s)) continue;
      var ms = dwell[s];
      /* ⚠️ 1초 미만은 보내지 않습니다 — 스쳐 지난 것을 「머물렀다」로 세지 않습니다. */
      if (ms < 1000) continue;
      sendApp({ kind: 'pageview', section: s, dwellMs: ms > DWELL_MAX_MS ? DWELL_MAX_MS : ms });
    }
  }

  /*
   * 🔴 `pagehide` 를 씁니다 — `beforeunload` 는 모바일 사파리에서 안 옵니다.
   *    `visibilitychange`(hidden)도 함께 겁니다(탭 전환 후 안 돌아오는 경우).
   */
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });

  /* ══════════════ 클릭 · 다음 걸음 ══════════════ */

  /* 어느 영역 안에서 눌렸는가 — 영역 밖이면 null 입니다(짐작하지 않습니다). */
  function sectionOf(el) {
    var node = el;
    while (node && node !== document.body) {
      if (node.getAttribute && node.getAttribute('data-section')) {
        return node.getAttribute('data-section');
      }
      node = node.parentNode;
    }
    return null;
  }

  /*
   * 「다음 걸음」은 **어느 버튼을 눌렀는가와 다른 물음**입니다 — 버튼 이름은 자리마다 다르고
   * (`hero-precheck`·`step1-precheck`·`final-precheck`) 다음 걸음은 **어디로 갔는가**입니다.
   * 그래서 목적지에서 파생시킵니다. ⛔ 둘을 한 값으로 합치지 마십시오 — 합치면 「사전점검으로
   * 간 사람이 몇인가」에 답하려면 버튼 이름을 전부 알아야 합니다.
   */
  function nextStepOf(href) {
    if (!href) return null;
    if (href.indexOf('/insurance/quick') !== -1) return 'prep-pack';
    if (href.indexOf('/export-precheck') !== -1) return 'export-precheck';
    if (href.indexOf('/precheck') !== -1) return 'precheck';
    if (href.indexOf('/contact') !== -1) return 'contact';
    return null;
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track]');
    if (!el) return;
    var label = el.getAttribute('data-track');
    var section = sectionOf(el);

    sendLegacy({ kind: 'click', path: location.pathname, label: label });
    sendApp({ kind: 'click', label: label, section: section });

    var step = nextStepOf(el.getAttribute('href'));
    if (step) sendApp({ kind: 'click', label: 'next:' + step, section: section });
  });
})();
