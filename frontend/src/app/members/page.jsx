'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Bookmark,
  Briefcase,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Compass,
  Copy,
  CreditCard,
  Eye,
  FileText,
  GraduationCap,
  Handshake,
  Heart,
  Hourglass,
  KeyRound,
  Landmark,
  Languages,
  Layers,
  Lock,
  MapPin,
  Moon,
  Phone,
  PhoneCall,
  RotateCcw,
  Ruler,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users,
  X,
  ZoomIn,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getMemberDirectoryApi, unlockMemberContactApi } from '@/lib/api';
import styles from './members.module.css';

const RASI_OPTIONS = [
  'Mesham (Aries)', 'Rishabam (Taurus)', 'Mithunam (Gemini)', 'Kadagam (Cancer)',
  'Simmam (Leo)', 'Kanni (Virgo)', 'Thulaam (Libra)', 'Viruchigam (Scorpio)',
  'Dhanusu (Sagittarius)', 'Magaram (Capricorn)', 'Kumbam (Aquarius)', 'Meenam (Pisces)',
];

const NAKSHATRAM_OPTIONS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashirsha', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

const POPULAR_CASTES = [
  'Vanniyar',
  'Mudaliar',
  'Pillai',
  'Chettiar',
  'Brahmin - Iyer',
  'Brahmin - Iyengar',
  'Nadar',
  'Naidu',
  'Reddiar',
  'Viswakarma',
  'Kongu Vellalar',
  'Thevar / Mukkulathor',
  'Sengunthar / Kaikolar',
  'Yadava',
  'Gounder',
  'Sourashtra',
  'Devanga',
  'Adidravidar',
  'Naicker',
  'Muthuraja',
  'Intercaste',
];

const EMPTY_FILTERS = {
  gender: '',
  minAge: '',
  maxAge: '',
  minHeight: '',
  maxHeight: '',
  maritalStatus: '',
  location: '',
  education: '',
  occupation: '',
  religion: '',
  caste: '',
  subcaste: '',
  gothram: '',
  rasi: '',
  nakshatram: '',
  diet: '',
  dosham: '',
};

const FILTER_LABELS = {
  gender: 'Looking For',
  maritalStatus: 'Status',
  location: 'City / Location',
  education: 'Education',
  occupation: 'Profession',
  religion: 'Religion',
  caste: 'Caste',
  subcaste: 'Subcaste',
  gothram: 'Gothram',
  rasi: 'Rasi',
  nakshatram: 'Nakshatram',
  diet: 'Diet',
  dosham: 'Dosham Status',
};

