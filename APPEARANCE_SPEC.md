# สเปกหน้าตกแต่งหน้าเว็บและ PDF (Appearance Studio Specification)

เอกสารนี้ถอดแบบโครงสร้าง UI, สไตล์ CSS, ตัวแปรธีม, ฟิลด์ทั้งหมด, พรีวิวสด (Live Preview), ระบบไฮไลต์สีทอง (Golden Focus Ring), การจัดการรูปภาพ และ API ของหน้า **ตกแต่งหน้าเว็บและ PDF (`/appearance`)** ให้ละเอียดครบทุกจุด เพื่อให้สามารถนำไปสร้างใหม่ได้ตรงตามต้นฉบับ 100%

> **ไฟล์ต้นฉบับอ้างอิง**
> - Page Component: `frontend/src/app/pages/appearance/appearance.ts`
> - Theme Service & Models: `frontend/src/app/core/theme.ts`
> - Global Design System: `frontend/src/styles.scss`
> - PDF Preview Modal: `frontend/src/app/shared/pdf-preview.ts`
> - Icons: `frontend/src/app/shared/icon.ts`
> - Backend Config & API: `backend/src/services/config.js`, `backend/src/routes/api.js`, `backend/src/services/exporter.js`

---

## 1. ภาพรวมและเส้นทาง (Overview & Routing)

- **Route**: `/appearance`
- **Page Title**: `ตกแต่งหน้าเว็บ` (เมื่อรวมกับ `AppTitleStrategy` จะแสดงเป็น `ตกแต่งหน้าเว็บ · {siteName}`)
- **Sidebar Menu Item**:
  ```ts
  { id: 'appearance', path: '/appearance', label: 'ตกแต่งหน้าเว็บ', icon: 'palette', exact: false }
  ```
- **สิทธิ์การใช้งาน (`auth.isAdmin()`)**:
  - ผู้ใช้ทั่วไปที่ล็อกอินเข้ามาสามารถเปิดดูหน้านี้ได้ แต่ **input / button แก้ไขทั้งหมดจะถูก `[disabled]="!auth.isAdmin()"`**
  - ปุ่มอัปโหลดรูปภาพ และแถบ `Sticky Save Bar` ด้านล่างจะแสดง **เฉพาะ Admin เท่านั้น (`@if (auth.isAdmin())`)**
- **หลักการทำงาน (Live Preview + Draft State)**:
  - เมื่อเข้าหน้า (`ngOnInit`) จะโหลดค่าจาก `GET /api/public/appearance` แล้ว clone เก็บไว้ใน `draft` signal
  - ทุกครั้งที่แก้ค่าในฝั่งซ้าย (`patch()`):
    - อัปเดต `draft`, ตั้ง `dirty = true` และเรียก `theme.apply(next)` ทันทีเพื่อให้หน้าเว็บจริงเปลี่ยนตามแบบ Real-time
    - (ยกเว้น `patchPdf()` จะอัปเดตเฉพาะ `draft` และ `dirty = true` โดยไม่ต้องเรียก `theme.apply`)
  - เมื่อออกจากหน้า (`ngOnDestroy`) หาก `dirty() === true` (ยังไม่ได้กดบันทึก) ต้องเรียก `this.theme.apply(this.theme.appearance())` เพื่อคืนค่าธีมจริงกลับ ไม่ให้ค่าทดลองค้างอยู่บนหน้าอื่น

---

## 2. โครงสร้างข้อมูลและค่าเริ่มต้น (Data Model & Defaults)

### 2.1 `PdfAppearance` Interface & Default

```ts
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
```

### 2.2 `Appearance` Interface & Default

```ts
export interface Appearance {
  // Zone 1: App Shell
  siteName: string;
  siteSubtitle: string;
  topBarTitle: string;
  logoDataUrl: string;
  logoShape: 'rounded' | 'circle' | 'square';
  sidebarStyle: 'gradient' | 'solid' | 'dark' | 'light';
  sidebarWidth: number;

  // Zone 2: Login Page
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

  // Zone 3: Register Page
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

  // Zone 4: Dashboard
  heroTitle: string;
  heroSubtitle: string;
  cardShadow: 'none' | 'sm' | 'md' | 'lg';
  density: 'comfortable' | 'compact' | 'spacious';

  // Zone 5: Colors & Dark Mode
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  surfaceColor: string;
  textColor: string;
  darkMode: boolean;

  // Zone 6: Typography & Custom CSS
  fontFamily: string;
  fontSize: number;
  borderRadius: number;
  customCss: string;

  // Zone 7: PDF Document
  pdf: PdfAppearance;
}

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
};
```

### 2.3 ชุดสีสำเร็จรูป 7 ชุด (`PRESETS`)

| ชื่อชุดสี (`name`) | `primary` | `accent` | `bg` | `surface` | `text` | `darkMode` | `sidebarStyle` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| แดงเลือดหมู (ค่าเริ่มต้น) | `#800020` | `#9b1b30` | `#faf7f7` | `#ffffff` | `#22161a` | `false` | `gradient` |
| น้ำเงินอาชีวะ | `#1e3a8a` | `#2563eb` | `#f4f7fb` | `#ffffff` | `#172033` | `false` | `gradient` |
| เขียวมรกต | `#0f766e` | `#0d9488` | `#f3faf9` | `#ffffff` | `#132a27` | `false` | `gradient` |
| ม่วงเทคโนโลยี | `#5b21b6` | `#7c3aed` | `#f7f5fc` | `#ffffff` | `#1e1633` | `false` | `gradient` |
| ส้มอิฐอบอุ่น | `#b45309` | `#d97706` | `#fcf8f3` | `#ffffff` | `#291c10` | `false` | `gradient` |
| มินิมอลขาว-ดำ | `#1f2937` | `#374151` | `#f6f7f9` | `#ffffff` | `#111827` | `false` | `light` |
| โหมดมืด (Dark Mode) | `#c81e4a` | `#e11d48` | `#141115` | `#1e1920` | `#f5eff2` | `true` | `dark` |

---

## 3. Design System & การคำนวณ CSS Variables (`ThemeService.apply()`)

### 3.1 ค่าเริ่มต้นใน `:root` (`styles.scss`)

```css
:root {
  --maroon-950: #3a000e;
  --maroon-900: #4a0012;
  --maroon-800: #5c0017;
  --maroon-700: #800020;
  --maroon-600: #9b1b30;
  --maroon-200: #ecc7ce;
  --maroon-100: #f8e7ea;
  --maroon-50: #fcf4f5;
  --bg: #faf7f7;
  --surface: #fff;
  --text: #22161a;
  --text-muted: #6b5a5e;
  --border: #e8dadd;
  --border-strong: #d5bcc2;
  --success: #1e7b4f;
  --success-bg: #e8f5ee;
  --warning: #9a5b00;
  --warning-bg: #fff4e0;
  --danger: #b42318;
  --danger-bg: #fdecea;
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --shadow-sm: 0 1px 2px rgba(58, 0, 14, 0.06);
  --shadow: 0 4px 16px rgba(58, 0, 14, 0.08);
  --shadow-lg: 0 18px 48px rgba(58, 0, 14, 0.18);
  --focus: 0 0 0 3px rgba(128, 0, 32, 0.28);
  --sidebar-w: 248px;
  --header-h: 60px;
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
}
```

### 3.2 สูตรคำนวณสีและตัวแปรแบบ Dynamic ใน `ThemeService.apply(ap)`

เมื่อ `apply(ap)` ทำงาน จะคำนวณและอัปเดต `document.documentElement.style` ดังนี้:

- **Primary (`p`)**: `ap.primaryColor || '#800020'`
- **Accent (`a`)**: `ap.accentColor || mixHex(p, '#ffffff', 0.15)`
- **เฉดสีจาก Primary (`mixHex(hexA, hexB, weightB)`)**:
  - `--maroon-950`: `mixHex(p, '#000000', 0.56)`
  - `--maroon-900`: `mixHex(p, '#000000', 0.42)`
  - `--maroon-800`: `mixHex(p, '#000000', 0.28)`
  - `--maroon-700`: `p`
  - `--maroon-600`: `a`
  - `--maroon-200`: Dark Mode → `mixHex(p, '#000000', 0.45)` | Light Mode → `mixHex(p, '#ffffff', 0.74)`
  - `--maroon-100`: Dark Mode → `mixHex(p, '#000000', 0.62)` | Light Mode → `mixHex(p, '#ffffff', 0.89)`
  - `--maroon-50`: Dark Mode → `mixHex(p, '#000000', 0.74)` | Light Mode → `mixHex(p, '#ffffff', 0.95)`
- **พื้นหลัง / การ์ด / ข้อความ / เส้นขอบ**:
  - `--bg`: Dark → `#141115` | Light → `ap.bgColor || '#faf7f7'`
  - `--surface`: Dark → `#1e1920` | Light → `ap.surfaceColor || '#ffffff'`
  - `--text`: Dark → `#f5eff2` | Light → `ap.textColor || '#22161a'`
  - `--text-muted`: Dark → `#b5a7ad` | Light → `mixHex(text, '#ffffff', 0.35)`
  - `--border`: Dark → `#352b36` | Light → `mixHex(p, '#ffffff', 0.86)`
  - `--border-strong`: Dark → `#4a3c4c` | Light → `mixHex(p, '#ffffff', 0.74)`
  - `--focus`: `0 0 0 3px rgba(${pr}, ${pg}, ${pb}, 0.28)`
