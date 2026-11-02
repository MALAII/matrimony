/**
 * Horoscope & Jathagam Controller
 *
 * Implements:
 * 1. Member self-profile Jathagam generation (POST /api/profiles/me/horoscope/generate)
 * 2. Member manual horoscope particulars update (PATCH /api/profiles/me/horoscope)
 * 3. Admin candidate Jathagam generation (POST /api/admin/profiles/:id/horoscope/generate)
 * 4. Admin preview generation (POST /api/admin/horoscope/preview)
 * 5. Pre-configured South Indian cities endpoint (GET /api/profiles/cities)
 */

const mongoose = require('mongoose');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const HoroscopeRecord = require('../models/HoroscopeRecord');
const {
  generateHoroscope,
  isProkeralaConfigured,
  SOUTH_INDIAN_CITIES,
  RASI_LIST,
  NAKSHATRA_LIST,
  calculateVedicAscendant,
} = require('../services/prokeralaService');
const { generateHoroscopePdfBuffer } = require('../services/horoscopePdfService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes date and time into valid ISO 8601 string with +05:30 IST offset
 */
const formatIsoDatetime = (dobStr, timeStr = '12:00') => {
  if (!dobStr) return null;
  const datePart = typeof dobStr === 'string' ? dobStr.slice(0, 10) : new Date(dobStr).toISOString().slice(0, 10);
  const cleanTime = (timeStr || '12:00').trim();
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
  const timePart = timeRegex.test(cleanTime)
    ? cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime
    : '12:00:00';
  return `${datePart}T${timePart}+05:30`;
};

/**
 * Resolves latitude,longitude coordinates from input or city lookup table
 * Returns null if coordinates cannot be determined without guessing
 */
const resolveCoordinates = (birthCoordinates, placeOfBirth) => {
  if (typeof birthCoordinates === 'string' && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(birthCoordinates.trim())) {
    return birthCoordinates.trim();
  }
  if (birthCoordinates && typeof birthCoordinates === 'object' && birthCoordinates.latitude && birthCoordinates.longitude) {
    return `${birthCoordinates.latitude},${birthCoordinates.longitude}`;
  }
  if (placeOfBirth) {
    const cleanPlace = placeOfBirth.toLowerCase().trim();
    const match = SOUTH_INDIAN_CITIES.find((c) => {
      const cityName = c.name.toLowerCase();
      return cityName === cleanPlace || cityName.includes(cleanPlace) || cleanPlace.includes(cityName.split(',')[0].trim());
    });
    if (match) {
      return match.coordinates;
    }
  }
  return null;
};

/**
 * @route   GET /api/profiles/cities
 * @desc    Get pre-configured list of South Indian cities and coordinates
 * @access  Public / Authenticated
 */
const getSouthIndianCities = async (req, res) => {
  return res.status(200).json({
    success: true,
    cities: SOUTH_INDIAN_CITIES,
    rasis: RASI_LIST,
    nakshatras: NAKSHATRA_LIST,
    isProkeralaConfigured: isProkeralaConfigured(),
    data: {
      cities: SOUTH_INDIAN_CITIES,
      rasis: RASI_LIST,
      nakshatras: NAKSHATRA_LIST,
      isProkeralaConfigured: isProkeralaConfigured(),
    },
  });
};

/**
 * @route   POST /api/profiles/me/horoscope/request
 * @desc    Submit a Jathagam generation request for the signed-in user's own profile
 * @access  Private (Authenticated User only)
 */
const requestMyHoroscope = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { timeOfBirth, placeOfBirth, birthCoordinates } = req.body || {};

    const profile = await MatrimonialProfile.findOne({ user: userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found. Please create your profile first.',
      });
    }

    // Require Date of Birth
    const dob = profile.personalDetails?.dateOfBirth;
    if (!dob) {
      return res.status(400).json({
        success: false,
        message: 'Date of birth is required on your profile before requesting Jathagam generation.',
      });
    }

    // Check existing request status
    const currentStatus = profile.horoscope?.requestStatus;
    if (currentStatus === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'A Jathagam generation request is already pending administrator review.',
        data: {
          requestStatus: 'pending',
          requestedAt: profile.horoscope?.requestedAt,
        },
      });
    }

    if (currentStatus === 'processing') {
      return res.status(400).json({
        success: false,
        message: 'Your Jathagam chart is currently being generated. Please check back shortly.',
        data: {
          requestStatus: 'processing',
          requestedAt: profile.horoscope?.requestedAt,
        },
      });
    }

    // Update birth particulars if provided in request
    const cleanTime = typeof timeOfBirth === 'string' && timeOfBirth.trim() ? timeOfBirth.trim() : (profile.horoscope?.timeOfBirth || null);
    const cleanPlace = typeof placeOfBirth === 'string' && placeOfBirth.trim() ? placeOfBirth.trim() : (profile.horoscope?.placeOfBirth || null);
    const cleanCoords = typeof birthCoordinates === 'string' && birthCoordinates.trim() ? birthCoordinates.trim() : (profile.horoscope?.birthCoordinates || null);

    profile.horoscope = {
      ...(typeof profile.horoscope?.toObject === 'function' ? profile.horoscope.toObject() : profile.horoscope || {}),
      requestStatus: 'pending',
      requestedAt: new Date(),
      failedReason: null,
      timeOfBirth: cleanTime,
      placeOfBirth: cleanPlace,
      birthCoordinates: cleanCoords,
    };

    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Jathagam generation requested successfully. An administrator will review and generate your chart.',
      data: {
        requestStatus: 'pending',
        requestedAt: profile.horoscope.requestedAt,
        timeOfBirth: profile.horoscope.timeOfBirth,
        placeOfBirth: profile.horoscope.placeOfBirth,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/profiles/me/horoscope/chart-file
 * @desc    Download the pure square vector SVG chart for the signed-in user's own profile
 * @access  Private (Authenticated User only)
 */
const downloadMyHoroscopeChart = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const chartType = (req.query.chart || 'rasi').toLowerCase(); // 'rasi' or 'navamsa'

    const profile = await MatrimonialProfile.findOne({ user: userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found.',
      });
    }

    const horoscope = profile.horoscope;
    if (
      !horoscope ||
      !horoscope.isGenerated ||
      horoscope.isSimulated ||
      horoscope.requestStatus !== 'completed'
    ) {
      return res.status(400).json({
        success: false,
        message: 'A completed, verified Jathagam chart is not available for download.',
      });
    }

    const svgContent = chartType === 'navamsa' ? horoscope.navamsaChartSvg : horoscope.rasiChartSvg;
    if (!svgContent || typeof svgContent !== 'string' || !svgContent.includes('<svg')) {
      return res.status(404).json({
        success: false,
        message: `The requested square ${chartType === 'navamsa' ? 'Navamsa' : 'Rasi'} chart is not available on this profile.`,
      });
    }

    const candidateName = profile.candidateName || req.user.name || 'Member';
    const sanitizedName = candidateName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const chartLabel = chartType === 'navamsa' ? 'Navamsa-Chart' : 'Rasi-Chart';
    const filename = `${sanitizedName}-${chartLabel}.svg`;

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    return res.status(200).send(svgContent);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/admin/horoscope-requests
 * @desc    List candidate profiles with pending / completed / failed horoscope requests
 * @access  Private (Admin only)
 */
