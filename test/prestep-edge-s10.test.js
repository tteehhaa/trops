/*
 * 사전 확인 엣지 케이스 검사 〔prestep-edge-s10 · 신설 2026-08-15 · bkit-11〕
 *
 *   npm test        (node --test test/)
 *
 * 정본: doc/s10/TROPS_사전확인_구현계획서_v1.md §9 (에러·엣지 케이스 표)
 *       doc/s10/TROPS_사전확인_설계서_v3.md §2-6 · §5-1
 *
 * ── 왜 따로 있는가 ──────────────────────────────────────────────────────────
 * test/prestep-flow-s10.test.js 는 **마크업과 스크립트 원문**을 읽습니다. 문구가 곧
 * 기능인 자리를 지키기에는 그것으로 충분하지만, §9 의 엣지 케이스 넷은 원문 검사로는
 * 잡히지 않습니다 — 「상호배제가 코드에 있다」와 「상호배제가 실제로 작동한다」는
 * 다른 문장이고, 조건 한 줄이 뒤집혀도 원문 검사는 통과하기 때문입니다.
 *
 * 그래서 이 파일은 check.html 의 <script> 를 **그대로 실행**합니다. 마크업도 같은
 * 파일에서 파싱해 세우므로, 보기가 하나 늘거나 id 가 바뀌면 여기가 먼저 깨집니다.
 *
 * ⚠️ 아래 DOM 대역은 이 스크립트가 쓰는 만큼만 있습니다(getElementById ·
 *    querySelector · getElementsByTagName · hidden · textContent · 버블링 이벤트).
 *    **브라우저를 흉내 내는 물건이 아닙니다.** 스크립트가 새 DOM API 를 쓰기 시작하면
 *    여기에 그 자리를 만들어야 합니다 — 조용히 통과시키지 마십시오. 그럴 바에는
 *    실패하는 편이 낫습니다.
 * ⚠️ 저장(fetch)·보관(sessionStorage)·타이머는 전부 가짜입니다. 타이머는 자동으로
 *    돌지 않고 flush() 를 불러야 돕니다 — 디바운스(600ms) 를 실제로 기다리지 않기
 *    위해서입니다.
 *
 * ── JS 비활성(§9 마지막 행)에 대하여 ────────────────────────────────────────
 * 이 케이스만 실행 검사가 아니라 마크업 검사입니다. 스크립트를 실행하지 않는 상황을
 * 스크립트로 재현할 수는 없기 때문입니다. 무엇을 잠갔고 무엇이 아직 안 잠겼는지는
 * 아래 1번 구획 머리말에 적어 두었습니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'check.html'), 'utf8');

/** 주석 없는 마크업. 이 저장소는 주석을 인수인계 수단으로 쓰고 빌드가 떼어냅니다. */
const M = RAW.replace(/<!--[\s\S]*?-->/g, '');
/** 사람 눈에 보이는 본문만 — <style>·<script> 를 걷어낸 것. */
const B = M.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
/** 페이지 스크립트 본문(주석 포함 · 실행할 것이므로 걷지 않습니다). */
const SCRIPT = RAW.match(/<script>([\s\S]*?)<\/script>/)[1];

/* ══════════════════════════════════════════════════════════════════════════
   DOM 대역 — check.html 의 <script> 를 돌리기 위한 최소한
   ══════════════════════════════════════════════════════════════════════════ */

const VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1 };

class El {
  constructor(tag, attrs) {
    this.tagName = tag;
    this.attrs = attrs || {};
    this.childNodes = [];
    this.parentNode = null;
    this._listeners = {};
    /* hidden 은 속성이자 프로퍼티입니다 — 스크립트는 프로퍼티로만 씁니다. */
    this._hidden = Object.prototype.hasOwnProperty.call(this.attrs, 'hidden');
    this.checked = Object.prototype.hasOwnProperty.call(this.attrs, 'checked');
  }

