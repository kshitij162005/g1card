import nodemailer from 'nodemailer';

const ADMIN_SENDER_EMAIL = 'kotechakshitij@gmail.com';
const APP_NAME = 'G1CARD';
const DEFAULT_WEB_APP_URL = 'http://localhost:5173';

let cachedTransporter = null;
let cachedTransporterKey = null;

function firstEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim()) return String(value).trim();
  }
  return '';
}

function getSmtpConfig() {
  const host = firstEnv('SMTP_HOST', 'MAIL_HOST');
  const portRaw = firstEnv('SMTP_PORT', 'MAIL_PORT');
  // Backward compatibility: some deployments use EMAIL_SERVICE to store the sender email.
  const user = firstEnv('SMTP_USER', 'MAIL_USER', 'EMAIL_USER', 'EMAIL_SERVICE');
  const rawPass = firstEnv('SMTP_PASS', 'MAIL_PASS', 'EMAIL_PASS', 'EMAIL_PASSWORD', 'GMAIL_APP_PASSWORD');
  const pass = rawPass.replace(/\s+/g, '');
  const serviceFromEnv = firstEnv('SMTP_SERVICE', 'MAIL_SERVICE');
  const service = serviceFromEnv || (user.toLowerCase().endsWith('@gmail.com') ? 'gmail' : '');
  const from = firstEnv('SMTP_FROM', 'MAIL_FROM', 'EMAIL_FROM', user) || ADMIN_SENDER_EMAIL;
  const port = Number(portRaw || 587);
  return { host, port, user, pass, service, from };
}

function getTransporter() {
  const cfg = getSmtpConfig();
  const cacheKey = JSON.stringify({ host: cfg.host, port: cfg.port, user: cfg.user, service: cfg.service });

  if (cachedTransporter && cachedTransporterKey === cacheKey) return cachedTransporter;

  if ((!cfg.host && !cfg.service) || !cfg.user || !cfg.pass) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport(
    cfg.service
      ? {
          service: cfg.service,
          auth: { user: cfg.user, pass: cfg.pass },
        }
      : {
          host: cfg.host,
          port: cfg.port,
          secure: cfg.port === 465,
          auth: { user: cfg.user, pass: cfg.pass },
        }
  );
  cachedTransporterKey = cacheKey;

  return cachedTransporter;
}

function getWebAppBaseUrl() {
  const configured = firstEnv('APP_BASE_URL', 'CLIENT_APP_URL', 'FRONTEND_URL', 'CLIENT_URL', 'APP_URL');
  const base = configured || DEFAULT_WEB_APP_URL;
  return base.replace(/\/+$/, '');
}

