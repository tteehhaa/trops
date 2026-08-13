/*
 * /precheck 접수 알림 (Resend).
 *
 * ⚠️ 경계: 접수·저장·알림·결제 처리만. LLM 호출·상태 판정 코드 없음.
 *
 * 파일명이 밑줄로 시작하므로 Vercel 은 이 파일을 엔드포인트로 만들지 않습니다.
 * api/intake.js(무상 건)와 api/payment-confirm.js(유료 건)가 공용으로 씁니다.
 * 두 곳에서 같은 메일을 보내야 하므로 한 곳에 둡니다 —
 * 복제해 두면 한쪽 문구만 고쳐지고 다른 쪽은 조용히 옛 문구로 나갑니다.
 * api/erasure.js(자료 즉시 삭제)도 여기의 sendErasureMails 를 씁니다.
 *
 * ⚠️ 확인메일에 PDF 를 첨부하지 않습니다.
 *    회수·정정이 불가능하고, 30일 삭제 정책이 적용되지 않으며, 열람을 측정할 수 없습니다.
 *    메일에는 Magic Link 만 담습니다.
 *
 * 필요한 환경변수:
 *   RESEND_API_KEY
 *   PRECHECK_ORIGIN   (선택 · Magic Link 기준 주소. 기본 https://trops.kr)
 */

const { Resend } = require('resend');
const {
  agreementFor, fetchTariffRecord, lookupUrl, tariffDisclaimer,
} = require('./_agreements.js');

/*
 * 🔴 클라이언트를 **모듈을 읽을 때 만들지 않습니다** (2026-08-11).
 *
 * 전에는 여기서 바로 `new Resend(process.env.RESEND_API_KEY)` 를 했습니다.
 * Resend 는 키가 비어 있으면 **생성자에서 던집니다.** 그래서 RESEND_API_KEY 가
 * 없는 환경에서는 이 파일을 require 하는 것만으로 함수가 죽었습니다 —
 * 접수·결제·환불 라우트 전부가 「메일을 못 보냄」이 아니라 「import 실패」로
 * 무너집니다. 메일은 이 저장소에서 실패해도 접수를 취소하지 않는 부속 동작인데,
 * 그 부속이 본체를 끌고 내려가는 배선이었습니다.
 *
 * 지금은 보낼 때 만듭니다. 키가 없으면 아래 send 함수들의 try 안에서 던지고,
 * 각 함수가 이미 갖고 있는 「실패는 로그로만」 처리에 걸립니다.
 * (api/cron/refund-blocked.js 가 이 파일을 require 하면서 드러난 문제입니다 —
 *  test/cron-registration.test.js 가 빈 env 로 전 라우트를 부릅니다.)
 */
let resendClient = null;

