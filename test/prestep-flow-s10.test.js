/*
 * 사전 확인 문항·저장 검사 〔prestep-flow-s10 · 신설 2026-08-14〕
 *
 *   npm test        (node --test test/)
 *
 * 정본: doc/s10/TROPS_사전확인_설계서_v3.md (§2-3 · §2-4 · §2-5 · §9)
 *       doc/s10/TROPS_사전확인_구현계획서_v1.md (§1-3 · §4 · §7 · §11 완료판정)
 *
 * ── 왜 있는가 ───────────────────────────────────────────────────────────────
 * 이 페이지는 **문구가 곧 기능**입니다(설계서 P1 「질문이 곧 교육이다」). 보기 문구를
 * 한 줄 다듬는 것이 기능을 지우는 일이 되는 자리가 세 곳 있고, 셋 다 사람 눈으로는
 * 「그냥 문장」으로 보입니다:
 *
 *   ① Q2 의 영문 병기 — 해외에서 오는 문서는 **영문 제목으로** 옵니다. 사용자가
 *      대조하는 대상은 한글 용어가 아니라 파일 이름입니다(F-8).
 *   ② Q2 의 「이메일 첨부·링크로 받으신 것도 포함」 — 이 한 줄이 없으면 DocuSign·
 *      이메일 경로가 거의 전부인 고객군이 「아직 없어요」를 고릅니다(§2-4).
 *   ③ Q1 의 「가장 최근에 있었던 일 하나만」 — 이 줄이 답의 축을 상태에서 사건으로
 *      고정합니다. 없으면 같은 상황이 두 값으로 갈려 저장됩니다(F-1 · T8).
 *
 * 그리고 저장 쪽에는 **fail-open** 이 있습니다(§9). 저장 실패로 화면을 멈추는 코드가
 * 한 줄 들어가는 순간 이탈 방지 설계가 자기모순이 되는데, 그 한 줄은 리뷰에서
 * 「에러 처리를 제대로 했다」로 보입니다. 그래서 사람 눈이 아니라 여기서 막습니다.
 *
 * ⚠️ 마크업 검사는 **주석을 걷어낸 뒤** 합니다(이 저장소의 공통 규칙 — 주석을
 *    인수인계 수단으로 쓰고 빌드가 떼어냅니다). 이 파일의 주석에도 옛 문구·금지 문구가
 *    인용되어 있으므로, 걷지 않으면 전부 오탐입니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'check.html'), 'utf8');
/** 주석 없는 마크업. */
const M = RAW.replace(/<!--[\s\S]*?-->/g, '');
/** 사람 눈에 보이는 본문만. */
const B = M.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
/** <style> 안의 CSS(주석 제거). */
const CSS = RAW.match(/<style[\s\S]*?<\/style>/)[0].replace(/\/\*[\s\S]*?\*\//g, '');
/** 페이지 스크립트(주석 제거). */
const JS = RAW.match(/<script>[\s\S]*?<\/script>/)[0].replace(/\/\*[\s\S]*?\*\//g, '');

/** `<section id="step-n">` 한 덩이. */
function step(id) {
  const at = B.indexOf('id="' + id + '"');
  assert.ok(at !== -1, '단계를 찾지 못했습니다: ' + id);
  const end = B.indexOf('</section>', at);
  return B.slice(at, end);
}

/** 한 단계 안의 보기 (코드, 한글 이름) 목록 — 화면 순서 그대로. */
function options(id) {
  const out = [];
  const re = /value="([a-z_]+)"[\s\S]*?<span data-title>([^<]+)<\/span>/g;
  let m;
  const src = step(id);
  while ((m = re.exec(src)) !== null) out.push([m[1], m[2]]);
  return out;
}

/* ══ 1. 문항 문구 — 설계서 §2-3 · §2-4 · §2-5 정본 ═════════════════════════ */

test('세 문항의 제목이 정본 그대로다', () => {
  const titles = [
    ['step-1-title', '지금 어느 쯤에 계신가요?'],
    ['step-2-title', '해외에서 받으신 서류가 있나요?'],
    ['step-3-title', '해외 거래는 어느 정도 해보셨나요?'],
  ];
  for (const [id, text] of titles) {
    const got = (B.match(new RegExp('id="' + id + '"[^>]*>([^<]*)<')) || [])[1];
    assert.strictEqual(got, text, id + ' 의 제목이 정본과 다릅니다');
  }
});

test('Q1 보조문이 살아 있다 — 답의 축을 사건으로 고정하는 줄이다 (F-1 · T8)', () => {
  assert.ok(step('step-1').indexOf('가장 최근에 있었던 일 하나만 골라주세요.') !== -1,
    '이 줄이 없으면 「연락도 왔고 서류도 받은」 사람의 답이 두 값으로 갈립니다 — ' +
    '같은 상황이 다른 값으로 저장되면 검수 우선순위(§3-1)가 랜덤화됩니다');
});

test('Q2 보조문의 「이메일 첨부·링크」가 살아 있다 — 삭제 금지 항목 (§2-4)', () => {
  assert.ok(step('step-2').indexOf('이메일 첨부·링크로 받으신 것도 포함이고, 여러 개 고르셔도 됩니다.') !== -1,
    '이 한 줄이 없으면 계약을 이메일·전자서명으로만 받는 고객군이 「아직 없어요」를 고릅니다 — ' +
    '가장 적합한 고객이 서류 없음으로 분류됩니다');
});

test('Q1 보기 6개가 코드·문구·순서까지 정본과 같다', () => {
  assert.deepStrictEqual(options('step-1'), [
    ['not_started', '아직 시작 전이에요'],
    ['talk_invited', '해외에서 이야기를 나누자는 연락이 왔어요'],
    // ⛔ 「서류를 주고받는 중이에요」로 되돌리지 마십시오 (F-1) — 「주고받는」은 상호적으로
    //    읽혀서 한 장 받기만 한 사람이 위 보기로 빠집니다.
    ['docs_received', '서류를 받았어요'],
    ['pre_contract', '계약을 앞두고 있어요'],
    ['has_revenue', '이미 해외에서 주문·매출이 있어요'],
    ['unsure', '잘 모르겠어요'],
  ]);
});

test('Q2 보기 6개와 영문 병기 4개가 정본과 같다 (F-8)', () => {
  assert.deepStrictEqual(options('step-2'), [
    ['nda', 'NDA·비밀유지계약서'],
    ['sales_contract', '매매계약서'],
    ['quote_pi', '견적서·PI'],
    ['service_license', '용역·라이선스 계약서'],
    ['other_doc', '이름을 잘 모르는 문서가 있어요'],
    ['none', '아직 없어요'],
  ]);

  const src = step('step-2');
  for (const en of [
    '(NDA / Confidentiality Agreement / Undertaking)',
    '(Sales Contract / Purchase Agreement)',
    '(Quotation / Proforma Invoice / Term Sheet)',
    '(Service / License / Publishing Agreement)',
  ]) {
    assert.ok(src.indexOf(en) !== -1,
      '영문 병기가 없습니다: ' + en + '\n해외에서 오는 문서는 영문 제목으로 옵니다 — ' +
      '사용자가 대조하는 대상은 한글 용어가 아니라 파일 이름입니다');
  }
});

test('Q3 보기 3개가 정본과 같다', () => {
  assert.deepStrictEqual(options('step-3'), [
    ['first', '이번이 처음이에요'],
    ['few', '몇 번 해봤어요'],
    ['regular', '계속 하고 있어요'],
  ]);
});

test('보기 코드가 스키마 enum 과 같다 (§5-2)', () => {
  // 화면이 저장하는 값과 테이블이 받는 값이 갈리면 그 필드만 조용히 버려집니다.
  assert.deepStrictEqual(options('step-1').map((o) => o[0]).sort(),
    ['docs_received', 'has_revenue', 'not_started', 'pre_contract', 'talk_invited', 'unsure']);
  assert.deepStrictEqual(options('step-2').map((o) => o[0]).sort(),
    ['nda', 'none', 'other_doc', 'quote_pi', 'sales_contract', 'service_license']);
  assert.deepStrictEqual(options('step-3').map((o) => o[0]).sort(), ['few', 'first', 'regular']);
});

/* ══ 2. 안전장치 G1~G4 ═════════════════════════════════════════════════════ */

test('세 문항 전부에 진행 표시와 [건너뛰기]가 있다 (G2 · T2)', () => {
  for (const [id, count] of [['step-1', '1 / 3'], ['step-2', '2 / 3'], ['step-3', '3 / 3']]) {
    const src = step(id);
    assert.ok(src.indexOf('class="step-count') !== -1 && src.indexOf(count) !== -1,
      id + ' 에 진행 표시 「' + count + '」가 없습니다 — 끝이 보여야 사람이 시작합니다');
    assert.ok(src.indexOf('data-skip') !== -1,
      id + ' 에 [건너뛰기]가 없습니다 — 하나라도 빠지면 그 문항이 사실상 필수가 됩니다(T2)');
  }
});

test('「바로 비교해 보기」가 세 문항 전부에서 클릭 가능하다 (G1)', () => {
  for (const id of ['step-1', 'step-2', 'step-3']) {
    const src = step(id);
    const at = src.indexOf('data-bypass');
    assert.ok(at !== -1, id + ' 에 상시 우회 링크가 없습니다');
    const tag = src.slice(src.lastIndexOf('<a', at), src.indexOf('</a>', at));
    assert.ok(tag.indexOf('href="/precheck"') !== -1,
      id + ' 의 우회 링크가 /precheck 로 가지 않거나 파라미터가 붙었습니다: ' + tag);
    assert.ok(tag.indexOf('바로 비교해 보기') !== -1,
      id + ' 의 우회 링크 문구가 「바로 비교해 보기」가 아닙니다 — 라이브 랜딩의 ' +
      '/precheck 링크는 전부 「비교해 보기」입니다(§12 C-1·C-4). 같은 곳으로 가는데 ' +
      '다른 말을 쓰면 다른 곳으로 읽힙니다');
    assert.ok(tag.indexOf('class="btn') === -1,
      id + ' 의 우회 링크가 버튼이 됐습니다 — 버튼이 되면 서류가 없는 사람까지 눌러버려 ' +
      '사전 확인이 존재할 이유가 없어집니다(§1-3). 위치만 올리고 형태는 낮게 둡니다');
  }
});

test('우회 링크가 문항 **위**에 있다 (§1-3 「왜 위인가」)', () => {
  for (const id of ['step-1', 'step-2', 'step-3']) {
    const src = step(id);
    assert.ok(src.indexOf('data-bypass') < src.indexOf('<h2'),
      id + ' 의 우회 링크가 문항 제목보다 아래에 있습니다 — 탈출구가 아래에 있으면 ' +
      '문항을 다 읽고 짜증이 난 뒤에 발견됩니다');
  }
});

test('전 화면에 가격 노출이 0이다 (G4)', () => {
  for (const money of ['₩', '300,000', '99,000', '원)']) {
    assert.ok(B.indexOf(money) === -1,
      '가격 표기 「' + money + '」가 보입니다 — 사전 확인 전 구간은 결제 게이트 뒤로 ' +
      '완전히 격리되어야 합니다(G4)');
  }
});

test('판정·평가 어휘가 화면에 없다 (§2-1 금지어)', () => {
  for (const word of ['진단', '상담', '점수', '등급', '순위', '적합', '부적합', '위반', '저촉', '불이익', '해당되지']) {
    assert.ok(B.indexOf(word) === -1,
      '금지어 「' + word + '」가 화면에 있습니다 — 이 페이지는 어디쯤인지만 말하고 ' +
      '좋고 나쁨을 말하지 않습니다');
  }
});

/* ══ 3. 자동 전환과 [다음] 버튼 ════════════════════════════════════════════ */

test('Q1·Q3 의 [다음]은 숨어 있고 Q2 의 [다음]은 보인다', () => {
  for (const id of ['step-1', 'step-3']) {
    const src = step(id);
    const at = src.indexOf('data-next');
    assert.ok(at !== -1, id + ' 에 [다음] 버튼 자체가 없습니다 — 키보드 화살표 사용자의 유일한 확정 수단입니다');
    assert.ok(src.slice(at, src.indexOf('>', at)).indexOf('hidden') !== -1,
      id + ' 의 [다음]이 처음부터 보입니다 — 선택 즉시 자동 전환과 겹쳐, 사람이 버튼을 ' +
      '누르기도 전에 화면이 넘어갑니다');
  }
  const q2 = step('step-2');
  const at2 = q2.indexOf('data-next');
  assert.ok(at2 !== -1 && q2.slice(at2, q2.indexOf('>', at2)).indexOf('hidden') === -1,
    'Q2 는 복수선택이라 자동 전환이 없습니다 — [다음]이 보여야 합니다');
});

test('숨긴 버튼이 실제로 사라지는 CSS 가 있다', () => {
  // `[hidden]{display:none}` 은 브라우저 기본 스타일이라 우선순위가 가장 낮고,
  // `.btn{display:inline-flex}` 가 그것을 이깁니다. 이 규칙이 없으면 hidden 이 무시됩니다.
  assert.ok(/\.cta-row\s+\.btn\[hidden\]\s*\{[^}]*display:\s*none/.test(CSS),
    '.cta-row .btn[hidden] { display: none } 규칙이 없습니다 — hidden 을 붙여도 ' +
    '[다음] 버튼이 그냥 보입니다(.btn 의 display 가 브라우저 기본값을 이깁니다)');
  assert.ok(/\.feat-panel\[hidden\]\s*\{[^}]*display:\s*none/.test(CSS),
    '.feat-panel[hidden] 규칙이 없습니다 — 감춘 단계가 그대로 보입니다');
  // 인트로(「세 가지만 여쭤봅니다」)가 이 클래스를 씁니다. 규칙이 없으면 `display: flex` 가
  // 브라우저 기본값을 이겨서 **결과 화면에도 인트로가 남습니다** — 다 답한 사람에게는
  // 참이 아닌 문장입니다. 속성은 제대로 걸려 있어서 DOM 만 보면 안 보이는 오류입니다.
  assert.ok(/\.feat-panel-pad\[hidden\]\s*\{[^}]*display:\s*none/.test(CSS),
    '.feat-panel-pad[hidden] 규칙이 없습니다 — 결과 화면에서 인트로가 안 내려갑니다');
});

/* ══ 4. 저장 — fail-open (§9) ══════════════════════════════════════════════ */

test('저장은 /api/prestep 프록시로만 간다 (§4-2 B안)', () => {
  assert.ok(JS.indexOf("'/api/prestep'") !== -1, '저장 엔드포인트가 없습니다');
  assert.ok(JS.indexOf('app.trops.kr') === -1,
    '화면이 앱 도메인을 직접 부릅니다 — 그 순간 CORS·프리플라이트가 살아나고 ' +
    '인입 비밀값이 브라우저로 내려갑니다(§4-2)');
});

test('저장 실패가 화면을 막지 않는다 (fail-open)', () => {
  assert.ok(/\.catch\(/.test(JS), 'fetch 에 .catch 가 없습니다 — 저장 실패가 예외로 새어 흐름을 끊습니다');
  assert.ok(JS.indexOf('await ') === -1,
    '저장을 기다리는 코드가 있습니다 — 저장의 성패는 화면 흐름의 조건이 될 수 없습니다(§9)');
  assert.ok(JS.indexOf('keepalive') !== -1,
    'keepalive 가 없습니다 — 「바로 비교해 보기」처럼 곧바로 페이지를 떠나는 클릭에서 ' +
    '요청이 끊깁니다(beforeunload 를 쓰지 않는 대신 이것이 그 자리를 지킵니다)');
});

test('beforeunload 저장 훅을 쓰지 않는다 (§4-3)', () => {
  assert.ok(JS.indexOf('beforeunload') === -1,
    'beforeunload 는 모바일에서 신뢰도가 낮습니다 — 이탈은 「마지막 저장 이후 완료 ' +
    '기록 없음」으로 서버 쪽에서 사후 판별합니다');
});

test('세션 키·보관에 폴백이 있다 (§9)', () => {
  assert.ok(JS.indexOf('randomUUID') !== -1 && JS.indexOf('Math.random') !== -1,
    'crypto.randomUUID 미지원 브라우저용 폴백이 없습니다');
  assert.ok(JS.indexOf('sessionStorage') !== -1 && JS.indexOf('localStorage') === -1,
    '보관은 sessionStorage 입니다 — 탭을 닫으면 새 세션인 것이 의도된 동작입니다(§3)');
  const store = JS.slice(JS.indexOf('function writeRaw'), JS.indexOf('function persist'));
  assert.ok(store.indexOf('try') !== -1 && store.indexOf('catch') !== -1,
    'sessionStorage 접근이 try 로 감싸여 있지 않습니다 — 시크릿 모드에서는 접근 ' +
    '자체가 예외를 던져 페이지 전체가 멈춥니다');
});

test('추론값을 저장하지 않는다 (§3-2 · 하지말것 9)', () => {
  for (const word of ['dealType', 'deal_type', 'segment', 'persona']) {
    assert.ok(JS.indexOf(word) === -1,
      '추론·관찰값 「' + word + '」이 화면 저장 경로에 있습니다 — 추론값은 DB 에 넣지 ' +
      '않고 조회 시 계산합니다(규칙이 바뀌면 과거 데이터가 오염됩니다)');
  }
});

/* ══ 5. 결과 화면 S4 — 설계서 §2-6 〔작업 6〕 ═══════════════════════════════
 *
 * 이 구획이 보는 것은 **문구가 마크업에 있는가**입니다. 결과 화면의 문장이 JS 문자열로
 * 옮겨가는 순간 아래 검사도, 빌드의 주석 제거도 그 문장을 못 봅니다 — 그래서 「JS 에
 * 문장이 없다」를 함께 봅니다.
 */

const S4 = (() => {
  const at = B.indexOf('id="step-result"');
  assert.ok(at !== -1, '결과 화면(step-result)이 없습니다');
  return B.slice(at, B.indexOf('</section>', at));
})();

test('블록2 3칸이 정본 문구 그대로다 (§2-6)', () => {
  for (const line of [
    '해외 거래에서 서류는 보통 이 순서로 옵니다.',
    '진지한 이야기가 시작될 때',
    'NDA·비밀유지계약서',
    '조건을 정할 때',
    '견적서·PI·매매계약서',
    '계속 거래하기로 할 때',
    '유통·라이선스 계약',
  ]) {
    assert.ok(S4.indexOf(line) !== -1, '블록2 문구가 없습니다: ' + line);
  }
});

test('NDA 정의 한 줄이 (1) 안에 있다 — 모든 경로가 지나가는 유일한 설명이다 (§2-6)', () => {
  const def = 'NDA는 본격적인 이야기를 시작하기 전에, 서로 알게 된 내용을 밖에 알리지 않기로 적어두는 문서입니다.';
  assert.ok(S4.indexOf(def) !== -1,
    'NDA 정의가 없습니다 — docs=none 을 고른 사람은 Q2 보기를 읽지 않고 지나가므로, ' +
    '이 줄이 없으면 NDA 가 한 번도 설명되지 않은 채 「문의하기」라는 블록3 을 만납니다');
  // (1) 칸 안에 있어야 합니다. (2) 칸이 시작되기 전에 나와야 한다는 뜻입니다.
  assert.ok(S4.indexOf(def) < S4.indexOf('조건을 정할 때'),
    'NDA 정의가 (1) 칸 밖에 있습니다 — (1) 안에 두는 것이 「모든 경로가 이 줄을 한 번 지나간다」의 조건입니다');
});

test('블록2 는 마크업에 정적으로 있고 조건이 걸려 있지 않다 (§5-1 「항상 표시」)', () => {
  const at = S4.indexOf('id="result-stages"');
  const tag = S4.slice(S4.lastIndexOf('<', at), S4.indexOf('>', at));
  assert.ok(tag.indexOf('hidden') === -1,
    '블록2 에 hidden 이 붙어 있습니다 — 답에 의존하지 않는 일반 진술이라 세 문항을 ' +
    '전부 건너뛴 사람도 「서류는 이 순서로 온다」는 얻고 가야 합니다');
  assert.ok(JS.indexOf('result-stages') === -1,
    '스크립트가 블록2 를 만지고 있습니다 — 분기 없는 블록에 조건이 붙는 순간 스킵한 ' +
    '사람이 빈 화면을 봅니다');
});

/* 🔄 기호를 ①②③(원문자) → (1)(2)(3) 로 바꿨습니다 〔2026-08-16 · 대표 피드백
 * 「가독성 떨어짐」〕. 검사 취지(칸 기호 = 위치 표시 기호)는 그대로입니다. */
test('(1)(2)(3) 표기가 한 벌로 통일돼 있다 (칸 기호 = 위치 표시 기호)', () => {
  const marks = (S4.match(/class="flow-num">([^<]+)</g) || []).map((s) => s.slice(s.indexOf('>') + 1, -1));
  assert.deepStrictEqual(marks, ['(1)', '(2)', '(3)'],
    '결과 화면 3칸의 기호가 (1)(2)(3) 이 아닙니다 — 위치 표시가 「(1) · (2)」로 가리키므로 ' +
    '칸에 찍힌 기호가 같아야 그 줄이 무언가를 가리킵니다(랜딩의 01·02·03 과 섞지 마십시오)');
  for (const mark of ['(1)', '(2)', '(3)']) {
    assert.ok(JS.indexOf("'" + mark + "'") !== -1, '위치 표시 매핑에 ' + mark + ' 가 없습니다');
  }
});

test('위치 표시는 docs(Q2)로만 계산하고 other_doc·none 을 배정하지 않는다 (F-7)', () => {
  const map = JS.slice(JS.indexOf('var PLACE_OF'), JS.indexOf('var DOCTYPE_OF'));
  assert.ok(/nda:\s*'\(1\)'/.test(map) && /sales_contract:\s*'\(2\)'/.test(map) &&
    /quote_pi:\s*'\(2\)'/.test(map) && /service_license:\s*'\(3\)'/.test(map),
    '위치 표시 매핑이 정본(§2-6 F-7 표)과 다릅니다');
  assert.ok(map.indexOf('other_doc') === -1 && map.indexOf('none') === -1,
    'other_doc·none 이 (1)(2)(3) 중 하나로 배정됐습니다 — 모르는 것을 모른다고 쓰는 것이 ' +
    '유일한 안전한 처리입니다. 배정하는 순간 근거 없는 주장이 화면에 나갑니다');
  // situation(Q1) 값이 위치 계산에 섞이면 「우리가 아는 것으로만 진술한다」가 깨집니다.
  for (const v of ['docs_received', 'pre_contract', 'has_revenue', 'talk_invited', 'not_started']) {
    assert.ok(map.indexOf(v) === -1, '위치 계산에 Q1 값 「' + v + '」이 섞였습니다 (F-7)');
  }
});

test('위치 표시 두 문장이 마크업에 있고 서로 독립적으로 켜진다', () => {
  assert.ok(S4.indexOf('받으신 서류가 놓이는 자리:') !== -1 &&
    S4.indexOf('받으신 서류가 어느 자리인지는 서류를 봐야 알 수 있습니다.') !== -1,
    '위치 표시 문구가 마크업에 없습니다 — JS 문자열로 옮기면 이 검사도 빌드도 못 봅니다');
  // 🔴 display 를 지정한 선택자마다 [hidden] 짝이 필요합니다(.cta-row .btn[hidden] 과 같은 이유).
  assert.ok(/#result-place\s*>\s*span\[hidden\]\s*\{[^}]*display:\s*none/.test(CSS),
    '#result-place > span[hidden] 규칙이 없습니다 — 위 `display: block` 이 브라우저 기본 ' +
    '`[hidden]{display:none}` 을 이겨서, other_doc 을 고르지 않은 사람에게도 「어느 자리인지는 ' +
    '서류를 봐야」가 붙고 자리를 못 찾은 사람에게 「놓이는 자리: (빈칸)」이 남습니다');
});

test('docs=none 문안에 시간 위계어가 없다 (F-5 · §2-1)', () => {
  const at = B.indexOf('id="result-none"');
  const line = B.slice(at, B.indexOf('</p>', at));
  assert.ok(line.indexOf('주문으로 이어지는 판매와, 문서를 주고받는 거래는 서로 다른 흐름입니다.') !== -1 &&
    line.indexOf('위 (1)에 해당하는 서류를 받으시면, 그때 쓰시는 도구입니다.') !== -1,
    'docs=none 문안이 정본과 다릅니다');
  for (const word of ['아직', '전입니다', '먼저', '다음 단계']) {
    assert.ok(line.indexOf(word) === -1,
      '시간 위계어 「' + word + '」가 있습니다 — 5년째 수출하는 사람에게 「진도가 덜 나갔다」로 ' +
      '읽혀 판단 금지 원칙에 실질 저촉합니다. 종류 차이(「서로 다른 흐름」)로만 서술합니다');
  }
});

test('블록1 되짚기의 값을 JS 로 복사하지 않고 화면 글자를 읽는다 (§2-1)', () => {
  assert.ok(S4.indexOf('받으신 서류:') !== -1 && S4.indexOf('상황:') !== -1,
    '되짚기 라벨이 마크업에 없습니다');
  assert.ok(JS.indexOf('data-title') !== -1,
    '보기의 한글 이름을 <span data-title> 에서 읽지 않고 있습니다 — 같은 문구를 JS 에 ' +
    '한 벌 더 적으면 보기 문구를 다듬은 날 화면과 결과가 조용히 갈립니다');
  for (const name of ['서류를 받았어요', '잘 모르겠어요', '이름을 잘 모르는 문서가 있어요']) {
    assert.ok(JS.indexOf(name) === -1, '보기 문구 「' + name + '」이 JS 에 복사돼 있습니다');
  }
});

/* 🔄 대표 수정안(2026-08-16) — 「서류 없음」 갈래를 곧장 [문의하기]로 바꿨습니다.
 *    옛 라벨(「NDA를 받으시면 그때 보내주세요」)·문구(「이메일을 남겨두시면…」)와
 *    목적지(파라미터 없는 /#interest)는 더 이상 정본이 아닙니다. */
test('블록3 두 갈래 문구와 행선지가 정본과 같다 (§2-6)', () => {
  assert.ok(S4.indexOf('이 서류 비교해 보기') !== -1 &&
    S4.indexOf('공개된 표준 서식과 항목별로 비교해서, 어디가 다른지 위치를 보여드립니다.') !== -1,
    '서류 있음 CTA 가 정본과 다릅니다');
  assert.ok(S4.indexOf('>문의하기<') !== -1 &&
    S4.indexOf('맞춤 서비스 개발 되는대로 연락드리겠습니다.') !== -1,
    '서류 없음 CTA 가 정본과 다릅니다');
  assert.ok(/id="cta-notify-me"[^>]*href="\/\?purpose=inquiry#interest"|href="\/\?purpose=inquiry#interest"[^>]*id="cta-notify-me"/.test(S4),
    '문의 CTA 가 랜딩 §10 문의 목적(?purpose=inquiry)으로 가지 않습니다 — 이메일은 ' +
    '이름·개인정보 동의가 함께 있어야 접수됩니다(api/leads.js). /check 안에 이메일 칸을 ' +
    '만들려면 그쪽이 먼저입니다');
});

test('블록3 클릭이 cta_clicked 를 저장하고 링크를 막지 않는다', () => {
  assert.ok(JS.indexOf("'send_docs'") !== -1 && JS.indexOf("'notify_me'") !== -1,
    'cta_clicked 저장값(send_docs · notify_me)이 없습니다 — §5-2 스키마의 값입니다');
  const at = JS.indexOf('function wireCta');
  assert.ok(at !== -1 && JS.slice(at, JS.indexOf('wireCta(', at + 10)).indexOf('preventDefault') === -1,
    'CTA 클릭을 막고 있습니다 — 저장을 기다리게 하는 순간 링크가 느려집니다. ' +
    '요청은 keepalive 가 들고 갑니다(우회 링크와 같은 처리)');
});

test('/precheck 로 세션키와 문서유형을 쿼리로 넘긴다 (§6 · 작업 8)', () => {
  assert.ok(JS.indexOf("'/precheck?pre='") !== -1 && JS.indexOf("'&docs='") !== -1,
    '/precheck?pre=…&docs=… 를 만들지 않습니다 — 서버 조회 없이 쿼리로 넘기는 것이 §6 입니다');
  const map = JS.slice(JS.indexOf('var DOCTYPE_OF'), JS.indexOf('function el('));
  assert.ok(/service_license:\s*'other'/.test(map) && /other_doc:\s*'other'/.test(map),
    'service_license·other_doc 이 「other」로 접히는 다대일 매핑이 없습니다 (§5-3)');
  assert.ok(map.indexOf('none') === -1,
    'docs=none 이 프리필 값으로 나갑니다 — 서류가 없는 사람에게는 파라미터 자체를 붙이지 않습니다');
});

test('결과 화면이 내용을 보여주므로 noindex 가 걷혔다', () => {
  assert.ok(!/name="robots"/.test(M),
    'noindex 가 남아 있습니다 — S4 가 3블록을 그리는 지금 기준(「결과 화면이 실제로 ' +
    '무언가를 보여주는가」)은 충족됐습니다. 두면 /check 는 영원히 검색에 안 잡힙니다');
});

/* ══ 6. /precheck 수신 〔작업 8〕 ═══════════════════════════════════════════ */

const PRE_RAW = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');
const PRE_M = PRE_RAW.replace(/<!--[\s\S]*?-->/g, '');
const PRE_JS = PRE_M.slice(PRE_M.indexOf('function pickDocTypeOption'));
/** 사람 눈에 보이는 본문만 — 이 파일의 B 와 같은 방식입니다(주석·스크립트·CSS 제외). */
const PRE_B = PRE_M.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');

test('문서유형 보기에 data-doctype 이 붙었고 name·value 는 그대로다 (§6)', () => {
  const at = PRE_M.indexOf('id="intake-doc-type"');
  const sel = PRE_M.slice(at, PRE_M.indexOf('</select>', at));
  assert.ok(sel.indexOf('name="docType"') !== -1, '폼 필드명(docType)이 바뀌었습니다 — 제출 로직 무변경이 전제입니다');
  for (const [key, value] of [['nda', 'nda'], ['sales_contract', 'contract'], ['quote_pi', 'quotation']]) {
    assert.ok(new RegExp('value="' + value + '" data-doctype="' + key + '"').test(sel),
      value + ' 보기에 data-doctype="' + key + '" 가 없거나 value 가 바뀌었습니다 — ' +
      '프리필은 [data-doctype] 으로만 찾으므로 이 속성이 연결의 전부입니다');
  }
  // other(용역·라이선스 + 이름 모르는 문서)에 대응하는 보기는 이 폼에 없습니다.
  // 발주서(PO)에 임의 배정하면 설계서가 금지한 「모르는 것을 아는 척 배정하기」가 됩니다.
  assert.ok(sel.indexOf('data-doctype="other"') === -1,
    'other 를 어느 보기엔가 배정했습니다 — 이 폼에 「기타」 칸이 없다는 사실이 바뀌지 않는 한, ' +
    '배정하는 쪽이 근거 없는 주장입니다. 「기타」 보기가 생기면 그 <option> 에 붙이십시오');
});

/*
 * ── F-10 · 「안 고름」이 존재하는가 〔2026-08-15〕 ──────────────────────────
 *
 * 종전에는 이 <select> 에 「안 고른 상태」가 없었습니다. HTML 은 첫 <option> 을
 * 자동으로 고른 채 시작하고 그 첫 보기가 NDA 였으므로, 사전 확인 Q2 에서
 * 「이름을 잘 모르는 문서가 있어요」를 골라 **NDA 가 아니라고 답한 사람**이
 * 이 폼에서 NDA 를 고른 상태로 시작했습니다(나머지 보기는 전부 disabled 라
 * 고칠 수도 없었습니다). 설계서 §7 이 결과 화면(F-7)에 적용한 원칙 —
 * 「모르는 것을 아는 척 배정하지 않는다」— 이 접수 폼에서만 빠져 있던 자리입니다.
 *
 * 여기서 잠그는 것은 셋입니다. ①「안 고름」 보기가 마크업에 있는가 ② 프리필이
 * 성립하지 못하면 실제로 그리로 가는가 ③ 그 상태가 접수로 새지 않는가.
 * ②는 원문 검사로 못 잡습니다 — 조건 한 줄이 뒤집혀도 낱말은 그대로이기
 * 때문입니다. 그래서 판단 함수를 **그대로 실행**합니다.
 */

/** 실제 마크업에서 읽어낸 보기 표 — 손으로 적으면 화면과 갈립니다. */
function docTypeOptionsFromMarkup() {
  const at = PRE_M.indexOf('id="intake-doc-type"');
  const sel = PRE_M.slice(at, PRE_M.indexOf('</select>', at));
  const map = {};
  for (const tag of sel.match(/<option[^>]*>/g) || []) {
    const key = (tag.match(/data-doctype="([^"]*)"/) || [])[1];
    if (!key) continue;
    map[key] = { value: (tag.match(/value="([^"]*)"/) || [])[1], disabled: tag.indexOf('disabled') !== -1 };
  }
  return map;
}

/** pickDocTypeOption 하나만 떼어 실행합니다(DOM 대역은 querySelector 한 칸뿐). */
function loadPicker() {
  const at = PRE_RAW.indexOf('function pickDocTypeOption');
  const end = PRE_RAW.indexOf('function applyPrestepHandoff', at);
  assert.ok(at !== -1 && end > at, 'pickDocTypeOption 을 찾지 못했습니다 — 함수가 사라졌거나 순서가 바뀌었습니다');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(PRE_RAW.slice(at, end), ctx);

  const options = docTypeOptionsFromMarkup();
  const sel = {
    querySelector(q) {
      const key = (q.match(/data-doctype="([^"]*)"/) || [])[1];
      return Object.prototype.hasOwnProperty.call(options, key) ? options[key] : null;
    },
  };
  return (docs) => ctx.pickDocTypeOption(sel, docs);
}

test('🔴 「안 고름」 보기가 첫 자리에 있고, 기본값은 그대로 NDA 다 (F-10)', () => {
  const at = PRE_M.indexOf('id="intake-doc-type"');
  const sel = PRE_M.slice(at, PRE_M.indexOf('</select>', at));
  const options = sel.match(/<option[^>]*>/g) || [];

  assert.match(options[0], /value=""/,
    '첫 보기가 빈 값이 아닙니다 — HTML 은 첫 <option> 을 자동으로 고른 채 시작하므로, ' +
    '첫 자리에 빈 보기가 없으면 「안 고른 상태」가 아예 존재하지 않습니다');
  assert.ok(options[0].indexOf('disabled') !== -1,
    '「안 고름」 보기가 사람에게 열려 있습니다 — 프리필만 넣는 자리이고, 화면에서 고를 수 있는 ' +
    '보기와 서버 목록을 대조하는 검사(test/doc-type.test.js)가 이 속성을 봅니다');
  assert.ok(options[0].indexOf('data-doctype') === -1,
    '「안 고름」 보기에 data-doctype 이 붙었습니다 — 사전 확인의 어떤 값을 여기에 배정한 것이 됩니다. ' +
    '프리필은 「고를 수 있는 것이 없다」는 결과로 이리 옵니다(pickDocTypeOption → null)');

  assert.match(sel, /value="nda"[^>]*selected/,
    'NDA 의 기본값이 사라졌습니다 — 고친 것은 「사전 확인의 답을 못 지키면서 지킨 척하는 것」이지 ' +
    '「기본값이 있는 것」이 아닙니다. 바로 온 사람에게 고르는 일을 하나 더 시키지 않습니다');
});

test('🔴 고를 수 있는 보기가 없으면 프리필이 아무것도 고르지 않는다 (F-10)', () => {
  const pick = loadPicker();

  // other = 용역·라이선스 + 이름 모르는 문서. 이 폼에 대응 보기가 없습니다.
  assert.strictEqual(pick('other'), null,
    'other 를 어느 보기엔가 배정했습니다 — 여기서 null 이 아니면 NDA 가 남거나 남의 자리가 배정됩니다');
  // 준비중 서류만 고른 사람도 같은 사실 위에 있습니다 — 「지금 고를 수 있는 보기가 없다」.
  assert.strictEqual(pick('sales_contract'), null, '준비중(disabled) 보기를 골랐습니다 — 접수가 400 으로 실패합니다');
  assert.strictEqual(pick('quote_pi'), null, '준비중(disabled) 보기를 골랐습니다 — 접수가 400 으로 실패합니다');
  assert.strictEqual(pick('sales_contract,other'), null, '준비중과 other 만 있는데 무언가를 골랐습니다');
  assert.strictEqual(pick(''), null);
  assert.strictEqual(pick('없는값'), null);
});

test('정상 프리필 경로는 그대로다 — nda 는 골라지고, 함께 온 other 가 그것을 밀어내지 않는다', () => {
  const pick = loadPicker();
  assert.strictEqual(pick('nda').value, 'nda');
  assert.strictEqual(pick('nda,other').value, 'nda', 'NDA 를 가진 사람의 프리필이 사라졌습니다');
  assert.strictEqual(pick('other,nda').value, 'nda', '고를 수 있는 값이 뒤에 있으면 못 찾습니다');
  assert.strictEqual(pick('sales_contract,nda').value, 'nda', '준비중 값에서 멈췄습니다 — 건너뛰고 계속 봐야 합니다');
});

test('🔴 프리필이 성립하지 못하면 빈 값으로 두고, 그 사실을 화면이 적는다 (F-10)', () => {
  assert.match(PRE_JS, /docTypeSel\.value = picked \? picked\.value : ''/,
    '고를 것이 없을 때 <select> 를 비우지 않습니다 — 손대지 않으면 기본값 NDA 가 그대로 남고, ' +
    '그것이 이 결함 자체입니다');
  assert.ok(PRE_JS.indexOf("getElementById('doc-type-unmatched')") !== -1,
    '보기가 없다는 사실을 화면이 말하지 않습니다 — 사용자에게는 프리필이 왜 비었는지가 보이지 않습니다');
  assert.ok(PRE_B.indexOf('사전 확인에서 고르신 서류에 해당하는 보기가 아직 없습니다') !== -1,
    '안내 문면이 사라졌습니다');
});

test('🔴 안 고른 채로 접수되지 않는다 — 화면이 서버의 빈값 폴백보다 앞에 선다 (F-10)', () => {
  assert.match(PRE_JS, /if \(!docType\) \{[\s\S]{0,120}?문서 종류를 골라 주십시오/,
    '문서 종류를 안 고른 제출을 막지 않습니다 — 서버(parseDocType)는 빈 값을 nda 로 받으므로 ' +
    '(옛 캐시본 때문에 그래야 합니다) 이 구분은 화면만 할 수 있습니다');
  assert.ok(!/docTypeSel && docTypeSel\.value \? docTypeSel\.value : 'nda'/.test(PRE_JS),
    '빈 값을 화면에서 nda 로 눕히고 있습니다 — 그러면 <select> 만 비어 보이고 접수는 NDA 로 들어갑니다');
  assert.match(PRE_JS, /var docType = docTypeSel \? docTypeSel\.value : 'nda'/,
    '선택 상자가 **없는** 옛 캐시본의 폴백이 사라졌습니다 — 상자가 없는 것과 비어 있는 것은 다릅니다');
});

test('프리필 뒤 주소창에서 파라미터를 지운다 (기존 ?intake=ok&r= 처리와 동일)', () => {
  assert.ok(/replaceState\(null, '', '\/precheck'\)/.test(PRE_JS),
    'history.replaceState 로 쿼리를 정리하지 않습니다 — 새로고침·뒤로가기에서 같은 ' +
    '프리필이 다시 걸리고 세션키가 주소창에 남습니다');
});

test('/precheck 에 연속성 문구가 없다 — E-4 승인 대기 항목이다 (§12 C-2)', () => {
  assert.ok(PRE_B.indexOf('방금 답하신 내용') === -1,
    '「방금 답하신 내용이 아래에 반영되어 있습니다」가 들어갔습니다 — 승인 전입니다. ' +
    '게다가 지금은 문서 종류 한 칸만 맞춰지므로 other 경로에서는 그 말이 사실이 아닙니다');
});
