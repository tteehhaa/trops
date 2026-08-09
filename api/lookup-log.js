/*
 * /uae 협정 세율 조회 기록 (관세사법 대응용)
 *
 * 개인정보를 받지 않습니다. IP·User-Agent·식별자를 저장하지 않습니다.
 * 저장 실패는 사용자 조회를 막지 않습니다 — 클라이언트는 fire-and-forget으로 호출합니다.
 *
 * 필요한 Vercel 환경변수 — 이 쌍은 **trops(prod) 프로젝트**를 봅니다.
 * 앞단 접수용 INTAKE_* 쌍(api/_supabase.js)과는 **다른 프로젝트**이며 폴백 관계가 아닙니다.
 *   UAE_LOG_SUPABASE_URL              ← 신규 이름 (구 이름 SUPABASE_URL 폴백)
 *   UAE_LOG_SUPABASE_SECRET_KEY       ← 신규 체계(sb_secret_…) · 서버에서만 사용
 *                                       (구 이름 SUPABASE_SERVICE_ROLE_KEY 폴백)
 * 둘 중 하나라도 없으면 저장을 건너뛰고 200을 반환합니다.
 *
 * ⚠️ 설정이 잘못돼도 화면에는 아무 증상이 없습니다 — 응답이 항상 200 이기 때문입니다.
 *    회전 후에는 scripts/verify-supabase-keys.js 로 이 쌍을 반드시 따로 확인하십시오.
 *
 * 이름 해석은 api/_supabase-keys.js 한 곳에서만 합니다.
 *
 * ── Supabase 테이블 스키마 (직접 실행) ─────────────────────────────
 *
 *   create table public.lookup_log (
 *     id            bigint generated always as identity primary key,
 *     hs8           char(8)     not null,
 *     country       text        not null,
 *     result_track  text        not null,
 *     psr_verified  boolean     not null,
 *     looked_up_at  timestamptz not null,
 *     created_at    timestamptz not null default now(),
 *     constraint lookup_log_hs8_digits check (hs8 ~ '^[0-9]{8}$'),
 *     constraint lookup_log_country_len check (char_length(country) between 2 and 8),
 *     constraint lookup_log_track_allowed check (result_track in ('A','B','C','X','PH','SG'))
 *   );
 *
 *   create index lookup_log_looked_up_at_idx on public.lookup_log (looked_up_at desc);
 *   create index lookup_log_hs8_idx          on public.lookup_log (hs8);
 *
 *   -- 이 테이블은 service role 로만 기록합니다. anon/authenticated 접근은 막습니다.
 *   alter table public.lookup_log enable row level security;
 *   -- (정책을 만들지 않으면 service role 외 모든 접근이 차단됩니다.)
 *
 * ────────────────────────────────────────────────────────────────
 */

const KEYS = require('./_supabase-keys.js');

const NAMES = KEYS.UAE_LOG_ENV_NAMES;

