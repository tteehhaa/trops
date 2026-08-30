'use strict';

/**
 * 사업자정보 단일소스화를 지키는 테스트 (2026-08-11).
 *
 * 왜 필요한가: 전에는 사업자정보 6항목이 6개 HTML 에 각자 하드코딩돼 있었고,
 * 통신판매업신고번호가 확정되면 6곳을 손으로 고쳐야 하는 상태였습니다.
 * 지금은 site.config.json 한 곳이 원본입니다. 누군가 편의로 HTML 에 값을 다시
 * 적어 넣으면 그 순간 원래 상태로 돌아가고, 아무 증상 없이 조용히 갈라집니다.
 *
 * 여기서 지키는 것 셋:
 *   1. 소스에 값이 없다 (토큰만 있다)
 *   2. 설정값 하나를 바꾸면 산출물 전부가 따라온다
 *   3. 오타 난 토큰은 빌드를 세운다
 */

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CONFIG = path.join(ROOT, 'site.config.json');

/*
 * 🔴 **페이지 목록을 손으로 적지 않습니다** 〔2026-08-30 복구〕.
 *
 * 종전에는 여덟 장을 배열에 박아 뒀고 그중 셋(`nda.html`·`precheck.html`·`uae.html`)이
 * 2026-08-30 에 삭제되면서 이 파일이 ENOENT 로 무너졌습니다. 「새 페이지를 만들면 여기에도
 * 넣으십시오」라는 주석은 **지우는 경우를 말하지 않았습니다.**
 *
 * 이제 **빌드 분류표**(`scripts/build-static.js` `STATIC.html`)에서 읽습니다 — 그 표가
 * 「무엇이 배포되는가」의 정본이고, `locale` 칸이 ko/en 을 이미 가르고 있습니다(사본 0).
 * ⛔ 여기에 파일 이름을 다시 적지 마십시오.
 */
const { STATIC } = require('../scripts/build-static.js');

/** 배포되는 전 페이지. 하드코딩 검사는 **여기 전부**를 봅니다. */
const PAGES = STATIC.html.map((e) => e.file);
const KO_PAGES = STATIC.html.filter((e) => e.locale === 'ko').map((e) => e.file);
const EN_PAGES = STATIC.html.filter((e) => e.locale === 'en').map((e) => e.file);

/**
 * 🔴 **사업자정보를 «싣는» 페이지** — 토큰을 쓰는 페이지만입니다.
 *
 * ⚠️ 전 페이지가 사업자정보를 싣지는 않습니다(`sample.html` 은 예시 리포트라 푸터가 없습니다).
 *    「전 페이지에 값이 들어간다」로 재면 그런 페이지가 생기는 날 검사가 거짓으로 red 가 됩니다.
 * 🔴 그래서 **소스가 토큰을 쓰는가**로 가릅니다 — 값이 아니라 «의도»를 축으로 삼습니다.
 */
const carriesBiz = (f) => /\{\{biz\./.test(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const KO_BIZ_PAGES = () => KO_PAGES.filter(carriesBiz);
const EN_BIZ_PAGES = () => EN_PAGES.filter(carriesBiz);

function build() {
  execFileSync('node', [path.join(ROOT, 'scripts', 'build-static.js')], {
    cwd: ROOT,
    stdio: 'pipe',
  });
}

/*
 * ══════════════════════════════════════════════════════════════════════════
 * 🔴 **site.config.json 오염 방지** 〔신설 2026-08-30 · 대표 지적〕
 * ══════════════════════════════════════════════════════════════════════════
 * 아래 「한 곳에서 바꾸면 전 페이지가 따라온다」 검사는 **진짜 설정 파일을 고쳤다가
 * 되돌립니다.** `finally` 가 그것을 되돌리지만 **Ctrl-C 로 죽이면 `finally` 가 돌지 않고**
 * 프로브 값(`2026-서울강남-00000`)이 그대로 남습니다. 검사가 오래 red 였던 동안 사람들이
 * 중간에 끊는 일이 잦았고, 그래서 오염이 되풀이됐습니다.
 *
 * 🔴 그래서 **원본을 파일 밖에 붙들고 종료 경로마다 되돌립니다.** `exit` 는 동기 훅이라
 *    `writeFileSync` 가 돕니다. ⛔ 이 장치를 지우지 마십시오.
 * ⚠️ `SIGKILL` 은 못 막습니다 — 막을 수 있는 것이 없습니다(그때는 `git checkout` 하십시오).
 */
let configBackup = null;
function guardConfig() {
  if (configBackup === null) configBackup = fs.readFileSync(CONFIG, 'utf8');
}
function restoreConfig() {
  if (configBackup === null) return;
  if (fs.readFileSync(CONFIG, 'utf8') !== configBackup) fs.writeFileSync(CONFIG, configBackup);
}
process.on('exit', restoreConfig);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { restoreConfig(); process.exit(130); });
}

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
}

