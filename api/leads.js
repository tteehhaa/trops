const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_DOMAIN = process.env.RESEND_EMAIL_DOMAIN;
const NOTIFY_TO = 'contact@theo-ne.com';
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

  try {
    const { error } = await resend.emails.send({
      from: `TROPS 관심등록 <leads@${FROM_DOMAIN}>`,
      to: [NOTIFY_TO],
      replyTo: email.trim(),
      subject: `[TROPS] 관심 등록 - ${name.trim()}`,
      html: `
        <p><strong>이름:</strong> ${escapeHtml(name.trim())}</p>
        <p><strong>이메일:</strong> ${escapeHtml(email.trim())}</p>
        <p><strong>회사명:</strong> ${escapeHtml((company || '').trim() || '-')}</p>
      `,
    });

    if (error) {
      console.error('resend error', error);
      res.status(502).json({ error: 'email send failed' });
      return;
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
