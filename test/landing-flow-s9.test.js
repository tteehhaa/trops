/*
 * 랜딩 잔여 4건 테스트 〔S1~S4 · 흐름 md §1 · §4 · §5-1 13번 · 신설 2026-08-13〕
 *
 *   npm test        (node --test test/)
 *
 * 다루는 것:
 *   S1 KOTRA 신뢰신호가 문의하기 버튼 옆에 **한 곳만** 있는가
 *   S2 애니메이션 3곳 — 신뢰 문장 등장 · 지도 핀 순차 · 아코디언 슬라이드
 *   S3 아코디언 카드 3종이 스펙대로인가 (실행버튼 유무 · 안내문 · 링크)
 *   S4 FAQ 채널분기 문항
 *
 * ⚠️ 모든 검사는 **주석을 걷어낸 마크업**에 대해 합니다. 이 저장소는 주석을 인수인계
 *    수단으로 쓰므로(빌드가 떼어냅니다) 주석에 "하지 마십시오" 로 적힌 문자열이
 *    그대로 오탐이 됩니다. 실제로 몇 번 그렇게 걸렸습니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
/** 주석 없는 마크업. 위 ⚠️ 참조. */
const M = HTML.replace(/<!--[\s\S]*?-->/g, '');
/**
 * 사람 눈에 보이는 본문만. <style>·<script> 를 통째로 걷어냅니다.
 *
 * ⚠️ 「문구가 몇 번 나오는가」를 셀 때 반드시 이것을 쓰십시오. M 은 HTML 주석만
 *    걷어내므로 CSS·JS **안의** 주석이 그대로 남습니다 — 이 저장소는 그 주석에
 *    문구를 인용해 경위를 적으므로(예: 「그 문구(KOTRA…)가 마감 CTA 로 옮겨갔다」)
 *    M 으로 세면 옮긴 흔적을 중복 노출로 오판합니다. 실제로 그렇게 걸렸습니다.
 */
const BODY = M
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<script[\s\S]*?<\/script>/g, '');
/** <style> 안의 CSS. 규칙을 볼 때 씁니다. */
const CSS = HTML.match(/<style[\s\S]*?<\/style>/)[0];

/** 한 섹션 블록을 잘라냅니다. */
function section(className) {
  const start = M.indexOf('<section class="' + className);
  assert.ok(start !== -1, className + ' 섹션을 찾지 못했습니다');
  const end = M.indexOf('</section>', start);
  return M.slice(start, end);
}

/* ── S1 KOTRA 신뢰신호 재배치 ─────────────────────────────────────────────── */

test('KOTRA 신뢰신호가 마감 CTA 안에 있다 — 문의하기 버튼 옆', () => {
  const close = section('close-cta');
  assert.ok(close.indexOf('KOTRA 멘토 네트워크') !== -1,
    '마감 CTA 에 KOTRA 신뢰신호가 없습니다');
  assert.ok(close.indexOf('data-purpose="inquiry"') !== -1,
    '같은 섹션에 [문의하기] 버튼이 없으면 「버튼 옆」이 성립하지 않습니다');
});

test('🔴 KOTRA 문구가 페이지에 딱 한 번만 나온다', () => {
  /*
   * 두 곳에 두면 #interest 쪽이 「기한관리 출시 알림 신청」의 신뢰신호로 읽힙니다 —
   * 흐름 md §4 가 「트래킹 대기자 등록에 붙어있던 문구를 재배치」 라고 지적한
   * 바로 그 상태입니다. 옮기는 것이지 복제하는 것이 아닙니다.
   */
  const hits = (BODY.match(/KOTRA 멘토 네트워크/g) || []).length;
  assert.strictEqual(hits, 1, 'KOTRA 문구가 화면에 ' + hits + '번 나옵니다 (1번이어야 합니다)');
});

test('#interest 폼에는 KOTRA 문구가 없다', () => {
  const start = M.indexOf('<section class="interest"');
  assert.ok(start !== -1, '#interest 섹션을 찾지 못했습니다');
  const interest = M.slice(start, M.indexOf('</section>', start));
  assert.ok(interest.indexOf('KOTRA') === -1,
    '#interest 에 KOTRA 문구가 남아 있습니다 — 알림 신청의 신뢰신호로 읽힙니다');
  assert.ok(interest.indexOf('class="interest-sub"') === -1,
    '.interest-sub 마크업이 남아 있습니다');
});

