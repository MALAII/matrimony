const crypto = require('crypto');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const User = require('../models/User');
const ImportBatch = require('../models/ImportBatch');
const ImportStagingRecord = require('../models/ImportStagingRecord');

const PHONE_REGEX = /^[+]?[\d\s()-]{7,25}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHUNK_SIZE = 250;

/**
 * Standard column headers mapping to schema properties
 */
const HEADER_MAPPINGS = {
  // Required candidate identification
  'candidate name': 'candidateName',
  'name': 'candidateName',
  'candidate phone': 'candidatePhone',
  'phone': 'candidatePhone',
  'mobile': 'candidatePhone',
  'candidate email': 'candidateEmail',
  'email': 'candidateEmail',

  // Personal details
  'gender': 'personalDetails.gender',
  'date of birth': 'personalDetails.dateOfBirth',
  'dob': 'personalDetails.dateOfBirth',
  'height': 'personalDetails.height',
  'height (cm)': 'personalDetails.height',
  'height(cm)': 'personalDetails.height',
  'weight': 'personalDetails.weight',
  'weight (kg)': 'personalDetails.weight',
  'weight(kg)': 'personalDetails.weight',
  'blood group': 'personalDetails.bloodGroup',
  'complexion': 'personalDetails.complexion',
  'diet': 'personalDetails.diet',
  'dietary preference': 'personalDetails.diet',
  'physical status': 'personalDetails.physicalStatus',
  'nativity': 'personalDetails.nativity',
  'native place': 'personalDetails.nativity',
  'place of birth': 'personalDetails.placeOfBirth',
  'time of birth': 'personalDetails.timeOfBirth',
  'present address': 'personalDetails.presentAddress',
  'permanent address': 'personalDetails.permanentAddress',
  'contact person': 'personalDetails.contactPerson',
  'alternate phone': 'personalDetails.alternatePhone',
  'marital status': 'personalDetails.maritalStatus',
  'mother tongue': 'personalDetails.motherTongue',
  'current location': 'personalDetails.location',
  'location': 'personalDetails.location',

  // Community details
  'religion': 'communityDetails.religion',
  'caste': 'communityDetails.caste',
  'subcaste': 'communityDetails.subcaste',
  'sub caste': 'communityDetails.subcaste',
  'gothram': 'communityDetails.gothram',
  'kulam': 'communityDetails.gothram',

  // Vedic astrology / horoscope
  'rasi': 'horoscope.rasi',
  'moon sign': 'horoscope.rasi',
  'nakshatram': 'horoscope.nakshatram',
  'birth star': 'horoscope.nakshatram',
  'star': 'horoscope.nakshatram',
  'padam': 'horoscope.padam',
  'lagnam': 'horoscope.lagnam',
  'ascendant': 'horoscope.lagnam',
  'dosham': 'horoscope.dosham.doshamSummary',
  'dosham status': 'horoscope.dosham.doshamSummary',
  'dasa balance': 'horoscope.dasaBalance.planet',

  // Education & profession
  'education qualification': 'educationAndProfession.educationalQualification',
  'educational qualification': 'educationAndProfession.educationalQualification',
  'education': 'educationAndProfession.educationalQualification',
  'occupation': 'educationAndProfession.occupation',
  'company name': 'educationAndProfession.company',
  'company': 'educationAndProfession.company',
  'work location': 'educationAndProfession.workLocation',
  'annual income': 'educationAndProfession.income',
  'income': 'educationAndProfession.income',

  // Family details
  'father name': 'familyDetails.fatherName',
  'father status': 'familyDetails.fatherAlive',
  'father occupation': 'familyDetails.fatherOccupation',
  'mother name': 'familyDetails.motherName',
  'mother status': 'familyDetails.motherAlive',
  'mother occupation': 'familyDetails.motherOccupation',
  'married elder brothers': 'familyDetails.marriedElderBrothers',
  'unmarried elder brothers': 'familyDetails.unmarriedElderBrothers',
  'married younger brothers': 'familyDetails.marriedYoungerBrothers',
  'unmarried younger brothers': 'familyDetails.unmarriedYoungerBrothers',
  'married elder sisters': 'familyDetails.marriedElderSisters',
  'unmarried elder sisters': 'familyDetails.unmarriedElderSisters',
  'married younger sisters': 'familyDetails.marriedYoungerSisters',
  'unmarried younger sisters': 'familyDetails.unmarriedYoungerSisters',
  'family details': 'familyDetails.familyInformation',
  'family info': 'familyDetails.familyInformation',
  'parent details': 'familyDetails.parentInformation',
  'parent info': 'familyDetails.parentInformation',
  'sibling details': 'familyDetails.siblingInformation',
  'sibling info': 'familyDetails.siblingInformation',
  'family location': 'familyDetails.familyLocation',

  // Partner preferences
  'partner preferred min age': 'partnerPreferences.preferredAgeRange.min',
  'preferred min age': 'partnerPreferences.preferredAgeRange.min',
  'min age': 'partnerPreferences.preferredAgeRange.min',
  'partner preferred max age': 'partnerPreferences.preferredAgeRange.max',
  'preferred max age': 'partnerPreferences.preferredAgeRange.max',
  'max age': 'partnerPreferences.preferredAgeRange.max',
  'partner preferred location': 'partnerPreferences.preferredLocation',
  'preferred location': 'partnerPreferences.preferredLocation',
  'partner education preference': 'partnerPreferences.educationPreference',
  'education preference': 'partnerPreferences.educationPreference',
  'partner occupation preference': 'partnerPreferences.occupationPreference',
  'occupation preference': 'partnerPreferences.occupationPreference',
  'partner job requirement': 'partnerPreferences.jobRequirement',
  'job requirement': 'partnerPreferences.jobRequirement',
  'partner marital status preference': 'partnerPreferences.maritalStatusPreference',
  'partner diet preference': 'partnerPreferences.dietPreference',
  'horoscope match required': 'partnerPreferences.horoscopeRequired',
  'partner horoscope required': 'partnerPreferences.horoscopeRequired',
  'partner caste preference': 'partnerPreferences.castePreference',
  'caste preference': 'partnerPreferences.castePreference',
  'partner income preference': 'partnerPreferences.incomePreference',
  'other preferences': 'partnerPreferences.otherPreferences',
  'partner other preferences': 'partnerPreferences.otherPreferences',

  // Photos (up to 3 URLs)
  'photo 1 url': 'rawPhotos.photo1',
  'photo 1': 'rawPhotos.photo1',
  'primary photo url': 'rawPhotos.photo1',
  'photo 2 url': 'rawPhotos.photo2',
  'photo 2': 'rawPhotos.photo2',
  'photo 3 url': 'rawPhotos.photo3',
  'photo 3': 'rawPhotos.photo3',
};

