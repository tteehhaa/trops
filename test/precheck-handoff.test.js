/**
 * precheck.html 의 **Handoff Sender** 검사 〔v2 로 다시 씀 2026-09-05〕.
 *
 * 🔴 **문자열이 아니라 «만들어진 주소»를 잽니다.** 종전 이 파일은 소스에 특정 코드
 *    조각(`if(!(prepaid&&f.key==='ins')&&f.send&&f.cd[v])`)이 «글자 그대로» 있는지를
 *    봤습니다. 뜻은 맞았지만 그 줄을 손대는 순간 red 가 났고, 정작 **주소가 틀려도**
 *    글자만 남아 있으면 green 이었습니다. 이제 스크립트를 실제로 돌려 두 카드의
 *    `href` 를 읽습니다.
 *
 * 정본 = 앱 `lib/handoff/contract-v2.ts`(canonical 여덟 + legacy 여덟).
 * ⚠️ 이 파일은 DOM 을 아주 얇게 흉내 냅니다 — 스크립트가 쓰는 것만 있습니다.
 *    스크립트가 새 DOM 기능을 쓰기 시작하면 여기도 함께 늘려야 합니다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'precheck.html'), 'utf8');

/** precheck.html 의 IIFE 를 얇은 DOM 위에서 돌리고, 값을 바꿔 가며 주소를 읽는 손잡이. */
function harness() {
  const body = source.match(/<script>\s*(\(function\(\)\{[\s\S]*?\n\}\)\(\);)\s*<\/script>/);
  assert.ok(body, 'precheck.html 에서 스크립트 블록을 찾지 못했습니다');

  const nodes = new Map();
  const listeners = new Map();
  const node = (id) => {
    const el = {
      id,
      value: '',
      disabled: false,
      /* 진짜 DOM 은 무엇을 넣어도 문자열로 바꿔 담습니다 — 숫자를 그대로 두면
         「100 !== '100'」 같은 «흉내 탓» 실패가 납니다. */
      set textContent(v) { this._text = String(v); },
      get textContent() { return this._text === undefined ? '' : this._text; },
      innerHTML: '',
      style: {},
      addEventListener(type, fn) {
        if (type === 'change') listeners.set(id, fn);
      },
    };
    nodes.set(id, el);
    return el;
  };
  for (const id of ['sc', 'gn', 'gd', 'rows', 'f3', 'f3b', 'h3b', 'h1b', 'h4', 'nt', 'ns', 'paths',
                    'f1', 'f1b', 'f2', 'f4', 'f5']) node(id);

  const document = { getElementById: (id) => nodes.get(id) || node(id) };
  new Function('document', body[1])(document);

  return {
    /** 답을 채우고 한 번 다시 그린다. `f3b`(국가)는 권역이 정해진 뒤라야 채울 수 있다. */
    fill(answers) {
      for (const [id, v] of Object.entries(answers)) {
        if (id === 'f3b') continue;
        nodes.get(id).value = v;
      }
      if (answers.f3 !== undefined) listeners.get('f3')();   // 국가 목록을 다시 만든다
      if (answers.f3b !== undefined) nodes.get('f3b').value = answers.f3b;
      listeners.get('f1')();
      return this;
    },
    hrefs() {
      const out = [...nodes.get('paths').innerHTML.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      assert.equal(out.length, 2, '다음 단계 카드가 둘이 아닙니다');
      return { diag: out[0].includes('export-precheck') ? out[0] : out[1],
               pack: out[0].includes('insurance') ? out[0] : out[1] };
    },
    params(url) { return new URL(url).searchParams; },
    score() { return nodes.get('sc').textContent; },
    insDisabled() { return nodes.get('f4').disabled; },
  };
}

/** 다섯 축을 다 고른 «완성» 한 벌. 목적국 아랍에미리트 · 두세 번 · L/C 전액 후불 · 60일 · 미가입. */
const FULL = { f3: '11', f3b: 'AE', f5: '11', f1: 'lc', f1b: 'postpaid', f2: '12', f4: '0' };

test('canonical 여덟을 보낸다 — 이름도 값도 앱 수신기의 어휘 그대로다', () => {
  const p = harness().fill(FULL).params(harness().fill(FULL).hrefs().diag);
  assert.equal(p.get('source'), 'one_minute_check');
  assert.equal(p.get('handoff_v'), '2');
  assert.equal(p.get('country'), 'AE');
  assert.equal(p.get('buyer_stage'), 'two_or_three');
  assert.equal(p.get('payment_method'), 'lc');
  assert.equal(p.get('payment_receipt'), 'postpaid');
  assert.equal(p.get('payment_period_band'), 'within_60d');
  assert.equal(p.get('insurance_status'), 'not_insured');
});

test('legacy 를 함께 보낸다 — 앱이 옛 이름을 그만 읽는 날까지 지우지 않는다', () => {
  const p = harness().fill(FULL).params(harness().fill(FULL).hrefs().diag);
  assert.equal(p.get('region'), 'middle_east_latin_eastern_europe');
  assert.equal(p.get('buyer'), 'two_or_three');
  assert.equal(p.get('term'), 'd60');
  assert.equal(p.get('ins'), 'not_insured');
  assert.equal(p.get('dest'), 'AE');
  assert.equal(p.get('pay'), 'lc');
});

test('두 카드가 «같은» 값을 싣는다 — 준비패키지에서 다시 묻지 않는다', () => {
  const h = harness().fill(FULL);
  const { diag, pack } = h.hrefs();
  const [a, b] = [h.params(diag), h.params(pack)];
  for (const k of ['source', 'handoff_v', 'country', 'buyer_stage', 'payment_method',
                   'payment_receipt', 'payment_period_band', 'insurance_status']) {
    assert.equal(b.get(k), a.get(k), `준비패키지 주소에 ${k} 가 다릅니다`);
  }
  // 🔴 출처 단서 — Referrer-Policy 때문에 도메인을 넘는 유일한 표지다.
  assert.equal(b.get('from'), 'precheck');
  assert.ok(pack.startsWith('https://app.trops.kr/insurance/quick?'), '준비패키지 목적지가 바뀌었습니다');
  assert.ok(diag.startsWith('https://app.trops.kr/export-precheck/new?'), '사전점검 목적지가 바뀌었습니다');
});

test('없는 칸을 지어내지 않는다 — T/T 는 옛 `pay` 여섯에 대응이 없다', () => {
  const h = harness().fill({ ...FULL, f1: 'tt', f1b: 'postpaid' });
  const p = h.params(h.hrefs().diag);
  assert.equal(p.get('payment_method'), 'tt');
  assert.equal(p.get('payment_receipt'), 'postpaid');
  assert.equal(p.get('pay'), null, 'legacy pay 를 지어냈습니다');
});

test('옛 한 칸은 «시점»이 먼저 정한다 — 선지급·선금잔금은 방식보다 앞선다', () => {
  for (const [receipt, legacy] of [['prepaid', 'prepay'], ['split', 'partial']]) {
    const h = harness().fill({ ...FULL, f1: 'da', f1b: receipt });
    assert.equal(h.params(h.hrefs().diag).get('pay'), legacy, `${receipt} 의 legacy pay 가 다릅니다`);
  }
});

test('전액 선지급의 계산용 보험 만점을 가입 답변으로 넘기지 않는다', () => {
  const h = harness().fill({ ...FULL, f1b: 'prepaid', f4: '0' });
  const p = h.params(h.hrefs().diag);
  assert.ok(h.insDisabled(), '전액 선지급인데 보험 칸이 잠기지 않았습니다');
  assert.equal(p.get('insurance_status'), null, '고르지 않은 보험 답을 넘겼습니다');
  assert.equal(p.get('ins'), null, '고르지 않은 보험 답을 legacy 로 넘겼습니다');
});

test('질문이 늘어도 축은 다섯이고 만점은 100 그대로다', () => {
  const h = harness().fill({ f3: '20', f3b: 'US', f5: '15', f1: 'lc', f1b: 'prepaid', f2: '20', f4: '15' });
  assert.equal(h.score(), '100', '다섯 축 만점이 100이 아닙니다');
  assert.equal(harness().fill(FULL).score(), String(11 + 11 + 22 + 12 + 0));
});

test('가장 낮은 축의 영역만 focus 로 넘긴다 — 만점이면 보내지 않는다', () => {
  const low = harness().fill(FULL);                    // 무역보험 0/15 가 최저
  assert.equal(low.params(low.hrefs().diag).get('focus'), 'payment');
  const perfect = harness().fill({ f3: '20', f3b: 'US', f5: '15', f1: 'lc', f1b: 'prepaid', f2: '20', f4: '15' });
  assert.equal(perfect.params(perfect.hrefs().diag).get('focus'), null, '만점인데 최저 축을 보냈습니다');
});

test('미완성이면 점수를 만들지 않는다 — 고른 답은 그래도 넘어간다', () => {
  const h = harness().fill({ f3: '11', f3b: 'AE', f5: '', f1: 'lc', f1b: '', f2: '', f4: '' });
  assert.equal(h.score(), '—');
  const p = h.params(h.hrefs().diag);
  assert.equal(p.get('country'), 'AE');
  assert.equal(p.get('payment_method'), null, '수취조건 없이 결제방식만 넘겼습니다');
});

test('개인 식별자를 주소에 얹지 않는다', () => {
  const h = harness().fill(FULL);
  const { diag, pack } = h.hrefs();
  for (const url of [diag, pack]) {
    for (const k of [...new URL(url).searchParams.keys()]) {
      assert.ok(
        ['source', 'handoff_v', 'country', 'buyer_stage', 'payment_method', 'payment_receipt',
         'payment_period_band', 'insurance_status', 'region', 'buyer', 'term', 'ins', 'dest',
         'pay', 'focus', 'from'].includes(k),
        `계약에 없는 파라미터가 붙었습니다: ${k}`
      );
    }
  }
});