const getAdminHoroscopeRequests = async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;
    const allowed = ['all', 'none', 'pending', 'processing', 'completed', 'failed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status parameter. Allowed values: ${allowed.join(', ')}`,
      });
    }

    const filter = status === 'all'
      ? { 'horoscope.requestStatus': { $in: ['pending', 'processing', 'completed', 'failed'] } }
      : { 'horoscope.requestStatus': status };

    const profiles = await MatrimonialProfile.find(filter)
      .select('candidateName personalDetails.gender personalDetails.dateOfBirth horoscope user createdAt source approvalStatus profileStatus')
      .populate('user', 'name email phone')
      .sort({ 'horoscope.requestedAt': -1, updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: profiles.length,
      data: profiles,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/profiles/me/horoscope/generate
 * @desc    Generate and save Jathagam data via Prokerala for signed-in user's profile
 * @access  Private (Authenticated User)
 */
const generateMyHoroscope = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const {
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
      birthCoordinates,
      language = 'ta',
    } = req.body || {};

    const profile = await MatrimonialProfile.findOne({ user: userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found. Please create your profile first.',
      });
    }

    // Determine target birth date (from request or fallback to existing profile DOB)
    const targetDob = dateOfBirth || profile.personalDetails?.dateOfBirth;
    if (!targetDob) {
      return res.status(400).json({
        success: false,
        message: 'Date of birth is mandatory to generate Jathagam.',
      });
    }

    const cleanTime = (timeOfBirth || profile.horoscope?.timeOfBirth || '').trim();
    if (!cleanTime) {
      return res.status(400).json({
        success: false,
        message: 'Time of birth is mandatory to generate Jathagam.',
      });
    }

    const cleanPlace = (placeOfBirth || profile.horoscope?.placeOfBirth || '').trim();
    if (!cleanPlace) {
      return res.status(400).json({
        success: false,
        message: 'Place of birth is mandatory to generate Jathagam.',
      });
    }

    const coords = resolveCoordinates(birthCoordinates || profile.horoscope?.birthCoordinates, cleanPlace);
    if (!coords) {
      return res.status(400).json({
        success: false,
        message: 'Could not resolve geographic coordinates for the birthplace. Please select a valid South Indian city.',
      });
    }

    const isoDatetime = formatIsoDatetime(targetDob, cleanTime);

    const generatedData = await generateHoroscope({
      datetime: isoDatetime,
      coordinates: coords,
      placeName: cleanPlace,
      language,
    });

    // Save into profile document
    profile.horoscope = {
      ...(typeof profile.horoscope?.toObject === 'function' ? profile.horoscope.toObject() : profile.horoscope || {}),
      ...generatedData,
      timeOfBirth: cleanTime,
      placeOfBirth: cleanPlace,
      birthCoordinates: coords,
      requestStatus: 'completed',
      processedAt: new Date(),
      failedReason: null,
    };

    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Jathagam generated and saved successfully.',
      data: profile.horoscope,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/profiles/me/horoscope
 * @desc    Manually update Jathagam particulars for signed-in user's profile
 * @access  Private (Authenticated User)
 */
const updateMyHoroscope = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const {
      rasi,
      nakshatram,
      padam,
      lagnam,
      doshamSummary,
      timeOfBirth,
      placeOfBirth,
      birthCoordinates,
    } = req.body || {};

    const profile = await MatrimonialProfile.findOne({ user: userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found.',
      });
    }

    const currentHoroscope = profile.horoscope ? profile.horoscope.toObject() : {};

    profile.horoscope = {
      ...currentHoroscope,
      rasi: rasi !== undefined ? rasi : currentHoroscope.rasi,
      nakshatram: nakshatram !== undefined ? nakshatram : currentHoroscope.nakshatram,
      padam: padam !== undefined ? padam : currentHoroscope.padam,
      lagnam: lagnam !== undefined ? lagnam : currentHoroscope.lagnam,
      timeOfBirth: timeOfBirth !== undefined ? timeOfBirth : currentHoroscope.timeOfBirth,
      placeOfBirth: placeOfBirth !== undefined ? placeOfBirth : currentHoroscope.placeOfBirth,
      birthCoordinates: birthCoordinates !== undefined ? birthCoordinates : currentHoroscope.birthCoordinates,
      dosham: {
        ...(currentHoroscope.dosham || {}),
        doshamSummary: doshamSummary !== undefined ? doshamSummary : currentHoroscope.dosham?.doshamSummary || 'None',
      },
    };

    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Horoscope details updated successfully.',
      data: profile.horoscope,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/admin/profiles/:id/horoscope/generate
 * @desc    Generate and save Jathagam for an admin-managed candidate profile
 * @access  Private (Admin only)
 */