  get id() { return this.attrs.id || ''; }
  get name() { return this.attrs.name || ''; }
  get type() { return this.attrs.type || ''; }
  get value() { return this.attrs.value || ''; }
  set value(v) { this.attrs.value = v; }
  get href() { return this.attrs.href || ''; }
  set href(v) { this.attrs.href = v; }
  get hidden() { return this._hidden; }
  set hidden(v) { this._hidden = !!v; }

  get textContent() {
    let out = '';
    for (const kid of this.childNodes) out += kid.isText ? kid.data : kid.textContent;
    return out;
  }
  set textContent(v) {
    this.childNodes = [{ isText: true, data: String(v) }];
  }

  /** 지원 선택자: `tag` · `.class` · `[attr]`. 그 밖은 던집니다 — 조용한 통과 금지. */
  matches(sel) {
    if (sel[0] === '.') return (' ' + (this.attrs.class || '') + ' ').indexOf(' ' + sel.slice(1) + ' ') !== -1;
    if (sel[0] === '[') return Object.prototype.hasOwnProperty.call(this.attrs, sel.slice(1, -1));
    if (/^[a-zA-Z0-9]+$/.test(sel)) return this.tagName === sel.toLowerCase();
    throw new Error('DOM 대역이 모르는 선택자입니다: ' + sel + ' — 대역에 자리를 만드십시오');
  }

  descendants(out) {
    out = out || [];
    for (const kid of this.childNodes) {
      if (kid.isText) continue;
      out.push(kid);
      kid.descendants(out);
    }
    return out;
  }

  querySelectorAll(sel) { return this.descendants().filter((n) => n.matches(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getElementsByTagName(tag) { return this.querySelectorAll(tag); }

  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }

  focus() { this.attrs['data-test-focused'] = '1'; }
}

function parseAttrs(src) {
  const out = {};
  const re = /([a-zA-Z][a-zA-Z0-9-]*)(?:\s*=\s*"([^"]*)")?/g;
  let m;
  while ((m = re.exec(src)) !== null) out[m[1].toLowerCase()] = m[2] === undefined ? '' : m[2];
  return out;
}

/** check.html 의 본문을 세웁니다. 태그 수프용 스캐너 — 이 파일 한 벌만 봅니다. */
function parse(html) {
  const root = new El('#root', {});
  const stack = [root];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    const here = stack[stack.length - 1];
    if (lt === -1) {
      if (i < html.length) here.childNodes.push({ isText: true, data: html.slice(i) });
      break;
    }
    if (lt > i) here.childNodes.push({ isText: true, data: html.slice(i, lt) });
    const gt = html.indexOf('>', lt);
    if (gt === -1) break;
    const raw = html.slice(lt + 1, gt);
    i = gt + 1;
    if (raw[0] === '!' || raw[0] === '?') continue;             /* <!DOCTYPE …> */
    if (raw[0] === '/') {
      const close = raw.slice(1).trim().toLowerCase();
      for (let s = stack.length - 1; s > 0; s -= 1) {
        if (stack[s].tagName === close) { stack.length = s; break; }
      }
      continue;
    }
    const head = /^([a-zA-Z0-9]+)([\s\S]*)$/.exec(raw);
    if (!head) continue;
    const tag = head[1].toLowerCase();
    const node = new El(tag, parseAttrs(head[2]));
    node.parentNode = here;
    here.childNodes.push(node);
    if (!VOID[tag] && !/\/\s*$/.test(raw)) stack.push(node);
  }
  return root;
}

/**
 * 페이지를 한 벌 세우고 스크립트를 돌립니다.
 *
 * @param {object} [opts]
 * @param {'ok'|'blocked'} [opts.storage]  'blocked' 은 시크릿·저장소 차단 재현(§9).
 * @param {string} [opts.seed]             sessionStorage 에 미리 들어 있는 원문.
 * @param {boolean} [opts.crypto]          false 면 crypto.randomUUID 미지원 재현(§9).
 */
