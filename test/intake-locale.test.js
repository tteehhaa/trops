/*
 * 접수 화면의 언어가 끝까지 따라간다 〔intake-locale · 신설 2026-08-17〕
 *
 *   npm test        (node --test test/)
 *
 * ── 왜 있는가 ───────────────────────────────────────────────────────────────
 * 영문 랜딩(/en → /en-check → /en-precheck)을 낸 뒤, 영문 방문자는 **서류를 보내는
 * 순간** 국문을 만났습니다 — 확인메일도 접수 확인 표의 라벨도 전부 국문이었습니다.
 * 깔때기를 영문으로 다 깔아 놓고 전환이 일어나는 그 지점에서 언어가 바뀌는 상태였고,
 * 남은 영문화 항목 중 사용자에게 실제로 보이는 것은 이것 하나였습니다.
 *
 * 고치는 방식이 이 파일이 지키는 것입니다:
 *
 *   🔴 **폼에 칸을 더하지 않았습니다.** precheck.html 과 en-precheck.html 은 구조가
 *      1:1 이라(test/naming-consistency.test.js 가 name= 목록까지 셉니다) 한쪽에만
 *      칸을 더하면 그 자리에서 갈라집니다. 두 페이지는 `<html lang>` 이 이미 다르고,
 *      **같은 코드**가 그 값을 읽어 서로 다른 값을 보냅니다.
 *
 *   🔴 **언어는 접수 성립의 조건이 아닙니다.** 모르는 값이 와도 400 이 아니라 국문으로
 *      떨어집니다. 여기서 막으면 언어 하나 때문에 접수를 잃습니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** 주석 없는 소스 — 이 저장소는 주석에 옛 문자열·반대 사례를 인용합니다. */
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const intake = require('../api/intake.js');
const ROUTE = require('../api/_intake-route.js');

/* ══ 1. 화면 → 서버 ═════════════════════════════════════════════════════════ */

test('두 접수 폼이 같은 코드로 각자의 언어를 보낸다', () => {
  const LINE = "locale: document.documentElement.lang === 'en' ? 'en' : 'ko',";
  for (const f of ['precheck.html', 'en-precheck.html']) {
    assert.ok(strip(read(f)).includes(LINE),
      f + ' 이 접수 요청에 locale 을 싣지 않습니다');
  }
  /* 🔴 값을 **하드코딩하지 않았는지**가 핵심입니다. 한쪽에 'en' 을 박아 두면 그 파일은
     맞지만, 다음에 문구만 옮기는 사람이 그 줄의 뜻을 모르고 복사합니다. */
  for (const f of ['precheck.html', 'en-precheck.html']) {
    assert.ok(!/locale:\s*'(ko|en)'/.test(strip(read(f))),
      f + ' 이 locale 을 하드코딩했습니다 — <html lang> 에서 읽어야 두 파일이 같은 코드가 됩니다');
  }
  /* 두 페이지의 <html lang> 이 실제로 다른가 — 위 코드가 기대는 유일한 전제입니다. */
  assert.match(read('precheck.html'), /<html lang="ko">/);
  assert.match(read('en-precheck.html'), /<html lang="en">/);
});

/* ══ 2. 아는 값만 · 모르면 국문 ══════════════════════════════════════════════ */

test('언어는 접수를 막지 않는다 — 모르는 값은 국문으로 떨어진다', () => {
  assert.strictEqual(intake.parseLocale('en'), 'en');
  assert.strictEqual(intake.parseLocale('ko'), 'ko');
  assert.strictEqual(intake.parseLocale('EN'), 'en', '대소문자로 갈리면 안 됩니다');
  assert.strictEqual(intake.parseLocale(' en '), 'en');

  for (const bad of ['ja', 'en-US', '', null, undefined, 42, {}, 'ko; drop table']) {
    assert.strictEqual(intake.parseLocale(bad), 'ko',
      JSON.stringify(bad) + ' 가 국문으로 떨어지지 않았습니다');
  }
});

test('서류 종류 표기가 언어를 따른다 — 화면이 코드값을 번역하지 않는다', () => {
  assert.strictEqual(intake.docTypeLabel('nda', 'ko'), '비밀유지계약서(NDA)');
  assert.strictEqual(intake.docTypeLabel('nda', 'en'), 'NDA (Non-Disclosure Agreement)');
  // locale 을 안 넘기는 옛 호출은 지금까지와 똑같이 동작해야 합니다.
  assert.strictEqual(intake.docTypeLabel('nda'), '비밀유지계약서(NDA)');
  // 모르는 코드값은 지어내지 않고 그대로 돌려줍니다(두 언어 모두).
  assert.strictEqual(intake.docTypeLabel('mystery', 'en'), 'mystery');
});

/* ══ 3. 문면 ═══════════════════════════════════════════════════════════════ */

/*
 * 🔴 국문에 걸린 규칙이 영문에도 **그대로** 걸립니다.
 *    scan-only 문면은 업로드 시점에 이미 띄우는 문장과 글자 그대로 같아야 합니다 —
 *    같은 사실을 두 시점에 두 문장으로 말하면 이용자는 다른 일이 생긴 줄 압니다.
 *    (test/intake-route.test.js 가 국문 쌍에 같은 단정을 겁니다.)
 */
test('영문 scan-only 문면이 영문 업로드 안내와 글자 그대로 같다', () => {
  const html = strip(read('en-precheck.html'));
  const shown = (html.match(/<p id="textlayer-msg">([^<]*)<\/p>/) || [])[1];
  assert.ok(shown, 'en-precheck.html 에서 #textlayer-msg 를 찾지 못했습니다');
  assert.strictEqual(ROUTE.NOTICES_EN['scan-only'], shown,
    '업로드 안내와 접수 확인 문면이 다릅니다 — 같은 사실을 두 문장으로 말합니다\n' +
    '  화면: ' + shown + '\n  문면: ' + ROUTE.NOTICES_EN['scan-only']);
});

