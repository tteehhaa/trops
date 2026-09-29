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

test('🔴 스위치는 site.config.json 한 곳이고 운영 기본값은 false 다', () => {
  const pa = JSON.parse(read('site.config.json')).pilotApply;
  assert.ok(pa, 'site.config.json 에 pilotApply 가 없습니다');
  /*
   * ⛔ **운영 스위치를 켜는 것은 순서의 마지막입니다** — 앱 0153·0154 → 앱 배포 → 앱 스위치 → 처리방침 시행 →
   *    여기 true → 합성 신청(docs/design/landing-v3/pending-app.md 「운영 순서」). 방침보다 먼저 켜면
   *    적지 않은 개인정보를 받게 됩니다(계약 0-1). 켜는 날 이 단정을 **함께** 고치십시오.
   */
  assert.strictEqual(pa.productionEnabled, false, '운영 스위치가 켜져 있습니다 — 운영 순서를 마쳤다면 이 단정을 함께 고치십시오');
  assert.strictEqual(pa.productionEndpoint, 'https://app.trops.kr/api/pilot-apply');
  assert.strictEqual(typeof pa.previewEnabled, 'boolean');
});

test('🔴 페이지가 스위치를 «토큰으로» 읽고, 운영 주소를 trops.kr 두 이름으로만 본다', () => {
  for (const key of ['productionEnabled', 'productionEndpoint', 'previewEnabled', 'previewEndpoint']) {
    assert.ok(script.includes("'{{pilotApply." + key + "}}'"), key + ' 를 토큰(따옴표 안)으로 읽지 않습니다');
  }
  assert.ok(script.includes('/^(www\\.)?trops\\.kr$/.test(location.hostname)'), '운영 주소 판정이 바뀌었습니다');
  assert.ok(!/enabled:\s*true\b/.test(script), '스위치를 스크립트에 손으로 켜 두었습니다');
  const onProd = /^(www\.)?trops\.kr$/;
  for (const [host, want] of [['trops.kr', true], ['www.trops.kr', true], ['trops.kr.evil.com', false],
    ['trops-git-feat-landing-v3-teheranroai-9246s-projects.vercel.app', false], ['localhost', false]]) {
    assert.strictEqual(onProd.test(host), want, host + ' 의 판정이 틀렸습니다');
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
  for (const piece of ['요청하신 업무', '소개 코드', '시범 참여 선정과 초대 안내·연락', '회사 장부 미리 채움',
    '가입 뒤 첫 화면에 요청하신 업무 채움', '소개 수 집계', '신청일부터 1년', '회원 정보로 옮겨', '동의를 철회하시면 바로 삭제']) {
    assert.ok(cons.includes(piece), '폼 동의 블록에 없습니다: ' + piece);
    assert.ok(row.includes(piece), '방침 시범 신청 행에 없습니다: ' + piece);
  }
  /* 영문 방침도 같은 자리를 갖는다 — 「one place only」 는 더는 사실이 아니다. */
  const en = read('en-privacy.html').replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(en.includes('<th scope="row">Early access application'), 'en-privacy.html §02 에 시범 신청 행이 없습니다');
  assert.ok(!en.includes('in one place only'), 'en-privacy.html §01 이 아직 「one place only」입니다');
  assert.ok(!ko.includes('출시 알림 신청</a> 한 자리입니다'), 'privacy.html §01 이 아직 「한 자리」입니다');
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
