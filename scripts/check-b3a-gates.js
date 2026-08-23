#!/usr/bin/env node
'use strict';

/*
 * B3-a 배치 필수 조건 게이트 〔landing-b3a-basis-pricing · 2026-08-23〕
 *
 *   node scripts/check-b3a-gates.js [baseRef]      기본 baseRef = HEAD
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

/* ══ G2. 근거 섹션 — §5-12 의 마지막 줄이 정확히 있다 ════════════════════ */

/** 🔴 사용자 지정 필수 문장. 이 줄이 근거 섹션의 **마지막**이라는 것이 §5-12 의 요점입니다. */
const BASIS_LAST = '확인 기준일이 없는 항목은 화면에 표시하지 않습니다.';
/** §5-12 가 세운 세 근거 축 — 하나라도 빠지면 「근거를 밝힌다」가 반쪽이 됩니다. */
const BASIS_AXES = ['규정 근거', '관세 근거', '문서 기준'];

function gate2() {
  console.log('\nG2. 근거 섹션 §5-12');
  const s = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const a = s.indexOf('<section class="basis');
  const b = s.indexOf('</section>', a);
  if (a === -1 || b === -1) { fail('근거 섹션을 찾지 못했습니다'); return; }
  const sec = s.slice(a, b);

  if (sec.indexOf(BASIS_LAST) !== -1) pass('마지막 줄 정확 포함: 「' + BASIS_LAST + '」');
  else fail('🔴 마지막 줄이 없습니다: 「' + BASIS_LAST + '」');

  for (const ax of BASIS_AXES) {
    if (sec.indexOf(ax) !== -1) pass('근거 축 「' + ax + '」');
    else fail('근거 축 「' + ax + '」이 없습니다');
  }
  /* 그 줄이 **마지막**인지 — 뒤에 다른 본문이 오면 「표시하지 않습니다」가 단서로 읽힙니다. */
  const after = sec.slice(sec.indexOf(BASIS_LAST) + BASIS_LAST.length).replace(/<[^>]*>/g, '').trim();
  if (after.length === 0) pass('그 줄 뒤에 다른 본문이 없습니다');
  else fail('마지막 줄 뒤에 본문이 남아 있습니다: ' + after.slice(0, 60));
}

/* ══ G3. 「사전 점검 리포트」 저장소 전체 0건 ══════════════════════════════════════ */

/*
 * PRD §7 B3 수용 기준이자 §8-1 결정 1 — 산출물 명칭은 「사전 점검 리포트」이고
 * 「사전 점검 리포트」는 쓰지 않습니다. ⛔ 이 게이트 파일도 그 낱말을 들고 있으면 스스로 걸리므로
 * 조각으로 조립합니다.
 */
const RETIRED_WORD = '진단' + '서';
const SKIP = /^(dist|node_modules|\.git)\//;
const BINARY = /\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf|eot|mp4|zip)$/i;

function gate3() {
  console.log('\nG3. 「' + RETIRED_WORD + '」 저장소 전체 0건 — PRD §7 · §8-1 결정 1');
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

/* ══ G4. 3탭 이미지 — 지정 파일명 · 동일 비율 ════════════════════════════ */

const TAB_IMAGES = [
  'assets/img/precheck-report.jpg',
  'assets/img/contract-list.jpg',
  'assets/img/policy-deadlines.jpg',
];

/**
 * JPEG 헤더에서 크기를 읽습니다(의존성 추가 없이).
 * SOF0/1/2/3, SOF5~7, SOF9~11, SOF13~15 마커의 payload 앞부분에 height, width 가 있습니다.
 */
function jpegSize(buf) {
  let i = 2;                                   // SOI(FFD8) 다음부터
  while (i < buf.length - 9) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

function gate4() {
  console.log('\nG4. 3탭 이미지 — 지정 파일명 · 동일 비율');
  const ratios = [];
  for (const rel of TAB_IMAGES) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) { fail(rel + ': 파일이 없습니다'); continue; }
    const size = jpegSize(fs.readFileSync(p));
    if (!size) { fail(rel + ': JPEG 크기를 읽지 못했습니다'); continue; }
    ratios.push([rel, size.w / size.h, size]);
    pass(rel + ' — ' + size.w + 'x' + size.h);
  }
  if (ratios.length === TAB_IMAGES.length) {
    const base = ratios[0][1];
    const off = ratios.filter(([, r]) => Math.abs(r - base) > 0.001);
    if (off.length === 0) pass('세 이미지 비율 동일 (' + base.toFixed(4) + ')');
    else fail('비율이 다릅니다: ' + off.map(([f, r]) => f + '=' + r.toFixed(4)).join(', '));
  }
  /* 마크업이 그 파일을 실제로 참조하는지 — 파일만 있고 안 쓰면 뜻이 없습니다. */
  for (const f of ['index.html', 'en.html']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const miss = TAB_IMAGES.filter((rel) => s.indexOf('/' + rel) === -1);
    if (miss.length === 0) pass(f + ': 세 이미지를 모두 참조');
    else fail(f + ': 참조 없음 — ' + miss.join(', '));
  }
}

