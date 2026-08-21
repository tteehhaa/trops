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
 * 로그인 완료 — `[대시보드 링크] (아바타) 이름 [로그아웃]` 한 줄.
 *
 * 🔴 **순서가 앱 헤더와 같습니다** — 앱은 `[EN] [TROPS 홈] (아바타) 이름 [로그아웃]`,
 *    여기는 `[EN] │ [나의 대시보드] (아바타) 이름 [로그아웃]` 입니다. 상대 오리진으로
 *    건너가는 링크가 언어 링크 다음, 계정 3요소(아바타·이름·로그아웃) 앞에 옵니다.
 *    ⛔ 대시보드 링크를 이름과 로그아웃 **사이**에 넣지 마십시오 — 계정 3요소가 갈립니다.
 * 🔴 **드롭다운이 없습니다.** 종전 칩 메뉴가 담던 것은 이메일 전문과 로그아웃 둘인데,
 *    전문은 `title` 이 갖고 로그아웃은 이제 줄 위에 그대로 있습니다 — 메뉴가 감출 것이
 *    없어졌습니다(누르는 곳 하나 = 하는 일 하나).
 * 🔴 **아바타는 무채색입니다** — 앱 `UI.HEADER.accountAvatar` 와 같은 값(#f1f4f8 /
 *    #4a5568). 브랜드색을 주지 마십시오: 아바타는 상태가 아닙니다.
 */
function renderSignedIn(user) {
  const email = String(user.email || '');
  area.innerHTML =
    '<span class="ta-divider" aria-hidden="true"></span>' +
    '<a class="nav-quiet ta-link" href="' + APP_ORIGIN + '/" data-track="nav_dashboard">' +
    esc(T.dashboard) + '</a>' +
    // 계정 3요소는 한 덩어리(`.ta-account`)입니다 — 앱 `AccountHeader` 와 같은 묶음이고,
    // 그래서 그룹 안(10px)이 그룹 사이(14px)보다 촘촘합니다.
    '<div class="ta-account">' +
    '<span class="ta-avatar" aria-hidden="true">' + esc(initialOf(email)) + '</span>' +
    // 전문은 `title` 에 — 같은 로컬파트를 쓰는 두 계정을 가릴 수 있어야 합니다.
    '<span class="ta-name"' + (email ? ' title="' + esc(email) + '"' : '') + '>' +
    esc(displayNameOf(email)) + '</span>' +
    '<button type="button" class="nav-quiet ta-link" data-track="nav_logout">' +
    esc(T.logout) + '</button>' +
    '</div>';

  area.querySelector('[data-track="nav_logout"]').addEventListener('click', function () {
    // 실패해도 토스트를 띄우지 않습니다 — onAuthStateChange 가 상태를 되돌립니다(§3.2).
    supabase().auth.signOut().catch(function () {});
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
