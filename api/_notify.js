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

const resend = new Resend(process.env.RESEND_API_KEY);

const CONTACT_ADDRESS = 'contact@theo-ne.com';
const DEFAULT_ORIGIN = 'https://trops.kr';
const RETENTION_DAYS = 30;

function origin() {
  return (process.env.PRECHECK_ORIGIN || DEFAULT_ORIGIN).trim().replace(/\/+$/, '');
}

function buildMagicLink(token) {
  return origin() + '/precheck?r=' + encodeURIComponent(token);
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

  try {
    const { error } = await resend.emails.send({
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
        <p><strong>동의 2(비식별 데이터 활용):</strong> ${info.consentTraining ? '동의' : '미동의'}</p>
        <p><strong>접수 시각:</strong> ${escapeHtml(toIso(info.receivedAt))}</p>
        <p>파일은 Supabase Storage <code>${escapeHtml(bucket)}/${escapeHtml(info.intakeId)}/</code> 에 있습니다.</p>
      `,
    });
    if (error) console.error('intake operator email error', error);
  } catch (err) {
    console.error('intake operator email exception', err);
  }

  try {
    const { error } = await resend.emails.send({
      from: `TROPS <${CONTACT_ADDRESS}>`,
      to: [info.email],
      subject: '[TROPS] 사전 확인 접수가 완료되었습니다',
      html: `
        <p>안녕하세요. 보내주신 서류가 정상적으로 접수되었습니다.</p>
        ${paid
          ? `<p><strong>${escapeHtml(formatWon(info.amount))}</strong> 결제가 승인되었습니다. 주문번호 ${escapeHtml(info.orderId || '-')}</p>`
          : ''}
        <p>19개 항목을 측정해 대조한 뒤, 당일 안에 요약 자료를 정돈해 아래 주소로 올려 드립니다.</p>
        <p><a href="${escapeHtml(info.magicLink)}">접수 내용 확인하기</a></p>
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
    const { error } = await resend.emails.send({
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
    const { error } = await resend.emails.send({
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
  sendIntakeMails: sendIntakeMails,
  sendErasureMails: sendErasureMails,
  formatWon: formatWon,
  escapeHtml: escapeHtml,
};
