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
/*
 * 🔴 **BASE 를 B3-a 배치 커밋으로 «고정»합니다** 〔2026-09-03〕.
 *    종전 기본값은 `HEAD` 였습니다 — 뒤 배치가 랜딩을 정당하게 바꿀 때마다 이 게이트가
 *    뜻 없이 빨개졌고, **뜻 없는 빨강은 곧 안 보게 됩니다**(같은 판단이 이 파일 G6 ·
 *    check-b1-gates.js G1 주석에 있습니다). 확인하는 것은 **B3-a 배치 한 번**입니다:
 *    `061da9f~1` → `061da9f`.
 * ⚠️ 인자로 다른 ref 를 주면 그 구간을 봅니다(진단용). 기본값을 HEAD 로 되돌리지 마십시오.
 */
const BASE = process.argv[2] || '061da9f';
/*
 * 🔴 **배치 판을 읽습니다 — 작업 트리가 아닙니다** 〔2026-09-03〕.
 *    이 게이트가 지키던 페이지들은 그 뒤 정당하게 바뀌거나(2026-08-29 랜딩 전면교체)
 *    저장소를 떠났습니다(`ca47218` 이 6장, `77c9162` 이 샘플 2장). 작업 트리를 읽으면
 *    「없는 파일」·「바뀐 문면」으로 영구히 빨개지는데, 이 게이트가 확인하는 것은
 *    **그 배치 한 번**이라 배치 판을 읽는 것이 맞습니다.
 * ⚠️ 그래서 이 파일은 **현재를 지키지 않습니다.** 현재를 지키는 축은 `test/` 로
 *    옮겼습니다 — landing-invariants(되살아나면 안 되는 문구 · 무료 경로 CTA ·
 *    알림 약속 · 알림 주기) · i18n-parity(푸터 서비스명) · price-exposure(결제 표면 부재).
 */
const readPinned = (rel) => execFileSync(
  'git', ['show', BASE + ':' + rel],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
);


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
      before = execFileSync('git', ['show', BASE + '~1:' + file], { cwd: ROOT, encoding: 'utf8' });
    } catch (e) {
      fail(file + ': ' + BASE + ' 판을 읽지 못했습니다 — 게이트를 통과시킬 수 없습니다');
      continue;
    }
    const after = readPinned(file);

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
  const s = readPinned('index.html').replace(/<!--[\s\S]*?-->/g, '');
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
/*
 * 🔄 **폐기 단정을 거뒀습니다** 〔2026-09-03 · 대표 결정〕.
 *
 *    이 게이트는 그 낱말이 저장소 전체에 0건이어야 한다고 단정했습니다(PRD §7 · §8-1
 *    결정 1). 그런데 실측하니 **라이브에 7곳** 있었습니다 — precheck 결과 화면의 CTA
 *    제목과 도움말, index 의 예시 행입니다. 게이트가 죽어 있는 동안(뒤 배치가 대상
 *    페이지를 교체해 red 였습니다) 들어왔고, 아무도 못 봤습니다.
 *
 * 🔴 **회귀가 아니라 «반전된 결정»입니다** — 그 낱말은 지금 **앱 문서의 이름**으로
 *    살아 있습니다(app.trops.kr 의 수출 절차 문서). 랜딩이 그 문서로 보내면서 그
 *    이름으로 부르는 것이 맞습니다. 그래서 단정을 지우고 사유를 남깁니다.
 *
 * ⚠️ **남은 물음** — 같은 대상을 지금 두 이름으로 부릅니다. 2026-09-03 상품명 개편이
 *    1단계를 「수출 사전점검 리포트」로 정했고(§8-1 결정 1 의 「리포트」와 같은 축),
 *    precheck 결과 화면은 앱 문서를 옛 이름으로 부릅니다. 어느 쪽으로 모을지는
 *    **정해지지 않았습니다.** ⛔ 정해지기 전에 한쪽을 임의로 고치지 마십시오.
 *
 * 🔄 **«화면» 감시는 `test/i18n-parity.test.js` ⑤ 절로 옮겼습니다** 〔2026-09-03〕.
 *    그쪽은 배포되는 페이지만 보고, 화면 문면(`body`)과 JS 를 포함한 소스(`strip`)
 *    **두 층**을 봅니다 — 새어 들어온 7곳 중 여럿이 JS 문자열이라 한 층으로는 못 잡습니다.
 *    저장소 «전역»이 아니라 페이지 기준이라, 인계 주석·문서·설계서는 그 낱말을 계속
 *    쓸 수 있습니다(왜 바뀌었는지가 거기 남아야 합니다).
 * ⛔ 이 자리를 조용히 지우지 않았습니다 — 왜 단정이 사라졌는지가 남아 있어야
 *    다음 사람이 「전에는 금지였는데」로 되돌리지 않습니다.
 */
