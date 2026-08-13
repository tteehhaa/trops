/*
 * 대기 공백 제품노출 테스트 〔S8 · 흐름 md §3 · §5-1 3번 · 신설 2026-08-13〕
 *
 *   npm test        (node --test test/)
 *
 * md 근거: 「검수 대기 시간 동안 고객이 아무 접점도 없는 공백을 제품 노출 기회로
 * 전환」. 결제확인 메일에 기한관리 미리보기 링크를 넣는 것이 그 장치입니다.
 *
 * 여기서 보는 것은 셋입니다.
 *
 *   ① 링크가 **실재하는 앵커**를 가리키는가. `#feat-timeline` 은 index.html 의
 *      기한관리 카드 id 이고, 그 id 가 바뀌면 이 링크는 조용히 페이지 맨 위로
 *      떨어집니다 — 아무 오류도 나지 않는 종류의 고장이라 테스트로 박아 둡니다.
 *   ② 훅 문장이 랜딩과 **같은 말**을 하는가. 눌러 도착한 자리가 낯설면 안 됩니다.
 *   ③ 무상·유료 **양쪽** 확인메일에 들어가는가.
 *
 * ⚠️ 이 파일은 api/_notify.js 를 **대역 없이** require 합니다 — 문면을 보는 것이
 *    목적이라 실물이 필요합니다. Resend 클라이언트는 「보낼 때」 만들어지므로
 *    (2026-08-11 수정) 키가 없어도 require 는 성공합니다. 그 배선이 깨지면
 *    이 파일이 import 단계에서 죽어 그 사실을 알려 줍니다.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const notify = require('../api/_notify.js');

/* ── ① 링크가 실재하는 앵커를 가리키는가 ─────────────────────────────────── */

test('기한관리 링크가 랜딩의 실재하는 카드 id 를 가리킨다', () => {
  const link = notify.buildTimelinePreviewLink();
  const hash = link.slice(link.indexOf('#') + 1);
  assert.ok(hash && link.indexOf('#') !== -1, '링크에 앵커가 없습니다: ' + link);

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(
    html.indexOf('id="' + hash + '"') !== -1,
    'index.html 에 id="' + hash + '" 가 없습니다 — 이 링크는 페이지 맨 위로 떨어집니다'
  );
});

test('링크는 사이트 주소를 쓴다 — 판정층(app) 호스트와 섞지 않는다', () => {
  const link = notify.buildTimelinePreviewLink();
  assert.ok(link.indexOf('https://') === 0, link);
  assert.ok(link.indexOf('app.trops.kr') === -1,
    '기한관리 미리보기는 랜딩(마케팅 사이트)의 아코디언입니다 — app 호스트가 아닙니다');
});

/* ── ② 랜딩과 같은 말을 하는가 ───────────────────────────────────────────── */

test('훅 문장이 랜딩 .feat-hook 과 같다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const hook = (html.match(/<p class="feat-hook">([^<]+)<\/p>/) || [])[1];
  assert.ok(hook, 'index.html 에서 .feat-hook 문장을 찾지 못했습니다');

  assert.ok(
    notify.waitingRoomHtml().indexOf(hook.trim()) !== -1,
    '메일의 훅 문장이 랜딩과 다릅니다 — 눌러 도착한 자리가 낯설어집니다.\n랜딩: ' + hook
  );
});

test('md 가 지정한 문구가 들어 있다', () => {
  const html = notify.waitingRoomHtml();
  assert.ok(html.indexOf('결과 준비되는 동안, 기한관리 먼저 둘러보세요') !== -1,
    '흐름 md §3 이 지정한 문구입니다');
});

test('「무료」를 유료화 여지 없이 단정하지 않는다', () => {
  // 흐름 md §4 Give/Get: 기한관리는 무료임을 밝혀야 하나 「추후 유료화 여지를
  // 남기는 문구로」. 랜딩 .feat-meta 도 「지금은 무료」를 씁니다.
  const html = notify.waitingRoomHtml();
  assert.ok(html.indexOf('지금은 무료') !== -1, '「지금은 무료」 표기가 없습니다');
  assert.ok(
    !/(?<!지금은 )무료입니다/.test(html.replace('지금은 무료입니다', '')),
    '조건 없는 「무료입니다」 단정이 있습니다'
  );
});

test('계약 등록 링크는 판정층(app) 호스트다 — 실제 제품 진입로', () => {
  assert.ok(notify.waitingRoomHtml().indexOf('app.trops.kr') !== -1,
    '「계약 등록해보기」가 app.trops.kr 로 가지 않습니다');
});

/* ── ③ 양쪽 확인메일에 들어가는가 ────────────────────────────────────────── */

test('확인메일 본문이 대기공백 블록을 부른다 — 무상·유료 공용 경로다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'api', '_notify.js'), 'utf8');

  // sendIntakeMails 안에서 불려야 합니다. api/intake.js(무상)와
  // api/payment-confirm.js(유료)가 그 한 함수를 공유합니다.
  const fn = src.match(/async function sendIntakeMails[\s\S]*?\n}/);
  assert.ok(fn, 'sendIntakeMails 를 찾지 못했습니다');
  assert.ok(fn[0].indexOf('${waitingRoomHtml()}') !== -1,
    'sendIntakeMails 가 대기공백 블록을 넣지 않습니다');

  // 두 라우트가 같은 함수를 쓰는지도 확인합니다 — 한쪽이 자기 메일을 따로
  // 만들면 그쪽에는 이 블록이 없습니다.
  for (const route of ['intake.js', 'payment-confirm.js']) {
    const routeSrc = fs.readFileSync(path.join(ROOT, 'api', route), 'utf8');
    assert.match(routeSrc, /sendIntakeMails/, route + ' 가 공용 확인메일을 쓰지 않습니다');
  }
});

