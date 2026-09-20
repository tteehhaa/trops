/**
 * quick-check-report.test.js — 1분 진단 «응답 집계» 검사 〔신설 2026-09-20〕
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **주소 계약과 다른 축입니다.** `test/precheck-handoff.test.js` 가 재는 것은
 *    「다음 화면으로 데려가는 짐」(`query()` → 카드 `href`)이고, 여기서 재는 것은
 *    「몇 명이 무엇을 보았는가」(`report()` → 앱 `POST /api/quick-check`)입니다.
 *    ⛔ 두 파일을 합치지 마십시오 — 합치면 「다음을 누르지 않은 사람」을 재는 자리가
 *       다시 없어집니다. 그 결손이 이 장치가 생긴 이유입니다.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **소스에 무엇이 적혀 있는가가 아니라 «실제로 나가는 몸통»을 잽니다.** 스크립트를
 *    얇은 DOM 위에서 돌리고 `navigator.sendBeacon` 으로 넘어온 Blob 을 열어 봅니다.
 *    이웃 파일(`precheck-handoff`)이 「글자만 남아 있으면 주소가 틀려도 green」이던
 *    시절을 겪고 같은 자리로 옮겨 왔습니다 — 그 교훈을 그대로 씁니다.
 *
 * ⚠️ **손잡이가 이웃 파일과 «닮았지만 따로»입니다.** 그쪽은 `href` 를 읽고 이쪽은 Blob 을
 *    읽습니다. 한 곳으로 빼면 `test/` 아래 공용 모듈이 생기는데, `node --test test/` 가
 *    그 디렉터리를 통째로 훑으므로 검사 아닌 파일이 검사로 실행됩니다. 사본을 둡니다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** 읽는 사람에게 «보이는» 글만 — 이 저장소는 주석에 옛 문장을 인용합니다. */
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '');

const source = read('precheck.html');
/** 스크립트 블록의 «코드»만 — 주석에 적힌 금지어(「sessionStorage 를 읽지 마십시오」)를 세지 않습니다. */
const SCRIPT = source
  .match(/<script>\s*(\(function\(\)\{[\s\S]*?\n\}\)\(\);)\s*<\/script>/)[1]
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** 이 방문의 열쇠 — 검사에서 넣어 주는 값입니다(실제 값은 `assets/track.js` 가 만듭니다). */
const VISIT = { sessionKey: 'k0000000000000000000000z', from: 'partner-abc' };

/**
 * precheck.html 의 IIFE 를 얇은 DOM 위에서 돌리고, 답을 채워 가며 «나간 요청»을 읽는 손잡이.
 */
