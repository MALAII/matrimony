import React from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '6rem 1.5rem',
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary, #FFF8F2)',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'rgba(217, 154, 36, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem',
          color: '#D99A24',
        }}
      >
        <Compass size={32} />
      </div>
      <h1
        style={{
          fontSize: '2.5rem',
          fontFamily: 'var(--font-serif, serif)',
          color: 'var(--heading-color, #49343B)',
          margin: '0 0 0.85rem',
        }}
      >
        Page Not Found
      </h1>
      <p
        style={{
          color: 'var(--text-muted, #6E565E)',
          maxWidth: '480px',
          margin: '0 0 2rem',
          lineHeight: 1.6,
          fontSize: '1rem',
        }}
      >
        The matrimonial page or profile you are looking for does not exist, has expired, or may have been moved.
      </p>
      <Link
        href="/"
        className="btn-primary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.85rem 1.75rem',
          borderRadius: '12px',
          textDecoration: 'none',
        }}
      >
        Return to Home
      </Link>
    </div>
  );
}