const VALID_GENDERS = ['Male', 'Female', 'Other'];
const VALID_MARITAL_STATUSES = ['Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce'];

/**
 * Normalizes a raw cell value to a clean string or null
 */
const cleanCellValue = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    if (val instanceof Date) return val;
    if (val.text) return String(val.text).trim();
    if (val.result !== undefined) return String(val.result).trim();
    return null;
  }
  const str = String(val).trim();
  return str.length > 0 ? str : null;
};

/**
 * Normalizes phone number to digits only for comparison
 */
const normalizePhoneForComparison = (rawPhone) => {
  if (!rawPhone) return '';
  return String(rawPhone).replace(/\D/g, '');
};

/**
 * Normalizes email address
 */
const normalizeEmail = (rawEmail) => {
  if (!rawEmail) return '';
  return String(rawEmail).trim().toLowerCase();
};

/**
 * Helper to safely set deeply nested properties on an object
 */
const setDeepProp = (obj, path, value) => {
  const parts = path.split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!curr[parts[i]]) curr[parts[i]] = {};
    curr = curr[parts[i]];
  }
  curr[parts[parts.length - 1]] = value;
};

/**
 * Parses and validates an uploaded Excel spreadsheet buffer
 */
const parseAndValidateExcelBuffer = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Spreadsheet does not contain any worksheets.');
  }

  // 1. Parse header row
  const headerRow = worksheet.getRow(1);
  const columnMap = {}; // colNumber -> schemaPath
  const seenHeaderPaths = new Set();

  headerRow.eachCell((cell, colNumber) => {
    const headerText = String(cell.value || '')
      .trim()
      .toLowerCase();
    const mappedPath = HEADER_MAPPINGS[headerText];
    if (mappedPath) {
      columnMap[colNumber] = mappedPath;
      seenHeaderPaths.add(mappedPath);
    }
  });

  // Verify mandatory columns exist
  const mandatoryFields = ['candidateName', 'candidatePhone', 'candidateEmail'];
  for (const field of mandatoryFields) {
    if (!seenHeaderPaths.has(field)) {
      return {
        missingHeader: field,
        error: `Excel spreadsheet is missing mandatory column: '${field === 'candidateName' ? 'Candidate Name' : field === 'candidatePhone' ? 'Candidate Phone' : 'Candidate Email'}'. Please check your headers.`,
      };
    }
  }

  const rawRows = [];
  const phonesForDbQuery = new Set();
  const emailsForDbQuery = new Set();

  // 2. Read row by row
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    // Check if entire row is empty
    let hasAnyValue = false;
    const rowValues = {};

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const path = columnMap[colNumber];
      if (path) {
        const val = cleanCellValue(cell.value);
        if (val !== null) {
          hasAnyValue = true;
          rowValues[path] = val;
        }
      }
    });

    if (hasAnyValue) {
      rawRows.push({ rowNumber, rowValues });
      if (rowValues['candidatePhone']) {
        const digits = normalizePhoneForComparison(rowValues['candidatePhone']);
        if (digits) phonesForDbQuery.add(digits);
      }
      if (rowValues['candidateEmail']) {
        emailsForDbQuery.add(normalizeEmail(rowValues['candidateEmail']));
      }
    }
  });

  return {
    rawRows,
    phonesForDbQuery: Array.from(phonesForDbQuery),
    emailsForDbQuery: Array.from(emailsForDbQuery),
  };
};

