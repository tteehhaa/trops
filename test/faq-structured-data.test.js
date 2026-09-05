/**
 * FAQ 본문 ↔ JSON-LD `FAQPage` **동기화** 검사 〔신설 2026-09-05〕.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🔴 **왜 이 파일이 생겼는가 — 두 벌이 조용히 갈릴 수 있었다**
 * ══════════════════════════════════════════════════════════════════════════
 * 같은 질문·답이 `index.html` 안에 **두 벌** 있다: 사람이 읽는 `<details>` 블록과,
 * 기계가 읽는 `<script type="application/ld+json">` 의 `FAQPage`. index.html 주석이
 * 두 자리에서 「한쪽만 고치면 본문과 구조화 데이터가 갈립니다 — **이를 막는 검사는 아직
 * 없습니다**」라고 스스로 적어 두고 있었다. 이 파일이 그 검사다.
 *
 * 갈리면 무엇이 나쁜가: 구조화 데이터는 **화면에 보이지 않는다**. 본문만 고치면 낡은
 * 문장이 기계에게만 남아, LLM 과 검색엔진이 «지금 페이지에 없는 말»을 이 회사의 답으로
 * 인용한다. 눈으로는 영원히 발견되지 않는 종류의 오류다.
 *
 * ⚠️ 접기 규약: 본문의 `<p>` 여럿을 **공백 하나로 이어** JSON-LD `text` 한 줄과 견준다.
 *    (지금 6문항이 이미 그 규약을 지키고 있어서, 새 문항도 그 꼴로 적으면 된다.)
 * ⛔ 이 검사를 「이름만 같은지」로 약하게 만들지 마십시오 — 갈리는 것은 대개 **답**이다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const LANDING = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(LANDING, 'utf8');

/** 사람이 읽는 쪽 — `<details><summary>질문</summary><div class="a"><p>…</p></div>`. */
function fromBody() {
  const out = [];
  const re = /<details><summary>([\s\S]*?)<\/summary>\s*<div class="a">([\s\S]*?)<\/div>/g;
  for (const m of html.matchAll(re)) {
    const paragraphs = [...m[2].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((p) => p[1]);
    out.push({
      name: m[1].replace(/\s+/g, ' ').trim(),
      /* 태그를 지우고 공백을 하나로 접는다 — 줄바꿈·들여쓰기는 뜻이 아니다. */
      text: paragraphs.join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    });
  }
  return out;
}

/** 기계가 읽는 쪽 — `@graph` 안의 `FAQPage`. */
function fromJsonLd() {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1, 'ld+json 블록이 하나가 아닙니다 — 어느 쪽이 정본인지 알 수 없습니다');
  const data = JSON.parse(blocks[0][1]);
  const graph = Array.isArray(data['@graph']) ? data['@graph'] : [data];
  const faq = graph.filter((n) => n['@type'] === 'FAQPage');
  assert.equal(faq.length, 1, 'FAQPage 노드가 하나가 아닙니다');
  return faq[0].mainEntity.map((q) => ({
    name: String(q.name).replace(/\s+/g, ' ').trim(),
    text: String(q.acceptedAnswer.text).replace(/\s+/g, ' ').trim(),
  }));
}

test('🔴 FAQ 문항 수가 본문과 구조화 데이터에서 같다', () => {
  assert.equal(fromBody().length, fromJsonLd().length,
    '한쪽에만 문항을 더했습니다 — 두 자리를 함께 고쳐야 합니다');
});

test('🔴 질문이 같은 순서로 같은 글자다', () => {
  assert.deepEqual(fromJsonLd().map((q) => q.name), fromBody().map((q) => q.name));
});

test('🔴 답이 글자까지 같다 — 갈리면 화면에 없는 말이 기계에만 남는다', () => {
  const [body, ld] = [fromBody(), fromJsonLd()];
  for (let i = 0; i < body.length; i += 1) {
    assert.equal(ld[i].text, body[i].text,
      `「${body[i].name}」의 답이 본문과 구조화 데이터에서 다릅니다`);
  }
});

test('⚠️ 빈 문항이 없다 — 질문만 있고 답이 비면 두 소비처가 다 헛돈다', () => {
  for (const q of fromBody()) {
    assert.ok(q.name.length > 0, '질문이 비어 있습니다');
    assert.ok(q.text.length > 0, `「${q.name}」의 답이 비어 있습니다`);
  }
});

/*
 * 🔴 **랜딩이 규정보다 앞서 약속하지 않는다** 〔2026-09-05〕.
 *
 * app.trops.kr `/insurance/quick` 의 요금 안내에는 「서류가 반송되면 다시 작성해 드리거나
 * 전액 환불합니다」가 있다. 그러나 `refund.html` 환불규정은 **종료된 「서류 사전 확인」**
 * (2026-08-20 접수분까지)만 다룬다 — 준비 패키지의 환불 조건을 담은 방침이 아직 없다.
 *
 * FAQ 는 LLM 이 통째로 인용하는 자리라, 여기 적힌 약속이 가장 널리 퍼진다. 규정이 서기
 * 전에 랜딩이 먼저 환불을 약속하면 근거 없는 약속이 된다.
 * ⚠️ 규정이 생기면 이 검사를 **함께** 풀어 주십시오 — 그때는 막을 이유가 사라진다.
 */
test('🔴 환불 약속을 FAQ 에 적지 않는다 — 준비 패키지를 다루는 환불규정이 아직 없다', () => {
  for (const q of fromBody()) {
    assert.ok(!/환불/.test(q.text),
      `「${q.name}」이 환불을 약속합니다 — refund.html 이 준비 패키지를 다루기 전에는 적지 마십시오`);
  }
});
