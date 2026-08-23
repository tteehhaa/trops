/*
 * 접수 페이지 축소 · 삭제메뉴 강등 · 랜딩 복귀 테스트
 * 〔2026-08-14 · 흐름 md §3 · precheck-slim-return-s9〕
 *
 *   npm test        (node --test test/)
 *
 * 다루는 것 넷:
 *
 *   ① precheck.html 이 **두 번째 랜딩이 아닌가** — 랜딩과 같은 헤드라인·HOW IT WORKS·
 *      WHAT YOU GET 을 반복하지 않고, 접수 폼이 첫 화면 가까이에 있는가.
 *   ② 「자료 즉시 삭제」가 **실수로 눌리지 않는 자리**에 있는가 — 접수 확인 표 아래,
 *      접힌 <details> 안.
 *   ③ 제출이 끝나면 **랜딩으로 실제로 이동**하는가 — 무상·유상 두 경로 모두.
 *      그리고 옮겨간 자리에서 접수 내용에 **되돌아올 길**이 남아 있는가.
 *   ④ 무상 확인메일에도 기한관리 안내가 들어가는가 — 유상 전용 분기에 갇히지 않았는가.
 *
 * 그리고 흐름 md 자체의 옛 표현 정정(a~d)을 함께 못질합니다. 코드가 먼저 맞고 문서가
 * 뒤처져 있던 자리들이라, 다시 어긋나면 여기서 걸립니다.
 *
 * ⚠️ 모든 검사는 **주석을 걷어낸 원문**에 대해 합니다. 이 저장소는 주석을 인수인계
 *    수단으로 쓰고(빌드가 떼어냅니다), 그 주석에 「이렇게 되돌리지 마십시오」로 적힌
 *    문자열이 그대로 오탐이 됩니다 — 이 배치에서만 그런 주석을 열 곳 넘게 남겼습니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const PRECHECK_RAW = read('precheck.html');
const INDEX_RAW = read('index.html');

/** HTML 주석만 걷어낸 원문. */
const stripHtmlComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

/** 사람 눈에 보이는 마크업만 — <style>·<script> 를 통째로 걷어냅니다. */
function markup(raw) {
  return stripHtmlComments(raw)
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');
}

