import nodemailer from 'nodemailer';

function getMailer() {
  const { GMAIL_USER: user, GMAIL_APP_PASSWORD: appPassword } = process.env;
  if (!user || !appPassword) {
    throw new Error('Gmail email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass: appPassword.replace(/\s/g, '') },
  });
}

const fromAddress = () => `Pathwise <${process.env.GMAIL_USER}>`;

export async function sendPasswordResetEmail({ to, resetUrl }) {
  await getMailer().sendMail({
    from: fromAddress(),
    to,
    subject: 'Reset your Pathwise password',
    text: `We received a request to reset your Pathwise password. Open this link within 15 minutes to choose a new password: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#17233f"><p style="color:#6256d9;font-weight:bold;letter-spacing:.12em">PATHWISE</p><h1 style="font-size:24px">Reset your password</h1><p>We received a request to reset your Pathwise password. This link expires in 15 minutes and can only be used once.</p><p><a href="${resetUrl}" style="display:inline-block;background:#6256d9;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
  });
}

export async function sendRegistrationOtpEmail({ to, code }) {
  await getMailer().sendMail({
    from: fromAddress(),
    to,
    subject: 'Your Pathwise verification code',
    text: `Your Pathwise verification code is ${code}. It expires in 10 minutes and can be tried up to 5 times. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#17233f"><p style="color:#6256d9;font-weight:bold;letter-spacing:.12em">PATHWISE</p><h1 style="font-size:24px">Verify your email</h1><p>Enter this one-time code to finish creating your Pathwise account:</p><p style="font-size:32px;font-weight:bold;letter-spacing:.28em;color:#483bb8">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
  });
}
