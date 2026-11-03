'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  User,
  GraduationCap,
  Users,
  Heart,
  Camera,
  ArrowLeft,
  Trash2,
  Star,
  Upload,
  Plus,
  Phone,
  Compass,
  Sparkles,
} from 'lucide-react';
import {
  getAdminMeApi,
  createBrokerProfileApi,
  addAdminCandidatePhotoApi,
} from '@/lib/api';

// Curated Matrimonial Options matching user biodata entry
const GENDER_OPTIONS = ['Female', 'Male', 'Other'];

const MARITAL_STATUS_OPTIONS = [
  'Never Married',
  'Divorced',
  'Widowed',
  'Awaiting Divorce',
];

const MOTHER_TONGUES = [
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Hindi',
  'English',
  'Marathi',
  'Gujarati',
  'Bengali',
  'Other',
];

const RELIGIONS = [
  'Hindu',
  'Christian',
  'Muslim',
  'Jain',
  'Sikh',
  'Buddhist',
  'Other',
];

const BLOOD_GROUPS = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];

const COMPLEXION_OPTIONS = [
  'Very Fair',
  'Fair',
  'Wheatish',
  'Wheatish Brown',
  'Dark',
];

const DIET_OPTIONS = ['Vegetarian', 'Non-Vegetarian', 'Eggetarian'];

const RASI_OPTIONS = [
  'Mesham (Aries)',
  'Rishabham (Taurus)',
  'Mithunam (Gemini)',
  'Kadagam (Cancer)',
  'Simmam (Leo)',
  'Kanni (Virgo)',
  'Thulaam (Libra)',
  'Viruchigam (Scorpio)',
  'Dhanusu (Sagittarius)',
  'Magaram (Capricorn)',
  'Kumbam (Aquarius)',
  'Meenam (Pisces)',
];

const NAKSHATRAM_OPTIONS = [
  'Ashwini',
  'Bharani',
  'Krittika',
  'Rohini',
  'Mrigashira',
  'Ardra',
  'Punarvasu',
  'Pushya',
  'Ashlesha',
  'Magha',
  'Purva Phalguni',
  'Uttara Phalguni',
  'Hasta',
  'Chitra',
  'Swati',
  'Vishakha',
  'Anuradha',
  'Jyeshtha',
  'Mula',
  'Purva Ashadha',
  'Uttara Ashadha',
  'Shravana',
  'Dhanishta',
  'Shatabhisha',
  'Purva Bhadrapada',
  'Uttara Bhadrapada',
  'Revati',
];

const DOSHAM_OPTIONS = [
  'No Dosham',
  'Chevvai Dosham (Manglik)',
  'Rahu / Ketu Dosham',
  'Naga Dosham',
  'Kalasarpa Dosham',
  'Don’t Know',
];