- **ความโค้งมน (`rad = clamp(borderRadius, 0, 24)`)**:
  - `--radius-lg`: `${rad}px`
  - `--radius`: `${Math.round(rad * 0.72)}px`
  - `--radius-sm`: `${Math.round(rad * 0.45)}px`
- **ความกว้าง Sidebar**: `--sidebar-w`: `${clamp(sidebarWidth, 200, 320)}px`
- **เงาการ์ด (`--shadow-sm`)**:
  - `none`: `'none'`
  - `sm`: `'0 1px 2px rgba(20, 10, 14, 0.06)'`
  - `md`: `'0 6px 20px rgba(20, 10, 14, 0.11)'`
  - `lg`: `'0 14px 36px rgba(20, 10, 14, 0.16)'`
- **Font Family (`document.body.style.fontFamily`)**:
  - `'IBM Plex Sans Thai'`: `"'IBM Plex Sans Thai', 'Sarabun', 'Leelawadee UI', Tahoma, sans-serif"`
  - `'Sarabun'`: `"'Sarabun', 'IBM Plex Sans Thai', 'Leelawadee UI', Tahoma, sans-serif"`
  - `'Prompt'`: `"'Prompt', 'IBM Plex Sans Thai', 'Leelawadee UI', Tahoma, sans-serif"`
  - `'Kanit'`: `"'Kanit', 'IBM Plex Sans Thai', 'Leelawadee UI', Tahoma, sans-serif"`
  - `'System'`: `"'Leelawadee UI', 'Segoe UI', Tahoma, system-ui, sans-serif"`
- **Font Size**: `document.body.style.fontSize = '${clamp(fontSize, 12, 18)}px'`
- **Density**: `document.body.dataset['density'] = ap.density || 'comfortable'`
  - `compact`: `.page { padding: 14px; gap: 12px }`, `.card-head { padding: 10px 14px }`, `.card-body { padding: 12px 14px; gap: 10px }`
  - `spacious`: `.page { padding: 32px; gap: 26px }`, `.card-head { padding: 18px 22px }`, `.card-body { padding: 22px; gap: 18px }`
- **Side Effects อื่นๆ**:
  - อัปเดต `<meta name="theme-color">` เป็นสีหลัก `p`
  - ซิงก์ `document.title` ผ่าน `syncDocumentTitle()`
  - ซิงก์ Favicon (`link[rel="icon"]`): ถ้ามี `logoDataUrl` ใช้ `logoDataUrl` (ลบ attribute `type`), ถ้าไม่มีใช้ `/favicon.svg`
  - ฉีด `customCss` ลง `<style id="tt-custom-css">` ใน `document.head`

---

## 4. โครงสร้างหน้าและ CSS ฉบับเต็ม (Page Layout & Scoped CSS)

### 4.1 โครงสร้างภาพรวมของหน้า (Top-to-Bottom)

```text
<div class="page">                              (max-width: 1480px; padding: 24px; gap: 20px)
  1. <div class="page-head">
       - eyebrow: "แยกหมวดการตกแต่งตามแต่ละหน้าอย่างชัดเจน"
       - h1:      "ตกแต่งหน้าเว็บและ PDF"
       - p.small.muted: "เลือกโซนที่ต้องการแก้ไขด้านล่าง แล้วชี้หรือคลิกช่องใดก็ได้ กรอบสีทองในภาพพรีวิวด้านขวาจะชี้จุดที่เปลี่ยนทันที"

  2. <div class="zone-tabs" role="tablist">     (แถบ 7 แท็บ)

  3. <div class="studio">                       (2-column grid: 1.15fr | 0.95fr, min-right 370px, gap 18px)
       ├── Left Column  (flex column, gap 14px): การ์ดควบคุมของแท็บที่เลือก
       └── Right Column (<aside class="card preview-sticky">):
             ├── card-head: "พรีวิวสด · {tabTitle()}" + subtitle "กรอบสีทองชี้จุดที่กำลังแก้ไขแบบเรียลไทม์"
             │              + badge สีทอง (.hl-tag) "จุดที่แก้: {focusLabel()}" (แสดงเมื่อมี focus)
             └── card-body (padding: 14px):
                   ├── Mockup Preview เฉพาะของแท็บนั้น
                   └── <div class="callout-map"> ปุ่ม chip ลัดสำหรับจิ้มไฮไลต์แต่ละจุด

  4. <div class="sticky-bar">                   (แสดงเฉพาะ Admin; position: sticky; bottom: 14px; margin-right: 76px)
</div>

5. <app-pdf-preview>                            (Modal แสดง PDF จริงจาก backend เมื่อกด "ดูตัวอย่าง PDF จริง")
```

### 4.2 Global UI Classes ที่จำเป็นต้องมี (`styles.scss`)

- `.page`: `padding: 24px; max-width: 1480px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;`
- `.eyebrow`: `font-size: 12px; font-weight: 600; color: var(--maroon-700); letter-spacing: 0.02em; margin-bottom: 2px;`
- `.card`: `background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); display: flex; flex-direction: column;`
- `.card-head`: `padding: 14px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;`
- `.card-body`: `padding: 18px; display: flex; flex-direction: column; gap: 14px;`
- `.grid-2`: `display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px;` (ใต้ `960px` → `1fr`)
- `.row`: `display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`
- `.field`: `display: flex; flex-direction: column; gap: 5px;` (`> label`: `13px`, `font-weight: 500`; `.hint`: `12px`, `--text-muted`)
- `.input`: `width: 100%; min-height: 38px; padding: 7px 11px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font: inherit;`
- `.segmented`: `display: inline-flex; padding: 3px; background: var(--maroon-100); border-radius: 10px; gap: 2px;`
  - `button`: `border: 0; background: transparent; padding: 6px 13px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--maroon-900); cursor: pointer;`
  - `button.active`: `background: #fff; color: var(--maroon-700); font-weight: 600; box-shadow: var(--shadow-sm);`
- `.switch`: toggle pill ขนาด `42px × 24px`, วงกลมขาว `18px × 18px` เลื่อน `translateX(18px)` เมื่อ checked, พื้นหลัง `--maroon-700` เมื่อ checked / `--border-strong` เมื่อ unchecked

### 4.3 Scoped CSS เฉพาะหน้า Appearance (คัดลอกใช้ได้ทันที)

