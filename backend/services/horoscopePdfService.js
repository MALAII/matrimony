const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');

// Path to bundled open-source Google Noto Sans Tamil fonts
const FONT_REGULAR_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansTamil-Regular.ttf');
const FONT_BOLD_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansTamil-Bold.ttf');

const WIN_NIRMALA_REGULAR = 'C:\\Windows\\Fonts\\Nirmala.ttf';
const WIN_NIRMALA_BOLD = 'C:\\Windows\\Fonts\\NirmalaB.ttf';

const resolveTamilFonts = () => {
  if (fs.existsSync(FONT_REGULAR_PATH) && fs.existsSync(FONT_BOLD_PATH)) {
    return { regular: FONT_REGULAR_PATH, bold: FONT_BOLD_PATH, available: true };
  }
  if (fs.existsSync(WIN_NIRMALA_REGULAR) && fs.existsSync(WIN_NIRMALA_BOLD)) {
    return { regular: WIN_NIRMALA_REGULAR, bold: WIN_NIRMALA_BOLD, available: true };
  }
  return { regular: 'Helvetica', bold: 'Helvetica-Bold', available: false };
};

const formatAstroDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} - ${month} - ${year}`;
  } catch (_) {
    return String(dateVal);
  }
};

/**
 * Transforms raw Prokerala chart SVG into Royal Gold South Indian Temple Astrological Chart
 * Preserves 100% of real planetary positions, numbers, and lagna slash from Prokerala.
 */
const transformToRoyalGoldChart = (rawSvg, chartType = 'rasi', candidateInfo = {}) => {
  if (!rawSvg || typeof rawSvg !== 'string') return rawSvg;
  if (rawSvg.includes('id="royalGoldFrame"')) return rawSvg;

  const isNavamsa = chartType.toLowerCase().includes('navamsa') || rawSvg.includes('நவாம்சம்') || rawSvg.includes('Navamsa');
  const tamilTitle = isNavamsa ? 'நவாம்சம்' : 'ராசி';
  const badgeTitle = isNavamsa ? 'நவாம்ச கட்டம் (Navamsa Chart)' : 'ராசி கட்டம் (Rasi Chart)';

  let extractedDate = candidateInfo.dob || '';
  let extractedTime = candidateInfo.tob || '';

  const dateMatch = rawSvg.match(/<text[^>]*>(\d{1,2}\s*-\s*[A-Za-z]{3}\s*-\s*\d{4})<\/text>/);
  if (dateMatch) extractedDate = dateMatch[1];

  const timeMatch = rawSvg.match(/<text[^>]*>(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)<\/text>/);
  if (timeMatch) extractedTime = timeMatch[1];

  let contentSvg = rawSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

  // Remove existing center texts so we can replace with royal gold center styling (handles any trailing ZWNJ or whitespace)
  contentSvg = contentSvg.replace(/<text[^>]*>\s*(?:ராசி|நவாம்ச[^<]*|Rasi|Navamsa)\s*<\/text>/gi, '');
  if (extractedDate) {
    const escDate = extractedDate.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    contentSvg = contentSvg.replace(new RegExp(`<text[^>]*>${escDate}<\\/text>`, 'g'), '');
  }
  if (extractedTime) {
    const escTime = extractedTime.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    contentSvg = contentSvg.replace(new RegExp(`<text[^>]*>${escTime}<\\/text>`, 'g'), '');
  }

  // Replace plain grid lines with royal antique gold
  contentSvg = contentSvg.replace(/stroke="#000000"/g, 'stroke="#C59933"');
  contentSvg = contentSvg.replace(/stroke-width="1"/g, 'stroke-width="1.6"');

  // Replace house numbers with refined antique bronze/maroon
  contentSvg = contentSvg.replace(/<text([^>]*)>(\d{1,2})<\/text>/g, (match, attrs, num) => {
    return `<text${attrs} font-family="'Noto Sans Tamil', 'Nirmala UI', sans-serif" font-weight="700" fill="#7A4E1A">${num}</text>`;
  });

  // Style planet glyphs with deep regal maroon and bold weight
  contentSvg = contentSvg.replace(/<text([^>]*)class="([^"]*pk-planet-[^"]*)"([^>]*)>([^<]+)<\/text>/g, (match, before, cls, after, glyph) => {
    return `<text${before}class="${cls}"${after} font-family="'Noto Sans Tamil', 'Nirmala UI', sans-serif" font-weight="bold" fill="#650D18">${glyph}</text>`;
  });

  // Style Lagna diagonal lines with distinct gold & maroon double slash
  contentSvg = contentSvg.replace(/(<line[^>]*stroke-width="2"[^>]*>)/g, (match) => {
    return match.replace(/stroke="[^"]*"/, 'stroke="#8B0000"').replace(/stroke-width="2"/, 'stroke-width="2.8" stroke-linecap="round"');
  });

  const typeSuffix = chartType.toLowerCase().includes('navamsa') ? 'nav' : 'rasi';

  return `