function harness(visit) {
  const body = source.match(/<script>\s*(\(function\(\)\{[\s\S]*?\n\}\)\(\);)\s*<\/script>/);
  assert.ok(body, 'precheck.html 에서 스크립트 블록을 찾지 못했습니다');

  const nodes = new Map();
  const listeners = new Map();
  const node = (id) => {
    const el = {
      id,
      value: '',
      disabled: false,
      set textContent(v) { this._text = String(v); },
      get textContent() { return this._text === undefined ? '' : this._text; },
      innerHTML: '',
      style: {},
      addEventListener(type, fn) { if (type === 'change') listeners.set(id, fn); },
    };
    nodes.set(id, el);
    return el;
  };
  for (const id of ['sc', 'gn', 'gd', 'rows', 'f3', 'f3b', 'h3b', 'h1b', 'h4', 'nt', 'ns', 'paths',
                    'f1', 'f1b', 'f2', 'f4', 'f5']) node(id);

  /** 나간 요청들. ⚠️ 길이가 곧 「한 방문에 몇 번 보냈는가」입니다. */
  const sent = [];
  const win = new Map();

  /*
   * 🔴 **시계를 우리가 쥡니다** — 스크립트는 다섯이 찬 뒤 «조용해지면» 보냅니다(`QUIET_MS`).
   *    진짜 타이머를 쓰면 이 검사가 1.2초씩 자고, 「언제 보냈는가」를 잴 수가 없습니다.
   */
  let seq = 0;
  const timers = new Map();
  const setTimeout = (fn) => { timers.set(++seq, fn); return seq; };
  const clearTimeout = (id) => { timers.delete(id); };

  const document = { getElementById: (id) => nodes.get(id) || node(id), addEventListener() {} };
  const window = {
    addEventListener(type, fn) { win.set(type, fn); },
    tropsVisit: () => (visit === null ? undefined : { ...(visit || VISIT) }),
  };
  const navigator = {
    sendBeacon(url, blob) { sent.push({ url, blob }); return true; },
  };
  /* ⛔ fetch 를 주지 않습니다 — 폴백으로 내려가면 `ReferenceError` 로 «보이게» 깨집니다. */
  new Function('document', 'window', 'navigator', 'setTimeout', 'clearTimeout', body[1])(
    document, window, navigator, setTimeout, clearTimeout);

  return {
    /** 답을 채우고 «조용해질 때까지» 기다린 상태. 대부분의 검사가 보는 자리입니다. */
    fill(answers) {
      this.type(answers);
      return this.tick();
    },
    type(answers) {
      for (const [id, v] of Object.entries(answers)) {
        if (id === 'f3b') continue;
        nodes.get(id).value = v;
      }
      if (answers.f3 !== undefined) listeners.get('f3')();
      if (answers.f3b !== undefined) nodes.get('f3b').value = answers.f3b;
      listeners.get('f1')();
      return this;
    },
    /** 조용해진 시늉 — 예약된 것이 있으면 그때 나갑니다. */
    tick() {
      const fns = [...timers.values()];
      timers.clear();
      for (const fn of fns) fn();
      return this;
    },
    /** 한 칸씩 고르는 시늉 — 「문항마다 보내지 않는다」를 재려면 한 번에 채우면 안 됩니다. */
    pick(id, v) {
      if (id === 'f3b') nodes.get('f3b').value = v;
      else nodes.get(id).value = v;
      (listeners.get(id) || listeners.get('f1'))();
      return this;
    },
    leave() { const fn = win.get('pagehide'); assert.ok(fn, 'pagehide 를 안 걸었습니다'); fn(); return this; },
    count() { return sent.length; },
    last() { return sent[sent.length - 1]; },
    async body() {
      assert.equal(sent.length, 1, '보낸 요청이 하나가 아닙니다: ' + sent.length);
      return JSON.parse(await sent[0].blob.text());
    },
    hrefs() {
      const out = [...nodes.get('paths').innerHTML.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      return out.find((u) => u.includes('export-precheck'));
    },
    score() { return nodes.get('sc').textContent; },
  };
}

/** 다섯 축을 다 고른 한 벌 — 이웃 파일과 «같은» 한 벌입니다(두 축을 맞대어 보려고). */
const FULL = { f3: '11', f3b: 'AE', f5: '11', f1: 'lc', f1b: 'postpaid', f2: '12', f4: '0' };

/* ══ ① 어디로 · 어떤 형식으로 ═════════════════════════════════════════════ */

test('앱의 «다른 문»으로 보낸다 — 방문 계측 `/api/track` 에 얹지 않는다', () => {
  const h = harness().fill(FULL);
  assert.equal(h.last().url, 'https://app.trops.kr/api/quick-check');
  /*
   * 🔴 그 표(`web_event`)는 조회·클릭의 축이고 「개인 식별자 0 · 추론값 칸 0」을 스스로
   *    적어 두었습니다. 답과 점수를 그리로 더하면 사람 방문 집계가 오염됩니다.
   */
  assert.ok(!source.includes("'https://app.trops.kr/api/track'"),
    '1분 진단 응답을 방문 계측 문으로 보냅니다 — 표가 두 뜻을 갖습니다');
});

test('🔴 text/plain 으로 보낸다 — json 이면 preflight 가 붙고 sendBeacon 이 조용히 죽는다', () => {
  /*
   * ⚠️ 받는 쪽은 선언된 형식과 무관하게 본문을 파싱합니다(2026-09-20 실측 — 두 형식 다 202).
   *    그래서 «안전 목록»인 쪽을 고릅니다. `assets/track.js` 가 2026-09-04 에 같은 자리에서
   *    데었습니다.
   */
  /* ⚠️ `Blob` 이 형식을 소문자로 정규화합니다(브라우저도 같습니다) — 안전 목록 판정은 그대로입니다. */
  assert.equal(harness().fill(FULL).last().blob.type.toLowerCase(), 'text/plain;charset=utf-8');
  assert.ok(!/QUICK_TYPE='application\/json/.test(source), 'json 으로 되돌렸습니다');
});

/* ══ ② 한 방문에 한 번 ════════════════════════════════════════════════════ */

test('🔴 문항마다 보내지 않는다 — 다섯이 찬 뒤 «한 번»이다', async () => {
  const h = harness();
  assert.equal(h.count(), 0, '아무것도 고르기 전에 보냈습니다');
  h.pick('f3', '11'); h.pick('f3b', 'AE'); h.pick('f5', '11');
  h.pick('f1', 'lc'); h.pick('f1b', 'postpaid'); h.pick('f2', '12');
  h.tick();
  assert.equal(h.count(), 0, '다섯이 차기 전에 보냈습니다');
  h.pick('f4', '0');
  h.tick();
  assert.equal(h.count(), 1, '다섯이 찬 뒤 한 번 나가야 합니다');
  assert.equal((await h.body()).totalScore, Number(h.score()));
});

test('🔴 «마지막에» 고른 목적 국가도 실린다 — 그 칸은 완성 판정에 안 들어간다', async () => {
  /*
   * 🔴 이것이 `QUIET_MS` 가 있는 이유입니다. 나머지를 다 고르고 국가를 마지막에 고르시면,
   *    완성되는 «순간» 보내는 구현에서는 국가가 영영 안 실립니다. 실측으로 겪었습니다.
   */
  const h = harness();
  h.pick('f3', '11'); h.pick('f5', '11'); h.pick('f1', 'lc');
  h.pick('f1b', 'postpaid'); h.pick('f2', '12'); h.pick('f4', '0');
  h.pick('f3b', 'AE');
  h.tick();
  const b = await h.body();
  assert.equal(b.country, 'AE', '마지막에 고른 국가를 놓쳤습니다');
});

test('🔴 고쳐 넣은 답이 나간다 — 조용해지기 전에 바꾸면 그 값으로 다시 기다린다', async () => {
  const h = harness();
  h.type(FULL);                 /* 아직 안 보냈습니다 */
  assert.equal(h.count(), 0, '조용해지기 전에 보냈습니다');
  h.pick('f4', '15');           /* 무역보험을 「가입을 마쳤습니다」로 고칩니다 */
  h.tick();
  const b = await h.body();
  assert.equal(b.insuranceStatus, 'insured', '고치기 «전» 답을 보냈습니다');
  assert.equal(b.totalScore, 11 + 11 + 22 + 12 + 15);
});

test('🔴 기다리는 사이에 「다음」을 누르면 곧바로 나간다 — 기다리다 잃지 않는다', async () => {
  const h = harness();
  h.type(FULL);
  assert.equal(h.count(), 0);
  h.leave();                    /* pagehide */
  assert.equal(h.count(), 1, '떠나는데 기다리고 있었습니다');
  assert.equal((await h.body()).totalScore, 56);
  h.tick();
  assert.equal(h.count(), 1, '예약이 남아 두 번 나갔습니다');
});

test('🔴 답을 고쳐도 두 번 보내지 않는다 — 한 방문이 완료 둘로 세어지면 ⓐ 가 망가진다', () => {
  const h = harness().fill(FULL);
  assert.equal(h.count(), 1);
  h.pick('f4', '15');
  h.pick('f2', '20');
  h.tick();
  h.leave();
  assert.equal(h.count(), 1, '한 방문에서 두 번 보냈습니다');
});

test('🔴 「다음」을 누르기 전에 나간다 — 누른 사람만 세면 이 장치가 있을 이유가 없다', () => {
  /* 카드(=「다음」)는 그려져 있고, 요청은 «이미» 나가 있습니다. */
  const h = harness().fill(FULL);
  assert.ok(h.hrefs().startsWith('https://app.trops.kr/export-precheck/new?'), '카드가 없습니다');
  assert.equal(h.count(), 1, '카드를 눌러야만 세어집니다');
});

/* ══ ③ 무엇을 보내는가 ════════════════════════════════════════════════════ */

test('값 어휘가 주소 계약과 «같다» — 앱은 허용 목록을 두지 않아 랜딩이 어휘의 주인이다', async () => {
  const h = harness().fill(FULL);
  const b = await h.body();
  const p = new URL(h.hrefs()).searchParams;

  assert.equal(b.region, p.get('region'));
  assert.equal(b.country, p.get('country'));
  assert.equal(b.buyerStage, p.get('buyer_stage'));
  assert.equal(b.paymentMethod, p.get('payment_method'));
  assert.equal(b.paymentReceipt, p.get('payment_receipt'));
  assert.equal(b.paymentPeriodBand, p.get('payment_period_band'));
  assert.equal(b.insuranceStatus, p.get('insurance_status'));
  assert.equal(b.focus, p.get('focus'));

  /* 실측값 한 벌 — 위 대조가 「둘 다 undefined」로 조용히 통과하지 않게 못을 박습니다. */
  assert.equal(b.region, 'middle_east_latin_eastern_europe');
  assert.equal(b.paymentPeriodBand, 'within_60d');
  assert.equal(b.insuranceStatus, 'not_insured');
});

test('점수는 0~100 정수이고, 축 다섯의 합이다', async () => {
  const b = await harness().fill(FULL).body();
  assert.equal(b.totalScore, 11 + 11 + 22 + 12 + 0);
  assert.ok(Number.isInteger(b.totalScore) && b.totalScore >= 0 && b.totalScore <= 100);
  assert.deepEqual(Object.keys(b.axisScores).sort(), ['buyer', 'ins', 'pay', 'region', 'term']);
  const sum = Object.values(b.axisScores).reduce((a, n) => a + n, 0);
  assert.equal(sum, b.totalScore, '축의 합과 총점이 다릅니다');
});

test('방문 열쇠와 채널 코드는 track.js 가 내준 것을 그대로 싣는다', async () => {
  const b = await harness().fill(FULL).body();
  assert.equal(b.sessionKey, VISIT.sessionKey);
  assert.equal(b.from, VISIT.from);
  /*
   * ⛔ 저장소 키 이름은 `assets/track.js` 의 것입니다 — 이 파일이 다시 적으면 이름이 바뀌는 날
   *    한쪽만 고쳐지고 두 계측이 조용히 갈라집니다.
   */
  assert.ok(!SCRIPT.includes('trops_vs'), 'precheck.html 이 저장소 키 이름을 다시 적습니다');
  assert.ok(!SCRIPT.includes('sessionStorage'), 'precheck.html 이 저장소를 직접 읽습니다');
  assert.ok(read('assets/track.js').includes('window.tropsVisit = function'),
    'track.js 가 손잡이를 안 내줍니다 — 랜딩 점수와 앱 실행이 이어지지 않습니다');
});

test('track.js 가 내주는 `from` 은 «원문»이다 — 지면 기본값을 제휴 코드로 섞지 않는다', () => {
  /*
   * `currentFrom()` 의 `landing`·`precheck` 는 «링크에 붙이는» 값입니다. 그것을 제휴 귀속
   * 축에 섞으면 제휴가 아닌 방문이 전부 제휴로 세어집니다(정산이 걸린 축입니다 · 0075).
   */
  const t = read('assets/track.js');
  const fn = t.match(/window\.tropsVisit = function[\s\S]*?\n  \};/);
  assert.ok(fn, 'tropsVisit 을 못 찾았습니다');
  assert.ok(fn[0].includes('ssGet(SS_FROM)'), '원문이 아니라 다른 값을 내줍니다');
  assert.ok(!fn[0].includes('currentFrom'), '지면 기본값을 제휴 코드 자리에 섞었습니다');
});

test('🔴 track.js 가 없어도(차단돼도) 답과 점수는 나간다 — 열쇠만 빠진다', async () => {
  const b = await harness(null).fill(FULL).body();
  assert.equal(b.sessionKey, undefined);
  assert.equal(b.from, undefined);
  assert.equal(b.totalScore, 56, '열쇠가 없다고 본문까지 접었습니다');
});

/* ══ ④ 끝내지 «않은» 방문 ═════════════════════════════════════════════════ */

test('🔴 도중에 그만둔 분도 떠날 때 한 번 보낸다 — 그래야 이탈이 보인다', async () => {
  const h = harness().fill({ f3: '11', f3b: 'AE', f5: '11', f1: '', f1b: '', f2: '', f4: '' });
  assert.equal(h.score(), '—');
  assert.equal(h.count(), 0, '미완성인데 그 자리에서 보냈습니다');
  h.leave();
  const b = await h.body();
  assert.equal(b.region, 'middle_east_latin_eastern_europe');
  assert.equal(b.buyerStage, 'two_or_three');
  /* 🔴 본 적 없는 점수를 지어내지 않습니다 — 화면에도 「—」가 떠 있습니다. */
  assert.equal(b.totalScore, undefined, '미완성에 점수를 실었습니다');
  assert.equal(b.paymentMethod, undefined);
  /* 고른 축만 담습니다 — 안 고른 축에 0을 넣으면 「0점」과 「안 고름」이 한 무리가 됩니다. */
  assert.deepEqual(Object.keys(b.axisScores).sort(), ['buyer', 'region']);
});

test('🔴 아무것도 고르지 않은 방문은 아예 보내지 않는다', () => {
  const h = harness();
  h.leave();
  assert.equal(h.count(), 0, '빈 요청을 보냈습니다');
});

test('전액 선지급이면 보험 «답»은 안 보내고 축 점수만 간다', async () => {
  const h = harness().fill({ ...FULL, f1b: 'prepaid', f4: '0' });
  const b = await h.body();
  assert.equal(b.insuranceStatus, undefined, '고르지 않은 보험 답을 보냈습니다');
  assert.equal(b.axisScores.ins, 15, '만점 처리한 축 점수가 빠졌습니다');
  assert.equal(b.paymentReceipt, 'prepaid');
});

/* ══ ⑤ 개인 식별자 ════════════════════════════════════════════════════════ */

test('🔴 개인 식별자를 담지 않는다 — 계약에 없는 칸이 붙으면 red 다', async () => {
  const b = await harness().fill(FULL).body();
  const allowed = ['sessionKey', 'from', 'region', 'country', 'buyerStage', 'paymentMethod',
                   'paymentReceipt', 'paymentPeriodBand', 'insuranceStatus', 'focus',
                   'axisScores', 'totalScore'];
  for (const k of Object.keys(b)) {
    assert.ok(allowed.includes(k), '계약에 없는 칸이 붙었습니다: ' + k);
  }
  for (const bad of ['name', 'email', 'phone', 'company', 'ip', 'userAgent']) {
    assert.ok(!(bad in b), '개인 식별자를 담았습니다: ' + bad);
  }
  /* 보내는 쪽 코드가 아예 만지지 않는다 — 앱이 버린다는 사실에 기대지 않습니다. */
  const js = source.match(/function reportBody\(\)[\s\S]*?\n  \}/)[0];
  for (const bad of ['userAgent', 'document.cookie', 'localStorage']) {
    assert.ok(!js.includes(bad), '보내는 몸통이 ' + bad + ' 을 만집니다');
  }
});

