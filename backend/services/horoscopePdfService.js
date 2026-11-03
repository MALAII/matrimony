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
      const col2X = margin + contentWidth / 2 + 8;
      const labelW1 = 105;
      const labelW2 = 115;
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

      curY += summaryStripHeight + 10;

      // -------------------------------------------------------------
      // 5. SOUTH INDIAN SQUARE CHARTS
      // -------------------------------------------------------------
      doc.font(boldFont).fontSize(9.8).fillColor('#650D18')
        .text('தென்னிந்திய முறை ஜாதக கட்டங்கள் (SOUTH INDIAN HOROSCOPE CHARTS)', margin, curY, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 0.5,
        });

      curY += 15;

      const chartSize = 254;
      const chartGap = contentWidth - chartSize * 2;
      const chart1X = margin;
      const chart2X = margin + chartSize + chartGap;

      embedSvgChart(doc, horoscope.rasiChartSvg, chart1X, curY, chartSize, chartSize, 'ராசி கட்டம் (D1)', fontConfig);
      embedSvgChart(doc, horoscope.navamsaChartSvg, chart2X, curY, chartSize, chartSize, 'நவாம்ச கட்டம் (D9)', fontConfig);

      curY += chartSize + 10;

      // -------------------------------------------------------------
      // 6. ASTROLOGICAL GUIDELINES & MATCHING NOTES
      // -------------------------------------------------------------
      const notesBoxHeight = 84;
      doc.roundedRect(margin, curY, contentWidth, notesBoxHeight, 5)
        .fillAndStroke('#FFFFFF', '#E8D3BC');

      doc.rect(margin, curY, contentWidth, 16).fill('#F7E9D7');
      doc.fillColor('#650D18')
        .font(boldFont)
        .fontSize(7.8)
        .text('ஜாதகக் குறிப்பு & பொருத்த வழிகாட்டுதல் (ASTROLOGICAL GUIDELINES & MATCHING NOTES)', margin + 10, curY + 3.8);

      doc.font(regFont).fontSize(7.4).fillColor('#351B1B');
      doc.text('• திருக்கணித பஞ்சாங்க முறைப்படி கிரக பாதசாரங்கள், தசா இருப்பு மற்றும் லக்ன நிலைகள் துல்லியமாக கணிக்கப்பட்டுள்ளன.', margin + 10, curY + 21);
      doc.text('• திருமண பொருத்தத்திற்கு தினப் பொருத்தம், கணப் பொருத்தம், ராசி, யோனி, ரஜ்ஜு உள்ளிட்ட 10 பொருத்தங்களை ஒப்பிட்டுப் பார்க்கவும்.', margin + 10, curY + 35);
      doc.text('• செவ்வாய் / சனி பார்வை நிலைகள் மற்றும் தசா-புக்தி சமநிலையை அனுபவமிக்க குடும்ப ஜோதிடரிடம் சரிபார்த்துக் கொள்ள பரிந்துரைக்கப்படுகிறது.', margin + 10, curY + 49);
      doc.text('• இரு குடும்பத்தினர் முன்னிலையில் வரன் ஜாதகத்தை பரிசீலித்து சுப முகூர்த்த முடிவுகளை மேற்கொள்ளவும்.', margin + 10, curY + 63);

      curY += notesBoxHeight + 8;

      // -------------------------------------------------------------
      // 7. BROKER OFFICIAL ENDORSEMENT & VERIFICATION SECTION
      // -------------------------------------------------------------
      const authBoxHeight = 88;
      doc.roundedRect(margin, curY, contentWidth, authBoxHeight, 5)
        .fillAndStroke('#FFF8E9', '#D99A24');

      doc.rect(margin, curY, contentWidth, 16).fill('#F7E9D7');
      doc.fillColor('#650D18')
        .font(boldFont)
        .fontSize(7.8)
        .text('அலுவலகச் சான்றொப்பம் & அங்கீகாரம் (OFFICIAL VERIFICATION & ENDORSEMENT)', margin + 10, curY + 3.8);

      const authCol1 = margin + 12;
      const authCol2 = margin + contentWidth / 2 + 10;

      // Col 1
      doc.font(boldFont).fontSize(8.5).fillColor('#650D18')
        .text('ஸ்ரீ வாராஹி திருமண தகவல் மையம்', authCol1, curY + 22);
      doc.font(regFont).fontSize(7.4).fillColor('#6B5555')
        .text('அங்கீகரிக்கப்பட்ட வரன் ஜாதகக் குறிப்பு அறிக்கை (Official Dossier)', authCol1, curY + 36);
      doc.font(boldFont).fontSize(7.5).fillColor('#351B1B')
        .text('பதிவாளர் கையொப்பம் (Authorized Signatory): ________________________', authCol1, curY + 54);

      // Col 2
      doc.font(boldFont).fontSize(7.5).fillColor('#351B1B')
        .text('பதிவு எண் (Dossier ID): ', authCol2, curY + 22, { continued: true })
        .font(boldFont).fillColor('#D99A24').text(displayProfileId);
      doc.font(boldFont).fontSize(7.5).fillColor('#351B1B')
        .text('வெளியிட்ட தேதி (Issued Date): ', authCol2, curY + 36, { continued: true })
        .font(regFont).fillColor('#351B1B').text(generatedDate);
      doc.font(boldFont).fontSize(7.5).fillColor('#351B1B')
        .text('சரிபார்ப்பு நிலை (Status): ', authCol2, curY + 50, { continued: true })
        .font(boldFont).fillColor('#1E6B38').text('சரிபார்க்கப்பட்டது (Verified Record)');
      doc.font(boldFont).fontSize(7.4).fillColor('#A20D16')
        .text('அங்கீகார முத்திரை (Official Seal): [ ஸ்ரீ வாராஹி சுப முத்திரை ]', authCol2, curY + 64);

      // Embed the official Varaghi bottom emblem right beside the seal text
      const emblemPaths = [
        path.join(__dirname, '..', 'assets', 'varaghi-bottom-emblem.png'),
        path.join(__dirname, '..', 'assets', 'motifs', 'varaghi-bottom-emblem.png'),
      ];
      const foundEmblem = emblemPaths.find((p) => fs.existsSync(p));
      if (foundEmblem) {
        try {
          doc.image(foundEmblem, authCol2 + 208, curY + 54, {
            fit: [22, 18],
            align: 'center',
            valign: 'center',
          });
        } catch (_) {}
      }

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
  embedSvgChart,
  generateHoroscopePdfBuffer,
  resolveTamilFonts,
};