test('소스 HTML 에 사업자정보 값이 하드코딩돼 있지 않다', () => {
  const config = readConfig();
  // 주석 안의 언급은 셈에서 뺍니다 — 「"주식회사 테오네"를 "(주)테오네"로 줄여 쓰지
  // 마십시오」 같은 인수인계 메모는 값이 아니라 설명이고, 빌드가 어차피 걷어냅니다.
  // HTML 주석뿐 아니라 <style>·<script> 안(=CSS·JS 주석이 사는 곳)도 함께 뺍니다.
  const stripComments = (h) =>
    h
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');

  for (const page of KO_PAGES) {
    const html = stripComments(fs.readFileSync(path.join(ROOT, page), 'utf8'));
    for (const [key, value] of Object.entries(config.biz.ko)) {
      if (key.startsWith('_')) continue;
      assert.ok(
        !html.includes(value),
        `${page}: 사업자정보 "${value}" 가 하드코딩돼 있습니다. {{biz.${key}}} 를 쓰십시오`
      );
    }
  }

  for (const page of EN_PAGES) {
    const html = stripComments(fs.readFileSync(path.join(ROOT, page), 'utf8'));
    for (const [key, value] of Object.entries(config.biz.en)) {
      if (key.startsWith('_')) continue;
      assert.ok(
        !html.includes(value),
        `${page}: 사업자정보 "${value}" 가 하드코딩돼 있습니다. {{biz.${key}}} 를 쓰십시오`
      );
    }
  }
});

test('빌드 산출물에 미치환 토큰이 남지 않는다', () => {
  build();
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(DIST, page), 'utf8');
    const left = html.match(/\{\{[\s\S]{0,40}?\}\}/g) || [];
    assert.deepEqual(left, [], `${page}: 치환되지 않은 토큰이 남았습니다`);
  }
});

test('현재 설정값이 사업자정보를 싣는 페이지 산출물에 그대로 들어간다', () => {
  const config = readConfig();
  build();

  /*
   * ⚠️ **여섯 값을 «전부» 싣는 페이지만 봅니다** — 랜딩 푸터는 요약이라 상호·대표·등록번호·
   *    주소 넷만 싣고 통신판매업신고번호·전화는 정책 페이지 푸터가 듭니다. 「전 페이지가
   *    여섯을 다 갖는다」로 재면 랜딩이 거짓 red 가 됩니다.
   * 🔴 대신 **각 페이지가 «자기가 쓴 토큰의» 값을 갖는가**를 봅니다 — 그것이 이 검사가
   *    지키려던 것(설정 → 산출물 도달)이고 페이지 구성과 무관합니다.
   */
  const tokensOf = (src) => [...src.matchAll(/\{\{biz\.([a-zA-Z]+)\}\}/g)].map((m) => m[1]);

  for (const [pages, locale] of [[KO_BIZ_PAGES(), 'ko'], [EN_BIZ_PAGES(), 'en']]) {
    assert.ok(pages.length > 0, locale + ' 쪽에 사업자정보를 싣는 페이지가 0장입니다 — 검사가 헛돕니다');
    for (const page of pages) {
      const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
      const html = fs.readFileSync(path.join(DIST, page), 'utf8');
      for (const key of new Set(tokensOf(src))) {
        assert.ok(
          html.includes(config.biz[locale][key]),
          `${page}: biz.${locale}.${key} 값이 산출물에 없습니다`
        );
      }
    }
  }
});

