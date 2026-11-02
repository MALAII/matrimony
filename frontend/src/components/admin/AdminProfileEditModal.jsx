'use client';

import React, { useState } from 'react';
import { X, User, Sparkles, Shield, Briefcase, Users, Heart } from 'lucide-react';
import { updateAdminProfileApi } from '@/lib/api';

const RASI_LIST = [
  'Mesham (Aries)', 'Rishabam (Taurus)', 'Mithunam (Gemini)', 'Kadagam (Cancer)',
  'Simmam (Leo)', 'Kanni (Virgo)', 'Thulaam (Libra)', 'Viruchigam (Scorpio)',
  'Dhanusu (Sagittarius)', 'Magaram (Capricorn)', 'Kumbam (Aquarius)', 'Meenam (Pisces)',
];

const NAKSHATRAM_LIST = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashirsha', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

const LAGNAM_LIST = [
  'Mesham', 'Rishabam', 'Mithunam', 'Kadagam', 'Simmam', 'Kanni',
  'Thulaam', 'Viruchigam', 'Dhanusu', 'Magaram', 'Kumbam', 'Meenam',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const COMPLEXION_LIST = ['Very Fair', 'Fair', 'Wheatish', 'Dusky', 'Dark'];
const DIET_LIST = ['Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Vegan'];
const MARITAL_STATUSES = ['Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce'];

export function AdminProfileEditModal({ profile, onClose, onSaved }) {
  const [activeTab, setActiveTab] = useState('personal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pd = profile.personalDetails || {};
  const cd = profile.communityDetails || {};
  const ed = profile.educationAndProfession || {};
  const fd = profile.familyDetails || {};
  const h = profile.horoscope || {};
  const pp = profile.partnerPreferences || {};
  const age = pp.preferredAgeRange || {};

  // Form State
  const [form, setForm] = useState({
    candidateName: profile.candidateName || profile.user?.name || '',
    candidateEmail: profile.candidateEmail || profile.user?.email || '',
    candidatePhone: profile.candidatePhone || '',

    // Personal Details
    'personalDetails.gender': pd.gender || '',
    'personalDetails.dateOfBirth': pd.dateOfBirth ? String(pd.dateOfBirth).slice(0, 10) : '',
    'personalDetails.height': pd.height ?? '',
    'personalDetails.weight': pd.weight ?? '',
    'personalDetails.bloodGroup': pd.bloodGroup || '',
    'personalDetails.complexion': pd.complexion || '',
    'personalDetails.diet': pd.diet || '',
    'personalDetails.physicalStatus': pd.physicalStatus || 'Normal',
    'personalDetails.disabilityDetails': pd.disabilityDetails || '',
    'personalDetails.maritalStatus': pd.maritalStatus || 'Never Married',
    'personalDetails.motherTongue': pd.motherTongue || '',
    'personalDetails.nativity': pd.nativity || '',
    'personalDetails.placeOfBirth': pd.placeOfBirth || '',
    'personalDetails.timeOfBirth': pd.timeOfBirth || '',
    'personalDetails.location': pd.location || '',
    'personalDetails.presentAddress': pd.presentAddress || '',
    'personalDetails.permanentAddress': pd.permanentAddress || '',
    'personalDetails.contactPerson': pd.contactPerson || '',
    'personalDetails.alternatePhone': pd.alternatePhone || '',

    // Astrology
    'horoscope.rasi': h.rasi || '',
    'horoscope.nakshatram': h.nakshatram || '',
    'horoscope.padam': h.padam ?? '',
    'horoscope.lagnam': h.lagnam || '',
    'horoscope.dosham': typeof h.dosham === 'object' ? (h.dosham.doshamSummary || 'No Dosham') : (h.dosham || 'No Dosham'),
    'horoscope.dasaBalance': h.dasaBalance || '',

    // Community
    'communityDetails.religion': cd.religion || 'Hindu',
    'communityDetails.caste': cd.caste || '',
    'communityDetails.subcaste': cd.subcaste || '',
    'communityDetails.gothram': cd.gothram || '',

    // Education & Career
    'educationAndProfession.educationalQualification': ed.educationalQualification || '',
    'educationAndProfession.occupation': ed.occupation || '',
    'educationAndProfession.company': ed.company || '',
    'educationAndProfession.workLocation': ed.workLocation || '',
    'educationAndProfession.income': ed.income || '',

    // Family
    'familyDetails.fatherName': fd.fatherName || '',
    'familyDetails.fatherAlive': fd.fatherAlive !== undefined ? (fd.fatherAlive ? 'yes' : 'no') : '',
    'familyDetails.fatherOccupation': fd.fatherOccupation || '',
    'familyDetails.motherName': fd.motherName || '',
    'familyDetails.motherAlive': fd.motherAlive !== undefined ? (fd.motherAlive ? 'yes' : 'no') : '',
    'familyDetails.motherOccupation': fd.motherOccupation || '',
    'familyDetails.elderBrothers': fd.elderBrothers ?? '',
    'familyDetails.youngerBrothers': fd.youngerBrothers ?? '',
    'familyDetails.marriedBrothers': fd.marriedBrothers ?? '',
    'familyDetails.elderSisters': fd.elderSisters ?? '',
    'familyDetails.youngerSisters': fd.youngerSisters ?? '',
    'familyDetails.marriedSisters': fd.marriedSisters ?? '',
    'familyDetails.familyLocation': fd.familyLocation || '',
    'familyDetails.familyInformation': fd.familyInformation || '',

    // Partner Preferences
    'partnerPreferences.ageMin': age.min ?? '',
    'partnerPreferences.ageMax': age.max ?? '',
    'partnerPreferences.preferredLocation': pp.preferredLocation || '',
    'partnerPreferences.educationPreference': pp.educationPreference || '',
    'partnerPreferences.occupationPreference': pp.occupationPreference || '',
    'partnerPreferences.maritalStatusPreference': pp.maritalStatusPreference || '',
    'partnerPreferences.dietPreference': pp.dietPreference || '',
    'partnerPreferences.castePreference': pp.castePreference || '',
    'partnerPreferences.horoscopeRequired': pp.horoscopeRequired || '',
    'partnerPreferences.jobRequirement': pp.jobRequirement || '',
    'partnerPreferences.otherPreferences': pp.otherPreferences || '',
  });

  const setVal = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      candidateName: form.candidateName.trim(),
      candidateEmail: form.candidateEmail.trim(),
      candidatePhone: form.candidatePhone.trim(),
      personalDetails: {
        gender: form['personalDetails.gender'],
        dateOfBirth: form['personalDetails.dateOfBirth'] || undefined,
        height: form['personalDetails.height'] === '' ? undefined : Number(form['personalDetails.height']),
        weight: form['personalDetails.weight'] === '' ? undefined : Number(form['personalDetails.weight']),
        bloodGroup: form['personalDetails.bloodGroup'],
        complexion: form['personalDetails.complexion'],
        diet: form['personalDetails.diet'],
        physicalStatus: form['personalDetails.physicalStatus'],
        disabilityDetails: form['personalDetails.disabilityDetails'],
        maritalStatus: form['personalDetails.maritalStatus'],
        motherTongue: form['personalDetails.motherTongue'],
        nativity: form['personalDetails.nativity'],
        placeOfBirth: form['personalDetails.placeOfBirth'],
        timeOfBirth: form['personalDetails.timeOfBirth'],
        location: form['personalDetails.location'],
        presentAddress: form['personalDetails.presentAddress'],
        permanentAddress: form['personalDetails.permanentAddress'],
        contactPerson: form['personalDetails.contactPerson'],
        alternatePhone: form['personalDetails.alternatePhone'],
      },
      horoscope: {
        rasi: form['horoscope.rasi'],
        nakshatram: form['horoscope.nakshatram'],
        padam: form['horoscope.padam'] === '' ? undefined : Number(form['horoscope.padam']),
        lagnam: form['horoscope.lagnam'],
        dosham: form['horoscope.dosham'],
        dasaBalance: form['horoscope.dasaBalance'],
      },
      communityDetails: {
        religion: form['communityDetails.religion'],
        caste: form['communityDetails.caste'],
        subcaste: form['communityDetails.subcaste'],
        gothram: form['communityDetails.gothram'],
      },
      educationAndProfession: {
        educationalQualification: form['educationAndProfession.educationalQualification'],
        occupation: form['educationAndProfession.occupation'],
        company: form['educationAndProfession.company'],
        workLocation: form['educationAndProfession.workLocation'],
        income: form['educationAndProfession.income'],
      },
      familyDetails: {
        fatherName: form['familyDetails.fatherName'],
        fatherAlive: form['familyDetails.fatherAlive'] === '' ? undefined : form['familyDetails.fatherAlive'] === 'yes',
        fatherOccupation: form['familyDetails.fatherOccupation'],
        motherName: form['familyDetails.motherName'],
        motherAlive: form['familyDetails.motherAlive'] === '' ? undefined : form['familyDetails.motherAlive'] === 'yes',
        motherOccupation: form['familyDetails.motherOccupation'],
        elderBrothers: form['familyDetails.elderBrothers'] === '' ? undefined : Number(form['familyDetails.elderBrothers']),
        youngerBrothers: form['familyDetails.youngerBrothers'] === '' ? undefined : Number(form['familyDetails.youngerBrothers']),
        marriedBrothers: form['familyDetails.marriedBrothers'] === '' ? undefined : Number(form['familyDetails.marriedBrothers']),
        elderSisters: form['familyDetails.elderSisters'] === '' ? undefined : Number(form['familyDetails.elderSisters']),
        youngerSisters: form['familyDetails.youngerSisters'] === '' ? undefined : Number(form['familyDetails.youngerSisters']),
        marriedSisters: form['familyDetails.marriedSisters'] === '' ? undefined : Number(form['familyDetails.marriedSisters']),
        familyLocation: form['familyDetails.familyLocation'],
        familyInformation: form['familyDetails.familyInformation'],
      },
      partnerPreferences: {
        preferredAgeRange: {
          min: form['partnerPreferences.ageMin'] === '' ? undefined : Number(form['partnerPreferences.ageMin']),
          max: form['partnerPreferences.ageMax'] === '' ? undefined : Number(form['partnerPreferences.ageMax']),
        },
        preferredLocation: form['partnerPreferences.preferredLocation'],
        educationPreference: form['partnerPreferences.educationPreference'],
        occupationPreference: form['partnerPreferences.occupationPreference'],
        maritalStatusPreference: form['partnerPreferences.maritalStatusPreference'],
        dietPreference: form['partnerPreferences.dietPreference'],
        castePreference: form['partnerPreferences.castePreference'],
        horoscopeRequired: form['partnerPreferences.horoscopeRequired'],
        jobRequirement: form['partnerPreferences.jobRequirement'],
        otherPreferences: form['partnerPreferences.otherPreferences'],
      },
    };

    try {
      const res = await updateAdminProfileApi(profile._id, payload);
      setSaving(false);
      if (res.success) {
        onSaved(res.data);
      } else {
        setError(res.message || 'Could not update profile. Please verify inputs.');
      }
    } catch {
      setSaving(false);
      setError('Network communication failure. Please check your connection.');
    }
  };

  const TABS = [
    { id: 'personal', label: 'Personal & Contact', icon: User },
    { id: 'astrology', label: 'Horoscope / Astrology', icon: Sparkles },
    { id: 'community', label: 'Community & Career', icon: Briefcase },
    { id: 'family', label: 'Family Details', icon: Users },
    { id: 'preferences', label: 'Partner Preferences', icon: Heart },
  ];

  return (
    <div className="adm-modal-scrim" onClick={onClose}>
      <div className="adm-modal" style={{ width: 'min(900px, 95vw)', height: '88vh' }} onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
              Edit Profile: {profile.candidateName || profile.user?.name || 'Member'}
            </h2>
            <small style={{ color: 'var(--a-muted)' }}>Update records across matrimonial registry</small>
          </div>
          <button type="button" className="adm-x" onClick={onClose} aria-label="Close" style={{ display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </header>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.4rem', padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--a-line)', background: '#FAF3ED', overflowX: 'auto' }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '8px',
                  border: active ? '1px solid var(--a-brand)' : '1px solid transparent',
                  background: active ? '#fff' : 'transparent',
                  color: active ? 'var(--a-brand)' : 'var(--a-muted)',
                  fontWeight: active ? 600 : 500,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="adm-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            {error && <div className="adm-alert-bad">{error}</div>}

            {/* TAB 1: Personal & Contact */}
            {activeTab === 'personal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ margin: 0, color: 'var(--a-brand)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Basic Contact & Identity
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" type="text" value={form.candidateName} onChange={(e) => setVal('candidateName', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <input className="form-input" type="email" value={form.candidateEmail} onChange={(e) => setVal('candidateEmail', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number *</label>
                    <input className="form-input" type="text" value={form.candidatePhone} onChange={(e) => setVal('candidatePhone', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alternate Phone</label>
                    <input className="form-input" type="text" value={form['personalDetails.alternatePhone']} onChange={(e) => setVal('personalDetails.alternatePhone', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Person</label>
                    <input className="form-input" type="text" placeholder="e.g. Father, Self" value={form['personalDetails.contactPerson']} onChange={(e) => setVal('personalDetails.contactPerson', e.target.value)} />
                  </div>
                </div>

                <h3 style={{ margin: '0.5rem 0 0', color: 'var(--a-brand)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Physical & Birth Attributes
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <select className="form-input" value={form['personalDetails.gender']} onChange={(e) => setVal('personalDetails.gender', e.target.value)}>
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input className="form-input" type="date" value={form['personalDetails.dateOfBirth']} onChange={(e) => setVal('personalDetails.dateOfBirth', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Height (cm)</label>
                    <input className="form-input" type="number" placeholder="e.g. 172" value={form['personalDetails.height']} onChange={(e) => setVal('personalDetails.height', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Weight (kg)</label>
                    <input className="form-input" type="number" placeholder="e.g. 68" value={form['personalDetails.weight']} onChange={(e) => setVal('personalDetails.weight', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Blood Group</label>
                    <select className="form-input" value={form['personalDetails.bloodGroup']} onChange={(e) => setVal('personalDetails.bloodGroup', e.target.value)}>
                      <option value="">Select Blood Group</option>
                      {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Complexion</label>
                    <select className="form-input" value={form['personalDetails.complexion']} onChange={(e) => setVal('personalDetails.complexion', e.target.value)}>
                      <option value="">Select Complexion</option>
                      {COMPLEXION_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Diet</label>
                    <select className="form-input" value={form['personalDetails.diet']} onChange={(e) => setVal('personalDetails.diet', e.target.value)}>
                      <option value="">Select Diet</option>
                      {DIET_LIST.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Marital Status</label>
                    <select className="form-input" value={form['personalDetails.maritalStatus']} onChange={(e) => setVal('personalDetails.maritalStatus', e.target.value)}>
                      {MARITAL_STATUSES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Physical Status</label>
                    <select className="form-input" value={form['personalDetails.physicalStatus']} onChange={(e) => setVal('personalDetails.physicalStatus', e.target.value)}>
                      <option value="Normal">Normal</option>
                      <option value="Physically Challenged">Physically Challenged</option>
                    </select>
                  </div>
                  {form['personalDetails.physicalStatus'] === 'Physically Challenged' && (
                    <div className="form-group">
                      <label className="form-label">Disability Details</label>
                      <input className="form-input" type="text" value={form['personalDetails.disabilityDetails']} onChange={(e) => setVal('personalDetails.disabilityDetails', e.target.value)} />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Mother Tongue</label>
                    <input className="form-input" type="text" placeholder="e.g. Tamil" value={form['personalDetails.motherTongue']} onChange={(e) => setVal('personalDetails.motherTongue', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nativity</label>
                    <input className="form-input" type="text" placeholder="e.g. Vellore" value={form['personalDetails.nativity']} onChange={(e) => setVal('personalDetails.nativity', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Place of Birth</label>
                    <input className="form-input" type="text" placeholder="e.g. Chennai" value={form['personalDetails.placeOfBirth']} onChange={(e) => setVal('personalDetails.placeOfBirth', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Time of Birth</label>
                    <input className="form-input" type="text" placeholder="e.g. 10:30 AM" value={form['personalDetails.timeOfBirth']} onChange={(e) => setVal('personalDetails.timeOfBirth', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Current City / Location</label>
                    <input className="form-input" type="text" value={form['personalDetails.location']} onChange={(e) => setVal('personalDetails.location', e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Present Residential Address</label>
                    <textarea className="form-textarea" rows={3} value={form['personalDetails.presentAddress']} onChange={(e) => setVal('personalDetails.presentAddress', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Permanent Address</label>
                    <textarea className="form-textarea" rows={3} value={form['personalDetails.permanentAddress']} onChange={(e) => setVal('personalDetails.permanentAddress', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Horoscope / Astrology */}
            {activeTab === 'astrology' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ margin: 0, color: 'var(--a-brand)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Vedic Astrology & Jathagam Particulars
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Rasi (Moon Sign)</label>
                    <select className="form-input" value={form['horoscope.rasi']} onChange={(e) => setVal('horoscope.rasi', e.target.value)}>
                      <option value="">Select Rasi</option>
                      {RASI_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nakshatram (Birth Star)</label>
                    <select className="form-input" value={form['horoscope.nakshatram']} onChange={(e) => setVal('horoscope.nakshatram', e.target.value)}>
                      <option value="">Select Nakshatram</option>
                      {NAKSHATRAM_LIST.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Padam</label>
                    <select className="form-input" value={form['horoscope.padam']} onChange={(e) => setVal('horoscope.padam', e.target.value)}>
                      <option value="">Select Padam</option>
                      <option value="1">Padam 1</option>
                      <option value="2">Padam 2</option>
                      <option value="3">Padam 3</option>
                      <option value="4">Padam 4</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lagnam (Ascendant)</label>
                    <select className="form-input" value={form['horoscope.lagnam']} onChange={(e) => setVal('horoscope.lagnam', e.target.value)}>
                      <option value="">Select Lagnam</option>
                      {LAGNAM_LIST.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dosham Status</label>
                    <select className="form-input" value={form['horoscope.dosham']} onChange={(e) => setVal('horoscope.dosham', e.target.value)}>
                      <option value="No Dosham">No Dosham</option>
                      <option value="Chevvai Dosham">Chevvai (Sevvai) Dosham</option>
                      <option value="Naga Dosham">Naga Dosham</option>
                      <option value="Kala Sarpa Dosham">Kala Sarpa Dosham</option>
                      <option value="Other Dosham">Other Dosham</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dasa Balance at Birth</label>
                    <input className="form-input" type="text" placeholder="e.g. Sani Dasa 4 Years 2 Months" value={form['horoscope.dasaBalance']} onChange={(e) => setVal('horoscope.dasaBalance', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Community & Career */}
            {activeTab === 'community' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ margin: 0, color: 'var(--a-brand)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Community & Lineage
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Religion</label>
                    <input className="form-input" type="text" value={form['communityDetails.religion']} onChange={(e) => setVal('communityDetails.religion', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Caste</label>
                    <input className="form-input" type="text" placeholder="e.g. Vanniyar, Mudaliar" value={form['communityDetails.caste']} onChange={(e) => setVal('communityDetails.caste', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subcaste</label>
                    <input className="form-input" type="text" value={form['communityDetails.subcaste']} onChange={(e) => setVal('communityDetails.subcaste', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gothram</label>
                    <input className="form-input" type="text" placeholder="e.g. Shiva, Vishvamitra" value={form['communityDetails.gothram']} onChange={(e) => setVal('communityDetails.gothram', e.target.value)} />
                  </div>
                </div>

                <h3 style={{ margin: '0.5rem 0 0', color: 'var(--a-brand)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Education & Profession
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Educational Qualification</label>
                    <input className="form-input" type="text" placeholder="e.g. B.Tech, MBA, MBBS" value={form['educationAndProfession.educationalQualification']} onChange={(e) => setVal('educationAndProfession.educationalQualification', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Occupation / Designation</label>
                    <input className="form-input" type="text" placeholder="e.g. Senior Software Engineer" value={form['educationAndProfession.occupation']} onChange={(e) => setVal('educationAndProfession.occupation', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Employer / Company Name</label>
                    <input className="form-input" type="text" placeholder="e.g. TCS, Amazon, Govt" value={form['educationAndProfession.company']} onChange={(e) => setVal('educationAndProfession.company', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Work Location</label>
                    <input className="form-input" type="text" placeholder="e.g. Chennai, Bangalore" value={form['educationAndProfession.workLocation']} onChange={(e) => setVal('educationAndProfession.workLocation', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Annual Income (₹)</label>
                    <input className="form-input" type="text" placeholder="e.g. 12 Lakhs" value={form['educationAndProfession.income']} onChange={(e) => setVal('educationAndProfession.income', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Family Details */}
            {activeTab === 'family' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ margin: 0, color: 'var(--a-brand)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Parental Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Father&apos;s Name</label>
                    <input className="form-input" type="text" value={form['familyDetails.fatherName']} onChange={(e) => setVal('familyDetails.fatherName', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Father Alive?</label>
                    <select className="form-input" value={form['familyDetails.fatherAlive']} onChange={(e) => setVal('familyDetails.fatherAlive', e.target.value)}>
                      <option value="">Not Specified</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Father&apos;s Occupation</label>
                    <input className="form-input" type="text" value={form['familyDetails.fatherOccupation']} onChange={(e) => setVal('familyDetails.fatherOccupation', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mother&apos;s Name</label>
                    <input className="form-input" type="text" value={form['familyDetails.motherName']} onChange={(e) => setVal('familyDetails.motherName', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mother Alive?</label>
                    <select className="form-input" value={form['familyDetails.motherAlive']} onChange={(e) => setVal('familyDetails.motherAlive', e.target.value)}>
                      <option value="">Not Specified</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mother&apos;s Occupation</label>
                    <input className="form-input" type="text" value={form['familyDetails.motherOccupation']} onChange={(e) => setVal('familyDetails.motherOccupation', e.target.value)} />
                  </div>
                </div>

                <h3 style={{ margin: '0.5rem 0 0', color: 'var(--a-brand)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Sibling Breakdown
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Elder Brothers</label>
                    <input className="form-input" type="number" min="0" value={form['familyDetails.elderBrothers']} onChange={(e) => setVal('familyDetails.elderBrothers', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Younger Brothers</label>
                    <input className="form-input" type="number" min="0" value={form['familyDetails.youngerBrothers']} onChange={(e) => setVal('familyDetails.youngerBrothers', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Married Brothers</label>
                    <input className="form-input" type="number" min="0" value={form['familyDetails.marriedBrothers']} onChange={(e) => setVal('familyDetails.marriedBrothers', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Elder Sisters</label>
                    <input className="form-input" type="number" min="0" value={form['familyDetails.elderSisters']} onChange={(e) => setVal('familyDetails.elderSisters', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Younger Sisters</label>
                    <input className="form-input" type="number" min="0" value={form['familyDetails.youngerSisters']} onChange={(e) => setVal('familyDetails.youngerSisters', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Married Sisters</label>
                    <input className="form-input" type="number" min="0" value={form['familyDetails.marriedSisters']} onChange={(e) => setVal('familyDetails.marriedSisters', e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Family Native / Location</label>
                    <input className="form-input" type="text" value={form['familyDetails.familyLocation']} onChange={(e) => setVal('familyDetails.familyLocation', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Family Background Notes</label>
                    <textarea className="form-textarea" rows={3} value={form['familyDetails.familyInformation']} onChange={(e) => setVal('familyDetails.familyInformation', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: Partner Preferences */}
            {activeTab === 'preferences' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ margin: 0, color: 'var(--a-brand)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Partner Expectations
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Min Preferred Age</label>
                    <input className="form-input" type="number" placeholder="e.g. 23" value={form['partnerPreferences.ageMin']} onChange={(e) => setVal('partnerPreferences.ageMin', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Preferred Age</label>
                    <input className="form-input" type="number" placeholder="e.g. 29" value={form['partnerPreferences.ageMax']} onChange={(e) => setVal('partnerPreferences.ageMax', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Marital Status Preference</label>
                    <input className="form-input" type="text" placeholder="e.g. Never Married" value={form['partnerPreferences.maritalStatusPreference']} onChange={(e) => setVal('partnerPreferences.maritalStatusPreference', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Preferred Location</label>
                    <input className="form-input" type="text" placeholder="e.g. Tamil Nadu, Chennai" value={form['partnerPreferences.preferredLocation']} onChange={(e) => setVal('partnerPreferences.preferredLocation', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Education Preference</label>
                    <input className="form-input" type="text" placeholder="e.g. Graduate or Above" value={form['partnerPreferences.educationPreference']} onChange={(e) => setVal('partnerPreferences.educationPreference', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Occupation Preference</label>
                    <input className="form-input" type="text" placeholder="e.g. IT, Government, Doctor" value={form['partnerPreferences.occupationPreference']} onChange={(e) => setVal('partnerPreferences.occupationPreference', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Diet Preference</label>
                    <input className="form-input" type="text" placeholder="e.g. Any, Vegetarian" value={form['partnerPreferences.dietPreference']} onChange={(e) => setVal('partnerPreferences.dietPreference', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Caste Preference</label>
                    <input className="form-input" type="text" placeholder="e.g. Same Caste, Caste No Bar" value={form['partnerPreferences.castePreference']} onChange={(e) => setVal('partnerPreferences.castePreference', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Horoscope Requirement</label>
                    <select className="form-input" value={form['partnerPreferences.horoscopeRequired']} onChange={(e) => setVal('partnerPreferences.horoscopeRequired', e.target.value)}>
                      <option value="">Any</option>
                      <option value="Must Match">Must Match (Strict)</option>
                      <option value="Not Necessary">Not Necessary</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Job Requirement</label>
                    <input className="form-input" type="text" placeholder="e.g. Employed, Any" value={form['partnerPreferences.jobRequirement']} onChange={(e) => setVal('partnerPreferences.jobRequirement', e.target.value)} />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label className="form-label">Other Partner Expectations</label>
                  <textarea className="form-textarea" rows={3} placeholder="Specific values, family expectations..." value={form['partnerPreferences.otherPreferences']} onChange={(e) => setVal('partnerPreferences.otherPreferences', e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <footer>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
