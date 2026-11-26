import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { AuthService } from '../../core/auth';
import { AppState } from '../../core/state';
import { Appearance, DEFAULT_APPEARANCE, PdfAppearance, PublicAppearance, PublicCarouselSlide, ThemeService } from '../../core/theme';
import { Toasts } from '../../core/toast';
import { Confirm } from '../../core/confirm';
import { IconComponent } from '../../shared/icon';
import { PdfPreviewComponent } from '../../shared/pdf-preview';

type TabKey = 'shell' | 'login' | 'register' | 'dashboard' | 'public' | 'colors' | 'typography' | 'pdf';

const TABS: { key: TabKey; icon: string; label: string; previewTitle: string }[] = [
  { key: 'shell', icon: 'menu', label: 'แถบเมนูและส่วนหัว', previewTitle: 'แถบเมนูและส่วนหัว (App Shell)' },
  { key: 'login', icon: 'shield', label: 'หน้าเข้าสู่ระบบ', previewTitle: 'หน้าเข้าสู่ระบบ (Login)' },
  { key: 'register', icon: 'users', label: 'หน้าสมัครบัญชี', previewTitle: 'หน้าสมัครบัญชีใหม่ (Register)' },
  { key: 'dashboard', icon: 'dashboard', label: 'หน้าภาพรวม', previewTitle: 'หน้าภาพรวม (Dashboard)' },
  { key: 'public', icon: 'external', label: 'หน้าสาธารณะ', previewTitle: 'หน้าตารางเรียนสาธารณะ (/p)' },
  { key: 'colors', icon: 'palette', label: 'สีและธีม', previewTitle: 'สีและธีม' },
  { key: 'typography', icon: 'sliders', label: 'ฟอนต์และ CSS', previewTitle: 'ฟอนต์และมุมโค้ง' },
  { key: 'pdf', icon: 'file', label: 'เอกสาร PDF', previewTitle: 'เอกสาร PDF (A4 แนวนอน)' },
];

const PRESETS = [
  { name: 'แดงเลือดหมู (ค่าเริ่มต้น)', primary: '#800020', accent: '#9b1b30', bg: '#faf7f7', surface: '#ffffff', text: '#22161a', darkMode: false, sidebarStyle: 'gradient' as const },
  { name: 'น้ำเงินอาชีวะ', primary: '#1e3a8a', accent: '#2563eb', bg: '#f4f7fb', surface: '#ffffff', text: '#172033', darkMode: false, sidebarStyle: 'gradient' as const },
  { name: 'เขียวมรกต', primary: '#0f766e', accent: '#0d9488', bg: '#f3faf9', surface: '#ffffff', text: '#132a27', darkMode: false, sidebarStyle: 'gradient' as const },
  { name: 'ม่วงเทคโนโลยี', primary: '#5b21b6', accent: '#7c3aed', bg: '#f7f5fc', surface: '#ffffff', text: '#1e1633', darkMode: false, sidebarStyle: 'gradient' as const },
  { name: 'ส้มอิฐอบอุ่น', primary: '#b45309', accent: '#d97706', bg: '#fcf8f3', surface: '#ffffff', text: '#291c10', darkMode: false, sidebarStyle: 'gradient' as const },
  { name: 'มินิมอลขาว-ดำ', primary: '#1f2937', accent: '#374151', bg: '#f6f7f9', surface: '#ffffff', text: '#111827', darkMode: false, sidebarStyle: 'light' as const },
  { name: 'โหมดมืด (Dark Mode)', primary: '#c81e4a', accent: '#e11d48', bg: '#141115', surface: '#1e1920', text: '#f5eff2', darkMode: true, sidebarStyle: 'dark' as const },
];

const FOCUS_LABELS: Record<string, string> = {
  siteName: 'ชื่อสถาบัน / Sidebar',
  siteSubtitle: 'ชื่อรองใต้แบรนด์',
  topBarTitle: 'ข้อความ Top Bar',
  logo: 'โลโก้เว็บไซต์',
  logoShape: 'รูปทรงกรอบโลโก้',
  sidebarStyle: 'สไตล์แถบด้านข้าง',
  sidebarWidth: 'ความกว้างแถบด้านข้าง',
  organization: 'หน่วยงานสังกัด',
  loginBadge: 'ป้าย Pill หน้า Login',
  loginHeading: 'หัวข้อใหญ่หน้า Login',
  loginDescription: 'คำอธิบายหน้า Login',
  loginChips: 'ป้ายจุดเด่น 3 ช่อง',
  loginLeftFooter: 'ข้อความล่างซ้ายหน้า Login',
  loginBg: 'ภาพพื้นหลังหน้า Login',
  loginPattern: 'ลวดลาย Pattern',
  loginCardTitle: 'หัวข้อกล่องเข้าสู่ระบบ',
  loginCardSubtitle: 'ข้อความรองกล่องเข้าสู่ระบบ',
  loginButtonText: 'ข้อความปุ่มเข้าสู่ระบบ',
  loginPublicLink: 'ปุ่มดูตารางสาธารณะ',
  footerText: 'ข้อความท้ายหน้า (Footer)',
  registerEnabled: 'เปิด/ปิดระบบสมัครบัญชีใหม่',
  registerPrompt: 'แถบชวนสมัครใต้ปุ่มเข้าสู่ระบบ',
  registerTitle: 'หัวข้อใหญ่หน้าสมัครบัญชี',
  registerSubtitle: 'คำอธิบายหน้าสมัครบัญชี',
  registerViewer: 'การ์ดสิทธิ์ผู้เยี่ยมชม',
  registerTeacher: 'การ์ดสิทธิ์ครูผู้สอน',
  registerAdminNotice: 'ข้อความแจ้งเตือนสิทธิ์ Admin',
  registerPendingTitle: 'หัวข้อหน้าจอรออนุมัติครู',
  heroTitle: 'หัวข้อ Hero หน้าภาพรวม',
  heroSubtitle: 'ข้อความรองหน้าภาพรวม',
  cardShadow: 'ระดับเงาการ์ด',
  density: 'ความโปร่งเนื้อหา',
  pubHero: 'ส่วนหัว Hero หน้าสาธารณะ',
  pubLogo: 'โลโก้หน้าสาธารณะ',
  pubStats: 'แถบสถิติหน้าสาธารณะ',
  pubLoginBtn: 'ปุ่มเข้าสู่ระบบมุมขวาบน',
  pubAnnouncement: 'แถบประกาศข่าวสาร',
  pubCarousel: 'ภาพสไลด์ Carousel',
  pubCards: 'เลย์เอาต์การ์ดตาราง',
  pubFooter: 'ส่วนท้ายหน้าสาธารณะ',
  primaryColor: 'สีหลัก (Primary)',
  accentColor: 'สีรอง (Accent)',
  bgColor: 'สีพื้นหลังเว็บ',
  surfaceColor: 'สีพื้นการ์ด',
  textColor: 'สีตัวอักษรหลัก',
  darkMode: 'โหมดมืด (Dark Mode)',
  fontFamily: 'แบบอักษร',
  fontSize: 'ขนาดตัวอักษร',
  borderRadius: 'ความโค้งมน',
  pdfLogo: 'โลโก้บนหัวกระดาษ PDF',
  pdfColorMode: 'โหมดสีเอกสาร PDF',
  pdfHeader: 'สีหัวตาราง PDF',
  pdfDayBg: 'สีแถบวันและแถวรวม',
  pdfBreakBg: 'สีช่องพักกลางวัน',
  pdfBorder: 'สีเส้นตาราง PDF',
  pdfSubjectTable: 'ตารางสรุปรายวิชาขวาบน',
  pdfSignatures: 'ช่องลงนาม 4 ตำแหน่ง',
  pdfFontScale: 'ขนาดตัวอักษรใน PDF',
  pdfMargin: 'ระยะขอบกระดาษ A4',
  pdfWatermark: 'ลายน้ำกลางหน้า',
  pdfFooter: 'หมายเหตุท้ายกระดาษและวันที่พิมพ์',
};

