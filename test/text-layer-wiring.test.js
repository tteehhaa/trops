/*
 * M-1 글자층 감지 **배선** 검사 〔신설 2026-08-30 · text-layer-detect.test.js 를 대체〕
 *
 *   npm test        (node --test test/)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **왜 종전 파일을 지우고 이것을 세웠는가**
 * ══════════════════════════════════════════════════════════════════════════════
 * `text-layer-detect.test.js` 는 `precheck.html` 안의 `<text-layer-detect>` 블록을 잘라
 * VM 으로 실행해 감지 함수를 쟀습니다. 그 페이지가 2026-08-30 에 삭제되면서
 * **감지 코드가 저장소에서 함께 사라졌고**(`detectTextLayerInBytes` 정의 0건), 검사는
 * ENOENT 로 죽었습니다. 잴 함수가 없으므로 그 파일은 되살릴 수 없습니다.
 *
 * 🔴 **그런데 그 값을 «쓰는» 안전 분기는 남았습니다.** 지우기만 하면 이 사실이
 *    아무 검사도 없는 상태로 남습니다(대표 지시: 「기대를 지우기만 하지 마십시오」).
 *
 *     생산자  detectTextLayerInBytes            → **0건** (precheck.html 과 함께 삭제)
 *     소비자  api/_precheck-charge-gate.js      → `pdfTextLayer === 'absent'` 분기 실재
 *     저장    api/intake.js TEXT_LAYER_STATES   → 세 값을 여전히 받는다
 *
 * ⚠️ **무슨 뜻인가** — 글자층 없는 스캔 PDF 를 과금에서 걸러 내던 분기가 **영구히
 *    발화하지 않습니다.** 접수 흐름이 되살아나면 그 PDF 가 **그대로 과금**됩니다.
 *    `test/precheck-charge-gate.test.js` 는 인자를 **직접 넣어** 재므로 green 입니다 —
 *    「함수가 옳다」와 「그 함수에 값이 도달한다」가 갈린 전형적인 미배선입니다.
 *
 * ── 🔴 이 파일이 하는 일 ────────────────────────────────────────────────────
 * **그 어긋남을 «사실»로 못질합니다.** 지금은 green 이고, **어느 한쪽이 움직이면 red** 라
 * 다음 사람이 나머지 한쪽을 함께 보게 됩니다.
 *   · 생산자가 생기면      → red. 그때 이 파일을 지우고 감지 자체를 재는 검사를 세우십시오
 *                            (원본: `git show ca47218^:precheck.html` 의 `<text-layer-detect>` 블록)
 *   · 소비자가 사라지면    → red. 그때는 이 파일도 함께 지웁니다
 * ⛔ 「green 이니 배선돼 있다」로 읽지 마십시오 — 이 파일이 잠그는 것은 **부재**입니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

/** 소스 전체(추적 + 미추적). ⚠️ -z 는 한글 경로 인용을 피하려는 것입니다. */
function sourceFiles() {
  return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  })
    .split('\0')
    .filter((f) => f && /\.(js|html)$/.test(f) && !/^(dist|node_modules)\//.test(f));
}

test('🔴 생산자가 0건이다 — 감지 코드는 precheck.html 과 함께 사라졌다', () => {
  const producers = sourceFiles().filter((f) => {
    if (f.startsWith('test/')) return false; // 검사 파일의 «언급»은 생산자가 아닙니다
    return fs.readFileSync(path.join(ROOT, f), 'utf8').includes('detectTextLayerInBytes');
  });
  assert.deepStrictEqual(producers, [],
    '글자층 감지가 되살아났습니다: ' + producers.join(', ') +
    ' — 이 파일을 지우고 감지 자체를 재는 검사를 세우십시오(머리주석 참조)');
});

test('🔴 그런데 소비자는 남아 있다 — 과금 차단 분기가 영구히 발화하지 않는다', () => {
  const gate = fs.readFileSync(path.join(ROOT, 'api', '_precheck-charge-gate.js'), 'utf8');
  assert.ok(gate.includes("pdfTextLayer === 'absent'"),
    '과금 차단 분기가 사라졌습니다 — 그렇다면 이 파일도 함께 지우십시오');

  const intake = fs.readFileSync(path.join(ROOT, 'api', 'intake.js'), 'utf8');
  assert.ok(/TEXT_LAYER_STATES/.test(intake),
    '저장층이 글자층 값을 더는 받지 않습니다 — 그렇다면 이 파일도 함께 지우십시오');
});

test('[대조] 검출기가 실제로 문다 — 0건 통과 금지', () => {
  const files = sourceFiles();
  assert.ok(files.length > 50, 'git ls-files 가 ' + files.length + '개만 냈습니다 — 검사가 헛돕니다');
  // 같은 방식으로 «실재하는» 심볼을 찾으면 잡혀야 합니다.
  const found = files.filter((f) =>
    fs.readFileSync(path.join(ROOT, f), 'utf8').includes('TEXT_LAYER_STATES'));
  assert.ok(found.length > 0, '검출기가 실재하는 심볼도 못 찾습니다 — 스캔 범위가 잘못됐습니다');
});
