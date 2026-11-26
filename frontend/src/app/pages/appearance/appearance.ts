import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { AuthService } from '../../core/auth';
import { ThemeService } from '../../core/theme';
import { Toasts } from '../../core/toast';
import { Confirm } from '../../core/confirm';

const PRESETS = [
  { name: 'แดงเลือดหมู (ค่าเริ่มต้น)', primary: '#800020', accent: '#9b1b30' },
  { name: 'น้ำเงินกีฬา', primary: '#1e3a8a', accent: '#2563eb' },
  { name: 'เขียวมรกต', primary: '#065f46', accent: '#059669' },
  { name: 'ม่วงราชภัฏ', primary: '#5b21b6', accent: '#7c3aed' },
];

@Component({
  selector: 'app-appearance',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" style="padding-bottom: 84px">
      <div class="page-head">
        <div>
          <div class="eyebrow">ตกแต่งหน้าเว็บและเอกสาร</div>
          <h1>ตกแต่งหน้าเว็บ</h1>
          <p>ปรับแต่งชื่อคณะ สีธีม แถบเมนู หน้าเข้าสู่ระบบ หน้าสาธารณะ และรูปแบบเอกสาร PDF แบบเรียลไทม์</p>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-head"><h3>แถบเมนูและแบรนด์</h3></div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 12px">
            <div class="field"><label>ชื่อสถาบัน (siteName)</label><input class="input" [(ngModel)]="draft['siteName']" (ngModelChange)="preview()" /></div>
            <div class="field"><label>คำบรรยายรอง</label><input class="input" [(ngModel)]="draft['siteSubtitle']" (ngModelChange)="preview()" /></div>
            <div class="field"><label>ชื่อแถบด้านบน</label><input class="input" [(ngModel)]="draft['topBarTitle']" (ngModelChange)="preview()" /></div>
            <div class="field">
              <label>สไตล์แถบเมนูซ้าย</label>
              <select class="input" [(ngModel)]="draft['sidebarStyle']" (ngModelChange)="preview()">
                <option value="gradient">ไล่สีเข้ม (Gradient)</option>
                <option value="solid">สีทึบ (Solid)</option>
                <option value="dark">โหมดมืด (Dark)</option>
                <option value="light">พื้นขาว (Light)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>สีและธีม</h3></div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 12px">
            <div class="row">
              @for (p of presets; track p.name) {
                <button type="button" class="btn sm" (click)="applyPreset(p)">
                  <span class="swatch" [style.background]="p.primary"></span> {{ p.name }}
                </button>
              }
            </div>
            <div class="grid-2">
              <div class="field"><label>สีหลัก (Primary)</label><input class="input" type="color" [(ngModel)]="draft['primaryColor']" (ngModelChange)="preview()" /></div>
              <div class="field"><label>สีรอง (Accent)</label><input class="input" type="color" [(ngModel)]="draft['accentColor']" (ngModelChange)="preview()" /></div>
            </div>
            <label class="row" style="justify-content: space-between">
              <span>โหมดมืด (Dark Mode)</span>
              <span class="switch"><input type="checkbox" [(ngModel)]="draft['darkMode']" (ngModelChange)="preview()" /><span></span></span>
            </label>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>เอกสาร PDF</h3></div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 12px">
            <div class="field">
              <label>โหมดสี PDF</label>
              <select class="input" [(ngModel)]="draft['pdf']['colorMode']">
                <option value="bw">ขาว-ดำ ทางการ (B&amp;W)</option>
                <option value="theme">สีตามธีม</option>
              </select>
            </div>
            <div class="field"><label>ลายน้ำ (Watermark)</label><input class="input" [(ngModel)]="draft['pdf']['watermark']" placeholder="เช่น ร่างตารางเรียน" /></div>
            <div class="field"><label>หมายเหตุท้ายกระดาษ</label><input class="input" [(ngModel)]="draft['pdf']['footerNote']" /></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>หน้าสาธารณะ (/p)</h3></div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 12px">
            <div class="field"><label>หัวข้อ Hero</label><input class="input" [(ngModel)]="draft['public']['heroTitle']" /></div>
            <div class="field"><label>คำบรรยาย Hero</label><input class="input" [(ngModel)]="draft['public']['heroSubtitle']" /></div>
            <label class="row" style="justify-content: space-between">
              <span>แสดงประกาศด้านบน</span>
              <span class="switch"><input type="checkbox" [(ngModel)]="draft['public']['announcementEnabled']" /><span></span></span>
            </label>
            @if (draft['public']['announcementEnabled']) {
              <div class="field"><label>ข้อความประกาศ</label><input class="input" [(ngModel)]="draft['public']['announcementText']" /></div>
            }
          </div>
        </div>
      </div>

      @if (auth.isAdmin()) {
        <div class="sticky-bar">
          <span class="small muted">กำลังแสดงตัวอย่างแบบเรียลไทม์</span>
          <div class="row">
            <button class="btn sm" type="button" (click)="resetDefaults()">คืนค่าเริ่มต้น</button>
            <button class="btn primary" type="button" (click)="save()">บันทึกการตกแต่ง</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .swatch { width: 14px; height: 14px; border-radius: 50%; display: inline-block; }
    .sticky-bar {
      position: fixed; bottom: 16px; left: calc(var(--sidebar-w) + 24px); right: 98px;
      background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px;
      padding: 12px 18px; box-shadow: var(--shadow-lg); display: flex; align-items: center;
      justify-content: space-between; gap: 12px; z-index: 90;
    }
    @media (max-width: 960px) { .sticky-bar { left: 16px; right: 16px; bottom: 90px; } }
  `,
})
export class AppearancePage implements OnInit {
  private api = inject(Api);
  auth = inject(AuthService);
  private theme = inject(ThemeService);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);

  presets = PRESETS;
  draft: Record<string, any> = { pdf: {}, public: {} };

  async ngOnInit() {
    const res = await this.api.getPublicAppearance();
    this.draft = structuredClone(res.appearance || {});
    this.draft['pdf'] = this.draft['pdf'] || {};
    this.draft['public'] = this.draft['public'] || {};
  }

  preview() {
    this.theme.apply(structuredClone(this.draft));
  }

  applyPreset(p: { primary: string; accent: string }) {
    this.draft['primaryColor'] = p.primary;
    this.draft['accentColor'] = p.accent;
    this.preview();
  }

  async save() {
    try {
      const res = await this.api.saveAppearance({ appearance: this.draft });
      this.theme.apply(res.appearance);
      this.toasts.success('บันทึกการตกแต่งแล้ว');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async resetDefaults() {
    const ok = await this.confirm.ask({ title: 'คืนค่าการตกแต่งเริ่มต้น', message: 'ต้องการรีเซ็ตสีและรูปแบบกลับเป็นค่าเริ่มต้นใช่หรือไม่?' });
    if (!ok) return;
    const res = await this.api.resetAppearance();
    this.draft = structuredClone(res.appearance);
    this.theme.apply(res.appearance);
    this.toasts.info('คืนค่าเริ่มต้นแล้ว');
  }
}