```css
/* 1. Zone Tabs (8 แท็บบรรทัดเดียว ไม่ตกบรรทัดใหม่) */
.zone-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
  background: var(--surface);
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.zone-tabs::-webkit-scrollbar { display: none; }
.zone-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 11px;
  flex: 1 0 auto;
  white-space: nowrap;
  border-radius: var(--radius);
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.14s var(--ease), color 0.14s var(--ease);
}
.zone-tab:hover { background: var(--maroon-50); color: var(--maroon-700); }
.zone-tab.active { background: var(--maroon-700); color: #fff; font-weight: 600; }

/* 2. Two-Column Studio Layout & Card Spacing */
.studio {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(370px, 0.95fr);
  gap: 18px;
  align-items: start;
}
.left-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.left-col .card-body { display: flex; flex-direction: column; gap: 16px; padding: 20px; }
.left-col .grid-2 { gap: 16px; align-items: start; }
@media (max-width: 1120px) {
  .studio { grid-template-columns: 1fr; }
}
.preview-sticky {
  position: sticky;
  top: calc(var(--header-h) + 14px);
}

/* 3. Color Presets & Inputs */
.presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 8px; }
.preset-btn {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  transition: border-color 0.15s var(--ease), transform 0.12s var(--ease);
}
.preset-btn:hover { border-color: var(--maroon-700); transform: translateY(-1px); }
.dot-swatch { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; border: 2px solid rgba(0, 0, 0, 0.12); }
.color-row { display: flex; align-items: center; gap: 8px; }
.color-row input[type='color'] {
  width: 40px; height: 36px; padding: 2px; border-radius: 8px;
  border: 1px solid var(--border-strong); background: var(--surface); cursor: pointer;
}

/* 4. Logo Preview Tile */
.preview-logo {
  width: 68px; height: 68px; background: var(--maroon-50); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;
}
.preview-logo img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
.preview-logo.rounded { border-radius: 16px; }
.preview-logo.circle { border-radius: 50%; }
.preview-logo.square { border-radius: 4px; }

/* 5. Toggle Box (การ์ดสวิตช์พร้อมป้าย เปิด/ปิด) */
.toggle-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 13px;
  border-radius: var(--radius);
  border: 1.5px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.16s var(--ease), background 0.16s var(--ease);
}
.toggle-box:hover { border-color: var(--maroon-600); }
.toggle-box.on { border-color: var(--maroon-200); background: var(--maroon-50); }
.toggle-box-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.toggle-box-title { font-size: 13.5px; font-weight: 600; color: var(--text); }
.toggle-box-sub { font-size: 12px; color: var(--text-muted); }
.toggle-box-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.toggle-state {
  font-size: 11.5px; font-weight: 600; padding: 2px 8px; border-radius: 999px;
  background: var(--border); color: var(--text-muted);
}
.toggle-box.on .toggle-state { background: var(--maroon-700); color: #fff; }

/* 6. Sticky Save Bar (เว้นขวา 76px หลบปุ่ม Chat Widget มุมขวาล่าง) */
.sticky-bar {
  position: sticky;
  bottom: 14px;
  z-index: 300;
  margin-right: 76px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  padding: 12px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
@media (max-width: 640px) {
  .sticky-bar { margin-right: 0; margin-bottom: 74px; }
}

/* 7. Golden Focus Highlight Ring */
.hl-zone { position: relative; transition: box-shadow 0.18s var(--ease); }
.hl-zone.hl-on {
  box-shadow: 0 0 0 2.5px #f59e0b, 0 0 0 5px rgba(245, 158, 11, 0.28) !important;
  z-index: 5;
}
.hl-tag {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 999px;
  background: #fef3c7; color: #92400e; border: 1px solid #f59e0b;
}

/* 8. Browser Chrome Frame */
.mock-browser {
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg);
  box-shadow: var(--shadow-sm);
}
.mock-bar {
  display: flex; align-items: center; gap: 6px; padding: 7px 10px;
  background: rgba(0, 0, 0, 0.05); border-bottom: 1px solid var(--border);
  font-size: 11px; color: var(--text-muted);
}
.mb-dot { width: 8px; height: 8px; border-radius: 50%; background: #d1d5db; }
/* สีจุด 3 จุดใน bar: #f87171 (แดง), #fbbf24 (เหลือง), #34d399 (เขียว) */
.mb-url {
  flex: 1; background: var(--surface); border: 1px solid var(--border);
  border-radius: 999px; padding: 2px 10px; font-size: 10.5px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* 9. Mini App Shell */
.mini-shell { display: flex; min-height: 245px; font-size: 10.5px; }
.mini-side {
  padding: 10px 8px; color: #fff; display: flex; flex-direction: column; gap: 6px;
  flex-shrink: 0; transition: width 0.15s var(--ease);
}
.mini-side.light { background: var(--surface); color: var(--text); border-right: 1px solid var(--border); }
.mini-brand { display: flex; align-items: center; gap: 6px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.18); }
.mini-side.light .mini-brand { border-bottom-color: var(--border); }
.mini-logo-tile {
  width: 26px; height: 26px; background: #fff; color: var(--maroon-700);
  display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;
}
.mini-logo-tile img { width: 100%; height: 100%; object-fit: contain; padding: 2px; }
.mini-logo-tile.rounded { border-radius: 7px; }
.mini-logo-tile.circle { border-radius: 50%; }
.mini-logo-tile.square { border-radius: 2px; }
.mini-nav-it { padding: 4px 6px; border-radius: 5px; opacity: 0.85; font-size: 10px; }
.mini-nav-it.active { background: #fff; color: var(--maroon-700); opacity: 1; font-weight: 700; }
.mini-side.light .mini-nav-it.active { background: var(--maroon-700); color: #fff; }
.mini-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.mini-top {
  padding: 8px 10px; border-bottom: 1px solid var(--border); font-weight: 600; font-size: 10.5px;
  display: flex; justify-content: space-between; align-items: center;
}
.mini-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; flex: 1; }

/* 10. Mini Login Mockup */
.mini-login { display: grid; grid-template-columns: 1.18fr 1fr; min-height: 295px; }
.mini-login-l {
  position: relative; padding: 14px 12px; color: #fff;
  display: flex; flex-direction: column; justify-content: space-between; gap: 10px;
  background-size: cover; background-position: center; overflow: hidden;
}
.mini-pat { position: absolute; inset: 0; pointer-events: none; opacity: 0.22; }
.mini-pat.grid {
  background-image: linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px);
  background-size: 16px 16px;
}
.mini-pat.dots {
  background-image: radial-gradient(rgba(255,255,255,.55) 1.2px, transparent 1.2px);
  background-size: 12px 12px;
}
.mini-pat.waves {
  background-image: repeating-linear-gradient(-45deg, rgba(255,255,255,.25) 0 4px, transparent 4px 12px);
}
.mini-login-r {
  padding: 12px 10px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px; background: var(--bg);
}
.mini-login-card {
  width: 100%; background: var(--surface); border: 1px solid var(--border);
  border-top: 3px solid var(--maroon-700); border-radius: 8px; padding: 10px;
  display: flex; flex-direction: column; gap: 6px;
}
.mini-chip {
  display: inline-block; padding: 2px 6px; border-radius: 5px;
  background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.24);
  font-size: 7.5px;
}

/* 11. Live A4 Landscape PDF Mockup */
.pdf-paper {
  background: #fff; color: #111; border: 1px solid #d1c7ca; border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); aspect-ratio: 297 / 210;
  position: relative; overflow: hidden; display: flex; flex-direction: column;
  font-family: 'Sarabun', 'IBM Plex Sans Thai', sans-serif;
}
.pdf-watermark {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  pointer-events: none; transform: rotate(-24deg);
  font-size: 32px; font-weight: 800; opacity: 0.11; letter-spacing: 2px; white-space: nowrap;
}
.pdf-top { display: flex; gap: 0; }
.pdf-head-box {
  border: 1px solid; padding: 5px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; gap: 2px;
}
.pdf-sub-tbl { flex: 1; border-collapse: collapse; font-size: 7.5px; }
.pdf-sub-tbl th, .pdf-sub-tbl td { border: 1px solid; padding: 1.5px 3px; text-align: center; }
.pdf-grid { width: 100%; border-collapse: collapse; margin-top: 5px; flex: 1; }
.pdf-grid th, .pdf-grid td { border: 1px solid; text-align: center; padding: 2px; }
.pdf-sigs {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;
  margin-top: 6px; text-align: center; font-size: 7px;
}
.pdf-foot {
  display: flex; justify-content: space-between; font-size: 6.5px; color: #555; margin-top: 3px;
}

/* 12. Callout Map Chips */
.callout-map {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 10px;
  border-top: 1px solid var(--border);
}
.cmap-chip {
  font-size: 11px; padding: 3px 8px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer;
}
.cmap-chip.active {
  background: #fef3c7; color: #92400e; border-color: #f59e0b; font-weight: 600;
}
```

---

## 5. รายละเอียดครบทั้ง 8 แท็บ (Zone Tabs & Controls + Live Previews)

แถบ `.zone-tabs` มีทั้งหมด **8 แท็บ** อยู่ในบรรทัดเดียว (`flex-wrap: nowrap; overflow-x: auto`) เรียงตามลำดับ (เมื่อกดเปลี่ยนแท็บ `setTab(t)` จะรีเซ็ต `focus.set('')`):

| ลำดับ | Key (`TabKey`) | Icon (`size=15`) | ข้อความบนแท็บ | หัวข้อพรีวิว (`tabTitle()`) |
| :---: | --- | --- | --- | --- |
| 1 | `shell` | `menu` | แถบเมนูและส่วนหัว | แถบเมนูและส่วนหัว (App Shell) |
| 2 | `login` | `shield` | หน้าเข้าสู่ระบบ | หน้าเข้าสู่ระบบ (Login) |
| 3 | `register` | `users` | หน้าสมัครบัญชี | หน้าสมัครบัญชีใหม่ (Register) |
| 4 | `dashboard` | `dashboard` | หน้าภาพรวม | หน้าภาพรวม (Dashboard) |
| 5 | `public` | `external` | หน้าสาธารณะ | หน้าตารางเรียนสาธารณะ (/p) |
| 6 | `colors` | `palette` | สีและธีม | สีและธีม |
| 7 | `typography` | `sliders` | ฟอนต์และ CSS | ฟอนต์และมุมโค้ง |
| 8 | `pdf` | `file` | เอกสาร PDF | เอกสาร PDF (A4 แนวนอน) |

> **พฤติกรรม Focus Highlight**: ทุก `.field` (หรือกลุ่มควบคุม) จะผูก `(mouseenter)="focus.set('<key>')" (focusin)="focus.set('<key>')"` เพื่อให้กรอบสีทอง `.hl-zone.hl-on` ในพรีวิวขวาติดทันที

---

### แท็บที่ 1: `shell` — แถบเมนูและส่วนหัว

#### ฝั่งซ้าย (2 การ์ด)

**การ์ด 1: `ชื่อสถาบันและข้อความแถบนำทาง`**
1. `.grid-2`:
   - `siteName` (focus: `siteName`) — Label: `ชื่อเว็บไซต์ / ชื่อสถาบัน (Sidebar & ชื่อแท็บ)` — `<input class="input">`
   - `siteSubtitle` (focus: `siteSubtitle`) — Label: `ชื่อรองใต้แบรนด์ (Sidebar)` — `<input class="input">`
2. `topBarTitle` (focus: `topBarTitle`) — Label: `ข้อความแถบด้านบน (Top Bar)` — `<input class="input">`
3. Toggle Box (`syncCollege`, ค่าเริ่มต้น `true`):
   - Title: `ซิงก์ชื่อสถาบันไปยังหัวกระดาษ PDF และ Excel`
   - Sub: `อัปเดตค่า document.college อัตโนมัติเมื่อกดบันทึก`

**การ์ด 2: `โลโก้หลักและสไตล์แถบด้านข้าง (Sidebar)`**
1. แถวอัปโหลดโลโก้ (focus: `logo`):
   - กล่อง `.preview-logo` (`68×68px`, class ตาม `logoShape`: `rounded` | `circle` | `square`) แสดง `logoDataUrl` หรือ fallback `logo.png`
   - ปุ่ม (Admin): `อัปโหลดโลโก้ใหม่` (`btn primary sm`, icon `upload` 15px) + ปุ่ม `ใช้โลโก้เริ่มต้น` (`btn sm ghost`, สี `--danger`, แสดงเมื่อมี `logoDataUrl`, เรียก `clearWebLogo()` ล้างทั้งเว็บและ PDF)
   - `<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">`
   - Hint: `รองรับ PNG, JPEG, WebP, SVG · ระบบจะแปลงเป็น PNG ความละเอียดสูงให้หน้า PDF อัตโนมัติด้วย`
   - `logoShape` (focus: `logoShape`) — Label: `รูปทรงกรอบโลโก้` — `.segmented`: `มุมมน` (`rounded`), `วงกลม` (`circle`), `สี่เหลี่ยม` (`square`)