const generateAdminCandidateHoroscope = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
      birthCoordinates,
      language = 'ta',
    } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID format',
      });
    }

    const profile = await MatrimonialProfile.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Candidate profile not found',
      });
    }

    if (dateOfBirth) {
      if (!profile.personalDetails) {
        profile.personalDetails = {};
      }
      profile.personalDetails.dateOfBirth = new Date(dateOfBirth);
    }

    const targetDob = dateOfBirth || profile.personalDetails?.dateOfBirth;
    if (!targetDob) {
      return res.status(400).json({
        success: false,
        message: 'Date of birth is mandatory to generate Jathagam.',
      });
    }

    const targetTime = (timeOfBirth || profile.horoscope?.timeOfBirth || '').trim();
    if (!targetTime) {
      return res.status(400).json({
        success: false,
        message: 'Time of birth is mandatory to generate Jathagam. Please provide a valid birth time.',
      });
    }
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
    if (!timeRegex.test(targetTime)) {
      return res.status(400).json({
        success: false,
        message: 'Time of birth must be in valid 24-hour format (HH:MM or HH:MM:SS).',
      });
    }

    const targetPlace = (placeOfBirth || profile.horoscope?.placeOfBirth || '').trim();
    if (!targetPlace) {
      return res.status(400).json({
        success: false,
        message: 'Place of birth is mandatory to generate Jathagam. Please select or enter a valid birthplace.',
      });
    }

    const targetCoords = resolveCoordinates(birthCoordinates || profile.horoscope?.birthCoordinates, targetPlace);
    if (!targetCoords) {
      return res.status(400).json({
        success: false,
        message: 'Could not resolve geographic coordinates for the birthplace. Please select a valid South Indian city from the list.',
      });
    }

    const isoDatetime = formatIsoDatetime(targetDob, targetTime);

    // Transition status to processing
    profile.horoscope = {
      ...(typeof profile.horoscope?.toObject === 'function' ? profile.horoscope.toObject() : profile.horoscope || {}),
      requestStatus: 'processing',
    };
    await profile.save();

    try {
      const generatedData = await generateHoroscope({
        datetime: isoDatetime,
        coordinates: targetCoords,
        placeName: targetPlace,
        language,
      });

      // Refuse silent simulation in production
      if (generatedData.isSimulated && process.env.NODE_ENV === 'production') {
        throw new Error('Prokerala API produced simulated calculations which are prohibited for verified member charts.');
      }

      profile.horoscope = {
        ...(typeof profile.horoscope?.toObject === 'function' ? profile.horoscope.toObject() : profile.horoscope || {}),
        ...generatedData,
        timeOfBirth: targetTime,
        placeOfBirth: targetPlace,
        birthCoordinates: targetCoords,
        requestStatus: 'completed',
        processedAt: new Date(),
        failedReason: null,
      };

      await profile.save();

      return res.status(200).json({
        success: true,
        message: 'Candidate Jathagam generated and saved successfully.',
        data: profile.horoscope,
      });
    } catch (genErr) {
      profile.horoscope = {
        ...(typeof profile.horoscope?.toObject === 'function' ? profile.horoscope.toObject() : profile.horoscope || {}),
        requestStatus: 'failed',
        failedReason: genErr.message || 'Horoscope generation failed',
      };
      await profile.save();

      return res.status(genErr.statusCode || 400).json({
        success: false,
        message: `Failed to generate Jathagam: ${genErr.message}`,
        code: genErr.code || 'HOROSCOPE_GENERATION_FAILED',
        failedReason: profile.horoscope.failedReason,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/admin/horoscope/preview
 * @desc    Dry-run generate Jathagam without saving (used in new candidate creation form)
 * @access  Private (Admin only)
 */
const previewHoroscope = async (req, res, next) => {
  try {
    const {
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
      birthCoordinates,
      language = 'ta',
    } = req.body || {};

    if (!dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: 'Date of birth is mandatory.',
      });
    }

    const cleanTime = (timeOfBirth || '').trim();
    if (!cleanTime) {
      return res.status(400).json({
        success: false,
        message: 'Time of birth is mandatory.',
      });
    }

    const cleanPlace = (placeOfBirth || '').trim();
    if (!cleanPlace) {
      return res.status(400).json({
        success: false,
        message: 'Place of birth is mandatory.',
      });
    }

    const coords = resolveCoordinates(birthCoordinates, cleanPlace);
    if (!coords) {
      return res.status(400).json({
        success: false,
        message: 'Could not resolve geographic coordinates for the selected place of birth. Please select a valid South Indian city.',
      });
    }

    const isoDatetime = formatIsoDatetime(dateOfBirth, cleanTime);

    const generatedData = await generateHoroscope({
      datetime: isoDatetime,
      coordinates: coords,
      placeName: cleanPlace,
      language,
    });

    return res.status(200).json({
      success: true,
      message: 'Jathagam preview generated.',
      data: generatedData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/admin/horoscopes/generate
 * @desc    Generate a standalone South Indian square chart for any individual (registered or unregistered)
 * @access  Private (Admin only)
 */
const generateStandaloneHoroscope = async (req, res, next) => {
  try {
    const {
      personName,
      name,
      gender = 'Not Specified',
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
      birthCoordinates,
      contactPhone = '',
      contactEmail = '',
      notes = '',
      language = 'ta',
    } = req.body || {};

    const targetName = (personName || name || '').trim();
    if (!targetName) {
      return res.status(400).json({
        success: false,
        message: 'Person / Candidate Name is mandatory (பெயர் அவசியம்).',
      });
    }

    if (!dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: 'Date of birth is mandatory to generate Jathagam (பிறந்த தேதி அவசியம்).',
      });
    }

    const targetTime = (timeOfBirth || '').trim();
    if (!targetTime) {
      return res.status(400).json({
        success: false,
        message: 'Time of birth is mandatory to generate Jathagam (பிறந்த நேரம் அவசியம்).',
      });
    }
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
    if (!timeRegex.test(targetTime)) {
      return res.status(400).json({
        success: false,
        message: 'Time of birth must be in valid 24-hour format (HH:MM or HH:MM:SS).',
      });
    }

    const targetPlace = (placeOfBirth || '').trim();
    if (!targetPlace) {
      return res.status(400).json({
        success: false,
        message: 'Place of birth is mandatory. Please select a valid South Indian city (பிறந்த இடம் அவசியம்).',
      });
    }

    const targetCoords = resolveCoordinates(birthCoordinates, targetPlace);
    if (!targetCoords) {
      return res.status(400).json({
        success: false,
        message: 'Could not resolve geographic coordinates for the birthplace. Please select a valid South Indian city from the list.',
      });
    }

    const isoDatetime = formatIsoDatetime(dateOfBirth, targetTime);

    const generatedData = await generateHoroscope({
      datetime: isoDatetime,
      coordinates: targetCoords,
      placeName: targetPlace,
      language,
    });

    // Refuse silent simulation in production
    if (generatedData.isSimulated && process.env.NODE_ENV === 'production') {
      throw new Error('Prokerala API produced simulated calculations which are prohibited for verified charts.');
    }

    const newRecord = new HoroscopeRecord({
      personName: targetName,
      gender: ['Male', 'Female', 'Other'].includes(gender) ? gender : 'Not Specified',
      dateOfBirth: new Date(dateOfBirth),
      timeOfBirth: targetTime,
      placeOfBirth: targetPlace,
      birthCoordinates: targetCoords,
      contactPhone: contactPhone.trim(),
      contactEmail: contactEmail.trim().toLowerCase(),
      notes: notes.trim(),
      ...generatedData,
      isGenerated: true,
      generatedAt: new Date(),
      createdBy: req.user?._id || null,
    });

    await newRecord.save();

    return res.status(201).json({
      success: true,
      message: 'Horoscope generated and saved successfully.',
      data: newRecord,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/admin/horoscopes
 * @desc    List all generated horoscopes (both standalone records and any existing profile horoscopes)
 * @access  Private (Admin only)
 */
const getAdminGeneratedHoroscopes = async (req, res, next) => {
  try {
    // Helper to ensure lagnam is calculated if not stored
    const resolveItemLagnam = (item) => {
      if (item.lagnam && typeof item.lagnam === 'string' && item.lagnam.trim() && item.lagnam !== '—' && item.lagnam !== 'N/A') {
        return item.lagnam.trim();
      }
      const dob = item.dateOfBirth;
      const tob = item.timeOfBirth || '12:00';
      const coords = item.birthCoordinates || resolveCoordinates(null, item.placeOfBirth);
      if (dob && coords) {
        const iso = formatIsoDatetime(dob, tob);
        const computed = calculateVedicAscendant(iso, coords, 'ta');
        if (computed) return computed;
      }
      return item.lagnam || '—';
    };

    // 1. Fetch standalone HoroscopeRecord documents
    const standaloneDocs = await HoroscopeRecord.find()
      .sort({ createdAt: -1 })
      .lean();

    const standaloneRecords = standaloneDocs.map((rec) => ({
      ...rec,
      lagnam: resolveItemLagnam(rec),
    }));

    // 2. Fetch any MatrimonialProfile documents that have generated horoscopes
    const profileRecords = await MatrimonialProfile.find({
      'horoscope.isGenerated': true,
    })
      .select('candidateName candidateEmail candidatePhone personalDetails horoscope source user createdAt updatedAt')
      .populate('user', 'name email phone')
      .sort({ 'horoscope.generatedAt': -1, updatedAt: -1 })
      .lean();

    // Format profiles into uniform list items
    const formattedProfiles = profileRecords.map((p) => {
      const item = {
        _id: p._id,
        personName: p.candidateName || p.user?.name || 'Unnamed Candidate',
        gender: p.personalDetails?.gender || 'Not Specified',
        dateOfBirth: p.personalDetails?.dateOfBirth,
        timeOfBirth: p.horoscope?.timeOfBirth,
        placeOfBirth: p.horoscope?.placeOfBirth,
        birthCoordinates: p.horoscope?.birthCoordinates,
        contactPhone: p.candidatePhone || '',
        contactEmail: p.candidateEmail || p.user?.email || '',
        rasi: p.horoscope?.rasi,
        nakshatram: p.horoscope?.nakshatram,
        padam: p.horoscope?.padam,
        lagnam: p.horoscope?.lagnam,
        dosham: p.horoscope?.dosham,
        dasaBalance: p.horoscope?.dasaBalance,
        isGenerated: p.horoscope?.isGenerated,
        isSimulated: p.horoscope?.isSimulated,
        generatedAt: p.horoscope?.generatedAt || p.updatedAt,
        isProfileLinked: true,
        profileSource: p.source,
        createdAt: p.createdAt,
      };
      item.lagnam = resolveItemLagnam(item);
      return item;
    });

    // Combine standalone + profile records, sorted newest first
    const allRecords = [...standaloneRecords, ...formattedProfiles].sort((a, b) => {
      const dateA = new Date(a.generatedAt || a.createdAt || 0);
      const dateB = new Date(b.generatedAt || b.createdAt || 0);
      return dateB - dateA;
    });

    return res.status(200).json({
      success: true,
      count: allRecords.length,
      data: allRecords,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/admin/horoscopes/:id/pdf
 * @route   GET /api/admin/profiles/:id/horoscope/pdf
 * @desc    View inline or download the official Horoscope PDF for a generated horoscope
 * @access  Private (Admin only)
 */
const getAdminCandidateHoroscopePdf = async (req, res, next) => {
  try {
    const { id } = req.params;
    const download = req.query.download === 'true' || req.query.download === '1';

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid record ID format',
      });
    }

    // Check HoroscopeRecord first
    let record = await HoroscopeRecord.findById(id);
    if (!record) {
      // Fallback to MatrimonialProfile for older generated horoscopes
      record = await MatrimonialProfile.findById(id);
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Horoscope record not found',
      });
    }

    const horoscope = record.horoscope && record.horoscope.isGenerated ? record.horoscope : record;
    if (!horoscope || !horoscope.isGenerated) {
      return res.status(400).json({
        success: false,
        message: 'A completed horoscope has not been generated for this record yet.',
      });
    }

    if (horoscope.isSimulated && process.env.NODE_ENV === 'production') {
      return res.status(400).json({
        success: false,
        message: 'Simulated horoscope PDFs cannot be served in production mode.',
      });
    }

    // Ensure Lagnam is calculated if missing in legacy records
    if (!record.lagnam || record.lagnam === '—' || record.lagnam === 'N/A') {
      const dob = record.dateOfBirth || record.personalDetails?.dateOfBirth;
      const tob = horoscope.timeOfBirth || record.timeOfBirth || '12:00';
      const coords = horoscope.birthCoordinates || record.birthCoordinates || resolveCoordinates(null, horoscope.placeOfBirth || record.placeOfBirth);
      if (dob && coords) {
        const computed = calculateVedicAscendant(formatIsoDatetime(dob, tob), coords, 'ta');
        if (computed) {
          record.lagnam = computed;
          if (record.horoscope) record.horoscope.lagnam = computed;
        }
      }
    }

    const template = (req.query.template || 'classic').toLowerCase() === 'watermark' ? 'watermark' : 'classic';
    const pdfBuffer = await generateHoroscopePdfBuffer(record, { template });

    const safeName = (record.personName || record.candidateName || 'Candidate').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}_Horoscope.pdf`;
    const disposition = download ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSouthIndianCities,
  generateMyHoroscope,
  updateMyHoroscope,
  requestMyHoroscope,
  downloadMyHoroscopeChart,
  generateStandaloneHoroscope,
  generateAdminCandidateHoroscope,
  getAdminHoroscopeRequests,
  getAdminGeneratedHoroscopes,
  getAdminBrokerHoroscopeCandidates: getAdminGeneratedHoroscopes, // Backward compatibility alias
  getAdminCandidateHoroscopePdf,
  previewHoroscope,
};
