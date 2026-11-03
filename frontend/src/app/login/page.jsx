'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Phone,
  Heart,
  RefreshCw,
} from 'lucide-react';
import { loginUserApi, getCurrentUserApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import styles from '../auth.module.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { currentUser, authLoading, setCurrentUser, logout } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [logoutMessage, setLogoutMessage] = useState('');

  // Automatically redirect authenticated admins directly into the Admin Dashboard
  useEffect(() => {
    if (!authLoading && currentUser && currentUser.role === 'admin') {
      window.location.href = '/admin';
    }
  }, [currentUser, authLoading]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!EMAIL_REGEX.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
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

    if (logoutMessage) {
      setLogoutMessage('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setLogoutMessage('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await loginUserApi({
        email: formData.email.trim(),
        password: formData.password,
      });

      setFormData((prev) => ({
        ...prev,
        password: '',
      }));

      if (response.success && response.status === 200) {
        const authenticatedUser = response.data;
        setCurrentUser(authenticatedUser);
        setFormData({ email: '', password: '' });
        setErrors({});
        setServerError('');
        setLogoutMessage('');
        if (authenticatedUser && authenticatedUser.role === 'admin') {
          window.location.href = '/admin';
          return;
        } else {
          window.location.href = '/profile';
          return;
        }
      } else {
        setServerError(response.message || 'Invalid email or password');
      }
    } catch (err) {
      setServerError('Unable to connect. Please check your network connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsSubmitting(true);
    setServerError('');

    try {
      await logout();
      setLogoutMessage('You have been logged out successfully.');
      setFormData({ email: '', password: '' });
      setErrors({});
    } catch (err) {
      setServerError('An unexpected error occurred during logout.');
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
              <Sparkles size={13} /> ஸ்ரீ வாராஹி &bull; South Indian Matrimonial Traditions
            </div>
            <h2>
              A Dignified Path to <em>Lifelong Alliances</em>
            </h2>
            <p className={styles.showcaseDesc}>
              Connect with verified South Indian families who share your cultural heritage, language, and core values.
            </p>
          </div>

          <div className={styles.perksList}>
            <div className={styles.perkItem}>
              <div className={styles.perkIconBox}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <strong>Phone Privacy Shield</strong>
                <span>Contact numbers are protected and never displayed openly.</span>
              </div>
            </div>

            <div className={styles.perkItem}>
              <div className={styles.perkIconBox}>
                <Phone size={18} />
              </div>
              <div>
                <strong>50 Monthly Unlocks</strong>
                <span>Transparent monthly contact credits with zero repeat deductions.</span>
              </div>
            </div>

            <div className={styles.perkItem}>
              <div className={styles.perkIconBox}>
                <Heart size={18} />
              </div>
              <div>
                <strong>Verified Families</strong>
                <span>Profiles curated with genuine biodata and family details.</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Side: Form / Authenticated State */}
        <main className={styles.formSide}>
          {authLoading || (currentUser && currentUser.role === 'admin') ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--muted)' }}>
              <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--rose-deep)', margin: '0 auto 1rem' }} />
              <p>{currentUser?.role === 'admin' ? 'Redirecting to Admin Dashboard...' : 'Verifying secure session...'}</p>
            </div>
          ) : currentUser ? (
            /* Authenticated Overview Card */
            <div className={styles.authConfirmedCard}>
              <div className={styles.avatarBadge} aria-hidden="true">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>

              <h2>Welcome back, {currentUser.name}!</h2>
              <p>Your matrimonial session is active and secure.</p>

              <div className={styles.userInfoBox}>
                <div className={styles.userInfoRow}>
                  <span className={styles.userInfoLabel}>Full Name:</span>
                  <span className={styles.userInfoVal}>{currentUser.name}</span>
                </div>
                <div className={styles.userInfoRow}>
                  <span className={styles.userInfoLabel}>Email Address:</span>
                  <span className={styles.userInfoVal}>{currentUser.email}</span>
                </div>
              </div>

              {currentUser.role === 'admin' ? (
                <Link
                  href="/admin"
                  className={styles.btnPrimary}
                  style={{ width: '100%', marginBottom: '0.75rem' }}
                >
                  Go to Admin Console <ArrowRight size={16} />
                </Link>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginBottom: '0.75rem' }}>
                  <Link href="/profile" className={styles.btnPrimary}>
                    View My Profile <ArrowRight size={16} />
                  </Link>
                  <Link href="/members" className={styles.btnOutline}>
                    Browse Profiles
                  </Link>
                </div>
              )}

              <button
                type="button"
                onClick={handleLogout}
                disabled={isSubmitting}
                className={styles.btnOutlineDanger}
                style={{ marginTop: '0.75rem' }}
              >
                {isSubmitting ? 'Logging Out...' : 'Log Out of Account'}
              </button>

              <div className={styles.returnHome}>
                <Link href="/" className={styles.returnHomeLink}>
                  <ArrowLeft size={14} /> Return to Home
                </Link>
              </div>
            </div>
          ) : (
            /* Login Form */
            <div>
              <header className={styles.formHeader}>
                <span className={styles.kicker}>Member Portal</span>
                <h1 className={styles.formTitle}>Welcome Back</h1>
                <p className={styles.formSubtitle}>
                  Sign in to access your matrimonial profile and prospective matches.
                </p>
              </header>

              {/* Logout Notice Banner */}
              {logoutMessage && (
                <div className={`${styles.alert} ${styles.alertSuccess}`} role="alert">
                  <CheckCircle2 size={18} color="#15803d" />
                  <span>{logoutMessage}</span>
                </div>
              )}

              {/* Server Error Banner */}
              {serverError && (
                <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
                  <AlertCircle size={18} color="#dc2626" />
                  <span>{serverError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className={styles.authForm} noValidate>
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

                {/* Password with Show/Hide Control */}
                <div className={styles.formGroup}>
                  <div className={styles.labelRow}>
                    <label htmlFor="password" className={styles.label}>
                      Password <span className={styles.reqMark}>*</span>
                    </label>
                    <Link href="/forgot-password" className={styles.forgotLink}>
                      Forgot Password?
                    </Link>
                  </div>
                  <div className={styles.passwordWrapper}>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`${styles.input} ${styles.passwordInput} ${errors.password ? styles.inputError : ''}`}
                      disabled={isSubmitting}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className={styles.passwordToggle}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.password && <span className={styles.errorText}>{errors.password}</span>}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Signing In...' : 'Sign In'} <ArrowRight size={16} />
                </button>
              </form>

              {/* Link to Registration */}
              <div className={styles.footerLinks}>
                Don&apos;t have an account?{' '}
                <Link href="/register">
                  Register free
                </Link>
              </div>

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
