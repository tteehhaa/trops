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

/** 사업자정보가 실리는 모든 페이지. 새 페이지를 만들면 여기에도 넣으십시오. */
const PAGES = [
  'index.html', 'en.html', 'nda.html', 'precheck.html',
  'refund.html', 'uae.html', 'privacy.html', 'en-privacy.html',
];

const KO_PAGES = PAGES.filter((p) => p !== 'en.html' && p !== 'en-privacy.html');
const EN_PAGES = ['en.html', 'en-privacy.html'];

function build() {
  execFileSync('node', [path.join(ROOT, 'scripts', 'build-static.js')], {
    cwd: ROOT,
    stdio: 'pipe',
  });
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

test('현재 설정값이 8개 페이지 산출물에 그대로 들어간다', () => {
  const config = readConfig();
  build();

  for (const page of KO_PAGES) {
    const html = fs.readFileSync(path.join(DIST, page), 'utf8');
    for (const key of ['companyName', 'ceo', 'registrationNo', 'ecommerceNo', 'address', 'phone']) {
      assert.ok(
        html.includes(config.biz.ko[key]),
        `${page}: biz.ko.${key} 값이 산출물에 없습니다`
      );
    }
  }

  for (const page of EN_PAGES) {
    const html = fs.readFileSync(path.join(DIST, page), 'utf8');
    for (const key of ['companyName', 'ceo', 'registrationNo', 'ecommerceNo', 'address', 'phone']) {
      assert.ok(
        html.includes(config.biz.en[key]),
        `${page}: biz.en.${key} 값이 산출물에 없습니다`
      );
    }
  }
});

test('통신판매업신고번호를 한 곳에서 바꾸면 전 페이지가 따라온다', () => {
  // 이 테스트가 A-1 의 본론입니다 — 신고번호가 확정되는 날 실제로 일어날 일을
  // 그대로 해 봅니다: site.config.json 한 줄만 고치고 빌드.
  const original = fs.readFileSync(CONFIG, 'utf8');
  const config = JSON.parse(original);

  const KO_PROBE = '2026-서울강남-00000';
  const EN_PROBE = '2026-Seoul-Gangnam-00000';
  config.biz.ko.ecommerceNo = KO_PROBE;
  config.biz.en.ecommerceNo = EN_PROBE;

  try {
    fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2) + '\n');
    build();

    for (const page of KO_PAGES) {
      const html = fs.readFileSync(path.join(DIST, page), 'utf8');
      assert.ok(html.includes(KO_PROBE), `${page}: 바뀐 신고번호가 반영되지 않았습니다`);
      assert.ok(!html.includes('신청 중'), `${page}: 예전 값이 남아 있습니다`);
    }
    for (const page of EN_PAGES) {
      const html = fs.readFileSync(path.join(DIST, page), 'utf8');
      assert.ok(html.includes(EN_PROBE), `${page}: 바뀐 신고번호가 반영되지 않았습니다`);
      assert.ok(!html.includes('Applied for'), `${page}: 예전 값이 남아 있습니다`);
    }
  } finally {
    fs.writeFileSync(CONFIG, original);
    build(); // 원상복구
  }
});

test('사전에 없는 토큰이 있으면 빌드가 실패한다', () => {
  // 오타(biz.ecommerceNumber)가 나면 화면에 {{...}} 가 그대로 찍힙니다.
  // 조용히 나가는 것보다 빌드가 깨지는 편이 낫습니다.
  const page = path.join(ROOT, 'nda.html');
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
