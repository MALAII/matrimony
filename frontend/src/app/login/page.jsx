'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { loginUserApi, getCurrentUserApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { currentUser, authLoading, setCurrentUser, logout } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [logoutMessage, setLogoutMessage] = useState('');

  // Form field validation
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
      // 1. Send login credentials to backend
      const response = await loginUserApi({
        email: formData.email.trim(),
        password: formData.password,
      });

      // Clear password from memory/state immediately for security
      setFormData((prev) => ({
        ...prev,
        password: '',
      }));

      if (response.success && response.status === 200) {
        // 2. Verify active session by querying /api/auth/me via HttpOnly cookie
        const meResponse = await getCurrentUserApi();
        const authenticatedUser = (meResponse.success && meResponse.data) ? meResponse.data : response.data;
        setCurrentUser(authenticatedUser);
        setFormData({ email: '', password: '' });
        setErrors({});
        setServerError('');
        setLogoutMessage('');
      } else {
        setServerError(response.message || 'Invalid email or password');
      }
    } catch (err) {
      setServerError('Unable to connect to the server. Please try again.');
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
    <div className="auth-page">
      {/* Background Kolam Ornaments (tasteful, subtle, behind form) */}
      <div className="auth-kolam-bg auth-kolam-tl" aria-hidden="true">
        <Image src="/images/kolam-corner.svg" alt="" width={150} height={150} />
      </div>
      <div className="auth-kolam-bg auth-kolam-br" aria-hidden="true">
        <Image src="/images/kolam-corner.svg" alt="" width={150} height={150} />
      </div>
      <div className="auth-kolam-watermark" aria-hidden="true">
        <Image src="/images/kolam-watermark.svg" alt="" width={300} height={300} />
      </div>

      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-brand-mark" aria-hidden="true">
            <span className="brand-emblem">
              <Sparkles size={20} />
            </span>
          </div>
          <div className="auth-eyebrow">
            <Sparkles size={12} className="auth-eyebrow-sparkle" aria-hidden="true" />
            <span>South Indian Matrimonial Traditions</span>
          </div>
          <h1 className="auth-title">
            {currentUser ? 'Account Overview' : 'Welcome Back'}
          </h1>
          <p className="auth-subtitle">
            {currentUser
              ? 'You are securely logged into your Matrimony account.'
              : 'Sign in to access your matrimonial profile and matches.'}
          </p>
        </div>

        {/* Loading Spinner during initial session verification */}
        {authLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
            Checking authentication session...
          </div>
        ) : currentUser ? (
          /* Authenticated Confirmation Panel */
          <div className="authenticated-card">
            <div className="user-avatar-circle" aria-hidden="true">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>

            <h2 className="success-title">
              Welcome back, {currentUser.name}!
            </h2>
            <p className="success-subtitle">
              Your matrimonial session is active and secure.
            </p>

            {/* Safe Account Information (never exposes password or passwordHash) */}
            <div className="user-info-table">
              <div className="user-info-row">
                <span className="user-info-label">Full Name:</span>
                <span className="user-info-value">{currentUser.name}</span>
              </div>
              <div className="user-info-row">
                <span className="user-info-label">Email Address:</span>
                <span className="user-info-value">{currentUser.email}</span>
              </div>
              <div className="user-info-row">
                <span className="user-info-label">Account Role:</span>
                <span className="user-info-value" style={{ textTransform: 'capitalize' }}>
                  {currentUser.role}
                </span>
              </div>
              {currentUser.id && (
                <div className="user-info-row">
                  <span className="user-info-label">User ID:</span>
                  <span
                    className="user-info-value"
                    style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
                  >
                    {currentUser.id}
                  </span>
                </div>
              )}
            </div>

            {/* Role-based destination action */}
            {currentUser.role === 'admin' ? (
              <Link
                href="/admin"
                className="btn-primary"
                style={{ width: '100%', marginBottom: '0.65rem' }}
              >
                Go to Admin Dashboard <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%' }}>
                <Link
                  href="/profile"
                  className="btn-primary"
                  style={{ width: '100%' }}
                >
                  View My Profile <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link
                  href="/members"
                  className="btn-secondary"
                  style={{ width: '100%' }}
                >
                  Browse Member Directory
                </Link>
              </div>
            )}

            {/* Link to return Home */}
            <div className="auth-home-return">
              <Link href="/" className="auth-home-link">
                ← Return to Home
              </Link>
            </div>

            {/* Logout Action */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isSubmitting}
              className="btn-danger-outline"
              style={{ marginTop: '1.25rem', width: '100%' }}
            >
              {isSubmitting ? 'Logging Out...' : 'Log Out of Account'}
            </button>
          </div>
        ) : (
          /* Login Form */
          <div>
            {/* Logout Confirmation Banner */}
            {logoutMessage && (
              <div className="alert alert-success" role="alert">
                <span className="alert-icon">✓</span>
                <div>{logoutMessage}</div>
              </div>
            )}

            {/* Server Error Alert */}
            {serverError && (
              <div className="alert alert-danger" role="alert">
                <span className="alert-icon">⚠</span>
                <div>{serverError}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {/* Email Address */}
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email Address <span className="required-mark">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className={`form-input ${errors.email ? 'input-error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete="email"
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>

              {/* Password with Show/Hide Control */}
              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Password <span className="required-mark">*</span>
                </label>
                <div className="password-input-group">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`form-input password-input ${errors.password ? 'input-error' : ''}`}
                    disabled={isSubmitting}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="password-toggle-btn"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                {errors.password && <span className="field-error">{errors.password}</span>}
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            {/* Link to Registration Page */}
            <div className="auth-footer-links">
              Don&apos;t have an account?{' '}
              <Link href="/register">
                Register here
              </Link>
            </div>

            {/* Link to return Home */}
            <div className="auth-home-return">
              <Link href="/" className="auth-home-link">
                ← Return to Home
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
