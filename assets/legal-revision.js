/**
 * legal-revision.js — 방침 · 환불규정의 «개정 예고 → 시행»을 시행일(한국 날짜)에 저절로 바꿉니다 〔신설 2026-10-30〕
 *
 * 🔴 **왜** — 이 사이트는 정적 HTML 이라 시행일에 다시 배포하지 않으면 글이 바뀌지 않습니다.
 *    앱(app.trops.kr/privacy)은 서버가 한국 날짜로 판을 고르고(`lib/legal/revision.ts`), 이 파일이 그 일을 브라우저에서 합니다.
 * 🔴 **시행일은 한 곳** — `site.config.json` 의 `legal.revisionEffective` 를 빌드가 이 스크립트 태그의
 *    `data-effective` 에 채웁니다. 화면 글의 날짜(§07 · 고지)는 test/quick-check-report.test.js 가 같은 값인지 잽니다.
 * 🔴 **한국 날짜로 셉니다** — 기기 시각(UTC+9 로 옮긴 날짜)이 시행일 이상이면
 *      · `[data-rev-until]` (시행일까지만 서는 지금 글)을 걷고
 *      · `[data-rev-from]` (시행일부터 서는 새 글 · 처음엔 `hidden`)을 보입니다.
 * ⚠️ 스크립트가 돌지 않는 브라우저는 «지금 글 + 개정 예고»를 계속 봅니다 — 예고가 무엇이 언제 바뀌는지 적고 있습니다.
 * ⚠️ 빌드 없이 소스를 열면 `data-effective` 가 토큰 그대로라 아무것도 바꾸지 않습니다(지금 글).
 * ⛔ 판정 · 계측 · 저장 0 — 이 파일은 글을 보이고 숨기는 일만 합니다.
 */
(function () {
  'use strict';
  var me = document.currentScript;
  var on = me && me.getAttribute('data-effective');
  if (!on || !/^\d{4}-\d{2}-\d{2}$/.test(on)) return;
  var today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (today < on) return;
  var olds = document.querySelectorAll('[data-rev-until]');
  for (var i = 0; i < olds.length; i++) olds[i].parentNode.removeChild(olds[i]);
  var news = document.querySelectorAll('[data-rev-from]');
  for (var j = 0; j < news.length; j++) news[j].hidden = false;
})();
