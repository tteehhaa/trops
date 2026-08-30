#!/usr/bin/env node
/*
 * /precheck 자료 즉시 삭제 — CLI 진입점 〔신설 2026-08-30 · 대표 지시〕
 *
 * 본체는 api/erasure.js 입니다. 여기는 실행 껍데기입니다
 * (인자 해석 · 설정 확인 · 미리보기 · 콘솔 출력 · 종료코드) — scripts/refund.js 와 같은 꼴.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🔴 **왜 생겼는가 — 창구가 이메일이 됐기 때문입니다**
 * ══════════════════════════════════════════════════════════════════════════
 * 2026-08-30 에 privacy §03·§05 와 refund §05 의 삭제 «창구»를 이메일로 바꿨습니다
 * (약속하던 「확인 메일 링크의 자료 즉시 삭제」 버튼이 화면에 없었습니다). 그래서
 * **요청이 사람에게 도착**하고, 그 사람이 처리할 손잡이가 필요합니다.
 *
 * ⛔ **SQL 로 직접 지우지 마십시오.** 그러면 Supabase Storage 의 파일이 그대로 남습니다 —
 *    「지웠다」고 표시된 채 바이트가 남는 것이 이 기능이 막으려는 가장 나쁜 상태입니다.
 *    본체가 **파일을 먼저 지우고 행을 나중에** 표시하는 것도 같은 이유입니다.
 *
 * ── 실행 ────────────────────────────────────────────────────────────────────
 *   # ① 누구의 어느 건인지 찾는다 (읽기 전용 · 아무것도 지우지 않습니다)
 *   npm run erasure:find -- buyer@example.com
 *
 *   # ② 무엇이 지워지는지 본다 (읽기 전용)
 *   npm run erasure:preview -- <token>
 *
 *   # ③ 지운다 (되돌릴 수 없습니다)
 *   npm run erasure:apply -- <token>
 *
 * 🔴 **`--apply` 없이는 아무것도 지우지 않습니다.** 환불·정리 배치와 같은 규약입니다.
 * 🔴 **`--apply` 는 재발급 불가 동의를 «대신 눌러 줍니다»** — 화면에서는 이용자가
 *    체크했지만 이메일 경로에서는 그 동의가 **메일 본문에 있습니다.** 그래서 실행하는
 *    사람이 그 사실을 확인했다는 뜻으로 `--apply` 를 답니다.
 *    ⛔ 요청 메일에 「재발급이 불가함을 안다」는 뜻이 없으면 실행하지 마십시오.
 *
 * ── ⛔ 이메일로 «지우지» 않습니다 ───────────────────────────────────────────
 * `--email` 은 **찾기 전용**입니다. 한 이메일에 접수가 여러 건일 수 있고, 그때
 * 「전부 지운다」는 요청자가 말하지 않은 것을 우리가 정하는 일이 됩니다.
 * 지우는 축은 **토큰 하나**이며 사람이 목록에서 골라 붙여 넣습니다.
 *
 * ── 삭제는 환불이 아닙니다 ──────────────────────────────────────────────────
 * 돈은 여기서 건드리지 않습니다(본체 머리주석). 환불을 함께 요청받았으면
 * scripts/refund.js 를 따로 돌립니다.
 *
 * 필요한 환경변수: INTAKE_SUPABASE_* (`--env-file=.env.local` 로 물립니다)
 */

'use strict';

const { readConfig, safeText } = require('../api/_supabase.js');

/** 본체와 **같은 값**입니다. ⛔ 여기서 다시 정의하지 않으려 했으나 본체가 내보내지 않습니다. */
const TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/;

function usage() {
  console.error('사용법:');
  console.error('  찾기      node --env-file=.env.local scripts/erasure.js --email <주소>');
  console.error('  미리보기  node --env-file=.env.local scripts/erasure.js <token>');
  console.error('  삭제      node --env-file=.env.local scripts/erasure.js <token> --apply');
}

function parseArgs(argv) {
  let apply = false;
  let email = '';
  let token = '';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') { apply = true; continue; }
    if (arg === '--email') {
      const value = argv[i + 1];
      email = typeof value === 'string' ? value.trim() : '';
      i += 1;
      continue;
    }
    if (arg.indexOf('--') === 0) continue;
    // 인자 하나만 받습니다. `@` 가 있으면 이메일로 읽습니다 — 토큰에는 `@` 가 없습니다.
    if (!email && !token && arg.indexOf('@') !== -1) { email = arg; continue; }
    if (!token) token = arg;
  }

  return { apply: apply, email: email, token: token };
}

/** 사람이 읽는 한 줄. ⛔ 파일 경로를 적지 않습니다(로그에 남습니다). */
function describe(row) {
  const files = Array.isArray(row.file_paths) ? row.file_paths.length : (row.file_count || 0);
  return [
    'id=' + row.id,
    row.email,
    '상태=' + row.status,
    '파일=' + files + '건',
    '접수=' + String(row.received_at || '').slice(0, 10),
    row.erasure_requested_at ? '**이미 삭제됨** ' + row.erasure_requested_at : '',
  ].filter(Boolean).join(' · ');
}

