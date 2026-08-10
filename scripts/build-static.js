#!/usr/bin/env node
'use strict';

/**
 * 배포용 정적 산출물을 dist/ 로 만듭니다.
 *
 * 하는 일은 하나입니다 — 주석 제거 (HTML · CSS · JS 세 종류 전부).
 *
 * 이 저장소는 주석을 인수인계 수단으로 씁니다(정본 조항 번호 · 미결 항목 · 왜 이렇게
 * 했는지). 그건 소스에 남아야 하지만, 세 종류 전부 브라우저로 전송됩니다 —
 * HTML 주석은 「소스 보기」로, <style>·<script> 안의 주석은 그 파일 자체로 읽힙니다.
 * 「8/20 캡처 대기」·「미결 L-1」·승인 이력 같은 문장이 trops.kr 에서 공개적으로
 * 읽히던 상태였습니다.
 *
 * ⚠️ 주석만 뗍니다. 압축·난독화·공백 정리를 하지 않습니다.
 *    렌더링이 한 픽셀도 바뀌면 안 되는 페이지라 최소 개입만 합니다.
 *    (collapseWhitespace 를 켜면 한글 인라인 요소 간격이 바뀝니다)
 *
 * 소스 파일은 건드리지 않습니다. 읽어서 dist/ 에 쓰기만 합니다 —
 * 로컬에서 `vercel build` 를 돌려도 작업 중인 .html 이 바뀌지 않습니다.
 *
 * ⚠️ 루트에 새 정적 파일·폴더를 추가하면 이 스크립트가 빌드를 실패시킵니다.
 *    아래 STATIC 과 NOT_DEPLOYED 중 어디에 속하는지 적어 주십시오.
 *    조용히 빠뜨리는 것보다 빌드가 깨지는 편이 낫습니다.
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist');

/** 배포되는 정적 자산. 루트 기준. */
const STATIC = {
  html: ['index.html', 'nda.html', 'precheck.html', 'refund.html', 'uae.html'],
  dirs: ['data'],
};

/** 배포되지 않는 것. api/ 는 Vercel 이 소스 루트에서 직접 함수로 잡습니다. */
const NOT_DEPLOYED = new Set([
  'api',                  // 서버리스 함수 — Vercel 이 별도로 처리
  'scripts', 'test',      // .vercelignore
  'docs',                 // 정본·와이어프레임. 공개되면 안 됩니다
  'node_modules', 'dist',
  'package.json', 'package-lock.json',
  'precheck-schema.sql',  // .vercelignore
  'vercel.json',
  'skills-lock.json',
  'README.md',
]);

/**
 * 주석만 제거하는 설정. 나머지 최적화는 전부 꺼 둡니다.
 * html-minifier-terser 는 기본값이 「아무것도 안 함」이라 켠 것만 동작합니다.
 */
const MINIFY_OPTS = {
  // HTML 주석. <!--! 로 시작하는 것은 남깁니다(법적 고지·저작권용).
  removeComments: true,
  // <style> 안 CSS 주석. level 1 의 나머지 최적화는 안전하지만(공백·색 표기 정규화)
  // 렌더링을 바꾸지 않는 선을 지키려고 주석 제거만 씁니다.
  minifyCSS: { level: { 1: { all: false, specialComments: 0 } } },
  // <script> 안 JS 주석. compress·mangle 을 끄면 terser 가 코드를 재구성하지 않고
  // 주석만 떼고 다시 출력합니다. 문자열·정규식 리터럴 안의 // 를 오인하지 않는 것이
  // 직접 정규식을 쓰지 않고 이 도구를 쓰는 이유입니다.
  minifyJS: { compress: false, mangle: false, format: { comments: false } },
};

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** 태그 이름 순서열 — 구조가 보존됐는지 비교하는 데 씁니다. */
function tagSequence(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const stripped = withoutComments.replace(
    /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    (m) => m.replace(/[\s\S]*/, '<$1></$1>')
  );
  return (stripped.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g) || [])
    .map((t) => t.toLowerCase())
    .join(',');
}