2. `.grid-2`:
   - `sidebarStyle` (focus: `sidebarStyle`) — Label: `สไตล์แถบด้านข้าง` — `.segmented`: `ไล่เฉด` (`gradient`), `สีทึบ` (`solid`), `สีเข้ม` (`dark`), `สีขาว` (`light`)
   - `sidebarWidth` (focus: `sidebarWidth`) — Label: `ความกว้างแถบด้านข้าง: {sidebarWidth} px` — `<input type="range" min="210" max="300" step="2">`

#### ฝั่งขวา (Preview 1: Mini App Shell)
- `.mock-browser` + `.mock-bar` URL แสดง `{siteName} · {siteSubtitle}`
- `.mini-shell`:
  - `.mini-side` (highlight เมื่อ `sidebarStyle` หรือ `sidebarWidth`):
    - กว้าง `Math.round(draft().sidebarWidth * 0.48) px`
    - พื้นหลัง `miniSidebarBg()`:
      - `light`: `darkMode ? '#1e1920' : surfaceColor` (ใส่ class `.light`)
      - `dark`: `'linear-gradient(180deg, #1b1920 0%, #0f0d12 100%)'`
      - `solid`: `primaryColor`
      - `gradient`: `` `linear-gradient(180deg, ${primaryColor} 0%, #2a000b 100%)` ``
    - `.mini-brand`: `.mini-logo-tile` (`26×26px`, class `logoShape`, highlight เมื่อ `logo`/`logoShape`) + `siteName` (`10px`, bold) + `siteSubtitle` (`8.5px`, opacity `0.85`)
    - เมนูจำลอง 4 รายการ: `ภาพรวม` (active), `จัดตารางสอน ▾`, `ตารางเรียน`, `ส่งออกไฟล์`
  - `.mini-main` (bg/color ตาม `darkMode` หรือ `bgColor`/`textColor`):
    - `.mini-top` (highlight เมื่อ `topBarTitle`): แสดง `topBarTitle` ด้านซ้าย + `ผู้ดูแล ▾` ด้านขวา
    - `.mini-body`: แสดงข้อความกลางกล่อง `พื้นที่เนื้อหาหลัก (กว้าง Sidebar: {sidebarWidth}px)`
- **Callout Chips (6 ปุ่ม)**: `ชื่อสถาบัน` (`siteName`), `ชื่อรอง` (`siteSubtitle`), `Top Bar` (`topBarTitle`), `โลโก้` (`logo`), `สไตล์ Sidebar` (`sidebarStyle`), `ความกว้าง` (`sidebarWidth`)

---

### แท็บที่ 2: `login` — หน้าเข้าสู่ระบบ (Login)

#### ฝั่งซ้าย (2 การ์ด)

**การ์ด 1: `ฝั่งซ้ายหน้า Login (แบรนด์ หัวข้อ และจุดเด่น)`**
1. `.grid-2`:
   - `organization` (focus: `organization`) — Label: `ชื่อหน่วยงานสังกัด (ใต้ชื่อสถาบัน)`
   - `loginBadge` (focus: `loginBadge`) — Label: `ป้ายกำกับด้านบน (Pill Badge)` — placeholder: `เว้นว่างเพื่อซ่อน`
2. `loginHeading` (focus: `loginHeading`) — Label: `หัวข้อใหญ่หน้า Login`
3. `loginDescription` (focus: `loginDescription`) — Label: `คำอธิบายใต้หัวข้อ` — `<textarea rows="2">`
4. กลุ่ม Feature Chips (focus: `loginChips`):
   - Toggle Box `loginShowChips`: Title `แสดงป้ายจุดเด่น 3 ช่อง (Feature Chips)` / Sub `ป้ายข้อความจุดเด่นใต้คำอธิบายฝั่งซ้ายหน้า Login`
   - เมื่อเปิด แสดง `<input>` 3 ช่องเรียงแนวตั้ง (gap `6px`): `loginChip1`, `loginChip2`, `loginChip3` (placeholder `จุดเด่นที่ 1/2/3 (เว้นว่างเพื่อซ่อน)`)
5. `loginLeftFooter` (focus: `loginLeftFooter`) — Label: `ข้อความบรรทัดล่างซ้าย`
6. `.grid-2`:
   - `loginBgDataUrl` (focus: `loginBg`) — Label: `ภาพพื้นหลังฝั่งซ้าย` — ปุ่ม `อัปโหลดภาพ` (accept `image/png,image/jpeg,image/webp`) + ปุ่ม `ลบภาพ` (เมื่อมีภาพ)
   - `loginPattern` (focus: `loginPattern`) — Label: `ลวดลายตกแต่ง (Pattern)` — `.segmented`: `ตาราง` (`grid`), `จุด` (`dots`), `เฉียง` (`waves`), `ไม่มี` (`none`)

**การ์ด 2: `ฝั่งขวาหน้า Login (การ์ดเข้าสู่ระบบ ปุ่มสาธารณะ และท้ายหน้า)`**
1. `.grid-2`:
   - `loginCardTitle` (focus: `loginCardTitle`) — Label: `หัวข้อกล่องเข้าสู่ระบบ`
   - `loginCardSubtitle` (focus: `loginCardSubtitle`) — Label: `ข้อความรองใต้หัวข้อ`
   - `loginButtonText` (focus: `loginButtonText`) — Label: `ข้อความบนปุ่มเข้าสู่ระบบ`
   - `loginShowPublicLink` (focus: `loginPublicLink`) — Label: `ปุ่มดูตารางสาธารณะ (/p)` — Toggle Box: Title `แสดงปุ่มดูตารางสาธารณะ` / Sub `เปิดให้กดไปหน้า /p จากหน้า Login`
2. ถ้า `loginShowPublicLink` เปิด:
   - `loginPublicLinkText` (focus: `loginPublicLink`) — Label: `ข้อความบนปุ่มดูตารางสาธารณะ`
3. `footerText` (focus: `footerText`) — Label: `ข้อความท้ายหน้า (Footer)`

#### ฝั่งขวา (Preview 2: Mini Login Page)
- `.mock-browser` URL: `/login · หน้าเข้าสู่ระบบ`
- `.mini-login` (grid `1.18fr 1fr`, min-height `295px`):
  - **ซ้าย `.mini-login-l`** (highlight เมื่อ `loginBg`/`loginPattern`):
    - `background-image` จาก `loginPreviewBg()`:
      - มี `loginBgDataUrl`: `` `linear-gradient(180deg, rgba(30,0,10,0.45), rgba(30,0,10,0.75)), url(${loginBgDataUrl})` ``
      - ไม่มี: `` `linear-gradient(145deg, ${primaryColor} 0%, ${accentColor} 55%, #2a000b 100%)` ``
    - Overlay `.mini-pat` ตาม `loginPattern`
    - บน: โลโก้ `30×30px` + `siteName` + `organization`
    - กลาง: Pill `loginBadge` (ถ้าไม่ว่าง) + `loginHeading` (`13px` bold) + `loginDescription` (`8.5px`) + 3 `.mini-chip` (ถ้า `loginShowChips` เปิด)
    - ล่าง: `loginLeftFooter` (`7.5px`)
  - **ขวา `.mini-login-r`**:
    - `.mini-login-card` (มี `border-top: 3px solid var(--maroon-700)`):
      - `loginCardTitle`, `loginCardSubtitle`, ช่อง input จำลอง 2 ช่อง (`height: 18px`), ปุ่มเข้าสู่ระบบ (`height: 22px`, bg `primaryColor`, แสดง `loginButtonText`), ปุ่มสาธารณะ (ถ้าเปิด แสดง `loginPublicLinkText`)
    - ใต้การ์ด: `footerText` (`7.5px`)
- **Callout Chips (7 ปุ่ม)**: `หัวข้อซ้าย` (`loginHeading`), `ป้ายจุดเด่น 3 ช่อง` (`loginChips`), `ภาพพื้นหลัง` (`loginBg`), `กล่องขวา` (`loginCardTitle`), `ปุ่มเข้าสู่ระบบ` (`loginButtonText`), `ปุ่มสาธารณะ` (`loginPublicLink`), `ท้ายหน้า` (`footerText`)

---

### แท็บที่ 3: `register` — หน้าสมัครบัญชี (Register)

#### ฝั่งซ้าย (1 การ์ด: `ตั้งค่าหน้าสมัครบัญชีใหม่ (Register)`)
1. Toggle Box `registerEnabled !== false` (focus: `registerEnabled`):
   - Title: `เปิดรับสมัครบัญชีผู้ใช้งานใหม่`
   - Sub: `หากปิด ปุ่ม "สมัครบัญชีใหม่" จะถูกซ่อนและระบบจะปิด API รับสมัครชั่วคราว`
2. `.grid-2`:
   - `registerPromptText` (focus: `registerPrompt`) — Label: `ข้อความชวนสมัครใต้ปุ่มเข้าสู่ระบบ`
   - `registerLinkText` (focus: `registerPrompt`) — Label: `ข้อความปุ่มลิงก์สมัครบัญชี`
   - `registerTitle` (focus: `registerTitle`) — Label: `หัวข้อใหญ่หน้าสมัครบัญชี`
   - `registerSubtitle` (focus: `registerSubtitle`) — Label: `คำอธิบายใต้หัวข้อหน้าสมัคร`
