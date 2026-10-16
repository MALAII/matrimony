'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getAdminProfilesApi,
  updateProfileApprovalApi,
  inviteBrokerCandidateApi,
  reinviteBrokerCandidateApi,
} from '@/lib/api';
import { AdminNav } from '@/components/admin/AdminNav';

// Calculate age from Date of Birth
function calculateAge(dobString) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  const diffMs = Date.now() - dob.getTime();
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

export default function AdminProfilesPage() {
  const router = useRouter();

  // Data & State
  const [profiles, setProfiles] = useState([]);
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
  const [actionFeedback, setActionFeedback] = useState({ type: '', text: '' });
  const [processingId, setProcessingId] = useState(null);
  const isFetchingRef = useRef(false);

  // Fetch Profiles with in-flight request guard
  const fetchProfiles = useCallback(async (targetPage, targetLimit, targetSearch) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await getAdminProfilesApi({
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
        setProfiles(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setErrorMessage(res.message || 'Failed to load matrimonial profiles.');
      }
    } catch (err) {
      setErrorMessage('Network connection error while fetching matrimonial profiles.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [router]);

  // Load when page, limit, or activeSearch changes
  useEffect(() => {
    fetchProfiles(page, limit, activeSearch);
  }, [page, limit, activeSearch, fetchProfiles]);

  // Search handler
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchTerm.trim());
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    setActiveSearch('');
    setPage(1);
  };

  // Handle Profile Approval / Rejection Action
  const handleApprovalAction = async (profileId, candidateLabel, actionStatus) => {
    if (processingId) return;

    const actionVerb = actionStatus === 'approved' ? 'approve' : 'reject';
    const isConfirmed = window.confirm(
      `Are you sure you want to ${actionVerb.toUpperCase()} the matrimonial profile for "${candidateLabel}"?`
    );

    if (!isConfirmed) return;

    setProcessingId(profileId);
    setActionFeedback({ type: '', text: '' });

    try {
      const res = await updateProfileApprovalApi(profileId, actionStatus);

      if (res.success) {
        setActionFeedback({
          type: 'success',
          text: `Successfully ${actionStatus === 'approved' ? 'approved' : 'rejected'} profile for "${candidateLabel}".`,
        });
        // Refresh directory listing to reflect updated status and audit fields
        fetchProfiles(page, limit, activeSearch);
      } else {
        setActionFeedback({
          type: 'error',
          text: res.message || `Failed to ${actionVerb} profile.`,
        });
      }
    } catch (err) {
      setActionFeedback({
        type: 'error',
        text: `Network error while attempting to ${actionVerb} profile.`,
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Login Invitation for Approved Broker Candidate
  const handleInviteCandidate = async (profileId, candidateName, existingEmail) => {
    if (processingId) return;

    let targetEmail = existingEmail;
    if (!targetEmail) {
      const inputEmail = window.prompt(
        `Please enter candidate email address to send login invitation for "${candidateName}":`
      );
      if (!inputEmail || !inputEmail.trim()) {
        return; // User cancelled
      }
      targetEmail = inputEmail.trim();
    } else {
      const confirmSend = window.confirm(
        `Send password setup invitation email to "${candidateName}" at ${targetEmail}?`
      );
      if (!confirmSend) return;
    }

    setProcessingId(profileId);
    setActionFeedback({ type: '', text: '' });

    try {
      const res = await inviteBrokerCandidateApi(profileId, targetEmail);

      if (res.success) {
        setActionFeedback({
          type: res.warning ? 'error' : 'success',
          text: res.message,
        });
        fetchProfiles(page, limit, activeSearch);
      } else {
        setActionFeedback({
          type: 'error',
          text: res.message || 'Failed to send login invitation.',
        });
      }
    } catch (err) {
      setActionFeedback({
        type: 'error',
        text: 'Network error while attempting to send login invitation.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Resending Login Invitation
  const handleReinviteCandidate = async (profileId, candidateName, email) => {
    if (processingId) return;

    const confirmResend = window.confirm(
      `Rotate setup token and resend invitation email to "${candidateName}" (${email})?`
    );
    if (!confirmResend) return;

    setProcessingId(profileId);
    setActionFeedback({ type: '', text: '' });

    try {
      const res = await reinviteBrokerCandidateApi(profileId);

      if (res.success) {
        setActionFeedback({
          type: res.warning ? 'error' : 'success',
          text: res.message,
        });
        fetchProfiles(page, limit, activeSearch);
      } else {
        setActionFeedback({
          type: 'error',
          text: res.message || 'Failed to resend invitation.',
        });
      }
    } catch (err) {
      setActionFeedback({
        type: 'error',
        text: 'Network error while attempting to resend invitation.',
      });
    } finally {
      setProcessingId(null);
    }
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
              Administrator privileges required. You do not have permission to view matrimonial profile records.
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
            <h1>Matrimonial Profiles Directory</h1>
            <p>Inspect registered candidate profiles, personal backgrounds, profession, and preferences.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Link
              href="/admin/profiles/new"
              className="btn-primary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1.15rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <span>+</span> Add Broker Profile
            </Link>
            <Link href="/admin" className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <AdminNav />

        {/* Action Feedback Banner */}
        {actionFeedback.text && (
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.25rem',
              backgroundColor: actionFeedback.type === 'error' ? '#fef2f2' : '#f0fdf4',
              color: actionFeedback.type === 'error' ? 'var(--danger)' : '#166534',
              border: `1px solid ${actionFeedback.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>{actionFeedback.type === 'error' ? '⚠️' : '✅'}</span>
              <span>{actionFeedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback({ type: '', text: '' })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'inherit' }}
              aria-label="Dismiss feedback"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search & Controls Bar */}
        <div className="table-controls-bar">
          <form onSubmit={handleSearchSubmit} className="search-form">
            <input
              type="text"
              placeholder="Search by candidate name, email, location, or profession..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              aria-label="Search profiles"
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
            <label htmlFor="profileLimitSelector" style={{ color: 'var(--text-muted)' }}>
              Rows per page:
            </label>
            <select
              id="profileLimitSelector"
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
            Showing results matching: <strong>&ldquo;{activeSearch}&rdquo;</strong>
          </div>
        )}

        {/* Main Content State Rendering */}
        {loading ? (
          <div className="admin-state-box">
            <div className="status-spinner" style={{ margin: '0 auto 1.25rem auto' }}></div>
            <p>Loading matrimonial profiles...</p>
          </div>
        ) : errorMessage ? (
          <div className="admin-state-box">
            <span className="admin-state-icon" role="img" aria-label="Error">
              ⚠️
            </span>
            <h2 className="admin-state-title">Failed to Load Profiles</h2>
            <p className="admin-state-desc">{errorMessage}</p>
            <button
              type="button"
              onClick={() => fetchProfiles(page, limit, activeSearch)}
              className="btn-search"
            >
              Retry
            </button>
          </div>
        ) : profiles.length === 0 ? (
          <div className="admin-state-box">
            <span className="admin-state-icon" role="img" aria-label="Empty">
              💍
            </span>
            <h2 className="admin-state-title">No Profiles Found</h2>
            <p className="admin-state-desc">
              {activeSearch
                ? `No matrimonial profiles matched "${activeSearch}". Try adjusting your search query.`
                : 'There are currently no matrimonial profiles created in the database.'}
            </p>
            {activeSearch ? (
              <button type="button" onClick={handleClearSearch} className="btn-secondary">
                Reset Search Filter
              </button>
            ) : (
              <Link href="/admin/profiles/new" className="btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
                + Create First Broker Profile
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Origin &amp; Account</th>
                    <th>Status</th>
                    <th>Personal Details</th>
                    <th>Education &amp; Profession</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => {
                    const u = p.user;
                    const isBroker = p.source === 'broker';
                    const candidateDisplayName = p.candidateName || u?.name || 'Unnamed Candidate';
                    const age = calculateAge(p.personalDetails?.dateOfBirth);
                    const photoUrl = p.profilePhoto?.url;
                    const isPendingApproval = p.approvalStatus === 'pending_approval';
                    const isProcessingThis = processingId === p._id;

                    const formattedCreated = p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'N/A';

                    return (
                      <tr key={p._id}>
                        {/* Candidate Avatar & Basic Info */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div className="profile-thumb-avatar">
                              {photoUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={photoUrl}
                                  alt="Candidate photo"
                                  className="profile-thumb-img"
                                />
                              ) : (
                                <span>{p.personalDetails?.gender === 'Female' ? '👩' : '👨'}</span>
                              )}
                            </div>
                            <div>
                              <strong style={{ color: 'var(--text-main)', display: 'block' }}>
                                {candidateDisplayName}
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {p.personalDetails?.gender || 'Gender unstated'}
                                {age ? ` • ${age} yrs` : ''}
                              </span>
                              {p.candidatePhone && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                                  📞 {p.candidatePhone}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Origin & Linked User Account */}
                        <td>
                          <div style={{ marginBottom: '0.4rem' }}>
                            {isBroker ? (
                              <span
                                className="badge"
                                style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.7rem' }}
                              >
                                🤝 Broker Profile
                              </span>
                            ) : (
                              <span
                                className="badge"
                                style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.7rem' }}
                              >
                                👤 Direct Member
                              </span>
                            )}
                          </div>

                          {u ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{u.name}</div>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {u.email}
                              </span>
                            </div>
                          ) : p.candidateEmail ? (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              ✉️ {p.candidateEmail}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                              No login account
                            </span>
                          )}
                        </td>

                        {/* Approval & Activity Status */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <div>
                              {p.approvalStatus === 'approved' && (
                                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                                  ✓ Approved
                                </span>
                              )}
                              {p.approvalStatus === 'pending_approval' && (
                                <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                                  ⏳ Pending
                                </span>
                              )}
                              {p.approvalStatus === 'rejected' && (
                                <span
                                  className="badge"
                                  style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.7rem' }}
                                >
                                  ✕ Rejected
                                </span>
                              )}
                            </div>

                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              State: <strong>{p.profileStatus || 'active'}</strong>
                            </span>

                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Added: {formattedCreated}
                            </span>
                          </div>
                        </td>

                        {/* Personal Details */}
                        <td>
                          <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                            {p.personalDetails?.maritalStatus && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                                {p.personalDetails.maritalStatus}
                              </div>
                            )}
                            {p.personalDetails?.location && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Location: </span>
                                {p.personalDetails.location}
                              </div>
                            )}
                            {p.personalDetails?.motherTongue && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Language: </span>
                                {p.personalDetails.motherTongue}
                              </div>
                            )}
                            {p.personalDetails?.height && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Height: </span>
                                {p.personalDetails.height} cm
                              </div>
                            )}
                            {!p.personalDetails?.maritalStatus &&
                              !p.personalDetails?.location &&
                              !p.personalDetails?.motherTongue && (
                                <span style={{ color: 'var(--text-muted)' }}>No details entered</span>
                              )}
                          </div>
                        </td>

                        {/* Education & Profession */}
                        <td>
                          <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                            {p.educationAndProfession?.occupation && (
                              <div>
                                <strong>{p.educationAndProfession.occupation}</strong>
                              </div>
                            )}
                            {p.educationAndProfession?.educationalQualification && (
                              <div style={{ color: 'var(--text-muted)' }}>
                                {p.educationAndProfession.educationalQualification}
                              </div>
                            )}
                            {p.educationAndProfession?.company && (
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                at {p.educationAndProfession.company}
                              </div>
                            )}
                            {p.educationAndProfession?.income && (
                              <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                                Income: {p.educationAndProfession.income}
                              </div>
                            )}
                            {!p.educationAndProfession?.occupation &&
                              !p.educationAndProfession?.educationalQualification && (
                                <span style={{ color: 'var(--text-muted)' }}>No career details entered</span>
                              )}
                          </div>
                        </td>

                        {/* Actions Column */}
                        <td>
                          {isBroker && isPendingApproval ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '100px' }}>
                              <button
                                type="button"
                                onClick={() => handleApprovalAction(p._id, candidateDisplayName, 'approved')}
                                disabled={isProcessingThis}
                                className="btn-search"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.78rem',
                                  backgroundColor: '#16a34a',
                                  textAlign: 'center',
                                }}
                              >
                                {isProcessingThis ? '...' : '✓ Approve'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApprovalAction(p._id, candidateDisplayName, 'rejected')}
                                disabled={isProcessingThis}
                                className="btn-danger-outline"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.78rem',
                                  textAlign: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {isProcessingThis ? '...' : '✕ Reject'}
                              </button>
                            </div>
                          ) : isBroker && p.approvalStatus === 'approved' && (!u || u.accountStatus === 'invited') ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '110px' }}>
                              {!u ? (
                                <button
                                  type="button"
                                  onClick={() => handleInviteCandidate(p._id, candidateDisplayName, p.candidateEmail)}
                                  disabled={isProcessingThis}
                                  className="btn-search"
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    fontSize: '0.78rem',
                                    backgroundColor: '#0284c7',
                                    textAlign: 'center',
                                  }}
                                  title="Send login invitation email to candidate"
                                >
                                  {isProcessingThis ? '...' : '✉️ Send Invite'}
                                </button>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  <span
                                    className="badge badge-warning"
                                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem', textAlign: 'center' }}
                                  >
                                    Invited
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleReinviteCandidate(p._id, candidateDisplayName, u.email || p.candidateEmail)}
                                    disabled={isProcessingThis}
                                    className="btn-reset"
                                    style={{
                                      padding: '0.3rem 0.5rem',
                                      fontSize: '0.75rem',
                                      textAlign: 'center',
                                    }}
                                    title="Rotate token and resend invitation email"
                                  >
                                    {isProcessingThis ? '...' : '🔄 Resend'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : isBroker && p.approvalStatus === 'approved' && u && u.accountStatus === 'active' ? (
                            <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                              ✓ Account Active
                            </span>
                          ) : isBroker ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Decision: {p.approvalStatus}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 500 }}>
                              Pre-approved (Direct)
                            </span>
                          )}
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
                Showing <strong>{profiles.length}</strong> of{' '}
                <strong>{pagination.totalRecords}</strong> profiles
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
