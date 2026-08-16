/*
 * 처리 가능 여부 읽기 · 사유 문면 〔M-2 재착수 · 2026-08-11〕
 *
 * ⚠️ 경계 (반드시 지킬 것)
 *   이 파일은 **읽기만** 합니다. 「처리 가능한가」를 여기서 정하지 않습니다.
 *   정본은 판정층 trops_a 의 lib/precheck/intake-route.ts 이고, 그 결과가
 *   공유 Supabase 의 precheck_intake_route 표에 append-only 로 쌓입니다.
 *   이 저장소는 그 표를 select 하고, 사유 코드를 **문면으로 옮기는 일**만 합니다.
 *   (M-2 가 한 번 스코프 아웃된 이유가 이 인터페이스의 부재였습니다 —
 *    docs/verify/2026-08-11-batch-c2.md 「M-2」절.)
 *
 * 파일명이 밑줄로 시작하므로 Vercel 은 이 파일을 엔드포인트로 만들지 않습니다.
 *
 * ── 🔴 「등급」이 아닙니다 · 2값입니다 ──────────────────────────────────────
 *   재착수 결정(2026-08-11 · trops_a 회신)이 축을 바꿨습니다:
 *     ⛔ 자동 / 부분 / 불가 3단 등급   ← 만들지 않습니다
 *     ✅ route 2값(ok · blocked) + 사유 코드
 *
 *   그래서 이 파일에도, 화면에도, 메일에도 「등급」·「부분」이라는 낱말이 없습니다
 *   (C2 규칙). test/intake-route.test.js 가 그 두 낱말을 문면에서 금지합니다.
 *
 * ── 🔴 route='ok' 는 대외 문면이 없습니다 ───────────────────────────────────
 *   진행 가능하면 **아무것도 표시하지 않습니다.** 「진행 가능합니다」를 띄우면
 *   그것이 곧 등급 표시가 되고, 아직 처리 전인 건에 결과를 약속하는 문장이 됩니다.
 *   noticeFor() 가 blocked 에서만 문자열을 돌려주는 것이 그 규칙의 구현입니다.
 *
 * ── 🔴 표가 없어도 접수·확인은 그대로 돕니다 ────────────────────────────────
 *   표는 trops_a 소유이고 **이 글을 쓰는 시점에 아직 없습니다**(그쪽 미착수).
 *   그래서 readLatestRoute() 는 **던지지 않습니다** — 못 읽으면 available:false 로
 *   돌려주고, 확인 화면은 그 상태에서 아무것도 그리지 않습니다.
 *   ⛔ 여기서 예외를 던지면 표 하나 없는 것 때문에 접수 확인 화면 전체가
 *      「불러오지 못했습니다」가 됩니다. 부속 정보 하나가 본체를 잃게 하지 않습니다.
 *
 * ── append-only 라서 마지막 행만 봅니다 ─────────────────────────────────────
 *   뒤집힘(ok → blocked · blocked → ok)이 UPDATE 가 아니라 **새 행**으로 옵니다.
 *   그래서 언제나 decided_at 내림차순 첫 행이 현재 상태입니다. 과거 행을 보고
 *   환불하면 이미 되돌려진 판단으로 돈을 움직입니다.
 */

'use strict';

const { safeText } = require('./_supabase.js');

/**
 * trops_a 소유 표. 이 저장소는 select 만 합니다.
 * DDL 참조본은 precheck-schema.sql 「0-G」에 주석으로 있습니다(실행하지 않습니다).
 */
const TABLE = 'precheck_intake_route';

/**
 * 아는 값만 통과시킵니다 — api/intake.js readDeclaration() 과 같은 규칙입니다.
 *
 * 모르는 문자열을 통과시키면, trops_a 가 값을 늘렸을 때 이 저장소가 그 뜻을
 * 모르는 채로 문면을 붙이거나(더 나쁘게) 환불을 돌립니다.
 * 모르는 값은 **없는 것으로 둡니다** — 표시하지 않고 환불하지 않습니다.
 */
const ROUTES = ['ok', 'blocked'];

/**
 * 사유 코드 정본은 trops_a lib/rules/l1/preflight.ts 의 PreflightStop 입니다:
 *   "scan-only" | "unsupported-language"
 * 재착수 결정 ①의 「기존 중단 사유 2종 재사용」이 이 둘입니다.
 * ⚠️ 늘어나면 여기와 NOTICES 를 함께 늘리십시오. 늘리지 않아도 안전한 쪽으로
 *    떨어집니다(FALLBACK_NOTICE) — 다만 그때 문면이 뭉툭해집니다.
 */
const REASONS = ['scan-only', 'unsupported-language'];