/** <script> 안의 코드에서 JS 주석을 걷어낸 것. */
function scripts(raw) {
  return (raw.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [])
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** <style> 안의 CSS 에서 주석을 걷어낸 것. */
function styles(raw) {
  return (raw.match(/<style[\s\S]*?<\/style>/g) || [])
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

const PRECHECK = markup(PRECHECK_RAW);
const PRECHECK_JS = scripts(PRECHECK_RAW);
const PRECHECK_CSS = styles(PRECHECK_RAW);
const INDEX = markup(INDEX_RAW);
const INDEX_JS = scripts(INDEX_RAW);

/* ══ ① precheck 는 두 번째 랜딩이 아니다 ═══════════════════════════════════ */

test('🔴 랜딩 헤드라인을 반복하지 않는다 — 설득은 index.html 에서 끝났다', () => {
  /*
   * 종전 히어로는 index.html 의 H1(「첫 해외 거래라 / 무엇부터 봐야 할지
   * 모르겠다면.」)을 글자 그대로 복제하고 있었습니다. 그 문장을 읽고 눌러서 넘어온
   * 사람에게 같은 문장을 다시 보여 주면, 눌린 것이 아무 일도 하지 않은 것처럼 읽힙니다.
   * 🔄 단언 문자열을 index.html 의 현재 H1(「첫 수출이라」→「첫 해외 거래라」)에
   *    맞춰 갱신했습니다 — 이 사이클과 무관한 이전 배치에서 이미 바뀌어 있었습니다.
   */
  /* 🔄 단언 문자열을 §5-1 히어로로 갱신했습니다 〔2026-08-23 · B3-b〕. 검사가 지키는 것은
     문장 자체가 아니라 **랜딩 H1 이 precheck 에 복제되지 않는다**는 규칙입니다 —
     H1 이 바뀌면 이 값도 함께 따라옵니다. */
  assert.ok(PRECHECK.indexOf('사전 점검 리포트로 기준을 세우세요') === -1,
    'precheck 에 랜딩 H1 이 그대로 남아 있습니다');
  assert.ok(INDEX.indexOf('사전 점검 리포트로 기준을 세우세요') !== -1,
    '원본(index.html)의 H1 까지 사라졌습니다 — 여기서 지울 것이 아니었습니다');
});

test('HOW IT WORKS · WHAT YOU GET 두 섹션이 없다', () => {
  for (const kicker of ['HOW IT WORKS', 'WHAT YOU GET']) {
    assert.ok(PRECHECK.indexOf(kicker) === -1,
      'precheck 에 ' + kicker + ' 섹션이 남아 있습니다 — 랜딩과 같은 설명입니다');
  }
  for (const id of ['id="how"', 'id="deliver"']) {
    assert.ok(PRECHECK.indexOf(id) === -1, 'precheck 에 ' + id + ' 가 남아 있습니다');
  }
});

test('걷어낸 섹션의 CSS 도 함께 걷었다 — 빈 자리를 남기지 않는다', () => {
  for (const rule of ['.steps', '.deliver-list', '.deliver-num', '.hero-cta']) {
    assert.ok(PRECHECK_CSS.indexOf(rule) === -1,
      rule + ' 규칙이 남아 있습니다 — 다음 사람이 「채울 자리」로 읽습니다');
  }
});

/*
 * 🔄 nav 의 [진행 방식](/#how)·[제공되는 것](/#service) 링크를 대표 지시(2026-08-16)로
 * 완전히 삭제했습니다 — "설명을 더 보려는 사람이 랜딩으로 갈 수 있어야 한다"던
 * 종전 단언은 전제 자체가 사라졌습니다. 이 페이지에 없는 id(#how·#deliver)를
 * 가리키는 죽은 링크가 없는지만 계속 봅니다.
 */
test('죽은 앵커를 남기지 않았다 — 이 페이지에 없는 id 를 가리키지 않는다', () => {
  assert.ok(!/href="#how"/.test(PRECHECK) && !/href="#deliver"/.test(PRECHECK),
    '이 페이지에 없는 id 를 가리키는 링크가 있습니다');
});

test('🔴 접수 폼이 첫 화면 가까이에 있다 — 머리말 한 블록 다음이다', () => {
  /*
   * 이 배치의 목적 자체입니다. 접수 화면(#offer) 안에서 #intake 앞에 올 수 있는
   * <section> 은 머리말 하나뿐입니다. 두 개가 되는 순간 「또 읽고 나서야 폼」입니다.
   *
   * ⚠️ #offer 를 기준으로 셉니다 — 그 위의 접수 확인 화면(#receipt)에도 <section>
   *    들이 있고(협정 세율·즉시 삭제), 그것들은 매직링크로 들어온 배타적 화면입니다.
   */
  const offerAt = PRECHECK.indexOf('<div id="offer">');
  const idAt = PRECHECK.indexOf('id="intake"');
  assert.ok(offerAt !== -1 && idAt > offerAt, '접수 화면 구조를 찾지 못했습니다');
  // 여는 태그부터 셉니다 — id 는 태그 **안**에 있어서, id 까지 자르면 접수 섹션
  // 자신의 `<section` 이 한 개 더 잡힙니다.
  const intakeAt = PRECHECK.lastIndexOf('<section', idAt);

  const before = PRECHECK.slice(offerAt, intakeAt);
  const sections = (before.match(/<section\b/g) || []).length;
  assert.strictEqual(sections, 1,
    '접수 폼 앞에 섹션이 ' + sections + '개입니다 — 머리말 하나만 남기기로 했습니다');
});

test('머리말이 한 줄 리마인더로 남아 있다 — 통째로 없애지는 않았다', () => {
  // 완전 삭제는 「내가 무엇을 신청하려던 것인가」를 확인할 자리까지 없앱니다.
  assert.match(PRECHECK, /<section class="[^"]*\blede\b[^"]*"/, '머리말 블록이 없습니다');
  assert.ok(/공개 라이선스로 배포되는 표준 서식/.test(PRECHECK),
    '무엇을 기준으로 대조하는지가 접수 화면에서 사라졌습니다');
  const h1 = (PRECHECK.match(/<h1[^>]*>/g) || []).length;
  assert.strictEqual(h1, 2, 'H1 이 ' + h1 + '개입니다 — 머리말과 접수 확인 각 1개(배타)입니다');
});

/* ══ ② 즉시 삭제 — 아래로, 그리고 접어서 ═══════════════════════════════════ */

test('🔴 즉시 삭제가 접힌 <details> 안에 있다 — 첫눈에 보이지 않는다', () => {
  const shell = PRECHECK.indexOf('<details class="erase-more" id="erase-more"');
  const box = PRECHECK.indexOf('id="erase"', shell === -1 ? 0 : shell);
  assert.ok(shell !== -1, '접힘 껍데기(#erase-more)가 없습니다');
  assert.ok(box > shell, '삭제 카드가 껍데기 밖에 있습니다');

  const tag = PRECHECK.slice(shell, PRECHECK.indexOf('>', shell) + 1);
  assert.ok(!/\bopen\b/.test(tag),
    '<details> 가 펼쳐진 채 내려옵니다 — 접어 둔 이유가 사라집니다');
  assert.ok(/\bhidden\b/.test(tag),
    '지울 파일이 없는 건에도 껍데기가 보입니다 — JS 가 열도록 hidden 으로 내려와야 합니다');
});

test('🔴 즉시 삭제가 접수 확인 표보다 아래다 — 스크롤해야 닿는다', () => {
  const table = PRECHECK.indexOf('id="receipt-card"');
  const retention = PRECHECK.indexOf('id="retention-note"');
  const home = PRECHECK.indexOf('TROPS 홈으로');
  const shell = PRECHECK.indexOf('id="erase-more"');

  assert.ok(table !== -1 && retention !== -1 && home !== -1 && shell !== -1,
    '기준 블록을 찾지 못했습니다');
  assert.ok(shell > table, '삭제 메뉴가 접수 내용보다 위에 있습니다');
  assert.ok(shell > retention, '삭제 메뉴가 30일 보관 안내보다 위에 있습니다');
  assert.ok(shell > home,
    '삭제 메뉴가 [TROPS 홈으로] 보다 위에 있습니다 — 화면 맨 아래여야 합니다');
});

test('기능은 그대로다 — 동의 없이는 버튼이 눌리지 않는다', () => {
  // 자리를 옮긴 것이지 없앤 것이 아닙니다. id 가 하나라도 바뀌면 JS 가 조용히 죽습니다.
  for (const id of ['erase', 'erase-consent', 'erase-btn', 'erase-msg', 'erase-title']) {
    assert.ok(PRECHECK.indexOf('id="' + id + '"') !== -1, 'id="' + id + '" 가 사라졌습니다');
  }
  assert.ok(/id="erase-btn" disabled/.test(PRECHECK),
    '삭제 버튼이 처음부터 눌리는 상태로 내려옵니다');
});

test('🔴 JS 가 껍데기까지 연다 — 안쪽만 열면 화면에 아무것도 안 나온다', () => {
  assert.match(PRECHECK_JS, /function revealEraseShell/,
    '껍데기를 여는 함수가 없습니다');
  const setup = PRECHECK_JS.match(/function setupErase[\s\S]*?\n    }/);
  assert.ok(setup, 'setupErase 를 찾지 못했습니다');
  assert.ok(setup[0].indexOf('revealEraseShell') !== -1,
    'setupErase 가 닫힌 <details> 안에서 카드만 엽니다 — 화면에는 아무것도 안 보입니다');

  const erased = PRECHECK_JS.match(/function showErased[\s\S]*?\n    }/);
  assert.ok(erased && erased[0].indexOf('revealEraseShell') !== -1,
    '이미 지운 건에서 껍데기가 열리지 않습니다');
  assert.ok(erased[0].indexOf('자료 삭제 완료') !== -1,
    '지운 뒤에도 요약줄이 「자료 즉시 삭제」로 남습니다 — 아직 지울 수 있는 것처럼 읽힙니다');
});

