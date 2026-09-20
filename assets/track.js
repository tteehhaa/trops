/*
 * track.js — 페이지 조회·버튼 클릭·영역 계측 〔2026-08-18 신설 · 2026-09-04 영역 축 추가
 *                                          · 2026-09-15 같은 오리진 경로 철거〕
 *
 * 보내는 곳은 **하나**입니다 — 앱 `app.trops.kr/api/track`.
 *
 * ── 🔴 종전의 둘째 경로를 걷었습니다 〔2026-09-15 · 앞단 폐지〕 ─────────────
 * 종전에는 같은 오리진 `/api/track` → `public.page_events`(칸 3개)로도 보냈습니다.
 * 그 표는 **앞단 Supabase**(뭄바이 trops-precheck)에 있고 그 프로젝트를 폐지합니다.
 * 앱 엔드포인트가 **같은 것을 더 많이** 받으므로(영역·체류·스크롤·세션) `page_events`
 * 는 그 부분집합이고, 걷어도 **잃는 집계가 없습니다.**
 * ⛔ 같은 오리진 호출을 되살리지 마십시오 — 그 표가 곧 사라집니다.
 *    되살려야 할 이유가 생기면 그것은 「본체에 표를 만드는」 이야기이지
 *    `api/track.js` 를 다시 부르는 이야기가 아닙니다.
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
 * ⚠️ 위 「쿠키를 만들지도 읽지도 않습니다」는 **이 파일의** 이야기입니다 〔2026-09-12〕.
 *    같은 사이트의 GA4(8장 <head> 의 gtag 스니펫)는 쿠키를 심습니다 — 방침 §01 의
 *    셋째 예외가 그것을 적습니다. ⛔ 그 둘을 한 문장으로 뭉치지 마십시오.
 *
 * ⚠️ 본문을 `text/plain` 으로 보냅니다 — 다른 오리진이라 `application/json` 이면 preflight
 *    가 필요해지고 `sendBeacon` 은 preflight 를 못 해 **조용히** 실패합니다. 받는 쪽은
 *    선언된 타입과 무관하게 본문을 파싱합니다.
 *
 * 히트맵·세션 재생이 아닙니다. 클릭은 `data-track` 이 붙은 요소만 셉니다.
 */