function boot(opts) {
  opts = opts || {};
  const root = parse(B);

  const byId = new Map();
  for (const node of root.descendants()) if (node.id && !byId.has(node.id)) byId.set(node.id, node);

  /* ── 보관 대역 ── */
  const bag = { [ 'trops.prestep.v1' ]: opts.seed };
  const storage = {
    getItem(k) {
      if (opts.storage === 'blocked') throw new Error('저장소 차단');
      return bag[k] === undefined ? null : bag[k];
    },
    setItem(k, v) {
      if (opts.storage === 'blocked') throw new Error('저장소 차단');
      bag[k] = v;
    },
  };

  /* ── 저장 대역 ── 보낸 본문을 그대로 쌓아 둡니다. */
  const sent = [];
  const fetch = (url, init) => {
    sent.push({ url, keepalive: init.keepalive === true, body: JSON.parse(init.body) });
    return Promise.resolve({ ok: true });
  };

  /* ── 타이머 대역 ── 자동으로 돌지 않습니다. flush() 가 돌립니다. */
  let seq = 0;
  const pending = new Map();
  const sandbox = {
    window: {
      sessionStorage: storage,
      fetch,
      crypto: opts.crypto === false ? undefined : { randomUUID: () => 'uuid-fixed-0000' },
    },
    document: {
      referrer: '',
      getElementById: (id) => byId.get(id) || null,
      querySelectorAll: (sel) => root.querySelectorAll(sel),
      addEventListener: () => {},
    },
    setTimeout: (fn) => { seq += 1; pending.set(seq, fn); return seq; },
    clearTimeout: (id) => { pending.delete(id); },
  };

  vm.runInNewContext(SCRIPT, sandbox, { filename: 'check.html <script>' });

  function flush() {
    const due = Array.from(pending.values());
    pending.clear();
    for (const fn of due) fn();
  }

  /** 이벤트는 버블링합니다 — change 리스너가 보기가 아니라 .opt-list 에 걸려 있습니다. */
  function fire(node, type, extra) {
    const ev = Object.assign({ type, target: node, preventDefault() {} }, extra);
    let cur = node;
    while (cur) {
      const fns = cur._listeners[type];
      if (fns) for (const fn of fns.slice()) fn.call(cur, ev);
      cur = cur.parentNode;
    }
  }

  const el = (id) => byId.get(id) || null;

  /** 보기 하나를 고릅니다. 라디오는 브라우저처럼 같은 name 을 풀어 줍니다. */
  function pick(stepId, value, on) {
    const group = el(stepId + '-opts');
    const list = group.getElementsByTagName('input');
    const hit = list.find((n) => n.value === value);
    assert.ok(hit, stepId + ' 에 보기가 없습니다: ' + value);
    hit.checked = on === undefined ? true : !!on;
    if (hit.type === 'radio' && hit.checked) {
      for (const other of list) if (other !== hit && other.name === hit.name) other.checked = false;
    }
    fire(hit, 'change');
    return hit;
  }

  function checkedValues(stepId) {
    return el(stepId + '-opts').getElementsByTagName('input').filter((n) => n.checked).map((n) => n.value);
  }

  function click(id) { fire(el(id), 'click'); }

  /** 단계의 [건너뛰기]를 누릅니다. */
  function skip(stepId) { fire(el(stepId).querySelector('[data-skip]'), 'click'); }

  /** 지금 보이는 화면 하나. */
  function visible() {
    const ids = ['step-1', 'step-2', 'step-3', 'step-result'];
    return ids.filter((id) => el(id).hidden === false);
  }

  return { root, el, sent, flush, fire, pick, checkedValues, click, skip, visible, bag };
}

