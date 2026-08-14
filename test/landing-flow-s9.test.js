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
  /*
   * 🔄 클래스 **문자열 전체**를 단정하던 것을 「stat-line 에 reveal 이 붙어 있는가」로
   *    바꿨습니다 〔2026-08-14 · landing-emphasis-s10〕. 인용문이 H3 스케일에서 헤드라인
   *    스케일로 올라가면서 `h3` 클래스가 빠졌는데, 그것은 이 검사가 지키려는 것(스크롤
   *    진입 등장)과 무관합니다. 크기가 바뀔 때마다 애니메이션 검사가 깨지면 안 됩니다.
   */
  assert.match(trust, /class="[^"]*\bstat-line\b[^"]*\breveal\b[^"]*"/, '인용문에 .reveal 이 없습니다');
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

/*
 * 🔄 **단언을 갈아 적었습니다** 〔2026-08-13 · price-300k-naming-map-s9〕.
 *
 * 종전 이름은 「기한관리 카드에 핀 마커가 **순차로 등장한다**」였고 흐름 md §1
 * 「다이나믹함」 2번을 근거로 삼았습니다. 그 요구를 **제품(trops_a)의 확정정책이
 * 덮었습니다** — `tests/guardrails/world-map-boundary.test.ts`(D2 · 2026-08-12)가
 * 세계지도 패널에 대해 ① 예시 2개국(FR·AE) ② 「⛔ 항로선·애니메이션 0」 ③ 「예시 점에
 * 건수를 적지 않는다」를 검사로 못질해 두었습니다.
 *
 * 랜딩의 이 자리는 **그 화면을 미리 보여주는 자리**입니다. 같은 예시가 두 곳에서 다르게
 * 보이면 「랜딩에서 본 것」과 「들어가서 본 것」이 갈립니다 — 그래서 랜딩을 제품에 맞춥니다.
 *
 * ⛔ 이 검사를 「순차 등장」으로 되돌리지 마십시오. 되돌리려면 trops_a 의 그 검사를 먼저
 *    바꿔야 하고, 그것은 제품 정책 변경입니다(스케치 md 로는 뒤집지 않습니다).
 */
test('🔴 기한관리 예시가 제품 정책과 같다 — 손으로 흉내 내지 않고 그 화면을 싣는다', () => {
  /*
   * 🔄 **단언을 갈아 적었습니다** 〔2026-08-14 · card-shot-reveal-s11〕.
   *
   * 종전에는 랜딩이 제품 정책(FR·AE 2개국 · 애니메이션 0 · 점에 수치 0)을 **손으로
   * 흉내 낸 결과**(`.feat-pin` 세로 목록)를 검사했습니다. 그 자리에 이제 app.trops.kr
   * 홈의 「계약이 향하는 곳」 패널 **실제 캡처**(`img/timeline-map.jpg`)가 들어갔습니다.
   *
   * 그래서 검사할 것이 바뀌었습니다 — 세 정책은 **캡처 안에 이미 들어 있으므로**
   * 여기서 다시 셀 것이 없습니다. 대신 지켜야 할 것은 **「손으로 그린 것으로 되돌아가지
   * 않는다」** 하나입니다. 되돌아가는 순간 제품과 갈라질 통로가 다시 열립니다.
   *
   * ⛔ 이 검사를 핀 개수 세기로 되돌리지 마십시오 — 되돌리려면 캡처를 먼저 걷어내야
   *    하고, 그것은 제품 화면을 손그림으로 바꾸는 일입니다.
   * ⚠️ 제품 쪽 정본은 그대로입니다: trops_a `tests/guardrails/world-map-boundary.test.ts`.
   */
  const timeline = M.slice(M.indexOf('id="feat-timeline"'));
  const card = timeline.slice(0, timeline.indexOf('</section>'));

  assert.ok(/<img[^>]*src="\/img\/timeline-map\.jpg"/.test(card),
    '기한관리 카드에 실제 화면 캡처가 없습니다 — 이 자리는 제품 화면을 미리 보여주는 자리입니다');

  const cssCode = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const markup = M.replace(/<style[\s\S]*?<\/style>/g, '');

  // 손으로 그리던 자리표시자가 마크업·CSS 양쪽에서 사라졌는지 함께 봅니다.
  //   한쪽만 지우면 다음 사람이 남은 쪽을 보고 되살립니다.
  for (const cls of ['feat-pin', 'feat-map']) {
    assert.ok(!new RegExp(cls).test(markup),
      '자리표시자(.' + cls + ')가 마크업에 남아 있습니다 — 실제 캡처와 손그림이 함께 있습니다');
    assert.ok(!new RegExp('\\.' + cls).test(cssCode),
      '자리표시자(.' + cls + ') 규칙이 CSS 에 남아 있습니다 — 쓰지 않는 클래스는 되살아납니다');
  }

  // 점에 수치 0 — D-day·건수를 적으면 예시가 집계처럼 읽힙니다.
  assert.ok(!/feat-pin-meta/.test(markup) && !/feat-pin-meta/.test(cssCode),
    '핀에 수치 캡션(.feat-pin-meta)이 남아 있습니다 — 숫자를 적으면 집계로 읽힙니다');
  assert.ok(!/D-\d+/.test(card), 'D-day 표기가 남아 있습니다');

  // 애니메이션 0 — 키프레임·규칙·순서값 세 겹을 함께 봅니다.
  assert.ok(!/@keyframes pin-drop/.test(cssCode), 'pin-drop 키프레임이 남아 있습니다');
  assert.ok(!/class="feat-pin"[^>]*--i:/.test(M),
    '등장 순서(--i)가 남아 있습니다 — 순차 등장의 흔적입니다');
});