/*
 * ── 문면 ────────────────────────────────────────────────────────────────────
 *
 * 🔴 scan-only 의 문장은 **새로 쓴 것이 아닙니다.** 업로드 시점에 이미 띄우고 있는
 *    M-1 지정 문장(precheck.html #textlayer-msg)과 **글자 그대로 같습니다.**
 *    같은 사실을 두 시점에 두 문장으로 말하면 이용자는 다른 일이 생긴 줄 압니다.
 *    test/intake-route.test.js 가 두 자리의 문장이 어긋나는 순간 red 를 냅니다.
 *
 * 🔴 unsupported-language 는 trops_a 의 문면을 **가져오지 않았습니다.**
 *    그쪽 L1_PREFLIGHT_UNSUPPORTED_LANGUAGE 는 「v1이 지원하지 않는 언어입니다」인데,
 *    재착수 결정 ③이 이 저장소 문면에서 **언어 이름과 「지원하지 않습니다」를
 *    금지**했습니다. 그래서 「범위 밖」계열 한 문장만 씁니다.
 *    ⛔ 두 문면을 「통일」하지 마십시오. 화면이 다르고 규칙이 다릅니다
 *       (app.trops.kr 은 그쪽 문면, www.trops.kr 은 이 문면).
 *
 * ⚠️ 어느 문면도 파일이 무엇인지·무슨 언어인지 말하지 않습니다.
 *    말하는 것은 「우리가 지금 확인할 수 있는 범위」 하나입니다.
 */
const NOTICES = {
  'scan-only':
    '이 파일에서 글자를 읽을 수 없습니다. 워드 파일이나 텍스트가 선택되는 PDF가 있으면 그것을 올려주세요.',
  'unsupported-language':
    '이 접수는 지금 확인할 수 있는 범위 밖입니다.',
};

/*
 * 영문 문면 〔2026-08-17 · 영문 접수 경로〕.
 *
 * 🔴 위 국문과 **같은 규칙**이 그대로 걸립니다:
 *    scan-only 는 업로드 시점에 이미 띄우는 문장(en-precheck.html #textlayer-msg)과
 *    **글자 그대로 같아야** 합니다. 같은 사실을 두 시점에 두 문장으로 말하면
 *    이용자는 다른 일이 생긴 줄 압니다. test/intake-route.test.js 가 국문·영문
 *    두 쌍을 모두 셉니다.
 * ⚠️ 여기에도 파일이 무엇인지·무슨 언어인지 적지 마십시오. 말하는 것은
 *    「우리가 지금 확인할 수 있는 범위」 하나입니다(국문과 같은 이유).
 */
const NOTICES_EN = {
  'scan-only':
    'We can’t read text from this file. If you have a Word file or a PDF with selectable text, please upload that instead.',
  'unsupported-language':
    'This submission is outside what we can check right now.',
};

/** 국문·영문 문면표. 모르는 locale 은 국문으로 떨어집니다(안전한 쪽). */
const NOTICE_SETS = { ko: NOTICES, en: NOTICES_EN };

/**
 * 사유를 모를 때의 문면.
 *
 * 언어 사유와 **같은 문장**을 씁니다. 일부러 그렇게 두었습니다 — 모르는 사유가
 * 왔을 때 문면이 달라지면, 그 차이 자체가 「무슨 일이 있었는지」를 흘립니다.
 * 범위 밖이라는 사실은 어느 사유든 참이고, 그 이상은 말할 근거가 없습니다.
 */
const FALLBACK_NOTICE = NOTICES['unsupported-language'];
const FALLBACK_NOTICE_EN = NOTICES_EN['unsupported-language'];

/**
 * 사유 코드 → 이용자에게 보여 줄 한 문장.
 *
 * blocked 가 아니면 null 입니다 — route='ok' 는 대외 문면이 없습니다(위 머리주석).
 * 돌려주는 것은 **사유 문면 하나**뿐입니다. 「그래서 돈은 어떻게 되는가」는
 * 부르는 쪽이 붙입니다(결제 상태를 아는 것은 부르는 쪽입니다).
 */
function noticeFor(route, reason, locale) {
  if (route !== 'blocked') return null;
  /* 🔴 모르는 locale 은 국문으로 떨어집니다. 접수는 국문이 기본이고, 언어를 모를 때
     빈 문면을 주는 것보다 국문 문면을 주는 편이 안전합니다(fail-safe).
     ⚠️ 인자를 빼고 부르는 곳이 여럿입니다(_route-refund.js · 테스트) — 그때도
        지금까지와 **똑같이** 국문을 돌려줍니다. 그러라고 뒤에 붙인 선택 인자입니다. */
  const set = NOTICE_SETS[locale] || NOTICES;
  if (typeof reason === 'string' && set[reason]) return set[reason];
  return set['unsupported-language'];
}

