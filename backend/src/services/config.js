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
    siteName: 'วิทยาลัยเทคนิคพังงา',
    siteSubtitle: 'ระบบจัดตารางเรียนอัตโนมัติ',
    topBarTitle: 'ระบบจัดตารางเรียนด้วยอัลกอริทึมปัญญาประดิษฐ์',
    organization: 'สำนักงานคณะกรรมการการอาชีวศึกษา',
    loginBadge: 'SMART TIMETABLE',
    loginHeading: 'ระบบจัดตารางเรียนอัตโนมัติ',
    loginDescription: 'จัดตารางเรียนด้วยอัลกอริทึมปัญญาประดิษฐ์ ตรวจครบทุกเงื่อนไข พร้อมใช้งานทั้งสถาบัน',
    loginShowChips: true,
    loginChip1: 'จัดตารางครบทุกเงื่อนไขในไม่ถึง 1 วินาที',
    loginChip2: 'ตรวจผลด้วย validator อิสระ',
    loginChip3: 'ผู้ช่วยจัดตารางแบบออฟไลน์',
    loginLeftFooter: 'CSP Search + Simulated Annealing · 100% Offline',
    loginCardTitle: 'เข้าสู่ระบบ',
    loginCardSubtitle: 'ใช้บัญชีที่ผู้ดูแลระบบสร้างให้',
    loginButtonText: 'เข้าสู่ระบบ',
    loginShowPublicLink: true,
    loginPublicLinkText: 'ดูตารางเรียนแบบไม่ต้องเข้าสู่ระบบ',
    registerEnabled: true,
    registerPromptText: 'เป็นครูผู้สอนและยังไม่มีบัญชี?',
    registerLinkText: 'สมัครบัญชีสำหรับครู',
    registerTitle: 'สมัครบัญชีสำหรับครูผู้สอน',
    registerSubtitle: 'ส่งคำขอเพื่อรอผู้ดูแลระบบอนุมัติก่อนเข้าสู่ระบบ',
    registerViewerLabel: 'ผู้เยี่ยมชม',
    registerViewerDesc: 'ผู้เยี่ยมชมและนักเรียนสามารถดูตารางเรียนแบบไม่ต้องเข้าสู่ระบบได้ทันที',
    registerTeacherLabel: 'ครูผู้สอน (Teacher)',
    registerTeacherDesc: 'ดูภาพรวม กลุ่มเรียนที่รับผิดชอบ ตารางสอนของตนเอง และส่งออกไฟล์ได้หลังผู้ดูแลระบบอนุมัติ',
    registerAdminNotice: 'ผู้เยี่ยมชมเข้าดูตารางแบบไม่เข้าสู่ระบบได้ทันที · สิทธิ์ผู้ดูแลระบบ (Admin) ต้องให้ผู้ดูแลระบบเพิ่มให้เท่านั้น',
    registerPendingTitle: 'ส่งคำขอสมัครบัญชีครูแล้ว',
    heroTitle: 'ระบบจัดตารางเรียนอัตโนมัติ',
    heroSubtitle: 'CSP Search + Simulated Annealing พร้อมตัวตรวจเงื่อนไขแบบอิสระ',
    footerText: '© วิทยาลัยเทคนิคพังงา · ระบบจัดตารางเรียนอัตโนมัติ',
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