/* ══ 0. 대역 자체가 살아 있는지 ════════════════════════════════════════════
   아래 세 검사가 전부 「스크립트가 돌았다」를 전제로 합니다. 대역이 조용히 죽으면
   세 검사가 전부 무의미하게 통과할 수 있으므로 여기서 먼저 못을 박습니다. */

test('DOM 대역 위에서 페이지 스크립트가 실제로 돈다', () => {
  const p = boot();
  assert.deepStrictEqual(p.visible(), ['step-1'], '첫 화면이 Q1 이어야 합니다');
  assert.strictEqual(p.el('step-2').hidden, true);
  assert.strictEqual(p.el('step-result').hidden, true);
  /* 스크립트가 세운 것: 보기 6개가 마크업에서 그대로 올라왔는지 */
  assert.strictEqual(p.el('step-2-opts').getElementsByTagName('input').length, 6);
});

/* ══ 1. JS 비활성 (§9 마지막 행) ═══════════════════════════════════════════
   정본 문장: 「<noscript> 로 「바로 비교해 보기」 링크만 표시」.
   ⚠️ **「만」은 아직 코드가 지키지 않습니다.** JS 가 꺼져 있으면 S1(Q1)과 인트로가
      그대로 보이고, 그 안의 라디오·[다음]·[건너뛰기]는 아무 일도 하지 않습니다.
      S1 을 내리는 장치(<noscript><style>)가 페이지에 없기 때문입니다.
      여기서는 **지금 지켜지는 것만** 잠급니다 — 갈 곳이 남아 있는가, 반쯤 지어진
      뒷단계·결과 화면이 새어 나오지 않는가. 「만」을 지키려면 마크업을 고쳐야 하고
      그것은 동작 변경이라 이번 작업 범위 밖입니다(bkit-11 완료판정 3).
   ⛔ 이 검사를 「S1 도 숨는다」로 미리 고쳐 두지 마십시오. 고칠 거면 마크업이
      먼저입니다 — 검사만 앞서 나가면 통과하지 않습니다. */

test('JS 없이도 갈 곳이 남는다 — <noscript> 안의 링크가 스크립트 없이 동작한다', () => {
  const block = B.match(/<noscript>([\s\S]*?)<\/noscript>/);
  assert.ok(block, '<noscript> 가 없습니다 — JS 비활성 사용자가 막다른 길에 섭니다');
  const inner = block[1];

  const link = inner.match(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/);
  assert.ok(link, '<noscript> 안에 링크가 없습니다');
  assert.strictEqual(link[1], '/precheck', 'JS 비활성 사용자의 행선지는 /precheck 입니다');
  assert.strictEqual(link[2].trim(), '바로 비교해 보기', '정본 문구입니다(§9 · 상시 우회 링크와 같은 말)');

  /* href 하나로 끝나야 합니다 — noscript 안에서 스크립트에 기대는 것은 자기모순입니다. */
  assert.ok(!/data-bypass|onclick=/.test(inner), '<noscript> 링크가 스크립트에 기대고 있습니다');
});

test('JS 비활성 시 뒷단계·결과 화면이 새어 나오지 않는다', () => {
  /* 스크립트가 감추는 것이 아니라 **마크업이** 감추고 있어야 합니다. show() 가 한 번도
     돌지 않는 것이 JS 비활성이므로, hidden 이 마크업에 없으면 답도 없는 결과 화면과
     빈 뒷문항이 세 덩이째 노출됩니다. */
  for (const id of ['step-2', 'step-3', 'step-result']) {
    const tag = B.match(new RegExp('<section[^>]*id="' + id + '"[^>]*>'));
    assert.ok(tag, id + ' 를 찾지 못했습니다');
    assert.ok(/\shidden\b/.test(tag[0]), id + ' 에 마크업 hidden 이 없습니다 — JS 비활성에서 새어 나옵니다');
  }
  /* <noscript> 는 문항 <section> 바깥에 있어야 합니다 — 안에 있으면 그 단계가 숨는
     순간(JS 가 켜졌을 때) 링크도 같이 사라집니다. */
  const at = B.indexOf('<noscript>');
  assert.ok(at > B.lastIndexOf('</section>'), '<noscript> 가 문항 <section> 안에 있습니다');
});

