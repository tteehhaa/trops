/*
 * 첫 화면 «우리 회사 수출 리포트» 입구 검사 〔신설 2026-11-03〕
 *
 *   npm test
 *
 * 🔄 **2026-11-03 대표 결정 — 앱 비로그인 홈이 수출 리포트 처음 화면으로 바뀌어 랜딩 첫 화면도 같은 입구로.**
 *    앱(app.trops.kr) 비로그인 홈이 «홈페이지 주소 한 칸 + [리포트 받기]»가 됐고, 로그인 뒤 앱이 넣은 주소로
 *    점검을 곧바로 시작합니다. 국문 랜딩(index.html) 첫 화면의 세 갈래를 같은 입구로 바꿨습니다.
 *    ⚠️ 영문(en.html)은 이번에 바꾸지 않았습니다 — 그쪽 세 갈래는 `hero-start-tasks.test.js` 가 그대로 잽니다.
 *
 * 🔄 **2026-11-05 대표 «고쳐» — 앱 로그인이 아니라 앱 비로그인 첫 화면 `/?site=<도메인>&from=landing` 으로.**
 *    앱 첫 화면이 그 주소를 칸에 채우고 맛보기(읽는 중 → 맛보기 → 카카오 · Google로 계속하기)를 저절로 시작합니다.
 *    로그인 링크로 바로 가면 그 맛보기를 건너뛰었습니다. ⚠️ 앱 쪽 고침이 운영에 나간 뒤에 이 고침이 나갑니다.
 *
 * 🔴 무엇을 지키나
 *   ① 링크 만들기 — 앱 첫 화면 `/?site=<도메인>` · foreon1.com 의 결과를 글자 그대로 · 유입원은 track.js 가 `landing`(이 방문의 값이 있으면 그 값)
 *      자바스크립트가 없거나 track.js 가 막혀도 폼의 숨은 칸이 `from=landing` 을 싣는다
 *   ② 주소 다듬기 · 기관 · 포털 거르기 — `assets/report-start.js` 를 그대로 불러 잽니다
 *   ③ 첫 화면 마크업 — 폼 하나 · 입력칸 · 단추 · 안내 줄 · 채움 단추 하나
 *   ④ 화면 예시 — 리포트 예시 이미지 · 입력 흉내 없음
 *   ⑤ 유입원(`from`) · 방문 열쇠(`vs`)는 `assets/track.js` 한 곳이 붙인다 — 두 번째 장치 없음
 *   ⑥ 자주 묻는 질문 · 마감 제목의 새 글
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** 사람 눈에 보이는 마크업만 — 주석 · `<style>` · `<script>` 를 걷습니다. */
const body = (f) => read(f).replace(/<!--[\s\S]*?-->/g, '').replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/g, '');
const heroOf = (f) => body(f).match(/<header class="hero"[\s\S]*?<\/header>/)?.[0];
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([a-z-]+)(?:="([^"]*)")?/g)].slice(1).map((m) => [m[1], m[2] ?? '']));
/** 주석을 걷은 코드. */
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const RS = require('../assets/report-start.js');
const APP = 'https://app.trops.kr';
const FOREON_HREF = 'https://app.trops.kr/?site=foreon1.com';
const NOSITE_HREF = 'https://app.trops.kr/login?next=%2F%3Fgo%3D%252Forganizations%252F%257Borg%257D%252Fhome';

