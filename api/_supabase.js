/*
 * 앞단(/precheck) 전용 Supabase 접속 설정.
 *
 * ⚠️ 경계: 이 폴더(main_web_page)는 접수·저장·알림만 담당합니다.
 *    LLM 호출·상태 판정 코드를 두지 않습니다. (판정층은 trops_a 에 분리되어 있습니다.)
 *
 * 파일명이 밑줄로 시작하므로 Vercel 은 이 파일을 엔드포인트로 만들지 않습니다.
 * api/slots.js · api/intake.js 가 공용으로 require 합니다.
 *
 * 필요한 Vercel 환경변수 — 앞단 전용 Supabase 프로젝트 trops-precheck (뒷단 trops_a 프로젝트와 분리):
 *   INTAKE_SUPABASE_URL
 *   INTAKE_SUPABASE_SECRET_KEY              ← 신규 체계(sb_secret_…)
 *   INTAKE_SUPABASE_SERVICE_ROLE_KEY        ← 구 이름 · 폴백(회전 끝나면 지웁니다)
 *
 * /uae 조회 로그용 쌍(api/lookup-log.js)과 이름을 일부러 다르게 둡니다.
 * 같은 이름을 쓰면 나중에 한쪽 값만 바꿔도 다른 쪽이 조용히 따라 움직여 경계가 무너집니다.
 * 그 쌍은 **다른 Supabase 프로젝트**(trops prod)를 봅니다 — 폴백 관계가 아닙니다.
 *
 * 이름 해석은 api/_supabase-keys.js 한 곳에서만 합니다.
 *
 * 스키마는 저장소 루트 precheck-schema.sql 을 Supabase SQL Editor 에 붙여넣어 실행하십시오.
 */

const KEYS = require('./_supabase-keys.js');

const NAMES = KEYS.INTAKE_ENV_NAMES;

function readConfig() {
  const url = process.env[NAMES.url.current];
  const resolved = KEYS.resolveKey(NAMES.key);
  const key = resolved.value;

  if (!url || !key) {
    const missing = [!url && NAMES.url.current, !key && KEYS.describeNames(NAMES.key)]
      .filter(Boolean).join(', ');
    return {
      ok: false,
      reason: 'not-configured',
      error: missing + ' 가 비어 있습니다. ' +
        '두 변수를 같은 환경(Production/Preview)에 함께 설정해야 합니다.',
    };
  }

  // 공개 키는 이 저장소에서 쓸 일이 없습니다(브라우저는 api/ 만 부릅니다).
  // 비밀 자리에 들어와 있다면 선택이 아니라 사고이므로 여기서 세웁니다.
  if (KEYS.isPublishable(resolved.scheme)) {
    return {
      ok: false,
      reason: 'publishable-key-in-secret-slot',
      error: resolved.source + ' 에 공개(publishable) 키가 들어 있습니다. ' +
        '비밀 키(' + KEYS.NEW_KEY_PREFIX + '…)를 넣어야 합니다.',
    };
  }

  // 이름은 신규인데 값이 레거시인 경우 — 연결 검사는 전부 통과하므로 여기서만 드러납니다.
  if (resolved.warning) {
    console.error('supabase config warning: ' + resolved.warning);
  }

  const trimmed = String(url).trim().replace(/\/+$/, '');

  // URL 은 자격증명이 아니므로 진단을 위해 값을 그대로 남깁니다.
  // (비밀 키는 어떤 경우에도 로그에 남기지 않습니다 — 이름과 체계만 남깁니다.)
  if (!/^https?:\/\//i.test(trimmed)) {
    return invalidUrl('스킴(https://)이 없습니다', url);
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (e) {
    return invalidUrl('URL 로 해석되지 않습니다', url);
  }
  if (!parsed.hostname || parsed.hostname.indexOf('.') === -1) {
    return invalidUrl('호스트명이 올바르지 않습니다', url);
  }

  return {
    ok: true,
    baseUrl: trimmed,
    restUrl: trimmed + '/rest/v1',
    storageUrl: trimmed + '/storage/v1',
    key: key,
    // 회전 상태 — scripts/verify-supabase-keys.js 가 읽습니다. 키 값은 담지 않습니다.
    keyScheme: resolved.scheme,
    keySource: resolved.source,
    legacyStillSet: resolved.legacyStillSet,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
    },
  };
}

function invalidUrl(what, rawValue) {
  return {
    ok: false,
    reason: 'invalid-supabase-url',
    error: NAMES.url.current + ' 형식 오류 — ' + what +
      ' | 현재값: ' + JSON.stringify(rawValue) +
      ' | 예: "https://<project-ref>.supabase.co"',
  };
}

async function safeText(response) {
  try { return await response.text(); } catch (e) { return '<no body>'; }
}

/* ──────────────────────────────────────────────────────────────
 * Storage
 *
 * intake.file_paths 에는 버킷 이름을 포함한 경로가 들어 있습니다 — "intake/<id>/01-a.pdf".
 * Storage API 는 버킷을 URL 로 받고 본문에는 버킷 뒤의 키만 받으므로 앞을 떼어 씁니다.
 *
 * 파일 삭제는 api/erasure.js(이용자 요청 즉시 삭제)와
 * scripts/cleanup-expired.js(30일 경과분 정리) 두 곳에서 씁니다.
 * 복제해 두면 한쪽만 고쳐지고 다른 쪽은 조용히 옛 방식으로 남습니다.
 * ────────────────────────────────────────────────────────────── */

/** "intake/<id>/01-a.pdf" → "<id>/01-a.pdf" (이미 떼어져 있으면 그대로). */
function storageKey(path, bucket) {
  const p = String(path || '').replace(/^\/+/, '');
  const prefix = bucket + '/';
  return p.slice(0, prefix.length) === prefix ? p.slice(prefix.length) : p;
}

/**
 * 객체 여럿을 한 번에 삭제합니다.
 *
 * 없는 키를 넘겨도 오류가 아닙니다 — 같은 요청을 두 번 보내도 안전합니다.
 * 반환값은 실제로 지워진 객체 수입니다(0 이면 이미 없던 것).
 */
async function removeObjects(config, bucket, keys) {
  const list = (keys || []).filter(Boolean);
  if (list.length === 0) return { deleted: 0 };

  const response = await fetch(config.storageUrl + '/object/' + encodeURIComponent(bucket), {
    method: 'DELETE',
    headers: config.headers,
    body: JSON.stringify({ prefixes: list }),
  });

  if (!response.ok) {
    throw new Error('storage delete HTTP ' + response.status +
      ' | ' + (await safeText(response)).slice(0, 300));
  }

  const body = await response.json().catch(() => []);
  return { deleted: Array.isArray(body) ? body.length : 0 };
}

/** 접두사 아래 객체 목록. 한 번에 최대 limit 건씩 가져옵니다. */
async function listObjects(config, bucket, prefix, limit, offset) {
  const response = await fetch(config.storageUrl + '/object/list/' + encodeURIComponent(bucket), {
    method: 'POST',
    headers: config.headers,
    body: JSON.stringify({
      prefix: prefix || '',
      limit: limit || 100,
      offset: offset || 0,
      sortBy: { column: 'name', order: 'asc' },
    }),
  });

  if (!response.ok) {
    throw new Error('storage list HTTP ' + response.status +
      ' | ' + (await safeText(response)).slice(0, 300));
  }

  const body = await response.json().catch(() => []);
  return Array.isArray(body) ? body : [];
}

module.exports = {
  readConfig: readConfig,
  safeText: safeText,
  storageKey: storageKey,
  removeObjects: removeObjects,
  listObjects: listObjects,
};