(function () {
  'use strict';

  var APP_ENDPOINT = 'https://app.trops.kr/api/track';

  var SS_KEY = 'trops_vs';
  var SS_RET = 'trops_vs_r';
  var SS_SRC = 'trops_vs_s';
  var SS_REF = 'trops_vs_h';
  /*
   * 🔴 **유입원 원문** 〔2026-09-20〕 — `?from=` 으로 들어온 값을 그 방문 내내 이어 씁니다.
   *    같은 오리진을 옮겨 다니면 쿼리가 사라지므로 방문 열쇠와 «같은 그릇·같은 수명»에 둡니다.
   *    ⚠️ 채널 코드입니다 — 이름·연락처·기기 정보가 아닙니다(개인 식별자 0).
   *       `privacy.html` §01 이 이 칸을 적고 있습니다. 이름을 바꾸면 그 문장도 함께 고치십시오.
   */
  var SS_FROM = 'trops_vs_f';
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

  /*
   * ── 유입원(`from`) ─────────────────────────────────────────────────────
   *
   * 🔴 **무엇인가** — 「어느 지면 · 어느 제휴에서 왔는가」입니다. 앱이 이 값을
   *    `export_precheck_run.from_source_raw` 에 **접지 않고 원문 그대로** 적습니다(0075).
   *
   * ⛔ **목록으로 거르지 마십시오.** 모르는 값을 버리면 이 장치가 없애려던 손실이 랜딩에서
   *    그대로 재발합니다 — 앱이 접지 않고 저장하는 것이 그 칸의 존재 이유입니다.
   * ⛔ **`source=one_minute_check` 를 대신하지 마십시오.** 그것은 Handoff Contract v2 의
   *    canonical 키로 「1분 체크 답을 갖고 왔다」를 뜻하고(앱에서 불리언 하나로 쓰입니다),
   *    이 값은 「어디서 왔는가」입니다. 둘은 다른 축이고 한 값으로 합치면 둘 다 잃습니다.
   *    ⚠️ 그 키는 `precheck.html` 의 `query()` 가 만듭니다 — 여기서 만들지 않습니다.
   * ⛔ **`utm_*` 를 건드리지 마십시오.** 위 `source()` 가 `utm_medium` 을 유입 «갈래» 판정에
   *    씁니다. 그 축은 방문 계측이고 이 축은 실행 행에 남는 값입니다.
   * ⚠️ **100자에서 자릅니다** — 앱도 자릅니다. 잘린 값이 두 곳에서 같아야 합니다.
   *    ⚠️ 여기는 UTF-16 단위로 자릅니다. 제휴 코드는 ASCII 라 실제로는 같지만, 서로게이트
   *       쌍이 든 값이 오면 앱의 글자 수 기준과 어긋날 수 있습니다.
   */

  /** 진입 쿼리의 `from` 을 한 방문에 «한 번만» 담습니다 — 첫 값이 그 방문의 값입니다. */
  function seedFrom() {
    /*
     * 🔴 **첫 값 우선**입니다 〔2026-09-20 · 대표 확인〕 — 위 `source()` 와 같은 방식이고,
     *    「그 방문 내내 이어 쓴다」가 그 뜻입니다.
     *    ⚠️ 나중 값으로 바꾸려면 이 이른 반환을 걷으면 됩니다. 그때 한 방문 안에서 제휴
     *       귀속이 옮겨 다닌다는 것을 알고 바꾸십시오 — 정산이 걸린 축입니다.
     */
    if (ssGet(SS_FROM)) return;
    var v;
    try { v = new URLSearchParams(location.search).get('from') || ''; } catch (e) { return; }
    v = v.replace(/^\s+|\s+$/g, '');
    if (v) ssSet(SS_FROM, v.slice(0, 100));
  }

  /**
   * 지금 이 클릭에 실을 값.
   * 🔴 **지면 기본값은 경로에서 «파생»합니다** — 파일마다 상수를 심으면 페이지가 늘 때
   *    한쪽만 붙습니다. ⛔ 여기 페이지 이름을 늘어놓지 마십시오.
   * ⚠️ 저장소가 막힌 브라우저에서는 제휴 코드를 못 잇고 지면 기본값으로 떨어집니다 —
   *    그래도 「어느 지면에서 왔는가」는 남습니다.
   */
  function currentFrom() {
    var v = ssGet(SS_FROM);
    /*
     * ⚠️ **`.html` 까지 받습니다** 〔2026-09-20 실측〕. 프로덕션은 `cleanUrls:true` 라
     *    주소가 `/precheck` 이지만, 로컬 `dist/` 와 `.html` 을 직접 연 경우는
     *    `/precheck.html` 입니다. 처음에 그 꼴을 빼 두었더니 **지면이 `landing` 으로
     *    떨어졌습니다** — 브라우저로 눌러 보고서야 나왔습니다.
     * ⚠️ 꼬리를 `(\/|$)` 로 닫아 둡니다 — 없으면 `/precheckers` 같은 주소가
     *    사전점검으로 잡힙니다.
     */
    if (!v) v = /^\/precheck(\.html)?(\/|$)/.test(location.pathname) ? 'precheck' : 'landing';
    return v.slice(0, 100);
  }

  var ID = identity();
  var SRC = source();
  seedFrom();

  /*
   * 🔴 **앱으로는 `text/plain;charset=UTF-8` 입니다.** CORS 안전 목록이라 preflight 가
   *    붙지 않습니다. `application/json` 이면 preflight 가 필요해지고 `sendBeacon` 은
   *    preflight 를 못 해 **조용히** 실패합니다.
   *
   * ⚠️ 형식은 여전히 **인자로 받습니다.** 보내는 곳이 지금은 하나뿐이지만, 함수 안에
   *    박아 두면 둘째 자리가 생기는 날 조용히 잘못된 형식으로 나갑니다 —
   *    2026-09-04 에 정확히 그 사고가 있었습니다(같은 오리진에 text/plain 을 보내
   *    전 건이 400 이었고, 검사가 그것을 green 으로 통과시켰습니다).
   */
  function post(url, payload, beacon, contentType) {
    var body = JSON.stringify(payload);
    if (beacon) {
      try {
        var blob = new Blob([body], { type: contentType });
        if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
      } catch (e) { /* fetch 로 폴백합니다 */ }
    }
    try {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: body,
        keepalive: true,
        mode: 'cors',
      })['catch'](function () { /* 집계 실패는 화면 동작에 영향을 주지 않습니다 */ });
    } catch (e) { /* 조용히 포기합니다 — 집계는 부가 기능입니다 */ }
  }

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
    post(APP_ENDPOINT, body, beacon !== false, 'text/plain;charset=UTF-8');
  }

  /* ── 페이지 조회 ── */
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

    sendApp({ kind: 'click', label: label, section: section });

    var step = nextStepOf(el.getAttribute('href'));
    if (step) sendApp({ kind: 'click', label: 'next:' + step, section: section });
  });

  /*
   * 🔴 앱으로 가는 링크에 «이 방문의 익명 열쇠»를 실어 보냅니다 〔2026-09-20 · 대표 지시〕.
   *    trops.kr 과 app.trops.kr 은 도메인이 달라 같은 탭이어도 방문 열쇠가 따로 생겼고, 그래서
   *    「랜딩 버튼 클릭 → 앱에서 무엇을 했나」가 이어지지 않았습니다. 앱은 이 값(`vs`)을 받아 같은
   *    열쇠로 이어 쓰고 주소창에서 곧바로 지웁니다(공유된 링크가 다른 사람의 방문을 섞지 않게).
   *    ⚠️ 열쇠는 한 방문짜리 난수입니다 — 이름·연락처·기기 정보가 아닙니다(개인 식별자 0).
   *    누르는 순간(`click` · 캡처 단계)에 붙이므로 data-track 이 없는 링크도 이어집니다.
   */
  var APP_ORIGIN = 'https://app.trops.kr';
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
    if (url.origin !== APP_ORIGIN) return;

    /*
     * 🔴 **이미 `from` 이 있으면 손대지 않습니다** 〔2026-09-20〕 — `/insurance/quick` 의
     *    `from=landing` · `from=precheck` 두 링크가 그렇습니다. 그 칸(0053)은 **닫힌 5값**
     *    집계 축이라, 제휴 코드가 들어가면 그 축이 깨집니다.
     *    ⛔ `set` 으로 바꾸지 마십시오 — 이 `if` 가 두 축을 갈라 놓는 전부입니다.
     */
    if (!url.searchParams.get('from')) url.searchParams.set('from', currentFrom());

    /*
     * ⚠️ **열쇠 검사보다 `from` 이 «먼저»입니다.** 종전에는 여기서 곧바로 `return` 했고,
     *    그래서 사생활 보호 모드처럼 저장소가 막힌 브라우저에서는 **아무것도 붙지 않았습니다.**
     *    열쇠는 못 이어도 유입원은 실어 보냅니다. ⛔ 이 둘의 순서를 되돌리지 마십시오.
     */
    var key = ID.sessionKey;
    if (key) url.searchParams.set('vs', key);

    a.setAttribute('href', url.toString());
  }, true);
})();