const HS8_RE = /^[0-9]{8}$/;
const ALLOWED_TRACKS = ['A', 'B', 'C', 'X', 'PH', 'SG'];
const MAX_COUNTRY_LEN = 8;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const body = parseBody(req.body);
  const hs8 = typeof body.hs8 === 'string' ? body.hs8.trim() : '';
  const country = typeof body.country === 'string' ? body.country.trim() : '';
  const resultTrack = typeof body.resultTrack === 'string' ? body.resultTrack.trim() : '';
  const psrVerified = body.psrVerified === true;
  const timestamp = typeof body.timestamp === 'string' ? body.timestamp : '';

  if (
    !HS8_RE.test(hs8) ||
    !country || country.length > MAX_COUNTRY_LEN ||
    ALLOWED_TRACKS.indexOf(resultTrack) === -1
  ) {
    res.status(400).json({ error: 'invalid input' });
    return;
  }

  const lookedUpAt = Number.isNaN(Date.parse(timestamp))
    ? new Date().toISOString()
    : new Date(timestamp).toISOString();

  const resolvedUrl = KEYS.resolveKey(NAMES.url);
  const resolvedKey = KEYS.resolveKey(NAMES.key);
  const url = resolvedUrl.value;
  const key = resolvedKey.value;

  // 저장을 못 하더라도 항상 200을 돌려줍니다 — 로그 실패가 사용자 조회를 막으면 안 됩니다.
  // 다만 "설정을 안 한 것"과 "설정이 잘못된 것"은 구분합니다.
  // 전자는 의도된 상태라 조용히 건너뛰고, 후자는 원인을 로그와 응답에 남깁니다.
  if (!url && !key) {
    res.status(200).json({ ok: true, stored: false, reason: 'not-configured' });
    return;
  }
  if (!url || !key) {
    const missing = !url ? KEYS.describeNames(NAMES.url) : KEYS.describeNames(NAMES.key);
    console.error('lookup-log config error: ' + missing + ' 가 비어 있습니다. ' +
      '두 변수를 같은 환경(Production/Preview)에 함께 설정해야 저장됩니다.');
    res.status(200).json({ ok: true, stored: false, reason: 'incomplete-config' });
    return;
  }

  // 공개 키는 이 저장소에서 쓸 일이 없습니다 — 비밀 자리에 있으면 설정 사고입니다.
  if (KEYS.isPublishable(resolvedKey.scheme)) {
    console.error('lookup-log config error: ' + resolvedKey.source +
      ' 에 공개(publishable) 키가 들어 있습니다. 비밀 키(' + KEYS.NEW_KEY_PREFIX + '…)를 넣어야 합니다.');
    res.status(200).json({ ok: true, stored: false, reason: 'publishable-key-in-secret-slot' });
    return;
  }

  // 이름은 신규인데 값이 레거시인 경우 — 레거시가 살아 있는 동안은 저장이 성공하므로
  // 여기서 적어 두지 않으면 레거시 비활성 시점에야 알게 됩니다.
  if (resolvedKey.warning) {
    console.error('lookup-log config warning: ' + resolvedKey.warning);
  }

  const endpoint = buildEndpoint(url);
  if (!endpoint.ok) {
    // URL 은 자격증명이 아니라 프로젝트 URL이므로 값을 그대로 남겨 진단할 수 있게 합니다.
    // (비밀 키는 어떤 경우에도 로그에 남기지 않습니다.)
    console.error('lookup-log config error: ' + resolvedUrl.source + ' 형식 오류 — ' + endpoint.error +
      ' | 현재값: ' + JSON.stringify(url) +
      ' | 예: "https://<project-ref>.supabase.co"');
    res.status(200).json({ ok: true, stored: false, reason: 'invalid-supabase-url' });
    return;
  }

  try {
    const response = await fetch(endpoint.value, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: 'Bearer ' + key,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        hs8: hs8,
        country: country,
        result_track: resultTrack,
        psr_verified: psrVerified,
        looked_up_at: lookedUpAt,
      }),
    });

    if (!response.ok) {
      // 테이블 미생성(404)·권한(401/403)·스키마 불일치(400) 등이 여기로 옵니다.
      console.error('lookup-log supabase error: HTTP ' + response.status +
        ' | 응답: ' + (await safeText(response)).slice(0, 300) +
        ' | 테이블이 없으면 api/lookup-log.js 상단 주석의 SQL 을 먼저 실행하십시오.');
      res.status(200).json({ ok: true, stored: false, reason: 'supabase-http-' + response.status });
      return;
    }

    res.status(200).json({ ok: true, stored: true });
  } catch (err) {
    console.error('lookup-log request failed:', err && err.message ? err.message : err);
    res.status(200).json({ ok: true, stored: false, reason: 'request-failed' });
  }
};

// 프로젝트 URL 을 검증해 REST 엔드포인트를 만듭니다.
// 스킴 누락(프로젝트 ref만 입력한 경우)처럼 흔한 실수를 fetch 이전에 잡아냅니다.
function buildEndpoint(rawUrl) {
  const trimmed = String(rawUrl).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: '스킴(https://)이 없습니다' };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (e) {
    return { ok: false, error: 'URL 로 해석되지 않습니다' };
  }
  if (!parsed.hostname || parsed.hostname.indexOf('.') === -1) {
    return { ok: false, error: '호스트명이 올바르지 않습니다' };
  }
  return { ok: true, value: trimmed + '/rest/v1/lookup_log' };
}

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

async function safeText(response) {
  try { return await response.text(); } catch (e) { return '<no body>'; }
}
