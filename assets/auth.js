/*!
 * auth.js — 랜딩 헤더 로그인 영역(3a·3d-A) + 로그인 모달(3c)
 *
 * 스펙 정본: dd-now/console_handoff/HANDOFF.md (trops_a 저장소) §2.2 · §2.3 · §3.2.
 *
 * ── 어느 Supabase 인가 ────────────────────────────────────────────
 * 앱(app.trops.kr · trops_a)의 **프로덕션 auth 프로젝트**입니다. 접수용
 * trops-precheck(api/_supabase.js)와 다른 프로젝트이며 폴백 관계가 아닙니다.
 * publishable 키는 브라우저에 노출되도록 설계된 키이고, 같은 값이 이미
 * app.trops.kr 의 클라이언트 번들에 실려 있습니다(2026-08-20 실측).
 *
 * ── 세션 공유 ────────────────────────────────────────────────────
 * @supabase/ssr 가 세션을 쿠키(sb-<ref>-auth-token)에 저장합니다. 도메인을
 * `.trops.kr` 로 올리면 app.trops.kr 이 같은 쿠키를 읽어 재로그인이 없습니다.
 * 판정 규칙은 trops_a lib/supabase/cookie-domain.ts 와 같습니다 — trops.kr
 * 계열 호스트에서만 도메인을 올리고, vercel.app 프리뷰·로컬에서는 호스트
 * 전용 쿠키로 그 호스트 안에서만 동작합니다(도메인이 호스트와 안 맞는
 * 쿠키는 브라우저가 통째로 거부합니다).
 *
 * ── 🔄 헤더를 납작한 한 줄로 (2026-08-21 · 대표 지시) ─────────────
 * 종전 헤더는 「사용자 칩(드롭다운) + 파란 [나의 대시보드] 버튼」이었습니다. 대표가
 * 실측 스크린샷을 보고 「EN · c contact · 나의 대시보드가 다 이상하다」고 지적했고,
 * 원인은 셋이었습니다:
 *   ① 칩의 이름 텍스트(`contact`)가 옆 nav 링크(서비스·이용 방법)와 같은 무게로 읽혀
 *      **메뉴 항목처럼** 보였습니다 — 그것은 계정 표시인데 nav 로 읽힙니다.
 *   ② 같은 계정 하나에 조작 지점이 둘(칩 드롭다운 + 파란 버튼)이었습니다.
 *   ③ 파란 채움 버튼이 히어로의 메인 CTA(30초 만에 알아보기)와 무게를 다퉜습니다 —
 *      이 파일 위쪽 nav 주석이 「app 진입은 저채도 텍스트 링크로만」이라 적어 둔 규칙을
 *      정작 이 영역이 깨고 있었습니다.
 * 그래서 app.trops.kr 헤더(`components/account-header.tsx`)와 **같은 패턴**으로 내렸습니다 —
 * 아바타 + 이름 + 회색 텍스트 링크, 드롭다운 0 · 채움 버튼 0. 두 헤더가 형제로 보입니다.
 *
 * 🔴 **표시 규칙도 앱과 같은 것 하나로 합쳤습니다.** 종전에는 이 파일만
 *    `user_metadata.name` 을 먼저 보고(있으면 「홍길동」·영문 이니셜 2자) 없을 때
 *    로컬파트를 썼습니다. 앱의 `SessionUser` 는 `{id, email}` 뿐이고 저장소 전체에
 *    `user_metadata` 를 **쓰는 코드가 0건**입니다(2026-08-21 실측) — 즉 그 분기는 지금
 *    닿지 않는 길이면서, 언젠가 이름을 받기 시작하는 날 **두 헤더가 서로 다른 이름을
 *    말하게** 되어 있었습니다. 규칙은 앱의 `initialOf`·`displayNameOf` 와 한 글자까지
 *    같습니다(로컬파트 8자 · 초과 시 ellipsis · 전문은 `title`).
 * ⚠️ 이름을 받기 시작하면 **두 파일을 같이** 고치십시오. 한쪽만 고치면 랜딩과 앱이
 *    같은 사람을 다른 이름으로 부릅니다.
 *
 * ── 🔄 계정 3요소를 아바타 메뉴 안으로 (2026-08-21 2차 · 대표 지시) ──
 * 「그 아이콘 안으로 필요한 메뉴 넣어주고 나머진 안 보이게 해줘 — contact · TROPS 홈 ·
 * 나의 대시보드 이 3개」. 그래서 헤더에 남는 것은 **[EN] 과 아바타 하나**뿐입니다.
 *
 *   랜딩(여기)      EN │ (C)▾ → [contact · 이메일] [나의 대시보드] [로그아웃]
 *   앱(app.trops.kr) EN  (C)▾ → [contact · 이메일] [TROPS 홈]      [로그아웃]
 *
 * 즉 **양쪽이 같은 자리에서 상대편으로 건너갑니다** — 랜딩 메뉴는 앱으로, 앱 메뉴는
 * 랜딩으로. 같은 아바타를 누르면 「지금 없는 쪽」이 나옵니다.
 *
 * 🔴 **이름 텍스트가 헤더에서 사라졌습니다.** 아바타 옆 `contact` 는 아바타와 같은 말을
 *    두 번 하고 있었고(대표 지적), 이제 메뉴 머리에서 이메일 전문과 함께 한 번만 말합니다.
 * 🔴 **아바타에 캐럿(▾)을 붙였습니다.** 종전에는 `aria-hidden` 인 장식용 원이었고 실제로
 *    「이 c 아이콘은 뭘 의미하냐」는 질문을 받았습니다 — 이제 누르는 것이 됐으므로 누를 수
 *    있다고 화면에 적습니다. ⛔ 캐럿을 떼지 마십시오: 떼면 다시 장식으로 읽힙니다.
 * ⛔ [EN] 은 메뉴에 넣지 않습니다 — 언어 전환은 계정이 아니고, 로그인하지 않은 방문자도
 *    써야 합니다(전 페이지 헤더에 같은 자리로 두기로 한 것이 같은 날 1차 지시입니다).
 *
 * ── 이 모달에 없는 것 2가지 (핸드오프 3c 대비 · 의도된 차이) ──────
 * ① 「이메일 링크로 로그인」— 매직링크(signInWithOtp)는 창업자 결정
 *    (2026-08-10 폐기 · 2026-08-12 제거)으로 앱 전체 0건이며 되살리지
 *    않습니다. 비밀번호를 정하지 않은 계정이 가는 길은 비밀번호 재설정입니다.
 * ② 「로그인 상태 유지」체크박스 — 세션은 쿠키로 항상 유지되고, 앱 쪽
 *    미들웨어가 갱신 시 자기 수명으로 다시 쓰므로 랜딩의 체크박스가 그
 *    약속을 지킬 수 없습니다. 동작하지 않는 스위치를 두지 않습니다.
 */