3. `registerTeacherLabel` (focus: `registerTeacher`) — Label: `ชื่อการ์ดสิทธิ์ครูผู้สอน`
4. `registerTeacherDesc` (focus: `registerTeacher`) — Label: `คำอธิบายสิทธิ์ครูผู้สอน` — `<textarea rows="2">`
5. `registerAdminNotice` (focus: `registerAdminNotice`) — Label: `ข้อความแจ้งเตือนสิทธิ์ผู้ดูแลระบบ (Admin)`
6. `registerPendingTitle` (focus: `registerPendingTitle`) — Label: `หัวข้อหน้าแจ้งสถานะรออนุมัติ (หลังครูส่งคำขอ)`

#### ฝั่งขวา (Preview 3: Register Page)
- `.mock-browser` (padding `14px`, bg ตาม `darkMode ? '#141115' : bgColor`):
  - หาก `registerEnabled === false`: แสดง `.alert.warning` พร้อม icon `alert` + ข้อความ `ปิดรับสมัครบัญชีใหม่อยู่ — ปุ่มสมัครสมาชิกจะถูกซ่อนจากหน้า Login`
  - หากเปิด: แสดงการ์ดจำลอง (`border-top: 3px solid var(--maroon-700)`, `border-radius: 10px`, `padding: 12px`):
    - Header: ไอคอน `users` ในกล่อง `28×28px` สี `primaryColor` + `registerTitle` + `registerSubtitle`
    - การ์ดสิทธิ์ครู (`border: 1.5px solid var(--maroon-700); background: var(--maroon-50)`): `registerTeacherLabel` + badge warning `รออนุมัติจาก Admin` + `registerTeacherDesc`
    - กล่องแจ้งเตือน Admin (เส้นประ `1px dashed`, แสดงเมื่อมี `registerAdminNotice`)
    - แถบชวนสมัคร (`background: var(--maroon-50); border: 1px solid var(--maroon-200)`): `{registerPromptText}` + `<strong>` ขีดเส้นใต้สี `primaryColor` `{registerLinkText}`
    - แถบสถานะรออนุมัติ (`background: var(--warning-bg); color: var(--warning)`): `หน้าจอรออนุมัติครู: {registerPendingTitle}`
- **Callout Chips (7 ปุ่ม)**: `เปิด/ปิดรับสมัคร` (`registerEnabled`), `หัวข้อ` (`registerTitle`), `การ์ดผู้เยี่ยมชม` (`registerViewer`), `การ์ดครู` (`registerTeacher`), `แจ้งเตือน Admin` (`registerAdminNotice`), `ปุ่มชวนสมัคร` (`registerPrompt`), `หน้ารออนุมัติ` (`registerPendingTitle`)

---

### แท็บที่ 4: `dashboard` — หน้าภาพรวม (Dashboard)

#### ฝั่งซ้าย (1 การ์ด: `ส่วนหัวและรูปแบบการ์ดหน้าภาพรวม (Dashboard)`)
1. `heroTitle` (focus: `heroTitle`) — Label: `หัวข้อใหญ่ Hero หน้าภาพรวม`
2. `heroSubtitle` (focus: `heroSubtitle`) — Label: `ข้อความรองใต้หัวข้อ Hero`
3. `.grid-2`:
   - `cardShadow` (focus: `cardShadow`) — Label: `ระดับเงาการ์ด (Card Shadow)` — `.segmented`: `ไม่มี` (`none`), `เบา` (`sm`), `กลาง` (`md`), `ชัด` (`lg`)
   - `density` (focus: `density`) — Label: `ความโปร่งของเนื้อหา (Density)` — `.segmented`: `กระชับ` (`compact`), `พอดี` (`comfortable`), `โปร่ง` (`spacious`)

#### ฝั่งขวา (Preview 4: Dashboard Hero)
- `.mock-browser` (padding `12px`, bg ตาม `darkMode ? '#141115' : bgColor`):
  - การ์ดจำลอง (highlight เมื่อ `cardShadow`/`density`):
    - `box-shadow` จาก `previewShadow()`: `none` | `sm: 0 1px 3px rgba(20,10,14,0.08)` | `md: 0 6px 20px rgba(20,10,14,0.14)` | `lg: 0 14px 36px rgba(20,10,14,0.22)`
    - `padding`: `compact` → `10px` | `comfortable` → `14px` | `spacious` → `18px`
    - Eyebrow: `{siteName}` (`9.5px`, bold, `--maroon-700`)
    - `heroTitle` (`15px`, bold) + `heroSubtitle` (`11px`, `--text-muted`)
    - KPI Grid 3 คอลัมน์: `กลุ่มเรียน: 8`, `ครูผู้สอน: 18`, `ห้องเรียน: 21`
- **Callout Chips (4 ปุ่ม)**: `หัวข้อ Hero` (`heroTitle`), `ข้อความรอง` (`heroSubtitle`), `เงาการ์ด` (`cardShadow`), `ความโปร่ง` (`density`)

---

### แท็บที่ 5: `colors` — สีและธีม

#### ฝั่งซ้าย (2 การ์ด)
**การ์ด 1: `ชุดสีสำเร็จรูป (คลิกเปลี่ยนทันที)`**
- `.presets` แสดงปุ่ม 7 ชุดสีจากตาราง `PRESETS` พร้อมจุดสี `.dot-swatch` (`20×20px` วงกลม) — คลิกเรียก `applyPreset(p)` (อัปเดต `primaryColor`, `accentColor`, `bgColor`, `surfaceColor`, `textColor`, `darkMode`, `sidebarStyle`)

**การ์ด 2: `กำหนดสีและโหมดมืดอย่างอิสระ`**
- `.grid-2` (6 ช่อง):
  1. `primaryColor` (focus: `primaryColor`) — Label: `สีหลัก (Primary)` — `<input type="color">` + `<input class="input">`
  2. `accentColor` (focus: `accentColor`) — Label: `สีรอง (Accent)` — `<input type="color">` + `<input class="input">`
  3. `bgColor` (focus: `bgColor`) — Label: `สีพื้นหลังหน้าเว็บ (Background)` — **disabled เมื่อ `darkMode === true`**
  4. `surfaceColor` (focus: `surfaceColor`) — Label: `สีพื้นการ์ด (Surface)` — **disabled เมื่อ `darkMode === true`**
  5. `textColor` (focus: `textColor`) — Label: `สีตัวอักษรหลัก (Text)` — **disabled เมื่อ `darkMode === true`**
  6. `darkMode` (focus: `darkMode`) — Label: `โหมดมืด (Dark Mode)` — Toggle Box:
     - Title: `โหมดมืดทั้งระบบ`
     - Sub: `กำลังใช้งานโหมดมืด` / `กำลังใช้งานโหมดสว่างปกติ`

#### ฝั่งขวา (Preview 5: Colors & Theme)
- `.mock-browser` URL: `ชุดสี · {darkMode ? 'Dark Mode' : 'Light Mode'}`
- พื้นหลัง (highlight เมื่อ `bgColor`/`darkMode`):
  - การ์ดตัวอย่าง (highlight เมื่อ `surfaceColor`/`textColor`): `การ์ดเนื้อหา (Surface & Text)` + คำอธิบาย + 2 ปุ่มสี (`ปุ่มสีหลัก Primary`, `สีรอง Accent`)
  - กล่องตารางตัวอย่าง: หัวตารางสี `primaryColor` (`หัวตารางเรียน (ใช้สีหลัก Primary)`) + แถวเนื้อหา `31901-2002 · ระบบปฏิบัติการเครื่องแม่ข่าย · ห้อง R6201`
- **Callout Chips (6 ปุ่ม)**: `สีหลัก` (`primaryColor`), `สีรอง` (`accentColor`), `พื้นหลัง` (`bgColor`), `พื้นการ์ด` (`surfaceColor`), `ตัวอักษร` (`textColor`), `Dark Mode` (`darkMode`)

---

### แท็บที่ 6: `typography` — ฟอนต์และ CSS

#### ฝั่งซ้าย (2 การ์ด)
**การ์ด 1: `แบบอักษร ขนาด และความโค้งมน`**
1. `.grid-2`:
   - `fontFamily` (focus: `fontFamily`) — Label: `แบบอักษร (Font Family)` — `<select class="input">`:
     - `IBM Plex Sans Thai` → `IBM Plex Sans Thai (ค่าเริ่มต้น)`
     - `Sarabun` → `Sarabun (ทางการ)`
     - `Prompt` → `Prompt (ทันสมัย)`
     - `Kanit` → `Kanit (โค้งมน)`
     - `System` → `ฟอนต์ระบบ (System UI)`
   - `fontSize` (focus: `fontSize`) — Label: `ขนาดตัวอักษรหลัก: {fontSize} px` — `<input type="range" min="12" max="17" step="1">`
2. `borderRadius` (focus: `borderRadius`) — Label: `ความโค้งมนของการ์ดและปุ่ม: {borderRadius} px` — `<input type="range" min="0" max="24" step="1">`

**การ์ด 2: `Custom CSS ขั้นสูง`**
- `customCss` — Label: `เขียน CSS เพิ่มเติม (มีผลทันทีทั่วทั้งระบบ)` — `<textarea class="input" rows="5">` (monospace `12.5px`, placeholder: `.card { border-width: 2px; }`)

