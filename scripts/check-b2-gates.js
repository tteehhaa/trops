#!/usr/bin/env node
'use strict';

/*
 * B2 배치 절대 조건 게이트 〔landing-b2-products-footer · 2026-08-23〕
 *
 *   node scripts/check-b2-gates.js [baseRef]      기본 baseRef = HEAD
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

/* ══ G2. 「바이어 확인 / Buyer check」 탭·패널 0건 ═══════════════════════ */

/** 탭·패널이 살아 있으면 반드시 남는 흔적들. 주석 인용까지 함께 봅니다. */
const RETIRED_TAB = ['바이어 확인', 'Buyer check', 'feat-buyer', 'feat-buyer-panel'];

/*
 * 범위 = **배포되는 사이트 소스**. 루트 *.html 과 assets/·api/ 의 스크립트뿐입니다.
 * ⛔ docs/·doc/(기획 문서·인계 메모)와 test/ 는 뺍니다 — 「무엇을 왜 지웠는지」를 적으려면
 *    그 이름을 써야 하고, 그것까지 금지하면 결정 이력을 남길 수 없습니다. 조건이 말하는
 *    것은 **탭·패널이 화면에 없는가** 입니다.
 * ⛔ 이 게이트 파일 자신도 뺍니다 — 찾을 문자열을 들고 있어야 하므로 스스로에 걸립니다.
 */
const IN_SCOPE = (f) =>
  (/^[^/]+\.html$/.test(f) || /^(assets|api)\//.test(f)) &&
  !/^dist\//.test(f);
const BINARY = /\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf|eot|mp4|zip)$/i;

/*
 * ⚠️ -z (NUL 구분) 필수 — 기본 출력은 한글 경로를 따옴표 인용해 내보내고,
 *    그 문자열로 파일을 열면 ENOENT 가 나 조용히 건너뜁니다 (B1 에서 실제로 겪었습니다).
 * ⚠️ docs/ 는 뺍니다 — PRD·설계서가 「무엇을 지웠는지」를 적으려면 그 이름을 써야 합니다.
 */
