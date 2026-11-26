import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppState } from '../../core/state';

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">Validator อิสระจาก solver</div>
          <h1>ผลตรวจเงื่อนไข</h1>
          <p>ตรวจสอบตารางเรียนล่าสุดครบทั้ง Integrity (I0), เงื่อนไขพื้นฐาน (C1–C7) และเงื่อนไขพิเศษ (C8–C13)</p>
        </div>
        <div class="segmented">
          <button type="button" [class.active]="filter() === 'all'" (click)="filter.set('all')">ทั้งหมด</button>
          <button type="button" [class.active]="filter() === 'failed'" (click)="filter.set('failed')">เฉพาะที่ไม่ผ่าน</button>
        </div>
      </div>

      @if (val(); as v) {
        <div class="grid-4">
          <div class="card stat"><small>ผ่าน</small><strong style="color: var(--success)">{{ counts().passed }}</strong></div>
          <div class="card stat"><small>ไม่ผ่าน</small><strong style="color: var(--danger)">{{ counts().failed }}</strong></div>
          <div class="card stat"><small>ไม่ได้เปิดใช้</small><strong class="muted">{{ counts().disabled }}</strong></div>
          <div class="card stat"><small>แถว output</small><strong>{{ v.stats.rows }}</strong></div>
        </div>

        @for (grp of groups(); track grp.type) {
          <div class="card">
            <div class="card-head"><h3>{{ grp.title }}</h3></div>
            <div class="card-body" style="display: flex; flex-direction: column; gap: 8px">
              @for (ch of grp.items; track ch.id) {
                <details class="chk" [open]="!ch.passed">
                  <summary>
                    <span class="mono" style="width: 36px; font-weight: 700">{{ ch.id }}</span>
                    <span style="flex: 1">{{ ch.name }}</span>
                    @if (!ch.enabled) {
                      <span class="badge neutral">ปิดใช้งาน</span>
                    } @else if (ch.passed) {
                      <span class="badge success">ผ่าน</span>
                    } @else {
                      <span class="badge danger">ไม่ผ่าน ({{ ch.violationCount }})</span>
                    }
                  </summary>
                  @if (ch.violations.length > 0) {
                    <ul class="v-list">
                      @for (m of ch.violations; track $index) { <li>{{ m }}</li> }
                    </ul>
                    @if (ch.violationCount > ch.violations.length) {
                      <div class="small muted" style="padding: 4px 12px">และอีก {{ ch.violationCount - ch.violations.length }} รายการ</div>
                    }
                  }
                </details>
              }
            </div>
          </div>
        }
      } @else {
        <div class="card"><div class="empty">ยังไม่มีตารางเรียนให้ตรวจสอบ <a routerLink="/solve" class="btn primary">ไปจัดตาราง</a></div></div>
      }
    </div>
  `,
  styles: `
    .stat { padding: 14px 18px; display: flex; flex-direction: column; }
    .stat small { color: var(--text-muted); font-size: 12.5px; }
    .stat strong { font-size: 26px; }
    .chk { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .chk summary {
      padding: 10px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer;
      list-style: none; font-size: 13.5px;
    }
    .chk summary:hover { background: var(--maroon-50); }
    .v-list { margin: 0; padding: 8px 18px 12px 34px; border-top: 1px solid var(--border); background: var(--danger-bg); color: var(--danger); font-size: 13px; }
  `,
})
export class ReportPage {
  state = inject(AppState);
  filter = signal<'all' | 'failed'>('all');

  val = computed(() => this.state.timetable()?.validation || null);
  counts = computed(() => {
    const list = this.val()?.checks || [];
    return {
      passed: list.filter((c) => c.enabled && c.passed).length,
      failed: list.filter((c) => c.enabled && !c.passed).length,
      disabled: list.filter((c) => !c.enabled).length,
    };
  });

  groups = computed(() => {
    const list = this.val()?.checks || [];
    const filtered = this.filter() === 'failed' ? list.filter((c) => c.enabled && !c.passed) : list;
    return [
      { type: 'integrity', title: 'โครงสร้างข้อมูล (Integrity)', items: filtered.filter((c) => c.type === 'integrity') },
      { type: 'basic', title: 'เงื่อนไขพื้นฐาน (C1–C7)', items: filtered.filter((c) => c.type === 'basic') },
      { type: 'special', title: 'เงื่อนไขพิเศษ (C8–C13)', items: filtered.filter((c) => c.type === 'special') },
    ].filter((g) => g.items.length > 0);
  });
}
