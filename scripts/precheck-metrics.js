#!/usr/bin/env node
/*
 * 사전 확인(/check) 퍼널 지표 — CLI 진입점.
 * 〔2026-08-15 · doc/s10 설계서 v3 §6-1 · §6-2〕
 *
 * 집계 본체는 api/_precheck-metrics.js 입니다. 여기는 실행 껍데기입니다
 * (인자 해석 · 설정 확인 · 콘솔 출력 · 종료코드) — scripts/cleanup-expired.js 와 같은 모양.
 *
 * ── 왜 관리자 화면이 아니라 스크립트인가 ────────────────────────────────────
 *   관리자 화면은 2단계입니다. 화면이 없다고 지표를 미루면, 화면을 만들 때
 *   「집계를 어떻게 할 것인가」부터 다시 시작하게 됩니다. 쿼리를 먼저 세워 두면
 *   그때는 이 파일이 부르는 것과 **같은 함수**를 라우트에서 부르기만 하면 됩니다.
 *   ⛔ 2단계에서 화면용 집계를 새로 짜지 마십시오(_precheck-metrics.js 머리주석).
 *
 * ── 실행 ────────────────────────────────────────────────────────────────────
 *   node --env-file=.env.local scripts/precheck-metrics.js
 *   node --env-file=.env.local scripts/precheck-metrics.js --from 2026-08-14
 *   node --env-file=.env.local scripts/precheck-metrics.js --from 2026-08-01 --to 2026-09-01
 *   node --env-file=.env.local scripts/precheck-metrics.js --json      기계용 출력
 *   node scripts/precheck-metrics.js --sql                             SQL 만 출력(접속 없음)
 *
 *   (package.json 의 metrics:precheck · metrics:precheck:json · metrics:precheck:sql)
 *
 * ── 인자 ────────────────────────────────────────────────────────────────────
 *   --from <ISO>        창 시작(이상). 생략하면 처음부터.
 *   --to <ISO>          창 끝(**미만**). 생략하면 지금까지.
 *   --gloss-date <ISO>  영문 병기(F-8) 도입 경계. 생략하면 커밋 4d236cf 시각.
 *                       PRECHECK_GLOSS_INTRODUCED_AT 환경변수로도 받습니다.
 *   --json              사람용 표 대신 JSON 한 덩어리.
 *   --sql               숫자 대신 대조용 SQL 9개를 출력하고 끝냅니다(DB 접속 없음).
 *
 * ── 필요한 환경변수 ─────────────────────────────────────────────────────────
 *   INTAKE_SUPABASE_URL · INTAKE_SUPABASE_SECRET_KEY
 *   api/_supabase.js 와 **같은 쌍**입니다 — precheck_prestep_session 은 접수 표와
 *   같은 앞단 프로젝트(trops-precheck)에 있습니다. 비밀 키라야 RLS 전면 차단(0008)을
 *   지나갑니다. 공개 키를 넣으면 표가 비어 보이는 것이 아니라 readConfig 가 세웁니다.
 *
 * ── ⚠️ 0 이 나오는 것은 실패가 아닙니다 ─────────────────────────────────────
 *   퍼널이 방금 열렸으므로 표본이 작습니다. 이 스크립트가 하는 일은 숫자를 크게
 *   만드는 것이 아니라 **분모를 정확히 가르는 것**입니다(§6-2). 다만 「0 인데
 *   왜 0 인가」가 애매한 자리는 warnings 로 이름을 대고 알립니다.
 */

'use strict';

const { readConfig } = require('../api/_supabase.js');
const METRICS = require('../api/_precheck-metrics.js');

/* ── 인자 해석 ──────────────────────────────────────────────────────────── */

function readArg(argv, name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  const value = argv[i + 1];
  if (!value || value.slice(0, 2) === '--') {
    throw new Error(name + ' 뒤에 값이 없습니다');
  }
  return value;
}

/* ── 출력 ───────────────────────────────────────────────────────────────── */

/** 분모 0 → '—'. 0.0% 로 찍으면 「잴 수 없다」가 「0% 다」로 둔갑합니다. */
function pct(rate) {
  if (rate === null || rate === undefined) return '—';
  return (rate * 100).toFixed(1) + '%';
}

function fraction(m) {
  return String(m.numerator) + '/' + String(m.denominator);
}

/**
 * 터미널에서 한글·기호(①②)는 두 칸을 먹습니다. String.padEnd 는 코드 단위로 세므로
 * 라벨에 한글이 섞이면 열이 어긋납니다 — 폭으로 세어 맞춥니다.
 */
function padLabel(label, width) {
  let w = 0;
  for (const ch of label) {
    const code = ch.codePointAt(0);
    w += (code >= 0x1100 && code <= 0x115f) || (code >= 0x2460 && code <= 0x24ff) ||
         (code >= 0x2e80 && code <= 0xa4cf) || (code >= 0xac00 && code <= 0xd7a3) ||
         (code >= 0xf900 && code <= 0xfaff) || (code >= 0xff00 && code <= 0xff60) ? 2 : 1;
  }
  return label + ' '.repeat(Math.max(1, width - w));
}