function sourceFiles() {
  return execFileSync(
    'git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  ).split('\0').filter((f) => f && IN_SCOPE(f) && !BINARY.test(f));
}

function readAll() {
  const out = [];
  for (const f of sourceFiles()) {
    try {
      if (!fs.statSync(path.join(ROOT, f)).isFile()) continue;
      out.push([f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
    } catch (e) {
      fail('읽지 못한 파일이 있습니다: ' + f + ' (' + e.code + ')');
    }
  }
  return out;
}

function gate2(files) {
  console.log('\nG2. 「바이어 확인 / Buyer check」 탭·패널 0건 (배포 소스 · 국문·영문)');
  const offenders = [];
  for (const [f, text] of files) {
    for (const needle of RETIRED_TAB) {
      let at = text.indexOf(needle);
      while (at !== -1) {
        offenders.push(f + ':' + (text.slice(0, at).split('\n').length) + ' (' + needle + ')');
        at = text.indexOf(needle, at + 1);
      }
    }
  }
  if (offenders.length === 0) pass('소스 ' + files.length + '개 · 잔여 0건');
  else fail(offenders.length + '건: ' + offenders.join(', '));
}

/* ══ G3. 푸터 서비스명 전수 치환 ══════════════════════════════════════════ */

const FOOTER_KO_OLD = '수출 사전점검 · 바이어 확인 · 기한 관리';
const FOOTER_KO_NEW = '수출 사전점검 · 수출 계약관리 · 수출 채권관리';
const FOOTER_EN_OLD = 'Export pre-check · Buyer check · Deadline tracking';
const FOOTER_EN_NEW = 'Export pre-check · Export contract management · Export receivables management';

/* PRD §6-2 는 국문 6개로 적었지만 privacy.html 이 빠져 있었습니다 — 실측 7개입니다. */
const FOOTER_KO = ['index.html', 'uae.html', 'nda.html', 'refund.html', 'precheck.html', 'check.html', 'privacy.html'];
const FOOTER_EN = ['en.html', 'en-precheck.html', 'en-nda.html', 'en-check.html', 'en-privacy.html', 'en-refund.html', 'en-uae.html'];

function gate3() {
  console.log('\nG3. 푸터 서비스명 치환 (국문 ' + FOOTER_KO.length + ' + 영문 ' + FOOTER_EN.length + ')');
  let bad = 0;
  const check = (list, want, old, label) => {
    for (const f of list) {
      const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
      if (s.indexOf(want) === -1) { fail(f + ': 새 ' + label + ' 서비스명이 없습니다'); bad++; }
      if (s.indexOf(old) !== -1) { fail(f + ': 구 문자열이 남아 있습니다'); bad++; }
    }
  };
  check(FOOTER_KO, FOOTER_KO_NEW, FOOTER_KO_OLD, '국문');
  check(FOOTER_EN, FOOTER_EN_NEW, FOOTER_EN_OLD, '영문');
  if (bad === 0) pass('14개 파일 전부 치환 · 구 문자열 잔여 0건');
}

/* ══ G4. 상품 ③ 에 「알려드립니다」 부재 (P-3) ═══════════════════════════ */

function gate4() {
  console.log('\nG4. 상품 ③(수출 채권·보험관리) 문구에 「알려드립니다」 부재 — P-3');
  const s = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const start = s.indexOf('id="feat-timeline-panel"');
  if (start === -1) { fail('상품 ③ 패널(#feat-timeline-panel)을 찾지 못했습니다'); return; }
  const end = s.indexOf('</div>\n\n        </div>', start);
  const panel = s.slice(start, end === -1 ? start + 4000 : end)
    .replace(/<!--[\s\S]*?-->/g, '');           // 주석은 설명이지 화면 문면이 아닙니다
  if (panel.indexOf('알려드립니다') === -1) pass('상품 ③ 패널 문면에 「알려드립니다」 없음');
  else fail('🔴 상품 ③ 에 「알려드립니다」가 있습니다 — L1_EMAIL_TOKEN 미설정이라 지킬 수 없는 약속입니다');
}

/* ══ G5. CTA 링크 정확성 ═════════════════════════════════════════════════ */

const CTA = [
  ['index.html', 'https://app.trops.kr/procedures/new',   '상품 ② 수출 계약 등록하기'],
  ['index.html', 'https://app.trops.kr/profile/insurance', '상품 ③ 가입 상품 등록하기'],
  /* 🔄 **목적지가 바뀌었습니다** 〔2026-08-23 · B3-b · PRD §5-18 「분기 결과」〕.
     B2-9 는 이 자리를 앱 **가입**으로 보냈습니다(그때는 「지금 바로 써 볼 수 있는 길」을
     만드는 것이 목적이었습니다). §5-18 은 한 걸음 더 들어가 **사전점검 화면**으로 곧장
     보냅니다 — 앱 `/precheck` 는 로그인 없이 열립니다(2026-08-23 라이브 실측).
     🔴 B2 가 세운 것(「유료 아니면 문의뿐」을 없앤다)은 그대로입니다 — 무료 경로가
        더 짧아졌을 뿐입니다. ⛔ 이 줄을 지우지 마십시오. 목적지가 사라지면 그때는
        정말로 B2 가 되돌아간 것입니다. */
  ['check.html', 'https://app.trops.kr/precheck',  '/check 서류 없음 분기'],
];

function gate5() {
  console.log('\nG5. CTA 링크 목적지');
  for (const [f, url, label] of CTA) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    if (s.indexOf('href="' + url + '"') !== -1) pass(label + ' → ' + url);
    else fail(label + ': href="' + url + '" 가 없습니다');
  }
}

/* ══ G6. B3 영역 불가침 ══════════════════════════════════════════════════ */

/** 사용자가 「이번에 건드리지 않을 것」으로 지정한 자리. base 판과 바이트 동일해야 합니다. */
const B3_GUARD = [
  ['index.html', '<section class="container hero">', '<section class="stories-sec', '히어로'],
  ['index.html', '<section class="how" id="how">', '<section class="basis', 'HOW IT WORKS'],
  /*
   * 🔄 **근거 섹션 가드를 뗐습니다** 〔2026-08-23 · B3-a〕. B2 시점에는 B3 영역이었지만
   *    B3-a 가 §5-12 로 정당하게 교체했습니다. 그 내용은 이제
   *    scripts/check-b3a-gates.js G2 가 지킵니다(마지막 줄이 마지막인지까지 봅니다).
   * 🔄 **탭① 가드를 「문구」로 좁혔습니다** 〔2026-08-23 · B3-a〕. B3-a 작업 6이 그
   *    <figure> 를 assets/img/ 로 바꾸라고 명시적으로 지정했습니다. 문구(상태줄~실행버튼)는
   *    여전히 불가침입니다.
   * ⛔ 조용히 지우지 않았습니다 — 왜 빠졌는지가 여기 남아 있어야 다음 사람이 압니다.
   */
  ['index.html', '<span class="feat-avail">지금 쓸 수 있습니다</span>', '>비교해 보기</a>', '상품 탭 ① 문구'],
  ['index.html', '<button class="tab" type="button" role="tab" id="feat-precheck"', '</button>', '상품 탭 ① 버튼'],
];

/*
 * 🔴 **이 게이트는 2026-08-23 B3-b 배치로 임무를 마쳤습니다** — `check-b3a-gates.js` G6 과
 *    같은 사유·같은 처리입니다(그쪽 주석에 자세히 적어 두었습니다).
 *    요약: 지키던 세 자리를 B3-b 가 정본(PRD §5-1·§5-4·§5-5)으로 정당하게 교체했습니다.
 *    그대로 두면 다음 배치마다 뜻 없는 빨강이 뜨고, 뜻 없는 빨강은 곧 안 보게 됩니다.
 * ⛔ 지우지 않습니다 — 「B2 가 그 자리를 안 건드렸다」는 확인 수단이 사라집니다.
 */
/* 🔴 **양끝을 과거 커밋으로 고정합니다** — 사유는 `check-b3a-gates.js` G6 의 같은 자리
   주석과 같습니다(한쪽을 HEAD 로 두면 뒤 배치마다 뜻 없이 빨개집니다).
   이 게이트가 확인하는 것은 **B2 배치 한 번**입니다:
     `ad1a4e1~1` (B2 직전) → `ad1a4e1` (B2 배포). */
const B2_BEFORE = 'ad1a4e1~1';
const B2_AFTER = 'ad1a4e1';

function gate6() {
  console.log('\nG6. B3 영역 불가침 — B2 배치 구간 고정(' + B2_BEFORE + ' → ' + B2_AFTER + ')');
  let before, after;
  try {
    before = execFileSync('git', ['show', B2_BEFORE + ':index.html'], { cwd: ROOT, encoding: 'utf8' });
    after = execFileSync('git', ['show', B2_AFTER + ':index.html'], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    console.log('  · 그 두 판을 읽지 못해 건너뜁니다(얕은 클론일 수 있습니다)');
    return;
  }

  for (const [, startMark, endMark, label] of B3_GUARD) {
    const slice = (t) => {
      const a = t.indexOf(startMark);
      if (a === -1) return null;
      const b = t.indexOf(endMark, a);
      return b === -1 ? null : t.slice(a, b + endMark.length);
    };
    const x = slice(before), y = slice(after);
    if (x === null || y === null) {
      /* B3-b 이후에는 **정상**입니다 — 그 문면이 교체됐다는 뜻이고, 이 게이트의
         구간(B2~B3-a)에는 영향이 없습니다. */
      console.log('  · ' + label + ': B3-b 로 문면이 교체되어 경계가 없습니다(정상)');
      continue;
    }
    if (x === y) pass(label + ': B2 배치가 건드리지 않았습니다');
    else fail('🔴 B2 배치가 ' + label + ' 을 건드렸습니다');
  }
}

console.log('═══ B2 절대 조건 게이트 ═══');
gate1();
const files = readAll();
gate2(files); gate3(); gate4(); gate5(); gate6();
console.log('\n' + (failed === 0 ? '✅ 전 게이트 PASS' : '❌ ' + failed + '건 FAIL'));
process.exit(failed === 0 ? 0 : 1);