const DASA_PLANETS = [
  'Venus (சுக்கிரன்)',
  'Jupiter (குரு)',
  'Mars (செவ்வாய்)',
  'Saturn (சனி)',
  'Sun (சூரியன்)',
  'Moon (சந்திரன்)',
  'Mercury (புதன்)',
  'Rahu (ராகு)',
  'Ketu (கேது)',
];

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export default function NewBrokerProfilePage() {
  const router = useRouter();

  // Authorization & Page State
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Address sync
  const [sameAsPresentAddress, setSameAsPresentAddress] = useState(false);

  // Form State (Complete symmetry with user candidate entry)
  const [formData, setFormData] = useState({
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    personalDetails: {
      gender: '',
      dateOfBirth: '',
      birthHour: '09',
      birthMinute: '00',
      birthPeriod: 'AM',
      placeOfBirth: '',
      nativity: '',
      height: '',
      weight: '',
      bloodGroup: '',
      complexion: '',
      diet: '',
      physicalStatus: 'Normal',
      disabilityDetails: '',
      maritalStatus: '',
      motherTongue: 'Tamil',
      location: '',
      presentAddress: '',
      permanentAddress: '',
      contactPerson: 'Self',
      alternatePhone: '',
    },
    communityDetails: {
      religion: 'Hindu',
      caste: '',
      subcaste: '',
      gothram: '',
    },
    horoscope: {
      rasi: '',
      nakshatram: '',
      padam: '',
      lagnam: '',
      dosham: '',
      dasaBalance: {
        planet: '',
        years: '',
        months: '',
        days: '',
      },
    },
    educationAndProfession: {
      educationalQualification: '',
      occupation: '',
      company: '',
      workLocation: '',
      income: '',
    },
    familyDetails: {
      fatherName: '',
      fatherAlive: 'Yes',
      fatherOccupation: '',
      motherName: '',
      motherAlive: 'Yes',
      motherOccupation: '',
      marriedElderBrothers: 0,
      unmarriedElderBrothers: 0,
      marriedYoungerBrothers: 0,
      unmarriedYoungerBrothers: 0,
      marriedElderSisters: 0,
      unmarriedElderSisters: 0,
      marriedYoungerSisters: 0,
      unmarriedYoungerSisters: 0,
      familyInformation: '',
      parentInformation: '',
      siblingInformation: '',
      familyLocation: '',
    },
    partnerPreferences: {
      preferredAgeRange: {
        min: '',
        max: '',
      },
      maritalStatusPreference: [],
      dietPreference: [],
      jobRequirement: 'Must',
      horoscopeRequired: 'Yes',
      educationPreference: '',
      occupationPreference: '',
      preferredLocation: '',
      castePreference: '',
      subcastePreference: '',
      incomePreference: '',
      otherPreferences: '',
    },
  });

  // Up to 3 Photo Upload Slots
  const [photoSlots, setPhotoSlots] = useState([
    { file: null, preview: '' },
    { file: null, preview: '' },
    { file: null, preview: '' },
  ]);
  const photoInputRefs = [useRef(null), useRef(null), useRef(null)];

  // Form Feedback & Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formFeedback, setFormFeedback] = useState({ type: '', text: '' });
  const [createdProfile, setCreatedProfile] = useState(null);
  const [uploadedPhotosResults, setUploadedPhotosResults] = useState([]);
  const [photoUploadError, setPhotoUploadError] = useState('');

  // 1. Session verification on mount
  useEffect(() => {
    let isMounted = true;
    async function verifyAdmin() {
      try {
        const res = await getAdminMeApi();
        if (!isMounted) return;

        if (res.status === 401) {
          router.replace('/login');
          return;
        }

        if (res.status === 403 || !res.success || res.data?.role !== 'admin') {
          setAccessDenied(true);
          setAuthLoading(false);
          return;
        }

        setAuthLoading(false);
      } catch (err) {
        if (isMounted) {
          setAccessDenied(true);
          setAuthLoading(false);
        }
      }
    }
    verifyAdmin();
    return () => {
      isMounted = false;
    };
  }, [router]);

  // Handle nested updates
  const handleInputChange = (section, field, value) => {
    if (errors[`${section ? section + '.' : ''}${field}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`${section ? section + '.' : ''}${field}`];
        return next;
      });
    }

    if (!section) {
      setFormData((prev) => ({ ...prev, [field]: value }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value,
        },
      }));
    }
  };

  const handleDeepNestedChange = (section, subSection, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subSection]: {
          ...prev[section][subSection],
          [field]: value,
        },
      },
    }));
  };

  // Multi-select toggle for preferences
  const handleMultiSelectToggle = (field, item) => {
    setFormData((prev) => {
      const currentList = Array.isArray(prev.partnerPreferences[field])
        ? prev.partnerPreferences[field]
        : [];
      const nextList = currentList.includes(item)
        ? currentList.filter((x) => x !== item)
        : [...currentList, item];
      return {
        ...prev,
        partnerPreferences: {
          ...prev.partnerPreferences,
          [field]: nextList,
        },
      };
    });
  };

  // Photo slot handlers
  const handleSlotPhotoSelect = (slotIdx, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type.toLowerCase())) {
      setFormFeedback({
        type: 'error',
        text: 'Unsupported image format. Please select JPG, PNG, or WebP.',
      });
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setFormFeedback({
        type: 'error',
        text: 'Image exceeds maximum allowed size of 5 MB.',
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPhotoSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = { file, preview: objectUrl };
      return next;
    });
    setFormFeedback({ type: '', text: '' });
  };

  const handleRemoveSlotPhoto = (slotIdx) => {
    setPhotoSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = { file: null, preview: '' };
      return next;
    });
    if (photoInputRefs[slotIdx]?.current) {
      photoInputRefs[slotIdx].current.value = '';
    }
  };

  // Form Validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.candidateName.trim()) {
      newErrors.candidateName = 'Candidate name is required.';
    } else if (formData.candidateName.trim().length > 100) {
      newErrors.candidateName = 'Candidate name cannot exceed 100 characters.';
    }

    if (formData.candidateEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.candidateEmail.trim())) {
        newErrors.candidateEmail = 'Please provide a valid email address format.';
      }
    }

    if (formData.candidatePhone.trim() && formData.candidatePhone.trim().length > 25) {
      newErrors.candidatePhone = 'Candidate phone number cannot exceed 25 characters.';
    }

    // Height range validation (if provided)
    if (formData.personalDetails.height) {
      const h = Number(formData.personalDetails.height);
      if (isNaN(h) || h < 50 || h > 260) {
        newErrors.height = 'Height must be between 50 and 260 cm.';
      }
    }

    // Partner Age Preference validation
    const minAge = formData.partnerPreferences.preferredAgeRange.min;
    const maxAge = formData.partnerPreferences.preferredAgeRange.max;
    if (minAge && (Number(minAge) < 18 || Number(minAge) > 100)) {
      newErrors.minAge = 'Minimum age must be between 18 and 100.';
    }
    if (maxAge && (Number(maxAge) < 18 || Number(maxAge) > 100)) {
      newErrors.maxAge = 'Maximum age must be between 18 and 100.';
    }
    if (minAge && maxAge && Number(minAge) > Number(maxAge)) {
      newErrors.minAge = 'Minimum age cannot be greater than maximum age.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFormFeedback({ type: '', text: '' });
    setPhotoUploadError('');
    setUploadedPhotosResults([]);

    if (!validateForm()) {
      setFormFeedback({
        type: 'error',
        text: 'Please correct the validation errors below before submitting.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Prepare payload matching MatrimonialProfile schema
      const tobString = `${formData.personalDetails.birthHour}:${formData.personalDetails.birthMinute} ${formData.personalDetails.birthPeriod}`;

      const payload = {
        candidateName: formData.candidateName.trim(),
        candidateEmail: formData.candidateEmail.trim() || undefined,
        candidatePhone: formData.candidatePhone.trim() || undefined,
        personalDetails: {
          gender: formData.personalDetails.gender || undefined,
          dateOfBirth: formData.personalDetails.dateOfBirth || undefined,
          timeOfBirth: tobString,
          placeOfBirth: formData.personalDetails.placeOfBirth.trim() || undefined,
          nativity: formData.personalDetails.nativity.trim() || undefined,
          height: formData.personalDetails.height ? Number(formData.personalDetails.height) : undefined,
          weight: formData.personalDetails.weight ? Number(formData.personalDetails.weight) : undefined,
          bloodGroup: formData.personalDetails.bloodGroup || undefined,
          complexion: formData.personalDetails.complexion || undefined,
          diet: formData.personalDetails.diet || undefined,
          physicalStatus: formData.personalDetails.physicalStatus || 'Normal',
          disabilityDetails: formData.personalDetails.disabilityDetails.trim() || undefined,
          maritalStatus: formData.personalDetails.maritalStatus || undefined,
          motherTongue: formData.personalDetails.motherTongue.trim() || 'Tamil',
          location: formData.personalDetails.location.trim() || undefined,
          presentAddress: formData.personalDetails.presentAddress.trim() || undefined,
          permanentAddress: (sameAsPresentAddress ? formData.personalDetails.presentAddress : formData.personalDetails.permanentAddress).trim() || undefined,
          contactPerson: formData.personalDetails.contactPerson.trim() || 'Self',
          alternatePhone: formData.personalDetails.alternatePhone.trim() || undefined,
        },
        communityDetails: {
          religion: formData.communityDetails.religion.trim() || 'Hindu',
          caste: formData.communityDetails.caste.trim() || undefined,
          subcaste: formData.communityDetails.subcaste.trim() || undefined,
          gothram: formData.communityDetails.gothram.trim() || undefined,
        },
        horoscope: {
          rasi: formData.horoscope.rasi || undefined,
          nakshatram: formData.horoscope.nakshatram || undefined,
          padam: formData.horoscope.padam ? Number(formData.horoscope.padam) : undefined,
          lagnam: formData.horoscope.lagnam.trim() || undefined,
          dosham: formData.horoscope.dosham
            ? {
                hasChevvaiDosham:
                  formData.horoscope.dosham.toLowerCase().includes('chevvai') ||
                  formData.horoscope.dosham.toLowerCase().includes('sevvai') ||
                  formData.horoscope.dosham.toLowerCase().includes('manglik'),
                hasNagaDosham:
                  formData.horoscope.dosham.toLowerCase().includes('naga') ||
                  formData.horoscope.dosham.toLowerCase().includes('rahu'),
                doshamSummary: formData.horoscope.dosham,
                description: formData.horoscope.dosham,
              }
            : undefined,
          dasaBalance: {
            planet: formData.horoscope.dasaBalance.planet || undefined,
            years: formData.horoscope.dasaBalance.years ? Number(formData.horoscope.dasaBalance.years) : undefined,
            months: formData.horoscope.dasaBalance.months ? Number(formData.horoscope.dasaBalance.months) : undefined,
            days: formData.horoscope.dasaBalance.days ? Number(formData.horoscope.dasaBalance.days) : undefined,
          },
        },
        educationAndProfession: {
          educationalQualification: formData.educationAndProfession.educationalQualification.trim() || undefined,
          occupation: formData.educationAndProfession.occupation.trim() || undefined,
          company: formData.educationAndProfession.company.trim() || undefined,
          workLocation: formData.educationAndProfession.workLocation.trim() || undefined,
          income: formData.educationAndProfession.income.trim() || undefined,
        },
        familyDetails: {
          fatherName: formData.familyDetails.fatherName.trim() || undefined,
          fatherAlive: formData.familyDetails.fatherAlive || 'Yes',
          fatherOccupation: formData.familyDetails.fatherOccupation.trim() || undefined,
          motherName: formData.familyDetails.motherName.trim() || undefined,
          motherAlive: formData.familyDetails.motherAlive || 'Yes',
          motherOccupation: formData.familyDetails.motherOccupation.trim() || undefined,
          marriedElderBrothers: Number(formData.familyDetails.marriedElderBrothers) || 0,
          unmarriedElderBrothers: Number(formData.familyDetails.unmarriedElderBrothers) || 0,
          marriedYoungerBrothers: Number(formData.familyDetails.marriedYoungerBrothers) || 0,
          unmarriedYoungerBrothers: Number(formData.familyDetails.unmarriedYoungerBrothers) || 0,
          marriedElderSisters: Number(formData.familyDetails.marriedElderSisters) || 0,
          unmarriedElderSisters: Number(formData.familyDetails.unmarriedElderSisters) || 0,
          marriedYoungerSisters: Number(formData.familyDetails.marriedYoungerSisters) || 0,
          unmarriedYoungerSisters: Number(formData.familyDetails.unmarriedYoungerSisters) || 0,
          familyInformation: formData.familyDetails.familyInformation.trim() || undefined,
          parentInformation: formData.familyDetails.parentInformation.trim() || undefined,
          siblingInformation: formData.familyDetails.siblingInformation.trim() || undefined,
          familyLocation: formData.familyDetails.familyLocation.trim() || undefined,
        },
        partnerPreferences: {
          preferredAgeRange: {
            min: formData.partnerPreferences.preferredAgeRange.min
              ? Number(formData.partnerPreferences.preferredAgeRange.min)
              : undefined,
            max: formData.partnerPreferences.preferredAgeRange.max
              ? Number(formData.partnerPreferences.preferredAgeRange.max)
              : undefined,
          },
          maritalStatusPreference: formData.partnerPreferences.maritalStatusPreference,
          dietPreference: formData.partnerPreferences.dietPreference,
          jobRequirement: formData.partnerPreferences.jobRequirement || 'Must',
          horoscopeRequired: formData.partnerPreferences.horoscopeRequired || 'Yes',
          educationPreference: formData.partnerPreferences.educationPreference.trim() || undefined,
          occupationPreference: formData.partnerPreferences.occupationPreference.trim() || undefined,
          preferredLocation: formData.partnerPreferences.preferredLocation.trim() || undefined,
          castePreference: formData.partnerPreferences.castePreference.trim() || undefined,
          subcastePreference: formData.partnerPreferences.subcastePreference.trim() || undefined,
          incomePreference: formData.partnerPreferences.incomePreference.trim() || undefined,
          otherPreferences: formData.partnerPreferences.otherPreferences.trim() || undefined,
        },
      };

      // 2. Submit broker profile creation
      const res = await createBrokerProfileApi(payload);

      if (!res.success || !res.data) {
        setFormFeedback({
          type: 'error',
          text: res.message || 'Failed to create broker profile. Please verify your fields.',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setIsSubmitting(false);
        return;
      }

      const created = res.data;
      setCreatedProfile(created);

      // 3. Upload selected photos (up to 3 photos sequentially)
      const selectedFiles = photoSlots
        .map((slot, index) => ({ file: slot.file, slotIndex: index }))
        .filter((item) => item.file !== null);

      if (selectedFiles.length > 0 && created._id) {
        const uploadResults = [];
        let anyFailed = false;

        for (const item of selectedFiles) {
          try {
            const photoRes = await addAdminCandidatePhotoApi(created._id, item.file);
            if (photoRes.success) {
              uploadResults.push({
                slot: item.slotIndex + 1,
                status: 'success',
                url: photoRes.data?.primaryPhoto?.url || photoRes.data?.photos?.[item.slotIndex]?.url,
              });
            } else {
              anyFailed = true;
              uploadResults.push({
                slot: item.slotIndex + 1,
                status: 'failed',
                error: photoRes.message || 'Upload failed',
              });
            }
          } catch (uploadErr) {
            anyFailed = true;
            uploadResults.push({
              slot: item.slotIndex + 1,
              status: 'failed',
              error: 'Network error during upload',
            });
          }
        }

        setUploadedPhotosResults(uploadResults);

        if (anyFailed) {
          setPhotoUploadError('Some photos could not be uploaded. You can manage photos from the profile view.');
          setFormFeedback({
            type: 'success',
            text: `Candidate profile created! ${uploadResults.filter((r) => r.status === 'success').length} photo(s) uploaded successfully.`,
          });
        } else {
          setFormFeedback({
            type: 'success',
            text: `Broker candidate profile created with all ${uploadResults.length} photo(s) uploaded successfully!`,
          });
        }
      } else {
        setFormFeedback({
          type: 'success',
          text: 'Broker candidate profile created successfully and pending review!',
        });
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setFormFeedback({
        type: 'error',
        text: 'An unexpected network error occurred while creating the profile.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setCreatedProfile(null);
    setUploadedPhotosResults([]);
    setPhotoUploadError('');
    setFormFeedback({ type: '', text: '' });
    setPhotoSlots([
      { file: null, preview: '' },
      { file: null, preview: '' },
      { file: null, preview: '' },
    ]);
    setFormData({
      candidateName: '',
      candidateEmail: '',
      candidatePhone: '',
      personalDetails: {
        gender: '',
        dateOfBirth: '',
        birthHour: '09',
        birthMinute: '00',
        birthPeriod: 'AM',
        placeOfBirth: '',
        nativity: '',
        height: '',
        weight: '',
        bloodGroup: '',
        complexion: '',
        diet: '',
        physicalStatus: 'Normal',
        disabilityDetails: '',
        maritalStatus: '',
        motherTongue: 'Tamil',
        location: '',
        presentAddress: '',
        permanentAddress: '',
        contactPerson: 'Self',
        alternatePhone: '',
      },
      communityDetails: {
        religion: 'Hindu',
        caste: '',
        subcaste: '',
        gothram: '',
      },
      horoscope: {
        rasi: '',
        nakshatram: '',
        padam: '',
        lagnam: '',
        dosham: '',
        dasaBalance: {
          planet: '',
          years: '',
          months: '',
          days: '',
        },
      },
      educationAndProfession: {
        educationalQualification: '',
        occupation: '',
        company: '',
        workLocation: '',
        income: '',
      },
      familyDetails: {
        fatherName: '',
        fatherAlive: 'Yes',
        fatherOccupation: '',
        motherName: '',
        motherAlive: 'Yes',
        motherOccupation: '',
        marriedElderBrothers: 0,
        unmarriedElderBrothers: 0,
        marriedYoungerBrothers: 0,
        unmarriedYoungerBrothers: 0,
        marriedElderSisters: 0,
        unmarriedElderSisters: 0,
        marriedYoungerSisters: 0,
        unmarriedYoungerSisters: 0,
        familyInformation: '',
        parentInformation: '',
        siblingInformation: '',
        familyLocation: '',
      },
      partnerPreferences: {
        preferredAgeRange: {
          min: '',
          max: '',
        },
        maritalStatusPreference: [],
        dietPreference: [],
        jobRequirement: 'Must',
        horoscopeRequired: 'Yes',
        educationPreference: '',
        occupationPreference: '',
        preferredLocation: '',
        castePreference: '',
        subcastePreference: '',
        incomePreference: '',
        otherPreferences: '',
      },
    });
  };

  // Access Denied State
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
              Administrator privileges required. You do not have permission to create candidate profiles.
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

  // Loading State
  if (authLoading) {
    return (
      <main className="admin-page">
        <div className="admin-container">
          <div className="admin-state-box">
            <div className="status-spinner" style={{ margin: '0 auto 1.25rem auto' }}></div>
            <p>Verifying administrator privileges...</p>
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
            <h1>Create Matrimonial Profile (Candidate Biodata)</h1>
            <p>
              Enter complete offline candidate details with all 6 biodata sections and up to 3 photographs.
            </p>
          </div>
          <Link
            href="/admin/profiles"
            className="btn-secondary"
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ArrowLeft size={14} /> Back to Profiles Directory
          </Link>
        </div>

        {/* Success Banner When Profile Created */}
        {createdProfile && (
          <div
            style={{
              background: '#ecfdf5',
              border: '1px solid #6ee7b7',
              borderRadius: 'var(--radius-lg, 12px)',
              padding: '1.75rem',
              marginBottom: '2rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <CheckCircle2 size={36} color="#059669" />
              <div>
                <h2 style={{ fontSize: '1.25rem', color: '#065f46', margin: 0 }}>
                  Candidate Biodata Profile Created Successfully!
                </h2>
                <p style={{ margin: '0.25rem 0 0', color: '#047857', fontSize: '0.9rem' }}>
                  Candidate: <strong>{createdProfile.candidateName}</strong> • Reference ID:{' '}
                  <strong>#{createdProfile._id?.slice(-6).toUpperCase() || 'PRF'}</strong>
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '1rem 0' }}>
              <span className="badge badge-warning">Origin: Broker / Admin Added</span>
              <span className="badge badge-warning">Approval: Pending Approval</span>
              <span className="badge badge-success">Activity: Active</span>
            </div>

            {/* Display Uploaded Photos */}
            {uploadedPhotosResults.length > 0 && (
              <div style={{ margin: '1.25rem 0', background: '#ffffff', padding: '1rem', borderRadius: 8, border: '1px solid #d1fae5' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#065f46' }}>Uploaded Gallery Photos ({uploadedPhotosResults.filter(r => r.status === 'success').length} / {uploadedPhotosResults.length})</h4>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {uploadedPhotosResults.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f0fdf4', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                      {r.status === 'success' ? (
                        <>
                          <CheckCircle2 size={16} color="#16a34a" />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>Photo {r.slot} {r.slot === 1 ? '(Primary)' : ''} Uploaded</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={16} color="#dc2626" />
                          <span style={{ fontSize: '0.85rem', color: '#dc2626' }}>Photo {r.slot}: {r.error}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {photoUploadError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md, 8px)',
                  color: 'var(--danger)',
                  fontSize: '0.9rem',
                  margin: '1rem 0',
                }}
              >
                <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={16} /> {photoUploadError}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
              <Link href="/admin/profiles" className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
                View in Profiles Directory →
              </Link>
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                + Create Another Profile
              </button>
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {formFeedback.text && (
          <div
            style={{
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-md, 8px)',
              marginBottom: '1.5rem',
              backgroundColor: formFeedback.type === 'error' ? '#fef2f2' : '#f0fdf4',
              color: formFeedback.type === 'error' ? 'var(--danger)' : '#166534',
              border: `1px solid ${formFeedback.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.95rem',
            }}
          >
            {formFeedback.type === 'error' ? (
              <AlertCircle size={18} color="var(--danger)" />
            ) : (
              <CheckCircle2 size={18} color="#16a34a" />
            )}
            <span>{formFeedback.text}</span>
          </div>
        )}

        {/* Profile Creation Form */}
        {!createdProfile && (
          <form onSubmit={handleSubmit} noValidate>
            {/* 1. Candidate Contact Information Card */}
            <div className="profile-section-card">
              <h2 className="profile-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardList size={18} color="var(--primary)" /> Candidate Identity & Contact
              </h2>
              <div className="form-grid-3">
                <div className="form-group">
                  <label htmlFor="candidateName" className="form-label">
                    Candidate Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    id="candidateName"
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={formData.candidateName}
                    onChange={(e) => handleInputChange(null, 'candidateName', e.target.value)}
                    className="form-input"
                  />
                  {errors.candidateName && <span className="form-error">{errors.candidateName}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="candidateEmail" className="form-label">
                    Candidate Email Address <span style={{ color: 'var(--text-muted)' }}>(Optional)</span>
                  </label>
                  <input
                    id="candidateEmail"
                    type="email"
                    placeholder="e.g. candidate@example.com"
                    value={formData.candidateEmail}
                    onChange={(e) => handleInputChange(null, 'candidateEmail', e.target.value)}
                    className="form-input"
                  />
                  {errors.candidateEmail && <span className="form-error">{errors.candidateEmail}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="candidatePhone" className="form-label">
                    Candidate Contact Phone <span style={{ color: 'var(--text-muted)' }}>(Optional)</span>
                  </label>
                  <input
                    id="candidatePhone"
                    type="tel"
                    placeholder="e.g. +91 9876543210"
                    value={formData.candidatePhone}
                    onChange={(e) => handleInputChange(null, 'candidatePhone', e.target.value)}
                    className="form-input"
                  />
                  {errors.candidatePhone && <span className="form-error">{errors.candidatePhone}</span>}
                </div>
              </div>
            </div>

            {/* 2. Personal & Physical Details Card */}
            <div className="profile-section-card">
              <h2 className="profile-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} color="var(--primary)" /> 01. Personal &amp; Physical Details (சுய விவரம்)
              </h2>
              <div className="form-grid-3">
                <div className="form-group">
                  <label htmlFor="gender" className="form-label">Gender <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select
                    id="gender"
                    value={formData.personalDetails.gender}
                    onChange={(e) => handleInputChange('personalDetails', 'gender', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select Gender</option>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="dateOfBirth" className="form-label">Date of Birth</label>
                  <input
                    id="dateOfBirth"
                    type="date"
                    value={formData.personalDetails.dateOfBirth}
                    onChange={(e) => handleInputChange('personalDetails', 'dateOfBirth', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Time of Birth (பிறந்த நேரம்)</label>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <select
                      value={formData.personalDetails.birthHour}
                      onChange={(e) => handleInputChange('personalDetails', 'birthHour', e.target.value)}
                      className="form-input"
                      style={{ flex: 1 }}
                    >
                      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <select
                      value={formData.personalDetails.birthMinute}
                      onChange={(e) => handleInputChange('personalDetails', 'birthMinute', e.target.value)}
                      className="form-input"
                      style={{ flex: 1 }}
                    >
                      {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={formData.personalDetails.birthPeriod}
                      onChange={(e) => handleInputChange('personalDetails', 'birthPeriod', e.target.value)}
                      className="form-input"
                      style={{ width: '80px' }}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="placeOfBirth" className="form-label">Place of Birth (பிறந்த இடம்)</label>
                  <input
                    id="placeOfBirth"
                    type="text"
                    placeholder="e.g. Madurai, Coimbatore"
                    value={formData.personalDetails.placeOfBirth}
                    onChange={(e) => handleInputChange('personalDetails', 'placeOfBirth', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="nativity" className="form-label">Nativity / Native Town (பூர்வீகம்)</label>
                  <input
                    id="nativity"
                    type="text"
                    placeholder="e.g. Salem, Tirunelveli"
                    value={formData.personalDetails.nativity}
                    onChange={(e) => handleInputChange('personalDetails', 'nativity', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="maritalStatus" className="form-label">Marital Status</label>
                  <select
                    id="maritalStatus"
                    value={formData.personalDetails.maritalStatus}
                    onChange={(e) => handleInputChange('personalDetails', 'maritalStatus', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select Marital Status</option>
                    {MARITAL_STATUS_OPTIONS.map((ms) => (
                      <option key={ms} value={ms}>{ms}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="height" className="form-label">Height (cm)</label>
                  <input
                    id="height"
                    type="number"
                    min="50"
                    max="260"
                    placeholder="e.g. 175"
                    value={formData.personalDetails.height}
                    onChange={(e) => handleInputChange('personalDetails', 'height', e.target.value)}
                    className="form-input"
                  />
                  {errors.height && <span className="form-error">{errors.height}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="weight" className="form-label">Weight (kg)</label>
                  <input
                    id="weight"
                    type="number"
                    min="20"
                    max="250"
                    placeholder="e.g. 68"
                    value={formData.personalDetails.weight}
                    onChange={(e) => handleInputChange('personalDetails', 'weight', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bloodGroup" className="form-label">Blood Group</label>
                  <select
                    id="bloodGroup"
                    value={formData.personalDetails.bloodGroup}
                    onChange={(e) => handleInputChange('personalDetails', 'bloodGroup', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select Blood Group</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="complexion" className="form-label">Complexion (நிறம்)</label>
                  <select
                    id="complexion"
                    value={formData.personalDetails.complexion}
                    onChange={(e) => handleInputChange('personalDetails', 'complexion', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select Complexion</option>
                    {COMPLEXION_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="diet" className="form-label">Diet (உணவு முறை)</label>
                  <select
                    id="diet"
                    value={formData.personalDetails.diet}
                    onChange={(e) => handleInputChange('personalDetails', 'diet', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select Diet</option>
                    {DIET_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="motherTongue" className="form-label">Mother Tongue</label>
                  <select
                    id="motherTongue"
                    value={formData.personalDetails.motherTongue}
                    onChange={(e) => handleInputChange('personalDetails', 'motherTongue', e.target.value)}
                    className="form-input"
                  >
                    {MOTHER_TONGUES.map((mt) => (
                      <option key={mt} value={mt}>{mt}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="location" className="form-label">Current Living City</label>
                  <input
                    id="location"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Chennai, Tamil Nadu"
                    value={formData.personalDetails.location}
                    onChange={(e) => handleInputChange('personalDetails', 'location', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="contactPerson" className="form-label">Contact Person</label>
                  <select
                    id="contactPerson"
                    value={formData.personalDetails.contactPerson}
                    onChange={(e) => handleInputChange('personalDetails', 'contactPerson', e.target.value)}
                    className="form-input"
                  >
                    <option value="Self">Self</option>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                    <option value="Guardian">Guardian</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="alternatePhone" className="form-label">Alternate Contact Phone</label>
                  <input
                    id="alternatePhone"
                    type="tel"
                    placeholder="e.g. +91 9443322110"
                    value={formData.personalDetails.alternatePhone}
                    onChange={(e) => handleInputChange('personalDetails', 'alternatePhone', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Addresses */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="presentAddress" className="form-label">Present Address (தற்போதைய முகவரி)</label>
                    <textarea
                      id="presentAddress"
                      rows={2}
                      placeholder="Street, City, Pincode"
                      value={formData.personalDetails.presentAddress}
                      onChange={(e) => handleInputChange('personalDetails', 'presentAddress', e.target.value)}
                      className="form-textarea"
                    />
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label htmlFor="permanentAddress" className="form-label">Permanent Address (நிரந்தர முகவரி)</label>
                      <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={sameAsPresentAddress}
                          onChange={(e) => setSameAsPresentAddress(e.target.checked)}
                        />
                        Same as Present
                      </label>
                    </div>
                    <textarea
                      id="permanentAddress"
                      rows={2}
                      disabled={sameAsPresentAddress}
                      placeholder={sameAsPresentAddress ? 'Same as Present Address' : 'Native permanent address'}
                      value={sameAsPresentAddress ? formData.personalDetails.presentAddress : formData.personalDetails.permanentAddress}
                      onChange={(e) => handleInputChange('personalDetails', 'permanentAddress', e.target.value)}
                      className="form-textarea"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Community & Horoscope Details Card */}
            <div className="profile-section-card">
              <h2 className="profile-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Compass size={18} color="var(--primary)" /> 02. Community &amp; Horoscope (சமூகம் &amp; ஜாதகம்)
              </h2>
              <div className="form-grid-4">
                <div className="form-group">
                  <label htmlFor="religion" className="form-label">Religion</label>
                  <select
                    id="religion"
                    value={formData.communityDetails.religion}
                    onChange={(e) => handleInputChange('communityDetails', 'religion', e.target.value)}
                    className="form-input"
                  >
                    {RELIGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="caste" className="form-label">Caste / Community (ஜாதி)</label>
                  <input
                    id="caste"
                    type="text"
                    placeholder="e.g. Kongu Vellalar, Brahmin, Nadar"
                    value={formData.communityDetails.caste}
                    onChange={(e) => handleInputChange('communityDetails', 'caste', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="subcaste" className="form-label">Subcaste / Sect (உட்பிரிவு)</label>
                  <input
                    id="subcaste"
                    type="text"
                    placeholder="e.g. Vadama, Thenkalai"
                    value={formData.communityDetails.subcaste}
                    onChange={(e) => handleInputChange('communityDetails', 'subcaste', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="gothram" className="form-label">Gothram / Kulam (கோத்திரம் / குலம்)</label>
                  <input
                    id="gothram"
                    type="text"
                    placeholder="e.g. Bharadwaja, Kadas"
                    value={formData.communityDetails.gothram}
                    onChange={(e) => handleInputChange('communityDetails', 'gothram', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="rasi" className="form-label">Rasi (ராசி)</label>
                  <select
                    id="rasi"
                    value={formData.horoscope.rasi}
                    onChange={(e) => handleInputChange('horoscope', 'rasi', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select Rasi</option>
                    {RASI_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="nakshatram" className="form-label">Nakshatram (நட்சத்திரம்)</label>
                  <select
                    id="nakshatram"
                    value={formData.horoscope.nakshatram}
                    onChange={(e) => handleInputChange('horoscope', 'nakshatram', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select Nakshatram</option>
                    {NAKSHATRAM_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="padam" className="form-label">Padam (பாதம்)</label>
                  <select
                    id="padam"
                    value={formData.horoscope.padam}
                    onChange={(e) => handleInputChange('horoscope', 'padam', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select Padam</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="lagnam" className="form-label">Lagnam (லக்னம்)</label>
                  <input
                    id="lagnam"
                    type="text"
                    placeholder="e.g. Mesha Lagnam"
                    value={formData.horoscope.lagnam}
                    onChange={(e) => handleInputChange('horoscope', 'lagnam', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="dosham" className="form-label">Dosham (தோஷம்)</label>
                  <select
                    id="dosham"
                    value={formData.horoscope.dosham}
                    onChange={(e) => handleInputChange('horoscope', 'dosham', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select Dosham</option>
                    {DOSHAM_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 3' }}>
                  <label className="form-label">Dasa Balance (திசா இருப்பு)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      value={formData.horoscope.dasaBalance.planet}
                      onChange={(e) => handleDeepNestedChange('horoscope', 'dasaBalance', 'planet', e.target.value)}
                      className="form-input"
                      style={{ flex: 2 }}
                    >
                      <option value="">Select Planet</option>
                      {DASA_PLANETS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Years"
                      value={formData.horoscope.dasaBalance.years}
                      onChange={(e) => handleDeepNestedChange('horoscope', 'dasaBalance', 'years', e.target.value)}
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      min="0"
                      max="12"
                      placeholder="Months"
                      value={formData.horoscope.dasaBalance.months}
                      onChange={(e) => handleDeepNestedChange('horoscope', 'dasaBalance', 'months', e.target.value)}
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      min="0"
                      max="31"
                      placeholder="Days"
                      value={formData.horoscope.dasaBalance.days}
                      onChange={(e) => handleDeepNestedChange('horoscope', 'dasaBalance', 'days', e.target.value)}
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Education & Profession Card */}
            <div className="profile-section-card">
              <h2 className="profile-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GraduationCap size={18} color="var(--primary)" /> 03. Education &amp; Profession (கல்வி &amp; பணி)
              </h2>
              <div className="form-grid-3">
                <div className="form-group">
                  <label htmlFor="educationalQualification" className="form-label">Highest Qualification</label>
                  <input
                    id="educationalQualification"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. B.Tech / MBA / MBBS / MS"
                    value={formData.educationAndProfession.educationalQualification}
                    onChange={(e) => handleInputChange('educationAndProfession', 'educationalQualification', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="occupation" className="form-label">Occupation / Designation</label>
                  <input
                    id="occupation"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Senior Software Architect"
                    value={formData.educationAndProfession.occupation}
                    onChange={(e) => handleInputChange('educationAndProfession', 'occupation', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="company" className="form-label">Organization / Company</label>
                  <input
                    id="company"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. TCS, Google, State Govt"
                    value={formData.educationAndProfession.company}
                    onChange={(e) => handleInputChange('educationAndProfession', 'company', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="workLocation" className="form-label">Work Location</label>
                  <input
                    id="workLocation"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Bengaluru, Karnataka"
                    value={formData.educationAndProfession.workLocation}
                    onChange={(e) => handleInputChange('educationAndProfession', 'workLocation', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="income" className="form-label">Annual Income / CTC</label>
                  <input
                    id="income"
                    type="text"
                    maxLength={50}
                    placeholder="e.g. 18 - 22 LPA"
                    value={formData.educationAndProfession.income}
                    onChange={(e) => handleInputChange('educationAndProfession', 'income', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* 5. Family Details Card */}
            <div className="profile-section-card">
              <h2 className="profile-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} color="var(--primary)" /> 04. Family &amp; Siblings (குடும்பம் &amp; உடன்பிறப்புகள்)
              </h2>
              <div className="form-grid-3">
                <div className="form-group">
                  <label htmlFor="fatherName" className="form-label">Father&apos;s Name</label>
                  <input
                    id="fatherName"
                    type="text"
                    placeholder="e.g. S. Ramasamy"
                    value={formData.familyDetails.fatherName}
                    onChange={(e) => handleInputChange('familyDetails', 'fatherName', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fatherAlive" className="form-label">Father Status</label>
                  <select
                    id="fatherAlive"
                    value={formData.familyDetails.fatherAlive}
                    onChange={(e) => handleInputChange('familyDetails', 'fatherAlive', e.target.value)}
                    className="form-input"
                  >
                    <option value="Yes">Living</option>
                    <option value="No">Late</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="fatherOccupation" className="form-label">Father&apos;s Occupation</label>
                  <input
                    id="fatherOccupation"
                    type="text"
                    placeholder="e.g. Retired Govt Officer / Business"
                    value={formData.familyDetails.fatherOccupation}
                    onChange={(e) => handleInputChange('familyDetails', 'fatherOccupation', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="motherName" className="form-label">Mother&apos;s Name</label>
                  <input
                    id="motherName"
                    type="text"
                    placeholder="e.g. R. Lakshmi"
                    value={formData.familyDetails.motherName}
                    onChange={(e) => handleInputChange('familyDetails', 'motherName', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="motherAlive" className="form-label">Mother Status</label>
                  <select
                    id="motherAlive"
                    value={formData.familyDetails.motherAlive}
                    onChange={(e) => handleInputChange('familyDetails', 'motherAlive', e.target.value)}
                    className="form-input"
                  >
                    <option value="Yes">Living</option>
                    <option value="No">Late</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="motherOccupation" className="form-label">Mother&apos;s Occupation</label>
                  <input
                    id="motherOccupation"
                    type="text"
                    placeholder="e.g. Homemaker / Teacher"
                    value={formData.familyDetails.motherOccupation}
                    onChange={(e) => handleInputChange('familyDetails', 'motherOccupation', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Sibling Counters Grid */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
                <h4 style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', color: 'var(--primary)' }}>Brothers &amp; Sisters (உடன்பிறந்தோர் எண்ணிக்கை)</h4>
                <div className="form-grid-4">
                  <div className="form-group">
                    <label className="form-label">Elder Brothers (Married)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.familyDetails.marriedElderBrothers}
                      onChange={(e) => handleInputChange('familyDetails', 'marriedElderBrothers', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Elder Brothers (Unmarried)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.familyDetails.unmarriedElderBrothers}
                      onChange={(e) => handleInputChange('familyDetails', 'unmarriedElderBrothers', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Younger Brothers (Married)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.familyDetails.marriedYoungerBrothers}
                      onChange={(e) => handleInputChange('familyDetails', 'marriedYoungerBrothers', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Younger Brothers (Unmarried)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.familyDetails.unmarriedYoungerBrothers}
                      onChange={(e) => handleInputChange('familyDetails', 'unmarriedYoungerBrothers', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Elder Sisters (Married)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.familyDetails.marriedElderSisters}
                      onChange={(e) => handleInputChange('familyDetails', 'marriedElderSisters', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Elder Sisters (Unmarried)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.familyDetails.unmarriedElderSisters}
                      onChange={(e) => handleInputChange('familyDetails', 'unmarriedElderSisters', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Younger Sisters (Married)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.familyDetails.marriedYoungerSisters}
                      onChange={(e) => handleInputChange('familyDetails', 'marriedYoungerSisters', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Younger Sisters (Unmarried)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.familyDetails.unmarriedYoungerSisters}
                      onChange={(e) => handleInputChange('familyDetails', 'unmarriedYoungerSisters', e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="form-grid-2" style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="familyInformation" className="form-label">Family Background Notes</label>
                  <textarea
                    id="familyInformation"
                    maxLength={500}
                    placeholder="Brief description of family values, native place, background..."
                    value={formData.familyDetails.familyInformation}
                    onChange={(e) => handleInputChange('familyDetails', 'familyInformation', e.target.value)}
                    className="form-textarea"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="familyLocation" className="form-label">Family Native / Origin Town</label>
                  <input
                    id="familyLocation"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Madurai, Tamil Nadu"
                    value={formData.familyDetails.familyLocation}
                    onChange={(e) => handleInputChange('familyDetails', 'familyLocation', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* 6. Partner Preferences Card */}
            <div className="profile-section-card">
              <h2 className="profile-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Heart size={18} color="var(--primary)" /> 05. Partner Preferences (எதிர்பார்ப்புகள்)
              </h2>
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Preferred Age Range</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="18"
                      max="100"
                      placeholder="Min"
                      value={formData.partnerPreferences.preferredAgeRange.min}
                      onChange={(e) => handleDeepNestedChange('partnerPreferences', 'preferredAgeRange', 'min', e.target.value)}
                      className="form-input"
                    />
                    <span>to</span>
                    <input
                      type="number"
                      min="18"
                      max="100"
                      placeholder="Max"
                      value={formData.partnerPreferences.preferredAgeRange.max}
                      onChange={(e) => handleDeepNestedChange('partnerPreferences', 'preferredAgeRange', 'max', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  {errors.minAge && <span className="form-error">{errors.minAge}</span>}
                  {errors.maxAge && <span className="form-error">{errors.maxAge}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Job Requirement (வேலை)</label>
                  <select
                    value={formData.partnerPreferences.jobRequirement}
                    onChange={(e) => handleInputChange('partnerPreferences', 'jobRequirement', e.target.value)}
                    className="form-input"
                  >
                    <option value="Must">Must</option>
                    <option value="Optional">Optional</option>
                    <option value="Not Required">Not Required</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Horoscope Match Required (ஜாதக பொருத்தம்)</label>
                  <select
                    value={formData.partnerPreferences.horoscopeRequired}
                    onChange={(e) => handleInputChange('partnerPreferences', 'horoscopeRequired', e.target.value)}
                    className="form-input"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="educationPreference" className="form-label">Education Preference</label>
                  <input
                    id="educationPreference"
                    type="text"
                    placeholder="e.g. Any Graduate, Engineering, Medical"
                    value={formData.partnerPreferences.educationPreference}
                    onChange={(e) => handleInputChange('partnerPreferences', 'educationPreference', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="occupationPreference" className="form-label">Occupation Preference</label>
                  <input
                    id="occupationPreference"
                    type="text"
                    placeholder="e.g. IT Professional, Govt Employee"
                    value={formData.partnerPreferences.occupationPreference}
                    onChange={(e) => handleInputChange('partnerPreferences', 'occupationPreference', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="preferredLocation" className="form-label">Preferred Location</label>
                  <input
                    id="preferredLocation"
                    type="text"
                    placeholder="e.g. Chennai, Coimbatore, Bangalore"
                    value={formData.partnerPreferences.preferredLocation}
                    onChange={(e) => handleInputChange('partnerPreferences', 'preferredLocation', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="castePreference" className="form-label">Caste Preference</label>
                  <input
                    id="castePreference"
                    type="text"
                    placeholder="e.g. Same Caste / Any Hindu"
                    value={formData.partnerPreferences.castePreference}
                    onChange={(e) => handleInputChange('partnerPreferences', 'castePreference', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="incomePreference" className="form-label">Expected Partner Income</label>
                  <input
                    id="incomePreference"
                    type="text"
                    placeholder="e.g. 10 LPA and above"
                    value={formData.partnerPreferences.incomePreference}
                    onChange={(e) => handleInputChange('partnerPreferences', 'incomePreference', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="otherPreferences" className="form-label">General Expectations</label>
                  <input
                    id="otherPreferences"
                    type="text"
                    placeholder="e.g. Family-oriented, well-cultured"
                    value={formData.partnerPreferences.otherPreferences}
                    onChange={(e) => handleInputChange('partnerPreferences', 'otherPreferences', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* 7. Candidate Photographs (Upload Up to 3 Photos) */}
            <div className="profile-section-card">
              <h2 className="profile-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Camera size={18} color="var(--primary)" /> 06. Candidate Photographs (Upload Up to 3 Photos - புகைப்படம்)
              </h2>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Select up to 3 candidate photos. Photo 1 will serve as the Primary portrait on search cards. Uploaded securely to Cloudinary upon creation.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {[0, 1, 2].map((slotIdx) => {
                  const slot = photoSlots[slotIdx];
                  const isPrimary = slotIdx === 0;

                  return (
                    <div
                      key={slotIdx}
                      style={{
                        border: isPrimary ? '2px solid var(--primary, #A20D16)' : '1px solid var(--border-color, #d1d5db)',
                        borderRadius: 12,
                        padding: '1rem',
                        background: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'relative',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {/* Slot Header Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isPrimary ? 'var(--primary)' : 'var(--text-muted)' }}>
                          {isPrimary ? '★ Photo 1 (Primary Portrait)' : `Photo ${slotIdx + 1} (Additional)`}
                        </span>
                      </div>

                      {/* Preview Box */}
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '3 / 4',
                          background: '#f9fafb',
                          borderRadius: 8,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px dashed var(--border-color, #cbd5e1)',
                          marginBottom: '0.75rem',
                        }}
                      >
                        {slot.preview ? (
                          <img
                            src={slot.preview}
                            alt={`Photo ${slotIdx + 1} preview`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                            <Camera size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.6 }} />
                            <p style={{ margin: 0, fontSize: '0.8rem' }}>No Photo Selected</p>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <input
                        ref={photoInputRefs[slotIdx]}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        style={{ display: 'none' }}
                        onChange={(e) => handleSlotPhotoSelect(slotIdx, e)}
                      />

                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <button
                          type="button"
                          onClick={() => photoInputRefs[slotIdx]?.current?.click()}
                          className="btn-upload"
                          style={{ flex: 1, padding: '0.45rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                        >
                          <Upload size={13} /> {slot.preview ? 'Change' : '+ Choose'}
                        </button>
                        {slot.preview && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSlotPhoto(slotIdx)}
                            className="btn-reset"
                            style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions Bar */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                marginTop: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid var(--border-color, #e5e7eb)',
              }}
            >
              <Link href="/admin/profiles" className="btn-secondary" style={{ padding: '0.75rem 1.5rem' }}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary"
                style={{ padding: '0.75rem 2.25rem', fontWeight: 600 }}
              >
                {isSubmitting ? 'Creating Candidate Profile...' : 'Save & Create Profile (With Photos)'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