#### ฝั่งขวา (Preview 6: Typography & Radius)
- `.mock-browser` (padding `14px`) → การ์ดจำลอง (`border-radius: {borderRadius}px`, highlight เมื่อ `borderRadius`/`fontFamily`/`fontSize`):
  - หัวข้อ `font-size: {fontSize + 2}px`: `ตัวอย่างแบบอักษร: {fontFamily}`
  - เนื้อหา `font-size: {fontSize}px`: `ระบบจัดตารางเรียนอัตโนมัติ (ขนาด {fontSize}px · มุมโค้ง {borderRadius}px)`
  - แถวปุ่ม + ช่องกรอกจำลอง (`border-radius: Math.round(borderRadius * 0.72)px`, `font-size: {fontSize - 1}px`): `ปุ่มตัวอย่าง` + `ช่องกรอกข้อมูล`
- **Callout Chips (3 ปุ่ม)**: `ฟอนต์` (`fontFamily`), `ขนาดตัวอักษร` (`fontSize`), `ความโค้งมน` (`borderRadius`)

---

### แท็บที่ 7: `pdf` — เอกสาร PDF

#### ฝั่งซ้าย (1 การ์ด: `ตกแต่งเอกสาร PDF (A4 แนวนอน)`)
- **Card Head**: หัวข้อซ้าย + ปุ่มขวา `ดูตัวอย่าง PDF จริง` (`btn primary sm`, icon `file` 14px, เรียก `openRealPdf()`)
- **Card Body**:
  1. **โลโก้บนหัวกระดาษ PDF** (focus: `pdfLogo`):
     - `.preview-logo.rounded` (`56×56px`) แสดง `effectivePdfLogo()` (`pdf.logoDataUrl || logoDataUrl || 'logo.png'`)
     - Toggle Box `pdf.showLogo` (`padding: 6px 10px`): `แสดงโลโก้บน PDF`
     - ปุ่ม (Admin): `เปลี่ยนโลโก้ PDF` (icon `upload` 14px) + ปุ่ม `ดึงจากโลโก้เว็บ` (`btn sm ghost`, แสดงเมื่อมี `draft().logoDataUrl`, เรียก `syncWebLogoToPdf()`)
     - `.segmented` (`max-width: 220px`, disabled เมื่อ `!showLogo`): `เล็ก` (`sm`), `กลาง` (`md`), `ใหญ่` (`lg`)
  2. **โหมดสีของเอกสาร PDF** (focus: `pdfColorMode`):
     - `.segmented`: `ขาว-ดำ (พิมพ์ทางการ)` (`bw`), `ตามสีธีมเว็บอัตโนมัติ` (`theme`), `กำหนดสีเอง` (`custom`)
  3. **เมื่อ `pdf.colorMode === 'custom'`** แสดง `.grid-2` 5 สี:
     - `pdf.headerBg` (focus: `pdfHeader`) — `สีพื้นหัวตาราง`
     - `pdf.headerText` (focus: `pdfHeader`) — `สีตัวอักษรหัวตาราง`
     - `pdf.dayBg` (focus: `pdfDayBg`) — `สีแถบวัน / แถวรวม`
     - `pdf.breakBg` (focus: `pdfBreakBg`) — `สีช่องพักกลางวัน`
     - `pdf.borderColor` (focus: `pdfBorder`) — `สีเส้นตาราง`
  4. **`.grid-2` โครงสร้างและขนาด**:
     - Toggle Box `pdf.showSubjectTable` (focus: `pdfSubjectTable`): Title `ตารางสรุปรายวิชา (ขวาบน)` / Sub `แสดงตาราง ท. ป. น. ช.` หรือ `ซ่อนและขยายหัวกระดาษเต็มแถบ`
     - Toggle Box `pdf.showSignatures` (focus: `pdfSignatures`): Title `ช่องลงนาม 4 ตำแหน่ง (ด้านล่าง)` / Sub `แสดงช่องลงชื่อ 4 คอลัมน์` หรือ `ซ่อนช่องลงนามเพื่อขยายตาราง`
     - `pdf.fontScale` (focus: `pdfFontScale`) — Label: `ขนาดตัวอักษรในตาราง PDF` — `.segmented`: `กระชับ` (`compact`), `ปกติ` (`normal`), `ใหญ่` (`large`)
     - `pdf.margin` (focus: `pdfMargin`) — Label: `ระยะขอบกระดาษ (Margin)` — `.segmented`: `แคบ` (`narrow`), `ปกติ` (`normal`), `กว้าง` (`wide`)
  5. **`.grid-2` ลายน้ำและหมายเหตุ**:
     - `pdf.watermark` (focus: `pdfWatermark`) — Label: `ลายน้ำกลางหน้า (ไม่บังคับ)` — placeholder: `เช่น ร่างตารางเรียน หรือ สำเนา`
     - `pdf.footerNote` (focus: `pdfFooter`) — Label: `ข้อความหมายเหตุท้ายกระดาษ (ซ้ายล่าง)` — placeholder: `เช่น แผนกวิชาเทคโนโลยีสารสนเทศ`
  6. **Toggle Box `pdf.showPrintDate`** (focus: `pdfFooter`):
     - Title: `แสดงวันและเวลาที่พิมพ์มุมขวาล่าง`
     - Sub: `พิมพ์เวลาปัจจุบันตามเขตเวลา Asia/Bangkok`

#### ฝั่งขวา (Preview 7: Live A4 Landscape PDF Sheet)
- **สูตรสีพรีวิว `pdfResolved()`**:
  - `bw`: `{ headerBg: '', headerText: '#111111', dayBg: '', breakBg: '#f4f4f4', border: '#111111' }`
  - `theme`: `{ headerBg: primaryColor || '#800020', headerText: '#ffffff', dayBg: '#fcf4f5', breakBg: '#f3ecee', border: '#3a2a2f' }`
  - `custom`: ใช้ค่า `pdf.headerBg`, `pdf.headerText`, `pdf.dayBg`, `pdf.breakBg`, `pdf.borderColor`
- **กระดาษ `.pdf-paper`** (`aspect-ratio: 297 / 210`, highlight เมื่อ `pdfMargin`):
  - `padding`: `narrow` → `8px` | `normal` → `13px` | `wide` → `18px`
  - **ลายน้ำ `.pdf-watermark`** (เมื่อมีข้อความ): เอียง `-24deg`, `32px`, bold, opacity `0.11`, สี `headerBg || '#111'`
  - **ส่วนหัว `.pdf-top`**:
    - `.pdf-head-box`: กว้าง `32%` (`flex-direction: column; gap: 2px`) เมื่อ `showSubjectTable = true` หรือ `100%` (`flex-direction: row; gap: 10px`) เมื่อซ่อนตารางวิชา
    - โลโก้ (ถ้า `showLogo`): `sm` → `18×18px`, `md` → `24×24px`, `lg` → `30×30px`
    - ข้อความ: `{siteName}` (`8.5px` bold) + `ตารางเรียนกลุ่ม G1 · ภาคเรียน 2/2569` (`7px`)
    - `.pdf-sub-tbl` (ถ้า `showSubjectTable`): หัวตาราง `รหัสวิชา | ชื่อรายวิชา | ท. | ป. | น. | ช.`, แถวตัวอย่าง `31901-2002 | ระบบปฏิบัติการเครื่องแม่ข่าย | 2 | 2 | 3 | 4`, แถว `รวม` พื้นหลัง `dayBg`
  - **ตารางหลัก `.pdf-grid`** (`font-size`: `compact: 6.5px`, `normal: 7.5px`, `large: 8.5px`):
    - แถวหัว 1 (`headerBg`/`headerText`): `เวลา | 08:00 | 09:00 | 12:00 | 13:00 | 14:00`
    - แถวหัว 2 (`dayBg`): `วัน/คาบ | 1 | 2 | 5 | 6 | 7`
    - แถว `จันทร์`: `31901-2002` (colspan 2) | `พัก` (`rowspan="2"`, bg `breakBg`) | `30000-1501` (colspan 2)
    - แถว `อังคาร`: `HOMEROOM / R5202` | (ว่าง) | `31901-2010` (colspan 2)
  - **ช่องลงนาม `.pdf-sigs`** (ถ้า `showSignatures`): 4 คอลัมน์เท่ากัน (`ครูที่ปรึกษา`, `หัวหน้างานหลักสูตร`, `รอง ผอ.วิชาการ`, `ผู้อำนวยการ`)
  - **ท้ายกระดาษ `.pdf-foot`**: ซ้ายแสดง `footerNote`, ขวาแสดง `พิมพ์เมื่อ 24/11/2569 21:05` (ถ้า `showPrintDate`)
- **Callout Chips (9 ปุ่ม)**: `โลโก้ PDF` (`pdfLogo`), `โหมดสี` (`pdfColorMode`), `หัวตาราง` (`pdfHeader`), `แถบวัน` (`pdfDayBg`), `ช่องพัก` (`pdfBreakBg`), `ตารางวิชา` (`pdfSubjectTable`), `ช่องลงนาม` (`pdfSignatures`), `ลายน้ำ` (`pdfWatermark`), `ท้ายกระดาษ` (`pdfFooter`)

---

## 6. ตารางข้อความป้ายไฮไลต์สีทอง (`FOCUS_LABELS`)

ใช้แสดงบนป้าย `.hl-tag` ด้านขวาบนของกล่องพรีวิว (`จุดที่แก้: {focusLabel()}`):

