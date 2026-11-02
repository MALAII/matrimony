/**
 * Horoscope PDF Generation Service
 *
 * Generates an official, publication-ready South Indian Horoscope PDF report
 * containing candidate particulars, astrological particulars (Rasi, Nakshatram,
 * Padam, Lagnam, Dosham, Dasa balance), and embedded South Indian square charts
 * (Rasi D1 and Navamsa D9) using PDFKit and svg-to-pdfkit.
 */

const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');

// Path to bundled open-source Google Noto Sans Tamil fonts
const FONT_REGULAR_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansTamil-Regular.ttf');
const FONT_BOLD_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansTamil-Bold.ttf');

// Windows system fallback font path
const WIN_NIRMALA_REGULAR = 'C:\\Windows\\Fonts\\Nirmala.ttf';
const WIN_NIRMALA_BOLD = 'C:\\Windows\\Fonts\\NirmalaB.ttf';

/**
 * Resolves available Tamil TrueType font paths with graceful fallback
 */
const resolveTamilFonts = () => {
  if (fs.existsSync(FONT_REGULAR_PATH) && fs.existsSync(FONT_BOLD_PATH)) {
    return {
      regular: FONT_REGULAR_PATH,
      bold: FONT_BOLD_PATH,
      available: true,
    };
  }
  if (fs.existsSync(WIN_NIRMALA_REGULAR) && fs.existsSync(WIN_NIRMALA_BOLD)) {
    return {
      regular: WIN_NIRMALA_REGULAR,
      bold: WIN_NIRMALA_BOLD,
      available: true,
    };
  }
  return {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    available: false,
  };
};

/**
 * Formats a Date object or ISO string into DD/MM/YYYY
 */
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

/**
 * Safely embeds an SVG chart into the PDF document at the given coordinates
 */
const embedSvgChart = (doc, svgString, x, y, width, height, fallbackTitle = 'ராசி கட்டம்', fonts = { available: false }) => {
  if (!svgString || typeof svgString !== 'string' || !svgString.includes('<svg')) {
    doc.rect(x, y, width, height).fillAndStroke('#FFFBF7', '#D1C5B4');
    const titleFont = fonts.available ? 'Tamil-Bold' : 'Helvetica-Bold';
    doc.fillColor('#8B263E')
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
    console.warn(`[Horoscope PDF] Failed to parse SVG chart for ${fallbackTitle}: ${err.message}`);
    doc.rect(x, y, width, height).fillAndStroke('#FFFBF7', '#D1C5B4');
    const titleFont = fonts.available ? 'Tamil-Bold' : 'Helvetica-Bold';
    doc.fillColor('#8B263E')
      .font(titleFont)
      .fontSize(9)
      .text(`${fallbackTitle}\n(வரைபடம் ஏற்ற முடியவில்லை)`, x + 10, y + height / 2 - 12, {
        width: width - 20,
        align: 'center',
      });
  }
};

/**
 * Generates a complete Horoscope PDF Buffer for a broker candidate profile
 *
 * @param {object} profile - MatrimonialProfile document or HoroscopeRecord document
 * @returns {Promise<Buffer>} Resolves to the PDF Buffer
 */
/**
 * Draws the official Sri Varahi Matrimony Logo / Crest
 * If an image file (varahi_logo.png or logo.png) exists in backend/assets, it embeds the custom image.
 * Otherwise, it renders an authentic gold temple medallion vector crest.
 */
