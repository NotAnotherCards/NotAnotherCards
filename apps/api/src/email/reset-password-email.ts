import * as nodemailer from 'nodemailer';

interface SendPasswordResetEmailArgs {
  to: string;
  subject: string;
  text: string;
}

export const sendResetPasswordEmail = async ({
  to,
  subject,
  text,
}: SendPasswordResetEmailArgs) => {
  const from = process.env.SMTP_FROM || 'no-reply@notanothercards.com';
  const errors: Error[] = [];
  let attempted = false;

  // 1. Resend API
  if (process.env.RESEND_API_KEY) {
    attempted = true;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          text,
          html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
        }),
      });
      if (!res.ok) {
        throw new Error(`Resend API returned status ${res.status}`);
      }
      console.log(`📧 Email sent to ${to} via Resend.`);
      return;
    } catch (err: unknown) {
      console.error('Failed to send email via Resend, falling back...', err);
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // 2. SMTP Transport
  if (process.env.SMTP_HOST) {
    attempted = true;
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD || '',
            }
          : undefined,
      });

      await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
      });
      console.log(`📧 Email sent to ${to} via SMTP.`);
      return;
    } catch (err: unknown) {
      console.error('Failed to send email via SMTP, falling back...', err);
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }

  if (!attempted) {
    throw new Error(
      'No email transport configured (RESEND_API_KEY or SMTP_HOST is required).',
    );
  }

  throw new Error(
    `All email transports failed: ${errors.map((e) => e.message).join(', ')}`,
  );
};