/* ══ G5. 국문·영문 양쪽 반영 ═════════════════════════════════════════════ */

/** 각 항목이 국·영 양쪽에 있는지 — 한쪽만 고치면 두 페이지가 다른 제품을 설명합니다. */
const BILINGUAL = [
  ['근거 §5-12',      '확인 기준일이 없는 항목은',            'Items without a verification date'],
  ['무료·유료 §5-13', 'pricing-sec',                          'pricing-sec'],
  ['WHAT\'S NEXT §5-14', '수출 업무 전 과정을 더 촘촘하게',   'Connecting the whole export workflow'],
  ['스토리 §5-15',    '수출은 계약서에 서명한 뒤부터',        'the real work starts'],
  ['중간 CTA §5-16',  '지금 검토 중이신 수출 건부터',         'Start with the export deal'],
  ['FAQ 결과물의 성격', '결과물의 성격',                      'What you get'],
];

function gate5() {
  console.log('\nG5. 국문·영문 양쪽 반영');
  const ko = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const en = fs.readFileSync(path.join(ROOT, 'en.html'), 'utf8');
  for (const [name, koNeedle, enNeedle] of BILINGUAL) {
    const a = ko.indexOf(koNeedle) !== -1, b = en.indexOf(enNeedle) !== -1;
    if (a && b) pass(name);
    else fail(name + ': ' + (!a ? 'index.html 누락 ' : '') + (!b ? 'en.html 누락' : ''));
  }
}

/* ══ G6. B3-b 영역 불가침 ════════════════════════════════════════════════ */

/*
 * 🔄 B2 의 G6 에서 **근거 섹션을 뺐습니다** — 이번 배치의 대상입니다(G2 가 대신 지킵니다).
 *    탭① 은 **문구 부분으로 좁혔습니다** — 작업 6이 그 <figure> 를 명시적으로 지정했습니다.
 */
const B3B_GUARD = [
  ['<section class="container hero">', '<section class="stories-sec', '히어로'],
  ['<section class="how" id="how">', '<section class="basis', 'HOW IT WORKS'],
  /*
   * 탭① 「문구」의 경계를 **상태줄부터 실행버튼까지**로 잡습니다. 종전에는 패널 시작~<figure>
   * 였는데, 그 사이에 그림을 설명하는 주석이 들어오면서 오탐이 났습니다 — 주석은 그림에
   * 딸린 것이고, 그림은 작업 6이 명시적으로 바꾸라고 지정한 대상입니다.
   */
  ['<span class="feat-avail">지금 쓸 수 있습니다</span>', '>비교해 보기</a>', '상품 탭 ① 문구'],
];

function gate6() {
  console.log('\nG6. B3-b 영역 불가침 (base: ' + BASE + ')');
  let before;
  try { before = execFileSync('git', ['show', BASE + ':index.html'], { cwd: ROOT, encoding: 'utf8' }); }
  catch (e) { fail('index.html 의 ' + BASE + ' 판을 읽지 못했습니다'); return; }
  const after = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const [startMark, endMark, label] of B3B_GUARD) {
    const slice = (t) => {
      const a = t.indexOf(startMark); if (a === -1) return null;
      const b = t.indexOf(endMark, a); return b === -1 ? null : t.slice(a, b);
    };
    const x = slice(before), y = slice(after);
    if (x === null || y === null) { fail(label + ': 경계를 찾지 못했습니다'); continue; }
    if (x === y) pass(label + ': 바이트 동일');
    else fail('🔴 ' + label + ' 이 바뀌었습니다 — B3-b 영역입니다');
  }
}

console.log('═══ B3-a 필수 조건 게이트 ═══');
gate1(); gate2(); gate3(); gate4(); gate5(); gate6();
console.log('\n' + (failed === 0 ? '✅ 전 게이트 PASS' : '❌ ' + failed + '건 FAIL'));
process.exit(failed === 0 ? 0 : 1);