@Component({
  selector: 'app-appearance',
  standalone: true,
  imports: [FormsModule, IconComponent, PdfPreviewComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">แยกหมวดการตกแต่งตามแต่ละหน้าอย่างชัดเจน</div>
          <h1>ตกแต่งหน้าเว็บและ PDF</h1>
          <p class="small muted">เลือกโซนที่ต้องการแก้ไขด้านล่าง แล้วชี้หรือคลิกช่องใดก็ได้ กรอบสีทองในภาพพรีวิวด้านขวาจะชี้จุดที่เปลี่ยนทันที</p>
        </div>
      </div>

      <div class="zone-tabs" role="tablist">
        @for (t of tabs; track t.key) {
          <button type="button" class="zone-tab" [class.active]="tab() === t.key" (click)="setTab(t.key)">
            <app-icon [name]="t.icon" [size]="15" />
            <span>{{ t.label }}</span>
          </button>
        }
      </div>

      <div class="studio">
        <!-- LEFT COLUMN: CONTROLS -->
        <div class="left-col">
          @if (tab() === 'shell') {
            <div class="card">
              <div class="card-head"><h3>ชื่อสถาบันและข้อความแถบนำทาง</h3></div>
              <div class="card-body">
                <div class="grid-2">
                  <div class="field" (mouseenter)="focus.set('siteName')" (focusin)="focus.set('siteName')">
                    <label>ชื่อเว็บไซต์ / ชื่อสถาบัน (Sidebar &amp; ชื่อแท็บ)</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().siteName" (ngModelChange)="patch({ siteName: $event })" />
                  </div>
                  <div class="field" (mouseenter)="focus.set('siteSubtitle')" (focusin)="focus.set('siteSubtitle')">
                    <label>ชื่อรองใต้แบรนด์ (Sidebar)</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().siteSubtitle" (ngModelChange)="patch({ siteSubtitle: $event })" />
                  </div>
                </div>
                <div class="field" (mouseenter)="focus.set('topBarTitle')" (focusin)="focus.set('topBarTitle')">
                  <label>ข้อความแถบด้านบน (Top Bar)</label>
                  <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().topBarTitle" (ngModelChange)="patch({ topBarTitle: $event })" />
                </div>
                <label class="toggle-box" [class.on]="syncCollege()">
                  <div class="toggle-box-text">
                    <span class="toggle-box-title">ซิงก์ชื่อสถาบันไปยังหัวกระดาษ PDF และ Excel</span>
                    <span class="toggle-box-sub">อัปเดตค่า document.college อัตโนมัติเมื่อกดบันทึก</span>
                  </div>
                  <div class="toggle-box-right">
                    <span class="toggle-state">{{ syncCollege() ? 'เปิด' : 'ปิด' }}</span>
                    <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="syncCollege()" (ngModelChange)="syncCollege.set($event)" /><span></span></span>
                  </div>
                </label>
              </div>
            </div>

            <div class="card">
              <div class="card-head"><h3>โลโก้หลักและสไตล์แถบด้านข้าง (Sidebar)</h3></div>
              <div class="card-body">
                <div class="row" (mouseenter)="focus.set('logo')" (focusin)="focus.set('logo')">
                  <div class="preview-logo" [class]="draft().logoShape">
                    <img [src]="draft().logoDataUrl || 'logo.png'" alt="logo" />
                  </div>
                  <div style="flex: 1; display: flex; flex-direction: column; gap: 6px">
                    @if (auth.isAdmin()) {
                      <div class="row">
                        <input #webLogoIn type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden (change)="onLogoFile($event)" />
                        <button class="btn primary sm" type="button" (click)="webLogoIn.click()">
                          <app-icon name="upload" [size]="15" /> อัปโหลดโลโก้ใหม่
                        </button>
                        @if (draft().logoDataUrl) {
                          <button class="btn sm ghost" style="color: var(--danger)" type="button" (click)="clearWebLogo()">ใช้โลโก้เริ่มต้น</button>
                        }
                      </div>
                    }
                    <span class="small muted">รองรับ PNG, JPEG, WebP, SVG · ระบบจะแปลงเป็น PNG ความละเอียดสูงให้หน้า PDF อัตโนมัติด้วย</span>
                  </div>
                </div>

                <div class="field" (mouseenter)="focus.set('logoShape')" (focusin)="focus.set('logoShape')">
                  <label>รูปทรงกรอบโลโก้</label>
                  <div class="segmented">
                    <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().logoShape === 'rounded'" (click)="patch({ logoShape: 'rounded' })">มุมมน</button>
                    <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().logoShape === 'circle'" (click)="patch({ logoShape: 'circle' })">วงกลม</button>
                    <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().logoShape === 'square'" (click)="patch({ logoShape: 'square' })">สี่เหลี่ยม</button>
                  </div>
                </div>

                <div class="grid-2">
                  <div class="field" (mouseenter)="focus.set('sidebarStyle')" (focusin)="focus.set('sidebarStyle')">
                    <label>สไตล์แถบด้านข้าง</label>
                    <div class="segmented">
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().sidebarStyle === 'gradient'" (click)="patch({ sidebarStyle: 'gradient' })">ไล่เฉด</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().sidebarStyle === 'solid'" (click)="patch({ sidebarStyle: 'solid' })">สีทึบ</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().sidebarStyle === 'dark'" (click)="patch({ sidebarStyle: 'dark' })">สีเข้ม</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().sidebarStyle === 'light'" (click)="patch({ sidebarStyle: 'light' })">สีขาว</button>
                    </div>
                  </div>
                  <div class="field" (mouseenter)="focus.set('sidebarWidth')" (focusin)="focus.set('sidebarWidth')">
                    <label>ความกว้างแถบด้านข้าง: {{ draft().sidebarWidth }} px</label>
                    <input type="range" min="210" max="300" step="2" [disabled]="!auth.isAdmin()" [ngModel]="draft().sidebarWidth" (ngModelChange)="patch({ sidebarWidth: +$event })" />
                  </div>
                </div>
              </div>
            </div>
          }

          @if (tab() === 'login') {
            <div class="card">
              <div class="card-head"><h3>ฝั่งซ้ายหน้า Login (แบรนด์ หัวข้อ และจุดเด่น)</h3></div>
              <div class="card-body">
                <div class="grid-2">
                  <div class="field" (mouseenter)="focus.set('organization')" (focusin)="focus.set('organization')">
                    <label>ชื่อหน่วยงานสังกัด (ใต้ชื่อสถาบัน)</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().organization" (ngModelChange)="patch({ organization: $event })" />
                  </div>
                  <div class="field" (mouseenter)="focus.set('loginBadge')" (focusin)="focus.set('loginBadge')">
                    <label>ป้ายกำกับด้านบน (Pill Badge)</label>
                    <input class="input" placeholder="เว้นว่างเพื่อซ่อน" [disabled]="!auth.isAdmin()" [ngModel]="draft().loginBadge" (ngModelChange)="patch({ loginBadge: $event })" />
                  </div>
                </div>
                <div class="field" (mouseenter)="focus.set('loginHeading')" (focusin)="focus.set('loginHeading')">
                  <label>หัวข้อใหญ่หน้า Login</label>
                  <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().loginHeading" (ngModelChange)="patch({ loginHeading: $event })" />
                </div>
                <div class="field" (mouseenter)="focus.set('loginDescription')" (focusin)="focus.set('loginDescription')">
                  <label>คำอธิบายใต้หัวข้อ</label>
                  <textarea class="input" rows="2" [disabled]="!auth.isAdmin()" [ngModel]="draft().loginDescription" (ngModelChange)="patch({ loginDescription: $event })"></textarea>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px" (mouseenter)="focus.set('loginChips')" (focusin)="focus.set('loginChips')">
                  <label class="toggle-box" [class.on]="draft().loginShowChips">
                    <div class="toggle-box-text">
                      <span class="toggle-box-title">แสดงป้ายจุดเด่น 3 ช่อง (Feature Chips)</span>
                      <span class="toggle-box-sub">ป้ายข้อความจุดเด่นใต้คำอธิบายฝั่งซ้ายหน้า Login</span>
                    </div>
                    <div class="toggle-box-right">
                      <span class="toggle-state">{{ draft().loginShowChips ? 'เปิด' : 'ปิด' }}</span>
                      <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().loginShowChips" (ngModelChange)="patch({ loginShowChips: $event })" /><span></span></span>
                    </div>
                  </label>
                  @if (draft().loginShowChips) {
                    <input class="input" placeholder="จุดเด่นที่ 1 (เว้นว่างเพื่อซ่อน)" [disabled]="!auth.isAdmin()" [ngModel]="draft().loginChip1" (ngModelChange)="patch({ loginChip1: $event })" />
                    <input class="input" placeholder="จุดเด่นที่ 2 (เว้นว่างเพื่อซ่อน)" [disabled]="!auth.isAdmin()" [ngModel]="draft().loginChip2" (ngModelChange)="patch({ loginChip2: $event })" />
                    <input class="input" placeholder="จุดเด่นที่ 3 (เว้นว่างเพื่อซ่อน)" [disabled]="!auth.isAdmin()" [ngModel]="draft().loginChip3" (ngModelChange)="patch({ loginChip3: $event })" />
                  }
                </div>
                <div class="field" (mouseenter)="focus.set('loginLeftFooter')" (focusin)="focus.set('loginLeftFooter')">
                  <label>ข้อความบรรทัดล่างซ้าย</label>
                  <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().loginLeftFooter" (ngModelChange)="patch({ loginLeftFooter: $event })" />
                </div>
                <div class="grid-2">
                  <div class="field" (mouseenter)="focus.set('loginBg')" (focusin)="focus.set('loginBg')">
                    <label>ภาพพื้นหลังฝั่งซ้าย</label>
                    <div class="row">
                      <input #bgIn type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="onBgFile($event)" />
                      <button class="btn sm" type="button" [disabled]="!auth.isAdmin()" (click)="bgIn.click()">อัปโหลดภาพ</button>
                      @if (draft().loginBgDataUrl) {
                        <button class="btn sm ghost" style="color: var(--danger)" type="button" [disabled]="!auth.isAdmin()" (click)="patch({ loginBgDataUrl: '' })">ลบภาพ</button>
                      }
                    </div>
                  </div>
                  <div class="field" (mouseenter)="focus.set('loginPattern')" (focusin)="focus.set('loginPattern')">
                    <label>ลวดลายตกแต่ง (Pattern)</label>
                    <div class="segmented">
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().loginPattern === 'grid'" (click)="patch({ loginPattern: 'grid' })">ตาราง</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().loginPattern === 'dots'" (click)="patch({ loginPattern: 'dots' })">จุด</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().loginPattern === 'waves'" (click)="patch({ loginPattern: 'waves' })">เฉียง</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().loginPattern === 'none'" (click)="patch({ loginPattern: 'none' })">ไม่มี</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-head"><h3>ฝั่งขวาหน้า Login (การ์ดเข้าสู่ระบบ ปุ่มสาธารณะ และท้ายหน้า)</h3></div>
              <div class="card-body">
                <div class="grid-2">
                  <div class="field" (mouseenter)="focus.set('loginCardTitle')" (focusin)="focus.set('loginCardTitle')">
                    <label>หัวข้อกล่องเข้าสู่ระบบ</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().loginCardTitle" (ngModelChange)="patch({ loginCardTitle: $event })" />
                  </div>
                  <div class="field" (mouseenter)="focus.set('loginCardSubtitle')" (focusin)="focus.set('loginCardSubtitle')">
                    <label>ข้อความรองใต้หัวข้อ</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().loginCardSubtitle" (ngModelChange)="patch({ loginCardSubtitle: $event })" />
                  </div>
                  <div class="field" (mouseenter)="focus.set('loginButtonText')" (focusin)="focus.set('loginButtonText')">
                    <label>ข้อความบนปุ่มเข้าสู่ระบบ</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().loginButtonText" (ngModelChange)="patch({ loginButtonText: $event })" />
                  </div>
                  <div class="field" (mouseenter)="focus.set('loginPublicLink')" (focusin)="focus.set('loginPublicLink')">
                    <label>ปุ่มดูตารางสาธารณะ (/p)</label>
                    <label class="toggle-box" [class.on]="draft().loginShowPublicLink">
                      <div class="toggle-box-text"><span class="toggle-box-title">แสดงปุ่มดูตารางสาธารณะ</span></div>
                      <div class="toggle-box-right">
                        <span class="toggle-state">{{ draft().loginShowPublicLink ? 'เปิด' : 'ปิด' }}</span>
                        <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().loginShowPublicLink" (ngModelChange)="patch({ loginShowPublicLink: $event })" /><span></span></span>
                      </div>
                    </label>
                  </div>
                </div>
                @if (draft().loginShowPublicLink) {
                  <div class="field" (mouseenter)="focus.set('loginPublicLink')" (focusin)="focus.set('loginPublicLink')">
                    <label>ข้อความบนปุ่มดูตารางสาธารณะ</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().loginPublicLinkText" (ngModelChange)="patch({ loginPublicLinkText: $event })" />
                  </div>
                }
                <div class="field" (mouseenter)="focus.set('footerText')" (focusin)="focus.set('footerText')">
                  <label>ข้อความท้ายหน้า (Footer)</label>
                  <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().footerText" (ngModelChange)="patch({ footerText: $event })" />
                </div>
              </div>
            </div>
          }

          @if (tab() === 'register') {
            <div class="card">
              <div class="card-head"><h3>ตั้งค่าหน้าสมัครบัญชีใหม่ (Register)</h3></div>
              <div class="card-body">
                <label class="toggle-box" [class.on]="draft().registerEnabled !== false" (mouseenter)="focus.set('registerEnabled')">
                  <div class="toggle-box-text">
                    <span class="toggle-box-title">เปิดรับสมัครบัญชีผู้ใช้งานใหม่</span>
                    <span class="toggle-box-sub">หากปิด ปุ่ม "สมัครบัญชีใหม่" จะถูกซ่อนจากหน้า Login</span>
                  </div>
                  <div class="toggle-box-right">
                    <span class="toggle-state">{{ draft().registerEnabled !== false ? 'เปิด' : 'ปิด' }}</span>
                    <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().registerEnabled !== false" (ngModelChange)="patch({ registerEnabled: $event })" /><span></span></span>
                  </div>
                </label>
                <div class="grid-2">
                  <div class="field" (mouseenter)="focus.set('registerPrompt')" (focusin)="focus.set('registerPrompt')">
                    <label>ข้อความชวนสมัครใต้ปุ่มเข้าสู่ระบบ</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().registerPromptText" (ngModelChange)="patch({ registerPromptText: $event })" />
                  </div>
                  <div class="field" (mouseenter)="focus.set('registerPrompt')" (focusin)="focus.set('registerPrompt')">
                    <label>ข้อความปุ่มลิงก์สมัครบัญชี</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().registerLinkText" (ngModelChange)="patch({ registerLinkText: $event })" />
                  </div>
                  <div class="field" (mouseenter)="focus.set('registerTitle')" (focusin)="focus.set('registerTitle')">
                    <label>หัวข้อใหญ่หน้าสมัครบัญชี</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().registerTitle" (ngModelChange)="patch({ registerTitle: $event })" />
                  </div>
                  <div class="field" (mouseenter)="focus.set('registerSubtitle')" (focusin)="focus.set('registerSubtitle')">
                    <label>คำอธิบายใต้หัวข้อหน้าสมัคร</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().registerSubtitle" (ngModelChange)="patch({ registerSubtitle: $event })" />
                  </div>
                </div>
                <div class="field" (mouseenter)="focus.set('registerTeacher')" (focusin)="focus.set('registerTeacher')">
                  <label>ชื่อการ์ดสิทธิ์ครูผู้สอน</label>
                  <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().registerTeacherLabel" (ngModelChange)="patch({ registerTeacherLabel: $event })" />
                </div>
                <div class="field" (mouseenter)="focus.set('registerTeacher')" (focusin)="focus.set('registerTeacher')">
                  <label>คำอธิบายสิทธิ์ครูผู้สอน</label>
                  <textarea class="input" rows="2" [disabled]="!auth.isAdmin()" [ngModel]="draft().registerTeacherDesc" (ngModelChange)="patch({ registerTeacherDesc: $event })"></textarea>
                </div>
                <div class="field" (mouseenter)="focus.set('registerAdminNotice')" (focusin)="focus.set('registerAdminNotice')">
                  <label>ข้อความแจ้งเตือนสิทธิ์ผู้ดูแลระบบ (Admin)</label>
                  <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().registerAdminNotice" (ngModelChange)="patch({ registerAdminNotice: $event })" />
                </div>
                <div class="field" (mouseenter)="focus.set('registerPendingTitle')" (focusin)="focus.set('registerPendingTitle')">
                  <label>หัวข้อหน้าแจ้งสถานะรออนุมัติ (หลังครูส่งคำขอ)</label>
                  <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().registerPendingTitle" (ngModelChange)="patch({ registerPendingTitle: $event })" />
                </div>
              </div>
            </div>
          }

          @if (tab() === 'dashboard') {
            <div class="card">
              <div class="card-head"><h3>ส่วนหัวและรูปแบบการ์ดหน้าภาพรวม (Dashboard)</h3></div>
              <div class="card-body">
                <div class="field" (mouseenter)="focus.set('heroTitle')" (focusin)="focus.set('heroTitle')">
                  <label>หัวข้อใหญ่ Hero หน้าภาพรวม</label>
                  <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().heroTitle" (ngModelChange)="patch({ heroTitle: $event })" />
                </div>
                <div class="field" (mouseenter)="focus.set('heroSubtitle')" (focusin)="focus.set('heroSubtitle')">
                  <label>ข้อความรองใต้หัวข้อ Hero</label>
                  <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().heroSubtitle" (ngModelChange)="patch({ heroSubtitle: $event })" />
                </div>
                <div class="grid-2">
                  <div class="field" (mouseenter)="focus.set('cardShadow')" (focusin)="focus.set('cardShadow')">
                    <label>ระดับเงาการ์ด (Card Shadow)</label>
                    <div class="segmented">
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().cardShadow === 'none'" (click)="patch({ cardShadow: 'none' })">ไม่มี</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().cardShadow === 'sm'" (click)="patch({ cardShadow: 'sm' })">เบา</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().cardShadow === 'md'" (click)="patch({ cardShadow: 'md' })">กลาง</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().cardShadow === 'lg'" (click)="patch({ cardShadow: 'lg' })">ชัด</button>
                    </div>
                  </div>
                  <div class="field" (mouseenter)="focus.set('density')" (focusin)="focus.set('density')">
                    <label>ความโปร่งของเนื้อหา (Density)</label>
                    <div class="segmented">
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().density === 'compact'" (click)="patch({ density: 'compact' })">กระชับ</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().density === 'comfortable'" (click)="patch({ density: 'comfortable' })">พอดี</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().density === 'spacious'" (click)="patch({ density: 'spacious' })">โปร่ง</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }

          @if (tab() === 'public') {
            <div class="card">
              <div class="card-head"><h3>ส่วนหัว Hero และแถบประกาศ (หน้าสาธารณะ /p)</h3></div>
              <div class="card-body">
                <div class="grid-2">
                  <div class="field" (mouseenter)="focus.set('pubHero')" (focusin)="focus.set('pubHero')">
                    <label>หัวข้อหน้าสาธารณะ</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.heroTitle" (ngModelChange)="patchPublic({ heroTitle: $event })" />
                  </div>
                  <div class="field" (mouseenter)="focus.set('pubHero')" (focusin)="focus.set('pubHero')">
                    <label>คำอธิบายรอง</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.heroSubtitle" (ngModelChange)="patchPublic({ heroSubtitle: $event })" />
                  </div>
                </div>
                <div class="grid-2">
                  <div class="field" (mouseenter)="focus.set('pubHero')" (focusin)="focus.set('pubHero')">
                    <label>สไตล์พื้นหลัง Hero</label>
                    <div class="segmented">
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.heroStyle === 'gradient'" (click)="patchPublic({ heroStyle: 'gradient' })">ไล่เฉด</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.heroStyle === 'solid'" (click)="patchPublic({ heroStyle: 'solid' })">สีทึบ</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.heroStyle === 'image'" (click)="patchPublic({ heroStyle: 'image' })">ภาพพื้นหลัง</button>
                    </div>
                  </div>
                  <div class="field" (mouseenter)="focus.set('pubLoginBtn')" (focusin)="focus.set('pubLoginBtn')">
                    <label>ข้อความปุ่มเข้าสู่ระบบมุมขวาบน</label>
                    <input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.loginButtonText" (ngModelChange)="patchPublic({ loginButtonText: $event })" />
                  </div>
                </div>
                <div class="field" (mouseenter)="focus.set('pubHero')" (focusin)="focus.set('pubHero')">
                  <label>ลวดลายตกแต่งส่วนหัว (Hero Pattern)</label>
                  <div class="segmented">
                    <button type="button" [disabled]="!auth.isAdmin()" [class.active]="(draft().public.heroPattern || 'grid') === 'grid'" (click)="patchPublic({ heroPattern: 'grid' })">ตาราง</button>
                    <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.heroPattern === 'dots'" (click)="patchPublic({ heroPattern: 'dots' })">จุด</button>
                    <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.heroPattern === 'waves'" (click)="patchPublic({ heroPattern: 'waves' })">เฉียง</button>
                    <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.heroPattern === 'none'" (click)="patchPublic({ heroPattern: 'none' })">ไม่มี</button>
                  </div>
                </div>
                @if (draft().public.heroStyle === 'image' && auth.isAdmin()) {
                  <div class="row" (mouseenter)="focus.set('pubHero')">
                    <input #pubBgIn type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="onPublicBgFile($event)" />
                    <button class="btn sm" type="button" (click)="pubBgIn.click()"><app-icon name="upload" [size]="14" /> อัปโหลดภาพพื้นหลังส่วนหัว</button>
                    @if (draft().public.heroBgDataUrl) {
                      <button class="btn sm ghost" type="button" (click)="patchPublic({ heroBgDataUrl: '' })">ลบภาพพื้นหลัง</button>
                    }
                  </div>
                }
                <div class="grid-2">
                  <label class="toggle-box" [class.on]="draft().public.showLogo" (mouseenter)="focus.set('pubLogo')">
                    <div class="toggle-box-text"><span class="toggle-box-title">แสดงโลโก้สถาบัน</span></div>
                    <div class="toggle-box-right">
                      <span class="toggle-state">{{ draft().public.showLogo ? 'เปิด' : 'ปิด' }}</span>
                      <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.showLogo" (ngModelChange)="patchPublic({ showLogo: $event })" /><span></span></span>
                    </div>
                  </label>
                  <label class="toggle-box" [class.on]="draft().public.showStats" (mouseenter)="focus.set('pubStats')">
                    <div class="toggle-box-text"><span class="toggle-box-title">แสดงแถบสรุปสถิติ</span></div>
                    <div class="toggle-box-right">
                      <span class="toggle-state">{{ draft().public.showStats ? 'เปิด' : 'ปิด' }}</span>
                      <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.showStats" (ngModelChange)="patchPublic({ showStats: $event })" /><span></span></span>
                    </div>
                  </label>
                </div>
                <div class="grid-2">
                  <label class="toggle-box" [class.on]="draft().public.showLoginButton" (mouseenter)="focus.set('pubLoginBtn')">
                    <div class="toggle-box-text"><span class="toggle-box-title">แสดงปุ่มเข้าสู่ระบบผู้ดูแล</span></div>
                    <div class="toggle-box-right">
                      <span class="toggle-state">{{ draft().public.showLoginButton ? 'เปิด' : 'ปิด' }}</span>
                      <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.showLoginButton" (ngModelChange)="patchPublic({ showLoginButton: $event })" /><span></span></span>
                    </div>
                  </label>
                  <label class="toggle-box" [class.on]="draft().public.showFooter" (mouseenter)="focus.set('pubFooter')">
                    <div class="toggle-box-text"><span class="toggle-box-title">แสดงข้อความส่วนท้าย</span></div>
                    <div class="toggle-box-right">
                      <span class="toggle-state">{{ draft().public.showFooter ? 'เปิด' : 'ปิด' }}</span>
                      <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.showFooter" (ngModelChange)="patchPublic({ showFooter: $event })" /><span></span></span>
                    </div>
                  </label>
                </div>
                <label class="toggle-box" [class.on]="draft().public.announcementEnabled" (mouseenter)="focus.set('pubAnnouncement')">
                  <div class="toggle-box-text"><span class="toggle-box-title">เปิดแถบประกาศข่าวสาร</span><span class="toggle-box-sub">แสดงข้อความประกาศเด่นด้านบนหน้า /p</span></div>
                  <div class="toggle-box-right">
                    <span class="toggle-state">{{ draft().public.announcementEnabled ? 'เปิด' : 'ปิด' }}</span>
                    <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.announcementEnabled" (ngModelChange)="patchPublic({ announcementEnabled: $event })" /><span></span></span>
                  </div>
                </label>
                @if (draft().public.announcementEnabled) {
                  <div class="grid-2" (mouseenter)="focus.set('pubAnnouncement')">
                    <div class="field"><label>ข้อความประกาศ</label><input class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.announcementText" (ngModelChange)="patchPublic({ announcementText: $event })" /></div>
                    <div class="field">
                      <label>โทนสีประกาศ</label>
                      <select class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.announcementTone" (ngModelChange)="patchPublic({ announcementTone: $event })">
                        <option value="info">ข่าวสาร (ฟ้า)</option>
                        <option value="warning">แจ้งเตือน (เหลือง)</option>
                        <option value="success">สำเร็จ/เปิดแล้ว (เขียว)</option>
                      </select>
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="card">
              <div class="card-head"><h3>ภาพสไลด์ Carousel (ประชาสัมพันธ์หน้าสาธารณะ)</h3></div>
              <div class="card-body" (mouseenter)="focus.set('pubCarousel')">
                <label class="toggle-box" [class.on]="draft().public.carouselEnabled">
                  <div class="toggle-box-text"><span class="toggle-box-title">เปิดแสดงภาพสไลด์ Carousel</span><span class="toggle-box-sub">รองรับสูงสุด 8 รูป (คงสัดส่วนภาพต้นฉบับ สูงสุด 1600px)</span></div>
                  <div class="toggle-box-right">
                    <span class="toggle-state">{{ draft().public.carouselEnabled ? 'เปิด' : 'ปิด' }}</span>
                    <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.carouselEnabled" (ngModelChange)="patchPublic({ carouselEnabled: $event })" /><span></span></span>
                  </div>
                </label>
                @if (draft().public.carouselEnabled) {
                  <div class="grid-2">
                    <div class="field">
                      <label>รูปแบบการจัดวางภาพ</label>
                      <div class="segmented">
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="(draft().public.carouselFit || 'cover') === 'contain'" (click)="patchPublic({ carouselFit: 'contain' })">พอดีกรอบ</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="(draft().public.carouselFit || 'cover') === 'cover'" (click)="patchPublic({ carouselFit: 'cover' })">ภาพใหญ่เต็มกรอบ</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.carouselFit === 'fill'" (click)="patchPublic({ carouselFit: 'fill' })">ยืดเต็มกรอบ</button>
                      </div>
                    </div>
                    <div class="field">
                      <label>ขนาดความสูงของสไลด์</label>
                      <div class="segmented">
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.carouselHeight === 'sm'" (click)="patchPublic({ carouselHeight: 'sm' })">เล็ก</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="(draft().public.carouselHeight || 'md') === 'md'" (click)="patchPublic({ carouselHeight: 'md' })">กลาง</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.carouselHeight === 'lg'" (click)="patchPublic({ carouselHeight: 'lg' })">ใหญ่</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.carouselHeight === 'xl'" (click)="patchPublic({ carouselHeight: 'xl' })">ใหญ่มาก</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.carouselHeight === 'auto'" (click)="patchPublic({ carouselHeight: 'auto' })">ตามภาพ</button>
                      </div>
                    </div>
                  </div>
                  <div class="grid-2">
                    <div class="field">
                      <label>ตำแหน่งมุมมองภาพ (โฟกัส)</label>
                      <div class="segmented">
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.carouselPosition === 'top'" (click)="patchPublic({ carouselPosition: 'top' })">ด้านบน</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="(draft().public.carouselPosition || 'center') === 'center'" (click)="patchPublic({ carouselPosition: 'center' })">กึ่งกลาง</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.carouselPosition === 'bottom'" (click)="patchPublic({ carouselPosition: 'bottom' })">ด้านล่าง</button>
                      </div>
                    </div>
                    <div class="field">
                      <label>ความโค้งมุมกรอบภาพ</label>
                      <div class="segmented">
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.carouselRadius === 'none'" (click)="patchPublic({ carouselRadius: 'none' })">เหลี่ยม</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.carouselRadius === 'sm'" (click)="patchPublic({ carouselRadius: 'sm' })">น้อย</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="(draft().public.carouselRadius || 'md') === 'md'" (click)="patchPublic({ carouselRadius: 'md' })">กลาง</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.carouselRadius === 'lg'" (click)="patchPublic({ carouselRadius: 'lg' })">มาก</button>
                      </div>
                    </div>
                  </div>
                  <div class="grid-2">
                    <div class="field">
                      <label>พื้นหลังพื้นที่ว่างด้านข้าง (เมื่อใช้แบบพอดีกรอบ)</label>
                      <div class="segmented">
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="(draft().public.carouselBgMode || 'blur') === 'blur'" (click)="patchPublic({ carouselBgMode: 'blur' })">เบลอภาพเดิม</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.carouselBgMode === 'gradient'" (click)="patchPublic({ carouselBgMode: 'gradient' })">ไล่เฉดธีม</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.carouselBgMode === 'dark'" (click)="patchPublic({ carouselBgMode: 'dark' })">สีเข้ม</button>
                        <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.carouselBgMode === 'solid'" (click)="patchPublic({ carouselBgMode: 'solid' })">เลือกสีเอง</button>
                      </div>
                    </div>
                    @if (draft().public.carouselBgMode === 'solid') {
                      <div class="field">
                        <label>สีพื้นหลังกรอบสไลด์</label>
                        <div class="color-row">
                          <input type="color" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.carouselBgColor || '#1a1a2e'" (ngModelChange)="patchPublic({ carouselBgColor: $event })" />
                          <input class="input mono" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.carouselBgColor || '#1a1a2e'" (ngModelChange)="patchPublic({ carouselBgColor: $event })" />
                        </div>
                      </div>
                    }
                  </div>
                  <div class="grid-2">
                    <label class="toggle-box" [class.on]="draft().public.carouselAutoplay">
                      <div class="toggle-box-text"><span class="toggle-box-title">เลื่อนสไลด์อัตโนมัติ</span></div>
                      <div class="toggle-box-right">
                        <span class="toggle-state">{{ draft().public.carouselAutoplay ? 'เปิด' : 'ปิด' }}</span>
                        <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.carouselAutoplay" (ngModelChange)="patchPublic({ carouselAutoplay: $event })" /><span></span></span>
                      </div>
                    </label>
                    <div class="field">
                      <label>หน่วงเวลาเปลี่ยนภาพ (วินาที): {{ draft().public.carouselIntervalSec || 5 }} วิ</label>
                      <input type="range" min="2" max="15" step="1" [disabled]="!auth.isAdmin() || !draft().public.carouselAutoplay" [ngModel]="draft().public.carouselIntervalSec || 5" (ngModelChange)="patchPublic({ carouselIntervalSec: +$event })" />
                    </div>
                  </div>
                  @if (auth.isAdmin()) {
                    <div class="row">
                      <input #carIn type="file" multiple accept="image/png,image/jpeg,image/webp" hidden (change)="onCarouselFiles($event)" />
                      <button class="btn primary sm" type="button" [disabled]="draft().public.carouselSlides.length >= 8" (click)="carIn.click()">
                        <app-icon name="upload" [size]="14" /> เพิ่มรูปภาพ Carousel ({{ draft().public.carouselSlides.length }}/8)
                      </button>
                    </div>
                  }
                  @for (sl of draft().public.carouselSlides; track sl.id; let i = $index) {
                    <div class="row" style="border: 1px solid var(--border); padding: 8px; border-radius: 8px">
                      <img [src]="sl.imageDataUrl" alt="slide" style="width: 72px; height: 42px; object-fit: cover; border-radius: 6px" />
                      <input class="input" style="flex: 1" placeholder="หัวข้อสไลด์ (ไม่บังคับ)" [disabled]="!auth.isAdmin()" [ngModel]="sl.title" (ngModelChange)="updateSlide(i, { title: $event })" />
                      @if (auth.isAdmin()) {
                        <button class="btn sm ghost" style="color: var(--danger)" type="button" (click)="removeSlide(i)">ลบ</button>
                      }
                    </div>
                  }
                }
              </div>
            </div>

            <div class="card">
              <div class="card-head"><h3>เลย์เอาต์การ์ดและส่วนท้าย</h3></div>
              <div class="card-body grid-2">
                <div class="field" (mouseenter)="focus.set('pubCards')">
                  <label>จำนวนคอลัมน์การ์ด</label>
                  <div class="segmented">
                    <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.cardColumns === 2" (click)="patchPublic({ cardColumns: 2 })">2 คอลัมน์</button>
                    <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.cardColumns === 3" (click)="patchPublic({ cardColumns: 3 })">3 คอลัมน์</button>
                    <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().public.cardColumns === 4" (click)="patchPublic({ cardColumns: 4 })">4 คอลัมน์</button>
                  </div>
                </div>
                <div class="field" (mouseenter)="focus.set('pubFooter')">
                  <label>ข้อความส่วนท้ายหน้า /p</label>
                  <input class="input" placeholder="เว้นว่างเพื่อใช้ค่าท้ายหน้าหลัก" [disabled]="!auth.isAdmin()" [ngModel]="draft().public.footerNote" (ngModelChange)="patchPublic({ footerNote: $event })" />
                </div>
              </div>
            </div>
          }

          @if (tab() === 'colors') {
            <div class="card">
              <div class="card-head"><h3>ชุดสีสำเร็จรูป (คลิกเปลี่ยนทันที)</h3></div>
              <div class="card-body">
                <div class="presets">
                  @for (p of presets; track p.name) {
                    <button type="button" class="preset-btn" [disabled]="!auth.isAdmin()" (click)="applyPreset(p)">
                      <span class="dot-swatch" [style.background]="p.primary"></span>
                      <span>{{ p.name }}</span>
                    </button>
                  }
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-head"><h3>กำหนดสีและโหมดมืดอย่างอิสระ</h3></div>
              <div class="card-body grid-2">
                <div class="field" (mouseenter)="focus.set('primaryColor')" (focusin)="focus.set('primaryColor')">
                  <label>สีหลัก (Primary)</label>
                  <div class="color-row">
                    <input type="color" [disabled]="!auth.isAdmin()" [ngModel]="draft().primaryColor" (ngModelChange)="patch({ primaryColor: $event })" />
                    <input class="input mono" [disabled]="!auth.isAdmin()" [ngModel]="draft().primaryColor" (ngModelChange)="patch({ primaryColor: $event })" />
                  </div>
                </div>
                <div class="field" (mouseenter)="focus.set('accentColor')" (focusin)="focus.set('accentColor')">
                  <label>สีรอง (Accent)</label>
                  <div class="color-row">
                    <input type="color" [disabled]="!auth.isAdmin()" [ngModel]="draft().accentColor" (ngModelChange)="patch({ accentColor: $event })" />
                    <input class="input mono" [disabled]="!auth.isAdmin()" [ngModel]="draft().accentColor" (ngModelChange)="patch({ accentColor: $event })" />
                  </div>
                </div>
                <div class="field" (mouseenter)="focus.set('bgColor')" (focusin)="focus.set('bgColor')">
                  <label>สีพื้นหลังหน้าเว็บ (Background)</label>
                  <div class="color-row">
                    <input type="color" [disabled]="!auth.isAdmin() || draft().darkMode" [ngModel]="draft().bgColor" (ngModelChange)="patch({ bgColor: $event })" />
                    <input class="input mono" [disabled]="!auth.isAdmin() || draft().darkMode" [ngModel]="draft().bgColor" (ngModelChange)="patch({ bgColor: $event })" />
                  </div>
                </div>
                <div class="field" (mouseenter)="focus.set('surfaceColor')" (focusin)="focus.set('surfaceColor')">
                  <label>สีพื้นการ์ด (Surface)</label>
                  <div class="color-row">
                    <input type="color" [disabled]="!auth.isAdmin() || draft().darkMode" [ngModel]="draft().surfaceColor" (ngModelChange)="patch({ surfaceColor: $event })" />
                    <input class="input mono" [disabled]="!auth.isAdmin() || draft().darkMode" [ngModel]="draft().surfaceColor" (ngModelChange)="patch({ surfaceColor: $event })" />
                  </div>
                </div>
                <div class="field" (mouseenter)="focus.set('textColor')" (focusin)="focus.set('textColor')">
                  <label>สีตัวอักษรหลัก (Text)</label>
                  <div class="color-row">
                    <input type="color" [disabled]="!auth.isAdmin() || draft().darkMode" [ngModel]="draft().textColor" (ngModelChange)="patch({ textColor: $event })" />
                    <input class="input mono" [disabled]="!auth.isAdmin() || draft().darkMode" [ngModel]="draft().textColor" (ngModelChange)="patch({ textColor: $event })" />
                  </div>
                </div>
                <div class="field" (mouseenter)="focus.set('darkMode')" (focusin)="focus.set('darkMode')">
                  <label>โหมดมืด (Dark Mode)</label>
                  <label class="toggle-box" [class.on]="draft().darkMode">
                    <div class="toggle-box-text">
                      <span class="toggle-box-title">โหมดมืดทั้งระบบ</span>
                      <span class="toggle-box-sub">{{ draft().darkMode ? 'กำลังใช้งานโหมดมืด' : 'กำลังใช้งานโหมดสว่างปกติ' }}</span>
                    </div>
                    <div class="toggle-box-right">
                      <span class="toggle-state">{{ draft().darkMode ? 'เปิด' : 'ปิด' }}</span>
                      <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().darkMode" (ngModelChange)="patch({ darkMode: $event })" /><span></span></span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          }

          @if (tab() === 'typography') {
            <div class="card">
              <div class="card-head"><h3>แบบอักษร ขนาด และความโค้งมน</h3></div>
              <div class="card-body">
                <div class="grid-2">
                  <div class="field" (mouseenter)="focus.set('fontFamily')" (focusin)="focus.set('fontFamily')">
                    <label>แบบอักษร (Font Family)</label>
                    <select class="input" [disabled]="!auth.isAdmin()" [ngModel]="draft().fontFamily" (ngModelChange)="patch({ fontFamily: $event })">
                      <option value="IBM Plex Sans Thai">IBM Plex Sans Thai (ค่าเริ่มต้น)</option>
                      <option value="Sarabun">Sarabun (ทางการ)</option>
                      <option value="Prompt">Prompt (ทันสมัย)</option>
                      <option value="Kanit">Kanit (โค้งมน)</option>
                      <option value="System">ฟอนต์ระบบ (System UI)</option>
                    </select>
                  </div>
                  <div class="field" (mouseenter)="focus.set('fontSize')" (focusin)="focus.set('fontSize')">
                    <label>ขนาดตัวอักษรหลัก: {{ draft().fontSize }} px</label>
                    <input type="range" min="12" max="17" step="1" [disabled]="!auth.isAdmin()" [ngModel]="draft().fontSize" (ngModelChange)="patch({ fontSize: +$event })" />
                  </div>
                </div>
                <div class="field" (mouseenter)="focus.set('borderRadius')" (focusin)="focus.set('borderRadius')">
                  <label>ความโค้งมนของการ์ดและปุ่ม: {{ draft().borderRadius }} px</label>
                  <input type="range" min="0" max="24" step="1" [disabled]="!auth.isAdmin()" [ngModel]="draft().borderRadius" (ngModelChange)="patch({ borderRadius: +$event })" />
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-head"><h3>Custom CSS ขั้นสูง</h3></div>
              <div class="card-body">
                <div class="field">
                  <label>เขียน CSS เพิ่มเติม (มีผลทันทีทั่วทั้งระบบ)</label>
                  <textarea class="input mono" rows="5" style="font-size: 12.5px" placeholder=".card { border-width: 2px; }" [disabled]="!auth.isAdmin()" [ngModel]="draft().customCss" (ngModelChange)="patch({ customCss: $event })"></textarea>
                </div>
              </div>
            </div>
          }

          @if (tab() === 'pdf') {
            <div class="card">
              <div class="card-head">
                <h3>ตกแต่งเอกสาร PDF (A4 แนวนอน)</h3>
                <button class="btn primary sm" type="button" (click)="openRealPdf()">
                  <app-icon name="file" [size]="14" /> ดูตัวอย่าง PDF จริง
                </button>
              </div>
              <div class="card-body">
                <div class="row" (mouseenter)="focus.set('pdfLogo')" (focusin)="focus.set('pdfLogo')">
                  <div class="preview-logo rounded" style="width: 56px; height: 56px">
                    <img [src]="effectivePdfLogo()" alt="pdf logo" />
                  </div>
                  <div style="flex: 1; display: flex; flex-direction: column; gap: 8px">
                    <div class="row">
                      <label class="toggle-box" style="padding: 6px 10px" [class.on]="draft().pdf.showLogo">
                        <span class="toggle-box-title" style="font-size: 12.5px">แสดงโลโก้บน PDF</span>
                        <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().pdf.showLogo" (ngModelChange)="patchPdf({ showLogo: $event })" /><span></span></span>
                      </label>
                      @if (auth.isAdmin()) {
                        <input #pdfLogoIn type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden (change)="onPdfLogoFile($event)" />
                        <button class="btn sm" type="button" (click)="pdfLogoIn.click()"><app-icon name="upload" [size]="14" /> เปลี่ยนโลโก้ PDF</button>
                        @if (draft().logoDataUrl) {
                          <button class="btn sm ghost" type="button" (click)="syncWebLogoToPdf()">ดึงจากโลโก้เว็บ</button>
                        }
                      }
                    </div>
                    <div class="segmented" style="max-width: 220px">
                      <button type="button" [disabled]="!auth.isAdmin() || !draft().pdf.showLogo" [class.active]="draft().pdf.logoSize === 'sm'" (click)="patchPdf({ logoSize: 'sm' })">เล็ก</button>
                      <button type="button" [disabled]="!auth.isAdmin() || !draft().pdf.showLogo" [class.active]="draft().pdf.logoSize === 'md'" (click)="patchPdf({ logoSize: 'md' })">กลาง</button>
                      <button type="button" [disabled]="!auth.isAdmin() || !draft().pdf.showLogo" [class.active]="draft().pdf.logoSize === 'lg'" (click)="patchPdf({ logoSize: 'lg' })">ใหญ่</button>
                    </div>
                  </div>
                </div>

                <div class="field" (mouseenter)="focus.set('pdfColorMode')" (focusin)="focus.set('pdfColorMode')">
                  <label>โหมดสีของเอกสาร PDF</label>
                  <div class="segmented">
                    <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().pdf.colorMode === 'bw'" (click)="patchPdf({ colorMode: 'bw' })">ขาว-ดำ (พิมพ์ทางการ)</button>
                    <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().pdf.colorMode === 'theme'" (click)="patchPdf({ colorMode: 'theme' })">ตามสีธีมเว็บอัตโนมัติ</button>
                    <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().pdf.colorMode === 'custom'" (click)="patchPdf({ colorMode: 'custom' })">กำหนดสีเอง</button>
                  </div>
                </div>

                @if (draft().pdf.colorMode === 'custom') {
                  <div class="grid-2">
                    <div class="field" (mouseenter)="focus.set('pdfHeader')"><label>สีพื้นหัวตาราง</label><div class="color-row"><input type="color" [ngModel]="draft().pdf.headerBg" (ngModelChange)="patchPdf({ headerBg: $event })" /><input class="input mono" [ngModel]="draft().pdf.headerBg" (ngModelChange)="patchPdf({ headerBg: $event })" /></div></div>
                    <div class="field" (mouseenter)="focus.set('pdfHeader')"><label>สีตัวอักษรหัวตาราง</label><div class="color-row"><input type="color" [ngModel]="draft().pdf.headerText" (ngModelChange)="patchPdf({ headerText: $event })" /><input class="input mono" [ngModel]="draft().pdf.headerText" (ngModelChange)="patchPdf({ headerText: $event })" /></div></div>
                    <div class="field" (mouseenter)="focus.set('pdfDayBg')"><label>สีแถบวัน / แถวรวม</label><div class="color-row"><input type="color" [ngModel]="draft().pdf.dayBg" (ngModelChange)="patchPdf({ dayBg: $event })" /><input class="input mono" [ngModel]="draft().pdf.dayBg" (ngModelChange)="patchPdf({ dayBg: $event })" /></div></div>
                    <div class="field" (mouseenter)="focus.set('pdfBreakBg')"><label>สีช่องพักกลางวัน</label><div class="color-row"><input type="color" [ngModel]="draft().pdf.breakBg" (ngModelChange)="patchPdf({ breakBg: $event })" /><input class="input mono" [ngModel]="draft().pdf.breakBg" (ngModelChange)="patchPdf({ breakBg: $event })" /></div></div>
                    <div class="field" (mouseenter)="focus.set('pdfBorder')"><label>สีเส้นตาราง</label><div class="color-row"><input type="color" [ngModel]="draft().pdf.borderColor" (ngModelChange)="patchPdf({ borderColor: $event })" /><input class="input mono" [ngModel]="draft().pdf.borderColor" (ngModelChange)="patchPdf({ borderColor: $event })" /></div></div>
                  </div>
                }

                <div class="grid-2">
                  <label class="toggle-box" [class.on]="draft().pdf.showSubjectTable" (mouseenter)="focus.set('pdfSubjectTable')">
                    <div class="toggle-box-text"><span class="toggle-box-title">ตารางสรุปรายวิชา (ขวาบน)</span><span class="toggle-box-sub">{{ draft().pdf.showSubjectTable ? 'แสดงตาราง น. บ. ป. ศ.' : 'ซ่อนและขยายหัวกระดาษเต็มแถบ' }}</span></div>
                    <div class="toggle-box-right"><span class="toggle-state">{{ draft().pdf.showSubjectTable ? 'เปิด' : 'ปิด' }}</span><span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().pdf.showSubjectTable" (ngModelChange)="patchPdf({ showSubjectTable: $event })" /><span></span></span></div>
                  </label>
                  <label class="toggle-box" [class.on]="draft().pdf.showSignatures" (mouseenter)="focus.set('pdfSignatures')">
                    <div class="toggle-box-text"><span class="toggle-box-title">ช่องลงนาม 4 ตำแหน่ง (ด้านล่าง)</span><span class="toggle-box-sub">{{ draft().pdf.showSignatures ? 'แสดงช่องลงชื่อ 4 คอลัมน์' : 'ซ่อนช่องลงนามเพื่อขยายตาราง' }}</span></div>
                    <div class="toggle-box-right"><span class="toggle-state">{{ draft().pdf.showSignatures ? 'เปิด' : 'ปิด' }}</span><span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().pdf.showSignatures" (ngModelChange)="patchPdf({ showSignatures: $event })" /><span></span></span></div>
                  </label>
                  <div class="field" (mouseenter)="focus.set('pdfFontScale')">
                    <label>ขนาดตัวอักษรในตาราง PDF</label>
                    <div class="segmented">
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().pdf.fontScale === 'compact'" (click)="patchPdf({ fontScale: 'compact' })">กระชับ</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().pdf.fontScale === 'normal'" (click)="patchPdf({ fontScale: 'normal' })">ปกติ</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().pdf.fontScale === 'large'" (click)="patchPdf({ fontScale: 'large' })">ใหญ่</button>
                    </div>
                  </div>
                  <div class="field" (mouseenter)="focus.set('pdfMargin')">
                    <label>ระยะขอบกระดาษ (Margin)</label>
                    <div class="segmented">
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().pdf.margin === 'narrow'" (click)="patchPdf({ margin: 'narrow' })">แคบ</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().pdf.margin === 'normal'" (click)="patchPdf({ margin: 'normal' })">ปกติ</button>
                      <button type="button" [disabled]="!auth.isAdmin()" [class.active]="draft().pdf.margin === 'wide'" (click)="patchPdf({ margin: 'wide' })">กว้าง</button>
                    </div>
                  </div>
                  <div class="field" (mouseenter)="focus.set('pdfWatermark')"><label>ลายน้ำกลางหน้า (ไม่บังคับ)</label><input class="input" placeholder="เช่น ร่างตารางเรียน หรือ สำเนา" [disabled]="!auth.isAdmin()" [ngModel]="draft().pdf.watermark" (ngModelChange)="patchPdf({ watermark: $event })" /></div>
                  <div class="field" (mouseenter)="focus.set('pdfFooter')"><label>ข้อความหมายเหตุท้ายกระดาษ (ซ้ายล่าง)</label><input class="input" placeholder="เช่น คณะศึกษาศาสตร์" [disabled]="!auth.isAdmin()" [ngModel]="draft().pdf.footerNote" (ngModelChange)="patchPdf({ footerNote: $event })" /></div>
                </div>

                <label class="toggle-box" [class.on]="draft().pdf.showPrintDate" (mouseenter)="focus.set('pdfFooter')">
                  <div class="toggle-box-text"><span class="toggle-box-title">แสดงวันและเวลาที่พิมพ์มุมขวาล่าง</span><span class="toggle-box-sub">พิมพ์เวลาปัจจุบันตามเขตเวลา Asia/Bangkok</span></div>
                  <div class="toggle-box-right"><span class="toggle-state">{{ draft().pdf.showPrintDate ? 'เปิด' : 'ปิด' }}</span><span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [ngModel]="draft().pdf.showPrintDate" (ngModelChange)="patchPdf({ showPrintDate: $event })" /><span></span></span></div>
                </label>
              </div>
            </div>
          }
        </div>

        <!-- RIGHT COLUMN: LIVE PREVIEW -->
        <aside class="card preview-sticky">
          <div class="card-head">
            <div>
              <h3>พรีวิวสด · {{ tabTitle() }}</h3>
              <div class="small muted">กรอบสีทองชี้จุดที่กำลังแก้ไขแบบเรียลไทม์</div>
            </div>
            @if (focusLabel()) {
              <span class="hl-tag">จุดที่แก้: {{ focusLabel() }}</span>
            }
          </div>
          <div class="card-body" style="padding: 14px">
            @if (tab() === 'shell') {
              <div class="mock-browser">
                <div class="mock-bar">
                  <span class="mb-dot" style="background:#f87171"></span><span class="mb-dot" style="background:#fbbf24"></span><span class="mb-dot" style="background:#34d399"></span>
                  <span class="mb-url">{{ draft().siteName }} · {{ draft().siteSubtitle }}</span>
                </div>
                <div class="mini-shell">
                  <div class="mini-side hl-zone" [class.light]="draft().sidebarStyle === 'light'" [class.hl-on]="isHl('sidebarStyle','sidebarWidth')"
                       [style.width.px]="Math.round(draft().sidebarWidth * 0.48)" [style.background]="miniSidebarBg()">
                    <div class="mini-brand">
                      <div class="mini-logo-tile hl-zone" [class]="draft().logoShape" [class.hl-on]="isHl('logo','logoShape')">
                        <img [src]="draft().logoDataUrl || 'logo.png'" alt="logo" />
                      </div>
                      <div style="min-width: 0">
                        <div class="hl-zone" [class.hl-on]="isHl('siteName')" style="font-size: 10px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ draft().siteName }}</div>
                        <div class="hl-zone" [class.hl-on]="isHl('siteSubtitle')" style="font-size: 8.5px; opacity: 0.85">{{ draft().siteSubtitle }}</div>
                      </div>
                    </div>
                    <div class="mini-nav-it active">ภาพรวม</div>
                    <div class="mini-nav-it">จัดตารางสอน ▾</div>
                    <div class="mini-nav-it">ตารางเรียน</div>
                    <div class="mini-nav-it">ส่งออกไฟล์</div>
                  </div>
                  <div class="mini-main" [style.background]="draft().darkMode ? '#141115' : draft().bgColor" [style.color]="draft().darkMode ? '#f5eff2' : draft().textColor">
                    <div class="mini-top hl-zone" [class.hl-on]="isHl('topBarTitle')">
                      <span>{{ draft().topBarTitle }}</span>
                      <span>ผู้ดูแล ▾</span>
                    </div>
                    <div class="mini-body" style="align-items: center; justify-content: center; opacity: 0.7">
                      พื้นที่เนื้อหาหลัก (กว้าง Sidebar: {{ draft().sidebarWidth }}px)
                    </div>
                  </div>
                </div>
              </div>
              <div class="callout-map">
                @for (ch of [['siteName','ชื่อสถาบัน'],['siteSubtitle','ชื่อรอง'],['topBarTitle','Top Bar'],['logo','โลโก้'],['sidebarStyle','สไตล์ Sidebar'],['sidebarWidth','ความกว้าง']]; track ch[0]) {
                  <button type="button" class="cmap-chip" [class.active]="focus() === ch[0]" (click)="focus.set(ch[0])">{{ ch[1] }}</button>
                }
              </div>
            }

            @if (tab() === 'login') {
              <div class="mock-browser">
                <div class="mock-bar"><span class="mb-dot" style="background:#f87171"></span><span class="mb-dot" style="background:#fbbf24"></span><span class="mb-dot" style="background:#34d399"></span><span class="mb-url">/login · หน้าเข้าสู่ระบบ</span></div>
                <div class="mini-login">
                  <div class="mini-login-l hl-zone" [class.hl-on]="isHl('loginBg','loginPattern')" [style.background-image]="loginPreviewBg()">
                    <div class="mini-pat" [class]="draft().loginPattern"></div>
                    <div class="row" style="gap: 6px; position: relative">
                      <div class="mini-logo-tile" [class]="draft().logoShape" style="width: 30px; height: 30px"><img [src]="draft().logoDataUrl || 'logo.png'" alt="logo" /></div>
                      <div><div style="font-size: 9.5px; font-weight: 700">{{ draft().siteName }}</div><div class="hl-zone" [class.hl-on]="isHl('organization')" style="font-size: 7.5px; opacity: 0.85">{{ draft().organization }}</div></div>
                    </div>
                    <div style="position: relative; display: flex; flex-direction: column; gap: 4px">
                      @if (draft().loginBadge) { <span class="mini-chip hl-zone" [class.hl-on]="isHl('loginBadge')" style="align-self: flex-start">{{ draft().loginBadge }}</span> }
                      <div class="hl-zone" [class.hl-on]="isHl('loginHeading')" style="font-size: 13px; font-weight: 700">{{ draft().loginHeading }}</div>
                      <div class="hl-zone" [class.hl-on]="isHl('loginDescription')" style="font-size: 8.5px; opacity: 0.9">{{ draft().loginDescription }}</div>
                      @if (draft().loginShowChips) {
                        <div class="row hl-zone" [class.hl-on]="isHl('loginChips')" style="gap: 4px">
                          @if (draft().loginChip1) { <span class="mini-chip">{{ draft().loginChip1 }}</span> }
                          @if (draft().loginChip2) { <span class="mini-chip">{{ draft().loginChip2 }}</span> }
                          @if (draft().loginChip3) { <span class="mini-chip">{{ draft().loginChip3 }}</span> }
                        </div>
                      }
                    </div>
                    <div class="hl-zone" [class.hl-on]="isHl('loginLeftFooter')" style="position: relative; font-size: 7.5px; opacity: 0.8">{{ draft().loginLeftFooter }}</div>
                  </div>
                  <div class="mini-login-r">
                    <div class="mini-login-card">
                      <div class="hl-zone" [class.hl-on]="isHl('loginCardTitle')" style="font-weight: 700; font-size: 11px">{{ draft().loginCardTitle }}</div>
                      <div class="hl-zone" [class.hl-on]="isHl('loginCardSubtitle')" style="font-size: 8px; color: var(--text-muted)">{{ draft().loginCardSubtitle }}</div>
                      <div style="height: 18px; border: 1px solid var(--border); border-radius: 5px"></div>
                      <div style="height: 18px; border: 1px solid var(--border); border-radius: 5px"></div>
                      <div class="hl-zone" [class.hl-on]="isHl('loginButtonText')" [style.background]="draft().primaryColor" style="height: 22px; color: #fff; border-radius: 6px; font-size: 9px; font-weight: 600; display: flex; align-items: center; justify-content: center">{{ draft().loginButtonText }}</div>
                      @if (draft().loginShowPublicLink) {
                        <div class="hl-zone" [class.hl-on]="isHl('loginPublicLink')" style="font-size: 8px; text-align: center; padding: 3px; border: 1px solid var(--border); border-radius: 5px">{{ draft().loginPublicLinkText }}</div>
                      }
                    </div>
                    <div class="hl-zone" [class.hl-on]="isHl('footerText')" style="font-size: 7.5px; color: var(--text-muted); text-align: center">{{ draft().footerText }}</div>
                  </div>
                </div>
              </div>
              <div class="callout-map">
                @for (ch of [['loginHeading','หัวข้อซ้าย'],['loginChips','ป้ายจุดเด่น 3 ช่อง'],['loginBg','ภาพพื้นหลัง'],['loginCardTitle','กล่องขวา'],['loginButtonText','ปุ่มเข้าสู่ระบบ'],['loginPublicLink','ปุ่มสาธารณะ'],['footerText','ท้ายหน้า']]; track ch[0]) {
                  <button type="button" class="cmap-chip" [class.active]="focus() === ch[0]" (click)="focus.set(ch[0])">{{ ch[1] }}</button>
                }
              </div>
            }

            @if (tab() === 'register') {
              <div class="mock-browser" style="padding: 14px" [style.background]="draft().darkMode ? '#141115' : draft().bgColor">
                @if (draft().registerEnabled === false) {
                  <div class="alert warning hl-zone" [class.hl-on]="isHl('registerEnabled')">ปิดรับสมัครบัญชีใหม่อยู่ — ปุ่มสมัครสมาชิกจะถูกซ่อนจากหน้า Login</div>
                } @else {
                  <div style="background: var(--surface); border: 1px solid var(--border); border-top: 3px solid var(--maroon-700); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px">
                    <div class="row" style="gap: 8px">
                      <div [style.background]="draft().primaryColor" style="width: 28px; height: 28px; border-radius: 7px; color: #fff; display: flex; align-items: center; justify-content: center"><app-icon name="users" [size]="15" /></div>
                      <div>
                        <div class="hl-zone" [class.hl-on]="isHl('registerTitle')" style="font-weight: 700; font-size: 12px">{{ draft().registerTitle }}</div>
                        <div class="hl-zone" [class.hl-on]="isHl('registerSubtitle')" style="font-size: 9.5px; color: var(--text-muted)">{{ draft().registerSubtitle }}</div>
                      </div>
                    </div>
                    <div class="hl-zone" [class.hl-on]="isHl('registerTeacher')" style="border: 1.5px solid var(--maroon-700); background: var(--maroon-50); padding: 8px; border-radius: 8px">
                      <div class="row" style="justify-content: space-between"><strong style="font-size: 10.5px">{{ draft().registerTeacherLabel }}</strong><span class="badge warning" style="font-size: 9px">รออนุมัติจาก Admin</span></div>
                      <div style="font-size: 9px; color: var(--text-muted); margin-top: 3px">{{ draft().registerTeacherDesc }}</div>
                    </div>
                    @if (draft().registerAdminNotice) {
                      <div class="hl-zone" [class.hl-on]="isHl('registerAdminNotice')" style="border: 1px dashed var(--border-strong); padding: 6px 8px; border-radius: 6px; font-size: 9px; color: var(--text-muted)">{{ draft().registerAdminNotice }}</div>
                    }
                    <div class="hl-zone" [class.hl-on]="isHl('registerPrompt')" style="background: var(--maroon-50); border: 1px solid var(--maroon-200); padding: 6px 8px; border-radius: 6px; font-size: 9.5px; text-align: center">
                      {{ draft().registerPromptText }} <strong [style.color]="draft().primaryColor" style="text-decoration: underline">{{ draft().registerLinkText }}</strong>
                    </div>
                    <div class="hl-zone" [class.hl-on]="isHl('registerPendingTitle')" style="background: var(--warning-bg); color: var(--warning); padding: 6px 8px; border-radius: 6px; font-size: 9.5px">
                      หน้าจอรออนุมัติครู: {{ draft().registerPendingTitle }}
                    </div>
                  </div>
                }
              </div>
              <div class="callout-map">
                @for (ch of [['registerEnabled','เปิด/ปิดรับสมัคร'],['registerTitle','หัวข้อ'],['registerTeacher','การ์ดครู'],['registerAdminNotice','แจ้งเตือน Admin'],['registerPrompt','ปุ่มชวนสมัคร'],['registerPendingTitle','หน้ารออนุมัติ']]; track ch[0]) {
                  <button type="button" class="cmap-chip" [class.active]="focus() === ch[0]" (click)="focus.set(ch[0])">{{ ch[1] }}</button>
                }
              </div>
            }

            @if (tab() === 'dashboard') {
              <div class="mock-browser" style="padding: 12px" [style.background]="draft().darkMode ? '#141115' : draft().bgColor">
                <div class="hl-zone" [class.hl-on]="isHl('cardShadow','density')" [style.box-shadow]="previewShadow()" [style.padding.px]="draft().density === 'compact' ? 10 : draft().density === 'spacious' ? 18 : 14"
                     style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; display: flex; flex-direction: column; gap: 8px">
                  <div style="font-size: 9.5px; font-weight: 700; color: var(--maroon-700)">{{ draft().siteName }}</div>
                  <div class="hl-zone" [class.hl-on]="isHl('heroTitle')" style="font-size: 15px; font-weight: 700">{{ draft().heroTitle }}</div>
                  <div class="hl-zone" [class.hl-on]="isHl('heroSubtitle')" style="font-size: 11px; color: var(--text-muted)">{{ draft().heroSubtitle }}</div>
                  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 4px">
                    <div style="background: var(--maroon-50); padding: 7px; border-radius: 7px; font-size: 10px">กลุ่มเรียน: <strong>14</strong></div>
                    <div style="background: var(--maroon-50); padding: 7px; border-radius: 7px; font-size: 10px">อาจารย์: <strong>22</strong></div>
                    <div style="background: var(--maroon-50); padding: 7px; border-radius: 7px; font-size: 10px">ห้อง/สนาม: <strong>38</strong></div>
                  </div>
                </div>
              </div>
              <div class="callout-map">
                @for (ch of [['heroTitle','หัวข้อ Hero'],['heroSubtitle','ข้อความรอง'],['cardShadow','เงาการ์ด'],['density','ความโปร่ง']]; track ch[0]) {
                  <button type="button" class="cmap-chip" [class.active]="focus() === ch[0]" (click)="focus.set(ch[0])">{{ ch[1] }}</button>
                }
              </div>
            }

            @if (tab() === 'public') {
              <div class="mock-browser">
                <div class="mock-bar"><span class="mb-dot" style="background:#f87171"></span><span class="mb-dot" style="background:#fbbf24"></span><span class="mb-dot" style="background:#34d399"></span><span class="mb-url">/p · ตารางเรียนสาธารณะ</span></div>
                <div class="hl-zone" [class.hl-on]="isHl('pubHero')" [style.background]="publicPreviewHeroBg()"
                     style="position: relative; overflow: hidden; color: #fff; padding: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; background-size: cover; background-position: center">
                  <div class="mini-pat" [class]="draft().public.heroPattern || 'grid'"></div>
                  <div class="row" style="gap: 8px; position: relative; z-index: 1">
                    @if (draft().public.showLogo) {
                      <div class="mini-logo-tile hl-zone" [class]="draft().logoShape" [class.hl-on]="isHl('pubLogo')"><img [src]="draft().logoDataUrl || 'logo.png'" alt="logo" /></div>
                    }
                    <div>
                      <div style="font-weight: 700; font-size: 12px">{{ draft().public.heroTitle }}</div>
                      <div style="font-size: 9px; opacity: 0.85">{{ draft().public.heroSubtitle || draft().siteName }}</div>
                    </div>
                  </div>
                  @if (draft().public.showLoginButton) {
                    <span class="hl-zone" [class.hl-on]="isHl('pubLoginBtn')" style="position: relative; z-index: 1; background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 6px; font-size: 9px">{{ draft().public.loginButtonText }}</span>
                  }
                </div>
                <div style="padding: 10px; display: flex; flex-direction: column; gap: 8px">
                  @if (draft().public.showStats) {
                    <div class="hl-zone" [class.hl-on]="isHl('pubStats')" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px">
                      <div style="background: var(--maroon-50); padding: 5px 7px; border-radius: 6px; font-size: 8.5px; text-align: center">กลุ่มเรียน <strong>14</strong></div>
                      <div style="background: var(--maroon-50); padding: 5px 7px; border-radius: 6px; font-size: 8.5px; text-align: center">อาจารย์ <strong>22</strong></div>
                      <div style="background: var(--maroon-50); padding: 5px 7px; border-radius: 6px; font-size: 8.5px; text-align: center">ห้อง/สนาม <strong>38</strong></div>
                    </div>
                  }
                  @if (draft().public.announcementEnabled) {
                    <div class="alert hl-zone" [class]="draft().public.announcementTone" [class.hl-on]="isHl('pubAnnouncement')" style="padding: 6px 8px; font-size: 9.5px">
                      {{ draft().public.announcementText || 'ข้อความประกาศข่าวสาร' }}
                    </div>
                  }
                  @if (draft().public.carouselEnabled && draft().public.carouselSlides.length > 0) {
                    <div class="hl-zone" [class.hl-on]="isHl('pubCarousel')"
                         [style.border-radius]="carouselPreviewRadius()"
                         [style.height]="carouselPreviewHeight()"
                         [style.background]="carouselPreviewBg()"
                         style="overflow: hidden; position: relative">
                      @if ((draft().public.carouselBgMode || 'blur') === 'blur') {
                        <img [src]="draft().public.carouselSlides[0].imageDataUrl" alt="" aria-hidden="true"
                             style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: blur(14px) brightness(0.75); transform: scale(1.15); pointer-events: none" />
                      }
                      <img [src]="draft().public.carouselSlides[0].imageDataUrl" alt="slide"
                           [style.object-fit]="draft().public.carouselFit || 'cover'"
                           [style.object-position]="draft().public.carouselPosition || 'center'"
                           [style.height]="draft().public.carouselHeight === 'auto' ? 'auto' : '100%'"
                           style="position: relative; z-index: 1; width: 100%; display: block" />
                    </div>
                  }
                  <div class="hl-zone" [class.hl-on]="isHl('pubCards')" [style.grid-template-columns]="'repeat(' + draft().public.cardColumns + ', 1fr)'" style="display: grid; gap: 6px">
                    <div style="background: var(--surface); border: 1px solid var(--border); padding: 7px; border-radius: 6px; font-size: 9px"><strong>ปี 1/1</strong></div>
                    <div style="background: var(--surface); border: 1px solid var(--border); padding: 7px; border-radius: 6px; font-size: 9px"><strong>ปี 1/2</strong></div>
                    <div style="background: var(--surface); border: 1px solid var(--border); padding: 7px; border-radius: 6px; font-size: 9px"><strong>ปี 2/1</strong></div>
                    <div style="background: var(--surface); border: 1px solid var(--border); padding: 7px; border-radius: 6px; font-size: 9px"><strong>ปี 3/1</strong></div>
                  </div>
                  @if (draft().public.showFooter !== false) {
                    <div class="hl-zone" [class.hl-on]="isHl('pubFooter')" style="font-size: 8px; color: var(--text-muted); text-align: center">{{ draft().public.footerNote || draft().footerText }}</div>
                  }
                </div>
              </div>
              <div class="callout-map">
                @for (ch of [['pubHero','Hero'],['pubLogo','โลโก้'],['pubStats','สถิติ'],['pubLoginBtn','ปุ่มล็อกอิน'],['pubAnnouncement','ประกาศ'],['pubCarousel','Carousel'],['pubCards','การ์ด'],['pubFooter','ท้ายหน้า']]; track ch[0]) {
                  <button type="button" class="cmap-chip" [class.active]="focus() === ch[0]" (click)="focus.set(ch[0])">{{ ch[1] }}</button>
                }
              </div>
            }

            @if (tab() === 'colors') {
              <div class="mock-browser">
                <div class="mock-bar"><span class="mb-dot" style="background:#f87171"></span><span class="mb-dot" style="background:#fbbf24"></span><span class="mb-dot" style="background:#34d399"></span><span class="mb-url">ชุดสี · {{ draft().darkMode ? 'Dark Mode' : 'Light Mode' }}</span></div>
                <div class="hl-zone" [class.hl-on]="isHl('bgColor','darkMode')" [style.background]="draft().darkMode ? '#141115' : draft().bgColor" style="padding: 12px; display: flex; flex-direction: column; gap: 10px">
                  <div class="hl-zone" [class.hl-on]="isHl('surfaceColor','textColor')" [style.background]="draft().darkMode ? '#1e1920' : draft().surfaceColor" [style.color]="draft().darkMode ? '#f5eff2' : draft().textColor"
                       style="border: 1px solid var(--border); border-radius: 10px; padding: 12px">
                    <div style="font-weight: 700; font-size: 12px">การ์ดเนื้อหา (Surface &amp; Text)</div>
                    <div style="font-size: 10px; opacity: 0.75; margin: 4px 0 8px">ตัวอย่างการแสดงผลสีพื้นการ์ดและตัวอักษรหลัก</div>
                    <div class="row">
                      <span class="hl-zone" [class.hl-on]="isHl('primaryColor')" [style.background]="draft().primaryColor" style="color: #fff; padding: 4px 10px; border-radius: 7px; font-size: 10.5px; font-weight: 600">ปุ่มสีหลัก Primary</span>
                      <span class="hl-zone" [class.hl-on]="isHl('accentColor')" [style.background]="draft().accentColor" style="color: #fff; padding: 4px 10px; border-radius: 7px; font-size: 10.5px; font-weight: 600">สีรอง Accent</span>
                    </div>
                  </div>
                  <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden">
                    <div [style.background]="draft().primaryColor" style="color: #fff; padding: 6px 10px; font-size: 10.5px; font-weight: 600">หัวตารางเรียน (ใช้สีหลัก Primary)</div>
                    <div [style.background]="draft().darkMode ? '#1e1920' : draft().surfaceColor" [style.color]="draft().darkMode ? '#f5eff2' : draft().textColor" style="padding: 8px 10px; font-size: 10px">มศ 041017 · ภาษาไทยเพื่อการสื่อสารฯ · ห้อง 321</div>
                  </div>
                </div>
              </div>
              <div class="callout-map">
                @for (ch of [['primaryColor','สีหลัก'],['accentColor','สีรอง'],['bgColor','พื้นหลัง'],['surfaceColor','พื้นการ์ด'],['textColor','ตัวอักษร'],['darkMode','Dark Mode']]; track ch[0]) {
                  <button type="button" class="cmap-chip" [class.active]="focus() === ch[0]" (click)="focus.set(ch[0])">{{ ch[1] }}</button>
                }
              </div>
            }

            @if (tab() === 'typography') {
              <div class="mock-browser" style="padding: 14px">
                <div class="hl-zone" [class.hl-on]="isHl('borderRadius','fontFamily','fontSize')" [style.border-radius.px]="draft().borderRadius"
                     style="background: var(--surface); border: 1px solid var(--border); padding: 14px; display: flex; flex-direction: column; gap: 8px">
                  <div [style.font-size.px]="draft().fontSize + 2" style="font-weight: 700">ตัวอย่างแบบอักษร: {{ draft().fontFamily }}</div>
                  <div [style.font-size.px]="draft().fontSize">ระบบจัดตารางเรียนอัตโนมัติ (ขนาด {{ draft().fontSize }}px · มุมโค้ง {{ draft().borderRadius }}px)</div>
                  <div class="row">
                    <span [style.border-radius.px]="Math.round(draft().borderRadius * 0.72)" [style.font-size.px]="draft().fontSize - 1" [style.background]="draft().primaryColor" style="color: #fff; padding: 5px 12px; font-weight: 600">ปุ่มตัวอย่าง</span>
                    <span [style.border-radius.px]="Math.round(draft().borderRadius * 0.72)" [style.font-size.px]="draft().fontSize - 1" style="border: 1px solid var(--border-strong); padding: 5px 10px; color: var(--text-muted)">ช่องกรอกข้อมูล</span>
                  </div>
                </div>
              </div>
              <div class="callout-map">
                @for (ch of [['fontFamily','ฟอนต์'],['fontSize','ขนาดตัวอักษร'],['borderRadius','ความโค้งมน']]; track ch[0]) {
                  <button type="button" class="cmap-chip" [class.active]="focus() === ch[0]" (click)="focus.set(ch[0])">{{ ch[1] }}</button>
                }
              </div>
            }

            @if (tab() === 'pdf') {
              <div class="pdf-paper hl-zone" [class.hl-on]="isHl('pdfMargin')" [style.padding.px]="draft().pdf.margin === 'narrow' ? 8 : draft().pdf.margin === 'wide' ? 18 : 13">
                @if (draft().pdf.watermark) {
                  <div class="pdf-watermark hl-zone" [class.hl-on]="isHl('pdfWatermark')" [style.color]="pdfResolved().headerBg || '#111'">{{ draft().pdf.watermark }}</div>
                }
                <div class="pdf-top">
                  <div class="pdf-head-box hl-zone" [class.hl-on]="isHl('pdfLogo','pdfBorder')" [style.border-color]="pdfResolved().border"
                       [style.width]="draft().pdf.showSubjectTable ? '34%' : '100%'" [style.flex-direction]="draft().pdf.showSubjectTable ? 'column' : 'row'">
                    @if (draft().pdf.showLogo) {
                      <img [src]="effectivePdfLogo()" alt="logo" [style.width.px]="draft().pdf.logoSize === 'sm' ? 18 : draft().pdf.logoSize === 'lg' ? 30 : 24" [style.height.px]="draft().pdf.logoSize === 'sm' ? 18 : draft().pdf.logoSize === 'lg' ? 30 : 24" />
                    }
                    <div>
                      <div style="font-size: 8.5px; font-weight: 700">{{ draft().siteName }}</div>
                      <div style="font-size: 7px">ตารางเรียน ปี 1/1 · ภาคเรียน 2/2569</div>
                    </div>
                  </div>
                  @if (draft().pdf.showSubjectTable) {
                    <table class="pdf-sub-tbl hl-zone" [class.hl-on]="isHl('pdfSubjectTable','pdfBorder')" [style.border-color]="pdfResolved().border">
                      <thead>
                        <tr [style.background]="pdfResolved().headerBg" [style.color]="pdfResolved().headerText">
                          <th [style.border-color]="pdfResolved().border">รหัสวิชา</th>
                          <th [style.border-color]="pdfResolved().border">ชื่อรายวิชา</th>
                          <th [style.border-color]="pdfResolved().border">น.</th><th [style.border-color]="pdfResolved().border">บ.</th><th [style.border-color]="pdfResolved().border">ป.</th><th [style.border-color]="pdfResolved().border">ศ.</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td [style.border-color]="pdfResolved().border">มศ 041017</td>
                          <td [style.border-color]="pdfResolved().border" style="text-align:left">ภาษาไทยเพื่อการสื่อสารฯ</td>
                          <td [style.border-color]="pdfResolved().border">3</td><td [style.border-color]="pdfResolved().border">3</td><td [style.border-color]="pdfResolved().border">0</td><td [style.border-color]="pdfResolved().border">6</td>
                        </tr>
                        <tr [style.background]="pdfResolved().dayBg">
                          <td colspan="2" [style.border-color]="pdfResolved().border" style="text-align:right; font-weight:700">รวม</td>
                          <td [style.border-color]="pdfResolved().border">20</td><td [style.border-color]="pdfResolved().border">19</td><td [style.border-color]="pdfResolved().border">8</td><td [style.border-color]="pdfResolved().border">34</td>
                        </tr>
                      </tbody>
                    </table>
                  }
                </div>

                <table class="pdf-grid hl-zone" [class.hl-on]="isHl('pdfColorMode','pdfFontScale','pdfBorder')"
                       [style.font-size.px]="draft().pdf.fontScale === 'compact' ? 6.5 : draft().pdf.fontScale === 'large' ? 8.5 : 7.5">
                  <thead>
                    <tr class="hl-zone" [class.hl-on]="isHl('pdfHeader')" [style.background]="pdfResolved().headerBg" [style.color]="pdfResolved().headerText">
                      <th [style.border-color]="pdfResolved().border">เวลา</th><th [style.border-color]="pdfResolved().border">08:00</th><th [style.border-color]="pdfResolved().border">09:00</th><th [style.border-color]="pdfResolved().border">12:00</th><th [style.border-color]="pdfResolved().border">13:00</th><th [style.border-color]="pdfResolved().border">14:00</th>
                    </tr>
                    <tr class="hl-zone" [class.hl-on]="isHl('pdfDayBg')" [style.background]="pdfResolved().dayBg">
                      <th [style.border-color]="pdfResolved().border">วัน/คาบ</th><th [style.border-color]="pdfResolved().border">1</th><th [style.border-color]="pdfResolved().border">2</th><th [style.border-color]="pdfResolved().border">5</th><th [style.border-color]="pdfResolved().border">6</th><th [style.border-color]="pdfResolved().border">7</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td [style.background]="pdfResolved().dayBg" [style.border-color]="pdfResolved().border" style="font-weight:700">จันทร์</td>
                      <td colspan="2" [style.border-color]="pdfResolved().border"><strong>มศ 041017</strong><br/>321</td>
                      <td rowspan="2" class="hl-zone" [class.hl-on]="isHl('pdfBreakBg')" [style.background]="pdfResolved().breakBg" [style.border-color]="pdfResolved().border" style="font-weight:700">พัก</td>
                      <td colspan="2" [style.border-color]="pdfResolved().border"><strong>พล 051383</strong><br/>321+ลานเหนือ</td>
                    </tr>
                    <tr>
                      <td [style.background]="pdfResolved().dayBg" [style.border-color]="pdfResolved().border" style="font-weight:700">อังคาร</td>
                      <td colspan="2" [style.border-color]="pdfResolved().border"><strong>กศ 032010</strong><br/>คอมฯ 1</td>
                      <td colspan="2" [style.border-color]="pdfResolved().border"><strong>กศ 071001</strong><br/>ห้องประชุม 1</td>
                    </tr>
                  </tbody>
                </table>

                @if (draft().pdf.showSignatures) {
                  <div class="pdf-sigs hl-zone" [class.hl-on]="isHl('pdfSignatures')">
                    <div>ลงชื่อ ................<br/>อาจารย์ที่ปรึกษา</div>
                    <div>ลงชื่อ ................<br/>หัวหน้างานหลักสูตร</div>
                    <div>ลงชื่อ ................<br/>รองคณบดีวิชาการ</div>
                    <div>ลงชื่อ ................<br/>คณบดี</div>
                  </div>
                }
                <div class="pdf-foot hl-zone" [class.hl-on]="isHl('pdfFooter')">
                  <span>{{ draft().pdf.footerNote }}</span>
                  <span>@if (draft().pdf.showPrintDate) { พิมพ์เมื่อ 26/11/2569 12:00 }</span>
                </div>
              </div>
              <div class="callout-map">
                @for (ch of [['pdfLogo','โลโก้ PDF'],['pdfColorMode','โหมดสี'],['pdfHeader','หัวตาราง'],['pdfDayBg','แถบวัน'],['pdfBreakBg','ช่องพัก'],['pdfSubjectTable','ตารางวิชา'],['pdfSignatures','ช่องลงนาม'],['pdfWatermark','ลายน้ำ'],['pdfFooter','ท้ายกระดาษ']]; track ch[0]) {
                  <button type="button" class="cmap-chip" [class.active]="focus() === ch[0]" (click)="focus.set(ch[0])">{{ ch[1] }}</button>
                }
              </div>
            }
          </div>
        </aside>
      </div>

      @if (auth.isAdmin()) {
        <div class="sticky-bar">
          <span class="small muted">
            {{ dirty() ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก (แสดงตัวอย่างสดอยู่)' : 'การตกแต่งล่าสุดถูกบันทึกแล้ว' }}
          </span>
          <span class="spacer"></span>
          @if (dirty()) {
            <button class="btn sm ghost" type="button" (click)="cancelChanges()">ยกเลิกการแก้</button>
          }
          <button class="btn sm danger" type="button" (click)="resetDefaults()">
            <app-icon name="refresh" [size]="15" /> คืนค่าเริ่มต้น
          </button>
          <button class="btn primary" type="button" [disabled]="saving()" (click)="save()">
            <app-icon name="check" [size]="16" /> {{ saving() ? 'กำลังบันทึก…' : 'บันทึกการตกแต่ง' }}
          </button>
        </div>
      }
    </div>

    <app-pdf-preview [url]="realPdfUrl()" (closed)="realPdfUrl.set(null)" />
  `,
  styles: `
    .zone-tabs { display: flex; flex-wrap: nowrap; gap: 4px; overflow-x: auto; scrollbar-width: none; background: var(--surface); padding: 6px; border: 1px solid var(--border); border-radius: var(--radius-lg); }
    .zone-tabs::-webkit-scrollbar { display: none; }
    .zone-tab { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 11px; flex: 1 0 auto; white-space: nowrap; border-radius: var(--radius); border: 0; background: transparent; color: var(--text-muted); font: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; }
    .zone-tab:hover { background: var(--maroon-50); color: var(--maroon-700); }
    .zone-tab.active { background: var(--maroon-700); color: #fff; font-weight: 600; }

    .studio { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(370px, 0.95fr); gap: 18px; align-items: start; }
    .left-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .left-col .card-body { display: flex; flex-direction: column; gap: 16px; padding: 20px; }
    .left-col .grid-2 { gap: 16px; align-items: start; }
    @media (max-width: 1120px) { .studio { grid-template-columns: 1fr; } }
    .preview-sticky { position: sticky; top: calc(var(--header-h) + 14px); }

    .presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 8px; }
    .preset-btn { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; font: inherit; font-size: 12.5px; text-align: left; }
    .preset-btn:hover { border-color: var(--maroon-700); transform: translateY(-1px); }
    .dot-swatch { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; border: 2px solid rgba(0,0,0,0.12); }
    .color-row { display: flex; align-items: center; gap: 8px; }
    .color-row input[type='color'] { width: 40px; height: 36px; padding: 2px; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--surface); cursor: pointer; }

    .preview-logo { width: 68px; height: 68px; background: var(--maroon-50); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
    .preview-logo img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
    .preview-logo.rounded { border-radius: 16px; }
    .preview-logo.circle { border-radius: 50%; }
    .preview-logo.square { border-radius: 4px; }

    .toggle-box { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 13px; border-radius: var(--radius); border: 1.5px solid var(--border); background: var(--surface); cursor: pointer; }
    .toggle-box:hover { border-color: var(--maroon-600); }
    .toggle-box.on { border-color: var(--maroon-200); background: var(--maroon-50); }
    .toggle-box-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .toggle-box-title { font-size: 13.5px; font-weight: 600; color: var(--text); }
    .toggle-box-sub { font-size: 12px; color: var(--text-muted); }
    .toggle-box-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .toggle-state { font-size: 11.5px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--border); color: var(--text-muted); }
    .toggle-box.on .toggle-state { background: var(--maroon-700); color: #fff; }

    .sticky-bar { position: sticky; bottom: 14px; z-index: 300; margin-right: 76px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius-lg); box-shadow: var(--shadow); padding: 12px 18px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    @media (max-width: 640px) { .sticky-bar { margin-right: 0; margin-bottom: 74px; } }

    .hl-zone { position: relative; transition: box-shadow 0.18s var(--ease); }
    .hl-zone.hl-on { box-shadow: 0 0 0 2.5px #f59e0b, 0 0 0 5px rgba(245, 158, 11, 0.28) !important; z-index: 5; }
    .hl-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; }

    .mock-browser { border: 1px solid var(--border-strong); border-radius: 12px; overflow: hidden; background: var(--bg); box-shadow: var(--shadow-sm); }
    .mock-bar { display: flex; align-items: center; gap: 6px; padding: 7px 10px; background: rgba(0,0,0,0.05); border-bottom: 1px solid var(--border); font-size: 11px; color: var(--text-muted); }
    .mb-dot { width: 8px; height: 8px; border-radius: 50%; }
    .mb-url { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 2px 10px; font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .mini-shell { display: flex; min-height: 245px; font-size: 10.5px; }
    .mini-side { padding: 10px 8px; color: #fff; display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
    .mini-side.light { color: var(--text); border-right: 1px solid var(--border); }
    .mini-brand { display: flex; align-items: center; gap: 6px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.18); }
    .mini-side.light .mini-brand { border-bottom-color: var(--border); }
    .mini-logo-tile { width: 26px; height: 26px; background: #fff; color: var(--maroon-700); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
    .mini-logo-tile img { width: 100%; height: 100%; object-fit: contain; padding: 2px; }
    .mini-logo-tile.rounded { border-radius: 7px; }
    .mini-logo-tile.circle { border-radius: 50%; }
    .mini-logo-tile.square { border-radius: 2px; }
    .mini-nav-it { padding: 4px 6px; border-radius: 5px; opacity: 0.85; font-size: 10px; }
    .mini-nav-it.active { background: #fff; color: var(--maroon-700); opacity: 1; font-weight: 700; }
    .mini-side.light .mini-nav-it.active { background: var(--maroon-700); color: #fff; }
    .mini-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .mini-top { padding: 8px 10px; border-bottom: 1px solid var(--border); font-weight: 600; font-size: 10.5px; display: flex; justify-content: space-between; align-items: center; }
    .mini-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; flex: 1; }

    .mini-login { display: grid; grid-template-columns: 1.18fr 1fr; min-height: 295px; }
    .mini-login-l { position: relative; padding: 14px 12px; color: #fff; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; background-size: cover; background-position: center; overflow: hidden; }
    .mini-pat { position: absolute; inset: 0; pointer-events: none; opacity: 0.22; }
    .mini-pat.grid { background-image: linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px); background-size: 16px 16px; }
    .mini-pat.dots { background-image: radial-gradient(rgba(255,255,255,.55) 1.2px, transparent 1.2px); background-size: 12px 12px; }
    .mini-pat.waves { background-image: repeating-linear-gradient(-45deg, rgba(255,255,255,.25) 0 4px, transparent 4px 12px); }
    .mini-login-r { padding: 12px 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: var(--bg); }
    .mini-login-card { width: 100%; background: var(--surface); border: 1px solid var(--border); border-top: 3px solid var(--maroon-700); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
    .mini-chip { display: inline-block; padding: 2px 6px; border-radius: 5px; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.24); font-size: 7.5px; }

    .pdf-paper { background: #fff; color: #111; border: 1px solid #d1c7ca; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); aspect-ratio: 297 / 210; position: relative; overflow: hidden; display: flex; flex-direction: column; font-family: 'Sarabun', 'IBM Plex Sans Thai', sans-serif; }
    .pdf-watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; transform: rotate(-24deg); font-size: 32px; font-weight: 800; opacity: 0.11; letter-spacing: 2px; white-space: nowrap; }
    .pdf-top { display: flex; }
    .pdf-head-box { border: 1px solid; padding: 5px; display: flex; align-items: center; justify-content: center; text-align: center; gap: 4px; }
    .pdf-sub-tbl { flex: 1; border-collapse: collapse; font-size: 7.5px; }
    .pdf-sub-tbl th, .pdf-sub-tbl td { border: 1px solid; padding: 1.5px 3px; text-align: center; }
    .pdf-grid { width: 100%; border-collapse: collapse; margin-top: 5px; flex: 1; }
    .pdf-grid th, .pdf-grid td { border: 1px solid; text-align: center; padding: 2px; }
    .pdf-sigs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 6px; text-align: center; font-size: 7px; }
    .pdf-foot { display: flex; justify-content: space-between; font-size: 6.5px; color: #555; margin-top: 3px; }

    .callout-map { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
    .cmap-chip { font-size: 11px; padding: 3px 8px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; }
    .cmap-chip.active { background: #fef3c7; color: #92400e; border-color: #f59e0b; font-weight: 600; }
  `,
})
export class AppearancePage implements OnInit, OnDestroy {
  private api = inject(Api);
  private theme = inject(ThemeService);
  private state = inject(AppState);
  auth = inject(AuthService);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);

  Math = Math;
  tabs = TABS;
  presets = PRESETS;

  tab = signal<TabKey>('shell');
  focus = signal('');
  draft = signal<Appearance>(structuredClone(DEFAULT_APPEARANCE));
  syncCollege = signal(true);
  dirty = signal(false);
  saving = signal(false);
  realPdfUrl = signal<string | null>(null);

  tabTitle = computed(() => TABS.find((t) => t.key === this.tab())?.previewTitle || '');
  focusLabel = computed(() => FOCUS_LABELS[this.focus()] || '');

  async ngOnInit() {
    try {
      const res = await this.api.getPublicAppearance();
      const merged = this.theme.merge(res.appearance || {});
      this.draft.set(structuredClone(merged));
    } catch {
      this.draft.set(structuredClone(this.theme.appearance()));
    }
  }

  ngOnDestroy() {
    if (this.dirty()) {
      this.theme.apply(this.theme.appearance());
    }
  }

  setTab(t: TabKey) {
    this.tab.set(t);
    this.focus.set('');
  }

  isHl(...keys: string[]) {
    return keys.includes(this.focus());
  }

  patch(part: Partial<Appearance>) {
    const next = { ...this.draft(), ...part };
    this.draft.set(next);
    this.dirty.set(true);
    this.theme.apply(next);
  }

  patchPdf(part: Partial<PdfAppearance>) {
    const cur = this.draft();
    this.draft.set({ ...cur, pdf: { ...cur.pdf, ...part } });
    this.dirty.set(true);
  }

  patchPublic(part: Partial<PublicAppearance>) {
    const cur = this.draft();
    this.draft.set({ ...cur, public: { ...cur.public, ...part } });
    this.dirty.set(true);
  }

  applyPreset(p: (typeof PRESETS)[number]) {
    this.patch({
      primaryColor: p.primary,
      accentColor: p.accent,
      bgColor: p.bg,
      surfaceColor: p.surface,
      textColor: p.text,
      darkMode: p.darkMode,
      sidebarStyle: p.sidebarStyle,
    });
  }

  miniSidebarBg() {
    const d = this.draft();
    if (d.sidebarStyle === 'light') return d.darkMode ? '#1e1920' : d.surfaceColor;
    if (d.sidebarStyle === 'dark') return 'linear-gradient(180deg, #1b1920 0%, #0f0d12 100%)';
    if (d.sidebarStyle === 'solid') return d.primaryColor;
    return `linear-gradient(180deg, ${d.primaryColor} 0%, #2a000b 100%)`;
  }

  loginPreviewBg() {
    const d = this.draft();
    if (d.loginBgDataUrl) return `linear-gradient(180deg, rgba(30,0,10,0.45), rgba(30,0,10,0.75)), url(${d.loginBgDataUrl})`;
    return `linear-gradient(145deg, ${d.primaryColor} 0%, ${d.accentColor} 55%, #2a000b 100%)`;
  }

  publicPreviewHeroBg() {
    const d = this.draft();
    if (d.public.heroStyle === 'image' && d.public.heroBgDataUrl) {
      return `linear-gradient(180deg, rgba(20,0,8,0.48), rgba(20,0,8,0.72)), url(${d.public.heroBgDataUrl})`;
    }
    if (d.public.heroStyle === 'solid') return d.primaryColor;
    return `linear-gradient(135deg, ${d.primaryColor}, #2a000b)`;
  }

  carouselPreviewHeight() {
    const h = this.draft().public.carouselHeight || 'md';
    if (h === 'sm') return '64px';
    if (h === 'lg') return '118px';
    if (h === 'xl') return '150px';
    if (h === 'auto') return 'auto';
    return '90px';
  }

  carouselPreviewRadius() {
    const r = this.draft().public.carouselRadius || 'md';
    if (r === 'none') return '0px';
    if (r === 'sm') return '5px';
    if (r === 'lg') return '16px';
    return '10px';
  }

  carouselPreviewBg() {
    const d = this.draft();
    const m = d.public.carouselBgMode || 'blur';
    if (m === 'gradient') return `linear-gradient(135deg, ${d.primaryColor}, #1e0008)`;
    if (m === 'dark') return '#141418';
    if (m === 'solid') return d.public.carouselBgColor || '#1a1a2e';
    return '#141418';
  }

  previewShadow() {
    const map: Record<string, string> = {
      none: 'none',
      sm: '0 1px 3px rgba(20,10,14,0.08)',
      md: '0 6px 20px rgba(20,10,14,0.14)',
      lg: '0 14px 36px rgba(20,10,14,0.22)',
    };
    return map[this.draft().cardShadow] || map['sm'];
  }

  effectivePdfLogo() {
    const d = this.draft();
    return d.pdf.logoDataUrl || d.logoDataUrl || 'logo.png';
  }

  pdfResolved() {
    const d = this.draft();
    if (d.pdf.colorMode === 'bw') return { headerBg: '', headerText: '#111111', dayBg: '', breakBg: '#f4f4f4', border: '#111111' };
    if (d.pdf.colorMode === 'theme') return { headerBg: d.primaryColor || '#800020', headerText: '#ffffff', dayBg: '#fcf4f5', breakBg: '#f3ecee', border: '#3a2a2f' };
    return { headerBg: d.pdf.headerBg, headerText: d.pdf.headerText, dayBg: d.pdf.dayBg, breakBg: d.pdf.breakBg, border: d.pdf.borderColor };
  }

  private rasterizeDataUrl(dataUrl: string, maxW: number, maxH: number, mime: 'image/png' | 'image/jpeg', quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width, maxH / img.height);
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d')!;
        if (mime === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL(mime, quality));
      };
      img.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ภาพได้'));
      img.src = dataUrl;
    });
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
      r.readAsDataURL(file);
    });
  }

  async onLogoFile(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const raw = await this.readFile(f);
      const png = await this.rasterizeDataUrl(raw, 512, 512, 'image/png', 0.95);
      const webVal = f.type === 'image/svg+xml' ? raw : png;
      this.patch({ logoDataUrl: webVal });
      this.patchPdf({ logoDataUrl: png });
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  clearWebLogo() {
    this.patch({ logoDataUrl: '' });
    this.patchPdf({ logoDataUrl: '' });
  }

  async onPdfLogoFile(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const raw = await this.readFile(f);
      const png = await this.rasterizeDataUrl(raw, 512, 512, 'image/png', 0.95);
      this.patchPdf({ logoDataUrl: png });
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async syncWebLogoToPdf() {
    const web = this.draft().logoDataUrl;
    if (!web) return;
    const png = /^data:image\/(png|jpeg);base64,/.test(web) ? web : await this.rasterizeDataUrl(web, 512, 512, 'image/png', 0.95);
    this.patchPdf({ logoDataUrl: png });
    this.toasts.info('ดึงโลโก้จากเว็บมาใส่ PDF แล้ว');
  }

  async onBgFile(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const raw = await this.readFile(f);
      const jpg = await this.rasterizeDataUrl(raw, 1280, 900, 'image/jpeg', 0.82);
      this.patch({ loginBgDataUrl: jpg });
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async onPublicBgFile(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const raw = await this.readFile(f);
      const jpg = await this.rasterizeDataUrl(raw, 1440, 640, 'image/jpeg', 0.84);
      this.patchPublic({ heroBgDataUrl: jpg });
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async onCarouselFiles(ev: Event) {
    const files = Array.from((ev.target as HTMLInputElement).files || []);
    const slides = [...this.draft().public.carouselSlides];
    for (const f of files) {
      if (slides.length >= 8) break;
      const raw = await this.readFile(f);
      const jpg = await this.rasterizeDataUrl(raw, 1600, 1200, 'image/jpeg', 0.85);
      slides.push({ id: `${Date.now()}-${Math.random()}`, imageDataUrl: jpg, title: '', caption: '' });
    }
    this.patchPublic({ carouselSlides: slides });
  }

  updateSlide(idx: number, part: Partial<PublicCarouselSlide>) {
    const slides = this.draft().public.carouselSlides.map((s, i) => (i === idx ? { ...s, ...part } : s));
    this.patchPublic({ carouselSlides: slides });
  }

  removeSlide(idx: number) {
    const slides = this.draft().public.carouselSlides.filter((_, i) => i !== idx);
    this.patchPublic({ carouselSlides: slides });
  }

  cancelChanges() {
    const saved = structuredClone(this.theme.appearance());
    this.draft.set(saved);
    this.dirty.set(false);
    this.theme.apply(saved);
    this.toasts.info('ยกเลิกการเปลี่ยนแปลงแล้ว');
  }

  async save() {
    this.saving.set(true);
    try {
      const d = structuredClone(this.draft());
      if (d.logoDataUrl && !/^data:image\/(png|jpeg);base64,/.test(d.logoDataUrl) && !d.pdf.logoDataUrl) {
        d.pdf.logoDataUrl = await this.rasterizeDataUrl(d.logoDataUrl, 512, 512, 'image/png', 0.95);
      }
      const res = await this.api.saveAppearance({ appearance: d, syncCollege: this.syncCollege() });
      this.theme.setSaved(res.appearance);
      this.draft.set(structuredClone(this.theme.appearance()));
      this.dirty.set(false);
      this.toasts.success('บันทึกการตกแต่งเรียบร้อยแล้ว');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  async resetDefaults() {
    const ok = await this.confirm.ask({ title: 'คืนค่าการตกแต่งเริ่มต้น', message: 'รีเซ็ตสี ข้อความ และรูปแบบทั้งหมดกลับเป็นค่าเริ่มต้น?', danger: true });
    if (!ok) return;
    try {
      const res = await this.api.resetAppearance();
      this.theme.setSaved(res.appearance);
      this.draft.set(structuredClone(this.theme.appearance()));
      this.dirty.set(false);
      this.toasts.info('คืนค่าเริ่มต้นแล้ว');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async openRealPdf() {
    if (!this.state.hasTimetable()) {
      this.toasts.info('ยังไม่มีตารางเรียนในระบบ กรุณาจัดตารางก่อนจึงจะดูตัวอย่าง PDF จริงได้');
      return;
    }
    if (this.dirty() && this.auth.isAdmin()) await this.save();
    this.realPdfUrl.set(this.api.exportUrl('pdf', 'group', undefined, true) + '&_t=' + Date.now());
  }
}