/* ══ ⑥ 화면과 방침이 같은 말을 한다 ═══════════════════════════════════════ */

test('🔴 화면이 더는 「입력값은 저장하지 않습니다」라고 말하지 않는다', () => {
  /*
   * 🔴 이 한 줄이 이 배치의 «전부»입니다 — 답과 점수를 보내면서 그 약속을 남겨 두면
   *    페이지가 거짓말을 합니다. 2026-09-20 이전에는 `.disc` 첫 문장이 그것이었습니다.
   */
  assert.ok(!strip(source).includes('입력값은 저장하지 않습니다'),
    'precheck.html 이 「안 보낸다」고 하면서 보내고 있습니다');
  const disc = strip(source).match(/<div class="disc">([\s\S]*?)<\/div>/);
  assert.ok(disc, '.disc 가 사라졌습니다');
  assert.ok(disc[1].includes('이름·연락처·회사명은 보내지 않습니다'), '무엇을 안 보내는지 안 적었습니다');
  assert.ok(disc[1].includes('점수는 주소에 담지 않습니다'), '주소 계약 설명이 사라졌습니다');
});

test('🔴 방침이 이 집계를 적는다 — 안 적으면 방침이 거짓말을 한다', () => {
  const ko = strip(read('privacy.html'));
  for (const must of [
    '1분 진단',
    '고르신 답과 화면에 뜬 점수',
    '100점 만점 점수',
    '도중에 그만두신 경우에도',
    '이름 &middot; 연락처 &middot; 회사명은 보내지 않습니다',
  ]) {
    assert.ok(ko.includes(must), 'privacy.html 이 안 적었습니다: ' + must);
  }
});

test('🔴 영어 방침도 같은 말을 한다', () => {
  const en = strip(read('en-privacy.html'));
  for (const must of [
    'one-minute check',
    'the answers you choose and the score you see',
    'score out of 100',
    'even if you leave part way through',
    'We do not send your name, contact details or company name',
  ]) {
    assert.ok(en.includes(must), 'en-privacy.html 이 안 적었습니다: ' + must);
  }
});
