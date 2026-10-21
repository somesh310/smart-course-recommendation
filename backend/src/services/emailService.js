import { randomBytes } from 'node:crypto';

export function emailIsConfigured() {
  return Boolean(
    process.env.GMAIL_USER &&
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  );
}

async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google OAuth token request failed (${response.status}): ${payload.error_description || payload.error || 'No access token returned.'}`);
  }
  return payload.access_token;
}

const base64Lines = (value) => Buffer.from(value, 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n').trim();
const safeHeader = (value) => value.replace(/[\r\n]/g, '');

function makeRawMessage({ to, subject, text, html }) {
  const boundary = `pathwise_${randomBytes(12).toString('hex')}`;
  const sender = safeHeader(process.env.GMAIL_USER);
  const recipient = safeHeader(to);
  const safeSubject = safeHeader(subject);
  const mime = [
    `From: Pathwise <${sender}>`,
    `To: ${recipient}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(html),
    `--${boundary}--`,
    '',
  ].join('\r\n');

  return Buffer.from(mime, 'utf8').toString('base64url');
}

async function sendEmail({ to, subject, text, html }) {
  if (!emailIsConfigured()) {
    throw new Error('Gmail API is not configured. Set GMAIL_USER and the Google OAuth client and refresh-token variables.');
  }

  const accessToken = await getAccessToken();
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: makeRawMessage({ to, subject, text, html }) }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gmail API returned ${response.status}: ${details}`);
  }
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  await sendEmail({
    to,
    subject: 'Reset your Pathwise password',
    text: `We received a request to reset your Pathwise password. Open this link within 15 minutes to choose a new password: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#17233f"><p style="color:#6256d9;font-weight:bold;letter-spacing:.12em">PATHWISE</p><h1 style="font-size:24px">Reset your password</h1><p>We received a request to reset your Pathwise password. This link expires in 15 minutes and can only be used once.</p><p><a href="${resetUrl}" style="display:inline-block;background:#6256d9;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
  });
}

export async function sendRegistrationOtpEmail({ to, code }) {
  await sendEmail({
    to,
    subject: 'Your Pathwise verification code',
    text: `Your Pathwise verification code is ${code}. It expires in 10 minutes and can be tried up to 5 times. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#17233f"><p style="color:#6256d9;font-weight:bold;letter-spacing:.12em">PATHWISE</p><h1 style="font-size:24px">Verify your email</h1><p>Enter this one-time code to finish creating your Pathwise account:</p><p style="font-size:32px;font-weight:bold;letter-spacing:.28em;color:#483bb8">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
  });
}
