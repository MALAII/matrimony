/**
 * Checks the outbound email setup for common causes of mail landing in spam.
 *
 *   npm run check:email                 config + DNS (SPF, DKIM, DMARC) for the From domain
 *   npm run check:email -- --verify     also opens an SMTP session to confirm the login works (sends nothing)
 *   npm run check:email -- --dkim=selector1   test a specific DKIM selector from your mail provider
 *
 * Reads backend/.env. Never prints secrets and never sends a message.
 */
require('dotenv').config();
const dns = require('dns').promises;
const {
  getDeliverabilityWarnings,
  createTransporter,
  isSmtpConfigured,
} = require('../services/emailService');

const COMMON_DKIM_SELECTORS = [
  'google', 'default', 'selector1', 'selector2', 'k1', 'k2', 'k3', 's1', 's2',
  'mail', 'resend', 'brevo', 'mandrill', 'zoho', 'zmail', 'smtp', 'dkim', 'sendgrid', 'amazonses',
];

const args = process.argv.slice(2);
const verify = args.includes('--verify');
const dkimArg = (args.find((a) => a.startsWith('--dkim=')) || '').split('=')[1];

const txt = async (name) => {
  try {
    return (await dns.resolveTxt(name)).map((parts) => parts.join(''));
  } catch {
    return [];
  }
};

const fromEmail = (() => {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || '';
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
})();
const domain = fromEmail.split('@')[1] || '';

const ok = (msg) => console.log(`  ✔ ${msg}`);
const bad = (msg) => console.log(`  ✘ ${msg}`);
const info = (msg) => console.log(`  • ${msg}`);

(async () => {
  console.log('\nEmail deliverability check');
  console.log('==========================');
  console.log(`From address : ${fromEmail || '(not set)'}`);
  console.log(`SMTP host    : ${process.env.SMTP_HOST || '(not set)'}`);
  console.log(`Client URL   : ${process.env.CLIENT_URL || '(not set)'}`);

  console.log('\nConfiguration');
  if (!isSmtpConfigured()) bad('SMTP is not fully configured (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).');
  else ok('SMTP credentials are present.');
  const warnings = getDeliverabilityWarnings();
  if (warnings.length === 0) ok('No configuration problems found.');
  warnings.forEach((w) => bad(w));

  const consumer = /^(gmail|googlemail|yahoo|outlook|hotmail|live|rediffmail|icloud)\./.test(domain);
  if (consumer) {
    console.log(`\nDNS for ${domain}`);
    info('Skipped: you do not control this domain. Switch to your own domain, then re-run this check.');
  } else if (domain) {
    console.log(`\nDNS for ${domain}`);
    const spf = (await txt(domain)).filter((r) => r.toLowerCase().startsWith('v=spf1'));
    if (spf.length === 0) bad('No SPF record. Add one that authorises your mail provider.');
    else if (spf.length > 1) bad(`Multiple SPF records found (${spf.length}); only one is allowed.`);
    else ok(`SPF: ${spf[0]}`);

    const dmarc = (await txt(`_dmarc.${domain}`)).filter((r) => r.toUpperCase().startsWith('V=DMARC1'));
    if (dmarc.length === 0) bad('No DMARC record at _dmarc. Start with: v=DMARC1; p=none; rua=mailto:you@yourdomain');
    else ok(`DMARC: ${dmarc[0]}`);

    const selectors = dkimArg ? [dkimArg] : COMMON_DKIM_SELECTORS;
    const found = [];
    for (const sel of selectors) {
      const rec = (await txt(`${sel}._domainkey.${domain}`)).filter((r) => /v=DKIM1|p=/.test(r));
      if (rec.length) found.push(sel);
    }
    if (found.length) ok(`DKIM selector(s) found: ${found.join(', ')}`);
    else bad(`No DKIM key found${dkimArg ? ` for selector "${dkimArg}"` : ' on common selectors'}. Your provider shows the exact record to add (use --dkim=<selector> to test it).`);
  }

  if (verify && isSmtpConfigured()) {
    console.log('\nSMTP login');
    try {
      await createTransporter().verify();
      ok('Connected and authenticated (no message was sent).');
    } catch (e) {
      bad(`SMTP verification failed: ${e.message}`);
    }
  }

  console.log('\nThen test a real message at https://www.mail-tester.com (aim for 9/10 or better).\n');
  process.exit(0);
})();
