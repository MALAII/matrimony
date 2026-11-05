import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  HeartHandshake,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import styles from './about.module.css';

export const metadata = {
  title: 'About Us | Varaghi Matrimony | ஸ்ரீ வாராஹி திருமண தகவல் மையம்',
  description:
    'தமிழர்களின் நீண்ட நாள் தேடலுக்கு ஓர் நிரந்தர தீர்வு. மதம், ஜாதி, எல்லை கடந்து இணைக்கும் உண்மையான உறவுகள். ஸ்ரீ வாராஹி திருமண தகவல் மையம், Ranipet, Tamil Nadu.',
};

const pillars = [
  {
    icon: Users,
    tamilTitle: 'அனைத்து மதங்களுக்கும், அனைத்து ஜாதிகளுக்கும்',
    engTitle: 'Inclusive For All Communities',
    desc: 'அன்புக்கு எல்லையில்லை — எங்களுடன் எல்லோரும் ஒரே குடும்பம். அனைத்து மதங்களுக்கும், அனைத்து சமூகப் பிரிவுகளுக்கும் சம உரிமை மற்றும் மரியாதையுடன் கூடிய உன்னத வரன் தேடல் தளம்.',
  },
  {
    icon: ShieldCheck,
    tamilTitle: '100% சரிபார்க்கப்பட்ட வரன்கள்',
    engTitle: 'Verified & Authentic Profiles',
    desc: 'ஒவ்வொரு வரன் பயோடேட்டாவும் நம்பகத்தன்மை பரிசோதனையின் மூலம் குடும்ப ரீதியாக உறுதி செய்யப்படுகிறது. போலிப் பதிவுகளற்ற தூய வரன் சேவை.',
  },
  {
    icon: Sparkles,
    tamilTitle: 'பாரம்பரிய ஜாதக பொருத்தம்',
    engTitle: 'Vedic Astrology & Horoscope',
    desc: 'ராசி, நட்சத்திரம், திதி, யோகம், லக்னம் மற்றும் செவ்வாய்/சர்ப்ப தோஷ விவரங்களுடன் பாரம்பரிய ஜோதிட விதிமுறைகளுக்கு ஏற்ப துல்லியமான பொருத்தங்கள்.',
  },
  {
    icon: Lock,
    tamilTitle: 'முழுமையான தனியுரிமை & பாதுகாப்பு',
    engTitle: 'Strict Contact Number Privacy',
    desc: 'உங்கள் குடும்பத் தகவல்களும் வரன்களின் தொலைபேசி எண்களும் எப்போதும் பாதுகாப்பாக இருக்கும். பகிர வேண்டிய விவரங்களை நீங்கள் மட்டுமே தீர்மானிக்கலாம்.',
  },
  {
    icon: HeartHandshake,
    tamilTitle: 'சிக்கனமான மற்றும் சிந்தனையுடன் பொருத்தம்',
    engTitle: 'Affordable & Mindful Matchmaking',
    desc: 'உங்கள் வாழ்க்கைமுறை, விருப்பங்கள் ஆகியவற்றின் அடிப்படையில் மிகக் குறைந்த செலவில் உகந்த இணையைத் தேர்ந்தெடுக்க எளிய மற்றும் வெளிப்படையான சந்தா திட்டங்கள்.',
  },
  {
    icon: PhoneCall,
    tamilTitle: 'நேரடி அலுவலக வழிகாட்டுதல்',
    engTitle: 'Personalized Human Consultation',
    desc: 'இராணிப்பேட்டை அலுவலகத்தில் நேரிலும் தொலைபேசி வாயிலாகவும் குடும்பத்தினருக்குத் தேவையான அனைத்து ஆலோசனைகளும் கனிவுடன் வழங்கப்படும்.',
  },
];

const stats = [
  {
    icon: ShieldCheck,
    num: '100%',
    label: 'சரிபார்க்கப்பட்ட வரன்கள்',
  },
  {
    icon: Users,
    num: '50+',
    label: 'தென்னிந்திய சமூகங்கள்',
  },
  {
    icon: Sparkles,
    num: '4',
    label: 'மொழிகள் (தமிழ், தெலுங்கு, கன்னடம், மலையாளம்)',
  },
  {
    icon: MapPin,
    num: 'Ranipet',
    label: 'தலைமை அலுவலகம், தமிழ்நாடு',
  },
];

