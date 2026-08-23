#!/usr/bin/env node
'use strict';

/*
 * B3-b 배치 필수 조건 게이트 〔landing-b3b-hero-sample-check · 2026-08-23〕
 *
 *   node scripts/check-b3b-gates.js [baseRef]      기본 baseRef = HEAD
 *
 * 왜 스크립트인가: 아래 G7 은 **사람 눈으로 지킬 수 없습니다**. 토스 결제 심사가
 * 진행 중이라(PRD §2 P-1 · §8-2 미결 4번 · 2026-08-23 현재 미해소) 가격·결제 표면이
 * 1줄이라도 움직이면 그 자체로 fail 입니다. B1·B2·B3-a 와 같은 방식으로 보호 구간을
 * baseRef 판과 **바이트로** 대조합니다.
 *
 * 나머지 여섯도 성격이 같습니다 — G1(등재 누락)·G3(금지 표현)·G5(영문 CTA 혼입)은
 * **화면이 멀쩡한 채 실패하는** 종류라 눈으로는 안 잡힙니다.
 *
 * ⛔ 금지 문자열(G3 · G6)을 이 파일에 리터럴로 적지 마십시오 — 이 파일도 검사 대상이라
 *    적는 순간 스스로를 잡습니다. 아래처럼 조각으로 조립합니다.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.argv[2] || 'HEAD';

let failed = 0;
const pass = (m) => console.log('  ✓ ' + m);
const fail = (m) => { failed++; console.log('  ✗ ' + m); };

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/** 주석을 걷은 마크업. 이 저장소는 주석을 인수인계 수단으로 쓰고 빌드가 떼어냅니다. */
const markup = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

const SAMPLES = ['sample.html', 'en-sample.html'];

/* ══ G1. /sample · /en-sample 이 빌드 산출물에 있다 ═══════════════════════ */

/*
 * 🔴 **이것이 이 배치에서 가장 조용한 실패입니다.** 파일을 루트에 두고 STATIC 등재를
 *    빠뜨리면 로컬에서는 아무 이상이 없고 배포에서만 404 가 납니다 — 그리고 그 404 를
 *    밟는 것은 **랜딩 첫 화면의 버튼**입니다(PRD §4 「B3-1은 B3-5 없이 배포 불가」).
 * ⚠️ `npm run build` 를 먼저 돌리십시오. dist/ 는 빌드 산출물이라 여기서 만들지 않습니다.
 */
function gate1() {
  console.log('\nG1. /sample · /en-sample — STATIC 등재와 빌드 산출물');
  const STATIC = require(path.join(ROOT, 'scripts', 'build-static.js')).STATIC.html;
  for (const f of SAMPLES) {
    const row = STATIC.find((r) => r.file === f);
    if (!row) { fail(f + ': STATIC.html 에 없습니다 — 배포되지 않아 404 가 됩니다'); continue; }
    const wantLocale = f.startsWith('en-') ? 'en' : 'ko';
    if (row.locale !== wantLocale) fail(f + ": locale 이 '" + row.locale + "' 입니다 (기대: '" + wantLocale + "')");
    else pass(f + " STATIC 등재 · locale '" + row.locale + "'");

    const out = path.join(ROOT, 'dist', f);
    if (!fs.existsSync(out)) fail('dist/' + f + ' 이 없습니다 — `npm run build` 를 먼저 돌리십시오');
    else pass('dist/' + f + ' (' + fs.statSync(out).size + ' bytes)');
  }
  /* 예시 문서라 검색에 실물처럼 잡히면 안 됩니다 — 원본이 들고 온 성질이고 지키기만 합니다. */
  for (const f of SAMPLES) {
    if (/name="robots"[^>]*noindex/.test(read(f))) pass(f + ': noindex 유지');
    else fail(f + ': noindex 가 없습니다 — 예시 문서가 검색 결과에 실제 발급 문서처럼 뜹니다');
  }
}

/* ══ G2. 히어로 CTA2 — 국문 /sample · 영문 /en-sample ════════════════════ */

function heroBlock(rel) {
  const s = markup(read(rel));
  const a = s.indexOf('<section class="container hero">');
  const b = s.indexOf('</section>', a);
  if (a === -1 || b === -1) throw new Error(rel + ': 히어로 섹션을 찾지 못했습니다');
  return s.slice(a, b);
}

