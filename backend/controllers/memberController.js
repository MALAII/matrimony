const mongoose = require('mongoose');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const ContactUnlock = require('../models/ContactUnlock');
const {
  checkUserDirectoryAccess,
  getExpiredBeyondGraceOwnerIds,
} = require('../services/subscriptionAccessService');
const {
  getOrCreateCurrentCreditCycle,
  formatCreditCycleDTO,
} = require('../services/creditCycleService');
const {
  unlockCandidateContact,
  getViewerCreditBalance,
} = require('../services/contactUnlockService');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const MAX_SEARCH_LENGTH = 100;

/**
 * Explicit MongoDB projection excluding private contact fields (candidatePhone, candidateEmail),
 * internal Cloudinary publicId, and audit fields. User is never populated.
 */
const DIRECTORY_DB_PROJECTION =
  '_id user source approvalStatus profileStatus candidateName personalDetails communityDetails educationAndProfession familyDetails partnerPreferences profilePhoto.url photos.url photos.isPrimary horoscope createdAt';

/**
 * Vedic Rasi bilingual synonym dictionary covering Tamil, Sanskrit, and English representations.
 */
const RASI_SYNONYMS = {
  mesham: ['mesham', 'mesha', 'aries', 'மேஷம்'],
  rishabam: ['rishabam', 'vrishabha', 'vrishabh', 'rishaba', 'taurus', 'ரிஷபம்'],
  mithunam: ['mithunam', 'mithuna', 'gemini', 'மிதுனம்'],
  kadagam: ['kadagam', 'karkataka', 'karka', 'cancer', 'கடகம்'],
  simmam: ['simmam', 'simha', 'leo', 'சிம்மம்'],
  kanni: ['kanni', 'kanya', 'virgo', 'கன்னி'],
  thulaam: ['thulaam', 'thulam', 'tula', 'libra', 'துலாம்'],
  viruchigam: ['viruchigam', 'vrischika', 'vrischikam', 'scorpio', 'விருச்சிகம்'],
  dhanusu: ['dhanusu', 'dhanu', 'sagittarius', 'தனுசு'],
  magaram: ['magaram', 'makaram', 'makara', 'capricorn', 'மகரம்'],
  kumbam: ['kumbam', 'kumbha', 'aquarius', 'கும்பம்'],
  meenam: ['meenam', 'meena', 'pisces', 'மீனம்'],
};

/**
 * Vedic Nakshatram (27 Birth Stars) bilingual synonym dictionary covering Tamil, Sanskrit, and English representations.
 */
const NAKSHATRAM_SYNONYMS = {
  ashwini: ['ashwini', 'aswini', 'aswathi', 'அஸ்வினி', 'அசுவினி'],
  bharani: ['bharani', 'பரணி'],
  krittika: ['krittika', 'krithika', 'karthigai', 'கார்த்திகை'],
  rohini: ['rohini', 'ரோஹிணி', 'ரோகிணி'],
  mrigashirsha: ['mrigashirsha', 'mrigashira', 'mirugasiridam', 'மிருகசீரிஷம்', 'மிருகசீரிடம்'],
  ardra: ['ardra', 'thiruvathirai', 'thiruvaathirai', 'திருவாதிரை'],
  punarvasu: ['punarvasu', 'punarpusam', 'புனர்பூசம்'],
  pushya: ['pushya', 'poosam', 'பூசம்'],
  ashlesha: ['ashlesha', 'ayilyam', 'ஆயில்யம்'],
  magha: ['magha', 'makam', 'மகம்'],
  purva_phalguni: ['purva phalguni', 'pooram', 'பூரம்'],
  uttara_phalguni: ['uttara phalguni', 'uthiram', 'உத்திரம்'],
  hasta: ['hasta', 'hastham', 'ஹஸ்தம்', 'அஸ்தம்'],
  chitra: ['chitra', 'chithirai', 'சித்திரை'],
  swati: ['swati', 'swathi', 'சுவாதி'],
  vishakha: ['vishakha', 'visakam', 'விசாகம்'],
  anuradha: ['anuradha', 'anusham', 'அனுஷம்'],
  jyeshtha: ['jyeshtha', 'kettai', 'கேட்டை'],
  mula: ['mula', 'moolam', 'மூலம்'],
  purva_ashadha: ['purva ashadha', 'pooradam', 'பூராடம்'],
  uttara_ashadha: ['uttara ashadha', 'uthiradam', 'உத்திராடம்'],
  shravana: ['shravana', 'thiruvonam', 'திருவோணம்'],
  dhanishta: ['dhanishta', 'avittam', 'அவிட்டம்'],
  shatabhisha: ['shatabhisha', 'sadayam', 'சதயம்'],
  purva_bhadrapada: ['purva bhadrapada', 'poorattathi', 'பூரட்டாதி'],
  uttara_bhadrapada: ['uttara bhadrapada', 'uthirattathi', 'உத்திரட்டாதி'],
  revati: ['revati', 'revathi', 'ரேவதி'],
};

/**
 * Escapes regex special characters to prevent ReDoS or regex injection.
 * @param {string} str
 * @returns {string}
 */