export default function AboutPage() {
  return (
    <main className={styles.page}>
      {/* 1. Hero Section */}
      <section className={styles.hero} aria-labelledby="about-hero-title">
        <div className={styles.heroBg} aria-hidden="true" />
        <img
          src="/images/varaghi/mandala-watermark.png"
          alt=""
          className={styles.mandalaWatermark}
          aria-hidden="true"
        />
        <img
          src="/images/varaghi/gold-corner.png"
          alt=""
          className={styles.goldCornerTopRight}
          aria-hidden="true"
        />
        <img
          src="/images/varaghi/gold-corner.png"
          alt=""
          className={styles.goldCornerTopLeft}
          aria-hidden="true"
        />

        <div className={styles.heroInner}>
          <div className={styles.kicker}>
            <Sparkles size={14} aria-hidden="true" />
            <span>ஸ்ரீ வாராஹி திருமண தகவல் மையம்</span>
          </div>

          <h1 id="about-hero-title" className={styles.heroTitle}>
            தமிழர்களின் நீண்ட நாள் தேடலுக்கு <br />
            <span className={styles.heroTitleGold}>ஓர் நிரந்தர தீர்வு</span>
          </h1>

          <p className={styles.heroSubtitle}>
            மதம், ஜாதி, எல்லை — எதையும் கடந்து இணைக்கும் உண்மையான உறவுகள். தென்னிந்தியக் குடும்பங்களின்
            நம்பிக்கையான திருமண தகவல் தளம். இங்கு குடும்பங்களும் மணமக்களும் ஒன்றிணைந்து வாழ்க்கையைப்
            பகிர்ந்துகொள்ளக் கூடிய உன்னத துணையைத் தேர்ந்தெடுக்கின்றனர்.
          </p>

          <div className={styles.heroActions}>
            <Link href="/members" className={styles.btnPrimaryHero}>
              <span>Browse Verified Matches</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="#contact-office" className={styles.btnSecondaryHero}>
              <PhoneCall size={16} aria-hidden="true" />
              <span>Contact Ranipet Office</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Key Stats Bar */}
      <section className={styles.statsSection} aria-label="Key Platform Statistics">
        <div className={styles.statsContainer}>
          {stats.map((s, idx) => {
            const IconComp = s.icon;
            return (
              <div key={idx} className={styles.statItem}>
                <div className={styles.statIconWrap}>
                  <IconComp size={22} aria-hidden="true" />
                </div>
                <div className={styles.statText}>
                  <span className={styles.statNumber}>{s.num}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Heritage & Mission 2-Column Story */}
      <section className={styles.storySection} aria-labelledby="story-heading">
        <div className={styles.storyGrid}>
          <div className={styles.storyText}>
            <span className={styles.sectionBadge}>
              <Sparkles size={14} aria-hidden="true" />
              <span>எங்கள் உன்னத நோக்கம்</span>
            </span>
            <h2 id="story-heading" className={styles.storyTitle}>
              உண்மையான வரன்களை மனதார இணைக்கும் பண்பாட்டுப் பாலம்
            </h2>
            <p className={styles.storyDesc}>
              <strong>ஸ்ரீ வாராஹி திருமண தகவல் மையம்</strong> என்பது விளம்பரங்களுக்கான மேலோட்டமான தளம் அல்ல.
              தமிழர்களின் பாரம்பரியக் கலாச்சாரம், குடும்பப் பின்னணி மற்றும் ஆன்மீக நம்பிக்கைகளை முழுமையாக மதித்து
              செயல்படும் பிரத்யேக திருமண தகவல் சேவையாகும்.
            </p>
            <p className={styles.storyDesc}>
              இன்றைய நவீன காலகட்டத்தில் இடைத்தரகர்களின் தொந்தரவுகளோ, உண்மைத்தன்மையற்ற போலிப் பதிவுகளோ இன்றி,
              பெற்றோரும் மணமக்களும் நேரடியாகவும் அமைதியாகவும் தங்களுக்குப் பொருத்தமான வரன்களைத் தேர்ந்தெடுக்கும்
              வகையில் இந்த தளம் உருவாக்கப்பட்டுள்ளது.
            </p>

            <ul className={styles.storyPoints}>
              <li className={styles.storyPoint}>
                <CheckCircle2 size={18} className={styles.storyPointIcon} aria-hidden="true" />
                <span>
                  <strong>முழு பயோடேட்டா & குடும்ப பின்னணி:</strong> கல்வி, உத்தியோகம், வருமானம் மற்றும் பூர்வீகம்
                  உள்ளிட்ட அத்தியாவசிய விவரங்கள் வெளிப்படையாகப் பதிவு செய்யப்படுகின்றன.
                </span>
              </li>
              <li className={styles.storyPoint}>
                <CheckCircle2 size={18} className={styles.storyPointIcon} aria-hidden="true" />
                <span>
                  <strong>ரகசியமான தொடர்பு எண்கள்:</strong> எந்த ஒரு உறுப்பினரின் தொலைபேசி எண்ணும்
                  பொதுவெளியில் காட்டப்படாது; தகுதியான பரஸ்பர விருப்பத்திற்குப் பின்னரே வெளியிடப்படும்.
                </span>
              </li>
              <li className={styles.storyPoint}>
                <CheckCircle2 size={18} className={styles.storyPointIcon} aria-hidden="true" />
                <span>
                  <strong>அனைத்து சமூகங்களுக்கும் திறந்த சேவை:</strong> வன்னியர், முதலியார், செட்டியார், பிராமணர்,
                  நாயுடு, நாடார் உட்பட அனைத்து சமூகப் பிரிவினருக்கும் சமமான முக்கியத்துவம்.
                </span>
              </li>
            </ul>
          </div>

          {/* Right Side Sacred Framed Card */}
          <div className={styles.storyCard}>
            <div className={styles.storyCardHeader}>
              <img
                src="/logo.png"
                alt="Varaghi Matrimony Logo"
                className={styles.storyCardLogo}
              />
              <div>
                <div className={styles.storyCardBrand}>Varaghi Matrimony</div>
                <div className={styles.storyCardTagline}>ஸ்ரீ வாராஹி திருமண தகவல் மையம்</div>
              </div>
            </div>

            <div className={styles.storyCardBlessing}>
              &ldquo;மங்கல வாழ்க்கை மலர ஸ்ரீ வாராஹி அம்மன் அருள் துணை நிற்கட்டும்&rdquo;
            </div>

            <div className={styles.storyCardFeatures}>
              <div className={styles.storyCardFeatureItem}>
                <ShieldCheck size={16} className={styles.storyCardFeatureIcon} aria-hidden="true" />
                <span>தலைமை அலுவலகம்: இராணிப்பேட்டை, தமிழ்நாடு</span>
              </div>
              <div className={styles.storyCardFeatureItem}>
                <HeartHandshake size={16} className={styles.storyCardFeatureIcon} aria-hidden="true" />
                <span>ஆயிரக்கணக்கான குடும்பங்களின் தொடர் நம்பிக்கை</span>
              </div>
              <div className={styles.storyCardFeatureItem}>
                <ScrollText size={16} className={styles.storyCardFeatureIcon} aria-hidden="true" />
                <span>ஜாதகம் மற்றும் ராசி கட்ட பொருத்தம்</span>
              </div>
              <div className={styles.storyCardFeatureItem}>
                <Lock size={16} className={styles.storyCardFeatureIcon} aria-hidden="true" />
                <span>100% பெண் வரன்களின் பாதுகாப்பு உறுதிப்பாடு</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Pillars Grid */}
      <section className={styles.pillarsSection} aria-labelledby="pillars-heading">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>
            <Sparkles size={14} aria-hidden="true" />
            <span>எங்கள் தனிச்சிறப்புகள்</span>
          </span>
          <h2 id="pillars-heading" className={styles.sectionTitle}>
            ஏன் வாராஹி மேட்ரிமோனி?
          </h2>
          <p className={styles.sectionSub}>
            குடும்பங்களின் நம்பிக்கையையும் வரன்களின் எதிர்பார்ப்புகளையும் இணைக்கும் எங்கள் உன்னதக் கொள்கைகள்.
          </p>
        </div>

        <div className={styles.pillarsGrid}>
          {pillars.map((item, idx) => {
            const IconComp = item.icon;
            return (
              <div key={idx} className={styles.pillarCard}>
                <div className={styles.pillarIconWrap}>
                  <IconComp size={24} aria-hidden="true" />
                </div>
                <h3 className={styles.pillarTamilTitle}>{item.tamilTitle}</h3>
                <span className={styles.pillarEngTitle}>{item.engTitle}</span>
                <p className={styles.pillarDesc}>{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Official Management Advisory Notice */}
      <section className={styles.advisorySection} aria-labelledby="advisory-heading">
        <div className={styles.advisoryBox}>
          <div className={styles.advisoryIconWrap}>
            <ScrollText size={28} aria-hidden="true" />
          </div>
          <div className={styles.advisoryContent}>
            <span className={styles.advisoryBadge}>முக்கிய அறிவிப்பு & வழிகாட்டுதல்</span>
            <h3 id="advisory-heading" className={styles.advisoryHeading}>
              மணமக்கள் & பெற்றோர்களுக்கான நிர்வாகத்தின் அன்பு வேண்டுகோள்
            </h3>
            <p className={styles.advisoryText}>
              &ldquo;மணமக்கள் பற்றிய தகவல்களை நீங்களே நன்கு விசாரித்து முடிவுக்கு வரவும். எமது நிறுவனத்தின்
              சேவை தகவல் தருவதற்காக மட்டுமே. பதிவு செய்த வரன்களுக்கு திருமணம் நிச்சயமானவுடன் எமது
              அலுவலகத்திற்கு தகவல் தெரிவிக்க அன்புடன் வேண்டுகிறோம்.&rdquo;
            </p>
            <span className={styles.advisoryAuthor}>— நிர்வாகம், ஸ்ரீ வாராஹி திருமண தகவல் மையம்</span>
          </div>
        </div>
      </section>

      {/* 6. Ranipet Office & Support Headquarters Card */}
      <section id="contact-office" className={styles.officeSection} aria-labelledby="office-heading">
        <div className={styles.officeCard}>
          <div className={styles.officeText}>
            <span className={styles.officeBadge}>
              <MapPin size={15} aria-hidden="true" />
              <span>நேரடி அலுவலகத் தொடர்பு</span>
            </span>
            <h2 id="office-heading" className={styles.officeTitle}>
              இராணிப்பேட்டை தலைமை அலுவலகம்
            </h2>
            <p className={styles.officeSubtitle}>
              எங்கள் அலுவலகத்திற்கு நேரடியாக வருகை தந்து வரன்களைப் பார்வையிடலாம் அல்லது தொலைபேசி
              வாயிலாகத் தொடர்பு கொண்டு பதிவு செய்யலாம்.
            </p>

            <div className={styles.officeDetailsList}>
              <div className={styles.officeDetailItem}>
                <MapPin size={17} className={styles.officeDetailIcon} aria-hidden="true" />
                <span>Ranipet, Tamil Nadu, India</span>
              </div>
              <div className={styles.officeDetailItem}>
                <Phone size={17} className={styles.officeDetailIcon} aria-hidden="true" />
                <span>
                  Helpline:{' '}
                  <a href="tel:+916381921242">+91 63819 21242</a>
                </span>
              </div>
              <div className={styles.officeDetailItem}>
                <Mail size={17} className={styles.officeDetailIcon} aria-hidden="true" />
                <span>
                  Email:{' '}
                  <a href="mailto:varaghiimatrimony@gmail.com">varaghiimatrimony@gmail.com</a>
                </span>
              </div>
              <div className={styles.officeDetailItem}>
                <Clock size={17} className={styles.officeDetailIcon} aria-hidden="true" />
                <span>அலுவலக நேரம்: திங்கள் முதல் சனி வரை, காலை 9:00 - மாலை 7:00</span>
              </div>
            </div>
          </div>

          {/* Quick Action Box Right */}
          <div className={styles.officeActionBox}>
            <h3 className={styles.officeActionBoxTitle}>உடனடி உதவி வேண்டுமா?</h3>
            <p className={styles.officeActionBoxSub}>
              எங்கள் திருமண ஆலோசகர்களுடன் நேரடியாகப் பேச அல்லது வாட்ஸ்அப் மூலம் தொடர்புகொள்ள:
            </p>
            <div className={styles.officeButtons}>
              <a href="tel:+916381921242" className={styles.btnOfficeCall}>
                <PhoneCall size={16} aria-hidden="true" />
                <span>Call +91 63819 21242</span>
              </a>
              <a
                href="https://wa.me/916381921242?text=வணக்கம்,%20ஸ்ரீ%20வாராஹி%20திருமண%20தகவல்%20மையம்%20பற்றி%20அறிய%20விரும்புகிறேன்."
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnOfficeWhatsApp}
              >
                <MessageCircle size={16} aria-hidden="true" />
                <span>Chat on WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Bottom Call to Action */}
      <section className={styles.bottomCtaSection} aria-labelledby="cta-heading">
        <div className={styles.bottomCtaCard}>
          <h2 id="cta-heading" className={styles.bottomCtaTitle}>
            உங்கள் குடும்பத்திற்கான மங்கல வரனை இன்றே தேடுங்கள்
          </h2>
          <p className={styles.bottomCtaSub}>
            பதிவு முற்றிலும் இலவசம். ஆயிரக்கணக்கான சரிபார்க்கப்பட்ட வரன்களைப் பார்வையிட்டு,
            உங்கள் பாரம்பரிய முறைப்படி பொருத்தமான வாழ்க்கைத் துணையை அடையுங்கள்.
          </p>
          <Link href="/register" className={styles.btnPrimaryHero}>
            <span>Register Free Profile Today</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
