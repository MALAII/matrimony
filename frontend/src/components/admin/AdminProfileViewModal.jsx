'use client';

import React from 'react';
import { X, Sparkles, User, Heart, Briefcase, Users, Phone, MapPin, Shield } from 'lucide-react';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

function safeVal(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    if (val.text) return String(val.text);
    if (val.label) return String(val.label);
    if (val.name) return String(val.name);
    if (val.years !== undefined || val.months !== undefined || val.days !== undefined) {
      const parts = [];
      if (val.planet) parts.push(`${val.planet}:`);
      if (val.years !== undefined && val.years !== null) parts.push(`${val.years}y`);
      if (val.months !== undefined && val.months !== null) parts.push(`${val.months}m`);
      if (val.days !== undefined && val.days !== null) parts.push(`${val.days}d`);
      return parts.join(' ') || '—';
    }
    if (Array.isArray(val)) {
      return val.map((x) => (typeof x === 'object' ? safeVal(x) : String(x))).filter(Boolean).join(', ');
    }
    const clean = Object.entries(val)
      .filter(([k, v]) => typeof v !== 'object' && v !== null && v !== undefined && k !== '_id')
      .map(([k, v]) => `${k}: ${v}`);
    return clean.length > 0 ? clean.join(', ') : '—';
  }
  return String(val);
}