/* ── 결제 미완료 리마인드 문면 ───────────────────────────────────────────── */

test('리마인드 메일이 지키지 못할 약속을 하지 않는다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'api', '_notify.js'), 'utf8');
  const fn = src.match(/async function sendPaymentReminderMail[\s\S]*?\n}/);
  assert.ok(fn, 'sendPaymentReminderMail 을 찾지 못했습니다');

  // 주석은 걷어냅니다 — 「이렇게 쓰지 마십시오」라고 적은 주석 자체가 걸립니다.
  const body = fn[0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\*.*$/gm, '');

  // 흐름 md §3 은 「재업로드 불필요」를 적었지만 현재 접수 폼은 파일을 다시 받습니다.
  // 지키지 못할 약속을 쓰면 눌러 들어온 사람이 빈 폼을 보고 두 번 이탈합니다.
  assert.ok(body.indexOf('재업로드 불필요') === -1 && body.indexOf('다시 올리지 않') === -1,
    '결제 재개(주문 재사용)가 구현되기 전에는 「재업로드 불필요」를 약속할 수 없습니다');
  assert.ok(body.indexOf('한 번 더 올려') !== -1,
    '재업로드가 필요하다는 사실을 밝혀야 합니다');

  // md §3 이 지정한 제목 문구.
  assert.ok(body.indexOf('업로드하신 서류, 결제만 하면 진행됩니다') !== -1,
    '흐름 md §3 이 지정한 문구입니다');

  // 1회성임을 밝힙니다 — 또 올까 걱정하게 두지 않습니다.
  assert.ok(body.indexOf('한 번만') !== -1, '1회 발송임을 밝히지 않았습니다');
});

test('리마인드 메일이 SLA·환불 약속을 화면과 같은 값으로 말한다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'api', '_notify.js'), 'utf8');
  const fn = src.match(/async function sendPaymentReminderMail[\s\S]*?\n}/)[0];
  const html = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');

  const sla = (html.match(/<p class="pay-sla">([^<]+)<\/p>/) || [])[1];
  assert.ok(sla, 'precheck.html 에 SLA 문구가 없습니다');

  const hours = (sla.match(/(\d+)시간/) || [])[1];
  assert.ok(hours, 'SLA 문구에서 시간 값을 읽지 못했습니다: ' + sla);
  assert.ok(fn.indexOf('영업일 기준 ' + hours + '시간') !== -1,
    '메일과 결제 화면이 서로 다른 SLA 를 말합니다 — 화면: ' + sla);
});

/* ── SLA 문구 자체 (S6) ──────────────────────────────────────────────────── */

test('SLA 문구가 전액환불 문구 바로 뒤에 있다', () => {
  // 흐름 md §5-1 1번: 선결제 마찰의 두 축(돌려받을 수 있는가 / 언제 받는가)이
  // 한 자리에서 함께 답돼야 합니다.
  const html = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');
  const markup = html.replace(/<!--[\s\S]*?-->/g, '');

  const refundAt = markup.indexOf('class="pay-refund"');
  const slaAt = markup.indexOf('class="pay-sla"');
  assert.ok(refundAt !== -1, '전액환불 문구가 사라졌습니다');
  assert.ok(slaAt !== -1, 'SLA 문구가 없습니다');
  assert.ok(slaAt > refundAt, 'SLA 가 환불 문구보다 앞에 있습니다');

  // 사이에 다른 블록이 끼지 않았는지 — 「근처」가 지켜지는지 봅니다.
  const between = markup.slice(refundAt, slaAt);
  assert.ok((between.match(/<p /g) || []).length <= 1,
    '환불 문구와 SLA 사이에 다른 문단이 끼었습니다 — 두 축이 함께 읽히지 않습니다');
});

test('SLA 문구가 결제 영역 안에 있다 — 흐름 md §3 이 결제 화면으로 지정했다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');
  const payArea = html.match(/<div class="pay-area"[\s\S]*?\n            <\/div>/);
  assert.ok(payArea, '.pay-area 블록을 찾지 못했습니다');
  assert.ok(payArea[0].indexOf('class="pay-sla"') !== -1,
    'SLA 문구가 결제 영역 밖에 있습니다');
});

test('SLA 문구에 금지 동사·과장 표현이 없다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'precheck.html'), 'utf8');
  const sla = (html.match(/<p class="pay-sla">([^<]+)<\/p>/) || [])[1];

  for (const banned of ['자문', '판단', '검토', '평가', '진단', '검수']) {
    assert.ok(sla.indexOf(banned) === -1, 'SLA 문구에 "' + banned + '" 가 있습니다');
  }
  for (const overclaim of ['즉시', '바로', '실시간']) {
    assert.ok(sla.indexOf(overclaim) === -1,
      'SLA 문구에 "' + overclaim + '" 가 있습니다 — 운영자 검수가 사이에 있습니다');
  }
});
