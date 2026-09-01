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
 * 지우는 축은 **한 건**이며 사람이 목록에서 골라 붙여 넣습니다.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🔴 **`public.leads` 도 함께 봅니다** 〔2026-09-01 · 대표 지시〕
 * ══════════════════════════════════════════════════════════════════════════
 * `/contact`(문의 · 견적 요청 · 출시 알림)가 남기는 행입니다. 그 전까지 이 표는
 * **삭제 요청을 받을 창구가 아예 없었습니다** — 방침이 파기를 약속해도 손잡이가 0이었습니다.
 *
 * ── 왜 「SQL 직접 삭제 금지」가 leads 에는 해당하지 않는가 ──────────────────
 * 위 ⛔ 는 **intake** 를 말합니다. intake 는 업로드 파일을 Supabase Storage 에 두고
 * 그 경로가 행에만 있어서, 행을 먼저 지우면 **어떤 파일을 지워야 하는지 알 수 없게** 되고
 * 「지웠다고 표시된 채 바이트가 남는」 상태가 됩니다. 그래서 본체가 파일 → 행 순서를 지킵니다.
 * 🔴 `public.leads` 에는 **파일이 없습니다**(precheck-schema.sql §0-L: id · created_at ·
 *    name · email · company · inquiry · 동의 2종 — 전부 텍스트/불리언). 남을 바이트가 없으므로
 *    **행 삭제 한 걸음으로 끝납니다.** 그래서 본체(api/erasure.js)를 거치지 않고 여기서 지웁니다.
 * ⛔ leads 에 파일 컬럼이 생기면 이 판단을 다시 하십시오 — 그때는 intake 와 같은 순서가 됩니다.
 *
 * ── 축이 토큰이 아니라 id 인 이유 ──────────────────────────────────────────
 * `leads` 에는 `access_token` 이 없습니다. 주소로 쓸 수 있는 것은 `id`(uuid) 뿐입니다.
 * ⚠️ uuid 는 위 `TOKEN_RE`(22~64자 · 영숫자·`-`·`_`)에 **그대로 들어맞습니다.** 그래서
 *    맨 인자로 받으면 접수 토큰과 구분되지 않습니다 — `--lead <id>` 로 **명시**해서 받습니다.
 * 🔴 「사람이 목록에서 골라 붙여 넣는다」는 규율은 그대로입니다. 바뀐 것은 무엇을 붙여
 *    넣는가(토큰 → id)뿐입니다.
 *
 * ── 삭제는 환불이 아닙니다 ──────────────────────────────────────────────────
 * 돈은 여기서 건드리지 않습니다(본체 머리주석). 환불을 함께 요청받았으면
 * scripts/refund.js 를 따로 돌립니다.
 *
 * 필요한 환경변수: INTAKE_SUPABASE_* (`--env-file=.env.local` 로 물립니다)
 */

'use strict';

const { readConfig, safeText } = require('../api/_supabase.js');
/* 보관 기준과 갈래 판정은 배치 본체가 정본입니다 — 여기서 다시 정의하지 않습니다. */
const CLEANUP = require('../api/_cleanup.js');

/** 본체와 **같은 값**입니다. ⛔ 여기서 다시 정의하지 않으려 했으나 본체가 내보내지 않습니다. */
const TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/;

function usage() {
  console.error('사용법:');
  console.error('  찾기      node --env-file=.env.local scripts/erasure.js --email <주소>');
  console.error('  미리보기  node --env-file=.env.local scripts/erasure.js <token>');
  console.error('  삭제      node --env-file=.env.local scripts/erasure.js <token> --apply');
  console.error('');
  console.error('  문의·알림(public.leads) — 축이 id 입니다 (위 --email 목록에 함께 나옵니다)');
  console.error('  미리보기  node --env-file=.env.local scripts/erasure.js --lead <id>');
  console.error('  삭제      node --env-file=.env.local scripts/erasure.js --lead <id> --apply');
}