/** 표에서 읽어 온 행을 아는 값만 남기고 걸러냅니다. 모르면 null. */
function readRow(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const route = typeof raw.route === 'string' ? raw.route : '';
  if (ROUTES.indexOf(route) === -1) return null;

  const reason = typeof raw.reason === 'string' && REASONS.indexOf(raw.reason) !== -1
    ? raw.reason
    : null;

  return {
    route: route,
    reason: reason,
    decidedAt: raw.decided_at || null,
  };
}

/**
 * 접수 한 건의 **현재** route. append-only 표의 마지막 행입니다.
 *
 * 던지지 않습니다. 못 읽은 경우와 「아직 안 정해진 경우」를 구분해 돌려줍니다:
 *   { available:false, error }        표가 없다 · 컬럼이 다르다 · 접속 실패
 *   { available:true, row:null }      표는 읽었고 이 건에 대한 행이 아직 없다
 *   { available:true, row:{…} }       현재 상태
 *
 * ⚠️ 둘을 섞지 마십시오. 화면은 두 경우에 똑같이 아무것도 그리지 않지만,
 *    환불 배치는 「못 읽었다」에서 **한 건도 환불하지 않아야** 합니다.
 */
async function readLatestRoute(config, intakeId) {
  if (!intakeId) return { available: true, row: null };

  const query = '?intake_id=eq.' + encodeURIComponent(intakeId) +
    '&select=route,reason,decided_at&order=decided_at.desc&limit=1';

  try {
    const response = await fetch(config.restUrl + '/' + TABLE + query, { headers: config.headers });
    if (!response.ok) {
      return {
        available: false,
        error: TABLE + ' 읽기 실패 (HTTP ' + response.status + ') — ' +
          (await safeText(response)).slice(0, 200),
      };
    }
    const rows = await response.json();
    const raw = Array.isArray(rows) ? rows[0] : null;
    return { available: true, row: raw ? readRow(raw) : null };
  } catch (err) {
    return { available: false, error: err && err.message ? err.message : String(err) };
  }
}

/**
 * blocked 로 기록된 적이 있는 접수 id 목록 (환불 배치의 1차 후보).
 *
 * 「적이 있는」입니다 — append-only 라 여기 걸린 건이 나중에 ok 로 되돌려졌을 수
 * 있습니다. 그래서 부르는 쪽이 건마다 readLatestRoute() 로 **현재 상태를 다시
 * 확인해야** 합니다(api/_route-refund.js 가 그렇게 합니다).
 *
 * 못 읽으면 available:false — 그때 배치는 한 건도 환불하지 않습니다.
 *
 * ⚠️ 한 번에 가져오는 행 수에 상한이 있습니다. 상한에 닿으면 **truncated:true** 로
 *    알립니다 — 조용히 자르면 「전건 확인했다」로 읽히고, 상한 밖으로 밀려난
 *    오래된 건은 아무도 모르는 사이 영구히 환불되지 않습니다.
 */
const BLOCKED_SCAN_LIMIT = 500;

async function readBlockedIntakeIds(config, limit) {
  const max = limit || BLOCKED_SCAN_LIMIT;
  const query = '?route=eq.blocked&select=intake_id,decided_at' +
    '&order=decided_at.desc&limit=' + String(max);

  try {
    const response = await fetch(config.restUrl + '/' + TABLE + query, { headers: config.headers });
    if (!response.ok) {
      return {
        available: false,
        error: TABLE + ' 읽기 실패 (HTTP ' + response.status + ') — ' +
          (await safeText(response)).slice(0, 200),
      };
    }

    const rows = await response.json();
    const list = Array.isArray(rows) ? rows : [];
    const ids = [];
    const seen = Object.create(null);
    for (const row of list) {
      const id = row && row.intake_id;
      if (typeof id !== 'string' || !id || seen[id]) continue;
      seen[id] = true;
      ids.push(id);
    }
    return { available: true, ids: ids, truncated: list.length >= max, limit: max };
  } catch (err) {
    return { available: false, error: err && err.message ? err.message : String(err) };
  }
}

module.exports = {
  TABLE: TABLE,
  BLOCKED_SCAN_LIMIT: BLOCKED_SCAN_LIMIT,
  ROUTES: ROUTES,
  REASONS: REASONS,
  NOTICES: NOTICES,
  NOTICES_EN: NOTICES_EN,
  FALLBACK_NOTICE: FALLBACK_NOTICE,
  FALLBACK_NOTICE_EN: FALLBACK_NOTICE_EN,
  noticeFor: noticeFor,
  readRow: readRow,
  readLatestRoute: readLatestRoute,
  readBlockedIntakeIds: readBlockedIntakeIds,
};
