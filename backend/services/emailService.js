const nodemailer = require('nodemailer');

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
const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
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
  const fromAddress = process.env.EMAIL_FROM || 'no-reply@matrimony.example.com';

  // Check if SMTP transport is configured
  if (!isSmtpConfigured()) {
    // Return controlled error without exposing internals
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
    subject: 'You have been invited to activate your Matrimonial Profile',
    text: `Hello ${name || 'Candidate'},\n\nYour matrimonial profile has been created and verified by our administration team.\n\nPlease activate your account and set up your secure password by visiting the following link:\n\n${setupUrl}\n\nThis invitation link is single-use and will expire in 24 hours.\n\nIf you did not request this profile, please ignore this email.\n\nWarm regards,\nMatrimony Team`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #991b1b; margin-top: 0;">Matrimonial Account Invitation</h2>
        <p style="color: #334155; font-size: 16px; line-height: 1.5;">Hello <strong>${name || 'Candidate'}</strong>,</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.5;">Your matrimonial profile has been created and verified by our administration team. You are now invited to set up your login credentials to access your dashboard.</p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${setupUrl}" style="background-color: #991b1b; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: 600; border-radius: 8px; display: inline-block; font-size: 16px;">Set Up Your Password</a>
        </div>
        <p style="color: #64748b; font-size: 14px; line-height: 1.5;">This secure setup link is valid for <strong>24 hours</strong> and can only be used once. If the link above does not work, copy and paste the following URL into your browser:</p>
        <p style="word-break: break-all; color: #64748b; font-size: 13px; background-color: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">${setupUrl}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">If you did not request this profile or believe this was sent in error, please disregard this email.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
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

module.exports = {
  isSmtpConfigured,
  sendInvitationEmail,
  createTransporter,
};