const escapeRegex = (str) => {
  return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

/**
 * Calculates age in completed years from a Date of Birth.
 * @param {Date|string|null} dobValue
 * @returns {number|null}
 */
const calculateAgeFromDob = (dobValue) => {
  if (!dobValue) return null;
  const dob = dobValue instanceof Date ? dobValue : new Date(dobValue);
  if (Number.isNaN(dob.getTime())) return null;
  const diffMs = Date.now() - dob.getTime();
  if (diffMs < 0) return null;
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

/**
 * Validates and normalizes pagination, search, and structured filter query parameters for GET /api/members.
 *
 * @param {object} query
 * @returns {{
 *   page?: number,
 *   limit?: number,
 *   search?: string,
 *   gender?: string,
 *   minAge?: number | null,
 *   maxAge?: number | null,
 *   maritalStatus?: string,
 *   location?: string,
 *   education?: string,
 *   occupation?: string,
 *   error?: string
 * }}
 */
const parseMemberDirectoryParams = (query = {}) => {
  const rawPage = query.page !== undefined ? query.page : String(DEFAULT_PAGE);
  const rawLimit = query.limit !== undefined ? query.limit : String(DEFAULT_LIMIT);
  const rawSearch = query.search !== undefined ? query.search : '';
  const rawGender = query.gender !== undefined ? query.gender : '';
  const rawMinAge = query.minAge !== undefined ? query.minAge : '';
  const rawMaxAge = query.maxAge !== undefined ? query.maxAge : '';
  const rawMaritalStatus = query.maritalStatus !== undefined ? query.maritalStatus : '';
  const rawLocation = query.location !== undefined ? query.location : '';
  const rawEducation = query.education !== undefined ? query.education : '';
  const rawOccupation = query.occupation !== undefined ? query.occupation : '';
  const rawRasi = query.rasi !== undefined ? query.rasi : '';
  const rawNakshatram = query.nakshatram !== undefined ? query.nakshatram : '';
  const rawCaste = query.caste !== undefined ? query.caste : '';
  const rawSubcaste = query.subcaste !== undefined ? query.subcaste : '';
  const rawGothram = query.gothram !== undefined ? query.gothram : '';
  const rawReligion = query.religion !== undefined ? query.religion : '';
  const rawMinHeight = query.minHeight !== undefined ? query.minHeight : '';
  const rawMaxHeight = query.maxHeight !== undefined ? query.maxHeight : '';
  const rawDiet = query.diet !== undefined ? query.diet : '';
  const rawDosham = query.dosham !== undefined ? query.dosham : '';

  // 1. Validate page
  const pageStr = typeof rawPage === 'number' ? String(rawPage) : rawPage;
  if (typeof pageStr !== 'string' || !/^\d+$/.test(pageStr.trim())) {
    return { error: 'Invalid page parameter: page must be a positive integer.' };
  }
  const page = parseInt(pageStr.trim(), 10);
  if (page < 1) {
    return { error: 'Invalid page parameter: page must be at least 1.' };
  }

  // 2. Validate limit (bounded between 1 and MAX_LIMIT = 50)
  const limitStr = typeof rawLimit === 'number' ? String(rawLimit) : rawLimit;
  if (typeof limitStr !== 'string' || !/^\d+$/.test(limitStr.trim())) {
    return { error: 'Invalid limit parameter: limit must be a positive integer.' };
  }
  const limit = parseInt(limitStr.trim(), 10);
  if (limit < 1 || limit > MAX_LIMIT) {
    return {
      error: `Invalid limit parameter: limit must be an integer between 1 and ${MAX_LIMIT}.`,
    };
  }

  // 3. Validate search text
  if (typeof rawSearch !== 'string') {
    return { error: 'Invalid search parameter: search query must be a string.' };
  }
  const search = rawSearch.trim();
  if (search.length > MAX_SEARCH_LENGTH) {
    return {
      error: `Search parameter cannot exceed ${MAX_SEARCH_LENGTH} characters.`,
    };
  }

  // 4. Validate gender filter
  let gender = '';
  if (rawGender !== undefined && rawGender !== null && String(rawGender).trim().length > 0) {
    const trimmedGender = String(rawGender).trim();
    const validGenders = ['Male', 'Female', 'Other'];
    const matchedGender = validGenders.find(
      (g) => g.toLowerCase() === trimmedGender.toLowerCase()
    );
    if (!matchedGender) {
      return { error: 'Invalid gender filter: must be Male, Female, or Other.' };
    }
    gender = matchedGender;
  }

  // 5. Validate minAge and maxAge filters
  let minAge = null;
  if (rawMinAge !== undefined && rawMinAge !== null && String(rawMinAge).trim().length > 0) {
    const minAgeStr = String(rawMinAge).trim();
    if (!/^\d+$/.test(minAgeStr)) {
      return { error: 'Invalid minAge parameter: must be a positive integer.' };
    }
    minAge = parseInt(minAgeStr, 10);
    if (minAge < 18 || minAge > 100) {
      return { error: 'Invalid minAge parameter: must be between 18 and 100.' };
    }
  }

  let maxAge = null;
  if (rawMaxAge !== undefined && rawMaxAge !== null && String(rawMaxAge).trim().length > 0) {
    const maxAgeStr = String(rawMaxAge).trim();
    if (!/^\d+$/.test(maxAgeStr)) {
      return { error: 'Invalid maxAge parameter: must be a positive integer.' };
    }
    maxAge = parseInt(maxAgeStr, 10);
    if (maxAge < 18 || maxAge > 100) {
      return { error: 'Invalid maxAge parameter: must be between 18 and 100.' };
    }
  }

  if (minAge !== null && maxAge !== null && minAge > maxAge) {
    return { error: 'Invalid age range: minAge cannot be greater than maxAge.' };
  }

  // 6. Validate maritalStatus filter
  let maritalStatus = '';
  if (rawMaritalStatus !== undefined && rawMaritalStatus !== null && String(rawMaritalStatus).trim().length > 0) {
    const trimmedStatus = String(rawMaritalStatus).trim();
    const validStatuses = ['Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce'];
    const matchedStatus = validStatuses.find(
      (s) => s.toLowerCase() === trimmedStatus.toLowerCase()
    );
    if (!matchedStatus) {
      return {
        error:
          'Invalid maritalStatus filter: must be Never Married, Divorced, Widowed, or Awaiting Divorce.',
      };
    }
    maritalStatus = matchedStatus;
  }

  // 7. Validate location filter
  let location = '';
  if (rawLocation !== undefined && rawLocation !== null) {
    if (typeof rawLocation !== 'string') {
      return { error: 'Invalid location parameter: location filter must be a string.' };
    }
    location = rawLocation.trim();
    if (location.length > MAX_SEARCH_LENGTH) {
      return {
        error: `Location filter cannot exceed ${MAX_SEARCH_LENGTH} characters.`,
      };
    }
  }

  // 8. Validate education filter
  let education = '';
  if (rawEducation !== undefined && rawEducation !== null) {
    if (typeof rawEducation !== 'string') {
      return { error: 'Invalid education parameter: education filter must be a string.' };
    }
    education = rawEducation.trim();
    if (education.length > MAX_SEARCH_LENGTH) {
      return {
        error: `Education filter cannot exceed ${MAX_SEARCH_LENGTH} characters.`,
      };
    }
  }

  // 9. Validate occupation filter
  let occupation = '';
  if (rawOccupation !== undefined && rawOccupation !== null) {
    if (typeof rawOccupation !== 'string') {
      return { error: 'Invalid occupation parameter: occupation filter must be a string.' };
    }
    occupation = rawOccupation.trim();
    if (occupation.length > MAX_SEARCH_LENGTH) {
      return {
        error: `Occupation filter cannot exceed ${MAX_SEARCH_LENGTH} characters.`,
      };
    }
  }

  // 10. Validate rasi filter
  let rasi = '';
  if (rawRasi !== undefined && rawRasi !== null && String(rawRasi).trim().length > 0) {
    rasi = String(rawRasi).trim();
    if (rasi.length > MAX_SEARCH_LENGTH) {
      return { error: `Rasi filter cannot exceed ${MAX_SEARCH_LENGTH} characters.` };
    }
  }

  // 11. Validate nakshatram filter
  let nakshatram = '';
  if (rawNakshatram !== undefined && rawNakshatram !== null && String(rawNakshatram).trim().length > 0) {
    nakshatram = String(rawNakshatram).trim();
    if (nakshatram.length > MAX_SEARCH_LENGTH) {
      return { error: `Nakshatram filter cannot exceed ${MAX_SEARCH_LENGTH} characters.` };
    }
  }

  // 12. Validate community filters (caste, subcaste, gothram, religion)
  let caste = '';
  if (rawCaste !== undefined && rawCaste !== null && String(rawCaste).trim().length > 0) {
    caste = String(rawCaste).trim();
    if (caste.length > MAX_SEARCH_LENGTH) {
      return { error: `Caste filter cannot exceed ${MAX_SEARCH_LENGTH} characters.` };
    }
  }

  let subcaste = '';
  if (rawSubcaste !== undefined && rawSubcaste !== null && String(rawSubcaste).trim().length > 0) {
    subcaste = String(rawSubcaste).trim();
    if (subcaste.length > MAX_SEARCH_LENGTH) {
      return { error: `Subcaste filter cannot exceed ${MAX_SEARCH_LENGTH} characters.` };
    }
  }

  let gothram = '';
  if (rawGothram !== undefined && rawGothram !== null && String(rawGothram).trim().length > 0) {
    gothram = String(rawGothram).trim();
    if (gothram.length > MAX_SEARCH_LENGTH) {
      return { error: `Gothram filter cannot exceed ${MAX_SEARCH_LENGTH} characters.` };
    }
  }

  let religion = '';
  if (rawReligion !== undefined && rawReligion !== null && String(rawReligion).trim().length > 0) {
    religion = String(rawReligion).trim();
    if (religion.length > MAX_SEARCH_LENGTH) {
      return { error: `Religion filter cannot exceed ${MAX_SEARCH_LENGTH} characters.` };
    }
  }

  // 13. Validate minHeight and maxHeight filters (in cm)
  let minHeight = null;
  if (rawMinHeight !== undefined && rawMinHeight !== null && String(rawMinHeight).trim().length > 0) {
    const minHeightStr = String(rawMinHeight).trim();
    if (!/^\d+$/.test(minHeightStr)) {
      return { error: 'Invalid minHeight parameter: must be a positive integer.' };
    }
    minHeight = parseInt(minHeightStr, 10);
    if (minHeight < 100 || minHeight > 250) {
      return { error: 'Invalid minHeight parameter: must be between 100 and 250 cm.' };
    }
  }

  let maxHeight = null;
  if (rawMaxHeight !== undefined && rawMaxHeight !== null && String(rawMaxHeight).trim().length > 0) {
    const maxHeightStr = String(rawMaxHeight).trim();
    if (!/^\d+$/.test(maxHeightStr)) {
      return { error: 'Invalid maxHeight parameter: must be a positive integer.' };
    }
    maxHeight = parseInt(maxHeightStr, 10);
    if (maxHeight < 100 || maxHeight > 250) {
      return { error: 'Invalid maxHeight parameter: must be between 100 and 250 cm.' };
    }
  }

  if (minHeight !== null && maxHeight !== null && minHeight > maxHeight) {
    return { error: 'Invalid height range: minHeight cannot exceed maxHeight.' };
  }

  // 14. Validate diet filter
  let diet = '';
  if (rawDiet !== undefined && rawDiet !== null && String(rawDiet).trim().length > 0) {
    diet = String(rawDiet).trim();
    if (diet.length > MAX_SEARCH_LENGTH) {
      return { error: `Diet filter cannot exceed ${MAX_SEARCH_LENGTH} characters.` };
    }
  }

  // 15. Validate dosham filter (e.g., 'no_dosham', 'chevvai', 'rahu_ketu')
  let dosham = '';
  if (rawDosham !== undefined && rawDosham !== null && String(rawDosham).trim().length > 0) {
    dosham = String(rawDosham).trim().toLowerCase();
    if (dosham.length > MAX_SEARCH_LENGTH) {
      return { error: `Dosham filter cannot exceed ${MAX_SEARCH_LENGTH} characters.` };
    }
  }

  return {
    page,
    limit,
    search,
    gender,
    minAge,
    maxAge,
    minHeight,
    maxHeight,
    maritalStatus,
    location,
    education,
    occupation,
    rasi,
    nakshatram,
    caste,
    subcaste,
    gothram,
    religion,
    diet,
    dosham,
  };
};

/**
 * Defense-in-depth eligibility predicate for a matrimonial profile in the member directory.
 *
 * Rules:
 * 1. `profileStatus` must be strictly `'active'`.
 * 2. Must not belong to the currently authenticated member (`profile.user !== currentUserId`).
 * 3. Account-linked profile owners whose subscriptions have expired beyond the 7-day grace period
 *    without renewal are excluded even if their `profileStatus` is still `'active'` (API-side expiry enforcement).
 *    Unlinked broker profiles (`user: null`) and unpaid users who never had a subscription are unaffected.
 * 4. Either:
 *    - `source === 'direct'` (direct self-registered profiles do not require admin approval), OR
 *    - `source === 'broker'` AND `approvalStatus === 'approved'` (including when `user` is null).
 * 5. Profiles with missing/unknown source or status are excluded.
 *
 * @param {object} profile
 * @param {string|import('mongoose').Types.ObjectId} currentUserId
 * @param {Set<string>} [expiredOwnerIdSet]
 * @returns {boolean}
 */
const isProfileEligibleForDirectory = (
  profile,
  currentUserId,
  expiredOwnerIdSet = new Set()
) => {
  if (!profile || typeof profile !== 'object') return false;
  if (profile.profileStatus !== 'active') return false;

  if (profile.user) {
    const profileUserId = profile.user._id ? String(profile.user._id) : String(profile.user);
    if (currentUserId && profileUserId === String(currentUserId)) {
      return false;
    }
    if (expiredOwnerIdSet && expiredOwnerIdSet.has(profileUserId)) {
      return false;
    }
  }

  if (profile.source === 'direct') {
    return true;
  }

  if (profile.source === 'broker' && profile.approvalStatus === 'approved') {
    return true;
  }

  return false;
};

/**
 * Builds the MongoDB filter for the member directory query.
 * Combines eligibility constraints, keyword search, and structured filters (gender, age, marital status, location, education, occupation).
 *
 * @param {{
 *   currentUserId: any,
 *   search?: string,
 *   gender?: string,
 *   minAge?: number | null,
 *   maxAge?: number | null,
 *   maritalStatus?: string,
 *   location?: string,
 *   education?: string,
 *   occupation?: string,
 *   expiredOwnerIds?: Array
 * }} params
 * @returns {object}
 */
const buildMemberDirectoryFilter = ({
  currentUserId,
  search = '',
  gender = '',
  minAge = null,
  maxAge = null,
  minHeight = null,
  maxHeight = null,
  maritalStatus = '',
  location = '',
  education = '',
  occupation = '',
  rasi = '',
  nakshatram = '',
  caste = '',
  subcaste = '',
  gothram = '',
  religion = '',
  diet = '',
  dosham = '',
  expiredOwnerIds = [],
}) => {
  const userExclusion =
    Array.isArray(expiredOwnerIds) && expiredOwnerIds.length > 0
      ? { $nin: [currentUserId, ...expiredOwnerIds] }
      : { $ne: currentUserId };

  const eligibilityFilter = {
    profileStatus: 'active',
    user: userExclusion,
    $or: [
      { source: 'direct' },
      { source: 'broker', approvalStatus: 'approved' },
    ],
  };

  const andClauses = [eligibilityFilter];

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), 'i');
    andClauses.push({
      $or: [
        { candidateName: searchRegex },
        { 'personalDetails.location': searchRegex },
        { 'personalDetails.nativity': searchRegex },
        { 'personalDetails.placeOfBirth': searchRegex },
        { 'personalDetails.motherTongue': searchRegex },
        { 'personalDetails.maritalStatus': searchRegex },
        { 'communityDetails.religion': searchRegex },
        { 'communityDetails.caste': searchRegex },
        { 'communityDetails.subcaste': searchRegex },
        { 'communityDetails.gothram': searchRegex },
        { 'educationAndProfession.educationalQualification': searchRegex },
        { 'educationAndProfession.occupation': searchRegex },
        { 'educationAndProfession.company': searchRegex },
        { 'educationAndProfession.workLocation': searchRegex },
        { 'familyDetails.familyLocation': searchRegex },
      ],
    });
  }

  if (gender) {
    andClauses.push({ 'personalDetails.gender': gender });
  }

  if (maritalStatus) {
    andClauses.push({ 'personalDetails.maritalStatus': maritalStatus });
  }

  if (location) {
    const locRegex = new RegExp(escapeRegex(location), 'i');
    andClauses.push({
      $or: [
        { 'personalDetails.location': locRegex },
        { 'personalDetails.nativity': locRegex },
        { 'personalDetails.placeOfBirth': locRegex },
        { 'familyDetails.familyLocation': locRegex },
      ],
    });
  }

  if (education) {
    andClauses.push({
      'educationAndProfession.educationalQualification': new RegExp(escapeRegex(education), 'i'),
    });
  }

  if (occupation) {
    andClauses.push({
      'educationAndProfession.occupation': new RegExp(escapeRegex(occupation), 'i'),
    });
  }

  if (rasi) {
    const rasiLower = rasi.toLowerCase();
    let matchedRasiGroup = null;
    for (const synonyms of Object.values(RASI_SYNONYMS)) {
      if (synonyms.some((s) => rasiLower.includes(s.toLowerCase()))) {
        matchedRasiGroup = synonyms;
        break;
      }
    }
    if (matchedRasiGroup && matchedRasiGroup.length > 0) {
      const pattern = matchedRasiGroup.map((s) => escapeRegex(s)).join('|');
      andClauses.push({
        'horoscope.rasi': new RegExp(pattern, 'i'),
      });
    } else {
      const rasiBase = rasi.split('(')[0].trim();
      andClauses.push({
        'horoscope.rasi': new RegExp(escapeRegex(rasiBase), 'i'),
      });
    }
  }

  if (nakshatram) {
    const nakLower = nakshatram.toLowerCase();
    let matchedNakGroup = null;
    for (const synonyms of Object.values(NAKSHATRAM_SYNONYMS)) {
      if (synonyms.some((s) => nakLower.includes(s.toLowerCase()))) {
        matchedNakGroup = synonyms;
        break;
      }
    }
    if (matchedNakGroup && matchedNakGroup.length > 0) {
      const pattern = matchedNakGroup.map((s) => escapeRegex(s)).join('|');
      andClauses.push({
        'horoscope.nakshatram': new RegExp(pattern, 'i'),
      });
    } else {
      const nakshatramBase = nakshatram.split('/')[0].trim().split(' ')[0];
      andClauses.push({
        'horoscope.nakshatram': new RegExp(escapeRegex(nakshatramBase), 'i'),
      });
    }
  }

  if (caste) {
    andClauses.push({
      'communityDetails.caste': new RegExp(escapeRegex(caste), 'i'),
    });
  }

  if (subcaste) {
    andClauses.push({
      'communityDetails.subcaste': new RegExp(escapeRegex(subcaste), 'i'),
    });
  }

  if (gothram) {
    andClauses.push({
      'communityDetails.gothram': new RegExp(escapeRegex(gothram), 'i'),
    });
  }

  if (religion) {
    andClauses.push({
      'communityDetails.religion': new RegExp(escapeRegex(religion), 'i'),
    });
  }

  if (diet) {
    andClauses.push({
      'personalDetails.diet': new RegExp(`^${escapeRegex(diet)}$`, 'i'),
    });
  }

  if (dosham) {
    if (dosham === 'no_dosham' || dosham === 'none' || dosham === 'no') {
      andClauses.push({
        $or: [
          { 'horoscope.dosham.hasChevvaiDosham': { $in: [false, null] } },
          { 'horoscope.dosham.doshamSummary': { $regex: /^(none|no|dosham free)$/i } },
          { 'horoscope.dosham': null },
        ],
      });
    } else if (dosham === 'chevvai' || dosham === 'chevvai_dosham') {
      andClauses.push({
        $or: [
          { 'horoscope.dosham.hasChevvaiDosham': true },
          { 'horoscope.dosham.doshamSummary': { $regex: /chevvai|sevvai|mars/i } },
        ],
      });
    } else if (dosham === 'rahu_ketu' || dosham === 'naga') {
      andClauses.push({
        $or: [
          { 'horoscope.dosham.hasNagaDosham': true },
          { 'horoscope.dosham.doshamSummary': { $regex: /rahu|ketu|naga|sarpa/i } },
        ],
      });
    }
  }

  if (minHeight !== null || maxHeight !== null) {
    const heightQuery = {};
    if (minHeight !== null) {
      heightQuery.$gte = minHeight;
    }
    if (maxHeight !== null) {
      heightQuery.$lte = maxHeight;
    }
    andClauses.push({ 'personalDetails.height': heightQuery });
  }

  if (minAge !== null || maxAge !== null) {
    const now = new Date();
    const dobQuery = {};
    if (minAge !== null) {
      // Age >= minAge: born on or before (now - minAge years)
      const maxDob = new Date(
        now.getFullYear() - minAge,
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      );
      dobQuery.$lte = maxDob;
    }
    if (maxAge !== null) {
      // Age <= maxAge: born on or after (now - (maxAge + 1) years + 1 day)
      const minDob = new Date(
        now.getFullYear() - (maxAge + 1),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        0
      );
      dobQuery.$gte = minDob;
    }
    andClauses.push({ 'personalDetails.dateOfBirth': dobQuery });
  }

  if (andClauses.length === 1) {
    return eligibilityFilter;
  }

  return {
    $and: andClauses,
  };
};

