/*
 * Supabase 접속 이름 해석 — 단일 출처.
 *
 * 이 저장소에는 서로 **다른 Supabase 프로젝트**를 보는 쌍이 2벌 있습니다.
 * 리더가 이름을 각자 정하면 한쪽만 이행된 상태를 아무도 못 봅니다.
 * 그래서 이름은 여기서만 정합니다.
 *
 *   쌍 1 (앞단 접수)   → trops-precheck  · 리더 api/_supabase.js
 *   쌍 2 (/uae 로그)   → trops (prod)    · 리더 api/lookup-log.js
 *
 * ⛔ 두 쌍은 폴백 관계가 아닙니다. 서로 다른 프로젝트를 가리키므로
 *    한쪽 이름을 다른 쪽 폴백으로 적으면 조용히 엉뚱한 곳에 씁니다.
 *    (여기서 말하는 폴백은 **같은 쌍 안에서 구→신 이름**뿐입니다.)
 *
 * ── 왜 이름을 새로 두는가 ────────────────────────────────────────
 * 레거시 anon/service_role 체계가 2026년 말 제거되고, 레거시 키는
 * 개별 회전이 이미 불가능합니다. 신규 체계(`sb_secret_…`)로 옮기는 것이
 * 회전 능력을 되찾는 유일한 경로입니다.
 *
 * 이름을 유지한 채 값만 갈면 **잘못 넣어도 아무 신호가 없습니다.**
 * 실제로 뒷단(trops_a) 이행 중 신규 이름에 구 값을 넣은 사고가 있었고,
 * 그것을 잡아낸 것은 「이름과 값의 체계가 다르다」는 신호 하나뿐이었습니다.
 * resolveKey() 가 그 신호를 만듭니다.
 *
 * 회전이 끝나 레거시를 비활성한 뒤에는 구 이름 줄을 지웁니다.
 * 그때 legacyStillSet 이 0 이 되는 것으로 확인합니다.
 *
 * 절차 정본: trops_a `docs/06-ops/supabase-key-rotation.md`
 */

'use strict';

const NEW_KEY_PREFIX = 'sb_secret_';
const PUBLISHABLE_PREFIX = 'sb_publishable_';

/** 쌍 1 — 앞단 접수(trops-precheck). URL 이름은 이미 고유하므로 바꾸지 않습니다. */
const INTAKE_ENV_NAMES = {
  url: { current: 'INTAKE_SUPABASE_URL', legacy: null },
  key: { current: 'INTAKE_SUPABASE_SECRET_KEY', legacy: 'INTAKE_SUPABASE_SERVICE_ROLE_KEY' },
};

/*
 * 쌍 2 — /uae 조회 로그(trops prod).
 *
 * 구 이름 `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` 는 **어느 프로젝트를
 * 가리키는지 이름만 보고는 알 수 없었습니다** — 실제로 특정하는 데 별도 조사가
 * 필요했습니다(`lookup_log` 테이블이 어느 프로젝트에 있는지 프로브).
 * 접두사를 붙여 그 조사가 다시 필요 없게 합니다.
 */
const UAE_LOG_ENV_NAMES = {
  url: { current: 'UAE_LOG_SUPABASE_URL', legacy: 'SUPABASE_URL' },
  key: { current: 'UAE_LOG_SUPABASE_SECRET_KEY', legacy: 'SUPABASE_SERVICE_ROLE_KEY' },
};

/** 값의 생김새로 체계를 가릅니다 — 이름이 아니라 값이 근거입니다. */
function classify(value) {
  const v = String(value || '');
  if (v.slice(0, NEW_KEY_PREFIX.length) === NEW_KEY_PREFIX) return 'new';
  if (v.slice(0, PUBLISHABLE_PREFIX.length) === PUBLISHABLE_PREFIX) return 'publishable';
  if (v.slice(0, 3) === 'eyJ') return 'legacy';
  return 'unrecognized';
}

/**
 * 이름 한 쌍(신규·구)에서 값을 찾습니다. 신규 이름이 이깁니다.
 *
 * 반환: { value, source, scheme, legacyStillSet, warning }
 *   source          실제로 값을 가져온 env 이름 (없으면 null)
 *   scheme          new | publishable | legacy | unrecognized | null
 *   legacyStillSet  구 이름이 아직 설정돼 있는가 (⑥ 이후 0 이어야 함)
 *   warning         이행 중 이상 징후. 사람이 읽을 문장 또는 null
 */
