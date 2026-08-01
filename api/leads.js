const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const CONTACT_ADDRESS = 'contact@theo-ne.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const { name, email, company } = req.body || {};

  if (
    typeof name !== 'string' || !name.trim() ||
    typeof email !== 'string' || !EMAIL_RE.test(email.trim())
  ) {
    res.status(400).json({ error: 'invalid input' });
    return;
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedCompany = (company || '').trim();

  try {
    const { error } = await resend.emails.send({
      from: `TROPS 관심등록 <${CONTACT_ADDRESS}>`,
      to: [CONTACT_ADDRESS],
      replyTo: trimmedEmail,
      subject: `[TROPS] 관심 등록 - ${trimmedName}`,
      html: `
        <p><strong>이름:</strong> ${escapeHtml(trimmedName)}</p>
        <p><strong>이메일:</strong> ${escapeHtml(trimmedEmail)}</p>
        <p><strong>회사명:</strong> ${escapeHtml(trimmedCompany || '-')}</p>
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
        subject: '[TROPS] 관심 등록이 완료되었습니다',
        html: `
          <p>${escapeHtml(trimmedName)}님, 안녕하세요.</p>
          <p>TROPS 관심 등록이 정상적으로 접수되었습니다. 준비되는 대로 안내해 드리겠습니다.</p>
          <p>감사합니다.</p>
        `,
      });
      if (confirmError) console.error('confirmation email error', confirmError);
    } catch (err) {
      console.error('confirmation email exception', err);
    }

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
