'use strict';

/*
 * from-source.test.js — 유입원(`?from=`) 전달 〔신설 2026-09-20〕
 *
 * 🔴 **무엇을 지키나** — 랜딩이 앱으로 넘기는 「어디서 왔는가」입니다. 앱은 그 값을
 *    `export_precheck_run.from_source_raw` 에 **접지 않고 원문 그대로** 적습니다(0075).
 *    그래서 랜딩 쪽에서도 접지 않는 것이 이 축의 전부입니다.
 *
 * 🔴 **이 파일이 지키는 것은 «규칙»이지 문자열이 아닙니다.** 아래 다섯이 무너지면 값이
 *    조용히 틀어집니다 — 조용하다는 것이 이 검사가 필요한 이유입니다:
 *      ① 이미 `from` 이 있으면 덮지 않는다      (`/insurance/quick` 의 닫힌 축 보호)
 *      ② 100자에서 자른다                        (앱과 잘린 값이 같아야 한다)
 *      ③ 허용 목록으로 거르지 않는다             (모르는 제휴 코드를 버리지 않는다)
 *      ④ `utm_*` 와 `source=` 를 건드리지 않는다 (서로 다른 축이다)
 *      ⑤ 유입원 부착이 열쇠 검사보다 «앞»이다    (저장소가 막혀도 지면은 남는다)
 *
 * ⚠️ **브라우저를 띄우지 않습니다** — 이 저장소에 DOM 실행 환경이 없습니다
 *    (`test/track-section.test.js` 와 같은 방식). 여기서 재는 것은 **소스의 사실**이고,
 *    실제 왕복은 사람이 확인합니다. 배포 후 확인 방법은 이 배치의 커밋 메시지에 있습니다.
 *
 * 🔜 이 파일이 맡지 «않는» 것: 쿠키·IP 를 만지지 않는가, 보내는 몸통에 무엇이 실리는가는
 *    `test/track-section.test.js` 가 봅니다. 두 곳에 같은 검사를 두지 마십시오.
 */

const test = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
/* 주석을 걷은 코드 — 머리말의 인용이 단정을 대신하지 않게 합니다. */
const code = (f) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const TRACK = 'assets/track.js';

/* ══ ① 이미 있는 `from` 을 덮지 않는다 ═══════════════════════════════ */

test('🔴 이미 `from` 이 있으면 손대지 않는다 — /insurance/quick 의 닫힌 축이 깨진다', () => {
  /*
   * 🔴 **`if` 가 이 축을 갈라 놓는 전부입니다.** 조건 없이 `set` 하면
   *    `/insurance/quick?from=landing|precheck` 두 링크가 제휴 코드로 덮이고,
   *    그 칸(0053)의 닫힌 5값 집계가 조용히 무너집니다.
   * ⚠️ 「`from` 을 set 하는 자리」를 세고, 그 앞에 «있는지 묻는» 조건이 있는지 봅니다.
   */
  const s = code(TRACK);

  const sets = s.match(/searchParams\.set\('from'[^)]*\)/g) || [];
  assert.strictEqual(sets.length, 1,
    `from 을 심는 자리가 ${sets.length} 곳입니다(1이어야 합니다) — 두 곳이면 규칙이 갈립니다`);

  assert.match(
    s,
    /if\s*\(!\s*url\.searchParams\.get\('from'\)\)\s*url\.searchParams\.set\('from',/,
    '이미 있는 from 을 확인하지 않고 심습니다 — /insurance/quick 의 값이 덮입니다'
  );
});

test('🔴 랜딩이 심어 둔 `from` 두 값이 소스에 살아 있다 — 덮이면 이 둘이 사라진다', () => {
  /*
   * 🔴 **보호 «대상»이 실재하는지 함께 잽니다.** 위 ① 은 「덮지 않는가」만 보는데,
   *    지켜야 할 링크가 사라지면 그 검사는 아무것도 지키지 않으면서 초록입니다.
   */
  const pairs = [
    ['index.html', 'from=landing'],
    ['en.html', 'from=landing'],
    ['precheck.html', "&from=precheck"],
  ];
  for (const [file, must] of pairs) {
    assert.ok(
      read(file).includes(must),
      `${file}: 「${must}」 가 없습니다 — /insurance/quick 의 닫힌 축이 사라졌습니까?`
    );
  }
});

