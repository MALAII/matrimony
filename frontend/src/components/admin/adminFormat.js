export const rupees = (paise) =>
  `₹${((Number(paise) || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const dateTime = (d) =>
  d
    ? new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

export const PLAN_LABEL = { THREE_MONTHS: '3 months', SIX_MONTHS: '6 months' };

const TONE = {
  captured: 'ok', active: 'ok', approved: 'ok',
  failed: 'bad', cancelled: 'bad', rejected: 'bad', expired: 'bad',
  refunded: 'warn', grace_period: 'warn', pending: 'warn', created: 'warn', authorized: 'warn',
};
export const toneOf = (status) => TONE[status] || 'neutral';