function Section({ icon: Icon, title, rows }) {
  const filled = rows.filter(([, v]) => v !== undefined && v !== null && v !== '');
  return (
    <div className="adm-view-sec">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {Icon && <Icon size={14} />} {title}
      </h3>
      {filled.length === 0 ? (
        <p className="adm-empty" style={{ padding: '0.4rem 0', fontSize: '0.85rem' }}>No details provided.</p>
      ) : (
        <dl>
          {filled.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{safeVal(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function AdminProfileViewModal({ profile, onClose, onEdit }) {
  if (!profile) return null;
  const pd = profile.personalDetails || {};
  const ed = profile.educationAndProfession || {};
  const fd = profile.familyDetails || {};
  const cd = profile.communityDetails || {};
  const h = profile.horoscope || {};
  const pp = profile.partnerPreferences || {};
  const age = pp.preferredAgeRange || {};
  const name = profile.candidateName || profile.user?.name || 'Unnamed candidate';
  const photo = profile.profilePhoto?.url;

  // Sibling string
  const brothersText = [
    fd.elderBrothers ? `${fd.elderBrothers} Elder` : '',
    fd.youngerBrothers ? `${fd.youngerBrothers} Younger` : '',
    fd.marriedBrothers ? `(${fd.marriedBrothers} Married)` : '',
  ].filter(Boolean).join(', ');

  const sistersText = [
    fd.elderSisters ? `${fd.elderSisters} Elder` : '',
    fd.youngerSisters ? `${fd.youngerSisters} Younger` : '',
    fd.marriedSisters ? `(${fd.marriedSisters} Married)` : '',
  ].filter(Boolean).join(', ');

  // Dosham text
  const doshamText = typeof h.dosham === 'object'
    ? [
        h.dosham.hasChevvaiDosham ? 'Chevvai (Sevvai)' : '',
        h.dosham.hasNagaDosham ? 'Naga' : '',
        h.dosham.doshamSummary || '',
      ].filter(Boolean).join(', ') || 'No Dosham'
    : (h.dosham || 'No Dosham');

  return (
    <div className="adm-modal-scrim" onClick={onClose}>
      <aside className="adm-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Profile details">
        <header>
          <div className="adm-drawer-id">
            <span className="adm-avatar-lg">
              {photo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={photo} alt={name} />
              ) : (
                name.charAt(0).toUpperCase()
              )}
            </span>
            <div>
              <h2>{name}</h2>
              <div className="adm-chips">
                <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                  {profile.source === 'broker' ? 'Assisted Entry' : 'Direct Member'}
                </span>
                <span className={`badge ${profile.approvalStatus === 'approved' ? 'badge-success' : profile.approvalStatus === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                  {String(profile.approvalStatus || 'pending_approval').replace('_', ' ')}
                </span>
                <span className={`badge ${profile.profileStatus === 'inactive' ? 'badge-neutral' : 'badge-success'}`}>
                  {profile.profileStatus || 'active'}
                </span>
              </div>
            </div>
          </div>
          <button type="button" className="adm-x" onClick={onClose} aria-label="Close" style={{ display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </header>

        <div className="adm-drawer-body">
          {/* Contact Details */}
          <Section
            icon={Phone}
            title="Contact Particulars"
            rows={[
              ['Email Address', profile.candidateEmail || profile.user?.email],
              ['Phone Number', profile.candidatePhone],
              ['Alternate Phone', pd.alternatePhone],
              ['Contact Person', pd.contactPerson],
              ['Account Status', profile.user ? `${profile.user.name} (${profile.user.accountStatus || 'active'})` : 'Assisted Profile (No login account)'],
              ['Registration Date', fmtDate(profile.createdAt)],
            ]}
          />

          {/* Horoscope & Vedic Credentials */}
          <Section
            icon={Sparkles}
            title="Vedic Astrology & Jathagam"
            rows={[
              ['Rasi (Moon Sign)', h.rasi],
              ['Nakshatram (Birth Star)', h.nakshatram],
              ['Padam', h.padam ? `Padam ${h.padam}` : ''],
              ['Lagnam (Ascendant)', h.lagnam],
              ['Dosham Status', doshamText],
              ['Dasa Balance', h.dasaBalance],
            ]}
          />

          {/* Personal Particulars */}
          <Section
            icon={User}
            title="Personal Particulars"
            rows={[
              ['Gender', pd.gender],
              ['Date of Birth', fmtDate(pd.dateOfBirth)],
              ['Height', pd.height ? `${pd.height} cm` : ''],
              ['Weight', pd.weight ? `${pd.weight} kg` : ''],
              ['Blood Group', pd.bloodGroup],
              ['Complexion', pd.complexion],
              ['Diet', pd.diet],
              ['Physical Status', pd.physicalStatus],
              ['Disability Details', pd.disabilityDetails],
              ['Marital Status', pd.maritalStatus],
              ['Mother Tongue', pd.motherTongue],
              ['Nativity', pd.nativity],
              ['Place of Birth', pd.placeOfBirth],
              ['Time of Birth', pd.timeOfBirth],
              ['Location / City', pd.location],
              ['Present Address', pd.presentAddress],
              ['Permanent Address', pd.permanentAddress],
            ]}
          />

          {/* Lineage & Community */}
          <Section
            icon={Shield}
            title="Community & Lineage"
            rows={[
              ['Religion', cd.religion || 'Hindu'],
              ['Caste', cd.caste],
              ['Subcaste', cd.subcaste],
              ['Gothram', cd.gothram],
            ]}
          />

          {/* Education & Profession */}
          <Section
            icon={Briefcase}
            title="Education & Profession"
            rows={[
              ['Qualification', ed.educationalQualification],
              ['Occupation', ed.occupation],
              ['Employer / Company', ed.company],
              ['Work Location', ed.workLocation],
              ['Annual Income', ed.income],
            ]}
          />

          {/* Family Background */}
          <Section
            icon={Users}
            title="Family Background"
            rows={[
              ['Father Name', fd.fatherName],
              ['Father Alive Status', fd.fatherAlive !== undefined ? (fd.fatherAlive ? 'Yes' : 'No') : ''],
              ['Father Occupation', fd.fatherOccupation],
              ['Mother Name', fd.motherName],
              ['Mother Alive Status', fd.motherAlive !== undefined ? (fd.motherAlive ? 'Yes' : 'No') : ''],
              ['Mother Occupation', fd.motherOccupation],
              ['Brothers', brothersText || (fd.siblingInformation || '')],
              ['Sisters', sistersText],
              ['Family Information', fd.familyInformation],
              ['Family Location', fd.familyLocation],
            ]}
          />

          {/* Partner Preferences */}
          <Section
            icon={Heart}
            title="Partner Preferences"
            rows={[
              ['Age Range', age.min || age.max ? `${age.min || 'Any'} – ${age.max || 'Any'} yrs` : ''],
              ['Marital Status', pp.maritalStatusPreference],
              ['Preferred Location', pp.preferredLocation],
              ['Education Preference', pp.educationPreference],
              ['Occupation Preference', pp.occupationPreference],
              ['Diet Preference', pp.dietPreference],
              ['Caste Preference', pp.castePreference],
              ['Horoscope Required', pp.horoscopeRequired],
              ['Job Requirement', pp.jobRequirement],
              ['Other Expectations', pp.otherPreferences],
            ]}
          />
        </div>

        <footer>
          <button type="button" className="btn-secondary" style={{ padding: '.55rem 1.1rem' }} onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-primary" style={{ padding: '.55rem 1.1rem' }} onClick={() => onEdit(profile)}>
            Edit Profile
          </button>
        </footer>
      </aside>
    </div>
  );
}