function gate2() {
  console.log('\nG2. 히어로 CTA2 링크');
  /* 🔴 **영문 히어로는 아직 `/en-sample` 을 가리키지 않습니다** — PRD §5 의 영문 확정본이
     없어 §5-1 을 옮기지 못했기 때문입니다(Plan §4). 그래서 이 게이트는 **국문만** 단정하고,
     영문은 「그 자리가 아직 옛 CTA 그대로인가」를 사실로 확인만 합니다.
     ⛔ 이 갈래를 지우지 마십시오 — 영문 확정본이 오는 날 여기가 바뀌어야 할 자리입니다. */
  try {
    const ko = heroBlock('index.html');
    if (/href="\/sample"/.test(ko)) pass('index.html 히어로 CTA2 → /sample');
    else fail('index.html 히어로에 /sample 링크가 없습니다');
    if (/href="https:\/\/app\.trops\.kr\/account\/password"/.test(ko)) pass('index.html 히어로 CTA1 → 앱 가입');
    else fail('index.html 히어로 CTA1 이 PRD §6-1 목적지가 아닙니다');
  } catch (e) { fail(e.message); }

  try {
    const en = heroBlock('en.html');
    if (/href="\/en-sample"/.test(en)) {
      pass('en.html 히어로 CTA2 → /en-sample (영문 확정본이 반영됐습니다)');
    } else {
      /* 미반영이 **의도된 상태**임을 여기서 명시합니다. 그냥 fail 로 두면 다음 사람이
         원인을 모른 채 영문 문구를 지어 넣습니다 — 그것이 이 배치가 막은 것입니다. */
      console.log('  · en.html 히어로 CTA2 미반영 — PRD §5 영문 확정본 부재(Plan §4). ' +
        '문구가 오면 이 자리를 /en-sample 로 바꾸고 위 갈래로 넘어갑니다');
    }
  } catch (e) { fail(e.message); }
}

/* ══ G3. 샘플 2종 — 금지 표현 0건 ════════════════════════════════════════ */

/*
 * PRD §5-11 「금지」 — 등급 표기 · 위험 점수 · 「즉시 조치 필요」.
 * 이 문서는 **판정하지 않습니다**(R1). 등급과 점수는 그 자체로 판정이고, 「즉시」는
 * 읽는 사람의 사정을 모른 채 시급성을 선언합니다.
 * ⛔ 리터럴로 적지 마십시오 — 이 파일도 저장소 파일이라 G6 과 같은 자기적발이 납니다.
 */
const BANNED_KO = ['등' + '급', '위험 ' + '점수', '위험' + '점수', '즉시 조치 ' + '필요'];
const BANNED_EN = ['immediate action ' + 'required', 'risk ' + 'score'];

function gate3() {
  console.log('\nG3. 샘플 2종 — 등급·위험 점수·즉시 조치 표현 0건 (PRD §5-11 「금지」)');
  for (const f of SAMPLES) {
    const t = read(f);
    const lower = t.toLowerCase();
    const hits = [];
    for (const w of BANNED_KO) if (t.indexOf(w) !== -1) hits.push(w);
    for (const w of BANNED_EN) if (lower.indexOf(w) !== -1) hits.push(w);
    if (hits.length === 0) pass(f + ': 0건');
    else fail(f + ': ' + hits.length + '건 — ' + JSON.stringify(hits));
  }
}

/* ══ G4. 샘플 2종 — 예시 표기 3종이 살아 있다 ════════════════════════════ */

/*
 * 🔴 **이 셋이 이 문서가 배포될 수 있는 유일한 근거입니다.** 가상의 기업 정보로 만든
 *    문서라 「예시」 표시가 하나라도 빠지면 실제 발급 문서로 읽힐 수 있습니다.
 *    셋을 **따로** 셉니다 — 하나로 뭉치면 둘이 남고 하나가 빠진 상태가 통과합니다.
 */
const SAMPLE_MARKS = [
  ['워터마크(문서 위 대각선)', (t) => /\.sheet::before\s*\{[\s\S]*?content:\s*"[^"]+"/.test(t) && /class="wm2/.test(t)],
  ['상단 바(랜딩에서 넘어온 사람용)', (t) => /class="pagebar"/.test(t)],
  ['하단 고지', (t) => /class="after"/.test(t) || /실제 발급 문서가 아닙니다|not an issued document/i.test(t)],
];

function gate4() {
  console.log('\nG4. 샘플 2종 — 예시 표기(워터마크 · 상단 바 · 하단 고지)');
  for (const f of SAMPLES) {
    const t = read(f);
    for (const [name, has] of SAMPLE_MARKS) {
      if (has(t)) pass(f + ' — ' + name);
      else fail(f + ': ' + name + ' 이 없습니다 — 예시 표시가 빠지면 실제 발급 문서로 읽힙니다');
    }
  }
}

/* ══ G5. en-sample.html 하단 CTA ═════════════════════════════════════════ */

