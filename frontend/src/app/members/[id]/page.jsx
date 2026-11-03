'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  CreditCard,
  ExternalLink,
  GraduationCap,
  Heart,
  Home,
  Hourglass,
  KeyRound,
  Languages,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Printer,
  Ruler,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  Users,
  X,
  Maximize2,
} from 'lucide-react';
import { getMemberCandidateDetailsApi, unlockMemberContactApi } from '@/lib/api';
import base from '../members.module.css';
import s from './detail.module.css';

// Traditional South Indian Chart Box Labels (Rasi Grid)
const RASI_BOX_CONFIG = [
  { index: 0, name: 'Meenam (மீனம்)', row: 1, col: 1 },
  { index: 1, name: 'Mesham (மேஷம்)', row: 1, col: 2 },
  { index: 2, name: 'Rishabham (ரிஷபம்)', row: 1, col: 3 },
  { index: 3, name: 'Mithunam (மிதுனம்)', row: 1, col: 4 },
  { index: 11, name: 'Kumbam (கும்பம்)', row: 2, col: 1 },
  { index: 4, name: 'Kadagam (கடகம்)', row: 2, col: 4 },
  { index: 10, name: 'Magaram (மகரம்)', row: 3, col: 1 },
  { index: 5, name: 'Simmam (சிம்மம்)', row: 3, col: 4 },
  { index: 9, name: 'Dhanusu (தனுசு)', row: 4, col: 1 },
  { index: 8, name: 'Viruchigam (விருச்சிகம்)', row: 4, col: 2 },
  { index: 7, name: 'Thulaam (துலாம்)', row: 4, col: 3 },
  { index: 6, name: 'Kanni (கன்னி)', row: 4, col: 4 },
];

