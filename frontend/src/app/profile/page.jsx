'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  getMyProfileApi,
  createProfileApi,
  updateProfileApi,
  uploadProfilePhotoApi,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Camera,
  User,
  GraduationCap,
  Users,
  Heart,
  Lock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

const MARITAL_STATUS_OPTIONS = [
  'Never Married',
  'Divorced',
  'Widowed',
  'Awaiting Divorce',
];

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export default function ProfilePage() {
  const { currentUser, authLoading } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [isExistingProfile, setIsExistingProfile] = useState(false);
  const [hasCandidatePhone, setHasCandidatePhone] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    candidatePhone: '',
    personalDetails: {
      gender: '',
      dateOfBirth: '',
      height: '',
      maritalStatus: '',
      motherTongue: '',
      location: '',
    },
    educationAndProfession: {
      educationalQualification: '',
      occupation: '',
      company: '',
      workLocation: '',
      income: '',
    },
    familyDetails: {
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
      preferredLocation: '',
      educationPreference: '',
      occupationPreference: '',
      otherPreferences: '',
    },
  });

  // Photo State
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState({ type: '', text: '' });
  const photoInputRef = useRef(null);

  // Form Action State
  const [isSaving, setIsSaving] = useState(false);
  const [formFeedback, setFormFeedback] = useState({ type: '', text: '' });
  const [errors, setErrors] = useState({});

  // 1. Initial Load: Fetch Matrimonial Profile for Authenticated User
  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (authLoading) return;

      if (!currentUser) {
        setProfileLoading(false);
        return;
      }

      try {
        const profileRes = await getMyProfileApi();
        if (!isMounted) return;

        if (profileRes.success && profileRes.data) {
          setIsExistingProfile(true);
          const p = profileRes.data;
          setHasCandidatePhone(Boolean(p.hasCandidatePhone));

          // Format Date of Birth for input[type="date"] (YYYY-MM-DD)
          let formattedDob = '';
          if (p.personalDetails?.dateOfBirth) {
            const d = new Date(p.personalDetails.dateOfBirth);
            if (!isNaN(d.getTime())) {
              formattedDob = d.toISOString().split('T')[0];
            }
          }

          setFormData({
            candidatePhone: '',
            personalDetails: {
              gender: p.personalDetails?.gender || '',
              dateOfBirth: formattedDob,
              height: p.personalDetails?.height ?? '',
              maritalStatus: p.personalDetails?.maritalStatus || '',
              motherTongue: p.personalDetails?.motherTongue || '',
              location: p.personalDetails?.location || '',
            },
            educationAndProfession: {
              educationalQualification: p.educationAndProfession?.educationalQualification || '',
              occupation: p.educationAndProfession?.occupation || '',
              company: p.educationAndProfession?.company || '',
              workLocation: p.educationAndProfession?.workLocation || '',
              income: p.educationAndProfession?.income || '',
            },
            familyDetails: {
              familyInformation: p.familyDetails?.familyInformation || '',
              parentInformation: p.familyDetails?.parentInformation || '',
              siblingInformation: p.familyDetails?.siblingInformation || '',
              familyLocation: p.familyDetails?.familyLocation || '',
            },
            partnerPreferences: {
              preferredAgeRange: {
                min: p.partnerPreferences?.preferredAgeRange?.min ?? '',
                max: p.partnerPreferences?.preferredAgeRange?.max ?? '',
              },
              preferredLocation: p.partnerPreferences?.preferredLocation || '',
              educationPreference: p.partnerPreferences?.educationPreference || '',
              occupationPreference: p.partnerPreferences?.occupationPreference || '',
              otherPreferences: p.partnerPreferences?.otherPreferences || '',
            },
          });

          if (p.profilePhoto?.url) {
            setExistingPhotoUrl(p.profilePhoto.url);
            setPhotoPreview(p.profilePhoto.url);
          }
        } else {
          setIsExistingProfile(false);
        }
      } catch (err) {
        if (isMounted) {
          setFormFeedback({
            type: 'error',
            text: 'An error occurred while loading your profile data.',
          });
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser, authLoading]);

  // Handle nested state updates
  const handleNestedChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));

    if (errors[`${section}.${field}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`${section}.${field}`];
        return next;
      });
    }
  };

  const handleCandidatePhoneChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      candidatePhone: value,
    }));

    if (errors.candidatePhone) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.candidatePhone;
        return next;
      });
    }
  };

  const handleAgeRangeChange = (bound, value) => {
    setFormData((prev) => ({
      ...prev,
      partnerPreferences: {
        ...prev.partnerPreferences,
        preferredAgeRange: {
          ...prev.partnerPreferences.preferredAgeRange,
          [bound]: value,
        },
      },
    }));

    if (errors['partnerPreferences.preferredAgeRange']) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next['partnerPreferences.preferredAgeRange'];
        return next;
      });
    }
  };

  // Form Validation
  const validateForm = () => {
    const errs = {};

    // Candidate phone validation (when provided)
    const trimmedPhone = (formData.candidatePhone || '').trim();
    if (trimmedPhone.length > 0) {
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      if (trimmedPhone.length > 25) {
        errs.candidatePhone = 'Candidate phone number cannot exceed 25 characters';
      } else if (
        trimmedPhone.includes('@') ||
        !/^[0-9+\-\s()]+$/.test(trimmedPhone) ||
        digitsOnly.length < 7 ||
        digitsOnly.length > 15
      ) {
        errs.candidatePhone = 'Please enter a valid phone number (7 to 15 digits)';
      }
    }

    // Personal details validation
    if (formData.personalDetails.dateOfBirth) {
      const dob = new Date(formData.personalDetails.dateOfBirth);
      if (dob > new Date()) {
        errs['personalDetails.dateOfBirth'] = 'Date of birth cannot be in the future';
      }
    }

    if (formData.personalDetails.height) {
      const h = Number(formData.personalDetails.height);
      if (isNaN(h) || h < 50 || h > 260) {
        errs['personalDetails.height'] = 'Height must be between 50 and 260 cm';
      }
    }

    // Partner preferences validation
    const minAge = formData.partnerPreferences.preferredAgeRange.min;
    const maxAge = formData.partnerPreferences.preferredAgeRange.max;

    if (minAge !== '' && (isNaN(Number(minAge)) || Number(minAge) < 18 || Number(minAge) > 100)) {
      errs['partnerPreferences.preferredAgeRange'] = 'Minimum age must be between 18 and 100';
    } else if (maxAge !== '' && (isNaN(Number(maxAge)) || Number(maxAge) < 18 || Number(maxAge) > 100)) {
      errs['partnerPreferences.preferredAgeRange'] = 'Maximum age must be between 18 and 100';
    } else if (minAge !== '' && maxAge !== '' && Number(minAge) > Number(maxAge)) {
      errs['partnerPreferences.preferredAgeRange'] = 'Minimum age cannot be greater than maximum age';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Construct payload conforming to backend schema
  const preparePayload = () => {
    const payload = {
      personalDetails: { ...formData.personalDetails },
      educationAndProfession: { ...formData.educationAndProfession },
      familyDetails: { ...formData.familyDetails },
      partnerPreferences: {
        ...formData.partnerPreferences,
        preferredAgeRange: {},
      },
    };

    const trimmedPhone = (formData.candidatePhone || '').trim();
    if (trimmedPhone.length > 0) {
      payload.candidatePhone = trimmedPhone;
    }

    // Clean height: number or omit if empty
    if (payload.personalDetails.height !== '' && payload.personalDetails.height !== null) {
      payload.personalDetails.height = Number(payload.personalDetails.height);
    } else {
      delete payload.personalDetails.height;
    }

    // Clean dateOfBirth: omit if empty
    if (!payload.personalDetails.dateOfBirth) {
      delete payload.personalDetails.dateOfBirth;
    }

    // Clean gender: omit if empty
    if (!payload.personalDetails.gender) {
      delete payload.personalDetails.gender;
    }

    // Clean maritalStatus: omit if empty
    if (!payload.personalDetails.maritalStatus) {
      delete payload.personalDetails.maritalStatus;
    }

    // Clean age range
    const minAge = formData.partnerPreferences.preferredAgeRange.min;
    const maxAge = formData.partnerPreferences.preferredAgeRange.max;

    if (minAge !== '' && minAge !== null) {
      payload.partnerPreferences.preferredAgeRange.min = Number(minAge);
    }
    if (maxAge !== '' && maxAge !== null) {
      payload.partnerPreferences.preferredAgeRange.max = Number(maxAge);
    }

    // If age range has no values, omit empty object
    if (Object.keys(payload.partnerPreferences.preferredAgeRange).length === 0) {
      delete payload.partnerPreferences.preferredAgeRange;
    }

    return payload;
  };

  // Submit profile details
  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setFormFeedback({ type: '', text: '' });

    if (!validateForm()) {
      setFormFeedback({
        type: 'error',
        text: 'Please correct the highlighted fields before saving.',
      });
      return;
    }

    setIsSaving(true);
    const payload = preparePayload();

    try {
      const wasExisting = isExistingProfile;
      let res;
      if (wasExisting) {
        res = await updateProfileApi(payload);
      } else {
        res = await createProfileApi(payload);
      }

      if (res && res.success) {
        setIsExistingProfile(true);
        if (typeof res.data?.hasCandidatePhone === 'boolean') {
          setHasCandidatePhone(res.data.hasCandidatePhone);
        } else if (payload.candidatePhone) {
          setHasCandidatePhone(true);
        }
        if (payload.candidatePhone) {
          setFormData((prev) => ({
            ...prev,
            candidatePhone: '',
          }));
        }
        setFormFeedback({
          type: 'success',
          text: wasExisting
            ? 'Profile changes saved successfully!'
            : 'Matrimonial profile created successfully!',
        });
      } else {
        setFormFeedback({
          type: 'error',
          text: (res && res.message) || (wasExisting ? 'Failed to save profile changes.' : 'Failed to create matrimonial profile.'),
        });
      }
    } catch (err) {
      setFormFeedback({
        type: 'error',
        text: 'An unexpected network error occurred. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle local photo selection
  const handlePhotoFileChange = (e) => {
    setPhotoMessage({ type: '', text: '' });
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoMessage({
        type: 'error',
        text: 'Invalid file format. Please choose a JPEG, PNG, or WebP image.',
      });
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoMessage({
        type: 'error',
        text: 'Photo file size exceeds the 5 MB limit. Please select a smaller photo.',
      });
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }

    setSelectedPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
  };

  // Upload photo to backend / Cloudinary
  const handleUploadPhoto = async () => {
    if (!selectedPhotoFile) {
      setPhotoMessage({
        type: 'error',
        text: 'Please select a photo file to upload.',
      });
      return;
    }

    if (!isExistingProfile) {
      setPhotoMessage({
        type: 'error',
        text: 'Please save your profile details first before uploading a photograph.',
      });
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoMessage({ type: '', text: '' });

    try {
      const res = await uploadProfilePhotoApi(selectedPhotoFile);

      if (res.success && res.data?.url) {
        setExistingPhotoUrl(res.data.url);
        setPhotoPreview(res.data.url);
        setSelectedPhotoFile(null);
        if (photoInputRef.current) photoInputRef.current.value = '';
        setPhotoMessage({
          type: 'success',
          text: 'Profile photo uploaded and updated successfully.',
        });
      } else {
        setPhotoMessage({
          type: 'error',
          text: res.message || 'Photo upload failed. Please try again.',
        });
      }
    } catch (err) {
      setPhotoMessage({
        type: 'error',
        text: 'An unexpected network error occurred while uploading your photo.',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // 1. Loading State
  if (authLoading || (currentUser && profileLoading)) {
    return (
      <main className="profile-page">
        <div className="profile-container" style={{ textAlign: 'center', paddingTop: '5rem' }}>
          <div className="status-spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-muted)', fontFamily: 'var(--font-serif)' }}>
            Loading your matrimonial profile...
          </h2>
        </div>
      </main>
    );
  }

  // 2. Unauthenticated State
  if (!currentUser) {
    return (
      <main className="profile-page">
        <div className="profile-container">
          <div className="auth-card" style={{ maxWidth: '520px', margin: '3rem auto' }}>
            <div className="auth-header">
              <div className="auth-brand-mark" aria-hidden="true">
                <span className="brand-emblem">
                  <Lock size={20} />
                </span>
              </div>
              <div className="auth-eyebrow">
                <Sparkles size={12} className="auth-eyebrow-sparkle" aria-hidden="true" />
                <span>South Indian Matrimonial Traditions</span>
              </div>
              <h1 className="auth-title">Authentication Required</h1>
              <p className="auth-subtitle">
                Please sign in to view and manage your matrimonial profile details, candidate contact privacy, and photographs.
              </p>
            </div>
            <div className="alert alert-info" style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
              Your session could not be verified. Registered members can sign in using their credentials to access profile editing, privacy settings, and photos.
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link href="/login" className="btn-primary" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>
                Sign In
              </Link>
              <Link href="/register" className="btn-secondary" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>
                Register Account
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // 3. Authenticated Profile Form
  return (
    <main className="profile-page">
      <div className="profile-container">
        {/* Header Area */}
        <div className="profile-header-area">
          <div>
            <h1 className="profile-title">
              {isExistingProfile ? 'My Matrimonial Profile' : 'Create Matrimonial Profile'}
            </h1>
            <p className="profile-subtitle">
              Logged in as <strong>{currentUser.name}</strong> ({currentUser.email})
            </p>
          </div>
          <span className={`profile-status-badge ${isExistingProfile ? 'active' : 'pending'}`}>
            <Sparkles size={13} aria-hidden="true" />
            <span>{isExistingProfile ? 'Profile Active' : 'Profile Incomplete'}</span>
          </span>
        </div>

        {/* Global Save Feedback (Top of Form) */}
        {formFeedback.text && (
          <div
            className={`alert ${formFeedback.type === 'success' ? 'alert-success' : 'alert-danger'}`}
            role={formFeedback.type === 'success' ? 'status' : 'alert'}
            aria-live={formFeedback.type === 'success' ? 'polite' : 'assertive'}
            style={{ marginBottom: '1.5rem' }}
          >
            <span className="alert-icon">
              {formFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            </span>
            <span>{formFeedback.text}</span>
          </div>
        )}

        {/* Section 0: Profile Photo */}
        <div className="profile-section-card">
          <h2 className="profile-section-title">
            <span className="profile-section-icon-box">
              <Camera size={18} />
            </span>
            <span>Profile Photograph</span>
          </h2>
          <div className="photo-upload-box">
            <div className="photo-preview-avatar">
              {photoPreview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photoPreview}
                  alt="Profile preview"
                  className="photo-preview-img"
                />
              ) : (
                <User size={48} strokeWidth={1.5} />
              )}
            </div>

            <div className="photo-controls">
              <label htmlFor="photoInput" className="form-label" style={{ marginBottom: 0 }}>
                Upload Photo (JPG, PNG, WebP — Max 5 MB)
              </label>
              <input
                ref={photoInputRef}
                id="photoInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handlePhotoFileChange}
                className="file-input-custom"
                disabled={isUploadingPhoto}
              />

              {photoMessage.text && (
                <div
                  className={`alert ${photoMessage.type === 'success' ? 'alert-success' : 'alert-danger'}`}
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', margin: 0 }}
                >
                  <span className="alert-icon">
                    {photoMessage.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  </span>
                  <span>{photoMessage.text}</span>
                </div>
              )}

              {selectedPhotoFile && (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleUploadPhoto}
                    disabled={isUploadingPhoto}
                    className="btn-upload"
                  >
                    <Upload size={14} aria-hidden="true" />
                    <span>{isUploadingPhoto ? 'Uploading to Cloudinary...' : 'Confirm Photo Upload'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPhotoFile(null);
                      setPhotoPreview(existingPhotoUrl);
                      setPhotoMessage({ type: '', text: '' });
                      if (photoInputRef.current) photoInputRef.current.value = '';
                    }}
                    disabled={isUploadingPhoto}
                    className="btn-secondary"
                    style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <X size={14} aria-hidden="true" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Multi-Section Form */}
        <form onSubmit={handleSubmitProfile} noValidate>
          {/* Section 1: Personal Details */}
          <div className="profile-section-card">
            <h2 className="profile-section-title">
              <span className="profile-section-icon-box">
                <User size={18} />
              </span>
              <span>1. Personal Details</span>
            </h2>
            <div className="form-grid-2">
              {/* Gender */}
              <div className="form-group">
                <label htmlFor="gender" className="form-label">
                  Gender
                </label>
                <select
                  id="gender"
                  className="form-input"
                  value={formData.personalDetails.gender}
                  onChange={(e) => handleNestedChange('personalDetails', 'gender', e.target.value)}
                >
                  <option value="">Select Gender</option>
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date of Birth */}
              <div className="form-group">
                <label htmlFor="dateOfBirth" className="form-label">
                  Date of Birth
                </label>
                <input
                  id="dateOfBirth"
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  className={`form-input ${errors['personalDetails.dateOfBirth'] ? 'input-error' : ''}`}
                  value={formData.personalDetails.dateOfBirth}
                  onChange={(e) => handleNestedChange('personalDetails', 'dateOfBirth', e.target.value)}
                />
                {errors['personalDetails.dateOfBirth'] && (
                  <p className="field-error-text">{errors['personalDetails.dateOfBirth']}</p>
                )}
              </div>

              {/* Height */}
              <div className="form-group">
                <label htmlFor="height" className="form-label">
                  Height (cm)
                </label>
                <input
                  id="height"
                  type="number"
                  min="50"
                  max="260"
                  placeholder="e.g. 175"
                  className={`form-input ${errors['personalDetails.height'] ? 'input-error' : ''}`}
                  value={formData.personalDetails.height}
                  onChange={(e) => handleNestedChange('personalDetails', 'height', e.target.value)}
                />
                {errors['personalDetails.height'] && (
                  <p className="field-error-text">{errors['personalDetails.height']}</p>
                )}
              </div>

              {/* Marital Status */}
              <div className="form-group">
                <label htmlFor="maritalStatus" className="form-label">
                  Marital Status
                </label>
                <select
                  id="maritalStatus"
                  className="form-input"
                  value={formData.personalDetails.maritalStatus}
                  onChange={(e) => handleNestedChange('personalDetails', 'maritalStatus', e.target.value)}
                >
                  <option value="">Select Marital Status</option>
                  {MARITAL_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mother Tongue */}
              <div className="form-group">
                <label htmlFor="motherTongue" className="form-label">
                  Mother Tongue
                </label>
                <input
                  id="motherTongue"
                  type="text"
                  maxLength={50}
                  placeholder="e.g. Tamil, English, Hindi"
                  className="form-input"
                  value={formData.personalDetails.motherTongue}
                  onChange={(e) => handleNestedChange('personalDetails', 'motherTongue', e.target.value)}
                />
              </div>

              {/* Location */}
              <div className="form-group">
                <label htmlFor="location" className="form-label">
                  Current Location / City
                </label>
                <input
                  id="location"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Chennai, Tamil Nadu"
                  className="form-input"
                  value={formData.personalDetails.location}
                  onChange={(e) => handleNestedChange('personalDetails', 'location', e.target.value)}
                />
              </div>

              {/* Candidate Contact Phone Number (Private) */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <label htmlFor="candidatePhone" className="form-label" style={{ marginBottom: 0, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Lock size={14} aria-hidden="true" style={{ color: 'var(--primary)' }} />
                    <span>Candidate Contact Phone Number</span>
                  </label>
                  <span className={`profile-status-badge ${hasCandidatePhone ? 'active' : 'pending'}`} style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}>
                    {hasCandidatePhone ? '✓ Phone Number Saved Privately' : 'Not Provided Yet'}
                  </span>
                </div>
                <input
                  id="candidatePhone"
                  type="tel"
                  maxLength={25}
                  placeholder={
                    hasCandidatePhone
                      ? 'Enter a new phone number only if you wish to update your saved number'
                      : 'e.g. +91 98765 43210'
                  }
                  className={`form-input ${errors.candidatePhone ? 'input-error' : ''}`}
                  value={formData.candidatePhone}
                  onChange={(e) => handleCandidatePhoneChange(e.target.value)}
                />
                {errors.candidatePhone && (
                  <p className="field-error-text">{errors.candidatePhone}</p>
                )}
                <div className="candidate-phone-privacy-card">
                  <Lock size={15} aria-hidden="true" />
                  <span>
                    <strong>Strictly Protected:</strong> Your phone number is kept private in the member directory and can only be unlocked by active subscribed members using verified contact credits.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Education & Profession */}
          <div className="profile-section-card">
            <h2 className="profile-section-title">
              <span className="profile-section-icon-box">
                <GraduationCap size={18} />
              </span>
              <span>2. Education & Profession</span>
            </h2>
            <div className="form-grid-2">
              {/* Educational Qualification */}
              <div className="form-group">
                <label htmlFor="educationalQualification" className="form-label">
                  Educational Qualification
                </label>
                <input
                  id="educationalQualification"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. B.Tech Computer Science, MBA"
                  className="form-input"
                  value={formData.educationAndProfession.educationalQualification}
                  onChange={(e) =>
                    handleNestedChange('educationAndProfession', 'educationalQualification', e.target.value)
                  }
                />
              </div>

              {/* Occupation */}
              <div className="form-group">
                <label htmlFor="occupation" className="form-label">
                  Occupation / Designation
                </label>
                <input
                  id="occupation"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Software Engineer, Doctor"
                  className="form-input"
                  value={formData.educationAndProfession.occupation}
                  onChange={(e) =>
                    handleNestedChange('educationAndProfession', 'occupation', e.target.value)
                  }
                />
              </div>

              {/* Company */}
              <div className="form-group">
                <label htmlFor="company" className="form-label">
                  Company / Organization
                </label>
                <input
                  id="company"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Tech Corp, Self-employed"
                  className="form-input"
                  value={formData.educationAndProfession.company}
                  onChange={(e) =>
                    handleNestedChange('educationAndProfession', 'company', e.target.value)
                  }
                />
              </div>

              {/* Work Location */}
              <div className="form-group">
                <label htmlFor="workLocation" className="form-label">
                  Work Location
                </label>
                <input
                  id="workLocation"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Bengaluru, Karnataka"
                  className="form-input"
                  value={formData.educationAndProfession.workLocation}
                  onChange={(e) =>
                    handleNestedChange('educationAndProfession', 'workLocation', e.target.value)
                  }
                />
              </div>

              {/* Income */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="income" className="form-label">
                  Annual Income
                </label>
                <input
                  id="income"
                  type="text"
                  maxLength={50}
                  placeholder="e.g. 12-15 LPA"
                  className="form-input"
                  value={formData.educationAndProfession.income}
                  onChange={(e) =>
                    handleNestedChange('educationAndProfession', 'income', e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          {/* Section 3: Family Details */}
          <div className="profile-section-card">
            <h2 className="profile-section-title">
              <span className="profile-section-icon-box">
                <Users size={18} />
              </span>
              <span>3. Family Details</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label htmlFor="familyInformation" className="form-label">
                  Family Overview & Background
                </label>
                <textarea
                  id="familyInformation"
                  maxLength={500}
                  rows={3}
                  placeholder="Briefly describe your family type, values, and background..."
                  className="form-textarea"
                  value={formData.familyDetails.familyInformation}
                  onChange={(e) =>
                    handleNestedChange('familyDetails', 'familyInformation', e.target.value)
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="parentInformation" className="form-label">
                  Parent Details (Father & Mother)
                </label>
                <textarea
                  id="parentInformation"
                  maxLength={500}
                  rows={2}
                  placeholder="Father's occupation, Mother's occupation..."
                  className="form-textarea"
                  value={formData.familyDetails.parentInformation}
                  onChange={(e) =>
                    handleNestedChange('familyDetails', 'parentInformation', e.target.value)
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="siblingInformation" className="form-label">
                  Sibling Details
                </label>
                <textarea
                  id="siblingInformation"
                  maxLength={500}
                  rows={2}
                  placeholder="Number of brothers/sisters, their marital status..."
                  className="form-textarea"
                  value={formData.familyDetails.siblingInformation}
                  onChange={(e) =>
                    handleNestedChange('familyDetails', 'siblingInformation', e.target.value)
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="familyLocation" className="form-label">
                  Family Native / Base Location
                </label>
                <input
                  id="familyLocation"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Madurai, Tamil Nadu"
                  className="form-input"
                  value={formData.familyDetails.familyLocation}
                  onChange={(e) =>
                    handleNestedChange('familyDetails', 'familyLocation', e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          {/* Section 4: Partner Preferences */}
          <div className="profile-section-card">
            <h2 className="profile-section-title">
              <span className="profile-section-icon-box">
                <Heart size={18} />
              </span>
              <span>4. Partner Preferences</span>
            </h2>
            <div className="form-grid-2">
              {/* Age Range */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Preferred Age Range (Years)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="number"
                    min="18"
                    max="100"
                    placeholder="Min (e.g. 24)"
                    className={`form-input ${errors['partnerPreferences.preferredAgeRange'] ? 'input-error' : ''}`}
                    value={formData.partnerPreferences.preferredAgeRange.min}
                    onChange={(e) => handleAgeRangeChange('min', e.target.value)}
                    style={{ maxWidth: '140px' }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>to</span>
                  <input
                    type="number"
                    min="18"
                    max="100"
                    placeholder="Max (e.g. 29)"
                    className={`form-input ${errors['partnerPreferences.preferredAgeRange'] ? 'input-error' : ''}`}
                    value={formData.partnerPreferences.preferredAgeRange.max}
                    onChange={(e) => handleAgeRangeChange('max', e.target.value)}
                    style={{ maxWidth: '140px' }}
                  />
                </div>
                {errors['partnerPreferences.preferredAgeRange'] && (
                  <p className="field-error-text">{errors['partnerPreferences.preferredAgeRange']}</p>
                )}
              </div>

              {/* Preferred Location */}
              <div className="form-group">
                <label htmlFor="preferredLocation" className="form-label">
                  Preferred Location
                </label>
                <input
                  id="preferredLocation"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Tamil Nadu, Bengaluru"
                  className="form-input"
                  value={formData.partnerPreferences.preferredLocation}
                  onChange={(e) =>
                    handleNestedChange('partnerPreferences', 'preferredLocation', e.target.value)
                  }
                />
              </div>

              {/* Education Preference */}
              <div className="form-group">
                <label htmlFor="educationPreference" className="form-label">
                  Education Preference
                </label>
                <input
                  id="educationPreference"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Any Graduate, Engineering, Medical"
                  className="form-input"
                  value={formData.partnerPreferences.educationPreference}
                  onChange={(e) =>
                    handleNestedChange('partnerPreferences', 'educationPreference', e.target.value)
                  }
                />
              </div>

              {/* Occupation Preference */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="occupationPreference" className="form-label">
                  Occupation Preference
                </label>
                <input
                  id="occupationPreference"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Software, Banking, Any Professional"
                  className="form-input"
                  value={formData.partnerPreferences.occupationPreference}
                  onChange={(e) =>
                    handleNestedChange('partnerPreferences', 'occupationPreference', e.target.value)
                  }
                />
              </div>

              {/* Other Preferences */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="otherPreferences" className="form-label">
                  Other Partner Preferences
                </label>
                <textarea
                  id="otherPreferences"
                  maxLength={500}
                  rows={3}
                  placeholder="Any dietary preferences, expectations, family values, etc..."
                  className="form-textarea"
                  value={formData.partnerPreferences.otherPreferences}
                  onChange={(e) =>
                    handleNestedChange('partnerPreferences', 'otherPreferences', e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          {/* Save & Profile Feedback (Near Save Changes Button) */}
          {formFeedback.text && (
            <div
              className={`alert ${formFeedback.type === 'success' ? 'alert-success' : 'alert-danger'}`}
              role={formFeedback.type === 'success' ? 'status' : 'alert'}
              aria-live={formFeedback.type === 'success' ? 'polite' : 'assertive'}
              style={{ marginBottom: '1.25rem', width: '100%' }}
            >
              <span className="alert-icon">
                {formFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              </span>
              <span>{formFeedback.text}</span>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="profile-actions-bar">
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              All matrimonial profile sections can be updated and saved at any time.
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary"
              style={{ minWidth: '190px', padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
            >
              {isSaving ? (
                <span className="btn-loading-content">
                  <span className="spinner-sm"></span>
                  Saving Profile...
                </span>
              ) : isExistingProfile ? (
                'Save Changes'
              ) : (
                'Create Profile'
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