| Key | ข้อความภาษาไทย | Key | ข้อความภาษาไทย |
| --- | --- | --- | --- |
| `siteName` | ชื่อสถาบัน / Sidebar | `registerAdminNotice` | ข้อความแจ้งเตือนสิทธิ์ Admin |
| `siteSubtitle` | ชื่อรองใต้แบรนด์ | `registerPendingTitle` | หัวข้อหน้าจอรออนุมัติครู |
| `topBarTitle` | ข้อความ Top Bar | `heroTitle` | หัวข้อ Hero หน้าภาพรวม |
| `logo` | โลโก้เว็บไซต์ | `heroSubtitle` | ข้อความรองหน้าภาพรวม |
| `logoShape` | รูปทรงกรอบโลโก้ | `cardShadow` | ระดับเงาการ์ด |
| `sidebarStyle` | สไตล์แถบด้านข้าง | `density` | ความโปร่งเนื้อหา |
| `sidebarWidth` | ความกว้างแถบด้านข้าง | `primaryColor` | สีหลัก (Primary) |
| `organization` | หน่วยงานสังกัด | `accentColor` | สีรอง (Accent) |
| `loginBadge` | ป้าย Pill หน้า Login | `bgColor` | สีพื้นหลังเว็บ |
| `loginHeading` | หัวข้อใหญ่หน้า Login | `surfaceColor` | สีพื้นการ์ด |
| `loginDescription` | คำอธิบายหน้า Login | `textColor` | สีตัวอักษรหลัก |
| `loginChips` | ป้ายจุดเด่น 3 ช่อง | `darkMode` | โหมดมืด (Dark Mode) |
| `loginLeftFooter` | ข้อความล่างซ้ายหน้า Login | `fontFamily` | แบบอักษร |
| `loginBg` | ภาพพื้นหลังหน้า Login | `fontSize` | ขนาดตัวอักษร |
| `loginPattern` | ลวดลาย Pattern | `borderRadius` | ความโค้งมน |
| `loginCardTitle` | หัวข้อกล่องเข้าสู่ระบบ | `pdfLogo` | โลโก้บนหัวกระดาษ PDF |
| `loginCardSubtitle` | ข้อความรองกล่องเข้าสู่ระบบ | `pdfColorMode` | โหมดสีเอกสาร PDF |
| `loginButtonText` | ข้อความปุ่มเข้าสู่ระบบ | `pdfHeader` | สีหัวตาราง PDF |
| `loginPublicLink` | ปุ่มดูตารางสาธารณะ | `pdfDayBg` | สีแถบวันและแถวรวม |
| `footerText` | ข้อความท้ายหน้า (Footer) | `pdfBreakBg` | สีช่องพักกลางวัน |
| `registerEnabled` | เปิด/ปิดระบบสมัครบัญชีใหม่ | `pdfBorder` | สีเส้นตาราง PDF |
| `registerPrompt` | แถบชวนสมัครใต้ปุ่มเข้าสู่ระบบ | `pdfSubjectTable` | ตารางสรุปรายวิชาขวาบน |
| `registerTitle` | หัวข้อใหญ่หน้าสมัครบัญชี | `pdfSignatures` | ช่องลงนาม 4 ตำแหน่ง |
| `registerSubtitle` | คำอธิบายหน้าสมัครบัญชี | `pdfFontScale` | ขนาดตัวอักษรใน PDF |
| `registerViewer` | การ์ดสิทธิ์ผู้เยี่ยมชม | `pdfMargin` | ระยะขอบกระดาษ A4 |
| `registerTeacher` | การ์ดสิทธิ์ครูผู้สอน | `pdfWatermark` | ลายน้ำกลางหน้า |
| | | `pdfFooter` | หมายเหตุท้ายกระดาษและวันที่พิมพ์ |

---

## 7. Sticky Save Bar, การประมวลผลรูปภาพ และ PDF Preview Modal

### 7.1 Sticky Save Bar (แสดงเฉพาะ Admin)
- ข้อความซ้าย:
  - `dirty() === true`: `มีการเปลี่ยนแปลงที่ยังไม่บันทึก (แสดงตัวอย่างสดอยู่)`
  - `dirty() === false`: `การตกแต่งล่าสุดถูกบันทึกแล้ว`
- ปุ่มเรียงจากซ้ายไปขวา:
  1. `ยกเลิกการแก้` (`btn sm ghost`, แสดงเฉพาะเมื่อ `dirty()`) → คืนค่า `draft` จาก `theme.appearance()`, รีเซ็ต `dirty = false`, เรียก `theme.apply(saved)` และแจ้ง toast `ยกเลิกการเปลี่ยนแปลงแล้ว`
  2. `คืนค่าเริ่มต้น` (`btn sm danger`, icon `refresh` 15px) → เปิด Confirm Dialog (`title: 'คืนค่าการตกแต่งเริ่มต้น'`, `danger: true`) → เรียก `POST /api/appearance/reset`
  3. `บันทึกการตกแต่ง` / `กำลังบันทึก…` (`btn primary`, icon `check` 16px) → เรียก `save()`

### 7.2 การประมวลผลรูปภาพฝั่ง Client (`rasterizeDataUrl`)
- **โลโก้เว็บ (`onLogoFile`)**:
  - อ่านเป็น Data URL → แปลงผ่าน `<canvas>` เป็น PNG ขนาดไม่เกิน `512×512` (quality `0.95`)
  - ถ้าไฟล์ต้นฉบับเป็น `image/svg+xml`: เก็บ SVG ต้นฉบับไว้ใน `logoDataUrl` (เพื่อความคมชัดบนเว็บ) **และเก็บ PNG ที่แปลงแล้วไว้ใน `pdf.logoDataUrl` เสมอ** (เพราะ PDFKit รองรับเฉพาะ PNG/JPEG)
  - ถ้าไม่ใช่ SVG: เก็บ PNG ที่แปลงแล้วทั้งใน `logoDataUrl` และ `pdf.logoDataUrl`
- **โลโก้ PDF (`onPdfLogoFile`)**: แปลงเป็น PNG ไม่เกิน `512×512` (quality `0.95`) เก็บใน `pdf.logoDataUrl`
- **ดึงจากโลโก้เว็บ (`syncWebLogoToPdf`)**: ถ้า `logoDataUrl` เป็น PNG/JPEG อยู่แล้วใช้ตรงๆ ถ้าเป็น SVG/WebP แปลงเป็น PNG `512×512` ก่อนเก็บใน `pdf.logoDataUrl`
- **ภาพพื้นหลัง Login (`onBgFile`)**: แปลงเป็น JPEG ไม่เกิน `1280×900` (quality `0.82`) เก็บใน `loginBgDataUrl`
- **Auto-convert ก่อน `save()`**: หากมี `logoDataUrl` ที่ไม่ใช่ PNG/JPEG และ `pdf.logoDataUrl` ว่าง จะแปลงให้อัตโนมัติก่อนส่งขึ้น Backend

### 7.3 ปุ่ม `ดูตัวอย่าง PDF จริง` (`openRealPdf()` + `PdfPreviewComponent`)
1. ถ้า `!state.hasTimetable()` → แสดง toast info `ยังไม่มีตารางเรียนในระบบ กรุณาจัดตารางก่อนจึงจะดูตัวอย่าง PDF จริงได้` และหยุด
2. ถ้า `dirty()` หรือโลโก้เว็บยังไม่ได้แปลงเป็น PNG ให้ `await this.save()` ก่อนอัตโนมัติ (เฉพาะ Admin)
3. ตั้ง URL เป็น `api.exportUrl('pdf', 'group', undefined, true) + '&_t=' + Date.now()`
4. `<app-pdf-preview>` เปิด Modal ขนาด `width: min(1180px, calc(100vw - 24px)); height: calc(100vh - 28px)` พื้นหลัง `#525659` มีปุ่ม `พิมพ์`, `ดาวน์โหลด PDF`, ปิด และ `<iframe [src]="safeUrl()">` พร้อม overlay spinner `กำลังสร้างเอกสาร…`

---

## 8. Backend API และผลต่อการสร้าง PDF จริง

### 8.1 Endpoints (`backend/src/routes/api.js`)
- `GET /api/public/appearance`: คืน `{ appearance, defaults }` (Public ไม่ต้องล็อกอิน)
- `PUT /api/appearance`: รับ `{ appearance, syncCollege }` (Admin เท่านั้น)
  - Validation:
    - Data URL Regex: `/^data:image\/(png|jpeg|webp|svg\+xml|gif);base64,[A-Za-z0-9+/=]+$/`
    - `logoDataUrl` ≤ 600 KB
    - `pdf.logoDataUrl` ≤ 600 KB
    - `loginBgDataUrl` ≤ 1.5 MB (`1500 * 1024`)
    - `customCss` ≤ 20,000 ตัวอักษร
  - หาก `syncCollege === true` และมี `ap.siteName` จะอัปเดต `config.document.college = ap.siteName.trim()` ไปพร้อมกัน
  - บันทึกลง `backend/data/config.json` และคืน `{ appearance, document }`
- `POST /api/appearance/reset`: รีเซ็ตเฉพาะ `config.appearance` กลับเป็น `DEFAULT_CONFIG.appearance` (ไม่กระทบ `constraints`, `params`, `savedSeeds`, `savedProfiles`)

### 8.2 การนำ `appearance.pdf` ไปใช้ใน PDFKit (`backend/src/services/exporter.js`)
- `margin`: `narrow` = `16 pt`, `normal` = `24 pt`, `wide` = `34 pt`
- `logoPx`: `sm` = `34`, `md` = `42`, `lg` = `50`
- `fontDelta`: `compact` = `-0.8 pt`, `normal` = `0`, `large` = `+0.9 pt`
- `colorMode`:
  - `bw`: `headerBg = ''`, `borderColor = '#000000'`
  - `theme`: `headerBg = ap.primaryColor`, `borderColor = '#3a2a2f'`
  - `custom`: ใช้สีจาก `pdf.*` โดยตรง

---

