'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  FileText,
  Search,
  Download,
  Eye,
  RefreshCw,
  AlertCircle,
  Calendar,
  Clock,
  MapPin,
  Plus,
  History,
  ArrowLeft,
  Compass,
} from 'lucide-react';
import {
  getAdminGeneratedHoroscopesApi,
  getAdminHoroscopePdfUrl,
} from '@/lib/api';

export default function AdminHoroscopeHistoryPage() {
  const [horoscopes, setHoroscopes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadHoroscopes = async () => {
    setIsLoading(true);
    setFetchError('');
    try {
      const res = await getAdminGeneratedHoroscopesApi();
      if (res.success && Array.isArray(res.data)) {
        setHoroscopes(res.data);
      } else {
        setFetchError(res.message || 'Failed to load generated horoscopes.');
      }
    } catch {
      setFetchError('Unable to load generated horoscope records. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHoroscopes();
  }, []);

  const filteredHoroscopes = useMemo(() => {
    if (!searchQuery.trim()) return horoscopes;
    const q = searchQuery.toLowerCase().trim();
    return horoscopes.filter((item) => {
      const name = (item.personName || item.candidateName || '').toLowerCase();
      const city = (item.placeOfBirth || '').toLowerCase();
      const rasi = (item.rasi || '').toLowerCase();
      const star = (item.nakshatram || '').toLowerCase();
      const phone = (item.contactPhone || '').toLowerCase();
      const email = (item.contactEmail || '').toLowerCase();
      const id = (item._id || '').toLowerCase();
      return (
        name.includes(q) ||
        city.includes(q) ||
        rasi.includes(q) ||
        star.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        id.includes(q)
      );
    });
  }, [horoscopes, searchQuery]);

  return (
    <main className="admin-page">
      <div className="admin-container">
        {/* Breadcrumb Navigation */}
        <div style={{ marginBottom: '1rem' }}>
          <Link
            href="/admin/horoscope"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--a-muted)',
              fontSize: '0.85rem',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={14} /> Back to Horoscope Studio
          </Link>
        </div>

        {/* Header Area */}
        <div className="admin-header-area">
          <div className="admin-title-group">
            <h1>Generated Horoscopes Archive</h1>
            <p>Complete historical archive of all calculated South Indian square charts (Rasi D1 &amp; Navamsa D9) with PDF downloads.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={loadHoroscopes}
              className="btn-secondary"
              disabled={isLoading}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RefreshCw size={14} className={isLoading ? 'status-spinner' : ''} /> Refresh
            </button>
            <Link
              href="/admin/horoscope"
              className="btn-primary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1.15rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={16} /> Generate New Chart
            </Link>
          </div>
        </div>

        {/* Error Notice */}
        {fetchError && (
          <div className="adm-alert-bad" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={16} />
            <span>{fetchError}</span>
          </div>
        )}

        {/* Main Table Card */}
        <div className="adm-card" style={{ border: '1px solid var(--a-line)', borderRadius: '16px', padding: '1.25rem' }}>
          {/* Search & Records Count Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--a-ink)' }}>
                Astrological Records ({horoscopes.length})
              </h2>
              <small style={{ color: 'var(--a-muted)' }}>
                Showing {filteredHoroscopes.length} matching {filteredHoroscopes.length === 1 ? 'record' : 'records'} • Select any template directly per candidate
              </small>
            </div>

            <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--a-muted)' }} />
              <input
                type="text"
                placeholder="Search candidate, rasi, star..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.85rem 0.5rem 2.2rem',
                  border: '1px solid var(--a-line)',
                  borderRadius: '10px',
                  fontSize: '0.86rem',
                }}
              />
            </div>
          </div>

          {/* Loading Spinner */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--a-muted)' }}>
              <div className="status-spinner" style={{ margin: '0 auto 0.75rem' }} />
              <p style={{ margin: 0 }}>Loading generated horoscopes…</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredHoroscopes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--a-muted)' }}>
              <FileText size={44} style={{ margin: '0 auto 0.85rem', opacity: 0.35 }} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: 'var(--a-ink)' }}>
                {searchQuery ? 'No matching horoscopes found' : 'No horoscopes generated yet'}
              </p>
              <p style={{ margin: '0.35rem 0 1.25rem', fontSize: '0.85rem' }}>
                {searchQuery
                  ? `Try adjusting your search query "${searchQuery}"`
                  : 'Generate a new Tamil-compatible South Indian horoscope chart for any candidate or walk-in client.'}
              </p>
              {!searchQuery && (
                <Link
                  href="/admin/horoscope"
                  className="btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.55rem 1.15rem' }}
                >
                  <Sparkles size={15} /> Generate First Horoscope
                </Link>
              )}
            </div>
          )}

          {/* Horoscopes Table */}
          {!isLoading && filteredHoroscopes.length > 0 && (
            <div className="admin-table-container">
              <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Candidate Identity</th>
                    <th style={{ width: '24%' }}>Birth Particulars</th>
                    <th style={{ width: '24%' }}>Astrology Breakdown</th>
                    <th style={{ width: '12%' }}>Generated</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHoroscopes.map((item) => {
                    const dobFormatted = item.dateOfBirth
                      ? new Date(item.dateOfBirth).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Not specified';

                    const genDateFormatted = item.generatedAt
                      ? new Date(item.generatedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Recently';

                    return (
                      <tr key={item._id}>
                        {/* Name & Contact */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <strong style={{ color: 'var(--a-ink)', fontSize: '0.92rem' }}>
                              {item.personName || 'Unnamed Record'}
                            </strong>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {item.gender && item.gender !== 'Not Specified' && (
                                <span className={`adm-tag-gender ${item.gender === 'Female' ? 'female' : item.gender === 'Male' ? 'male' : ''}`}>
                                  {item.gender}
                                </span>
                              )}
                              <span className="adm-tag-id">#{item._id.slice(-6).toUpperCase()}</span>
                            </div>
                            {(item.contactPhone || item.contactEmail) && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--a-muted)', marginTop: '0.15rem' }}>
                                {item.contactPhone && <span>{item.contactPhone}</span>}
                                {item.contactPhone && item.contactEmail && <span> • </span>}
                                {item.contactEmail && <span>{item.contactEmail}</span>}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Birth Details */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--a-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Calendar size={12} color="var(--a-brand)" />
                              <span>DOB: <strong style={{ color: 'var(--a-ink)' }}>{dobFormatted}</strong></span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Clock size={12} />
                              <span>Time: {item.timeOfBirth || 'N/A'} (IST)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <MapPin size={12} />
                              <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.placeOfBirth || 'South India'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Astrological Particulars */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              {item.rasi && (
                                <span className="adm-astro-tag" style={{ fontSize: '0.7rem' }}>
                                  {item.rasi}
                                </span>
                              )}
                              {item.nakshatram && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--a-ink)' }}>
                                  {item.nakshatram} {item.padam ? `(P${item.padam})` : ''}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--a-muted)' }}>
                              Lagna: <strong>{item.lagnam || item.lagna || item.ascendant || '—'}</strong>
                            </div>
                            {item.dosham?.doshamSummary && (
                              <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600 }}>
                                Dosham: {item.dosham.doshamSummary}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Generation Date */}
                        <td>
                          <span style={{ fontSize: '0.78rem', color: 'var(--a-muted)' }}>
                            {genDateFormatted}
                          </span>
                        </td>

                        {/* Actions: Direct per-candidate choice for both templates */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                            {/* Style 1: Royal Logo */}
                            <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                              <a
                                href={getAdminHoroscopePdfUrl(item._id, false, 'classic')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="adm-act-btn primary"
                                style={{ padding: '0.28rem 0.65rem', fontSize: '0.74rem' }}
                                title="Open Style 1: Royal Logo & Header PDF"
                              >
                                <Eye size={11} /> 👑 Logo
                              </a>
                              <a
                                href={getAdminHoroscopePdfUrl(item._id, true, 'classic')}
                                className="adm-act-btn"
                                style={{ padding: '0.28rem 0.45rem', fontSize: '0.74rem' }}
                                title="Download Style 1: Royal Logo & Header PDF"
                              >
                                <Download size={11} />
                              </a>
                            </div>

                            {/* Style 2: Watermark */}
                            <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                              <a
                                href={getAdminHoroscopePdfUrl(item._id, false, 'watermark')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="adm-act-btn"
                                style={{
                                  padding: '0.28rem 0.65rem',
                                  fontSize: '0.74rem',
                                  borderColor: 'var(--a-brand)',
                                  color: 'var(--a-brand)',
                                  background: 'rgba(184, 92, 120, 0.05)',
                                }}
                                title="Open Style 2: Centered Varahi Watermark PDF"
                              >
                                <Eye size={11} /> 🛡️ Watermark
                              </a>
                              <a
                                href={getAdminHoroscopePdfUrl(item._id, true, 'watermark')}
                                className="adm-act-btn"
                                style={{ padding: '0.28rem 0.45rem', fontSize: '0.74rem' }}
                                title="Download Style 2: Centered Varahi Watermark PDF"
                              >
                                <Download size={11} />
                              </a>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
