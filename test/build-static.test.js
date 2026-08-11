'use strict';

/**
 * 배포본에 주석이 남지 않는지 지키는 테스트.
 *
 * 왜 필요한가: HTML·CSS·JS 주석은 전부 브라우저로 전송됩니다. 이 저장소는 주석을
 * 인수인계 수단으로 써서(정본 조항 번호 · 미결 항목 · 승인 이력) 양이 많고,
 * 그게 그대로 trops.kr 에서 읽히던 상태였습니다. 빌드가 조용히 망가지면
 * 다시 같은 상태로 돌아갑니다.
 *
 * ⚠️ 이 파일과 site-config.test.js 는 같은 dist/ 를 만들고, 검사 도중 잠깐
 *    루트 파일을 바꿨다 되돌립니다(빌드 가드 확인용 probe · 설정값 교체).
 *    그래서 package.json 의 test 스크립트가 --test-concurrency=1 로 돕니다.
 *    이것을 지우면 두 파일이 서로의 dist/ 와 소스를 밟아 회차마다 결과가 달라집니다
 *    (2026-08-11 에 실제로 3회 중 1회 실패로 나타났습니다).
 */

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

/**
 * 로케일은 scripts/build-static.js 의 STATIC.html 과 같아야 합니다 —
 * 사업자정보 토큰을 어느 묶음으로 채우는지가 여기 달렸습니다.
 * 2026-08-11 에 en.html · privacy.html · en-privacy.html 을 넣었습니다.
 * (en.html 은 그전까지 이 목록에서 빠져 있었습니다 — 영문 랜딩만 주석 검사를
 *  못 받고 있었다는 뜻이라 이번에 함께 넣습니다.)
 */
const PAGE_LOCALES = {
  'index.html': 'ko',
  'en.html': 'en',
  'nda.html': 'ko',
  'precheck.html': 'ko',
  'refund.html': 'ko',
  'uae.html': 'ko',
  'privacy.html': 'ko',
  'en-privacy.html': 'en',
};
const PAGES = Object.keys(PAGE_LOCALES);

function build() {
  execFileSync('node', [path.join(ROOT, 'scripts', 'build-static.js')], {
    cwd: ROOT,
    stdio: 'pipe',
  });
}

/**
 * 소스의 {{biz.키}} 를 site.config.json 값으로 채웁니다.
 *
 * 소스와 산출물을 직접 비교하던 검사(문구 불변 · 태그 구조)의 기준을 여기로 옮깁니다.
 * 그 검사가 지키는 것은 「**주석 제거가** 문구를 바꾸지 않는다」이지 「소스 파일과
 * 산출물이 글자까지 같다」가 아닙니다. 치환이 문구를 바꾸는지는 site-config.test.js 몫입니다.
 */
function resolved(page) {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
  const values = config.biz[PAGE_LOCALES[page]];
  return fs
    .readFileSync(path.join(ROOT, page), 'utf8')
    .replace(/\{\{\s*biz\.([A-Za-z0-9_]+)\s*\}\}/g, (whole, key) =>
      Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : whole
    );
}

function blocks(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, 'gi');
  return (html.match(re) || []).join('');
}

test('빌드가 성공하고 모든 페이지를 만든다', () => {
  build();
  for (const p of PAGES) {
    assert.ok(fs.existsSync(path.join(DIST, p)), `${p} 이 dist 에 없습니다`);
  }
});

test('배포본에 HTML 주석이 남지 않는다', () => {
  for (const p of PAGES) {
    const html = fs.readFileSync(path.join(DIST, p), 'utf8');
    const found = html.match(/<!--(?!!)/g) || [];
    assert.equal(found.length, 0, `${p}: HTML 주석 ${found.length}개 남음`);
  }
});

test('배포본의 <style> 안에 CSS 주석이 남지 않는다', () => {
  for (const p of PAGES) {
    const html = fs.readFileSync(path.join(DIST, p), 'utf8');
    const found = blocks(html, 'style').match(/\/\*/g) || [];
    assert.equal(found.length, 0, `${p}: CSS 주석 ${found.length}개 남음`);
  }
});

test('배포본의 <script> 안에 JS 주석이 남지 않는다', () => {
  for (const p of PAGES) {
    const html = fs.readFileSync(path.join(DIST, p), 'utf8');
    const js = blocks(html, 'script');
    const found = js.match(/\/\*/g) || [];
    assert.equal(found.length, 0, `${p}: JS 블록 주석 ${found.length}개 남음`);
  }
});

test('내부 표기가 배포본에 새지 않는다', () => {
  // 화면에 보이는 문구로 정당하게 쓰이는 말은 제외합니다 —
  // "승인"(결제 오류 메시지) · "마케팅팀"(신뢰 섹션 플레이스홀더, 8/20 캡처 오면 사라짐)
  const FORBIDDEN = ['정본 §', 'PRD-', '미결 L-', '금지어', '와이어프레임', 'AA 미달'];
  for (const p of PAGES) {
    const html = fs.readFileSync(path.join(DIST, p), 'utf8');
    for (const word of FORBIDDEN) {
      assert.ok(!html.includes(word), `${p}: 내부 표기 "${word}" 가 배포본에 남음`);
    }
  }
});

test('DOCTYPE 과 문서 구조가 살아 있다', () => {
  for (const p of PAGES) {
    const src = resolved(p);
    const out = fs.readFileSync(path.join(DIST, p), 'utf8');
    assert.match(out.trim(), /^<!DOCTYPE html>/i, `${p}: DOCTYPE 없음`);

    // 주석을 뺀 태그 순서열이 같아야 합니다 (주석 안의 태그처럼 보이는 글자에 속지 않도록
    // 양쪽 모두 주석 제거 후 비교)
    const seq = (h) =>
      (h
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '<$1></$1>')
        .match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g) || []
      )
        .map((t) => t.toLowerCase())
        .join(',');
    assert.equal(seq(out), seq(src), `${p}: 태그 구조가 변함`);
  }
});

test('화면에 보이는 문구가 한 글자도 바뀌지 않는다', () => {
  // 정본 §0 · §8 — 문구는 한 글자도 수정하지 않는다. 빌드도 예외가 아닙니다.
  const visible = (h) =>
    h
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  for (const p of PAGES) {
    const src = resolved(p);
    const out = fs.readFileSync(path.join(DIST, p), 'utf8');
    assert.equal(visible(out), visible(src), `${p}: 화면 문구가 변함`);
  }
});

test('배포본에 docs/ 가 섞이지 않는다', () => {
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });
  const leaked = walk(DIST).filter((p) => /docs|와이어프레임|design_master|최종문구/.test(p));
  assert.deepEqual(leaked, [], '정본·와이어프레임이 배포본에 섞였습니다');
});

test('루트에 분류되지 않은 항목이 있으면 빌드가 실패한다', () => {
  // 새 정적 자산을 추가했을 때 조용히 누락되지 않게 하는 안전장치입니다.
  const probe = path.join(ROOT, '__build_guard_probe.css');
  fs.writeFileSync(probe, '/* 테스트용 */');
  try {
    assert.throws(() => build(), '미분류 항목이 있는데도 빌드가 성공했습니다');
  } finally {
    fs.rmSync(probe, { force: true });
  }
  build(); // 원상복구
});
