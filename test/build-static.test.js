'use strict';

/**
 * 배포본에 주석이 남지 않는지 지키는 테스트.
 *
 * 왜 필요한가: HTML·CSS·JS 주석은 전부 브라우저로 전송됩니다. 이 저장소는 주석을
 * 인수인계 수단으로 써서(정본 조항 번호 · 미결 항목 · 승인 이력) 양이 많고,
 * 그게 그대로 trops.kr 에서 읽히던 상태였습니다. 빌드가 조용히 망가지면
 * 다시 같은 상태로 돌아갑니다.
 */

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PAGES = ['index.html', 'nda.html', 'precheck.html', 'refund.html', 'uae.html'];

function build() {
  execFileSync('node', [path.join(ROOT, 'scripts', 'build-static.js')], {
    cwd: ROOT,
    stdio: 'pipe',
  });
}

function blocks(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, 'gi');
  return (html.match(re) || []).join('');
}

test('빌드가 성공하고 5개 페이지를 모두 만든다', () => {
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
    const src = fs.readFileSync(path.join(ROOT, p), 'utf8');
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
    const src = fs.readFileSync(path.join(ROOT, p), 'utf8');
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