/*
 * 지시: 하단 CTA 가 `[ Contact ] → /en#interest` 이고 「무료로 시작하기」 계열이 없다.
 * 🔴 **왜 영문만 다른가** — app.trops.kr 은 한국어 전용입니다(19b3cf3 결정). 영문 독자를
 *    가입 화면으로 보내면 읽을 수 없는 화면에 떨어집니다. 그래서 영문 샘플의 문은
 *    **문의**이고, 국문 샘플만 가입으로 갑니다.
 */
function gate5() {
  console.log('\nG5. en-sample.html 하단 CTA — [ Contact ] → /en#interest');
  const t = read('en-sample.html');
  if (/<a[^>]*href="\/en#interest"[^>]*>\s*Contact\s*<\/a>/.test(t)) pass('[ Contact ] → /en#interest');
  else fail('하단 CTA 가 [ Contact ] → /en#interest 가 아닙니다');

  /* 「무료로 시작하기」 계열 — 국문 문면과 영문 대응 라벨, 그리고 가입 화면 주소 자체. */
  const free = [];
  if (t.indexOf('무료로 시작') !== -1) free.push('무료로 시작하기');
  if (/account\/password/.test(t)) free.push('app.trops.kr/account/password');
  for (const en of ['Start free', 'Get started free', 'Sign up free']) {
    if (t.toLowerCase().indexOf(en.toLowerCase()) !== -1) free.push(en);
  }
  if (free.length === 0) pass('무료 시작 계열 CTA 0건');
  else fail('무료 시작 계열이 있습니다: ' + JSON.stringify(free) +
    ' — app.trops.kr 은 한국어 전용이라 영문 독자가 읽을 수 없는 화면에 떨어집니다');

  /* 국문 샘플은 반대로 가입으로 갑니다 — 둘이 뒤바뀌지 않았는지 함께 봅니다. */
  const ko = read('sample.html');
  if (/href="https:\/\/app\.trops\.kr\/account\/password"/.test(ko)) pass('sample.html 하단 CTA → 앱 가입');
  else fail('sample.html 하단 CTA 가 앱 가입이 아닙니다');
}

/* ══ G6. 폐기된 산출물 명칭 저장소 전체 0건 ══════════════════════════════ */

/*
 * PRD §7 B3 수용 기준이자 §8-1 결정 1 — 산출물 공식 명칭은 「사전 점검 리포트」입니다.
 * 사용자 지정 필수 조건 6 과 같은 규칙입니다(「진단」은 동사로만 허용).
 * ⛔ 이 게이트 파일도 그 낱말을 들고 있으면 스스로 걸리므로 조각으로 조립합니다.
 */
const RETIRED_WORD = '진단' + '서';
const SKIP = /^(dist|node_modules|\.git)\//;
const BINARY = /\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf|eot|mp4|zip)$/i;

function gate6() {
  console.log('\nG6. 폐기된 산출물 명칭 저장소 전체 0건 — PRD §7 · §8-1 결정 1');
  /* ⚠️ -z 필수 — 기본 출력은 한글 경로를 따옴표 인용해 내보내고, 그 문자열로 파일을
     열면 ENOENT 가 나 조용히 건너뜁니다(B1 에서 실제로 겪었습니다). */
  const files = execFileSync(
    'git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  ).split('\0').filter((f) => f && !SKIP.test(f) && !BINARY.test(f));

  const offenders = [];
  for (const f of files) {
    let t;
    try {
      if (!fs.statSync(path.join(ROOT, f)).isFile()) continue;
      t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    } catch (e) { fail('읽지 못한 파일: ' + f + ' (' + e.code + ')'); continue; }
    let at = t.indexOf(RETIRED_WORD);
    while (at !== -1) {
      offenders.push(f + ':' + (t.slice(0, at).split('\n').length));
      at = t.indexOf(RETIRED_WORD, at + 1);
    }
  }
  if (offenders.length === 0) pass('추적 파일 ' + files.length + '개 · 0건');
  else fail(offenders.length + '건: ' + offenders.join(', '));
}

/* ══ G7. 가격·결제 요소 diff 0줄 ═════════════════════════════════════════ */

/* B1 · B2 · B3-a 와 **같은 구현**입니다. 값을 바꾸지 마십시오 — 세 배치가 같은 자를
   써야 「한 번도 안 움직였다」가 배치를 건너 성립합니다. */
const PROTECTED_LINE_RE = /plan-price|pay-summary-value|pay-vat|₩330,000/;
const BLOCK_START = '<div class="pay-area"';
const BLOCK_END = 'id="intake-submit"';

function protectedSlice(text, file, label) {
  const lines = text.split('\n');
  const hits = lines.filter((l) => PROTECTED_LINE_RE.test(l));

  const start = lines.findIndex((l) => l.indexOf(BLOCK_START) !== -1);
  const end = lines.findIndex((l) => l.indexOf(BLOCK_END) !== -1);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      file + ' (' + label + '): 결제 폼 블록 경계를 찾지 못했습니다 — ' +
      '"' + BLOCK_START + '" .. "' + BLOCK_END + '" 순서가 깨졌습니다'
    );
  }
  return JSON.stringify({ hits, block: lines.slice(start, end + 1) }, null, 1);
}