/** report-start.js 를 가짜 화면에서 돌려 [리포트 받기]를 한 번 누릅니다 — 간 주소 · 폼 그대로 보내기 · 칸의 값. */
function submitOnce(typed, tropsAppHref) {
  const handlers = {};
  const input = { value: typed, focus() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {} };
  const status = { querySelectorAll: () => [] };
  let submitted = 0;
  const form = {
    querySelector: (sel) => (sel === '#report-start-url' ? input : sel === '[data-report-start-msg]' ? status : null),
    addEventListener: (type, fn) => { handlers[type] = fn; },
    submit() { submitted++; },
  };
  const assigned = [];
  const win = { location: { assign: (h) => assigned.push(h) } };
  if (tropsAppHref) win.tropsAppHref = tropsAppHref;
  vm.runInNewContext(read('assets/report-start.js'), { window: win, document: { querySelector: (sel) => (sel === 'form[data-report-start]' ? form : null) } });
  handlers.submit({ preventDefault() {} });
  return { assigned, submitted, value: input.value };
}

/** track.js 를 가짜 랜딩 쪽에서 돌려 앱 주소 꾸미기 손잡이(`tropsAppHref`)를 꺼냅니다. */
function trackHandle(search) {
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } }; };
  const ctx = {
    sessionStorage: store(), localStorage: store(),
    location: { search: search || '', pathname: '/', hostname: 'www.trops.kr', href: 'https://www.trops.kr/' + (search || '') },
    document: { referrer: '', querySelectorAll: () => [], addEventListener() {}, documentElement: { scrollHeight: 0, clientHeight: 0 }, visibilityState: 'visible' },
    navigator: {}, URL, URLSearchParams, Blob, crypto: require('node:crypto').webcrypto,
    fetch: () => ({ catch() {} }), addEventListener() {}, scrollY: 0,
  };
  ctx.window = ctx;
  vm.runInNewContext(read('assets/track.js'), ctx);
  return ctx.tropsAppHref;
}

/* ══ ① 링크 만들기 ═══════════════════════════════════════════════════════════ */

test('🔴 foreon1.com 의 링크가 글자 그대로 같다 — 앱 비로그인 첫 화면 ?site=', () => {
  assert.equal(RS.reportHref('foreon1.com'), FOREON_HREF);
  assert.equal(RS.check('foreon1.com').href, FOREON_HREF);
  assert.equal(RS.reportLoginHref, undefined, '옛 로그인 링크 함수가 남아 있습니다');
});

test('🔴 링크 모양 — 앱 루트 · site 하나 · 로그인 · next · go 없음', () => {
  const url = new URL(RS.reportHref('hanbit.co.kr'));
  assert.equal(url.origin + url.pathname, APP + '/');
  assert.deepEqual([...url.searchParams.keys()], ['site']);
  assert.equal(url.searchParams.get('site'), 'hanbit.co.kr');
  assert.ok(!/\/login|next=|go=/.test(url.href), '로그인으로 바로 갑니다: ' + url.href);
});

test('🔴 track.js 가 유입원 landing 과 방문 열쇠를 붙인다 — 이 방문의 값이 있으면 그 값 · 이미 있으면 그대로', () => {
  const href = trackHandle('')(FOREON_HREF);
  const url = new URL(href);
  assert.equal(url.origin + url.pathname, APP + '/');
  assert.equal(url.searchParams.get('site'), 'foreon1.com');
  assert.equal(url.searchParams.get('from'), 'landing');
  assert.match(url.searchParams.get('vs'), /^[a-z0-9]{8,24}$/);
  assert.equal(new URL(trackHandle('?from=ad-insta')(FOREON_HREF)).searchParams.get('from'), 'ad-insta');
  /* «홈페이지가 없어요»(로그인 링크)도 누를 때 같은 규칙으로 landing 이 실린다. */
  const nosite = new URL(trackHandle('')(NOSITE_HREF));
  assert.equal(nosite.pathname, '/login');
  assert.equal(nosite.searchParams.get('from'), 'landing');
});