/* ══ ② 100자에서 자른다 ══════════════════════════════════════════════ */

test('🔴 담을 때와 실을 때 «둘 다» 100자에서 자른다 — 앱과 잘린 값이 같아야 한다', () => {
  const s = code(TRACK);
  const cuts = s.match(/\.slice\(0,\s*100\)/g) || [];
  assert.ok(cuts.length >= 2,
    `100자 자름이 ${cuts.length} 곳입니다 — 담는 자리(seedFrom)와 싣는 자리(currentFrom) 둘 다여야 합니다`);

  for (const fn of ['seedFrom', 'currentFrom']) {
    const body = s.match(new RegExp('function ' + fn + '\\(\\)[\\s\\S]*?\\n  \\}'));
    assert.ok(body, fn + ' 을 찾지 못했습니다 — 검사가 헛돕니다');
    assert.match(body[0], /\.slice\(0,\s*100\)/, fn + ' 이 100자에서 자르지 않습니다');
  }
});

/* ══ ③ 목록으로 거르지 않는다 ════════════════════════════════════════ */

test('🔴 허용 목록이 없다 — 모르는 제휴 코드를 버리면 이 장치가 없애려던 손실이 재발한다', () => {
  /*
   * 🔴 앱이 **접지 않고** 저장하는 것이 그 칸의 존재 이유입니다. 랜딩에서 거르면
   *    앱이 아무리 원문을 받아도 받을 원문이 없습니다.
   * ⚠️ 「거른다」의 꼴을 셋으로 봅니다 — 배열 대조 · 정규식 화이트리스트 · 소문자 정규화.
   *    ⛔ 대소문자를 접지 마십시오. 제휴 코드는 대소문자가 뜻인 경우가 있습니다.
   */
  const s = code(TRACK);
  const fns = ['seedFrom', 'currentFrom']
    .map((n) => (s.match(new RegExp('function ' + n + '\\(\\)[\\s\\S]*?\\n  \\}')) || [''])[0])
    .join('\n');
  assert.ok(fns.trim(), '유입원 함수를 찾지 못했습니다 — 검사가 헛돕니다');

  for (const bad of ['indexOf(', 'includes(', 'toLowerCase()', 'ALLOW', 'WHITELIST']) {
    assert.ok(!fns.includes(bad), '유입원 값을 거르거나 접고 있습니다: ' + bad);
  }
});

/* ══ ④ 다른 축을 건드리지 않는다 ═════════════════════════════════════ */

test('🔴 `source=one_minute_check` 를 track.js 가 만들지 않는다 — 두 축은 다르다', () => {
  /*
   * 🔴 그 키는 Handoff Contract v2 의 canonical 키로 「1분 체크 답을 갖고 왔다」를 뜻하고,
   *    앱에서 **불리언 하나**로 쓰입니다. `from` 은 「어디서 왔는가」이고 DB 에 남는 값입니다.
   *    한 값으로 합치면 둘 다 잃습니다.
   * ⚠️ 그 키를 만드는 곳은 `precheck.html` 의 `query()` 하나여야 합니다.
   */
  assert.ok(!code(TRACK).includes('one_minute_check'),
    'track.js 가 canonical 키를 만집니다 — 그 키는 precheck.html 의 query() 몫입니다');
  assert.ok(read('precheck.html').includes("q.push('source=one_minute_check')"),
    'precheck.html 이 canonical 키를 더는 만들지 않습니다 — 축이 사라졌습니까?');
});

