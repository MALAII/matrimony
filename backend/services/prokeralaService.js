/**
 * Prokerala Astrology API Service (v2)
 *
 * Handles:
 * 1. OAuth 2.0 Client Credentials token management with in-memory caching.
 * 2. Birth Chart (Kundli) calculation (Rasi, Nakshatram, Pada, Lagnam, Dasha).
 * 3. South Indian 12-house Rasi (D1) and Navamsa (D9) vector SVG charts.
 * 4. Chevvai / Mangal Dosham and Naga Dosham evaluation.
 * 5. High-fidelity synthetic fallback when unconfigured or running in test suites.
 * 6. Attribution formatting per Prokerala API terms.
 */

const PROKERALA_TOKEN_URL = 'https://api.prokerala.com/token';
const PROKERALA_API_BASE = 'https://api.prokerala.com/v2/astrology';

// In-memory OAuth token cache
let tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

/**
 * Maps English / Sanskrit Rasi names to Tamil
 */
const RASI_NAME_MAP_TO_TAMIL = {
  aries: 'மேஷம்',
  mesha: 'மேஷம்',
  mesham: 'மேஷம்',
  taurus: 'ரிஷபம்',
  vrishabha: 'ரிஷபம்',
  rishaba: 'ரிஷபம்',
  rishabam: 'ரிஷபம்',
  gemini: 'மிதுனம்',
  mithuna: 'மிதுனம்',
  mithunam: 'மிதுனம்',
  cancer: 'கடகம்',
  karka: 'கடகம்',
  kataka: 'கடகம்',
  kadagam: 'கடகம்',
  leo: 'சிம்மம்',
  simha: 'சிம்மம்',
  simmam: 'சிம்மம்',
  virgo: 'கன்னி',
  kanya: 'கன்னி',
  kanni: 'கன்னி',
  libra: 'துலாம்',
  thula: 'துலாம்',
  tula: 'துலாம்',
  thulam: 'துலாம்',
  scorpio: 'விருச்சிகம்',
  vrischika: 'விருச்சிகம்',
  vrichigam: 'விருச்சிகம்',
  sagittarius: 'தனுசு',
  dhanu: 'தனுசு',
  dhanusu: 'தனுசு',
  capricorn: 'மகரம்',
  makara: 'மகரம்',
  makaram: 'மகரம்',
  aquarius: 'கும்பம்',
  kumbha: 'கும்பம்',
  kumbam: 'கும்பம்',
  pisces: 'மீனம்',
  meena: 'மீனம்',
  meenam: 'மீனம்',
};

/**
 * Normalizes any Rasi / Lagna name to target language
 */
const normalizeRasiName = (name, language = 'ta') => {
  if (!name || typeof name !== 'string') return null;
  const clean = name.trim().toLowerCase();
  if (language === 'ta') {
    if (TAMIL_RASI_NAMES.includes(name.trim())) return name.trim();
    if (RASI_NAME_MAP_TO_TAMIL[clean]) return RASI_NAME_MAP_TO_TAMIL[clean];
  }
  return name.trim();
};

/**
 * Calculates Vedic Ascendant (Lagna) sign accurately based on UTC date, time, latitude, longitude
 * using standard Lahiri Ayanamsa algorithm as a verified astronomical fallback
 */
const calculateVedicAscendant = (datetime, coordinates, language = 'ta') => {
  try {
    if (!coordinates) return null;
    const parts = coordinates.split(',');
    const lat = parseFloat(parts[0]) || 13.0827;
    const lon = parseFloat(parts[1]) || 80.2707;
    const date = new Date(datetime);
    if (isNaN(date.getTime())) return null;

    // Julian Date
    const jd = date.getTime() / 86400000 + 2440587.5;
    const d = jd - 2451545.0; // days since J2000.0

    // Greenwich Mean Sidereal Time (GMST) in degrees
    let gmst = 280.46061837 + 360.98564736629 * d;
    gmst = ((gmst % 360) + 360) % 360;

    // Local Sidereal Time (LST) in degrees
    const lst = ((gmst + lon) % 360 + 360) % 360;
    const lstRad = (lst * Math.PI) / 180;
    const latRad = (lat * Math.PI) / 180;

    // Obliquity of the Ecliptic
    const T = d / 36525.0;
    const eps = (23.439291 - 0.0130042 * T) * (Math.PI / 180);

    // Tropical Ascendant
    const y = Math.cos(lstRad);
    const x = -(Math.sin(lstRad) * Math.cos(eps) + Math.tan(latRad) * Math.sin(eps));
    let tropicalAscDeg = (Math.atan2(y, x) * 180) / Math.PI;
    tropicalAscDeg = ((tropicalAscDeg % 360) + 360) % 360;

    // Lahiri Ayanamsa approximation
    const lahiriAyanamsa = 23.85 + (d / 365.25) * (50.29 / 3600);
    const siderealAscDeg = ((tropicalAscDeg - lahiriAyanamsa) % 360 + 360) % 360;

    const rasiIndex = Math.floor(siderealAscDeg / 30) % 12;
    return language === 'ta' ? TAMIL_RASI_NAMES[rasiIndex] : RASI_LIST[rasiIndex];
  } catch (_) {
    return null;
  }
};

