import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppState } from '../../core/state';
import { AuthService } from '../../core/auth';
import { Api } from '../../core/api';
import { Toasts } from '../../core/toast';
import { Confirm } from '../../core/confirm';
import { IconComponent } from '../../shared/icon';

const ENTITY_TABS = [
  { key: 'teacher', label: 'อาจารย์ผู้สอน', icon: 'user' },
  { key: 'room', label: 'ห้องและสนาม', icon: 'door' },
  { key: 'student_group', label: 'กลุ่มนักศึกษา', icon: 'users' },
  { key: 'subject', label: 'รายวิชา', icon: 'book' },
  { key: 'teach', label: 'การสอน', icon: 'layers' },
  { key: 'timeslot', label: 'คาบเรียน', icon: 'clock' },
  { key: 'register', label: 'การลงทะเบียน', icon: 'sheet' },
];

const FIELD_LABELS: Record<string, string> = {
  teacher_id: 'รหัสอาจารย์',
  teacher_name: 'ชื่ออาจารย์',
  role: 'ตำแหน่ง',
  room_id: 'รหัสห้อง/สนาม',
  room_name: 'ชื่อสถานที่',
  room_type: 'ประเภท',
  capacity: 'ความจุ',
  sport_tag: 'ชนิดกีฬา',
  group_id: 'รหัสกลุ่ม',
  group_name: 'ชื่อกลุ่ม',
  student_count: 'จำนวน นศ.',
  advisor: 'อาจารย์ที่ปรึกษา',
  year: 'ชั้นปี',
  home_room: 'ห้องประจำ',
  subject_id: 'รหัสวิชา',
  subject_name: 'ชื่อรายวิชา',
  theory: 'บรรยาย',
  practice: 'ปฏิบัติ',
  credit: 'หน่วยกิต',
  group_type: 'กลุ่มวิชา',
  credit_raw: 'หน่วยกิต (ดิบ)',
  special_mode: 'โหมดพิเศษ',
  elective_set: 'ชุดวิชาเลือก',
  timeslot_id: 'รหัสคาบ',
  day: 'วัน',
  period: 'คาบที่',
  start: 'เริ่ม',
  end: 'สิ้นสุด',
};

