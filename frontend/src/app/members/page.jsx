'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Hourglass } from 'lucide-react';
import { getMemberDirectoryApi, unlockMemberContactApi } from '@/lib/api';

function formatDateDisplay(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function MemberDirectoryPage() {
  const router = useRouter();

  // Directory Data, Credit Summary & Pagination State
  const [profiles, setProfiles] = useState([]);
  const [subscriptionAccess, setSubscriptionAccess] = useState(null);
  const [creditSummary, setCreditSummary] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    totalRecords: 0,
    totalPages: 1,
  });

  // Per-card Contact Unlock State (phone numbers never preloaded)
  const [unlockingByProfileId, setUnlockingByProfileId] = useState({});
  const [unlockedContactsByProfileId, setUnlockedContactsByProfileId] = useState({});
  const [unlockErrorByProfileId, setUnlockErrorByProfileId] = useState({});

  // Search & Filter Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);

  // Structured Filters Form State
  const [filterGender, setFilterGender] = useState('');
  const [filterMinAge, setFilterMinAge] = useState('');
  const [filterMaxAge, setFilterMaxAge] = useState('');
  const [filterMaritalStatus, setFilterMaritalStatus] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterEducation, setFilterEducation] = useState('');
  const [filterOccupation, setFilterOccupation] = useState('');

  // Active Applied Structured Filters
  const [activeFilters, setActiveFilters] = useState({
    gender: '',
    minAge: '',
    maxAge: '',
    maritalStatus: '',
    location: '',
    education: '',
    occupation: '',
  });

  // Status & Access Gating State
  const [loading, setLoading] = useState(true);
  const [accessDenialCode, setAccessDenialCode] = useState(null);
  const [accessDenialMessage, setAccessDenialMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const isFetchingRef = useRef(false);

  const fetchMembers = useCallback(
    async (targetPage, targetLimit, targetSearch, targetFilters) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setLoading(true);
      setErrorMessage('');

      try {
        const res = await getMemberDirectoryApi({
          page: targetPage,
          limit: targetLimit,
          search: targetSearch,
          gender: targetFilters.gender,
          minAge: targetFilters.minAge,
          maxAge: targetFilters.maxAge,
          maritalStatus: targetFilters.maritalStatus,
          location: targetFilters.location,
          education: targetFilters.education,
          occupation: targetFilters.occupation,
        });

        if (res.status === 401) {
          router.replace('/login');
          return;
        }

        if (res.status === 403) {
          setProfiles([]);
          setSubscriptionAccess(res.subscriptionAccess || null);
          setCreditSummary(null);
          setAccessDenialCode(res.code || 'NO_SUBSCRIPTION');
          setAccessDenialMessage(
            res.message || 'An active subscription is required to browse the member directory.'
          );
          setLoading(false);
          return;
        }

        if (res.success) {
          setAccessDenialCode(null);
          setAccessDenialMessage('');
          setProfiles(res.data || []);
          setSubscriptionAccess(res.subscriptionAccess || null);
          setCreditSummary(res.credits || res.subscriptionAccess?.credits || null);
          if (res.pagination) {
            setPagination(res.pagination);
          }
        } else {
          setErrorMessage(res.message || 'Failed to load member directory profiles.');
        }
      } catch (err) {
        setErrorMessage('Network connection error while loading member profiles.');
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    [router]
  );

  useEffect(() => {
    fetchMembers(page, limit, activeSearch, activeFilters);
  }, [page, limit, activeSearch, activeFilters, fetchMembers]);

  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    setActiveSearch(searchTerm.trim());
    setActiveFilters({
      gender: filterGender,
      minAge: filterMinAge,
      maxAge: filterMaxAge,
      maritalStatus: filterMaritalStatus,
      location: filterLocation.trim(),
      education: filterEducation.trim(),
      occupation: filterOccupation.trim(),
    });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setActiveSearch('');
    setFilterGender('');
    setFilterMinAge('');
    setFilterMaxAge('');
    setFilterMaritalStatus('');
    setFilterLocation('');
    setFilterEducation('');
    setFilterOccupation('');
    setActiveFilters({
      gender: '',
      minAge: '',
      maxAge: '',
      maritalStatus: '',
      location: '',
      education: '',
      occupation: '',
    });
    setPage(1);
  };

  const activeFilterCount = [
    activeSearch,
    activeFilters.gender,
    activeFilters.minAge || activeFilters.maxAge,
    activeFilters.maritalStatus,
    activeFilters.location,
    activeFilters.education,
    activeFilters.occupation,
  ].filter(Boolean).length;

  const handleUnlockContact = async (profileId) => {
    if (!profileId || unlockingByProfileId[profileId]) return;

    setUnlockingByProfileId((prev) => ({ ...prev, [profileId]: true }));
    setUnlockErrorByProfileId((prev) => {
      const next = { ...prev };
      delete next[profileId];
      return next;
    });

    try {
      const res = await unlockMemberContactApi(profileId);

      if (res.status === 401) {
        router.replace('/login');
        return;
      }

      if (res.success && res.data?.candidatePhone) {
        setUnlockedContactsByProfileId((prev) => ({
          ...prev,
          [profileId]: {
            candidatePhone: res.data.candidatePhone,
            alreadyUnlocked: Boolean(res.data.alreadyUnlocked),
            creditsCharged: Number(res.data.creditsCharged ?? 0),
          },
        }));

        if (res.data.credits) {
          setCreditSummary((prev) => ({
            ...(prev || {}),
            ...res.data.credits,
          }));
        }

        setProfiles((prev) =>
          prev.map((item) =>
            item.id === profileId ? { ...item, isContactUnlocked: true } : item
          )
        );
      } else {
        if (res.credits) {
          setCreditSummary((prev) => ({
            ...(prev || {}),
            ...res.credits,
          }));
        }

        let contextualMessage =
          res.message || 'Unable to unlock candidate contact number right now.';

        if (res.code === 'CREDITS_EXHAUSTED') {
          contextualMessage =
            res.message ||
            'You have used all 50 contact credits for your current monthly cycle.';
        } else if (res.code === 'PHONE_NOT_AVAILABLE') {
          contextualMessage =
            'Candidate phone number is not available for this profile. No credit was deducted.';
        } else if (
          res.code === 'GRACE_PERIOD_CONTACTS_LOCKED' ||
          res.code === 'GRACE_PERIOD_CONTACT_RESTRICTED'
        ) {
          contextualMessage =
            'Contact unlocking is disabled during your 7-day grace period. Please renew your subscription.';
        } else if (
          res.code === 'NO_SUBSCRIPTION' ||
          res.code === 'SUBSCRIPTION_EXPIRED' ||
          res.code === 'SUBSCRIPTION_REQUIRED'
        ) {
          contextualMessage =
            'An active subscription is required to view candidate contact numbers.';
        } else if (
          res.code === 'PROFILE_NOT_FOUND' ||
          res.code === 'PROFILE_NOT_ELIGIBLE'
        ) {
          contextualMessage =
            'This profile is no longer active or eligible for contact unlocking. No credit was deducted.';
        }

        setUnlockErrorByProfileId((prev) => ({
          ...prev,
          [profileId]: contextualMessage,
        }));
      }
    } catch (err) {
      setUnlockErrorByProfileId((prev) => ({
        ...prev,
        [profileId]: 'Network error while unlocking contact. Please try again.',
      }));
    } finally {
      setUnlockingByProfileId((prev) => ({ ...prev, [profileId]: false }));
    }
  };

  // 1. Subscription Access Denied Views (403)
  if (!loading && accessDenialCode) {
    const isExpired = accessDenialCode === 'SUBSCRIPTION_EXPIRED';

    return (
      <div className="admin-page">
        <div className="admin-container">
          <div className="admin-header-area">
            <div className="admin-title-group">
              <h1>Member Directory</h1>
              <p>Explore eligible matrimonial profiles with an active subscription.</p>
            </div>
            <Link href="/profile" className="btn-secondary">
              My Profile
            </Link>
          </div>

          <div className="admin-state-box">
            <span
              className="admin-state-icon"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              {isExpired ? (
                <Hourglass size={44} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Lock size={44} strokeWidth={1.75} aria-hidden="true" />
              )}
            </span>
            <h2 className="admin-state-title">
              {isExpired
                ? 'Subscription & Grace Period Expired'
                : 'Subscription Required to Browse Profiles'}
            </h2>
            <p className="admin-state-desc">
              {isExpired
                ? accessDenialMessage ||
                  'Your subscription and 7-day grace period have ended. Expired members cannot access the protected member directory. Please renew your subscription to continue browsing profiles.'
                : accessDenialMessage ||
                  'You must have an active 3-month or 6-month subscription before browsing matrimonial profiles in the member directory.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link href="/membership" className="btn-primary" style={{ width: 'auto' }}>
                View Membership Plans
              </Link>
              <Link href="/" className="btn-secondary">
                Return Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isActiveAccess = subscriptionAccess?.accessMode === 'active';
  const isGraceAccess = Boolean(subscriptionAccess?.inGracePeriod);

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Page Header */}
        <div className="admin-header-area">
          <div className="admin-title-group">
            <h1>Member Directory</h1>
            <p>Explore eligible matrimonial profiles. Candidate contact details remain private.</p>
          </div>
          <Link href="/profile" className="btn-secondary">
            Manage My Profile
          </Link>
        </div>

        {/* Active Subscription Monthly Contact Credit Cycle Banner */}
        {isActiveAccess && creditSummary && (
          <div className="credit-summary-banner" role="region" aria-label="Monthly Contact Credits">
            <div className="credit-summary-left">
              <div className="credit-summary-title">
                <span>🎟️ Monthly Contact Credits</span>
                {creditSummary.cycleNumber && (
                  <span className="badge badge-info">
                    Cycle {creditSummary.cycleNumber}
                    {creditSummary.totalCycles ? ` of ${creditSummary.totalCycles}` : ''}
                  </span>
                )}
              </div>
              <div className="credit-summary-meta">
                {creditSummary.cycleStart && creditSummary.cycleEnd ? (
                  <>
                    Current cycle: <strong>{formatDateDisplay(creditSummary.cycleStart)}</strong> to{' '}
                    <strong>{formatDateDisplay(creditSummary.cycleEnd)}</strong> • Unused credits do
                    not carry forward
                  </>
                ) : (
                  '50 contact credits allocated per monthly subscription cycle.'
                )}
              </div>
            </div>

            <div className="credit-summary-stats">
              <div className="credit-stat-pill credit-stat-pill-highlight">
                <span className="credit-stat-number">{creditSummary.creditsRemaining ?? 0}</span>
                <span className="credit-stat-label">
                  / {creditSummary.creditsAllocated ?? 50} Remaining
                </span>
              </div>
              <div className="credit-stat-pill">
                <span className="credit-stat-number" style={{ color: '#334155' }}>
                  {creditSummary.creditsUsed ?? 0}
                </span>
                <span className="credit-stat-label">Used This Cycle</span>
              </div>
            </div>
          </div>
        )}

        {/* 7-Day Grace Period Notice Banner */}
        {isGraceAccess && (
          <div className="alert alert-warning-banner" role="status">
            <span className="alert-icon">⚠️</span>
            <div>
              <strong>7-Day Grace Period Active:</strong> Your subscription term has ended, and you
              are currently browsing within your 7-day grace period
              {subscriptionAccess.gracePeriodEndDate
                ? ` (ends ${formatDateDisplay(subscriptionAccess.gracePeriodEndDate)})`
                : ''}
              . Profile browsing is permitted during the grace period, but contact unlocking is
              disabled until you renew your subscription.
            </div>
          </div>
        )}

        {/* Structured Search & Filter Controls */}
        <div className="directory-filter-section" role="search" aria-label="Member Directory Filters">
          <div className="directory-filter-header">
            <div className="directory-filter-title">
              <span>🔍 Search & Filter Profiles</span>
              {activeFilterCount > 0 && (
                <span className="directory-filter-badge">
                  {activeFilterCount} {activeFilterCount === 1 ? 'filter active' : 'filters active'}
                </span>
              )}
            </div>

            <div className="pagination-controls">
              <label htmlFor="directory-limit-select" style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Profiles per page:
              </label>
              <select
                id="directory-limit-select"
                className="limit-select"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                disabled={loading}
              >
                <option value={6}>6</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
              </select>
            </div>
          </div>

          <form onSubmit={handleApplyFilters}>
            <div className="directory-filter-grid">
              {/* Keyword Search */}
              <div className="directory-filter-field" style={{ gridColumn: 'span 1' }}>
                <label htmlFor="filter-search" className="directory-filter-label">
                  Keyword Search
                </label>
                <input
                  id="filter-search"
                  type="text"
                  className="directory-filter-input"
                  placeholder="Name, city, role, company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* Gender Filter */}
              <div className="directory-filter-field">
                <label htmlFor="filter-gender" className="directory-filter-label">
                  Gender
                </label>
                <select
                  id="filter-gender"
                  className="directory-filter-select"
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value)}
                >
                  <option value="">All Genders</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Age Range Filter */}
              <div className="directory-filter-field">
                <label className="directory-filter-label">Age Range (Years)</label>
                <div className="directory-filter-range">
                  <input
                    type="number"
                    className="directory-filter-input"
                    placeholder="Min"
                    min="18"
                    max="100"
                    value={filterMinAge}
                    onChange={(e) => setFilterMinAge(e.target.value)}
                    aria-label="Minimum candidate age"
                  />
                  <span className="directory-filter-range-sep">to</span>
                  <input
                    type="number"
                    className="directory-filter-input"
                    placeholder="Max"
                    min="18"
                    max="100"
                    value={filterMaxAge}
                    onChange={(e) => setFilterMaxAge(e.target.value)}
                    aria-label="Maximum candidate age"
                  />
                </div>
              </div>

              {/* Marital Status Filter */}
              <div className="directory-filter-field">
                <label htmlFor="filter-marital-status" className="directory-filter-label">
                  Marital Status
                </label>
                <select
                  id="filter-marital-status"
                  className="directory-filter-select"
                  value={filterMaritalStatus}
                  onChange={(e) => setFilterMaritalStatus(e.target.value)}
                >
                  <option value="">All Marital Statuses</option>
                  <option value="Never Married">Never Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Awaiting Divorce">Awaiting Divorce</option>
                </select>
              </div>

              {/* Location Filter */}
              <div className="directory-filter-field">
                <label htmlFor="filter-location" className="directory-filter-label">
                  Location / City
                </label>
                <input
                  id="filter-location"
                  type="text"
                  className="directory-filter-input"
                  placeholder="e.g. Chennai, Bangalore"
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* Education Filter */}
              <div className="directory-filter-field">
                <label htmlFor="filter-education" className="directory-filter-label">
                  Education Qualification
                </label>
                <input
                  id="filter-education"
                  type="text"
                  className="directory-filter-input"
                  placeholder="e.g. B.Tech, M.S., MBA"
                  value={filterEducation}
                  onChange={(e) => setFilterEducation(e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* Occupation Filter */}
              <div className="directory-filter-field">
                <label htmlFor="filter-occupation" className="directory-filter-label">
                  Occupation / Profession
                </label>
                <input
                  id="filter-occupation"
                  type="text"
                  className="directory-filter-input"
                  placeholder="e.g. Software, Banking, Doctor"
                  value={filterOccupation}
                  onChange={(e) => setFilterOccupation(e.target.value)}
                  maxLength={100}
                />
              </div>
            </div>

            <div className="directory-filter-actions">
              <button type="submit" className="btn-filter-apply" disabled={loading}>
                Apply Filters
              </button>
              <button
                type="button"
                className="btn-filter-reset"
                onClick={handleResetFilters}
                disabled={loading}
              >
                Reset Filters
              </button>
            </div>
          </form>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="alert alert-danger" role="alert">
            <span className="alert-icon">⚠️</span>
            <div style={{ flex: 1 }}>
              <strong>Unable to Load Profiles:</strong> {errorMessage}
            </div>
            <button
              type="button"
              className="btn-reset"
              onClick={() => fetchMembers(page, limit, activeSearch, activeFilters)}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="admin-state-box">
            <span className="admin-state-icon">⏳</span>
            <h2 className="admin-state-title">Loading Member Profiles...</h2>
            <p className="admin-state-desc">
              Fetching eligible matrimonial profiles for your directory view.
            </p>
          </div>
        )}

        {/* Empty / No-Results State */}
        {!loading && !errorMessage && profiles.length === 0 && (
          <div className="admin-state-box">
            <span className="admin-state-icon">🔍</span>
            <h2 className="admin-state-title">
              {activeFilterCount > 0 ? 'No Matching Profiles Found' : 'No Eligible Profiles Available Yet'}
            </h2>
            <p className="admin-state-desc">
              {activeFilterCount > 0
                ? 'No active matrimonial profiles matched your search and filter criteria. Try adjusting your age range, location, or reset filters to view all profiles.'
                : 'There are currently no other active matrimonial profiles to display in the directory.'}
            </p>
            {activeFilterCount > 0 && (
              <button type="button" className="btn-secondary" onClick={handleResetFilters}>
                Reset All Filters
              </button>
            )}
          </div>
        )}

        {/* Directory Profile Cards Grid */}
        {!loading && !errorMessage && profiles.length > 0 && (
          <>
            <div className="member-directory-grid">
              {profiles.map((profile) => {
                const pDetails = profile.personalDetails || {};
                const eduDetails = profile.educationAndProfession || {};
                const famDetails = profile.familyDetails || {};
                const prefDetails = profile.partnerPreferences || {};
                const prefAge = prefDetails.preferredAgeRange || {};

                // Safe candidate display name with neutral fallback
                const displayName = profile.candidateName || 'Member Profile';
                const initialLetter = displayName.charAt(0).toUpperCase();

                const isUnlocking = Boolean(unlockingByProfileId[profile.id]);
                const unlockedInfo = unlockedContactsByProfileId[profile.id] || null;
                const unlockError = unlockErrorByProfileId[profile.id] || '';
                const isAlreadyUnlocked = Boolean(profile.isContactUnlocked || unlockedInfo);
                const creditsExhausted =
                  !isAlreadyUnlocked &&
                  creditSummary &&
                  typeof creditSummary.creditsRemaining === 'number' &&
                  creditSummary.creditsRemaining <= 0;

                return (
                  <article key={profile.id} className="member-card">
                    {/* Card Header: Photo + Primary Identity */}
                    <div className="member-card-header">
                      <div className="member-card-avatar">
                        {profile.profilePhotoUrl ? (
                          <img
                            src={profile.profilePhotoUrl}
                            alt={`${displayName} profile photo`}
                            className="member-card-avatar-img"
                          />
                        ) : (
                          <span aria-hidden="true">{initialLetter}</span>
                        )}
                      </div>

                      <div className="member-card-heading">
                        <div className="member-card-badges">
                          <span
                            className={`badge ${
                              profile.source === 'broker' ? 'badge-info' : 'badge-success'
                            }`}
                          >
                            {profile.source === 'broker' ? 'Broker Profile' : 'Direct Profile'}
                          </span>
                          {pDetails.gender && (
                            <span className="badge badge-neutral">{pDetails.gender}</span>
                          )}
                        </div>

                        <h2 className="member-card-name">{displayName}</h2>

                        <p className="member-card-submeta">
                          {pDetails.age !== null && pDetails.age !== undefined
                            ? `${pDetails.age} yrs`
                            : 'Age not specified'}
                          {pDetails.height ? ` • ${pDetails.height} cm` : ''}
                          {pDetails.maritalStatus ? ` • ${pDetails.maritalStatus}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Personal & Education Details */}
                    <div className="member-card-body">
                      <div className="member-detail-row">
                        <span className="member-detail-label">Location:</span>
                        <span className="member-detail-value">
                          {pDetails.location || 'Not specified'}
                        </span>
                      </div>

                      <div className="member-detail-row">
                        <span className="member-detail-label">Mother Tongue:</span>
                        <span className="member-detail-value">
                          {pDetails.motherTongue || 'Not specified'}
                        </span>
                      </div>

                      {famDetails.familyLocation && (
                        <div className="member-detail-row">
                          <span className="member-detail-label">Native Place:</span>
                          <span className="member-detail-value">{famDetails.familyLocation}</span>
                        </div>
                      )}

                      <div className="member-detail-row">
                        <span className="member-detail-label">Education:</span>
                        <span className="member-detail-value">
                          {eduDetails.educationalQualification || 'Not specified'}
                        </span>
                      </div>

                      <div className="member-detail-row">
                        <span className="member-detail-label">Occupation:</span>
                        <span className="member-detail-value">
                          {eduDetails.occupation
                            ? `${eduDetails.occupation}${
                                eduDetails.company ? ` at ${eduDetails.company}` : ''
                              }`
                            : 'Not specified'}
                        </span>
                      </div>

                      {eduDetails.workLocation && (
                        <div className="member-detail-row">
                          <span className="member-detail-label">Work Location:</span>
                          <span className="member-detail-value">{eduDetails.workLocation}</span>
                        </div>
                      )}

                      {eduDetails.income && (
                        <div className="member-detail-row">
                          <span className="member-detail-label">Annual Income:</span>
                          <span className="member-detail-value">{eduDetails.income}</span>
                        </div>
                      )}

                      {(prefAge.min ||
                        prefAge.max ||
                        prefDetails.preferredLocation ||
                        prefDetails.educationPreference) && (
                        <div className="member-detail-block">
                          <span className="member-detail-label">Partner Preferences:</span>
                          <p className="member-detail-text">
                            {[
                              prefAge.min || prefAge.max
                                ? `Age: ${prefAge.min || 18}–${prefAge.max || ''} yrs`
                                : null,
                              prefDetails.preferredLocation
                                ? `Location: ${prefDetails.preferredLocation}`
                                : null,
                              prefDetails.educationPreference
                                ? `Education: ${prefDetails.educationPreference}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Contact Action Footer */}
                    <div className="member-card-footer">
                      <Link
                        href={`/members/${profile.id}`}
                        className="btn-view-profile"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          padding: '0.55rem 1rem',
                          borderRadius: '6px',
                          backgroundColor: '#FBF8F1',
                          color: '#0B5D52',
                          border: '1.5px solid #0B5D52',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                          marginBottom: '0.25rem',
                        }}
                      >
                        View Full Profile →
                      </Link>

                      {unlockedInfo ? (
                        <div className="contact-unlocked-box" role="status" aria-live="polite">
                          <span className="contact-unlocked-phone">
                            📞 {unlockedInfo.candidatePhone}
                          </span>
                          <span className="contact-unlocked-sub">
                            {unlockedInfo.alreadyUnlocked
                              ? 'Previously unlocked • 0 credits deducted'
                              : 'Contact unlocked • 1 credit deducted'}
                          </span>
                        </div>
                      ) : isActiveAccess ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUnlockContact(profile.id)}
                            disabled={isUnlocking || creditsExhausted}
                            className={`btn-unlock-contact ${
                              isAlreadyUnlocked ? 'btn-unlock-contact-secondary' : ''
                            }`}
                          >
                            {isUnlocking
                              ? 'Unlocking Contact...'
                              : isAlreadyUnlocked
                              ? '📞 View Unlocked Phone Number (Free)'
                              : creditsExhausted
                              ? 'Monthly Contact Credits Exhausted (0 Left)'
                              : '📞 View Contact Number (1 Credit)'}
                          </button>

                          {unlockError && (
                            <div
                              className="contact-unlock-feedback contact-unlock-feedback-error"
                              role="alert"
                            >
                              {unlockError}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="contact-locked-pill">
                          🔒 Contact unlocking is disabled during your 7-day grace period. Renew
                          your subscription to view candidate phone numbers.
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination Footer */}
            <div className="pagination-bar">
              <div>
                Showing page <strong>{pagination.page}</strong> of{' '}
                <strong>{pagination.totalPages}</strong> ({pagination.totalRecords} eligible{' '}
                {pagination.totalRecords === 1 ? 'profile' : 'profiles'})
              </div>

              <div className="pagination-controls">
                <button
                  type="button"
                  className="btn-page"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={loading || pagination.page <= 1}
                >
                  ← Previous
                </button>
                <span style={{ padding: '0 0.5rem', fontWeight: 600, color: '#334155' }}>
                  Page {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  className="btn-page"
                  onClick={() =>
                    setPage((prev) => Math.min(pagination.totalPages, prev + 1))
                  }
                  disabled={loading || pagination.page >= pagination.totalPages}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
