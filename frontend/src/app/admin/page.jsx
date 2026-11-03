'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Users,
  Heart,
  IndianRupee,
  UserPlus,
  CalendarClock,
  Unlock,
  ShieldAlert,
  Clock,
  CreditCard,
  Receipt,
  ArrowUpRight,
  Sparkles,
  Download,
  Calendar,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { getAdminStatsApi, getAdminMeApi, downloadAdminRevenueCsvApi } from '@/lib/api';
import { AreaChart, BarChart, Donut, HBars, Sparkline } from '@/components/admin/charts';
import { rupees } from '@/components/admin/adminFormat';

const shortDay = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthLabel = (m) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
const cap = (s) => String(s).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const PERIOD_PRESETS = [
  ['7d', 'Last 7 Days'],
  ['30d', 'Last 30 Days'],
  ['6m', 'Last 6 Months'],
  ['year', 'This Year'],
  ['custom', 'Custom Range'],
];

function Kpi({ icon: Icon, label, value, hint, tone = '', href, spark }) {
  const body = (
    <>
      <span className="adm-kpi-ico">
        <Icon size={20} />
      </span>
      <div className="adm-kpi-main">
        <span>{label}</span>
        <b>{value}</b>
        {hint && <small>{hint}</small>}
      </div>
      {spark && (
        <div className="adm-kpi-spark">
          <Sparkline values={spark} />
        </div>
      )}
    </>
  );
  return href ? (
    <Link href={href} className={`adm-card adm-kpi ${tone}`}>
      {body}
    </Link>
  ) : (
    <div className={`adm-card adm-kpi ${tone}`}>{body}</div>
  );
}

