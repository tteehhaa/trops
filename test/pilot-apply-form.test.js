'use strict';
/*
 * pilot-apply-form.test.js — 홈 「먼저 사용해 보기」 시범 참여 신청 폼 〔신설 2026-09-29 · 랜딩 v3〕
 *
 * 🔴 이 검사가 지키는 것은 **세 갈래**입니다.
 *    ① 폼이 앱 계약(trops_a doc/self15/pilot-apply-api.md · self15 28·29)의 **키 그대로** 보낸다 —
 *      칸 이름과 선택지 값이 하나라도 갈리면 앱이 400 으로 돌려보냅니다(목록 밖 값은 조용히 버리지 않습니다).
 *    ② **꺼짐이 기본**이다 — 마크업은 잠긴 채로 오고, 운영 스위치는 site.config.json 한 줄이며 기본 false 다.
 *    ③ 소개를 «순번 약속»으로 말하지 않는다 — 앱은 소개로 순번을 자동으로 바꾸지 않습니다(계약 2-6).
 *
 * ⚠️ 브라우저를 띄우지 않습니다 — 재는 것은 **소스의 사실**입니다. 응답별 화면(201 · 400 · 409 · 429 · 503)은
 *    사람이 확인했습니다(2026-09-29 · 응답을 가로챈 브라우저 대조).
 * ⚠️ 형제 저장소(../trops_a)가 있으면 선택지 값을 **앱의 어휘 정본**(lib/pilot/vocab.ts)과도 맞댑니다 —
 *    앱 검사들이 이 저장소를 읽는 것과 같은 방식입니다. 없으면 그 한 검사만 건너뜁니다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html');
/** 주석을 걷은 원문 — 인수인계 메모의 인용이 단정을 대신하지 않게 합니다. */
const src = html.replace(/<!--[\s\S]*?-->/g, '');

const formHtml = (src.match(/<form class="f" id="applyForm"[\s\S]*?<\/form>/) || [])[0] || '';
const script = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');

/* 계약 2-1 의 키 — 필수 다섯 + 봇 방지 두 칸 + 판 이름, 그리고 이 폼이 싣는 선택 둘. */
const CONTRACT_KEYS = [
  'company_name', 'email', 'industry', 'region', 'consents.collection',
  'website', 'elapsed_ms', 'notice_version',
  'requested_work', 'referral_code',
];
/* 계약 2-1 의 선택지 — 순서도 화면 순서입니다. */
const INDUSTRY = ['machinery', 'electronics', 'cosmetics', 'food', 'chemicals', 'other'];
const REGION = ['capital', 'chungcheong', 'jeolla', 'gyeongsang', 'gangwon_jeju'];