/** 눈에 보이는 텍스트 — 주석·스크립트·스타일을 뺀 나머지. */
function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  // 1. 루트에 분류되지 않은 것이 있으면 실패시킵니다 (조용한 누락 방지)
  const known = new Set([...STATIC.html, ...STATIC.dirs, ...NOT_DEPLOYED]);
  const unknown = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .map((e) => e.name)
    .filter((n) => !n.startsWith('.') && !known.has(n));

  if (unknown.length) {
    console.error(
      '\n✋ 루트에 분류되지 않은 항목이 있습니다:\n' +
        unknown.map((n) => '     ' + n).join('\n') +
        '\n\n   scripts/build-static.js 의 STATIC(배포됨) 또는 NOT_DEPLOYED(배포 안 됨)에\n' +
        '   추가해 주십시오. 정적 자산이면 STATIC, 아니면 NOT_DEPLOYED 입니다.\n'
    );
    process.exit(1);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  let totalBytes = 0;

  for (const name of STATIC.html) {
    const src = path.join(ROOT, name);
    if (!fs.existsSync(src)) {
      console.error(`✋ ${name} 이 없습니다. STATIC.html 목록과 실제 파일이 어긋납니다.`);
      process.exit(1);
    }
    const before = fs.readFileSync(src, 'utf8');
    const after = await minify(before, MINIFY_OPTS);

    const fail = (msg) => {
      console.error(`✋ ${name}: ${msg}\n   배포를 중단합니다.`);
      process.exit(1);
    };

    // ── 검증 ──────────────────────────────────────────────────────────────
    // A. 주석이 남지 않았는지 (세 종류 전부)
    const htmlComments = (after.match(/<!--(?!!)/g) || []).length;
    if (htmlComments) fail(`HTML 주석 ${htmlComments}개가 남았습니다`);

    const inBlocks = (s, tag) =>
      (s.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, 'gi')) || []).join('');
    const cssLeft = (inBlocks(after, 'style').match(/\/\*/g) || []).length;
    if (cssLeft) fail(`CSS 주석 ${cssLeft}개가 남았습니다`);
    const jsLeft = (inBlocks(after, 'script').match(/\/\*|(?:^|\s)\/\//g) || []).length;
    if (jsLeft) fail(`JS 주석 ${jsLeft}개가 남았습니다`);

    // B. DOCTYPE
    if (!/^<!DOCTYPE html>/i.test(after.trim())) fail('DOCTYPE 이 사라졌습니다');

    // C. 태그 구조가 그대로인지 — 주석 안의 태그처럼 보이는 글자에 속지 않도록
    //    양쪽 모두 주석을 뺀 상태로 비교합니다.
    if (tagSequence(before) !== tagSequence(after)) fail('태그 구조가 변했습니다');

    // D. 눈에 보이는 텍스트가 한 글자도 안 바뀌었는지.
    //    문구는 한 글자도 바뀌면 안 되는 것이 이 프로젝트의 첫 규칙입니다(정본 §0 · §8).
    if (visibleText(before) !== visibleText(after)) fail('화면에 보이는 문구가 변했습니다');

    fs.writeFileSync(path.join(OUT, name), after);
    const saved = before.length - after.length;
    totalBytes += saved;
    console.log(
      `  ${name.padEnd(15)} ${String(before.length).padStart(6)} → ` +
        `${String(after.length).padStart(6)}자  (−${saved.toLocaleString()})`
    );
  }

  for (const dir of STATIC.dirs) {
    const src = path.join(ROOT, dir);
    if (!fs.existsSync(src)) {
      console.error(`✋ ${dir}/ 이 없습니다. STATIC.dirs 목록과 실제 폴더가 어긋납니다.`);
      process.exit(1);
    }
    copyDir(src, path.join(OUT, dir));
    console.log(`  ${(dir + '/').padEnd(15)} 복사`);
  }

  console.log(`\n  주석 ${totalBytes.toLocaleString()}자 제거 → dist/\n`);
}

main().catch((err) => {
  console.error('✋ 빌드 실패:', err && err.message ? err.message : err);
  process.exit(1);
});