export default function AdminDashboardPage() {
  const [s, setS] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [error, setError] = useState('');

  // Date-range analytics state
  const [revenuePeriod, setRevenuePeriod] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [appliedCustom, setAppliedCustom] = useState({ startDate: '', endDate: '' });
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueError, setRevenueError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const revenueRequestIdRef = useRef(0);

  // Fetch dashboard stats with period parameter and race-condition protection
  const fetchDashboardStats = useCallback(
    async (periodParams, isPeriodChangeOnly = false) => {
      const currentRequestId = ++revenueRequestIdRef.current;
      if (isPeriodChangeOnly) {
        setRevenueLoading(true);
      }
      setRevenueError('');

      try {
        const res = await getAdminStatsApi(periodParams);
        if (currentRequestId !== revenueRequestIdRef.current) return;

        if (res.success && res.data) {
          setS(res.data);
        } else {
          const msg = res.message || 'Could not load statistics.';
          if (isPeriodChangeOnly) {
            setRevenueError(msg);
          } else {
            setError(msg);
          }
        }
      } catch {
        if (currentRequestId === revenueRequestIdRef.current) {
          if (isPeriodChangeOnly) {
            setRevenueError('Network error loading revenue analytics.');
          } else {
            setError('Unable to load analytics data. Please check your network connection.');
          }
        }
      } finally {
        if (currentRequestId === revenueRequestIdRef.current) {
          setRevenueLoading(false);
        }
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    let alive = true;
    Promise.all([getAdminStatsApi({ range: '30d' }), getAdminMeApi()]).then(([st, me]) => {
      if (!alive) return;
      if (st.success) setS(st.data);
      else setError(st.message || 'Could not load dashboard statistics.');
      if (me.success) setAdmin(me.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Handle Preset Period Selection
  const handleSelectPeriod = (preset) => {
    if (preset === revenuePeriod && preset !== 'custom') return;
    setRevenuePeriod(preset);
    setRevenueError('');
    if (preset !== 'custom') {
      fetchDashboardStats({ range: preset }, true);
    }
  };

  // Handle Custom Date Range Submission
  const handleApplyCustomDates = (e) => {
    e.preventDefault();
    if (!customStart || !customEnd) {
      setRevenueError('Please provide both Start Date and End Date.');
      return;
    }
    if (customStart > customEnd) {
      setRevenueError('Start Date cannot be after End Date.');
      return;
    }
    setRevenueError('');
    setAppliedCustom({ startDate: customStart, endDate: customEnd });
    fetchDashboardStats({ range: 'custom', startDate: customStart, endDate: customEnd }, true);
  };

  // Handle Authenticated Financial CSV Export
  const handleExportFinancialCsv = async () => {
    setExporting(true);
    setExportMessage('');
    try {
      const filters = {
        range: revenuePeriod,
        ...(revenuePeriod === 'custom' ? appliedCustom : {}),
      };
      const res = await downloadAdminRevenueCsvApi(filters);
      if (res.success && res.blob) {
        const url = window.URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename || `revenue-report-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        setExportMessage(res.message || 'Failed to download revenue export.');
      }
    } catch {
      setExportMessage('Network error during financial export.');
    } finally {
      setExporting(false);
    }
  };

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  if (error) return <div className="adm-card adm-empty">{error}</div>;
  if (!s) return <div className="adm-card adm-empty">Loading dashboard…</div>;

  const t = s?.totals || {};
  const rev = s?.revenueAnalytics;
  const pending = s?.approval?.pending_approval || 0;
  const signupSeries = (s?.signups || []).map((d) => ({ label: shortDay(d.date), full: shortDay(d.date), value: d.value }));
  const signups30 = (s?.signups || []).reduce((a, d) => a + d.value, 0);
  const revenueSeries = (s?.revenueMonthly || []).map((d) => ({
    label: monthLabel(d.month),
    full: `${monthLabel(d.month)} · ${d.orders} orders`,
    value: d.value / 100,
  }));

  const attention = [
    { icon: Clock, label: 'Profiles waiting for approval', n: pending, href: '/admin/profiles', tone: 'warn' },
    { icon: ShieldAlert, label: 'Failed payments', n: t.failedPayments || 0, href: '/admin/payments', tone: 'bad' },
    { icon: CalendarClock, label: 'Subscriptions ending in 7 days', n: t.expiring7 || 0, href: '/admin/subscriptions', tone: 'warn' },
  ];

  return (
    <>
      <section className="adm-hero">
        <div>
          <span className="adm-hero-date">{today}</span>
          <h1>Welcome back{admin?.name ? `, ${admin.name.split(' ')[0]}` : ''}</h1>
          {pending > 0 && (
            <p>
              {pending} profile{pending > 1 ? 's are' : ' is'} waiting for your review.
            </p>
          )}
        </div>
        <div className="adm-hero-actions">
          <Link href="/admin/profiles" className="adm-hero-btn primary">
            <Sparkles size={16} /> Review profiles
          </Link>
          <Link href="/admin/payments" className="adm-hero-btn">
            View payments
          </Link>
        </div>
      </section>

      {/* Primary KPI Overview Cards (All-Time & 30-day indicators) */}
      <div className="adm-kpis">
        <Kpi
          icon={Users}
          label="Members"
          value={t.users || 0}
          hint={`+${t.newUsers7 || 0} this week`}
          href="/admin/users"
          spark={(s?.signups || []).slice(-14).map((d) => d.value)}
        />
        <Kpi
          icon={Heart}
          label="Profiles"
          value={t.profiles || 0}
          hint={`${s?.approval?.approved || 0} approved`}
          href="/admin/profiles"
        />
        <Kpi
          icon={IndianRupee}
          label="All-Time Revenue"
          value={rupees(t.revenue || 0)}
          hint={`${t.paidOrders || 0} paid orders`}
          tone="gold"
          href="/admin/payments"
          spark={(s?.revenueMonthly || []).map((d) => d.value)}
        />
        <Kpi icon={UserPlus} label="Sign-ups (30 days)" value={signups30} hint="New member accounts" />
        <Kpi
          icon={Unlock}
          label="Contacts unlocked (30 days)"
          value={t.unlocks30 || 0}
          hint="Credit usage"
          spark={(s?.unlocks || []).slice(-14).map((d) => d.value)}
        />
        <Kpi
          icon={CalendarClock}
          label="Ending in 7 days"
          value={t.expiring7 || 0}
          hint="Subscriptions"
          tone={t.expiring7 ? 'warn' : ''}
          href="/admin/subscriptions"
        />
      </div>

      {/* ========================================================================= */}
      {/* Enhanced Revenue & Financial Analytics Panel with Date-Range Filtering */}
      {/* ========================================================================= */}
      <div className="adm-card" style={{ marginBottom: '1.25rem', padding: '1.4rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Receipt size={18} color="var(--a-brand)" /> Revenue & Payment Analytics
            </h2>
            <p style={{ margin: '0.2rem 0 0', color: 'var(--a-muted)', fontSize: '0.82rem' }}>
              Captured gross subscription payments across Asia/Kolkata timezone
              {rev?.period?.startDate && rev?.period?.endDate
                ? ` (${rev.period.startDate} to ${rev.period.endDate})`
                : revenueLoading
                ? ' (loading...)'
                : ''}
              .
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportFinancialCsv}
            disabled={exporting}
            className="btn-upload"
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            title="Download financial CSV report for selected date range"
          >
            <Download size={14} />
            {exporting ? 'Exporting CSV...' : 'Download Financial CSV'}
          </button>
        </div>

        {/* Period Selector Chips */}
        <div className="adm-filters" style={{ marginBottom: '1rem' }}>
          {PERIOD_PRESETS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`adm-chip ${revenuePeriod === key ? 'on' : ''}`}
              onClick={() => handleSelectPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom Date Range Inputs */}
        {revenuePeriod === 'custom' && (
          <form
            onSubmit={handleApplyCustomDates}
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: '1.25rem',
              padding: '0.75rem',
              backgroundColor: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid var(--a-line)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
              <label htmlFor="customStart" style={{ color: 'var(--a-muted)' }}>
                From:
              </label>
              <input
                id="customStart"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--a-line)' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
              <label htmlFor="customEnd" style={{ color: 'var(--a-muted)' }}>
                To:
              </label>
              <input
                id="customEnd"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--a-line)' }}
              />
            </div>
            <button
              type="submit"
              disabled={revenueLoading}
              className="btn-search"
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}
            >
              Apply Filter
            </button>
          </form>
        )}

        {/* Feedback / Error Message */}
        {revenueError && (
          <div
            style={{
              padding: '0.65rem 0.9rem',
              marginBottom: '1rem',
              borderRadius: '8px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <AlertCircle size={15} /> {revenueError}
          </div>
        )}

        {exportMessage && (
          <div
            style={{
              padding: '0.65rem 0.9rem',
              marginBottom: '1rem',
              borderRadius: '8px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{exportMessage}</span>
            <button
              type="button"
              onClick={() => setExportMessage('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Financial Metrics Cards for Selected Period */}
        {rev ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1.25rem',
            }}
          >
            {/* 1. Gross Captured Revenue */}
            <div
              className="adm-card"
              style={{ padding: '0.9rem 1rem', borderLeft: '4px solid #A78345', backgroundColor: '#FDFBF7' }}
            >
              <span style={{ fontSize: '0.74rem', color: 'var(--a-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Gross Captured Revenue
              </span>
              <b style={{ display: 'block', fontSize: '1.45rem', marginTop: '0.2rem', color: '#A20D16' }}>
                {revenueLoading ? '...' : rupees(rev.summary?.capturedAmount || 0)}
              </b>
              <small style={{ color: 'var(--a-muted)', fontSize: '0.74rem' }}>
                {rev.summary?.capturedCount || 0} paid order{(rev.summary?.capturedCount || 0) === 1 ? '' : 's'}
              </small>
            </div>

            {/* 2. Average Order Value (AOV) */}
            <div
              className="adm-card"
              style={{ padding: '0.9rem 1rem', borderLeft: '4px solid #A20D16', backgroundColor: '#FAF5F7' }}
            >
              <span style={{ fontSize: '0.74rem', color: 'var(--a-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Average Order Value (AOV)
              </span>
              <b style={{ display: 'block', fontSize: '1.45rem', marginTop: '0.2rem', color: '#49343B' }}>
                {revenueLoading ? '...' : rupees(rev.summary?.averageOrderValue || 0)}
              </b>
              <small style={{ color: 'var(--a-muted)', fontSize: '0.74rem' }}>Per captured transaction</small>
            </div>

            {/* 3. Failed Transactions */}
            <div
              className="adm-card"
              style={{
                padding: '0.9rem 1rem',
                borderLeft: `4px solid ${(rev.summary?.failedCount || 0) > 0 ? '#b91c1c' : '#15803d'}`,
                backgroundColor: (rev.summary?.failedCount || 0) > 0 ? '#FEF2F2' : '#F0FDF4',
              }}
            >
              <span style={{ fontSize: '0.74rem', color: 'var(--a-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Failed Payments
              </span>
              <b
                style={{
                  display: 'block',
                  fontSize: '1.45rem',
                  marginTop: '0.2rem',
                  color: (rev.summary?.failedCount || 0) > 0 ? '#b91c1c' : '#15803d',
                }}
              >
                {revenueLoading ? '...' : (rev.summary?.failedCount || 0)}
              </b>
              <small style={{ color: 'var(--a-muted)', fontSize: '0.74rem' }}>Payment failures in period</small>
            </div>

            {/* 4. Plan Revenue Breakdown */}
            <div
              className="adm-card"
              style={{ padding: '0.9rem 1rem', borderLeft: '4px solid #15803d', backgroundColor: '#F0FDF4' }}
            >
              <span style={{ fontSize: '0.74rem', color: 'var(--a-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Revenue by Plan
              </span>
              <div style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>3 Months:</span>
                  <b>
                    {rupees(rev.plans?.THREE_MONTHS?.amount || 0)} ({rev.plans?.THREE_MONTHS?.percentage || 0}%)
                  </b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>6 Months:</span>
                  <b>
                    {rupees(rev.plans?.SIX_MONTHS?.amount || 0)} ({rev.plans?.SIX_MONTHS?.percentage || 0}%)
                  </b>
                </div>
              </div>
            </div>
          </div>
        ) : revenueLoading ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--a-muted)', fontSize: '0.88rem' }}>
            Loading revenue metrics...
          </div>
        ) : (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--a-muted)', fontSize: '0.88rem' }}>
            Revenue analytics unavailable for the selected range.
          </div>
        )}

        {/* Dynamic Revenue Trend Chart for the Selected Period */}
        {rev && rev.trend && rev.trend.length > 0 ? (
          <div>
            <div className="adm-card-head" style={{ marginBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.92rem' }}>
                {rev.period?.bucketType === 'daily' ? 'Daily' : 'Monthly'} Captured Revenue Trend
              </h3>
              <span className="adm-muted">
                {rev.period?.startDate} to {rev.period?.endDate} (Asia/Kolkata)
              </span>
            </div>
            {revenueLoading ? (
              <div style={{ height: '200px', display: 'grid', placeItems: 'center', color: 'var(--a-muted)' }}>
                <div className="status-spinner" style={{ margin: '0 auto' }}></div>
              </div>
            ) : (
              <BarChart
                data={rev.trend.map((d) => ({
                  key: d.key,
                  label: d.label,
                  full: d.full,
                  value: d.amount / 100, // convert paise to rupees for chart axis
                }))}
                format={(v) => `₹${Number(v).toLocaleString('en-IN')}`}
                color="#A78345"
                height={210}
              />
            )}
          </div>
        ) : rev ? (
          <div style={{ height: '140px', display: 'grid', placeItems: 'center', color: 'var(--a-muted)', fontSize: '0.85rem' }}>
            No revenue transactions recorded for this period.
          </div>
        ) : null}
      </div>

      {/* Grid A: Member Sign-ups & Profile Approval */}
      <div className="adm-dash-grid a">
        <div className="adm-card">
          <div className="adm-card-head">
            <h2>Member sign-ups</h2>
            <span className="adm-muted">Last 30 days · {signups30} total</span>
          </div>
          <AreaChart data={signupSeries} />
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <h2>Profile approval</h2>
          </div>
          <Donut
            centerLabel="Profiles"
            data={[
              { label: 'Approved', value: s?.approval?.approved || 0, color: '#15803d' },
              { label: 'Pending', value: s?.approval?.pending_approval || 0, color: '#A78345' },
              { label: 'Rejected', value: s?.approval?.rejected || 0, color: '#b91c1c' },
            ]}
          />
        </div>
      </div>

      {/* Grid B: Historical 6-Month Revenue, Gender Split & Subscription Lifecycles */}
      <div className="adm-dash-grid b">
        <div className="adm-card">
          <div className="adm-card-head">
            <h2>Revenue by month</h2>
            <span className="adm-muted">Last 6 months · ₹</span>
          </div>
          <BarChart data={revenueSeries} format={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <h2>Gender split</h2>
          </div>
          <Donut
            centerLabel="Profiles"
            data={Object.entries(s?.gender || {}).map(([k, v]) => ({
              label: k === 'unknown' || k === 'null' ? 'Not stated' : k,
              value: v,
            }))}
          />
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <h2>Subscriptions</h2>
          </div>
          <Donut
            centerLabel="Total"
            data={[
              { label: 'Active', value: s?.subscriptions?.active || 0, color: '#15803d' },
              { label: 'Grace period', value: s?.subscriptions?.grace_period || 0, color: '#A78345' },
              { label: 'Expired', value: s?.subscriptions?.expired || 0, color: '#8F757E' },
              { label: 'Cancelled', value: s?.subscriptions?.cancelled || 0, color: '#b91c1c' },
              { label: 'Pending', value: s?.subscriptions?.pending || 0, color: '#CC6B88' },
            ].filter((d) => d.value > 0)}
          />
        </div>
      </div>

      {/* Grid C: Actionable Operations */}
      <div className="adm-dash-grid c">
        <div className="adm-card">
          <div className="adm-card-head">
            <h2>Needs attention</h2>
          </div>
          <ul className="adm-attn">
            {attention.map((a) => {
              const Icon = a.icon;
              return (
                <li key={a.label}>
                  <Link href={a.href} className={a.n ? a.tone : 'ok'}>
                    <span className="ico">
                      <Icon size={18} />
                    </span>
                    <span className="txt">{a.label}</span>
                    <b>{a.n}</b>
                    <ArrowUpRight size={16} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="adm-card">
          <div className="adm-card-head">
            <h2>Oldest pending profiles</h2>
            <Link href="/admin/profiles" className="adm-link">
              All →
            </Link>
          </div>
          {(!s?.pending || s.pending.length === 0) ? (
            <p className="adm-empty">Nothing pending.</p>
          ) : (
            <ul className="adm-list">
              {s.pending.map((p) => (
                <li key={p._id}>
                  <div>
                    {p.candidateName || p.user?.name || 'Unnamed profile'}
                    <small>
                      {cap(p.source)} · {new Date(p.createdAt).toLocaleDateString()}
                    </small>
                  </div>
                  <Link href="/admin/profiles" className="adm-pill warn">
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="adm-card">
          <div className="adm-card-head">
            <h2>Top locations</h2>
          </div>
          <HBars data={s?.topLocations || []} />
        </div>
      </div>

      {/* Quick Navigation Links */}
      <div className="adm-quick">
        {[
          [Heart, 'Profiles', 'Review, edit, import', '/admin/profiles'],
          [Users, 'User accounts', 'Details and history', '/admin/users'],
          [CreditCard, 'Subscriptions', 'Extend or cancel', '/admin/subscriptions'],
          [Receipt, 'Payments', 'Orders and failures', '/admin/payments'],
        ].map(([Icon, title, sub, href]) => (
          <Link key={href} href={href} className="adm-card adm-quick-item">
            <span>
              <Icon size={20} />
            </span>
            <div>
              <b>{title}</b>
              <small>{sub}</small>
            </div>
            <ArrowUpRight size={16} />
          </Link>
        ))}
      </div>
    </>
  );
}
