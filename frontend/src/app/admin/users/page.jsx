'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAdminUsersApi } from '@/lib/api';
import { AdminNav } from '@/components/admin/AdminNav';

export default function AdminUsersPage() {
  const router = useRouter();

  // Data & State
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalRecords: 0,
    totalPages: 1,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Status & Concurrency State
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isFetchingRef = useRef(false);

  // Fetch Users with in-flight request guard
  const fetchUsers = useCallback(async (targetPage, targetLimit, targetSearch) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await getAdminUsersApi({
        page: targetPage,
        limit: targetLimit,
        search: targetSearch,
      });

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
    } catch (err) {
      setErrorMessage('Network connection error while fetching users.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [router]);

  // Load when page, limit, or activeSearch changes
  useEffect(() => {
    fetchUsers(page, limit, activeSearch);
  }, [page, limit, activeSearch, fetchUsers]);

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

  // 1. Access Denied State (403)
  if (accessDenied) {
    return (
      <main className="admin-page">
        <div className="admin-container">
          <div className="admin-state-box" style={{ maxWidth: '580px', margin: '4rem auto' }}>
            <span className="admin-state-icon" role="img" aria-label="Access Denied">
              🚫
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

  return (
    <main className="admin-page">
      <div className="admin-container">
        {/* Header Area */}
        <div className="admin-header-area">
          <div className="admin-title-group">
            <h1>User Accounts Management</h1>
            <p>Review registered users, account roles, and membership registration dates.</p>
          </div>
          <Link href="/admin" className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
            ← Back to Dashboard
          </Link>
        </div>

        {/* Navigation Tabs */}
        <AdminNav />

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
            Showing results filtered by: <strong>&ldquo;{activeSearch}&rdquo;</strong>
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
            <span className="admin-state-icon" role="img" aria-label="Error">
              ⚠️
            </span>
            <h2 className="admin-state-title">Failed to Load Users</h2>
            <p className="admin-state-desc">{errorMessage}</p>
            <button
              type="button"
              onClick={() => fetchUsers(page, limit, activeSearch)}
              className="btn-search"
            >
              Retry
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="admin-state-box">
            <span className="admin-state-icon" role="img" aria-label="Empty">
              👥
            </span>
            <h2 className="admin-state-title">No User Records Found</h2>
            <p className="admin-state-desc">
              {activeSearch
                ? `No user accounts matched "${activeSearch}". Try refining your search query.`
                : 'There are currently no registered users in the database.'}
            </p>
            {activeSearch && (
              <button type="button" onClick={handleClearSearch} className="btn-secondary">
                Reset Search Filter
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email Address</th>
                    <th>Role</th>
                    <th>Registered On</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const formattedDate = u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'N/A';

                    return (
                      <tr key={u.id || u._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                backgroundColor: u.role === 'admin' ? 'var(--primary-light)' : '#f1f5f9',
                                color: u.role === 'admin' ? 'var(--primary)' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                flexShrink: 0,
                              }}
                            >
                              {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                              <strong style={{ color: 'var(--text-main)', display: 'block' }}>
                                {u.name || 'Unnamed User'}
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                ID: {u.id || u._id}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                            {u.email}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${u.role === 'admin' ? 'badge-success' : 'badge-neutral'}`}
                            style={{
                              backgroundColor: u.role === 'admin' ? '#dcfce7' : '#f1f5f9',
                              color: u.role === 'admin' ? '#166534' : '#475569',
                            }}
                          >
                            {u.role === 'admin' ? '★ Admin' : 'User'}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {formattedDate}
                          </span>
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
                  disabled={page <= 1 || loading}
                  className="btn-page"
                  aria-label="Previous Page"
                >
                  ← Previous
                </button>
                <span style={{ padding: '0 0.5rem', fontWeight: 600 }}>
                  {page} / {pagination.totalPages || 1}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(prev + 1, pagination.totalPages))}
                  disabled={page >= pagination.totalPages || loading}
                  className="btn-page"
                  aria-label="Next Page"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