test('🔴 가짜 지도를 그리지 않았다 — 그리는 대신 제품 화면을 싣는다', () => {
  const timeline = M.slice(M.indexOf('id="feat-timeline"'));
  const card = timeline.slice(0, timeline.indexOf('</section>'));

  /*
   * 🔄 **자리표시자 단계가 끝났습니다** 〔2026-08-14 · card-shot-reveal-s11〕.
   * 이 검사의 이름은 「자리표시자는 자리표시자로 남는다」였고, 캡처가 없는 동안
   * 가짜 지도를 그리지 못하게 막는 것이 일이었습니다. 캡처가 들어온 지금 지켜야 할
   * 것은 **「직접 그린 지도가 다시 들어오지 않는다」** 로 좁혀집니다.
   */
  // 셰브론 말고 다른 SVG(직접 그린 지도 윤곽·대륙)가 들어오지 않았는지.
  const svgs = (card.match(/<svg/g) || []).length;
  const chevs = (card.match(/feat-chev/g) || []).length;
  assert.strictEqual(svgs, chevs,
    '기한관리 카드에 셰브론이 아닌 SVG 가 ' + (svgs - chevs) + '개 있습니다 — 지도를 직접 ' +
    '그리면 제품 화면이 아닌 것이 제품 화면처럼 보입니다');

  assert.ok(card.indexOf('timeline-map-sample') === -1,
    '없는 캡처 파일을 참조합니다 — 깨진 이미지가 배포됩니다');

  // 예시임을 밝히는 문장이 남아 있어야 합니다.
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
  /*
   * 🔄 핀 애니메이션 예외 단언을 걷었습니다 〔2026-08-13〕. 끌 애니메이션 자체가 없어졌으므로
   *    (위 「제품 정책과 같다」 검사) 여기서 그것을 요구하면 서로 반대되는 두 검사가 됩니다.
   *    ⚠️ 슬라이드·페이드는 그대로 남아 있어야 하므로 아래 두 단언은 유지합니다.
   */
  assert.match(block[0], /\.feat-panel[^{]*\{[^}]*transition: none/,
    '아코디언 슬라이드를 끄지 않습니다');
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