import { createBrowserClient } from '/assets/vendor/supabase-ssr.js';

const SUPABASE_URL = 'https://bdlqjhxwqqvigqtwklqi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_7-FA5xV378-txqHWOBnfpA_iX8J_GH0';
const APP_ORIGIN = 'https://app.trops.kr';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILURES = 5;      // §3.2 — 5회 실패 시
const LOCK_SECONDS = 30;     //        30초 잠금 안내

/*
 * 실패 문구는 trops_a 화면 B(AUTH_UI_LOGIN.failed)와 같은 문장입니다 —
 * 이메일·비밀번호를 구분하지 않습니다(계정 존재 여부 비노출).
 * 「이메일 미인증」만 갈라 말합니다: 그 오류는 비밀번호가 맞아야만 나오므로
 * 계정 열람 권한이 있는 본인에게만 보입니다(열거 위험 없음).
 */
const COPY = {
  ko: {
    login: '로그인',
    start: '무료로 시작하기',
    dashboard: '나의 대시보드',
    logout: '로그아웃',
    title: '다시 오셨네요',
    sub: '진단 결과와 계약 현황을 이어서 확인하세요.',
    emailLabel: '이메일',
    emailPlaceholder: 'name@company.co.kr',
    passwordLabel: '비밀번호',
    forgot: '비밀번호를 잊으셨나요?',
    submit: '로그인',
    showPassword: '비밀번호 표시',
    hidePassword: '비밀번호 감추기',
    close: '닫기',
    account: '계정',
    accountMenu: '계정 메뉴',
    signupLead: '아직 계정이 없으세요?',
    signupLink: '무료로 가입하기',
    errEmailFormat: '이메일 형식을 확인해 주세요.',
    errFailed: '이메일 또는 비밀번호가 맞지 않습니다.',
    errUnconfirmed: '가입 확인 메일의 링크를 누른 뒤 다시 로그인해 주세요.',
    errNetwork: '연결에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    errLocked: '로그인 시도가 ' + MAX_FAILURES + '회 실패해 ' + LOCK_SECONDS +
      '초 동안 잠급니다. 잠시 후 다시 시도해 주세요.',
  },
  en: {
    login: 'Log in',
    start: 'Start free',
    dashboard: 'My dashboard',
    logout: 'Log out',
    title: 'Welcome back',
    sub: 'Pick up your results and contract status where you left off.',
    emailLabel: 'Email',
    emailPlaceholder: 'name@company.com',
    passwordLabel: 'Password',
    forgot: 'Forgot your password?',
    submit: 'Log in',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    close: 'Close',
    account: 'Account',
    accountMenu: 'Account menu',
    signupLead: 'New to trops?',
    signupLink: 'Sign up free',
    errEmailFormat: 'Please check the email format.',
    errFailed: 'The email or password does not match.',
    errUnconfirmed: 'Please open the link in your confirmation email, then log in again.',
    errNetwork: 'Connection failed. Please try again shortly.',
    errLocked: 'Login was locked for ' + LOCK_SECONDS + ' seconds after ' +
      MAX_FAILURES + ' failed attempts. Please try again shortly.',
  },
};