test('🔴 유입원 함수가 `utm_*` 를 건드리지 않는다 — 방문 계측 축과 다르다', () => {
  /*
   * `source()` 가 `utm_medium` 을 유입 «갈래» 판정에 씁니다(방문 계측). 이 축은 실행 행에
   * 남는 값이라 다릅니다. ⛔ 한쪽이 다른 쪽 값을 읽기 시작하면 두 축이 붙어 버립니다.
   */
  const s = code(TRACK);
  const fns = ['seedFrom', 'currentFrom']
    .map((n) => (s.match(new RegExp('function ' + n + '\\(\\)[\\s\\S]*?\\n  \\}')) || [''])[0])
    .join('\n');
  assert.ok(!fns.includes('utm_'), '유입원 함수가 utm_* 를 읽습니다');
  assert.ok(s.includes("p.get('utm_medium')"), 'source() 가 utm_medium 을 더는 안 읽습니다 — 축이 사라졌습니까?');
});

/* ══ ⑤ 열쇠가 없어도 유입원은 실린다 ═════════════════════════════════ */

test('🔴 유입원 부착이 열쇠 검사보다 «앞»이다 — 저장소가 막혀도 지면은 남는다', () => {
  /*
   * 🔴 **종전 리스너는 `if (!key) return;` 으로 곧바로 빠져나갔습니다.** 거기에 유입원을
   *    뒤에 얹으면 사생활 보호 모드처럼 저장소가 막힌 브라우저에서 **아무것도 붙지 않습니다.**
   *    열쇠는 못 이어도 유입원은 실어 보냅니다.
   * ⚠️ 위치로 잽니다 — 「있다」로만 재면 순서가 뒤집혀도 초록입니다.
   */
  const s = code(TRACK);
  const listener = s.match(/var APP_ORIGIN[\s\S]*?\}, true\);/);
  assert.ok(listener, '앱 링크 리스너를 찾지 못했습니다 — 검사가 헛돕니다');
  const body = listener[0];

  const at = body.indexOf("searchParams.set('from'");
  const keyAt = body.indexOf('ID.sessionKey');
  assert.ok(at > -1, '리스너가 from 을 붙이지 않습니다');
  assert.ok(keyAt > -1, '리스너가 방문 열쇠를 읽지 않습니다 — vs 부착이 사라졌습니까?');
  assert.ok(at < keyAt, 'from 부착이 열쇠 검사 뒤에 있습니다 — 저장소가 막히면 아무것도 안 붙습니다');

  /* 열쇠가 없을 때 «되돌아가지» 않는다 — 그 이른 반환이 되살아나면 위 순서가 무의미해집니다. */
  assert.ok(!/if\s*\(!key\)\s*return;/.test(body),
    '열쇠가 없을 때 곧바로 반환합니다 — 그러면 from 도 함께 사라집니다');
  assert.match(body, /if\s*\(key\)\s*url\.searchParams\.set\('vs', key\)/,
    '열쇠가 있을 때 vs 를 싣지 않습니다');
});

test('🔴 `vs` 부착이 그대로 살아 있다 — 이 배치가 건드린 자리라 함께 잰다', () => {
  const s = code(TRACK);
  assert.ok(s.includes("var APP_ORIGIN = 'https://app.trops.kr'"), '앱 오리진 상수가 없습니다');
  assert.match(s, /if\s*\(url\.origin !== APP_ORIGIN\)\s*return;/, '오리진 확인이 사라졌습니다');
  assert.match(s, /\}, true\);/, '캡처 단계 등록이 사라졌습니다 — 런타임 링크를 놓칩니다');
});

/* ══ ⑥ 지면 기본값을 «파생»한다 ══════════════════════════════════════ */