/* ══ ③ 제출 완료 → 랜딩 복귀 (무상·유상) ═══════════════════════════════════ */

test('🔴 복귀 함수가 랜딩으로 replace 한다 — 히스토리에 결제 주소를 남기지 않는다', () => {
  const fn = PRECHECK_JS.match(/function returnToLanding[\s\S]*?\n    }/);
  assert.ok(fn, 'returnToLanding 을 찾지 못했습니다');

  assert.ok(fn[0].indexOf("'/?intake=ok'") !== -1, '랜딩으로 가지 않습니다');
  assert.ok(fn[0].indexOf('window.location.replace') !== -1,
    'replace 가 아닙니다 — 뒤로가기로 결제 승인 주소(?pay=success)에 되돌아갑니다');
  assert.ok(!/location\.assign|location\.href\s*=/.test(fn[0]),
    'assign/href 대입이 섞여 있습니다');
  assert.ok(fn[0].indexOf('&r=') !== -1,
    '토큰을 넘기지 않습니다 — 랜딩에서 접수 내용으로 돌아갈 길이 끊깁니다');
});

test('🔴 무상 경로가 화면에 머물지 않는다', () => {
  const fn = PRECHECK_JS.match(/function onAccepted[\s\S]*?\n    }/);
  assert.ok(fn, 'onAccepted 를 찾지 못했습니다');
  assert.ok(fn[0].indexOf('returnToLanding') !== -1,
    'onAccepted 가 문장만 바꾸고 그 자리에 머뭅니다 — 흐름 md §3 과 어긋납니다');
  // 떠나기 전에도 접수 내용으로 가는 손잡이는 남깁니다.
  assert.ok(fn[0].indexOf('/precheck?r=') !== -1,
    '접수 내용 확인 링크가 사라졌습니다');
});