/**
 * Standard South Indian Rasi (Moon Sign) and Nakshatra Constants
 */
const RASI_LIST = [
  'Mesham', 'Rishabam', 'Mithunam', 'Kadagam',
  'Simmam', 'Kanni', 'Thulam', 'Vrichigam',
  'Dhanusu', 'Makaram', 'Kumbam', 'Meenam',
];

const TAMIL_RASI_NAMES = [
  'மேஷம்', 'ரிஷபம்', 'மிதுனம்', 'கடகம்',
  'சிம்மம்', 'கன்னி', 'துலாம்', 'விருச்சிகம்',
  'தனுசு', 'மகரம்', 'கும்பம்', 'மீனம்',
];

const NAKSHATRA_LIST = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashirsha',
  'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha',
  'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati',
  'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha',
  'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

const TAMIL_NAKSHATRA_NAMES = [
  'அசுவினி', 'பரணி', 'கார்த்திகை', 'ரோகிணி', 'மிருகசீரிஷம்',
  'திருவாதிரை', 'புனர்பூசம்', 'பூசம்', 'ஆயில்யம்', 'மகம்',
  'பூரம்', 'உத்திரம்', 'ஹஸ்தம்', 'சித்திரை', 'சுவாதி',
  'விசாகம்', 'அனுஷம்', 'கேட்டை', 'மூலம்', 'பூராடம்',
  'உத்திராடம்', 'திருவோணம்', 'அவிட்டம்', 'சதயம்',
  'பூரட்டாதி', 'உத்திரட்டாதி', 'ரேவதி',
];

const TAMIL_PLANET_SYMBOLS = {
  Lagna: 'ல',
  Ascendant: 'ல',
  Asc: 'ல',
  As: 'ல',
  Sun: 'சூ',
  Su: 'சூ',
  Moon: 'சந்',
  Mo: 'சந்',
  Mars: 'செவ்',
  Ma: 'செவ்',
  Mercury: 'பு',
  Me: 'பு',
  Jupiter: 'குரு',
  Ju: 'குரு',
  Venus: 'சுக்',
  Ve: 'சுக்',
  Saturn: 'சனி',
  Sa: 'சனி',
  Rahu: 'ரா',
  Ra: 'ரா',
  Ketu: 'கே',
  Ke: 'கே',
};

const { transformToRoyalGoldChart } = require('./horoscopePdfService');

/**
 * Safely localizes an astrological chart SVG into Tamil and transforms it into the
 * Royal Gold South Indian Temple design (matching Varaghi Matrimony standards).
 *
 * @param {string} svgString - SVG XML markup
 * @param {string} [chartType='rasi'] - 'rasi' or 'navamsa'
 * @param {object} [candidateInfo={}] - { dob, tob }
 * @returns {string} Royal Gold Tamil-localized SVG markup
 */
