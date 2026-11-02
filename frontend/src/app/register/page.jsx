'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Phone,
  Heart,
  UserCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { registerUserApi, getCurrentUserApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import styles from '../auth.module.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export default function RegisterPage() {
  const router = useRouter();
  const { setCurrentUser, setAuthenticatedUser, checkAuth } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [successData, setSuccessData] = useState(null);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Full Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email Address is required';
    } else if (!EMAIL_REGEX.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < MIN_PASSWORD_LENGTH) {
      newErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm Password is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }

    if (serverError) {
      setServerError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await registerUserApi({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      if (response.success && response.status === 201) {
        // Automatically establish authenticated session in global state
        let authedUser = response.data;
        try {
          const meResponse = await getCurrentUserApi();
          if (meResponse && meResponse.success && meResponse.data) {
            authedUser = meResponse.data;
          }
        } catch (_) {}

        if (setCurrentUser) {
          setCurrentUser(authedUser);
        } else if (setAuthenticatedUser) {
          setAuthenticatedUser(authedUser);
        }

        if (checkAuth) {
          checkAuth();
        }

        setSuccessData(authedUser);
        setFormData({
          name: '',
          email: '',
          password: '',
          confirmPassword: '',
        });
        setErrors({});

        // Automatically navigate to profile completion after a short welcome delay
        setTimeout(() => {
          window.location.href = '/profile';
        }, 1800);
      } else {
        setServerError(response.message || 'Registration failed. Please check your details.');
        setFormData((prev) => ({
          ...prev,
          password: '',
          confirmPassword: '',
        }));
      }
    } catch (err) {
      setServerError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.bgGlowTop} aria-hidden="true" />
      <div className={styles.bgGlowBottom} aria-hidden="true" />

      <div className={styles.authContainer}>
        {/* Left Side: Brand Showcase */}
        <aside className={styles.showcaseSide}>
          <div>
            <div className={styles.brandBadge}>
              <Sparkles size={13} /> South Indian Matrimonial Traditions
            </div>
            <h2>
              Begin Your Family&apos;s <em>Sacred Journey</em>
            </h2>
            <p className={styles.showcaseDesc}>
              Create a free matrimonial account to browse verified candidate profiles, share family biodata, and find dignified matches.
            </p>
          </div>

          <div className={styles.perksList}>
            <div className={styles.perkItem}>
              <div className={styles.perkIconBox}>
                <UserCheck size={18} />
              </div>
              <div>
                <strong>100% Free Registration</strong>
                <span>Create your profile and start exploring candidates at zero cost.</span>
              </div>
            </div>

            <div className={styles.perkItem}>
              <div className={styles.perkIconBox}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <strong>Candidate Contact Shield</strong>
                <span>Personal phone numbers remain confidential and shielded from public search.</span>
              </div>
            </div>

            <div className={styles.perkItem}>
              <div className={styles.perkIconBox}>
                <Heart size={18} />
              </div>
              <div>
                <strong>Traditional Values</strong>
                <span>Designed specifically around Tamil, Telugu, Kannada, and Malayalam family values.</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Side: Registration Form / Success Confirmation */}
        <main className={styles.formSide}>
          {successData ? (
            /* Registration Success Confirmation */
            <div className={styles.successCard}>
              <div className={styles.successIconCircle} aria-hidden="true">
                <Check size={32} strokeWidth={2.4} />
              </div>

              <h2>Welcome, {successData.name}!</h2>
              <p>Your matrimonial account is active and you are now signed in.</p>

              <div className={styles.userInfoBox}>
                <div className={styles.userInfoRow}>
                  <span className={styles.userInfoLabel}>Full Name:</span>
                  <span className={styles.userInfoVal}>{successData.name}</span>
                </div>
                <div className={styles.userInfoRow}>
                  <span className={styles.userInfoLabel}>Email Address:</span>
                  <span className={styles.userInfoVal}>{successData.email}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                <Link
                  href="/profile"
                  className={styles.btnPrimary}
                >
                  Complete Your Profile <ArrowRight size={16} />
                </Link>
                <Link href="/members" className={styles.btnOutline}>
                  Browse Profiles
                </Link>
                <Link href="/" className={styles.btnOutline}>
                  Explore Website
                </Link>
              </div>
            </div>
          ) : (
            /* Registration Form */
            <div>
              <header className={styles.formHeader}>
                <span className={styles.kicker}>New Membership</span>
                <h1 className={styles.formTitle}>Create Account</h1>
                <p className={styles.formSubtitle}>
                  Begin your matrimonial journey with trusted profiles and families.
                </p>
              </header>

              {/* Server Error Alert */}
              {serverError && (
                <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
                  <AlertCircle size={18} color="#dc2626" />
                  <span>{serverError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className={styles.authForm} noValidate>
                {/* Full Name */}
                <div className={styles.formGroup}>
                  <label htmlFor="name" className={styles.label}>
                    Full Name <span className={styles.reqMark}>*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="e.g. Anand Kumar"
                    value={formData.name}
                    onChange={handleChange}
                    className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                    disabled={isSubmitting}
                    autoComplete="name"
                  />
                  {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                </div>

                {/* Email Address */}
                <div className={styles.formGroup}>
                  <label htmlFor="email" className={styles.label}>
                    Email Address <span className={styles.reqMark}>*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                    disabled={isSubmitting}
                    autoComplete="email"
                  />
                  {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                </div>

                {/* Password & Confirm Password Row */}
                <div className={styles.formRow}>
                  {/* Password */}
                  <div className={styles.formGroup}>
                    <label htmlFor="password" className={styles.label}>
                      Password <span className={styles.reqMark}>*</span>
                    </label>
                    <div className={styles.passwordWrapper}>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min 6 chars"
                        value={formData.password}
                        onChange={handleChange}
                        className={`${styles.input} ${styles.passwordInput} ${errors.password ? styles.inputError : ''}`}
                        disabled={isSubmitting}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className={styles.passwordToggle}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {errors.password && <span className={styles.errorText}>{errors.password}</span>}
                  </div>

                  {/* Confirm Password */}
                  <div className={styles.formGroup}>
                    <label htmlFor="confirmPassword" className={styles.label}>
                      Confirm Password <span className={styles.reqMark}>*</span>
                    </label>
                    <div className={styles.passwordWrapper}>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Re-enter"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className={`${styles.input} ${styles.passwordInput} ${errors.confirmPassword ? styles.inputError : ''}`}
                        disabled={isSubmitting}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className={styles.passwordToggle}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <span className={styles.errorText}>{errors.confirmPassword}</span>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Registering Account...' : 'Register Free'} <ArrowRight size={16} />
                </button>
              </form>

              {/* Link to Login */}
              <div className={styles.footerLinks}>
                Already have an account?{' '}
                <Link href="/login">
                  Sign in here
                </Link>
              </div>

              <p className={styles.agreementText}>
                By registering, you agree to find genuine matrimonial matches with verified profiles.
              </p>

              {/* Return to Home Link */}
              <div className={styles.returnHome}>
                <Link href="/" className={styles.returnHomeLink}>
                  <ArrowLeft size={14} /> Return to Home
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