test('「상담」이라는 낱말을 쓰지 않는다 — 유상 자문 오인 이력', () => {
  const close = section('close-cta');
  assert.ok(!/상담/.test(close), '마감 CTA 에 「상담」이 있습니다');
});

/* ── S2 애니메이션 ────────────────────────────────────────────────────────── */

test('신뢰 통계 문장에 스크롤 진입 등장이 붙어 있다', () => {
  const trust = section('trust');
  assert.match(trust, /class="h3 stat-line reveal"/, '인용문에 .reveal 이 없습니다');
  assert.match(trust, /class="stat-src reveal reveal-late"/, '출처에 .reveal 이 없습니다');
});

test('🔴 JS 가 죽으면 인용문이 그대로 보인다 — 숨김은 JS 가 켠다', () => {
  /*
   * 이것이 S2 에서 가장 중요한 단정입니다. .reveal 만으로 opacity:0 을 걸면
   * IntersectionObserver 가 없는 브라우저에서 **페이지에서 가장 중요한 인용문
   * 하나가 영구히 사라집니다.** 그래서 숨김 규칙은 .reveal-armed 하위에만 있고,
   * 그 클래스는 JS 가 관찰을 시작할 수 있을 때만 붙습니다.
   */
  /*
   * 셀렉터를 **전체 문자열로** 봅니다. `.reveal` 부분일치로 찾으면
   * `.reveal-armed .reveal {` 같은 정상 규칙까지 걸립니다(그렇게 한 번 오탐했습니다).
   * 주석은 먼저 걷어냅니다 — 규칙처럼 생긴 문장이 주석에 있습니다.
   */
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((chunk) => {
      const at = chunk.lastIndexOf('{');
      if (at === -1) return null;
      return { selector: chunk.slice(0, at).trim(), body: chunk.slice(at + 1) };
    })
    .filter(Boolean);

  const bare = rules.filter((r) => r.selector.split(',').some((s) => s.trim() === '.reveal'));
  assert.ok(bare.length === 0 || bare.every((r) => !/opacity:\s*0/.test(r.body)),
    '.reveal 이 단독으로 숨김을 걸고 있습니다 — JS 가 없는 환경에서 인용문이 영구히 사라집니다');

  const armed = rules.filter((r) => r.selector === '.reveal-armed .reveal');
  assert.ok(armed.length > 0 && armed.some((r) => /opacity:\s*0/.test(r.body)),
    '숨김이 .reveal-armed 하위에 있어야 합니다');

  const js = HTML.match(/<script>[\s\S]*?<\/script>/)[0];
  assert.match(js, /IntersectionObserver/, '관찰자를 쓰지 않습니다');
  // 관찰자 지원 확인이 .reveal-armed 부착보다 **먼저** 와야 합니다.
  const guardAt = js.indexOf("typeof window.IntersectionObserver");
  const armAt = js.indexOf("classList.add('reveal-armed')");
  assert.ok(guardAt !== -1 && armAt !== -1, '가드나 부착 코드가 없습니다');
  assert.ok(guardAt < armAt,
    '지원 확인보다 먼저 숨김을 켭니다 — 미지원 브라우저에서 문장이 사라집니다');
});

test('기한관리 카드에 핀 마커가 순차로 등장한다', () => {
  const pins = (M.match(/class="feat-pin"/g) || []).length;
  assert.ok(pins >= 2, '핀 마커가 ' + pins + '개입니다 — 순차 등장은 2개 이상이어야 보입니다');

  // 등장 순서는 마크업의 --i 가 정합니다(CSS 에 순서를 박지 않습니다).
  const orders = (M.match(/class="feat-pin" style="--i:(\d+)"/g) || [])
    .map((s) => Number(s.match(/--i:(\d+)/)[1]));
  assert.strictEqual(orders.length, pins, '모든 핀에 --i 가 붙어 있어야 합니다');
  assert.deepStrictEqual(orders, orders.slice().sort((a, b) => a - b), '--i 가 순서대로가 아닙니다');
  assert.strictEqual(new Set(orders).size, orders.length, '--i 가 겹칩니다 — 두 핀이 같이 나타납니다');

  const css = CSS;
  assert.match(css, /@keyframes pin-drop/, '핀 등장 키프레임이 없습니다');
  assert.match(css, /\.feat\[data-open="1"\] \.feat-pin \{[^}]*animation: pin-drop/,
    '펼쳐진 카드에서만 돌아야 합니다 — 접힌 채로 돌면 펼쳤을 때 이미 끝나 있습니다');
  assert.match(css, /animation-delay: calc\(var\(--i[^)]*\) \* \d+ms\)/, '순차 지연이 없습니다');
});