/* ── Supabase 클라이언트 ─────────────────────────────────────────── */

let client = null;
function supabase() {
  if (!client) {
    const host = location.hostname.toLowerCase();
    const domain =
      host === 'trops.kr' || host.endsWith('.trops.kr') ? '.trops.kr' : undefined;
    client = createBrowserClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      domain ? { cookieOptions: { domain: domain } } : undefined
    );
  }
  return client;
}

/* ── 아이콘 (lucide 패스 · 핸드오프 §5 크기·굵기) ────────────────── */

function icon(name, size, strokeWidth) {
  /*
   * ⛔ 소비처 0인 아이콘을 남기지 않습니다 — `arrow-right`·`dashboard`·`logout` 3종은
   *    드롭다운 메뉴와 채움 버튼이 사라지며 부르는 곳이 없어졌습니다(2026-08-21).
   *    남겨 두면 다음 화면이 근거 없이 집어 씁니다.
   */
  const paths = {
    mail:
      '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    lock:
      '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eye:
      '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/>' +
      '<circle cx="12" cy="12" r="3"/>',
    'eye-off':
      '<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>' +
      '<path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>' +
      '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="m2 2 20 20"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  };
  return (
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="' + strokeWidth + '" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>'
  );
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

/* ── 사용자 표시 (핸드오프 §2.2 · §4.3) ──────────────────────────────
 * 🔴 아래 두 함수는 앱 `components/account-header.tsx` 의 `initialOf`·`displayNameOf`
 *    **같은 규칙**입니다(값·상한·폴백까지). 한쪽만 고치지 마십시오 — 같은 사람을 두
 *    헤더가 다른 이름으로 부르게 됩니다(파일 머리 주석 참조).
 */

/** 표시 이름 상한 — 핸드오프 §2.2 「최대 8자 → 초과 시 ellipsis」. */
const NAME_MAX = 8;

/** 이메일 → 아바타 이니셜 1자. 비ASCII 는 그대로 둡니다(한글은 대소문자가 없습니다). */
function initialOf(email) {
  const first = String(email || '').trim().charAt(0);
  return first ? first.toUpperCase() : '?';
}

/**
 * 이메일 → 헤더 표시명(로컬파트 8자 · 초과분은 `…`).
 * ⛔ 도메인을 붙이지 않습니다 — 폭만 먹고 계정 식별에 기여하지 않습니다(전문은 `title`).
 */
function displayNameOf(email) {
  const local = String(email || '').trim().split('@')[0] || '';
  if (!local) return T.account;
  return local.length > NAME_MAX ? local.slice(0, NAME_MAX) + '…' : local;
}

/* ── 헤더 상태 렌더 (§3.2 — 비로그인 / 세션 확인 중 / 로그인 완료) ── */

const area = document.getElementById('trops-auth');
const lang = area && area.getAttribute('data-auth-lang') === 'en' ? 'en' : 'ko';
const T = COPY[lang];

function renderSkeleton() {
  area.innerHTML =
    '<span class="ta-divider" aria-hidden="true"></span>' +
    '<span class="ta-skeleton" aria-hidden="true"></span>';
}

/*
 * 🔴 링크·버튼은 랜딩의 `.nav-quiet`(index.html·en.html <style>)를 **그대로 입습니다** —
 *    바로 왼쪽 [EN] 이 쓰는 그 클래스입니다. 색·크기 사본을 auth.css 에 두면 한 줄 안에서
 *    두 회색이 갈립니다(실제로 갈려 있었습니다). `.ta-link` 는 <button> 을 링크처럼
 *    보이게 하는 초기화(배경·테두리·패딩·폰트 상속)만 갖습니다.
 */
function renderSignedOut() {
  area.innerHTML =
    '<span class="ta-divider" aria-hidden="true"></span>' +
    '<button type="button" class="nav-quiet ta-link" data-track="nav_login">' +
    esc(T.login) + '</button>' +
    '<a class="ta-start" href="' + APP_ORIGIN + '/account/password" data-track="nav_signup">' +
    esc(T.start) + '</a>';
  area.querySelector('[data-track="nav_login"]').addEventListener('click', openModal);
}

/*
 * 로그인 완료 — 아바타 버튼 하나 + 그 안의 메뉴 3요소 (3d-A · 3d-C).
 *
 * 🔴 **헤더에 보이는 것은 아바타뿐입니다.** 계정 이름·상대 오리진 링크·로그아웃이 전부
 *    메뉴 안입니다(파일 머리 주석의 대표 지시). 종전 납작한 줄에서 되돌린 것이 아니라
 *    **더 접은 것**입니다 — 그때는 이름이 헤더에 남아 아바타와 겹쳐 말했습니다.
 * 🔴 메뉴는 **열 때 만들고 닫을 때 지웁니다**(DOM 에 상주하지 않습니다). 닫힌 메뉴가
 *    남아 있으면 `hidden` 을 빠뜨린 순간 조용히 화면에 나타납니다.
 * ⚠️ 바깥 클릭·Escape 로 닫고, 닫을 때 포커스를 버튼으로 되돌립니다 — 키보드 사용자가
 *    메뉴를 닫은 뒤 문서 처음으로 튕기지 않게 하는 자리입니다.
 */
function renderSignedIn(user) {
  const email = String(user.email || '');
  area.innerHTML =
    '<span class="ta-divider" aria-hidden="true"></span>' +
    '<div class="ta-menu-wrap">' +
    '<button type="button" class="ta-avatar-btn" aria-haspopup="menu" aria-expanded="false" ' +
    'aria-label="' + esc(T.accountMenu) + '">' +
    '<span class="ta-avatar" aria-hidden="true">' + esc(initialOf(email)) + '</span>' +
    '<span class="ta-caret" aria-hidden="true"></span>' +
    '</button>' +
    '</div>';

  const wrap = area.querySelector('.ta-menu-wrap');
  const button = area.querySelector('.ta-avatar-btn');

  function open() {
    const menu = document.createElement('div');
    menu.className = 'ta-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML =
      '<div class="ta-menu-head">' +
      '<div class="ta-menu-name">' + esc(displayNameOf(email)) + '</div>' +
      (email ? '<div class="ta-menu-mail">' + esc(email) + '</div>' : '') +
      '</div>' +
      '<a class="ta-menu-item" role="menuitem" href="' + APP_ORIGIN + '/" ' +
      'data-track="nav_dashboard">' + esc(T.dashboard) + '</a>' +
      '<button type="button" class="ta-menu-item" role="menuitem" data-track="nav_logout">' +
      esc(T.logout) + '</button>';
    wrap.appendChild(menu);
    button.setAttribute('aria-expanded', 'true');

    menu.querySelector('[data-track="nav_logout"]').addEventListener('click', function () {
      close();
      // 실패해도 토스트를 띄우지 않습니다 — onAuthStateChange 가 상태를 되돌립니다(§3.2).
      supabase().auth.signOut().catch(function () {});
    });
    // 여는 클릭 자체가 바깥 클릭으로 잡히지 않게 한 틱 뒤에 붙입니다.
    setTimeout(function () {
      document.addEventListener('click', onOutside);
      document.addEventListener('keydown', onKey);
    }, 0);
    menu.querySelector('.ta-menu-item').focus();
  }

  function close() {
    const menu = wrap.querySelector('.ta-menu');
    if (!menu) return;
    menu.remove();
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutside);
    document.removeEventListener('keydown', onKey);
  }

  function onOutside(e) {
    if (!wrap.contains(e.target)) close();
  }

  function onKey(e) {
    if (e.key !== 'Escape') return;
    close();
    button.focus();
  }

  button.addEventListener('click', function () {
    if (wrap.querySelector('.ta-menu')) close();
    else open();
  });
}

function renderFor(session) {
  if (session && session.user) renderSignedIn(session.user);
  else renderSignedOut();
}

/* ── 로그인 모달 (3c) ────────────────────────────────────────────── */

let overlay = null;
let lastFocus = null;
let failures = 0;
let lockedUntil = 0;

function modalHtml() {
  return (
    '<div class="ta-modal" role="dialog" aria-modal="true" aria-labelledby="ta-title">' +
    '<button type="button" class="ta-close" aria-label="' + esc(T.close) + '">' +
    icon('x', 17, 2) + '</button>' +
    '<span class="ta-logo">trops</span>' +
    '<h2 class="ta-title" id="ta-title">' + esc(T.title) + '</h2>' +
    '<p class="ta-sub">' + esc(T.sub) + '</p>' +
    '<form class="ta-form" novalidate>' +
    '<div>' +
    '<div class="ta-label-row"><label class="ta-label" for="ta-email">' + esc(T.emailLabel) +
    '</label></div>' +
    '<div class="ta-field" data-field="email">' + icon('mail', 16, 1.7) +
    '<input id="ta-email" type="email" autocomplete="email" placeholder="' +
    esc(T.emailPlaceholder) + '">' +
    '</div>' +
    '</div>' +
    '<div>' +
    '<div class="ta-label-row"><label class="ta-label" for="ta-password">' +
    esc(T.passwordLabel) + '</label>' +
    '<a class="ta-forgot" href="' + APP_ORIGIN + '/reset-password">' + esc(T.forgot) + '</a></div>' +
    '<div class="ta-field" data-field="password">' + icon('lock', 16, 1.7) +
    '<input id="ta-password" type="password" autocomplete="current-password">' +
    '<button type="button" class="ta-eye" aria-label="' + esc(T.showPassword) + '" aria-pressed="false">' +
    icon('eye', 16, 1.7) + '</button>' +
    '</div>' +
    '</div>' +
    '<p class="ta-error" hidden></p>' +
    '<button type="submit" class="ta-submit">' + esc(T.submit) + '</button>' +
    '</form>' +
    '<p class="ta-signup-line">' + esc(T.signupLead) + ' ' +
    '<a href="' + APP_ORIGIN + '/account/password" data-track="modal_signup">' +
    esc(T.signupLink) + '</a></p>' +
    '</div>'
  );
}

function openModal() {
  if (overlay) return;
  lastFocus = document.activeElement;
  overlay = document.createElement('div');
  overlay.className = 'ta-overlay';
  overlay.innerHTML = modalHtml();
  document.body.appendChild(overlay);

  const emailInput = overlay.querySelector('#ta-email');
  const passwordInput = overlay.querySelector('#ta-password');
  const form = overlay.querySelector('.ta-form');
  const eye = overlay.querySelector('.ta-eye');

  overlay.addEventListener('mousedown', function (e) {
    if (e.target === overlay) closeModal();
  });
  overlay.querySelector('.ta-close').addEventListener('click', closeModal);
  document.addEventListener('keydown', onModalKey);

  eye.addEventListener('click', function () {
    const show = passwordInput.type === 'password';
    passwordInput.type = show ? 'text' : 'password';
    eye.innerHTML = icon(show ? 'eye-off' : 'eye', 16, 1.7);
    eye.setAttribute('aria-label', show ? T.hidePassword : T.showPassword);
    eye.setAttribute('aria-pressed', show ? 'true' : 'false');
    passwordInput.focus();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    void submitLogin(overlay, emailInput, passwordInput);
  });

  emailInput.focus();
}

function onModalKey(e) {
  if (e.key === 'Escape') closeModal();
}

function closeModal() {
  if (!overlay) return;
  document.removeEventListener('keydown', onModalKey);
  overlay.remove();
  overlay = null;
  if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
}

function showError(root, message, fields) {
  const box = root.querySelector('.ta-error');
  box.textContent = message;
  box.hidden = false;
  for (const field of root.querySelectorAll('.ta-field')) {
    field.classList.toggle(
      'ta-field-error',
      Boolean(fields && fields.indexOf(field.getAttribute('data-field')) !== -1)
    );
  }
}

function clearError(root) {
  const box = root.querySelector('.ta-error');
  box.hidden = true;
  box.textContent = '';
  for (const field of root.querySelectorAll('.ta-field')) {
    field.classList.remove('ta-field-error');
  }
}

/**
 * 데모 계정인지 앱에 물어보고, 맞으면 갈 곳을 돌려받습니다.
 *
 * 🔴 판정·쿠키·목적지는 전부 앱이 합니다. 이 함수가 아는 것은 **「가라」 또는 「모른다」** 뿐입니다.
 * ⚠️ 프리뷰(`*.vercel.app`)에서는 CORS 오리진 목록 밖이라 항상 `null` 입니다 — 의도된 결과이며,
 *    그 환경의 확인은 앱의 `/login` 으로 합니다.
 *
 * @returns {Promise<string|null>} 앱 오리진 기준 경로(예: `/demo`) 또는 null
 */
async function tryDemoLogin(loginId, password) {
  try {
    const res = await fetch(APP_ORIGIN + '/api/demo/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ loginId: loginId, password: password }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data.to === 'string' ? data.to : null;
  } catch (err) {
    // 네트워크·CORS 실패 — 「데모가 아니다」와 같게 취급하고 일반 인증으로 내려갑니다.
    return null;
  }
}

async function submitLogin(root, emailInput, passwordInput) {
  const submit = root.querySelector('.ta-submit');
  if (Date.now() < lockedUntil) {
    showError(root, T.errLocked, []);
    return;
  }
  const email = emailInput.value.trim();
  if (!EMAIL_RE.test(email)) {
    showError(root, T.errEmailFormat, ['email']);
    return;
  }
  clearError(root);
  submit.disabled = true;
  try {
    /*
     * ── 데모 계정 분기 (창업자 지시 2026-08-24) ───────────────────────────
     *
     * 🔴 **여기서 «판정»하지 않습니다.** 이 저장소는 데모 인증을 할 수 없습니다 —
     *    비밀번호는 bcrypt(해시는 앱 서버만 읽습니다), 세션은 HMAC 서명 쿠키
     *    (비밀값은 브라우저에 내려올 수 없습니다), 5회 잠금은 DB 카운터입니다.
     *    그래서 **앱의 문 하나를 부르고 결과만 받습니다** — 분기 규칙은 전부 저쪽
     *    (`trops_a` `lib/demo/login-attempt.ts`)에 있고, 이 저장소에는 복제본이 0입니다.
     *    조사 정본: `trops_a` `docs/prd/demo/IMPACT_MAP.md` 부록 A.
     *
     * 🔴 **데모 먼저 시도합니다** — 앱의 `/login` 과 «같은 순서»입니다. 두 입구가 순서까지
     *    같아야 같은 아이디가 어느 문으로 들어와도 같은 곳에 도착합니다.
     *
     * 🔴 **`to` 가 없으면 아래 기존 인증이 그대로 이어집니다.** 데모 계정이 아니든,
     *    데모 계정인데 비밀번호가 틀렸든 응답은 똑같이 `{to:null}` 입니다 —
     *    그래서 사용자는 여느 실패와 **같은 문장**을 받고, 데모 계정임이 드러나지 않습니다.
     *    ⛔ 이 블록 때문에 일반 계정의 동작이 달라지는 곳은 없습니다.
     *
     * ⚠️ **전체 페이지 이동입니다.** 데모 셸(사이드바·상단 바)은 앱의 루트 레이아웃이
     *    쿠키를 읽어 그립니다 — SPA 이동으로는 그 레이아웃이 다시 그려지지 않습니다.
     * ⚠️ `credentials: 'include'` 가 필수입니다 — 앱이 내려주는 세션 쿠키를 저장해야 합니다.
     *    trops.kr 과 app.trops.kr 은 **same-site** 라 이 쿠키는 정상 저장됩니다(서드파티 차단은
     *    cross-site 에 걸립니다). 같은 전제 위에서 Supabase 세션도 이미 공유되고 있습니다.
     * ⚠️ 실패는 **삼키고** 일반 인증으로 내려갑니다 — 데모 문이 죽었다고 로그인이 막히면 안 됩니다.
     */
    const demo = await tryDemoLogin(email, passwordInput.value);
    if (demo) {
      window.location.assign(APP_ORIGIN + demo);
      return;
    }

    const result = await supabase().auth.signInWithPassword({
      email: email,
      password: passwordInput.value,
    });
    if (result.error || !result.data || !result.data.session) {
      failures += 1;
      if (failures >= MAX_FAILURES) {
        // §3.2 — 5회 실패 시 30초 잠금 안내
        failures = 0;
        lockedUntil = Date.now() + LOCK_SECONDS * 1000;
        showError(root, T.errLocked, ['email', 'password']);
        submit.disabled = true;
        setTimeout(function () {
          if (overlay) {
            overlay.querySelector('.ta-submit').disabled = false;
            clearError(overlay);
          }
        }, LOCK_SECONDS * 1000);
        return;
      }
      const code = result.error && result.error.code;
      showError(
        root,
        code === 'email_not_confirmed' ? T.errUnconfirmed : T.errFailed,
        ['email', 'password']
      );
      submit.disabled = false;
      return;
    }
    // 성공 — 모달을 닫고 헤더만 전환합니다(§2.3 — 리로드·리다이렉트 없음).
    failures = 0;
    closeModal();
    renderFor(result.data.session);
  } catch (err) {
    showError(root, T.errNetwork, []);
    submit.disabled = false;
  }
}

/* ── 시동 ───────────────────────────────────────────────────────── */

if (area) {
  renderSkeleton();
  supabase()
    .auth.getSession()
    .then(function (result) {
      renderFor(result.data ? result.data.session : null);
    })
    .catch(function () {
      // 세션 복구 실패 — 토스트 없이 조용히 비로그인으로(§3.2)
      renderSignedOut();
    });

  supabase().auth.onAuthStateChange(function (event, session) {
    if (event === 'SIGNED_OUT') renderSignedOut();
    else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      renderFor(session);
    }
  });
}
