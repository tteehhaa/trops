'use strict';

// The retired pilot intake is replaced by direct app signup.
/*
 * 🔄 2026-11-03 대표 결정 — 앱 비로그인 홈이 수출 리포트 처음 화면으로 바뀌어 랜딩 첫 화면도 같은 입구로.
 *    국문(index.html) 첫 화면에 폼이 «하나» 섭니다 — 홈페이지 주소를 받아 앱 비로그인 첫 화면으로 보내는 리포트 입구
 *    (`data-report-start` · action https://app.trops.kr/ · 🔄 2026-11-05 종전 /login)입니다. 신청서 · 접수 폼이 아닙니다.
 *    그래서 «폼 0» · «히어로 입력 0» 단정은 en.html 에만 그대로 두고, index.html 은 «폼은 그 입구 하나뿐 ·
 *    화면 예시(figure)는 여전히 입력 없는 이미지»로 바꿔 잽니다. 입구 자체의 검사는 `report-start.test.js`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const body = file => read(file).replace(/<!--[\s\S]*?-->/g, '').replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/g, '');

/** 국문 첫 화면의 유일한 폼 — 리포트 입구(앱 비로그인 첫 화면으로 가는 GET · 🔄 2026-11-05 종전 /login). */
const REPORT_FORM = /^<form\b[^>]*\baction="https:\/\/app\.trops\.kr\/"[^>]*\bmethod="get"[^>]*\bdata-report-start\b[^>]*>$/;

test('랜딩이 신청서나 승인 대기 없이 앱에서 시작하도록 안내한다', () => {
  for (const file of ['index.html', 'en.html']) {
    const h = body(file);
    const forms = [...h.matchAll(/<form\b[^>]*>/g)].map((m) => m[0]);
    if (file === 'en.html') assert.ok(!/<form\b/.test(h));
    else {
      assert.equal(forms.length, 1, file + ': 폼이 ' + forms.length + '개입니다 — 리포트 입구 하나여야 합니다');
      assert.match(forms[0], REPORT_FORM, file + ': 하나뿐인 폼이 리포트 입구(앱 첫 화면 · GET)가 아닙니다');
      assert.ok(!/<textarea\b|type="(email|tel|password)"/.test(h), file + ': 신청서 꼴의 입력칸이 있습니다');
    }
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

/*
 * 🔄 **「핵심 기능 세 개」를 세는 자리가 탭에서 기능 블록으로 옮겨 갔습니다** 〔2026-10-16 · 대표 결정〕
 *    토스페이먼츠형 히어로와 함께 제품 탭 세 개를 01·02·03 블록(`<ol class="features">`)으로 펼쳤습니다 —
 *    스크롤만 하는 방문자가 첫 탭(수출 서류)만 보고 지나가던 문제를 없애려는 것입니다.
 * 🔴 축은 그대로입니다 — 「제품 구획에 핵심 기능이 정확히 세 개」. 세는 대상만 `role="tab"` → `<li class="feature"` 입니다.
 * ⛔ 탭이 되살아나지 않게 `role="tab"` 0 도 함께 잽니다(블록과 탭이 한 장에 겹치면 같은 기능이 두 번 보입니다).
 */
test('자료 카드 세 개와 핵심 기능 세 개가 유지된다', () => {
  for (const file of ['index.html', 'en.html']) {
    const h = body(file);
    const section = h.match(/<section id="resources"[\s\S]*?<\/section>/)?.[0];
    assert.ok(section);
    assert.equal((section.match(/<a\b/g) || []).length, 3);
    const product = h.match(/<section id="product"[\s\S]*?<\/section>/)?.[0];
    assert.ok(product, file + ': 제품 구획을 찾지 못했습니다');
    assert.equal((product.match(/<li class="feature"/g) || []).length, 3, file + ': 제품 기능 블록이 세 개가 아닙니다');
    assert.equal((h.match(/role="tab"/g) || []).length, 0, file + ': 제품 탭이 남아 있습니다');
    assert.ok(!h.includes('필요할 때 찾아보세요'));
    assert.ok(!h.includes('가입 없이 읽을 수 있습니다.'));
  }
});

test('화면 예시는 입력 없는 이미지이며 실제 작업으로 오인할 폼이 없다', () => {
  for (const file of ['index.html', 'en.html']) {
    const hero = body(file).match(/<header class="hero"[\s\S]*?<\/header>/)?.[0];
    assert.ok(hero);
    assert.ok(!/data:image\//.test(read(file)));
    if (file === 'en.html') {
      assert.ok(hero.includes('src="/assets/img/workspace-overview.png"'));
      assert.ok(!/<(?:input|textarea|button)\b/.test(hero));
      continue;
    }
    /* 국문 — 화면 예시는 리포트 예시 이미지이고 그 안에 입력이 없다. 히어로의 입력은 리포트 입구의 한 칸 · 단추 하나뿐이다. */
    const figure = hero.match(/<figure class="appfig static-workspace" id="demo">[\s\S]*?<\/figure>/)?.[0];
    assert.ok(figure, file + ': 화면 예시(figure#demo)를 찾지 못했습니다');
    assert.ok(figure.includes('src="/assets/img/report-example.png"'), file + ': 화면 예시가 리포트 예시 이미지가 아닙니다');
    assert.ok(!/<(?:input|textarea|button|form)\b/.test(figure), file + ': 화면 예시 안에 입력이 있습니다');
    assert.ok(!figure.includes('workspace-demo'), file + ': 걷은 «요청 예시» 입력 흉내가 남아 있습니다');
    const form = hero.match(/<form\b[\s\S]*?<\/form>/)?.[0] || '';
    const outside = hero.replace(form, '');
    assert.ok(!/<(?:input|textarea|button)\b/.test(outside), file + ': 리포트 입구 밖에 입력 · 단추가 있습니다');
    /* 숨은 칸(유입원 from=landing)은 입력칸이 아니다 — 보이는 입력칸은 하나 · 숨은 칸도 하나. */
    assert.equal((form.match(/<input\b(?![^>]*type="hidden")/g) || []).length, 1, file + ': 리포트 입구의 입력칸이 하나가 아닙니다');
    assert.equal((form.match(/<input\b[^>]*type="hidden"/g) || []).length, 1, file + ': 리포트 입구의 숨은 칸이 하나가 아닙니다');
    assert.equal((form.match(/<button\b/g) || []).length, 1, file + ': 리포트 입구의 단추가 하나가 아닙니다');
    assert.ok(!/<textarea\b/.test(hero));
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