test('🔴 가짜 지도를 그리지 않았다 — 자리표시자는 자리표시자로 남는다', () => {
  const timeline = M.slice(M.indexOf('id="feat-timeline"'));
  const card = timeline.slice(0, timeline.indexOf('</section>'));

  // 지도 이미지·SVG 경로가 새로 들어오지 않았는지.
  assert.ok(card.indexOf('<svg') === -1 || card.indexOf('feat-chev') !== -1,
    '기한관리 카드에 지도 그래픽이 들어왔습니다');
  assert.ok(card.indexOf('timeline-map-sample') === -1,
    '아직 없는 캡처 파일을 참조합니다 — 깨진 이미지가 배포됩니다');

  // 예시임을 밝히는 문장이 남아 있어야 합니다.
  assert.ok(/캡처를 준비하고 있습니다/.test(card), '준비 중이라는 사실을 밝히지 않습니다');
  assert.ok(/실제 고객 거래가 아닙니다/.test(card), '예시 표기가 없습니다');
});

test('아코디언 슬라이드가 즉시 show/hide 가 아니다', () => {
  const css = CSS;
  const rule = css.match(/\.feat-panel \{[^}]*\}/);
  assert.ok(rule, '.feat-panel 규칙이 없습니다');
  assert.match(rule[0], /grid-template-rows: 0fr/, '접힘이 0fr 이 아닙니다');
  assert.match(rule[0], /transition: grid-template-rows/, '슬라이드 전환이 없습니다');
  assert.match(css, /\.feat\[data-open="1"\] \.feat-panel \{[^}]*grid-template-rows: 1fr/,
    '펼침이 1fr 이 아닙니다');
  assert.ok(!/\.feat-panel \{[^}]*display: none/.test(css),
    'display:none 방식이면 슬라이드가 불가능합니다');
});

test('움직임을 줄이는 설정에서 내용이 사라지지 않는다', () => {
  const css = CSS;
  const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n  \}/);
  assert.ok(block, 'prefers-reduced-motion 블록이 없습니다');

  assert.match(block[0], /\.reveal-armed \.reveal \{[^}]*opacity: 1/,
    '움직임을 끄면서 문장을 숨긴 채 둡니다');
  assert.match(block[0], /\.feat-pin \{ animation: none/, '핀 애니메이션을 끄지 않습니다');
  assert.ok(!/display: none/.test(block[0]),
    '접근성 설정을 콘텐츠 검열로 바꾸지 마십시오');
});

/* ── S3 아코디언 카드 3종 ─────────────────────────────────────────────────── */

/** 카드 하나의 마크업을 잘라냅니다. */
function card(id) {
  const start = M.indexOf('<div class="feat" id="' + id + '"');
  assert.ok(start !== -1, id + ' 카드를 찾지 못했습니다');
  const next = M.indexOf('<div class="feat" id=', start + 10);
  const end = next === -1 ? M.indexOf('</section>', start) : next;
  return M.slice(start, end);
}

/** 카드 안의 실행버튼(.btn) — 펼침 버튼(.feat-btn)은 제외합니다. */
function actionButtons(block) {
  return (block.match(/<(?:a|button)[^>]*class="[^"]*\bbtn\b[^"]*"[^>]*>/g) || [])
    .filter((tag) => tag.indexOf('feat-btn') === -1);
}