test('영문 문면이 국문과 같은 사유를 덮는다', () => {
  assert.deepStrictEqual(
    Object.keys(ROUTE.NOTICES_EN).sort(), Object.keys(ROUTE.NOTICES).sort(),
    '한쪽에만 있는 사유가 있습니다 — 그 사유가 온 영문 접수는 문면이 국문으로 나갑니다');
  assert.strictEqual(ROUTE.FALLBACK_NOTICE_EN, ROUTE.NOTICES_EN['unsupported-language'],
    '모르는 사유의 문면이 언어 사유와 다릅니다 — 그 차이가 무슨 일이 있었는지를 흘립니다');
});

test('문면에 언어·파일 종류를 적지 않는다 — 국문과 같은 규칙', () => {
  for (const [reason, text] of Object.entries(ROUTE.NOTICES_EN)) {
    assert.ok(!/korean|english|japanese|chinese|language is|not supported/i.test(text),
      reason + ' 문면이 언어를 지목합니다: ' + text);
  }
});

test('noticeFor 가 언어를 따르고, 인자를 빼면 지금까지와 같다', () => {
  assert.strictEqual(ROUTE.noticeFor('blocked', 'scan-only', 'en'), ROUTE.NOTICES_EN['scan-only']);
  assert.strictEqual(ROUTE.noticeFor('blocked', 'scan-only', 'ko'), ROUTE.NOTICES['scan-only']);
  // 🔴 인자를 빼고 부르는 곳이 여럿입니다(api/_route-refund.js · 기존 테스트).
  assert.strictEqual(ROUTE.noticeFor('blocked', 'scan-only'), ROUTE.NOTICES['scan-only']);
  assert.strictEqual(ROUTE.noticeFor('blocked', 'something-new', 'en'), ROUTE.FALLBACK_NOTICE_EN);
  // route 가 blocked 가 아니면 어느 언어에서도 문면이 없습니다.
  assert.strictEqual(ROUTE.noticeFor('ok', 'scan-only', 'en'), null);
});

/* ══ 4. 나중에 나가는 메일 ═══════════════════════════════════════════════════ */

/*
 * 확인메일은 접수와 같은 요청 안에서 나가므로 컬럼이 없어도 영문으로 갑니다.
 * 자료 전달·삭제 확인은 **한참 뒤**라 행에 적힌 것만이 근거입니다 — 그래서 컬럼이
 * 필요하고, 그 컬럼이 없을 때 **조회가 통째로 실패하면 안 됩니다.**
 */
test('전달·삭제 조회가 locale 컬럼이 없어도 살아남는다', () => {
  for (const [f, what] of [['api/_delivery.js', '전달'], ['api/erasure.js', '삭제']]) {
    const src = read(f);
    assert.match(src, /locale/, f + ' 이 locale 을 조회하지 않습니다');
    assert.match(src, /PGRST204|42703/,
      f + ' 에 「그런 칸 없다」 판정이 없습니다 — 컬럼이 없는 DB 에서 ' + what + '이 통째로 멈춥니다');
    assert.match(src, /0-K/, f + ' 이 무엇을 실행해야 하는지 로그로 알려주지 않습니다');
  }
});

test('locale 이 없어도 접수는 성립한다 — 재시도 대상에 있다', () => {
  assert.ok(intake.OPTIONAL_COLUMNS.indexOf('locale') !== -1,
    'locale 이 OPTIONAL_COLUMNS 에 없습니다 — 컬럼이 없는 DB 에서 접수가 통째로 502 가 됩니다');
});

/* ══ 5. 운영자 메일은 언제나 국문 ════════════════════════════════════════════ */

/*
 * 읽는 사람이 한 명이고 그 사람의 언어는 안 바뀝니다. 운영자 메일까지 영문으로
 * 갈아 끼우면 같은 받은편지함에 두 언어가 섞여 검수가 느려집니다.
 */
test('운영자 메일에는 언어 분기가 없다', () => {
  const src = read('api/_notify.js');
  const operator = src.slice(src.indexOf('TROPS 사전 확인 접수 <'), src.indexOf('intake operator email error'));
  assert.ok(!/\ben\s*\?/.test(operator),
    '운영자 알림에 언어 분기가 들어왔습니다 — 받은편지함에 두 언어가 섞입니다');
});

/* ══ 6. 영문 메일에서 빠지면 안 되는 것 ══════════════════════════════════════ */

test('영문 고객 메일이 국문과 같은 고지를 담는다', () => {
  const src = read('api/_notify.js');
  /* 보관 기간·법률 자문 아님은 국문에서 빠질 수 없는 고지입니다. 영문에서만 빠지면
     같은 서비스가 언어에 따라 다른 약속을 하게 됩니다. */
  for (const phrase of [
    'Files you send are deleted ${RETENTION_DAYS} days after submission',
    'TROPS is not a legal advisory service',
  ]) {
    assert.ok(src.includes(phrase), '영문 메일에 「' + phrase + '」 가 없습니다');
  }
  /* 영문 메일의 정책 링크는 영문 페이지여야 합니다 — 국문 /refund 로 보내면
     영문 메일 한가운데서 국문 페이지가 열립니다. */
  assert.ok(src.includes('/en-refund'), '영문 메일이 /en-refund 를 가리키지 않습니다');
});
