/**
 * Safe, Idempotent Synthetic Candidate Seeder for Evening Demonstration
 * 
 * Safety Invariants:
 * 1. Strictly targets local isolated test DB 'matrimony_phase5c_test'.
 * 2. Asserts mongoose.connection.name === 'matrimony_phase5c_test' before ANY write.
 * 3. Never overwrites or modifies existing records (preserves Priya and existing users).
 * 4. Strictly synthetic data with dummy 555-style/reserved test phone numbers and example.com emails.
 * 5. Idempotent: Can be run multiple times safely without creating duplicates.
 * 
 * Usage:
 *   node scripts/seedDemoCandidates.js
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const EXPECTED_TEST_DB = 'matrimony_phase5c_test';
const TEST_DB_URI = process.env.MONGODB_URI && process.env.MONGODB_URI.includes(EXPECTED_TEST_DB)
  ? process.env.MONGODB_URI
  : 'mongodb://127.0.0.1:27017/matrimony_phase5c_test';

const MatrimonialProfile = require('../models/MatrimonialProfile');

const DEMO_SYNTHETIC_CANDIDATES = [
  {
    candidateName: 'Kavitha Sundaram',
    candidatePhone: '+919876540001',
    candidateEmail: 'kavitha.sundaram.demo@example.com',
    source: 'broker',
    approvalStatus: 'approved',
    profileStatus: 'active',
    user: null,
    personalDetails: {
      gender: 'Female',
      dateOfBirth: new Date('1996-08-24'),
      height: 162,
      maritalStatus: 'Never Married',
      motherTongue: 'Tamil',
      location: 'Chennai, Tamil Nadu',
    },
    communityDetails: {
      religion: 'Hindu',
      caste: 'Vellalar',
      subcaste: 'Thondaimandalam',
      gothram: 'Siva',
    },
    educationAndProfession: {
      educationalQualification: 'B.Tech Information Technology',
      occupation: 'Senior Software Engineer',
      company: 'Tech Solutions Ltd',
      workLocation: 'Chennai',
      income: '18-22 LPA',
    },
    familyDetails: {
      familyInformation: 'Upper middle class traditional family',
      parentInformation: 'Father retired bank manager, mother school teacher',
      siblingInformation: 'One elder brother (married, living in Singapore)',
      familyLocation: 'Chennai',
    },
    partnerPreferences: {
      preferredAgeRange: { min: 28, max: 34 },
      preferredLocation: 'Chennai / Bangalore',
      educationPreference: 'BE / B.Tech / ME / MBA',
      occupationPreference: 'Software / Engineering / Banking',
      otherPreferences: 'Non-smoker, vegetarian / eggetarian preferred',
    },
    horoscope: {
      isGenerated: false,
      isSimulated: false,
      rasi: 'Simham',
      nakshatram: 'Magam',
      padam: 2,
      lagnam: 'Dhanusu',
      timeOfBirth: '07:45 AM',
      placeOfBirth: 'Chennai',
      timezone: '+05:30',
      dosham: { hasChevvaiDosham: false, hasNagaDosham: false, doshamSummary: 'No dosham' },
    },
  },
  {
    candidateName: 'Karthik Natarajan',
    candidatePhone: '+919876540002',
    candidateEmail: 'karthik.natarajan.demo@example.com',
    source: 'broker',
    approvalStatus: 'approved',
    profileStatus: 'active',
    user: null,
    personalDetails: {
      gender: 'Male',
      dateOfBirth: new Date('1993-11-12'),
      height: 178,
      maritalStatus: 'Never Married',
      motherTongue: 'Tamil',
      location: 'Coimbatore, Tamil Nadu',
    },
    communityDetails: {
      religion: 'Hindu',
      caste: 'Gounder',
      subcaste: 'Kongu',
      gothram: 'Kasyapa',
    },
    educationAndProfession: {
      educationalQualification: 'M.S. Mechanical Engineering',
      occupation: 'Design Engineer',
      company: 'L&T Technology Services',
      workLocation: 'Coimbatore',
      income: '22-26 LPA',
    },
    familyDetails: {
      familyInformation: 'Respected industrial and agricultural family in Kongu region',
      parentInformation: 'Father running manufacturing business, mother homemaker',
      siblingInformation: 'One younger sister (completed MBBS)',
      familyLocation: 'Coimbatore',
    },
    partnerPreferences: {
      preferredAgeRange: { min: 25, max: 30 },
      preferredLocation: 'Coimbatore / Tirupur / Erode / Chennai',
      educationPreference: 'Graduate / Post Graduate',
      occupationPreference: 'Professional or working',
    },
    horoscope: {
      isGenerated: false,
      isSimulated: false,
      rasi: 'Mesham',
      nakshatram: 'Ashwini',
      padam: 3,
      lagnam: 'Mesham',
      timeOfBirth: '10:15 AM',
      placeOfBirth: 'Coimbatore',
      timezone: '+05:30',
      dosham: { hasChevvaiDosham: false, hasNagaDosham: false, doshamSummary: 'No dosham' },
    },
  },
  {
    candidateName: 'Deepa Swaminathan',
    candidatePhone: '+919876540003',
    candidateEmail: 'deepa.swaminathan.demo@example.com',
    source: 'broker',
    approvalStatus: 'approved',
    profileStatus: 'active',
    user: null,
    personalDetails: {
      gender: 'Female',
      dateOfBirth: new Date('1998-02-18'),
      height: 165,
      maritalStatus: 'Never Married',
      motherTongue: 'Tamil',
      location: 'Madurai, Tamil Nadu',
    },
    communityDetails: {
      religion: 'Hindu',
      caste: 'Brahmin',
      subcaste: 'Vadama',
      gothram: 'Bharadwaj',
    },
    educationAndProfession: {
      educationalQualification: 'M.Sc Biotechnology',
      occupation: 'Research Associate',
      company: 'Apollo Biomedical Research',
      workLocation: 'Madurai',
      income: '12-16 LPA',
    },
    familyDetails: {
      familyInformation: 'Cultured orthodox family with musical traditions',
      parentInformation: 'Father audit consultant, mother classical vocalist',
      siblingInformation: 'Only child',
      familyLocation: 'Madurai',
    },
    partnerPreferences: {
      preferredAgeRange: { min: 27, max: 32 },
      preferredLocation: 'Madurai / Chennai / Bangalore',
      educationPreference: 'Post Graduate / Professional',
    },
    horoscope: {
      isGenerated: false,
      isSimulated: false,
      rasi: 'Kanni',
      nakshatram: 'Hastham',
      padam: 1,
      lagnam: 'Kanni',
      timeOfBirth: '06:30 AM',
      placeOfBirth: 'Madurai',
      timezone: '+05:30',
      dosham: { hasChevvaiDosham: false, hasNagaDosham: false, doshamSummary: 'No dosham' },
    },
  },
  {
    candidateName: 'Vigneshwaran Balaji',
    candidatePhone: '+919876540004',
    candidateEmail: 'vignesh.balaji.demo@example.com',
    source: 'broker',
    approvalStatus: 'approved',
    profileStatus: 'active',
    user: null,
    personalDetails: {
      gender: 'Male',
      dateOfBirth: new Date('1992-05-30'),
      height: 182,
      maritalStatus: 'Never Married',
      motherTongue: 'Tamil',
      location: 'Bangalore, Karnataka',
    },
    communityDetails: {
      religion: 'Hindu',
      caste: 'Mudaliar',
      subcaste: 'Arcot',
      gothram: 'Vishnu',
    },
    educationAndProfession: {
      educationalQualification: 'M.Tech Data Science',
      occupation: 'Data Platform Architect',
      company: 'Informatica Cloud',
      workLocation: 'Bangalore',
      income: '32-38 LPA',
    },
    familyDetails: {
      familyInformation: 'Well-settled family in Bangalore with roots in Vellore',
      parentInformation: 'Father retired central government officer, mother homemaker',
      siblingInformation: 'One elder sister (married, physician)',
      familyLocation: 'Bangalore',
    },
    partnerPreferences: {
      preferredAgeRange: { min: 26, max: 31 },
      preferredLocation: 'Bangalore / Chennai',
      educationPreference: 'Engineering / Masters / Professional',
    },
    horoscope: {
      isGenerated: false,
      isSimulated: false,
      rasi: 'Rishabham',
      nakshatram: 'Rohini',
      padam: 4,
      lagnam: 'Mithunam',
      timeOfBirth: '02:20 PM',
      placeOfBirth: 'Bangalore',
      timezone: '+05:30',
      dosham: { hasChevvaiDosham: false, hasNagaDosham: false, doshamSummary: 'No dosham' },
    },
  },
  {
    candidateName: 'Meenakshi Sundaresan',
    candidatePhone: '+919876540005',
    candidateEmail: 'meenakshi.sundaresan.demo@example.com',
    source: 'broker',
    approvalStatus: 'approved',
    profileStatus: 'active',
    user: null,
    personalDetails: {
      gender: 'Female',
      dateOfBirth: new Date('1995-12-05'),
      height: 158,
      maritalStatus: 'Never Married',
      motherTongue: 'Tamil',
      location: 'Trichy, Tamil Nadu',
    },
    communityDetails: {
      religion: 'Hindu',
      caste: 'Chettiar',
      subcaste: 'Nattukottai',
      gothram: 'Vasistha',
    },
    educationAndProfession: {
      educationalQualification: 'Chartered Accountant (CA)',
      occupation: 'Senior Audit Specialist',
      company: 'Ernst & Young (EY)',
      workLocation: 'Trichy',
      income: '20-25 LPA',
    },
    familyDetails: {
      familyInformation: 'Distinguished Chettiar business lineage',
      parentInformation: 'Father trading firm proprietor, mother homemaker',
      siblingInformation: 'One younger brother managing export business',
      familyLocation: 'Trichy',
    },
    partnerPreferences: {
      preferredAgeRange: { min: 28, max: 34 },
      preferredLocation: 'Tamil Nadu / Chennai / Bangalore',
      educationPreference: 'CA / MBA / BE / Masters',
    },
    horoscope: {
      isGenerated: false,
      isSimulated: false,
      rasi: 'Thulam',
      nakshatram: 'Swati',
      padam: 2,
      lagnam: 'Thulam',
      timeOfBirth: '09:00 AM',
      placeOfBirth: 'Trichy',
      timezone: '+05:30',
      dosham: { hasChevvaiDosham: false, hasNagaDosham: false, doshamSummary: 'No dosham' },
    },
  },
  {
    candidateName: 'Saravanan Ramasamy',
    candidatePhone: '+919876540006',
    candidateEmail: 'saravanan.ramasamy.demo@example.com',
    source: 'broker',
    approvalStatus: 'approved',
    profileStatus: 'active',
    user: null,
    personalDetails: {
      gender: 'Male',
      dateOfBirth: new Date('1994-09-14'),
      height: 175,
      maritalStatus: 'Never Married',
      motherTongue: 'Tamil',
      location: 'Salem, Tamil Nadu',
    },
    communityDetails: {
      religion: 'Hindu',
      caste: 'Naidu',
      subcaste: 'Kamma',
      gothram: 'Kasyapa',
    },
    educationAndProfession: {
      educationalQualification: 'B.Arch Architecture',
      occupation: 'Principal Architect',
      company: 'Studio Form & Space',
      workLocation: 'Salem',
      income: '18-24 LPA',
    },
    familyDetails: {
      familyInformation: 'Established architectural and construction consultancy family',
      parentInformation: 'Father civil contractor, mother homemaker',
      siblingInformation: 'One elder brother (Structural engineer)',
      familyLocation: 'Salem',
    },
    partnerPreferences: {
      preferredAgeRange: { min: 25, max: 30 },
      preferredLocation: 'Salem / Coimbatore / Chennai',
      educationPreference: 'Graduate / Post Graduate',
    },
    horoscope: {
      isGenerated: false,
      isSimulated: false,
      rasi: 'Mithunam',
      nakshatram: 'Thiruvathirai',
      padam: 3,
      lagnam: 'Dhanusu',
      timeOfBirth: '11:45 PM',
      placeOfBirth: 'Salem',
      timezone: '+05:30',
      dosham: { hasChevvaiDosham: false, hasNagaDosham: false, doshamSummary: 'No dosham' },
    },
  },
  {
    candidateName: 'Aravind Subramanian',
    candidatePhone: '+919876540007',
    candidateEmail: 'aravind.subramanian.demo@example.com',
    source: 'broker',
    approvalStatus: 'pending_approval', // FOR DEMO: Admin approval workflow
    profileStatus: 'active',
    user: null,
    personalDetails: {
      gender: 'Male',
      dateOfBirth: new Date('1996-03-22'),
      height: 172,
      maritalStatus: 'Never Married',
      motherTongue: 'Tamil',
      location: 'Chennai, Tamil Nadu',
    },
    communityDetails: {
      religion: 'Hindu',
      caste: 'Vellalar',
      subcaste: 'Saiva',
      gothram: 'Siva',
    },
    educationAndProfession: {
      educationalQualification: 'B.E. Electronics & Communication',
      occupation: 'Embedded Systems Engineer',
      company: 'Bosch Automotive',
      workLocation: 'Chennai',
      income: '15-18 LPA',
    },
    familyDetails: {
      familyInformation: 'Traditional Saiva Vellalar family',
      parentInformation: 'Father retired TNEB engineer, mother homemaker',
      siblingInformation: 'One younger sister (studying B.Tech)',
      familyLocation: 'Chennai',
    },
    partnerPreferences: {
      preferredAgeRange: { min: 24, max: 28 },
      preferredLocation: 'Chennai / Coimbatore',
      educationPreference: 'BE / B.Tech / MCA / Science Graduate',
    },
    horoscope: {
      isGenerated: false,
      isSimulated: false,
      rasi: 'Meenam',
      nakshatram: 'Revathi',
      padam: 4,
      lagnam: 'Mesham',
      timeOfBirth: '05:15 PM',
      placeOfBirth: 'Chennai',
      timezone: '+05:30',
      dosham: { hasChevvaiDosham: false, hasNagaDosham: false, doshamSummary: 'No dosham' },
    },
  },
  {
    candidateName: 'Sangeetha Krishnan',
    candidatePhone: '+919876540008',
    candidateEmail: 'sangeetha.krishnan.demo@example.com',
    source: 'broker',
    approvalStatus: 'approved',
    profileStatus: 'active',
    user: null,
    personalDetails: {
      gender: 'Female',
      dateOfBirth: new Date('1997-10-18'),
      height: 160,
      maritalStatus: 'Never Married',
      motherTongue: 'Tamil',
      location: 'Chennai, Tamil Nadu',
    },
    communityDetails: {
      religion: 'Hindu',
      caste: 'Vellalar',
      subcaste: 'Sozhiya',
      gothram: 'Vishnu',
    },
    educationAndProfession: {
      educationalQualification: 'M.A. English Literature & B.Ed',
      occupation: 'High School Educator',
      company: 'DAV Senior Secondary School',
      workLocation: 'Chennai',
      income: '8-12 LPA',
    },
    familyDetails: {
      familyInformation: 'Academically focused family in Chennai',
      parentInformation: 'Father college professor, mother librarian',
      siblingInformation: 'Only daughter',
      familyLocation: 'Chennai',
    },
    partnerPreferences: {
      preferredAgeRange: { min: 28, max: 33 },
      preferredLocation: 'Chennai / Bangalore / Coimbatore',
      educationPreference: 'Post Graduate / Professional',
    },
    horoscope: {
      isGenerated: false,
      isSimulated: false,
      rasi: 'Mesham',
      nakshatram: 'Bharani',
      padam: 1,
      lagnam: 'Simham',
      timeOfBirth: '04:10 AM',
      placeOfBirth: 'Chennai',
      timezone: '+05:30',
      dosham: { hasChevvaiDosham: false, hasNagaDosham: false, doshamSummary: 'No dosham' },
    },
  },
];

async function seedDemoData() {
  console.log('========================================================================');
  console.log(' Safe Synthetic Demo Candidate Seeder');
  console.log(' Target DB:', EXPECTED_TEST_DB);
  console.log('========================================================================\n');

  // Strict Database Safety Guard
  await mongoose.connect(TEST_DB_URI);
  if (mongoose.connection.name !== EXPECTED_TEST_DB) {
    throw new Error(`CRITICAL ABORT: Connected to '${mongoose.connection.name}' instead of '${EXPECTED_TEST_DB}'. Refusing to write.`);
  }
  console.log(`✓ Confirmed connection to isolated test database: ${mongoose.connection.name}`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const candidate of DEMO_SYNTHETIC_CANDIDATES) {
    // Check if duplicate already exists by candidatePhone or candidateEmail
    const existing = await MatrimonialProfile.findOne({
      $or: [
        { candidatePhone: candidate.candidatePhone },
        { candidateEmail: candidate.candidateEmail },
        { candidateName: candidate.candidateName },
      ],
    });

    if (existing) {
      console.log(`  - [SKIP] '${candidate.candidateName}' already exists (ID: ${existing._id})`);
      skippedCount++;
    } else {
      const created = await MatrimonialProfile.create(candidate);
      console.log(`  + [CREATED] '${created.candidateName}' (${created.approvalStatus}, ${created.communityDetails.caste}, ${created.personalDetails.location}) -> ID: ${created._id}`);
      createdCount++;
    }
  }

  // Summary counts
  const totalProfiles = await MatrimonialProfile.countDocuments({});
  const approvedActive = await MatrimonialProfile.countDocuments({ approvalStatus: 'approved', profileStatus: 'active' });
  const pendingApproval = await MatrimonialProfile.countDocuments({ approvalStatus: 'pending_approval' });
  const unlinkedCount = await MatrimonialProfile.countDocuments({ user: null });
  const linkedCount = await MatrimonialProfile.countDocuments({ user: { $ne: null } });

  console.log('\n------------------------------------------------------------------------');
  console.log(`Seeding Result: ${createdCount} created, ${skippedCount} skipped.`);
  console.log('Database Profile Breakdown:');
  console.log(`  Total Profiles in ${EXPECTED_TEST_DB}: ${totalProfiles}`);
  console.log(`  Approved & Active: ${approvedActive}`);
  console.log(`  Pending Approval (Admin workflow demo): ${pendingApproval}`);
  console.log(`  Unlinked Broker Profiles (Invite demo): ${unlinkedCount}`);
  console.log(`  Linked Member Profiles: ${linkedCount}`);
  console.log('------------------------------------------------------------------------');

  await mongoose.disconnect();
}

seedDemoData().catch((err) => {
  console.error('\n✗ Seeding Aborted:', err.message);
  process.exit(1);
});