test('🔴 유상 경로도 같은 함수로 랜딩에 간다 — 접수 확인 표에 머물지 않는다', () => {
  const fn = PRECHECK_JS.match(/function confirmPayment[\s\S]*?\n    }/);
  assert.ok(fn, 'confirmPayment 를 찾지 못했습니다');
  assert.ok(fn[0].indexOf('returnToLanding') !== -1,
    '결제 완료 뒤 랜딩으로 가지 않습니다');
  assert.ok(fn[0].indexOf('showReceipt(') === -1,
    '결제 직후 접수 확인 표를 그리고 머뭅니다 — 두 경로가 서로 다른 곳에 도착합니다');

  // 매직링크(?r=)로 들어온 사람에게는 여전히 표를 그려야 합니다.
  assert.match(PRECHECK_JS, /function showReceipt/, 'showReceipt 자체가 사라졌습니다');
  assert.ok(/params\.r\s*\)?\s*\{?\s*[\s\S]{0,80}showReceipt\(params\.r\)/.test(PRECHECK_JS),
    '매직링크로 들어왔을 때 접수 확인 표를 그리는 경로가 끊겼습니다');
});

test('랜딩에 접수 완료 배너가 있고, 기본값은 숨김이다', () => {
  const at = INDEX.indexOf('id="intake-return"');
  assert.ok(at !== -1, 'index.html 에 접수 완료 배너가 없습니다');
  const tag = INDEX.slice(at - 60, INDEX.indexOf('>', at) + 1);
  assert.ok(/\bhidden\b/.test(tag),
    '배너가 열린 채 내려옵니다 — 그냥 들어온 방문자에게 「접수되었습니다」는 거짓말입니다');
});

test('🔴 배너 JS 가 intake=ok 일 때만 열고, 토큰을 주소창에서 지운다', () => {
  assert.ok(INDEX_JS.indexOf("params.get('intake') !== 'ok'") !== -1,
    '조건 없이 배너를 엽니다');
  assert.ok(INDEX_JS.indexOf("'/precheck?r=' + encodeURIComponent(token)") !== -1,
    '배너 링크가 접수 확인 표(매직링크와 같은 주소)를 가리키지 않습니다');
  assert.ok(/history\.replaceState\(null, '', '\/'\)/.test(INDEX_JS),
    '토큰이 주소창에 남습니다 — 그 상태로 복사·공유될 수 있습니다');
  assert.ok(INDEX_JS.indexOf("params.get('mail') === 'late'") !== -1,
    '확인메일 지연 사실이 화면을 옮기며 사라집니다');
});