function line(label, m) {
  const rate = pct(m.rate).padStart(7);
  const note = m.denominatorNote ? '   분모: ' + m.denominatorNote : '';
  return '  ' + padLabel(label, 16) + rate + '  (' + fraction(m) + ')' + note;
}

function render(result) {
  const out = [];
  const p = result.population;
  const m = result.metrics;

  const from = result.window.from || '(처음부터)';
  const to = result.window.to || '(지금까지)';
  out.push('창: ' + from + ' ~ ' + to);
  out.push('');

  out.push('모집단 — 분모 분할 (설계서 §6-2)');
  out.push('  진입          ' + p.entered);
  out.push('  Q2 응답       ' + p.docsAnswered + '   (미응답 ' + p.docsUnanswered + ')');
  out.push('    서류 보유    ' + p.docsHolders + '   ← 접수 전환율의 분모');
  out.push('    서류 없음    ' + p.docsNonHolders + '   ← 알림 등록률의 분모');
  out.push('');

  out.push('지표 (설계서 §6-1)');
  out.push('  ' + padLabel('① 진입 수', 16) + String(m.entered.count).padStart(7));
  out.push(line('② 스킵률', m.skipRate));
  out.push('  ' + padLabel('③ 이탈 스텝', 16) + 'completed_step 분포   분모: 진입 전체');
  for (const step of [0, 1, 2, 3]) {
    const s = m.exitStep.steps[step];
    out.push('  ' + padLabel('     step ' + step, 16) + pct(s.rate).padStart(7) + '  (' + s.count + '/' + m.exitStep.denominator + ')');
  }
  out.push(line('④ 우회율', m.bypassRate));
  out.push(line('⑤ 완주율', m.completionRate));
  out.push(line('⑥ 접수 전환', m.intakeConversion));
  out.push(line('⑦ 알림 등록률', m.notifyRate));
  out.push('  ' + padLabel('⑧ other_doc', 16) + '영문 병기 도입 경계: ' + m.otherDocShare.boundary);
  out.push(line('     도입 전', m.otherDocShare.before));
  out.push(line('     도입 후', m.otherDocShare.after));
  out.push('  ' + padLabel('⑨ 로드맵', 16) + '수요 신호 — 「준비중」 상품 개시 판단');
  out.push(line('     매매계약서', m.roadmapDemand.sales_contract));
  out.push(line('     견적서·PI', m.roadmapDemand.quote_pi));
  out.push(line('     둘 중 하나', m.roadmapDemand.either));

  if (result.warnings.length > 0) {
    out.push('');
    out.push('⚠️  읽기 전에');
    for (const w of result.warnings) out.push('  · ' + w);
  }

  return out.join('\n');
}

/* ── 본체 ───────────────────────────────────────────────────────────────── */

async function main(argv) {
  let from, to, gloss;
  try {
    from = readArg(argv, '--from');
    to = readArg(argv, '--to');
    gloss = readArg(argv, '--gloss-date') || process.env.PRECHECK_GLOSS_INTRODUCED_AT || null;
  } catch (err) {
    console.error('인자 오류 — ' + err.message);
    return 2;
  }

  // --sql 은 DB 를 보지 않습니다. 설정이 없는 자리에서도 쿼리를 꺼내 볼 수 있어야 합니다.
  if (argv.indexOf('--sql') !== -1) {
    const keys = Object.keys(METRICS.SQL);
    console.log('-- :from · :to · :gloss 를 값으로 바꿔 Supabase SQL Editor 에 붙여넣으십시오.');
    console.log('-- 정본은 api/_precheck-metrics.js 의 순수 함수이고, 아래는 대조용입니다.\n');
    for (const key of keys) console.log(METRICS.SQL[key] + '\n');
    return 0;
  }

  const config = readConfig();
  if (!config.ok) {
    console.error('설정 오류 — ' + config.error);
    return 2;
  }

  let fetched;
  try {
    fetched = await METRICS.fetchSessions(config, { from: from, to: to });
  } catch (err) {
    console.error('조회 실패 — ' + (err && err.message ? err.message : err));
    return 1;
  }

  let result;
  try {
    result = METRICS.computeMetrics(fetched.rows, {
      from: from,
      to: to,
      glossIntroducedAt: gloss || undefined,
    });
  } catch (err) {
    console.error('집계 실패 — ' + (err && err.message ? err.message : err));
    return 1;
  }

  if (fetched.truncated) {
    // 잘린 집계는 틀린 집계입니다. 조용히 작은 숫자를 내보내지 않습니다.
    result.warnings.push(
      '읽기 상한(' + METRICS.MAX_PAGES * METRICS.PAGE_SIZE + '행)에 닿아 뒷부분을 ' +
      '읽지 못했습니다 — 아래 숫자는 전부가 아닙니다. --from/--to 로 창을 좁히십시오.'
    );
  }

  if (argv.indexOf('--json') !== -1) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(config.baseUrl);
    console.log(render(result));
  }

  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

/* 집계 본체를 다시 내보냅니다 — scripts/cleanup-expired.js 와 같은 이유입니다. */
module.exports = {
  pct: pct,
  render: render,
  main: main,
  computeMetrics: METRICS.computeMetrics,
  fetchSessions: METRICS.fetchSessions,
  SQL: METRICS.SQL,
};
