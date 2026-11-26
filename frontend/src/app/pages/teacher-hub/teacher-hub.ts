import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { AuthService } from '../../core/auth';
import { Toasts } from '../../core/toast';
import { Grid } from '../../core/models';

interface SlotOption {
  key: string;
  label: string;
  subject_id: string;
  fromDay: string;
  fromPeriod: number;
  length: number;
  room_id: string;
}

const DAYS = [
  { key: 'Mon', label: 'จันทร์' },
  { key: 'Tue', label: 'อังคาร' },
  { key: 'Wed', label: 'พุธ' },
  { key: 'Thu', label: 'พฤหัสบดี' },
  { key: 'Fri', label: 'ศุกร์' },
];

const DAY_LABEL: Record<string, string> = Object.fromEntries(DAYS.map((d) => [d.key, d.label]));

@Component({
  selector: 'app-teacher-hub',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">ศูนย์สื่อสารอาจารย์และผู้ดูแล</div>
          <h1>{{ auth.isAdmin() ? 'คำขอจากครู' : 'คำขอและบันทึกครู' }}</h1>
        </div>
      </div>

      <div class="hub-stack">
        <!-- Section 1: Requests -->
        <div class="card">
          <div class="card-head">
            <h3>คำขอย้าย / เปลี่ยนคาบสอน ({{ requests().length }})</h3>
          </div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 14px">
            @if (!auth.isAdmin()) {
              <form class="req-form" (ngSubmit)="submitRequest()">
                <div class="rf-title">ส่งคำขอย้าย / เปลี่ยนคาบสอนถึงผู้ดูแลระบบ</div>
                <div class="grid-2">
                  <div class="field" style="grid-column: 1 / -1">
                    <label>เลือกคาบสอนที่ต้องการย้าย</label>
                    <select class="input" name="slotOpt" [(ngModel)]="selectedSlotKey" (ngModelChange)="onPickSlot($event)">
                      <option value="">— เลือกจากตารางสอนของฉัน —</option>
                      @for (opt of slotOptions(); track opt.key) {
                        <option [value]="opt.key">{{ opt.label }}</option>
                      }
                    </select>
                  </div>
                  <div class="field">
                    <label>วันที่ต้องการย้ายไป</label>
                    <select class="input" name="toDay" [(ngModel)]="reqToDay" (ngModelChange)="checkLive()" required>
                      @for (d of days; track d.key) {
                        <option [value]="d.key">วัน{{ d.label }}</option>
                      }
                    </select>
                  </div>
                  <div class="field">
                    <label>คาบเริ่มต้นที่ต้องการ</label>
                    <select class="input" name="toPeriod" [(ngModel)]="reqToPeriod" (ngModelChange)="checkLive()" required>
                      @for (p of periods; track p) {
                        <option [ngValue]="p">คาบ {{ p }}</option>
                      }
                    </select>
                  </div>

                  @if (selectedSlotKey) {
                    <div style="grid-column: 1 / -1">
                      @if (checkingLive()) {
                        <div class="alert info">กำลังตรวจสอบเงื่อนไขการย้ายคาบ…</div>
                      } @else if (liveCheck(); as chk) {
                        @if (chk.feasible) {
                          <div class="alert success">
                            <strong>✓ สามารถย้ายได้ — ไม่ขัดต่อเงื่อนไข</strong>
                            (วัน{{ dayTh(reqToDay) }} คาบ {{ reqToPeriod }})
                          </div>
                        } @else {
                          <div class="alert danger">
                            <div><strong>✗ คำขอนี้ขัดต่อเงื่อนไข ไม่สามารถย้ายไปช่วงเวลานี้ได้</strong></div>
                            @for (rs of chk.reasons; track $index) {
                              <div class="small" style="margin-top: 2px">• {{ rs }}</div>
                            }
                          </div>
                        }
                      }

                      @if (suggestedTargets().length > 0) {
                        <div class="suggest-box">
                          <div class="small muted" style="margin-bottom: 6px">ช่วงเวลาที่ย้ายได้โดยไม่ขัดเงื่อนไข (คลิกเพื่อเลือก):</div>
                          <div class="row" style="gap: 6px">
                            @for (t of suggestedTargets().slice(0, 10); track t.day + '-' + t.period) {
                              <button type="button" class="btn sm"
                                      [class.primary]="reqToDay === t.day && reqToPeriod === t.period"
                                      (click)="pickSuggested(t.day, t.period)">
                                วัน{{ t.dayLabel }} คาบ {{ t.period }}@if (t.isSwap) { (สลับ) }
                              </button>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }

                  <div class="field" style="grid-column: 1 / -1">
                    <label>เหตุผล / รายละเอียดคำขอ</label>
                    <div class="row">
                      <input class="input" style="flex: 1" name="reason" [(ngModel)]="reqReason" placeholder="ระบุเหตุผล เช่น ติดราชการ / ประชุม / ขอเปลี่ยนเวลา…" required />
                      <button class="btn primary" type="submit" [disabled]="submittingReq() || !selectedSlotKey">
                        {{ submittingReq() ? 'กำลังส่ง…' : 'ส่งคำขอถึงผู้ดูแล' }}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            }

            @if (requests().length === 0) {
              <div class="muted small">ยังไม่มีคำขอ</div>
            }
            @for (r of requests(); track r.id) {
              <div class="req-box">
                <div class="row" style="justify-content: space-between">
                  <strong>{{ r.teacher_name }} ({{ r.subject_id || r.kind }})</strong>
                  <span class="badge" [class.success]="r.status === 'approved'" [class.danger]="r.status === 'rejected'" [class.warning]="r.status === 'pending'">
                    {{ statusTh(r.status) }}
                  </span>
                </div>
                <div class="small muted" style="margin-top: 2px">
                  จาก วัน{{ dayTh(r.fromDay) }} คาบ {{ r.fromPeriod }}@if (r.length > 1) {–{{ r.fromPeriod + r.length - 1 }}}
                  → วัน{{ dayTh(r.toDay) }} คาบ {{ r.toPeriod }} · {{ r.reason || '-' }}
                </div>

                @if (r.status === 'pending' && r.check; as chk) {
                  <div class="check-strip" [class.ok]="chk.feasible" [class.bad]="!chk.feasible">
                    @if (chk.feasible) {
                      <strong>✓ ตรวจเงื่อนไขผ่าน: สามารถย้ายได้โดยไม่ขัดต่อเงื่อนไข</strong>
                    } @else {
                      <strong>✗ ขัดต่อเงื่อนไข: ไม่สามารถย้ายได้</strong>
                      @for (rs of chk.reasons; track $index) {
                        <div class="small">• {{ rs }}</div>
                      }
                    }
                  </div>
                }

                @if (r.adminNote) {
                  <div class="small" style="margin-top: 6px; color: var(--maroon-700)">หมายเหตุจากผู้ดูแล: {{ r.adminNote }}</div>
                }
                @if (auth.isAdmin() && r.status === 'pending') {
                  <div class="row" style="margin-top: 10px">
                    <button class="btn sm primary" type="button"
                            [disabled]="r.check && !r.check.feasible"
                            [title]="r.check && !r.check.feasible ? 'ไม่สามารถอนุมัติได้เนื่องจากขัดต่อเงื่อนไข' : ''"
                            (click)="approve(r.id)">
                      อนุมัติ
                    </button>
                    <button class="btn sm danger" type="button" (click)="reject(r.id)">ปฏิเสธ</button>
                  </div>
                }
                @if (!auth.isAdmin() && r.status === 'pending') {
                  <div class="row" style="margin-top: 8px">
                    <button class="btn sm ghost" style="color: var(--danger)" type="button" (click)="cancelRequest(r.id)">ยกเลิกคำขอ</button>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Section 2: Private Notes (Teachers only) -->
        @if (!auth.isAdmin()) {
          <div class="card">
            <div class="card-head">
              <h3>บันทึกช่วยจำส่วนตัว ({{ filteredNotes().length }})</h3>
              <select class="input" style="max-width: 260px" [ngModel]="noteFilterSubject()" (ngModelChange)="noteFilterSubject.set($event)">
                <option value="">ทั้งหมด ({{ notes().length }})</option>
                <option value="__general__">เฉพาะบันทึกทั่วไป</option>
                @for (s of mySubjects(); track s.subject_id) {
                  <option [value]="s.subject_id">{{ s.subject_id }} {{ s.name }}</option>
                }
              </select>
            </div>
            <div class="card-body" style="display: flex; flex-direction: column; gap: 12px">
              <div class="note-form">
                <div class="row" style="justify-content: space-between; gap: 10px">
                  <div class="segmented">
                    <button type="button" [class.active]="noteMode() === 'general'" (click)="setNoteMode('general')">บันทึกทั่วไป</button>
                    <button type="button" [class.active]="noteMode() === 'subject'" (click)="setNoteMode('subject')">บันทึกรายวิชา</button>
                  </div>
                  @if (noteMode() === 'subject') {
                    <select class="input" style="flex: 1; max-width: 380px" [(ngModel)]="noteSubjectId">
                      <option value="">— เลือกรายวิชาที่สอน —</option>
                      @for (s of mySubjects(); track s.subject_id) {
                        <option [value]="s.subject_id">{{ s.subject_id }} {{ s.name }}</option>
                      }
                    </select>
                  }
                </div>
                <input class="input" [(ngModel)]="noteTitle" placeholder="หัวข้อบันทึก…" />
                <textarea class="input" rows="2" [(ngModel)]="noteContent" placeholder="รายละเอียดบันทึก…"></textarea>
                <div class="row" style="justify-content: flex-end">
                  <button class="btn sm primary" type="button"
                          [disabled]="!noteTitle.trim() || (noteMode() === 'subject' && !noteSubjectId)"
                          (click)="addNote()">
                    + เพิ่มบันทึก
                  </button>
                </div>
              </div>

              @for (n of filteredNotes(); track n.id) {
                <div class="req-box">
                  <div class="row" style="justify-content: space-between">
                    <div class="row" style="gap: 8px">
                      <strong>{{ n.title }}</strong>
                      @if (n.subject_id) {
                        <span class="badge">{{ n.subject_id }} {{ subjectName(n.subject_id) }}</span>
                      } @else {
                        <span class="badge">บันทึกทั่วไป</span>
                      }
                    </div>
                    <button class="btn sm ghost" style="color: var(--danger)" type="button" (click)="delNote(n.id)">ลบ</button>
                  </div>
                  @if (n.content) {
                    <div class="small muted" style="margin-top: 4px; white-space: pre-wrap">{{ n.content }}</div>
                  }
                </div>
              } @empty {
                <div class="muted small">ยังไม่มีบันทึกช่วยจำ</div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .hub-stack { display: flex; flex-direction: column; gap: 16px; }
    .req-box { border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
    .req-form, .note-form {
      background: var(--maroon-50); border: 1px solid var(--border); border-radius: 12px;
      padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;
    }
    .rf-title { font-weight: 700; font-size: 14px; color: var(--maroon-800); }
    .suggest-box { margin-top: 8px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
    .check-strip { margin-top: 8px; padding: 8px 11px; border-radius: 8px; font-size: 12.5px; }
    .check-strip.ok { background: #ecfdf3; border: 1px solid #a7e3be; color: #166534; }
    .check-strip.bad { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
  `,
})
export class TeacherHubPage implements OnInit {
  private api = inject(Api);
  auth = inject(AuthService);
  private toasts = inject(Toasts);

  days = DAYS;
  periods = [1, 2, 3, 4, 6, 7, 8, 9];

  requests = signal<any[]>([]);
  notes = signal<any[]>([]);
  myGrid = signal<Grid | null>(null);
  noteFilterSubject = signal('');
  noteMode = signal<'general' | 'subject'>('general');
  submittingReq = signal(false);

  checkingLive = signal(false);
  liveCheck = signal<{ feasible: boolean; reasons: string[] } | null>(null);
  suggestedTargets = signal<any[]>([]);

  selectedSlotKey = '';
  reqToDay = 'Mon';
  reqToPeriod = 1;
  reqReason = '';

  noteTitle = '';
  noteContent = '';
  noteSubjectId = '';

  mySubjects = computed(() => this.myGrid()?.subjects?.list || []);

  slotOptions = computed<SlotOption[]>(() => {
    const g = this.myGrid();
    if (!g) return [];
    const out: SlotOption[] = [];
    (g.days || []).forEach((d, di) => {
      for (const sp of g.cells?.[di] || []) {
        if (sp.subject_id === 'ADVISOR' || sp.subject_id === 'ACTIVITY') continue;
        const end = sp.start + sp.span - 1;
        const grp = (sp.group_labels || sp.groups || []).join(', ');
        const key = `${d.key}|${sp.start}|${sp.subject_id}`;
        out.push({
          key,
          label: `${sp.display_code || sp.subject_id} ${sp.subject_name || ''} (${grp}) · วัน${d.label} คาบ ${sp.start}${sp.span > 1 ? '–' + end : ''}`,
          subject_id: sp.subject_id,
          fromDay: d.key,
          fromPeriod: sp.start,
          length: sp.span,
          room_id: sp.room || '',
        });
      }
    });
    return out;
  });

  filteredNotes = computed(() => {
    const f = this.noteFilterSubject();
    const list = this.notes();
    if (!f) return list;
    if (f === '__general__') return list.filter((n) => !n.subject_id);
    return list.filter((n) => n.subject_id === f);
  });

  async ngOnInit() { await this.load(); }

  async load() {
    if (this.auth.isAdmin()) {
      const r = await this.api.getTeacherRequests();
      this.requests.set(r.requests || []);
      return;
    }
    const tid = this.auth.user()?.teacher_id;
    const [r, n, g] = await Promise.all([
      this.api.getTeacherRequests(),
      this.api.getTeacherNotes(),
      tid ? this.api.getGrid('teacher', tid).catch(() => null) : Promise.resolve(null),
    ]);
    this.requests.set(r.requests || []);
    this.notes.set(n.notes || []);
    this.myGrid.set(g);
  }

  setNoteMode(mode: 'general' | 'subject') {
    this.noteMode.set(mode);
    if (mode === 'general') this.noteSubjectId = '';
  }

  async onPickSlot(key: string) {
    this.liveCheck.set(null);
    this.suggestedTargets.set([]);
    const opt = this.slotOptions().find((o) => o.key === key);
    if (!opt) return;
    this.reqToDay = opt.fromDay;
    this.reqToPeriod = opt.fromPeriod;

    const tid = this.auth.user()?.teacher_id;
    if (tid) {
      try {
        const res = await this.api.moveOptions({
          view: 'teacher',
          id: tid,
          fromDay: opt.fromDay,
          fromPeriod: opt.fromPeriod,
          length: opt.length,
        });
        this.suggestedTargets.set(res.targets || []);
        if (res.targets?.length) {
          this.reqToDay = res.targets[0].day;
          this.reqToPeriod = res.targets[0].period;
        }
      } catch {
        // ignore
      }
    }
    await this.checkLive();
  }

  async pickSuggested(day: string, period: number) {
    this.reqToDay = day;
    this.reqToPeriod = period;
    await this.checkLive();
  }

  async checkLive() {
    const opt = this.slotOptions().find((o) => o.key === this.selectedSlotKey);
    if (!opt) {
      this.liveCheck.set(null);
      return;
    }
    this.checkingLive.set(true);
    try {
      const res = await this.api.checkTeacherRequest({
        kind: 'move',
        subject_id: opt.subject_id,
        fromDay: opt.fromDay,
        fromPeriod: opt.fromPeriod,
        length: opt.length,
        toDay: this.reqToDay,
        toPeriod: Number(this.reqToPeriod),
        room_id: opt.room_id,
      });
      this.liveCheck.set({ feasible: Boolean(res.feasible), reasons: res.reasons || [] });
    } catch (err) {
      this.liveCheck.set({ feasible: false, reasons: [this.api.errorMessage(err)] });
    } finally {
      this.checkingLive.set(false);
    }
  }

  async submitRequest() {
    const opt = this.slotOptions().find((o) => o.key === this.selectedSlotKey);
    if (!opt) {
      this.toasts.error('กรุณาเลือกคาบสอนที่ต้องการย้าย');
      return;
    }
    if (!this.reqReason.trim()) {
      this.toasts.error('กรุณาระบุเหตุผลในการขอเปลี่ยนคาบสอน');
      return;
    }
    this.submittingReq.set(true);
    try {
      await this.api.createTeacherRequest({
        kind: 'move',
        subject_id: opt.subject_id,
        fromDay: opt.fromDay,
        fromPeriod: opt.fromPeriod,
        length: opt.length,
        toDay: this.reqToDay,
        toPeriod: Number(this.reqToPeriod),
        room_id: opt.room_id,
        reason: this.reqReason.trim(),
      });
      this.selectedSlotKey = '';
      this.reqReason = '';
      this.liveCheck.set(null);
      this.suggestedTargets.set([]);
      await this.load();
      this.toasts.success('ส่งคำขอถึงผู้ดูแลระบบเรียบร้อยแล้ว');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    } finally {
      this.submittingReq.set(false);
    }
  }

  async cancelRequest(id: string) {
    try {
      await this.api.deleteTeacherRequest(id);
      await this.load();
      this.toasts.info('ยกเลิกคำขอแล้ว');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async approve(id: string) {
    try {
      await this.api.approveTeacherRequest(id);
      await this.load();
      this.toasts.success('อนุมัติและปรับตารางเรียบร้อย');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async reject(id: string) {
    await this.api.rejectTeacherRequest(id);
    await this.load();
    this.toasts.info('ปฏิเสธคำขอแล้ว');
  }

  async addNote() {
    if (!this.noteTitle.trim()) return;
    if (this.noteMode() === 'subject' && !this.noteSubjectId) {
      this.toasts.error('กรุณาเลือกรายวิชา');
      return;
    }
    await this.api.createTeacherNote({
      title: this.noteTitle.trim(),
      content: this.noteContent.trim(),
      subject_id: this.noteMode() === 'subject' ? this.noteSubjectId : '',
    });
    this.noteTitle = '';
    this.noteContent = '';
    await this.load();
    this.toasts.success('เพิ่มบันทึกแล้ว');
  }

  async delNote(id: string) {
    await this.api.deleteTeacherNote(id);
    await this.load();
  }

  dayTh(day: string) {
    return DAY_LABEL[day] || day || '-';
  }

  statusTh(st: string) {
    if (st === 'approved') return 'อนุมัติแล้ว';
    if (st === 'rejected') return 'ปฏิเสธแล้ว';
    return 'รออนุมัติ';
  }

  subjectName(sid: string) {
    return this.mySubjects().find((s) => s.subject_id === sid)?.name || '';
  }
}