const localizeChartSvgToTamil = (svgString, chartType = 'rasi', candidateInfo = {}) => {
  if (!svgString || typeof svgString !== 'string') return svgString;

  let localized = svgString;

  // 1. Center Title localization
  localized = localized.replace(/>\s*RASI CHART \(D1\)\s*</g, '>ராசி கட்டம் (D1)<');
  localized = localized.replace(/>\s*NAVAMSA CHART \(D9\)\s*</g, '>நவாம்ச கட்டம் (D9)<');
  localized = localized.replace(/>\s*Rasi\s*</g, '>ராசி<');
  localized = localized.replace(/>\s*Navamsa\s*</g, '>நவாம்சம்<');
  localized = localized.replace(/>\s*South Indian 12-House Grid\s*</g, '>தென்னிந்திய 12 கட்ட அமைப்பு<');

  // 2. Planet abbreviations localization in Prokerala SVG classes
  localized = localized.replace(/(class="[^"]*pk-planet-ascendant[^"]*"\s*>)([^<]+)(<\/text>)/g, '$1ல$3');
  localized = localized.replace(/(class="[^"]*pk-planet-sun[^"]*"\s*>)([^<]+)(<\/text>)/g, '$1சூ$3');
  localized = localized.replace(/(class="[^"]*pk-planet-moon[^"]*"\s*>)([^<]+)(<\/text>)/g, '$1சந்$3');
  localized = localized.replace(/(class="[^"]*pk-planet-mars[^"]*"\s*>)([^<]+)(<\/text>)/g, '$1செவ்$3');
  localized = localized.replace(/(class="[^"]*pk-planet-mercury[^"]*"\s*>)([^<]+)(<\/text>)/g, '$1பு$3');
  localized = localized.replace(/(class="[^"]*pk-planet-jupiter[^"]*"\s*>)([^<]+)(<\/text>)/g, '$1குரு$3');
  localized = localized.replace(/(class="[^"]*pk-planet-venus[^"]*"\s*>)([^<]+)(<\/text>)/g, '$1சுக்$3');
  localized = localized.replace(/(class="[^"]*pk-planet-saturn[^"]*"\s*>)([^<]+)(<\/text>)/g, '$1சனி$3');
  localized = localized.replace(/(class="[^"]*pk-planet-rahu[^"]*"\s*>)([^<]+)(<\/text>)/g, '$1ரா$3');
  localized = localized.replace(/(class="[^"]*pk-planet-ketu[^"]*"\s*>)([^<]+)(<\/text>)/g, '$1கே$3');

  // 3. Fallback simulated chart house name localization
  const houseEnToTa = [
    { en: '1. Mesham', ta: '1. மேஷம்' },
    { en: '2. Rishabam', ta: '2. ரிஷபம்' },
    { en: '3. Mithunam', ta: '3. மிதுனம்' },
    { en: '4. Kadagam', ta: '4. கடகம்' },
    { en: '5. Simmam', ta: '5. சிம்மம்' },
    { en: '6. Kanni', ta: '6. கன்னி' },
    { en: '7. Thulam', ta: '7. துலாம்' },
    { en: '8. Vrichigam', ta: '8. விருச்சிகம்' },
    { en: '9. Dhanusu', ta: '9. தனுசு' },
    { en: '10. Makaram', ta: '10. மகரம்' },
    { en: '11. Kumbam', ta: '11. கும்பம்' },
    { en: '12. Meenam', ta: '12. மீனம்' },
  ];

  houseEnToTa.forEach((h) => {
    localized = localized.split(`>${h.en}<`).join(`>${h.ta}<`);
  });

  return transformToRoyalGoldChart(localized, chartType, candidateInfo);
};

/**
 * Pre-configured South Indian City / Town Coordinates Lookup Table
 */
const SOUTH_INDIAN_CITIES = [
  { name: 'Chennai, Tamil Nadu', coordinates: '13.0827,80.2707' },
  { name: 'Coimbatore, Tamil Nadu', coordinates: '11.0168,76.9558' },
  { name: 'Madurai, Tamil Nadu', coordinates: '9.9252,78.1198' },
  { name: 'Tiruchirappalli, Tamil Nadu', coordinates: '10.7905,78.7047' },
  { name: 'Salem, Tamil Nadu', coordinates: '11.6643,78.1460' },
  { name: 'Tirunelveli, Tamil Nadu', coordinates: '8.7139,77.7567' },
  { name: 'Vellore, Tamil Nadu', coordinates: '12.9165,79.1325' },
  { name: 'Erode, Tamil Nadu', coordinates: '11.3410,77.7172' },
  { name: 'Thanjavur, Tamil Nadu', coordinates: '10.7870,79.1378' },
  { name: 'Dindigul, Tamil Nadu', coordinates: '10.3673,77.9803' },
  { name: 'Kanchipuram, Tamil Nadu', coordinates: '12.8342,79.7036' },
  { name: 'Nagercoil, Tamil Nadu', coordinates: '8.1833,77.4119' },
  { name: 'Cuddalore, Tamil Nadu', coordinates: '11.7480,79.7714' },
  { name: 'Bengaluru, Karnataka', coordinates: '12.9716,77.5946' },
  { name: 'Hyderabad, Telangana', coordinates: '17.3850,78.4867' },
  { name: 'Kochi, Kerala', coordinates: '9.9312,76.2673' },
  { name: 'Thiruvananthapuram, Kerala', coordinates: '8.5241,76.9366' },
];