function resolveKey(names, env) {
  const source = env || process.env;
  const currentValue = names.current ? source[names.current] : undefined;
  const legacyValue = names.legacy ? source[names.legacy] : undefined;

  const value = currentValue || legacyValue || undefined;
  const from = currentValue ? names.current : (legacyValue ? names.legacy : null);
  const scheme = value ? classify(value) : null;
  const legacyStillSet = Boolean(legacyValue);

  let warning = null;
  if (currentValue && classify(currentValue) === 'legacy') {
    // 뒷단 이행에서 실제로 났던 사고입니다 — 이름만 바꾸고 값을 안 바꾼 경우.
    // 레거시가 아직 살아 있으면 연결 검사는 전부 통과하므로 여기서만 드러납니다.
    warning = names.current + ' 에 레거시 값이 들어 있습니다. ' +
      '신규 체계 값(' + NEW_KEY_PREFIX + '…)이어야 합니다 — ' +
      '이대로 레거시를 비활성하면 조용히 죽습니다.';
  } else if (currentValue && classify(currentValue) === 'unrecognized') {
    warning = names.current + ' 의 값이 아는 체계가 아닙니다(' + NEW_KEY_PREFIX + '… 도 eyJ… 도 아님).';
  }

  return { value: value, source: from, scheme: scheme, legacyStillSet: legacyStillSet, warning: warning };
}

/**
 * 비밀 키 자리에 공개 키가 들어갔는가.
 *
 * api/ 는 비밀 키 전용입니다 — 공개(publishable) 키가 필요한 곳은 랜딩 헤더의
 * 로그인 UI(assets/auth.js · 브라우저) 하나뿐이고, 거기는 env 가 아니라 자기 파일에
 * 값을 가집니다. 그래서 api/ 의 비밀 자리에 공개 키가 보이면 설정 사고입니다.
 */
function isPublishable(scheme) {
  return scheme === 'publishable';
}

/**
 * Supabase URL 정규화 — trops_a `lib/supabase/keys.ts` normalizeSupabaseUrl 과 같은 규칙.
 *
 * 🔴 http:// 로 실 프로젝트를 가리키면 REST 가 301 로 https 로 돌리고, 그 리다이렉트에서
 *    fetch 가 POST 를 GET 으로 깎아 본문이 사라집니다 — 에러 없이 200·빈 배열만 돌아오고
 *    실제 쓰기는 유실됩니다(trops_a 2026-08-13 실측 · precheck_nda_run 삽입이 배포에서만
 *    이렇게 죽어 있었습니다). 스킴이 있어도 http 면 https 로 올립니다.
 *
 * 관용은 읽을 수 있는 형태만 받습니다 — Reference ID 단독·스킴 누락은 채워 주고,
 * 못 읽는 값에는 null 로 답합니다(스택 트레이스로 답하지 않습니다).
 * 로컬 Supabase CLI(http://localhost·127.0.0.1)만 http 그대로 둡니다.
 */
function normalizeSupabaseUrl(raw) {
  const v = String(raw == null ? '' : raw).trim().replace(/\/+$/, '');
  if (v === '') return null;
  if (/^https?:\/\//i.test(v)) {
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(v)) return v;
    return v.replace(/^http:\/\//i, 'https://');
  }
  // Reference ID 만 넣은 경우 — Supabase ref 는 소문자 20자입니다
  if (/^[a-z]{20}$/.test(v)) return 'https://' + v + '.supabase.co';
  // 스킴만 빠진 경우
  if (v.indexOf('.') !== -1) return 'https://' + v;
  return null;
}

/** 두 이름 중 사람에게 보여줄 이름 — 지금 읽히는 쪽을 먼저 적습니다. */
function describeNames(names) {
  return names.legacy ? names.current + '(또는 구 이름 ' + names.legacy + ')' : names.current;
}

module.exports = {
  NEW_KEY_PREFIX: NEW_KEY_PREFIX,
  PUBLISHABLE_PREFIX: PUBLISHABLE_PREFIX,
  INTAKE_ENV_NAMES: INTAKE_ENV_NAMES,
  UAE_LOG_ENV_NAMES: UAE_LOG_ENV_NAMES,
  classify: classify,
  resolveKey: resolveKey,
  isPublishable: isPublishable,
  normalizeSupabaseUrl: normalizeSupabaseUrl,
  describeNames: describeNames,
};