/**
 * Explicit allowlist DTO mapper for member directory profile cards.
 *
 * Strictly strips and never exposes:
 * - `candidatePhone`
 * - `candidateEmail`
 * - `user` / `user.email` / `user.password` / `user.role`
 * - `approvedBy`, `approvedAt`, `approvalStatus`, `profileStatus`, `deactivationReason`, `deactivatedAt`
 * - `profilePhoto.publicId`
 * - Any authentication, invitation, payment, or subscription fields
 *
 * Safe Name Resolution:
 * 1. Explicit `candidateName` on the profile document (for broker profiles).
 * 2. If null, safely uses `user.name` when populated (for direct self-registered members).
 * 3. Never returns or leaks any private User fields.
 *
 * @param {object} profileDoc
 * @param {{ isContactUnlocked?: boolean }} [options]
 * @returns {object}
 */
const toMemberDirectoryDTO = (profileDoc, { isContactUnlocked = false } = {}) => {
  const raw =
    profileDoc && typeof profileDoc.toObject === 'function'
      ? profileDoc.toObject()
      : profileDoc || {};

  const personal = raw.personalDetails || {};
  const community = raw.communityDetails || {};
  const edu = raw.educationAndProfession || {};
  const family = raw.familyDetails || {};
  const prefs = raw.partnerPreferences || {};
  const ageRange = prefs.preferredAgeRange || {};

  const photoUrl =
    typeof raw.profilePhoto?.url === 'string' && raw.profilePhoto.url.trim().length > 0
      ? raw.profilePhoto.url.trim()
      : null;

  // Derive candidate display name safely without exposing user object
  const rawUser = raw.user && typeof raw.user === 'object' ? raw.user : null;
  const rawUserName =
    typeof rawUser?.name === 'string' && rawUser.name.trim().length > 0
      ? rawUser.name.trim()
      : null;
  const rawCandidateName =
    typeof raw.candidateName === 'string' && raw.candidateName.trim().length > 0
      ? raw.candidateName.trim()
      : null;

  const candidateName = rawCandidateName || rawUserName || null;

  return {
    id: raw._id ? String(raw._id) : null,
    source: raw.source === 'broker' ? 'broker' : 'direct',
    candidateName,
    personalDetails: {
      gender: personal.gender || null,
      dateOfBirth: personal.dateOfBirth || null,
      age: calculateAgeFromDob(personal.dateOfBirth),
      height: typeof personal.height === 'number' ? personal.height : null,
      weight: typeof personal.weight === 'number' ? personal.weight : null,
      bloodGroup: personal.bloodGroup || null,
      complexion: personal.complexion || null,
      diet: personal.diet || null,
      physicalStatus: personal.physicalStatus || null,
      maritalStatus: personal.maritalStatus || null,
      motherTongue: personal.motherTongue || null,
      nativity: personal.nativity || null,
      placeOfBirth: personal.placeOfBirth || null,
      timeOfBirth: personal.timeOfBirth || null,
      location: personal.location || null,
    },
    communityDetails: {
      religion: community.religion || null,
      caste: community.caste || null,
      subcaste: community.subcaste || null,
      gothram: community.gothram || null,
    },
    educationAndProfession: {
      educationalQualification: edu.educationalQualification || null,
      occupation: edu.occupation || null,
      company: edu.company || null,
      workLocation: edu.workLocation || null,
      income: edu.income || null,
    },
    familyDetails: {
      fatherName: family.fatherName || null,
      fatherAlive: family.fatherAlive || null,
      fatherOccupation: family.fatherOccupation || null,
      motherName: family.motherName || null,
      motherAlive: family.motherAlive || null,
      motherOccupation: family.motherOccupation || null,
      marriedElderBrothers: family.marriedElderBrothers ?? 0,
      unmarriedElderBrothers: family.unmarriedElderBrothers ?? 0,
      marriedYoungerBrothers: family.marriedYoungerBrothers ?? 0,
      unmarriedYoungerBrothers: family.unmarriedYoungerBrothers ?? 0,
      marriedElderSisters: family.marriedElderSisters ?? 0,
      unmarriedElderSisters: family.unmarriedElderSisters ?? 0,
      marriedYoungerSisters: family.marriedYoungerSisters ?? 0,
      unmarriedYoungerSisters: family.unmarriedYoungerSisters ?? 0,
      familyInformation: family.familyInformation || null,
      parentInformation: family.parentInformation || null,
      siblingInformation: family.siblingInformation || null,
      familyLocation: family.familyLocation || null,
    },
    partnerPreferences: {
      preferredAgeRange: {
        min: typeof ageRange.min === 'number' ? ageRange.min : null,
        max: typeof ageRange.max === 'number' ? ageRange.max : null,
      },
      maritalStatusPreference: Array.isArray(prefs.maritalStatusPreference) ? prefs.maritalStatusPreference : [],
      dietPreference: Array.isArray(prefs.dietPreference) ? prefs.dietPreference : [],
      jobRequirement: prefs.jobRequirement || null,
      horoscopeRequired: prefs.horoscopeRequired || null,
      educationPreference: prefs.educationPreference || null,
      occupationPreference: prefs.occupationPreference || null,
      preferredLocation: prefs.preferredLocation || null,
      castePreference: prefs.castePreference || null,
      subcastePreference: prefs.subcastePreference || null,
      incomePreference: prefs.incomePreference || null,
      otherPreferences: prefs.otherPreferences || null,
    },
    profilePhotoUrl: photoUrl,
    photos: Array.isArray(raw.photos)
      ? raw.photos
          .filter((ph) => ph && typeof ph.url === 'string' && ph.url.trim().length > 0)
          .map((ph) => ({
            _id: ph._id ? String(ph._id) : undefined,
            url: ph.url.trim(),
            isPrimary: Boolean(ph.isPrimary),
          }))
      : (photoUrl ? [{ url: photoUrl, isPrimary: true }] : []),
    horoscope: raw.horoscope ? {
      isGenerated: Boolean(raw.horoscope.isGenerated),
      isSimulated: Boolean(raw.horoscope.isSimulated),
      timeOfBirth: raw.horoscope.timeOfBirth || null,
      placeOfBirth: raw.horoscope.placeOfBirth || null,
      rasi: raw.horoscope.rasi || null,
      nakshatram: raw.horoscope.nakshatram || null,
      padam: raw.horoscope.padam || null,
      lagnam: raw.horoscope.lagnam || null,
      dosham: typeof raw.horoscope.dosham === 'object'
        ? raw.horoscope.dosham?.doshamSummary || 'None'
        : (raw.horoscope.dosham || 'None'),
      dasaBalance: typeof raw.horoscope.dasaBalance === 'object' && raw.horoscope.dasaBalance?.planet
        ? `${raw.horoscope.dasaBalance.planet} Dasa (${raw.horoscope.dasaBalance.years || 0}y ${raw.horoscope.dasaBalance.months || 0}m ${raw.horoscope.dasaBalance.days || 0}d)`
        : (typeof raw.horoscope.dasaBalance === 'string' ? raw.horoscope.dasaBalance : null),
      rasiChartSvg: raw.horoscope.rasiChartSvg || null,
      navamsaChartSvg: raw.horoscope.navamsaChartSvg || null,
      rasiChartBoxes: Array.isArray(raw.horoscope.rasiChartBoxes) ? raw.horoscope.rasiChartBoxes : [],
      navamsaChartBoxes: Array.isArray(raw.horoscope.navamsaChartBoxes) ? raw.horoscope.navamsaChartBoxes : [],
      attribution: raw.horoscope.attribution || null,
    } : null,
    contactLocked: true,
    isContactUnlocked: Boolean(isContactUnlocked),
    createdAt: raw.createdAt || null,
  };
};