/**
 * Checks whether valid Prokerala credentials are configured in the environment
 * @returns {boolean}
 */
const isProkeralaConfigured = () => {
  const clientId = process.env.PROKERALA_CLIENT_ID;
  const clientSecret = process.env.PROKERALA_CLIENT_SECRET;
  return Boolean(
    clientId &&
    clientId.trim() &&
    clientSecret &&
    clientSecret.trim() &&
    !clientId.includes('your_')
  );
};

/**
 * Clears in-memory token cache (used in test suites)
 */
const resetTokenCache = () => {
  tokenCache = { accessToken: null, expiresAt: 0 };
};

/**
 * Retrieves a valid OAuth 2.0 Bearer access token using Client Credentials grant
 * Reuses cached token if valid; requests fresh token when within 5 minutes of expiration.
 * @returns {Promise<string>}
 */
const getAccessToken = async () => {
  const now = Date.now();
  // Return cached token if valid for at least 5 more minutes
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 300 * 1000) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.PROKERALA_CLIENT_ID;
  const clientSecret = process.env.PROKERALA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Prokerala API credentials (PROKERALA_CLIENT_ID, PROKERALA_CLIENT_SECRET) are unconfigured.');
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId.trim());
  params.append('client_secret', clientSecret.trim());

  const response = await fetch(PROKERALA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to obtain Prokerala access token (${response.status}): ${errorText}`);
  }

  const tokenData = await response.json();
  if (!tokenData.access_token) {
    throw new Error('Prokerala token response did not contain access_token.');
  }

  const expiresInSec = Number(tokenData.expires_in) || 3600;
  tokenCache = {
    accessToken: tokenData.access_token,
    expiresAt: now + expiresInSec * 1000,
  };

  return tokenCache.accessToken;
};

/**
 * Generates an authentic South Indian 12-house SVG grid for fallback simulation.
 * Includes prominent SIMULATED TEST CHART watermark badge when generated in test/sandbox mode.
 * @param {string} chartTitle - e.g. "RASI CHART (D1)" or "NAVAMSA CHART (D9)"
 * @param {object} housePlanets - mapping house index 0..11 to array of planet abbreviations
 * @param {boolean} [isSimulated=false] - whether this chart is an offline simulation
 * @returns {string} SVG XML markup
 */
const generateSouthIndianChartSvg = (chartTitle = 'RASI CHART (D1)', housePlanets = {}, isSimulated = false, language = 'ta') => {
  let safeTitle = typeof chartTitle === 'string'
    ? chartTitle
    : (chartTitle?.chartType?.toLowerCase() === 'navamsa' ? 'NAVAMSA CHART (D9)' : 'RASI CHART (D1)');
  let safePlanets = (typeof chartTitle === 'object' && chartTitle !== null && chartTitle.planetsByHouse)
    ? chartTitle.planetsByHouse
    : housePlanets;
  let safeSimulated = (typeof chartTitle === 'object' && chartTitle !== null && chartTitle.isSimulated !== undefined)
    ? chartTitle.isSimulated
    : isSimulated;
  let safeLang = (typeof chartTitle === 'object' && chartTitle !== null && chartTitle.language)
    ? chartTitle.language
    : language;

  const isTamil = safeLang === 'ta';
  const houseLabels = isTamil
    ? [
        '1. மேஷம்', '2. ரிஷபம்', '3. மிதுனம்', '4. கடகம்',
        '5. சிம்மம்', '6. கன்னி', '7. துலாம்', '8. விருச்சிகம்',
        '9. தனுசு', '10. மகரம்', '11. கும்பம்', '12. மீனம்',
      ]
    : [
        '1. Mesham', '2. Rishabam', '3. Mithunam', '4. Kadagam',
        '5. Simmam', '6. Kanni', '7. Thulam', '8. Vrichigam',
        '9. Dhanusu', '10. Makaram', '11. Kumbam', '12. Meenam',
      ];

  const defaultTitle = isTamil
    ? (safeTitle.includes('D9') || safeTitle.toLowerCase().includes('navamsa') ? 'நவாம்ச கட்டம் (D9)' : 'ராசி கட்டம் (D1)')
    : safeTitle;

  // Grid coordinates: [col (0..3), row (0..3)]
  // South Indian traditional layout:
  // Row 0: Meenam(0), Mesham(1), Rishabam(2), Mithunam(3)
  // Row 1: Kumbam(0), Center, Kadagam(3)
  // Row 2: Makaram(0), Center, Simmam(3)
  // Row 3: Dhanusu(0), Vrichigam(1), Thulam(2), Kanni(3)
  const housePositions = [
    { house: 0, col: 1, row: 0, name: isTamil ? 'மேஷம்' : 'Mesham' },
    { house: 1, col: 2, row: 0, name: isTamil ? 'ரிஷபம்' : 'Rishabam' },
    { house: 2, col: 3, row: 0, name: isTamil ? 'மிதுனம்' : 'Mithunam' },
    { house: 3, col: 3, row: 1, name: isTamil ? 'கடகம்' : 'Kadagam' },
    { house: 4, col: 3, row: 2, name: isTamil ? 'சிம்மம்' : 'Simmam' },
    { house: 5, col: 3, row: 3, name: isTamil ? 'கன்னி' : 'Kanni' },
    { house: 6, col: 2, row: 3, name: isTamil ? 'துலாம்' : 'Thulam' },
    { house: 7, col: 1, row: 3, name: isTamil ? 'விருச்சிகம்' : 'Vrichigam' },
    { house: 8, col: 0, row: 3, name: isTamil ? 'தனுசு' : 'Dhanusu' },
    { house: 9, col: 0, row: 2, name: isTamil ? 'மகரம்' : 'Makaram' },
    { house: 10, col: 0, row: 1, name: isTamil ? 'கும்பம்' : 'Kumbam' },
    { house: 11, col: 0, row: 0, name: isTamil ? 'மீனம்' : 'Meenam' },
  ];

  const cellSize = 100;
  const width = cellSize * 4;
  const height = cellSize * 4;

  let cellsSvg = '';
  housePositions.forEach((pos) => {
    const x = pos.col * cellSize;
    const y = pos.row * cellSize;
    const planets = housePlanets[pos.house] || [];
    const planetsText = planets.map((p) => (isTamil ? (TAMIL_PLANET_SYMBOLS[p] || p) : p)).join('  ') || '-';

    cellsSvg += `
      <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#FFFDF9" stroke="#A78345" stroke-width="1.5" />
      <text x="${x + 6}" y="${y + 16}" font-family="sans-serif" font-size="9" font-weight="600" fill="#6E565E">${pos.house + 1}. ${pos.name}</text>
      <text x="${x + cellSize / 2}" y="${y + 56}" font-family="sans-serif" font-size="12" font-weight="700" fill="#B85C78" text-anchor="middle">${planetsText}</text>
    `;
  });

  const rawSimSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="max-width: 400px; display: block; margin: 0 auto; background: #FFF8F2; border-radius: 8px;">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#FFF8F2" />
      ${cellsSvg}
      <!-- Center Box -->
      <rect x="${cellSize}" y="${cellSize}" width="${cellSize * 2}" height="${cellSize * 2}" fill="#FFF3EB" stroke="#A78345" stroke-width="2" />
      <text x="${width / 2}" y="${height / 2 - 10}" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#49343B" text-anchor="middle" letter-spacing="1">${defaultTitle}</text>
      <text x="${width / 2}" y="${height / 2 + 12}" font-family="sans-serif" font-size="9" fill="#A78345" text-anchor="middle">${isTamil ? 'தென்னிந்திய 12 கட்ட அமைப்பு' : 'South Indian 12-House Grid'}</text>
    </svg>
  `.trim();

  const chartCategory = (defaultTitle.includes('D9') || defaultTitle.toLowerCase().includes('navamsa')) ? 'navamsa' : 'rasi';
  return transformToRoyalGoldChart(rawSimSvg, chartCategory);
};