const drawVarahiLogo = (doc, x, y, size = 36) => {
  const customLogoPaths = [
    path.join(__dirname, '..', 'assets', 'varahi_logo.png'),
    path.join(__dirname, '..', 'assets', 'varahi_logo.jpg'),
    path.join(__dirname, '..', 'assets', 'logo.png'),
    path.join(__dirname, '..', 'assets', 'logo.jpg'),
  ];
  const foundFile = customLogoPaths.find((p) => fs.existsSync(p));

  if (foundFile) {
    try {
      doc.image(foundFile, x, y, { width: size, height: size });
      return;
    } catch (_) {
      // Fallback to vector below
    }
  }

  // Authentic Vector Gold Medallion Crest for Sri Varahi Matrimony
  const radius = size / 2;
  const cx = x + radius;
  const cy = y + radius;

  doc.save();
  // Outer gold rim
  doc.circle(cx, cy, radius).fillAndStroke('#B08D4C', '#E0BD77');
  // Inner ring
  doc.circle(cx, cy, radius - 2).strokeColor('#FFFFFF').lineWidth(0.8).stroke();
  doc.circle(cx, cy, radius - 4).strokeColor('#E0BD77').lineWidth(0.5).stroke();
  // Center deep wine base
  doc.circle(cx, cy, radius - 5).fill('#7A1E3A');

  // Temple Diya / Kalasam Flame Symbol
  doc.save();
  doc.translate(cx, cy);
  // Kalasam pot
  doc.polygon([-6, 5], [6, 5], [4, 1], [-4, 1]).fill('#E0BD77');
  // Kalasam base
  doc.rect(-5, 5, 10, 2).fill('#B08D4C');
  // Sacred Diya flame
  doc.path('M 0 -8 C 3 -4, 4 -1, 0 1 C -4 -1, -3 -4, 0 -8 Z').fill('#FFF2D4');
  doc.restore();

  doc.restore();
};

/**
 * Draws an elegant, clearly visible Varahi Matrimonial Crest Watermark centered on the page
 */
const drawVarahiWatermark = (doc, cx, cy, radius = 135, fonts = { available: false }) => {
  doc.save();
  doc.opacity(0.14); // Clearly visible yet delicate watermark behind charts and text

  // Concentric double decorative rings
  doc.circle(cx, cy, radius).lineWidth(3.5).strokeColor('#B08D4C').stroke();
  doc.circle(cx, cy, radius - 6).lineWidth(1.2).strokeColor('#7A1E3A').stroke();
  doc.circle(cx, cy, radius - 14).lineWidth(0.8).strokeColor('#B08D4C').stroke();

  // 12-petaled floral mandala rays
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    const x1 = cx + (radius - 14) * Math.cos(angle);
    const y1 = cy + (radius - 14) * Math.sin(angle);
    const x2 = cx + (radius - 34) * Math.cos(angle);
    const y2 = cy + (radius - 34) * Math.sin(angle);
    doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(1.2).strokeColor('#B08D4C').stroke();
  }

  // Inner medallion ring
  doc.circle(cx, cy, 75).lineWidth(2).strokeColor('#7A1E3A').stroke();
  doc.circle(cx, cy, 70).lineWidth(1).strokeColor('#B08D4C').stroke();

  // Traditional Sacred Temple Kalasam & Diya
  doc.save();
  doc.translate(cx, cy - 14);
  // Kalasam pot body
  doc.polygon([-22, 22], [22, 22], [15, 4], [-15, 4]).fill('#B08D4C');
  doc.rect(-18, 22, 36, 6).fill('#7A1E3A');
  // Sacred Diya coconut & flame
  doc.circle(0, 0, 14).fill('#B08D4C');
  doc.path('M 0 -30 C 14 -16, 14 -4, 0 4 C -14 -4, -14 -16, 0 -30 Z').fill('#7A1E3A');
  doc.restore();

  // Watermark Brand Typography
  const waterFont = fonts.available ? 'Tamil-Bold' : 'Helvetica-Bold';
  doc.fillColor('#7A1E3A')
    .font(waterFont)
    .fontSize(14)
    .text('SRI VARAHI MATRIMONY', cx - 130, cy + 28, { width: 260, align: 'center', characterSpacing: 1.5 });

  doc.font(waterFont)
    .fontSize(11)
    .fillColor('#B08D4C')
    .text('ஸ்ரீ வாராஹி திருமண தகவல் மையம்', cx - 130, cy + 46, { width: 260, align: 'center' });

  doc.restore();
};

/**
 * Generates a complete Horoscope PDF Buffer for a broker candidate profile
 * Supports two admin-selected template styles:
 * 1. 'classic': Solid Royal Wine Header with Gold Varahi Logo Medallion
 * 2. 'watermark': Minimalist Golden Certificate Header with Centered Full-Page Varahi Watermark
 *
 * @param {object} profile - MatrimonialProfile document or HoroscopeRecord document
 * @param {object} [options={}] - { template: 'classic' | 'watermark' }
 * @returns {Promise<Buffer>} Resolves to the PDF Buffer
 */
