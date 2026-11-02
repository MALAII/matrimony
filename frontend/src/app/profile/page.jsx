'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  getMyProfileApi,
  createProfileApi,
  updateProfileApi,
  uploadProfilePhotoApi,
  getMyPhotosApi,
  addMyPhotoApi,
  replaceMyPhotoApi,
  deleteMyPhotoApi,
  setMyPrimaryPhotoApi,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Camera,
  GraduationCap,
  Users,
  Lock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Upload,
  X,
  Phone,
  ArrowRight,
  ShieldCheck,
  Check,
  Eye,
  Briefcase,
  MapPin,
  ChevronRight,
  Home,
  Trash2,
  Star,
  Plus,
} from 'lucide-react';
import styles from './profile.module.css';

// ------------------------------ Curated Options ------------------------------
const GENDER_OPTIONS = ['Female', 'Male', 'Other'];

const MARITAL_STATUS_OPTIONS = [
  'Never Married',
  'Divorced',
  'Widowed',
  'Awaiting Divorce',
];

const MOTHER_TONGUES = [
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Hindi',
  'English',
  'Marathi',
  'Gujarati',
  'Bengali',
  'Other',
];

const RELIGIONS = [
  'Hindu',
  'Christian',
  'Muslim',
  'Jain',
  'Sikh',
  'Buddhist',
  'Other',
];

const BLOOD_GROUPS = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];

const COMPLEXION_OPTIONS = [
  'Very Fair',
  'Fair',
  'Wheatish',
  'Wheatish Brown',
  'Dark',
];

const DIET_OPTIONS = ['Vegetarian', 'Non-Vegetarian', 'Eggetarian'];

const RASI_OPTIONS = [
  'Mesham (Aries)',
  'Rishabham (Taurus)',
  'Mithunam (Gemini)',
  'Kadagam (Cancer)',
  'Simmam (Leo)',
  'Kanni (Virgo)',
  'Thulaam (Libra)',
  'Viruchigam (Scorpio)',
  'Dhanusu (Sagittarius)',
  'Magaram (Capricorn)',
  'Kumbam (Aquarius)',
  'Meenam (Pisces)',
];

const NAKSHATRAM_OPTIONS = [
  'Ashwini',
  'Bharani',
  'Krittika',
  'Rohini',
  'Mrigashira',
  'Ardra',
  'Punarvasu',
  'Pushya',
  'Ashlesha',
  'Magha',
  'Purva Phalguni',
  'Uttara Phalguni',
  'Hasta',
  'Chitra',
  'Swati',
  'Vishakha',
  'Anuradha',
  'Jyeshtha',
  'Mula',
  'Purva Ashadha',
  'Uttara Ashadha',
  'Shravana',
  'Dhanishta',
  'Shatabhisha',
  'Purva Bhadrapada',
  'Uttara Bhadrapada',
  'Revati',
];

const DOSHAM_OPTIONS = [
  'No Dosham',
  'Chevvai Dosham (Manglik)',
  'Rahu / Ketu Dosham',
  'Naga Dosham',
  'Kalasarpa Dosham',
  'Don’t Know',
];

const DASA_PLANETS = [
  'Venus (சுக்கிரன்)',
  'Jupiter (குரு)',
  'Mars (செவ்வாய்)',
  'Saturn (சனி)',
  'Sun (சூரியன்)',
  'Moon (சந்திரன்)',
  'Mercury (புதன்)',
  'Rahu (ராகு)',
  'Ketu (கேது)',
];

const EDUCATION_SUGGESTIONS = [
  'B.Tech / B.E',
  'MBA',
  'MBBS / MD / MS',
  'M.Tech / M.E',
  'MS (Abroad)',
  'CA / CS',
  'B.Sc / M.Sc',
  'B.Com / M.Com',
  'BCA / MCA',
  'Ph.D / Doctorate',
  'Diploma',
  'Other Graduate',
];

const INCOME_OPTIONS = [
  'Below 3 Lakhs PA',
  '3 - 5 Lakhs PA',
  '5 - 7.5 Lakhs PA',
  '7.5 - 10 Lakhs PA',
  '10 - 15 Lakhs PA',
  '15 - 25 Lakhs PA',
  '25 - 40 Lakhs PA',
  '40 - 60 Lakhs PA',
  '60 Lakhs - 1 Crore PA',
  '1 Crore+ PA',
  '$60K - $100K USD',
  '$100K+ USD',
];

const SIBLING_COUNT_OPTIONS = ['0', '1', '2', '3', '4', '5+'];

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