/**
 * @route   POST /api/admin/imports/candidates/validate
 * @desc    Dry-run validation of uploaded candidate Excel spreadsheet (zero profile writes)
 * @access  Private (Admin only)
 */
const validateCandidateImport = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "No Excel file uploaded. Please upload a file with field name 'file'",
      });
    }

    const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    // Parse Excel workbook
    let parsedResult;
    try {
      parsedResult = await parseAndValidateExcelBuffer(req.file.buffer);
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        message: `Failed to parse Excel file: ${parseErr.message}`,
      });
    }

    if (parsedResult.error) {
      return res.status(400).json({
        success: false,
        message: parsedResult.error,
      });
    }

    const { rawRows, phonesForDbQuery, emailsForDbQuery } = parsedResult;

    if (rawRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded spreadsheet does not contain any candidate data rows.',
      });
    }

    // 3. Batch DB duplicate queries
    const existingDbProfiles = await MatrimonialProfile.find({
      $or: [
        { candidatePhone: { $in: phonesForDbQuery } },
        { candidateEmail: { $in: emailsForDbQuery } },
      ],
    }).select('candidatePhone candidateEmail');

    const existingDbUsers = await User.find({
      email: { $in: emailsForDbQuery },
    }).select('email');

    const dbPhonesSet = new Set(
      existingDbProfiles
        .filter((p) => p.candidatePhone)
        .map((p) => normalizePhoneForComparison(p.candidatePhone))
    );

    const dbEmailsSet = new Set([
      ...existingDbProfiles.filter((p) => p.candidateEmail).map((p) => normalizeEmail(p.candidateEmail)),
      ...existingDbUsers.map((u) => normalizeEmail(u.email)),
    ]);

    // 4. Validate rows, tracking in-file duplicates and format rules
    const inFileDataPhones = new Map(); // phoneDigits -> rowNumber
    const inFileDataEmails = new Map(); // email -> rowNumber

    const validStagingRecords = [];
    const rowErrors = [];

    let duplicateCount = 0;
    let invalidCount = 0;

    for (const { rowNumber, rowValues } of rawRows) {
      const reasons = [];

      const rawName = rowValues['candidateName'];
      const rawPhone = rowValues['candidatePhone'];
      const rawEmail = rowValues['candidateEmail'];

      // A. Mandatory candidateName
      if (!rawName || typeof rawName !== 'string' || rawName.trim().length === 0) {
        reasons.push('Candidate Name is mandatory');
      } else if (rawName.trim().length > 100) {
        reasons.push('Candidate Name cannot exceed 100 characters');
      }

      // B. Mandatory candidatePhone
      let normalizedPhoneDigits = '';
      if (!rawPhone) {
        reasons.push('Candidate Phone is mandatory');
      } else {
        const phoneStr = String(rawPhone).trim();
        normalizedPhoneDigits = normalizePhoneForComparison(phoneStr);
        if (!PHONE_REGEX.test(phoneStr) || normalizedPhoneDigits.length < 7 || normalizedPhoneDigits.length > 15) {
          reasons.push('Candidate Phone must be a valid 7 to 15 digit phone number');
        }
      }

      // C. Mandatory candidateEmail
      let normalizedEmailStr = '';
      if (!rawEmail) {
        reasons.push('Candidate Email is mandatory');
      } else {
        normalizedEmailStr = normalizeEmail(rawEmail);
        if (!EMAIL_REGEX.test(normalizedEmailStr)) {
          reasons.push('Candidate Email must be a valid email address');
        }
      }

      // D. Duplicate detection (In-File and Database)
      let isDuplicate = false;

      // In-file phone check
      if (normalizedPhoneDigits) {
        if (inFileDataPhones.has(normalizedPhoneDigits)) {
          const firstSeenRow = inFileDataPhones.get(normalizedPhoneDigits);
          reasons.push(`Duplicate in spreadsheet: Phone matches row ${firstSeenRow}`);
          isDuplicate = true;
        } else {
          inFileDataPhones.set(normalizedPhoneDigits, rowNumber);
        }
      }

      // In-file email check
      if (normalizedEmailStr && EMAIL_REGEX.test(normalizedEmailStr)) {
        if (inFileDataEmails.has(normalizedEmailStr)) {
          const firstSeenRow = inFileDataEmails.get(normalizedEmailStr);
          reasons.push(`Duplicate in spreadsheet: Email matches row ${firstSeenRow}`);
          isDuplicate = true;
        } else {
          inFileDataEmails.set(normalizedEmailStr, rowNumber);
        }
      }

      // Database duplicate checks
      if (normalizedPhoneDigits && dbPhonesSet.has(normalizedPhoneDigits)) {
        reasons.push('Duplicate candidate: Phone number is already registered to an existing candidate');
        isDuplicate = true;
      }

      if (normalizedEmailStr && dbEmailsSet.has(normalizedEmailStr)) {
        reasons.push('Duplicate candidate: Email already registered in candidate profiles or user accounts');
        isDuplicate = true;
      }

      // E. Field-level format and enum validations
      const rawGender = rowValues['personalDetails.gender'];
      if (rawGender) {
        const matchedGender = VALID_GENDERS.find(
          (g) => g.toLowerCase() === String(rawGender).trim().toLowerCase()
        );
        if (!matchedGender) {
          reasons.push(`Invalid gender '${rawGender}'. Allowed values: Male, Female, Other`);
        } else {
          rowValues['personalDetails.gender'] = matchedGender;
        }
      }

      const rawMarital = rowValues['personalDetails.maritalStatus'];
      if (rawMarital) {
        const matchedMarital = VALID_MARITAL_STATUSES.find(
          (m) => m.toLowerCase() === String(rawMarital).trim().toLowerCase()
        );
        if (!matchedMarital) {
          reasons.push(`Invalid marital status '${rawMarital}'. Allowed values: Never Married, Divorced, Widowed, Awaiting Divorce`);
        } else {
          rowValues['personalDetails.maritalStatus'] = matchedMarital;
        }
      }

      const rawDob = rowValues['personalDetails.dateOfBirth'];
      if (rawDob) {
        const parsedDob = new Date(rawDob);
        if (isNaN(parsedDob.getTime())) {
          reasons.push('Invalid Date of Birth format');
        } else if (parsedDob > new Date()) {
          reasons.push('Date of Birth cannot be in the future');
        } else {
          rowValues['personalDetails.dateOfBirth'] = parsedDob;
        }
      }

      const rawHeight = rowValues['personalDetails.height'];
      if (rawHeight !== undefined && rawHeight !== null) {
        const numHeight = Number(rawHeight);
        if (isNaN(numHeight) || numHeight < 50 || numHeight > 260) {
          reasons.push('Height must be a number between 50 and 260 cm');
        } else {
          rowValues['personalDetails.height'] = Math.round(numHeight);
        }
      }

      const rawMinAge = rowValues['partnerPreferences.preferredAgeRange.min'];
      const rawMaxAge = rowValues['partnerPreferences.preferredAgeRange.max'];
      let minAgeNum = null;
      let maxAgeNum = null;

      if (rawMinAge !== undefined && rawMinAge !== null) {
        minAgeNum = Number(rawMinAge);
        if (isNaN(minAgeNum) || minAgeNum < 18 || minAgeNum > 100) {
          reasons.push('Preferred minimum age must be between 18 and 100');
        }
      }

      if (rawMaxAge !== undefined && rawMaxAge !== null) {
        maxAgeNum = Number(rawMaxAge);
        if (isNaN(maxAgeNum) || maxAgeNum < 18 || maxAgeNum > 100) {
          reasons.push('Preferred maximum age must be between 18 and 100');
        }
      }

      if (minAgeNum !== null && maxAgeNum !== null && minAgeNum > maxAgeNum) {
        reasons.push('Preferred minimum age cannot be greater than maximum preferred age');
      }

      // F. Classify row outcome
      if (reasons.length > 0) {
        if (isDuplicate) duplicateCount++;
        else invalidCount++;

        rowErrors.push({
          rowNumber,
          candidateName: rawName || 'N/A',
          candidatePhone: rawPhone || 'N/A',
          candidateEmail: rawEmail || 'N/A',
          reasons,
        });
      } else {
        // Build sanitized payload matching schema invariants
        const candidatePayload = {
          candidateName: String(rawName).trim(),
          candidatePhone: String(rawPhone).trim(),
          candidateEmail: normalizedEmailStr,
          source: 'broker',
          approvalStatus: 'pending_approval',
          profileStatus: 'active',
          user: null,
          approvedAt: null,
          approvedBy: null,
          photos: [],
          profilePhoto: { url: null, publicId: null },
        };

        // Populate nested groups
        for (const [key, val] of Object.entries(rowValues)) {
          if (!['candidateName', 'candidatePhone', 'candidateEmail', 'rawPhotos.photo1', 'rawPhotos.photo2', 'rawPhotos.photo3'].includes(key)) {
            setDeepProp(candidatePayload, key, val);
          }
        }

        // Process rawPhotos into valid photos gallery if valid URLs are provided
        const photoUrls = [
          rowValues['rawPhotos.photo1'],
          rowValues['rawPhotos.photo2'],
          rowValues['rawPhotos.photo3'],
        ].filter((u) => u && typeof u === 'string' && u.trim().startsWith('http'));

        if (photoUrls.length > 0) {
          candidatePayload.photos = photoUrls.map((url, idx) => ({
            _id: new mongoose.Types.ObjectId(),
            url: url.trim(),
            publicId: `imported_${Date.now()}_${idx}`,
            isPrimary: idx === 0,
            uploadedAt: new Date(),
          }));

          candidatePayload.profilePhoto = {
            url: photoUrls[0].trim(),
            publicId: `imported_${Date.now()}_0`,
          };
        }

        validStagingRecords.push({
          rowNumber,
          payload: candidatePayload,
        });
      }
    }

    // 5. Generate Batch ID and stage valid records in MongoDB (with TTL)
    const batchId = `imp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    if (validStagingRecords.length > 0) {
      const stagingDocs = validStagingRecords.map((r) => ({
        batchId,
        rowNumber: r.rowNumber,
        payload: r.payload,
      }));

      // Insert in chunks of 500 to staging collection
      for (let i = 0; i < stagingDocs.length; i += 500) {
        await ImportStagingRecord.insertMany(stagingDocs.slice(i, i + 500), { ordered: false });
      }
    }

    // 6. Create ImportBatch tracking document
    const importBatch = await ImportBatch.create({
      batchId,
      adminUser: req.user._id,
      fileName: req.file.originalname,
      fileHash,
      status: 'validated',
      stats: {
        totalRows: rawRows.length,
        validRows: validStagingRecords.length,
        duplicateRows: duplicateCount,
        invalidRows: invalidCount,
        importedRows: 0,
      },
      errors: rowErrors,
    });

    return res.status(200).json({
      success: true,
      message: 'Spreadsheet validation completed successfully',
      data: {
        batchId: importBatch.batchId,
        fileName: importBatch.fileName,
        stats: importBatch.stats,
        // Return first 100 errors for UI preview; full errors available via CSV export
        errorsPreview: rowErrors.slice(0, 100),
        totalErrors: rowErrors.length,
        canCommit: validStagingRecords.length > 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/admin/imports/candidates/commit
 * @desc    Executes chunked batch insertion of pre-validated candidates (forces pending_approval)
 * @access  Private (Admin only)
 */
const commitCandidateImport = async (req, res, next) => {
  try {
    const { batchId } = req.body;

    if (!batchId || typeof batchId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid batchId parameter',
      });
    }

    const batch = await ImportBatch.findOne({ batchId });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Import batch not found or validation session has expired.',
      });
    }

    // Idempotency & Concurrency Guard
    if (batch.status === 'completed') {
      return res.status(409).json({
        success: false,
        message: 'This import batch has already been committed.',
        data: {
          batchId: batch.batchId,
          importedRows: batch.stats.importedRows,
        },
      });
    }

    if (batch.status === 'committing') {
      return res.status(409).json({
        success: false,
        message: 'This import batch is currently being processed by another task.',
      });
    }

    if (batch.stats.validRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'This batch has 0 valid candidates to import.',
      });
    }

    // Mark status committing
    batch.status = 'committing';
    await batch.save();

    let totalImported = 0;
    let hasMore = true;
    let lastRow = 0;

    try {
      while (hasMore) {
        const stagedChunk = await ImportStagingRecord.find({
          batchId,
          rowNumber: { $gt: lastRow },
        })
          .sort({ rowNumber: 1 })
          .limit(CHUNK_SIZE);

        if (stagedChunk.length === 0) {
          hasMore = false;
          break;
        }

        const bulkOps = stagedChunk.map((record) => {
          // Double enforce invariants strictly before write
          const finalProfile = {
            ...record.payload,
            source: 'broker',
            approvalStatus: 'pending_approval',
            profileStatus: 'active',
            user: null,
            approvedAt: null,
            approvedBy: null,
            photos: Array.isArray(record.payload?.photos) && record.payload.photos.length > 0 ? record.payload.photos : [],
            profilePhoto: record.payload?.profilePhoto?.url ? record.payload.profilePhoto : { url: null, publicId: null },
            importBatchId: batchId,
          };

          return {
            insertOne: {
              document: finalProfile,
            },
          };
        });

        // Unordered bulk write ensures partial failures don't abort remaining rows
        const result = await MatrimonialProfile.bulkWrite(bulkOps, { ordered: false });
        totalImported += result.insertedCount || stagedChunk.length;

        lastRow = stagedChunk[stagedChunk.length - 1].rowNumber;

        // 30ms event-loop pause between chunks to keep server responsive
        await new Promise((r) => setTimeout(r, 30));
      }

      // Update batch status to completed
      batch.status = 'completed';
      batch.completedAt = new Date();
      batch.stats.importedRows = totalImported;
      await batch.save();

      // Clean up staged records
      await ImportStagingRecord.deleteMany({ batchId });

      return res.status(200).json({
        success: true,
        message: `Successfully imported ${totalImported} broker candidate profiles pending approval.`,
        data: {
          batchId: batch.batchId,
          importedRows: totalImported,
          status: batch.status,
        },
      });
    } catch (importErr) {
      batch.status = 'failed';
      await batch.save();
      throw importErr;
    }
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/admin/imports/candidates/:batchId/errors/csv
 * @desc    Download CSV report of skipped or invalid rows with exact reasons
 * @access  Private (Admin only)
 */
const downloadImportErrorsCsv = async (req, res, next) => {
  try {
    const { batchId } = req.params;

    const batch = await ImportBatch.findOne({ batchId });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Import batch not found',
      });
    }

    const errors = batch.errors || [];

    // Build CSV
    const csvRows = ['Row Number,Candidate Name,Candidate Phone,Candidate Email,Error Reasons'];

    for (const err of errors) {
      const escapeCsv = (str) => {
        if (!str) return '""';
        const clean = String(str).replace(/"/g, '""');
        return `"${clean}"`;
      };

      const reasonsJoined = (err.reasons || []).join('; ');
      csvRows.push(
        [
          err.rowNumber,
          escapeCsv(err.candidateName),
          escapeCsv(err.candidatePhone),
          escapeCsv(err.candidateEmail),
          escapeCsv(reasonsJoined),
        ].join(',')
      );
    }

    const csvContent = csvRows.join('\r\n');
    const filename = `import_errors_${batchId}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/admin/imports/candidates/template
 * @desc    Download official starter Excel (.xlsx) template with sample candidate rows
 * @access  Private (Admin only)
 */