/* ══ 2. Q2 상호배제 (§9) ═══════════════════════════════════════════════════
   「아직 없어요 + NDA」 라는 앞뒤가 맞지 않는 레코드가 저장되는 것을 막는 자리입니다.
   한 방향만 걸려도 원문 검사는 통과하므로 여기서 양방향을 다 밟습니다. */

test('Q2 — none 을 고르면 나머지가 풀린다', () => {
  const p = boot();
  p.pick('step-2', 'nda');
  p.pick('step-2', 'quote_pi');
  assert.deepStrictEqual(p.checkedValues('step-2'), ['nda', 'quote_pi']);

  p.pick('step-2', 'none');
  assert.deepStrictEqual(p.checkedValues('step-2'), ['none'], 'none 이 나머지를 풀지 못했습니다');

  p.flush();
  assert.deepStrictEqual(p.sent[p.sent.length - 1].body.docs, ['none']);
});

test('Q2 — none 이 켜진 채 다른 보기를 고르면 none 이 풀린다 (반대 방향)', () => {
  const p = boot();
  p.pick('step-2', 'none');
  assert.deepStrictEqual(p.checkedValues('step-2'), ['none']);

  p.pick('step-2', 'sales_contract');
  assert.deepStrictEqual(p.checkedValues('step-2'), ['sales_contract'], '나머지가 none 을 풀지 못했습니다');

  p.flush();
  assert.deepStrictEqual(p.sent[p.sent.length - 1].body.docs, ['sales_contract']);
});

test('Q2 — none 아닌 보기끼리는 서로를 풀지 않는다', () => {
  const p = boot();
  p.pick('step-2', 'nda');
  p.pick('step-2', 'service_license');
  p.pick('step-2', 'other_doc');
  assert.deepStrictEqual(p.checkedValues('step-2'), ['nda', 'service_license', 'other_doc']);
});

test('Q2 — 저장되는 순서는 클릭 순서가 아니라 화면 순서다', () => {
  /* 작업 6 의 위치 표시(「① · ②」)가 이 배열 순서를 그대로 읽습니다. 클릭 순서로
     모으면 「② · ①」 이 화면에 나갑니다 — 정렬을 넣지 말라는 주석의 짝입니다. */
  /* ⚠️ 보기 두 개는 **화면 순서와 사전순이 어긋나는 짝**으로 골라야 합니다.
        nda·quote_pi 처럼 둘이 우연히 같은 짝을 쓰면, 누가 sort() 를 끼워 넣어도
        이 검사가 통과합니다. sales_contract(화면 둘째) · quote_pi(화면 셋째)는
        사전순으로 뒤집힙니다. */
  const p = boot();
  p.pick('step-2', 'quote_pi');        /* 화면 셋째 · 사전순 앞 */
  p.pick('step-2', 'sales_contract');  /* 화면 둘째 · 사전순 뒤 */
  p.flush();
  assert.deepStrictEqual(p.sent[p.sent.length - 1].body.docs, ['sales_contract', 'quote_pi']);
});

test('Q2 — 골랐다 도로 지우면 빈 배열이 저장된다 (이전 답이 남지 않는다)', () => {
  const p = boot();
  p.pick('step-2', 'nda');
  p.flush();
  p.pick('step-2', 'nda', false);
  p.flush();
  const last = p.sent[p.sent.length - 1].body;
  assert.ok(Object.prototype.hasOwnProperty.call(last, 'docs'), 'docs 키가 빠지면 서버의 이전 값이 살아남습니다');
  assert.deepStrictEqual(last.docs, []);
});

/* ══ 3. Q1~Q3 전부 스킵 (§9 「아무 답 없이 결과 화면 도달」) ════════════════ */

