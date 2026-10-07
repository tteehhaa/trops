'use strict';
/*
 * pilot-apply-form.test.js — 홈 «신청하기»(#join · 실증 참여) 〔신설 2026-09-29 · 🔄 2026-10-05 입구 통합 · 🔄 2026-10-06 출시 소식 걷음〕
 *
 * 🔄 **2026-10-06 · 대표 결정 「출시 소식 받기 빼자」** — #join 은 실증 참여 하나만 받습니다. 출시 알림은 /contact 의
 *    「출시 알림」 신청이 그대로 받습니다. 종전 이 파일이 재던 출시 소식 폼(#joinNotifyForm · /api/leads)의 검사는 걷고,
 *    «되살아나지 않는다» 한 가지만 남겼습니다.
 *
 * 🔄 **2026-10-05 · 대표 지시 「랜딩 신청 입구를 지금 하나로 합쳐줘」** — 옛 신청 폼(#apply)과 「실증 신청」 · 「가입하기」
 *    두 버튼을 걷고, 신청 버튼을 전부 「신청하기」 → #join 으로 모았습니다. #join 은 오늘부터 섭니다.
 *    종전 이 파일은 옛 폼(#applyForm · 2판 · 업종 6 · 지역 5)을 쟀습니다 — 그 폼이 사라져 대상이 #join 으로 옮겼습니다.
 *
 * 🔴 이 검사가 지키는 것은 **네 갈래**입니다.
 *    ① 입구가 하나다 — 신청 버튼은 전부 #join, 옛 폼·옛 버튼 0.
 *    ② 폼이 앱 계약(trops_a lib/pilot/validate.ts 3판)의 **키 그대로** 보낸다.
 *    ③ **새 칸은 방침 2차 개정 시행일부터** — 그 칸은 마크업에서 숨김·잠김으로 오고, 보내는 본문도 그날부터만 싣는다.
 *       지금 받는 칸은 지금 시행 중인 방침에 적힌 것뿐이다(근거는 아래 TODAY 표의 주석).
 *    ④ **꺼짐이 기본** — 제출 버튼은 숨긴 채로 오고, 운영 스위치는 site.config.json 한 줄이다.
 *
 * ⚠️ 브라우저를 띄우지 않습니다 — 재는 것은 **소스의 사실**입니다.
 * ⚠️ 형제 저장소(../trops_a)가 있으면 어휘 · 시행일을 **앱의 정본**과도 맞댑니다. 없으면 그 검사만 건너뜁니다.
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

const joinHtml = (src.match(/<section id="join"[\s\S]*?<\/section>/) || [])[0] || '';
const pilotHtml = (joinHtml.match(/<form class="f" id="joinPilotForm"[\s\S]*?<\/form>/) || [])[0] || '';
const script = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const joinScript = (script.match(/\/\* ══════════════ 신청하기 · 실증 참여[\s\S]*?\}\)\(\);/) || [])[0] || '';

const namesIn = (h) => [...h.matchAll(/\sname="([^"]+)"/g)].map((m) => m[1]);
/** `data-from-rev2` 가 붙은 덩어리(여는 태그 ~ 짝 닫는 태그)를 전부 꺼냅니다 — 같은 태그 이름의 겹침을 셉니다. */
function rev2Blocks(h) {
  const out = [];
  const re = /<(div|fieldset|dl)\b[^>]*\sdata-from-rev2\b[^>]*>/g;
  let m;
  while ((m = re.exec(h))) {
    const tag = m[1];
    const open = new RegExp('<' + tag + '\\b', 'g');
    const close = new RegExp('</' + tag + '>', 'g');
    let depth = 0, i = m.index, end = -1;
    const tokens = [];
    open.lastIndex = i; close.lastIndex = i;
    for (let t; (t = open.exec(h));) tokens.push([t.index, 1]);
    for (let t; (t = close.exec(h));) tokens.push([t.index, -1]);
    tokens.sort((a, b) => a[0] - b[0]);
    for (const [at, d] of tokens) { depth += d; if (depth === 0) { end = at + tag.length + 3; break; } }
    out.push({ open: m[0], body: h.slice(m.index, end) });
  }
  return out;
}

