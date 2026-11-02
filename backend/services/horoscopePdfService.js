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
const generateHoroscopePdfBuffer = (profile) => {
  return new Promise((resolve, reject) => {
    try {
      if (!profile) {
        return reject(new Error('Profile or horoscope document is required for PDF generation.'));
      }

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
      const lagnam = horoscope.lagnam || 'Not Specified';

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

      // Create A4 PDF Document (595.28 x 841.89 points)
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        info: {
          Title: `Horoscope Report - ${candidateName}`,
          Author: 'Matrimony Platform',
          Subject: 'Candidate Astrological Chart (Jathagam)',
          Keywords: 'Matrimony, Horoscope, Jathagam, South Indian Chart, Prokerala',
        },
      });

      if (fontConfig.available) {
        doc.registerFont('Tamil-Regular', fontConfig.regular);
        doc.registerFont('Tamil-Bold', fontConfig.bold);
      }

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = 595.28;
      const margin = 36;
      const contentWidth = pageWidth - margin * 2; // ~523.28 pt

      // -------------------------------------------------------------
      // 1. Top Decorative Brand Banner
      // -------------------------------------------------------------
      doc.rect(margin, margin, contentWidth, 54).fill('#7A1E3A');

      doc.fillColor('#FFFFFF')
        .font(boldFont)
        .fontSize(14)
        .text('திருமண தகவல் மையம் • MATRIMONY PLATFORM', margin, margin + 11, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 0.8,
        });

      doc.fillColor('#E5D3B3')
        .font(regFont)
        .fontSize(9.5)
        .text('வரன் ஜாதகக் குறிப்பு அறிக்கை (CANDIDATE JATHAGAM / ASTROLOGICAL REPORT)', margin, margin + 31, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 0.5,
        });

      let curY = margin + 64;

      // -------------------------------------------------------------
      // 2. Candidate Particulars Box (Two-column card)
      // -------------------------------------------------------------
      const infoBoxHeight = 86;
      doc.rect(margin, curY, contentWidth, infoBoxHeight)
        .fillAndStroke('#FFFBF7', '#D1C5B4');

      // Header strip inside box
      doc.rect(margin, curY, contentWidth, 18).fill('#F3EAE1');
      doc.fillColor('#5C1D2E')
        .font(boldFont)
        .fontSize(8.5)
        .text('வரன் மற்றும் பிறப்பு விவரங்கள் (CANDIDATE & BIRTH PARTICULARS)', margin + 10, curY + 4);

      const col1X = margin + 12;
      const col2X = margin + contentWidth / 2 + 10;
      const labelW1 = 110;
      const labelW2 = 120;
      const rowY1 = curY + 23;
      const rowY2 = curY + 38;
      const rowY3 = curY + 53;
      const rowY4 = curY + 68;

      doc.font(boldFont).fontSize(8).fillColor('#3B2C35');

      // Col 1
      doc.font(boldFont).text('பெயர் (Name):', col1X, rowY1);
      doc.font(regFont).text(candidateName, col1X + labelW1, rowY1);

      doc.font(boldFont).text('பதிவு எண் (Profile ID):', col1X, rowY2);
      doc.font(regFont).text(profileId.slice(-8).toUpperCase(), col1X + labelW1, rowY2);

      doc.font(boldFont).text('பாலினம் (Gender):', col1X, rowY3);
      doc.font(regFont).text(gender, col1X + labelW1, rowY3);

      doc.font(boldFont).text('மின்னஞ்சல் (Email):', col1X, rowY4);
      doc.font(regFont).text(email, col1X + labelW1, rowY4);

      // Col 2
      doc.font(boldFont).text('பிறந்த தேதி (Date of Birth):', col2X, rowY1);
      doc.font(regFont).text(dob, col2X + labelW2, rowY1);

      doc.font(boldFont).text('பிறந்த நேரம் (Time of Birth):', col2X, rowY2);
      doc.font(regFont).text(tob, col2X + labelW2, rowY2);

      doc.font(boldFont).text('பிறந்த இடம் (Place of Birth):', col2X, rowY3);
      doc.font(regFont).text(pob, col2X + labelW2, rowY3);

      doc.font(boldFont).text('அட்சரேகை (Coordinates):', col2X, rowY4);
      doc.font(regFont).text(coords, col2X + labelW2, rowY4);

      curY += infoBoxHeight + 10;

      // -------------------------------------------------------------
      // 3. Astrological Key Data Summary (4 pill boxes)
      // -------------------------------------------------------------
      const pillGap = 8;
      const pillWidth = (contentWidth - pillGap * 3) / 4;
      const pillHeight = 44;

      const astroPills = [
        { label: 'ராசி (RASI)', val: rasi },
        { label: 'நட்சத்திரம் (STAR)', val: nakshatram },
        { label: 'பாதம் (PADA)', val: padam },
        { label: 'லக்னம் (LAGNAM)', val: lagnam },
      ];

      astroPills.forEach((p, idx) => {
        const px = margin + idx * (pillWidth + pillGap);
        doc.rect(px, curY, pillWidth, pillHeight).fillAndStroke('#FBF7F0', '#C4A87C');
        doc.fillColor('#7A1E3A')
          .font(boldFont)
          .fontSize(7.5)
          .text(p.label, px, curY + 6, { width: pillWidth, align: 'center' });

        doc.fillColor('#261C20')
          .font(boldFont)
          .fontSize(10.5)
          .text(p.val, px, curY + 22, { width: pillWidth, align: 'center' });
      });

      curY += pillHeight + 8;

      // -------------------------------------------------------------
      // 4. Dosham & Dasa Balance Information Strip
      // -------------------------------------------------------------
      const summaryStripHeight = 36;
      doc.rect(margin, curY, contentWidth, summaryStripHeight).fillAndStroke('#FFFDF9', '#E5DACD');

      doc.font(boldFont).fontSize(8).fillColor('#7A1E3A')
        .text('தோஷ விவரம் (Dosham): ', margin + 10, curY + 6, { continued: true })
        .font(regFont).fillColor('#332228')
        .text(`${doshamSummary} — ${doshamDesc}`);

      doc.font(boldFont).fontSize(8).fillColor('#7A1E3A')
        .text('பிறப்பு இருப்பு திசை (Dasa Balance): ', margin + 10, curY + 20, { continued: true })
        .font(regFont).fillColor('#332228')
        .text(dasaText);

      curY += summaryStripHeight + 12;

      // -------------------------------------------------------------
      // 5. South Indian Square Charts (Side by Side)
      // -------------------------------------------------------------
      doc.font(boldFont).fontSize(10).fillColor('#7A1E3A')
        .text('தென்னிந்திய முறை ஜாதக கட்டங்கள் (SOUTH INDIAN HOROSCOPE CHARTS)', margin, curY, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 0.5,
        });

      curY += 16;

      const chartSize = 245;
      const chartGap = contentWidth - chartSize * 2; // ~33 pt
      const chart1X = margin;
      const chart2X = margin + chartSize + chartGap;

      // Render Rasi (D1) Chart
      embedSvgChart(doc, horoscope.rasiChartSvg, chart1X, curY, chartSize, chartSize, 'ராசி கட்டம் (D1)', fontConfig);

      // Render Navamsa (D9) Chart
      embedSvgChart(doc, horoscope.navamsaChartSvg, chart2X, curY, chartSize, chartSize, 'நவாம்ச கட்டம் (D9)', fontConfig);

      curY += chartSize + 14;

      // -------------------------------------------------------------
      // 6. Footer Notes & Prokerala Attribution
      // -------------------------------------------------------------
      const footerY = 800;
      doc.moveTo(margin, footerY - 14).lineTo(margin + contentWidth, footerY - 14).strokeColor('#C4A87C').lineWidth(0.75).stroke();

      doc.font(regFont).fontSize(7.5).fillColor('#6B5960')
        .text(
          `Confidential Matrimonial Document • Generated: ${generatedDate} • ${attribution}`,
          margin,
          footerY - 8,
          { width: contentWidth, align: 'center' }
        );

      doc.font(regFont).fontSize(6.5).fillColor('#9C8990')
        .text(
          'This document is strictly intended for matrimonial compatibility evaluation. Unapproved replication is prohibited.',
          margin,
          footerY + 4,
          { width: contentWidth, align: 'center' }
        );

      // Finalize the PDF stream
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
