import { Injectable, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Api } from './api';

export interface PdfAppearance {
  colorMode: 'bw' | 'theme' | 'custom';
  headerBg: string;
  headerText: string;
  dayBg: string;
  breakBg: string;
  borderColor: string;
  showLogo: boolean;
  logoSize: 'sm' | 'md' | 'lg';
  logoDataUrl: string;
  showSubjectTable: boolean;
  showSignatures: boolean;
  showPrintDate: boolean;
  footerNote: string;
  watermark: string;
  fontScale: 'compact' | 'normal' | 'large';
  margin: 'narrow' | 'normal' | 'wide';
}

export interface PublicCarouselSlide {
  id: string;
  imageDataUrl: string;
  title: string;
  caption: string;
  linkUrl?: string;
}

export interface PublicAppearance {
  heroTitle: string;
  heroSubtitle: string;
  heroStyle: 'gradient' | 'solid' | 'image';
  heroPattern: 'grid' | 'dots' | 'waves' | 'none';
  heroBgDataUrl: string;
  showLogo: boolean;
  showStats: boolean;
  showLoginButton: boolean;
  loginButtonText: string;
  announcementEnabled: boolean;
  announcementText: string;
  announcementTone: 'info' | 'warning' | 'success';
  carouselEnabled: boolean;
  carouselAutoplay: boolean;
  carouselIntervalSec: number;
  carouselHeight: 'sm' | 'md' | 'lg';
  carouselSlides: PublicCarouselSlide[];
  cardColumns: 2 | 3 | 4;
  showFooter: boolean;
  footerNote: string;
}

export interface Appearance {
  siteName: string;
  siteSubtitle: string;
  topBarTitle: string;
  logoDataUrl: string;
  logoShape: 'rounded' | 'circle' | 'square';
  sidebarStyle: 'gradient' | 'solid' | 'dark' | 'light';
  sidebarWidth: number;
  organization: string;
  loginBadge: string;
  loginHeading: string;
  loginDescription: string;
  loginShowChips: boolean;
  loginChip1: string;
  loginChip2: string;
  loginChip3: string;
  loginLeftFooter: string;
  loginBgDataUrl: string;
  loginPattern: 'grid' | 'dots' | 'waves' | 'none';
  loginCardTitle: string;
  loginCardSubtitle: string;
  loginButtonText: string;
  loginShowPublicLink: boolean;
  loginPublicLinkText: string;
  footerText: string;
  registerEnabled: boolean;
  registerPromptText: string;
  registerLinkText: string;
  registerTitle: string;
  registerSubtitle: string;
  registerViewerLabel: string;
  registerViewerDesc: string;
  registerTeacherLabel: string;
  registerTeacherDesc: string;
  registerAdminNotice: string;
  registerPendingTitle: string;
  heroTitle: string;
  heroSubtitle: string;
  cardShadow: 'none' | 'sm' | 'md' | 'lg';
  density: 'comfortable' | 'compact' | 'spacious';
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  surfaceColor: string;
  textColor: string;
  darkMode: boolean;
  fontFamily: string;
  fontSize: number;
  borderRadius: number;
  customCss: string;
  pdf: PdfAppearance;
  public: PublicAppearance;
  [key: string]: any;
}

export const DEFAULT_PDF_APPEARANCE: PdfAppearance = {
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
};

export const DEFAULT_PUBLIC_APPEARANCE: PublicAppearance = {
  heroTitle: 'ตารางเรียนสาธารณะ',
  heroSubtitle: '',
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
};

export const DEFAULT_APPEARANCE: Appearance = {
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
  pdf: { ...DEFAULT_PDF_APPEARANCE },
  public: { ...DEFAULT_PUBLIC_APPEARANCE },
};

