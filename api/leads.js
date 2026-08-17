/*
 * §10 출시 알림 사전등록 접수 (index.html · en.html 공용)
 *
 * body: { name, email, company(선택), inquiry(선택), consentPrivacy, consentMarketing }
 *
 * inquiry (2026-08-16 대표 수정안 · purpose 라디오를 대체) — 자유 텍스트, optional.
 *   종전에는 목적 라디오(tracking/inquiry)로 「무엇을 보낼지」를 고르게 했는데, 그
 *   라디오를 걷고 이메일 아래 [문의하기] 입력창 하나로 합쳤습니다. 값이 있으면 문의
 *   내용을 담당자 메일에 함께 싣고, 없으면 순수 관심 등록으로 처리합니다 — 화면에서
 *   목적을 구분하지 않아도 담당자 메일에서는 여전히 구분됩니다(아래 subject/body).
 *   ⚠️ en.html 은 이 필드를 보내지 않으므로 미전송이 정상 경로입니다 — required 로
 *      올리면 영문 페이지 접수가 전부 400 이 됩니다.
 *
 * 🔴 **2026-08-18 — 저장소가 생겼습니다.** trops_a admin 화면에서 문의·출시 알림
 *    이력을 조회하려고 `public.leads`(precheck-schema.sql §0-L)에 저장합니다.
 *    ⚠️ **메일이 여전히 우선입니다** — DB 쓰기는 메일 두 통을 보낸 **뒤에** 시도하고,
 *    실패해도 응답을 막지 않습니다(로그만 남긴다). 담당자 알림 메일은 계속 동의 기록의
 *    사본 역할을 한다 — DB 가 이겨서는 안 되는 것이 아니라, **DB 실패가 접수 자체를
 *    막아서는 안 된다**는 뜻이다(api/intake.js 의 OPTIONAL_COLUMNS 폴백과 같은 판단).
 *
 * ⚠️ consentPrivacy 는 === true 로만 받습니다. 문자열 'true' · 1 · 'on' 을
 *    통과시키지 마십시오 — 체크 안 한 폼이 통과하는 경로가 생깁니다.
 *    api/intake.js:113 이 같은 형태입니다.
 */

const { Resend } = require('resend');
const { readConfig, safeText } = require('./_supabase.js');

const resend = new Resend(process.env.RESEND_API_KEY);
const CONTACT_ADDRESS = 'contact@theo-ne.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `public.leads` 에 한 행 남긴다. **실패해도 던지지 않는다** — 호출부가 접수 응답을
 * 이것 때문에 막지 않게 하려는 것이다(위 파일 머리주석).
 */
async function saveLeadRow(row) {
  const config = readConfig();
  if (!config.ok) {
    console.error('leads store skipped: ' + config.error);
    return;
  }
  try {
    const response = await fetch(config.restUrl + '/leads', {
      method: 'POST',
      headers: Object.assign({}, config.headers, { Prefer: 'return=minimal' }),
      body: JSON.stringify(row),
    });
    if (!response.ok) {
      console.error('leads store failed: ' + response.status + ' ' + (await safeText(response)));
    }
  } catch (err) {
    console.error('leads store exception', err);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const { name, email, company, inquiry, consentPrivacy, consentMarketing } = req.body || {};

  if (
    typeof name !== 'string' || !name.trim() ||
    typeof email !== 'string' || !EMAIL_RE.test(email.trim())
  ) {
    res.status(400).json({ error: 'invalid input' });
    return;
  }

  // 필수 동의. 클라이언트에도 같은 검사가 있지만 그것은 사용자 안내용이고,
  // 동의 없는 접수를 실제로 막는 것은 여기입니다.
  if (consentPrivacy !== true) {
    res.status(400).json({ error: 'invalid input', field: 'consentPrivacy' });
    return;
  }

  const marketing = consentMarketing === true;
  const consentAt = new Date();

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedCompany = (company || '').trim();
  const trimmedInquiry = (inquiry || '').trim();
  const hasInquiry = trimmedInquiry.length > 0;

  try {
    const { error } = await resend.emails.send({
      from: `TROPS 관심등록 <${CONTACT_ADDRESS}>`,
      to: [CONTACT_ADDRESS],
      replyTo: trimmedEmail,
      // 문의 내용이 있는지로 제목을 가릅니다 — 메일함에서 열어보지 않고 갈라내야
      // 회신 우선순위가 잡힙니다(종전 목적 라디오가 하던 일을 값의 유무가 대신합니다).
      subject: hasInquiry ? `[TROPS] 문의 - ${trimmedName}` : `[TROPS] 관심 등록 - ${trimmedName}`,
      html: `
        <p><strong>이름:</strong> ${escapeHtml(trimmedName)}</p>
        <p><strong>이메일:</strong> ${escapeHtml(trimmedEmail)}</p>
        <p><strong>회사명:</strong> ${escapeHtml(trimmedCompany || '-')}</p>
        ${hasInquiry ? `<p><strong>문의 내용:</strong> ${escapeHtml(trimmedInquiry)}</p>` : ''}
        <hr>
        <p><strong>개인정보 수집·이용 동의(필수):</strong> 동의</p>
        <p><strong>서비스 소식 수신 동의(선택):</strong> ${marketing ? '동의' : '미동의'}</p>
        <p><strong>동의 시각:</strong> ${escapeHtml(consentAt.toISOString())}</p>
        <p style="color:#64748B;font-size:12px">※ 이 메일이 위 동의의 유일한 기록입니다(사전등록은 DB 에 저장하지 않습니다). 지우지 마십시오.</p>
      `,
    });

    if (error) {
      console.error('resend error', error);
      res.status(502).json({ error: 'email send failed' });
      return;
    }

    try {
      const { error: confirmError } = await resend.emails.send({
        from: `TROPS <${CONTACT_ADDRESS}>`,
        to: [trimmedEmail],
        subject: hasInquiry ? '[TROPS] 문의를 받았습니다' : '[TROPS] 관심 등록이 완료되었습니다',
        html: hasInquiry
          ? `
          <p>${escapeHtml(trimmedName)}님, 안녕하세요.</p>
          <p>보내주신 문의가 정상적으로 접수되었습니다. 확인 후 이 메일로 회신드리겠습니다.</p>
          <p>감사합니다.</p>
        `
          : `
          <p>${escapeHtml(trimmedName)}님, 안녕하세요.</p>
          <p>TROPS 관심 등록이 정상적으로 접수되었습니다. 준비되는 대로 안내해 드리겠습니다.</p>
          <p>감사합니다.</p>
        `,
      });
      if (confirmError) console.error('confirmation email error', confirmError);
    } catch (err) {
      console.error('confirmation email exception', err);
    }

    await saveLeadRow({
      name: trimmedName,
      email: trimmedEmail,
      company: trimmedCompany || null,
      inquiry: trimmedInquiry || null,
      consent_privacy: true,
      consent_marketing: marketing,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('leads handler error', err);
    res.status(500).json({ error: 'internal error' });
  }
};

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}
