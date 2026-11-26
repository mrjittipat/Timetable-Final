import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths.js';

export const DEFAULT_CONFIG = {
  constraints: {
    r5_theoryRoom: true,
    r6_computerLab: true,
    r7_coTeach: true,
    r8_sportDualRoom: true,
    r9_electiveSync: true,
    r10_year4NoSchedule: true,
  },
  params: {
    breakPeriod: 5,
    maxPeriodsPerDay: 8,
    execMeeting: { day: 'Tue', periods: [1, 2, 3, 4] },
    wedFixed: { day: 'Wed', advisorPeriod: 8, activityPeriod: 9 },
    maxBlock: 4,
    latestPreferredPeriod: 9,
    timeLimitSec: 20,
    seed: 42,
  },
  document: {
    college: 'คณะศึกษาศาสตร์ มหาวิทยาลัยการกีฬาแห่งชาติ วิทยาเขตกระบี่',
    semester: '2',
    year: '2569',
    curriculumHeadName: '',
    deputyName: '',
    directorName: '',
    publicEnabled: true,
    publicBaseUrl: '',
  },
  appearance: {
    siteName: 'คณะศึกษาศาสตร์ มกช. กระบี่',
    siteSubtitle: 'ระบบจัดตารางเรียนอัตโนมัติ',
    topBarTitle: 'ระบบจัดตารางเรียนด้วยอัลกอริทึมปัญญาประดิษฐ์',
    organization: 'มหาวิทยาลัยการกีฬาแห่งชาติ วิทยาเขตกระบี่',
    loginBadge: 'SMART TIMETABLE',
    loginHeading: 'ระบบจัดตารางเรียนอัตโนมัติ',
    loginDescription: 'หลักสูตรศึกษาศาสตรบัณฑิต สาขาพลศึกษา ชั้นปีที่ 1–4 ตรวจครบทุกเงื่อนไข พร้อมใช้งานทั้งคณะ',
    loginShowChips: true,
    loginChip1: 'CSP Search + SA',
    loginChip2: 'ตรวจครบ 13 เงื่อนไข',
    loginChip3: 'ส่งออก CSV / Excel / PDF',
    loginLeftFooter: 'ภาคเรียนที่ 2 ปีการศึกษา 2569 · คณะศึกษาศาสตร์ มกช. กระบี่',
    loginCardTitle: 'เข้าสู่ระบบ',
    loginCardSubtitle: 'กรอกชื่อผู้ใช้และรหัสผ่านเพื่อจัดการตารางเรียน',
    loginButtonText: 'เข้าสู่ระบบ',
    loginShowPublicLink: true,
    loginPublicLinkText: 'ดูตารางเรียนสาธารณะ (ไม่ต้องเข้าสู่ระบบ)',
    registerEnabled: true,
    registerPromptText: 'ยังไม่มีบัญชีอาจารย์ผู้สอน?',
    registerLinkText: 'สมัครบัญชีอาจารย์',
    registerTitle: 'สมัครบัญชีอาจารย์ผู้สอน',
    registerSubtitle: 'สร้างบัญชีเพื่อดูตารางสอนและส่งคำขอปรับคาบ',
    registerTeacherLabel: 'บัญชีอาจารย์ผู้สอน (Teacher)',
    registerTeacherDesc: 'ดูตารางสอน กลุ่มเรียนที่รับผิดชอบ แจ้งคาบไม่สะดวก และส่งคำขอย้ายคาบได้',
    registerAdminNotice: 'บัญชีที่สมัครใหม่จะมีสถานะรออนุมัติจากผู้ดูแลระบบก่อนเข้าใช้งาน',
    registerPendingTitle: 'ส่งคำขอสมัครบัญชีแล้ว กรุณารอผู้ดูแลระบบอนุมัติ',
    heroTitle: 'ระบบจัดตารางเรียนอัตโนมัติ',
    heroSubtitle: 'CSP Search + Simulated Annealing พร้อมตัวตรวจเงื่อนไขแบบอิสระ',
    footerText: '© คณะศึกษาศาสตร์ มหาวิทยาลัยการกีฬาแห่งชาติ วิทยาเขตกระบี่',
    logoDataUrl: '',
    logoShape: 'rounded',
    loginBgDataUrl: '',
    loginPattern: 'grid',
    primaryColor: '#800020',
    accentColor: '#9b1b30',
    bgColor: '#faf7f7',
    surfaceColor: '#ffffff',
    textColor: '#22161a',
    sidebarStyle: 'gradient',
    darkMode: false,
    fontFamily: 'IBM Plex Sans Thai',
    fontSize: 14,
    borderRadius: 14,
    sidebarWidth: 248,
    cardShadow: 'sm',
    density: 'comfortable',
    customCss: '',
    pdf: {
      colorMode: 'bw',
      headerBg: '#800020',
      headerText: '#ffffff',
      dayBg: '#fcf4f5',
      breakBg: '#f3ecee',
      borderColor: '#22161a',
      showLogo: true,
      logoSize: 'md',
      logoDataUrl: '',
      showSubjectTable: true,
      showSignatures: true,
      showPrintDate: true,
      footerNote: '',
      watermark: '',
      fontScale: 'normal',
      margin: 'normal',
    },
    public: {
      heroTitle: 'ตารางเรียนสาธารณะ',
      heroSubtitle: 'หลักสูตรศึกษาศาสตรบัณฑิต สาขาพลศึกษา ชั้นปีที่ 1–4',
      heroStyle: 'gradient',
      heroPattern: 'grid',
      heroBgDataUrl: '',
      showLogo: true,
      showStats: true,
      showLoginButton: true,
      loginButtonText: 'เข้าสู่ระบบผู้ดูแล',
      announcementEnabled: false,
      announcementText: '',
      announcementTone: 'info',
      carouselEnabled: false,
      carouselAutoplay: true,
      carouselIntervalSec: 5,
      carouselHeight: 'md',
      carouselSlides: [],
      cardColumns: 3,
      showFooter: true,
      footerNote: '',
    },
  },
  savedSeeds: [],
  savedProfiles: [],
};

