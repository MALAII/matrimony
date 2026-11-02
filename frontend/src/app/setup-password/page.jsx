'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { verifySetupTokenApi, setupPasswordApi } from '@/lib/api';
import styles from '../auth.module.css';

function SetupPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  // State
  const [tokenStatus, setTokenStatus] = useState('verifying'); // 'verifying' | 'valid' | 'invalid'
  const [tokenError, setTokenError] = useState('');
  const [candidateInfo, setCandidateInfo] = useState({ name: '', email: '' });

  // Form State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
          setTokenError('Invitation token is missing from the URL. Please verify your invitation link.');
        }
        return;
      }

      try {
        const res = await verifySetupTokenApi(token.trim());
        if (!isMounted) return;

        if (res.success && res.data) {
          setTokenStatus('valid');
          setCandidateInfo(res.data);
        } else {
          setTokenStatus('invalid');
          setTokenError(res.message || 'This invitation link is invalid, expired, or has already been used.');
        }
      } catch (err) {
        if (isMounted) {
          setTokenStatus('invalid');
          setTokenError('Unable to verify your invitation link. Please check your network connection and try again.');
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
      errors.confirmPassword = 'Please confirm your password.';
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
      const res = await setupPasswordApi({
        token: token.trim(),
        password,
      });

      if (res.success) {
        setIsSuccess(true);
      } else {
        setSubmitError(res.message || 'Failed to configure your password. Please try again.');
      }
    } catch (err) {
      setSubmitError('A network error occurred while submitting your password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Token Verification Loading State
  if (tokenStatus === 'verifying') {
    return (
      <div className={styles.authContainerNarrow} style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
        <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--rose-deep)', margin: '0 auto 1.25rem' }} />
        <h2 className={styles.formTitle} style={{ fontSize: '1.4rem' }}>Verifying Invitation Link...</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.92rem', marginTop: '0.5rem' }}>
          Validating your single-use security token.
        </p>
      </div>
    );
  }

  // 2. Token Invalid or Expired State
  if (tokenStatus === 'invalid') {
    return (
      <div className={styles.authContainerNarrow} style={{ textAlign: 'center' }}>
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
        <h1 className={styles.formTitle} style={{ color: '#991b1b', fontSize: '1.45rem' }}>
          Invitation Link Expired or Invalid
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.95rem', margin: '1rem 0 1.5rem', lineHeight: 1.6 }}>
          {tokenError}
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '2rem' }}>
          If your invitation has expired, please contact the marriage bureau administrator to request a new invitation link.
        </p>
        <Link href="/login" className={styles.btnPrimary}>
          Go to Sign In <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  // 3. Success State
  if (isSuccess) {
    return (
      <div className={styles.authContainerNarrow}>
        <div className={styles.successCard}>
          <div className={styles.successIconCircle} aria-hidden="true">
            <CheckCircle2 size={32} />
          </div>
          <h2>Password Configured Successfully!</h2>
          <p>
            Your matrimonial candidate account has been activated. You can now log in using your email address (<strong>{candidateInfo.email}</strong>) and your chosen password.
          </p>
          <Link href="/login" className={styles.btnPrimary}>
            Sign In with New Password <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  // 4. Default Setup Password Form
  return (
    <div className={styles.authContainerNarrow}>
      <header className={styles.formHeader}>
        <span className={styles.kicker}>Account Activation</span>
        <h1 className={styles.formTitle}>Set Up Your Password</h1>
        <p className={styles.formSubtitle}>
          Welcome, <strong>{candidateInfo.name || 'Candidate'}</strong>. Please choose a strong password to complete your matrimonial account setup.
        </p>
      </header>

      {submitError && (
        <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
          <AlertCircle size={18} color="#dc2626" />
          <span>{submitError}</span>
        </div>
      )}

      <div className={styles.userInfoBox} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.userInfoRow}>
          <span className={styles.userInfoLabel}>Account Email:</span>
          <span className={styles.userInfoVal}>{candidateInfo.email}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.authForm} noValidate>
        {/* New Password */}
        <div className={styles.formGroup}>
          <label htmlFor="password" className={styles.label}>
            Create Password <span className={styles.reqMark}>*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Minimum 12 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (formErrors.password) setFormErrors((p) => ({ ...p, password: '' }));
            }}
            className={`${styles.input} ${formErrors.password ? styles.inputError : ''}`}
            disabled={isSubmitting}
            autoComplete="new-password"
          />
          {formErrors.password && <span className={styles.errorText}>{formErrors.password}</span>}
        </div>

        {/* Confirm Password */}
        <div className={styles.formGroup}>
          <label htmlFor="confirmPassword" className={styles.label}>
            Confirm Password <span className={styles.reqMark}>*</span>
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Re-enter your password"
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
          {isSubmitting ? 'Configuring Password...' : 'Activate Account & Set Password'} <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <div className={styles.page}>
      <div className={styles.bgGlowTop} aria-hidden="true" />
      <div className={styles.bgGlowBottom} aria-hidden="true" />

      <Suspense
        fallback={
          <div className={styles.authContainerNarrow} style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
            <RefreshCw size={30} className="animate-spin" style={{ color: 'var(--rose-deep)', margin: '0 auto 1.25rem' }} />
            <p style={{ color: 'var(--muted)' }}>Loading invitation verification...</p>
          </div>
        }
      >
        <SetupPasswordContent />
      </Suspense>
    </div>
  );
}