/**
 * 조회 — 본체의 `findByToken` 과 **같은 표·같은 축**이지만 여기서는 읽기만 합니다.
 * ⚠️ `locale` 을 묻지 않습니다 — 이 스크립트는 메일을 보내지 않으므로 필요 없고,
 *    없는 컬럼 때문에 조회가 실패하는 갈래를 만들지 않습니다(본체가 겪은 그것).
 */
async function query(config, filter) {
  const select = 'id,email,status,file_paths,file_count,received_at,access_token,' +
    'order_id,payment_status,erasure_requested_at';
  const response = await fetch(
    config.restUrl + '/intake?' + filter + '&select=' + select + '&order=received_at.desc',
    { headers: config.headers }
  );
  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' | ' + (await safeText(response)).slice(0, 300));
  }
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function main(argv) {
  const args = parseArgs(argv);

  if (!args.email && !args.token) { usage(); return 2; }

  const config = readConfig();
  if (!config.ok) {
    console.error('설정 오류 — ' + config.error);
    return 2;
  }

  /* ── 찾기 — 읽기 전용 ─────────────────────────────────────────────────── */
  if (args.email) {
    if (args.apply) {
      console.error('⛔ --email 로는 지우지 않습니다. 목록에서 토큰을 골라 다시 실행하십시오.');
      return 2;
    }
    let rows;
    try {
      rows = await query(config, 'email=eq.' + encodeURIComponent(args.email));
    } catch (err) {
      console.error('조회 실패: ' + (err && err.message ? err.message : err));
      return 1;
    }
    if (rows.length === 0) {
      console.log('접수 기록이 없습니다 — ' + args.email);
      return 0;
    }
    console.log('[찾기] ' + args.email + ' — ' + rows.length + '건');
    for (const row of rows) {
      console.log('  ' + describe(row));
      console.log('    token: ' + row.access_token);
    }
    console.log('\n지우려면: npm run erasure:apply -- <token>');
    return 0;
  }

  /* ── 토큰 축 ──────────────────────────────────────────────────────────── */
  if (!TOKEN_RE.test(args.token)) {
    console.error('토큰 형식이 아닙니다: ' + args.token);
    usage();
    return 2;
  }

  let rows;
  try {
    rows = await query(config, 'access_token=eq.' + encodeURIComponent(args.token));
  } catch (err) {
    console.error('조회 실패: ' + (err && err.message ? err.message : err));
    return 1;
  }
  const row = rows[0];
  if (!row) {
    console.error('그 토큰의 접수 기록이 없습니다.');
    return 1;
  }

  console.log((args.apply ? '[삭제] ' : '[미리보기] ') + config.baseUrl);
  console.log('  ' + describe(row));

  if (!args.apply) {
    if (row.erasure_requested_at) {
      console.log('\n이미 삭제된 건입니다. 다시 실행해도 파일은 늘지도 줄지도 않습니다.');
    } else {
      const files = Array.isArray(row.file_paths) ? row.file_paths.length : 0;
      console.log('\n지울 것: 업로드 파일 ' + files + '건 + 접수 기록');
      console.log('⛔ 되돌릴 수 없습니다 — 같은 자료를 다시 만들어 드릴 수 없습니다.');
      console.log('실행: npm run erasure:apply -- ' + args.token);
    }
    return 0;
  }

  /*
   * 🔴 **본체를 그대로 부릅니다** — 파일 삭제 순서 · 상태 전이 · 멱등 · 알림 메일이
   *    전부 그 안에 있습니다. ⛔ 여기서 다시 구현하면 두 경로가 갈립니다.
   * ⚠️ HTTP 핸들러라 req/res 를 흉내 냅니다(test/erasure.test.js 와 같은 방식).
   */
  const handler = require('../api/erasure.js');
  let status = null;
  let payload = null;
  const res = {
    setHeader() {},
    status(code) { status = code; return this; },
    json(body) { payload = body; return this; },
  };

  try {
    await handler(
      { method: 'POST', body: { token: args.token, confirmNoReissue: true } },
      res
    );
  } catch (err) {
    console.error('삭제 실패: ' + (err && err.message ? err.message : err));
    return 1;
  }

  if (status === 200 && payload && payload.ok) {
    if (payload.alreadyErased) {
      console.log('이미 삭제된 건이었습니다 (' + payload.erasureRequestedAt + '). 바뀐 것 없음.');
    } else {
      console.log('삭제 완료 — 파일 ' + payload.filesDeleted + '건');
      console.log('⚠️ 환불을 함께 요청받았으면 scripts/refund.js 를 따로 돌리십시오.');
    }
    return 0;
  }

  console.error('삭제 실패 — HTTP ' + status + ' | ' + JSON.stringify(payload));
  return 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

module.exports = { main: main, parseArgs: parseArgs, describe: describe };
