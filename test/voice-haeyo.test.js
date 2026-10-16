/*
 * 해요체 래칫 〔신설 2026-10-16 · 대표 결정 — 앱(app.trops.kr)이 해요체로 옮겨 가서 랜딩도 맞춘다〕
 *
 *   npm test
 *
 * 🔴 **무엇을 지키나** — 랜딩에서 앱으로 넘어갈 때 말투가 갑자기 바뀌지 않게, 사용자에게 보이는
 *    한국어 서술문이 «~습니다»체로 되돌아가지 않게 합니다. 앱의 `voice-tone.md` §1-2 · §1-3 이
 *    정한 규칙의 랜딩 쪽 검사입니다(앱의 `tests/guardrails/voice-haeyo.test.ts` 와 같은 생각).
 *
 * 🔴 **어디까지 재나** — 화면 문구가 있는 파일만입니다: index · about · contact(HTML) ·
 *    assets/*.js · llms.txt · site.config.json 의 `publicCopy.ko`. 주석 · 스타일은 걷고 봅니다.
 *    ⛔ privacy · refund · en-privacy · en-refund 는 **여기에 넣지 마십시오** — 법적 문서라
 *       판이 있고, 말투를 바꾸려면 새 판을 내야 합니다.
 *
 * ⚠️ **그대로 두기로 한 «~습니다»가 아래 `KEPT` 에 있습니다.** 하나도 «고쳐야 할 것»이 아니라
 *    대표 결정을 기다리는 자리입니다 — 면책 고지(서비스 제공 범위) · 개인정보 수집·이용 동의 ·
 *    보관 기간 안내 · 개인정보 처리 요약. 목록에 있는 글자가 사라지면 아래 «낡은 목록» 검사가
 *    red 를 내므로, 문구를 옮길 때는 이 목록에서도 함께 지우십시오(래칫이 조여지는 방향입니다).
 * ⚠️ 새로 쓰는 문구는 처음부터 해요체입니다. 목록을 늘려 «습니다»를 들이지 마십시오.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** 주석 · 스타일을 걷습니다. 스크립트 안의 문자열(화면에 나가는 글)은 남깁니다. */
