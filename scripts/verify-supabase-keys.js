/*
 * Supabase 키 회전 검증 — 이 저장소의 두 쌍을 각각 확인합니다.
 *
 *   node --env-file=.env.local scripts/verify-supabase-keys.js
 *   npm run keys:verify
 *
 * ⛔ 키 값을 출력하지 않습니다. 출력은 이름 · 체계 · 프로젝트 ref · HTTP 결과뿐입니다.
 *
 * ── 왜 이 스크립트가 필요한가 ────────────────────────────────────
 * `api/lookup-log.js` 는 설정이 없거나 틀려도 **항상 200 {stored:false}** 를 돌려줍니다
 * (의도된 설계 — 로그 실패가 사용자 조회를 막지 않게). 그래서 회전을 잘못해도
 * 화면에는 아무 증상이 없습니다. 여기서 보지 않으면 아무 데서도 못 봅니다.
 *
 * ── 무엇을 보는가 ────────────────────────────────────────────────
 *   ① 이름과 체계   어느 env 이름에서 왔는가 · new/legacy · 구 이름이 남았는가
 *   ② 실제 연결     GET /rest/v1/ (PostgREST 루트 — 설계상 비밀 키 전용)
 *   ③ 자리 바꿔치기 공개 키가 비밀 자리에 들어왔는가
 *   ④ 테이블 권한   그 쌍이 실제로 쓰는 테이블 1행 조회
 *
 * ⚠️ ②가 통과해도 **레거시가 살아 있는 동안은 구 값으로도 통과합니다.**
 *    「이행이 끝났는가」의 판정은 ①이 new 인지로 합니다.
 *
 * 절차 정본: trops_a `docs/06-ops/supabase-key-rotation.md`
 */

'use strict';

const KEYS = require('../api/_supabase-keys.js');

const PAIRS = [
  {
    label: '쌍 1 — 앞단 접수 (/precheck)',
    expectProject: 'trops-precheck',
    names: KEYS.INTAKE_ENV_NAMES,
    table: 'intake',
    reader: 'api/_supabase.js',
  },
  {
    label: '쌍 2 — /uae 조회 로그',
    expectProject: 'trops (prod)',
    names: KEYS.UAE_LOG_ENV_NAMES,
    table: 'lookup_log',
    reader: 'api/lookup-log.js',
  },
];

function refOf(url) {
  const m = /^https?:\/\/([a-z0-9-]+)\.supabase\.co/i.exec(String(url || '').trim());
  return m ? m[1] : null;
}

async function probe(url, key, path) {
  try {
    const res = await fetch(url + path, {
      headers: { apikey: key, Authorization: 'Bearer ' + key },
    });
    let body = '';
    try { body = (await res.text()).slice(0, 200); } catch (e) { body = ''; }
    return { status: res.status, body: body };
  } catch (e) {
    return { status: 0, body: e && e.message ? e.message : String(e) };
  }
}

async function checkPair(pair) {
  const problems = [];
  const out = [];
  out.push('── ' + pair.label + '  (리더 ' + pair.reader + ')');

  const url = KEYS.resolveKey(pair.names.url);
  const key = KEYS.resolveKey(pair.names.key);

  // ① 이름과 체계
  if (!url.value || !key.value) {
    const missing = [!url.value && KEYS.describeNames(pair.names.url),
      !key.value && KEYS.describeNames(pair.names.key)].filter(Boolean).join(', ');
    out.push('   ① 이름·체계    ✗ 비어 있음 — ' + missing);
    problems.push(pair.label + ': ' + missing + ' 미설정');
    return { lines: out, problems: problems };
  }

  const ref = refOf(url.value);
  out.push('   ① 이름·체계    키=' + key.source + ' · 체계=' + key.scheme +
    ' · URL=' + url.source + ' · ref=' + (ref || '?') +
    ' · 구 이름 잔존=' + (key.legacyStillSet ? 'yes' : 'no'));
  out.push('      대상 프로젝트 기대값: ' + pair.expectProject);

  if (key.warning) {
    out.push('   ⚠️  ' + key.warning);
    problems.push(pair.label + ': ' + key.warning);
  }
  if (key.scheme === 'legacy') {
    out.push('      ↳ 아직 레거시입니다 — 이행 미완(회전 대상).');
  }

  // 공개 키는 값이 밖으로 나가기 전에 세웁니다 — 프로브에 실어 보내지 않습니다.
  // (출력은 ①②③④ 순서를 지키므로 판정 결과만 들고 있다가 아래에서 적습니다.)
  if (KEYS.isPublishable(key.scheme)) {
    out.push('   ②③ 자리       🔴 공개 키가 비밀 자리에 있습니다 — 즉시 교체하십시오.');
    out.push('      연결 검사는 건너뜁니다(이 값을 밖으로 보내지 않습니다).');
    problems.push(pair.label + ': 공개 키가 비밀 자리');
    return { lines: out, problems: problems };
  }

  const base = String(url.value).trim().replace(/\/+$/, '');

  // ② 실제 연결 — PostgREST 루트는 설계상 비밀 키 전용입니다.
  const root = await probe(base, key.value, '/rest/v1/');
  if (root.status === 200) {
    out.push('   ② 연결         ✓ /rest/v1/ 200');
  } else {
    out.push('   ② 연결         ✗ /rest/v1/ ' + root.status + ' — ' + root.body.replace(/\s+/g, ' '));
    problems.push(pair.label + ': /rest/v1/ ' + root.status);
  }

  // ③ 자리 바꿔치기 — 위에서 이미 걸렀으므로 여기 오면 통과입니다.
  out.push('   ③ 자리         ✓ 공개 키 아님');

  // ④ 테이블 권한
  const tbl = await probe(base, key.value, '/rest/v1/' + pair.table + '?select=*&limit=1');
  if (tbl.status === 200 || tbl.status === 206) {
    out.push('   ④ 테이블       ✓ ' + pair.table + ' 조회 가능');
  } else {
    out.push('   ④ 테이블       ✗ ' + pair.table + ' ' + tbl.status +
      ' — ' + tbl.body.replace(/\s+/g, ' '));
    problems.push(pair.label + ': ' + pair.table + ' ' + tbl.status);
  }

  return { lines: out, problems: problems };
}

async function main() {
  console.log('Supabase 키 회전 검증 — main_web_page 두 쌍\n');

  const problems = [];
  for (const pair of PAIRS) {
    const result = await checkPair(pair);
    console.log(result.lines.join('\n'));
    console.log('');
    problems.push(...result.problems);
  }

  // 두 쌍이 같은 프로젝트를 보고 있으면 경계가 무너진 것입니다.
  const refs = PAIRS.map((p) => refOf(KEYS.resolveKey(p.names.url).value)).filter(Boolean);
  if (refs.length === 2 && refs[0] === refs[1]) {
    console.log('🔴 두 쌍이 같은 프로젝트(' + refs[0] + ')를 가리킵니다 — 경계가 무너졌습니다.');
    problems.push('두 쌍이 같은 프로젝트를 가리킴');
  }

  if (problems.length === 0) {
    console.log('✅ 문제 없음.');
    console.log('   ⚠️ 다만 체계가 legacy 인 쌍이 있으면 이행은 아직 끝나지 않은 것입니다(①을 보십시오).');
    process.exit(0);
  }

  console.log('발견된 문제 ' + problems.length + '건:');
  problems.forEach((p) => console.log('  - ' + p));
  process.exit(1);
}

main().catch((err) => {
  console.error('검증 실패:', err && err.message ? err.message : err);
  process.exit(1);
});
