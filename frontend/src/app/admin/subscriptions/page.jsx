'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  CalendarClock,
  Layers,
  Calendar,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Mail,
  Loader2,
} from 'lucide-react';
import { getAdminSubscriptionsApi, updateAdminSubscriptionApi } from '@/lib/api';
import { StatusPill } from '@/components/admin/StatusPill';
import { rupees, shortDate, PLAN_LABEL } from '@/components/admin/adminFormat';

const TABS = [
  ['', 'All'],
  ['active', 'Active'],
  ['grace_period', 'Grace period'],
  ['expired', 'Expired'],
  ['cancelled', 'Cancelled'],
  ['pending', 'Pending'],
];

const EXTEND_PRESETS = [7, 15, 30, 60, 90];

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalRecords: 0 });
  const [status, setStatus] = useState('');
  const [expiring, setExpiring] = useState(false);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const requestIdRef = useRef(0);

  // Custom modal states (replacing window.prompt and window.confirm)
  const [extendModal, setExtendModal] = useState({ open: false, sub: null, days: 30 });
  const [cancelModal, setCancelModal] = useState({ open: false, sub: null });

  const load = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const res = await getAdminSubscriptionsApi({
        page,
        limit: 15,
        status: expiring ? '' : status,
        search: activeSearch,
        expiringDays: expiring ? 14 : '',
      });
      if (currentRequestId !== requestIdRef.current) return;
      if (res.success) {
        setRows(res.data || []);
        setCounts(res.statusCounts || {});
        setPagination(res.pagination);
      } else setError(res.message || 'Failed to load subscriptions.');
    } catch {
      if (currentRequestId === requestIdRef.current) {
        setError('Network error fetching subscriptions.');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [page, status, expiring, activeSearch]);

  useEffect(() => {
    load();
  }, [load]);

  // Execute Extend API
  const handleConfirmExtend = async () => {
    const { sub, days } = extendModal;
    if (!sub) return;
    const daysNum = parseInt(days, 10);
    if (!daysNum || daysNum < 1 || daysNum > 365) {
      setFeedback({ ok: false, text: 'Please enter a valid number of days between 1 and 365.' });
      return;
    }

    setBusy(sub._id);
    try {
      const res = await updateAdminSubscriptionApi(sub._id, { action: 'extend', days: daysNum });
      setFeedback({ ok: res.success, text: res.message || `Successfully extended by ${daysNum} days.` });
      setExtendModal({ open: false, sub: null, days: 30 });
      if (res.success) load();
    } catch {
      setFeedback({ ok: false, text: 'Network error extending subscription.' });
    } finally {
      setBusy(null);
    }
  };

  // Execute Cancel API
  const handleConfirmCancel = async () => {
    const { sub } = cancelModal;
    if (!sub) return;

    setBusy(sub._id);
    try {
      const res = await updateAdminSubscriptionApi(sub._id, { action: 'cancel' });
      setFeedback({ ok: res.success, text: res.message || 'Subscription successfully cancelled.' });
      setCancelModal({ open: false, sub: null });
      if (res.success) load();
    } catch {
      setFeedback({ ok: false, text: 'Network error cancelling subscription.' });
    } finally {
      setBusy(null);
    }
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Helper for computing live prospective expiry date in Extend modal
  const getProspectiveDate = (sub, days) => {
    if (!sub) return '';
    const base = sub.endDate && new Date(sub.endDate) > new Date() ? new Date(sub.endDate) : new Date();
    const prospective = new Date(base.getTime() + (parseInt(days, 10) || 0) * 86400000);
    return shortDate(prospective.toISOString());
  };

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Subscriptions & Membership</h1>
          <p>Monitor active candidate access, plan renewals, and administrative overrides.</p>
        </div>
      </div>

      {/* DASHBOARD-STYLE KPI CARDS */}
      <div className="adm-kpis">
        <div className="adm-card adm-kpi">
          <span className="adm-kpi-ico">
            <ShieldCheck size={22} />
          </span>
          <div className="adm-kpi-main">
            <span>ACTIVE PLANS</span>
            <b>{counts.active ?? 0}</b>
            <small>Active candidate memberships</small>
          </div>
        </div>

        <div className="adm-card adm-kpi warn">
          <span className="adm-kpi-ico">
            <Clock size={22} />
          </span>
          <div className="adm-kpi-main">
            <span>IN GRACE PERIOD</span>
            <b>{counts.grace_period ?? 0}</b>
            <small>Renewal grace window</small>
          </div>
        </div>

        <div className="adm-card adm-kpi">
          <span className="adm-kpi-ico">
            <CalendarClock size={22} />
          </span>
          <div className="adm-kpi-main">
            <span>EXPIRED PLANS</span>
            <b>{counts.expired ?? 0}</b>
            <small>Lapsed or hidden profiles</small>
          </div>
        </div>

        <div className="adm-card adm-kpi gold">
          <span className="adm-kpi-ico">
            <Layers size={22} />
          </span>
          <div className="adm-kpi-main">
            <span>TOTAL SUBSCRIBERS</span>
            <b>{total}</b>
            <small>Lifetime recorded memberships</small>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={feedback.ok ? 'adm-alert-ok' : 'adm-alert-bad'}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            className="adm-x"
            onClick={() => setFeedback(null)}
            aria-label="Close feedback"
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* TOOLBAR */}
      <div className="adm-toolbar">
        <div className="adm-filters" style={{ margin: 0 }}>
          {TABS.map(([v, l]) => (
            <button
              key={v}
              type="button"
              className={`adm-chip ${!expiring && status === v ? 'on' : ''}`}
              onClick={() => {
                setExpiring(false);
                setStatus(v);
                setPage(1);
              }}
            >
              {l}
            </button>
          ))}
          <button
            type="button"
            className={`adm-chip ${expiring ? 'on' : ''}`}
            onClick={() => {
              setExpiring(true);
              setPage(1);
            }}
          >
            Expiring in 14 days
          </button>
        </div>
        <form
          className="adm-search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setActiveSearch(search.trim());
          }}
        >
          <input
            type="text"
            placeholder="Member name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
          />
          <button type="submit" className="btn-search" style={{ padding: '.5rem 1rem' }}>
            Search
          </button>
        </form>
      </div>

      {/* TABLE */}
      {error ? (
        <div className="adm-card adm-empty">{error}</div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '26%' }}>Member Account</th>
                <th style={{ width: '13%' }}>Plan Tier</th>
                <th style={{ width: '11%' }}>Status</th>
                <th style={{ width: '24%' }}>Validity Period</th>
                <th style={{ width: '8%' }}>Paid</th>
                <th style={{ width: '18%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="adm-empty" style={{ padding: '2.5rem' }}>
                    Loading subscriptions…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="adm-empty" style={{ padding: '2.5rem' }}>
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                rows.map((s) => {
                  const initial = s.user?.name ? s.user.name.charAt(0).toUpperCase() : 'U';
                  const isExtendable = ['active', 'grace_period', 'expired'].includes(s.status);
                  const isCancellable = s.status !== 'cancelled' && s.status !== 'expired';

                  return (
                    <tr key={s._id}>
                      {/* MEMBER COLUMN */}
                      <td>
                        <div className="adm-user-cell">
                          <div className="adm-user-avatar">{initial}</div>
                          <div style={{ minWidth: 0 }}>
                            {s.user ? (
                              <Link href={`/admin/users/${s.user._id}`} className="adm-user-name">
                                {s.user.name}
                              </Link>
                            ) : (
                              <span style={{ color: 'var(--a-muted)', fontStyle: 'italic' }}>Deleted User</span>
                            )}
                            <div className="adm-user-sub">
                              <Mail size={11} style={{ opacity: 0.6 }} />
                              <span style={{ fontFamily: 'monospace' }}>{s.user?.email || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* PLAN */}
                      <td>
                        <span className="adm-plan-pill">
                          <Sparkles size={11} />
                          {PLAN_LABEL[s.planCode] || s.planCode || 'Standard Plan'}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td>
                        <StatusPill status={s.status} />
                      </td>

                      {/* PERIOD */}
                      <td>
                        <div className="adm-validity-cell">
                          <div className="adm-validity-main">
                            <Calendar size={13} className="adm-validity-icon" />
                            <span className="adm-validity-exp">
                              Expires <strong>{shortDate(s.endDate)}</strong>
                            </span>
                          </div>
                          <div className="adm-validity-sub">
                            Started {shortDate(s.startDate)}
                          </div>
                          {s.gracePeriodEndDate && (
                            <span className="adm-grace-tag">
                              Grace until {shortDate(s.gracePeriodEndDate)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* PAID */}
                      <td>
                        <span className="adm-paid-pill">
                          {s.payment ? rupees(s.payment.amount) : '—'}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="adm-sub-actions">
                          {isExtendable && (
                            <button
                              type="button"
                              className="adm-btn-extend"
                              disabled={busy === s._id}
                              onClick={() => setExtendModal({ open: true, sub: s, days: 30 })}
                              title="Extend membership validity period"
                            >
                              <Plus size={12} /> Extend
                            </button>
                          )}
                          {isCancellable && (
                            <button
                              type="button"
                              className="adm-btn-cancel"
                              disabled={busy === s._id}
                              onClick={() => setCancelModal({ open: true, sub: s })}
                              title="Revoke active membership"
                            >
                              <X size={12} /> Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PAGINATION */}
      <div className="pagination-bar">
        <div>
          {pagination.totalRecords} subscriptions · page {pagination.page} of {pagination.totalPages}
        </div>
        <div className="pagination-controls">
          <button
            type="button"
            className="btn-page"
            disabled={page <= 1}
            onClick={() => setPage((x) => x - 1)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <button
            type="button"
            className="btn-page"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((x) => x + 1)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          CUSTOM EXTEND SUBSCRIPTION MODAL (REPLACES WINDOW.PROMPT)
          ========================================================================= */}
      {extendModal.open && extendModal.sub && (
        <div className="adm-modal-center" onClick={() => !busy && setExtendModal({ open: false, sub: null, days: 30 })}>
          <div className="adm-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="adm-dialog-header">
              <h3>
                <Sparkles size={18} style={{ color: 'var(--a-brand)' }} /> Extend Membership Validity
              </h3>
              <button
                type="button"
                className="adm-x"
                disabled={Boolean(busy)}
                onClick={() => setExtendModal({ open: false, sub: null, days: 30 })}
              >
                <X size={16} />
              </button>
            </div>

            <div className="adm-dialog-body">
              {/* Member overview */}
              <div className="adm-user-mini-card">
                <div className="adm-user-avatar">
                  {extendModal.sub.user?.name ? extendModal.sub.user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--a-ink)', fontSize: '0.95rem' }}>
                    {extendModal.sub.user?.name || 'Candidate'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--a-muted)', fontFamily: 'monospace' }}>
                    {extendModal.sub.user?.email || '—'}
                  </div>
                </div>
                <span className="adm-plan-pill">
                  {PLAN_LABEL[extendModal.sub.planCode] || extendModal.sub.planCode}
                </span>
              </div>

              {/* Quick Preset Chips */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--a-ink)', display: 'block', marginBottom: '0.3rem' }}>
                  Quick Extension Presets:
                </label>
                <div className="adm-quick-chips">
                  {EXTEND_PRESETS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`adm-quick-chip ${parseInt(extendModal.days, 10) === d ? 'active' : ''}`}
                      onClick={() => setExtendModal((prev) => ({ ...prev, days: d }))}
                    >
                      +{d} Days {d === 7 ? '(1 Wk)' : d === 30 ? '(1 Mo)' : d === 90 ? '(3 Mo)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Days Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--a-ink)' }}>
                  Number of Days to Extend:
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={extendModal.days}
                  onChange={(e) => setExtendModal((prev) => ({ ...prev, days: e.target.value }))}
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--a-line)',
                    fontSize: '0.92rem',
                    color: 'var(--a-ink)',
                    width: '100%',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--a-muted)' }}>
                  Enter any integer between 1 and 365 days.
                </span>
              </div>

              {/* Calculated preview */}
              <div className="adm-preview-box">
                <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                <div>
                  <div>Current Expiration: <strong>{shortDate(extendModal.sub.endDate)}</strong></div>
                  <div>
                    New Validity Date: <b>{getProspectiveDate(extendModal.sub, extendModal.days)}</b>
                  </div>
                </div>
              </div>
            </div>

            <div className="adm-dialog-footer">
              <button
                type="button"
                className="btn-secondary"
                disabled={Boolean(busy)}
                onClick={() => setExtendModal({ open: false, sub: null, days: 30 })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={Boolean(busy)}
                onClick={handleConfirmExtend}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {busy === extendModal.sub._id ? (
                  <>
                    <Loader2 size={14} className="adm-spin" /> Extending…
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Confirm & Extend
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CUSTOM CANCEL SUBSCRIPTION MODAL (REPLACES WINDOW.CONFIRM)
          ========================================================================= */}
      {cancelModal.open && cancelModal.sub && (
        <div className="adm-modal-center" onClick={() => !busy && setCancelModal({ open: false, sub: null })}>
          <div className="adm-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="adm-dialog-header">
              <h3 style={{ color: '#991b1b' }}>
                <AlertTriangle size={18} /> Revoke Membership Access
              </h3>
              <button
                type="button"
                className="adm-x"
                disabled={Boolean(busy)}
                onClick={() => setCancelModal({ open: false, sub: null })}
              >
                <X size={16} />
              </button>
            </div>

            <div className="adm-dialog-body">
              {/* Member overview */}
              <div className="adm-user-mini-card">
                <div className="adm-user-avatar">
                  {cancelModal.sub.user?.name ? cancelModal.sub.user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--a-ink)', fontSize: '0.95rem' }}>
                    {cancelModal.sub.user?.name || 'Candidate'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--a-muted)', fontFamily: 'monospace' }}>
                    {cancelModal.sub.user?.email || '—'}
                  </div>
                </div>
                <span className="adm-plan-pill">
                  {PLAN_LABEL[cancelModal.sub.planCode] || cancelModal.sub.planCode}
                </span>
              </div>

              {/* Danger Warning Box */}
              <div className="adm-danger-box">
                <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>Are you sure you want to cancel this plan?</div>
                  <div>
                    This action will immediately terminate active member privileges for{' '}
                    <strong>{cancelModal.sub.user?.name || 'this member'}</strong> and permanently set the subscription status to <strong>Cancelled</strong>.
                  </div>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', opacity: 0.85 }}>
                    Originally scheduled to expire on: {shortDate(cancelModal.sub.endDate)}
                  </div>
                </div>
              </div>
            </div>

            <div className="adm-dialog-footer">
              <button
                type="button"
                className="btn-secondary"
                disabled={Boolean(busy)}
                onClick={() => setCancelModal({ open: false, sub: null })}
              >
                Keep Plan Active
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={handleConfirmCancel}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.6rem 1.3rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 8px 18px -6px rgba(220, 38, 38, 0.5)',
                }}
              >
                {busy === cancelModal.sub._id ? (
                  <>
                    <Loader2 size={14} className="adm-spin" /> Revoking…
                  </>
                ) : (
                  <>
                    <X size={14} /> Yes, Revoke Subscription
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