export function hexToRgb(hex: string): [number, number, number] {
  const clean = String(hex || '#800020').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const num = parseInt(full.slice(0, 6), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function mixHex(hexA: string, hexB: string, weightB: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weightB));
  const r = Math.round(r1 * (1 - w) + r2 * w);
  const g = Math.round(g1 * (1 - w) + g2 * w);
  const b = Math.round(b1 * (1 - w) + b2 * w);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const FONT_STACKS: Record<string, string> = {
  'IBM Plex Sans Thai': "'IBM Plex Sans Thai', 'Sarabun', 'Leelawadee UI', Tahoma, sans-serif",
  Sarabun: "'Sarabun', 'IBM Plex Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
  Prompt: "'Prompt', 'IBM Plex Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
  Kanit: "'Kanit', 'IBM Plex Sans Thai', 'Leelawadee UI', Tahoma, sans-serif",
  System: "'Leelawadee UI', 'Segoe UI', Tahoma, system-ui, sans-serif",
};

const SHADOW_MAP: Record<string, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(20, 10, 14, 0.06)',
  md: '0 6px 20px rgba(20, 10, 14, 0.11)',
  lg: '0 14px 36px rgba(20, 10, 14, 0.16)',
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private api = inject(Api);
  private title = inject(Title);
  private lastPageTitle = '';

  appearance = signal<Appearance>(structuredClone(DEFAULT_APPEARANCE));

  merge(raw: Partial<Appearance> = {}): Appearance {
    return {
      ...DEFAULT_APPEARANCE,
      ...raw,
      pdf: { ...DEFAULT_PDF_APPEARANCE, ...(raw.pdf || {}) },
      public: { ...DEFAULT_PUBLIC_APPEARANCE, ...(raw.public || {}) },
    };
  }

  async load() {
    try {
      const res = await this.api.getPublicAppearance();
      if (res?.appearance) {
        const merged = this.merge(res.appearance);
        this.appearance.set(merged);
        this.apply(merged);
      }
    } catch {
      this.apply(this.appearance());
    }
  }

  setSaved(raw: Partial<Appearance>) {
    const merged = this.merge(raw);
    this.appearance.set(merged);
    this.apply(merged);
  }

  setPageTitle(pageTitle: string) {
    this.lastPageTitle = pageTitle;
    this.syncDocumentTitle(this.appearance().siteName);
  }

  syncDocumentTitle(siteName?: string) {
    const site = siteName || this.appearance().siteName || DEFAULT_APPEARANCE.siteName;
    this.title.setTitle(this.lastPageTitle ? `${this.lastPageTitle} · ${site}` : site);
  }

  apply(raw: Partial<Appearance>) {
    const ap = this.merge(raw);
    const root = document.documentElement.style;
    const p = ap.primaryColor || '#800020';
    const a = ap.accentColor || mixHex(p, '#ffffff', 0.15);
    const dark = Boolean(ap.darkMode);
    const [pr, pg, pb] = hexToRgb(p);

    root.setProperty('--maroon-950', mixHex(p, '#000000', 0.56));
    root.setProperty('--maroon-900', mixHex(p, '#000000', 0.42));
    root.setProperty('--maroon-800', mixHex(p, '#000000', 0.28));
    root.setProperty('--maroon-700', p);
    root.setProperty('--maroon-600', a);
    root.setProperty('--maroon-200', dark ? mixHex(p, '#000000', 0.45) : mixHex(p, '#ffffff', 0.74));
    root.setProperty('--maroon-100', dark ? mixHex(p, '#000000', 0.62) : mixHex(p, '#ffffff', 0.89));
    root.setProperty('--maroon-50', dark ? mixHex(p, '#000000', 0.74) : mixHex(p, '#ffffff', 0.95));

    const text = dark ? '#f5eff2' : (ap.textColor || '#22161a');
    root.setProperty('--bg', dark ? '#141115' : (ap.bgColor || '#faf7f7'));
    root.setProperty('--surface', dark ? '#1e1920' : (ap.surfaceColor || '#ffffff'));
    root.setProperty('--text', text);
    root.setProperty('--text-muted', dark ? '#b5a7ad' : mixHex(text, '#ffffff', 0.35));
    root.setProperty('--border', dark ? '#352b36' : mixHex(p, '#ffffff', 0.86));
    root.setProperty('--border-strong', dark ? '#4a3c4c' : mixHex(p, '#ffffff', 0.74));
    root.setProperty('--focus', `0 0 0 3px rgba(${pr}, ${pg}, ${pb}, 0.28)`);

    const rad = Math.max(0, Math.min(24, Number(ap.borderRadius ?? 14)));
    root.setProperty('--radius-lg', `${rad}px`);
    root.setProperty('--radius', `${Math.round(rad * 0.72)}px`);
    root.setProperty('--radius-sm', `${Math.round(rad * 0.45)}px`);

    const sw = Math.max(200, Math.min(320, Number(ap.sidebarWidth ?? 248)));
    root.setProperty('--sidebar-w', `${sw}px`);
    root.setProperty('--shadow-sm', SHADOW_MAP[ap.cardShadow || 'sm'] || SHADOW_MAP['sm']);

    document.body.style.fontFamily = FONT_STACKS[ap.fontFamily] || FONT_STACKS['IBM Plex Sans Thai'];
    const fs = Math.max(12, Math.min(18, Number(ap.fontSize ?? 14)));
    document.body.style.fontSize = `${fs}px`;
    document.body.dataset['density'] = ap.density || 'comfortable';

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', p);

    this.syncDocumentTitle(ap.siteName);

    const fav = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (fav) {
      if (ap.logoDataUrl) {
        fav.removeAttribute('type');
        fav.href = ap.logoDataUrl;
      } else {
        fav.type = 'image/svg+xml';
        fav.href = 'favicon.svg';
      }
    }

    let styleEl = document.getElementById('tt-custom-css') as HTMLStyleElement | null;
    if (ap.customCss) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'tt-custom-css';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = ap.customCss;
    } else if (styleEl) {
      styleEl.remove();
    }
  }
}

@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private theme = inject(ThemeService);

  override updateTitle(snapshot: RouterStateSnapshot) {
    this.theme.setPageTitle(this.buildTitle(snapshot) || '');
  }
}