function visible(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

/**
 * «~습니다»체 종결을 찾습니다. 받침 ㅂ 인 글자 + 「니다」(했습니다 · 입니다 · 합니다 · 갑니다 …)와
 * 「십시오」. 「아니다」 · 「다니다」처럼 ㅂ 받침이 앞에 없는 말은 걸리지 않습니다.
 */
function formalEndings(text) {
  const hits = [];
  for (const m of text.matchAll(/([가-힣])니다/g)) {
    if ((m[1].charCodeAt(0) - 0xac00) % 28 === 17) hits.push(m[0]);
  }
  for (const m of text.matchAll(/십시오/g)) hits.push(m[0]);
  return hits;
}

/** 문장 앞뒤 문맥까지 보여 주어 어디를 고칠지 바로 알 수 있게 합니다. */
function withContext(text) {
  const out = [];
  for (const m of text.matchAll(/[^.!?。\n<>"'`]{0,40}([가-힣])니다|[^.!?。\n<>"'`]{0,40}십시오/g)) {
    const hit = m[1] === undefined || (m[1].charCodeAt(0) - 0xac00) % 28 === 17;
    if (hit) out.push('…' + m[0].trim());
  }
  return out;
}

/*
 * 그대로 두는 «~습니다» — 파일마다, 글자 그대로. 까닭은 PR 본문과 같습니다.
 *   · 면책 고지 — 앱의 voice-tone §1-3 도 «원문 그대로로 잠긴 고지(L1 면책 고지)»를 옮기지 않습니다.
 *     test/disclaimer-parity.test.js 가 세 축을 잡고 있는 문면이라 글자를 바꾸면 검사도 함께 바뀝니다.
 *   · 동의 · 보관 기간 — privacy.html §02 표와 «같은 말»이어야 하는 법적 고지입니다(방침이 판을 가집니다).
 */
const KEPT = {
  'index.html': [
    // 푸터 「서비스 제공 범위」 — 면책 고지
    'TROPS는 서류 준비와 기록 관리를 돕습니다. 법률 자문과 계약서에 대한 법률적 검토를 제공하지 않습니다. 보험 인수·지급 심사나 가입 대행, 특정 상품 추천을 하지 않으며, 가입 가능 여부와 조건은 해당 기관이 약관과 심사 기준에 따라 결정합니다. 미수금 회수를 보장하지 않습니다.',
  ],
  'about.html': [
    // 02 「TROPS가 명확히 선을 긋는 영역」 — 면책 고지
    '<b>TROPS는 다음을 하지 않습니다</b>',
    '<li>법률 자문 및 개별 계약서 검토를 제공하지 않습니다.</li>',
    '<li>보험 인수·지급 심사 및 가입 대행, 특정 상품 추천을 하지 않습니다.</li>',
    '<li>미수금 회수를 보장하지 않습니다.</li>',
    '<p>본 서비스는 기술·실무·법제의 유기적 연결을 바탕으로 한 예방적 가이드를 지향합니다. 상세한 내용은 <a href="/">홈</a>의 자주 묻는 질문과 푸터를 참고해 주시기 바랍니다.</p>',
  ],
  'contact.html': [
    // 개인정보 수집·이용 동의 문구와 보관 기간 — 법적 고지
    '위 항목을 수집·이용하는 데 동의합니다. 동의하지 않으셔도 되며, 그때는 이 양식으로 접수할 수 없습니다. 자세한 내용은 <a href="https://app.trops.kr/privacy">개인정보처리방침</a>에서 확인하실 수 있습니다.',
    '문의 기록은 6개월(183일) 보관합니다.',
    '출시 알림 기록은 1년(365일) 보관합니다.',
  ],
};

/** `site.config.json` 의 `publicCopy.ko` 중 그대로 두는 키 — 개인정보 처리 · 보관 안내 요약입니다. */
const KEPT_CONFIG_KEYS = new Set(['securitySummary', 'retention']);

const TEXT_FILES = ['index.html', 'about.html', 'contact.html', 'llms.txt'];
const JS_FILES = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => f.endsWith('.js')).map((f) => 'assets/' + f);

function textFor(file) {
  let t = file.endsWith('.txt') ? read(file) : visible(read(file));
  for (const k of KEPT[file] || []) t = t.split(k).join('');
  return t;
}

/* ══ ① 화면 문구에 «~습니다»가 없다 ══════════════════════════════════════ */

for (const f of [...TEXT_FILES, ...JS_FILES]) {
  test(`🔴 ${f} 의 화면 문구는 해요체다 — «~습니다» 0 (그대로 두기로 한 목록 제외)`, () => {
    const left = withContext(textFor(f));
    assert.deepStrictEqual(left, [],
      f + ' 에 «~습니다»체가 남았습니다 — 해요체로 쓰십시오(새 문구는 처음부터 해요체입니다): ' + left.join(' | '));
  });
}

test('🔴 site.config.json 의 publicCopy.ko 는 해요체다 — 개인정보 요약 두 키만 그대로', () => {
  const ko = JSON.parse(read('site.config.json')).publicCopy.ko;
  const left = [];
  for (const [key, value] of Object.entries(ko)) {
    if (KEPT_CONFIG_KEYS.has(key)) continue;
    for (const h of withContext(String(value))) left.push(`${key}: ${h}`);
  }
  assert.deepStrictEqual(left, [], 'publicCopy.ko 에 «~습니다»체가 남았습니다: ' + left.join(' | '));
});

/* ══ ② [대조] 목록이 낡지 않았고 검출기가 실제로 문다 ═════════════════════ */

test('[대조] 그대로 두는 목록의 글자가 파일에 실제로 있다 — 없으면 목록에서 지운다(래칫)', () => {
  const stale = [];
  for (const [file, list] of Object.entries(KEPT)) {
    const src = visible(read(file));
    for (const k of list) if (!src.includes(k)) stale.push(`${file}: ${k.slice(0, 40)}…`);
  }
  const cfg = JSON.parse(read('site.config.json')).publicCopy.ko;
  for (const k of KEPT_CONFIG_KEYS) if (!(k in cfg)) stale.push(`site.config.json: publicCopy.ko.${k}`);
  assert.deepStrictEqual(stale, [], '낡은 목록입니다 — 글자가 바뀌었거나 사라졌습니다: ' + stale.join(' | '));
});

test('[대조] 그대로 두는 목록의 «~습니다»는 목록 안에서만 걸린다 — 목록이 헛돌지 않는다', () => {
  for (const [file, list] of Object.entries(KEPT)) {
    const withKept = visible(read(file));
    assert.ok(formalEndings(withKept).length > 0, file + ': 목록이 있는데 «~습니다»가 한 곳도 없습니다');
    assert.deepStrictEqual(formalEndings(textFor(file)), [], file + ': 목록 밖에 남았습니다');
    assert.ok(list.length > 0);
  }
});

test('[대조] 검출기가 실제로 문다 — 습니다체는 잡고 해요체 · 비종결 낱말은 놓는다', () => {
  for (const bad of ['저장했습니다', '견적서입니다', '확인합니다', '보관합니다', '입력해 주십시오', '돕습니다', '갑니다']) {
    assert.ok(formalEndings(bad).length > 0, `${bad} 를 못 잡습니다`);
  }
  for (const ok of ['저장했어요', '견적서예요', '확인해요', '입력해 주세요', '아니다', '다니다', '선택하세요', '보시겠어요?']) {
    assert.strictEqual(formalEndings(ok).length, 0, `${ok} 를 잘못 잡습니다`);
  }
});

test('[대조] 대상이 0건이 아니다 — 빈 목록은 조용한 초록이다', () => {
  for (const f of [...TEXT_FILES, ...JS_FILES]) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), f + ' 가 없습니다');
  }
  assert.ok(JS_FILES.length >= 3, 'assets/*.js 를 ' + JS_FILES.length + '개만 찾았습니다');
  assert.ok(/[가-힣]/.test(textFor('index.html')), 'index.html 에서 한국어를 못 읽었습니다');
});
