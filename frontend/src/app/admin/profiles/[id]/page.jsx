'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit,
  Camera,
  Play,
  Pause,
  Check,
  X,
  RotateCw,
  Sparkles,
  Briefcase,
  GraduationCap,
  Shield,
  ShieldCheck,
  Users,
  Heart,
  ArrowLeft,
} from 'lucide-react';
import {
  getAdminProfileDetailApi,
  updateProfileApprovalApi,
  inviteBrokerCandidateApi,
  reinviteBrokerCandidateApi,
  updateAdminProfileStatusApi,
} from '@/lib/api';
import { AdminProfileEditModal } from '@/components/admin/AdminProfileEditModal';
import { AdminPhotoManagerModal } from '@/components/admin/AdminPhotoManagerModal';
import { StatusPill } from '@/components/admin/StatusPill';

function calculateAge(dobString) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  const diffMs = Date.now() - dob.getTime();
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(d);
  }
}

function safeVal(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    if (val.text) return String(val.text);
    if (val.label) return String(val.label);
    if (val.name) return String(val.name);
    if (val.years !== undefined || val.months !== undefined || val.days !== undefined) {
      const parts = [];
      if (val.planet) parts.push(`${val.planet}:`);
      if (val.years !== undefined && val.years !== null) parts.push(`${val.years}y`);
      if (val.months !== undefined && val.months !== null) parts.push(`${val.months}m`);
      if (val.days !== undefined && val.days !== null) parts.push(`${val.days}d`);
      return parts.join(' ') || '—';
    }
    if (Array.isArray(val)) {
      return val.map((x) => (typeof x === 'object' ? safeVal(x) : String(x))).filter(Boolean).join(', ');
    }
    const clean = Object.entries(val)
      .filter(([k, v]) => typeof v !== 'object' && v !== null && v !== undefined && k !== '_id')
      .map(([k, v]) => `${k}: ${v}`);
    return clean.length > 0 ? clean.join(', ') : '—';
  }
  return String(val);
}

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="adm-card" style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--a-line)', paddingBottom: '0.65rem' }}>
        {Icon && <Icon size={18} color="var(--a-brand)" />}
        <h2 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--a-ink)' }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function InfoGrid({ items }) {
  return (
    <dl className="adm-dl" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.85rem' }}>
      {items.map(([label, rawValue], i) => {
        const value = safeVal(rawValue);
        return (
          <div key={i}>
            <dt style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--a-muted)' }}>{label}</dt>
            <dd style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--a-ink)', marginTop: '0.15rem' }}>
              {value || <span style={{ color: 'var(--a-muted)', fontWeight: 400 }}>—</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export default function AdminProfileDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFeedback, setActionFeedback] = useState({ type: '', text: '' });
  const [processing, setProcessing] = useState(false);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (!actionFeedback.text) return;
    const t = setTimeout(() => setActionFeedback({ type: '', text: '' }), 4500);
    return () => clearTimeout(t);
  }, [actionFeedback.text]);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await getAdminProfileDetailApi(id);
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (res.success && res.data) {
        setProfile(res.data);
      } else {
        setError(res.message || 'Could not find the requested matrimonial profile.');
      }
    } catch {
      setError('Network connection error while loading profile details.');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Custom In-App Modal State (replaces native window.confirm & window.prompt)
  const [modalState, setModalState] = useState({
    open: false,
    action: '',
    targetStatus: '',
    title: '',
    message: '',
    confirmText: '',
    confirmColor: '',
    inputVal: '',
  });

  // Handle Deactivate / Activate
  const handleToggleStatus = () => {
    if (!profile || processing) return;
    const nextStatus = profile.profileStatus === 'inactive' ? 'active' : 'inactive';
    const actionLabel = nextStatus === 'active' ? 'Activate' : 'Deactivate';
    setModalState({
      open: true,
      action: 'status-toggle',
      targetStatus: nextStatus,
      title: `${actionLabel} Profile`,
      message: `Are you sure you want to ${actionLabel.toLowerCase()} the matrimonial profile for "${profile.candidateName || 'Candidate'}"?`,
      confirmText: `Yes, ${actionLabel}`,
      confirmColor: nextStatus === 'active' ? '#16a34a' : '#d97706',
      inputVal: '',
    });
  };

  // Handle Approval Action
  const handleApproval = (status) => {
    if (!profile || processing) return;
    const actionVerb = status === 'approved' ? 'Approve' : 'Reject';
    setModalState({
      open: true,
      action: `approval-${status}`,
      targetStatus: status,
      title: `${actionVerb} Matrimonial Profile`,
      message:
        status === 'approved'
          ? `Are you sure you want to approve this matrimonial profile for "${profile.candidateName || 'Candidate'}"? It will become active and visible in the member directory.`
          : `Are you sure you want to reject this matrimonial profile?`,
      confirmText: `Yes, ${actionVerb} Profile`,
      confirmColor: status === 'approved' ? '#16a34a' : '#dc2626',
      inputVal: '',
    });
  };

  // Handle Send / Resend Login Invite
  const handleInvite = () => {
    if (!profile || processing) return;
    const candidateName = profile.candidateName || profile.user?.name || 'Candidate';
    const existingEmail = profile.user?.email || profile.candidateEmail || '';
    setModalState({
      open: true,
      action: 'invite',
      targetStatus: '',
      title: 'Send Candidate Login Invite',
      message: `Send an activation email inviting "${candidateName}" to log in and manage their profile.`,
      confirmText: 'Send Invitation Email',
      confirmColor: '#0284c7',
      inputVal: existingEmail,
    });
  };

  // Handle Confirm Modal Action
  const handleConfirmModalAction = async () => {
    if (!profile || processing) return;
    const { action, targetStatus, inputVal } = modalState;

    if (action.startsWith('approval-')) {
      const status = targetStatus;
      const actionVerb = status === 'approved' ? 'approve' : 'reject';
      setProcessing(true);
      setActionFeedback({ type: '', text: '' });
      try {
        const res = await updateProfileApprovalApi(profile._id, status);
        if (res.success) {
          setActionFeedback({ type: 'success', text: `Profile successfully ${actionVerb}d.` });
          setProfile((prev) => ({ ...prev, approvalStatus: status }));
          setModalState({ open: false, action: '', title: '', message: '' });
        } else {
          setActionFeedback({ type: 'error', text: res.message || `Failed to ${actionVerb} profile.` });
        }
      } catch {
        setActionFeedback({ type: 'error', text: `Network error while attempting to ${actionVerb} profile.` });
      } finally {
        setProcessing(false);
      }
    } else if (action === 'status-toggle') {
      const nextStatus = targetStatus;
      const actionLabel = nextStatus === 'active' ? 'Activate' : 'Deactivate';
      setProcessing(true);
      setActionFeedback({ type: '', text: '' });
      try {
        const res = await updateAdminProfileStatusApi(profile._id, nextStatus);
        if (res.success) {
          setActionFeedback({ type: 'success', text: `Profile successfully ${actionLabel.toLowerCase()}d.` });
          setProfile((prev) => ({ ...prev, profileStatus: nextStatus }));
          setModalState({ open: false, action: '', title: '', message: '' });
        } else {
          setActionFeedback({ type: 'error', text: res.message || `Failed to ${actionLabel.toLowerCase()} profile.` });
        }
      } catch {
        setActionFeedback({ type: 'error', text: 'Network error updating profile status.' });
      } finally {
        setProcessing(false);
      }
    } else if (action === 'invite') {
      const candidateName = profile.candidateName || profile.user?.name || 'Candidate';
      const targetEmail = (inputVal || '').trim();
      if (!targetEmail) {
        setActionFeedback({ type: 'error', text: 'Please enter a valid email address.' });
        return;
      }
      setProcessing(true);
      setActionFeedback({ type: '', text: '' });
      try {
        const isReinvite = profile.user && profile.user.accountStatus === 'invited';
        const res = isReinvite
          ? await reinviteBrokerCandidateApi(profile._id, targetEmail)
          : await inviteBrokerCandidateApi(profile._id, targetEmail);

        if (res.success) {
          setActionFeedback({ type: res.warning ? 'warning' : 'success', text: res.message });
          setProfile((prev) => ({
            ...prev,
            candidateEmail: targetEmail,
            user: prev.user
              ? { ...prev.user, email: targetEmail, accountStatus: 'invited' }
              : { email: targetEmail, name: candidateName, accountStatus: 'invited' },
          }));
          setModalState({ open: false, action: '', title: '', message: '' });
        } else {
          setActionFeedback({ type: 'error', text: res.message || 'Failed to send login invite.' });
        }
      } catch {
        setActionFeedback({ type: 'error', text: 'Network error sending invitation.' });
      } finally {
        setProcessing(false);
      }
    }
  };

  // Photos Updated callback from photo modal
  const handlePhotosUpdated = useCallback((profileId, newPrimaryUrl, newCount) => {
    setProfile((prev) => {
      if (!prev || prev._id !== profileId) return prev;
      return {
        ...prev,
        profilePhoto: { ...(prev.profilePhoto || {}), url: newPrimaryUrl },
        photos: Array.from({ length: newCount || 0 }),
      };
    });
  }, []);

  // Handle Profile Saved
  const handleProfileSaved = (updated) => {
    setIsEditModalOpen(false);
    setActionFeedback({ type: 'success', text: 'Candidate details successfully updated.' });
    if (updated) setProfile(updated);
  };

  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-container">
          <div className="admin-state-box" style={{ margin: '4rem auto', maxWidth: '480px' }}>
            <div className="status-spinner" style={{ margin: '0 auto 1rem auto' }}></div>
            <p>Loading candidate dossier...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="admin-page">
        <div className="admin-container">
          <div className="admin-state-box" style={{ margin: '4rem auto', maxWidth: '520px' }}>
            <AlertCircle size={44} color="var(--danger)" style={{ margin: '0 auto 1rem auto', display: 'block' }} />
            <h2>Candidate Not Found</h2>
            <p>{error || 'This matrimonial profile could not be loaded.'}</p>
            <Link href="/admin/profiles" className="btn-secondary" style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <ArrowLeft size={14} /> Back to Directory
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const u = profile.user;
  const isBroker = profile.source === 'broker';
  const pd = profile.personalDetails || {};
  const cd = profile.communityDetails || {};
  const h = profile.horoscope || {};
  const ed = profile.educationAndProfession || profile.careerDetails || {};
  const fd = profile.familyDetails || {};
  const pp = profile.partnerPreferences || {};
  const age = calculateAge(pd.dateOfBirth);
  const candidateName = profile.candidateName || u?.name || 'Candidate';
  const candidateIdCode = profile.profileId || (profile._id ? `TM-${profile._id.slice(-6).toUpperCase()}` : 'TM-PROFILE');
  const photoUrl = profile.profilePhoto?.url;
  const photoCount = Array.isArray(profile.photos) && profile.photos.length > 0 ? profile.photos.length : photoUrl ? 1 : 0;
  const isInactive = profile.profileStatus === 'inactive';

  return (
    <main className="admin-page">
      <div className="admin-container" style={{ maxWidth: '1120px' }}>
        {/* Floating Toast */}
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
            }}
          >
            {actionFeedback.type === 'error' ? <AlertCircle size={18} color="#fca5a5" /> : <CheckCircle2 size={18} color="#86efac" />}
            <span>{actionFeedback.text}</span>
            <button
              type="button"
              onClick={() => setActionFeedback({ type: '', text: '' })}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Top Breadcrumb Navigation */}
        <div style={{ marginBottom: '1.25rem' }}>
          <Link
            href="/admin/profiles"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--a-muted)',
              fontSize: '0.85rem',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={14} /> Back to Profiles Directory
          </Link>
        </div>

        {/* Candidate Hero Header */}
        <div
          className="adm-card"
          style={{
            marginBottom: '1.5rem',
            padding: '1.4rem 1.6rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.25rem',
            background: '#ffffff',
            border: '1px solid var(--a-line)',
            borderRadius: '16px',
            boxShadow: '0 6px 18px rgba(43,26,33,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', minWidth: '280px' }}>
            <div
              className="adm-profile-avatar"
              style={{ width: '64px', height: '64px', fontSize: '1.35rem', cursor: 'pointer' }}
              onClick={() => setIsPhotoModalOpen(true)}
              title="Click to manage candidate photos"
            >
              {photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={photoUrl} alt={candidateName} />
              ) : (
                <span>{candidateName.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.4rem', margin: 0, color: 'var(--a-ink)', fontFamily: 'var(--font-serif)' }}>
                  {candidateName}
                </h1>
                <span className="adm-tag-id" style={{ fontSize: '0.78rem' }}>#{candidateIdCode}</span>
                <span className={`adm-tag-gender ${pd.gender === 'Female' ? 'female' : pd.gender === 'Male' ? 'male' : ''}`} style={{ fontSize: '0.72rem' }}>
                  {pd.gender === 'Female' ? 'Bride' : pd.gender === 'Male' ? 'Groom' : (pd.gender || 'Profile')}
                  {age ? ` • ${age} yrs` : ''}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.4rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--a-muted)' }}>
                {(profile.candidatePhone || pd.phone) && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Phone size={12} /> {profile.candidatePhone || pd.phone}
                  </span>
                )}
                {(u?.email || profile.candidateEmail) && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'monospace' }}>
                    <Mail size={12} /> {u?.email || profile.candidateEmail}
                  </span>
                )}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={12} /> Added {fmtDate(profile.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Edit Profile */}
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="adm-act-btn primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
              title="Edit candidate profile information"
            >
              <Edit size={14} /> Edit Profile
            </button>

            {/* Photos */}
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(true)}
              className="adm-act-btn"
              style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem' }}
              title="Manage gallery photos"
            >
              <Camera size={14} /> Photos ({photoCount})
            </button>

            {/* Deactivate / Activate Button (Instead of Delete) */}
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={processing}
              className={`adm-act-btn ${isInactive ? 'success' : ''}`}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.82rem',
                color: isInactive ? '#16a34a' : '#b45309',
                borderColor: isInactive ? '#86efac' : '#fed7aa',
                backgroundColor: isInactive ? '#f0fdf4' : '#fffbeb',
              }}
              title={isInactive ? 'Activate profile for public directory' : 'Deactivate and hide profile from directory'}
            >
              {isInactive ? (
                <><Play size={14} /> Activate Profile</>
              ) : (
                <><Pause size={14} /> Deactivate Profile</>
              )}
            </button>

            {/* Send / Resend Login Invite */}
            {(!u || u.accountStatus === 'invited') && profile.approvalStatus === 'approved' && (
              <button
                type="button"
                onClick={handleInvite}
                disabled={processing}
                className="adm-act-btn"
                style={{ padding: '0.5rem 0.95rem', fontSize: '0.82rem', borderColor: '#0284c7', color: '#0369a1' }}
                title="Send or resend login invitation email"
              >
                {u?.accountStatus === 'invited' ? (
                  <><RotateCw size={13} /> Resend Invite</>
                ) : (
                  <><Mail size={13} /> Send Login Invite</>
                )}
              </button>
            )}

            {/* Approval Controls (If Pending) */}
            {profile.approvalStatus === 'pending_approval' && (
              <>
                <button
                  type="button"
                  onClick={() => handleApproval('approved')}
                  disabled={processing}
                  className="adm-act-btn success"
                  style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem' }}
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => handleApproval('rejected')}
                  disabled={processing}
                  className="adm-act-btn danger"
                  style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem' }}
                >
                  <X size={14} /> Reject
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Pill Overview Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.85rem',
            marginBottom: '1.5rem',
          }}
        >
          <div className="adm-card" style={{ padding: '0.85rem 1rem' }}>
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--a-muted)', display: 'block' }}>Approval Status</span>
            <div style={{ marginTop: '0.35rem' }}>
              <StatusPill status={profile.approvalStatus} />
            </div>
          </div>
          <div className="adm-card" style={{ padding: '0.85rem 1rem' }}>
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--a-muted)', display: 'block' }}>Profile Visibility</span>
            <div style={{ marginTop: '0.35rem', fontWeight: 600, fontSize: '0.88rem', color: isInactive ? '#dc2626' : '#16a34a' }}>
              {isInactive ? '● Inactive (Hidden)' : '● Active (Live)'}
            </div>
          </div>
          <div className="adm-card" style={{ padding: '0.85rem 1rem' }}>
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--a-muted)', display: 'block' }}>Registration Source</span>
            <div style={{ marginTop: '0.35rem', fontWeight: 600, fontSize: '0.88rem', color: 'var(--a-ink)' }}>
              {isBroker ? 'Assisted Entry (Admin / Broker)' : 'Direct Member Sign-Up'}
            </div>
          </div>
          <div className="adm-card" style={{ padding: '0.85rem 1rem' }}>
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--a-muted)', display: 'block' }}>Candidate Account</span>
            <div style={{ marginTop: '0.35rem', fontWeight: 600, fontSize: '0.88rem', color: 'var(--a-ink)' }}>
              {u ? u.name : profile.candidateEmail ? 'Pending Setup' : 'Unlinked Candidate'}
            </div>
          </div>
        </div>

        {/* 2-Column Detail Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.25rem' }}>
          {/* Personal Particulars */}
          <SectionCard title="Personal Particulars" icon={User}>
            <InfoGrid
              items={[
                ['Gender', pd.gender],
                ['Date of Birth', fmtDate(pd.dateOfBirth)],
                ['Height', pd.height ? `${pd.height} cm` : ''],
                ['Weight', pd.weight ? `${pd.weight} kg` : ''],
                ['Blood Group', pd.bloodGroup],
                ['Complexion', pd.complexion],
                ['Diet', pd.diet],
                ['Physical Status', pd.physicalStatus],
                ['Marital Status', pd.maritalStatus],
                ['Mother Tongue', pd.motherTongue],
                ['Nativity', pd.nativity],
                ['Location / City', pd.location || profile.contactDetails?.city],
                ['Present Address', pd.presentAddress],
                ['Permanent Address', pd.permanentAddress],
              ]}
            />
          </SectionCard>

          {/* Education & Profession */}
          <SectionCard title="Education & Profession" icon={Briefcase}>
            <InfoGrid
              items={[
                ['Highest Qualification', ed.educationalQualification || ed.education],
                ['Education Details', ed.educationDetails],
                ['Occupation / Role', ed.occupation || ed.profession || ed.designation],
                ['Employer / Company', ed.company],
                ['Work Location', ed.workLocation || ed.city],
                ['Annual Income', ed.income || ed.annualIncome],
              ]}
            />
          </SectionCard>

          {/* Community & Lineage */}
          <SectionCard title="Community & Lineage" icon={Shield}>
            <InfoGrid
              items={[
                ['Religion', cd.religion || 'Hindu'],
                ['Caste', cd.caste],
                ['Subcaste', cd.subcaste],
                ['Gothram', cd.gothram],
              ]}
            />
          </SectionCard>

          {/* Vedic Astrology & Horoscope */}
          <SectionCard title="Vedic Astrology & Jathagam" icon={Sparkles}>
            <InfoGrid
              items={[
                ['Rasi (Moon Sign)', h.rasi],
                ['Nakshatram (Star)', h.nakshatram],
                ['Padam', h.padam ? `Padam ${h.padam}` : ''],
                ['Lagnam (Ascendant)', h.lagnam],
                ['Chevvai Dosham', h.chevvaiDosham],
                ['Dasa Balance', h.dasaBalance],
              ]}
            />
          </SectionCard>

          {/* Family Background */}
          <SectionCard title="Family Background" icon={Users}>
            <InfoGrid
              items={[
                ["Father's Name", fd.fatherName],
                ["Father's Profession", fd.fatherOccupation],
                ["Mother's Name", fd.motherName],
                ["Mother's Profession", fd.motherOccupation],
                ['Siblings', fd.brothersCount || fd.sistersCount ? `${fd.brothersCount || 0} Brother(s), ${fd.sistersCount || 0} Sister(s)` : fd.siblings],
                ['Family Values', fd.familyValues],
                ['Family Type', fd.familyType],
                ['Native Place', fd.nativePlace],
              ]}
            />
          </SectionCard>

          {/* Partner Preferences */}
          <SectionCard title="Partner Preferences" icon={Heart}>
            <InfoGrid
              items={[
                ['Preferred Age Range', pp.preferredAgeRange?.min && pp.preferredAgeRange?.max ? `${pp.preferredAgeRange.min} - ${pp.preferredAgeRange.max} yrs` : ''],
                ['Preferred Height Range', pp.preferredHeightRange?.min && pp.preferredHeightRange?.max ? `${pp.preferredHeightRange.min} - ${pp.preferredHeightRange.max} cm` : ''],
                ['Marital Status Preference', pp.maritalStatusPreference || pp.maritalStatus],
                ['Education Preference', pp.educationPreference || pp.education],
                ['Caste Preference', pp.castePreference],
                ['Dosham Requirement', pp.doshamPreference || pp.horoscopeRequired],
                ['Preferred Location', pp.locationPreference || pp.location],
              ]}
            />
          </SectionCard>
        </div>
      </div>

      {/* Admin Profile Edit Modal */}
      {isEditModalOpen && (
        <AdminProfileEditModal
          profile={profile}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={handleProfileSaved}
        />
      )}

      {/* Admin Candidate Photo Manager Modal */}
      <AdminPhotoManagerModal
        profile={profile}
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        onPhotosUpdated={handlePhotosUpdated}
      />

      {/* Custom Confirmation / Prompt Modal (Replaces browser window.confirm / window.prompt) */}
      {modalState.open && (
        <div className="adm-modal-center" onClick={() => !processing && setModalState({ open: false, action: '', title: '', message: '' })}>
          <div className="adm-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="adm-dialog-header">
              <h3>
                <ShieldCheck size={18} color="var(--a-brand)" /> {modalState.title}
              </h3>
              <button
                type="button"
                className="adm-x"
                disabled={processing}
                onClick={() => setModalState({ open: false, action: '', title: '', message: '' })}
              >
                <X size={16} />
              </button>
            </div>
            <div className="adm-dialog-body">
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--a-ink)', lineHeight: 1.5 }}>
                {modalState.message}
              </p>
              {modalState.action === 'invite' && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--a-ink)', marginBottom: '0.35rem' }}>
                    Recipient Email Address:
                  </label>
                  <input
                    type="email"
                    value={modalState.inputVal}
                    onChange={(e) => setModalState((prev) => ({ ...prev, inputVal: e.target.value }))}
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
                disabled={processing}
                onClick={() => setModalState({ open: false, action: '', title: '', message: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleConfirmModalAction}
                style={{
                  background: modalState.confirmColor || 'var(--a-brand)',
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
                {processing ? 'Processing...' : modalState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
