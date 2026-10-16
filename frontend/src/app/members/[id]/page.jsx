'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  Lock,
  Hourglass,
  ArrowLeft,
  User,
  GraduationCap,
  Briefcase,
  Heart,
  MapPin,
  Calendar,
  Phone,
} from 'lucide-react';
import { getMemberCandidateDetailsApi, unlockMemberContactApi } from '@/lib/api';

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

export default function CandidateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params?.id ? String(params.id) : '';

  const [profile, setProfile] = useState(null);
  const [subscriptionAccess, setSubscriptionAccess] = useState(null);
  const [creditSummary, setCreditSummary] = useState(null);

  // Contact Unlock State
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockedContact, setUnlockedContact] = useState(null);
  const [unlockError, setUnlockError] = useState('');

  // Page Lifecycle State
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSelfProfile, setIsSelfProfile] = useState(false);
  const [accessDenialCode, setAccessDenialCode] = useState(null);
  const [accessDenialMessage, setAccessDenialMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchProfileDetails = useCallback(async () => {
    if (!profileId) return;

    setLoading(true);
    setErrorMessage('');
    setNotFound(false);
    setIsSelfProfile(false);
    setAccessDenialCode(null);

    try {
      const res = await getMemberCandidateDetailsApi(profileId);

      if (res.status === 401) {
        router.replace('/login');
        return;
      }

      if (res.status === 403) {
        setProfile(null);
        setSubscriptionAccess(res.subscriptionAccess || null);
        setCreditSummary(null);
        setAccessDenialCode(res.code || 'NO_SUBSCRIPTION');
        setAccessDenialMessage(
          res.message || 'An active subscription is required to browse member profiles.'
        );
        setLoading(false);
        return;
      }

      if (res.status === 400 && res.code === 'SELF_PROFILE_VIEW_DENIED') {
        setIsSelfProfile(true);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (res.status === 404 || !res.success) {
        if (res.status === 404 || res.code === 'PROFILE_NOT_FOUND' || res.code === 'PROFILE_NOT_AVAILABLE') {
          setNotFound(true);
        } else {
          setErrorMessage(res.message || 'Unable to load candidate details.');
        }
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(res.data || null);
      setSubscriptionAccess(res.subscriptionAccess || null);
      setCreditSummary(res.credits || res.subscriptionAccess?.credits || null);
    } catch (err) {
      setErrorMessage('Network connection error while loading candidate details.');
    } finally {
      setLoading(false);
    }
  }, [profileId, router]);

  useEffect(() => {
    fetchProfileDetails();
  }, [fetchProfileDetails]);

  const handleUnlockContact = async () => {
    if (!profileId || isUnlocking) return;

    setIsUnlocking(true);
    setUnlockError('');

    try {
      const res = await unlockMemberContactApi(profileId);

      if (res.success && res.data) {
        setUnlockedContact({
          candidatePhone: res.data.candidatePhone,
          alreadyUnlocked: Boolean(res.data.alreadyUnlocked),
          creditsCharged: res.data.creditsCharged,
          unlockedAt: res.data.unlockedAt,
        });

        if (res.data.credits) {
          setCreditSummary(res.data.credits);
        }
      } else {
        setUnlockError(res.message || 'Failed to unlock contact details.');
      }
    } catch (err) {
      setUnlockError('Network error while unlocking contact details.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const isActiveAccess = Boolean(
    subscriptionAccess &&
      subscriptionAccess.accessMode === 'active' &&
      !subscriptionAccess.inGracePeriod
  );

  const isInGracePeriod = Boolean(subscriptionAccess?.inGracePeriod);

  const isAlreadyUnlocked = Boolean(
    profile?.isContactUnlocked || unlockedContact
  );

  const creditsExhausted =
    !isAlreadyUnlocked &&
    creditSummary &&
    typeof creditSummary.creditsRemaining === 'number' &&
    creditSummary.creditsRemaining <= 0;

  // 1. Subscription Required / Paywall State
  if (!loading && accessDenialCode) {
    return (
      <div className="directory-container" style={{ padding: '2rem 1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href="/members"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#0B5D52',
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} /> Back to Member Directory
          </Link>
        </div>

        <div className="admin-state-box" style={{ padding: '3rem 2rem', textAlign: 'center', backgroundColor: '#FBF8F1', borderRadius: '12px', border: '1px solid #C5A15B' }}>
          <span className="admin-state-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0B5D52', marginBottom: '1rem' }}>
            <Lock size={44} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 className="admin-state-title" style={{ color: '#07463F', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Explore eligible matrimonial profiles with an active subscription.
          </h2>
          <p className="admin-state-desc" style={{ color: '#343434', maxWidth: '580px', margin: '0 auto 1.75rem', lineHeight: 1.6 }}>
            {accessDenialMessage ||
              'An active membership subscription is required to browse candidate profiles and view full details.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/membership"
              className="btn-primary"
              style={{
                backgroundColor: '#0B5D52',
                color: '#ffffff',
                padding: '0.75rem 1.75rem',
                borderRadius: '6px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              View Membership Plans
            </Link>
            <Link
              href="/"
              className="btn-secondary"
              style={{
                backgroundColor: '#ffffff',
                color: '#343434',
                border: '1px solid #cbd5e1',
                padding: '0.75rem 1.75rem',
                borderRadius: '6px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Self Profile View Attempt
  if (!loading && isSelfProfile) {
    return (
      <div className="directory-container" style={{ padding: '2rem 1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href="/members"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#0B5D52',
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} /> Back to Member Directory
          </Link>
        </div>

        <div className="admin-state-box" style={{ padding: '3rem 2rem', textAlign: 'center', backgroundColor: '#FBF8F1', borderRadius: '12px', border: '1px solid #C5A15B' }}>
          <span className="admin-state-icon" style={{ fontSize: '2.5rem', marginBottom: '1rem', display: 'inline-block' }}>
            👤
          </span>
          <h2 className="admin-state-title" style={{ color: '#07463F', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            This is Your Own Profile
          </h2>
          <p className="admin-state-desc" style={{ color: '#343434', maxWidth: '540px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
            You cannot view your own matrimonial profile through the candidate directory view. To review or update your profile details and photograph, please visit My Profile.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/profile"
              className="btn-primary"
              style={{
                backgroundColor: '#0B5D52',
                color: '#ffffff',
                padding: '0.7rem 1.5rem',
                borderRadius: '6px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Go to My Profile
            </Link>
            <Link
              href="/members"
              className="btn-secondary"
              style={{
                backgroundColor: '#ffffff',
                color: '#343434',
                border: '1px solid #cbd5e1',
                padding: '0.7rem 1.5rem',
                borderRadius: '6px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Back to Member Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Profile Not Found / Inactive
  if (!loading && notFound) {
    return (
      <div className="directory-container" style={{ padding: '2rem 1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href="/members"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#0B5D52',
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} /> Back to Member Directory
          </Link>
        </div>

        <div className="admin-state-box" style={{ padding: '3rem 2rem', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span className="admin-state-icon" style={{ fontSize: '2.5rem', marginBottom: '1rem', display: 'inline-block' }}>
            🔍
          </span>
          <h2 className="admin-state-title" style={{ color: '#07463F', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Candidate Profile Not Found or Unavailable
          </h2>
          <p className="admin-state-desc" style={{ color: '#64748b', maxWidth: '540px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
            The requested matrimonial profile could not be found, or is no longer actively available in the member directory.
          </p>
          <Link
            href="/members"
            className="btn-secondary"
            style={{
              backgroundColor: '#0B5D52',
              color: '#ffffff',
              padding: '0.7rem 1.5rem',
              borderRadius: '6px',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Return to Directory
          </Link>
        </div>
      </div>
    );
  }

  // 4. Loading State
  if (loading) {
    return (
      <div className="directory-container" style={{ padding: '3rem 1.5rem', maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <div className="admin-state-box" style={{ padding: '3rem 2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span className="admin-state-icon" style={{ fontSize: '2.5rem', marginBottom: '1rem', display: 'inline-block' }}>
            ⏳
          </span>
          <h2 className="admin-state-title" style={{ color: '#07463F', fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Loading Candidate Details...
          </h2>
          <p className="admin-state-desc" style={{ color: '#64748b' }}>
            Retrieving candidate profile information and contact status.
          </p>
        </div>
      </div>
    );
  }

  // 5. Generic Error State
  if (errorMessage && !profile) {
    return (
      <div className="directory-container" style={{ padding: '2rem 1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href="/members"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#0B5D52',
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} /> Back to Member Directory
          </Link>
        </div>

        <div className="alert alert-danger" style={{ padding: '1.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <strong>Unable to Load Profile:</strong> {errorMessage}
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={fetchProfileDetails}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fecaca',
              padding: '0.4rem 0.9rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const pDetails = profile.personalDetails || {};
  const eduDetails = profile.educationAndProfession || {};
  const famDetails = profile.familyDetails || {};
  const prefDetails = profile.partnerPreferences || {};
  const prefAge = prefDetails.preferredAgeRange || {};

  const displayName = profile.candidateName || 'Member Profile';
  const initialLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="directory-container" style={{ padding: '2rem 1.5rem 4rem', maxWidth: '1000px', margin: '0 auto', color: '#343434' }}>
      {/* Top Navigation */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          href="/members"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: '#0B5D52',
            fontWeight: 600,
            fontSize: '0.92rem',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={18} /> Back to Member Directory
        </Link>

        {creditSummary && typeof creditSummary.creditsRemaining === 'number' && (
          <div
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#0B5D52',
              backgroundColor: '#FBF8F1',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #C5A15B',
            }}
          >
            Contact Credits: {creditSummary.creditsRemaining} / {creditSummary.creditsAllocated || 50} Remaining
          </div>
        )}
      </div>

      {/* Grace Period Notification Banner */}
      {isInGracePeriod && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.88rem',
            color: '#92400e',
          }}
        >
          <Hourglass size={20} color="#b45309" style={{ flexShrink: 0 }} />
          <div>
            <strong>7-Day Grace Period Active:</strong> You are browsing within your subscription grace period
            {subscriptionAccess.gracePeriodEndDate ? ` (ends ${formatDateDisplay(subscriptionAccess.gracePeriodEndDate)})` : ''}.
            Profile details are visible, but contact unlocking is disabled until you renew your subscription.
          </div>
        </div>
      )}

      {/* Candidate Profile Hero Header */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #0B5D52 0%, #07463F 100%)',
            padding: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.75rem',
            color: '#ffffff',
            flexWrap: 'wrap',
          }}
        >
          {/* Avatar / Photo */}
          <div
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              backgroundColor: '#FBF8F1',
              color: '#0B5D52',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              fontWeight: 700,
              border: '4px solid #C5A15B',
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
            }}
          >
            {profile.profilePhotoUrl ? (
              <img
                src={profile.profilePhotoUrl}
                alt={`${displayName} profile photo`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span>{initialLetter}</span>
            )}
          </div>

          {/* Heading Info */}
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  backgroundColor: profile.source === 'broker' ? '#dbeafe' : '#dcfce7',
                  color: profile.source === 'broker' ? '#1e40af' : '#166534',
                }}
              >
                {profile.source === 'broker' ? 'Broker Profile' : 'Direct Member'}
              </span>
              {pDetails.gender && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                  }}
                >
                  {pDetails.gender}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.35rem', color: '#ffffff' }}>
              {displayName}
            </h1>

            <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {pDetails.age !== null && pDetails.age !== undefined ? `${pDetails.age} yrs` : 'Age not specified'}
              {pDetails.height ? ` • ${pDetails.height} cm` : ''}
              {pDetails.maritalStatus ? ` • ${pDetails.maritalStatus}` : ''}
              {pDetails.location ? ` • ${pDetails.location}` : ''}
            </p>
          </div>
        </div>

        {/* Contact Unlock Action Panel */}
        <div
          style={{
            padding: '1.25rem 2rem',
            backgroundColor: '#FBF8F1',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#07463F', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Phone size={16} color="#0B5D52" /> Candidate Contact Details
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
              {unlockedContact
                ? 'Contact information is currently visible.'
                : isAlreadyUnlocked
                ? 'You have already unlocked this contact. Retrieving is free (0 credits).'
                : '1 contact credit is deducted on first unlock. Repeat views are completely free.'}
            </div>
          </div>

          <div>
            {unlockedContact ? (
              <div
                style={{
                  backgroundColor: '#ecfdf5',
                  border: '1.5px solid #a7f3d0',
                  borderRadius: '8px',
                  padding: '0.65rem 1.25rem',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: '#065f46',
                    letterSpacing: '0.03em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Phone size={18} strokeWidth={2.2} /> {unlockedContact.candidatePhone}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '0.15rem' }}>
                  {unlockedContact.alreadyUnlocked
                    ? 'Previously unlocked • 0 credits deducted'
                    : 'Contact unlocked • 1 credit deducted'}
                </div>
              </div>
            ) : isActiveAccess ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={handleUnlockContact}
                  disabled={isUnlocking || creditsExhausted}
                  style={{
                    backgroundColor: isAlreadyUnlocked ? '#ffffff' : '#0B5D52',
                    color: isAlreadyUnlocked ? '#0B5D52' : '#ffffff',
                    border: isAlreadyUnlocked ? '1.5px solid #0B5D52' : 'none',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: creditsExhausted ? 'not-allowed' : 'pointer',
                    opacity: creditsExhausted || isUnlocking ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Phone size={15} />
                  {isUnlocking
                    ? 'Unlocking Contact...'
                    : isAlreadyUnlocked
                    ? 'View Unlocked Phone Number (Free)'
                    : creditsExhausted
                    ? 'Monthly Contact Credits Exhausted'
                    : 'View Contact Number (1 Credit)'}
                </button>

                {unlockError && (
                  <div style={{ fontSize: '0.78rem', color: '#991b1b', backgroundColor: '#fef2f2', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #fecaca' }}>
                    {unlockError}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#92400e',
                  backgroundColor: '#fef3c7',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '6px',
                  border: '1px solid #fde68a',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Lock size={14} /> Contact unlocking disabled during grace period
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Profile Sections Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Section 1: Personal Details */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem', borderBottom: '2px solid #FBF8F1', paddingBottom: '0.6rem' }}>
            <User size={18} color="#0B5D52" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#07463F' }}>
              Personal Details
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div className="member-detail-row">
              <span className="member-detail-label">Gender:</span>
              <span className="member-detail-value">{pDetails.gender || 'Not specified'}</span>
            </div>
            <div className="member-detail-row">
              <span className="member-detail-label">Age:</span>
              <span className="member-detail-value">
                {pDetails.age !== null && pDetails.age !== undefined ? `${pDetails.age} years` : 'Not specified'}
              </span>
            </div>
            {pDetails.dateOfBirth && (
              <div className="member-detail-row">
                <span className="member-detail-label">Date of Birth:</span>
                <span className="member-detail-value">{formatDateDisplay(pDetails.dateOfBirth)}</span>
              </div>
            )}
            <div className="member-detail-row">
              <span className="member-detail-label">Height:</span>
              <span className="member-detail-value">{pDetails.height ? `${pDetails.height} cm` : 'Not specified'}</span>
            </div>
            <div className="member-detail-row">
              <span className="member-detail-label">Marital Status:</span>
              <span className="member-detail-value">{pDetails.maritalStatus || 'Not specified'}</span>
            </div>
            <div className="member-detail-row">
              <span className="member-detail-label">Mother Tongue:</span>
              <span className="member-detail-value">{pDetails.motherTongue || 'Not specified'}</span>
            </div>
            <div className="member-detail-row">
              <span className="member-detail-label">Current Location:</span>
              <span className="member-detail-value">{pDetails.location || 'Not specified'}</span>
            </div>
          </div>
        </section>

        {/* Section 2: Education & Career */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem', borderBottom: '2px solid #FBF8F1', paddingBottom: '0.6rem' }}>
            <GraduationCap size={18} color="#0B5D52" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#07463F' }}>
              Education & Career
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div className="member-detail-row">
              <span className="member-detail-label">Educational Qualification:</span>
              <span className="member-detail-value">{eduDetails.educationalQualification || 'Not specified'}</span>
            </div>
            <div className="member-detail-row">
              <span className="member-detail-label">Occupation / Profession:</span>
              <span className="member-detail-value">{eduDetails.occupation || 'Not specified'}</span>
            </div>
            {eduDetails.company && (
              <div className="member-detail-row">
                <span className="member-detail-label">Company / Organization:</span>
                <span className="member-detail-value">{eduDetails.company}</span>
              </div>
            )}
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
          </div>
        </section>

        {/* Section 3: Family Details */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem', borderBottom: '2px solid #FBF8F1', paddingBottom: '0.6rem' }}>
            <MapPin size={18} color="#0B5D52" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#07463F' }}>
              Family Details
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {famDetails.familyLocation && (
              <div className="member-detail-row">
                <span className="member-detail-label">Native Place / Location:</span>
                <span className="member-detail-value">{famDetails.familyLocation}</span>
              </div>
            )}
            <div className="member-detail-block">
              <span className="member-detail-label">Family Background:</span>
              <p className="member-detail-text" style={{ margin: '0.2rem 0 0' }}>
                {famDetails.familyInformation || 'No family information provided.'}
              </p>
            </div>
            {famDetails.parentInformation && (
              <div className="member-detail-block">
                <span className="member-detail-label">Parent Details:</span>
                <p className="member-detail-text" style={{ margin: '0.2rem 0 0' }}>
                  {famDetails.parentInformation}
                </p>
              </div>
            )}
            {famDetails.siblingInformation && (
              <div className="member-detail-block">
                <span className="member-detail-label">Sibling Details:</span>
                <p className="member-detail-text" style={{ margin: '0.2rem 0 0' }}>
                  {famDetails.siblingInformation}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Partner Preferences */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem', borderBottom: '2px solid #FBF8F1', paddingBottom: '0.6rem' }}>
            <Heart size={18} color="#0B5D52" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#07463F' }}>
              Partner Preferences
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {(prefAge.min || prefAge.max) && (
              <div className="member-detail-row">
                <span className="member-detail-label">Preferred Age Range:</span>
                <span className="member-detail-value">
                  {prefAge.min || 18} to {prefAge.max || 100} years
                </span>
              </div>
            )}
            {prefDetails.preferredLocation && (
              <div className="member-detail-row">
                <span className="member-detail-label">Preferred Location:</span>
                <span className="member-detail-value">{prefDetails.preferredLocation}</span>
              </div>
            )}
            {prefDetails.educationPreference && (
              <div className="member-detail-row">
                <span className="member-detail-label">Education Preference:</span>
                <span className="member-detail-value">{prefDetails.educationPreference}</span>
              </div>
            )}
            {prefDetails.occupationPreference && (
              <div className="member-detail-row">
                <span className="member-detail-label">Occupation Preference:</span>
                <span className="member-detail-value">{prefDetails.occupationPreference}</span>
              </div>
            )}
            {prefDetails.otherPreferences && (
              <div className="member-detail-block">
                <span className="member-detail-label">Other Expectations / Notes:</span>
                <p className="member-detail-text" style={{ margin: '0.2rem 0 0' }}>
                  {prefDetails.otherPreferences}
                </p>
              </div>
            )}
            {!prefAge.min &&
              !prefAge.max &&
              !prefDetails.preferredLocation &&
              !prefDetails.educationPreference &&
              !prefDetails.occupationPreference &&
              !prefDetails.otherPreferences && (
                <p className="member-detail-text" style={{ margin: '0.2rem 0 0', color: '#64748b' }}>
                  No specific partner preferences listed.
                </p>
              )}
          </div>
        </section>
      </div>

      {/* Bottom Back Button */}
      <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
        <Link
          href="/members"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            backgroundColor: '#ffffff',
            color: '#0B5D52',
            border: '1.5px solid #0B5D52',
            padding: '0.65rem 1.4rem',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '0.9rem',
            textDecoration: 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowLeft size={16} /> Return to Member Directory
        </Link>
      </div>
    </div>
  );
}