test('없는 링크를 가리키지 않는다 — 토큰 없이 온 경우', () => {
  /*
   * 실측으로 잡은 것입니다 〔2026-08-14〕. `?intake=ok&mail=late` 만 있고 `r` 이 없으면
   * 링크 줄은 지워지는데 안내문은 「아래 링크를 열어 두시면」이라고 말하고 있었습니다.
   */
  const branch = INDEX_JS.slice(INDEX_JS.indexOf("params.get('mail') === 'late'"));
  assert.ok(/sub\.textContent\s*=\s*link\s*\n?\s*\?/.test(branch),
    '지연 안내문이 링크 유무를 보지 않고 한 문장으로 고정돼 있습니다');
});

test('두 페이지가 같은 파라미터 이름을 쓴다 — 한쪽만 고치면 배너가 안 열린다', () => {
  for (const key of ['intake=ok', 'mail=late']) {
    assert.ok(PRECHECK_JS.indexOf(key) !== -1, 'precheck 가 ' + key + ' 를 보내지 않습니다');
  }
  assert.ok(INDEX_JS.indexOf("'intake'") !== -1 && INDEX_JS.indexOf("'mail'") !== -1,
    'index 가 같은 파라미터를 읽지 않습니다');
});

/* ══ ③-b 경로 분기보다 뒤에 선 상수 (실측으로 잡은 사고) ══════════════════ */

test('🔴 접수 확인·결제 복귀가 쓰는 상수가 경로 분기보다 앞에 선언돼 있다', () => {
  /*
   * 2026-08-14 실측으로 잡았습니다. 이 스크립트는 IIFE 하나이고, 접수 확인(`?r=`)·
   * 결제 복귀(`paymentKey`) 경로는 그 안에서 **곧장 return** 합니다. `var` 는
   * 끌어올려지지만 **대입은 실행되지 않으므로**, 분기 뒤에 선언된 상수는 그 두
   * 경로에서만 `undefined` 가 됩니다.
   *
   * 실제 피해: `PROGRESS_STEPS` 가 분기 뒤에 있어 addProgress 가 TypeError 를 냈고,
   * showReceipt 의 `.catch` 가 그것을 삼켜 **접수 확인 표가 통째로 비어 있었습니다**
   * (진행상태·접수 내용·협정 세율·자료 즉시 삭제 전부). 화면에는 오류 문구도 안 떴습니다 —
   * catch 가 문구를 넣으려던 `#receipt-msg` 를 바로 앞줄이 이미 지웠기 때문입니다.
   *
   * 그래서 「고쳤다」가 아니라 「다시 그렇게 되지 않는다」를 검사합니다.
   */
  const branchAt = PRECHECK_JS.indexOf('showReceipt(params.r); return;');
  assert.ok(branchAt !== -1, '경로 분기를 찾지 못했습니다');

  for (const name of ['PROGRESS_STEPS', 'RETURN_DELAY_MS']) {
    const declAt = PRECHECK_JS.indexOf('var ' + name + ' =');
    assert.ok(declAt !== -1, name + ' 선언을 찾지 못했습니다');
    assert.ok(declAt < branchAt,
      name + ' 이 경로 분기보다 뒤에 선언돼 있습니다 — 접수 확인·결제 복귀에서 ' +
      'undefined 가 됩니다(선언 자리의 🔴 주석을 읽으십시오)');
  }
});

/* ══ ④ 무상 확인메일의 기한관리 안내 ═══════════════════════════════════════ */

