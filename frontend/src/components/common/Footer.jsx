'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Heart, Lock } from 'lucide-react';

const exploreLinks = [
  { href: '/', label: 'Home' },
  { href: '/members', label: 'Browse Profiles' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#membership', label: 'Membership Plans' },
  { href: '/#privacy', label: 'Candidate Privacy' },
];

const accountLinks = [
  { href: '/register', label: 'Create Profile' },
  { href: '/login', label: 'Member Sign In' },
  { href: '/membership', label: 'My Membership' },
  { href: '/profile', label: 'My Profile' },
  { href: '/forgot-password', label: 'Forgot Password' },
];

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer" aria-labelledby="footer-brand">
      <div className="container site-footer-main">
        <div>
          <Link href="/" className="brand-logo site-footer-brand">
            <span className="brand-emblem" aria-hidden="true">
              <Heart size={17} fill="currentColor" />
            </span>
            <span className="brand-text-wrap">
              <span id="footer-brand" className="brand-name">Matrimony Platform</span>
              <span className="brand-tagline">South Indian Traditions</span>
            </span>
          </Link>
          <p className="site-footer-about">
            A matrimonial platform for South Indian families, with detailed biodata, family-first
            search and contact numbers that stay private until unlocked.
          </p>
          <div className="site-footer-langs" aria-label="Languages served">
            <span>Tamil</span>
            <span>Telugu</span>
            <span>Kannada</span>
            <span>Malayalam</span>
          </div>
        </div>

        <nav aria-label="Explore">
          <h3>Explore</h3>
          <ul className="site-footer-links">
            {exploreLinks.map((l) => (
              <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account">
          <h3>Account</h3>
          <ul className="site-footer-links">
            {accountLinks.map((l) => (
              <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
            ))}
          </ul>
        </nav>

        <div className="site-footer-cta">
          <h3>Get started</h3>
          <p>Registration is free. Browse with a membership and unlock contacts with monthly credits.</p>
          <Link href="/register" className="site-footer-btn">
            Register free <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <br />
          <Link href="/login" className="site-footer-signin">Already a member? Sign in</Link>
        </div>
      </div>

      <div className="site-footer-bottom">
        <div className="container">
          <span>&copy; {currentYear} <strong>Matrimony Platform</strong>. All rights reserved.</span>
          <span><Lock size={13} aria-hidden="true" /> Candidate contact numbers are never shown publicly</span>
        </div>
      </div>
    </footer>
  );
};