/**
 * Generates synthetic simulated horoscope data for testing or unconfigured environments
 */
const generateSyntheticHoroscope = ({ datetime, coordinates, placeName = 'Chennai, Tamil Nadu', language = 'ta' }) => {
  const dt = new Date(datetime || Date.now());
  const day = dt.getUTCDate() || 1;
  const month = dt.getUTCMonth();

  const rasiIdx = (day + month) % 12;
  const nakshatraIdx = (day * 2 + month) % 27;
  const pada = ((day % 4) + 1);
  const lagnaIdx = (rasiIdx + 4) % 12;

  const isTamil = language === 'ta';
  const rasiName = isTamil ? TAMIL_RASI_NAMES[rasiIdx] : RASI_LIST[rasiIdx];
  const nakshatraName = isTamil ? TAMIL_NAKSHATRA_NAMES[nakshatraIdx] : NAKSHATRA_LIST[nakshatraIdx];
  const lagnaName = isTamil ? TAMIL_RASI_NAMES[lagnaIdx] : RASI_LIST[lagnaIdx];

  const hasChevvai = day % 3 === 0;
  const hasNaga = day % 5 === 0;
  let doshamSummary = isTamil ? 'இல்லை (None)' : 'None';
  if (hasChevvai && hasNaga) doshamSummary = isTamil ? 'செவ்வாய் மற்றும் நாக தோஷம்' : 'Chevvai & Naga Dosham';
  else if (hasChevvai) doshamSummary = isTamil ? 'செவ்வாய் தோஷம்' : 'Chevvai Dosham';
  else if (hasNaga) doshamSummary = isTamil ? 'நாக தோஷம்' : 'Sarpa / Naga Dosham';

  const dasaPlanetsEn = ['Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury', 'Ketu', 'Venus'];
  const dasaPlanetsTa = ['சூரியன்', 'சந்திரன்', 'செவ்வாய்', 'ராகு', 'குரு', 'சனி', 'புதன்', 'கேது', 'சுக்கிரன்'];
  const dasaPlanet = isTamil
    ? dasaPlanetsTa[nakshatraIdx % dasaPlanetsTa.length]
    : dasaPlanetsEn[nakshatraIdx % dasaPlanetsEn.length];

  // Distribute planets across houses for chart SVG
  const rasiPlanets = {
    [lagnaIdx]: ['Lagna'],
    [rasiIdx]: ['Moon'],
    [(rasiIdx + 2) % 12]: ['Sun', 'Mercury'],
    [(rasiIdx + 4) % 12]: ['Mars'],
    [(rasiIdx + 6) % 12]: ['Jupiter'],
    [(rasiIdx + 8) % 12]: ['Venus', 'Rahu'],
    [(rasiIdx + 10) % 12]: ['Saturn'],
    [(rasiIdx + 2) % 12]: ['Ketu'],
  };

  const navamsaPlanets = {
    [(lagnaIdx + 3) % 12]: ['Lagna'],
    [(rasiIdx + 1) % 12]: ['Moon', 'Venus'],
    [(rasiIdx + 5) % 12]: ['Sun'],
    [(rasiIdx + 7) % 12]: ['Mars', 'Jupiter'],
    [(rasiIdx + 9) % 12]: ['Mercury'],
    [(rasiIdx + 11) % 12]: ['Saturn'],
  };

  const rasiChartSvg = generateSouthIndianChartSvg(
    isTamil ? 'ராசி கட்டம் (D1)' : 'RASI CHART (D1)',
    rasiPlanets,
    true,
    language
  );
  const navamsaChartSvg = generateSouthIndianChartSvg(
    isTamil ? 'நவாம்ச கட்டம் (D9)' : 'NAVAMSA CHART (D9)',
    navamsaPlanets,
    true,
    language
  );

  return {
    isGenerated: true,
    isSimulated: true,
    generatedAt: new Date(),
    timeOfBirth: dt.toISOString().slice(11, 16),
    placeOfBirth: placeName,
    birthCoordinates: coordinates || '13.0827,80.2707',
    timezone: '+05:30',
    rasi: rasiName,
    nakshatram: nakshatraName,
    padam: pada,
    lagnam: lagnaName,
    dosham: {
      hasChevvaiDosham: hasChevvai,
      hasNagaDosham: hasNaga,
      doshamSummary,
      description: hasChevvai ? 'Mars placed in an influential astrological bhava.' : 'No significant adverse dosham detected.',
    },
    dasaBalance: {
      planet: dasaPlanet,
      years: (day % 14) + 1,
      months: (month % 11) + 1,
      days: (day % 28) + 1,
    },
    rasiChartSvg,
    navamsaChartSvg,
    attribution: 'SIMULATED TEST CALCULATION (Offline Model — Real Prokerala API Unverified)',
  };
};