test('🔴 기한관리 안내가 유상 전용 분기에 갇혀 있지 않다', () => {
  /*
   * test/waiting-room-mail.test.js 가 「sendIntakeMails 안에서 불린다」까지는 이미
   * 보고 있습니다. 여기서 한 겹 더 봅니다 — 그 호출이 `${paid ? …}` 안으로 들어가면
   * 위 검사는 그대로 통과하면서 **무상 건에만 조용히 빠집니다.**
   */
  const src = read('api/_notify.js');
  const fn = src.match(/async function sendIntakeMails[\s\S]*?\n}/);
  assert.ok(fn, 'sendIntakeMails 를 찾지 못했습니다');

  const call = fn[0].indexOf('${waitingRoomHtml()}');
  assert.ok(call !== -1, '확인메일에 대기공백 블록이 없습니다');

  // 호출이 들어 있는 줄에 삼항 분기가 없어야 합니다.
  const lineStart = fn[0].lastIndexOf('\n', call) + 1;
  const line = fn[0].slice(lineStart, fn[0].indexOf('\n', call));
  assert.ok(line.indexOf('paid') === -1 && line.indexOf('?') === -1,
    '기한관리 안내가 조건부입니다 — 무상 접수 확인메일에서 빠집니다: ' + line.trim());
});

/* ══ ⑤ 흐름 md 정정 (a~d) ═════════════════════════════════════════════════ */

const DOC = read('doc/s9/TROPS_user_flow_2026-08-13.md');

test('(a) 결과 열람은 로그인이 아니라 토큰이다', () => {
  assert.ok(DOC.indexOf('메일 링크(토큰)로 → 웹뷰(/c/[token]) 결과 열람') !== -1,
    '정정된 문장이 없습니다');
  assert.ok(DOC.indexOf('고객 로그인 → 웹뷰') === -1,
    '옛 표현(로그인 → 웹뷰)이 남아 있습니다');
});

test('(b) 검수 실패는 재실행 없이 즉시 자동 환불이다', () => {
  assert.ok(DOC.indexOf('검수 실패(품질 미달/AI 오류 등) → 즉시 자동 환불 + 고객 안내 메일') !== -1,
    '정정된 문장이 없습니다');
  assert.ok(DOC.indexOf('재실행 트리거') === -1 && DOC.indexOf('재실행 결과도 실패 시') === -1,
    '옛 재실행 분기가 남아 있습니다');
  // §5-1 2번의 같은 서술도 함께 맞춰야 합니다 — 한 문서가 두 말을 하면 안 됩니다.
  assert.ok(DOC.indexOf('재실행도 실패하면') === -1,
    '§5-1 에 재실행 서술이 남아 문서가 스스로와 어긋납니다');
});

test('(c) 재구매자 단축은 로그인이 아니라 이메일 매칭이다', () => {
  assert.ok(DOC.indexOf('이메일 매칭 시: 이전 접수 정보 자동 참조') !== -1,
    '정정된 문장이 없습니다');
  assert.ok(DOC.indexOf('로그인 상태 감지 시') === -1, '옛 표현이 남아 있습니다');
  assert.ok(DOC.indexOf('로그인 상태면 계정정보 재입력 생략') === -1,
    '§5-1 7번에 같은 옛 표현이 남아 있습니다');
});

test('(d) 기한관리는 신규 가입이고, 이메일 일치 시 프리필이다', () => {
  assert.ok(
    DOC.indexOf('계정 로그인/생성 (사전점검 자체엔 계정이 없어 신규 가입이나, 이메일 일치 시 목적국 등 정보 자동 프리필)') !== -1,
    '정정된 문장이 없습니다'
  );
  assert.ok(DOC.indexOf('사전점검 결제자면 기존 계정 재사용') === -1,
    '옛 표현이 남아 있습니다');
});

test('문서가 코드와 같은 말을 한다 — 접수 폼에 로그인이 없다는 사실', () => {
  // 정정 c·d 의 근거. 접수 폼에 계정 필드가 생기면 이 문서 정정이 거짓이 됩니다.
  assert.ok(PRECHECK.indexOf('로그인이나 회원가입은 필요 없습니다') !== -1,
    '접수 화면의 「로그인 불요」 약속이 사라졌습니다');
  assert.ok(!/type="password"/.test(PRECHECK),
    '접수 폼에 비밀번호 필드가 생겼습니다 — 문서 정정 (c)(d)와 어긋납니다');
});