function gate3() {
  console.log('\nG3. 산출물 명칭 폐기 단정 — **거둠** 〔2026-09-03〕');
  pass('폐기 단정을 거뒀습니다(위 주석의 사유 참조) — 이 축은 더 이상 재지 않습니다');
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
    const s = readPinned(f);
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
  const ko = readPinned('index.html');
  const en = readPinned('en.html');
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

/*
 * 🔴 **이 게이트는 2026-08-23 B3-b 배치로 임무를 마쳤습니다.**
 *
 * 하는 일은 「B3-a 가 B3-b 영역을 건드리지 않았는가」였고, B3-b 가 바로 그 세 자리를
 * 정본(PRD §5-1 · §5-4 · §5-5)으로 교체하는 배치였습니다. 그대로 두면 **다음 배치마다
 * 세 건이 빨갛게 뜨고**, 그 빨강이 아무 뜻도 없어서 곧 아무도 안 보게 됩니다 —
 * 게이트가 죽는 가장 흔한 방식입니다.
 *
 * ⛔ 그렇다고 **지우지 않습니다.** 지우면 「B3-a 가 그 자리를 안 건드렸다」는 사실을
 *    확인할 방법이 저장소에서 사라지고, B3-a 커밋을 되짚을 때 근거가 없어집니다.
 *    대신 **B3-a 시점의 마지막 판(HEAD~1 = B3-a 배포 커밋)** 을 기준으로 고정합니다 —
 *    인자로 baseRef 를 주면 그 판과 대조하던 종전 동작을 그대로 씁니다.
 *
 * 🔴 이 자리를 지금 지키는 것은 `scripts/check-b3b-gates.js` G2·G8 과
 *    `test/landing-b3b.test.js` 입니다. 세 자리의 **현재 문구**는 그쪽이 붙듭니다.
 */
/* 🔴 **양끝을 과거 커밋으로 고정합니다.** 한쪽을 `BASE`(기본 HEAD)로 두면 HEAD 가 앞으로
   갈 때마다 비교 대상이 함께 움직여, 그 뒤 배치가 이 자리를 정당하게 고칠 때마다 빨갛게
   뜹니다. 이 게이트가 확인하는 것은 **B3-a 배치 한 번**이므로 구간도 그 한 번입니다:
     `061da9f~1` (B3-a 직전) → `061da9f` (B3-a 배포). */
const B3A_BEFORE = '061da9f~1';
const B3A_AFTER = '061da9f';

function gate6() {
  console.log('\nG6. B3-b 영역 불가침 — B3-a 배치 구간 고정(' + B3A_BEFORE + ' → ' + B3A_AFTER + ')');
  let before, after;
  try {
    before = execFileSync('git', ['show', B3A_BEFORE + ':index.html'], { cwd: ROOT, encoding: 'utf8' });
    after = execFileSync('git', ['show', B3A_AFTER + ':index.html'], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    console.log('  · 그 두 판을 읽지 못해 건너뜁니다(얕은 클론일 수 있습니다)');
    return;
  }
  for (const [startMark, endMark, label] of B3B_GUARD) {
    const slice = (t) => {
      const a = t.indexOf(startMark); if (a === -1) return null;
      const b = t.indexOf(endMark, a); return b === -1 ? null : t.slice(a, b);
    };
    const x = slice(before), y = slice(after);
    if (x === null || y === null) {
      /* 두 판 모두에서 경계를 못 찾는 것은 **B3-b 이후에는 정상**입니다 — 그 문면이
         교체됐다는 뜻이고, 이 게이트의 구간(B3-a)에는 영향이 없습니다. */
      console.log('  · ' + label + ': B3-b 로 문면이 교체되어 경계가 없습니다(정상)');
      continue;
    }
    if (x === y) pass(label + ': B3-a 배치가 건드리지 않았습니다');
    else fail('🔴 B3-a 배치가 ' + label + ' 을 건드렸습니다');
  }
}

/* ══ G7. FAQ 「결과물의 성격」 확정본 ═════════════════════════════════════ */

/*
 * 🔴 사용자 지정 필수 문장. 이 자리는 B3-a 구현 시점에 원본이 없어 임시 문안으로
 *    나갔고(커밋 061da9f), PRD §5-8 「결과물의 성격」 확정본으로 교체됐습니다.
 * ⚠️ **주석을 걷고 봅니다** — 인수인계 주석이 이 문장을 인용하고 있어서, 걷지 않으면
 *    답변에서 지워도 검사가 통과합니다(주석이 오탐이 됩니다).
 */
const FAQ_REQUIRED = '확인번호는 발급된 리포트를 다시 열람하시기 위한 번호입니다';
/** 세 문항이 전부 「아닙니다」로 시작하는지 — 완곡하게 다듬으면 오인 방어가 풀립니다. */
const FAQ_KO = [
  '발급받은 사전 점검 리포트가 인증서인가요?',
  'TROPS를 이용하면 무역보험 보상금이 보장되나요?',
  'TROPS가 제공하는 정리 결과가 법률 자문을 대신하나요?',
];
const FAQ_EN = [
  'Is the pre-check report I receive a certificate?',
  'Does using TROPS guarantee a trade insurance payout?',
  'Does what TROPS organises replace legal advice?',
];

/*
 * 🔴 **이 게이트만 «다른 커밋»에 고정합니다** 〔2026-09-03〕. PRD §5-8 확정본 3문항은
 *    B3-a 배치 커밋(`061da9f`)이 아니라 **후속 커밋 `c7a9696`**(「copy(faq): 결과물의
 *    성격 3문항을 PRD 확정본으로 교체」)에 들어왔습니다. BASE 로 보면 배치 판에 아직
 *    없는 문장을 찾아 8건이 빨개집니다 — 회귀가 아니라 **핀이 틀린 것**이었습니다.
 * ⚠️ 배치와 후속 교체가 갈린 자리라 핀이 둘입니다. ⛔ 하나로 합치지 마십시오.
 */
const FAQ_PIN = 'c7a9696';

function gate7() {
  console.log('\nG7. FAQ 「결과물의 성격」 — PRD §5-8 확정본 (고정: ' + FAQ_PIN + ')');
  const strip = (t) => t.replace(/<!--[\s\S]*?-->/g, '');
  const readFaq = (rel) => execFileSync(
    'git', ['show', FAQ_PIN + ':' + rel],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  );
  const ko = strip(readFaq('index.html'));
  const en = strip(readFaq('en.html'));

  if (ko.indexOf(FAQ_REQUIRED) !== -1) pass('필수 문장 포함(주석 제외): 「' + FAQ_REQUIRED + '」');
  else fail('🔴 필수 문장이 답변에 없습니다: 「' + FAQ_REQUIRED + '」');

  for (const q of FAQ_KO) {
    if (ko.indexOf(q) !== -1) pass('국문 문항: ' + q);
    else fail('국문 문항이 없습니다: ' + q);
  }
  for (const q of FAQ_EN) {
    if (en.indexOf(q) !== -1) pass('영문 문항: ' + q);
    else fail('영문 문항이 없습니다: ' + q);
  }
  /* 세 답변이 부정으로 시작하는지 — 이 그룹의 존재 이유입니다. */
  const answers = (ko.match(/<div class="qans" id="qa-1[345]">\s*<p>([^<]*)</g) || [])
    .map((m) => m.slice(m.indexOf('<p>') + 3).trim());
  const soft = answers.filter((a) => a.indexOf('아닙니다') !== 0);
  if (answers.length === 3 && soft.length === 0) pass('세 답변이 모두 「아닙니다」로 시작');
  else fail('부정으로 시작하지 않는 답변이 있습니다: ' + JSON.stringify(soft));
}

console.log('═══ B3-a 필수 조건 게이트 ═══');
gate1(); gate2(); gate3(); gate4(); gate5(); gate6(); gate7();
console.log('\n' + (failed === 0 ? '✅ 전 게이트 PASS' : '❌ ' + failed + '건 FAIL'));
process.exit(failed === 0 ? 0 : 1);