function parseArgs(argv) {
  let apply = false;
  let email = '';
  let token = '';
  let lead = '';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') { apply = true; continue; }
    /* ⚠️ `--lead` 는 «명시» 입니다 — uuid 가 TOKEN_RE 에 들어맞아 맨 인자로는 접수
       토큰과 구분되지 않습니다(머리주석 「축이 토큰이 아니라 id 인 이유」). */
    if (arg === '--lead') {
      const value = argv[i + 1];
      lead = typeof value === 'string' ? value.trim() : '';
      i += 1;
      continue;
    }
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

  return { apply: apply, email: email, token: token, lead: lead };
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

/** 사람이 읽는 한 줄 — leads. ⛔ 문의 내용 원문을 통째로 찍지 않습니다(로그에 남습니다). */
function describeLead(row) {
  const kind = CLEANUP.leadKind(row) === 'notify' ? '출시 알림' : '문의·견적';
  const days = CLEANUP.LEADS_RETENTION_DAYS[CLEANUP.leadKind(row)];
  return [
    'id=' + row.id,
    row.email,
    kind,
    row.company ? '회사=' + row.company : '',
    row.inquiry ? '내용 ' + String(row.inquiry).length + '자' : '내용 없음',
    '접수=' + String(row.created_at || '').slice(0, 10),
    '보관 ' + days + '일',
  ].filter(Boolean).join(' · ');
}

/** leads 조회 — 읽기 전용. */
async function queryLeads(config, filter) {
  const select = 'id,email,name,company,inquiry,created_at,consent_privacy,consent_marketing';
  const response = await fetch(
    config.restUrl + '/leads?' + filter + '&select=' + select + '&order=created_at.desc',
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

  if (!args.email && !args.token && !args.lead) { usage(); return 2; }

  const config = readConfig();
  if (!config.ok) {
    console.error('설정 오류 — ' + config.error);
    return 2;
  }

  /* ── 찾기 — 읽기 전용 ─────────────────────────────────────────────────── */
  if (args.email) {
    if (args.apply) {
      console.error('⛔ --email 로는 지우지 않습니다. 목록에서 한 건을 골라 다시 실행하십시오.');
      console.error('   접수는 <token>, 문의·알림은 --lead <id> 입니다.');
      return 2;
    }
    let rows;
    try {
      rows = await query(config, 'email=eq.' + encodeURIComponent(args.email));
    } catch (err) {
      console.error('조회 실패: ' + (err && err.message ? err.message : err));
      return 1;
    }
    /* ⛔ 여기서 «접수 0건»으로 일찍 빠져나가지 마십시오 〔2026-09-01 실측으로 고침〕.
       종전 판이 그랬고, 그래서 접수는 없고 문의만 있는 사람(=`/contact` 로만 온 사람)이
       조회에서 **통째로 안 보였습니다.** 두 표를 다 읽고 나서 판단합니다. */
    let leadRows = [];
    try {
      leadRows = await queryLeads(config, 'email=eq.' + encodeURIComponent(args.email));
    } catch (err) {
      /* 🔴 leads 조회 실패로 intake 결과까지 버리지 않습니다 — 두 표는 서로 독립입니다. */
      console.error('문의·알림 조회 실패(접수 목록은 아래에 그대로 냅니다): ' +
        (err && err.message ? err.message : err));
    }

    if (rows.length === 0 && leadRows.length === 0) {
      console.log('기록이 없습니다 — ' + args.email);
      return 0;
    }

    console.log('[찾기] ' + args.email);
    console.log('  접수(intake) ' + rows.length + '건 · 문의·알림(leads) ' + leadRows.length + '건');

    if (rows.length) {
      console.log('\n— 접수(intake) —');
      for (const row of rows) {
        console.log('  ' + describe(row));
        console.log('    token: ' + row.access_token);
      }
      console.log('  지우려면: npm run erasure:apply -- <token>');
    }
    if (leadRows.length) {
      console.log('\n— 문의·알림(leads) —');
      for (const row of leadRows) {
        console.log('  ' + describeLead(row));
      }
      console.log('  지우려면: node --env-file=.env.local scripts/erasure.js --lead <id> --apply');
    }
    return 0;
  }

  /* ── leads 축 — id 하나 ───────────────────────────────────────────────── */
  if (args.lead) {
    let leadRows;
    try {
      leadRows = await queryLeads(config, 'id=eq.' + encodeURIComponent(args.lead));
    } catch (err) {
      console.error('조회 실패: ' + (err && err.message ? err.message : err));
      return 1;
    }
    const lead = leadRows[0];
    if (!lead) {
      console.error('그 id 의 문의·알림 기록이 없습니다.');
      return 1;
    }

    console.log((args.apply ? '[삭제] ' : '[미리보기] ') + config.baseUrl);
    console.log('  ' + describeLead(lead));

    if (!args.apply) {
      console.log('\n지울 것: 이 행 하나 (업로드 파일 없음 — leads 는 파일을 갖지 않습니다)');
      console.log('⛔ 되돌릴 수 없습니다.');
      console.log('실행: node --env-file=.env.local scripts/erasure.js --lead ' + args.lead + ' --apply');
      return 0;
    }

    try {
      /* 🔴 **본체에 위임합니다** — 삭제 코드는 api/ 에만 둡니다
         (test/erasure-cli.test.js 「스크립트가 파일을 스스로 지우지 않는다」).
         intake 는 api/erasure.js, leads 는 api/_cleanup.js 가 본체입니다.
         ⚠️ 목록 함수지만 **한 건만** 넘깁니다 — 목록 삭제 축을 여기 만들지 마십시오. */
      await CLEANUP.deleteLeadRows(config, [lead.id]);
    } catch (err) {
      console.error('삭제 실패: ' + (err && err.message ? err.message : err));
      return 1;
    }
    console.log('\n지웠습니다 — id=' + lead.id);
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
