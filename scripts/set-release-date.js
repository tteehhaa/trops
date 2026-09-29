#!/usr/bin/env node
'use strict';

/**
 * set-release-date.js — 처리방침 개정 시행일(= 배포일)을 **다섯 자리 함께** 바꿉니다 〔신설 2026-09-30 · 랜딩 v3〕
 *
 *   node scripts/set-release-date.js 2026-10-02            # 바꾸기
 *   node scripts/set-release-date.js 2026-09-30 --rev 2    # 같은 날 두 번째 개정 — 판 이름이 pilot-apply-2026-09-30-2
 *   node scripts/set-release-date.js --check               # 지금 날짜들만 보기(바꾸지 않음)
 *
 * 바꾸는 자리
 *   privacy.html     머리 「개정 · 시행 YYYY년 M월 D일」 · §07 첫 소제목 「YYYY년 M월 D일 시행 — …」
 *   en-privacy.html  머리 「Amended and effective Month D, YYYY.」 · §07 첫 소제목 「Effective Month D, YYYY: …」
 *   index.html       신청 폼 `notice_version` = `pilot-apply-YYYY-MM-DD`
 *
 * 🔴 **왜 도구인가** — 이 저장소는 「시행일 = 배포일」로 정했고(2026-09-29 hotfix), 배포일은 배포하는 날에야 정해집니다.
 *    그날 손으로 다섯 곳을 고치면 한 곳이 빠지기 쉽습니다 — 국문·영문이 갈리면 test/ga-policy.test.js 가,
 *    판 이름이 갈리면 test/pilot-apply-form.test.js 가 red 를 냅니다. 이 도구는 그 둘이 초록이 되는 상태를 한 번에 만듭니다.
 * ⚠️ §07 의 **첫** 소제목만 바꿉니다(가장 최근 고지). 그 아래 지난 고지들의 날짜는 건드리지 않습니다.
 * ⚠️ 본문 문단 안의 날짜는 바꾸지 않습니다 — 고지 본문에 날짜를 적지 마십시오.
 * 🔴 **같은 날 두 번째 개정** 〔2026-09-30 · 실제로 있었음〕 — 같은 날 앞서 게시한 판이 있으면 그 판에 동의한 사람과
 *    새 판에 동의한 사람을 가를 수 있어야 합니다. `--rev N` 이 판 이름에 `-N` 을 붙입니다. §07 소제목의 표지
 *    (「시행(2차)」 · 「(second amendment)」)는 사람이 적고, 이 도구는 그 표지를 건드리지 않고 날짜만 바꿉니다.
 * ⛔ 배포되지 않습니다(scripts/ 는 NOT_DEPLOYED). 바꾼 뒤 `npm test` → 커밋 → 배포 순서입니다.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const arg = process.argv[2];
const CHECK = arg === '--check';
const revAt = process.argv.indexOf('--rev');
const REV = revAt > -1 ? process.argv[revAt + 1] : null;
if (REV !== null && !/^[2-9]$/.test(REV || '')) {
  console.error('✋ --rev 는 2~9 입니다(같은 날 두 번째부터).');
  process.exit(1);
}
if (!CHECK && !/^\d{4}-\d{2}-\d{2}$/.test(arg || '')) {
  console.error('사용: node scripts/set-release-date.js YYYY-MM-DD   (확인만: --check)');
  process.exit(1);
}

/** [파일, 이름, 찾는 꼴, 새 글자를 만드는 함수] — 꼴마다 «첫 번째 하나»만 바꿉니다. */
function targets(y, m, d) {
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return [
    ['privacy.html', '국문 머리 줄', /(<strong>개정 &middot; 시행 )\d{4}년 \d{1,2}월 \d{1,2}일(<\/strong>)/,
      (all, a, b) => `${a}${y}년 ${m}월 ${d}일${b}`],
    ['privacy.html', '국문 §07 첫 소제목', /(<h3>)\d{4}년 \d{1,2}월 \d{1,2}일( 시행(?:\(\d차\))? &mdash;)/,
      (all, a, b) => `${a}${y}년 ${m}월 ${d}일${b}`],
    ['en-privacy.html', '영문 머리 줄', /(<strong>Amended and effective )[A-Z][a-z]+ \d{1,2}, \d{4}(\.<\/strong>)/,
      (all, a, b) => `${a}${MONTHS[m - 1]} ${d}, ${y}${b}`],
    ['en-privacy.html', '영문 §07 첫 소제목', /(<h3>Effective )[A-Z][a-z]+ \d{1,2}, \d{4}((?: \([a-z ]+\))?:)/,
      (all, a, b) => `${a}${MONTHS[m - 1]} ${d}, ${y}${b}`],
    ['index.html', '신청 폼 notice_version', /(name="notice_version" value="pilot-apply-)\d{4}-\d{2}-\d{2}(?:-\d)?(")/,
      (all, a, b) => `${a}${iso}${REV ? '-' + REV : ''}${b}`],
  ];
}

const [y, m, d] = CHECK ? [2000, 1, 1] : arg.split('-').map(Number);
if (!CHECK) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    console.error('✋ 없는 날짜입니다: ' + arg);
    process.exit(1);
  }
}

const files = {};
let failed = false;
for (const [file, name, re, make] of targets(y, m, d)) {
  if (!files[file]) files[file] = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const found = files[file].match(re);
  if (!found) {
    console.error(`✋ ${file} · ${name} 자리를 찾지 못했습니다 — 꼴이 바뀌었으면 이 도구의 표를 고치십시오`);
    failed = true;
    continue;
  }
  const before = found[0];
  if (CHECK) { console.log(`  ${name.padEnd(22)} ${before}`); continue; }
  const after = before.replace(re, make);
  files[file] = files[file].replace(before, after);
  console.log(`  ${name.padEnd(22)} ${before === after ? '(그대로)' : before + '  →  ' + after}`);
}
if (failed) process.exit(1);
if (CHECK) process.exit(0);

for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(ROOT, file), text);
console.log(`\n  시행일을 ${arg} 로 맞췄습니다. 다음: npm test → 커밋 → 배포`);