test('첫 화면에서 [건너뛰기]만 세 번 누르면 결과 화면에 닿는다', () => {
  const p = boot();
  assert.deepStrictEqual(p.visible(), ['step-1']);
  p.skip('step-1');
  assert.deepStrictEqual(p.visible(), ['step-2']);
  p.skip('step-2');
  assert.deepStrictEqual(p.visible(), ['step-3']);
  p.skip('step-3');
  assert.deepStrictEqual(p.visible(), ['step-result'], '세 번 건너뛰고도 결과 화면에 닿지 못했습니다');
  /* 인트로(「세 가지만 여쭤봅니다」)는 결과 화면에서 참이 아니므로 내려갑니다. */
  assert.strictEqual(p.el('check-intro').hidden, true);
});

test('전부 스킵해도 결과 화면이 빈 화면이 아니다 — 블록2 는 항상 선다 (§5-1)', () => {
  const p = boot();
  p.skip('step-1');
  p.skip('step-2');
  p.skip('step-3');

  /* 블록1 되짚기는 통째로 내려갑니다 — 되짚을 답이 하나도 없습니다. */
  assert.strictEqual(p.el('result-recap').hidden, true, '빈 상자는 「뭔가 안 나왔다」로 읽힙니다');
  /* 블록2 는 답에 의존하지 않는 일반 진술이라 그대로 섭니다. */
  assert.strictEqual(p.el('result-lead').hidden, false);
  assert.strictEqual(p.el('result-stages').hidden, false);
  /* 위치 표시는 내려가고 「서류 없음」 문단이 그 자리를 대체합니다(F-5). */
  assert.strictEqual(p.el('result-place').hidden, true);
  assert.strictEqual(p.el('result-none').hidden, false);
  /* 블록3 은 「서류 없음」 갈래입니다. */
  assert.strictEqual(p.el('cta-has-docs').hidden, true);
  assert.strictEqual(p.el('cta-no-docs').hidden, false);
  /* 둘이 동시에 보이면 같은 자리에 대해 두 가지를 말하게 됩니다. */
  assert.notStrictEqual(p.el('result-place').hidden, p.el('result-none').hidden);
});

test('전부 스킵한 사람의 마지막 기록은 skip 이 아니라 completed 다 (§4-3)', () => {
  const p = boot();
  p.skip('step-1');
  p.skip('step-2');
  p.skip('step-3');

  const last = p.sent[p.sent.length - 1].body;
  assert.strictEqual(last.exitedVia, 'completed', 'exited_via 는 「어떤 문항을 건너뛰었나」가 아니라 「어떻게 나갔나」입니다');
  assert.strictEqual(last.completedStep, 3);
  /* 값이 없는 필드는 키째로 빠집니다 — null 을 실어 보내면 upsert 가 이전 값을 지웁니다. */
  assert.ok(!('situation' in last), '고르지 않은 값이 실려 나갔습니다');
  assert.ok(!('experience' in last), '고르지 않은 값이 실려 나갔습니다');
  assert.ok(!('docs' in last), '건드리지 않은 문항은 키째로 빠져야 합니다');
});

/* ══ 4. /check 직접 URL 진입 (§9) ══════════════════════════════════════════
   랜딩 경유가 전제가 아닙니다. 보관된 세션이 없는 상태로 처음 열려도 흐름이 서야
   하고, 저장소가 아예 막혀 있어도(시크릿) 마찬가지입니다. */

test('보관된 세션 없이 처음 열어도 첫 화면이 정상적으로 선다', () => {
  const p = boot();                       /* sessionStorage 비어 있음 */
  assert.deepStrictEqual(p.visible(), ['step-1']);
  /* 이전 세션을 참조해 보기가 미리 찍혀 있으면 안 됩니다. */
  assert.deepStrictEqual(p.checkedValues('step-1'), []);
  assert.deepStrictEqual(p.checkedValues('step-2'), []);
  assert.deepStrictEqual(p.checkedValues('step-3'), []);
  /* 아직 아무 행동이 없으므로 저장도 없습니다. */
  assert.strictEqual(p.sent.length, 0);
});