<svg preserveAspectRatio="xMidYMid meet" viewBox="0 0 480 540" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldGrad_${typeSuffix}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E5C158" />
      <stop offset="25%" stop-color="#FFF0A5" />
      <stop offset="50%" stop-color="#CFA035" />
      <stop offset="75%" stop-color="#9E731B" />
      <stop offset="100%" stop-color="#F3D375" />
    </linearGradient>

    <linearGradient id="maroonGrad_${typeSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#550810" />
      <stop offset="50%" stop-color="#720E1A" />
      <stop offset="100%" stop-color="#42060C" />
    </linearGradient>

    <linearGradient id="cellParchment_${typeSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFDF9" />
      <stop offset="100%" stop-color="#FFF7E8" />
    </linearGradient>

    <linearGradient id="centerParchment_${typeSuffix}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFDF7" />
      <stop offset="100%" stop-color="#FFF2DC" />
    </linearGradient>

    <g id="templeCorner_${typeSuffix}">
      <path d="M 0,0 L 28,0 C 22,4 16,10 14,18 C 12,24 6,26 0,28 Z" fill="url(#goldGrad_${typeSuffix})" opacity="0.85" />
      <path d="M 3,3 L 20,3 C 16,6 12,10 10,16 C 8,20 5,21 3,23 Z" fill="#7A4E1A" opacity="0.6" />
      <circle cx="8" cy="8" r="2.5" fill="#FFF0A5" />
      <circle cx="16" cy="6" r="1.5" fill="#FFF0A5" />
      <circle cx="6" cy="16" r="1.5" fill="#FFF0A5" />
    </g>
  </defs>

  <!-- 1. Header Royal Maroon Badge -->
  <g transform="translate(60, 8)">
    <path d="M 12,0 L 348,0 C 354,0 360,6 360,12 L 360,24 C 360,30 354,36 348,36 L 12,36 C 6,36 0,30 0,24 L 0,12 C 0,6 6,0 12,0 Z"
          fill="url(#maroonGrad_${typeSuffix})" stroke="url(#goldGrad_${typeSuffix})" stroke-width="1.8" />
    <path d="M 14,3 L 346,3 C 350,3 355,7 355,12 L 355,24 C 355,29 350,33 346,33 L 14,33 C 10,33 5,29 5,24 L 5,12 C 5,7 10,3 14,3 Z"
          fill="none" stroke="#F5C369" stroke-width="0.6" opacity="0.7" />
    <circle cx="20" cy="18" r="2.2" fill="url(#goldGrad_${typeSuffix})" />
    <circle cx="340" cy="18" r="2.2" fill="url(#goldGrad_${typeSuffix})" />
    <text x="180" y="23" font-family="'Noto Sans Tamil', 'Nirmala UI', sans-serif" font-size="13" font-weight="bold" fill="#FFF8E9" text-anchor="middle" letter-spacing="0.5">
      ${badgeTitle}
    </text>
  </g>

  <!-- 2. Chart Main Body Group -->
  <g id="royalGoldFrame" transform="translate(0, 52)">
    <rect x="10" y="10" width="462" height="462" rx="4" fill="url(#cellParchment_${typeSuffix})" />

    <!-- Center 2x2 Box Background -->
    <rect x="126" y="126" width="232" height="232" fill="url(#centerParchment_${typeSuffix})" stroke="url(#goldGrad_${typeSuffix})" stroke-width="2.2" />
    <rect x="130" y="130" width="224" height="224" fill="none" stroke="#D4AF37" stroke-width="0.8" opacity="0.6" />

    <!-- Raw Prokerala SVG Content (Grid Lines, Numbers, Planets, Lagna Slash) -->
    ${contentSvg}

    <!-- Center Box Content -->
    <text x="242" y="206" font-family="'Noto Sans Tamil', 'Nirmala UI', Georgia, serif" font-size="22" font-weight="bold" fill="#650D18" text-anchor="middle">
      ${tamilTitle}
    </text>

    ${extractedDate ? `
    <text x="242" y="236" font-family="'Noto Sans Tamil', 'Nirmala UI', sans-serif" font-size="13.5" font-weight="700" fill="#351B1B" text-anchor="middle">
      ${extractedDate}
    </text>` : ''}

    ${extractedTime ? `
    <text x="242" y="258" font-family="'Noto Sans Tamil', 'Nirmala UI', sans-serif" font-size="12" font-weight="600" fill="#6B5555" text-anchor="middle">
      ${extractedTime}
    </text>` : ''}

    <!-- Royal Gold Filigree Divider Motif -->
    <g transform="translate(242, 280) scale(0.85)">
      <path d="M 0,-5 L 5,0 L 0,5 L -5,0 Z" fill="url(#goldGrad_${typeSuffix})" stroke="#7A4E1A" stroke-width="0.5" />
      <circle cx="0" cy="0" r="1.5" fill="#550810" />
      <path d="M -8,0 C -18,-5 -30,5 -42,0 C -34,-2 -22,-2 -10,0" fill="none" stroke="url(#goldGrad_${typeSuffix})" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="-42" cy="0" r="1.8" fill="url(#goldGrad_${typeSuffix})" />
      <path d="M 8,0 C 18,-5 30,5 42,0 C 34,-2 22,-2 10,0" fill="none" stroke="url(#goldGrad_${typeSuffix})" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="42" cy="0" r="1.8" fill="url(#goldGrad_${typeSuffix})" />
    </g>

    <!-- Dual Heavy Gold Outer Frame -->
    <rect x="8" y="8" width="466" height="466" rx="5" fill="none" stroke="url(#goldGrad_${typeSuffix})" stroke-width="3.8" />
    <rect x="12" y="12" width="458" height="458" rx="3" fill="none" stroke="#D4AF37" stroke-width="1" opacity="0.8" />

    <!-- Four Temple Gold Filigree Corners -->
    <use href="#templeCorner_${typeSuffix}" x="8" y="8" />
    <use href="#templeCorner_${typeSuffix}" transform="translate(474, 8) scale(-1, 1)" />
    <use href="#templeCorner_${typeSuffix}" transform="translate(8, 474) scale(1, -1)" />
    <use href="#templeCorner_${typeSuffix}" transform="translate(474, 474) scale(-1, -1)" />
  </g>