const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

export function mergeConfig(cfg = {}) {
  const c = cfg || {};
  const constraints = {};
  for (const [k, v] of Object.entries(DEFAULT_CONFIG.constraints)) {
    constraints[k] = c.constraints?.[k] !== undefined ? Boolean(c.constraints[k]) : v;
  }
  return {
    savedSeeds: Array.isArray(c.savedSeeds) ? c.savedSeeds : [],
    savedProfiles: Array.isArray(c.savedProfiles) ? c.savedProfiles : [],
    updatedAt: c.updatedAt || null,
    document: { ...DEFAULT_CONFIG.document, ...(c.document || {}) },
    constraints,
    params: {
      ...DEFAULT_CONFIG.params,
      ...(c.params || {}),
      execMeeting: {
        ...DEFAULT_CONFIG.params.execMeeting,
        ...(c.params?.execMeeting || {}),
      },
      wedFixed: {
        ...DEFAULT_CONFIG.params.wedFixed,
        ...(c.params?.wedFixed || {}),
      },
    },
    appearance: {
      ...DEFAULT_CONFIG.appearance,
      ...(c.appearance || {}),
      pdf: { ...DEFAULT_CONFIG.appearance.pdf, ...(c.appearance?.pdf || {}) },
      public: { ...DEFAULT_CONFIG.appearance.public, ...(c.appearance?.public || {}) },
    },
  };
}

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return mergeConfig(raw);
    }
  } catch {
    // Fallback to defaults on parse error
  }
  return mergeConfig();
}

export function saveConfig(cfg) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const merged = mergeConfig({ ...cfg, updatedAt: new Date().toISOString() });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}
