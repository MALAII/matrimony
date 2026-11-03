const nodemailer = require('nodemailer');

// In-memory capture for automated testing (isolated to test environment)
let sentInvitationsForTest = [];
const getSentInvitationsForTest = () => sentInvitationsForTest;
const clearSentInvitationsForTest = () => {
  sentInvitationsForTest = [];
};

let sentPasswordResetsForTest = [];
const getSentPasswordResetsForTest = () => sentPasswordResetsForTest;
const clearSentPasswordResetsForTest = () => {
  sentPasswordResetsForTest = [];
};

let sentSubscriptionRemindersForTest = [];
const getSentSubscriptionRemindersForTest = () => sentSubscriptionRemindersForTest;
const clearSentSubscriptionRemindersForTest = () => {
  sentSubscriptionRemindersForTest = [];
};

let sentAdminDigestsForTest = [];
const getSentAdminDigestsForTest = () => sentAdminDigestsForTest;
const clearSentAdminDigestsForTest = () => {
  sentAdminDigestsForTest = [];
};

/**
 * Escapes unsafe characters for safe interpolation into HTML email templates
 * @param {string} unsafe
 * @returns {string}
 */
const escapeHtml = (unsafe) => {
  if (!unsafe || typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Renders an HTML email layout matching the South Indian Matrimonial website aesthetic:
 * Deep royal plum (#2b1a21), antique temple gold (#b08d4c / #e0bd77), ceremonial wine (#7d3147),
 * warm ivory canvas (#f7f1eb), elegant serif headings, circular crest medallion, pill CTA button,
 * and Golden Privacy Shield guarantees.
 */
const renderBrandedMatrimonyEmail = ({
  topicBadge,
  greetingName,
  introParagraphs = [],
  customBodyHtml = '',
  highlightBox = null,
  ctaButton = null,
  noticeBox = null,
  secondaryNote = null,
}) => {
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(topicBadge || 'Matrimony Platform')}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f1eb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f7f1eb; margin: 0; padding: 28px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container (Max 600px) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #eadbd0; box-shadow: 0 4px 24px rgba(43, 26, 33, 0.08);">
          
          <!-- Top Utility Banner -->
          <tr>
            <td style="background-color: #2a0810; padding: 10px 20px; text-align: center; border-bottom: 1px solid #45101e;">
              <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; color: #f0c354; letter-spacing: 1.2px; text-transform: uppercase;">
                ஸ்ரீ வாராஹி திருமண தகவல் மையம் &bull; VARAGHI MATRIMONY
              </span>
            </td>
          </tr>

          <!-- Brand Header with Circular Medallion -->
          <tr>
            <td style="background-color: #2a0810; padding: 28px 24px 22px 24px; text-align: center;">
              <!-- Medallion -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td align="center" valign="middle" style="width: 50px; height: 50px; background-color: #a81b32; border: 2px solid #f0c354; border-radius: 50%; text-align: center; font-size: 20px; line-height: 46px; color: #fffdf8;">
                    &#10084;
                  </td>
                </tr>
              </table>
              <!-- Brand Title in Serif -->
              <h1 style="margin: 12px 0 3px 0; font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px; line-height: 1.2;">
                Varaghi Matrimony
              </h1>
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #f0c354; font-weight: 700;">
                ஸ்ரீ வாராஹி திருமண தகவல் மையம்
              </div>
            </td>
          </tr>

          <!-- Antique Gold Divider Ribbon -->
          <tr>
            <td style="height: 3px; background-color: #c69214; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 34px 28px 26px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #3f2b32;">
              ${topicBadge ? `
              <div style="margin-bottom: 22px;">
                <span style="display: inline-block; background-color: #fef7ee; color: #8c6a28; border: 1px solid #e0bd77; padding: 4px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;">
                  ${escapeHtml(topicBadge)}
                </span>
              </div>` : ''}

              ${greetingName ? `
              <h2 style="margin: 0 0 16px 0; font-family: 'Playfair Display', Georgia, serif; font-size: 20px; font-weight: 700; color: #2b1a21;">
                Hello <strong>${greetingName}</strong>,
              </h2>` : ''}

              ${introParagraphs.map(p => `<p style="font-size: 15px; line-height: 1.65; color: #3f2b32; margin: 0 0 16px 0;">${p}</p>`).join('')}

              ${customBodyHtml || ''}

              ${highlightBox ? `
              <div style="background-color: ${highlightBox.type === 'warning' ? '#fff7ed' : '#fef7ee'}; border-left: 4px solid ${highlightBox.type === 'warning' ? '#ea580c' : '#b08d4c'}; border-radius: 6px; padding: 14px 16px; margin: 22px 0; font-size: 14px; color: ${highlightBox.type === 'warning' ? '#7c2d12' : '#5c4638'}; line-height: 1.55;">
                <strong style="color: ${highlightBox.type === 'warning' ? '#9a3412' : '#2b1a21'};">${highlightBox.title}</strong><br />
                ${highlightBox.content}
              </div>` : ''}

              ${ctaButton ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 30px auto;">
                <tr>
                  <td align="center" style="border-radius: 9999px; background-color: #a81b32; border: 1px solid #f0c354; box-shadow: 0 4px 14px rgba(168, 27, 50, 0.25);">
                    <a href="${ctaButton.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; letter-spacing: 0.4px;">
                      ${escapeHtml(ctaButton.label)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>` : ''}

              ${noticeBox ? `
              <div style="background-color: #fff9f2; border: 1px solid #eedecb; border-left: 4px solid #b08d4c; border-radius: 8px; padding: 16px 18px; margin: 26px 0; font-size: 13px; color: #5c4638; line-height: 1.55;">
                <p style="margin: 0 0 8px 0; font-weight: 700; color: #2b1a21; font-size: 13px;">
                  <span style="color: #b08d4c; margin-right: 4px;">&#128737;&#65039;</span> ${escapeHtml(noticeBox.title || 'Security Notice:')}
                </p>
                ${(noticeBox.items || []).map(item => `<p style="margin: 0 0 6px 0;">&bull; ${item}</p>`).join('')}
                ${noticeBox.rawUrl ? `
                <p style="margin: 10px 0 6px 0; font-size: 12px; color: #75606a;">If the button above does not open, copy and paste this URL into your browser:</p>
                <div style="word-break: break-all; color: #2b1a21; font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 11px; background: #ffffff; padding: 10px 12px; border-radius: 6px; border: 1px solid #e4d3c1; line-height: 1.4;">
                  ${noticeBox.rawUrl}
                </div>` : ''}
              </div>` : ''}

              ${secondaryNote ? `
              <hr style="border: none; border-top: 1px solid #eadbd0; margin: 26px 0 16px 0;" />
              <p style="font-size: 12px; color: #75606a; line-height: 1.55; margin: 0;">
                ${secondaryNote}
              </p>` : ''}
            </td>
          </tr>

          <!-- Deep Royal Maroon Footer (matching website footer) -->
          <tr>
            <td style="background-color: #2a0810; padding: 24px 20px; text-align: center; border-top: 1px solid #45101e;">
              <p style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #f0c354; letter-spacing: 1.4px; text-transform: uppercase;">
                மங்கல வாழ்க்கை மலர ஸ்ரீ வாராஹி அம்மன் துணை
              </p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #d6b8c1; line-height: 1.5;">
                வரன் விவரங்கள் மற்றும் ஜாதகத் தகவல்கள் பாதுகாப்பாகப் பராமரிக்கப்படுகின்றன.
              </p>
              <p style="margin: 0; font-size: 11px; color: #a17885; line-height: 1.5;">
                &copy; ${year} Varaghi Matrimony &middot; ஸ்ரீ வாராஹி திருமண தகவல் மையம் &middot; All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Resolves the outbound sender address from environment variables
 * @returns {string}
 */
const getFromAddress = () => {
  if (process.env.EMAIL_FROM) {
    return process.env.EMAIL_FROM;
  }
  const email = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (email) {
    return `"Varaghi Matrimony" <${email}>`;
  }
  return 'no-reply@varagimatrimony.com';
};

/**
 * Resolves the optional Reply-To address from environment variables
 * @returns {string|undefined}
 */
const getReplyToAddress = () => {
  return process.env.EMAIL_REPLY_TO || process.env.SMTP_REPLY_TO || undefined;
};

/**
 * Validates whether essential SMTP environment variables are configured
 * @returns {boolean}
 */
const isSmtpConfigured = () => {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
};

/**
 * Creates a Nodemailer transporter instance based on environment variables
 * @returns {nodemailer.Transporter}
 */
let cachedTransporter = null;
let cachedTransporterKey = '';

const createTransporter = () => {
  const host = process.env.SMTP_HOST || '';
  const isGmail = Boolean(host.toLowerCase().includes('gmail') || (process.env.SMTP_USER && process.env.SMTP_USER.includes('@gmail.com')));
  const port = parseInt(process.env.SMTP_PORT, 10) || (isGmail ? 465 : 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465 || isGmail;
  const user = process.env.SMTP_USER;
  // Strip whitespace if user copied Google App Password as "xxxx xxxx xxxx xxxx"
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  const key = [host, port, secure, user, pass, isGmail].join('|');
  if (cachedTransporter && cachedTransporterKey === key) {
    return cachedTransporter;
  }

  const transportConfig = isGmail
    ? {
        service: 'gmail',
        auth: { user, pass },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      }
    : {
        host,
        port,
        secure,
        pool: true,
        maxConnections: 3,
        maxMessages: 100,
        auth: { user, pass },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      };

  cachedTransporter = nodemailer.createTransport(transportConfig);
  cachedTransporterKey = key;
  return cachedTransporter;
};

const CONSUMER_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.in',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'rediffmail.com',
  'icloud.com',
]);

/**
 * Extracts the bare email address from `"Name" <user@domain>` or `user@domain`
 * @param {string} from
 * @returns {string}
 */
const extractEmailAddress = (from) => {
  if (!from || typeof from !== 'string') return '';
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim().toLowerCase();
};

/**
 * Inspects outbound mail configuration for the most common causes of mail landing in spam.
 * Pure function of the environment: it does not touch the network.
 * @returns {string[]} human-readable warnings (empty when nothing looks wrong)
 */
const getDeliverabilityWarnings = () => {
  const warnings = [];
  const fromEmail = extractEmailAddress(getFromAddress());
  const fromDomain = fromEmail.split('@')[1] || '';
  const smtpUser = (process.env.SMTP_USER || '').toLowerCase();
  const clientUrl = process.env.CLIENT_URL || '';
  const isProd = process.env.NODE_ENV === 'production';

  if (!process.env.EMAIL_FROM) {
    warnings.push('EMAIL_FROM is not set; the sender falls back to SMTP_USER. Set it to an address on your own domain.');
  }
  if (!fromDomain || fromDomain.endsWith('.example.com') || fromDomain === 'example.com') {
    warnings.push(`Sender domain "${fromDomain || 'unknown'}" is a placeholder.`);
  } else if (CONSUMER_MAIL_DOMAINS.has(fromDomain)) {
    warnings.push(
      `Mail is sent from a personal @${fromDomain} mailbox. Automated account mail from a personal address has low sender reputation and a daily sending cap, and you cannot set up your own SPF/DKIM/DMARC identity for it, so recipients' filters often send it to spam. Use an address on a domain you own, sent through a transactional provider (e.g. Brevo, Resend, SendGrid, Amazon SES, Zoho ZeptoMail).`
    );
  }
  if (/localhost|127\.0\.0\.1/.test(clientUrl)) {
    warnings.push(`CLIENT_URL is "${clientUrl}". Links to localhost in emails look suspicious to spam filters and do not work for recipients.${isProd ? ' This is production.' : ''}`);
  } else if (isProd && clientUrl && !/^https:\/\//i.test(clientUrl)) {
    warnings.push('CLIENT_URL is not https. Use an https link in production emails.');
  }
  if (!getReplyToAddress()) {
    warnings.push('EMAIL_REPLY_TO is not set. A monitored reply address improves trust and lets recipients respond.');
  }
  return warnings;
};

let deliverabilityWarned = false;

/**
 * Sends a prepared message, adding headers that identify it as automated transactional mail
 * and logging configuration problems that commonly cause spam placement (once per process).
 */
const dispatchMail = async (transporter, mailOptions) => {
  if (!deliverabilityWarned && process.env.NODE_ENV !== 'test') {
    deliverabilityWarned = true;
    getDeliverabilityWarnings().forEach((w) => console.warn(`[Email Deliverability] ${w}`));
  }
  return transporter.sendMail({
    ...mailOptions,
    headers: {
      'Auto-Submitted': 'auto-generated',
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      ...(mailOptions.headers || {}),
    },
  });
};

/**
 * Sends a generic email using the configured SMTP transporter
 * 
 * @param {object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.subject - Email subject
 * @param {string} [params.text] - Plain text body
 * @param {string} [params.html] - HTML body
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendEmail = async ({ to, subject, text, html, attachments }) => {
  if (!to || !subject) {
    return {
      success: false,
      error: 'Recipient email and subject are required to send email.',
    };
  }

  if (process.env.NODE_ENV === 'test' || process.env.TEST_CAPTURE_EMAILS === 'true') {
    if (process.env.TEST_CAPTURE_EMAILS === 'true' || !isSmtpConfigured()) {
      return {
        success: true,
        messageId: `test-captured-${Date.now()}`,
        isTestMock: true,
      };
    }
  }

  if (!isSmtpConfigured()) {
    console.warn('[Email Service] SMTP configuration is incomplete or missing in environment variables.');
    return {
      success: false,
      error: 'SMTP email service is not configured on this server. Please configure SMTP in environment variables.',
    };
  }

  const transporter = createTransporter();
  const fromAddress = getFromAddress();
  const replyTo = getReplyToAddress();

  const mailOptions = {
    from: fromAddress,
    to,
    subject,
    text,
    html,
    ...(attachments && Array.isArray(attachments) && attachments.length > 0 ? { attachments } : {}),
  };

  if (replyTo) {
    mailOptions.replyTo = replyTo;
  }

  try {
    const info = await dispatchMail(transporter, mailOptions);
    console.log(`[Email Service] Email successfully dispatched to ${to} (MessageId: ${info.messageId})`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error(`[Email Service Error] Failed to send email to ${to}: ${err.message}`);
    return {
      success: false,
      error: `Failed to deliver email: ${err.message}`,
    };
  }
};

/**
 * Sends an account activation / password-setup invitation email
 * 
 * @param {object} params
 * @param {string} params.to - Recipient candidate email address
 * @param {string} params.name - Candidate name
 * @param {string} params.rawToken - Raw single-use invitation token (never logged)
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendInvitationEmail = async ({ to, name, rawToken }) => {
  if (!to || !rawToken) {
    return {
      success: false,
      error: 'Recipient email and invitation token are required to send invitation.',
    };
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const setupUrl = `${clientUrl.replace(/\/$/, '')}/setup-password?token=${encodeURIComponent(rawToken)}`;
  const fromAddress = getFromAddress();
  const replyTo = getReplyToAddress();
  const safeName = escapeHtml(name || 'Candidate');

  // Capture for automated tests in test environment
  if (process.env.NODE_ENV === 'test' || process.env.TEST_CAPTURE_EMAILS === 'true') {
    sentInvitationsForTest.push({
      to,
      name,
      rawToken,
      setupUrl,
      dispatchedAt: new Date(),
    });
    if (process.env.TEST_CAPTURE_EMAILS === 'true' || !isSmtpConfigured()) {
      return {
        success: true,
        messageId: `test-captured-${Date.now()}`,
        isTestMock: true,
      };
    }
  }

  // Check if SMTP transport is configured
  if (!isSmtpConfigured()) {
    console.warn('[Email Service] SMTP configuration is incomplete or missing in environment variables.');
    return {
      success: false,
      error: 'SMTP email service is not configured on this server. Please configure SMTP in environment variables.',
    };
  }

  const transporter = createTransporter();

  const mailOptions = {
    from: fromAddress,
    to,
    subject: 'Activate your Matrimonial Profile — Matrimony Platform',
    text: `Hello ${name || 'Candidate'},\n\n` +
      `Welcome to Matrimony Platform. Your matrimonial profile has been created and verified by our administration team.\n\n` +
      `To access your candidate dashboard and view verified matches, please complete your account activation by setting up your password using the following link:\n\n` +
      `${setupUrl}\n\n` +
      `Next step: Click the link above to choose your password and sign in to your account.\n\n` +
      `Important notice: For your privacy and security, this invitation link is unique to you, can only be used once, and will expire in 24 hours.\n\n` +
      `Why did you receive this email? You are receiving this invitation because a candidate profile was created for you on Matrimony Platform. If you did not request this profile or believe this was sent in error, you may safely disregard this email—no account will be activated without password setup.\n\n` +
      `Warm regards,\n` +
      `Matrimony Platform Team`,
    html: renderBrandedMatrimonyEmail({
      topicBadge: 'Official Candidate Invitation',
      greetingName: safeName,
      introParagraphs: [
        `Welcome to <strong>Matrimony Platform</strong>. Your matrimonial profile has been created and verified by our administration team.`,
        `To access your candidate dashboard and begin exploring verified matches, please activate your account and choose your password:`,
      ],
      ctaButton: {
        label: 'Activate Account & Set Password',
        url: setupUrl,
      },
      noticeBox: {
        title: 'Important Link Information:',
        items: [
          `This secure invitation link is single-use and will expire in <strong>24 hours</strong>.`,
          `No account will be activated until your password is created.`,
        ],
        rawUrl: setupUrl,
      },
      secondaryNote: `<strong>Why did you receive this email?</strong> You received this invitation because a candidate profile was registered for you on Matrimony Platform. If this email was received in error or you did not request a profile, please ignore it—no account will be activated without password setup.`,
    }),
  };

  if (replyTo) {
    mailOptions.replyTo = replyTo;
  }

  try {
    const info = await dispatchMail(transporter, mailOptions);
    console.log(`[Email Service] Invitation email successfully dispatched to ${to} (MessageId: ${info.messageId})`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error(`[Email Service Error] Failed to send email to ${to}: ${err.message}`);
    return {
      success: false,
      error: 'Failed to deliver invitation email through the email service.',
    };
  }
};

/**
 * Sends a password reset email with a single-use expiring token link
 * 
 * @param {object} params
 * @param {string} params.to - Recipient user email address
 * @param {string} params.name - User name
 * @param {string} params.rawToken - Raw single-use reset token (never logged)
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendPasswordResetEmail = async ({ to, name, rawToken }) => {
  if (!to || !rawToken) {
    return {
      success: false,
      error: 'Recipient email and reset token are required.',
    };
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetUrl = `${clientUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const fromAddress = getFromAddress();
  const replyTo = getReplyToAddress();
  const safeName = escapeHtml(name || 'Member');

  // Capture for automated tests in test environment
  if (process.env.NODE_ENV === 'test' || process.env.TEST_CAPTURE_EMAILS === 'true') {
    sentPasswordResetsForTest.push({
      to,
      name,
      rawToken,
      resetUrl,
      dispatchedAt: new Date(),
    });
    if (process.env.TEST_CAPTURE_EMAILS === 'true' || !isSmtpConfigured()) {
      return {
        success: true,
        messageId: `test-reset-${Date.now()}`,
        isTestMock: true,
      };
    }
  }

  // Check if SMTP transport is configured
  if (!isSmtpConfigured()) {
    console.warn('[Email Service] SMTP configuration is incomplete or missing in environment variables.');
    return {
      success: false,
      error: 'SMTP email service is not configured on this server.',
    };
  }

  const transporter = createTransporter();

  const mailOptions = {
    from: fromAddress,
    to,
    subject: 'Password Reset Request — Matrimony Platform',
    text: `Hello ${name || 'Member'},\n\n` +
      `We received a request to reset your password for your Matrimony Platform account.\n\n` +
      `To choose a new password, please visit the following link:\n\n` +
      `${resetUrl}\n\n` +
      `Important notice: For your security, this password reset link can only be used once and will expire in 1 hour.\n\n` +
      `If you did not request a password reset, you can safely ignore this email; your existing password will remain unchanged.\n\n` +
      `Warm regards,\n` +
      `Matrimony Platform Team`,
    html: renderBrandedMatrimonyEmail({
      topicBadge: 'Password Reset Request',
      greetingName: safeName,
      introParagraphs: [
        `We received a request to reset the password for your <strong>Matrimony Platform</strong> account.`,
        `Click the button below to choose a new password for your account:`,
      ],
      ctaButton: {
        label: 'Reset My Password',
        url: resetUrl,
      },
      noticeBox: {
        title: 'Security Notice:',
        items: [
          `This secure link is single-use and will expire in <strong>1 hour</strong>.`,
          `For your privacy and security, never forward this email to anyone.`,
        ],
        rawUrl: resetUrl,
      },
      secondaryNote: `<strong>Didn't request this?</strong> If you did not request a password reset, you can safely ignore this email. Your password and account security remain completely unchanged.`,
    }),
  };

  if (replyTo) {
    mailOptions.replyTo = replyTo;
  }

  try {
    const info = await dispatchMail(transporter, mailOptions);
    console.log(`[Email Service] Password reset email successfully dispatched to ${to} (MessageId: ${info.messageId})`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error(`[Email Service Error] Failed to send password reset email to ${to}: ${err.message}`);
    return {
      success: false,
      error: 'Failed to deliver password reset email through the email service.',
    };
  }
};

/**
 * Format plan code to human readable label
 * @param {string} planCode
 * @returns {string}
 */
const formatPlanCode = (planCode) => {
  if (planCode === 'THREE_MONTHS') return '3-Month Plan';
  if (planCode === 'SIX_MONTHS') return '6-Month Plan';
  return planCode || 'Membership Plan';
};

/**
 * Sends a 7-day subscription expiry reminder email to an active member
 * 
 * @param {object} params
 * @param {string} params.to - Recipient user email
 * @param {string} params.name - Recipient user name
 * @param {string} params.planCode - Subscription plan code
 * @param {Date|string} params.endDate - Subscription expiration date
 * @param {number} [params.daysRemaining=7] - Number of days remaining
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendSubscriptionExpiryReminderEmail = async ({ to, name, planCode, endDate, daysRemaining = 7 }) => {
  if (!to) {
    return {
      success: false,
      error: 'Recipient email is required for expiry reminder.',
    };
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const renewUrl = `${clientUrl.replace(/\/$/, '')}/membership`;
  const fromAddress = getFromAddress();
  const replyTo = getReplyToAddress();
  const safeName = escapeHtml(name || 'Valued Member');
  const planLabel = formatPlanCode(planCode);
  const formattedEndDate = endDate
    ? new Date(endDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'in 7 days';

  // Capture for automated tests in test environment
  if (process.env.NODE_ENV === 'test' || process.env.TEST_CAPTURE_EMAILS === 'true') {
    sentSubscriptionRemindersForTest.push({
      to,
      name,
      planCode,
      endDate,
      daysRemaining,
      renewUrl,
      dispatchedAt: new Date(),
    });
    if (process.env.TEST_CAPTURE_EMAILS === 'true' || !isSmtpConfigured()) {
      return {
        success: true,
        messageId: `test-sub-reminder-${Date.now()}`,
        isTestMock: true,
      };
    }
  }

  if (!isSmtpConfigured()) {
    console.warn('[Email Service] SMTP configuration is incomplete or missing in environment variables.');
    return {
      success: false,
      error: 'SMTP email service is not configured on this server.',
    };
  }

  const transporter = createTransporter();

  const mailOptions = {
    from: fromAddress,
    to,
    subject: `Your Matrimony Subscription is Expiring in ${daysRemaining} Days — Matrimony Platform`,
    text: `Hello ${name || 'Valued Member'},\n\n` +
      `Your ${planLabel} on Matrimony Platform will expire on ${formattedEndDate} (in approximately ${daysRemaining} days).\n\n` +
      `To ensure continuous access to verified candidate contact details and maintain uninterrupted matchmaking, please renew your subscription:\n\n` +
      `${renewUrl}\n\n` +
      `Grace Period Notice:\n` +
      `After your subscription expires, a 7-day grace period allows you to continue browsing profiles, but contact detail viewing will be locked until renewed.\n\n` +
      `Warm regards,\n` +
      `Matrimony Platform Team`,
    html: renderBrandedMatrimonyEmail({
      topicBadge: 'Subscription Expiry Reminder',
      greetingName: safeName,
      introParagraphs: [
        `This is a friendly reminder that your active <strong>${escapeHtml(planLabel)}</strong> is scheduled to expire on <strong>${escapeHtml(formattedEndDate)}</strong> (in ${daysRemaining} days).`,
      ],
      highlightBox: {
        type: 'gold',
        title: 'Why renew early?',
        content: 'Renewing early ensures uninterrupted profile visibility and seamless access to candidate contact unlocks without any matchmaking downtime.',
      },
      ctaButton: {
        label: 'Renew Subscription Now',
        url: renewUrl,
      },
      noticeBox: {
        title: '7-Day Grace Period Information:',
        items: [
          `After your expiration date (${escapeHtml(formattedEndDate)}), you will receive an automatic 7-day grace period during which you can still browse member profiles.`,
          `However, verified candidate contact details will remain locked until your subscription is renewed.`,
        ],
      },
      secondaryNote: `You received this automated reminder because you hold an active membership subscription on Matrimony Platform.`,
    }),
  };

  if (replyTo) {
    mailOptions.replyTo = replyTo;
  }

  try {
    const info = await dispatchMail(transporter, mailOptions);
    console.log(`[Email Service] Expiry reminder email successfully dispatched to ${to} (MessageId: ${info.messageId})`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error(`[Email Service Error] Failed to send expiry reminder to ${to}: ${err.message}`);
    return {
      success: false,
      error: `Failed to deliver subscription expiry reminder: ${err.message}`,
    };
  }
};

/**
 * Sends a consolidated daily digest email to an administrator listing all subscriptions approaching expiry
 * 
 * @param {object} params
 * @param {string} params.to - Recipient admin email
 * @param {string} params.adminName - Administrator name
 * @param {Array<object>} params.expiringSubscriptions - Array of { userName, userEmail, planCode, endDate, daysRemaining, profileId }
 * @param {Date|string} [params.reportDate] - Date of report
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendAdminSubscriptionExpiryDigestEmail = async ({ to, adminName, expiringSubscriptions = [], reportDate = new Date() }) => {
  if (!to) {
    return {
      success: false,
      error: 'Recipient admin email is required for expiry digest.',
    };
  }

  if (!Array.isArray(expiringSubscriptions) || expiringSubscriptions.length === 0) {
    return {
      success: false,
      error: 'Cannot send empty subscription expiry digest.',
    };
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const adminSubscriptionsUrl = `${clientUrl.replace(/\/$/, '')}/admin/subscriptions?expiringDays=7`;
  const fromAddress = getFromAddress();
  const replyTo = getReplyToAddress();
  const safeAdminName = escapeHtml(adminName || 'Administrator');
  const dateStr = new Date(reportDate).toLocaleDateString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Capture for automated tests in test environment
  if (process.env.NODE_ENV === 'test' || process.env.TEST_CAPTURE_EMAILS === 'true') {
    sentAdminDigestsForTest.push({
      to,
      adminName,
      expiringCount: expiringSubscriptions.length,
      expiringSubscriptions,
      adminSubscriptionsUrl,
      dispatchedAt: new Date(),
    });
    if (process.env.TEST_CAPTURE_EMAILS === 'true' || !isSmtpConfigured()) {
      return {
        success: true,
        messageId: `test-admin-digest-${Date.now()}`,
        isTestMock: true,
      };
    }
  }

  if (!isSmtpConfigured()) {
    console.warn('[Email Service] SMTP configuration is incomplete or missing in environment variables.');
    return {
      success: false,
      error: 'SMTP email service is not configured on this server.',
    };
  }

  const transporter = createTransporter();

  // Build HTML table rows for expiring subscriptions
  const tableRowsHtml = expiringSubscriptions
    .map((item, idx) => {
      const uName = escapeHtml(item.userName || 'Member');
      const uEmail = escapeHtml(item.userEmail || '-');
      const plan = escapeHtml(formatPlanCode(item.planCode));
      const endStr = item.endDate
        ? new Date(item.endDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
        : '-';
      const days = item.daysRemaining != null ? item.daysRemaining : 7;
      const bg = idx % 2 === 0 ? '#ffffff' : '#fcf8f4';

      return `
        <tr style="background-color: ${bg}; border-bottom: 1px solid #eadbd0;">
          <td style="padding: 10px 12px; font-size: 13px; color: #2b1a21;">
            <strong>${uName}</strong><br />
            <span style="color: #75606a; font-size: 12px;">${uEmail}</span>
          </td>
          <td style="padding: 10px 12px; font-size: 13px; color: #3f2b32;">${plan}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #3f2b32;">${endStr}</td>
          <td style="padding: 10px 12px; font-size: 13px; text-align: center;">
            <span style="background-color: #fef7ee; color: #8c6a28; border: 1px solid #e0bd77; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 700;">
              ${days}d
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  const plainTextItems = expiringSubscriptions
    .map(
      (item) =>
        `- ${item.userName || 'Member'} (${item.userEmail}): ${formatPlanCode(item.planCode)}, Expires: ${new Date(item.endDate).toISOString().slice(0, 10)} (${item.daysRemaining} days remaining)`
    )
    .join('\n');

  const tableHtml = `
    <div style="border: 1px solid #eadbd0; border-radius: 8px; overflow: hidden; margin: 20px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="background-color: #2b1a21; border-bottom: 2px solid #b08d4c;">
            <th style="padding: 11px 12px; font-size: 11px; text-transform: uppercase; color: #e0bd77; letter-spacing: 0.08em; font-weight: 700;">Member</th>
            <th style="padding: 11px 12px; font-size: 11px; text-transform: uppercase; color: #e0bd77; letter-spacing: 0.08em; font-weight: 700;">Plan</th>
            <th style="padding: 11px 12px; font-size: 11px; text-transform: uppercase; color: #e0bd77; letter-spacing: 0.08em; font-weight: 700;">Expiry Date</th>
            <th style="padding: 11px 12px; font-size: 11px; text-transform: uppercase; color: #e0bd77; letter-spacing: 0.08em; text-align: center; font-weight: 700;">Due</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>
  `;

  const mailOptions = {
    from: fromAddress,
    to,
    subject: `[Admin Digest] ${expiringSubscriptions.length} Subscription(s) Approaching Expiry — ${dateStr}`,
    text: `Hello ${adminName || 'Administrator'},\n\n` +
      `Here is your daily subscription expiry digest for ${dateStr}.\n\n` +
      `The following ${expiringSubscriptions.length} member subscription(s) will reach their expiration date within the next 7 days:\n\n` +
      `${plainTextItems}\n\n` +
      `Review and manage these accounts in the admin console:\n` +
      `${adminSubscriptionsUrl}\n\n` +
      `Regards,\n` +
      `Matrimony Platform System`,
    html: renderBrandedMatrimonyEmail({
      topicBadge: `Admin Digest • ${escapeHtml(dateStr)}`,
      greetingName: safeAdminName,
      introParagraphs: [
        `The automated scheduler identified <strong>${expiringSubscriptions.length}</strong> active member subscription(s) approaching expiry within the next 7 days:`,
      ],
      customBodyHtml: tableHtml,
      ctaButton: {
        label: 'Open Subscriptions in Admin Console',
        url: adminSubscriptionsUrl,
      },
      noticeBox: {
        title: 'Automated Actions Log:',
        items: [
          'Individual 7-day reminder emails have also been queued/dispatched to each eligible member above.',
          'Profiles that lapse will enter the standard 7-day grace period before candidate contact visibility locks.',
        ],
      },
      secondaryNote: 'Automated System Digest dispatched to authorized platform administrators.',
    }),
  };

  if (replyTo) {
    mailOptions.replyTo = replyTo;
  }

  try {
    const info = await dispatchMail(transporter, mailOptions);
    console.log(`[Email Service] Admin expiry digest successfully dispatched to ${to} (MessageId: ${info.messageId})`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error(`[Email Service Error] Failed to send admin expiry digest to ${to}: ${err.message}`);
    return {
      success: false,
      error: `Failed to deliver admin subscription expiry digest: ${err.message}`,
    };
  }
};

module.exports = {
  isSmtpConfigured,
  sendEmail,
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendSubscriptionExpiryReminderEmail,
  sendAdminSubscriptionExpiryDigestEmail,
  createTransporter,
  getDeliverabilityWarnings,
  getSentInvitationsForTest,
  clearSentInvitationsForTest,
  getSentPasswordResetsForTest,
  clearSentPasswordResetsForTest,
  getSentSubscriptionRemindersForTest,
  clearSentSubscriptionRemindersForTest,
  getSentAdminDigestsForTest,
  clearSentAdminDigestsForTest,
  escapeHtml,
  renderBrandedMatrimonyEmail,
};