test('통신판매업신고번호를 한 곳에서 바꾸면 전 페이지가 따라온다', () => {
  // 이 테스트가 A-1 의 본론입니다 — 신고번호가 확정되는 날 실제로 일어날 일을
  // 그대로 해 봅니다: site.config.json 한 줄만 고치고 빌드.
  guardConfig();
  const original = fs.readFileSync(CONFIG, 'utf8');
  const config = JSON.parse(original);

  const KO_PROBE = '2026-서울강남-00000';
  const EN_PROBE = '2026-Seoul-Gangnam-00000';
  config.biz.ko.ecommerceNo = KO_PROBE;
  config.biz.en.ecommerceNo = EN_PROBE;

  try {
    fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2) + '\n');
    build();

    /* ⚠️ 신고번호 토큰을 «쓰는» 페이지만 봅니다 — 랜딩 푸터는 그 항목을 싣지 않습니다. */
    const uses = (f) => /\{\{biz\.ecommerceNo\}\}/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    const koTargets = KO_PAGES.filter(uses);
    const enTargets = EN_PAGES.filter(uses);
    assert.ok(koTargets.length > 0 && enTargets.length > 0,
      '신고번호를 싣는 페이지가 없습니다 — 이 검사가 아무것도 재지 않습니다');

    for (const page of koTargets) {
      const html = fs.readFileSync(path.join(DIST, page), 'utf8');
      assert.ok(html.includes(KO_PROBE), `${page}: 바뀐 신고번호가 반영되지 않았습니다`);
      assert.ok(!html.includes('신청 중'), `${page}: 예전 값이 남아 있습니다`);
    }
    for (const page of enTargets) {
      const html = fs.readFileSync(path.join(DIST, page), 'utf8');
      assert.ok(html.includes(EN_PROBE), `${page}: 바뀐 신고번호가 반영되지 않았습니다`);
      assert.ok(!html.includes('Applied for'), `${page}: 예전 값이 남아 있습니다`);
    }
  } finally {
    fs.writeFileSync(CONFIG, original);
    build(); // 원상복구
  }
  // 🔴 되돌아왔는지 «확인»합니다 — 조용히 오염된 채 통과하지 않습니다.
  assert.strictEqual(fs.readFileSync(CONFIG, 'utf8'), original,
    'site.config.json 이 프로브 값인 채로 남았습니다 — git checkout site.config.json 하십시오');
});

test('사전에 없는 토큰이 있으면 빌드가 실패한다', () => {
  // 오타(biz.ecommerceNumber)가 나면 화면에 {{...}} 가 그대로 찍힙니다.
  // 조용히 나가는 것보다 빌드가 깨지는 편이 낫습니다.
  /* ⚠️ 대상을 손으로 고르지 않습니다 — 그 토큰을 «쓰는» 첫 페이지를 씁니다. */
  const target = KO_PAGES.find((f) =>
    /\{\{biz\.ecommerceNo\}\}/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  assert.ok(target, '신고번호 토큰을 쓰는 페이지가 없습니다');
  const page = path.join(ROOT, target);
  const original = fs.readFileSync(page, 'utf8');
  try {
    fs.writeFileSync(page, original.replace('{{biz.ecommerceNo}}', '{{biz.thisKeyDoesNotExist}}'));
    assert.throws(() => build(), '미치환 토큰이 있는데도 빌드가 성공했습니다');
  } finally {
    fs.writeFileSync(page, original);
    build(); // 원상복구
  }
});

test('site.config.json 이 두 언어 묶음을 모두 갖는다', () => {
  const config = readConfig();
  for (const locale of ['ko', 'en']) {
    for (const key of ['companyName', 'ceo', 'registrationNo', 'ecommerceNo', 'address', 'phone']) {
      const value = config.biz[locale][key];
      assert.equal(typeof value, 'string', `biz.${locale}.${key} 가 없습니다`);
      assert.ok(value.trim().length > 0, `biz.${locale}.${key} 가 비어 있습니다`);
    }
  }
  // 사업자등록번호는 언어와 무관한 같은 번호입니다. 갈라지면 둘 중 하나가 틀린 것입니다.
  assert.equal(config.biz.ko.registrationNo, config.biz.en.registrationNo);
});