</svg>
`.trim();
};

const formatDate = (dateVal) => {
  if (!dateVal) return 'Not Specified';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (_) {
    return String(dateVal);
  }
};

const embedSvgChart = (doc, svgString, x, y, width, height, fallbackTitle = 'ராசி கட்டம்', fonts = { available: false }) => {
  if (!svgString || typeof svgString !== 'string' || !svgString.includes('<svg')) {
    doc.rect(x, y, width, height).fillAndStroke('#FFF8E9', '#E8D3BC');
    const titleFont = fonts.available ? 'Tamil-Bold' : 'Helvetica-Bold';
    doc.fillColor('#650D18')
      .font(titleFont)
      .fontSize(10)
      .text(`${fallbackTitle}\n(விவரங்கள் கிடைக்கவில்லை)`, x + 10, y + height / 2 - 12, {
        width: width - 20,
        align: 'center',
      });
    return;
  }

  try {
    SVGtoPDF(doc, svgString, x, y, {
      width,
      height,
      preserveAspectRatio: 'xMidYMid meet',
      fontCallback: (family, bold) => {
        if (fonts.available) {
          return bold ? 'Tamil-Bold' : 'Tamil-Regular';
        }
        return bold ? 'Helvetica-Bold' : 'Helvetica';
      },
    });
  } catch (err) {
    doc.rect(x, y, width, height).fillAndStroke('#FFF8E9', '#E8D3BC');
    const titleFont = fonts.available ? 'Tamil-Bold' : 'Helvetica-Bold';
    doc.fillColor('#650D18')
      .font(titleFont)
      .fontSize(9)
      .text(`${fallbackTitle}\n(வரைபடம் ஏற்ற முடியவில்லை)`, x + 10, y + height / 2 - 12, {
        width: width - 20,
        align: 'center',
      });
  }
};

/**
 * Draws the official Sri Varaghi Matrimony Logo Medallion
 * Uses a soft cream (#FFF8E9) medallion with dual antique gold borders (#D99A24 & #F5C369)
 * and perfectly centers the logo artwork so it sits naturally and majestically.
 */
const drawVarahiLogo = (doc, x, y, size = 56) => {
  const customLogoPaths = [
    path.join(__dirname, '..', 'assets', 'logo.png'),
    path.join(__dirname, '..', 'assets', 'varahi_logo.png'),
    path.join(__dirname, '..', 'assets', 'logo.jpg'),
    path.join(__dirname, '..', 'assets', 'varahi_logo.jpg'),
  ];
  const foundFile = customLogoPaths.find((p) => fs.existsSync(p));

  const radius = 8;
  doc.save();
  // Elegant cream medallion background
  doc.roundedRect(x, y, size, size, radius).fillAndStroke('#FFF8E9', '#D99A24');
  doc.roundedRect(x + 2, y + 2, size - 4, size - 4, radius - 2).lineWidth(0.6).strokeColor('#F5C369').stroke();

  if (foundFile) {
    try {
      const pad = 3.5;
      doc.image(foundFile, x + pad, y + pad, {
        fit: [size - pad * 2, size - pad * 2],
        align: 'center',
        valign: 'center',
      });
      doc.restore();
      return;
    } catch (_) {
      // fallback
    }
  }

  // Fallback Vector Medallion
  const cx = x + size / 2;
  const cy = y + size / 2;
  doc.circle(cx, cy, size / 2 - 6).fill('#650D18');
  doc.circle(cx, cy, size / 2 - 8).lineWidth(1).strokeColor('#D99A24').stroke();
  doc.restore();
};

/**
 * Draws the subtle Varaghi Matrimonial Watermark centered on the page
 */
const drawVarahiWatermark = (doc, cx, cy, fonts = { available: false }) => {
  const customLogoPaths = [
    path.join(__dirname, '..', 'assets', 'logo.png'),
    path.join(__dirname, '..', 'assets', 'varahi_logo.png'),
    path.join(__dirname, '..', 'assets', 'logo.jpg'),
  ];
  const foundFile = customLogoPaths.find((p) => fs.existsSync(p));

  if (foundFile) {
    try {
      doc.save();
      doc.opacity(0.09);
      const wmSize = 280;
      doc.image(foundFile, cx - wmSize / 2, cy - wmSize / 2, {
        fit: [wmSize, wmSize],
        align: 'center',
        valign: 'center',
      });
      doc.restore();
      return;
    } catch (_) {
      // fallback
    }
  }

  doc.save();
  doc.opacity(0.10);
  const radius = 140;
  doc.circle(cx, cy, radius).lineWidth(3).strokeColor('#D99A24').stroke();
  doc.circle(cx, cy, radius - 6).lineWidth(1.2).strokeColor('#650D18').stroke();
  const waterFont = fonts.available ? 'Tamil-Bold' : 'Helvetica-Bold';
  doc.fillColor('#650D18')
    .font(waterFont)
    .fontSize(14)
    .text('SRI VARAGHI MATRIMONY', cx - 130, cy + 28, { width: 260, align: 'center' });
  doc.restore();
};

const generateHoroscopePdfBuffer = (profile, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      if (!profile) return reject(new Error('Profile is required.'));

      const template = (options.template || 'classic').toLowerCase() === 'watermark' ? 'watermark' : 'classic';
      const horoscope = profile.horoscope && profile.horoscope.isGenerated ? profile.horoscope : profile;
      if (!horoscope.isGenerated) return reject(new Error('Horoscope has not been generated yet.'));

      const candidateName = (profile.personName || profile.candidateName || 'Candidate').trim();
      const profileId = String(profile._id);
      const displayProfileId = `VRG-${profileId.slice(-6).toUpperCase()}`;

      const rawGender = profile.gender || profile.personalDetails?.gender || 'Not Specified';
      const gender = rawGender.toLowerCase() === 'male' ? 'ஆண் / Male' : rawGender.toLowerCase() === 'female' ? 'பெண் / Female' : rawGender;
      const email = profile.contactEmail || profile.candidateEmail || 'Not Registered';
      const phone = profile.contactPhone || profile.candidatePhone || 'Not Specified';

      const dob = formatDate(profile.dateOfBirth || profile.personalDetails?.dateOfBirth);
      const tob = horoscope.timeOfBirth ? `${horoscope.timeOfBirth} (IST)` : 'Not Specified';
      const pob = horoscope.placeOfBirth || 'South India';
      const coords = horoscope.birthCoordinates || '13.0827,80.2707';

      const rasi = horoscope.rasi || 'Not Specified';
      const nakshatram = horoscope.nakshatram || 'Not Specified';
      const padam = horoscope.padam !== null && horoscope.padam !== undefined ? String(horoscope.padam) : '-';
      const lagnam = horoscope.lagnam || horoscope.lagna || horoscope.ascendant || 'Not Specified';

      const dosham = horoscope.dosham || {};
      const doshamSummary = dosham.doshamSummary || 'None';
      const doshamDesc = dosham.description || 'செவ்வாய் / நாக தோஷம் இல்லை (No adverse planetary dosham recorded).';

      const dasa = horoscope.dasaBalance || {};
      const dasaText = dasa.planet
        ? `${dasa.planet} திசை (${dasa.years ?? 0} வருடம், ${dasa.months ?? 0} மாதம், ${dasa.days ?? 0} நாள்)`
        : 'Not Specified';

      const attribution = horoscope.attribution || 'Astrological calculations powered by Prokerala Astrology API';
      const generatedDate = formatDate(horoscope.generatedAt || profile.createdAt || new Date());

      const fontConfig = resolveTamilFonts();
      const boldFont = fontConfig.available ? 'Tamil-Bold' : 'Helvetica-Bold';
      const regFont = fontConfig.available ? 'Tamil-Regular' : 'Helvetica';

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 26;
      const contentWidth = pageWidth - margin * 2; // 543.28 pt

      const doc = new PDFDocument({
        size: 'A4',
        margin: 26,
        autoFirstPage: true,
        bufferPages: false,
        info: {
          Title: `Horoscope Report - ${candidateName} | Sri Varaghi Matrimony`,
          Author: 'Sri Varaghi Matrimony',
          Subject: 'Candidate Astrological Chart (Jathagam)',
        },
      });

      doc.page.margins.bottom = 0;

      if (fontConfig.available) {
        doc.registerFont('Tamil-Regular', fontConfig.regular);
        doc.registerFont('Tamil-Bold', fontConfig.bold);
      }

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Centered subtle watermark in Template 2
      if (template === 'watermark') {
        drawVarahiWatermark(doc, pageWidth / 2, 450, fontConfig);
      }

      let curY = margin;

      // -------------------------------------------------------------
      // 1. HEADER SECTION
      // -------------------------------------------------------------
      const headerHeight = 68;
      if (template === 'classic') {
        // Deep Maroon Bar with Gold Accent Line
        doc.rect(margin, curY, contentWidth, headerHeight).fill('#650D18');
        doc.rect(margin, curY + headerHeight - 2, contentWidth, 2).fill('#D99A24');

        // Medallion Logo
        drawVarahiLogo(doc, margin + 8, curY + 6, 56);

        const textX = margin + 74;
        const textW = contentWidth - 82;

        doc.fillColor('#FFF8E9')
          .font(boldFont)
          .fontSize(14.5)
          .text('ஸ்ரீ வாராஹி திருமண தகவல் மையம்', textX, curY + 9, {
            width: textW,
            align: 'left',
            lineBreak: false,
          });

        doc.fillColor('#D99A24')
          .font(boldFont)
          .fontSize(8.8)
          .text('VARAGHI MATRIMONY', textX, curY + 30, {
            continued: true,
            characterSpacing: 0.6,
          })
          .fillColor('#FFF8E9')
          .text('  •  வரன் ஜாதகக் குறிப்பு அறிக்கை (ASTROLOGICAL DOSSIER)', {
            characterSpacing: 0.2,
          });

        doc.fillColor('#F7E9D7')
          .font(regFont)
          .fontSize(7.5)
          .text('100% நம்பகமான வரன்கள்  •  சுப முகூர்த்த திருமண தகவல் மையம்', textX, curY + 47, {
            width: textW,
            align: 'left',
            lineBreak: false,
          });
      } else {
        // Watermark Template: Cream Background with Double Gold Borders
        doc.rect(margin, curY, contentWidth, headerHeight).fillAndStroke('#FFF8E9', '#D99A24');
        doc.rect(margin + 2.5, curY + 2.5, contentWidth - 5, headerHeight - 5).strokeColor('#F5C369').lineWidth(0.8).stroke();

        drawVarahiLogo(doc, margin + 8, curY + 6, 56);

        const textX = margin + 74;
        const textW = contentWidth - 82;

        doc.fillColor('#650D18')
          .font(boldFont)
          .fontSize(14.5)
          .text('ஸ்ரீ வாராஹி திருமண தகவல் மையம்', textX, curY + 9, {
            width: textW,
            align: 'left',
            lineBreak: false,
          });

        doc.fillColor('#A20D16')
          .font(boldFont)
          .fontSize(8.8)
          .text('VARAGHI MATRIMONY', textX, curY + 30, {
            continued: true,
            characterSpacing: 0.6,
          })
          .fillColor('#650D18')
          .text('  •  வரன் ஜாதகக் குறிப்பு (OFFICIAL ASTROLOGICAL DOSSIER)', {
            characterSpacing: 0.2,
          });

        doc.fillColor('#6B5555')
          .font(regFont)
          .fontSize(7.5)
          .text('100% நம்பகமான வரன்கள்  •  சுப முகூர்த்த திருமண தகவல் மையம்', textX, curY + 47, {
            width: textW,
            align: 'left',
            lineBreak: false,
          });
      }

      curY += headerHeight + 8;

      // -------------------------------------------------------------
      // 2. CANDIDATE & BIRTH PARTICULARS BOX
      // -------------------------------------------------------------
      const infoBoxHeight = 88;
      doc.rect(margin, curY, contentWidth, infoBoxHeight)
        .fillAndStroke('#FFFFFF', '#E8D3BC');

      // Title bar
      doc.rect(margin, curY, contentWidth, 17).fill('#F7E9D7');
      doc.fillColor('#650D18')
        .font(boldFont)
        .fontSize(8.2)
        .text('வரன் மற்றும் பிறப்பு விவரங்கள் (CANDIDATE & BIRTH PARTICULARS)', margin + 10, curY + 4);

      const col1X = margin + 12;
      const col2X = margin + 242;
      const labelW1 = 100;
      const labelW2 = 130;
      const rowY1 = curY + 21;
      const rowY2 = curY + 37;
      const rowY3 = curY + 53;
      const rowY4 = curY + 69;

      doc.fontSize(8);

      // Col 1
      doc.font(boldFont).fillColor('#351B1B').text('பெயர் (Name):', col1X, rowY1);
      doc.font(boldFont).fillColor('#A20D16').text(candidateName, col1X + labelW1, rowY1);

      doc.font(boldFont).fillColor('#351B1B').text('பதிவு எண் (Profile ID):', col1X, rowY2);
      doc.font(boldFont).fillColor('#D99A24').text(displayProfileId, col1X + labelW1, rowY2);

      doc.font(boldFont).fillColor('#351B1B').text('பாலினம் (Gender):', col1X, rowY3);
      doc.font(regFont).fillColor('#351B1B').text(gender, col1X + labelW1, rowY3);

      doc.font(boldFont).fillColor('#351B1B').text('தொடர்பு (Contact):', col1X, rowY4);
      doc.font(regFont).fillColor('#351B1B').text(phone !== 'Not Specified' ? phone : email, col1X + labelW1, rowY4);

      // Col 2
      doc.font(boldFont).fillColor('#351B1B').text('பிறந்த தேதி (Date of Birth):', col2X, rowY1);
      doc.font(boldFont).fillColor('#351B1B').text(dob, col2X + labelW2, rowY1);

      doc.font(boldFont).fillColor('#351B1B').text('பிறந்த நேரம் (Time of Birth):', col2X, rowY2);
      doc.font(regFont).fillColor('#351B1B').text(tob, col2X + labelW2, rowY2);

      doc.font(boldFont).fillColor('#351B1B').text('பிறந்த இடம் (Place of Birth):', col2X, rowY3);
      doc.font(regFont).fillColor('#351B1B').text(pob, col2X + labelW2, rowY3);

      doc.font(boldFont).fillColor('#351B1B').text('அட்சரேகை (Coordinates):', col2X, rowY4);
      doc.font(regFont).fillColor('#351B1B').text(coords, col2X + labelW2, rowY4);

      curY += infoBoxHeight + 8;

      // -------------------------------------------------------------
      // 3. ASTROLOGICAL KEY DATA (4 PILLS)
      // -------------------------------------------------------------
      const pillGap = 8;
      const pillWidth = (contentWidth - pillGap * 3) / 4;
      const pillHeight = 46;

      const astroPills = [
        { label: 'ராசி (RASI)', val: rasi },
        { label: 'நட்சத்திரம் (STAR)', val: nakshatram },
        { label: 'பாதம் (PADA)', val: padam },
        { label: 'லக்னம் (LAGNAM)', val: lagnam },
      ];

      astroPills.forEach((p, idx) => {
        const px = margin + idx * (pillWidth + pillGap);
        doc.roundedRect(px, curY, pillWidth, pillHeight, 5).fillAndStroke('#FFF8E9', '#D99A24');
        doc.fillColor('#650D18')
          .font(boldFont)
          .fontSize(7.5)
          .text(p.label, px, curY + 6, { width: pillWidth, align: 'center' });

        doc.fillColor('#351B1B')
          .font(boldFont)
          .fontSize(11.5)
          .text(p.val, px, curY + 22, { width: pillWidth, align: 'center' });
      });

      curY += pillHeight + 8;

      // -------------------------------------------------------------
      // 4. DOSHAM & DASA BALANCE STRIP
      // -------------------------------------------------------------
      const summaryStripHeight = 38;
      doc.roundedRect(margin, curY, contentWidth, summaryStripHeight, 5)
        .fillAndStroke('#FFFFFF', '#E8D3BC');

      doc.font(boldFont).fontSize(7.8).fillColor('#650D18')
        .text('தோஷ விவரம் (Dosham): ', margin + 8, curY + 6, { continued: true })
        .font(regFont).fillColor('#351B1B')
        .text(`${doshamSummary} — ${doshamDesc}`);

      doc.font(boldFont).fontSize(7.8).fillColor('#650D18')
        .text('பிறப்பு இருப்பு திசை (Dasa Balance): ', margin + 8, curY + 20, { continued: true })
        .font(regFont).fillColor('#351B1B')
        .text(dasaText);

      curY += summaryStripHeight + 8;

      // -------------------------------------------------------------
      // 5. SOUTH INDIAN SQUARE CHARTS (ROYAL TEMPLE GOLD DESIGN)
      // -------------------------------------------------------------
      const chartWidth = 254;
      const chartHeight = 262;
      const chartGap = contentWidth - chartWidth * 2;
      const chart1X = margin;
      const chart2X = margin + chartWidth + chartGap;

      const astroDate = formatAstroDate(profile.dateOfBirth || profile.personalDetails?.dateOfBirth);
      const astroTime = horoscope.timeOfBirth || '';

      const styledRasiSvg = transformToRoyalGoldChart(horoscope.rasiChartSvg, 'rasi', { dob: astroDate, tob: astroTime });
      const styledNavamsaSvg = transformToRoyalGoldChart(horoscope.navamsaChartSvg, 'navamsa', { dob: astroDate, tob: astroTime });

      embedSvgChart(doc, styledRasiSvg, chart1X, curY, chartWidth, chartHeight, 'ராசி கட்டம் (Rasi Chart)', fontConfig);
      embedSvgChart(doc, styledNavamsaSvg, chart2X, curY, chartWidth, chartHeight, 'நவாம்ச கட்டம் (Navamsa Chart)', fontConfig);

      curY += chartHeight + 4;

      // Centered Golden Lotus Ornament between charts and guidelines
      const lotusPath = path.join(__dirname, '..', 'assets', 'lotus-ornament.svg');
      if (fs.existsSync(lotusPath)) {
        try {
          const lotusW = 56;
          const lotusH = 16;
          const lotusSvg = fs.readFileSync(lotusPath, 'utf8');
          SVGtoPDF(doc, lotusSvg, margin + (contentWidth - lotusW) / 2, curY, {
            width: lotusW,
            height: lotusH,
            preserveAspectRatio: 'xMidYMid meet',
          });
          curY += lotusH + 4;
        } catch (_) {}
      } else {
        curY += 4;
      }

      // -------------------------------------------------------------
      // 6. ASTROLOGICAL GUIDELINES & MATCHING NOTES
      // -------------------------------------------------------------
      const guidelines = [
        'திருக்கணித பஞ்சாங்க முறைப்படி கிரக பாதசாரங்கள், தசா இருப்பு மற்றும் லக்ன நிலைகள் துல்லியமாக கணிக்கப்பட்டுள்ளன.',
        'திருமண பொருத்தத்திற்கு தினப் பொருத்தம், கணப் பொருத்தம், ராசி, யோனி, ரஜ்ஜு உள்ளிட்ட 10 பொருத்தங்களை ஒப்பிட்டுப் பார்க்கவும்.',
        'செவ்வாய் / சனி பார்வை நிலைகள் மற்றும் தசா-புக்தி சமநிலையை அனுபவமிக்க குடும்ப ஜோதிடரிடம் சரிபார்த்துக் கொள்ள பரிந்துரைக்கப்படுகிறது.',
        'இரு குடும்பத்தினர் முன்னிலையில் வரன் ஜாதகத்தை பரிசீலித்து சுப முகூர்த்த முடிவுகளை மேற்கொள்ளவும்.',
      ];

      const noteX = margin + 12;
      const noteTextWidth = contentWidth - 28;
      const bulletIndent = 12;

      // Pre-measure dynamic height so the box expands gracefully to contain all lines
      doc.font(regFont).fontSize(7.4);
      let notesTextTotalH = 0;
      guidelines.forEach((g) => {
        notesTextTotalH += doc.heightOfString(g, { width: noteTextWidth - bulletIndent, lineGap: 1.5 }) + 4;
      });

      const notesBoxHeight = Math.max(88, Math.ceil(20 + notesTextTotalH + 5));
      doc.roundedRect(margin, curY, contentWidth, notesBoxHeight, 5)
        .fillAndStroke('#FFFFFF', '#E8D3BC');

      doc.rect(margin, curY, contentWidth, 16).fill('#F7E9D7');
      doc.fillColor('#650D18')
        .font(boldFont)
        .fontSize(7.8)
        .text('ஜாதகக் குறிப்பு & பொருத்த வழிகாட்டுதல் (ASTROLOGICAL GUIDELINES & MATCHING NOTES)', margin + 10, curY + 3.8);

      let noteY = curY + 22;
      guidelines.forEach((g) => {
        // Gold bullet dot
        doc.font(boldFont).fontSize(7.4).fillColor('#D99A24')
          .text('•', noteX, noteY, { lineBreak: false });

        // Text with clean hanging indent and dynamic line height flow
        doc.font(regFont).fontSize(7.4).fillColor('#351B1B');
        const textH = doc.heightOfString(g, { width: noteTextWidth - bulletIndent, lineGap: 1.5 });
        doc.text(g, noteX + bulletIndent, noteY, {
          width: noteTextWidth - bulletIndent,
          lineGap: 1.5,
        });
        noteY += textH + 4;
      });

      curY += notesBoxHeight + 8;

      // -------------------------------------------------------------
      // 7. BROKER OFFICIAL ENDORSEMENT & VERIFICATION SECTION
      // -------------------------------------------------------------
      const authBoxHeight = 82;
      doc.roundedRect(margin, curY, contentWidth, authBoxHeight, 5)
        .fillAndStroke('#FFF8E9', '#D99A24');

      doc.rect(margin, curY, contentWidth, 16).fill('#F7E9D7');
      doc.fillColor('#650D18')
        .font(boldFont)
        .fontSize(7.8)
        .text('அலுவலகச் சான்றொப்பம் & அங்கீகாரம் (OFFICIAL VERIFICATION & ENDORSEMENT)', margin + 10, curY + 3.8);

      const authCol1 = margin + 14;
      const authCol2 = margin + contentWidth / 2 - 10;
      const authLabelW2 = 122;

      const r1Y = curY + 23;
      const r2Y = curY + 41;
      const r3Y = curY + 60;

      // Col 1 (Left): Official Authority & Signatory
      doc.font(boldFont).fontSize(8.5).fillColor('#650D18')
        .text('ஸ்ரீ வாராஹி திருமண தகவல் மையம்', authCol1, r1Y);

      doc.font(regFont).fontSize(7.3).fillColor('#6B5555')
        .text('அங்கீகரிக்கப்பட்ட வரன் ஜாதகக் குறிப்பு அறிக்கை (Official Matrimonial Dossier)', authCol1, r2Y);

      doc.font(boldFont).fontSize(7.4).fillColor('#351B1B')
        .text('பதிவாளர் கையொப்பம் (Authorized Signatory): ________________________', authCol1, r3Y);

      // Col 2 (Right): Dossier Identification & Verification Status
      // Row 1: Dossier ID
      doc.font(boldFont).fontSize(7.5).fillColor('#351B1B')
        .text('பதிவு எண் (Dossier ID):', authCol2, r1Y);
      doc.font(boldFont).fontSize(7.5).fillColor('#D99A24')
        .text(displayProfileId, authCol2 + authLabelW2, r1Y);

      // Row 2: Issued Date
      doc.font(boldFont).fontSize(7.5).fillColor('#351B1B')
        .text('வெளியிட்ட தேதி (Issued Date):', authCol2, r2Y);
      doc.font(regFont).fontSize(7.5).fillColor('#351B1B')
        .text(generatedDate, authCol2 + authLabelW2, r2Y);

      // Row 3: Verification Status
      doc.font(boldFont).fontSize(7.5).fillColor('#351B1B')
        .text('சரிபார்ப்பு நிலை (Status):', authCol2, r3Y);
      doc.font(boldFont).fontSize(7.5).fillColor('#1E6B38')
        .text('சரிபார்க்கப்பட்டது (Verified Record)', authCol2 + authLabelW2, r3Y);

      curY += authBoxHeight + 8;

      // -------------------------------------------------------------
      // 8. FOOTER
      // -------------------------------------------------------------
      doc.moveTo(margin, curY).lineTo(margin + contentWidth, curY).strokeColor('#D99A24').lineWidth(0.8).stroke();

      doc.font(regFont).fontSize(6.8).fillColor('#6B5555')
        .text(
          `ஸ்ரீ வாராஹி திருமண தகவல் மையம் • மங்கல வாழ்க்கை மலர ஸ்ரீ வாராஹி அம்மன் துணை • ${attribution}`,
          margin,
          curY + 5,
          { width: contentWidth, align: 'center', lineBreak: false }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  formatDate,
  formatAstroDate,
  transformToRoyalGoldChart,
  embedSvgChart,
  generateHoroscopePdfBuffer,
  resolveTamilFonts,
};