test('🔴 누르면 — track.js 가 있으면 꾸민 주소로 · 막혔으면 다듬은 주소로 폼을 그대로 보낸다 · 틀린 주소는 어디로도 가지 않는다', () => {
  const ok = submitOnce('  https://www.Foreon1.com/about?x=1 ', (h) => h + '&from=landing&vs=abc');
  assert.deepEqual(ok, { assigned: [FOREON_HREF + '&from=landing&vs=abc'], submitted: 0, value: '  https://www.Foreon1.com/about?x=1 ' });
  const blocked = submitOnce('  https://www.Foreon1.com/about?x=1 ', null);
  assert.deepEqual(blocked, { assigned: [], submitted: 1, value: 'foreon1.com' });
  const thrown = submitOnce('foreon1.com', () => { throw new Error('x'); });
  assert.deepEqual(thrown, { assigned: [], submitted: 1, value: 'foreon1.com' });
  for (const bad of ['hanbit', 'naver.com', '한빛.com']) {
    assert.deepEqual(submitOnce(bad, (h) => h), { assigned: [], submitted: 0, value: bad }, bad);
  }
});

/* ══ ② 주소 다듬기 · 거르기 ═══════════════════════════════════════════════════ */

test('🔴 넣은 주소를 회사 도메인으로 다듬는다 — 앞뒤 공백 · 스킴 · www · 경로 · 쿼리 · 포트 · 대문자', () => {
  const cases = [
    ['foreon1.com', 'foreon1.com'],
    ['  https://www.Foreon1.com/about?x=1  ', 'foreon1.com'],
    ['http://www2.hanbit.co.kr:8080/ko/index.html#top', 'hanbit.co.kr'],
    ['HANBIT.CO.KR/', 'hanbit.co.kr'],
    ['shop.hanbit.co.kr?lang=en', 'shop.hanbit.co.kr'],
    ['//hanbit.co.kr', 'hanbit.co.kr'],
  ];
  for (const [raw, want] of cases) assert.equal(RS.normalizeSite(raw), want, JSON.stringify(raw));
});

test('🔴 주소 꼴이 아니면 받지 않는다 — 점 없음 · 끝자리 · 빈 칸 · 허용 밖 글자 · 253자 초과', () => {
  for (const raw of ['', '   ', 'hanbit', 'hanbit.c', 'hanbit.123', 'hanbit..com', '-hanbit.com', 'hanbit-.com',
    '한빛.com', 'info@hanbit.co.kr', 'hanbit co.kr', 'a'.repeat(250) + '.com', null, undefined]) {
    assert.equal(RS.normalizeSite(raw), null, JSON.stringify(raw) + ' 를 받았습니다');
    assert.deepEqual(RS.check(raw), { error: 'format' });
  }
});

test('🔴 기관 · 포털 주소는 «portal» 로 거른다', () => {
  for (const raw of ['www.kosme.or.kr', 'moef.go.kr', 'snu.ac.kr', 'kist.re.kr', 'army.mil.kr', 'usda.gov',
    'naver.com', 'blog.naver.com', 'smartstore.naver.com', 'cafe.naver.com', 'daum.net', 'kakao.com', 'google.com',
    'youtube.com', 'instagram.com', 'facebook.com', 'm.facebook.com', 'tistory.com', 'notion.site', 'wixsite.com', 'modoo.at']) {
    assert.deepEqual(RS.check(raw), { error: 'portal' }, raw + ' 를 회사 주소로 받았습니다');
  }
});

test('회사 주소는 거르지 않는다 — 홈페이지 짓기 서비스의 하위 주소도 회사 홈페이지다', () => {
  for (const raw of ['hanbit.co.kr', 'foreon1.com', 'hanbit.modoo.at', 'hanbit.wixsite.com', 'navercorp.com', 'mygov.com']) {
    const r = RS.check(raw);
    assert.ok(!r.error, raw + ' 를 걸렀습니다: ' + r.error);
    assert.equal(r.href, RS.reportHref(RS.normalizeSite(raw)));
  }
});

/* ══ ③ 첫 화면 마크업 ═════════════════════════════════════════════════════════ */