// Helper for Height (cm -> ft & in)
const formatHeightDisplay = (cm) => {
  const num = Number(cm);
  if (!num || isNaN(num) || num < 50 || num > 260) return '';
  const totalInches = num / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet} ft ${inches} in`;
};

// Helper for Age calculation from DOB
const calculateAge = (dobString) => {
  if (!dobString) return '';
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age > 0 ? `${age} yrs` : '';
};

export default function ProfilePage() {
  const { currentUser, authLoading, checkAuth } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [isExistingProfile, setIsExistingProfile] = useState(false);
  const [hasCandidatePhone, setHasCandidatePhone] = useState(false);
  const [profileId, setProfileId] = useState(null);

  const [sameAsPresentAddress, setSameAsPresentAddress] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    candidatePhone: '',
    personalDetails: {
      gender: '',
      dateOfBirth: '',
      birthHour: '09',
      birthMinute: '00',
      birthPeriod: 'AM',
      placeOfBirth: '',
      nativity: '',
      height: '',
      weight: '',
      bloodGroup: '',
      complexion: '',
      diet: '',
      physicalStatus: 'Normal',
      disabilityDetails: '',
      maritalStatus: '',
      motherTongue: 'Tamil',
      location: '',
      presentAddress: '',
      permanentAddress: '',
      contactPerson: 'Self',
      alternatePhone: '',
    },
    communityDetails: {
      religion: 'Hindu',
      caste: '',
      subcaste: '',
      gothram: '',
    },
    educationAndProfession: {
      educationalQualification: '',
      occupation: '',
      company: '',
      workLocation: '',
      income: '',
    },
    familyDetails: {
      fatherName: '',
      fatherAlive: 'Yes',
      fatherOccupation: '',
      motherName: '',
      motherAlive: 'Yes',
      motherOccupation: '',
      marriedElderBrothers: 0,
      unmarriedElderBrothers: 0,
      marriedYoungerBrothers: 0,
      unmarriedYoungerBrothers: 0,
      marriedElderSisters: 0,
      unmarriedElderSisters: 0,
      marriedYoungerSisters: 0,
      unmarriedYoungerSisters: 0,
      familyInformation: '',
      parentInformation: '',
      siblingInformation: '',
      familyLocation: '',
    },
    partnerPreferences: {
      preferredAgeRange: {
        min: '',
        max: '',
      },
      maritalStatusPreference: [],
      dietPreference: [],
      jobRequirement: 'Must',
      horoscopeRequired: 'Yes',
      educationPreference: '',
      occupationPreference: '',
      preferredLocation: '',
      castePreference: '',
      subcastePreference: '',
      incomePreference: '',
      otherPreferences: '',
    },
    horoscope: {
      isGenerated: false,
      isSimulated: false,
      timeOfBirth: '',
      placeOfBirth: '',
      rasi: '',
      nakshatram: '',
      padam: '',
      lagnam: '',
      dosham: '',
      dasaBalance: {
        planet: '',
        years: '',
        months: '',
        days: '',
      },
      rasiChartBoxes: Array(12).fill(''),
      navamsaChartBoxes: Array(12).fill(''),
      attribution: '',
    },
  });

  // Photo State (Multi-Photo Gallery: Max 3 photos)
  const [photosList, setPhotosList] = useState([]);
  const [photoActionLoading, setPhotoActionLoading] = useState(false);
  const [photoSlotAction, setPhotoSlotAction] = useState(null); // 'upload', 'replace-[id]', 'delete-[id]', 'primary-[id]'
  const [photoMessage, setPhotoMessage] = useState({ type: '', text: '' });
  const galleryInputRef = useRef(null);
  const replaceInputRefs = useRef({});

  // Legacy single photo state (preserved for backward compatibility)
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  // Form Action State
  const [isSaving, setIsSaving] = useState(false);
  const [formFeedback, setFormFeedback] = useState({ type: '', text: '' });
  const [errors, setErrors] = useState({});

  // 1. Initial Load: Fetch Matrimonial Profile for Authenticated User
  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (authLoading) return;

      let user = currentUser;
      if (!user && checkAuth) {
        user = await checkAuth();
      }

      if (!user) {
        setProfileLoading(false);
        return;
      }

      try {
        const profileRes = await getMyProfileApi();
        if (!isMounted) return;

        if (profileRes.success && profileRes.data) {
          setIsExistingProfile(true);
          const p = profileRes.data;
          setProfileId(p.id || p._id || null);
          setHasCandidatePhone(Boolean(p.hasCandidatePhone));

          // Format Date of Birth for input[type="date"] (YYYY-MM-DD)
          let formattedDob = '';
          if (p.personalDetails?.dateOfBirth) {
            const d = new Date(p.personalDetails.dateOfBirth);
            if (!isNaN(d.getTime())) {
              formattedDob = d.toISOString().split('T')[0];
            }
          }

          // Parse time of birth if present (e.g., "09:30 AM")
          let tobHour = '09';
          let tobMin = '00';
          let tobPeriod = 'AM';
          const savedTob = p.personalDetails?.timeOfBirth || p.horoscope?.timeOfBirth || '';
          if (savedTob) {
            const match = savedTob.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
            if (match) {
              tobHour = match[1].padStart(2, '0');
              tobMin = match[2];
              if (match[3]) tobPeriod = match[3].toUpperCase();
            }
          }

          setFormData({
            candidatePhone: '',
            personalDetails: {
              gender: p.personalDetails?.gender || '',
              dateOfBirth: formattedDob,
              birthHour: tobHour,
              birthMinute: tobMin,
              birthPeriod: tobPeriod,
              placeOfBirth: p.personalDetails?.placeOfBirth || p.horoscope?.placeOfBirth || '',
              nativity: p.personalDetails?.nativity || '',
              height: p.personalDetails?.height ?? '',
              weight: p.personalDetails?.weight ?? '',
              bloodGroup: p.personalDetails?.bloodGroup || '',
              complexion: p.personalDetails?.complexion || '',
              diet: p.personalDetails?.diet || '',
              physicalStatus: p.personalDetails?.physicalStatus || 'Normal',
              disabilityDetails: p.personalDetails?.disabilityDetails || '',
              maritalStatus: p.personalDetails?.maritalStatus || '',
              motherTongue: p.personalDetails?.motherTongue || 'Tamil',
              location: p.personalDetails?.location || '',
              presentAddress: p.personalDetails?.presentAddress || '',
              permanentAddress: p.personalDetails?.permanentAddress || '',
              contactPerson: p.personalDetails?.contactPerson || 'Self',
              alternatePhone: p.personalDetails?.alternatePhone || '',
            },
            communityDetails: {
              religion: p.communityDetails?.religion || 'Hindu',
              caste: p.communityDetails?.caste || '',
              subcaste: p.communityDetails?.subcaste || '',
              gothram: p.communityDetails?.gothram || '',
            },
            educationAndProfession: {
              educationalQualification: p.educationAndProfession?.educationalQualification || '',
              occupation: p.educationAndProfession?.occupation || '',
              company: p.educationAndProfession?.company || '',
              workLocation: p.educationAndProfession?.workLocation || '',
              income: p.educationAndProfession?.income || '',
            },
            familyDetails: {
              fatherName: p.familyDetails?.fatherName || '',
              fatherAlive: p.familyDetails?.fatherAlive || 'Yes',
              fatherOccupation: p.familyDetails?.fatherOccupation || '',
              motherName: p.familyDetails?.motherName || '',
              motherAlive: p.familyDetails?.motherAlive || 'Yes',
              motherOccupation: p.familyDetails?.motherOccupation || '',
              marriedElderBrothers: p.familyDetails?.marriedElderBrothers ?? 0,
              unmarriedElderBrothers: p.familyDetails?.unmarriedElderBrothers ?? 0,
              marriedYoungerBrothers: p.familyDetails?.marriedYoungerBrothers ?? 0,
              unmarriedYoungerBrothers: p.familyDetails?.unmarriedYoungerBrothers ?? 0,
              marriedElderSisters: p.familyDetails?.marriedElderSisters ?? 0,
              unmarriedElderSisters: p.familyDetails?.unmarriedElderSisters ?? 0,
              marriedYoungerSisters: p.familyDetails?.marriedYoungerSisters ?? 0,
              unmarriedYoungerSisters: p.familyDetails?.unmarriedYoungerSisters ?? 0,
              familyInformation: p.familyDetails?.familyInformation || '',
              parentInformation: p.familyDetails?.parentInformation || '',
              siblingInformation: p.familyDetails?.siblingInformation || '',
              familyLocation: p.familyDetails?.familyLocation || '',
            },
            partnerPreferences: {
              preferredAgeRange: {
                min: p.partnerPreferences?.preferredAgeRange?.min ?? '',
                max: p.partnerPreferences?.preferredAgeRange?.max ?? '',
              },
              maritalStatusPreference: Array.isArray(p.partnerPreferences?.maritalStatusPreference)
                ? p.partnerPreferences.maritalStatusPreference
                : [],
              dietPreference: Array.isArray(p.partnerPreferences?.dietPreference)
                ? p.partnerPreferences.dietPreference
                : [],
              jobRequirement: p.partnerPreferences?.jobRequirement || 'Must',
              horoscopeRequired: p.partnerPreferences?.horoscopeRequired || 'Yes',
              educationPreference: p.partnerPreferences?.educationPreference || '',
              occupationPreference: p.partnerPreferences?.occupationPreference || '',
              preferredLocation: p.partnerPreferences?.preferredLocation || '',
              castePreference: p.partnerPreferences?.castePreference || '',
              subcastePreference: p.partnerPreferences?.subcastePreference || '',
              incomePreference: p.partnerPreferences?.incomePreference || '',
              otherPreferences: p.partnerPreferences?.otherPreferences || '',
            },
            horoscope: {
              isGenerated: Boolean(p.horoscope?.isGenerated),
              isSimulated: Boolean(p.horoscope?.isSimulated),
              timeOfBirth: p.horoscope?.timeOfBirth || '',
              placeOfBirth: p.horoscope?.placeOfBirth || '',
              rasi: p.horoscope?.rasi || '',
              nakshatram: p.horoscope?.nakshatram || '',
              padam: p.horoscope?.padam ?? '',
              lagnam: p.horoscope?.lagnam || '',
              dosham: p.horoscope?.dosham?.doshamSummary || (typeof p.horoscope?.dosham === 'string' ? p.horoscope.dosham : ''),
              dasaBalance: {
                planet: p.horoscope?.dasaBalance?.planet || '',
                years: p.horoscope?.dasaBalance?.years ?? '',
                months: p.horoscope?.dasaBalance?.months ?? '',
                days: p.horoscope?.dasaBalance?.days ?? '',
              },
              rasiChartBoxes: Array.isArray(p.horoscope?.rasiChartBoxes) && p.horoscope.rasiChartBoxes.length === 12
                ? p.horoscope.rasiChartBoxes
                : Array(12).fill(''),
              navamsaChartBoxes: Array.isArray(p.horoscope?.navamsaChartBoxes) && p.horoscope.navamsaChartBoxes.length === 12
                ? p.horoscope.navamsaChartBoxes
                : Array(12).fill(''),
              attribution: p.horoscope?.attribution || '',
            },
          });

          if (Array.isArray(p.photos) && p.photos.length > 0) {
            setPhotosList(p.photos);
            const prim = p.photos.find((ph) => ph.isPrimary) || p.photos[0];
            if (prim?.url) {
              setExistingPhotoUrl(prim.url);
              setPhotoPreview(prim.url);
            }
          } else if (p.profilePhoto?.url) {
            setExistingPhotoUrl(p.profilePhoto.url);
            setPhotoPreview(p.profilePhoto.url);
            setPhotosList([
              {
                _id: 'legacy_photo',
                url: p.profilePhoto.url,
                isPrimary: true,
              },
            ]);
          }
        } else {
          setIsExistingProfile(false);
        }
      } catch (err) {
        if (isMounted) {
          setFormFeedback({
            type: 'error',
            text: 'An error occurred while loading your profile data.',
          });
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser, authLoading]);

  // Profile completion calculation
  const completionPercentage = useMemo(() => {
    let score = 0;
    const total = 7;
    // 1. Personal & Physical
    if (formData.personalDetails.gender && formData.personalDetails.dateOfBirth && formData.personalDetails.location) score++;
    // 2. Phone
    if (hasCandidatePhone || (formData.candidatePhone && formData.candidatePhone.trim().length >= 7)) score++;
    // 3. Community
    if (formData.communityDetails.religion && formData.communityDetails.caste) score++;
    // 4. Horoscope
    if (formData.horoscope.rasi || formData.horoscope.nakshatram) score++;
    // 5. Education & Profession
    if (formData.educationAndProfession.educationalQualification || formData.educationAndProfession.occupation) score++;
    // 6. Family
    if (formData.familyDetails.fatherName || formData.familyDetails.motherName || formData.familyDetails.familyInformation) score++;
    // 7. Preferences & Photo
    if (existingPhotoUrl || photoPreview || formData.partnerPreferences.preferredLocation) score++;

    return Math.min(100, Math.round((score / total) * 100));
  }, [formData, hasCandidatePhone, existingPhotoUrl, photoPreview]);

  // Handle nested state updates
  const handleNestedChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));

    if (errors[`${section}.${field}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`${section}.${field}`];
        return next;
      });
    }
  };

  const handleCandidatePhoneChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      candidatePhone: value,
    }));

    if (errors.candidatePhone) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.candidatePhone;
        return next;
      });
    }
  };

  const handleAgeRangeChange = (bound, value) => {
    setFormData((prev) => ({
      ...prev,
      partnerPreferences: {
        ...prev.partnerPreferences,
        preferredAgeRange: {
          ...prev.partnerPreferences.preferredAgeRange,
          [bound]: value,
        },
      },
    }));

    if (errors['partnerPreferences.preferredAgeRange']) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next['partnerPreferences.preferredAgeRange'];
        return next;
      });
    }
  };

  // Toggle multi-select preference pills (e.g. Diet or Marital Status)
  const toggleArrayPreference = (field, item) => {
    setFormData((prev) => {
      const currentList = prev.partnerPreferences[field] || [];
      const exists = currentList.includes(item);
      const updated = exists ? currentList.filter((x) => x !== item) : [...currentList, item];
      return {
        ...prev,
        partnerPreferences: {
          ...prev.partnerPreferences,
          [field]: updated,
        },
      };
    });
  };

  // Address sync
  const handleSameAddressToggle = (e) => {
    const checked = e.target.checked;
    setSameAsPresentAddress(checked);
    if (checked) {
      setFormData((prev) => ({
        ...prev,
        personalDetails: {
          ...prev.personalDetails,
          permanentAddress: prev.personalDetails.presentAddress,
        },
      }));
    }
  };

  // Dasa balance change handler
  const handleDasaChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      horoscope: {
        ...prev.horoscope,
        dasaBalance: {
          ...(prev.horoscope.dasaBalance || {}),
          [field]: value,
        },
      },
    }));
  };

  // Form Validation
  const validateForm = () => {
    const errs = {};

    // Candidate phone validation (when provided)
    const trimmedPhone = (formData.candidatePhone || '').trim();
    if (trimmedPhone.length > 0) {
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      if (trimmedPhone.length > 25) {
        errs.candidatePhone = 'Candidate phone number cannot exceed 25 characters';
      } else if (
        trimmedPhone.includes('@') ||
        !/^[0-9+\-\s()]+$/.test(trimmedPhone) ||
        digitsOnly.length < 7 ||
        digitsOnly.length > 15
      ) {
        errs.candidatePhone = 'Please enter a valid phone number (7 to 15 digits)';
      }
    }

    // Personal details validation
    if (formData.personalDetails.dateOfBirth) {
      const dob = new Date(formData.personalDetails.dateOfBirth);
      if (isNaN(dob.getTime())) {
        errs['personalDetails.dateOfBirth'] = 'Please enter a valid date of birth';
      } else if (dob > new Date()) {
        errs['personalDetails.dateOfBirth'] = 'Date of birth cannot be in the future';
      }
    }

    if (
      formData.personalDetails.height !== '' &&
      formData.personalDetails.height !== null &&
      formData.personalDetails.height !== undefined
    ) {
      const h = Number(formData.personalDetails.height);
      if (isNaN(h) || h < 50 || h > 260) {
        errs['personalDetails.height'] = 'Height must be between 50 and 260 cm';
      }
    }

    // Partner preferences validation
    const minAge = formData.partnerPreferences?.preferredAgeRange?.min;
    const maxAge = formData.partnerPreferences?.preferredAgeRange?.max;

    const hasMin = minAge !== '' && minAge !== null && minAge !== undefined;
    const hasMax = maxAge !== '' && maxAge !== null && maxAge !== undefined;

    if (hasMin && (isNaN(Number(minAge)) || Number(minAge) < 18 || Number(minAge) > 100)) {
      errs['partnerPreferences.preferredAgeRange'] = 'Preferred minimum age must be between 18 and 100';
    } else if (hasMax && (isNaN(Number(maxAge)) || Number(maxAge) < 18 || Number(maxAge) > 100)) {
      errs['partnerPreferences.preferredAgeRange'] = 'Preferred maximum age must be between 18 and 100';
    } else if (hasMin && hasMax && Number(minAge) > Number(maxAge)) {
      errs['partnerPreferences.preferredAgeRange'] = 'Preferred minimum age cannot be greater than maximum age';
    }

    setErrors(errs);
    return errs;
  };

  // Construct payload conforming to backend schema
  const preparePayload = () => {
    const payload = {
      personalDetails: { ...formData.personalDetails },
      communityDetails: { ...formData.communityDetails },
      educationAndProfession: { ...formData.educationAndProfession },
      familyDetails: { ...formData.familyDetails },
      partnerPreferences: {
        ...formData.partnerPreferences,
        preferredAgeRange: {},
      },
    };

    const trimmedPhone = (formData.candidatePhone || '').trim();
    if (trimmedPhone.length > 0) {
      payload.candidatePhone = trimmedPhone;
    }

    // Combine time of birth into standard formatted string
    const tobString = `${formData.personalDetails.birthHour}:${formData.personalDetails.birthMinute} ${formData.personalDetails.birthPeriod}`;
    payload.personalDetails.timeOfBirth = tobString;
    delete payload.personalDetails.birthHour;
    delete payload.personalDetails.birthMinute;
    delete payload.personalDetails.birthPeriod;

    // Clean height: number or omit if empty
    if (payload.personalDetails.height !== '' && payload.personalDetails.height !== null) {
      payload.personalDetails.height = Number(payload.personalDetails.height);
    } else {
      delete payload.personalDetails.height;
    }

    // Clean weight: number or omit if empty
    if (payload.personalDetails.weight !== '' && payload.personalDetails.weight !== null) {
      payload.personalDetails.weight = Number(payload.personalDetails.weight);
    } else {
      delete payload.personalDetails.weight;
    }

    // Clean dateOfBirth: omit if empty
    if (!payload.personalDetails.dateOfBirth) {
      delete payload.personalDetails.dateOfBirth;
    }

    // Clean gender: omit if empty
    if (!payload.personalDetails.gender) {
      delete payload.personalDetails.gender;
    }

    // Clean maritalStatus: omit if empty
    if (!payload.personalDetails.maritalStatus) {
      delete payload.personalDetails.maritalStatus;
    }

    // Sibling numeric cleans
    payload.familyDetails.marriedElderBrothers = Number(payload.familyDetails.marriedElderBrothers) || 0;
    payload.familyDetails.unmarriedElderBrothers = Number(payload.familyDetails.unmarriedElderBrothers) || 0;
    payload.familyDetails.marriedYoungerBrothers = Number(payload.familyDetails.marriedYoungerBrothers) || 0;
    payload.familyDetails.unmarriedYoungerBrothers = Number(payload.familyDetails.unmarriedYoungerBrothers) || 0;
    payload.familyDetails.marriedElderSisters = Number(payload.familyDetails.marriedElderSisters) || 0;
    payload.familyDetails.unmarriedElderSisters = Number(payload.familyDetails.unmarriedElderSisters) || 0;
    payload.familyDetails.marriedYoungerSisters = Number(payload.familyDetails.marriedYoungerSisters) || 0;
    payload.familyDetails.unmarriedYoungerSisters = Number(payload.familyDetails.unmarriedYoungerSisters) || 0;

    // Clean age range
    const minAge = formData.partnerPreferences.preferredAgeRange.min;
    const maxAge = formData.partnerPreferences.preferredAgeRange.max;

    if (minAge !== '' && minAge !== null) {
      payload.partnerPreferences.preferredAgeRange.min = Number(minAge);
    }
    if (maxAge !== '' && maxAge !== null) {
      payload.partnerPreferences.preferredAgeRange.max = Number(maxAge);
    }

    if (Object.keys(payload.partnerPreferences.preferredAgeRange).length === 0) {
      delete payload.partnerPreferences.preferredAgeRange;
    }

    // Horoscope clean payload
    const horo = { ...formData.horoscope };
    horo.timeOfBirth = tobString;
    horo.placeOfBirth = formData.personalDetails.placeOfBirth;

    if (horo.padam !== '' && horo.padam !== null && !isNaN(Number(horo.padam))) {
      horo.padam = Number(horo.padam);
    } else {
      delete horo.padam;
    }

    // Format dosham object to match backend schema
    const dStr = typeof formData.horoscope.dosham === 'string' ? formData.horoscope.dosham : 'No Dosham';
    horo.dosham = {
      hasChevvaiDosham: dStr.includes('Chevvai') || dStr.includes('Manglik'),
      hasNagaDosham: dStr.includes('Naga') || dStr.includes('Rahu') || dStr.includes('Kalasarpa'),
      doshamSummary: dStr || 'None',
      description: dStr || null,
    };

    // Dasa Balance cleaning
    if (horo.dasaBalance) {
      const db = { ...horo.dasaBalance };
      db.planet = db.planet || null;
      db.years = db.years !== '' && db.years !== null && !isNaN(Number(db.years)) ? Number(db.years) : null;
      db.months = db.months !== '' && db.months !== null && !isNaN(Number(db.months)) ? Number(db.months) : null;
      db.days = db.days !== '' && db.days !== null && !isNaN(Number(db.days)) ? Number(db.days) : null;
      if (!db.planet && db.years === null && db.months === null && db.days === null) {
        delete horo.dasaBalance;
      } else {
        horo.dasaBalance = db;
      }
    }

    payload.horoscope = horo;

    return payload;
  };

  // Submit profile details
  const handleSubmitProfile = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setFormFeedback({ type: '', text: '' });

    const validationErrors = validateForm();
    const errorKeys = Object.keys(validationErrors);
    if (errorKeys.length > 0) {
      const firstKey = errorKeys[0];
      const firstErrorMessage = validationErrors[firstKey];

      setFormFeedback({
        type: 'error',
        text: firstErrorMessage || 'Please check the highlighted fields before saving.',
      });

      // Map error key to corresponding section
      let targetSectionId = 'sec-personal';
      if (firstKey.startsWith('personalDetails.') || firstKey === 'candidatePhone') {
        targetSectionId = 'sec-personal';
      } else if (firstKey.startsWith('familyDetails.')) {
        targetSectionId = 'sec-family';
      } else if (firstKey.startsWith('educationAndProfession.')) {
        targetSectionId = 'sec-education';
      } else if (firstKey.startsWith('communityDetails.') || firstKey.startsWith('horoscope.')) {
        targetSectionId = 'sec-community';
      } else if (firstKey.startsWith('partnerPreferences.')) {
        targetSectionId = 'sec-preferences';
      }

      setTimeout(() => {
        const errorInput = document.querySelector(`.${styles.inputError}`);
        if (errorInput) {
          errorInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof errorInput.focus === 'function') errorInput.focus();
        } else {
          const sec = document.getElementById(targetSectionId);
          if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

      return;
    }

    setIsSaving(true);
    const payload = preparePayload();

    try {
      const wasExisting = isExistingProfile;
      let res;
      if (wasExisting) {
        res = await updateProfileApi(payload);
      } else {
        res = await createProfileApi(payload);
      }

      if (res && res.success) {
        setIsExistingProfile(true);
        if (res.data?.id || res.data?._id) {
          setProfileId(res.data.id || res.data._id);
        }
        if (typeof res.data?.hasCandidatePhone === 'boolean') {
          setHasCandidatePhone(res.data.hasCandidatePhone);
        } else if (payload.candidatePhone) {
          setHasCandidatePhone(true);
        }

        setFormData((prev) => ({
          ...prev,
          candidatePhone: '',
        }));

        // If a photo was selected alongside profile changes, upload it automatically
        if (selectedPhotoFile) {
          try {
            setIsUploadingPhoto(true);
            const photoRes = await uploadProfilePhotoApi(selectedPhotoFile);
            if (photoRes && photoRes.success) {
              const photoUrl = photoRes.data?.url || photoRes.data?.profilePhoto?.url || photoPreview;
              setExistingPhotoUrl(photoUrl);
              setPhotoPreview(photoUrl);
              setSelectedPhotoFile(null);
            }
          } catch (photoErr) {
            console.warn('Auto photo upload warning:', photoErr);
          } finally {
            setIsUploadingPhoto(false);
          }
        }

        setFormFeedback({
          type: 'success',
          text: wasExisting
            ? 'Profile details updated successfully!'
            : 'Your matrimonial biodata was created successfully!',
        });

        setTimeout(() => {
          setFormFeedback((current) =>
            current.type === 'success' ? { type: '', text: '' } : current
          );
        }, 5000);
      } else {
        setFormFeedback({
          type: 'error',
          text: res?.message || 'Failed to save profile. Please verify your details.',
        });
      }
    } catch (err) {
      setFormFeedback({
        type: 'error',
        text: err?.message || 'Network error occurred while saving profile.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Multi-Photo Gallery Handlers (Max 3)
  const handleAddGalleryPhoto = async (e) => {
    setPhotoMessage({ type: '', text: '' });
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoMessage({
        type: 'error',
        text: 'Please choose a valid JPG, PNG, or WEBP image format.',
      });
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoMessage({
        type: 'error',
        text: 'Image exceeds the maximum allowed size of 5 MB.',
      });
      return;
    }

    setPhotoActionLoading(true);
    setPhotoSlotAction('upload');

    try {
      const res = await addMyPhotoApi(file);
      if (res && res.success && res.data) {
        setPhotosList(res.data.photos || []);
        const prim = res.data.primaryPhoto?.url || res.data.photos?.[0]?.url;
        if (prim) {
          setExistingPhotoUrl(prim);
          setPhotoPreview(prim);
        }
        setIsExistingProfile(true);
        setPhotoMessage({
          type: 'success',
          text: 'Candidate photo uploaded successfully to your gallery!',
        });
        setTimeout(() => {
          setPhotoMessage((c) => (c.type === 'success' ? { type: '', text: '' } : c));
        }, 4000);
      } else {
        setPhotoMessage({
          type: 'error',
          text: res?.message || 'Failed to upload photo. Please try again.',
        });
      }
    } catch (err) {
      setPhotoMessage({
        type: 'error',
        text: err?.message || 'Network error occurred during photo upload.',
      });
    } finally {
      setPhotoActionLoading(false);
      setPhotoSlotAction(null);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleReplaceGalleryPhoto = async (photoId, file) => {
    if (!photoId || !file) return;
    setPhotoMessage({ type: '', text: '' });

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoMessage({
        type: 'error',
        text: 'Please choose a valid JPG, PNG, or WEBP image format.',
      });
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoMessage({
        type: 'error',
        text: 'Image exceeds the maximum allowed size of 5 MB.',
      });
      return;
    }

    setPhotoActionLoading(true);
    setPhotoSlotAction(`replace-${photoId}`);

    try {
      const res = await replaceMyPhotoApi(photoId, file);
      if (res && res.success && res.data) {
        setPhotosList(res.data.photos || []);
        const prim = res.data.primaryPhoto?.url || res.data.photos?.[0]?.url;
        if (prim) {
          setExistingPhotoUrl(prim);
          setPhotoPreview(prim);
        }
        setPhotoMessage({
          type: 'success',
          text: 'Candidate photo replaced successfully!',
        });
        setTimeout(() => {
          setPhotoMessage((c) => (c.type === 'success' ? { type: '', text: '' } : c));
        }, 4000);
      } else {
        setPhotoMessage({
          type: 'error',
          text: res?.message || 'Failed to replace photo.',
        });
      }
    } catch (err) {
      setPhotoMessage({
        type: 'error',
        text: err?.message || 'Network error occurred during photo replacement.',
      });
    } finally {
      setPhotoActionLoading(false);
      setPhotoSlotAction(null);
    }
  };

  const handleDeleteGalleryPhoto = async (photoId) => {
    if (!photoId || photoActionLoading) return;

    setPhotoMessage({ type: '', text: '' });
    setPhotoActionLoading(true);
    setPhotoSlotAction(`delete-${photoId}`);

    try {
      const res = await deleteMyPhotoApi(photoId);
      if (res && res.success && res.data) {
        setPhotosList(res.data.photos || []);
        const prim = res.data.primaryPhoto?.url || res.data.photos?.[0]?.url || '';
        setExistingPhotoUrl(prim);
        setPhotoPreview(prim);
        setPhotoMessage({
          type: 'success',
          text: 'Photo deleted successfully.',
        });
        setTimeout(() => {
          setPhotoMessage((c) => (c.type === 'success' ? { type: '', text: '' } : c));
        }, 4000);
      } else {
        setPhotoMessage({
          type: 'error',
          text: res?.message || 'Failed to delete photo.',
        });
      }
    } catch (err) {
      setPhotoMessage({
        type: 'error',
        text: err?.message || 'Network error occurred during photo deletion.',
      });
    } finally {
      setPhotoActionLoading(false);
      setPhotoSlotAction(null);
    }
  };

  const handleSetPrimaryGalleryPhoto = async (photoId) => {
    if (!photoId || photoActionLoading) return;
    setPhotoMessage({ type: '', text: '' });
    setPhotoActionLoading(true);
    setPhotoSlotAction(`primary-${photoId}`);

    try {
      const res = await setMyPrimaryPhotoApi(photoId);
      if (res && res.success && res.data) {
        setPhotosList(res.data.photos || []);
        const prim = res.data.primaryPhoto?.url || res.data.photos?.[0]?.url;
        if (prim) {
          setExistingPhotoUrl(prim);
          setPhotoPreview(prim);
        }
        setPhotoMessage({
          type: 'success',
          text: 'Primary profile photo updated successfully!',
        });
        setTimeout(() => {
          setPhotoMessage((c) => (c.type === 'success' ? { type: '', text: '' } : c));
        }, 4000);
      } else {
        setPhotoMessage({
          type: 'error',
          text: res?.message || 'Failed to set primary photo.',
        });
      }
    } catch (err) {
      setPhotoMessage({
        type: 'error',
        text: err?.message || 'Network error occurred.',
      });
    } finally {
      setPhotoActionLoading(false);
      setPhotoSlotAction(null);
    }
  };

  // Legacy single photo handlers (preserved)
  const handlePhotoSelect = (e) => {
    setPhotoMessage({ type: '', text: '' });
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoMessage({
        type: 'error',
        text: 'Please choose a valid JPG, PNG, or WEBP image format.',
      });
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoMessage({
        type: 'error',
        text: 'Image exceeds the maximum allowed size of 5 MB.',
      });
      return;
    }

    setSelectedPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
  };

  const handleUploadPhoto = async () => {
    if (!selectedPhotoFile) return;
    setIsUploadingPhoto(true);
    setPhotoMessage({ type: '', text: '' });

    try {
      const res = await uploadProfilePhotoApi(selectedPhotoFile);
      if (res && res.success) {
        const photoUrl = res.data?.url || res.data?.profilePhoto?.url || photoPreview;
        setExistingPhotoUrl(photoUrl);
        setPhotoPreview(photoUrl);
        setSelectedPhotoFile(null);
        setIsExistingProfile(true);
        if (res.data?.id || res.data?._id) {
          setProfileId(res.data.id || res.data._id);
        }
        setPhotoMessage({
          type: 'success',
          text: 'Profile portrait uploaded and updated successfully!',
        });
        setTimeout(() => {
          setPhotoMessage((c) => (c.type === 'success' ? { type: '', text: '' } : c));
        }, 4000);
      } else {
        setPhotoMessage({
          type: 'error',
          text: res?.message || 'Failed to upload photograph. Please try again.',
        });
      }
    } catch (err) {
      setPhotoMessage({
        type: 'error',
        text: err?.message || 'Network error occurred during photo upload.',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleCancelPhotoSelection = () => {
    setSelectedPhotoFile(null);
    setPhotoPreview(existingPhotoUrl);
    setPhotoMessage({ type: '', text: '' });
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // Auth Loading
  if (authLoading || profileLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.loadingSkeleton}>
            <div className={styles.skeletonPulse} style={{ height: '140px', borderRadius: '24px' }} />
            <div className={styles.skeletonPulse} style={{ height: '450px', borderRadius: '24px' }} />
          </div>
        </div>
      </main>
    );
  }

  // Not signed in
  if (!currentUser) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.unauthorizedCard}>
            <div className={styles.unauthorizedIcon}>
              <Lock size={32} />
            </div>
            <h1 className={styles.unauthorizedTitle}>Sign In Required</h1>
            <p className={styles.unauthorizedText}>
              Please sign in to view and manage your matrimonial registration profile.
            </p>
            <Link href="/login" className={styles.btnSignIn}>
              Sign In to Continue <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const candidateInitials = (currentUser?.name || 'M')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const liveAge = calculateAge(formData.personalDetails.dateOfBirth);
  const liveHeightDisplay = formatHeightDisplay(formData.personalDetails.height);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Editorial Header Banner */}
        <header className={styles.headerBanner}>
          <div className={styles.headerPill}>
            <Sparkles size={13} />
            <span>Matrimonial Registration & Biodata Portfolio</span>
          </div>
          <h1 className={styles.mainTitle}>Candidate Biodata & Profile</h1>
          <p className={styles.subTitle}>
            Comprehensive matrimonial biodata covering personal, Vedic astrological (ஜாதகம்), educational, family lineage, and partner expectations.
          </p>
        </header>

        {/* Globally Visible Floating Toast Notification */}
        {formFeedback.text && (
          <div
            role="status"
            aria-live="polite"
            className={`${styles.toastNotification} ${
              formFeedback.type === 'success' ? styles.toastSuccess : styles.toastError
            }`}
          >
            <div
              className={`${styles.toastIconCircle} ${
                formFeedback.type === 'success'
                  ? styles.toastIconCircleSuccess
                  : styles.toastIconCircleError
              }`}
            >
              {formFeedback.type === 'success' ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
            </div>

            <div className={styles.toastBody}>
              <span className={styles.toastTitle}>
                {formFeedback.type === 'success'
                  ? isExistingProfile
                    ? 'Profile Updated Successfully'
                    : 'Profile Created Successfully'
                  : 'Notice'}
              </span>
              <span className={styles.toastMessage}>{formFeedback.text}</span>
            </div>

            <button
              type="button"
              className={styles.toastDismissBtn}
              onClick={() => setFormFeedback({ type: '', text: '' })}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Dossier Two-Column Layout */}
        <div className={styles.dossierLayout}>
          {/* ==================== LEFT STICKY IDENTITY COLUMN ==================== */}
          <aside className={styles.identitySidebar}>
            <div className={styles.identityCard}>
              <div className={styles.avatarContainer}>
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt={currentUser?.name || 'Candidate portrait'}
                    className={styles.avatarImg}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>{candidateInitials}</div>
                )}
                <button
                  type="button"
                  className={styles.avatarChangeBtn}
                  onClick={() => photoInputRef.current?.click()}
                  title="Upload / Change Portrait"
                >
                  <Camera size={15} />
                </button>
              </div>

              <h2 className={styles.candidateName}>{currentUser?.name || 'Candidate Name'}</h2>
              <p className={styles.candidateEmail}>{currentUser?.email}</p>

              {/* Status Badges Row with explicit spacing */}
              <div className={styles.statusBadgeRow}>
                <span className={styles.activeBadge}>
                  <Check size={11} /> Active Member
                </span>
                {formData.personalDetails.gender && (
                  <span className={styles.genderBadge}>
                    {formData.personalDetails.gender}
                  </span>
                )}
              </div>

              {/* Completion Progress Card */}
              <div className={styles.completionCard}>
                <div className={styles.completionHeaderRow}>
                  <span className={styles.completionLabel}>Biodata Completion</span>
                  <span className={styles.completionPercentage}>{completionPercentage}%</span>
                </div>
                <div className={styles.completionTrack}>
                  <div
                    className={styles.completionFill}
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>

              {/* Live Biodata Snapshot Table */}
              <div className={styles.snapshotTable}>
                <div className={styles.snapshotRow}>
                  <span className={styles.snapshotKey}>Age</span>
                  <span className={styles.snapshotVal}>{liveAge || '—'}</span>
                </div>
                <div className={styles.snapshotRow}>
                  <span className={styles.snapshotKey}>Height</span>
                  <span className={styles.snapshotVal}>
                    {formData.personalDetails.height
                      ? `${formData.personalDetails.height} cm (${liveHeightDisplay})`
                      : '—'}
                  </span>
                </div>
                <div className={styles.snapshotRow}>
                  <span className={styles.snapshotKey}>Weight</span>
                  <span className={styles.snapshotVal}>
                    {formData.personalDetails.weight ? `${formData.personalDetails.weight} kg` : '—'}
                  </span>
                </div>
                <div className={styles.snapshotRow}>
                  <span className={styles.snapshotKey}>Blood Group</span>
                  <span className={styles.snapshotVal}>{formData.personalDetails.bloodGroup || '—'}</span>
                </div>
                <div className={styles.snapshotRow}>
                  <span className={styles.snapshotKey}>Community</span>
                  <span className={styles.snapshotVal}>
                    {formData.communityDetails.caste || formData.communityDetails.religion || '—'}
                  </span>
                </div>
                <div className={styles.snapshotRow}>
                  <span className={styles.snapshotKey}>Star / Rasi</span>
                  <span className={styles.snapshotVal}>
                    {formData.horoscope.nakshatram || formData.horoscope.rasi || '—'}
                  </span>
                </div>
                <div className={styles.snapshotRow}>
                  <span className={styles.snapshotKey}>Location</span>
                  <span className={styles.snapshotVal}>
                    {formData.personalDetails.location || formData.personalDetails.nativity || '—'}
                  </span>
                </div>
                <div className={styles.snapshotRow}>
                  <span className={styles.snapshotKey}>Profession</span>
                  <span className={styles.snapshotVal}>
                    {formData.educationAndProfession.occupation || '—'}
                  </span>
                </div>
              </div>

              {/* Public Card Link */}
              {profileId && (
                <Link href={`/members/${profileId}`} className={styles.btnSidebarPreview}>
                  <Eye size={14} /> Preview Public Card
                </Link>
              )}
            </div>

            {/* Quick Section Jump Navigator */}
            <nav className={styles.jumpNavCard}>
              <h3 className={styles.jumpNavTitle}>Sections</h3>
              <a href="#sec-personal" className={styles.jumpNavLink}>
                <span>01. Personal & Physical</span>
                <ChevronRight size={14} />
              </a>
              <a href="#sec-family" className={styles.jumpNavLink}>
                <span>02. Family & Siblings</span>
                <ChevronRight size={14} />
              </a>
              <a href="#sec-education" className={styles.jumpNavLink}>
                <span>03. Education & Profession</span>
                <ChevronRight size={14} />
              </a>
              <a href="#sec-horoscope" className={styles.jumpNavLink}>
                <span>04. Community & Astrology</span>
                <ChevronRight size={14} />
              </a>
              <a href="#sec-preferences" className={styles.jumpNavLink}>
                <span>05. Partner Preferences</span>
                <ChevronRight size={14} />
              </a>
              <a href="#sec-photos" className={styles.jumpNavLink}>
                <span>06. Profile Photograph</span>
                <ChevronRight size={14} />
              </a>
            </nav>
          </aside>

          {/* ==================== RIGHT MAIN FORM CANVAS ==================== */}
          <form className={styles.mainCanvas} onSubmit={handleSubmitProfile} noValidate>
            {/* -------------------- SECTION 01: PERSONAL & PHYSICAL PROFILE -------------------- */}
            <section id="sec-personal" className={styles.dossierSectionCard}>
              <div className={styles.sectionCardHeader}>
                <div className={styles.sectionMedallion}>01</div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionCardTitle}>Personal, Physical & Contact Profile</h2>
                  <p className={styles.sectionCardSubtitle}>
                    Personal credentials, physical attributes, birth timings, and confidential contact coordinates.
                  </p>
                </div>
              </div>

              <div className={styles.formGrid}>
                {/* Full Name & Gender */}
                <div className={styles.formGrid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Registered Full Name <span className={styles.reqMark}>*</span>
                    </label>
                    <input
                      type="text"
                      className={`${styles.input} ${styles.inputDisabled}`}
                      value={currentUser?.name || ''}
                      disabled
                    />
                    <span className={styles.hintText}>From primary account credentials</span>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Gender <span className={styles.reqMark}>*</span>
                    </label>
                    <div className={styles.pillGroup}>
                      {GENDER_OPTIONS.map((g) => {
                        const active = formData.personalDetails.gender === g;
                        return (
                          <button
                            key={g}
                            type="button"
                            className={`${styles.pillBtn} ${active ? styles.pillBtnActive : ''}`}
                            onClick={() => handleNestedChange('personalDetails', 'gender', g)}
                          >
                            {active && <Check size={12} />}
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Date of Birth, Birth Time & Place of Birth */}
                <div className={styles.formGrid3}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Date of Birth <span className={styles.reqMark}>*</span>
                    </label>
                    <input
                      type="date"
                      className={`${styles.input} ${
                        errors['personalDetails.dateOfBirth'] ? styles.inputError : ''
                      }`}
                      value={formData.personalDetails.dateOfBirth}
                      onChange={(e) =>
                        handleNestedChange('personalDetails', 'dateOfBirth', e.target.value)
                      }
                    />
                    {liveAge && (
                      <span className={styles.dynamicBadge}>
                        <Sparkles size={11} /> {liveAge} old
                      </span>
                    )}
                    {errors['personalDetails.dateOfBirth'] && (
                      <span className={styles.errorText}>
                        {errors['personalDetails.dateOfBirth']}
                      </span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Time of Birth (பிறந்த நேரம்)</label>
                    <div className={styles.timeGroupWrap}>
                      <select
                        className={styles.timeSelect}
                        value={formData.personalDetails.birthHour}
                        onChange={(e) =>
                          handleNestedChange('personalDetails', 'birthHour', e.target.value)
                        }
                      >
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(
                          (h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          )
                        )}
                      </select>
                      <select
                        className={styles.timeSelect}
                        value={formData.personalDetails.birthMinute}
                        onChange={(e) =>
                          handleNestedChange('personalDetails', 'birthMinute', e.target.value)
                        }
                      >
                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(
                          (m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          )
                        )}
                      </select>
                      <select
                        className={styles.timeSelectPeriod}
                        value={formData.personalDetails.birthPeriod}
                        onChange={(e) =>
                          handleNestedChange('personalDetails', 'birthPeriod', e.target.value)
                        }
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                    <span className={styles.hintText}>Hr : Min : AM/PM</span>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Place of Birth (பிறந்த இடம்)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Madurai, Tamil Nadu"
                      value={formData.personalDetails.placeOfBirth}
                      onChange={(e) =>
                        handleNestedChange('personalDetails', 'placeOfBirth', e.target.value)
                      }
                    />
                    <span className={styles.hintText}>Town / District for Horoscope</span>
                  </div>
                </div>

                {/* Nativity, Mother Tongue & Marital Status */}
                <div className={styles.formGrid3}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nativity / Native Town (பூர்வீகம்)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Chidambaram, Cuddalore"
                      value={formData.personalDetails.nativity}
                      onChange={(e) =>
                        handleNestedChange('personalDetails', 'nativity', e.target.value)
                      }
                    />
                    <span className={styles.hintText}>Town & District of ancestral roots</span>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Mother Tongue (தாய்மொழி)</label>
                    <select
                      className={styles.select}
                      value={formData.personalDetails.motherTongue}
                      onChange={(e) =>
                        handleNestedChange('personalDetails', 'motherTongue', e.target.value)
                      }
                    >
                      {MOTHER_TONGUES.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Marital Status (திருமண நிலை)</label>
                    <select
                      className={styles.select}
                      value={formData.personalDetails.maritalStatus}
                      onChange={(e) =>
                        handleNestedChange('personalDetails', 'maritalStatus', e.target.value)
                      }
                    >
                      <option value="">— Select Marital Status —</option>
                      {MARITAL_STATUS_OPTIONS.map((ms) => (
                        <option key={ms} value={ms}>
                          {ms}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Physical: Height, Weight, Blood Group */}
                <div className={styles.formGrid3}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Height (உயரம் cm)</label>
                    <input
                      type="number"
                      className={`${styles.input} ${
                        errors['personalDetails.height'] ? styles.inputError : ''
                      }`}
                      placeholder="e.g. 165"
                      min="50"
                      max="260"
                      value={formData.personalDetails.height}
                      onChange={(e) =>
                        handleNestedChange('personalDetails', 'height', e.target.value)
                      }
                    />
                    {liveHeightDisplay && (
                      <span className={styles.dynamicBadge}>
                        <Sparkles size={11} /> {liveHeightDisplay}
                      </span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Weight (எடை kg)</label>
                    <input
                      type="number"
                      className={styles.input}
                      placeholder="e.g. 62"
                      min="30"
                      max="200"
                      value={formData.personalDetails.weight}
                      onChange={(e) =>
                        handleNestedChange('personalDetails', 'weight', e.target.value)
                      }
                    />
                    <span className={styles.hintText}>Kilograms (40 kg - 140 kg)</span>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Blood Group (இரத்த வகை)</label>
                    <select
                      className={styles.select}
                      value={formData.personalDetails.bloodGroup}
                      onChange={(e) =>
                        handleNestedChange('personalDetails', 'bloodGroup', e.target.value)
                      }
                    >
                      <option value="">— Select Blood Group —</option>
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Complexion & Diet */}
                <div className={styles.formGrid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Complexion (நிறம்)</label>
                    <div className={styles.pillGroup}>
                      {COMPLEXION_OPTIONS.map((c) => {
                        const active = formData.personalDetails.complexion === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            className={`${styles.pillBtn} ${
                              active ? styles.pillBtnActive : ''
                            }`}
                            onClick={() => handleNestedChange('personalDetails', 'complexion', c)}
                          >
                            {active && <Check size={12} />}
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Diet Habit (உணவு முறை)</label>
                    <div className={styles.pillGroup}>
                      {DIET_OPTIONS.map((d) => {
                        const active = formData.personalDetails.diet === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            className={`${styles.pillBtn} ${
                              active ? styles.pillBtnActive : ''
                            }`}
                            onClick={() => handleNestedChange('personalDetails', 'diet', d)}
                          >
                            {active && <Check size={12} />}
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Physical Status */}
                <div className={styles.formGrid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Physical Status (உடல் நிலை)</label>
                    <div className={styles.pillGroup}>
                      {['Normal', 'Physically Challenged'].map((ps) => {
                        const active = formData.personalDetails.physicalStatus === ps;
                        return (
                          <button
                            key={ps}
                            type="button"
                            className={`${styles.pillBtn} ${
                              active ? styles.pillBtnActive : ''
                            }`}
                            onClick={() =>
                              handleNestedChange('personalDetails', 'physicalStatus', ps)
                            }
                          >
                            {active && <Check size={12} />}
                            {ps}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {formData.personalDetails.physicalStatus === 'Physically Challenged' && (
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Disability Details</label>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="Please specify nature of challenge"
                        value={formData.personalDetails.disabilityDetails}
                        onChange={(e) =>
                          handleNestedChange('personalDetails', 'disabilityDetails', e.target.value)
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Residential Addresses: Present & Permanent */}
                <div className={styles.addressCardGrid}>
                  <div className={styles.addressCard}>
                    <div className={styles.addressHeader}>
                      <span className={styles.addressTitle}>
                        <Home size={16} /> Present Address (தற்போதைய முகவரி)
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      className={styles.textarea}
                      placeholder="Door No, Street Name, Area, City, State, PIN"
                      value={formData.personalDetails.presentAddress}
                      onChange={(e) => {
                        handleNestedChange('personalDetails', 'presentAddress', e.target.value);
                        if (sameAsPresentAddress) {
                          handleNestedChange('personalDetails', 'permanentAddress', e.target.value);
                        }
                      }}
                    />
                  </div>

                  <div className={styles.addressCard}>
                    <div className={styles.addressHeader}>
                      <span className={styles.addressTitle}>
                        <MapPin size={16} /> Permanent Address (நிரந்தர முகவரி)
                      </span>
                      <label className={styles.sameAddressCheckbox}>
                        <input
                          type="checkbox"
                          checked={sameAsPresentAddress}
                          onChange={handleSameAddressToggle}
                        />
                        <span>Same as present</span>
                      </label>
                    </div>
                    <textarea
                      rows={3}
                      className={styles.textarea}
                      placeholder="Native residential / ancestral address"
                      value={formData.personalDetails.permanentAddress}
                      onChange={(e) =>
                        handleNestedChange('personalDetails', 'permanentAddress', e.target.value)
                      }
                      disabled={sameAsPresentAddress}
                    />
                  </div>
                </div>

                {/* Contact Coordinates */}
                <div className={styles.formGrid3}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Contact Person (தொடர்பு நபர்)</label>
                    <select
                      className={styles.select}
                      value={formData.personalDetails.contactPerson}
                      onChange={(e) =>
                        handleNestedChange('personalDetails', 'contactPerson', e.target.value)
                      }
                    >
                      <option value="Self">Candidate (Self)</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                      <option value="Guardian">Guardian / Relative</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Confidential Mobile Number <span className={styles.reqMark}>*</span>
                    </label>
                    <input
                      type="tel"
                      className={`${styles.input} ${
                        errors.candidatePhone ? styles.inputError : ''
                      }`}
                      placeholder={hasCandidatePhone ? '•••••••••• (Saved)' : '+91 98765 43210'}
                      value={formData.candidatePhone}
                      onChange={(e) => handleCandidatePhoneChange(e.target.value)}
                    />
                    {errors.candidatePhone && (
                      <span className={styles.errorText}>{errors.candidatePhone}</span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Alternate Mobile / WhatsApp</label>
                    <input
                      type="tel"
                      className={styles.input}
                      placeholder="e.g. +91 94444 12345"
                      value={formData.personalDetails.alternatePhone}
                      onChange={(e) =>
                        handleNestedChange('personalDetails', 'alternatePhone', e.target.value)
                      }
                    />
                  </div>
                </div>

                {/* Golden Phone Privacy Shield Notice */}
                <div className={styles.privacyShieldBanner}>
                  <div className={styles.shieldIconWrap}>
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 className={styles.shieldTitle}>Strict Golden Shield Privacy Protection</h4>
                    <p className={styles.shieldDesc}>
                      Your contact number and full address are strictly confidential. They are never published openly on search listings, and can only be unlocked by verified members holding an active contact credit.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* -------------------- SECTION 02: FAMILY HERITAGE & SIBLINGS -------------------- */}
            <section id="sec-family" className={styles.dossierSectionCard}>
              <div className={styles.sectionCardHeader}>
                <div className={styles.sectionMedallion}>02</div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionCardTitle}>Family Heritage & Siblings (குடும்ப விவரங்கள்)</h2>
                  <p className={styles.sectionCardSubtitle}>
                    Parental lineage, occupation, married and unmarried brothers and sisters, and ancestral native heritage.
                  </p>
                </div>
              </div>

              <div className={styles.formGrid}>
                {/* Father Details */}
                <div className={styles.formGrid3}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Father&apos;s Name (தந்தை பெயர்)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. R. Subramanian"
                      value={formData.familyDetails.fatherName}
                      onChange={(e) =>
                        handleNestedChange('familyDetails', 'fatherName', e.target.value)
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Father Status</label>
                    <div className={styles.pillGroup}>
                      {['Yes', 'No'].map((status) => {
                        const active = formData.familyDetails.fatherAlive === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            className={`${styles.pillBtn} ${
                              active ? styles.pillBtnActive : ''
                            }`}
                            onClick={() =>
                              handleNestedChange('familyDetails', 'fatherAlive', status)
                            }
                          >
                            {active && <Check size={12} />}
                            {status === 'Yes' ? 'Alive (உள்ளார்)' : 'Passed Away'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Father&apos;s Job / Profession</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Retired Govt Officer, Business"
                      value={formData.familyDetails.fatherOccupation}
                      onChange={(e) =>
                        handleNestedChange('familyDetails', 'fatherOccupation', e.target.value)
                      }
                    />
                  </div>
                </div>

                {/* Mother Details */}
                <div className={styles.formGrid3}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Mother&apos;s Name (தாய் பெயர்)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. S. Lakshmi"
                      value={formData.familyDetails.motherName}
                      onChange={(e) =>
                        handleNestedChange('familyDetails', 'motherName', e.target.value)
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Mother Status</label>
                    <div className={styles.pillGroup}>
                      {['Yes', 'No'].map((status) => {
                        const active = formData.familyDetails.motherAlive === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            className={`${styles.pillBtn} ${
                              active ? styles.pillBtnActive : ''
                            }`}
                            onClick={() =>
                              handleNestedChange('familyDetails', 'motherAlive', status)
                            }
                          >
                            {active && <Check size={12} />}
                            {status === 'Yes' ? 'Alive (உள்ளார்)' : 'Passed Away'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Mother&apos;s Job / Profession</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Homemaker, Teacher"
                      value={formData.familyDetails.motherOccupation}
                      onChange={(e) =>
                        handleNestedChange('familyDetails', 'motherOccupation', e.target.value)
                      }
                    />
                  </div>
                </div>

                {/* Siblings Breakdown Counter Matrix */}
                <div className={styles.siblingContainer}>
                  <h4 className={styles.siblingSubhead}>
                    <Users size={16} /> Brothers & Sisters Breakdown (உடன்பிறப்புகள் விவரம்)
                  </h4>
                  <div className={styles.siblingRow}>
                    {/* Brothers Card */}
                    <div className={styles.siblingCard}>
                      <span className={styles.siblingCardTitle}>Brothers (சகோதரர்கள்)</span>
                      <div className={styles.siblingCounterPair}>
                        <div className={styles.siblingCounterBox}>
                          <span className={styles.siblingCounterLabel}>Elder Brother (மூத்தவர்)</span>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <select
                              className={styles.siblingSelect}
                              value={formData.familyDetails.marriedElderBrothers}
                              onChange={(e) =>
                                handleNestedChange('familyDetails', 'marriedElderBrothers', e.target.value)
                              }
                            >
                              {SIBLING_COUNT_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                  {c} Married
                                </option>
                              ))}
                            </select>
                            <select
                              className={styles.siblingSelect}
                              value={formData.familyDetails.unmarriedElderBrothers}
                              onChange={(e) =>
                                handleNestedChange('familyDetails', 'unmarriedElderBrothers', e.target.value)
                              }
                            >
                              {SIBLING_COUNT_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                  {c} Unmarried
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className={styles.siblingCounterBox}>
                          <span className={styles.siblingCounterLabel}>Younger Brother (இளையவர்)</span>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <select
                              className={styles.siblingSelect}
                              value={formData.familyDetails.marriedYoungerBrothers}
                              onChange={(e) =>
                                handleNestedChange('familyDetails', 'marriedYoungerBrothers', e.target.value)
                              }
                            >
                              {SIBLING_COUNT_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                  {c} Married
                                </option>
                              ))}
                            </select>
                            <select
                              className={styles.siblingSelect}
                              value={formData.familyDetails.unmarriedYoungerBrothers}
                              onChange={(e) =>
                                handleNestedChange('familyDetails', 'unmarriedYoungerBrothers', e.target.value)
                              }
                            >
                              {SIBLING_COUNT_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                  {c} Unmarried
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sisters Card */}
                    <div className={styles.siblingCard}>
                      <span className={styles.siblingCardTitle}>Sisters (சகோதரிகள்)</span>
                      <div className={styles.siblingCounterPair}>
                        <div className={styles.siblingCounterBox}>
                          <span className={styles.siblingCounterLabel}>Elder Sister (அக்கா)</span>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <select
                              className={styles.siblingSelect}
                              value={formData.familyDetails.marriedElderSisters}
                              onChange={(e) =>
                                handleNestedChange('familyDetails', 'marriedElderSisters', e.target.value)
                              }
                            >
                              {SIBLING_COUNT_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                  {c} Married
                                </option>
                              ))}
                            </select>
                            <select
                              className={styles.siblingSelect}
                              value={formData.familyDetails.unmarriedElderSisters}
                              onChange={(e) =>
                                handleNestedChange('familyDetails', 'unmarriedElderSisters', e.target.value)
                              }
                            >
                              {SIBLING_COUNT_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                  {c} Unmarried
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className={styles.siblingCounterBox}>
                          <span className={styles.siblingCounterLabel}>Younger Sister (தங்கை)</span>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <select
                              className={styles.siblingSelect}
                              value={formData.familyDetails.marriedYoungerSisters}
                              onChange={(e) =>
                                handleNestedChange('familyDetails', 'marriedYoungerSisters', e.target.value)
                              }
                            >
                              {SIBLING_COUNT_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                  {c} Married
                                </option>
                              ))}
                            </select>
                            <select
                              className={styles.siblingSelect}
                              value={formData.familyDetails.unmarriedYoungerSisters}
                              onChange={(e) =>
                                handleNestedChange('familyDetails', 'unmarriedYoungerSisters', e.target.value)
                              }
                            >
                              {SIBLING_COUNT_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                  {c} Unmarried
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Family Overview & Ancestral Town */}
                <div className={styles.formGrid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Family Overview & Values (குடும்ப பின்னணி)</label>
                    <textarea
                      rows={3}
                      className={styles.textarea}
                      placeholder="e.g. Traditional, close-knit, middle-class / upper-middle-class family with deep cultural values..."
                      value={formData.familyDetails.familyInformation}
                      onChange={(e) =>
                        handleNestedChange('familyDetails', 'familyInformation', e.target.value)
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Ancestral Origin / Family Town (பூர்வீக ஊர்)</label>
                    <textarea
                      rows={3}
                      className={styles.textarea}
                      placeholder="e.g. Native in Thanjavur / Kumbakonam, currently settled in Chennai..."
                      value={formData.familyDetails.familyLocation}
                      onChange={(e) =>
                        handleNestedChange('familyDetails', 'familyLocation', e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* -------------------- SECTION 03: EDUCATION & PROFESSION -------------------- */}
            <section id="sec-education" className={styles.dossierSectionCard}>
              <div className={styles.sectionCardHeader}>
                <div className={styles.sectionMedallion}>03</div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionCardTitle}>Education, Profession & Financials (கல்வி & தொழில்)</h2>
                  <p className={styles.sectionCardSubtitle}>
                    Academic degrees, designation, employer organization, work city, and monthly/annual income.
                  </p>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGrid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Highest Educational Degree <span className={styles.reqMark}>*</span>
                    </label>
                    <input
                      type="text"
                      list="edu-options"
                      className={styles.input}
                      placeholder="e.g. B.Tech / MBA / MBBS / CA"
                      value={formData.educationAndProfession.educationalQualification}
                      onChange={(e) =>
                        handleNestedChange(
                          'educationAndProfession',
                          'educationalQualification',
                          e.target.value
                        )
                      }
                    />
                    <datalist id="edu-options">
                      {EDUCATION_SUGGESTIONS.map((deg) => (
                        <option key={deg} value={deg} />
                      ))}
                    </datalist>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Occupation / Job Title (தொழில் / பதவி)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Senior Software Architect, Doctor"
                      value={formData.educationAndProfession.occupation}
                      onChange={(e) =>
                        handleNestedChange('educationAndProfession', 'occupation', e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className={styles.formGrid3}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Company / Employer (நிறுவனம்)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Cognizant / TCS / Apollo"
                      value={formData.educationAndProfession.company}
                      onChange={(e) =>
                        handleNestedChange('educationAndProfession', 'company', e.target.value)
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Work Location (வேலை செய்யும் இடம்)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Chennai, Singapore"
                      value={formData.educationAndProfession.workLocation}
                      onChange={(e) =>
                        handleNestedChange('educationAndProfession', 'workLocation', e.target.value)
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Monthly / Annual Income (வருமானம்)</label>
                    <select
                      className={styles.select}
                      value={formData.educationAndProfession.income}
                      onChange={(e) =>
                        handleNestedChange('educationAndProfession', 'income', e.target.value)
                      }
                    >
                      <option value="">— Select Income Range —</option>
                      {INCOME_OPTIONS.map((inc) => (
                        <option key={inc} value={inc}>
                          {inc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* -------------------- SECTION 04: COMMUNITY & VEDIC ASTROLOGY (ஜாதகம்) -------------------- */}
            <section id="sec-horoscope" className={styles.dossierSectionCard}>
              <div className={styles.sectionCardHeader}>
                <div className={styles.sectionMedallion}>04</div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionCardTitle}>Community & Vedic Astrology (சமூகம் & ஜாதகம்)</h2>
                  <p className={styles.sectionCardSubtitle}>
                    Caste, subcaste, gothram, Vedic astrology attributes, Nakshatram, Rasi, Lagnam, Dosham status, and Dasa balance (திசை இருப்பு).
                  </p>
                </div>
              </div>

              <div className={styles.formGrid}>
                {/* Community Row */}
                <div className={styles.formGrid4}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Religion (மதம்)</label>
                    <select
                      className={styles.select}
                      value={formData.communityDetails.religion}
                      onChange={(e) =>
                        handleNestedChange('communityDetails', 'religion', e.target.value)
                      }
                    >
                      {RELIGIONS.map((rel) => (
                        <option key={rel} value={rel}>
                          {rel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Caste / Community (ஜாதி)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Mudaliar, Pillai, Iyer, Chettiar, Nadar"
                      value={formData.communityDetails.caste}
                      onChange={(e) =>
                        handleNestedChange('communityDetails', 'caste', e.target.value)
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Subcaste / Sect (உட்பிரிவு)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Saiva Pillai, Vadama"
                      value={formData.communityDetails.subcaste}
                      onChange={(e) =>
                        handleNestedChange('communityDetails', 'subcaste', e.target.value)
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Gothram / Kulam (கோத்திரம்)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Shiva, Bharadwaja, Kasyapa"
                      value={formData.communityDetails.gothram}
                      onChange={(e) =>
                        handleNestedChange('communityDetails', 'gothram', e.target.value)
                      }
                    />
                  </div>
                </div>

                {/* Astrology Key Selectors: Rasi, Star, Padam, Lagnam */}
                <div className={styles.formGrid4}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Rasi / Moon Sign (ராசி)</label>
                    <select
                      className={styles.select}
                      value={formData.horoscope.rasi}
                      onChange={(e) => handleNestedChange('horoscope', 'rasi', e.target.value)}
                    >
                      <option value="">— Select Rasi —</option>
                      {RASI_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Star / Nakshatram (நட்சத்திரம்)</label>
                    <select
                      className={styles.select}
                      value={formData.horoscope.nakshatram}
                      onChange={(e) =>
                        handleNestedChange('horoscope', 'nakshatram', e.target.value)
                      }
                    >
                      <option value="">— Select Star —</option>
                      {NAKSHATRAM_OPTIONS.map((nak) => (
                        <option key={nak} value={nak}>
                          {nak}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Padam (பாதம்)</label>
                    <select
                      className={styles.select}
                      value={formData.horoscope.padam}
                      onChange={(e) => handleNestedChange('horoscope', 'padam', e.target.value)}
                    >
                      <option value="">— Padam —</option>
                      <option value="1">1 ஆம் பாதம்</option>
                      <option value="2">2 ஆம் பாதம்</option>
                      <option value="3">3 ஆம் பாதம்</option>
                      <option value="4">4 ஆம் பாதம்</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Lagnam / Ascendant (லக்னம்)</label>
                    <select
                      className={styles.select}
                      value={formData.horoscope.lagnam}
                      onChange={(e) => handleNestedChange('horoscope', 'lagnam', e.target.value)}
                    >
                      <option value="">— Select Lagnam —</option>
                      {RASI_OPTIONS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dosham & Dasa Balance */}
                <div className={styles.formGrid4}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Dosham Status (தோஷம் விவரம்)</label>
                    <select
                      className={styles.select}
                      value={formData.horoscope.dosham}
                      onChange={(e) => handleNestedChange('horoscope', 'dosham', e.target.value)}
                    >
                      {DOSHAM_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Dasa Balance (திசை இருப்பு)</label>
                    <select
                      className={styles.select}
                      value={formData.horoscope.dasaBalance?.planet || ''}
                      onChange={(e) => handleDasaChange('planet', e.target.value)}
                    >
                      <option value="">— Planet / கிரகம் —</option>
                      {DASA_PLANETS.map((dp) => (
                        <option key={dp} value={dp}>
                          {dp}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Years (வருடம்)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className={styles.input}
                      placeholder="e.g. 5"
                      value={formData.horoscope.dasaBalance?.years ?? ''}
                      onChange={(e) => handleDasaChange('years', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Months & Days (மாதம் / நாள்)</label>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <input
                        type="number"
                        min="0"
                        max="11"
                        className={styles.input}
                        placeholder="M"
                        title="Months"
                        value={formData.horoscope.dasaBalance?.months ?? ''}
                        onChange={(e) => handleDasaChange('months', e.target.value)}
                      />
                      <input
                        type="number"
                        min="0"
                        max="31"
                        className={styles.input}
                        placeholder="D"
                        title="Days"
                        value={formData.horoscope.dasaBalance?.days ?? ''}
                        onChange={(e) => handleDasaChange('days', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* -------------------- SECTION 05: PARTNER PREFERENCES & EXPECTATIONS -------------------- */}
            <section id="sec-preferences" className={styles.dossierSectionCard}>
              <div className={styles.sectionCardHeader}>
                <div className={styles.sectionMedallion}>05</div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionCardTitle}>Partner Preferences & Expectations (வரன் எதிர்பார்ப்புகள்)</h2>
                  <p className={styles.sectionCardSubtitle}>
                    Desired age bracket, marital status eligibility, diet, horoscope match necessity, job requirements, and location preferences.
                  </p>
                </div>
              </div>

              <div className={styles.formGrid}>
                {/* Age Range & Horoscope Matching */}
                <div className={styles.formGrid3}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Preferred Age Range (வயது வரம்பு)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <input
                        type="number"
                        min="18"
                        max="100"
                        className={`${styles.input} ${
                          errors['partnerPreferences.preferredAgeRange'] ? styles.inputError : ''
                        }`}
                        placeholder="From 21"
                        value={formData.partnerPreferences.preferredAgeRange.min}
                        onChange={(e) => handleAgeRangeChange('min', e.target.value)}
                      />
                      <span style={{ color: '#888', fontWeight: 600 }}>to</span>
                      <input
                        type="number"
                        min="18"
                        max="100"
                        className={`${styles.input} ${
                          errors['partnerPreferences.preferredAgeRange'] ? styles.inputError : ''
                        }`}
                        placeholder="To 29"
                        value={formData.partnerPreferences.preferredAgeRange.max}
                        onChange={(e) => handleAgeRangeChange('max', e.target.value)}
                      />
                    </div>
                    {errors['partnerPreferences.preferredAgeRange'] && (
                      <span className={styles.errorText}>
                        {errors['partnerPreferences.preferredAgeRange']}
                      </span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Horoscope Matching Required (ஜாதகம் பொருத்தம்)</label>
                    <div className={styles.pillGroup}>
                      {['Yes', 'No', "Doesn't Matter"].map((opt) => {
                        const active = formData.partnerPreferences.horoscopeRequired === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            className={`${styles.pillBtn} ${
                              active ? styles.pillBtnActive : ''
                            }`}
                            onClick={() =>
                              handleNestedChange('partnerPreferences', 'horoscopeRequired', opt)
                            }
                          >
                            {active && <Check size={12} />}
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Job Requirement (வேலை எதிர்பார்ப்பு)</label>
                    <div className={styles.pillGroup}>
                      {['Must', 'Optional', 'Not required'].map((req) => {
                        const active = formData.partnerPreferences.jobRequirement === req;
                        return (
                          <button
                            key={req}
                            type="button"
                            className={`${styles.pillBtn} ${
                              active ? styles.pillBtnActive : ''
                            }`}
                            onClick={() =>
                              handleNestedChange('partnerPreferences', 'jobRequirement', req)
                            }
                          >
                            {active && <Check size={12} />}
                            {req}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Acceptable Marital Status Multi-Select */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Acceptable Marital Status (ஏற்றுக்கொள்ளத்தக்க திருமண நிலை)</label>
                  <div className={styles.pillGroup}>
                    {['Never Married', 'Married', 'Widowed', 'Divorced', "Doesn't Matter"].map(
                      (status) => {
                        const active = (
                          formData.partnerPreferences.maritalStatusPreference || []
                        ).includes(status);
                        return (
                          <button
                            key={status}
                            type="button"
                            className={`${styles.pillBtn} ${
                              active ? styles.pillBtnActive : ''
                            }`}
                            onClick={() =>
                              toggleArrayPreference('maritalStatusPreference', status)
                            }
                          >
                            {active && <Check size={12} />}
                            {status}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Preferred Diet Multi-Select */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Preferred Diet (உணவு விருப்பம்)</label>
                  <div className={styles.pillGroup}>
                    {['Vegetarian', 'Non-Vegetarian', 'Eggetarian', "Doesn't Matter"].map(
                      (diet) => {
                        const active = (
                          formData.partnerPreferences.dietPreference || []
                        ).includes(diet);
                        return (
                          <button
                            key={diet}
                            type="button"
                            className={`${styles.pillBtn} ${
                              active ? styles.pillBtnActive : ''
                            }`}
                            onClick={() => toggleArrayPreference('dietPreference', diet)}
                          >
                            {active && <Check size={12} />}
                            {diet}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Qualification, Location & Caste Preferences */}
                <div className={styles.formGrid3}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Preferred Education (கல்வித் தகுதி)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Any Graduate, Engineering, Medical"
                      value={formData.partnerPreferences.educationPreference}
                      onChange={(e) =>
                        handleNestedChange('partnerPreferences', 'educationPreference', e.target.value)
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Preferred Location / City (வசிக்கும் இடம்)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Chennai, Bangalore, Abroad"
                      value={formData.partnerPreferences.preferredLocation}
                      onChange={(e) =>
                        handleNestedChange('partnerPreferences', 'preferredLocation', e.target.value)
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Preferred Caste / Community (சமூகம்)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Same Caste or Any Hindu"
                      value={formData.partnerPreferences.castePreference}
                      onChange={(e) =>
                        handleNestedChange('partnerPreferences', 'castePreference', e.target.value)
                      }
                    />
                  </div>
                </div>

                {/* Other Expectations */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>General Expectations & Lifestyle Notes (பிற எதிர்பார்ப்புகள்)</label>
                  <textarea
                    rows={3}
                    className={styles.textarea}
                    placeholder="e.g. Looking for an understanding, caring, and values-driven partner..."
                    value={formData.partnerPreferences.otherPreferences}
                    onChange={(e) =>
                      handleNestedChange('partnerPreferences', 'otherPreferences', e.target.value)
                    }
                  />
                </div>
              </div>
            </section>

            {/* -------------------- SECTION 06: PROFILE PHOTOGRAPH -------------------- */}
            <section id="sec-photos" className={styles.dossierSectionCard}>
              <div className={styles.sectionCardHeader}>
                <div className={styles.sectionMedallion}>06</div>
                <div className={styles.sectionHeaderContent}>
                  <h2 className={styles.sectionCardTitle}>Profile Portraits & Photos (புகைப்படம் - 3 படங்கள் வரை)</h2>
                  <p className={styles.sectionCardSubtitle}>
                    Upload up to 3 high-definition matrimonial photographs (Frontal portrait, side pose, full-length). Verified candidates with 3 clear photos receive up to 5x higher responses.
                  </p>
                </div>
              </div>

              <div className={styles.galleryContainer}>
                {photoMessage.text && (
                  <div
                    className={
                      photoMessage.type === 'success'
                        ? styles.photoFeedbackSuccess
                        : styles.photoFeedbackError
                    }
                  >
                    {photoMessage.type === 'success' ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <span>{photoMessage.text}</span>
                  </div>
                )}

                <div className={styles.galleryGrid}>
                  {[0, 1, 2].map((slotIdx) => {
                    const photo = photosList[slotIdx];
                    if (photo && photo.url) {
                      return (
                        <div
                          key={photo._id || `photo-slot-${slotIdx}`}
                          className={`${styles.galleryCard} ${
                            photo.isPrimary ? styles.galleryCardPrimary : ''
                          }`}
                        >
                          <div className={styles.galleryImageWrapper}>
                            <img
                              src={photo.url}
                              alt={`Candidate photo ${slotIdx + 1}`}
                              className={styles.galleryImg}
                            />
                            {photo.isPrimary && (
                              <div className={styles.primaryBadge}>
                                <Star size={12} fill="#ffffff" /> Primary Photo
                              </div>
                            )}
                            <span className={styles.gallerySlotNumber}>
                              Photo {slotIdx + 1} of 3
                            </span>
                          </div>

                          <div className={styles.galleryActions}>
                            {!photo.isPrimary ? (
                              <button
                                type="button"
                                className={styles.btnSlotPrimary}
                                onClick={() => handleSetPrimaryGalleryPhoto(photo._id)}
                                disabled={photoActionLoading}
                              >
                                {photoSlotAction === `primary-${photo._id}` ? (
                                  <span
                                    className={styles.spinner}
                                    style={{
                                      borderColor: 'var(--rose-deep)',
                                      borderTopColor: 'transparent',
                                      width: 14,
                                      height: 14,
                                    }}
                                  />
                                ) : (
                                  <Star size={13} />
                                )}
                                Set as Primary
                              </button>
                            ) : (
                              <div
                                className={`${styles.btnSlotPrimary} ${styles.btnSlotPrimaryActive}`}
                              >
                                <Check size={13} /> Main Profile Photo
                              </div>
                            )}

                            <div className={styles.galleryActionRow}>
                              <button
                                type="button"
                                className={styles.btnSlotReplace}
                                onClick={() =>
                                  replaceInputRefs.current[photo._id]?.click()
                                }
                                disabled={photoActionLoading}
                              >
                                {photoSlotAction === `replace-${photo._id}` ? (
                                  <span
                                    className={styles.spinner}
                                    style={{
                                      borderColor: 'var(--plum)',
                                      borderTopColor: 'transparent',
                                      width: 14,
                                      height: 14,
                                    }}
                                  />
                                ) : (
                                  <Upload size={13} />
                                )}
                                Replace
                              </button>
                              <button
                                type="button"
                                className={styles.btnSlotDelete}
                                onClick={() => handleDeleteGalleryPhoto(photo._id)}
                                disabled={photoActionLoading}
                                title="Delete this photo"
                              >
                                {photoSlotAction === `delete-${photo._id}` ? (
                                  <span
                                    className={styles.spinner}
                                    style={{
                                      borderColor: '#b91c1c',
                                      borderTopColor: 'transparent',
                                      width: 14,
                                      height: 14,
                                    }}
                                  />
                                ) : (
                                  <Trash2 size={13} />
                                )}
                                Delete
                              </button>
                            </div>

                            <input
                              ref={(el) => {
                                if (photo._id) {
                                  replaceInputRefs.current[photo._id] = el;
                                }
                              }}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/jpg"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleReplaceGalleryPhoto(photo._id, file);
                                e.target.value = '';
                              }}
                            />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={`empty-slot-${slotIdx}`}
                        type="button"
                        className={styles.galleryEmptySlot}
                        onClick={() => galleryInputRef.current?.click()}
                        disabled={photoActionLoading}
                      >
                        <div className={styles.galleryEmptyIcon}>
                          {photoActionLoading && photoSlotAction === 'upload' ? (
                            <span
                              className={styles.spinner}
                              style={{
                                borderColor: 'var(--rose-deep)',
                                borderTopColor: 'transparent',
                                width: 22,
                                height: 22,
                              }}
                            />
                          ) : (
                            <Plus size={24} />
                          )}
                        </div>
                        <div>
                          <p className={styles.galleryEmptyTitle}>+ Add Photo {slotIdx + 1}</p>
                          <p className={styles.galleryEmptySubtitle}>
                            Click to upload portrait (Max 5 MB)
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  style={{ display: 'none' }}
                  onChange={handleAddGalleryPhoto}
                />

                <div className={styles.galleryGuidelinesBox}>
                  <Sparkles size={20} color="var(--gold-dark)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div className={styles.photoControls}>
                    <h4 className={styles.photoGuidelinesTitle}>Matrimonial Portrait Guidelines</h4>
                    <ul className={styles.galleryGuidelinesList}>
                      <li>Upload up to 3 recent, clear, color photographs.</li>
                      <li>We recommend: 1 frontal close-up, 1 traditional attire, and 1 full-length photograph.</li>
                      <li>The portrait selected as Primary will appear in browse searches and member listings.</li>
                      <li>Supported file formats: JPG, PNG, WEBP (Max 5 MB per photo).</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* -------------------- IN-FLOW SAVE ACTION CARD -------------------- */}
            <div className={styles.saveActionCard}>
              <div className={styles.saveCardStatus}>
                <span className={styles.saveBadge}>
                  {completionPercentage === 100 ? (
                    <>
                      <CheckCircle2 size={15} /> Profile Complete (100%)
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} /> {completionPercentage}% Complete
                    </>
                  )}
                </span>
                <span className={styles.saveNote}>
                  Review your particulars and click Save Changes to persist your biodata.
                </span>
              </div>

              <div className={styles.saveBtnGroup}>
                {profileId && (
                  <Link href={`/members/${profileId}`} className={styles.btnPreviewCard}>
                    <Eye size={15} /> Preview Public Card
                  </Link>
                )}
                <button
                  type="submit"
                  className={styles.btnPrimarySave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className={styles.spinner} /> Saving Changes...
                    </>
                  ) : (
                    <>Save Profile Changes</>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
