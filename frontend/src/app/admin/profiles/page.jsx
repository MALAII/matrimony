'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet,
  Plus,
  LayoutDashboard,
  ShieldAlert,
  Heart,
  AlertCircle,
  CheckCircle2,
  XCircle,
  User,
  Users,
  Phone,
  Mail,
  Clock,
  Eye,
  Edit,
  Camera,
  Play,
  Pause,
  Trash2,
  Check,
  X,
  RotateCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import {
  getAdminProfilesApi,
  updateProfileApprovalApi,
  inviteBrokerCandidateApi,
  reinviteBrokerCandidateApi,
  updateAdminProfileStatusApi,
  deleteAdminProfileApi,
} from '@/lib/api';
import { AdminPhotoManagerModal } from '@/components/admin/AdminPhotoManagerModal';
import { AdminBulkImportModal } from '@/components/admin/AdminBulkImportModal';
import { AdminProfileViewModal } from '@/components/admin/AdminProfileViewModal';
import { AdminProfileEditModal } from '@/components/admin/AdminProfileEditModal';

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
  const requestIdRef = useRef(0);

  // Auto-dismiss feedback toast after 4.5 seconds
  useEffect(() => {
    if (!actionFeedback.text) return;
    const t = setTimeout(() => {
      setActionFeedback({ type: '', text: '' });
    }, 4500);
    return () => clearTimeout(t);
  }, [actionFeedback.text]);

  // View / Edit / Filter State
  const [viewProfile, setViewProfile] = useState(null);
  const [editProfile, setEditProfile] = useState(null);
  const [filters, setFilters] = useState({ approvalStatus: '', profileStatus: '', source: '', gender: '' });
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Memoized stats calculation for directory overview ribbon
  const stats = React.useMemo(() => {
    const total = pagination.totalRecords || profiles.length;
    let active = 0;
    let pending = 0;
    let brides = 0;
    let grooms = 0;
    profiles.forEach((p) => {
      if (p.profileStatus === 'active') active++;
      if (p.approvalStatus === 'pending_approval') pending++;
      if (p.personalDetails?.gender === 'Female') brides++;
      if (p.personalDetails?.gender === 'Male') grooms++;
    });
    return { total, active, pending, brides, grooms };
  }, [profiles, pagination.totalRecords]);

  // Photo Management Modal State
  const [selectedPhotoProfile, setSelectedPhotoProfile] = useState(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // Bulk Excel Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Fetch Profiles with sequence-based race condition protection
  const fetchProfiles = useCallback(async (targetPage, targetLimit, targetSearch) => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await getAdminProfilesApi({
        page: targetPage,
        limit: targetLimit,
        search: targetSearch,
        ...filtersRef.current,
      });

      // Ignore stale responses from earlier requests
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
        setProfiles(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setErrorMessage(res.message || 'Failed to load matrimonial profiles.');
      }
    } catch (err) {
      if (currentRequestId === requestIdRef.current) {
        setErrorMessage('Network connection error while fetching matrimonial profiles.');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [router]);

  // Sync photo updates from modal to parent table row
  const handlePhotosUpdated = useCallback((profileId, newPrimaryUrl, newCount) => {
    setProfiles((prevProfiles) =>
      prevProfiles.map((p) => {
        if (p._id === profileId) {
          return {
            ...p,
            profilePhoto: {
              ...(p.profilePhoto || {}),
              url: newPrimaryUrl,
            },
            photos: Array.from({ length: newCount || 0 }),
          };
        }
        return p;
      })
    );
  }, []);

  // Handle successful import completion
  const handleImportCompleted = useCallback((importedCount) => {
    setActionFeedback({
      type: 'success',
      text: `Successfully imported ${importedCount} candidate profiles! All imported profiles are pending approval.`,
    });
    setPage(1);
    fetchProfiles(1, limit, activeSearch);
  }, [fetchProfiles, limit, activeSearch]);

  // Load when page, limit, or activeSearch changes
  useEffect(() => {
    fetchProfiles(page, limit, activeSearch);
  }, [page, limit, activeSearch, filters, fetchProfiles]);

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

  // Custom Modal Confirmation & Prompt State (Replaces native browser window.confirm & window.prompt)
  const [actionModal, setActionModal] = useState({
    open: false,
    type: '', // 'approval', 'status', 'delete', 'invite', 'reinvite'
    profileId: null,
    candidateLabel: '',
    targetStatus: '',
    title: '',
    message: '',
    confirmText: '',
    confirmColor: '',
    inputVal: '',
  });

  // Handle Profile Approval / Rejection Action
  const handleApprovalAction = (profileId, candidateLabel, actionStatus) => {
    if (processingId) return;
    const actionVerb = actionStatus === 'approved' ? 'Approve' : 'Reject';
    setActionModal({
      open: true,
      type: 'approval',
      profileId,
      candidateLabel,
      targetStatus: actionStatus,
      title: `${actionVerb} Matrimonial Profile`,
      message:
        actionStatus === 'approved'
          ? `Are you sure you want to approve the profile for "${candidateLabel}"? It will become active and visible in the member directory.`
          : `Are you sure you want to reject the profile for "${candidateLabel}"?`,
      confirmText: `Yes, ${actionVerb} Profile`,
      confirmColor: actionStatus === 'approved' ? '#16a34a' : '#dc2626',
      inputVal: '',
    });
  };

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const handleToggleStatus = (p, label) => {
    if (processingId) return;
    const next = p.profileStatus === 'inactive' ? 'active' : 'inactive';
    const actionLabel = next === 'active' ? 'Activate' : 'Deactivate';
    setActionModal({
      open: true,
      type: 'status',
      profileId: p._id,
      candidateLabel: label,
      targetStatus: next,
      title: `${actionLabel} Profile`,
      message: `Are you sure you want to ${actionLabel.toLowerCase()} the profile for "${label}"?`,
      confirmText: `Yes, ${actionLabel}`,
      confirmColor: next === 'active' ? '#16a34a' : '#d97706',
      inputVal: '',
    });
  };

  const handleDeleteProfile = (p, label) => {
    if (processingId) return;
    setActionModal({
      open: true,
      type: 'delete',
      profileId: p._id,
      candidateLabel: label,
      targetStatus: '',
      title: 'Delete Matrimonial Profile',
      message: `Permanently DELETE the profile for "${label}"? This action cannot be undone.`,
      confirmText: 'Yes, Delete Permanently',
      confirmColor: '#dc2626',
      inputVal: '',
    });
  };

  const handleProfileSaved = (updated) => {
    setEditProfile(null);
    setViewProfile(null);
    setActionFeedback({ type: 'success', text: 'Profile updated.' });
    if (updated) setProfiles((prev) => prev.map((x) => (x._id === updated._id ? updated : x)));
  };

  // Handle Login Invitation for Approved Broker Candidate
  const handleInviteCandidate = (profileId, candidateName, existingEmail) => {
    if (processingId) return;
    setActionModal({
      open: true,
      type: 'invite',
      profileId,
      candidateLabel: candidateName,
      targetStatus: '',
      title: 'Send Candidate Login Invite',
      message: `Send an activation email inviting "${candidateName}" to log in and manage their profile.`,
      confirmText: 'Send Invitation Email',
      confirmColor: '#0284c7',
      inputVal: existingEmail || '',
    });
  };

  // Handle Resending Login Invitation
  const handleReinviteCandidate = (profileId, candidateName, currentEmail) => {
    if (processingId) return;
    setActionModal({
      open: true,
      type: 'reinvite',
      profileId,
      candidateLabel: candidateName,
      targetStatus: '',
      title: 'Resend Candidate Login Invite',
      message: `Rotate token and resend invitation email to "${candidateName}".`,
      confirmText: 'Resend Invitation Email',
      confirmColor: '#0284c7',
      inputVal: currentEmail || '',
    });
  };

  // Execute Action from Custom Modal
  const handleConfirmActionModal = async () => {
    const { type, profileId, candidateLabel, targetStatus, inputVal } = actionModal;
    if (!profileId || processingId) return;

    if (type === 'approval') {
      const actionVerb = targetStatus === 'approved' ? 'approve' : 'reject';
      setProcessingId(profileId);
      setActionFeedback({ type: '', text: '' });
      try {
        const res = await updateProfileApprovalApi(profileId, targetStatus);
        if (res.success) {
          setActionFeedback({
            type: 'success',
            text: `Successfully ${targetStatus === 'approved' ? 'approved' : 'rejected'} profile for "${candidateLabel}".`,
          });
          setActionModal({ open: false, type: '', profileId: null });
          fetchProfiles(page, limit, activeSearch);
        } else {
          setActionFeedback({ type: 'error', text: res.message || `Failed to ${actionVerb} profile.` });
        }
      } catch (err) {
        setActionFeedback({ type: 'error', text: `Network error while attempting to ${actionVerb} profile.` });
      } finally {
        setProcessingId(null);
      }
    } else if (type === 'status') {
      setProcessingId(profileId);
      try {
        const res = await updateAdminProfileStatusApi(profileId, targetStatus);
        setActionFeedback({ type: res.success ? 'success' : 'error', text: res.message || 'Done.' });
        if (res.success) {
          setActionModal({ open: false, type: '', profileId: null });
          fetchProfiles(page, limit, activeSearch);
        }
      } catch (err) {
        setActionFeedback({ type: 'error', text: 'Network error updating profile status.' });
      } finally {
        setProcessingId(null);
      }
    } else if (type === 'delete') {
      setProcessingId(profileId);
      try {
        const res = await deleteAdminProfileApi(profileId);
        setActionFeedback({ type: res.success ? 'success' : 'error', text: res.message || 'Done.' });
        if (res.success) {
          setActionModal({ open: false, type: '', profileId: null });
          fetchProfiles(page, limit, activeSearch);
        }
      } catch (err) {
        setActionFeedback({ type: 'error', text: 'Network error deleting profile.' });
      } finally {
        setProcessingId(null);
      }
    } else if (type === 'invite' || type === 'reinvite') {
      const targetEmail = (inputVal || '').trim();
      if (!targetEmail) {
        setActionFeedback({ type: 'error', text: 'Please enter a valid email address.' });
        return;
      }
      setProcessingId(profileId);
      setActionFeedback({ type: '', text: '' });
      try {
        const res =
          type === 'reinvite'
            ? await reinviteBrokerCandidateApi(profileId, targetEmail)
            : await inviteBrokerCandidateApi(profileId, targetEmail);

        if (res.success) {
          setActionFeedback({ type: res.warning ? 'warning' : 'success', text: res.message });
          setProfiles((prev) =>
            prev.map((item) => {
              if (item._id === profileId) {
                return {
                  ...item,
                  candidateEmail: targetEmail,
                  user: item.user
                    ? { ...item.user, email: targetEmail }
                    : { email: targetEmail, name: candidateLabel, accountStatus: 'invited' },
                };
              }
              return item;
            })
          );
          setActionModal({ open: false, type: '', profileId: null });
          fetchProfiles(page, limit, activeSearch);
        } else {
          setActionFeedback({ type: 'error', text: res.message || 'Failed to send login invitation.' });
        }
      } catch (err) {
        setActionFeedback({ type: 'error', text: 'Network error while attempting to send login invitation.' });
      } finally {
        setProcessingId(null);
      }
    }
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
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="btn-primary"
              style={{
                fontSize: '0.85rem',
                padding: '0.5rem 1.15rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: '#0284c7',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Bulk import candidates from Excel spreadsheet"
            >
              <FileSpreadsheet size={16} /> Bulk Import Excel
            </button>
            <Link
              href="/admin/profiles/new"
              className="btn-primary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1.15rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={16} /> Add Profile
            </Link>
            <Link href="/admin" className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <LayoutDashboard size={14} /> Dashboard
            </Link>
          </div>
        </div>


        {/* Summary Overview Ribbon */}
        <div className="adm-summary-ribbon">
          <div className="adm-summary-card">
            <div className="adm-summary-icon">
              <Users size={20} />
            </div>
            <div className="adm-summary-data">
              <span>Total Directory</span>
              <strong>{stats.total}</strong>
            </div>
          </div>
          <div className="adm-summary-card">
            <div className="adm-summary-icon green">
              <ShieldCheck size={20} />
            </div>
            <div className="adm-summary-data">
              <span>Active Profiles</span>
              <strong>{stats.active}</strong>
            </div>
          </div>
          <div className="adm-summary-card">
            <div className="adm-summary-icon amber">
              <Clock size={20} />
            </div>
            <div className="adm-summary-data">
              <span>Pending Review</span>
              <strong>{stats.pending}</strong>
            </div>
          </div>
          <div className="adm-summary-card">
            <div className="adm-summary-icon rose">
              <Heart size={20} />
            </div>
            <div className="adm-summary-data">
              <span>Brides / Grooms</span>
              <strong>{stats.brides} / {stats.grooms}</strong>
            </div>
          </div>
        </div>

        {/* Top-Pinned Globally Visible Floating Toast */}
        {actionFeedback.text && (
          <div
            style={{
              position: 'fixed',
              top: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1.4rem',
              borderRadius: '999px',
              backgroundColor: actionFeedback.type === 'error' ? '#991b1b' : actionFeedback.type === 'warning' ? '#92400e' : '#14532d',
              color: '#ffffff',
              boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
              fontSize: '0.92rem',
              fontWeight: 500,
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              animation: 'fadeInDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {actionFeedback.type === 'error' ? (
              <AlertCircle size={18} color="#fca5a5" />
            ) : actionFeedback.type === 'warning' ? (
              <AlertCircle size={18} color="#fcd34d" />
            ) : (
              <CheckCircle2 size={18} color="#86efac" />
            )}
            <span>{actionFeedback.text}</span>
            <button
              type="button"
              onClick={() => setActionFeedback({ type: '', text: '' })}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                color: '#ffffff',
                marginLeft: '0.25rem',
              }}
              aria-label="Close notification"
            >
              <X size={14} />
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

        {/* Status filters */}
        <div className="adm-filters">
          {[['', 'All Status'], ['pending_approval', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([v, l]) => (
            <button key={v} type="button" className={`adm-chip ${filters.approvalStatus === v ? 'on' : ''}`} onClick={() => setFilter('approvalStatus', v)}>
              {l}
            </button>
          ))}
          <span style={{ display: 'inline-block', height: '18px', width: '1px', background: 'var(--a-line)', margin: '0 0.25rem' }} />
          {[['', 'All Genders'], ['Female', 'Brides (F)'], ['Male', 'Grooms (M)']].map(([v, l]) => (
            <button key={v} type="button" className={`adm-chip ${filters.gender === v ? 'on' : ''}`} onClick={() => setFilter('gender', v)}>
              {l}
            </button>
          ))}
          <select value={filters.profileStatus} onChange={(e) => setFilter('profileStatus', e.target.value)} aria-label="Activity filter">
            <option value="">Any activity</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={filters.source} onChange={(e) => setFilter('source', e.target.value)} aria-label="Origin filter">
            <option value="">Any origin</option>
            <option value="direct">Direct sign-up</option>
            <option value="broker">Assisted Entry</option>
          </select>
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
            <span className="admin-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <AlertCircle size={48} color="var(--danger)" />
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
            <span className="admin-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <Heart size={48} color="var(--primary)" />
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
              <Link href="/admin/profiles/new" className="btn-primary" style={{ padding: '0.65rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Plus size={16} /> Create First Profile
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="admin-table-container">
              <table className="admin-table" style={{ width: '100%', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ width: '38%' }}>Candidate Profile</th>
                    <th style={{ width: '26%' }}>Origin &amp; Account</th>
                    <th style={{ width: '22%' }}>Status &amp; Verification</th>
                    <th style={{ width: '14%', textAlign: 'right' }}>Actions</th>
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
                    const candidateCode = p.profileId || (p._id ? `TM-${p._id.slice(-6).toUpperCase()}` : 'TM-PROFILE');
                    const phoneDisplay = p.candidatePhone || p.contactDetails?.phone;

                    const formattedCreated = p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'N/A';

                    const photoCount =
                      Array.isArray(p.photos) && p.photos.length > 0
                        ? p.photos.length
                        : p.profilePhoto?.url
                        ? 1
                        : 0;

                    const isFemale = p.personalDetails?.gender === 'Female';
                    const isMale = p.personalDetails?.gender === 'Male';

                    return (
                      <tr key={p._id}>
                        {/* 1. Candidate Avatar & Primary Info */}
                        <td>
                          <div className="adm-profile-cell">
                            <div
                              className="adm-profile-avatar"
                              onClick={() => {
                                setSelectedPhotoProfile(p);
                                setIsPhotoModalOpen(true);
                              }}
                              title="Click to view or manage candidate photos"
                            >
                              {photoUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={photoUrl}
                                  alt={candidateDisplayName}
                                />
                              ) : (
                                <span>{candidateDisplayName.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="adm-profile-info">
                              <Link
                                href={`/admin/profiles/${p._id}`}
                                className="adm-profile-name"
                                title="Click to view candidate details"
                              >
                                {candidateDisplayName}
                              </Link>
                              <div className="adm-profile-meta">
                                <span className={`adm-tag-gender ${isFemale ? 'female' : isMale ? 'male' : ''}`}>
                                  {isFemale ? 'Bride' : isMale ? 'Groom' : (p.personalDetails?.gender || 'Profile')}
                                  {age ? ` • ${age} yrs` : ''}
                                </span>
                                <span className="adm-tag-id">#{candidateCode}</span>
                              </div>
                              {phoneDisplay && (
                                <span className="adm-profile-phone">
                                  <Phone size={11} /> {phoneDisplay}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Origin & Linked User Account */}
                        <td>
                          <div style={{ marginBottom: '0.35rem' }}>
                            {isBroker ? (
                              <span
                                className="badge"
                                style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
                              >
                                <Users size={11} /> Assisted Profile
                              </span>
                            ) : (
                              <span
                                className="badge"
                                style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
                              >
                                <User size={11} /> Direct Member
                              </span>
                            )}
                          </div>

                          {u ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--a-ink)' }}>{u.name}</div>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.73rem', color: 'var(--a-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Mail size={11} /> {u.email}
                              </span>
                            </div>
                          ) : p.candidateEmail ? (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.73rem', color: 'var(--a-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Mail size={11} /> {p.candidateEmail}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--a-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>
                              No login account
                            </span>
                          )}

                          <span style={{ fontSize: '0.7rem', color: 'var(--a-muted)', display: 'block', marginTop: '0.25rem' }}>
                            Added: {formattedCreated}
                          </span>
                        </td>

                        {/* 3. Status & Verification */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', alignItems: 'flex-start' }}>
                            <div>
                              {p.approvalStatus === 'approved' && (
                                <span className="badge badge-success" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Check size={11} /> Approved
                                </span>
                              )}
                              {p.approvalStatus === 'pending_approval' && (
                                <span className="badge badge-warning" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Clock size={11} /> Pending Review
                                </span>
                              )}
                              {p.approvalStatus === 'rejected' && (
                                <span
                                  className="badge"
                                  style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                  <X size={11} /> Rejected
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleStatus(p, candidateDisplayName)}
                              disabled={isProcessingThis}
                              className={`adm-act-btn ${p.profileStatus === 'inactive' ? 'success' : ''}`}
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.22rem 0.55rem',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                color: p.profileStatus === 'inactive' ? '#16a34a' : '#b45309',
                                borderColor: p.profileStatus === 'inactive' ? '#86efac' : '#fed7aa',
                                backgroundColor: p.profileStatus === 'inactive' ? '#f0fdf4' : '#fffbeb',
                              }}
                              title={`Click to ${p.profileStatus === 'inactive' ? 'activate' : 'deactivate'} profile`}
                            >
                              {p.profileStatus === 'inactive' ? (
                                <><Play size={11} /> Activate</>
                              ) : (
                                <><Pause size={11} /> Deactivate</>
                              )}
                            </button>

                            {u?.accountStatus === 'invited' && (
                              <span className="badge badge-warning" style={{ fontSize: '0.65rem', width: 'fit-content' }}>
                                Invite Pending
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Actions: Only Keep View Button */}
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Link
                              href={`/admin/profiles/${p._id}`}
                              className="adm-act-btn primary"
                              style={{
                                textDecoration: 'none',
                                padding: '0.42rem 0.95rem',
                                fontSize: '0.78rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                              }}
                              title="View full candidate details, edit options & invite management"
                            >
                              <Eye size={13} /> View
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

      {/* Admin Candidate Photo Management Modal */}
      <AdminPhotoManagerModal
        profile={selectedPhotoProfile}
        isOpen={isPhotoModalOpen}
        onClose={() => {
          setIsPhotoModalOpen(false);
          setSelectedPhotoProfile(null);
        }}
        onPhotosUpdated={handlePhotosUpdated}
      />

      <AdminProfileViewModal
        profile={viewProfile}
        onClose={() => setViewProfile(null)}
        onEdit={(p) => {
          setViewProfile(null);
          setEditProfile(p);
        }}
      />
      {editProfile && (
        <AdminProfileEditModal profile={editProfile} onClose={() => setEditProfile(null)} onSaved={handleProfileSaved} />
      )}

      {/* Admin Bulk Excel Candidate Import Modal */}
      <AdminBulkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportCompleted={handleImportCompleted}
      />

      {/* Custom Confirmation / Prompt Modal (Replaces browser window.confirm / window.prompt) */}
      {actionModal.open && (
        <div className="adm-modal-center" onClick={() => !processingId && setActionModal({ open: false, type: '', profileId: null })}>
          <div className="adm-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="adm-dialog-header">
              <h3>
                <ShieldCheck size={18} color="var(--a-brand)" /> {actionModal.title}
              </h3>
              <button
                type="button"
                className="adm-x"
                disabled={Boolean(processingId)}
                onClick={() => setActionModal({ open: false, type: '', profileId: null })}
              >
                <X size={16} />
              </button>
            </div>
            <div className="adm-dialog-body">
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--a-ink)', lineHeight: 1.5 }}>
                {actionModal.message}
              </p>
              {(actionModal.type === 'invite' || actionModal.type === 'reinvite') && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--a-ink)', marginBottom: '0.35rem' }}>
                    Recipient Email Address:
                  </label>
                  <input
                    type="email"
                    value={actionModal.inputVal}
                    onChange={(e) => setActionModal((prev) => ({ ...prev, inputVal: e.target.value }))}
                    placeholder="candidate@example.com"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--a-line)',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>
              )}
            </div>
            <div className="adm-dialog-footer">
              <button
                type="button"
                className="btn-secondary"
                disabled={Boolean(processingId)}
                onClick={() => setActionModal({ open: false, type: '', profileId: null })}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(processingId)}
                onClick={handleConfirmActionModal}
                style={{
                  background: actionModal.confirmColor || 'var(--a-brand)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.6rem 1.3rem',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {processingId ? 'Processing...' : actionModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