test('직접 진입에서도 세션 키가 즉시 만들어지고 첫 저장에 실린다', () => {
  const p = boot();
  p.skip('step-1');
  assert.strictEqual(p.sent.length, 1);
  const first = p.sent[0];
  assert.strictEqual(first.url, '/api/prestep');
  assert.strictEqual(first.keepalive, true);
  assert.strictEqual(typeof first.body.sessionKey, 'string');
  assert.ok(first.body.sessionKey.length > 0, '세션 키 없이 저장이 나갔습니다 — 한 사람의 답이 여러 행으로 흩어집니다');
  /* 보관에도 같은 값이 남아야 같은 탭 재진입이 이어집니다. */
  const saved = JSON.parse(p.bag['trops.prestep.v1']);
  assert.strictEqual(saved.sessionKey, first.body.sessionKey);
});

test('저장소가 막혀 있어도(시크릿·차단) 흐름이 끝까지 선다 (§9)', () => {
  const p = boot({ storage: 'blocked' });   /* getItem·setItem 이 예외를 던집니다 */
  assert.deepStrictEqual(p.visible(), ['step-1']);
  p.skip('step-1');
  p.skip('step-2');
  p.skip('step-3');
  assert.deepStrictEqual(p.visible(), ['step-result'], '저장소 차단이 흐름을 멈췄습니다');
  assert.ok(p.sent.length >= 1, '저장소가 막혔다고 서버 저장까지 멈추면 안 됩니다');
  assert.strictEqual(typeof p.sent[p.sent.length - 1].body.sessionKey, 'string');
});

test('crypto.randomUUID 가 없는 구형 브라우저에서도 세션 키가 나온다 (§9)', () => {
  const p = boot({ crypto: false });
  assert.deepStrictEqual(p.visible(), ['step-1']);
  p.skip('step-1');
  const key = p.sent[0].body.sessionKey;
  assert.strictEqual(typeof key, 'string');
  assert.ok(key.length > 0, '폴백이 죽으면 구형 브라우저의 답이 전부 한 행으로 뭉칩니다');
  assert.notStrictEqual(key, 'uuid-fixed-0000', '대역의 randomUUID 가 새어 들어왔습니다 — 폴백을 밟지 못했습니다');
});

test('보관된 값이 깨져 있어도 새 세션으로 다시 시작한다', () => {
  const p = boot({ seed: '{이건 JSON 이 아닙니다' });
  assert.deepStrictEqual(p.visible(), ['step-1']);
  p.skip('step-1');
  assert.ok(p.sent[0].body.sessionKey.length > 0);
});

test('같은 탭에서 다시 들어오면 보관된 세션과 진행도를 이어받는다', () => {
  /* 직접 진입의 짝입니다 — 「보관이 없으면 새로」가 「보관이 있어도 새로」가 되면
     한 사람이 두 건으로 세어져 §10 의 지표가 전부 어긋납니다. */
  const seed = JSON.stringify({
    sessionKey: 'seeded-key-1', situation: 'docs_received', docs: ['nda'],
    experience: null, completedStep: 2, exitedVia: null, ctaClicked: null,
    docsTouched: true, referrerSent: false,
  });
  const p = boot({ seed });
  assert.deepStrictEqual(p.visible(), ['step-3'], '진행하던 자리로 돌아가지 못했습니다');
  assert.deepStrictEqual(p.checkedValues('step-1'), ['docs_received']);
  assert.deepStrictEqual(p.checkedValues('step-2'), ['nda']);
  p.skip('step-3');
  assert.strictEqual(p.sent[p.sent.length - 1].body.sessionKey, 'seeded-key-1');
});