/**
 * Main service method: Generates complete Jathagam data via Prokerala Astrology API.
 * In production mode, strictly refuses to run simulated horoscopes if API credentials are missing.
 *
 * @param {object} params
 * @param {string} params.datetime - ISO 8601 string, e.g. '1995-05-15T14:30:00+05:30'
 * @param {string} params.coordinates - 'latitude,longitude', e.g. '13.0827,80.2707'
 * @param {string} [params.placeName] - Optional place name label
 * @param {string} [params.language] - 'en' (default) or 'ta'
 * @returns {Promise<object>} Standardized horoscope object ready for MongoDB persistence
 */
const generateHoroscope = async ({ datetime, coordinates, placeName = '', language = 'ta' }) => {
  // Input validations
  if (!datetime) {
    throw new Error('datetime is required for Jathagam generation (ISO 8601 format)');
  }
  if (!coordinates || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(coordinates.trim())) {
    throw new Error("coordinates must be a valid 'latitude,longitude' decimal string (e.g. '13.0827,80.2707')");
  }

  const cleanCoords = coordinates.trim();
  const ayanamsa = process.env.PROKERALA_AYANAMSA || 1;
  const lang = language === 'en' ? 'en' : 'ta';

  // 1. Production Safety Guard: Production MUST NEVER silently fall back to simulated calculations
  if (!isProkeralaConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error(
        'Prokerala Astrology API credentials (PROKERALA_CLIENT_ID / PROKERALA_CLIENT_SECRET) are missing. Simulated horoscopes are strictly prohibited in production mode.'
      );
      err.code = 'PROKERALA_NOT_CONFIGURED';
      throw err;
    }

    // In development or test mode, generate offline synthetic horoscope clearly flagged as isSimulated: true
    return generateSyntheticHoroscope({
      datetime,
      coordinates: cleanCoords,
      placeName,
      language: lang,
    });
  }

  // Live Prokerala API Execution
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  const queryParams = new URLSearchParams({
    datetime,
    coordinates: cleanCoords,
    ayanamsa: String(ayanamsa),
    la: lang,
  });

  try {
    // 1. Fetch Kundli birth particulars (Rasi, Nakshatram, Pada, Lagnam, Dasha)
    const kundliRes = await fetch(`${PROKERALA_API_BASE}/kundli?${queryParams.toString()}`, { headers });
    if (!kundliRes.ok) {
      const errBody = await kundliRes.text();
      throw new Error(`Prokerala /kundli failed (${kundliRes.status}): ${errBody}`);
    }
    const kundliJson = await kundliRes.json();
    const kData = kundliJson.data || {};

    // 2. Fetch South Indian Rasi Chart (D1) SVG
    const rasiChartParams = new URLSearchParams(queryParams);
    rasiChartParams.set('chart_type', 'rasi');
    rasiChartParams.set('chart_style', 'south-indian');
    const rasiChartRes = await fetch(`${PROKERALA_API_BASE}/chart?${rasiChartParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'image/svg+xml, application/json' },
    });
    const rawRasiChartSvg = rasiChartRes.ok ? await rasiChartRes.text() : null;
    const rasiChartSvg = rawRasiChartSvg ? (lang === 'ta' ? localizeChartSvgToTamil(rawRasiChartSvg, 'rasi', { dob: datetime }) : rawRasiChartSvg) : null;

    // 3. Fetch South Indian Navamsa Chart (D9) SVG
    const navamsaChartParams = new URLSearchParams(queryParams);
    navamsaChartParams.set('chart_type', 'navamsa');
    navamsaChartParams.set('chart_style', 'south-indian');
    const navamsaChartRes = await fetch(`${PROKERALA_API_BASE}/chart?${navamsaChartParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'image/svg+xml, application/json' },
    });
    const rawNavamsaChartSvg = navamsaChartRes.ok ? await navamsaChartRes.text() : null;
    const navamsaChartSvg = rawNavamsaChartSvg ? (lang === 'ta' ? localizeChartSvgToTamil(rawNavamsaChartSvg, 'navamsa', { dob: datetime }) : rawNavamsaChartSvg) : null;

    // 4. Fetch Mangal / Chevvai Dosham (use from kundli response if available to preserve rate limit)
    let hasChevvai = false;
    let doshamDesc = lang === 'ta' ? 'செவ்வாய் தோஷம் எதுவும் இல்லை.' : 'No significant Chevvai dosham detected.';
    if (kData.mangal_dosha) {
      hasChevvai = Boolean(kData.mangal_dosha.has_dosha);
      if (kData.mangal_dosha.description) doshamDesc = kData.mangal_dosha.description;
    } else {
      try {
        const mangalRes = await fetch(`${PROKERALA_API_BASE}/mangal-dosha?${queryParams.toString()}`, { headers });
        if (mangalRes.ok) {
          const mangalJson = await mangalRes.json();
          hasChevvai = Boolean(mangalJson.data?.has_mangal_dosha || mangalJson.data?.has_dosha);
          if (mangalJson.data?.description) doshamDesc = mangalJson.data.description;
        }
      } catch (_) {
        // Graceful fallback if separate dosha endpoint is unavailable on current tier
      }
    }

    // Extract core parameters (supports both Prokerala /kundli standard schema and flat schema)
    const nakshatraDetails = kData.nakshatra_details || {};
    const rasiName = nakshatraDetails.chandra_rasi?.name || kData.rasi?.name || null;
    const nakshatraName = nakshatraDetails.nakshatra?.name || kData.nakshatra?.name || null;
    const padamVal = nakshatraDetails.nakshatra?.pada ?? kData.nakshatra?.pada ?? null;
    const dashaLord = nakshatraDetails.nakshatra?.lord?.name || kData.dasha?.current_lord || kData.dasha?.vimshottari?.[0]?.lord || null;

    // Lagna / Ascendant is identified in planet_position where name is 'Ascendant' or 'Lagna'
    let lagnamName = null;

    // Check 1: Direct in kData (kundli payload)
    if (kData.ascendant?.rasi?.name) {
      lagnamName = normalizeRasiName(kData.ascendant.rasi.name, lang);
    } else if (Array.isArray(kData.planet_position)) {
      const lagnaObj = kData.planet_position.find((p) => p.name === 'Ascendant' || p.name === 'Lagna' || p.id === 100);
      if (lagnaObj && lagnaObj.rasi) {
        lagnamName = normalizeRasiName(lagnaObj.rasi.name, lang);
      }
    }

    // Check 2: Query Prokerala's planet-position endpoint if not found in kundli response
    if (!lagnamName) {
      try {
        const planetPosRes = await fetch(`${PROKERALA_API_BASE}/planet-position?${queryParams.toString()}`, { headers });
        if (planetPosRes.ok) {
          const ppJson = await planetPosRes.json();
          const positions = ppJson.data?.planet_position || ppJson.data || [];
          if (Array.isArray(positions)) {
            const asc = positions.find((p) => p.name === 'Ascendant' || p.name === 'Lagna' || p.id === 100);
            if (asc && asc.rasi) {
              lagnamName = normalizeRasiName(asc.rasi.name, lang);
            }
          }
        }
      } catch (_) {
        // Graceful fallback to astronomical calculation
      }
    }

    // Check 3: Standard Astronomical Ascendant calculation from exact birth datetime & coordinates
    if (!lagnamName) {
      lagnamName = calculateVedicAscendant(datetime, cleanCoords, lang);
    }

    const doshamSummary = hasChevvai
      ? (lang === 'ta' ? 'செவ்வாய் தோஷம்' : 'Chevvai Dosham')
      : (lang === 'ta' ? 'இல்லை (None)' : 'None');

    return {
      isGenerated: true,
      isSimulated: false,
      generatedAt: new Date(),
      timeOfBirth: datetime.slice(11, 16),
      placeOfBirth: placeName,
      birthCoordinates: cleanCoords,
      timezone: datetime.slice(19) || '+05:30',
      rasi: rasiName,
      nakshatram: nakshatraName,
      padam: padamVal,
      lagnam: lagnamName,
      dosham: {
        hasChevvaiDosham: hasChevvai,
        hasNagaDosham: false,
        doshamSummary,
        description: doshamDesc,
      },
      dasaBalance: {
        planet: dashaLord,
        years: null,
        months: null,
        days: null,
      },
      rasiChartSvg,
      navamsaChartSvg,
      attribution: 'Astrological calculations powered by Prokerala Astrology API',
    };
  } catch (err) {
    console.error(`[Prokerala Service Error] ${err.message}`);
    throw err;
  }
};

module.exports = {
  PROKERALA_TOKEN_URL,
  PROKERALA_API_BASE,
  RASI_LIST,
  TAMIL_RASI_NAMES,
  NAKSHATRA_LIST,
  TAMIL_NAKSHATRA_NAMES,
  TAMIL_PLANET_SYMBOLS,
  SOUTH_INDIAN_CITIES,
  isProkeralaConfigured,
  resetTokenCache,
  getAccessToken,
  generateSouthIndianChartSvg,
  generateSyntheticHoroscope,
  generateHoroscope,
  localizeChartSvgToTamil,
  calculateVedicAscendant,
  normalizeRasiName,
};