const optionValues = (name) => {
  const sel = (formHtml.match(new RegExp('<select name="' + name + '">([\\s\\S]*?)</select>')) || [])[1] || '';
  return [...sel.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
};

/* ══ ① 계약의 키 그대로 ══════════════════════════════════════════════ */

test('🔴 폼의 칸 이름이 계약의 요청 키 그대로다', () => {
  assert.ok(formHtml, '신청 폼을 찾지 못했습니다 — 검사가 헛돕니다');
  const names = [...formHtml.matchAll(/\sname="([^"]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual([...names].sort(), [...CONTRACT_KEYS].sort(),
    '칸 이름이 계약과 다릅니다 — 앱은 모르는 키를 받지 않고, 빠진 필수 키는 400 입니다');
});

test('🔴 업종 6 · 지역 5 선택지 값이 계약의 키다', () => {
  assert.deepStrictEqual(optionValues('industry'), INDUSTRY, '업종 선택지 값이 계약과 다릅니다');
  assert.deepStrictEqual(optionValues('region'), REGION, '지역 선택지 값이 계약과 다릅니다');
});

test('⚠️ 선택지 값이 앱의 어휘 정본(lib/pilot/vocab.ts)과 같다 — 형제 저장소가 있을 때', (t) => {
  const vocab = path.join(ROOT, '..', 'trops_a', 'lib', 'pilot', 'vocab.ts');
  if (!fs.existsSync(vocab)) { t.skip('형제 저장소가 없어 건너뜁니다 — 이 실행의 green 은 앱과 같다는 뜻이 아닙니다'); return; }
  const v = fs.readFileSync(vocab, 'utf8');
  const keysOf = (name) => {
    const body = (v.match(new RegExp('export const ' + name + ' = \\{([\\s\\S]*?)\\n\\} as const')) || [])[1] || '';
    return [...body.matchAll(/^\s{2}([a-z_]+):/gm)].map((m) => m[1]);
  };
  assert.deepStrictEqual(keysOf('PILOT_INDUSTRY_GROUPS'), INDUSTRY, '앱의 업종 묶음이 바뀌었습니다 — 폼과 이 표를 함께 고치십시오');
  assert.deepStrictEqual(keysOf('PILOT_REGION_GROUPS'), REGION, '앱의 지역 묶음이 바뀌었습니다 — 폼과 이 표를 함께 고치십시오');
});

test('🔴 보내는 본문이 동의를 `consents.collection` 으로 묶고 봇 방지 두 칸을 싣는다', () => {
  assert.match(script, /consents:\s*\{\s*collection:/, '동의를 consents 객체로 묶지 않습니다(계약 2-1)');
  assert.match(script, /website:\s*form\.elements\.website\.value/, 'website(숨은 칸)를 그대로 싣지 않습니다');
  assert.match(script, /elapsed_ms:/, 'elapsed_ms 를 싣지 않습니다');
  assert.match(script, /3200\s*-\s*\(Date\.now\(\)\s*-\s*openedAt\)/, '3초 전 제출을 기다려 보내는 장치가 없습니다 — 앱이 bot 으로 봅니다');
  assert.match(script, /'Content-Type':\s*'application\/json'/, 'JSON 으로 보내지 않습니다(계약 1)');
});

test('🔴 201 이 아니면 완료 화면을 띄우지 않는다 — 저장 못 한 신청을 «접수됐다»고 하지 않는다', () => {
  assert.match(script, /r\.status === 201 && r\.data && r\.data\.ok\) \{ showDone\(/, '완료 화면이 201·ok 에만 묶여 있지 않습니다');
  for (const status of ['400', '403', '409', '413', '429', '503']) {
    assert.ok(new RegExp('status === ' + status).test(script), status + ' 응답의 문구 갈래가 없습니다');
  }
});

/* ══ ② 꺼짐이 기본 ═══════════════════════════════════════════════════ */

test('🔴 마크업의 기본이 «꺼짐»이다 — 스크립트가 없으면 아무것도 보내지 않는다', () => {
  assert.match(formHtml, /<fieldset class="fs" id="applyFields" disabled>/, '칸 묶음이 잠긴 채로 오지 않습니다');
  assert.match(formHtml, /<button class="btn" type="submit" id="applySubmit"[^>]*\shidden>/, '제출 버튼이 숨은 채로 오지 않습니다');
  assert.match(formHtml, /<p class="note" id="applyOff">/, '꺼졌을 때의 안내 문구가 보이는 채로 오지 않습니다');
  assert.ok(!/<p class="note" id="applyOff"[^>]*hidden/.test(formHtml), '안내 문구가 숨은 채로 옵니다');
});

test('🔴 스위치는 site.config.json 한 곳이고 운영에서 켜져 있다 — 켜는 커밋 이후', () => {
  const pa = JSON.parse(read('site.config.json')).pilotApply;
  assert.ok(pa, 'site.config.json 에 pilotApply 가 없습니다');
  /*
   * ⛔ **운영 스위치를 켜는 것은 순서의 마지막입니다** — 앱 0153·0154 → 앱 배포 → 앱 스위치 → 처리방침 시행 →
   *    여기 true → 합성 신청(docs/design/landing-v3/pending-app.md 「운영 순서」). 방침보다 먼저 켜면
   *    적지 않은 개인정보를 받게 됩니다(계약 0-1). 켜는 날 이 단정을 **함께** 고치십시오.
   */
  /*
   * 🔄 **운영에서 켰습니다** — 이 단정은 「켜는 커밋」(feat(apply): 운영에서 시범 참여 신청 폼을 켠다)과 함께 뒤집혔습니다.
   *    ⚠️ 폼만 끄려면 **그 커밋 하나를 되돌리십시오**(git revert) — 이 단정도 함께 false 로 돌아갑니다
   *       (docs/design/landing-v3/pending-app.md 「되돌리는 법」 A).
   */
  assert.strictEqual(pa.productionEnabled, true, '운영 스위치가 꺼져 있습니다 — 끈 것이면 「켜는 커밋」을 되돌렸는지 보십시오');
  assert.strictEqual(pa.productionEndpoint, 'https://app.trops.kr/api/pilot-apply');
  assert.strictEqual(typeof pa.previewEnabled, 'boolean');
});

test('🔴 페이지가 스위치를 «토큰으로» 읽고, 운영 주소를 trops.kr 두 이름으로만 본다', () => {
  for (const key of ['productionEnabled', 'productionEndpoint', 'previewEnabled', 'previewEndpoint']) {
    assert.ok(script.includes("'{{pilotApply." + key + "}}'"), key + ' 를 토큰(따옴표 안)으로 읽지 않습니다');
  }
  assert.ok(script.includes('/^(www\\.)?trops\\.kr$/.test(location.hostname)'), '운영 주소 판정이 바뀌었습니다');
  assert.ok(!/enabled:\s*true\b/.test(script), '스위치를 스크립트에 손으로 켜 두었습니다');
  /*
   * 🔴 **운영 주소 둘 — `https://trops.kr` · `https://www.trops.kr`** 〔2026-09-29 · 대표 확인〕.
   *    페이지는 주소 전체가 아니라 `location.hostname` 을 봅니다 — 그래서 아래도 브라우저처럼 URL 을 풀어
   *    호스트 이름을 꺼낸 뒤 잽니다. 쿼리(`?ref=`)·조각(`#apply`)·경로가 붙어도 판정이 같아야 합니다.
   * ⚠️ `http://` 로 열어도 운영으로 잡힙니다(호스트가 같습니다) — «꺼짐» 쪽으로 기우는 것이라 안전합니다.
   *    Vercel 은 http 를 https 로 돌립니다.
   */
  const onProd = (url) => /^(www\.)?trops\.kr$/.test(new URL(url).hostname);
  for (const [url, want] of [
    ['https://trops.kr', true],
    ['https://www.trops.kr', true],
    ['https://trops.kr/', true],
    ['https://www.trops.kr/?ref=TR-3NV8QD#apply', true],
    ['http://www.trops.kr/', true],
    ['https://app.trops.kr/', false],
    ['https://trops.kr.evil.com/', false],
    ['https://trops-git-feat-landing-v3-teheranroai-9246s-projects.vercel.app/', false],
    ['https://main-web-page-git-feat-landing-v3-teheranroai-9246s-projects.vercel.app/', false],
    ['http://localhost:8765/index.html', false],
  ]) {
    assert.strictEqual(onProd(url), want, url + ' 의 운영 판정이 틀렸습니다');
  }
});

/* ══ ②-b 동의 블록 ↔ 처리방침 — 같은 말을 한다 ═══════════════════════ */

test('🔴 폼의 동의 블록과 방침 §02 시범 신청 행이 같은 항목·목적·보관을 말한다', () => {
  /*
   * 🔴 계약 0-1: 「요청하신 업무」는 앱 동의 기록의 범위 코드에 실리지 않아 **동의 문구가 글로 적어야** 합니다.
   *    그리고 contact.html 과 같은 규칙으로, 화면이 약속한 것과 방침이 적은 것이 갈리면 안 됩니다.
   * ⚠️ 문장 전체가 아니라 «뜻의 조각»을 맞댑니다 — 동의 블록은 짧고 방침 칸은 줄바꿈으로 나뉩니다.
   */
  const cons = (formHtml.match(/<div class="fld cons">[\s\S]*?<\/dl>/) || [])[0] || '';
  const ko = read('privacy.html').replace(/<!--[\s\S]*?-->/g, '');
  const row = (ko.match(/<th scope="row">먼저 사용해 보기 &middot; 시범 참여 신청[\s\S]*?<\/tr>/) || [])[0] || '';
  assert.ok(cons, '폼의 동의 블록을 찾지 못했습니다');
  assert.ok(row, 'privacy.html §02 에 시범 참여 신청 행이 없습니다 — 폼을 켜기 전에 방침이 먼저입니다(계약 0-1)');
  for (const piece of ['요청하신 업무', '소개 코드', '시범 참여 선정과 초대 안내·연락',
    '가입 뒤 첫 화면에 요청하신 업무 채움', '소개 수 집계', '신청일부터 1년', '회원 정보로 옮겨', '동의를 철회하시면 바로 삭제',
    '접수 메일', '먼저 챙길 것 요약', '회사 담당자에게 알림 메일', '들어오신 경로', '신청 경로 집계']) {
    assert.ok(cons.includes(piece), '폼 동의 블록에 없습니다: ' + piece);
    assert.ok(row.includes(piece), '방침 시범 신청 행에 없습니다: ' + piece);
  }
  /*
   * ⚠️ 같은 목적의 두 표기 — 폼은 「회사 정보 미리 채움」, 방침은 아직 「회사 장부 미리 채움」입니다
   *    〔2026-10-04 · 대표 결정 — 화면의 「장부」는 앱과 같은 기준으로 바꾸고 방침 2곳은 다음 개정 때 같이〕.
   *    방침을 개정하면 이 쌍을 지우고 「회사 정보 미리 채움」을 위 목록으로 되돌립니다.
   */
  assert.ok(cons.includes('회사 정보 미리 채움'), '폼 동의 블록에 없습니다: 회사 정보 미리 채움');
  assert.ok(row.includes('회사 장부 미리 채움') || row.includes('회사 정보 미리 채움'),
    '방침 시범 신청 행에 없습니다: 회사 정보 미리 채움(개정 전 표기 「회사 장부 미리 채움」)');
  /*
   * 🔴 메일을 보내면 이메일 주소 · 회사명 · 담당자 이름 · 문의·요청 내용이 미국의 Resend 로 넘어갑니다 — 국외이전 표에 그 행이 있어야 합니다
   *    〔2026-09-30 · 대표 결정 · 수탁 표에만 있고 국외이전 표에 없던 빈칸〕.
   */
  assert.match(ko, /<th scope="row">Resend, Inc\.<\/th>\s*<td>이메일, 회사명, 담당자 이름, 문의·요청 내용<\/td>\s*<td>미국<\/td>/,
    'privacy.html §04 국외이전 표에 Resend(미국) 행이 없습니다');
  /* 영문 방침도 같은 자리를 갖는다 — 「one place only」 는 더는 사실이 아니다. */
  const en = read('en-privacy.html').replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(en.includes('<th scope="row">Early access application'), 'en-privacy.html §02 에 시범 신청 행이 없습니다');
  assert.ok(!en.includes('in one place only'), 'en-privacy.html §01 이 아직 「one place only」입니다');
  assert.match(en, /<th scope="row">Resend, Inc\.<\/th>\s*<td>Email address, company name, contact name, and the content of your inquiry or request<\/td>\s*<td>United States<\/td>/,
    'en-privacy.html §04 cross-border 표에 Resend 행이 없습니다');
  assert.ok(!ko.includes('출시 알림 신청</a> 한 자리입니다'), 'privacy.html §01 이 아직 「한 자리」입니다');
});

test('🔴 동의 문구의 판 이름이 처리방침 시행일과 같은 날이다 — pilot-apply-YYYY-MM-DD', () => {
  /*
   * 🔴 앱은 `notice_version` 을 동의 기록에 그대로 적습니다(계약 0-2). 판 이름이 방침 시행일과 다르면, 나중에
   *    「그 사람이 동의한 문구가 어느 판이었는가」를 방침 이력(§07)에서 찾을 수 없습니다.
   * ⚠️ 날짜는 `node scripts/set-release-date.js YYYY-MM-DD` 가 방침 네 자리와 함께 바꿉니다.
   * ⛔ 초안 꼴(`draft`)로 되돌리지 마십시오 — 운영에서 받는 동의가 초안 판으로 기록됩니다.
   */
  const v = (formHtml.match(/name="notice_version" value="([^"]+)"/) || [])[1] || '';
  const m = v.match(/^pilot-apply-(\d{4})-(\d{2})-(\d{2})(?:-[2-9])?$/);   // -N = 같은 날 N 번째 판(set-release-date --rev)
  assert.ok(m, 'notice_version 이 pilot-apply-YYYY-MM-DD(-N) 꼴이 아닙니다: ' + v);
  const head = read('privacy.html').match(/개정 &middot; 시행 (\d{4})년 (\d{1,2})월 (\d{1,2})일/);
  assert.ok(head, 'privacy.html 머리의 개정 시행일을 읽지 못했습니다');
  assert.deepStrictEqual([+m[1], +m[2], +m[3]], [+head[1], +head[2], +head[3]],
    '판 이름의 날짜(' + v + ')가 방침 시행일과 다릅니다 — scripts/set-release-date.js 로 함께 맞추십시오');
});

/* ══ ②-c 들어오신 경로 · 신청 접수 계측 · /contact ══════════════════ */

test('🔴 신청에 들어오신 경로(acquisition)를 계약의 키로만 싣는다 — 채널 코드는 ref, 소개 코드와 섞지 않는다', () => {
  /*
   * 〔2026-09-30 · 대표 결정 「어느 채널(?from=, utm, ref)로 와서 신청했는지」〕 — 앱 계약 2-1 `acquisition` 은
   * utm_source · utm_medium · utm_campaign · utm_term · utm_content · ref · landing_path 일곱 키만 받습니다.
   */
  const fn = (script.match(/function acquisition\(\)\{[\s\S]*?\n  \}/) || [])[0] || '';
  assert.ok(fn, 'acquisition() 을 찾지 못했습니다');
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    assert.ok(fn.includes("'" + k + "'"), k + ' 를 싣지 않습니다');
  }
  assert.match(fn, /out\.ref = /, '채널 코드를 acquisition.ref 로 싣지 않습니다');
  assert.match(fn, /tropsVisit\(\)\.from/, '채널 코드를 track.js 의 방문 값에서 읽지 않습니다');
  assert.match(fn, /out\.landing_path = /, 'landing_path 를 싣지 않습니다');
  assert.ok(!/referral_code|fRef/.test(fn), '소개 코드를 acquisition 에 섞었습니다 — 그 값은 referral_code 입니다');
  const keys = [...fn.matchAll(/out(?:\.([a-z_]+)|\[k\])/g)].map((m) => m[1]).filter(Boolean);
  for (const k of keys) {
    assert.ok(['ref', 'landing_path'].includes(k), '계약에 없는 키를 싣습니다: ' + k);
  }
  assert.match(script, /if \(acq\) body\.acquisition = acq;/, '본문에 acquisition 을 싣지 않습니다');
});

test('🔴 신청 접수 계측(apply-success)은 완료 화면(201)에서만 한 번 부른다', () => {
  const calls = script.match(/tropsEvent\('apply-success'\)/g) || [];
  assert.strictEqual(calls.length, 1, 'apply-success 를 부르는 자리가 ' + calls.length + '곳입니다');
  const done = (script.match(/function showDone\(data\)\{[\s\S]*?\n  \}/) || [])[0] || '';
  assert.ok(done.includes("tropsEvent('apply-success')"), 'apply-success 가 완료 화면(showDone) 밖에 있습니다');
  const track = read('assets/track.js');
  assert.match(track, /var PAGE_EVENTS = \{ 'apply-success': 'apply' \};/, 'track.js 가 받는 페이지 사건 표가 바뀌었습니다');
  assert.match(track, /sendApp\(\{ kind: 'click', label: label, section: PAGE_EVENTS\[label\] \}\)/,
    'apply-success 를 클릭과 같은 모양으로 보내지 않습니다 — kind 는 두 값(pageview · click) 그대로여야 합니다');
});

test('⚠️ 푸터 「문의 · 교육 · 파트너」가 /contact 로 간다 — 랜딩에서 문의 폼으로 가는 길', () => {
  const footer = (src.match(/<footer[\s\S]*?<\/footer>/) || [])[0] || '';
  assert.match(footer, /<a href="\/contact" data-track="footer-contact">문의 · 교육 · 파트너<\/a>/,
    '푸터에서 /contact 로 가는 링크가 없습니다');
});

/* ══ ③ 소개는 순번 약속이 아니다 ═════════════════════════════════════ */

test('🔴 소개 문구가 순번을 약속하지 않는다 — 「소개해 주시면 먼저 연락드립니다」 한 벌', () => {
  for (const bad of ['순서가 앞당겨', '세 칸씩', '순번이 올라', '우선 초대']) {
    assert.ok(!html.replace(/<!--[\s\S]*?-->/g, '').includes(bad), '순번을 약속하는 문구가 있습니다: ' + bad);
  }
  assert.ok(src.includes('소개해 주시면 먼저 연락드립니다'), '통일한 소개 문구가 사라졌습니다');
});

test('⚠️ 소개 코드는 계약 모양일 때만 담는다 — 영문·숫자·하이픈 4~32자', () => {
  assert.ok(script.includes('/^[A-Za-z0-9-]{4,32}$/.test(rp)'), '소개 코드 모양 검사가 바뀌었습니다');
  const ok = /^[A-Za-z0-9-]{4,32}$/;
  assert.ok(ok.test('TR-3NV8QD') && ok.test('tr-7kq2xm'));
  assert.ok(!ok.test('abc') && !ok.test('회사이름') && !ok.test('TR 3NV8QD'));
});
