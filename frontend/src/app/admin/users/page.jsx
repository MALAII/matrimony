'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  Users,
  LayoutDashboard,
  Eye,
  ChevronLeft,
  ChevronRight,
  Download,
  UserCheck,
  Mail,
  UserX,
  CreditCard,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Heart,
} from 'lucide-react';
import {
  getAdminUsersApi,
  getAdminUserStatsApi,
  downloadAdminUsersCsvApi,
} from '@/lib/api';
import { StatusPill } from '@/components/admin/StatusPill';

export default function AdminUsersPage() {
  const router = useRouter();

  // Data & State
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalRecords: 0,
    totalPages: 1,
  });

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    role: '',
    registrationSource: '',
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Status & Concurrency State
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const requestIdRef = useRef(0);

  // 1. Fetch Account Statistics
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await getAdminUserStatsApi();
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch {
      // Non-blocking for table display
    } finally {
      setStatsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // 2. Fetch Users with sequence counter race-condition protection
  const fetchUsers = useCallback(async (targetPage, targetLimit, targetSearch, currentFilters) => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await getAdminUsersApi({
        page: targetPage,
        limit: targetLimit,
        search: targetSearch,
        status: currentFilters.status,
        role: currentFilters.role,
        registrationSource: currentFilters.registrationSource,
      });

      // Ignore stale responses
      if (currentRequestId !== requestIdRef.current) return;

      if (res.status === 401) {
        router.replace('/login');
        return;
      }

      if (res.status === 403) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      if (res.success) {
        setUsers(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setErrorMessage(res.message || 'Failed to load user directory.');
      }
    } catch {
      if (currentRequestId === requestIdRef.current) {
        setErrorMessage('Network connection error while fetching users.');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [router]);

  // Load when page, limit, activeSearch, or filters change
  useEffect(() => {
    fetchUsers(page, limit, activeSearch, filters);
  }, [page, limit, activeSearch, filters, fetchUsers]);

  // Handle Search Submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchTerm.trim());
  };

  // Handle Search Clear
  const handleClearSearch = () => {
    setSearchTerm('');
    setActiveSearch('');
    setPage(1);
  };

  // Handle Filter Change
  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Reset All Filters
  const handleResetAllFilters = () => {
    setSearchTerm('');
    setActiveSearch('');
    setFilters({ status: '', role: '', registrationSource: '' });
    setPage(1);
  };

  // Authenticated CSV Export
  const handleExportCsv = async () => {
    setExporting(true);
    setExportMessage('');
    try {
      const res = await downloadAdminUsersCsvApi({
        search: activeSearch,
        status: filters.status,
        role: filters.role,
        registrationSource: filters.registrationSource,
      });

      if (res.status === 401) {
        router.replace('/login');
        return;
      }

      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }

      if (res.success && res.blob) {
        const url = window.URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename || `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        setExportMessage(res.message || 'Failed to download export.');
      }
    } catch {
      setExportMessage('Network error while exporting records.');
    } finally {
      setExporting(false);
    }
  };

  // Format Helper for Plan Code
  const formatPlanCode = (code) => {
    if (!code) return 'Free';
    if (code === 'THREE_MONTHS') return '3 Months';
    if (code === 'SIX_MONTHS') return '6 Months';
    return String(code).replace(/_/g, ' ');
  };

  // 1. Access Denied State (403)
  if (accessDenied) {
    return (
      <main className="admin-page">
        <div className="admin-container">
          <div className="admin-state-box" style={{ maxWidth: '580px', margin: '4rem auto' }}>
            <span className="admin-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <ShieldAlert size={48} color="var(--danger)" />
            </span>
            <h1 className="admin-state-title" style={{ color: 'var(--danger)' }}>
              Access Denied
            </h1>
            <p className="admin-state-desc">
              Administrator privileges required. You do not have permission to view the user management records.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link href="/" className="btn-secondary">
                Return to Home
              </Link>
              <Link href="/login" className="btn-upload">
                Sign In with Different Account
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const hasActiveFilters = Boolean(
    activeSearch || filters.status || filters.role || filters.registrationSource
  );

  return (
    <main className="admin-page">
      <div className="admin-container">
        {/* Header Area */}
        <div className="admin-header-area">
          <div className="admin-title-group">
            <h1>User Accounts Management</h1>
            <p>Review registered users, account analytics, roles, and membership status.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting}
              className="btn-upload"
              style={{
                fontSize: '0.85rem',
                padding: '0.5rem 1rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title="Download filtered user records as CSV"
            >
              <Download size={15} />
              {exporting ? 'Exporting CSV...' : 'Download CSV'}
            </button>
            <Link
              href="/admin"
              className="btn-secondary"
              style={{
                fontSize: '0.85rem',
                padding: '0.5rem 1rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <LayoutDashboard size={14} /> Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Export Notification Message */}
        {exportMessage && (
          <div
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              borderRadius: '8px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              fontSize: '0.875rem',
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

        {/* Account Analysis KPI Cards */}
        <div className="adm-kpis" style={{ marginTop: '0.5rem' }}>
          <div
            className={`adm-card adm-kpi ${filters.status === '' && !filters.role && !filters.registrationSource ? 'on' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => setFilter('status', '')}
            title="Click to view all accounts"
          >
            <span className="adm-kpi-ico">
              <Users size={20} />
            </span>
            <div className="adm-kpi-main">
              <span>Total Accounts</span>
              <b>{statsLoading ? '...' : stats?.totalAccounts ?? 0}</b>
              <small>All registered users</small>
            </div>
          </div>

          <div
            className={`adm-card adm-kpi ${filters.status === 'active' ? 'on' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => setFilter('status', filters.status === 'active' ? '' : 'active')}
            title="Click to filter by active accounts"
          >
            <span className="adm-kpi-ico" style={{ background: '#dcfce7', color: '#166534' }}>
              <UserCheck size={20} />
            </span>
            <div className="adm-kpi-main">
              <span>Active Accounts</span>
              <b>{statsLoading ? '...' : stats?.active ?? 0}</b>
              <small>Live active logins</small>
            </div>
          </div>

          <div
            className={`adm-card adm-kpi ${filters.status === 'invited' ? 'on' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => setFilter('status', filters.status === 'invited' ? '' : 'invited')}
            title="Click to filter by invited candidates"
          >
            <span className="adm-kpi-ico" style={{ background: '#e0f2fe', color: '#0369a1' }}>
              <Mail size={20} />
            </span>
            <div className="adm-kpi-main">
              <span>Invited Accounts</span>
              <b>{statsLoading ? '...' : stats?.invited ?? 0}</b>
              <small>Pending invitation setup</small>
            </div>
          </div>

          <div
            className={`adm-card adm-kpi ${filters.status === 'suspended' || filters.status === 'inactive' ? 'on' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => setFilter('status', filters.status === 'suspended' ? '' : 'suspended')}
            title="Click to filter suspended accounts"
          >
            <span className="adm-kpi-ico" style={{ background: '#fee2e2', color: '#b91c1c' }}>
              <UserX size={20} />
            </span>
            <div className="adm-kpi-main">
              <span>Suspended / Inactive</span>
              <b>{statsLoading ? '...' : stats?.suspendedOrInactive ?? 0}</b>
              <small>Disabled or inactive</small>
            </div>
          </div>

          <div className="adm-card adm-kpi">
            <span className="adm-kpi-ico" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
              <CheckCircle2 size={20} />
            </span>
            <div className="adm-kpi-main">
              <span>Email Verified</span>
              <b>{statsLoading ? '...' : stats?.verifiedEmails ?? 0}</b>
              <small>Confirmed email owners</small>
            </div>
          </div>

          <div className="adm-card adm-kpi gold">
            <span className="adm-kpi-ico">
              <CreditCard size={20} />
            </span>
            <div className="adm-kpi-main">
              <span>Subscribed Users</span>
              <b>{statsLoading ? '...' : stats?.subscribedUsers ?? 0}</b>
              <small>Active paid memberships</small>
            </div>
          </div>
        </div>

        {/* Filter Chips & Dropdowns */}
        <div className="adm-filters" style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
          {[
            ['', 'All Statuses'],
            ['active', 'Active'],
            ['invited', 'Invited'],
            ['suspended', 'Suspended'],
            ['inactive', 'Inactive'],
          ].map(([val, label]) => (
            <button
              key={val}
              type="button"
              className={`adm-chip ${filters.status === val ? 'on' : ''}`}
              onClick={() => setFilter('status', val)}
            >
              {label}
            </button>
          ))}

          <select
            value={filters.role}
            onChange={(e) => setFilter('role', e.target.value)}
            aria-label="Filter by role"
          >
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          <select
            value={filters.registrationSource}
            onChange={(e) => setFilter('registrationSource', e.target.value)}
            aria-label="Filter by registration source"
          >
            <option value="">All Sources</option>
            <option value="direct">Direct Sign-up</option>
            <option value="broker">Assisted Candidate</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Search & Controls Bar */}
        <div className="table-controls-bar">
          <form onSubmit={handleSearchSubmit} className="search-form">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              aria-label="Search users"
              maxLength={100}
            />
            <button type="submit" disabled={loading} className="btn-search">
              Search
            </button>
            {(searchTerm || activeSearch) && (
              <button
                type="button"
                onClick={handleClearSearch}
                disabled={loading}
                className="btn-reset"
              >
                Clear
              </button>
            )}
          </form>

          {/* Page size limit selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <label htmlFor="limitSelector" style={{ color: 'var(--text-muted)' }}>
              Rows per page:
            </label>
            <select
              id="limitSelector"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="limit-select"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Active Filter Pill */}
        {activeSearch && (
          <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Showing results filtered by search: <strong>&ldquo;{activeSearch}&rdquo;</strong>
          </div>
        )}

        {/* Main Content State Rendering */}
        {loading ? (
          <div className="admin-state-box">
            <div className="status-spinner" style={{ margin: '0 auto 1.25rem auto' }}></div>
            <p>Loading user records...</p>
          </div>
        ) : errorMessage ? (
          <div className="admin-state-box">
            <span className="admin-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <AlertCircle size={48} color="var(--danger)" />
            </span>
            <h2 className="admin-state-title">Failed to Load Users</h2>
            <p className="admin-state-desc">{errorMessage}</p>
            <button
              type="button"
              onClick={() => fetchUsers(page, limit, activeSearch, filters)}
              className="btn-search"
            >
              Retry
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="admin-state-box">
            <span className="admin-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <Users size={48} color="var(--text-muted)" />
            </span>
            <h2 className="admin-state-title">No User Records Found</h2>
            <p className="admin-state-desc">
              {hasActiveFilters
                ? 'No user accounts matched your active filters or search query.'
                : 'There are currently no registered users in the database.'}
            </p>
            {hasActiveFilters && (
              <button type="button" onClick={handleResetAllFilters} className="btn-secondary">
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="admin-table-container">
              <table className="admin-table" style={{ width: '100%', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>User Account</th>
                    <th style={{ width: '23%' }}>Contact &amp; Verification</th>
                    <th style={{ width: '16%' }}>Role &amp; Status</th>
                    <th style={{ width: '18%' }}>Matrimonial Profile</th>
                    <th style={{ width: '10%' }}>Membership</th>
                    <th style={{ width: '8%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const formattedDate = u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'N/A';

                    const isAdmin = u.role === 'admin';
                    const userInitial = u.name ? u.name.charAt(0).toUpperCase() : '?';
                    const userCode = u._id ? `USR-${u._id.slice(-6).toUpperCase()}` : 'USER';
                    const isBroker = u.registrationSource === 'broker';

                    return (
                      <tr key={u.id || u._id}>
                        {/* 1. User Account Identity */}
                        <td>
                          <div className="adm-user-cell">
                            <div className={`adm-user-avatar ${isAdmin ? 'admin' : ''}`}>
                              {userInitial}
                            </div>
                            <div>
                              <Link
                                href={`/admin/users/${u.id || u._id}`}
                                className="adm-user-name"
                                title="Click to view complete user dossier"
                              >
                                {u.name || 'Unnamed User'}
                              </Link>
                              <div className="adm-user-sub">
                                <span className="adm-tag-id">#{userCode}</span>
                                <span>• {isBroker ? 'Assisted' : 'Direct Sign-up'}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Contact & Verification */}
                        <td>
                          <div className="adm-email-box">
                            <span className="adm-email-text">
                              <Mail size={12} color="var(--a-muted)" />
                              {u.email}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                              {u.emailVerifiedAt ? (
                                <span className="adm-verify-tag">
                                  <CheckCircle2 size={11} /> Verified
                                </span>
                              ) : (
                                <span className="adm-unverify-tag">Unverified</span>
                              )}
                              <span style={{ fontSize: '0.7rem', color: 'var(--a-muted)' }}>
                                • Joined {formattedDate}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Role & Account Status */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                            <span
                              className="adm-tag-gender"
                              style={{
                                background: isAdmin ? '#fdf2f4' : '#f0f9ff',
                                color: isAdmin ? '#9f1239' : '#0369a1',
                                borderColor: isAdmin ? '#fecdd3' : '#bae6fd',
                                fontSize: '0.68rem',
                                padding: '0.12rem 0.5rem',
                              }}
                            >
                              {isAdmin ? <><ShieldCheck size={11} /> Admin</> : 'Member'}
                            </span>
                            <StatusPill status={u.accountStatus} />
                          </div>
                        </td>

                        {/* 4. Linked Profile */}
                        <td>
                          {u.profile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                              <Link
                                href={`/admin/profiles/${u.profile._id || u.profile.id}`}
                                style={{
                                  fontSize: '0.84rem',
                                  fontWeight: 600,
                                  color: 'var(--a-brand)',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                }}
                                title="View matrimonial profile"
                              >
                                <Heart size={11} />
                                {u.profile.candidateName || 'Candidate Profile'}
                              </Link>
                              <StatusPill status={u.profile.approvalStatus} />
                            </div>
                          ) : (
                            <span style={{ color: 'var(--a-muted)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                              No Profile Linked
                            </span>
                          )}
                        </td>

                        {/* 5. Membership */}
                        <td>
                          {u.subscription ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--a-ink)' }}>
                                {formatPlanCode(u.subscription.planCode)}
                              </span>
                              <StatusPill status={u.subscription.status} />
                            </div>
                          ) : (
                            <span className="adm-pill neutral" style={{ fontSize: '0.7rem' }}>Free Tier</span>
                          )}
                        </td>

                        {/* 6. Action: View Button */}
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Link
                              href={`/admin/users/${u.id || u._id}`}
                              className="adm-act-btn primary"
                              style={{ textDecoration: 'none', padding: '0.4rem 0.85rem', fontSize: '0.76rem' }}
                              title="Inspect full user account, security & subscription details"
                            >
                              <Eye size={12} /> View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="pagination-bar">
              <div>
                Showing <strong>{users.length}</strong> of{' '}
                <strong>{pagination.totalRecords}</strong> user accounts
                {pagination.totalPages > 1 && (
                  <span>
                    {' '}(Page {pagination.page} of {pagination.totalPages})
                  </span>
                )}
              </div>

              <div className="pagination-controls">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={page <= 1}
                  className="btn-page"
                  aria-label="Previous Page"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span style={{ padding: '0 0.5rem', fontWeight: 600 }}>
                  {page} / {pagination.totalPages || 1}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(prev + 1, pagination.totalPages))}
                  disabled={page >= pagination.totalPages}
                  className="btn-page"
                  aria-label="Next Page"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
