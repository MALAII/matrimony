'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getAdminMeApi,
  createBrokerProfileApi,
  uploadAdminBrokerPhotoApi,
} from '@/lib/api';
import { AdminNav } from '@/components/admin/AdminNav';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

const MARITAL_STATUS_OPTIONS = [
  'Never Married',
  'Divorced',
  'Widowed',
  'Awaiting Divorce',
];

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export default function NewBrokerProfilePage() {
  const router = useRouter();

  // Authorization & Page State
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    candidateName: '',
    candidateEmail: '',
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
  const photoInputRef = useRef(null);

  // Form Feedback & Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formFeedback, setFormFeedback] = useState({ type: '', text: '' });
  const [createdProfile, setCreatedProfile] = useState(null);
  const [photoUploadError, setPhotoUploadError] = useState('');
  const [isRetryingPhoto, setIsRetryingPhoto] = useState(false);

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

  // Handle generic nested field changes
  const handleInputChange = (section, field, value, subField = null) => {
    // Clear validation error on change
    if (section === null && errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }

    if (section === null) {
      setFormData((prev) => ({ ...prev, [field]: value }));
    } else if (subField) {
      setFormData((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: {
            ...prev[section][field],
            [subField]: value,
          },
        },
      }));
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

  // Photo selection handler with size and type checks
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type.toLowerCase())) {
      setFormFeedback({
        type: 'error',
        text: 'Unsupported image type. Only JPG, PNG, and WebP files are allowed.',
      });
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setFormFeedback({
        type: 'error',
        text: 'Photo size exceeds the maximum allowed limit of 5 MB.',
      });
      return;
    }

    setSelectedPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
    setFormFeedback({ type: '', text: '' });
  };

  const handleRemovePhoto = () => {
    setSelectedPhotoFile(null);
    setPhotoPreview('');
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
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
      const payload = {
        candidateName: formData.candidateName.trim(),
        candidateEmail: formData.candidateEmail.trim() || undefined,
        candidatePhone: formData.candidatePhone.trim() || undefined,
        personalDetails: {
          gender: formData.personalDetails.gender || undefined,
          dateOfBirth: formData.personalDetails.dateOfBirth || undefined,
          height: formData.personalDetails.height ? Number(formData.personalDetails.height) : undefined,
          maritalStatus: formData.personalDetails.maritalStatus || undefined,
          motherTongue: formData.personalDetails.motherTongue.trim() || undefined,
          location: formData.personalDetails.location.trim() || undefined,
        },
        educationAndProfession: {
          educationalQualification: formData.educationAndProfession.educationalQualification.trim() || undefined,
          occupation: formData.educationAndProfession.occupation.trim() || undefined,
          company: formData.educationAndProfession.company.trim() || undefined,
          workLocation: formData.educationAndProfession.workLocation.trim() || undefined,
          income: formData.educationAndProfession.income.trim() || undefined,
        },
        familyDetails: {
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
          preferredLocation: formData.partnerPreferences.preferredLocation.trim() || undefined,
          educationPreference: formData.partnerPreferences.educationPreference.trim() || undefined,
          occupationPreference: formData.partnerPreferences.occupationPreference.trim() || undefined,
          otherPreferences: formData.partnerPreferences.otherPreferences.trim() || undefined,
        },
      };

      // 2. Submit broker profile creation
      const res = await createBrokerProfileApi(payload);

      if (!res.success || !res.data) {
        setFormFeedback({
          type: 'error',
          text: res.message || 'Failed to create broker profile. Please try again.',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setIsSubmitting(false);
        return;
      }

      const created = res.data;
      setCreatedProfile(created);

      // 3. If a photo was selected, upload it now
      if (selectedPhotoFile && created._id) {
        const photoRes = await uploadAdminBrokerPhotoApi(created._id, selectedPhotoFile);
        if (!photoRes.success) {
          setPhotoUploadError(
            photoRes.message ||
              'Profile was created successfully, but photograph upload failed. You can retry photo upload below.'
          );
        } else {
          setFormFeedback({
            type: 'success',
            text: 'Broker candidate profile created and photograph uploaded successfully!',
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

  // Safe retry for photo upload without recreating the profile
  const handleRetryPhotoUpload = async () => {
    if (!createdProfile?._id || !selectedPhotoFile || isRetryingPhoto) return;

    setIsRetryingPhoto(true);
    setPhotoUploadError('');

    try {
      const photoRes = await uploadAdminBrokerPhotoApi(createdProfile._id, selectedPhotoFile);
      if (photoRes.success) {
        setFormFeedback({
          type: 'success',
          text: 'Photograph uploaded successfully for the created broker profile!',
        });
      } else {
        setPhotoUploadError(photoRes.message || 'Photograph upload failed again. Please try another image.');
      }
    } catch (err) {
      setPhotoUploadError('Network error while uploading photograph.');
    } finally {
      setIsRetryingPhoto(false);
    }
  };

  // Access Denied State
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
              Administrator privileges required. You do not have permission to create broker candidate profiles.
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
            <h1>Create Broker Matrimonial Profile</h1>
            <p>
              Enter offline broker-sourced candidate details without requiring an email address or user account.
            </p>
          </div>
          <Link href="/admin/profiles" className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
            ← Back to Profiles Directory
          </Link>
        </div>

        {/* Navigation Tabs */}
        <AdminNav />

        {/* Success Banner When Profile Created */}
        {createdProfile && (
          <div
            style={{
              background: '#ecfdf5',
              border: '1px solid #6ee7b7',
              borderRadius: 'var(--radius-lg)',
              padding: '1.75rem',
              marginBottom: '2rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>🎉</span>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: '#065f46', margin: 0 }}>
                  Profile Successfully Created!
                </h2>
                <p style={{ margin: '0.25rem 0 0', color: '#047857', fontSize: '0.9rem' }}>
                  Candidate: <strong>{createdProfile.candidateName}</strong> • System ID:{' '}
                  <code>{createdProfile._id}</code>
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '1rem 0' }}>
              <span className="badge badge-warning">Origin: Broker-Sourced</span>
              <span className="badge badge-warning">Approval: Pending Approval</span>
              <span className="badge badge-success">Activity: Active</span>
            </div>

            {/* Photo Upload Failure Alert inside Success Box */}
            {photoUploadError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--danger)',
                  fontSize: '0.9rem',
                  margin: '1rem 0',
                }}
              >
                <p style={{ marginBottom: '0.75rem' }}>⚠️ {photoUploadError}</p>
                {selectedPhotoFile && (
                  <button
                    type="button"
                    onClick={handleRetryPhotoUpload}
                    disabled={isRetryingPhoto}
                    className="btn-primary"
                    style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}
                  >
                    {isRetryingPhoto ? 'Retrying Upload...' : 'Retry Photo Upload'}
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
              <Link href="/admin/profiles" className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
                View in Profiles Directory →
              </Link>
              <button
                type="button"
                onClick={() => {
                  setCreatedProfile(null);
                  setPhotoUploadError('');
                  setFormFeedback({ type: '', text: '' });
                  handleRemovePhoto();
                  setFormData({
                    candidateName: '',
                    candidateEmail: '',
                    candidatePhone: '',
                    personalDetails: { gender: '', dateOfBirth: '', height: '', maritalStatus: '', motherTongue: '', location: '' },
                    educationAndProfession: { educationalQualification: '', occupation: '', company: '', workLocation: '', income: '' },
                    familyDetails: { familyInformation: '', parentInformation: '', siblingInformation: '', familyLocation: '' },
                    partnerPreferences: { preferredAgeRange: { min: '', max: '' }, preferredLocation: '', educationPreference: '', occupationPreference: '', otherPreferences: '' },
                  });
                }}
                className="btn-secondary"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                + Create Another Broker Profile
              </button>
            </div>
          </div>
        )}

        {/* Form Feedback Alerts */}
        {formFeedback.text && (
          <div
            style={{
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-md)',
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
            <span>{formFeedback.type === 'error' ? '⚠️' : '✅'}</span>
            <span>{formFeedback.text}</span>
          </div>
        )}

        {/* Profile Creation Form */}
        {!createdProfile && (
          <form onSubmit={handleSubmit} noValidate>
            {/* 1. Candidate Contact Information Card */}
            <div className="profile-section-card">
              <h2 className="profile-section-title">
                <span className="section-icon">📋</span> Candidate Details (Broker Provided)
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

            {/* 2. Personal Details Card */}
            <div className="profile-section-card">
              <h2 className="profile-section-title">
                <span className="section-icon">👤</span> 1. Personal Details
              </h2>
              <div className="form-grid-3">
                <div className="form-group">
                  <label htmlFor="gender" className="form-label">Gender</label>
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
                  <label htmlFor="motherTongue" className="form-label">Mother Tongue</label>
                  <input
                    id="motherTongue"
                    type="text"
                    maxLength={50}
                    placeholder="e.g. Tamil, Telugu, Hindi"
                    value={formData.personalDetails.motherTongue}
                    onChange={(e) => handleInputChange('personalDetails', 'motherTongue', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="location" className="form-label">Current Location / City</label>
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
              </div>
            </div>

            {/* 3. Education & Profession Card */}
            <div className="profile-section-card">
              <h2 className="profile-section-title">
                <span className="section-icon">🎓</span> 2. Education &amp; Professional Details
              </h2>
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="educationalQualification" className="form-label">Educational Qualification</label>
                  <input
                    id="educationalQualification"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. B.Tech / MBA / MBBS"
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
                    placeholder="e.g. Senior Software Engineer"
                    value={formData.educationAndProfession.occupation}
                    onChange={(e) => handleInputChange('educationAndProfession', 'occupation', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="company" className="form-label">Company Name</label>
                  <input
                    id="company"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Infosys, TCS, Startup"
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
                  <label htmlFor="income" className="form-label">Annual Income</label>
                  <input
                    id="income"
                    type="text"
                    maxLength={50}
                    placeholder="e.g. 15-20 LPA"
                    value={formData.educationAndProfession.income}
                    onChange={(e) => handleInputChange('educationAndProfession', 'income', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* 4. Family Details Card */}
            <div className="profile-section-card">
              <h2 className="profile-section-title">
                <span className="section-icon">👨‍👩‍👧‍👦</span> 3. Family Details
              </h2>
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="familyInformation" className="form-label">Family Background</label>
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
                  <label htmlFor="parentInformation" className="form-label">Parents Information</label>
                  <textarea
                    id="parentInformation"
                    maxLength={500}
                    placeholder="Father and mother's occupation, status..."
                    value={formData.familyDetails.parentInformation}
                    onChange={(e) => handleInputChange('familyDetails', 'parentInformation', e.target.value)}
                    className="form-textarea"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="siblingInformation" className="form-label">Siblings Information</label>
                  <textarea
                    id="siblingInformation"
                    maxLength={500}
                    placeholder="Number of brothers/sisters, marital status..."
                    value={formData.familyDetails.siblingInformation}
                    onChange={(e) => handleInputChange('familyDetails', 'siblingInformation', e.target.value)}
                    className="form-textarea"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="familyLocation" className="form-label">Family Origin Location</label>
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

            {/* 5. Partner Preferences Card */}
            <div className="profile-section-card">
              <h2 className="profile-section-title">
                <span className="section-icon">💍</span> 4. Partner Preferences
              </h2>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Preferred Partner Age Range</label>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="18"
                      max="100"
                      placeholder="Min Age"
                      value={formData.partnerPreferences.preferredAgeRange.min}
                      onChange={(e) => handleInputChange('partnerPreferences', 'preferredAgeRange', e.target.value, 'min')}
                      className="form-input"
                    />
                    <span style={{ color: 'var(--text-muted)' }}>to</span>
                    <input
                      type="number"
                      min="18"
                      max="100"
                      placeholder="Max Age"
                      value={formData.partnerPreferences.preferredAgeRange.max}
                      onChange={(e) => handleInputChange('partnerPreferences', 'preferredAgeRange', e.target.value, 'max')}
                      className="form-input"
                    />
                  </div>
                  {errors.minAge && <span className="form-error">{errors.minAge}</span>}
                  {errors.maxAge && <span className="form-error">{errors.maxAge}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="preferredLocation" className="form-label">Preferred Location</label>
                  <input
                    id="preferredLocation"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Any Metro City, Chennai, Abroad"
                    value={formData.partnerPreferences.preferredLocation}
                    onChange={(e) => handleInputChange('partnerPreferences', 'preferredLocation', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="educationPreference" className="form-label">Education Preference</label>
                  <input
                    id="educationPreference"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Graduate or Above"
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
                    maxLength={100}
                    placeholder="e.g. Working Professional, IT, Govt"
                    value={formData.partnerPreferences.occupationPreference}
                    onChange={(e) => handleInputChange('partnerPreferences', 'occupationPreference', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* 6. Candidate Photograph Upload Card */}
            <div className="profile-section-card">
              <h2 className="profile-section-title">
                <span className="section-icon">📷</span> 5. Candidate Photograph (Optional)
              </h2>
              <div className="photo-upload-box">
                <div className="profile-thumb-avatar" style={{ width: 80, height: 80, fontSize: '2rem' }}>
                  {photoPreview ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={photoPreview} alt="Candidate preview" className="profile-thumb-img" />
                  ) : (
                    <span>📸</span>
                  )}
                </div>

                <div>
                  <input
                    ref={photoInputRef}
                    id="brokerPhotoInput"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoSelect}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="btn-upload"
                      style={{ padding: '0.55rem 1.15rem' }}
                    >
                      {photoPreview ? 'Change Photo' : 'Select Photograph'}
                    </button>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="btn-reset"
                        style={{ padding: '0.55rem 1rem' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.4rem' }}>
                    Supported formats: JPG, PNG, WebP (Max 5 MB). Uploaded securely to Cloudinary after profile creation.
                  </span>
                </div>
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
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <Link href="/admin/profiles" className="btn-secondary" style={{ padding: '0.75rem 1.5rem' }}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary"
                style={{ padding: '0.75rem 2rem', fontWeight: 600 }}
              >
                {isSubmitting ? 'Creating Profile...' : 'Create Broker Profile'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
