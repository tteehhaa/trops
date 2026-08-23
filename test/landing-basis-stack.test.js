'use strict';

/*
 * 근거 스택 회귀 검사 〔landing-basis-stack · 신설 2026-08-24〕
 *
 * 정본: docs/prd/PRD_landing_v2.1_main_web_page.md §5-12 (왼쪽 세 축)
 *       + 2026-08-24 대표 지시(오른쪽 비주얼을 3장 Evidence stack 으로)
 *
 * ── 왜 있는가 ───────────────────────────────────────────────────────────────
 * 이 블록이 깨지는 방식은 전부 **화면이 멀쩡한 채** 일어납니다:
 *
 *   ① 한 장이 빠져도 페이지는 그려집니다 — 두 장만 남으면 「여러 정부 근거」라는
 *      이 비주얼의 존재 이유가 사라지는데, 레이아웃은 아무 말도 하지 않습니다.
 *   ② 겹침 값(top·width)과 상자 비율(aspect-ratio)은 **함께** 움직여야 합니다.
 *      한쪽만 고치면 앞장 아래가 잘리거나 아래에 빈 여백이 남습니다. 둘 다
 *      「조금 이상한데?」로만 보여서 리뷰에서 잡히지 않습니다.
 *   ③ OGL 파일을 새로 받아 갈아 끼우는 것 — 대표가 명시적으로 금지한 것이고,
 *      갈아 끼워도 화면은 비슷하게 보입니다.
 *
 * ⚠️ 마크업 검사는 **주석을 걷어낸 뒤** 합니다(이 저장소 공통 규칙).
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '');

const PAGES = ['index.html', 'en.html'];

/** `<figure class="basis-stack">` 한 덩이(주석 제거). */
function stack(rel) {
  const m = strip(read(rel));
  const a = m.indexOf('<figure class="basis-stack">');
  assert.ok(a !== -1, rel + ' 에 근거 스택이 없습니다');
  return m.slice(a, m.indexOf('</figure>', a));
}
/** <style> 안의 CSS(주석 제거). */
function css(rel) {
  return read(rel).match(/<style[\s\S]*?<\/style>/)[0].replace(/\/\*[\s\S]*?\*\//g, '');
}

/* ══ 1. 세 장이 다 있고, 순서가 뒤 → 앞이다 ═══════════════════════════════ */

/**
 * 뒤 → 앞. **왼쪽 `.basis-src` 의 세 축과 하나씩 짝**입니다(문서 기준 · 관세 근거 · 규정 근거).
 * ⛔ 순서를 바꾸지 마십시오 — 앞장이 대표 이미지이고, 그 자리는 「규정 근거」입니다.
 */
const LAYERS = [
  ['basis-doc-back', '/img/ogl-licence.png', '문서 기준(영국 OGL)'],
  ['basis-doc-mid', '/assets/img/basis-hts.png', '관세 근거(미국 HTS)'],
  ['basis-doc-front', '/assets/img/basis-ecfr.png', '규정 근거(미국 eCFR)'],
];

test('근거 스택이 세 장이고 순서가 뒤 → 앞이다 (국·영문)', () => {
  for (const p of PAGES) {
    const s = stack(p);
    const order = [...s.matchAll(/class="basis-doc (basis-doc-[a-z]+)"/g)].map((m) => m[1]);
    assert.deepStrictEqual(order, LAYERS.map((l) => l[0]),
      p + ' 의 스택 순서가 다릅니다 — DOM 순서가 곧 쌓임 순서입니다(z-index 는 보험입니다)');

    for (const [cls, src, role] of LAYERS) {
      const at = s.indexOf('basis-doc-' + cls.split('-').pop());
      const layer = s.slice(at, s.indexOf('</a>', at));
      assert.ok(layer.indexOf('src="' + src + '"') !== -1,
        p + ' 의 ' + role + ' 장이 ' + src + ' 를 쓰지 않습니다');
    }
  }
});

test('🔴 OGL 은 종전 asset 을 그대로 쓴다 — 새로 받거나 갈아 끼우지 않았다', () => {
  /* 대표 지시: 「현재 이 섹션에서 사용 중인 Open Government Licence 이미지 asset은
     그대로 재사용하고, 첨부한 eCFR 및 USITC 캡처 2장만 새 asset으로 추가해라.」
     ⛔ `assets/img/` 밑에 OGL 사본을 만들지 마십시오 — 두 벌이 되는 순간 어느 것이
        화면에 나가는지 알 수 없어지고, 한쪽만 고쳐도 아무도 모릅니다. */
  assert.ok(fs.existsSync(path.join(ROOT, 'img/ogl-licence.png')),
    '종전 OGL asset(img/ogl-licence.png)이 없습니다');
  const copies = fs.readdirSync(path.join(ROOT, 'assets/img'))
    .filter((f) => /ogl|licence|license|national.?archives/i.test(f));
  assert.deepStrictEqual(copies, [],
    'assets/img 에 OGL 사본이 생겼습니다: ' + JSON.stringify(copies) + ' — 종전 파일 하나만 씁니다');

  for (const p of PAGES) {
    assert.strictEqual((stack(p).match(/ogl-licence\.png/g) || []).length, 1,
      p + ' 가 OGL 을 한 번만 참조하지 않습니다');
  }
});

test('새로 더한 asset 은 두 장뿐이고 실제로 있다', () => {
  for (const rel of ['assets/img/basis-ecfr.png', 'assets/img/basis-hts.png']) {
    const f = path.join(ROOT, rel);
    assert.ok(fs.existsSync(f), rel + ' 이 없습니다 — 스택에서 그 자리가 깨진 이미지가 됩니다');
    /* 화면 폭(560px)의 2배는 넘겨야 고해상도에서 글자가 뭉개지지 않습니다. */
    assert.ok(fs.statSync(f).size > 20 * 1024, rel + ' 이 너무 작습니다 — 잘못 저장된 것 같습니다');
  }
});

/* ══ 2. 마크업에 라벨을 넣지 않는다 ═══════════════════════════════════════ */

test('스택 안에 설명 텍스트·라벨이 없다 — 무엇의 근거인지는 왼쪽 텍스트가 말한다', () => {
  /* 대표 지시: 「이미지 안에 별도의 설명 텍스트나 라벨을 새로 넣지 않는다.」
     그림이 왼쪽과 같은 말을 반복하면 두 곳이 갈릴 자리가 생깁니다. */
  for (const p of PAGES) {
    const s = stack(p);
    const bare = s.replace(/<[^>]*>/g, '').replace(/\s+/g, '');
    assert.strictEqual(bare, '',
      p + ' 의 스택 안에 글자가 있습니다: 「' + bare.slice(0, 40) + '」 — <a><img> 만 둡니다');
    /* 종전 단일 컷의 캡션(<figcaption>)이 되살아나지 않았는지도 봅니다. */
    assert.ok(s.indexOf('<figcaption') === -1, p + ' 의 스택에 figcaption 이 생겼습니다');
  }
});

test('세 장 모두 원문으로 링크되고 새 창 안전 속성을 갖는다', () => {
  for (const p of PAGES) {
    const s = stack(p);
    const links = [...s.matchAll(/<a class="basis-doc[^"]*" href="(https:\/\/[^"]+)"([^>]*)>/g)];
    assert.strictEqual(links.length, 3, p + ' 의 스택 링크가 3개가 아닙니다');
    for (const [, href, attrs] of links) {
      assert.match(attrs, /rel="noopener noreferrer"/,
        p + ': ' + href + ' 에 rel="noopener noreferrer" 가 없습니다');
    }
    /* 세 목적지가 서로 달라야 합니다 — 같으면 한 근거를 세 번 가리키는 셈입니다. */
    const hrefs = links.map((m) => m[1]);
    assert.strictEqual(new Set(hrefs).size, 3, p + ' 의 스택 링크 목적지가 겹칩니다: ' + JSON.stringify(hrefs));
  }
});

/* ══ 3. 겹침·비율이 함께 선언돼 있다 ═════════════════════════════════════ */

test('상자 비율과 세 장의 top·width 가 함께 선언돼 있다', () => {
  /* 🔴 자식이 전부 absolute 라 **상자가 스스로 높이를 얻지 못합니다.** aspect-ratio 가
     빠지면 스택이 높이 0 으로 접히고, 그때도 카드는 그려져서 아래 섹션 위에 겹칩니다 —
     「깨졌다」가 아니라 「이상하다」로만 보이는 실패입니다. */
  for (const p of PAGES) {
    const c = css(p);
    assert.match(c, /\.basis-stack\s*\{[^}]*position:\s*relative/, p + ': .basis-stack 이 relative 가 아닙니다');
    assert.match(c, /\.basis-stack\s*\{[^}]*aspect-ratio/, p + ': .basis-stack 에 aspect-ratio 가 없습니다');
    for (const [cls] of LAYERS) {
      const rule = (c.match(new RegExp('\\.' + cls + '\\s*\\{[^}]*\\}')) || [])[0];
      assert.ok(rule, p + ': .' + cls + ' 규칙이 없습니다');
      for (const prop of ['top', 'width', 'z-index']) {
        assert.ok(rule.indexOf(prop) !== -1, p + ': .' + cls + ' 에 ' + prop + ' 이 없습니다');
      }
    }
    /* 좁은 화면 값도 함께 있어야 합니다 — 없으면 기관명이 읽을 수 없는 크기가 됩니다. */
    assert.match(c, /@media \(max-width: 768px\) \{[^@]*\.basis-stack \{ aspect-ratio/,
      p + ': 좁은 화면용 스택 비율이 없습니다');
  }
});

test('회전을 쓰지 않는다 — 깊이는 위치·겹침·그림자로만 만든다', () => {
  /* 🔄 「1.5도 안쪽」 → **0도** 〔2026-08-24 2차 · 대표 지시「위치와 겹침만으로 차분한
     document stack」〕. 종전에는 1도 안팎을 허용했는데, 지시가 회전을 구성 수단에서
     아예 뺐습니다. 이 페이지의 다른 어디에도 기울어진 요소가 없습니다.
     ⛔ 되살리지 마십시오 — 「조금만 기울이면 자연스러울 것」이라는 판단이 이 블록을
        사진처럼 보이게 만듭니다. 이건 근거 묶음입니다. */
  for (const p of PAGES) {
    const hits = [...css(p).matchAll(/\.basis-doc-[a-z]+\s*\{[^}]*rotate\(/g)];
    assert.strictEqual(hits.length, 0,
      p + ': 스택 카드에 rotate 가 ' + hits.length + '개 있습니다 — 깊이는 위치·겹침·그림자로만 만듭니다');
  }
});

test('앞장이 뒤 두 장보다 넓지 않다 — 뒤가 배경 장식으로 밀리지 않게', () => {
  /* 🔴 **이 검사가 지키는 것이 2차 조정의 요지입니다** 〔2026-08-24〕. 앞장(eCFR)이 크면
     뒤 두 장이 배경처럼 읽히고, 그러면 「여러 정부 공식 근거를 본다」가 아니라
     「eCFR 을 본다」가 됩니다. 앞장을 다시 키우려면 그 사유부터 여기 적으십시오. */
  for (const p of PAGES) {
    const w = {};
    for (const [cls] of LAYERS) {
      const rule = (css(p).match(new RegExp('\\.' + cls + '\\s*\\{[^}]*\\}')) || [])[0] || '';
      w[cls] = parseFloat((rule.match(/width:\s*([\d.]+)%/) || [])[1]);
      assert.ok(!Number.isNaN(w[cls]), p + ': .' + cls + ' 의 width 를 읽지 못했습니다');
    }
    assert.ok(w['basis-doc-front'] <= w['basis-doc-back'],
      p + ': 앞장(' + w['basis-doc-front'] + '%)이 뒷장(' + w['basis-doc-back'] + '%)보다 넓습니다');
    assert.ok(w['basis-doc-front'] <= w['basis-doc-mid'],
      p + ': 앞장(' + w['basis-doc-front'] + '%)이 중간장(' + w['basis-doc-mid'] + '%)보다 넓습니다');
  }
});

test('뒤 두 장이 서로 반대쪽으로 삐져나온다 — 좌우로 갈라져야 세 장으로 읽힌다', () => {
  /* 뒷장 OGL 은 앞장보다 **왼쪽에서** 시작하고, 중간장 HTS 는 앞장보다 **오른쪽에서**
     끝나야 합니다. 둘을 같은 쪽으로 몰면 한 장이 통째로 가려집니다. */
  for (const p of PAGES) {
    const c = css(p);
    const geo = {};
    for (const [cls] of LAYERS) {
      const rule = (c.match(new RegExp('\\.' + cls + '\\s*\\{[^}]*\\}')) || [])[0] || '';
      geo[cls] = {
        left: parseFloat((rule.match(/left:\s*(-?[\d.]+)%?/) || [])[1]),
        width: parseFloat((rule.match(/width:\s*([\d.]+)%/) || [])[1]),
      };
    }
    const f = geo['basis-doc-front'], b = geo['basis-doc-back'], mm = geo['basis-doc-mid'];
    assert.ok(b.left < f.left,
      p + ': 뒷장(OGL)이 앞장보다 왼쪽에서 시작하지 않습니다 — 기관명이 가려집니다');
    assert.ok(mm.left + mm.width > f.left + f.width,
      p + ': 중간장(HTS)이 앞장보다 오른쪽에서 끝나지 않습니다');
  }
});

test('죽은 클래스(.basis-shot)가 규칙·마크업에 남아 있지 않다', () => {
  /* 이 파일의 규칙: 쓰지 않는 클래스를 남겨 두지 않습니다.
     ⚠️ **주석은 뺍니다** — 이 저장소는 주석을 이력으로 쓰고, 「종전에는 .basis-shot 이었다」는
        문장은 남아 있어야 다음 사람이 왜 바뀌었는지 압니다. 지워야 하는 것은 **규칙과
        마크업**에 남은 죽은 클래스입니다. */
  for (const p of PAGES) {
    const raw = read(p);
    const markup = strip(raw).replace(/<style[\s\S]*?<\/style>/g, '');
    assert.ok(markup.indexOf('basis-shot') === -1, p + ' 마크업에 .basis-shot 이 남아 있습니다');
    assert.ok(css(p).indexOf('.basis-shot') === -1, p + ' CSS 에 .basis-shot 규칙이 남아 있습니다');
  }
});

/* ══ 4. 왼쪽 텍스트는 손대지 않았다 ══════════════════════════════════════ */

test('고유명사가 줄 중간에서 갈리지 않는다 (국·영문)', () => {
  /* 🔴 body 에 `word-break: keep-all` 이 걸려 있어 **한글 낱말은** 통째로 움직이지만,
     라틴 문자 이름은 그 규칙 밖이라 띄어쓰기마다 끊깁니다 — 「Open Government /
     Licence v3.0」처럼 이름 한가운데가 갈리면 한글 문장 안에서 그것이 하나의 이름이라는
     것이 안 읽힙니다(2026-08-24 대표 지시 「한글 맥락에 맞춰서 줄바꿈」).
     ⚠️ 글자는 한 자도 바뀌지 않았습니다 — 어디서 줄이 갈리는지만 정합니다. */
  for (const p of PAGES) {
    const m = strip(read(p));
    assert.ok(m.indexOf('<span class="nobr">Open Government Licence v3.0</span>') !== -1,
      p + ': 「Open Government Licence v3.0」이 줄바꿈 보호를 잃었습니다');
    assert.match(css(p), /\.nobr\s*\{[^}]*white-space:\s*nowrap/,
      p + ': .nobr 규칙이 없습니다 — 보호 클래스만 붙어 있고 아무 일도 하지 않습니다');
  }
});

test('왼쪽 세 축(규정 근거 · 관세 근거 · 문서 기준)이 그대로다', () => {
  /* 대표 지시: 「왼쪽 텍스트는 수정하지 않는다.」 오른쪽 세 장은 이 세 축과 짝이므로,
     축이 사라지면 스택이 무엇을 가리키는지가 없어집니다. */
  const ko = strip(read('index.html'));
  const sec = ko.slice(ko.indexOf('<section class="basis'), ko.indexOf('</section>', ko.indexOf('<section class="basis')));
  for (const axis of ['규정 근거', '관세 근거', '문서 기준']) {
    assert.ok(sec.indexOf('<dt>' + axis + '</dt>') !== -1, '근거 축 「' + axis + '」이 사라졌습니다');
  }
  assert.ok(sec.indexOf('확인 기준일이 없는 항목은 화면에 표시하지 않습니다.') !== -1,
    '근거 섹션의 맺음 문장이 사라졌습니다');
});
