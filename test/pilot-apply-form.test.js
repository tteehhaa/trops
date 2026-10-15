'use strict';

// The retired pilot intake is replaced by direct app signup.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const body = file => read(file).replace(/<!--[\s\S]*?-->/g, '').replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/g, '');

test('랜딩이 신청서나 승인 대기 없이 앱에서 시작하도록 안내한다', () => {
  for (const file of ['index.html', 'en.html']) {
    const h = body(file);
    assert.ok(!/<form\b/.test(h));
    assert.ok(!/href="\/?#(?:join|apply)"/.test(h));
    assert.ok(!/실증|초대받|승인 대기|invited companies|in pilot|invitation period/i.test(h));
    assert.ok(!/pilot-apply|pilot\/account/.test(read(file)));
    assert.ok(/href="https:\/\/app\.trops\.kr\/" data-track="hero-start"/.test(h));
  }
});

test('종료한 랜딩 실증 접수 스위치가 양쪽 환경에서 꺼져 있다', () => {
  const config = JSON.parse(read('site.config.json'));
  assert.equal(config.pilotApply.productionEnabled, false);
  assert.equal(config.pilotApply.previewEnabled, false);
});

test('회사 소개도 앱으로 바로 연결되고 실증 모집을 하지 않는다', () => {
  const h = body('about.html');
  assert.ok(h.includes('href="https://app.trops.kr/" data-track="about-start"'));
  assert.ok(!/href="\/#join"|실증에 참여|초대 방식/.test(h));
});

test('자료 카드 세 개와 핵심 기능 세 개가 유지된다', () => {
  for (const file of ['index.html', 'en.html']) {
    const h = body(file);
    const section = h.match(/<section id="resources"[\s\S]*?<\/section>/)?.[0];
    assert.ok(section);
    assert.equal((section.match(/<a\b/g) || []).length, 3);
    assert.equal((h.match(/role="tab"/g) || []).length, 3);
    assert.ok(!h.includes('필요할 때 찾아보세요'));
    assert.ok(!h.includes('가입 없이 읽을 수 있습니다.'));
  }
});

test('화면 예시는 입력 없는 이미지이며 실제 작업으로 오인할 폼이 없다', () => {
  for (const file of ['index.html', 'en.html']) {
    const hero = body(file).match(/<header class="hero"[\s\S]*?<\/header>/)?.[0];
    assert.ok(hero);
    assert.ok(hero.includes('src="/assets/img/workspace-overview.png"'));
    assert.ok(!/<(?:input|textarea|button)\b/.test(hero));
    assert.ok(!/data:image\//.test(read(file)));
  }
});

test('운영 페이지가 검색 차단이나 목업 표시를 싣지 않는다', () => {
  for (const file of ['index.html', 'en.html']) {
    assert.ok(!/content="noindex|랜딩 모션 시안|미배포/.test(read(file)));
  }
});

test('문의·교육·파트너 입구가 남아 있다', () => {
  for (const file of ['index.html', 'en.html']) {
    const target = file === 'en.html' ? 'mailto:contact@theo-ne.com' : '/contact';
    assert.ok(body(file).includes('href="' + target + '" data-track="footer-contact"'));
  }
});