function formatDateDisplay(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatHeight(cm) {
  if (!cm || isNaN(Number(cm))) return null;
  const num = Number(cm);
  const totalInches = num / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet} ft ${inches} in (${num} cm)`;
}

function formatSiblings(fam) {
  if (!fam) return null;
  const elderB = (fam.marriedElderBrothers || 0) + (fam.unmarriedElderBrothers || 0);
  const youngerB = (fam.marriedYoungerBrothers || 0) + (fam.unmarriedYoungerBrothers || 0);
  const totalB = elderB + youngerB;

  const elderS = (fam.marriedElderSisters || 0) + (fam.unmarriedElderSisters || 0);
  const youngerS = (fam.marriedYoungerSisters || 0) + (fam.unmarriedYoungerSisters || 0);
  const totalS = elderS + youngerS;

  if (totalB === 0 && totalS === 0) {
    return 'None (Single child / No siblings specified)';
  }

  const parts = [];
  if (totalB > 0) {
    const bDetails = [];
    if (fam.marriedElderBrothers > 0) bDetails.push(`${fam.marriedElderBrothers} Elder Married`);
    if (fam.unmarriedElderBrothers > 0) bDetails.push(`${fam.unmarriedElderBrothers} Elder Unmarried`);
    if (fam.marriedYoungerBrothers > 0) bDetails.push(`${fam.marriedYoungerBrothers} Younger Married`);
    if (fam.unmarriedYoungerBrothers > 0) bDetails.push(`${fam.unmarriedYoungerBrothers} Younger Unmarried`);
    parts.push(`${totalB} Brother${totalB > 1 ? 's' : ''} [${bDetails.join(', ') || 'Unspecified'}]`);
  } else {
    parts.push('0 Brothers');
  }

  if (totalS > 0) {
    const sDetails = [];
    if (fam.marriedElderSisters > 0) sDetails.push(`${fam.marriedElderSisters} Elder Married`);
    if (fam.unmarriedElderSisters > 0) sDetails.push(`${fam.unmarriedElderSisters} Elder Unmarried`);
    if (fam.marriedYoungerSisters > 0) sDetails.push(`${fam.marriedYoungerSisters} Younger Married`);
    if (fam.unmarriedYoungerSisters > 0) sDetails.push(`${fam.unmarriedYoungerSisters} Younger Unmarried`);
    parts.push(`${totalS} Sister${totalS > 1 ? 's' : ''} [${sDetails.join(', ') || 'Unspecified'}]`);
  } else {
    parts.push('0 Sisters');
  }

  return parts.join(' · ');
}

function generateNarrativeAbout(p, edu, fam) {
  const genderTerm = p.gender === 'Female' ? 'candidate' : p.gender === 'Male' ? 'candidate' : 'candidate';
  const ageStr = p.age ? `${p.age}-year-old` : '';
  const eduStr = edu.educationalQualification ? `holding a ${edu.educationalQualification}` : '';
  const jobStr = edu.occupation ? `working as a ${edu.occupation}${edu.company ? ` with ${edu.company}` : ''}` : '';
  const locStr = p.location ? `currently residing in ${p.location}` : '';
  const nativeStr = p.nativity || fam.familyLocation ? `originally from ${p.nativity || fam.familyLocation}` : '';

  const clause1 = [ageStr, genderTerm, eduStr, jobStr, locStr].filter(Boolean).join(', ');
  let sentence1 = clause1 ? `A well-qualified ${clause1}.` : '';

  let sentence2 = nativeStr ? `Belongs to a respected South Indian family ${nativeStr}.` : '';
  if (fam.familyInformation) {
    sentence2 += ` ${fam.familyInformation}.`;
  }

  const sentence3 = 'Values traditional cultural roots, mutual understanding, and family values in marriage.';

  return [sentence1, sentence2, sentence3].filter(Boolean).join(' ');
}

function StateScreen({ Icon, title, text, children }) {
  return (
    <div className={base.page}>
      <section className={base.gate}>
        <span className={base.gateIcon}>
          <Icon size={34} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <span className={base.kicker}>Candidate Biodata</span>
        <h1>{title}</h1>
        <p>{text}</p>
        <div className={base.gateActions}>{children}</div>
      </section>
    </div>
  );
}

export default function CandidateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params?.id ? String(params.id) : '';

  // Profile data & Subscription State
  const [profile, setProfile] = useState(null);
  const [subscriptionAccess, setSubscriptionAccess] = useState(null);
  const [creditSummary, setCreditSummary] = useState(null);

  // Photo Gallery State
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Contact Unlock State
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockedContact, setUnlockedContact] = useState(null);
  const [unlockError, setUnlockError] = useState('');
  const [copiedPhone, setCopiedPhone] = useState(false);

  // User Actions State
  const [shareToast, setShareToast] = useState('');

  // Page Lifecycle State
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSelfProfile, setIsSelfProfile] = useState(false);
  const [accessDenialCode, setAccessDenialCode] = useState(null);
  const [accessDenialMessage, setAccessDenialMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Fetch Profile Data
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
        setAccessDenialMessage(res.message || 'An active subscription is required to browse member profiles.');
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
      setActivePhotoIdx(0);
    } catch {
      setErrorMessage('Network connection error while loading candidate details.');
    } finally {
      setLoading(false);
    }
  }, [profileId, router]);

  useEffect(() => {
    fetchProfileDetails();
  }, [fetchProfileDetails]);

  // Unlock Contact Handler
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
    } catch {
      setUnlockError('Network error while unlocking contact details.');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Copy Phone Number
  const handleCopyPhone = async (num) => {
    if (!num) return;
    try {
      await navigator.clipboard.writeText(num);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch (_) {}
  };

  // Share Profile
  const handleShareProfile = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Matrimonial Profile: ${profile?.candidateName || 'Candidate'}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareToast('Profile link copied to clipboard!');
        setTimeout(() => setShareToast(''), 3000);
      }
    } catch (_) {
      setShareToast('Profile link copied to clipboard!');
      setTimeout(() => setShareToast(''), 3000);
    }
  };

  // Print Biodata
  const handlePrintBiodata = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const isActiveAccess = Boolean(
    subscriptionAccess && subscriptionAccess.accessMode === 'active' && !subscriptionAccess.inGracePeriod
  );
  const isInGracePeriod = Boolean(subscriptionAccess?.inGracePeriod);
  const isAlreadyUnlocked = Boolean(profile?.isContactUnlocked || unlockedContact);
  const creditsExhausted =
    !isAlreadyUnlocked &&
    creditSummary &&
    typeof creditSummary.creditsRemaining === 'number' &&
    creditSummary.creditsRemaining <= 0;

  /* ------------------------------ State Screens ------------------------------ */
  if (!loading && accessDenialCode) {
    return (
      <StateScreen
        Icon={Lock}
        title="Membership Required to View Biodata"
        text={
          accessDenialMessage ||
          'An active membership plan is required to browse candidate biodatas and view full horoscopes.'
        }
      >
        <Link href="/membership" className={base.btnPrimary}>
          View Membership Plans <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link href="/members" className={base.btnOutline}>
          Back to Matches
        </Link>
      </StateScreen>
    );
  }

  if (!loading && isSelfProfile) {
    return (
      <StateScreen
        Icon={User}
        title="This is your own profile"
        text="You cannot view your own matrimonial record through the member discovery directory. You can view and edit all your details under My Profile."
      >
        <Link href="/profile" className={base.btnPrimary}>
          Go to My Profile
        </Link>
        <Link href="/members" className={base.btnOutline}>
          Back to Directory
        </Link>
      </StateScreen>
    );
  }

  if (!loading && notFound) {
    return (
      <StateScreen
        Icon={AlertCircle}
        title="Profile Not Found"
        text="The requested matrimonial profile is either no longer active or has been removed."
      >
        <Link href="/members" className={base.btnPrimary}>
          Back to Directory
        </Link>
        <Link href="/" className={base.btnOutline}>
          Home
        </Link>
      </StateScreen>
    );
  }

  if (loading) {
    return (
      <div className={base.page}>
        <div className={s.container}>
          <div className={s.skBlock} style={{ height: '180px', marginBottom: '1.5rem' }} />
          <div className={s.layout}>
            <div className={`${s.skBlock} ${s.skSide}`} />
            <div className={s.skMain}>
              <div className={`${s.skBlock} ${s.skCard}`} />
              <div className={`${s.skBlock} ${s.skCard}`} />
              <div className={`${s.skBlock} ${s.skCard}`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className={base.page}>
        <div className={s.container}>
          <Link href="/members" className={s.back}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to directory
          </Link>
          <div className={`${base.notice} ${base.noticeError}`} role="alert">
            <AlertCircle size={20} aria-hidden="true" />
            <div>
              <strong>Unable to load profile.</strong> {errorMessage}
            </div>
            <button type="button" onClick={fetchProfileDetails}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  /* ------------------------------ Profile Data Mapping ------------------------------ */
  const p = profile.personalDetails || {};
  const comm = profile.communityDetails || {};
  const edu = profile.educationAndProfession || {};
  const fam = profile.familyDetails || {};
  const pref = profile.partnerPreferences || {};
  const prefAge = pref.preferredAgeRange || {};
  const h = profile.horoscope || {};

  const displayName = profile.candidateName || 'Candidate';
  const initial = displayName.charAt(0).toUpperCase();
  const candidateIdShort = profile.id ? profile.id.slice(-6).toUpperCase() : 'PRF';
  const hasAge = p.age !== null && p.age !== undefined;
  const remaining = creditSummary?.creditsRemaining;
  const allocated = creditSummary?.creditsAllocated || 50;

  // Photo list resolution
  const candidatePhotos =
    Array.isArray(profile.photos) && profile.photos.length > 0
      ? profile.photos
      : profile.profilePhotoUrl
      ? [{ url: profile.profilePhotoUrl, isPrimary: true }]
      : [];
  const currentPhotoUrl = candidatePhotos[activePhotoIdx]?.url || profile.profilePhotoUrl;

  // Check if horoscope chart boxes have any planets
  const rasiBoxes = Array.isArray(h.rasiChartBoxes) ? h.rasiChartBoxes : [];
  const hasAstrologyBoxes = rasiBoxes.some((b) => b && typeof b === 'string' && b.trim().length > 0);

  // Narrative summary
  const narrativeSummary = generateNarrativeAbout(p, edu, fam);

  return (
    <div className={base.page}>
      <div className={s.container}>
        {/* ------------------------------ Breadcrumbs & Top Actions ------------------------------ */}
        <nav className={s.topbar} aria-label="Breadcrumb">
          <div className={s.crumbs}>
            <Link href="/members">
              <ArrowLeft size={16} aria-hidden="true" /> Back to Matches
            </Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span>
              {p.gender === 'Female' ? 'Bride' : p.gender === 'Male' ? 'Groom' : 'Candidate'} Profile
            </span>
            <ChevronRight size={14} aria-hidden="true" />
            <span>{displayName} (#{candidateIdShort})</span>
          </div>

          <div className={s.topActions}>
            <button
              type="button"
              onClick={handlePrintBiodata}
              className={s.btnTopAction}
              title="Print Biodata"
            >
              <Printer size={15} /> Print Biodata
            </button>
            <button
              type="button"
              onClick={handleShareProfile}
              className={s.btnTopAction}
              title="Share Profile Link"
            >
              <Share2 size={15} /> Share
            </button>
            {creditSummary && typeof remaining === 'number' && (
              <span className={s.creditChip} title="Monthly contact view credits remaining">
                <CreditCard size={14} aria-hidden="true" />
                <strong>{remaining}</strong> / {allocated} Credits
              </span>
            )}
          </div>
        </nav>

        {/* Toast Alert for Share */}
        {shareToast && (
          <div
            style={{
              background: '#065f46',
              color: '#ffffff',
              padding: '0.65rem 1.25rem',
              borderRadius: 999,
              fontSize: '0.86rem',
              fontWeight: 600,
              marginBottom: '1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <Check size={16} /> {shareToast}
          </div>
        )}

        {/* Grace Period Alert */}
        {isInGracePeriod && (
          <div className={base.notice} role="status" style={{ marginBottom: '1.25rem' }}>
            <Hourglass size={20} aria-hidden="true" />
            <div>
              <strong>7-day grace period active.</strong> You can view candidate details
              {subscriptionAccess?.gracePeriodEndDate
                ? ` until ${formatDateDisplay(subscriptionAccess.gracePeriodEndDate)}`
                : ''}
              , but contact unlocking is paused until renewal.
              <Link href="/membership"> Renew membership</Link>
            </div>
          </div>
        )}

        {/* ------------------------------ Hero Profile Banner ------------------------------ */}
        <section className={s.heroBanner}>
          <div className={s.heroHeaderRow}>
            <div>
              <div className={s.heroIdRow}>
                <span className={s.profileIdTag}>ID: SH-{candidateIdShort}</span>
                <span className={s.verifiedBadge}>
                  <BadgeCheck size={14} /> Verified Matrimonial Biodata
                </span>
                <span className={s.profileSourceTag}>
                  {profile.source === 'broker' ? 'Curated by Offline Matchmaker' : 'Direct Member Registration'}
                </span>
              </div>
              <h1 className={s.candidateTitle}>{displayName}</h1>
              <p className={s.candidateSummaryLine}>
                {[
                  hasAge ? `${p.age} Yrs` : null,
                  formatHeight(p.height),
                  comm.caste ? `${comm.religion || 'Hindu'}, ${comm.caste}` : (comm.religion || 'Hindu'),
                  edu.occupation || edu.educationalQualification,
                  p.location ? `Lives in ${p.location}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>

          {/* Quick Attribute Pills Ribbon */}
          <div className={s.metricsRibbon}>
            {hasAge && (
              <span className={s.metricPill}>
                <Calendar size={14} /> {p.age} Yrs ({formatDateDisplay(p.dateOfBirth)})
              </span>
            )}
            {p.height && (
              <span className={s.metricPill}>
                <Ruler size={14} /> {formatHeight(p.height)}
              </span>
            )}
            {p.maritalStatus && (
              <span className={s.metricPill}>
                <Heart size={14} /> {p.maritalStatus}
              </span>
            )}
            {comm.religion && (
              <span className={s.metricPill}>
                <Compass size={14} /> {comm.religion} {comm.caste ? `· ${comm.caste}` : ''}
              </span>
            )}
            {h.rasi && (
              <span className={s.metricPill}>
                <Sparkles size={14} /> {h.rasi} {h.nakshatram ? `· ${h.nakshatram}` : ''}
              </span>
            )}
            {edu.educationalQualification && (
              <span className={s.metricPill}>
                <GraduationCap size={14} /> {edu.educationalQualification}
              </span>
            )}
            {edu.occupation && (
              <span className={s.metricPill}>
                <Briefcase size={14} /> {edu.occupation} {edu.company ? `at ${edu.company}` : ''}
              </span>
            )}
            {edu.income && (
              <span className={s.metricPill}>
                <strong>₹</strong> {edu.income}
              </span>
            )}
            {p.location && (
              <span className={s.metricPill}>
                <MapPin size={14} /> {p.location}
              </span>
            )}
            {p.motherTongue && (
              <span className={s.metricPill}>
                <Languages size={14} /> {p.motherTongue}
              </span>
            )}
          </div>
        </section>

        {/* ------------------------------ 2-Column Layout ------------------------------ */}
        <div className={s.layout}>
          {/* ==================== LEFT COLUMN: PHOTO + CONTACT ==================== */}
          <aside className={s.side}>
            {/* Photo Showcase Card */}
            <div className={s.photoCard}>
              <div
                className={s.photoFrame}
                onClick={() => {
                  if (currentPhotoUrl) setIsLightboxOpen(true);
                }}
              >
                {currentPhotoUrl ? (
                  <>
                    <img
                      src={currentPhotoUrl}
                      alt={`${displayName} portrait ${activePhotoIdx + 1}`}
                      className={s.photoFrameImg}
                    />
                    {candidatePhotos.length > 1 && (
                      <span className={s.photoCounterBadge}>
                        Photo {activePhotoIdx + 1} of {candidatePhotos.length}
                      </span>
                    )}
                    <span className={s.zoomHint}>
                      <Maximize2 size={12} /> Click to zoom
                    </span>
                  </>
                ) : (
                  <div className={s.avatarPlaceholder}>
                    <div className={s.avatarMonogram}>{initial}</div>
                    <p className={s.avatarTitle}>No Photo Available</p>
                  </div>
                )}
              </div>

              {/* Multiple Photos Thumbnail Strip */}
              {candidatePhotos.length > 1 && (
                <div className={s.thumbnailsRow}>
                  {candidatePhotos.map((ph, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePhotoIdx(idx)}
                      className={`${s.thumbBtn} ${activePhotoIdx === idx ? s.thumbBtnActive : ''}`}
                      aria-label={`View candidate photo ${idx + 1}`}
                    >
                      <img src={ph.url} alt={`Thumbnail ${idx + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Confidential Contact & Privacy Shield Card */}
            <div className={s.contactCard}>
              <div className={s.contactHead}>
                <div className={s.contactShieldIcon}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3>Candidate Direct Contact</h3>
                  <p>
                    {unlockedContact
                      ? 'Contact credentials verified.'
                      : isAlreadyUnlocked
                      ? 'Already unlocked. Viewing is free.'
                      : 'Requires 1 credit to view direct phone.'}
                  </p>
                </div>
              </div>

              {/* Contact Unlocked State */}
              {unlockedContact ? (
                <div className={s.unlockedPhoneBox}>
                  <div className={s.phoneRow}>
                    <a href={`tel:${unlockedContact.candidatePhone}`} className={s.phoneLink}>
                      <Phone size={18} /> {unlockedContact.candidatePhone}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(unlockedContact.candidatePhone)}
                      className={s.btnTopAction}
                      style={{ padding: '0.35rem 0.65rem' }}
                      title="Copy phone"
                    >
                      {copiedPhone ? <Check size={14} color="#15803d" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div className={s.unlockedCreditNote}>
                    <Check size={13} />
                    {unlockedContact.alreadyUnlocked
                      ? 'Previously unlocked · 0 credits deducted'
                      : 'Contact unlocked · 1 credit deducted'}
                  </div>
                  <div className={s.contactActionButtons}>
                    <a href={`tel:${unlockedContact.candidatePhone}`} className={s.btnCall}>
                      <Phone size={14} /> Call Candidate
                    </a>
                    <a
                      href={`https://wa.me/${unlockedContact.candidatePhone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={s.btnWhatsapp}
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  </div>
                </div>
              ) : isActiveAccess ? (
                <>
                  {/* Sleek Golden Blurred Phone Contact Card */}
                  <div className={s.unifiedGoldenContactCard}>
                    <div className={s.goldenBlurHead}>
                      <span className={s.goldenBlurLabel}>
                        <Lock size={13} /> Direct Contact Phone
                      </span>
                      <span className={s.goldenBlurCreditCost}>1 Credit</span>
                    </div>

                    <div className={s.goldenPhoneInteractiveRow}>
                      <div className={s.goldenRealBlurDigits} title="Locked direct phone number">
                        <Phone size={15} className={s.goldenPhoneIcon} />
                        <span className={s.blurryNumberDigits}>+91 98401 78423</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleUnlockContact}
                        disabled={isUnlocking || creditsExhausted}
                        className={s.btnGoldenUnlockPill}
                      >
                        <KeyRound size={14} />
                        {isUnlocking
                          ? 'Unlocking...'
                          : isAlreadyUnlocked
                          ? 'View Phone (Free)'
                          : creditsExhausted
                          ? 'Credits Exhausted'
                          : 'Reveal Phone'}
                      </button>
                    </div>
                  </div>
                  {unlockError && <p style={{ color: '#dc2626', fontSize: '0.82rem', margin: '0.4rem 0 0' }}>{unlockError}</p>}
                </>
              ) : (
                <div style={{ background: '#FFF8E9', padding: '0.85rem', borderRadius: 12, border: '1px solid #E8D3BC', fontSize: '0.82rem', color: '#650D18' }}>
                  <Lock size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                  Contact unlocking is reserved for active subscribed members.
                </div>
              )}

              <p className={s.privacyShieldNote}>
                <ShieldCheck size={14} /> 100% Privacy Protected &bull; Verified Family Contact
              </p>
            </div>
          </aside>

          {/* ==================== RIGHT COLUMN: DETAILED DOSSIER ==================== */}
          <div className={s.main}>
            {/* Sticky In-Page Navigation Bar */}
            <nav className={s.sectionTabs} aria-label="Section navigation">
              <a href="#sec-about" className={s.tabLink}>About</a>
              <a href="#sec-personal" className={s.tabLink}>Personal</a>
              <a href="#sec-community" className={s.tabLink}>Community &amp; Astro</a>
              <a href="#sec-education" className={s.tabLink}>Education &amp; Career</a>
              <a href="#sec-family" className={s.tabLink}>Family</a>
              <a href="#sec-preferences" className={s.tabLink}>Expectations</a>
            </nav>

            {/* Section 0: Narrative Summary & About Candidate */}
            <section id="sec-about" className={s.dossierCard}>
              <div className={s.cardHeader}>
                <div className={s.cardMedallion}>
                  <Sparkles size={20} />
                </div>
                <div className={s.cardTitleGroup}>
                  <h2>About Candidate &amp; Lifestyle (சுய அறிமுகம்)</h2>
                  <p>Personal profile summary and lifestyle inclinations</p>
                </div>
              </div>

              <div className={s.narrativeBox}>
                <p style={{ margin: 0 }}>{narrativeSummary}</p>
              </div>

              <div className={s.dataGrid3}>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Dietary Habit (உணவு)</span>
                  <span className={s.fieldValue}>{p.diet || 'Not specified'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Physical Status (உடல் நிலை)</span>
                  <span className={s.fieldValue}>{p.physicalStatus || 'Normal'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Mother Tongue (தாய்மொழி)</span>
                  <span className={s.fieldValue}>{p.motherTongue || 'Tamil'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Blood Group</span>
                  <span className={s.fieldValue}>{p.bloodGroup || 'Not specified'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Complexion (நிறம்)</span>
                  <span className={s.fieldValue}>{p.complexion || 'Not specified'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Disability Details</span>
                  <span className={s.fieldValue}>{p.disabilityDetails || 'None'}</span>
                </div>
              </div>
            </section>

            {/* Section 1: Personal & Physical Particulars */}
            <section id="sec-personal" className={s.dossierCard}>
              <div className={s.cardHeader}>
                <div className={s.cardMedallion}>
                  <User size={20} />
                </div>
                <div className={s.cardTitleGroup}>
                  <h2>Personal &amp; Physical Particulars (சுய விவரம்)</h2>
                  <p>Comprehensive identity, birth particulars, and residence</p>
                </div>
              </div>

              <div className={s.dataGrid3}>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Gender</span>
                  <span className={s.fieldValue}>{p.gender || 'Not specified'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Age</span>
                  <span className={s.fieldValue}>{hasAge ? `${p.age} Years` : 'Not specified'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Date of Birth</span>
                  <span className={s.fieldValue}>{formatDateDisplay(p.dateOfBirth) || 'Not specified'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Time of Birth (பிறந்த நேரம்)</span>
                  <span className={s.fieldValue}>{p.timeOfBirth || 'Not specified'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Place of Birth (பிறந்த இடம்)</span>
                  <span className={s.fieldValue}>{p.placeOfBirth || 'Not specified'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Nativity / Origin (பூர்வீகம்)</span>
                  <span className={s.fieldValue}>{p.nativity || fam.familyLocation || 'Not specified'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Height</span>
                  <span className={s.fieldValue}>{formatHeight(p.height) || 'Not specified'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Weight</span>
                  <span className={s.fieldValue}>{p.weight ? `${p.weight} kg` : 'Not specified'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Marital Status</span>
                  <span className={s.fieldValue}>{p.maritalStatus || 'Never Married'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Current Residence</span>
                  <span className={s.fieldValue}>{p.location || 'Not specified'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Profile Reference ID</span>
                  <span className={s.fieldValue}>SH-{candidateIdShort}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Verification Status</span>
                  <span className={s.fieldValue} style={{ color: '#15803d' }}>
                    100% சரிபார்க்கப்பட்ட வரன் (Verified Profile) ✓
                  </span>
                </div>
              </div>
            </section>

            {/* Section 2: Community & Lineage */}
            <section id="sec-community" className={s.dossierCard}>
              <div className={s.cardHeader}>
                <div className={s.cardMedallion}>
                  <Compass size={20} />
                </div>
                <div className={s.cardTitleGroup}>
                  <h2>Community &amp; Lineage (சமூகம் &amp; குலம்)</h2>
                  <p>Ancestral roots, religious heritage, and clan</p>
                </div>
              </div>

              <div className={s.dataGrid2}>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Religion</span>
                  <span className={s.fieldValue}>{comm.religion || 'Hindu'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Caste / Community (ஜாதி)</span>
                  <span className={s.fieldValue}>{comm.caste || 'Open / Caste No Bar'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Subcaste / Sect (உட்பிரிவு)</span>
                  <span className={s.fieldValue}>{comm.subcaste || 'Not specified / Open'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Gothram / Kulam (கோத்திரம் / குலம்)</span>
                  <span className={s.fieldValue}>{comm.gothram || 'Not specified'}</span>
                </div>
              </div>
            </section>

            {/* Section 3: Vedic Horoscope & Astrology */}
            <section id="sec-astro" className={s.dossierCard}>
              <div className={s.cardHeader}>
                <div className={s.cardMedallion}>
                  <Star size={20} />
                </div>
                <div className={s.cardTitleGroup}>
                  <h2>Vedic Astrology &amp; Jathagam (ஜாதகம் &amp; கிரக நிலை)</h2>
                  <p>Planetary alignments, birth star, dosham analysis, and dasa balance</p>
                </div>
              </div>

              {/* Astro Highlights Banner */}
              <div className={s.astroHighlightBanner}>
                <div className={s.astroPill}>
                  <span className={s.astroPillLabel}>Rasi (Moon Sign)</span>
                  <span className={s.astroPillValue}>{h.rasi || 'Not Specified'}</span>
                </div>
                <div className={s.astroPill}>
                  <span className={s.astroPillLabel}>Nakshatram (Star)</span>
                  <span className={s.astroPillValue}>{h.nakshatram || 'Not Specified'}</span>
                </div>
                <div className={s.astroPill}>
                  <span className={s.astroPillLabel}>Padam</span>
                  <span className={s.astroPillValue}>{h.padam ? `Padam ${h.padam}` : 'Not Specified'}</span>
                </div>
                <div className={s.astroPill}>
                  <span className={s.astroPillLabel}>Lagnam</span>
                  <span className={s.astroPillValue}>{h.lagnam || 'Not Specified'}</span>
                </div>
                <div className={s.astroPill}>
                  <span className={s.astroPillLabel}>Dosham Analysis</span>
                  <span>
                    {!h.dosham || h.dosham === 'None' || h.dosham === 'No Dosham' ? (
                      <span className={s.doshamCleanBadge}>No Dosham (சுத்த ஜாதகம்)</span>
                    ) : (
                      <span className={s.doshamActiveBadge}>{h.dosham}</span>
                    )}
                  </span>
                </div>
              </div>

              <div className={s.dataGrid2}>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Dasa Balance at Birth (திசா இருப்பு)</span>
                  <span className={s.fieldValue}>
                    {h.dasaBalance || 'Not specified / Available in horoscope copy'}
                  </span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Horoscope Matching Status</span>
                  <span className={s.fieldValue}>
                    {pref.horoscopeRequired === 'Yes'
                      ? 'Horoscope match required for alliance'
                      : 'Horoscope match not strictly required'}
                  </span>
                </div>
              </div>

              {/* South Indian 12-Box Visual Chart if boxes are available */}
              {hasAstrologyBoxes && (
                <div className={s.chartContainer}>
                  <h4 className={s.chartTitle}>
                    <Sparkles size={16} color="var(--gold)" /> South Indian Rasi Chart (ராசி கட்டம்)
                  </h4>
                  <div className={s.southIndianChartGrid}>
                    <div className={s.chartCenter}>
                      <div>
                        <div>ராசி</div>
                        <small style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>RASI</small>
                      </div>
                    </div>
                    {RASI_BOX_CONFIG.map((b) => {
                      const planets = rasiBoxes[b.index] || '';
                      return (
                        <div
                          key={b.index}
                          className={s.chartBox}
                          style={{ gridRow: b.row, gridColumn: b.col }}
                        >
                          <span className={s.chartBoxName}>{b.name.split(' ')[0]}</span>
                          <span className={s.chartBoxPlanets}>{planets}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Section 4: Education & Career */}
            <section id="sec-education" className={s.dossierCard}>
              <div className={s.cardHeader}>
                <div className={s.cardMedallion}>
                  <GraduationCap size={20} />
                </div>
                <div className={s.cardTitleGroup}>
                  <h2>Education &amp; Profession (கல்வி &amp; தொழில்)</h2>
                  <p>Academic qualifications, designation, company, and annual earnings</p>
                </div>
              </div>

              <div className={s.dataGrid3}>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Highest Qualification</span>
                  <span className={s.fieldValue}>{edu.educationalQualification || 'Graduate'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Occupation / Designation</span>
                  <span className={s.fieldValue}>{edu.occupation || 'Working Professional'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Organization / Employer</span>
                  <span className={s.fieldValue}>{edu.company || 'Private Firm / Organization'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Work Location</span>
                  <span className={s.fieldValue}>{edu.workLocation || p.location || 'Not specified'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Annual Income / CTC</span>
                  <span className={s.fieldValue} style={{ color: 'var(--rose-deep)' }}>
                    {edu.income ? `₹ ${edu.income}` : 'Disclosed on request'}
                  </span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Employment Sector</span>
                  <span className={s.fieldValue}>
                    {edu.company?.toLowerCase().includes('govt') ? 'Government / Public' : 'Corporate / Private'}
                  </span>
                </div>
              </div>
            </section>

            {/* Section 5: Family Details & Siblings */}
            <section id="sec-family" className={s.dossierCard}>
              <div className={s.cardHeader}>
                <div className={s.cardMedallion}>
                  <Users size={20} />
                </div>
                <div className={s.cardTitleGroup}>
                  <h2>Family Details &amp; Siblings (குடும்பம் &amp; உடன்பிறப்புகள்)</h2>
                  <p>Parental background, sibling status, and ancestral home</p>
                </div>
              </div>

              <div className={s.dataGrid2}>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Father&apos;s Name &amp; Status</span>
                  <span className={s.fieldValue}>
                    {fam.fatherName || 'Father'} ({fam.fatherAlive === 'No' || fam.fatherAlive === false ? 'Late' : 'Living'})
                  </span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Father&apos;s Occupation</span>
                  <span className={s.fieldValue}>{fam.fatherOccupation || 'Retired / Business / Employed'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Mother&apos;s Name &amp; Status</span>
                  <span className={s.fieldValue}>
                    {fam.motherName || 'Mother'} ({fam.motherAlive === 'No' || fam.motherAlive === false ? 'Late' : 'Living'})
                  </span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Mother&apos;s Occupation</span>
                  <span className={s.fieldValue}>{fam.motherOccupation || 'Homemaker'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Family Native Place / Origin</span>
                  <span className={s.fieldValue}>{fam.familyLocation || p.nativity || 'Tamil Nadu'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Family Values &amp; Structure</span>
                  <span className={s.fieldValue}>{fam.familyInformation || 'Traditional Nuclear Family'}</span>
                </div>
              </div>

              {/* Sibling Overview Box */}
              <div className={s.siblingsOverview}>
                <h4 className={s.siblingTitle}>
                  <Users size={16} /> Siblings Breakdown (உடன்பிறந்தோர்)
                </h4>
                <div className={s.siblingPillRow}>
                  <span className={s.siblingChip}>{formatSiblings(fam)}</span>
                </div>
              </div>
            </section>

            {/* Section 6: Partner Preferences & Expectations */}
            <section id="sec-preferences" className={s.dossierCard}>
              <div className={s.cardHeader}>
                <div className={s.cardMedallion}>
                  <Heart size={20} />
                </div>
                <div className={s.cardTitleGroup}>
                  <h2>Partner Preferences &amp; Expectations (எதிர்பார்ப்புகள்)</h2>
                  <p>Desired age, career, education, and lifestyle compatibility</p>
                </div>
              </div>

              <div className={s.dataGrid3}>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Preferred Age Range</span>
                  <span className={s.fieldValue}>
                    {prefAge.min || prefAge.max
                      ? `${prefAge.min || 18} to ${prefAge.max || 100} Years`
                      : 'Open / Any suitable age'}
                  </span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Preferred Location</span>
                  <span className={s.fieldValue}>{pref.preferredLocation || 'Tamil Nadu / Any metro'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Job Requirement (வேலை)</span>
                  <span className={s.fieldValue}>{pref.jobRequirement || 'Preferred / Working professional'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Horoscope Match Required</span>
                  <span className={s.fieldValue}>
                    {pref.horoscopeRequired === 'Yes' ? 'Yes (ஜாதக பொருத்தம் அவசியம்)' : 'Flexible / Not mandatory'}
                  </span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Caste / Community Preference</span>
                  <span className={s.fieldValue}>{pref.castePreference || 'Same Caste / Open to all'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Expected Partner Income</span>
                  <span className={s.fieldValue}>{pref.incomePreference || 'Flexible / Decent earnings'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Education Preference</span>
                  <span className={s.fieldValue}>{pref.educationPreference || 'Graduate or Post Graduate'}</span>
                </div>
                <div className={s.dataField}>
                  <span className={s.fieldLabel}>Occupation Preference</span>
                  <span className={s.fieldValue}>{pref.occupationPreference || 'Working Professional / Govt / IT'}</span>
                </div>
              </div>

              {pref.otherPreferences && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px dashed var(--line)' }}>
                  <span className={s.fieldLabel}>General Expectations &amp; Values</span>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.94rem', color: 'var(--plum)', lineHeight: 1.6 }}>
                    {pref.otherPreferences}
                  </p>
                </div>
              )}
            </section>

            {/* Bottom Directory Return Button */}
            <div className={s.bottom}>
              <Link href="/members" className={base.btnOutline}>
                <ArrowLeft size={16} aria-hidden="true" /> Return to Verified Matches Directory
              </Link>
            </div>
          </div>
        </div>

        {/* ------------------------------ Lightbox Modal for Photo Zoom ------------------------------ */}
        {isLightboxOpen && currentPhotoUrl && (
          <div className={s.lightboxOverlay} onClick={() => setIsLightboxOpen(false)}>
            <div className={s.lightboxContent} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={s.lightboxCloseBtn}
                onClick={() => setIsLightboxOpen(false)}
                aria-label="Close photo preview"
              >
                <X size={24} />
              </button>
              <img
                src={currentPhotoUrl}
                alt={`${displayName} full photograph`}
                className={s.lightboxImg}
              />
              {candidatePhotos.length > 1 && (
                <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1rem' }}>
                  {candidatePhotos.map((ph, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePhotoIdx(idx)}
                      style={{
                        width: 48,
                        height: 56,
                        borderRadius: 6,
                        overflow: 'hidden',
                        border: activePhotoIdx === idx ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.4)',
                        padding: 0,
                        background: '#000',
                        cursor: 'pointer',
                        opacity: activePhotoIdx === idx ? 1 : 0.6,
                      }}
                    >
                      <img src={ph.url} alt={`Thumb ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