/**
 * @route   GET /api/members
 * @desc    Browse eligible matrimonial profiles with search, pagination, API-side expiry filtering,
 *          current credit-cycle summary, and strict privacy DTO
 * @access  Private (Authenticated active user with active or grace-period subscription)
 */
const getMemberDirectory = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, authentication required.',
      });
    }

    // 1. Validate query parameters before hitting the database
    const parsedParams = parseMemberDirectoryParams(req.query);
    if (parsedParams.error) {
      return res.status(400).json({
        success: false,
        message: parsedParams.error,
      });
    }

    const {
      page,
      limit,
      search,
      gender,
      minAge,
      maxAge,
      minHeight,
      maxHeight,
      maritalStatus,
      location,
      education,
      occupation,
      rasi,
      nakshatram,
      caste,
      subcaste,
      gothram,
      religion,
      diet,
      dosham,
    } = parsedParams;

    // 2. Enforce subscription access
    let access = req.subscriptionAccess;
    if (!access) {
      const accessEval = await checkUserDirectoryAccess(req.user._id);
      if (!accessEval.allowed) {
        return res.status(403).json({
          success: false,
          code: accessEval.code,
          message: accessEval.message,
          subscriptionAccess: {
            allowed: false,
            code: accessEval.code,
            inGracePeriod: false,
            contactsHidden: true,
          },
        });
      }
      access = {
        allowed: true,
        code: accessEval.code,
        accessMode: accessEval.accessMode,
        inGracePeriod: accessEval.inGracePeriod,
        contactsHidden: true,
        endDate: accessEval.subscriptionSummary?.endDate || null,
        gracePeriodEndDate: accessEval.subscriptionSummary?.gracePeriodEndDate || null,
        subscription: accessEval.subscription || null,
      };
    }

    // 3. Batch-resolve candidate account-linked owner IDs matching active profiles (excluding self)
    const candidateQuery = MatrimonialProfile.find({
      profileStatus: 'active',
      user: { $ne: null },
      $or: [
        { source: 'direct' },
        { source: 'broker', approvalStatus: 'approved' },
      ],
    }).select('user');

    let candidateOwnerProfiles = [];
    if (candidateQuery && typeof candidateQuery.then === 'function') {
      candidateOwnerProfiles = await candidateQuery;
    } else if (candidateQuery && typeof candidateQuery.limit === 'function') {
      candidateOwnerProfiles = await candidateQuery.limit(10000);
    } else if (Array.isArray(candidateQuery)) {
      candidateOwnerProfiles = candidateQuery;
    }

    const candidateOwnerIds = (Array.isArray(candidateOwnerProfiles) ? candidateOwnerProfiles : [])
      .map((p) => (p && p.user && p.user._id ? p.user._id : p && p.user ? p.user : null))
      .filter((uid) => uid && String(uid) !== String(req.user._id));

    // 4. Batch-resolve which candidate owners have expired beyond the 7-day grace period
    const { expiredOwnerIds, expiredOwnerIdSet } =
      await getExpiredBeyondGraceOwnerIds(candidateOwnerIds);

    // 5. Build safe database filter
    const filter = buildMemberDirectoryFilter({
      currentUserId: req.user._id,
      search,
      gender,
      minAge,
      maxAge,
      minHeight,
      maxHeight,
      maritalStatus,
      location,
      education,
      occupation,
      rasi,
      nakshatram,
      caste,
      subcaste,
      gothram,
      religion,
      diet,
      dosham,
      expiredOwnerIds,
    });

    const skip = (page - 1) * limit;

    // 6. Execute count and paginated query, safely populating ONLY user.name (never email or sensitive auth fields)
    const [totalRecords, rawProfiles] = await Promise.all([
      MatrimonialProfile.countDocuments(filter),
      MatrimonialProfile.find(filter)
        .select(DIRECTORY_DB_PROJECTION)
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    // 6. Filter eligible profiles and batch-check which displayed profiles were already unlocked by this viewer
    const eligibleProfiles = (rawProfiles || []).filter((profile) =>
      isProfileEligibleForDirectory(profile, req.user._id, expiredOwnerIdSet)
    );

    let unlockedProfileIdSet = new Set();
    if (eligibleProfiles.length > 0 && !access.inGracePeriod) {
      try {
        const pageProfileIds = eligibleProfiles.map((p) => p._id).filter(Boolean);
        const unlockQuery = ContactUnlock.find({
          viewerUser: req.user._id,
          targetProfile: { $in: pageProfileIds },
        });
        let unlockedDocs = [];
        if (unlockQuery && typeof unlockQuery.select === 'function') {
          unlockedDocs = await unlockQuery.select('targetProfile');
        } else if (unlockQuery && typeof unlockQuery.then === 'function') {
          unlockedDocs = await unlockQuery;
        }
        if (Array.isArray(unlockedDocs)) {
          unlockedProfileIdSet = new Set(
            unlockedDocs.map((u) => String(u.targetProfile?._id || u.targetProfile))
          );
        }
      } catch (_) {
        // Non-fatal in isolated Phase 5B tests where ContactUnlock is not mocked
      }
    }

    const safeProfiles = eligibleProfiles.map((profile) =>
      toMemberDirectoryDTO(profile, {
        isContactUnlocked: unlockedProfileIdSet.has(String(profile._id)),
      })
    );

    // 7. Resolve viewer's current monthly credit cycle if subscription is in active window
    let currentCredits = null;
    if (access.accessMode === 'active' && !access.inGracePeriod && access.subscription?._id) {
      try {
        const cycleRes = await getOrCreateCurrentCreditCycle(access.subscription);
        if (cycleRes.eligible && cycleRes.cycle) {
          currentCredits = formatCreditCycleDTO(cycleRes.cycle);
        }
      } catch (_) {
        // Non-fatal fallback
      }
    }

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    // Prevent caching of private member directory responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

    return res.status(200).json({
      success: true,
      data: safeProfiles,
      credits: currentCredits,
      subscriptionAccess: {
        accessMode: access.accessMode,
        inGracePeriod: Boolean(access.inGracePeriod),
        canUnlockContacts: access.accessMode === 'active' && !access.inGracePeriod,
        contactsHidden: true,
        endDate: access.endDate || null,
        gracePeriodEndDate: access.inGracePeriod ? access.gracePeriodEndDate || null : null,
        credits: currentCredits,
      },
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/members/credits
 * @desc    Get the current authenticated member's monthly contact-view credit balance
 * @access  Private
 */
const getMemberCredits = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, authentication required.',
      });
    }

    const balanceInfo = await getViewerCreditBalance(req.user._id);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    if (!balanceInfo.allowed) {
      return res.status(403).json({
        success: false,
        code: balanceInfo.code,
        message: balanceInfo.message,
        data: balanceInfo,
      });
    }

    return res.status(200).json({
      success: true,
      data: balanceInfo,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/members/:profileId/view-contact
 * @desc    Unlock and view a candidate's own phone number using 1 monthly credit (0 on repeat view)
 * @access  Private (Active subscriber only; denied during grace period or after expiry)
 */
const unlockMemberContactHandler = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, authentication required.',
      });
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');

    const { profileId } = req.params;

    const unlockResult = await unlockCandidateContact({
      viewerUserId: req.user._id,
      targetProfileId: profileId,
    });

    return res.status(200).json({
      success: true,
      message: unlockResult.alreadyUnlocked
        ? 'Contact number retrieved (previously unlocked — 0 credits used).'
        : 'Contact number unlocked successfully (1 credit used).',
      data: {
        profileId: unlockResult.profileId,
        candidatePhone: unlockResult.candidatePhone,
        alreadyUnlocked: unlockResult.alreadyUnlocked,
        creditsCharged: unlockResult.creditsCharged,
        unlockedAt: unlockResult.unlockedAt,
        credits: unlockResult.credits,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        code: err.code || null,
        message: err.message,
      });
    }
    next(err);
  }
};