const generateHoroscopePdfBuffer = (profile, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      if (!profile) {
        return reject(new Error('Profile or horoscope document is required for PDF generation.'));
      }

      const template = (options.template || 'classic').toLowerCase() === 'watermark' ? 'watermark' : 'classic';

      // Read from either MatrimonialProfile.horoscope or standalone HoroscopeRecord fields
      const horoscope = profile.horoscope && profile.horoscope.isGenerated
        ? profile.horoscope
        : profile;

      if (!horoscope.isGenerated) {
        return reject(new Error('Cannot generate PDF: Horoscope has not been generated for this record yet.'));
      }

      // Prohibit simulated charts in production
      if (horoscope.isSimulated && process.env.NODE_ENV === 'production') {
        return reject(new Error('Simulated horoscopes cannot be rendered to official PDF in production mode.'));
      }

      const candidateName = (profile.personName || profile.candidateName || 'Candidate').trim();
      const profileId = String(profile._id);
      const displayProfileId = `VRH-${profileId.slice(-6).toUpperCase()}`;

      const rawGender = profile.gender || profile.personalDetails?.gender || 'Not Specified';
      const gender = rawGender.toLowerCase() === 'male'
        ? 'ஆண் / Male'
        : rawGender.toLowerCase() === 'female'
        ? 'பெண் / Female'
        : rawGender;
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

      // Resolve Tamil font configuration
      const fontConfig = resolveTamilFonts();
      const boldFont = fontConfig.available ? 'Tamil-Bold' : 'Helvetica-Bold';
      const regFont = fontConfig.available ? 'Tamil-Regular' : 'Helvetica';

      // Create A4 PDF Document with tight margin to strictly guarantee 1 single page
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 28;
      const contentWidth = pageWidth - margin * 2; // 539.28 pt

      const doc = new PDFDocument({
        size: 'A4',
        margin: 26,
        autoFirstPage: true,
        bufferPages: false,
        info: {
          Title: `Horoscope Report - ${candidateName} | Sri Varahi Matrimony`,
          Author: 'Sri Varahi Matrimony',
          Subject: 'Candidate Astrological Chart (Jathagam)',
          Keywords: 'Sri Varahi Matrimony, Horoscope, Jathagam, South Indian Chart, Prokerala',
        },
      });

      // Disable bottom margin page break trigger to guarantee strict 1-page output
      doc.page.margins.bottom = 0;

      if (fontConfig.available) {
        doc.registerFont('Tamil-Regular', fontConfig.regular);
        doc.registerFont('Tamil-Bold', fontConfig.bold);
      }

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // -------------------------------------------------------------
      // TEMPLATE 2 ONLY: Background Center Watermark
      // -------------------------------------------------------------
      if (template === 'watermark') {
        drawVarahiWatermark(doc, pageWidth / 2, 450, 135, fontConfig);
      }

      let curY = margin;

      // -------------------------------------------------------------
      // 1. HEADER SECTION (Varies by Template)
      // -------------------------------------------------------------
      if (template === 'classic') {
        // STYLE 1: Royal Plum/Wine Banner with Gold Varahi Logo Crest
        const bannerHeight = 54;
        doc.rect(margin, curY, contentWidth, bannerHeight).fill('#7A1E3A');

        // Draw Left Logo
        drawVarahiLogo(doc, margin + 10, curY + 7, 40);

        // Header Texts
        const textX = margin + 58;
        const textW = contentWidth - 68;

        // Line 1: Main Tamil Brand
        doc.fillColor('#FFFFFF')
          .font(boldFont)
          .fontSize(13)
          .text('ஸ்ரீ வாராஹி திருமண தகவல் மையம்', textX, curY + 8, {
            width: textW,
            align: 'left',
            lineBreak: false,
          });

        // Line 2: English Brand & Dossier Subtitle
        doc.fillColor('#E5D3B3')
          .font(boldFont)
          .fontSize(9)
          .text('SRI VARAHI MATRIMONY  •  ', textX, curY + 26, {
            continued: true,
            characterSpacing: 0.8,
          })
          .font(regFont)
          .fillColor('#FFFFFF')
          .text('வரன் ஜாதகக் குறிப்பு அறிக்கை (ASTROLOGICAL DOSSIER)', {
            characterSpacing: 0.2,
          });

        curY += bannerHeight + 8;
      } else {
        // STYLE 2: Watermark Certificate Header with Gold Double Border
        const headerHeight = 50;
        doc.rect(margin, curY, contentWidth, headerHeight).fillAndStroke('#FFFDF9', '#C4A87C');
        doc.rect(margin + 2, curY + 2, contentWidth - 4, headerHeight - 4).strokeColor('#EAD9BF').lineWidth(0.75).stroke();

        // Mini crest emblem on left
        drawVarahiLogo(doc, margin + 10, curY + 8, 34);

        const textX = margin + 52;
        const textW = contentWidth - 60;

        // Line 1: Main Tamil Brand
        doc.fillColor('#7A1E3A')
          .font(boldFont)
          .fontSize(13)
          .text('ஸ்ரீ வாராஹி திருமண தகவல் மையம்', textX, curY + 8, {
            width: textW,
            align: 'left',
            lineBreak: false,
          });

        // Line 2: English Brand & Dossier Subtitle
        doc.fillColor('#A78345')
          .font(boldFont)
          .fontSize(9)
          .text('SRI VARAHI MATRIMONY  •  ', textX, curY + 26, {
            continued: true,
            characterSpacing: 0.8,
          })
          .font(regFont)
          .fillColor('#5C1D2E')
          .text('வரன் ஜாதகக் குறிப்பு (OFFICIAL ASTROLOGICAL DOSSIER)', {
            characterSpacing: 0.2,
          });

        curY += headerHeight + 8;
      }

      // -------------------------------------------------------------
      // 2. Candidate Particulars Box (Two-column card)
      // -------------------------------------------------------------
      const infoBoxHeight = 78;
      doc.rect(margin, curY, contentWidth, infoBoxHeight)
        .fillAndStroke(template === 'watermark' ? '#FFFFFF' : '#FFFBF7', '#D1C5B4');

      // Header strip inside box
      doc.rect(margin, curY, contentWidth, 16).fill('#F3EAE1');
      doc.fillColor('#5C1D2E')
        .font(boldFont)
        .fontSize(8)
        .text('வரன் மற்றும் பிறப்பு விவரங்கள் (CANDIDATE & BIRTH PARTICULARS)', margin + 10, curY + 3.5);

      const col1X = margin + 12;
      const col2X = margin + contentWidth / 2 + 8;
      const labelW1 = 105;
      const labelW2 = 115;
      const rowY1 = curY + 20;
      const rowY2 = curY + 34;
      const rowY3 = curY + 48;
      const rowY4 = curY + 62;

      doc.fontSize(7.8);

      // Col 1
      doc.font(boldFont).fillColor('#3B2C35').text('பெயர் (Name):', col1X, rowY1);
      doc.font(boldFont).fillColor('#7A1E3A').text(candidateName, col1X + labelW1, rowY1);

      doc.font(boldFont).fillColor('#3B2C35').text('பதிவு எண் (Profile ID):', col1X, rowY2);
      doc.font(boldFont).fillColor('#B08D4C').text(displayProfileId, col1X + labelW1, rowY2);

      doc.font(boldFont).fillColor('#3B2C35').text('பாலினம் (Gender):', col1X, rowY3);
      doc.font(regFont).fillColor('#3B2C35').text(gender, col1X + labelW1, rowY3);

      doc.font(boldFont).fillColor('#3B2C35').text('தொடர்பு (Contact):', col1X, rowY4);
      doc.font(regFont).fillColor('#3B2C35').text(phone !== 'Not Specified' ? phone : email, col1X + labelW1, rowY4);

      // Col 2
      doc.font(boldFont).fillColor('#3B2C35').text('பிறந்த தேதி (Date of Birth):', col2X, rowY1);
      doc.font(boldFont).fillColor('#3B2C35').text(dob, col2X + labelW2, rowY1);

      doc.font(boldFont).fillColor('#3B2C35').text('பிறந்த நேரம் (Time of Birth):', col2X, rowY2);
      doc.font(regFont).fillColor('#3B2C35').text(tob, col2X + labelW2, rowY2);

      doc.font(boldFont).fillColor('#3B2C35').text('பிறந்த இடம் (Place of Birth):', col2X, rowY3);
      doc.font(regFont).fillColor('#3B2C35').text(pob, col2X + labelW2, rowY3);

      doc.font(boldFont).fillColor('#3B2C35').text('அட்சரேகை (Coordinates):', col2X, rowY4);
      doc.font(regFont).fillColor('#3B2C35').text(coords, col2X + labelW2, rowY4);

      curY += infoBoxHeight + 8;

      // -------------------------------------------------------------
      // 3. Astrological Key Data Summary (4 pill boxes)
      // -------------------------------------------------------------
      const pillGap = 8;
      const pillWidth = (contentWidth - pillGap * 3) / 4;
      const pillHeight = 38;

      const astroPills = [
        { label: 'ராசி (RASI)', val: rasi },
        { label: 'நட்சத்திரம் (STAR)', val: nakshatram },
        { label: 'பாதம் (PADA)', val: padam },
        { label: 'லக்னம் (LAGNAM)', val: lagnam },
      ];

      astroPills.forEach((p, idx) => {
        const px = margin + idx * (pillWidth + pillGap);
        doc.rect(px, curY, pillWidth, pillHeight).fillAndStroke(template === 'watermark' ? '#FFFFFF' : '#FBF7F0', '#C4A87C');
        doc.fillColor('#7A1E3A')
          .font(boldFont)
          .fontSize(7)
          .text(p.label, px, curY + 4.5, { width: pillWidth, align: 'center' });

        doc.fillColor('#261C20')
          .font(boldFont)
          .fontSize(10)
          .text(p.val, px, curY + 18, { width: pillWidth, align: 'center' });
      });

      curY += pillHeight + 7;

      // -------------------------------------------------------------
      // 4. Dosham & Dasa Balance Information Strip
      // -------------------------------------------------------------
      const summaryStripHeight = 30;
      doc.rect(margin, curY, contentWidth, summaryStripHeight)
        .fillAndStroke(template === 'watermark' ? '#FFFFFF' : '#FFFDF9', '#E5DACD');

      doc.font(boldFont).fontSize(7.5).fillColor('#7A1E3A')
        .text('தோஷ விவரம் (Dosham): ', margin + 8, curY + 5, { continued: true })
        .font(regFont).fillColor('#332228')
        .text(`${doshamSummary} — ${doshamDesc}`);

      doc.font(boldFont).fontSize(7.5).fillColor('#7A1E3A')
        .text('பிறப்பு இருப்பு திசை (Dasa Balance): ', margin + 8, curY + 17, { continued: true })
        .font(regFont).fillColor('#332228')
        .text(dasaText);

      curY += summaryStripHeight + 10;

      // -------------------------------------------------------------
      // 5. South Indian Square Charts (Side by Side)
      // -------------------------------------------------------------
      doc.font(boldFont).fontSize(9.5).fillColor('#7A1E3A')
        .text('தென்னிந்திய முறை ஜாதக கட்டங்கள் (SOUTH INDIAN HOROSCOPE CHARTS)', margin, curY, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 0.5,
        });

      curY += 13;

      const chartSize = 232;
      const chartGap = contentWidth - chartSize * 2;
      const chart1X = margin;
      const chart2X = margin + chartSize + chartGap;

      // Render Rasi (D1) Chart
      embedSvgChart(doc, horoscope.rasiChartSvg, chart1X, curY, chartSize, chartSize, 'ராசி கட்டம் (D1)', fontConfig);

      // Render Navamsa (D9) Chart
      embedSvgChart(doc, horoscope.navamsaChartSvg, chart2X, curY, chartSize, chartSize, 'நவாம்ச கட்டம் (D9)', fontConfig);

      // -------------------------------------------------------------
      // 6. Footer Notes & Varahi Attribution (Fixed at bottom within 1 page)
      // -------------------------------------------------------------
      const footerY = 772;
      doc.moveTo(margin, footerY - 8).lineTo(margin + contentWidth, footerY - 8).strokeColor('#C4A87C').lineWidth(0.75).stroke();

      doc.font(regFont).fontSize(6.8).fillColor('#6B5960')
        .text(
          `ஸ்ரீ வாராஹி திருமண தகவல் மையம் • Confidential Matrimonial Document • Generated: ${generatedDate} • ${attribution}`,
          margin,
          footerY - 4,
          { width: contentWidth, align: 'center', lineBreak: false }
        );

      doc.font(regFont).fontSize(6).fillColor('#9C8990')
        .text(
          'This document is strictly intended for matrimonial compatibility evaluation. Unapproved replication or commercial circulation is prohibited.',
          margin,
          footerY + 7,
          { width: contentWidth, align: 'center', lineBreak: false }
        );

      // Finalize the PDF stream (Guaranteed single page output)
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  formatDate,
  embedSvgChart,
  generateHoroscopePdfBuffer,
  resolveTamilFonts,
};