function resendApi() {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

const CONTACT_ADDRESS = 'contact@theo-ne.com';
const DEFAULT_ORIGIN = 'https://trops.kr';
/**
 * 판정층(trops_a) 주소. `DEFAULT_ORIGIN`(이 저장소의 사이트)과 **다른 호스트**입니다 —
 * 운영자 검토 화면은 trops_a 에 있습니다. 두 값을 섞지 마십시오.
 */
const DEFAULT_APP_ORIGIN = 'https://app.trops.kr';
const RETENTION_DAYS = 30;

function origin() {
  return (process.env.PRECHECK_ORIGIN || DEFAULT_ORIGIN).trim().replace(/\/+$/, '');
}

function appOrigin() {
  return (process.env.PRECHECK_APP_ORIGIN || DEFAULT_APP_ORIGIN).trim().replace(/\/+$/, '');
}

function buildMagicLink(token) {
  return origin() + '/precheck?r=' + encodeURIComponent(token);
}

/**
 * 랜딩의 기한관리 카드 앵커 〔흐름 md §3 · §5-1 3번 · 2026-08-13〕.
 *
 * `#feat-timeline` 은 index.html 05 「핵심기능 3분류」 아코디언의 기한관리 카드 id 입니다.
 * ⚠️ 앵커로 도착하면 카드는 **접힌 상태**입니다(펼침은 그 페이지 JS 의 [data-timeline-open]
 *    트리거 몫). 카드 제목과 셰브론이 보이므로 죽은 링크는 아니고, 한 번 더 눌러 펼치는
 *    형태입니다 — 메일에서 패널을 미리 펼칠 방법은 없습니다.
 * ⚠️ id 를 바꾸면 이 링크가 조용히 페이지 맨 위로 떨어집니다. index.html 의
 *    #feat-timeline 주석에 「id 를 바꾸지 마십시오」가 적혀 있는 이유 중 하나입니다.
 */
function buildTimelinePreviewLink() {
  return origin() + '/#feat-timeline';
}

/**
 * 대기 공백 동안의 제품 노출 블록 〔흐름 md §3 「결제확인 메일」 · §5-1 3번〕.
 *
 * md 근거: 「검수 대기 시간 동안 고객이 아무 접점도 없는 공백을 제품 노출 기회로 전환」.
 * 훅 문장은 랜딩 `.feat-hook` 원문 그대로입니다 — 메일과 화면이 **같은 말**을 해야
 * 클릭해서 도착한 자리가 낯설지 않습니다. 한쪽만 고치지 마십시오.
 *
 * ⚠️ 「무료」라고 쓰지 않고 「지금은 무료」로 씁니다 — md §4 Give/Get 표가 기한관리에만
 *    무료 표기를 허용하되 「추후 유료화 여지를 남기는 문구로」 라고 못박았습니다.
 *    (바이어확인 쪽에 「무료」를 쓰지 않는 것과는 다른 이유입니다.)
 * ⚠️ 무상·유료 **양쪽 메일에 붙입니다.** md §3 은 결제확인 메일을 지목했지만 대기
 *    공백은 무상 건도 같고, sendIntakeMails 는 두 경로가 공유하는 한 함수입니다.
 */
function waitingRoomHtml() {
  return `
        <hr>
        <p><strong>결과 준비되는 동안, 기한관리 먼저 둘러보세요.</strong></p>
        <p>계약서 하나에 기한이 몇 개나 숨어있는지 아세요?
          거래가 시작되면 계약서에 적힌 기한과 통관·외환 절차를 한 화면에 모아
          남은 날짜로 보여드립니다. 기한 7일 전과 1일 전에 메일로 알려드리고, 지금은 무료입니다.</p>
        <p><a href="${escapeHtml(buildTimelinePreviewLink())}">기한관리 미리보기</a>
          &nbsp;·&nbsp;
          <a href="${escapeHtml(appOrigin() + '/')}">계약 등록해보기</a></p>
  `;
}

/**
 * 운영자 검토 링크 〔2026-08-13〕 — trops_a 화면 C-05 목록의 **해당 접수를 강조한 상태**로 엽니다.
 *
 * `?new=` 가 그 강조를 켭니다(링크로 들어왔을 때만 색이 붙습니다 — 목록을 그냥 열면 아무 행도
 * 강조되지 않습니다). 접수 시점에는 아직 대조가 실행되지 않았으므로 그 화면의 「처리 대기」
 * 구획에 **미실행**으로 서 있고, 운영자가 거기서 [대조 실행]을 누릅니다.
 *
 * ⚠️ 접수 번호(`intake.id`)가 곧 trops_a 의 `run_id` 입니다 — 실행하면 같은 값으로 증적이
 *    생기므로 링크가 그대로 유효합니다.
 */
function buildReviewLink(intakeId) {
  return appOrigin() + '/admin/nda-runs?new=' + encodeURIComponent(intakeId);
}

/**
 * 운영자 알림 1통 + 이용자 확인메일 1통.
 *
 * 처리는 사람이 손으로 하므로 운영자 알림이 먼저입니다.
 * 어느 쪽이 실패해도 예외를 던지지 않습니다 — 접수는 이미 저장되었고,
 * 메일은 사람이 다시 보낼 수 있습니다. 실패는 로그로만 남깁니다.
 */
async function sendIntakeMails(info) {
  let confirmationSent = false;

  const paid = info.path === 'paid';
  const label = paid
    ? '유료 ' + formatWon(info.amount)
    : '무상 ' + String(info.slotNo).padStart(2, '0') + '/20';
  const bucket = info.storageBucket || 'intake';

  // 대조 기준(PRD-62 §3-3) — 자사 서식이 1순위, 공개 표준 서식은 자사 서식이 없을 때만 씁니다.
  // 운영자가 무엇과 대조할지 메일에서 바로 알 수 있어야 합니다.
  const ownFormName = typeof info.ownFormName === 'string' ? info.ownFormName : '';
  const basis = ownFormName
    ? '자사 서식 — ' + ownFormName
    : '자사 서식 없음 → 공개 라이선스로 배포되는 표준 서식';

  // 거래 정보(선택)를 넣으신 건에만 붙습니다. 없으면 trade 가 null 이고,
  // 아래 두 메일 모두 해당 문단을 만들지 않습니다 — 빈 항목을 남기지 않습니다.
  const trade = await describeTrade(info.targetCountry, info.hsCode);

  try {
    const { error } = await resendApi().emails.send({
      from: `TROPS 사전 확인 접수 <${CONTACT_ADDRESS}>`,
      to: [CONTACT_ADDRESS],
      replyTo: info.email,
      subject: `[TROPS] 사전 확인 접수 (${label}) - ${info.email}`,
      html: `
        <p><strong>접수 번호:</strong> ${escapeHtml(info.intakeId)}</p>
        <p><strong>경로:</strong> ${paid
          ? '건별 결제 ' + escapeHtml(formatWon(info.amount))
          : '무상 실증 ' + info.slotNo + ' / 20'}</p>
        ${paid ? `<p><strong>주문번호:</strong> ${escapeHtml(info.orderId || '-')}</p>` : ''}
        ${paid ? `<p><strong>결제키:</strong> ${escapeHtml(info.paymentKey || '-')}</p>` : ''}
        ${paid ? `<p><strong>결제수단:</strong> ${escapeHtml(info.method || '-')}</p>` : ''}
        <p><strong>이메일:</strong> ${escapeHtml(info.email)}</p>
        <p><strong>파일 ${info.fileCount}건:</strong> ${escapeHtml((info.fileNames || []).join(', ') || '-')}</p>
        <!-- 서류 종류 〔흐름 md §5〕. 지금은 늘 NDA 이지만 서류가 늘면 운영자가 이 한 줄로
             무엇을 대조해야 하는지 가려야 합니다. 넘어오지 않으면 표기하지 않습니다 —
             빈 항목을 남기지 않는 이 파일의 기존 처리(trade)와 같습니다. -->
        ${info.docTypeLabel ? `<p><strong>서류 종류:</strong> ${escapeHtml(info.docTypeLabel)}</p>` : ''}
        <p><strong>대조 기준:</strong> ${escapeHtml(basis)}</p>
        ${trade ? `<p><strong>거래 정보:</strong> ${escapeHtml(trade.operatorLine)}</p>` : ''}
        <p><strong>동의 2(비식별 데이터 활용):</strong> ${info.consentTraining ? '동의' : '미동의'}</p>
        <p><strong>접수 시각:</strong> ${escapeHtml(toIso(info.receivedAt))}</p>
        <p>파일은 Supabase Storage <code>${escapeHtml(bucket)}/${escapeHtml(info.intakeId)}/</code> 에 있습니다.</p>
        <p style="margin-top:16px">
          <a href="${escapeHtml(buildReviewLink(info.intakeId))}"><strong>이 건 대조 실행·검수하기 →</strong></a>
        </p>
        <p style="color:#64748B;font-size:13px">
          목록에서 이 접수가 강조돼 보입니다. 아직 대조 전이라 「처리 대기 · 미실행」에 있고,
          [대조 실행]을 누르면 그 자리에서 돌아갑니다. 검수 완료로 표시해야 고객이 결과를 봅니다.
        </p>
      `,
    });
    if (error) console.error('intake operator email error', error);
  } catch (err) {
    console.error('intake operator email exception', err);
  }

  try {
    const { error } = await resendApi().emails.send({
      from: `TROPS <${CONTACT_ADDRESS}>`,
      to: [info.email],
      subject: '[TROPS] 사전 확인 접수가 완료되었습니다',
      html: `
        <p>안녕하세요. 보내주신 서류가 정상적으로 접수되었습니다.</p>
        ${paid
          ? `<p><strong>${escapeHtml(formatWon(info.amount))}</strong> 결제가 승인되었습니다. 주문번호 ${escapeHtml(info.orderId || '-')}</p>`
          : ''}
        <p>${ownFormName
          ? '함께 보내주신 자사 서식을 기준으로 대조한 뒤, 당일 안에 요약 자료를 정돈해 아래 주소로 올려 드립니다.'
          : '자사 서식을 함께 받지 못했으므로 공개 라이선스로 배포되는 표준 서식을 기준으로 대조한 뒤, 당일 안에 요약 자료를 정돈해 아래 주소로 올려 드립니다.'}</p>
        <p><a href="${escapeHtml(info.magicLink)}">접수 내용 확인하기</a></p>
        ${waitingRoomHtml()}
        ${trade ? trade.html : ''}
        <p style="color:#64748B;font-size:13px">
          이 링크는 접수하신 분만 여실 수 있습니다. 다른 사람에게 전달하지 마십시오.<br>
          보내주신 파일은 접수일로부터 ${RETENTION_DAYS}일 후 삭제됩니다.
        </p>
        ${paid
          ? `<p style="color:#64748B;font-size:13px">환불규정은 <a href="${escapeHtml(origin())}/refund">${escapeHtml(origin().replace(/^https?:\/\//, ''))}/refund</a> 에서 보실 수 있습니다. 요약 자료를 받으시기 전에는 전액 환불해 드립니다.</p>`
          : ''}
        <p style="color:#64748B;font-size:13px">
          TROPS는 법률 자문 서비스가 아닙니다. 전달해 드리는 자료는 참고용입니다.
        </p>
      `,
    });
    if (error) {
      console.error('intake confirmation email error', error);
    } else {
      confirmationSent = true;
    }
  } catch (err) {
    console.error('intake confirmation email exception', err);
  }

  return { confirmationSent: confirmationSent };
}

/**
 * 자료 즉시 삭제 요청 알림 (환불규정 05).
 *
 * 파일은 이미 지워진 뒤에 부릅니다. 메일이 실패해도 삭제를 되돌리지 않습니다 —
 * 되돌릴 수 없는 것이 이 기능의 약속입니다(재발급 불가).
 *
 * 운영자 알림이 먼저입니다. Supabase 밖에 만들어 둔 요약 자료와, 환불을 함께
 * 신청한 건의 환불 처리는 사람이 손으로 마무리해야 합니다.
 */
async function sendErasureMails(info) {
  let confirmationSent = false;
  const paid = info.path === 'paid';

  try {
    const { error } = await resendApi().emails.send({
      from: `TROPS 자료 삭제 요청 <${CONTACT_ADDRESS}>`,
      to: [CONTACT_ADDRESS],
      replyTo: info.email,
      subject: `[TROPS] 자료 즉시 삭제 요청 - ${info.email}`,
      html: `
        <p><strong>이용자가 자료 즉시 삭제를 요청했습니다. 파일은 이미 삭제되었습니다.</strong></p>
        <p><strong>접수 번호:</strong> ${escapeHtml(info.intakeId)}</p>
        <p><strong>이메일:</strong> ${escapeHtml(info.email)}</p>
        <p><strong>접수 시각:</strong> ${escapeHtml(toIso(info.receivedAt))}</p>
        <p><strong>삭제한 파일:</strong> ${Number(info.filesDeleted || 0)}건
          (<code>${escapeHtml(info.storageBucket || 'intake')}/${escapeHtml(info.intakeId)}/</code>)</p>
        <p><strong>접수 상태:</strong> ${escapeHtml(info.statusBefore || '-')} → ${escapeHtml(info.statusAfter || '-')}</p>
        <p><strong>경로:</strong> ${paid
          ? '건별 결제 ' + escapeHtml(formatWon(info.amount)) +
            ' · 주문번호 ' + escapeHtml(info.orderId || '-') +
            ' · 결제상태 ' + escapeHtml(info.paymentStatus || '-')
          : '무상 실증'}</p>
        <hr>
        <p><strong>손으로 마무리할 것</strong></p>
        <ol>
          <li>Supabase 밖(로컬·메일·문서도구)에 만들어 둔 요약 자료가 있으면 함께 지웁니다.</li>
          ${paid
            ? '<li>환불을 함께 신청한 건이면 토스 대시보드에서 환불하고 payment_status 를 refunded 로 맞춥니다. ' +
              '삭제는 환불을 뜻하지 않습니다 — 별개로 확인하십시오.</li>'
            : ''}
          <li>접수 기록(행)은 정리 배치(<code>scripts/cleanup-expired.js</code>)가 다음 실행에서 지웁니다.</li>
        </ol>
      `,
    });
    if (error) console.error('erasure operator email error', error);
  } catch (err) {
    console.error('erasure operator email exception', err);
  }

  try {
    const { error } = await resendApi().emails.send({
      from: `TROPS <${CONTACT_ADDRESS}>`,
      to: [info.email],
      subject: '[TROPS] 요청하신 자료를 삭제했습니다',
      html: `
        <p>요청하신 대로 보내주신 파일을 삭제했습니다.</p>
        <p style="color:#64748B;font-size:13px">
          접수 번호 ${escapeHtml(info.intakeId)} · 삭제한 파일 ${Number(info.filesDeleted || 0)}건<br>
          접수 기록도 곧 함께 지워집니다. 이 링크는 더 이상 열리지 않습니다.
        </p>
        <p><strong>같은 건의 자료는 다시 만들어 드릴 수 없습니다.</strong>
          필요하시면 서류를 다시 보내주셔야 하며, 그때는 새로 접수됩니다.</p>
        ${paid
          ? `<p>삭제는 환불과 별개입니다. 환불을 원하시면 ${escapeHtml(CONTACT_ADDRESS)} 으로
             결제하신 이메일 주소와 접수 번호를 보내주십시오.
             환불규정은 <a href="${escapeHtml(origin())}/refund">${escapeHtml(origin().replace(/^https?:\/\//, ''))}/refund</a> 에 있습니다.</p>`
          : ''}
      `,
    });
    if (error) {
      console.error('erasure confirmation email error', error);
    } else {
      confirmationSent = true;
    }
  } catch (err) {
    console.error('erasure confirmation email exception', err);
  }

  return { confirmationSent: confirmationSent };
}

/**
 * 요약 자료 전달 메일 (환불규정 §02 기준선).
 *
 * ⚠️ 이 메일의 발송 성공 시각이 곧 delivered_at 입니다.
 *    규정 문언이 "링크를 보내드린 시점을 전달 시점으로 봅니다" 이기 때문입니다.
 *    그래서 여기만은 다른 알림과 달리 성공/실패를 정확히 돌려줘야 합니다 —
 *    부르는 쪽(api/_delivery.js)이 이 값을 보고 전달 기록을 남길지 정합니다.
 *    실패를 삼키면 보내지도 않은 건이 "전달 완료" 가 되고, 그 순간
 *    이용자는 환불받을 수 있는 구간에서 밀려납니다.
 *
 * 이용자 메일이 먼저입니다. 이용자에게 못 갔으면 전달이 아니므로,
 * 운영자 알림이 성공했는지는 판단에 넣지 않습니다.
 *
 * @returns {Promise<{sent: boolean, error: string|null}>}
 */
async function sendDeliveryMail(info) {
  const paid = info.path === 'paid';
  const summaryUrl = String(info.summaryUrl || '');

  let sent = false;
  let failure = null;

  try {
    const { error } = await resendApi().emails.send({
      from: `TROPS <${CONTACT_ADDRESS}>`,
      to: [info.email],
      subject: '[TROPS] 요청하신 요약 자료를 보내드립니다',
      html: `
        <p>보내주신 서류의 대조를 마쳤습니다. 아래 링크에서 요약 자료를 보실 수 있습니다.</p>
        <p><a href="${escapeHtml(summaryUrl)}">요약 자료 보기</a></p>
        <p>${info.ownFormName
          ? '함께 보내주신 자사 서식 <strong>' + escapeHtml(info.ownFormName) + '</strong> 을 기준으로 대조했습니다.'
          : '자사 서식을 받지 못했으므로 공개 라이선스로 배포되는 표준 서식을 기준으로 대조했습니다.'}</p>
        <p style="color:#64748B;font-size:13px">
          접수 번호 ${escapeHtml(info.intakeId)}<br>
          접수 내용은 <a href="${escapeHtml(info.magicLink)}">여기</a>에서 확인하실 수 있습니다.<br>
          보내주신 파일은 접수일로부터 ${RETENTION_DAYS}일 후 삭제됩니다.
        </p>
        ${paid
          ? `<p style="color:#64748B;font-size:13px">이 메일을 보내드린 시점이 환불규정의 전달 시점입니다.
             환불규정은 <a href="${escapeHtml(origin())}/refund">${escapeHtml(origin().replace(/^https?:\/\//, ''))}/refund</a> 에서 보실 수 있습니다.</p>`
          : ''}
        <p style="color:#64748B;font-size:13px">
          TROPS는 법률 자문 서비스가 아닙니다. 전달해 드리는 자료는 서류의 항목별 차이를 표시한
          참고 자료이며, 그 자체로 법적 효력을 갖지 않습니다. 최종 결정은 이용자와 이용자가
          선임한 전문가의 몫입니다.
        </p>
      `,
    });
    if (error) {
      failure = String(error.message || error);
      console.error('delivery email error', error);
    } else {
      sent = true;
    }
  } catch (err) {
    failure = err && err.message ? err.message : String(err);
    console.error('delivery email exception', err);
  }

  // 이용자에게 못 갔으면 운영자 알림도 보내지 않습니다 — 전달이 아니기 때문입니다.
  if (!sent) return { sent: false, error: failure };

  try {
    const { error } = await resendApi().emails.send({
      from: `TROPS 자료 전달 <${CONTACT_ADDRESS}>`,
      to: [CONTACT_ADDRESS],
      replyTo: info.email,
      subject: `[TROPS] 요약 자료 전달 완료 - ${info.email}`,
      html: `
        <p><strong>접수 번호:</strong> ${escapeHtml(info.intakeId)}</p>
        <p><strong>이메일:</strong> ${escapeHtml(info.email)}</p>
        <p><strong>보낸 링크:</strong> ${escapeHtml(summaryUrl)}</p>
        <p><strong>경로:</strong> ${paid
          ? '건별 결제 ' + escapeHtml(formatWon(info.amount)) + ' · 주문번호 ' + escapeHtml(info.orderId || '-')
          : '무료 접수'}</p>
        <p><strong>전달 시각:</strong> ${escapeHtml(toIso(info.deliveredAt))}</p>
        <p style="color:#64748B;font-size:13px">
          이 시각부터 환불규정 §02 의 "요약 자료 전달 후" 구간입니다.
          다만 §03(당일 미전달 등)에 해당하면 전달 후에도 전액 환불입니다.
        </p>
      `,
    });
    if (error) console.error('delivery operator email error', error);
  } catch (err) {
    console.error('delivery operator email exception', err);
  }

  return { sent: true, error: null };
}

/**
 * 「범위 밖」으로 뒤집혀 자동 환불한 건의 안내메일 〔M-2 · 2026-08-11〕.
 *
 * 🔴 **환불이 끝난 뒤에만** 부릅니다(api/_route-refund.js ⑦). 돈이 돌아가지
 *    않은 상태에서 이 메일이 나가면 지키지 못한 약속이 됩니다.
 *
 * ⚠️ 문면을 여기서 만들지 않습니다. 사유 문장(info.notice)은 api/_intake-route.js
 *    한 곳에서 옵니다 — 화면과 메일이 같은 문장을 말해야 하고, 두 곳에 적어 두면
 *    한쪽만 고쳐집니다. 「등급」·「부분」이라는 낱말은 쓰지 않습니다(C2).
 *
 * ⛔ 무엇이 문제인 파일인지·무슨 언어인지 말하지 않습니다. 말하는 것은
 *    「지금 확인할 수 있는 범위」와 「돈은 돌려드렸다」 둘입니다.
 *
 * @returns {Promise<{sent: boolean, error: string|null}>}
 */
async function sendRouteRefundMail(info) {
  const notice = String(info.notice || '').trim();
  const magicLink = info.magicLink ? String(info.magicLink) : '';
  /*
   * 이 함수 이름은 「route」지만 구현은 범용입니다 — 사후 자동환불 배치가 늘 때마다
   * (E5 · outcome_kind 축) 새 메일 함수를 복제하지 않으려고 판정 표·소스 파일을
   * 인자로 받습니다. 기본값은 이 함수의 원래 호출부(api/_route-refund.js)와
   * 같아 하위 호환됩니다.
   */
  const canonTable = info.canonTable || 'precheck_intake_route';
  const canonSourceFile = info.canonSourceFile || 'api/_route-refund.js';

  try {
    const { error } = await resendApi().emails.send({
      from: `TROPS <${CONTACT_ADDRESS}>`,
      to: [info.email],
      subject: '[TROPS] 결제하신 금액을 전액 환불했습니다',
      html: `
        <p>${escapeHtml(notice)}</p>
        <p><strong>결제하신 ${escapeHtml(formatWon(info.amount))} 을 전액 환불했습니다.</strong>
          카드사에 따라 실제 입금까지 며칠 걸릴 수 있습니다.</p>
        <p>서류를 다시 보내주시면 새로 접수됩니다. 접수 자체에는 비용이 들지 않습니다.</p>
        ${magicLink
          ? `<p style="color:#64748B;font-size:13px">
             접수 내용은 <a href="${escapeHtml(magicLink)}">여기</a>에서 확인하실 수 있습니다.<br>
             주문번호 ${escapeHtml(info.orderId || '-')}</p>`
          : `<p style="color:#64748B;font-size:13px">주문번호 ${escapeHtml(info.orderId || '-')}</p>`}
        <p style="color:#64748B;font-size:13px">
          환불규정은 <a href="${escapeHtml(origin())}/refund">${escapeHtml(origin().replace(/^https?:\/\//, ''))}/refund</a> 에서 보실 수 있습니다.
          문의는 ${escapeHtml(CONTACT_ADDRESS)} 으로 주십시오.
        </p>
      `,
    });
    if (error) {
      console.error('route refund email error', error);
      return { sent: false, error: String(error.message || error) };
    }
  } catch (err) {
    console.error('route refund email exception', err);
    return { sent: false, error: err && err.message ? err.message : String(err) };
  }

  // 운영자 알림. 실패해도 이용자 안내가 나갔으면 sent 는 true 입니다 —
  // 이 값을 보고 부르는 쪽이 「알렸는가」를 셉니다.
  try {
    const { error } = await resendApi().emails.send({
      from: `TROPS 자동 환불 <${CONTACT_ADDRESS}>`,
      to: [CONTACT_ADDRESS],
      replyTo: info.email,
      subject: `[TROPS] 자동 환불 - ${info.orderId || '-'}`,
      html: `
        <p><strong>처리 불가로 확인되어 자동 환불했습니다.</strong></p>
        <p><strong>주문번호:</strong> ${escapeHtml(info.orderId || '-')}</p>
        <p><strong>이메일:</strong> ${escapeHtml(info.email)}</p>
        <p><strong>금액:</strong> ${escapeHtml(formatWon(info.amount))}</p>
        <p><strong>이용자에게 나간 문장:</strong> ${escapeHtml(notice)}</p>
        <p style="color:#64748B;font-size:13px">
          판단의 정본은 판정층 trops_a 입니다(${escapeHtml(canonTable)}). 이 저장소는 그것을
          읽어 환불만 실행했습니다 — ${escapeHtml(canonSourceFile)}.
        </p>
      `,
    });
    if (error) console.error('route refund operator email error', error);
  } catch (err) {
    console.error('route refund operator email exception', err);
  }

  return { sent: true, error: null };
}

/**
 * 사람이 판단해 돌린 환불의 안내메일 〔M-3 후속 · 2026-08-12〕.
 *
 * 🔴 **환불이 끝난 뒤에만** 부릅니다(api/_refund.js refundOrder). 돈이 돌아가지
 *    않은 상태에서 이 메일이 나가면 지키지 못한 약속이 됩니다.
 *
 * ⚠️ api/_route-refund.js 가 부르는 sendRouteRefundMail 과 다른 함수입니다.
 *    그쪽은 문면이 정해진 「범위 밖」 통보이고, 이쪽은 사람이 적은 자유 사유를
 *    그대로 보여 줍니다 — 문면을 하나로 합치면 사람이 적은 사유가 사라지거나
 *    반대로 판정층 통보에 사람 손을 타야 하는 자리가 생깁니다.
 *
 * @returns {Promise<{sent: boolean, error: string|null}>}
 */
async function sendManualRefundMail(info) {
  const reason = String(info.reason || '').trim();

  try {
    const { error } = await resendApi().emails.send({
      from: `TROPS <${CONTACT_ADDRESS}>`,
      to: [info.email],
      subject: '[TROPS] 결제하신 금액을 전액 환불했습니다',
      html: `
        <p><strong>결제하신 ${escapeHtml(formatWon(info.amount))} 을 전액 환불했습니다.</strong>
          카드사에 따라 실제 입금까지 며칠 걸릴 수 있습니다.</p>
        <p><strong>환불 사유:</strong> ${escapeHtml(reason || '미기재')}</p>
        <p>서류를 다시 보내주시면 새로 접수됩니다. 접수 자체에는 비용이 들지 않습니다.</p>
        <p style="color:#64748B;font-size:13px">주문번호 ${escapeHtml(info.orderId || '-')}</p>
        <p style="color:#64748B;font-size:13px">
          환불규정은 <a href="${escapeHtml(origin())}/refund">${escapeHtml(origin().replace(/^https?:\/\//, ''))}/refund</a> 에서 보실 수 있습니다.
          문의는 ${escapeHtml(CONTACT_ADDRESS)} 으로 주십시오.
        </p>
      `,
    });
    if (error) {
      console.error('manual refund email error', error);
      return { sent: false, error: String(error.message || error) };
    }
  } catch (err) {
    console.error('manual refund email exception', err);
    return { sent: false, error: err && err.message ? err.message : String(err) };
  }

  // 운영자 알림. 실패해도 이용자 안내가 나갔으면 sent 는 true 입니다.
  try {
    const { error } = await resendApi().emails.send({
      from: `TROPS 환불 <${CONTACT_ADDRESS}>`,
      to: [CONTACT_ADDRESS],
      replyTo: info.email,
      subject: `[TROPS] 환불 처리 완료 - ${info.orderId || '-'}`,
      html: `
        <p><strong>사람이 판단하여 환불했습니다.</strong></p>
        <p><strong>주문번호:</strong> ${escapeHtml(info.orderId || '-')}</p>
        <p><strong>이메일:</strong> ${escapeHtml(info.email)}</p>
        <p><strong>금액:</strong> ${escapeHtml(formatWon(info.amount))}</p>
        <p><strong>사유:</strong> ${escapeHtml(reason || '미기재')}</p>
      `,
    });
    if (error) console.error('manual refund operator email error', error);
  } catch (err) {
    console.error('manual refund operator email exception', err);
  }

  return { sent: true, error: null };
}

/**
 * 결제 미완료 리마인드 메일 〔흐름 md §3 · §5-1 6번 · 신설 2026-08-13〕.
 *
 * 파일까지 올리고 결제만 하지 않은 건에 **1회** 보냅니다. md 근거: 「이미 파일
 * 업로드까지 한 고성의도 이탈자 회수」.
 *
 * 🔴 **돌려주는 값이 「1회」의 근거입니다.** 부르는 쪽(api/_payment-reminder.js)이
 *    이 값을 보고 payment_reminder_sent_at 을 채웁니다 — 실패를 삼키면 보내지도 않은
 *    건이 「보냈음」으로 굳어 영구히 회수 대상에서 빠집니다. sendDeliveryMail 과 같은
 *    이유로 성공/실패를 정확히 돌려줘야 하는 함수입니다.
 *
 * ⛔ **「재업로드 불필요」라고 쓰지 않습니다.** md §3 은 그 문구를 적었지만, 현재 접수
 *    폼은 파일을 다시 받는 구조이고 주문 재사용(결제 재개)은 구현돼 있지 않습니다.
 *    지키지 못할 약속을 메일에 쓰면, 눌러 들어온 사람이 빈 폼을 보고 두 번 이탈합니다.
 *    결제 재개가 붙는 날 이 문면과 아래 링크를 함께 고치십시오.
 * ⛔ 독촉하지 않습니다. 기한·마감·불이익을 말하지 않고, 「멈춰 있다」는 사실과
 *    「이어서 하실 수 있다」만 말합니다.
 * ⛔ 운영자 알림을 함께 보내지 않습니다 — 하루에 여러 건이 몰리면 그 자체가 소음이고,
 *    배치 응답(cron 로그)에 건수가 이미 남습니다.
 *
 * @returns {Promise<{sent: boolean, error: string|null}>}
 */
async function sendPaymentReminderMail(info) {
  try {
    const { error } = await resendApi().emails.send({
      from: `TROPS <${CONTACT_ADDRESS}>`,
      to: [info.email],
      subject: '[TROPS] 업로드하신 서류, 결제만 하면 진행됩니다',
      html: `
        <p>보내주신 서류는 잘 도착했지만, 결제가 끝나지 않아 아직 대조를 시작하지 못했습니다.</p>
        <p><strong>결제가 확인되면 그때부터 진행됩니다.</strong>
          영업일 기준 24시간 내에 요약 자료를 보내드리고,
          자료를 받으시기 전에는 언제든 전액 환불해 드립니다.</p>
        <p><a href="${escapeHtml(origin() + '/precheck')}">이어서 신청하기</a></p>
        <p style="color:#64748B;font-size:13px">
          결제 화면으로 돌아가시면 서류를 한 번 더 올려주셔야 합니다.
          이전에 보내주신 파일은 접수일로부터 ${RETENTION_DAYS}일 후 삭제됩니다.
        </p>
        <p style="color:#64748B;font-size:13px">
          이 안내는 한 번만 보내드립니다. 진행하지 않기로 하셨다면 그냥 두셔도 됩니다 —
          따로 하실 일은 없습니다.
        </p>
        <p style="color:#64748B;font-size:13px">
          환불규정은 <a href="${escapeHtml(origin())}/refund">${escapeHtml(origin().replace(/^https?:\/\//, ''))}/refund</a> 에서 보실 수 있습니다.
          문의는 ${escapeHtml(CONTACT_ADDRESS)} 으로 주십시오.
        </p>
      `,
    });
    if (error) {
      console.error('payment reminder email error', error);
      return { sent: false, error: String(error.message || error) };
    }
  } catch (err) {
    console.error('payment reminder email exception', err);
    return { sent: false, error: err && err.message ? err.message : String(err) };
  }

  return { sent: true, error: null };
}

/* ──────────────────────────────────────────────────────────────
 * 거래 정보 · 협정 세율 (선택 항목)
 * ────────────────────────────────────────────────────────────── */

/**
 * 접수 때 골라 넣으신 거래 상대국·HS 코드로 양허표 한 줄을 읽어 메일 문단을 만듭니다.
 *
 * 둘 중 하나라도 없으면 null 입니다 — 부르는 쪽은 문단 자체를 만들지 않습니다.
 * 빈 표를 띄우느니 항목이 없는 편이 낫습니다.
 *
 * ⚠️ 여기서 세율을 계산하지 않습니다. 양허표에 문자 그대로 적힌 값만 옮깁니다.
 *    연도별 단계 인하 계산은 /uae 한 곳에만 두고, 메일은 그리로 보냅니다 —
 *    두 곳에서 계산하면 언젠가 서로 다른 "현재 세율" 을 말하게 됩니다.
 */
async function describeTrade(countryCode, hsCode) {
  const agreement = agreementFor(countryCode);
  if (!agreement || !hsCode) return null;

  const url = lookupUrl(origin(), agreement.code, hsCode);
  if (!url) return null;

  const lookup = await fetchTariffRecord(origin(), agreement.code, hsCode);
  const record = lookup.record;

  const head = agreement.name + ' · ' + agreement.agreement + ' · HS ' + hsCode;

  // 표를 못 읽었습니다. "그런 코드는 없다" 고 말하지 않습니다 —
  // 멀쩡한 코드를 의심하게 만드는 것이 더 나쁩니다. 조회 화면으로 보냅니다.
  if (!lookup.ok) {
    return {
      operatorLine: head + ' — 양허표를 읽지 못함',
      html: `
        <hr>
        <p><strong>거래 상대국 협정 세율</strong></p>
        <p>${escapeHtml(head)}</p>
        <p>지금은 양허표를 불러오지 못했습니다.
          <a href="${escapeHtml(url)}">협정 세율 조회</a>에서 직접 확인해 주십시오.</p>
      `,
    };
  }

  // 표에 없는 코드입니다. 지어내지 않고 못 찾았다고 그대로 말합니다.
  if (!record) {
    return {
      operatorLine: head + ' — 양허표에 없는 코드',
      html: `
        <hr>
        <p><strong>거래 상대국 협정 세율</strong></p>
        <p>${escapeHtml(head)}</p>
        <p>이 코드는 ${escapeHtml(agreement.agreement)} 양허표에서 찾지 못했습니다.
          코드를 다시 확인하신 뒤 <a href="${escapeHtml(url)}">협정 세율 조회</a>에서
          같은 호(4단위)의 다른 품목을 보실 수 있습니다.</p>
      `,
    };
  }

  const itemName = String(record.name || '').replace(/^[-\s]+/, '').trim();

  return {
    operatorLine: head + ' · ' + record.trackLabel + ' (양허유형 ' + record.concession + ')',
    html: `
      <hr>
      <p><strong>거래 상대국 협정 세율</strong></p>
      <p>${escapeHtml(head)}<br>
        ${itemName ? escapeHtml(itemName) + '<br>' : ''}
        기준세율 ${escapeHtml(record.baseRateRaw)} ·
        ${escapeHtml(record.trackLabel)} ·
        무관세 도달 ${escapeHtml(record.zeroDate)}</p>
      <p><a href="${escapeHtml(url)}">연도별 세율과 원산지 결정기준(PSR) 보기</a></p>
      <p style="color:#64748B;font-size:13px">
        ${tariffDisclaimer(agreement.code).map(escapeHtml).join('<br>')}
      </p>
    `,
  };
}

function toIso(value) {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function formatWon(amount) {
  return '₩' + Number(amount || 0).toLocaleString('ko-KR');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

module.exports = {
  CONTACT_ADDRESS: CONTACT_ADDRESS,
  RETENTION_DAYS: RETENTION_DAYS,
  buildMagicLink: buildMagicLink,
  buildTimelinePreviewLink: buildTimelinePreviewLink,
  waitingRoomHtml: waitingRoomHtml,
  sendIntakeMails: sendIntakeMails,
  sendPaymentReminderMail: sendPaymentReminderMail,
  sendErasureMails: sendErasureMails,
  sendDeliveryMail: sendDeliveryMail,
  sendRouteRefundMail: sendRouteRefundMail,
  sendManualRefundMail: sendManualRefundMail,
  formatWon: formatWon,
  escapeHtml: escapeHtml,
};