@Component({
  selector: 'app-data',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">ข้อมูลตั้งต้น 7 ตาราง (จากชุดข้อมูลชั้นปีที่ 1–4)</div>
          <h1>จัดการข้อมูล</h1>
          <p>นำเข้าไฟล์ CSV/XLSX หรือแก้ไขข้อมูลอาจารย์ ห้อง/สนาม กลุ่มนักศึกษา และรายวิชาได้โดยตรง</p>
        </div>
        @if (auth.isAdmin()) {
          <button class="btn danger" type="button" (click)="resetAll()">
            <app-icon name="refresh" [size]="16" /> คืนค่าข้อมูลต้นฉบับ
          </button>
        }
      </div>

      @if (auth.isAdmin()) {
        <div class="dropzone" [class.over]="dragOver()"
             (dragover)="$event.preventDefault(); dragOver.set(true)"
             (dragleave)="dragOver.set(false)"
             (drop)="onDrop($event)"
             (click)="fileInput.click()">
          <input #fileInput type="file" multiple accept=".csv,.xlsx,.xls" hidden (change)="onPick($event)" />
          <app-icon name="upload" [size]="28" />
          <strong>ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</strong>
          <span class="small muted">รองรับไฟล์ .csv / .xlsx (ทั้งไฟล์ชั้นปีที่ 1–4 และ 7 ไฟล์ตารางมาตรฐาน)</span>
        </div>
      }

      <div class="card">
        <div class="tabs">
          @for (t of tabs; track t.key) {
            <button type="button" [class.active]="activeTab() === t.key" (click)="activeTab.set(t.key); search = ''">
              <app-icon [name]="t.icon" [size]="15" />
              <span>{{ t.label }}</span>
              <span class="tab-cnt">{{ countOf(t.key) }}</span>
            </button>
          }
        </div>

        <div class="card-head">
          <div class="row" style="flex: 1">
            <input class="input" style="max-width: 300px" [(ngModel)]="search" placeholder="ค้นหาในตารางนี้…" />
            <span class="small muted">แสดง {{ filteredRows().length }} จาก {{ totalRows() }} แถว</span>
          </div>
          @if (auth.isAdmin()) {
            <div class="row">
              @if (activeTab() === 'student_group') {
                <button class="btn sm" type="button" (click)="autoAssignAdvisors()">
                  <app-icon name="sparkles" [size]="15" /> จัดสรรครูที่ปรึกษาอัตโนมัติ
                </button>
              }
              <button class="btn primary sm" type="button" (click)="openDialog(null)">
                <app-icon name="plus" [size]="15" /> เพิ่มข้อมูล
              </button>
            </div>
          }
        </div>

        <div class="table-wrap" style="max-height: 540px">
          <table class="table">
            <thead>
              <tr>
                @for (f of activeFields(); track f) {
                  <th>
                    <div>{{ fieldLabel(f) }}</div>
                    <div class="mono small muted" style="font-weight: 400">{{ f }}</div>
                  </th>
                }
                @if (auth.isAdmin()) { <th style="width: 96px">จัดการ</th> }
              </tr>
            </thead>
            <tbody>
              @for (row of filteredRows(); track $index) {
                <tr>
                  @for (f of activeFields(); track f) {
                    <td [class.mono]="isKey(f)">
                      @if (f === 'role') {
                        <span class="badge" [class.warning]="row[f] === 'Leader'" [class.neutral]="row[f] !== 'Leader'">
                          {{ row[f] === 'Leader' ? 'ผู้บริหาร' : 'อาจารย์' }}
                        </span>
                      } @else {
                        {{ row[f] }}
                      }
                    </td>
                  }
                  @if (auth.isAdmin()) {
                    <td>
                      <div class="row" style="gap: 4px; flex-wrap: nowrap">
                        <button class="btn icon ghost sm" type="button" (click)="openDialog(row)"><app-icon name="pencil" [size]="15" /></button>
                        <button class="btn icon ghost sm" style="color: var(--danger)" type="button" (click)="removeRow(row)"><app-icon name="trash" [size]="15" /></button>
                      </div>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (dialogOpen()) {
      <div class="scrim" (click)="dialogOpen.set(false)">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-head">
            <h3>{{ editingKey() ? 'แก้ไขข้อมูล' : 'เพิ่มข้อมูลใหม่' }} ({{ activeTab() }})</h3>
            <button class="btn icon ghost" type="button" (click)="dialogOpen.set(false)"><app-icon name="x" [size]="18" /></button>
          </div>
          <div class="dialog-body">
            @for (f of activeFields(); track f) {
              <div class="field">
                <label>{{ fieldLabel(f) }} <span class="mono muted small">({{ f }})</span></label>
                @if (activeTab() === 'student_group' && f === 'advisor') {
                  <select class="input" [(ngModel)]="formRow[f]">
                    <option value="">— ยังไม่กำหนด —</option>
                    @for (t of teachersList(); track t['teacher_id']) {
                      <option [value]="t['teacher_name']">{{ t['teacher_id'] }} {{ t['teacher_name'] }}</option>
                    }
                  </select>
                } @else {
                  <input class="input" [type]="isInt(f) ? 'number' : 'text'" [(ngModel)]="formRow[f]" />
                }
              </div>
            }
          </div>
          <div class="dialog-foot">
            <button class="btn" type="button" (click)="dialogOpen.set(false)">ยกเลิก</button>
            <button class="btn primary" type="button" (click)="saveRow()">บันทึก</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .dropzone {
      border: 2px dashed var(--border-strong); border-radius: var(--radius-lg);
      background: var(--surface); padding: 24px; text-align: center; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--maroon-700);
      transition: background 0.15s, border-color 0.15s;
    }
    .dropzone.over, .dropzone:hover { background: var(--maroon-50); border-color: var(--maroon-700); }
    .tabs { display: flex; overflow-x: auto; border-bottom: 1px solid var(--border); background: var(--maroon-50); padding: 6px 10px 0; gap: 4px; }
    .tabs button {
      border: none; background: transparent; padding: 9px 13px; border-radius: 10px 10px 0 0;
      display: flex; align-items: center; gap: 7px; font: inherit; font-size: 13px; font-weight: 500;
      color: var(--text-muted); cursor: pointer; white-space: nowrap;
    }
    .tabs button.active { background: var(--surface); color: var(--maroon-700); font-weight: 600; border: 1px solid var(--border); border-bottom-color: var(--surface); margin-bottom: -1px; }
    .tab-cnt { background: var(--maroon-100); color: var(--maroon-700); font-size: 11px; padding: 1px 7px; border-radius: 999px; font-weight: 600; }
  `,
})
export class DataPage {
  state = inject(AppState);
  auth = inject(AuthService);
  private api = inject(Api);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);

  tabs = ENTITY_TABS;
  activeTab = signal('teacher');
  search = '';
  dragOver = signal(false);

  dialogOpen = signal(false);
  editingKey = signal<string | null>(null);
  formRow: Record<string, any> = {};

  activeSchema = computed(() => this.state.data()?.schema?.[this.activeTab()]);
  activeFields = computed(() => this.activeSchema()?.fields || []);
  totalRows = computed(() => (this.state.data()?.data?.[this.activeTab()] || []).length);
  teachersList = computed(() => this.state.data()?.data?.['teacher'] || []);

  filteredRows = computed(() => {
    const list = this.state.data()?.data?.[this.activeTab()] || [];
    const q = this.search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)));
  });

  countOf(entity: string) {
    return (this.state.data()?.data?.[entity] || []).length;
  }

  fieldLabel(f: string) { return FIELD_LABELS[f] || f; }
  isKey(f: string) { return (this.activeSchema()?.key || []).includes(f); }
  isInt(f: string) { return (this.activeSchema()?.int || []).includes(f); }

  rowKeyOf(row: Record<string, any>) {
    return (this.activeSchema()?.key || []).map((k) => String(row[k] ?? '').trim()).join('|');
  }

  openDialog(row: Record<string, any> | null) {
    if (row) {
      this.editingKey.set(this.rowKeyOf(row));
      this.formRow = { ...row };
    } else {
      this.editingKey.set(null);
      this.formRow = {};
      for (const f of this.activeFields()) this.formRow[f] = this.isInt(f) ? 0 : '';
    }
    this.dialogOpen.set(true);
  }

  async saveRow() {
    try {
      const entity = this.activeTab();
      if (this.editingKey()) {
        await this.api.updateRow(entity, this.editingKey()!, this.formRow);
        this.toasts.success('อัปเดตข้อมูลแล้ว');
      } else {
        await this.api.addRow(entity, this.formRow);
        this.toasts.success('เพิ่มข้อมูลแล้ว');
      }
      this.dialogOpen.set(false);
      await this.state.refreshData();
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async removeRow(row: Record<string, any>) {
    const key = this.rowKeyOf(row);
    const ok = await this.confirm.ask({
      title: 'ยืนยันการลบข้อมูล',
      message: `ต้องการลบรายการรหัส "${key}" ออกจากตาราง ${this.activeTab()} ใช่หรือไม่?`,
      confirmText: 'ลบข้อมูล',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.deleteRow(this.activeTab(), key);
      this.toasts.success('ลบข้อมูลแล้ว');
      await this.state.refreshData();
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async autoAssignAdvisors() {
    const ok = await this.confirm.ask({
      title: 'จัดสรรครูที่ปรึกษาอัตโนมัติ',
      message: 'ระบบจะเลือกอาจารย์ที่มีภาระสอนน้อยที่สุดในแต่ละชั้นปีที่สอน (1 คนต่อ 1 กลุ่ม ไม่ซ้ำกัน) และอัปเดตคาบพบครูที่ปรึกษาวันพุธ คาบ 8 ให้ทันที',
      confirmText: 'จัดสรรอัตโนมัติ',
    });
    if (!ok) return;
    try {
      const res = await this.api.autoAssignAdvisors();
      await this.state.refresh();
      this.toasts.success(`จัดสรรครูที่ปรึกษาครบ ${res.assigned?.length || 0} กลุ่มแล้ว`);
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async resetAll() {
    const ok = await this.confirm.ask({
      title: 'คืนค่าข้อมูลต้นฉบับ',
      message: 'ข้อมูลที่แก้ไขทั้งหมดจะถูกแทนที่ด้วยข้อมูลต้นฉบับจากชุดการแข่งขัน',
      confirmText: 'คืนค่า',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.resetData();
      await this.state.refresh();
      this.toasts.success('คืนค่าข้อมูลต้นฉบับแล้ว');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.dragOver.set(false);
    const files = Array.from(ev.dataTransfer?.files || []);
    if (files.length) this.uploadFiles(files);
  }

  onPick(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (files.length) this.uploadFiles(files);
  }

  async uploadFiles(files: File[]) {
    try {
      const res = await this.api.importFiles(files);
      await this.state.refreshData();
      this.toasts.success(`นำเข้าสำเร็จ ${res.imported?.length || 0} รายการ`);
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }
}
