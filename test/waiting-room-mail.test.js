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

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **(D-1) 닫혔습니다 — 죽은 링크를 걷었습니다** 〔2026-08-31 · 대표 결정 ⓐ〕
 * ══════════════════════════════════════════════════════════════════════════════
 * 종전 두 검사는 「메일 링크가 랜딩의 실재하는 앵커를 가리키는가」와 「훅 문장이 랜딩
 * `.feat-hook` 과 같은가」를 쟀고, 2026-08-29 개편이 **그 앵커와 그 문단을 둘 다 걷어내면서**
 * 잴 대상이 사라졌습니다(실측: `id="feat-timeline"` 0건 · `.feat-hook` 0건).
 *
 * 결정은 **ⓐ 메일에서 죽은 링크를 걷는다**였습니다. ⛔ 랜딩에 앵커를 다시 만들지 않습니다 —
 * 그 섹션은 개편이 의도적으로 내린 것이고, 링크 하나 때문에 구조를 되돌릴 수 없습니다.
 *
 * 🔴 **그래서 검사를 «뒤집습니다»** — 「앵커가 있는가」가 아니라 **「랜딩 앵커로 가는 링크가
 *    없는가」**를 잽니다. 지우면 다음 사람이 편의로 그 링크를 되살리고, 그때 아무도 모릅니다.
 * ⚠️ 훅 문장 대조는 되살릴 수 없습니다 — 대조 상대가 사라졌습니다. 대신 **그 문단이 여전히
 *    메일에 있는가**를 아래 「md 가 지정한 문구」·「무료를 단정하지 않는다」가 잽니다
 *    (블록을 통째로 걷지 «않은» 것이 그 둘이 계속 도는 이유입니다).
 */

test('🔴 메일이 랜딩 앵커로 가는 링크를 싣지 않는다 — 죽은 링크는 되살아나기 쉽다', () => {
  for (const html of [notify.waitingRoomHtml(), notify.waitingRoomHtml(true)]) {
    assert.ok(html.indexOf('#feat-timeline') === -1,
      '죽은 앵커가 메일에 돌아왔습니다 — 랜딩에 그 id 가 없습니다');
    assert.ok(!/href="[^"]*trops\.kr\/#/.test(html),
      '랜딩의 «다른» 앵커로 가는 링크가 생겼습니다 — 개편으로 사라질 수 있는 자리입니다');
  }
});

test('🔴 링크 빌더 자체가 사라졌다 — 부르는 곳이 생기면 red 다', () => {
  assert.strictEqual(typeof notify.buildTimelinePreviewLink, 'undefined',
    'buildTimelinePreviewLink 가 되살아났습니다 — 그 함수는 죽은 앵커를 만듭니다');
  const src = fs.readFileSync(path.join(ROOT, 'api', '_notify.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(src.indexOf('feat-timeline') === -1,
    '실행되는 코드에 죽은 앵커가 남아 있습니다');
});

test('🔴 남은 링크는 «살아 있는» 자리로 간다 — 앱의 계약 등록', () => {
  for (const html of [notify.waitingRoomHtml(), notify.waitingRoomHtml(true)]) {
    assert.ok(/href="[^"]*app\.trops\.kr\/"/.test(html),
      '대기공백 블록에 살아 있는 링크가 하나도 없습니다');
  }
});

/* ── ② 랜딩과 같은 말을 하는가 ───────────────────────────────────────────── */

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

/* ── SLA 문구 자체 (S6) ──────────────────────────────────────────────────── */

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 **(D-1) 이 파일이 «진짜 결함»을 가리키고 있습니다 — 낡은 기대가 아닙니다**
 * ══════════════════════════════════════════════════════════════════════════════
 * 실측 2026-08-30:
 *     api/_notify.js:80   buildTimelinePreviewLink() → origin() + '/#feat-timeline'
 *     index.html          id="feat-timeline" → **0건** · .feat-hook → **0건**
 * 2026-08-29 랜딩 전면교체가 도착지를 걷었는데 **메일은 그대로 그 앵커를 싣습니다.**
 * 국·영문 양쪽이고 `sendIntakeMails` 는 무상·유료 두 경로가 공유합니다(위 「대기공백 블록을
 * 부른다」 가 그 배선을 지금도 확인합니다). 누르면 오류 없이 **페이지 맨 위로 떨어집니다** —
 * `api/_notify.js` 주석이 스스로 「id 를 바꾸면 조용히 페이지 맨 위로 떨어진다」고 적어 둔
 * 바로 그 고장이며, **이미 발송된 메일에도 그대로 남아 있습니다.**
 *
 * ⚠️ **오늘 새로 발송되지는 않습니다** — 살아 있는 8장에 `<form>`·`fetch(` 가 0건이고
 *    `api/intake.js` 에 CORS 헤더가 없어 접수 경로가 닫혀 있습니다. 그래서 red 로 두지 않고
 *    **`skip` + 사유**로 남깁니다(진짜 실패가 묻히지 않게). ⛔ 지우지 마십시오.
 * 🔴 **삭제 알림 메일에는 이 블록이 없습니다**(`sendErasureMails` 는 `waitingRoomHtml` 을
 *    쓰지 않습니다 — 실측). 그래서 `npm run erasure:apply` 경로는 영향받지 않습니다.
 *
 * ── ⚠️ 함께 걷은 것 (SLA 화면 대조 4건) ────────────────────────────────────
 * 「리마인드 메일이 화면과 같은 값을 말한다」·「전액환불 문구 바로 뒤」·「결제 영역 안」·
 * 「금지 동사·과장 표현 0」 — 넷 다 `precheck.html` 결제 화면을 상대로 대조했고 그 화면이
 * 사라졌습니다. 🔴 **잃은 보증**: 메일 문안과 화면 문안이 «같은 값»인지 아무도 재지 않습니다.
 * ⚠️ 「금지 동사·과장어 0」은 메일 문안만으로도 잴 수 있어 되살릴 후보입니다(별 배치).
 */