/**
 * @route   GET /api/members/:profileId
 * @desc    View an individual eligible candidate's full profile details (excluding raw contact info)
 * @access  Private (Authenticated active user with active or grace-period subscription)
 */
const getMemberCandidateDetails = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, authentication required.',
      });
    }

    const { profileId } = req.params;

    // Validate profileId format - safe 404 for invalid ObjectId
    if (!profileId || !mongoose.Types.ObjectId.isValid(String(profileId))) {
      return res.status(404).json({
        success: false,
        code: 'PROFILE_NOT_FOUND',
        message: 'Matrimonial profile not found or unavailable.',
      });
    }

    // Retrieve profile with safe projection excluding private contact info
    const profile = await MatrimonialProfile.findById(profileId)
      .select(DIRECTORY_DB_PROJECTION)
      .populate('user', 'name');

    if (!profile) {
      return res.status(404).json({
        success: false,
        code: 'PROFILE_NOT_FOUND',
        message: 'Matrimonial profile not found or unavailable.',
      });
    }

    // Prevent members from viewing their own profile through the candidate-detail route
    if (profile.user) {
      const profileUserId = profile.user._id ? String(profile.user._id) : String(profile.user);
      if (String(req.user._id) === profileUserId) {
        return res.status(400).json({
          success: false,
          code: 'SELF_PROFILE_VIEW_DENIED',
          message:
            'You cannot view your own profile in the candidate directory. Please manage your profile under My Profile.',
        });
      }
    }

    // Enforce active status and broker approval
    if (profile.profileStatus !== 'active') {
      return res.status(404).json({
        success: false,
        code: 'PROFILE_NOT_FOUND',
        message: 'Matrimonial profile not found or unavailable.',
      });
    }

    if (profile.source === 'broker' && profile.approvalStatus !== 'approved') {
      return res.status(404).json({
        success: false,
        code: 'PROFILE_NOT_FOUND',
        message: 'Matrimonial profile not found or unavailable.',
      });
    }

    // Exclude profile if candidate's linked user is expired beyond 7-day grace period
    if (profile.user) {
      const candidateOwnerId = profile.user._id || profile.user;
      const { expiredOwnerIdSet } = await getExpiredBeyondGraceOwnerIds([candidateOwnerId]);
      if (expiredOwnerIdSet.has(String(candidateOwnerId))) {
        return res.status(404).json({
          success: false,
          code: 'PROFILE_NOT_AVAILABLE',
          message: 'This matrimonial profile is no longer available in the member directory.',
        });
      }
    }

    const access = req.subscriptionAccess || {};

    // Check if viewer has already unlocked contact for this candidate
    let isContactUnlocked = false;
    if (!access.inGracePeriod) {
      try {
        const unlockQuery = ContactUnlock.findOne({
          viewerUser: req.user._id,
          targetProfile: profile._id,
        });
        let existingUnlock = null;
        if (unlockQuery && typeof unlockQuery.select === 'function') {
          existingUnlock = await unlockQuery.select('_id');
        } else if (unlockQuery && typeof unlockQuery.then === 'function') {
          existingUnlock = await unlockQuery;
        }
        if (existingUnlock) {
          isContactUnlocked = true;
        }
      } catch (_) {
        // Non-fatal fallback
      }
    }

    // Map to safe DTO
    const safeProfile = toMemberDirectoryDTO(profile, { isContactUnlocked });

    // Resolve viewer's current monthly credit cycle
    let currentCredits = null;
    if (access.accessMode === 'active' && !access.inGracePeriod && access.subscription?._id) {
      try {
        const cycleRes = await getOrCreateCurrentCreditCycle(access.subscription);
        if (cycleRes.eligible && cycleRes.cycle) {
          currentCredits = formatCreditCycleDTO(cycleRes.cycle);
        }
      } catch (_) {
        // Non-fatal fallback
      }
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

    return res.status(200).json({
      success: true,
      data: safeProfile,
      credits: currentCredits,
      subscriptionAccess: {
        accessMode: access.accessMode,
        inGracePeriod: Boolean(access.inGracePeriod),
        canUnlockContacts: access.accessMode === 'active' && !access.inGracePeriod,
        contactsHidden: true,
        endDate: access.endDate || null,
        gracePeriodEndDate: access.inGracePeriod ? access.gracePeriodEndDate || null : null,
        credits: currentCredits,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_SEARCH_LENGTH,
  DIRECTORY_DB_PROJECTION,
  parseMemberDirectoryParams,
  isProfileEligibleForDirectory,
  buildMemberDirectoryFilter,
  toMemberDirectoryDTO,
  getMemberDirectory,
  getMemberCredits,
  getMemberCandidateDetails,
  unlockMemberContactHandler,
};
