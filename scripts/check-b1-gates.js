#!/usr/bin/env node
'use strict';

/*
 * B1 배치 절대 조건 게이트 〔landing-b1-facts-freecopy · 2026-08-23〕
 *
 *   node scripts/check-b1-gates.js [baseRef]      기본 baseRef = HEAD
 *
 * 왜 스크립트인가: 아래 G1 은 **사람 눈으로 지킬 수 없습니다**. 토스 결제 심사가
 * 진행 중이라 가격·결제 표면이 1줄이라도 움직이면 그 자체로 fail 인데, 이 배치는
 * 같은 두 파일(precheck.html · en-precheck.html)의 **바로 옆 줄**을 고칩니다.
 * 보호 구간을 baseRef 판과 바이트로 대조하는 것 말고는 보증할 방법이 없습니다.
 *
 * ⛔ 금지 문자열(G2)을 이 파일에 리터럴로 적지 마십시오 — 이 파일도 검사 대상이라
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

/* ══ G1. 가격·결제 요소 diff 0줄 ══════════════════════════════════════════ */

/** 보호 대상 패턴 — 이 문자열이 든 줄은 한 글자도 바뀌면 안 됩니다. */
const PROTECTED_LINE_RE = /plan-price|pay-summary-value|pay-vat|₩330,000/;

/** 결제 폼 블록 — 여는 줄부터 결제 버튼 줄까지. */
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

function gate1() {
  console.log('\nG1. 가격·결제 요소 diff 0줄 (base: ' + BASE + ')');
  for (const file of ['precheck.html', 'en-precheck.html']) {
    let before;
    try {
      before = execFileSync('git', ['show', BASE + ':' + file], { cwd: ROOT, encoding: 'utf8' });
    } catch (e) {
      fail(file + ': ' + BASE + ' 판을 읽지 못했습니다 — 게이트를 통과시킬 수 없습니다');
      continue;
    }
    const after = fs.readFileSync(path.join(ROOT, file), 'utf8');

    let a, b;
    try {
      a = protectedSlice(before, file, BASE);
      b = protectedSlice(after, file, 'working');
    } catch (e) {
      fail(e.message);
      continue;
    }

    if (a === b) {
      pass(file + ': 보호 구간(패턴 줄 + 결제 폼 블록) 바이트 동일');
    } else {
      fail(file + ': 🔴 보호 구간이 바뀌었습니다 — 토스 심사 fail 조건입니다');
      const al = JSON.parse(a), bl = JSON.parse(b);
      const diffOne = (name, x, y) => {
        const max = Math.max(x.length, y.length);
        for (let i = 0; i < max; i++) {
          if (x[i] !== y[i]) {
            console.log('      [' + name + ' #' + i + ']');
            console.log('      - ' + String(x[i]).trim());
            console.log('      + ' + String(y[i]).trim());
          }
        }
      };
      diffOne('패턴줄', al.hits, bl.hits);
      diffOne('결제폼', al.block, bl.block);
    }
  }
}

/* ══ G2. 금지 문자열 0건 ═════════════════════════════════════════════════ */

/** ⛔ 조각으로 조립합니다 — 위 머리주석 참조. */
const BANNED = [
  ['First 20 submissions', 'free'].join(' '),
  ['No login', 'required'].join(' '),
  ['남은', '자리'].join(' '),
  '선' + '착순',
  ['무료', '실증'].join(' '),
];

const SKIP_DIR = /^(dist|node_modules|\.git)\//;
const BINARY = /\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf|eot|mp4|zip)$/i;

/*
 * 추적 파일 + 무시되지 않은 미추적 파일. 「저장소 전체」가 조건이므로 아직 커밋되지
 * 않은 새 파일도 봅니다.
 * ⚠️ -z (NUL 구분) 가 필수입니다 — 기본 출력은 한글 경로를 "…\353…" 로 따옴표 인용해
 *    내보내고, 그 문자열로 파일을 열면 ENOENT 가 나 **조용히 건너뜁니다**.
 */
function trackedFiles() {
  return execFileSync(
    'git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  )
    .split('\0')
    .filter((f) => f && !SKIP_DIR.test(f) && !BINARY.test(f));
}

function gate2() {
  console.log('\nG2. 종료된 무상 제공 문구 0건 (저장소 전체 · dist/ node_modules/ 제외)');
  const files = trackedFiles();
  const offenders = [];
  for (const f of files) {
    let text;
    try {
      const st = fs.statSync(path.join(ROOT, f));
      if (!st.isFile()) continue;
      text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    } catch (e) {
      // ⛔ 조용히 넘기지 않습니다 — 못 읽은 파일은 「0건」의 근거가 될 수 없습니다.
      fail('읽지 못한 파일이 있습니다: ' + f + ' (' + e.code + ')');
      continue;
    }
    for (const needle of BANNED) {
      let at = text.indexOf(needle);
      while (at !== -1) {
        offenders.push(f + ':' + (text.slice(0, at).split('\n').length));
        at = text.indexOf(needle, at + 1);
      }
    }
  }
  if (offenders.length === 0) pass('추적 파일 ' + files.length + '개 · 금지 문자열 5종 0건');
  else fail('금지 문자열 ' + offenders.length + '건: ' + offenders.join(', '));
}

/* ══ G3. itemCount = 17 ══════════════════════════════════════════════════ */

function gate3() {
  console.log('\nG3. site.config.json precheck.itemCount = 17');
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
  const n = cfg && cfg.precheck && cfg.precheck.itemCount;
  if (n === 17) pass('itemCount = 17');
  else fail('itemCount = ' + JSON.stringify(n) + ' (기대값 17)');
}

/* ══ G4. 알림 주기 표기 ══════════════════════════════════════════════════ */

const CYCLE = '30일 전, 7일 전, 1일 전';

function gate4() {
  console.log('\nG4. 알림 주기 표기 = 「' + CYCLE + '」');
  for (const f of ['index.html', 'en.html']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (s.indexOf(CYCLE) !== -1) pass(f + ': 표기 있음');
    else fail(f + ': 「' + CYCLE + '」 표기가 없습니다');
  }
}

/* ══ G5. dist/ 산출물에도 금지 문자열 0건 ════════════════════════════════ */

function gate5() {
  console.log('\nG5. dist/ 산출물 금지 문자열 0건');
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(dist)) { fail('dist/ 가 없습니다 — npm run build 를 먼저 돌리십시오'); return; }
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (!BINARY.test(e.name)) {
        const text = fs.readFileSync(p, 'utf8');
        for (const needle of BANNED) {
          if (text.indexOf(needle) !== -1) offenders.push(path.relative(ROOT, p));
        }
      }
    }
  };
  walk(dist);
  if (offenders.length === 0) pass('dist/ 정상');
  else fail('dist/ 잔존: ' + [...new Set(offenders)].join(', '));
}

console.log('═══ B1 절대 조건 게이트 ═══');
gate1(); gate2(); gate3(); gate4(); gate5();
console.log('\n' + (failed === 0 ? '✅ 전 게이트 PASS' : '❌ ' + failed + '건 FAIL'));
process.exit(failed === 0 ? 0 : 1);