function buildAppUrl(path = '') {
  if (!path) return getWebAppBaseUrl();
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getWebAppBaseUrl()}${normalized}`;
}

function buildEmailShell({ preheader = '', headline, intro, sections = [], footerNote = '', actionButton = null }) {
  const sectionHtml = sections
    .map((section) => {
      const lines = Array.isArray(section.lines) ? section.lines : [];
      const linesHtml = lines.map((line) => `<li style="margin:0 0 8px 0;">${line}</li>`).join('');
      return `
        <div style="margin:0 0 20px 0;">
          <h3 style="margin:0 0 8px 0;color:#1f2937;font-size:15px;">${section.title}</h3>
          <ul style="margin:0;padding:0 0 0 18px;color:#475569;font-size:14px;line-height:1.55;">${linesHtml}</ul>
        </div>
      `;
    })
    .join('');

  const actionButtonHtml = actionButton?.label && actionButton?.url
    ? `
      <div style="margin:0 0 22px 0;">
        <a href="${actionButton.url}" style="display:inline-block;background:#0f4aa0;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;line-height:1;padding:12px 18px;border-radius:10px;">${actionButton.label}</a>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${APP_NAME} Notification</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Segoe UI,Inter,Arial,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #d9e2ef;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0f4aa0,#1d6fe5);padding:24px 28px;">
                <div style="font-size:28px;letter-spacing:1px;font-weight:800;color:#ffffff;">G1CARD</div>
                <div style="margin-top:6px;color:#dbeafe;font-size:13px;">Unified Medical Records Platform</div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 10px 28px;">
                <h2 style="margin:0 0 12px 0;color:#111827;font-size:22px;line-height:1.3;">${headline}</h2>
                <p style="margin:0 0 20px 0;color:#475569;font-size:14px;line-height:1.6;">${intro}</p>
                ${actionButtonHtml}
                ${sectionHtml}
                ${footerNote ? `<p style="margin:0 0 18px 0;color:#64748b;font-size:12px;line-height:1.6;">${footerNote}</p>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;color:#334155;font-size:13px;line-height:1.6;">
                  Regards,<br />
                  <strong>G1CARD Trust & Security Team</strong><br />
                  on behalf of Super Admin (${ADMIN_SENDER_EMAIL})
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  const smtp = getSmtpConfig();
  const from = `${APP_NAME} Notifications <${smtp.from}>`;

  if (!to) return { ok: false, skipped: true, reason: 'Missing recipient' };

  if (!transporter) {
    console.warn(`[email] SMTP not configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS (or MAIL_* aliases). Skipping email to ${to}. Subject: ${subject}`);
    return { ok: false, skipped: true, reason: 'SMTP not configured (missing host/service, user, or password)' };
  }

  try {
    await transporter.sendMail({ from, to, subject, html, text });
    return { ok: true };
  } catch (err) {
    const reason = err?.message || 'SMTP send failed';
    console.error(`[email] Failed to deliver email to ${to}: ${reason}`);
    return { ok: false, skipped: true, reason };
  }
}

export async function sendOtpEmail({ to, otp, purposeLabel }) {
  const subject = `${APP_NAME} verification code for ${purposeLabel}`;
  const actionUrl = buildAppUrl('/#/login');
  const html = buildEmailShell({
    preheader: `Your ${APP_NAME} OTP is ${otp}`,
    headline: 'Verify your email address',
    intro: `Use the one-time password below to continue. For your security, this code expires in 10 minutes (10 min).`,
    actionButton: { label: 'Open G1CARD', url: actionUrl },
    sections: [
      {
        title: 'One-Time Password (OTP)',
        lines: [`<strong style="font-size:22px;letter-spacing:4px;color:#0f4aa0;">${otp}</strong>`],
      },
      {
        title: 'Security guidance',
        lines: [
          'Do not share this code with anyone, including support personnel.',
          'If you did not initiate this request, please reset your password immediately.',
        ],
      },
    ],
    footerNote: 'This is an automated security message from G1CARD.',
  });

  return sendEmail({
    to,
    subject,
    html,
    text: `Your ${APP_NAME} OTP is ${otp}. It expires in 10 minutes (10 min). Open G1CARD: ${actionUrl}`,
  });
}

export async function sendPatientPreferenceEmail({ to, title, message, details = [] }) {
  const actionUrl = buildAppUrl('/#/patient/notifications');
  const html = buildEmailShell({
    preheader: title,
    headline: title,
    intro: message,
    actionButton: { label: 'View In App', url: actionUrl },
    sections: details.length ? [{ title: 'Details', lines: details }] : [],
    footerNote: 'You are receiving this because the corresponding email preference is enabled in your G1CARD account settings.',
  });

  return sendEmail({
    to,
    subject: `${APP_NAME} update: ${title}`,
    html,
    text: `${title}\n\n${message}\n\n${details.join('\n')}\n\nView in app: ${actionUrl}`,
  });
}

export async function sendDeletionRequestEmailToAdmin({ patientName, patientEmail, requestType, reason }) {
  const target = process.env.SUPERADMIN_EMAIL || ADMIN_SENDER_EMAIL;
  const title = requestType === 'ACCOUNT_DELETION' ? 'Account Deletion Request Submitted' : 'Data Deletion Request Submitted';
  const requiresReview = requestType !== 'ACCOUNT_DELETION';
  const actionUrl = buildAppUrl('/#/admin/deletion-requests');

  const html = buildEmailShell({
    preheader: `${patientName} submitted a ${requestType}`,
    headline: title,
    intro: requiresReview
      ? 'A patient has submitted a deletion request that requires super admin review and approval.'
      : 'A patient initiated account deletion. The account and related data were permanently removed immediately.',
    actionButton: {
      label: requiresReview ? 'Review Request' : 'Open Admin Dashboard',
      url: actionUrl,
    },
    sections: [
      {
        title: 'Request snapshot',
        lines: [
          `<strong>Patient:</strong> ${patientName || 'Unknown'}`,
          `<strong>Email:</strong> ${patientEmail || 'Not provided'}`,
          `<strong>Request type:</strong> ${requestType}`,
          `<strong>Reason:</strong> ${reason || 'No reason provided'}`,
        ],
      },
      {
        title: 'Action needed',
        lines: [
          requiresReview
            ? 'Review this request in the admin panel and mark it as Approved or Rejected.'
            : 'No review required. You may open the admin panel to audit this event.',
        ],
      },
    ],
  });

  return sendEmail({
    to: target,
    subject: `${APP_NAME} Admin Action Required: ${title}`,
    html,
    text: `Admin update.\nPatient: ${patientName}\nEmail: ${patientEmail}\nType: ${requestType}\nReason: ${reason}\nOpen admin: ${actionUrl}`,
  });
}

export async function sendDeletionReviewEmailToPatient({ to, patientName, requestType, decision, reviewNotes }) {
  const action = decision === 'APPROVED' ? 'approved' : 'rejected';
  const title = `Your ${requestType === 'ACCOUNT_DELETION' ? 'account' : 'data'} deletion request was ${action}`;
  const actionUrl = buildAppUrl('/#/patient/settings');

  const html = buildEmailShell({
    preheader: title,
    headline: decision === 'APPROVED' ? 'Deletion Request Approved' : 'Deletion Request Rejected',
    intro: decision === 'APPROVED'
      ? 'Your deletion request has been approved by the admin team. Further processing will follow as per policy timelines.'
      : 'Your deletion request was reviewed and rejected by the admin team.',
    actionButton: { label: 'Open Account Settings', url: actionUrl },
    sections: [
      {
        title: 'Review details',
        lines: [
          `<strong>Patient:</strong> ${patientName || 'Patient'}`,
          `<strong>Request type:</strong> ${requestType}`,
          `<strong>Decision:</strong> ${decision}`,
          `<strong>Review notes:</strong> ${reviewNotes || 'No additional remarks provided.'}`,
        ],
      },
    ],
    footerNote: 'If you have questions, please contact support through your G1CARD account.',
  });

  return sendEmail({
    to,
    subject: `${APP_NAME}: ${title}`,
    html,
    text: `${title}\n\nPatient: ${patientName}\nRequest Type: ${requestType}\nDecision: ${decision}\nReview Notes: ${reviewNotes || 'N/A'}\nOpen account settings: ${actionUrl}`,
  });
}