## 9. เช็กลิสต์จุดสำคัญที่มักพลาดเวลาสร้างใหม่

1. **ต้องมี CSS Variables ครบชุดและสูตร `mixHex()`**: หน้านี้พึ่ง `--maroon-50`..`--maroon-950`, `--surface`, `--bg`, `--border`, `--border-strong`, `--radius-*` หากไม่คำนวณเฉดสีเหล่านี้แบบ dynamic สีของปุ่ม, `.segmented`, `.toggle-box.on`, และ `.zone-tab` จะไม่เปลี่ยนตามธีม
2. **การ์ดสวิตช์ต้องใช้ `.toggle-box` + `.toggle-state` + `.switch`**: ไม่ใช่ `<input type="checkbox">` เปล่าๆ เพื่อให้ได้กล่องมีขอบ ป้าย pill `เปิด/ปิด` และพื้นหลังอ่อน `--maroon-50` เมื่อเปิด
3. **ระบบชี้จุดด้วยกรอบสีทอง (`.hl-zone.hl-on`)**: ต้องมี `box-shadow: 0 0 0 2.5px #f59e0b, 0 0 0 5px rgba(245, 158, 11, 0.28) !important` และผูกทั้ง `(mouseenter)` กับ `(focusin)` ที่ฟิลด์ฝั่งซ้าย + ปุ่ม `.cmap-chip` ใต้พรีวิวฝั่งขวา
4. **Sticky Preview และ Sticky Save Bar**:
   - คอลัมน์ขวาต้อง `position: sticky; top: calc(var(--header-h) + 14px)` และ layout กว้างเป็น `minmax(0, 1.15fr) minmax(370px, 0.95fr)`
   - `.sticky-bar` ต้องใส่ `margin-right: 76px` (และบนมือถือ `margin-bottom: 74px`) เพื่อไม่ให้ปุ่มแชทลอยมุมขวาล่างบังปุ่ม "บันทึกการตกแต่ง"
5. **คืนค่าธีมเมื่อออกจากหน้าโดยไม่บันทึก (`ngOnDestroy`)**: ถ้าไม่คืนค่า `theme.apply(saved)` หน้าอื่นจะยังคงแสดงสีที่ลองปรับเล่นไว้
6. **โลโก้ PDF ต้องเป็น PNG/JPEG เสมอ**: ต้องทำ canvas rasterize (`512×512`) เก็บลง `pdf.logoDataUrl` ไม่อย่างนั้นอัปโหลดโลโก้ SVG หรือ WebP แล้ว PDF จะไม่แสดงโลโก้
7. **ซิงก์ข้ามหน้าจริงให้ตรงกับพรีวิวทุกจุด**:
   - `logoShape` (`rounded`/`circle`/`square`) และ `logoDataUrl` ต้องผูกทั้งใน **Sidebar (`shell.ts`)**, **หน้า Login (`login.ts`)** และ **หน้าสาธารณะ (`public-index.ts`)**
   - `loginChip1..3` บนหน้า Login จริงต้องแสดงข้อความตามที่กรอกตรง ๆ **ห้ามใส่อีโมจิฮาร์ดโค้ด** และซ่อนอัตโนมัติเมื่อเว้นว่าง
   - หน้าสมัครบัญชีจริง (`/login?mode=register`) ต้องแสดงกรอบไอคอน `users` สีธีม, การ์ดสิทธิ์ครู (`registerTeacherLabel` + ป้าย `รออนุมัติจาก Admin` + `registerTeacherDesc`) และกล่องเส้นประ `registerAdminNotice` ให้ตรงกับพรีวิว
   - ตาราง **ความหนาแน่นของการเรียน** (`charts.ts`) ต้องคำนวณสี RGB จาก `ThemeService.appearance().primaryColor` แบบ Dynamic
   - ชื่อแท็บเบราว์เซอร์ต้องใช้ `AppTitleStrategy` + `syncDocumentTitle()` เพื่อให้เปลี่ยนตาม `siteName` ทันทีแบบเรียลไทม์
   - `.left-col .card-body` ต้องมี `display: flex; flex-direction: column; gap: 16px; padding: 20px;` เพื่อให้ช่องกรอกและการ์ดสวิตช์ไม่ชิดติดกัน


---

## 10. อัปเดตเพิ่มเติม: แท็บที่ 8 — หน้าสาธารณะ (`public`) และ Carousel

เพิ่มหมวดหมู่การตกแต่งสำหรับ **หน้าตารางเรียนสาธารณะ (`/p`)** พร้อมระบบ **Image Carousel** และการซิงก์โลโก้/รูปทรงกรอบโลโก้จากแท็บแถบเมนูอัตโนมัติ

### 10.1 Data Model (`PublicCarouselSlide` & `PublicAppearance`)

```ts
export interface PublicCarouselSlide {
  id: string;
  imageDataUrl: string; // JPEG <= 1280x640 (quality 0.82)
  title: string;
  caption: string;
  linkUrl?: string;
}

export interface PublicAppearance {
  heroTitle: string;                // ค่าเริ่มต้น: 'ตารางเรียนสาธารณะ'
  heroSubtitle: string;
  heroStyle: 'gradient' | 'solid' | 'image';
  heroPattern: 'grid' | 'dots' | 'waves' | 'none';
  heroBgDataUrl: string;            // JPEG <= 1280x640
  showLogo: boolean;                // แสดงโลโก้จาก appearance.logoDataUrl + logoShape
  showStats: boolean;               // แสดงแถบสรุปสถิติ (กลุ่มเรียน / ครูผู้สอน / ห้องเรียน)
  showLoginButton: boolean;         // แสดงปุ่มเข้าสู่ระบบผู้ดูแลมุมขวาบน
  loginButtonText: string;          // ค่าเริ่มต้น: 'เข้าสู่ระบบผู้ดูแล'
  announcementEnabled: boolean;     // เปิด/ปิดแถบประกาศข่าวสาร
  announcementText: string;
  announcementTone: 'info' | 'warning' | 'success';
  carouselEnabled: boolean;         // เปิด/ปิด Carousel ภาพสไลด์
  carouselAutoplay: boolean;        // เลื่อนภาพอัตโนมัติ
  carouselIntervalSec: number;      // 3–12 วินาที (ค่าเริ่มต้น 5)
  carouselHeight: 'sm' | 'md' | 'lg'; // 200px / 280px / 360px
  carouselSlides: PublicCarouselSlide[]; // สูงสุด 8 รูป
  cardColumns: 2 | 3 | 4;           // จำนวนคอลัมน์การ์ดบนเดสก์ท็อป (ค่าเริ่มต้น 3)
  showFooter: boolean;
  footerNote: string;               // เว้นว่างเพื่อใช้ appearance.footerText
}
```

### 10.2 แท็บที่ 8: `public` — หน้าสาธารณะ (Public)
- **Key**: `public` | **Icon**: `external` | **Label**: `หน้าสาธารณะ (Public)` | **Preview Title**: `หน้าตารางเรียนสาธารณะ (/p)`
- **ฝั่งซ้าย (3 การ์ด)**:
  1. `ส่วนหัว Hero และแถบประกาศ (หน้าสาธารณะ /p)`: หัวข้อ, คำอธิบาย, สไตล์พื้นหลัง (`gradient`/`solid`/`image` + อัปโหลดภาพพื้นหลัง), ลวดลาย (`grid`/`dots`/`waves`/`none`), Toggle แสดงโลโก้, Toggle แสดงแถบสรุปสถิติ, Toggle ปุ่มเข้าสู่ระบบ + ข้อความปุ่ม, Toggle แถบประกาศข่าวสาร + ข้อความ + โทนสี (`info`/`warning`/`success`)
  2. `ภาพสไลด์ Carousel (ประชาสัมพันธ์หน้าสาธารณะ)`: Toggle เปิด/ปิด Carousel, Toggle เลื่อนภาพอัตโนมัติ, Slider ความเร็ว (3–12 วินาที), ความสูง (`sm`/`md`/`lg`), ปุ่มอัปโหลดหลายรูปพร้อมกัน (`เพิ่มรูปภาพ Carousel`, สูงสุด 8 รูป, แปลงผ่าน Canvas เป็น JPEG `1280×640` quality `0.82`), รายการสไลด์ที่แก้หัวข้อ/คำบรรยาย เลื่อนลำดับขึ้น-ลง และลบได้
  3. `เลย์เอาต์การ์ดและส่วนท้าย`: จำนวนคอลัมน์การ์ด (`2`/`3`/`4`), Toggle แสดงส่วนท้าย + ข้อความท้ายหน้า
- **ฝั่งขวา (Live Preview `/p`)**: จำลองหน้า `/p` จริงทั้ง Hero (พร้อมโลโก้และรูปทรงกรอบโลโก้จริง), แถบประกาศ, Carousel (กดสลับสไลด์ดูได้ในพรีวิว), การ์ดตารางตามจำนวนคอลัมน์ และ Footer พร้อมกรอบสีทอง `.hl-zone.hl-on` และ Callout Chips 8 ปุ่ม (`pubHero`, `pubLogo`, `pubStats`, `pubLoginBtn`, `pubAnnouncement`, `pubCarousel`, `pubCards`, `pubFooter`)
- **Backend (`server.js`, `config.js`, `routes/api.js`)**:
  - เพิ่ม `express.json({ limit: '15mb' })` เพื่อรองรับหลายรูปใน Carousel
  - ตรวจจำนวน `carouselSlides <= 8` และขนาดภาพแต่ละรูป `<= 1.5 MB` ใน `PUT /api/appearance`