function gate7() {
  console.log('\nG7. 가격·결제 요소 diff 0줄 (base: ' + BASE + ') — 토스 심사 진행 중');
  for (const file of ['precheck.html', 'en-precheck.html']) {
    let before;
    try {
      before = execFileSync('git', ['show', BASE + ':' + file], { cwd: ROOT, encoding: 'utf8' });
    } catch (e) {
      fail(file + ': ' + BASE + ' 판을 읽지 못했습니다 — 게이트를 통과시킬 수 없습니다');
      continue;
    }
    const after = read(file);

    let a, b;
    try {
      a = protectedSlice(before, file, BASE);
      b = protectedSlice(after, file, 'working');
    } catch (e) { fail(e.message); continue; }

    if (a === b) pass(file + ': 보호 구간(패턴 줄 + 결제 폼 블록) 바이트 동일');
    else fail(file + ': 🔴 보호 구간이 바뀌었습니다 — 토스 심사 fail 조건입니다');
  }
  /* 파일 전체 diff 도 함께 봅니다 — 이 배치는 두 파일을 아예 건드리지 않았습니다. */
  for (const file of ['precheck.html', 'en-precheck.html']) {
    let out = '';
    try {
      out = execFileSync('git', ['diff', '--numstat', BASE, '--', file], { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch (e) { fail(file + ': diff 를 읽지 못했습니다'); continue; }
    if (out === '') pass(file + ': 파일 전체 diff 0줄');
    else fail(file + ': 파일이 바뀌었습니다 — ' + out);
  }
}

/* ══ G8. 국문·영문 반영 상태 ═════════════════════════════════════════════ */

/*
 * 🔴 이 게이트는 **「영문도 다 됐다」를 단정하지 않습니다.** PRD §5 영문 확정본이 없어
 *    문구 5종을 옮기지 못했고(Plan §4), 그것을 통과로 적으면 거짓이 됩니다.
 *    대신 **영문에서 실제로 한 것**(샘플 등재)을 단정하고, 못 한 것을 목록으로 남깁니다.
 */
const KO_ONLY_COPY = [
  ['히어로 §5-1', '사전 점검 리포트로 기준을 세우세요.'],
  ['HOW §5-4', '품목과 국가를 입력하시면,'],
  ['탭① §5-5', '이 품목을 이 국가로 수출할 때'],
  ['진단 가능 범위 §5-6', '계약 전 단계라면, 수출 사전점검부터 시작하세요'],
  ['샘플 §5-11', '받아보시는 리포트는 이렇게 구성됩니다'],
];

function gate8() {
  console.log('\nG8. 국문·영문 반영');
  const ko = markup(read('index.html'));
  for (const [name, needle] of KO_ONLY_COPY) {
    if (ko.indexOf(needle) !== -1) pass('국문 ' + name);
    else fail('국문 ' + name + ' 이 index.html 에 없습니다');
  }
  /* 영문에서 한 것 — 샘플 페이지 등재는 문구가 필요 없어 함께 나갔습니다. */
  const STATIC = require(path.join(ROOT, 'scripts', 'build-static.js')).STATIC.html;
  if (STATIC.some((r) => r.file === 'en-sample.html' && r.locale === 'en')) pass('영문 샘플 등재');
  else fail('en-sample.html 이 영문으로 등재되지 않았습니다');

  console.log('  · 영문 미반영(원본 부재) — ' + KO_ONLY_COPY.map(([n]) => n).join(' · ') + ' · /check 문항 §5-18');
  console.log('    사유: PRD §5 영문 확정본 0건. B2·B3-a 보고서가 이미 이월로 적어 둔 항목입니다');
}

/* ══ 실행 ════════════════════════════════════════════════════════════════ */

console.log('B3-b 게이트 — landing-b3b-hero-sample-check');
for (const g of [gate1, gate2, gate3, gate4, gate5, gate6, gate7, gate8]) {
  try { g(); } catch (e) { fail('게이트 실행 중 예외: ' + (e && e.message)); }
}
console.log('\n' + (failed === 0 ? '전부 통과' : failed + '건 실패'));
process.exit(failed === 0 ? 0 : 1);