function formatDateDisplay(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

function formatHeightDisplay(heightVal) {
  if (!heightVal) return '–';
  const num = Number(heightVal);
  if (isNaN(num) || num <= 0) return String(heightVal);
  const totalInches = num / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet} ft ${inches} in (${num} cm)`;
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button type="button" className={styles.iconBtn} onClick={copy} aria-label="Copy phone number" title="Copy to clipboard">
      {copied ? <Check size={14} color="#15803d" /> : <Copy size={14} />}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className={`${styles.matchCard} ${styles.skeleton}`} aria-hidden="true">
      <div className={styles.skPhotoCol} />
      <div className={styles.skBioCol}>
        <div className={styles.skLine} style={{ width: '45%', height: '28px' }} />
        <div className={styles.skGrid}>
          <div className={styles.skLine} style={{ width: '90%', height: '18px' }} />
          <div className={styles.skLine} style={{ width: '85%', height: '18px' }} />
          <div className={styles.skLine} style={{ width: '90%', height: '18px' }} />
          <div className={styles.skLine} style={{ width: '80%', height: '18px' }} />
          <div className={styles.skLine} style={{ width: '90%', height: '18px' }} />
          <div className={styles.skLine} style={{ width: '85%', height: '18px' }} />
        </div>
        <div className={styles.skLine} style={{ width: '100%', height: '40px', borderRadius: '10px' }} />
      </div>
      <div className={styles.skActionCol}>
        <div className={styles.skLine} style={{ width: '100%', height: '42px', borderRadius: '12px' }} />
        <div className={styles.skLine} style={{ width: '100%', height: '65px', borderRadius: '14px' }} />
        <div className={styles.skLine} style={{ width: '100%', height: '40px', borderRadius: '12px' }} />
      </div>
    </div>
  );
}

export default function MemberDirectoryPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  // Directory data, credit summary & pagination
  const [profiles, setProfiles] = useState([]);
  const [subscriptionAccess, setSubscriptionAccess] = useState(null);
  const [creditSummary, setCreditSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, totalRecords: 0, totalPages: 1 });

  // Shortlist & photo lightbox zoom state
  const [shortlistedMap, setShortlistedMap] = useState({});
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('varaghi_shortlisted_ids');
      if (saved) setShortlistedMap(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleShortlist = (id) => {
    setShortlistedMap((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem('varaghi_shortlisted_ids', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Per-card contact unlock state
  const [unlockingByProfileId, setUnlockingByProfileId] = useState({});
  const [unlockedContactsByProfileId, setUnlockedContactsByProfileId] = useState({});
  const [unlockErrorByProfileId, setUnlockErrorByProfileId] = useState({});

  // Search & filters
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [form, setForm] = useState(EMPTY_FILTERS);
  const [activeFilters, setActiveFilters] = useState(EMPTY_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Status & access gating
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
          ...targetFilters,
        });

        if (res.status === 401) {
          setProfiles([]);
          setSubscriptionAccess(null);
          setCreditSummary(null);
          setAccessDenialCode('UNAUTHENTICATED');
          setAccessDenialMessage('Please sign in or register for a free account to browse matching matrimonial profiles.');
          setLoading(false);
          return;
        }

        if (res.status === 403) {
          setProfiles([]);
          setSubscriptionAccess(res.subscriptionAccess || null);
          setCreditSummary(null);
          setAccessDenialCode(res.code || 'NO_SUBSCRIPTION');
          setAccessDenialMessage(res.message || 'An active subscription is required to browse profiles.');
          setLoading(false);
          return;
        }

        if (res.success) {
          setAccessDenialCode(null);
          setAccessDenialMessage('');
          setProfiles(res.data || []);
          setSubscriptionAccess(res.subscriptionAccess || null);
          setCreditSummary(res.credits || res.subscriptionAccess?.credits || null);
          if (res.pagination) setPagination(res.pagination);
        } else {
          setErrorMessage(res.message || 'Failed to load profiles.');
        }
      } catch {
        setErrorMessage('Network connection error while loading member profiles.');
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    fetchMembers(page, limit, activeSearch, activeFilters);
  }, [page, limit, activeSearch, activeFilters, fetchMembers]);

  // Lock body scroll while the mobile filter drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    setActiveSearch(searchTerm.trim());
    setActiveFilters({
      ...form,
      location: form.location.trim(),
      education: form.education.trim(),
      occupation: form.occupation.trim(),
      caste: form.caste.trim(),
      subcaste: form.subcaste.trim(),
      gothram: form.gothram.trim(),
      diet: form.diet.trim(),
      dosham: form.dosham.trim(),
    });
    setDrawerOpen(false);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setActiveSearch('');
    setForm(EMPTY_FILTERS);
    setActiveFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const removeChip = (keys) => {
    const list = Array.isArray(keys) ? keys : [keys];
    if (list.includes('search')) {
      setSearchTerm('');
      setActiveSearch('');
    }
    const patch = Object.fromEntries(list.filter((k) => k !== 'search').map((k) => [k, '']));
    setForm((f) => ({ ...f, ...patch }));
    setActiveFilters((a) => ({ ...a, ...patch }));
    setPage(1);
  };

  // Active filter chips
  const chips = useMemo(() => {
    const list = [];
    if (activeSearch) list.push({ id: 'search', keys: 'search', label: `“${activeSearch}”` });
    Object.keys(FILTER_LABELS).forEach((k) => {
      if (!activeFilters[k]) return;
      let shown = activeFilters[k];
      if (k === 'gender') {
        shown = activeFilters[k] === 'Female' ? 'Bride' : activeFilters[k] === 'Male' ? 'Groom' : activeFilters[k];
        list.push({ id: k, keys: k, label: shown });
        return;
      }
      if (k === 'dosham') {
        shown =
          activeFilters[k] === 'no_dosham'
            ? 'Dosham Free / No Chevvai'
            : activeFilters[k] === 'chevvai'
            ? 'Chevvai / Sevvai Dosham'
            : activeFilters[k] === 'rahu_ketu'
            ? 'Rahu / Ketu Dosham'
            : activeFilters[k];
        list.push({ id: k, keys: k, label: shown });
        return;
      }
      list.push({ id: k, keys: k, label: `${FILTER_LABELS[k]}: ${shown}` });
    });
    if (activeFilters.minAge || activeFilters.maxAge) {
      list.push({
        id: 'age',
        keys: ['minAge', 'maxAge'],
        label: `Age: ${activeFilters.minAge || 18}–${activeFilters.maxAge || 'any'}`,
      });
    }
    if (activeFilters.minHeight || activeFilters.maxHeight) {
      list.push({
        id: 'height',
        keys: ['minHeight', 'maxHeight'],
        label: `Height: ${activeFilters.minHeight || 140}–${activeFilters.maxHeight || 200} cm`,
      });
    }
    return list;
  }, [activeSearch, activeFilters]);

  const activeFilterCount = chips.length;

  const handleQuickGender = (val) => {
    setForm((f) => ({ ...f, gender: val }));
    setActiveFilters((a) => ({ ...a, gender: val }));
    setPage(1);
  };

  // Sorting profiles client-side
  const sortedProfiles = useMemo(() => {
    const list = [...profiles];
    if (sortBy === 'age_asc') {
      return list.sort((a, b) => (a.personalDetails?.age || 0) - (b.personalDetails?.age || 0));
    }
    if (sortBy === 'age_desc') {
      return list.sort((a, b) => (b.personalDetails?.age || 0) - (a.personalDetails?.age || 0));
    }
    if (sortBy === 'height_desc') {
      return list.sort((a, b) => (b.personalDetails?.height || 0) - (a.personalDetails?.height || 0));
    }
    return list;
  }, [profiles, sortBy]);

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
          setCreditSummary((prev) => ({ ...(prev || {}), ...res.data.credits }));
        }

        setProfiles((prev) => prev.map((item) => (item.id === profileId ? { ...item, isContactUnlocked: true } : item)));
      } else {
        if (res.credits) {
          setCreditSummary((prev) => ({ ...(prev || {}), ...res.credits }));
        }

        let contextualMessage = res.message || 'Unable to unlock candidate contact number right now.';

        if (res.code === 'CREDITS_EXHAUSTED') {
          contextualMessage = res.message || 'You have used all 50 contact credits for your current monthly cycle.';
        } else if (res.code === 'PHONE_NOT_AVAILABLE') {
          contextualMessage = 'Candidate phone number is not available for this profile. No credit was deducted.';
        } else if (res.code === 'GRACE_PERIOD_CONTACTS_LOCKED' || res.code === 'GRACE_PERIOD_CONTACT_RESTRICTED') {
          contextualMessage = 'Contact unlocking is disabled during your 7-day grace period. Please renew your subscription.';
        } else if (
          res.code === 'NO_SUBSCRIPTION' ||
          res.code === 'SUBSCRIPTION_EXPIRED' ||
          res.code === 'SUBSCRIPTION_REQUIRED'
        ) {
          contextualMessage = 'An active subscription is required to view candidate contact numbers.';
        } else if (res.code === 'PROFILE_NOT_FOUND' || res.code === 'PROFILE_NOT_ELIGIBLE') {
          contextualMessage = 'This profile is no longer active or eligible for contact unlocking. No credit was deducted.';
        }

        setUnlockErrorByProfileId((prev) => ({ ...prev, [profileId]: contextualMessage }));
      }
    } catch {
      setUnlockErrorByProfileId((prev) => ({
        ...prev,
        [profileId]: 'Network error while unlocking contact. Please try again.',
      }));
    } finally {
      setUnlockingByProfileId((prev) => ({ ...prev, [profileId]: false }));
    }
  };

  /* ------------------------------------------------------------------ */
  /* Access denied views                                                */
  /* ------------------------------------------------------------------ */
  if (!loading && accessDenialCode) {
    const isUnauthenticated = accessDenialCode === 'UNAUTHENTICATED' || !currentUser;
    const isExpired = accessDenialCode === 'SUBSCRIPTION_EXPIRED';

    return (
      <div className={styles.page}>
        <section className={styles.gate}>
          <span className={styles.gateIcon}>
            {isExpired ? <Hourglass size={34} strokeWidth={1.6} aria-hidden="true" /> : <Lock size={34} strokeWidth={1.6} aria-hidden="true" />}
          </span>
          <span className={styles.kicker}>Sacred Matrimonial Registry</span>
          <h1>
            {isUnauthenticated
              ? 'Sign in to Explore Verified Matches'
              : isExpired
              ? 'Your Membership Cycle Has Concluded'
              : 'Active Membership Required to Browse'}
          </h1>
          <p>
            {isUnauthenticated
              ? 'Sign in with your account or register free to discover auspicious profiles across Tamil Nadu and South India with full privacy safeguards.'
              : isExpired
              ? accessDenialMessage ||
                'Your subscription has expired. Renew your plan to unlock contact credentials and browse full biodata.'
              : accessDenialMessage ||
                'Subscribe to a 3-month or 6-month royal plan to unlock direct contact access and astrological porutham details.'}
          </p>
          <ul className={styles.gateList}>
            <li><CheckCircle2 size={16} aria-hidden="true" color="var(--gold)" /> Exhaustive Biodata with Vedic Astrology &amp; Sibling Breakdown</li>
            <li><CheckCircle2 size={16} aria-hidden="true" color="var(--gold)" /> 50 Contact Credits every 30 days</li>
            <li><CheckCircle2 size={16} aria-hidden="true" color="var(--gold)" /> Golden Privacy Shield: Phones protected until explicitly unlocked</li>
          </ul>
          <div className={styles.gateActions}>
            {isUnauthenticated ? (
              <>
                <Link href="/login?redirect=/members" className={styles.btnPrimary}>Sign In to Account</Link>
                <Link href="/register" className={styles.btnOutline}>Register Free</Link>
              </>
            ) : (
              <>
                <Link href="/membership" className={styles.btnPrimary}>
                  View Membership Plans <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link href="/" className={styles.btnOutline}>Return Home</Link>
              </>
            )}
          </div>
        </section>
      </div>
    );
  }

  const isActiveAccess = subscriptionAccess?.accessMode === 'active';
  const isGraceAccess = Boolean(subscriptionAccess?.inGracePeriod);
  const remaining = creditSummary?.creditsRemaining ?? 0;
  const allocated = creditSummary?.creditsAllocated ?? 50;
  const creditPct = allocated > 0 ? Math.max(0, Math.min(100, (remaining / allocated) * 100)) : 0;

  const filterPanel = (
    <form onSubmit={handleApplyFilters} className={styles.filterForm}>
      <div className={styles.filterHead}>
        <h2><SlidersHorizontal size={17} aria-hidden="true" /> Filter Matches</h2>
        <button type="button" className={styles.drawerClose} onClick={() => setDrawerOpen(false)} aria-label="Close filters">
          <X size={20} />
        </button>
      </div>

      {/* Gender / Looking For */}
      <fieldset className={styles.group}>
        <legend>Looking For</legend>
        <div className={styles.segmented} role="radiogroup" aria-label="Gender">
          {[
            ['', 'All'],
            ['Female', 'Bride'],
            ['Male', 'Groom'],
          ].map(([val, label]) => (
            <button
              type="button"
              key={label}
              role="radio"
              aria-checked={form.gender === val}
              className={form.gender === val ? styles.segOn : ''}
              onClick={() => setForm((f) => ({ ...f, gender: val }))}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Age Range */}
      <fieldset className={styles.group}>
        <legend>Age Range</legend>
        <div className={styles.range}>
          <input type="number" min="18" max="90" placeholder="Min" value={form.minAge} onChange={setField('minAge')} aria-label="Minimum age" />
          <span>to</span>
          <input type="number" min="18" max="90" placeholder="Max" value={form.maxAge} onChange={setField('maxAge')} aria-label="Maximum age" />
        </div>
      </fieldset>

      {/* Height Range */}
      <fieldset className={styles.group}>
        <legend>Height Range (cm)</legend>
        <div className={styles.range}>
          <input type="number" min="120" max="220" placeholder="Min cm" value={form.minHeight} onChange={setField('minHeight')} aria-label="Minimum height" />
          <span>to</span>
          <input type="number" min="120" max="220" placeholder="Max cm" value={form.maxHeight} onChange={setField('maxHeight')} aria-label="Maximum height" />
        </div>
      </fieldset>

      {/* Marital Status */}
      <div className={styles.group}>
        <label htmlFor="f-marital">Marital Status</label>
        <select id="f-marital" value={form.maritalStatus} onChange={setField('maritalStatus')}>
          <option value="">Any Status</option>
          <option value="Never Married">Never Married</option>
          <option value="Divorced">Divorced</option>
          <option value="Widowed">Widowed</option>
          <option value="Awaiting Divorce">Awaiting Divorce</option>
        </select>
      </div>

      {/* Vedic Astrology - Rasi */}
      <div className={styles.group}>
        <label htmlFor="f-rasi">Rasi (Moon Sign)</label>
        <select id="f-rasi" value={form.rasi} onChange={setField('rasi')}>
          <option value="">Any Rasi</option>
          {RASI_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Vedic Astrology - Nakshatram */}
      <div className={styles.group}>
        <label htmlFor="f-nakshatram">Nakshatram (Birth Star)</label>
        <select id="f-nakshatram" value={form.nakshatram} onChange={setField('nakshatram')}>
          <option value="">Any Nakshatram</option>
          {NAKSHATRAM_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Vedic Astrology - Chevvai / Sevvai Dosham */}
      <div className={styles.group}>
        <label htmlFor="f-dosham">Chevvai / Sevvai Dosham</label>
        <select id="f-dosham" value={form.dosham} onChange={setField('dosham')}>
          <option value="">Any Dosham Status</option>
          <option value="no_dosham">No Chevvai Dosham (Dosham Free)</option>
          <option value="chevvai">Has Chevvai / Sevvai Dosham</option>
          <option value="rahu_ketu">Has Rahu / Ketu / Naga Dosham</option>
        </select>
      </div>

      {/* Community / Caste */}
      <div className={styles.group}>
        <label htmlFor="f-caste">Caste / Community</label>
        <input
          id="f-caste"
          type="text"
          list="caste-suggestions"
          placeholder="e.g. Vanniyar, Mudaliar, Brahmin"
          value={form.caste}
          onChange={setField('caste')}
          maxLength={100}
        />
        <datalist id="caste-suggestions">
          {POPULAR_CASTES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      {/* Subcaste */}
      <div className={styles.group}>
        <label htmlFor="f-subcaste">Subcaste</label>
        <input id="f-subcaste" type="text" placeholder="e.g. Padayachi, Thondaimandalam" value={form.subcaste} onChange={setField('subcaste')} maxLength={100} />
      </div>

      {/* Gothram */}
      <div className={styles.group}>
        <label htmlFor="f-gothram">Gothram / Kulam</label>
        <input id="f-gothram" type="text" placeholder="e.g. Shiva, Vishvamitra, Koundinya" value={form.gothram} onChange={setField('gothram')} maxLength={100} />
      </div>

      {/* Location */}
      <div className={styles.group}>
        <label htmlFor="f-location">Location / Native City</label>
        <input id="f-location" type="text" placeholder="e.g. Chennai, Coimbatore, Madurai, Bangalore" value={form.location} onChange={setField('location')} maxLength={100} />
      </div>

      {/* Education */}
      <div className={styles.group}>
        <label htmlFor="f-education">Education</label>
        <input id="f-education" type="text" placeholder="e.g. B.Tech, MBA, MBBS, MCA" value={form.education} onChange={setField('education')} maxLength={100} />
      </div>

      {/* Occupation */}
      <div className={styles.group}>
        <label htmlFor="f-occupation">Occupation / Career</label>
        <input id="f-occupation" type="text" placeholder="e.g. Software, Banking, Doctor, Government" value={form.occupation} onChange={setField('occupation')} maxLength={100} />
      </div>

      {/* Diet */}
      <div className={styles.group}>
        <label htmlFor="f-diet">Diet</label>
        <select id="f-diet" value={form.diet} onChange={setField('diet')}>
          <option value="">Any Diet</option>
          <option value="Vegetarian">Vegetarian</option>
          <option value="Non-Vegetarian">Non-Vegetarian</option>
          <option value="Eggetarian">Eggetarian</option>
        </select>
      </div>

      <div className={styles.filterActions}>
        <button type="submit" className={styles.btnPrimary} disabled={loading}>
          <Search size={16} aria-hidden="true" /> Apply Filters
        </button>
        <button type="button" className={styles.btnText} onClick={handleResetFilters} disabled={loading}>
          <RotateCcw size={14} aria-hidden="true" /> Reset All
        </button>
      </div>
    </form>
  );

  return (
    <div className={styles.page}>
      {/* ------------------------------ Hero Header ------------------------------ */}
      <header className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <img
          src="/images/varaghi/mandala-watermark.png"
          alt=""
          className={styles.mandalaWatermark}
          aria-hidden="true"
        />
        <img
          src="/images/varaghi/gold-corner.png"
          alt=""
          className={styles.goldCornerTopRight}
          aria-hidden="true"
        />
        <img
          src="/images/varaghi/gold-corner.png"
          alt=""
          className={styles.goldCornerTopLeft}
          aria-hidden="true"
        />

        <div className={styles.heroInner}>
          <div className={styles.heroTextWrap}>
            <nav className={styles.crumbs} aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <ChevronRight size={14} aria-hidden="true" />
              <span>Verified Matches</span>
            </nav>
            <span className={styles.kicker} style={{ marginTop: '0.4rem' }}>ஸ்ரீ வாராஹி திருமண தகவல் மையம்</span>
            <h1>உண்மையான வரன்கள் — Browse Matches</h1>
            <p>தமிழ்நாட்டில் மிகவும் நம்பகரமான திருமணத்தகவல் சேவை. மதம், ஜாதி, எல்லை கடந்து இணைக்கும் உண்மையான உறவுகள்.</p>
          </div>

          {isActiveAccess && creditSummary && (
            <aside className={styles.credits} role="region" aria-label="Monthly contact credits">
              <div className={styles.creditsTop}>
                <span><CreditCard size={16} aria-hidden="true" /> Contact Credits</span>
                {creditSummary.cycleNumber && (
                  <em>
                    Cycle {creditSummary.cycleNumber}
                    {creditSummary.totalCycles ? ` of ${creditSummary.totalCycles}` : ''}
                  </em>
                )}
              </div>
              <div className={styles.creditsNum}>
                <strong>{remaining}</strong>
                <span>/ {allocated} Available</span>
              </div>
              <div className={styles.bar} aria-hidden="true">
                <i style={{ width: `${creditPct}%` }} />
              </div>
              <p>
                {creditSummary.cycleStart && creditSummary.cycleEnd
                  ? `Resets on ${formatDateDisplay(creditSummary.cycleEnd)}`
                  : 'Monthly credits reset every 30 days'}
                {' · '}{creditSummary.creditsUsed ?? 0} unlocked this cycle
              </p>
            </aside>
          )}
        </div>
      </header>

      <div className={styles.container}>
        {isGraceAccess && (
          <div className={styles.notice} role="status">
            <AlertCircle size={20} aria-hidden="true" />
            <div>
              <strong>7-day grace period active.</strong> Your membership term has concluded. You can continue browsing profiles
              {subscriptionAccess.gracePeriodEndDate ? ` until ${formatDateDisplay(subscriptionAccess.gracePeriodEndDate)}` : ''}, but
              contact unlocking is disabled until renewal.
              <Link href="/membership"> Renew Membership</Link>
            </div>
          </div>
        )}

        <div className={styles.shell}>
          {/* ------------------------------ Sidebar ------------------------------ */}
          <aside className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ''}`} aria-label="Search filters">
            {filterPanel}
          </aside>
          {drawerOpen && <div className={styles.backdrop} onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

          {/* ------------------------------ Results Section ------------------------------ */}
          <section className={styles.results} aria-live="polite">
            <form className={styles.searchBar} onSubmit={handleApplyFilters} role="search">
              <Search size={18} aria-hidden="true" />
              <input
                type="text"
                placeholder="Search candidate name, city, caste, or profession..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                maxLength={100}
                aria-label="Search profiles"
              />
              <button type="submit" disabled={loading}>Search</button>
            </form>

            {/* Top Quick Filters & Filter Trigger */}
            <div className={styles.topFilterBar}>
              <div className={styles.quickGenderGroup} role="radiogroup" aria-label="Looking For">
                <button
                  type="button"
                  className={`${styles.quickGenderBtn} ${!activeFilters.gender ? styles.quickGenderActive : ''}`}
                  onClick={() => handleQuickGender('')}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  <span>All Matches</span>
                </button>
                <button
                  type="button"
                  className={`${styles.quickGenderBtn} ${activeFilters.gender === 'Female' ? styles.quickGenderActive : ''}`}
                  onClick={() => handleQuickGender('Female')}
                >
                  <Heart size={14} aria-hidden="true" />
                  <span>Brides (மணமகள்)</span>
                </button>
                <button
                  type="button"
                  className={`${styles.quickGenderBtn} ${activeFilters.gender === 'Male' ? styles.quickGenderActive : ''}`}
                  onClick={() => handleQuickGender('Male')}
                >
                  <Users size={14} aria-hidden="true" />
                  <span>Grooms (மணமகன்)</span>
                </button>
              </div>

              <button type="button" className={styles.filterTriggerBtn} onClick={() => setDrawerOpen(true)}>
                <SlidersHorizontal size={15} aria-hidden="true" />
                <span>All Filters (வடிகட்டிகள்)</span>
                {activeFilterCount > 0 && <span className={styles.filterBadge}>{activeFilterCount}</span>}
              </button>
            </div>

            <div className={styles.toolbar}>
              <p className={styles.count}>
                {loading ? (
                  'Searching eligible profiles…'
                ) : errorMessage ? null : (
                  <>
                    <strong>{pagination.totalRecords}</strong> {pagination.totalRecords === 1 ? 'verified match' : 'verified matches'} found
                  </>
                )}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <label className={styles.perPage}>
                  Sort by
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="newest">Newest First</option>
                    <option value="age_asc">Age: Young to Old</option>
                    <option value="age_desc">Age: Old to Young</option>
                    <option value="height_desc">Height: Tall First</option>
                  </select>
                </label>
                <label className={styles.perPage}>
                  Show
                  <select
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
                </label>
              </div>
            </div>

            {chips.length > 0 && (
              <div className={styles.chips} aria-label="Active filters">
                {chips.map((c) => (
                  <button type="button" key={c.id} onClick={() => removeChip(c.keys)} aria-label={`Remove filter ${c.label}`}>
                    {c.label} <X size={13} aria-hidden="true" />
                  </button>
                ))}
                <button type="button" className={styles.clearAll} onClick={handleResetFilters}>Clear all filters</button>
              </div>
            )}

            {errorMessage && (
              <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
                <AlertCircle size={20} aria-hidden="true" />
                <div>
                  <strong>Unable to load profiles.</strong> {errorMessage}
                </div>
                <button type="button" onClick={() => fetchMembers(page, limit, activeSearch, activeFilters)}>Retry</button>
              </div>
            )}

            {loading && (
              <div className={styles.grid}>
                {Array.from({ length: Math.min(limit, 6) }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}

            {!loading && !errorMessage && sortedProfiles.length === 0 && (
              <div className={styles.empty}>
                <span><Search size={32} strokeWidth={1.5} aria-hidden="true" /></span>
                <h2>{activeFilterCount > 0 ? 'No Matching Profiles' : 'No Profiles Available'}</h2>
                <p>
                  {activeFilterCount > 0
                    ? 'Try expanding the age range, removing specific caste/community filters, or searching nearby districts.'
                    : 'There are currently no active profiles matching your viewing permissions.'}
                </p>
                {activeFilterCount > 0 && (
                  <button type="button" className={styles.btnOutline} onClick={handleResetFilters}>
                    <RotateCcw size={15} aria-hidden="true" /> Reset All Filters
                  </button>
                )}
              </div>
            )}

            {!loading && !errorMessage && sortedProfiles.length > 0 && (
              <>
                <div className={styles.grid}>
                  {sortedProfiles.map((profile) => {
                    const p = profile.personalDetails || {};
                    const edu = profile.educationAndProfession || {};
                    const fam = profile.familyDetails || {};
                    const pref = profile.partnerPreferences || {};
                    const prefAge = pref.preferredAgeRange || {};
                    const comm = profile.communityDetails || {};
                    const h = profile.horoscope || {};

                    const displayName = profile.candidateName || 'Candidate';
                    const initial = displayName.charAt(0).toUpperCase();

                    const isUnlocking = Boolean(unlockingByProfileId[profile.id]);
                    const unlockedInfo = unlockedContactsByProfileId[profile.id] || null;
                    const unlockError = unlockErrorByProfileId[profile.id] || '';
                    const isAlreadyUnlocked = Boolean(profile.isContactUnlocked || unlockedInfo);
                    const creditsExhausted =
                      !isAlreadyUnlocked &&
                      creditSummary &&
                      typeof creditSummary.creditsRemaining === 'number' &&
                      creditSummary.creditsRemaining <= 0;

                    const candidateRefId =
                      profile.refId ||
                      `VM${profile.id ? profile.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() : '123456'}`;

                    // Formatted row data matching reference image exactly
                    const ageDisplay = p.age !== null && p.age !== undefined && p.age !== '' ? `${p.age} Years` : '–';
                    const maritalStatusDisplay = p.maritalStatus || 'Never Married';
                    const currentCityDisplay = p.location || '–';
                    const professionDisplay = edu.occupation || '–';
                    const casteDisplay = comm.caste || '–';
                    const gothramDisplay = comm.gothram || '–';
                    const rasiDisplay = h.rasi || '–';

                    const heightDisplay = formatHeightDisplay(p.height);
                    const nativePlaceDisplay =
                      p.nativity || (fam.familyLocation && fam.familyLocation !== p.location ? fam.familyLocation : null) || '–';
                    const educationDisplay = edu.educationalQualification || '–';
                    const incomeDisplay = edu.income
                      ? (String(edu.income).startsWith('₹') ? edu.income : `₹ ${edu.income} per annum`)
                      : '–';
                    const subcasteDisplay = comm.subcaste || '–';
                    const nakshatramDisplay = h.nakshatram || '–';
                    const doshamDisplay = h.dosham && h.dosham !== 'None' && h.dosham !== 'No Dosham' ? h.dosham : 'No Dosham';

                    const partnerExpectationText =
                      pref.partnerExpectations ||
                      pref.description ||
                      pref.notes ||
                      [
                        prefAge.min || prefAge.max ? `Age ${prefAge.min || 18}–${prefAge.max || ''} yrs` : null,
                        pref.preferredLocation ? `Location: ${pref.preferredLocation}` : null,
                        pref.educationPreference ? `Education: ${pref.educationPreference}` : null,
                        pref.occupationPreference ? `Job: ${pref.occupationPreference}` : null,
                        pref.castePreference ? `Caste: ${pref.castePreference}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') ||
                      'Looking for a well-educated, professionally settled, family-oriented match with similar values.';

                    const isShortlisted = Boolean(shortlistedMap[profile.id]);

                    return (
                      <article key={profile.id} className={styles.matchCard}>
                        {/* Column 1: Portrait Photo */}
                        <div className={styles.matchPhotoCol}>
                          <div className={styles.matchPhotoFrame}>
                            {profile.profilePhotoUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={profile.profilePhotoUrl} alt={`${displayName} portrait`} loading="lazy" />
                            ) : (
                              <div className={styles.matchPhotoPlaceholder}>
                                <span>{initial}</span>
                              </div>
                            )}

                            <span className={styles.matchVerifiedPill}>
                              <CheckCircle2 size={13} strokeWidth={2.5} aria-hidden="true" />
                              <span>Verified</span>
                            </span>

                            <span className={styles.matchPhotoCountPill}>
                              <Camera size={13} aria-hidden="true" />
                              <span>{Array.isArray(profile.photos) && profile.photos.length > 0 ? `1 / ${profile.photos.length}` : '1 / 1'}</span>
                            </span>

                            {profile.profilePhotoUrl && (
                              <button
                                type="button"
                                className={styles.matchPhotoZoomBtn}
                                onClick={() => setZoomPhotoUrl(profile.profilePhotoUrl)}
                                aria-label={`Zoom ${displayName}'s photo`}
                                title="Zoom Photo"
                              >
                                <ZoomIn size={14} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Column 2: Essential Matrimonial Biodata (Streamlined & Clean) */}
                        <div className={styles.matchBioCol}>
                          <div className={styles.cleanHeader}>
                            <div className={styles.nameGroup}>
                              <Link href={`/members/${profile.id}`} className={styles.candidateNameLink}>
                                <h3 className={styles.candidateName}>{displayName}</h3>
                              </Link>
                            </div>
                            <div className={styles.statusGroup}>
                              <span className={styles.recentlyActivePill}>
                                <span className={styles.activeDot} />
                                <span>Recently Active</span>
                              </span>
                            </div>
                          </div>

                          {/* 2-Column Clean Key-Value Spec Grid (Core Essentials) */}
                          <div className={styles.cleanSpecTable}>
                            {/* Left Column (Core Personal & Origin) */}
                            <div className={styles.specCol}>
                              <div className={styles.cleanRow}>
                                <div className={styles.cleanKey}>
                                  <Calendar size={15} className={styles.rowIcon} aria-hidden="true" />
                                  <span>Age / Height</span>
                                </div>
                                <span className={styles.colon}>:</span>
                                <span className={styles.cleanVal}>
                                  {p.age ? `${p.age} Yrs` : '–'}{p.height ? `, ${heightDisplay}` : ''}
                                </span>
                              </div>

                              <div className={styles.cleanRow}>
                                <div className={styles.cleanKey}>
                                  <Heart size={15} className={styles.rowIcon} aria-hidden="true" />
                                  <span>Marital Status</span>
                                </div>
                                <span className={styles.colon}>:</span>
                                <span className={styles.cleanVal}>{maritalStatusDisplay}</span>
                              </div>

                              <div className={styles.cleanRow}>
                                <div className={styles.cleanKey}>
                                  <MapPin size={15} className={styles.rowIcon} aria-hidden="true" />
                                  <span>Location</span>
                                </div>
                                <span className={styles.colon}>:</span>
                                <span className={styles.cleanVal} title={currentCityDisplay}>{currentCityDisplay}</span>
                              </div>

                              <div className={styles.cleanRow}>
                                <div className={styles.cleanKey}>
                                  <Users size={15} className={styles.rowIcon} aria-hidden="true" />
                                  <span>Community</span>
                                </div>
                                <span className={styles.colon}>:</span>
                                <span className={styles.cleanVal} title={community || '–'}>{community || '–'}</span>
                              </div>
                            </div>

                            {/* Right Column (Career, Income & Astrology) */}
                            <div className={styles.specCol}>
                              <div className={styles.cleanRow}>
                                <div className={styles.cleanKey}>
                                  <GraduationCap size={15} className={styles.rowIcon} aria-hidden="true" />
                                  <span>Education</span>
                                </div>
                                <span className={styles.colon}>:</span>
                                <span className={styles.cleanVal} title={educationDisplay}>{educationDisplay}</span>
                              </div>

                              <div className={styles.cleanRow}>
                                <div className={styles.cleanKey}>
                                  <Briefcase size={15} className={styles.rowIcon} aria-hidden="true" />
                                  <span>Profession</span>
                                </div>
                                <span className={styles.colon}>:</span>
                                <span className={styles.cleanVal} title={professionDisplay}>{professionDisplay}</span>
                              </div>

                              <div className={styles.cleanRow}>
                                <div className={styles.cleanKey}>
                                  <Coins size={15} className={styles.rowIcon} aria-hidden="true" />
                                  <span>Income</span>
                                </div>
                                <span className={styles.colon}>:</span>
                                <span className={styles.cleanVal} title={incomeDisplay}>{incomeDisplay}</span>
                              </div>

                              <div className={styles.cleanRow}>
                                <div className={styles.cleanKey}>
                                  <Star size={15} className={styles.rowIcon} aria-hidden="true" />
                                  <span>Star &amp; Rasi</span>
                                </div>
                                <span className={styles.colon}>:</span>
                                <span className={styles.cleanVal} title={horoscopeText || '–'}>
                                  {[h.nakshatram, h.rasi].filter(Boolean).join(' · ') || 'Available upon request'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Partner Expectation banner */}
                          <div className={styles.partnerExpectationBox}>
                            <Handshake size={17} className={styles.expectationIcon} aria-hidden="true" />
                            <div className={styles.expectationContent}>
                              <strong className={styles.expectationTitle}>Partner Expectation:</strong>{' '}
                              <span className={styles.expectationBody}>{partnerExpectationText}</span>
                            </div>
                          </div>
                        </div>

                          {/* Column 3: Dedicated Action Column */}
                          <div className={styles.matchActionCol}>
                            <Link href={`/members/${profile.id}`} className={styles.btnActionView}>
                              <FileText size={16} aria-hidden="true" />
                              <span>View Full Biodata</span>
                              <ArrowRight size={14} aria-hidden="true" />
                            </Link>

                            <div className={styles.unlockContactCard}>
                              <div className={styles.unlockCardHeader}>
                                <PhoneCall size={15} aria-hidden="true" />
                                <span>Unlock Contact Number</span>
                              </div>

                              {unlockedInfo ? (
                                <div className={styles.waterPhoneBoxRevealed} role="status" aria-live="polite">
                                  <div className={styles.revealedPhoneDigitsCol}>
                                    <a href={`tel:${unlockedInfo.candidatePhone}`} className={styles.revealedPhoneNumberLink}>
                                      <Phone size={14} aria-hidden="true" />
                                      <span className={styles.revealingWaterNumber}>{unlockedInfo.candidatePhone}</span>
                                    </a>
                                    <small className={styles.revealedPhoneNote}>
                                      {unlockedInfo.alreadyUnlocked ? 'Previously unlocked' : 'Contact unlocked · 1 credit'}
                                    </small>
                                  </div>
                                  <CopyButton value={unlockedInfo.candidatePhone} />
                                </div>
                              ) : isActiveAccess ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleUnlockContact(profile.id)}
                                    disabled={isUnlocking || creditsExhausted}
                                    className={styles.waterPhoneBoxLocked}
                                    title={isAlreadyUnlocked ? 'Click to reveal candidate contact (Free)' : 'Click to reveal candidate contact (1 Credit)'}
                                  >
                                    <div className={styles.waterPhoneDigitsRow} aria-hidden="true">
                                      <span className={styles.waterBlurredDigits}>+91 98401 28549</span>
                                    </div>

                                    <div className={styles.waterLockBadge}>
                                      {isUnlocking ? (
                                        <span className={styles.lockSpinner} aria-hidden="true" />
                                      ) : (
                                        <Lock size={14} aria-hidden="true" />
                                      )}
                                    </div>
                                  </button>
                                  {unlockError && <p className={styles.unlockError} role="alert">{unlockError}</p>}
                                </>
                              ) : (
                                <p className={styles.locked}>
                                  <Lock size={13} aria-hidden="true" /> Contact unlocking is paused during grace period.
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              className={`${styles.btnShortlist} ${isShortlisted ? styles.btnShortlisted : ''}`}
                              onClick={() => toggleShortlist(profile.id)}
                              aria-label={isShortlisted ? `Remove ${candidateRefId} from shortlist` : `Add ${candidateRefId} to shortlist`}
                            >
                              <Bookmark
                                size={16}
                                fill={isShortlisted ? '#8B0D18' : 'none'}
                                color="#8B0D18"
                                aria-hidden="true"
                              />
                              <span>{isShortlisted ? 'Shortlisted' : 'Shortlist'}</span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                </div>

                {pagination.totalPages > 1 && (
                  <nav className={styles.pager} aria-label="Pagination">
                    <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={loading || pagination.page <= 1}>
                      <ChevronLeft size={16} aria-hidden="true" /> Prev
                    </button>
                    <div className={styles.pages}>
                      {pageWindow(pagination.page, pagination.totalPages).map((n, i) =>
                        n === '…' ? (
                          <span key={`e${i}`} className={styles.dots}>…</span>
                        ) : (
                          <button
                            type="button"
                            key={n}
                            className={n === pagination.page ? styles.pageOn : ''}
                            onClick={() => setPage(n)}
                            disabled={loading}
                            aria-current={n === pagination.page ? 'page' : undefined}
                            aria-label={`Page ${n}`}
                          >
                            {n}
                          </button>
                        )
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                      disabled={loading || pagination.page >= pagination.totalPages}
                    >
                      Next <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* Enlarged Photo Lightbox Modal */}
      {zoomPhotoUrl && (
        <div
          className={styles.lightboxBackdrop}
          onClick={() => setZoomPhotoUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged photo preview"
        >
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.lightboxCloseBtn}
              onClick={() => setZoomPhotoUrl(null)}
              aria-label="Close preview"
            >
              <X size={20} aria-hidden="true" />
            </button>
            <img src={zoomPhotoUrl} alt="Enlarged portrait" className={styles.lightboxImg} />
          </div>
        </div>
      )}
    </div>
  );
}