test('🔴 index.html 의 폼은 리포트 입구 하나다 — 앱 비로그인 첫 화면 · GET · 입력칸 · 숨은 유입원 · 단추', () => {
  const page = body('index.html');
  const hero = heroOf('index.html');
  assert.ok(hero, 'index.html 히어로를 찾지 못했습니다');
  const forms = [...page.matchAll(/<form\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(forms.length, 1, 'index.html 의 폼이 ' + forms.length + '개입니다');
  assert.ok(hero.includes(forms[0]), '리포트 입구가 첫 화면 밖에 있습니다');
  const f = attrs(forms[0]);
  assert.equal(f.action, APP + '/');
  assert.equal(f.method, 'get');
  assert.ok('data-report-start' in f && 'novalidate' in f, '폼 표지(data-report-start · novalidate)가 없습니다');

  const form = hero.match(/<form\b[\s\S]*?<\/form>/)[0];
  assert.ok(form.includes('<label class="sr" for="report-start-url">홈페이지 주소</label>'), '숨은 라벨 «홈페이지 주소» 가 없습니다');
  const all = [...form.matchAll(/<input\b[^>]*>/g)].map((m) => attrs(m[0]));
  const inputs = all.filter((a) => a.type !== 'hidden');
  assert.equal(inputs.length, 1, '입력칸이 하나가 아닙니다');
  /* 자바스크립트가 없을 때도 앱이 유입원을 센다 — 숨은 칸 하나(from=landing) · 넣은 주소 다음. */
  assert.deepEqual(all.filter((a) => a.type === 'hidden'), [{ type: 'hidden', name: 'from', value: 'landing' }]);
  assert.ok(all.findIndex((a) => a.name === 'site') < all.findIndex((a) => a.name === 'from'), '숨은 칸이 주소 칸보다 앞에 있습니다');
  /* 그대로 제출하면 이 주소다(GET · 칸 순서대로). */
  const noJs = f.action + '?' + new URLSearchParams(all.map((a) => [a.name, a.name === 'site' ? 'foreon1.com' : a.value])).toString();
  assert.equal(noJs, FOREON_HREF + '&from=landing');
  assert.deepEqual(
    Object.fromEntries(['id', 'name', 'type', 'inputmode', 'autocomplete', 'autocapitalize', 'spellcheck', 'placeholder'].map((k) => [k, inputs[0][k]])),
    { id: 'report-start-url', name: 'site', type: 'text', inputmode: 'url', autocomplete: 'url', autocapitalize: 'none', spellcheck: 'false', placeholder: '예: hanbit.co.kr' });
  const buttons = [...form.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)];
  assert.equal(buttons.length, 1, '단추가 하나가 아닙니다');
  const b = attrs('<button' + buttons[0][1] + '>');
  assert.equal(b.type, 'submit');
  assert.equal(b.class, 'btn');
  assert.equal(b['data-track'], 'hero-report-start');
  assert.equal(buttons[0][2].trim(), '리포트 받기');
});

test('🔴 첫 화면 글 — 꼬리표 · 한 줄 · 안내 줄 둘(처음엔 숨김 · role=status)', () => {
  const hero = heroOf('index.html');
  assert.match(hero, /<p class="report-start-badge">(?:<svg[\s\S]*?<\/svg>)?한국무역보험공사 공개 자료로 1분 점검<\/p>/);
  assert.match(hero, /<p class="report-start-q"[^>]*>홈페이지 주소만 넣으면 <b>우리 회사 수출 리포트<\/b>가 나와요<\/p>/);
  const status = hero.match(/<p\b[^>]*role="status"[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(status, '안내 줄(role=status)이 없습니다');
  const spans = [...status[1].matchAll(/<span data-reason="([a-z]+)" hidden>([^<]+)<\/span>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(spans, [
    ['format', '주소를 다시 확인해 주세요. 예: hanbit.co.kr'],
    ['portal', '기관 · 포털 말고 우리 회사 홈페이지 주소를 넣어 주세요.'],
  ], '안내 줄 둘이 다르거나 처음부터 보입니다');
  /* 대표 글 규칙 — 새로 쓴 글에 «» · 긴 줄표가 없다. */
  const block = hero.match(/<div class="report-start">[\s\S]*?<\/form>[\s\S]*?<\/div>/)[0].replace(/<[^>]+>/g, '');
  assert.ok(!/[«»—]/.test(block), '리포트 입구 글에 «» 또는 — 가 있습니다');
});

test('🔴 첫 화면의 채움 단추는 [리포트 받기] 하나다 — 시작 버튼은 테두리 단추로 남는다', () => {
  const hero = heroOf('index.html');
  const filled = [...hero.matchAll(/<(?:a|button)\b[^>]*class="btn(?: [^"]*)?"[^>]*>/g)].map((m) => m[0]);
  assert.equal(filled.length, 1, '첫 화면의 채움 단추가 ' + filled.length + '개입니다');
  assert.ok(filled[0].includes('data-track="hero-report-start"'), '채움 단추가 [리포트 받기] 가 아닙니다');
  assert.ok(hero.includes('<a class="btn-2" href="https://app.trops.kr/" data-track="hero-start">TROPS 시작하기</a>'),
    '시작 버튼(hero-start)이 테두리 단추 · 앱 루트가 아닙니다');
  assert.ok(hero.includes('<a href="' + NOSITE_HREF + '" data-track="hero-report-nosite">홈페이지가 없어요</a>'),
    '«홈페이지가 없어요» 링크가 다릅니다');
});

test('index.html 이 입구 스크립트 · 스타일을 싣고 영문은 싣지 않는다', () => {
  const ko = read('index.html');
  assert.ok(ko.includes('<script defer src="/assets/report-start.js"></script>'));
  assert.ok(ko.includes('<link rel="stylesheet" href="/assets/report-start.css">'));
  assert.ok(ko.includes(".hero .report-start,.hero .cta"), '첫 화면 등장 움직임이 입구를 고르지 않습니다');
  const en = read('en.html');
  assert.ok(!en.includes('report-start'), 'en.html 은 이번에 바꾸지 않습니다');
});

/* ══ ④ 화면 예시 ═════════════════════════════════════════════════════════════ */

test('🔴 화면 예시는 리포트 예시 이미지다 — 크기 비율 · 대체글 · 설명', () => {
  const fig = heroOf('index.html').match(/<figure class="appfig static-workspace" id="demo">[\s\S]*?<\/figure>/)?.[0];
  assert.ok(fig, '화면 예시(figure#demo)가 없습니다');
  const img = attrs(fig.match(/<img\b[^>]*>/)[0]);
  assert.equal(img.src, '/assets/img/report-example.png');
  assert.equal(img.width, '1200');
  assert.equal(img.height, '860');
  assert.equal(img.alt, 'TROPS 우리 회사 수출 리포트 예시: 예시 회사(한빛모빌리티) 홈페이지로 만든 리포트 첫 화면');
  assert.match(fig, /<figcaption>예시 회사 리포트 · 실제 리포트는 넣은 홈페이지 주소로 만들어져요<\/figcaption>/);
  assert.ok(!fig.includes('workspace-demo'), '걷은 «요청 예시» 상자가 남아 있습니다');
  assert.ok(!body('index.html').includes('workspace-overview.png'), 'index.html 이 옛 화면 사진을 싣습니다');

  /* 이미지 파일이 실제로 있고 속성 비율과 같다(2배 크기). */
  const png = fs.readFileSync(path.join(ROOT, 'assets', 'img', 'report-example.png'));
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  assert.equal(w * 860, h * 1200, `이미지 ${w}x${h} 가 1200x860 비율이 아닙니다`);
  /* 영문이 쓰는 옛 사진은 남아 있다. */
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'img', 'workspace-overview.png')));
  assert.ok(read('en.html').includes('src="/assets/img/workspace-overview.png"'));
});

test('🔴 workspace-demo.js 는 «요청 예시» 상자가 없는 페이지에서 멈추지 않는다', () => {
  const listeners = [];
  const ctx = {
    matchMedia: () => ({ matches: false, addEventListener: (t, fn) => listeners.push(fn) }),
    document: { querySelector: () => null },
    IntersectionObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  };
  vm.runInNewContext(read('assets/workspace-demo.js'), ctx);
  for (const fn of listeners) fn({ matches: true });
});

/* ══ ⑤ 유입원 · 방문 열쇠는 track.js 한 곳 ══════════════════════════════════════ */

test('🔴 리포트 이동은 track.js 의 손잡이로 from · vs 를 붙인다 — 두 번째 장치가 없다', () => {
  const rs = code('assets/report-start.js');
  assert.ok(rs.includes('window.tropsAppHref'), 'report-start.js 가 track.js 손잡이를 쓰지 않습니다');
  assert.ok(!/searchParams|[?&]from=|[?&]vs=|'vs'|sessionStorage|trops_vs/.test(rs), 'report-start.js 가 from · vs 를 스스로 붙입니다');

  const tr = code('assets/track.js');
  assert.match(tr, /window\.tropsAppHref = function \(href\) \{\s*return decorateAppHref\(href\) \|\| href;\s*\};/);
  const listener = tr.match(/document\.addEventListener\('click', function \(e\) \{\s*var a = [\s\S]*?\}, true\);/)?.[0] || '';
  assert.ok(listener.includes('decorateAppHref('), '링크 리스너가 같은 함수를 쓰지 않습니다');
  assert.equal((tr.match(/function decorateAppHref\(/g) || []).length, 1);
});

/* ══ ⑥ 자주 묻는 질문 · 마감 제목 ══════════════════════════════════════════════ */

const START_ANSWER = 'app.trops.kr 첫 화면에 우리 회사 홈페이지 주소를 넣으면 우리 회사 수출 리포트가 나와요. 가입하면 바로 리포트가 만들어지고, 거기서 첫 수출 거래를 시작해요. 홈페이지가 없어도 시작할 수 있어요.';

test('🔴 «TROPS는 어떻게 시작하나요?» 답이 리포트 입구를 말한다 — 본문 · 구조화 데이터 둘 다', () => {
  const html = read('index.html');
  assert.ok(html.includes('<details><summary>TROPS는 어떻게 시작하나요?</summary><div class="a"><p>' + START_ANSWER + ' <a href="https://app.trops.kr/">TROPS 시작하기 →</a></p></div></details>'),
    '본문 답이 다르거나 «TROPS 시작하기 →» 링크가 빠졌습니다');
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const faq = ld['@graph'].find((n) => n['@type'] === 'FAQPage');
  const q = faq.mainEntity.find((e) => e.name === 'TROPS는 어떻게 시작하나요?');
  assert.equal(q.acceptedAnswer.text, START_ANSWER + ' TROPS 시작하기 →');
  assert.ok(!/필요한 업무를 선택/.test(body('index.html')), '옛 답이 남아 있습니다');
});

test('마감 제목이 리포트 입구를 말한다 — 시작 버튼 · 집계 이름은 그대로', () => {
  const fin = body('index.html').match(/<section class="fin"[\s\S]*?<\/section>/)?.[0];
  assert.ok(fin, '마감 CTA 가 없습니다');
  assert.ok(fin.includes('<h2>홈페이지 주소로 우리 회사 수출 리포트부터 받아 보세요</h2>'));
  assert.ok(fin.includes('<a class="btn" href="https://app.trops.kr/" data-track="final-start">TROPS 시작하기</a>'));
  assert.ok(!body('index.html').includes('지금 필요한 수출 업무부터 시작하세요'));
});