test('🔴 지면 기본값이 경로에서 파생된다 — 파일마다 상수를 심지 않는다', () => {
  const s = code(TRACK);
  const fn = (s.match(/function currentFrom\(\)[\s\S]*?\n  \}/) || [''])[0];
  assert.ok(fn, 'currentFrom 을 찾지 못했습니다');
  assert.match(fn, /location\.pathname/, '경로에서 파생하지 않습니다');
  assert.match(fn, /'precheck'/, 'precheck 기본값이 없습니다');
  assert.match(fn, /'landing'/, 'landing 기본값이 없습니다');

  /* 그 판정을 여기서 재현해 봅니다 — 정규식이 실제로 그렇게 가르는지. */
  const re = /^\/precheck(\.html)?(\/|$)/;
  /*
   * 🔴 **`.html` 꼴이 들어 있는 것은 실측 때문입니다** 〔2026-09-20〕 — 프로덕션은
   *    `cleanUrls:true` 라 `/precheck` 이지만 로컬 `dist/` 는 `/precheck.html` 입니다.
   *    처음 판정식이 그 꼴을 빼고 있었고, 브라우저로 눌러 보니 지면이 `landing` 으로
   *    떨어졌습니다. ⛔ `.html` 가지를 걷지 마십시오.
   * ⚠️ `/precheckers` 가 false 인 것도 함께 잽니다 — 꼬리를 안 닫으면 그것이 걸립니다.
   */
  for (const [path, want] of [
    ['/precheck', true], ['/precheck/', true], ['/precheck?x=1'.split('?')[0], true],
    ['/precheck.html', true], ['/precheck.html/', true],
    ['/', false], ['/en', false], ['/about', false], ['/precheckers', false],
    ['/precheck-old', false],
  ]) {
    assert.strictEqual(re.test(path), want, path + ' 의 지면 판정이 틀렸습니다');
  }
});

/* ══ ⑦ 방침이 늘어난 칸을 적는다 ═════════════════════════════════════ */

test('🔴 두 방침이 채널 코드를 적는다 — 안 적으면 방침이 거짓말을 한다', () => {
  /*
   * 🔴 §01 은 브라우저 저장소에 무엇이 있는지를 **열거**합니다(방문 열쇠 · trops_seen).
   *    칸이 하나 늘었으니 그 열거가 사실이 아니게 됩니다.
   * 🔴 **이 칸은 «보내는» 값입니다** — 나머지 둘과 다릅니다. 방침이 그 사실을 적어야 합니다.
   * ⚠️ 낱말이 아니라 약속을 잽니다(track-section 의 방침 검사와 같은 방식).
   */
  const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '');
  const ko = strip(read('privacy.html'));
  for (const must of ['<code>trops_vs_f</code>', '채널 코드', '<code>?from=</code>', '함께 보냅니다']) {
    assert.ok(ko.includes(must), 'privacy.html 이 안 적었습니다: ' + must);
  }
  const en = strip(read('en-privacy.html'));
  for (const must of ['<code>trops_vs_f</code>', 'channel code', '<code>?from=</code>', 'send it along']) {
    assert.ok(en.includes(must), 'en-privacy.html 이 안 적었습니다: ' + must);
  }
});

/* ══ ⑧ [대조] 검출기가 실제로 문다 ═══════════════════════════════════ */

test('[대조] 위 단정들이 «빈 문자열»을 재고 있지 않다', () => {
  const s = code(TRACK);
  assert.ok(s.length > 3000, '주석을 걷으니 코드가 ' + s.length + '자입니다 — 검사가 헛돕니다');
  for (const fn of ['seedFrom', 'currentFrom']) {
    assert.ok(new RegExp('function ' + fn + '\\(\\)').test(s), fn + ' 이 없습니다');
  }
  assert.ok(s.includes("var SS_FROM = 'trops_vs_f'"), 'SS_FROM 칸이 없습니다');
});

test('[대조] 「덮지 않는다」 검출기가 조건 없는 set 을 실제로 잡는다', () => {
  const guarded = "if (!url.searchParams.get('from')) url.searchParams.set('from', currentFrom());";
  const naked = "url.searchParams.set('from', currentFrom());";
  const re = /if\s*\(!\s*url\.searchParams\.get\('from'\)\)\s*url\.searchParams\.set\('from',/;
  assert.ok(re.test(guarded), '지켜진 꼴을 못 잡습니다');
  assert.ok(!re.test(naked), '조건 없는 set 을 통과시킵니다 — 검출기가 물지 않습니다');
});
