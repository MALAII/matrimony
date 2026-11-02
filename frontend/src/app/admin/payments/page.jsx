'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Mail,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { getAdminPaymentsApi } from '@/lib/api';
import { StatusPill } from '@/components/admin/StatusPill';
import { rupees, PLAN_LABEL } from '@/components/admin/adminFormat';

const STATUSES = [
  ['', 'All Payments'],
  ['captured', 'Captured (Paid)'],
  ['created', 'Created (Incomplete)'],
  ['failed', 'Failed'],
  ['authorized', 'Authorized'],
  ['refunded', 'Refunded'],
];

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalRecords: 0 });
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const res = await getAdminPaymentsApi({ page, limit: 15, status, search: activeSearch });
      if (currentRequestId !== requestIdRef.current) return;
      if (res.success) {
        setRows(res.data || []);
        setSummary(res.summary);
        setPagination(res.pagination);
      } else setError(res.message || 'Failed to load payments.');
    } catch {
      if (currentRequestId === requestIdRef.current) {
        setError('Network error loading payments.');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [page, status, activeSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  const formatDateParts = (d) => {
    if (!d) return { date: '—', time: '' };
    const dt = new Date(d);
    const date = dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const time = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return { date, time };
  };

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Payments &amp; Transactions</h1>
          <p>Monitor Razorpay order settlements, payment verifications, and financial logs.</p>
        </div>
      </div>

      {/* DASHBOARD-STYLE STAT CARDS */}
      <div className="adm-kpis">
        <div className="adm-card adm-kpi gold">
          <span className="adm-kpi-ico">
            <IndianRupee size={22} />
          </span>
          <div className="adm-kpi-main">
            <span>TOTAL REVENUE</span>
            <b>{summary ? rupees(summary.capturedAmount) : '₹0'}</b>
            <small>Gross settled collections</small>
          </div>
        </div>

        <div className="adm-card adm-kpi">
          <span className="adm-kpi-ico">
            <CheckCircle2 size={22} />
          </span>
          <div className="adm-kpi-main">
            <span>SUCCESSFUL ORDERS</span>
            <b>{summary?.capturedCount ?? 0}</b>
            <small>Captured via Razorpay</small>
          </div>
        </div>

        <div className="adm-card adm-kpi warn">
          <span className="adm-kpi-ico">
            <Clock size={22} />
          </span>
          <div className="adm-kpi-main">
            <span>UNFINISHED / PENDING</span>
            <b>{summary?.pendingCount ?? 0}</b>
            <small>Abandoned checkout sessions</small>
          </div>
        </div>

        <div className="adm-card adm-kpi">
          <span className="adm-kpi-ico" style={{ color: '#dc2626', borderColor: '#fca5a5' }}>
            <AlertCircle size={22} />
          </span>
          <div className="adm-kpi-main">
            <span>FAILED TRANSACTIONS</span>
            <b>{summary?.failedCount ?? 0}</b>
            <small>Bank or gateway declines</small>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="adm-toolbar">
        <div className="adm-filters" style={{ margin: 0 }}>
          {STATUSES.map(([v, l]) => (
            <button
              key={v}
              type="button"
              className={`adm-chip ${status === v ? 'on' : ''}`}
              onClick={() => {
                setStatus(v);
                setPage(1);
              }}
            >
              {l}
            </button>
          ))}
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
            placeholder="Name, email, or order/payment ID"
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
          <table className="admin-table" style={{ width: '100%', tableLayout: 'auto' }}>
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Transaction Date</th>
                <th style={{ width: '22%' }}>Member / Customer</th>
                <th style={{ width: '12%' }}>Purchased Plan</th>
                <th style={{ width: '8%' }}>Amount</th>
                <th style={{ width: '15%' }}>Settlement Status</th>
                <th style={{ width: '28%', textAlign: 'right' }}>Gateway Reference</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="adm-empty" style={{ padding: '2.5rem' }}>
                    Loading payments…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="adm-empty" style={{ padding: '2.5rem' }}>
                    No payment records found.
                  </td>
                </tr>
              ) : (
                rows.map((p) => {
                  const initial = p.user?.name ? p.user.name.charAt(0).toUpperCase() : 'U';
                  const { date, time } = formatDateParts(p.createdAt);
                  const refId = p.razorpayPaymentId || p.razorpayOrderId || '';

                  return (
                    <tr key={p._id}>
                      {/* DATE */}
                      <td>
                        <div className="adm-pay-date">
                          <div className="adm-pay-date-main">
                            <Calendar size={13} style={{ color: 'var(--a-gold)', flexShrink: 0 }} />
                            <span>{date}</span>
                          </div>
                          <div className="adm-pay-date-sub">{time}</div>
                        </div>
                      </td>

                      {/* MEMBER */}
                      <td>
                        <div className="adm-user-cell">
                          <div className="adm-user-avatar">{initial}</div>
                          <div style={{ minWidth: 0 }}>
                            {p.user ? (
                              <Link href={`/admin/users/${p.user._id}`} className="adm-user-name">
                                {p.user.name}
                              </Link>
                            ) : (
                              <span style={{ color: 'var(--a-muted)', fontStyle: 'italic' }}>Deleted User</span>
                            )}
                            <div className="adm-user-sub">
                              <Mail size={11} style={{ opacity: 0.6 }} />
                              <span style={{ fontFamily: 'monospace' }}>{p.user?.email || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* PLAN */}
                      <td>
                        <span className="adm-plan-pill">
                          <Sparkles size={11} />
                          {PLAN_LABEL[p.planCode] || (p.planCode === 'SIX_MONTHS' ? '6 months' : '3 months')}
                        </span>
                      </td>

                      {/* AMOUNT */}
                      <td>
                        <span className="adm-paid-pill">
                          {rupees(p.amount)}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
                          <StatusPill status={p.status} />
                          {p.status === 'captured' && (
                            <small style={{ color: '#15803d', fontSize: '0.68rem', fontWeight: 600 }}>
                              Paid &amp; Active
                            </small>
                          )}
                          {p.status === 'created' && (
                            <small style={{ color: '#b45309', fontSize: '0.68rem', fontWeight: 600 }}>
                              Incomplete checkout
                            </small>
                          )}
                          {p.status === 'failed' && (
                            <small style={{ color: '#b91c1c', fontSize: '0.68rem', fontWeight: 600 }}>
                              {p.failureReason || 'Declined by bank'}
                            </small>
                          )}
                        </div>
                      </td>

                      {/* GATEWAY REFERENCE ID */}
                      <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                        {refId ? (
                          <div style={{ display: 'inline-flex', justifyContent: 'flex-end', width: '100%' }}>
                            <div className="adm-pay-ref" title={refId}>
                              <span>{refId}</span>
                              <button
                                type="button"
                                className="adm-pay-ref-copy"
                                onClick={() => handleCopy(refId, p._id)}
                                title={copiedId === p._id ? 'Copied to clipboard' : 'Copy reference ID'}
                                aria-label="Copy reference ID"
                              >
                                {copiedId === p._id ? (
                                  <Check size={13} style={{ color: '#16a34a' }} />
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--a-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
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
          {pagination.totalRecords} payments · page {pagination.page} of {pagination.totalPages}
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
    </>
  );
}