test('사전점검 카드 — 실행버튼 없이 설명+예시화면만', () => {
  const block = card('feat-precheck');
  assert.deepStrictEqual(actionButtons(block), [],
    '실행버튼이 있습니다 — 바로 다음 「결」 섹션 CTA 와 중복되고 주버튼 2회 규칙이 깨집니다');
  assert.match(block, /class="feat-desc"/, '설명이 없습니다');
  assert.match(block, /<img[^>]*src="\/img\//, '예시화면이 없습니다');
});

test('바이어확인 카드 — 실행버튼 없이 사전점검 연결 안내만', () => {
  const block = card('feat-buyer');
  assert.deepStrictEqual(actionButtons(block), [], '죽은 클릭이 될 실행버튼이 있습니다');
  assert.ok(
    block.indexOf('사전점검 결과화면에서 바로 확인하실 수 있습니다') !== -1,
    '흐름 md §1 이 지정한 연결 안내문이 없습니다'
  );
  assert.ok(!/무료/.test(block),
    '「무료」는 덤처럼 보여 가치를 저평가시킵니다 — 흐름 md §4 Give/Get 은 「포함」 계열을 씁니다');
});

test('기한관리 카드 — [계약 등록해보기] 가 app.trops.kr 로 간다', () => {
  const block = card('feat-timeline');
  const buttons = actionButtons(block);
  assert.strictEqual(buttons.length, 1,
    '실행버튼이 ' + buttons.length + '개입니다 — 기한관리만 1개를 갖습니다');
  assert.match(buttons[0], /btn-secondary/,
    'btn-primary 로 올리면 주버튼이 3회가 됩니다');
  assert.ok(block.indexOf('계약 등록해보기') !== -1, '버튼 라벨이 다릅니다');

  const href = (buttons[0].match(/href="([^"]*)"/) || [])[1];
  assert.strictEqual(href, 'https://app.trops.kr/',
    '[계약 등록해보기] 가 app.trops.kr 로 가지 않습니다: ' + href);
});

test('세 카드가 같은 인터랙션이다 — 클릭하면 그 자리에서 펼쳐진다', () => {
  for (const id of ['feat-precheck', 'feat-buyer', 'feat-timeline']) {
    const block = card(id);
    assert.match(block, /data-open="0"/, id + ' 이 접힌 상태로 내려오지 않습니다');
    assert.match(block, /class="feat-btn" type="button" aria-expanded="false"/,
      id + ' 의 펼침 버튼이 다른 모양입니다');
    assert.match(block, /class="feat-panel"/, id + ' 에 패널이 없습니다');
  }
});

/* ── S4 FAQ 채널분기 ─────────────────────────────────────────────────────── */

test('채널분기 문항이 있고, 문구가 흐름 md 그대로다', () => {
  assert.ok(
    M.indexOf('셀프서브 사전점검이랑 문의하기는 뭐가 달라요?') !== -1,
    '채널분기 질문이 없습니다'
  );
  assert.ok(
    M.indexOf('지금 바로 결과를 받고 싶으시면 사전점검, 저희 대표님과 먼저 상황을 얘기하고 싶으시면 문의하기입니다.') !== -1,
    '흐름 md §5-1 13번의 답 문면과 다릅니다'
  );
});

test('채널분기 문항이 「어떻게 쓰나요」 묶음에 있다', () => {
  const groups = M.match(/<div class="qgroup">[\s\S]*?(?=<div class="qgroup">|<\/div>\s*<\/div>\s*<\/section>)/g);
  assert.ok(groups && groups.length === 3, '묶음이 3개가 아닙니다: ' + (groups ? groups.length : 0));

  const found = groups.find((g) => g.indexOf('셀프서브 사전점검이랑') !== -1);
  assert.ok(found, '어느 묶음에도 없습니다');
  assert.ok(found.indexOf('어떻게 쓰나요') !== -1,
    '「어떻게 쓰나요」 묶음이 아닙니다 — 어느 경로로 시작하는가는 사용법 질문입니다');
});

test('FAQ 아코디언 짝이 맞고 id 가 겹치지 않는다', () => {
  const controls = M.match(/aria-controls="(qa-\d+)"/g).map((s) => s.match(/qa-\d+/)[0]);
  const panels = M.match(/<div class="qans" id="(qa-\d+)"/g).map((s) => s.match(/qa-\d+/)[0]);

  assert.deepStrictEqual(controls, panels, '버튼과 패널의 짝이 어긋납니다');
  assert.strictEqual(new Set(controls).size, controls.length,
    'qa- id 가 중복됩니다 — 한 버튼이 두 패널을 엽니다');
  assert.strictEqual(controls.length, 14, 'FAQ 문항 수가 14개가 아닙니다: ' + controls.length);
});

test('「상담 신청」 문항을 되살리지 않았다', () => {
  const start = M.indexOf('<section class="qna"');
  const qna = M.slice(start, M.indexOf('</section>', start));
  assert.ok(!/상담\s*신청/.test(qna), 'FAQ 에 「상담 신청」이 있습니다 — 명칭은 「문의하기」로 확정됐습니다');
});
