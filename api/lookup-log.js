/*
 * /uae 협정 세율 조회 기록 (관세사법 대응용)
 *
 * 개인정보를 받지 않습니다. IP·User-Agent·식별자를 저장하지 않습니다.
 * 저장 실패는 사용자 조회를 막지 않습니다 — 클라이언트는 fire-and-forget으로 호출합니다.
 *
 * 필요한 Vercel 환경변수:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (service role — 서버에서만 사용)
 * 둘 중 하나라도 없으면 저장을 건너뛰고 200을 반환합니다.
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

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 환경변수가 없으면 조용히 건너뜁니다. 조회 화면은 이 응답을 기다리지 않습니다.
  if (!url || !key) {
    res.status(200).json({ ok: true, stored: false });
    return;
  }

  try {
    const response = await fetch(url.replace(/\/+$/, '') + '/rest/v1/lookup_log', {
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
      console.error('lookup-log supabase error', response.status, await safeText(response));
      res.status(200).json({ ok: true, stored: false });
      return;
    }

    res.status(200).json({ ok: true, stored: true });
  } catch (err) {
    console.error('lookup-log handler error', err);
    res.status(200).json({ ok: true, stored: false });
  }
};

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

async function safeText(response) {
  try { return await response.text(); } catch (e) { return '<no body>'; }
}