const downloadCandidateExcelTemplate = async (req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Candidates');

    worksheet.columns = [
      // 1. Identity & Contact
      { header: 'Candidate Name', key: 'candidateName', width: 22 },
      { header: 'Candidate Phone', key: 'candidatePhone', width: 18 },
      { header: 'Candidate Email', key: 'candidateEmail', width: 26 },
      { header: 'Alternate Phone', key: 'alternatePhone', width: 18 },
      { header: 'Contact Person', key: 'contactPerson', width: 18 },

      // 2. Personal & Physical
      { header: 'Gender', key: 'gender', width: 12 },
      { header: 'Date of Birth', key: 'dob', width: 16 },
      { header: 'Time of Birth', key: 'timeOfBirth', width: 16 },
      { header: 'Place of Birth', key: 'placeOfBirth', width: 20 },
      { header: 'Nativity', key: 'nativity', width: 18 },
      { header: 'Height (cm)', key: 'height', width: 14 },
      { header: 'Weight (kg)', key: 'weight', width: 14 },
      { header: 'Marital Status', key: 'maritalStatus', width: 18 },
      { header: 'Mother Tongue', key: 'motherTongue', width: 16 },
      { header: 'Current Location', key: 'location', width: 20 },
      { header: 'Blood Group', key: 'bloodGroup', width: 14 },
      { header: 'Complexion', key: 'complexion', width: 16 },
      { header: 'Dietary Preference', key: 'diet', width: 18 },
      { header: 'Physical Status', key: 'physicalStatus', width: 16 },

      // 3. Community & Horoscope
      { header: 'Religion', key: 'religion', width: 16 },
      { header: 'Caste', key: 'caste', width: 20 },
      { header: 'Subcaste', key: 'subcaste', width: 20 },
      { header: 'Gothram', key: 'gothram', width: 18 },
      { header: 'Rasi', key: 'rasi', width: 16 },
      { header: 'Nakshatram', key: 'nakshatram', width: 18 },
      { header: 'Padam', key: 'padam', width: 12 },
      { header: 'Lagnam', key: 'lagnam', width: 16 },
      { header: 'Dosham Status', key: 'dosham', width: 18 },
      { header: 'Dasa Balance', key: 'dasaBalance', width: 16 },

      // 4. Education & Career
      { header: 'Education Qualification', key: 'education', width: 24 },
      { header: 'Occupation', key: 'occupation', width: 20 },
      { header: 'Company Name', key: 'company', width: 22 },
      { header: 'Work Location', key: 'workLocation', width: 20 },
      { header: 'Annual Income', key: 'income', width: 16 },

      // 5. Family Details
      { header: 'Father Name', key: 'fatherName', width: 20 },
      { header: 'Father Status', key: 'fatherAlive', width: 16 },
      { header: 'Father Occupation', key: 'fatherOccupation', width: 20 },
      { header: 'Mother Name', key: 'motherName', width: 20 },
      { header: 'Mother Status', key: 'motherAlive', width: 16 },
      { header: 'Mother Occupation', key: 'motherOccupation', width: 20 },
      { header: 'Married Elder Brothers', key: 'marriedElderBrothers', width: 18 },
      { header: 'Unmarried Elder Brothers', key: 'unmarriedElderBrothers', width: 18 },
      { header: 'Married Younger Brothers', key: 'marriedYoungerBrothers', width: 18 },
      { header: 'Unmarried Younger Brothers', key: 'unmarriedYoungerBrothers', width: 18 },
      { header: 'Married Elder Sisters', key: 'marriedElderSisters', width: 18 },
      { header: 'Unmarried Elder Sisters', key: 'unmarriedElderSisters', width: 18 },
      { header: 'Married Younger Sisters', key: 'marriedYoungerSisters', width: 18 },
      { header: 'Unmarried Younger Sisters', key: 'unmarriedYoungerSisters', width: 18 },
      { header: 'Family Details', key: 'familyInfo', width: 28 },
      { header: 'Parent Details', key: 'parentInfo', width: 28 },
      { header: 'Sibling Details', key: 'siblingInfo', width: 28 },
      { header: 'Family Location', key: 'familyLocation', width: 20 },

      // 6. Partner Preferences
      { header: 'Partner Preferred Min Age', key: 'minAge', width: 24 },
      { header: 'Partner Preferred Max Age', key: 'maxAge', width: 24 },
      { header: 'Partner Preferred Location', key: 'prefLocation', width: 24 },
      { header: 'Partner Education Preference', key: 'prefEdu', width: 26 },
      { header: 'Partner Occupation Preference', key: 'prefOcc', width: 26 },
      { header: 'Partner Job Requirement', key: 'jobRequirement', width: 20 },
      { header: 'Partner Caste Preference', key: 'castePreference', width: 22 },
      { header: 'Horoscope Match Required', key: 'horoscopeRequired', width: 22 },
      { header: 'Other Preferences', key: 'otherPrefs', width: 28 },

      // 7. Photos
      { header: 'Photo 1 URL', key: 'photo1', width: 32 },
      { header: 'Photo 2 URL', key: 'photo2', width: 32 },
      { header: 'Photo 3 URL', key: 'photo3', width: 32 },
    ];

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFB85C78' }, // Rose Pink Theme
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 26;

    // Add 2 Sample Rows demonstrating valid entries
    worksheet.addRow({
      candidateName: 'Aditya Ramanathan',
      candidatePhone: '9840112233',
      candidateEmail: 'aditya.sample@example.com',
      gender: 'Male',
      dob: '1995-06-15',
      height: 175,
      maritalStatus: 'Never Married',
      motherTongue: 'Tamil',
      location: 'Chennai, Tamil Nadu',
      education: 'B.Tech Computer Science',
      occupation: 'Software Architect',
      company: 'Tech Solutions India',
      workLocation: 'Chennai',
      income: '18 LPA',
      familyInfo: 'Traditional, cultured nuclear family based in Chennai',
      parentInfo: 'Father retired banker, Mother homemaker',
      siblingInfo: '1 younger sister (unmarried, pursuing MBA)',
      familyLocation: 'Mylapore, Chennai',
      minAge: 24,
      maxAge: 29,
      prefLocation: 'Chennai or Bangalore',
      prefEdu: 'Graduate or Post Graduate',
      prefOcc: 'IT or Corporate Professional',
      otherPrefs: 'Seeking a family-oriented, well-educated partner',
    });

    worksheet.addRow({
      candidateName: 'Kavitha Balasubramanian',
      candidatePhone: '9840998877',
      candidateEmail: 'kavitha.sample@example.com',
      gender: 'Female',
      dob: '1997-09-22',
      height: 162,
      maritalStatus: 'Never Married',
      motherTongue: 'Tamil',
      location: 'Coimbatore, Tamil Nadu',
      education: 'M.Sc Biotechnology',
      occupation: 'Research Scientist',
      company: 'BioPharma Labs',
      workLocation: 'Coimbatore',
      income: '12 LPA',
      familyInfo: 'Modern values with deep cultural roots',
      parentInfo: 'Father businessman, Mother school teacher',
      siblingInfo: '1 elder brother (married, in USA)',
      familyLocation: 'RS Puram, Coimbatore',
      minAge: 27,
      maxAge: 32,
      prefLocation: 'Tamil Nadu or Bangalore',
      prefEdu: 'Professional degree (B.Tech / MBA / MS)',
      prefOcc: 'Working professional',
      otherPrefs: 'Looking for a kind, caring, and progressive life partner',
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="broker_candidate_import_template.xlsx"'
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  validateCandidateImport,
  commitCandidateImport,
  downloadImportErrorsCsv,
  downloadCandidateExcelTemplate,
};
