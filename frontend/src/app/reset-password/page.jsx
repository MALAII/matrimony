'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Sparkles, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { verifyResetTokenApi, resetPasswordApi } from '@/lib/api';
import styles from '../auth.module.css';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  // State
  const [tokenStatus, setTokenStatus] = useState('verifying'); // 'verifying' | 'valid' | 'invalid'
  const [tokenError, setTokenError] = useState('');
  const [userEmail, setUserEmail] = useState('');

  // Form State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      if (!token || !token.trim()) {
        if (isMounted) {
          setTokenStatus('invalid');
          setTokenError('Password reset token is missing from the URL. Please verify your reset link.');
        }
        return;
      }

      try {
        const res = await verifyResetTokenApi(token.trim());
        if (!isMounted) return;

        if (res.success && res.data) {
          setTokenStatus('valid');
          setUserEmail(res.data.email || '');
        } else {
          setTokenStatus('invalid');
          setTokenError(res.message || 'This password reset link is invalid, expired, or has already been used.');
        }
      } catch (err) {
        if (isMounted) {
          setTokenStatus('invalid');
          setTokenError('Unable to verify your reset link. Please check your network connection and try again.');
        }
      }
    }

    checkToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const validateForm = () => {
    const errors = {};

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 12) {
      errors.password = 'Password must be at least 12 characters long for security.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await resetPasswordApi({
        token: token.trim(),
        password,
      });

      if (res.success) {
        setIsSuccess(true);
      } else {
        setSubmitError(res.message || 'Failed to reset password. The link may have expired.');
      }
    } catch (err) {
      setSubmitError('Unable to complete password reset. Please check your network connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.authContainerNarrow}>
      <header className={styles.formHeader}>
        <span className={styles.kicker}>Account Security</span>
        <h1 className={styles.formTitle}>
          {isSuccess ? 'Password Reset Complete' : 'Reset Your Password'}
        </h1>
        <p className={styles.formSubtitle}>
          {isSuccess
            ? 'Your credentials have been securely updated.'
            : 'Choose a strong, unique password to secure your account.'}
        </p>
      </header>

      {/* State A: Loading / Verifying Token */}
      {tokenStatus === 'verifying' && (
        <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--rose-deep)', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
            Verifying your password reset link...
          </p>
        </div>
      )}

      {/* State B: Invalid or Expired Token */}
      {tokenStatus === 'invalid' && (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 1.25rem auto',
            }}
          >
            <AlertCircle size={32} />
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#991b1b', marginBottom: '0.75rem' }}>
            Link Expired or Invalid
          </h2>

          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
            {tokenError}
          </p>

          <Link href="/forgot-password" className={styles.btnPrimary} style={{ width: '100%', marginBottom: '1rem' }}>
            Request a New Reset Link <ArrowRight size={16} />
          </Link>

          <div className={styles.returnHome}>
            <Link href="/login" className={styles.returnHomeLink}>
              <ArrowLeft size={14} /> Return to Sign In
            </Link>
          </div>
        </div>
      )}

      {/* State C: Success */}
      {tokenStatus === 'valid' && isSuccess && (
        <div className={styles.successCard}>
          <div className={styles.successIconCircle} aria-hidden="true">
            <CheckCircle2 size={32} />
          </div>

          <h2>Password Updated Successfully</h2>

          <p>
            Your account password has been updated. You can now sign in with your new credentials.
          </p>

          <Link href="/login" className={styles.btnPrimary}>
            Sign In with New Password <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {/* State D: Valid Token - Form */}
      {tokenStatus === 'valid' && !isSuccess && (
        <div>
          {submitError && (
            <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
              <AlertCircle size={18} color="#dc2626" />
              <span>{submitError}</span>
            </div>
          )}

          {userEmail && (
            <div className={styles.userInfoBox} style={{ marginBottom: '1.25rem' }}>
              <div className={styles.userInfoRow}>
                <span className={styles.userInfoLabel}>Account:</span>
                <span className={styles.userInfoVal}>{userEmail}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.authForm} noValidate>
            {/* New Password */}
            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.label}>
                New Password <span className={styles.reqMark}>*</span>
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 12 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formErrors.password) setFormErrors((p) => ({ ...p, password: '' }));
                  }}
                  className={`${styles.input} ${styles.passwordInput} ${formErrors.password ? styles.inputError : ''}`}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className={styles.passwordToggle}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              {formErrors.password && <span className={styles.errorText}>{formErrors.password}</span>}
            </div>

            {/* Confirm Password */}
            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirm New Password <span className={styles.reqMark}>*</span>
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (formErrors.confirmPassword) setFormErrors((p) => ({ ...p, confirmPassword: '' }));
                }}
                className={`${styles.input} ${formErrors.confirmPassword ? styles.inputError : ''}`}
                disabled={isSubmitting}
                autoComplete="new-password"
              />
              {formErrors.confirmPassword && (
                <span className={styles.errorText}>{formErrors.confirmPassword}</span>
              )}
            </div>

            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating Password...' : 'Save New Password'} <ArrowRight size={16} />
            </button>
          </form>

          <div className={styles.returnHome}>
            <Link href="/login" className={styles.returnHomeLink}>
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className={styles.page}>
      <div className={styles.bgGlowTop} aria-hidden="true" />
      <div className={styles.bgGlowBottom} aria-hidden="true" />

      <Suspense
        fallback={
          <div className={styles.authContainerNarrow} style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--rose-deep)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--muted)' }}>Loading security verification...</p>
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
