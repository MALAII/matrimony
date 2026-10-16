'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, Check } from 'lucide-react';
import { registerUserApi } from '@/lib/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // Validate form fields
  const validateForm = () => {
    const newErrors = {};

    // 1. Full Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Full Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Full Name must be at least 2 characters';
    }

    // 2. Email Address validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email Address is required';
    } else if (!EMAIL_REGEX.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    // 3. Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < MIN_PASSWORD_LENGTH) {
      newErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
    }

    // 4. Confirm Password validation
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

    // Clear specific field error as user types
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }

    // Clear server error banner upon edit
    if (serverError) {
      setServerError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    // Frontend validation
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
        setSuccessData(response.data);
        // Clear passwords and form data immediately upon success
        setFormData({
          name: '',
          email: '',
          password: '',
          confirmPassword: '',
        });
        setErrors({});
      } else {
        // Handle 400, 409, or other API errors
        setServerError(response.message || 'Registration failed. Please check your details.');
        // Clear password fields on failed submission for security
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

  const handleRegisterAnother = () => {
    setSuccessData(null);
    setServerError('');
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    });
    setErrors({});
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
        {/* Header with existing brand emblem mark & traditions eyebrow */}
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
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">
            Begin your matrimonial journey with trusted profiles and families.
          </p>
        </div>

        {/* Success Confirmation View */}
        {successData ? (
          <div className="success-card">
            <div className="success-badge-icon" aria-hidden="true">
              <Check size={30} strokeWidth={2.4} />
            </div>
            <h2 className="success-title">
              Registration Successful!
            </h2>
            <p className="success-subtitle">
              Your matrimonial account has been registered successfully.
            </p>

            <div className="success-user-box">
              <div className="success-user-row">
                <span className="success-user-label">Full Name:</span>
                <strong className="success-user-val">{successData.name}</strong>
              </div>
              <div className="success-user-row">
                <span className="success-user-label">Email Address:</span>
                <strong className="success-user-val">{successData.email}</strong>
              </div>
              <div className="success-user-row">
                <span className="success-user-label">Account Role:</span>
                <strong className="success-user-val">{successData.role}</strong>
              </div>
            </div>

            <div className="success-actions">
              <button
                type="button"
                onClick={handleRegisterAnother}
                className="btn-secondary"
              >
                Register Another Account
              </button>
              <Link href="/" className="btn-secondary">
                Return to Home
              </Link>
            </div>
          </div>
        ) : (
          /* Registration Form View */
          <div>
            {/* Server Error Alert */}
            {serverError && (
              <div className="alert alert-danger" role="alert">
                <span className="alert-icon">⚠</span>
                <div>{serverError}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {/* Full Name */}
              <div className="form-group">
                <label htmlFor="name" className="form-label">
                  Full Name <span className="required-mark">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="e.g. Anand Kumar"
                  value={formData.name}
                  onChange={handleChange}
                  className={`form-input ${errors.name ? 'input-error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete="name"
                />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>

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

              {/* Password */}
              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Password <span className="required-mark">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  className={`form-input ${errors.password ? 'input-error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />
                {errors.password && <span className="field-error">{errors.password}</span>}
              </div>

              {/* Confirm Password */}
              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Confirm Password <span className="required-mark">*</span>
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`form-input ${errors.confirmPassword ? 'input-error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />
                {errors.confirmPassword && (
                  <span className="field-error">{errors.confirmPassword}</span>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Registering Account...' : 'Register'}
              </button>
            </form>

            <div className="auth-footer-links">
              Already have an account?{' '}
              <Link href="/login">
                Login here
              </Link>
            </div>

            <p className="auth-agreement-text">
              By registering, you agree to find genuine matrimonial matches with verified profiles.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