/*
 * 🔴 **지금 받는 칸** — 지금 시행 중인 방침에 «함께» 적힌 것만입니다.
 *    실증 참여: 앱 방침 2026-10-01 판 제2조 「시범 참여 신청」(회사명 · 이메일 · 업종 · 요청하신 업무 · 소개 코드 · 유입 경로)
 *               ∩ privacy.html §02 「시범 참여 신청」 행(같은 항목 · 이름 · 전화 · 직급은 없음).
 *    + 동의(수집·이용 · 실증 참여 안내 확인)와 봇 방지 · 판 이름.
 */
const TODAY_PILOT = ['website', 'requested_work', 'referral_code', 'notice_version', 'company_name', 'industry', 'email',
  'consents.program_notice', 'consents.collection'];
const REV2_PILOT = ['company_size_band', 'contact_name', 'job_title', 'phone', 'address', 'address_detail', 'postal_code',
  'consents.newsletter', 'consents.support_info'];
const SECTOR = ['manufacturing', 'trade', 'service', 'other'];
const SIZE = ['small', 'medium'];

const optionValues = (h, name) => {
  const sel = (h.match(new RegExp('<select name="' + name + '"[^>]*>([\\s\\S]*?)</select>')) || [])[1] || '';
  return [...sel.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
};

/* ══ ① 입구가 하나다 ═════════════════════════════════════════════════ */

test('🔴 신청 입구가 하나다 — 옛 신청 폼(#apply) · 「실증 신청」 · 「가입하기」 버튼이 없다', () => {
  assert.ok(joinHtml, '#join 구획을 찾지 못했습니다 — 검사가 헛돕니다');
  assert.ok(!/id="apply"/.test(src), '옛 신청 구획(#apply)이 남아 있습니다');
  assert.ok(!/id="applyForm"/.test(src), '옛 신청 폼이 남아 있습니다');
  assert.ok(!/href="#apply"/.test(src), '#apply 로 가는 링크가 남아 있습니다');
  assert.ok(!/>\s*가입하기\s*</.test(src), '「가입하기」 버튼이 남아 있습니다 — 이름은 「신청하기」입니다');
  assert.ok(!/class="btn[^"]*"[^>]*>\s*실증 신청\s*</.test(src), '「실증 신청」 별도 버튼이 남아 있습니다');
});

test('🔴 메뉴 · 히어로 · 공지 띠 · 계산기 · 마감 띠 · 푸터의 신청 버튼이 전부 #join 「신청하기」다', () => {
  const nav = (src.match(/<nav[\s\S]*?<\/nav>/) || [])[0] || '';
  assert.deepStrictEqual([...nav.matchAll(/href="#join"[^>]*>([^<]*)</g)].map((m) => m[1]), ['신청하기'], '메뉴의 신청 버튼이 하나가 아닙니다');
  const hero = (src.match(/<header class="hero"[\s\S]*?<\/header>/) || [])[0] || '';
  assert.match(hero, /<a class="btn" href="#join" data-track="hero-join">신청하기<\/a>/, '히어로의 주 버튼이 신청하기가 아닙니다');
  assert.match(src, /<div class="announce"[\s\S]*?<a href="#join" data-track="announce-join">신청 →<\/a>/, '공지 띠가 #join 으로 가지 않습니다');
  assert.match(src, /<a class="btn" href="#join" data-track="calc-join">신청하기<\/a>/, '계산기의 신청 버튼이 #join 이 아닙니다');
  const fin = (src.match(/<section class="fin"[\s\S]*?<\/section>/) || [])[0] || '';
  assert.match(fin, /<a class="btn" href="#join" data-track="final-join">신청하기<\/a>/, '마감 띠의 신청 버튼이 #join 이 아닙니다');
  const footer = (src.match(/<footer[\s\S]*?<\/footer>/) || [])[0] || '';
  assert.match(footer, /<a href="#join" data-track="footer-join">신청하기<\/a>/, '푸터에 신청하기가 없습니다');
});

test('🔴 다른 페이지(about · en · privacy)도 홈의 #join 으로 간다', () => {
  for (const f of ['about.html', 'en.html', 'privacy.html']) {
    const s = read(f).replace(/<!--[\s\S]*?-->/g, '');
    assert.ok(!/\/#apply/.test(s), f + ' 에 /#apply 가 남아 있습니다');
    assert.ok(/href="\/#join"/.test(s), f + ' 에 /#join 링크가 없습니다');
  }
  const about = read('about.html');
  assert.ok(!/실증 신청<\/a>/.test(about), 'about.html 의 버튼 이름이 「실증 신청」 그대로입니다');
});

test('🔴 출시 소식 받기는 #join 에 없다 — 2026-10-06 대표 결정 · 출시 알림은 /contact 가 받는다', () => {
  assert.ok(joinHtml && pilotHtml, '#join · 실증 참여 폼을 찾지 못했습니다 — 검사가 헛돕니다');
  assert.ok(!/id="joinNotifyForm"/.test(src), '출시 소식 폼이 되살아났습니다');
  assert.strictEqual((joinHtml.match(/<form\b/g) || []).length, 1, '#join 의 폼이 하나가 아닙니다');
  assert.ok(!/\/api\/leads|kind: 'notify'/.test(joinScript), '#join 스크립트가 출시 소식(/api/leads)을 보냅니다');
  assert.match(read('contact.html'), /href="\/contact\?type=notify"/, '/contact 의 출시 알림 신청이 사라졌습니다 — 출시 알림을 받을 곳이 없습니다');
});

test('🔴 #join 은 오늘부터 선다 — 숨김으로 오지 않고, 옛 주소 #apply 를 받아 준다', () => {
  assert.match(joinHtml, /^<section id="join" class="tint" data-section="apply">/, '#join 이 숨은 채로 옵니다(계측 영역 이름은 apply 를 잇습니다)');
  assert.match(joinScript, /location\.hash === '#apply'/, '옛 주소 #apply 를 이 구획으로 데려오는 자리가 없습니다');
  assert.ok(!/retarget\(/.test(joinScript), '날짜로 #join ↔ #apply 를 바꿔 끼우는 옛 장치가 남아 있습니다');
});

/* ══ ② 계약의 키 그대로 ══════════════════════════════════════════════ */

test('🔴 실증 참여 폼의 칸 이름 = 지금 칸 + 새 칸(3판 계약 키)', () => {
  assert.ok(pilotHtml, '실증 참여 폼을 찾지 못했습니다 — 검사가 헛돕니다');
  assert.deepStrictEqual([...namesIn(pilotHtml)].sort(), [...TODAY_PILOT, ...REV2_PILOT].sort(), '실증 참여 폼의 칸 이름이 계약과 다릅니다');
});

test('🔴 업종 · 규모 선택지 값이 앱의 정본 어휘다', () => {
  assert.deepStrictEqual(optionValues(pilotHtml, 'industry'), SECTOR, '업종 선택지 값이 계약과 다릅니다');
  assert.deepStrictEqual(optionValues(pilotHtml, 'company_size_band'), SIZE, '규모 선택지 값이 계약과 다릅니다');
});

test('⚠️ 업종 · 규모 선택지가 앱의 어휘 정본(lib/organization/onboarding.ts)과 같다 — 형제 저장소가 있을 때', (t) => {
  const file = path.join(ROOT, '..', 'trops_a', 'lib', 'organization', 'onboarding.ts');
  if (!fs.existsSync(file)) { t.skip('형제 저장소가 없어 건너뜁니다 — 이 실행의 green 은 앱과 같다는 뜻이 아닙니다'); return; }
  const v = fs.readFileSync(file, 'utf8');
  const keysOf = (name) => {
    const body = (v.match(new RegExp('export const ' + name + '[^=]*= \\{([\\s\\S]*?)\\}')) || [])[1] || '';
    return [...body.matchAll(/([a-z_]+):\s*"/g)].map((m) => m[1]);
  };
  assert.deepStrictEqual(keysOf('SECTOR_CHOICES'), SECTOR, '앱의 업종 어휘가 바뀌었습니다 — 폼과 이 표를 함께 고치십시오');
  assert.deepStrictEqual(keysOf('SIZE_BAND_CHOICES'), SIZE, '앱의 규모 어휘가 바뀌었습니다 — 폼과 이 표를 함께 고치십시오');
});

test('🔴 보내는 본문 — 3판 · 동의는 consents 객체 · 봇 방지 두 칸 · 3초 기다림 · JSON', () => {
  assert.match(joinScript, /form_version: 3/, '3판으로 보내지 않습니다');
  assert.match(joinScript, /consents: \{ collection: on\(pf, 'consents\.collection'\), program_notice: on\(pf, 'consents\.program_notice'\) \}/, '동의를 consents 객체로 묶지 않습니다');
  assert.match(joinScript, /website: pf\.elements\.website\.value, elapsed_ms: elapsed/, '봇 방지 두 칸을 싣지 않습니다');
  assert.match(joinScript, /3200 - \(Date\.now\(\) - opened\)/, '3초 전 제출을 기다려 보내는 장치가 없습니다 — 앱이 bot 으로 봅니다');
  assert.match(joinScript, /'Content-Type': 'application\/json'/, 'JSON 으로 보내지 않습니다');
});

test('🔴 201 이 아니면 완료 화면을 띄우지 않는다 — 저장 못 한 신청을 «접수됐다»고 하지 않는다', () => {
  assert.match(joinScript, /r\.status === 201 && r\.data && r\.data\.ok === true &&[\s\S]*?typeof r\.data\.application_id === 'string'[\s\S]*?r\.data\.result === 'created'/, '실증 참여 완료 화면이 201·ok 에만 묶여 있지 않습니다');
  for (const status of ['400', '403', '409', '413', '429', '503']) {
    assert.ok(new RegExp('status === ' + status).test(joinScript), status + ' 응답의 문구 갈래가 없습니다');
  }
});

/* ══ ③ 새 칸은 방침 2차 개정 시행일부터 ══════════════════════════════ */

test('🔴 새 칸은 전부 `data-from-rev2` 안에 있고, 마크업에서 숨김 · 잠김으로 온다', () => {
  const blocks = rev2Blocks(joinHtml);
  assert.ok(blocks.length >= 6, '`data-from-rev2` 덩어리가 너무 적습니다 — 검사가 헛돕니다');
  for (const b of blocks) {
    assert.match(b.open, /\shidden\b/, '새 칸 덩어리가 숨은 채로 오지 않습니다: ' + b.open);
    /* fieldset 은 스스로 잠기면 안의 칸이 함께 잠깁니다 · 그 밖의 덩어리는 칸마다 잠겨 있어야 합니다. */
    if (/^<fieldset/.test(b.open)) { assert.match(b.open, /\sdisabled\b/, '새 칸 묶음이 잠긴 채로 오지 않습니다'); continue; }
    const controls = [...b.body.matchAll(/<(input|select|button)\b[^>]*>/g)].map((m) => m[0]);
    for (const c of controls) assert.match(c, /\sdisabled\b/, '새 칸이 잠긴 채로 오지 않습니다: ' + c);
  }
  const inRev2 = new Set(blocks.flatMap((b) => namesIn(b.body)));
  for (const n of REV2_PILOT) assert.ok(inRev2.has(n), n + ' 가 `data-from-rev2` 밖에 있습니다 — 방침 시행 전에 보입니다');
  for (const n of TODAY_PILOT) assert.ok(!inRev2.has(n), n + ' 가 `data-from-rev2` 안에 있습니다 — 오늘 받을 칸이 숨습니다');
});

test('🔴 지금 칸은 잠기지 않은 채로 온다 — 오늘부터 보이고 받는다', () => {
  for (const [form, names] of [[pilotHtml, TODAY_PILOT]]) {
    for (const n of names) {
      const tag = (form.match(new RegExp('<(?:input|select)\\b[^>]*\\sname="' + n.replace('.', '\\.') + '"[^>]*>')) || [])[0] || '';
      assert.ok(tag, n + ' 칸을 찾지 못했습니다');
      assert.ok(!/\sdisabled\b/.test(tag), n + ' 칸이 잠긴 채로 옵니다');
    }
  }
});

test('🔴 보내는 본문도 새 칸을 «그날부터만» 싣는다', () => {
  const pilotBody = (joinScript.match(/url: PILOT\.endpoint[\s\S]*?return body;/) || [])[0] || '';
  for (const [body, names] of [[pilotBody, ['company_size_band', 'contact_name', 'phone', 'job_title', 'address', 'postal_code', 'newsletter', 'support_info']]]) {
    assert.ok(body, '본문을 만드는 자리를 찾지 못했습니다');
    const outside = body.replace(/if \(REV2\) \{[\s\S]*?\n {6}\}/, '');
    for (const n of names) assert.ok(!new RegExp('\\.' + n + '\\b').test(outside), n + ' 를 시행일 전에도 싣습니다');
    assert.match(body, /if \(REV2\) \{/, '시행일 갈래가 없습니다');
  }
});

test('🔴 새 칸이 서는 날은 site.config.json 한 곳이고, 토큰으로 읽는다', () => {
  const pa = JSON.parse(read('site.config.json')).pilotApply;
  assert.match(String(pa.newFieldsFrom), /^\d{4}-\d{2}-\d{2}$/, 'newFieldsFrom 이 날짜가 아닙니다');
  assert.ok(!('joinOpensOn' in pa), '옛 이름(joinOpensOn)이 남아 있습니다 — #join 은 이제 늘 섭니다');
  assert.ok(joinScript.includes("var REV2_FROM = '{{pilotApply.newFieldsFrom}}';"), '날짜를 토큰으로 읽지 않습니다');
  assert.match(joinScript, /kstToday >= REV2_FROM/, '한국 날짜로 견주지 않습니다');
});

test('⚠️ 새 칸이 서는 날 = 앱의 방침 2차 개정 시행일(PRIVACY_REV2_EFFECTIVE) — 형제 저장소가 있을 때', (t) => {
  const file = path.join(ROOT, '..', 'trops_a', 'lib', 'legal', 'privacy-rev2.ts');
  if (!fs.existsSync(file)) { t.skip('형제 저장소가 없어 건너뜁니다'); return; }
  const app = (fs.readFileSync(file, 'utf8').match(/PRIVACY_REV2_EFFECTIVE = "(\d{4}-\d{2}-\d{2})"/) || [])[1];
  assert.strictEqual(JSON.parse(read('site.config.json')).pilotApply.newFieldsFrom, app, '랜딩과 앱의 시행일이 갈렸습니다 — 두 겹이 어긋납니다');
});

test('🔴 수집·이용 안내 글이 둘이다 — 지금 방침에 맞춘 글(data-until-rev2)과 새 글(data-from-rev2), 판 이름도 둘', () => {
  for (const form of [pilotHtml]) {
    assert.match(form, /<dl data-until-rev2>/, '지금 방침에 맞춘 안내 글이 없습니다');
    assert.match(form, /<dl data-from-rev2 hidden>/, '새 안내 글이 숨은 채로 오지 않습니다');
  }
  const today = (pilotHtml.match(/<dl data-until-rev2>([\s\S]*?)<\/dl>/) || [])[1] || '';
  for (const word of ['규모', '전화', '직급', '주소', '이름']) assert.ok(!today.includes(word), '지금 안내 글이 아직 받지 않는 칸(' + word + ')을 적습니다');
  assert.ok(today.includes('{{publicCopy.retention}}'), '지금 안내 글이 보관 기준(publicCopy.retention)을 쓰지 않습니다');
  assert.match(pilotHtml, /name="notice_version" value="pilot-apply-2026-10-07" data-rev2-value="pilot-apply-2026-10-13"/, '동의 문구의 판 이름이 바뀌었습니다 — 글을 고쳤으면 판도 바꾸십시오');
});

/* ══ ④ 꺼짐이 기본 ═══════════════════════════════════════════════════ */

test('🔴 제출 버튼은 숨긴 채로 온다 — 스크립트가 없으면 아무것도 보내지 않는다', () => {
  for (const form of [pilotHtml]) {
    assert.match(form, /<button class="btn" type="submit"[^>]*\sdata-js-submit hidden>/, '제출 버튼이 숨은 채로 오지 않습니다');
  }
  assert.match(pilotHtml, /<p class="note" id="pilotOff">/, '꺼졌을 때의 안내 문구가 보이는 채로 오지 않습니다');
});

test('🔴 스위치는 site.config.json 한 곳이고 운영에서 켜져 있다', () => {
  const pa = JSON.parse(read('site.config.json')).pilotApply;
  assert.strictEqual(pa.productionEnabled, true, '운영 스위치가 꺼져 있습니다');
  assert.strictEqual(pa.productionEndpoint, 'https://app.trops.kr/api/pilot-apply');
  assert.strictEqual(typeof pa.previewEnabled, 'boolean');
});

test('🔴 페이지가 스위치를 «토큰으로» 읽고, 운영 주소를 trops.kr 두 이름으로만 본다', () => {
  for (const key of ['productionEnabled', 'productionEndpoint', 'previewEnabled', 'previewEndpoint']) {
    assert.ok(joinScript.includes("'{{pilotApply." + key + "}}'"), key + ' 를 토큰(따옴표 안)으로 읽지 않습니다');
  }
  assert.ok(joinScript.includes('/^(www\\.)?trops\\.kr$/.test(location.hostname)'), '운영 주소 판정이 바뀌었습니다');
  assert.ok(!/enabled:\s*true\b/.test(joinScript), '스위치를 스크립트에 손으로 켜 두었습니다');
  assert.match(joinScript, /function\(\)\{ return PILOT\.enabled; \}/, '실증 참여 제출이 스위치를 보지 않습니다');
  const onProd = (url) => /^(www\.)?trops\.kr$/.test(new URL(url).hostname);
  for (const [url, want] of [
    ['https://trops.kr', true], ['https://www.trops.kr/?ref=TR-3NV8QD#join', true], ['http://www.trops.kr/', true],
    ['https://app.trops.kr/', false], ['https://trops.kr.evil.com/', false], ['http://localhost:8765/index.html', false],
  ]) {
    assert.strictEqual(onProd(url), want, url + ' 의 운영 판정이 틀렸습니다');
  }
});

/* ══ 들어오신 경로 · 신청 접수 계측 · /contact · 소개 ═══════════════ */

test('🔴 실증 참여에 들어오신 경로(acquisition)를 계약의 키로만 싣는다 — 채널 코드는 ref, 소개 코드와 섞지 않는다', () => {
  const fn = (joinScript.match(/function acquisition\(\)\{[\s\S]*?\n  \}/) || [])[0] || '';
  assert.ok(fn, 'acquisition() 을 찾지 못했습니다');
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) assert.ok(fn.includes("'" + k + "'"), k + ' 를 싣지 않습니다');
  assert.match(fn, /out\.ref = /, '채널 코드를 acquisition.ref 로 싣지 않습니다');
  assert.match(fn, /tropsVisit\(\)\.from/, '채널 코드를 track.js 의 방문 값에서 읽지 않습니다');
  assert.match(fn, /out\.landing_path = /, 'landing_path 를 싣지 않습니다');
  assert.ok(!/referral_code/.test(fn), '소개 코드를 acquisition 에 섞었습니다');
  assert.match(joinScript, /if \(acq\) body\.acquisition = acq;/, '본문에 acquisition 을 싣지 않습니다');
});

test('🔴 신청 접수 계측(apply-success)은 실증 참여 완료(201)에서만 한 번 부른다', () => {
  assert.strictEqual((joinScript.match(/event: 'apply-success'/g) || []).length, 1, 'apply-success 를 붙인 자리가 하나가 아닙니다');
  assert.match(joinScript, /if \(isDone\(r\)\) \{ u\.done\(\); if \(window\.tropsEvent\) window\.tropsEvent\(build\.event\); if \(build\.after\) build\.after\(r\.data\); return; \}/, '계측이 완료 화면 밖에서 불립니다');
  const track = read('assets/track.js');
  assert.match(track, /var PAGE_EVENTS = \{ 'apply-success': 'apply' \};/, 'track.js 가 받는 페이지 사건 표가 바뀌었습니다');
});

test('⚠️ 푸터 「문의 · 교육 · 파트너」가 /contact 로 간다 — 랜딩에서 문의 폼으로 가는 길', () => {
  const footer = (src.match(/<footer[\s\S]*?<\/footer>/) || [])[0] || '';
  assert.match(footer, /<a href="\/contact" data-track="footer-contact">문의 · 교육 · 파트너<\/a>/, '푸터에서 /contact 로 가는 링크가 없습니다');
});

test('🔴 소개 문구가 순번을 약속하지 않는다 — 「소개해 주시면 먼저 연락드립니다」 한 벌', () => {
  for (const bad of ['순서가 앞당겨', '세 칸씩', '순번이 올라', '우선 초대']) assert.ok(!src.includes(bad), '순번을 약속하는 문구가 있습니다: ' + bad);
  assert.ok(src.includes('소개해 주시면 먼저 연락드립니다'), '통일한 소개 문구가 사라졌습니다');
});

test('⚠️ 소개 코드는 계약 모양일 때만 담는다 — 영문·숫자·하이픈 4~32자', () => {
  assert.ok(joinScript.includes('/^[A-Za-z0-9-]{4,32}$/.test(rp)'), '소개 코드 모양 검사가 바뀌었습니다');
});

/*
 * 🔄 2026-10-07 — 신청하면서 가입 · 승인은 뒤에서(대표 지시).
 * 신청이 끝나면 앱이 준 계정 만들기 화면으로 보낸다. 그 주소는 «신청을 보낸 그 앱»의 /pilot/account 일 때만 쓴다.
 * 주소가 없으면(앱이 아직 그 길을 열지 않았다) 종전 완료 글 그대로다 — 없는 화면을 약속하지 않는다.
 */
test('🔴 완료 화면 — 계정 만들기 글과 버튼은 숨긴 채로 오고, 앱이 주소를 줬을 때만 선다', () => {
  const done = (joinHtml.match(/<div class="done" hidden>[\s\S]*?<\/div>\s*<\/div>/) || [])[0] || '';
  assert.ok(done, '완료 화면을 찾지 못했습니다');
  assert.match(done, /<p data-done-wait>담당자가 참여 가능 여부를 확인한 뒤 이메일로 안내드립니다\.<\/p>/, '주소가 없을 때의 완료 글이 바뀌었습니다');
  assert.match(done, /<div data-done-account hidden>/, '계정 만들기 자리가 처음부터 보입니다');
  assert.match(done, /data-done-account-link href="https:\/\/app\.trops\.kr\/pilot\/account"/, '계정 만들기 버튼의 기본 주소가 앱의 계정 화면이 아닙니다');
  assert.match(joinScript, /link\.href = url; box\.hidden = false; wait\.hidden = true;/, '주소를 받았을 때 글을 바꾸지 않습니다');
});

test('🔴 계정 만들기 화면 주소는 신청을 보낸 그 앱의 /pilot/account 일 때만 쓴다', () => {
  const fn = (joinScript.match(/function accountUrlOf\(raw\)\{[\s\S]*?\n  \}/) || [])[0] || '';
  assert.ok(fn, 'accountUrlOf() 를 찾지 못했습니다');
  const make = (endpoint) => new Function('PILOT', 'location', 'URL', fn + '; return accountUrlOf;')({ endpoint }, { href: 'https://trops.kr/' }, URL);
  const ok = make('https://app.trops.kr/api/pilot-apply');
  assert.strictEqual(ok('https://app.trops.kr/pilot/account?applied=1#e=a%40b.co'), 'https://app.trops.kr/pilot/account?applied=1#e=a%40b.co');
  for (const bad of [
    'https://evil.example/pilot/account', 'https://app.trops.kr.evil.example/pilot/account', 'http://app.trops.kr/pilot/account',
    'https://app.trops.kr/login', 'https://app.trops.kr/pilot/account/../../login', 'javascript:alert(1)', '/pilot/account', '', null, undefined, 42,
    'https://app.trops.kr/pilot/account?' + 'x'.repeat(700),
  ]) assert.strictEqual(ok(bad), null, '받으면 안 되는 주소를 받았습니다: ' + String(bad).slice(0, 60));
  // 미리보기 앱으로 보낸 신청은 그 미리보기 앱의 화면만 받는다.
  const preview = make('https://trops-a-git-x.vercel.app/api/pilot-apply');
  assert.strictEqual(preview('https://app.trops.kr/pilot/account'), null);
  assert.ok(preview('https://trops-a-git-x.vercel.app/pilot/account?applied=1'));
  assert.match(joinScript, /var url = accountUrlOf\(data && data\.account_url\);\s+if \(!url\) return;/, '주소를 검사하지 않고 옮깁니다');
});

test('🔴 실증 참여 폼의 안내 글이 «초대 메일을 기다린다»고 말하지 않는다 — 앱이 계정 화면을 주든 안 주든 맞는 글', () => {
  for (const bad of ['초대 메일이 이 주소로', '초대 메일을 보내 드립니다', '초대 메일에서 입력', '초대해 드릴 때']) {
    assert.ok(!joinHtml.replace(/<!--[\s\S]*?-->/g, '').includes(bad), '옛 흐름의 글이 남았습니다: ' + bad);
  }
  assert.ok(pilotHtml.includes('담당자가 참여 가능 여부를 확인해 승인하면 이메일로 알려 드리고'), '실증 참여 안내가 승인 흐름을 말하지 않습니다');
  // 폼의 글은 «바로 계정을 만들 수 있다»고 약속하지 않는다 — 그 길은 앱이 주소를 줬을 때 완료 화면이 말한다.
  assert.ok(!pilotHtml.includes('바로 계정을'), '폼이 앱이 열지 않았을 수도 있는 길을 약속합니다');
});
