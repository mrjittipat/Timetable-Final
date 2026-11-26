import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { AuthService } from '../../core/auth';
import { Toasts } from '../../core/toast';
import { Grid, GridSpan } from '../../core/models';

interface SelectedSpan {
  day: string;
  dayLabel: string;
  dayIdx: number;
  span: GridSpan;
}

const DAY_LABEL: Record<string, string> = {
  Mon: 'จันทร์',
  Tue: 'อังคาร',
  Wed: 'พุธ',
  Thu: 'พฤหัสบดี',
  Fri: 'ศุกร์',
};

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
            <div>
              <h3>คำขอย้าย / เปลี่ยนคาบสอน ({{ requests().length }})</h3>
              @if (!auth.isAdmin()) {
                <div class="small muted">คลิกหรือลากคาบสอนในตารางของฉันไปวางยังช่องปลายทาง (ช่องสีเขียว = ย้ายได้ไม่ขัดเงื่อนไข) แล้วกรอกเหตุผลเพื่อส่งขออนุมัติ</div>
              }
            </div>
            @if (!auth.isAdmin() && selected()) {
              <button class="btn sm ghost" type="button" (click)="clearSelection()">ยกเลิกการเลือก</button>
            }
          </div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 16px">
            @if (!auth.isAdmin()) {
              @if (myGrid(); as g) {
                <div class="grid-wrap">
                  <table class="tt-pick">
                    <colgroup>
                      <col style="width: 10%" />
                      @for (p of g.periods; track p.period) {
                        <col style="width: 10%" />
                      }
                    </colgroup>
                    <thead>
                      <tr>
                        <th>วัน / คาบ</th>
                        @for (p of g.periods; track p.period) {
                          <th [class.brk-h]="p.isBreak">
                            <div>คาบ {{ p.period }}</div>
                            <div class="th-time">{{ p.start }}–{{ p.end }}</div>
                          </th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (d of g.days; track d.key; let di = $index) {
                        <tr>
                          <td class="day-col">{{ d.label }}</td>
                          @for (cell of rowCells(g, di); track cell.period) {
                            @if (cell.isBreak) {
                              <td class="brk-cell">พัก</td>
                            } @else if (cell.span; as sp) {
                              <td [attr.colspan]="sp.span"
                                  class="span-cell"
                                  [class.movable]="isMovable(sp)"
                                  [class.selected-span]="isSelected(d.key, sp.start)"
                                  [class.target-ok]="isTargetOk(d.key, sp.start)"
                                  [class.target-picked]="isPickedDest(d.key, sp.start)"
                                  [attr.draggable]="isMovable(sp)"
                                  (dragstart)="onDragStart($event, d.key, d.label, di, sp)"
                                  (dragover)="onDragOver($event, d.key, sp.start)"
                                  (drop)="onDrop($event, d.key, sp.start)"
                                  (click)="onSpanClick(d.key, d.label, di, sp)">
                                <div class="sp-code">{{ sp.display_code || sp.subject_id }}</div>
                                <div class="sp-name">{{ sp.subject_name }}</div>
                                <div class="sp-meta">{{ (sp.group_labels || sp.groups || []).join(', ') }} · {{ sp.room_name || sp.room }}</div>
                                @if (isSelected(d.key, sp.start)) {
                                  <span class="sp-badge sel">กำลังเลือกย้าย</span>
                                } @else if (isTargetOk(d.key, sp.start)) {
                                  <span class="sp-badge ok">สลับได้</span>
                                }
                              </td>
                            } @else {
                              <td class="empty-cell"
                                  [class.exec-block]="g.entity?.isLeader && d.key === 'Tue' && cell.period >= 1 && cell.period <= 4"
                                  [class.target-ok]="isTargetOk(d.key, cell.period)"
                                  [class.target-picked]="isPickedDest(d.key, cell.period)"
                                  [class.target-preview]="isInPickedRange(d.key, cell.period)"
                                  (dragover)="onDragOver($event, d.key, cell.period)"
                                  (drop)="onDrop($event, d.key, cell.period)"
                                  (click)="onEmptyClick(d.key, cell.period)">
                                @if (g.entity?.isLeader && d.key === 'Tue' && cell.period >= 1 && cell.period <= 4) {
                                  <span class="exec-txt">ประชุมผู้บริหาร</span>
                                } @else if (isPickedDest(d.key, cell.period)) {
                                  <span class="sp-badge dest">ปลายทาง</span>
                                } @else if (isTargetOk(d.key, cell.period)) {
                                  <span class="sp-badge ok">ย้ายได้</span>
                                }
                              </td>
                            }
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <!-- Draft Move Confirmation Box -->
                @if (selected(); as sel) {
                  <form class="req-form" (ngSubmit)="submitRequest()">
                    <div class="row" style="justify-content: space-between; gap: 10px">
                      <div class="rf-title">
                        คำขอย้าย: {{ sel.span.display_code || sel.span.subject_id }} {{ sel.span.subject_name }}
                        ({{ (sel.span.group_labels || sel.span.groups || []).join(', ') }})
                      </div>
                      <span class="badge">
                        ต้นทาง: วัน{{ sel.dayLabel }} คาบ {{ sel.span.start }}@if (sel.span.span > 1) {–{{ sel.span.start + sel.span.span - 1 }}} ({{ sel.span.span }} คาบ)
                      </span>
                    </div>

                    @if (!pickedDest()) {
                      <div class="alert info">
                        กรุณาคลิกหรือลากไปวางที่ <strong>ช่องปลายทาง</strong> ในตารางด้านบน (ช่องสีเขียวคือช่วงเวลาที่ย้ายได้โดยไม่ขัดต่อเงื่อนไข)
                        @if (loadingTargets()) { · กำลังคำนวณช่องว่าง… }
                      </div>
                    } @else if (pickedDest(); as dest) {
                      <div class="dest-summary">
                        <strong>ปลายทางที่เลือก:</strong> วัน{{ dayTh(dest.day) }} คาบ {{ dest.period }}@if (sel.span.span > 1) {–{{ dest.period + sel.span.span - 1 }}}
                        <span class="small muted">(ตารางสอนจริงจะยังไม่เปลี่ยนจนกว่าแอดมินจะกดอนุมัติ)</span>
                      </div>

                      @if (checkingLive()) {
                        <div class="alert info">กำลังตรวจสอบเงื่อนไขการย้ายคาบ…</div>
                      } @else if (liveCheck(); as chk) {
                        @if (chk.feasible) {
                          <div class="alert success">
                            <strong>✓ สามารถย้ายได้ — ไม่ขัดต่อเงื่อนไขใด ๆ</strong>
                          </div>
                        } @else {
                          <div class="alert danger">
                            <div><strong>✗ ช่วงเวลานี้ขัดต่อเงื่อนไข ไม่สามารถย้ายได้</strong></div>
                            @for (rs of chk.reasons; track $index) {
                              <div class="small" style="margin-top: 2px">• {{ rs }}</div>
                            }
                          </div>
                        }
                      }

                      <div class="field">
                        <label>เหตุผลในการขอย้ายคาบสอน</label>
                        <div class="row">
                          <input class="input" style="flex: 1" name="reason" [(ngModel)]="reqReason"
                                 placeholder="ระบุเหตุผล เช่น ติดราชการ / ประชุม / ขอเปลี่ยนเวลา…" required />
                          <button class="btn primary" type="submit" [disabled]="submittingReq() || !reqReason.trim()">
                            {{ submittingReq() ? 'กำลังส่ง…' : 'ส่งคำขออนุมัติ' }}
                          </button>
                        </div>
                      </div>
                    }
                  </form>
                }
              } @else {
                <div class="muted small">ยังไม่มีตารางสอนในระบบ</div>
              }
            }

            <!-- Request List (Both Teacher & Admin) -->
            <div style="display: flex; flex-direction: column; gap: 10px">
              @if (!auth.isAdmin()) {
                <div class="small" style="font-weight: 700; color: var(--text-muted)">ประวัติคำขอที่ส่งไปแล้ว ({{ requests().length }})</div>
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
                    → วัน{{ dayTh(r.toDay) }} คาบ {{ r.toPeriod }}@if (r.length > 1) {–{{ r.toPeriod + r.length - 1 }}} · เหตุผล: {{ r.reason || '-' }}
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
    .dest-summary { font-size: 13.5px; padding: 8px 12px; background: var(--surface); border-radius: 8px; border: 1px solid var(--border); }
    .check-strip { margin-top: 8px; padding: 8px 11px; border-radius: 8px; font-size: 12.5px; }
    .check-strip.ok { background: #ecfdf3; border: 1px solid #a7e3be; color: #166534; }
    .check-strip.bad { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

    .grid-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }
    .tt-pick { width: 100%; min-width: 820px; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
    .tt-pick th, .tt-pick td { border: 1px solid var(--border); padding: 6px 4px; text-align: center; vertical-align: middle; }
    .tt-pick thead th { background: var(--maroon-800); color: #fff; font-weight: 600; }
    .tt-pick thead th.brk-h { background: var(--maroon-600); }
    .th-time { font-size: 10px; font-weight: 400; opacity: 0.85; }
    .day-col { font-weight: 700; background: var(--maroon-50); color: var(--maroon-900); }
    .brk-cell { background: #f3ecee; color: var(--text-muted); font-size: 11px; }

    .span-cell { background: #fff9fa; position: relative; transition: background 0.12s, box-shadow 0.12s; }
    .span-cell.movable { cursor: pointer; }
    .span-cell.movable:hover { background: var(--maroon-100); }
    .span-cell.selected-span { background: #dbeafe !important; box-shadow: inset 0 0 0 2px #2563eb; }
    .sp-code { font-weight: 700; color: var(--maroon-800); font-size: 12px; }
    .sp-name { font-size: 11px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sp-meta { font-size: 10px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .empty-cell { height: 64px; background: var(--surface); cursor: pointer; position: relative; transition: background 0.12s; }
    .empty-cell:hover { background: var(--maroon-50); }
    .empty-cell.exec-block { background: #fffbeb; }
    .exec-txt { font-size: 10.5px; font-weight: 600; color: #92400e; }

    .target-ok { background: #ecfdf3 !important; box-shadow: inset 0 0 0 1.5px #16a34a; }
    .target-picked { background: #fef3c7 !important; box-shadow: inset 0 0 0 2px #d97706 !important; }
    .target-preview { background: #fffbeb !important; box-shadow: inset 0 0 0 1.5px dashed #d97706; }

    .sp-badge {
      display: inline-block; margin-top: 3px; padding: 1px 6px; border-radius: 999px;
      font-size: 10px; font-weight: 700;
    }
    .sp-badge.sel { background: #2563eb; color: #fff; }
    .sp-badge.ok { background: #16a34a; color: #fff; }
    .sp-badge.dest { background: #d97706; color: #fff; }
  `,
})
export class TeacherHubPage implements OnInit {
  private api = inject(Api);
  auth = inject(AuthService);
  private toasts = inject(Toasts);

  requests = signal<any[]>([]);
  notes = signal<any[]>([]);
  myGrid = signal<Grid | null>(null);
  noteFilterSubject = signal('');
  noteMode = signal<'general' | 'subject'>('general');
  submittingReq = signal(false);

  selected = signal<SelectedSpan | null>(null);
  pickedDest = signal<{ day: string; period: number } | null>(null);
  validTargets = signal<any[]>([]);
  loadingTargets = signal(false);
  checkingLive = signal(false);
  liveCheck = signal<{ feasible: boolean; reasons: string[] } | null>(null);

  reqReason = '';
  noteTitle = '';
  noteContent = '';
  noteSubjectId = '';

  mySubjects = computed(() => this.myGrid()?.subjects?.list || []);

  validTargetSet = computed(() => {
    const s = new Set<string>();
    for (const t of this.validTargets()) s.add(`${t.day}|${t.period}`);
    return s;
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

  rowCells(g: Grid, dayIdx: number) {
    const spans = g.cells?.[dayIdx] || [];
    const byStart = new Map(spans.map((s) => [s.start, s]));
    const out: { period: number; isBreak: boolean; span?: GridSpan }[] = [];
    let i = 0;
    while (i < g.periods.length) {
      const pm = g.periods[i];
      if (pm.isBreak) {
        out.push({ period: pm.period, isBreak: true });
        i++;
        continue;
      }
      const sp = byStart.get(pm.period);
      if (sp) {
        out.push({ period: pm.period, isBreak: false, span: sp });
        i += sp.span || 1;
      } else {
        out.push({ period: pm.period, isBreak: false });
        i++;
      }
    }
    return out;
  }

  isMovable(sp: GridSpan) {
    return sp.subject_id !== 'ADVISOR' && sp.subject_id !== 'ACTIVITY';
  }

  isSelected(day: string, period: number) {
    const s = this.selected();
    return !!s && s.day === day && s.span.start === period;
  }

  isTargetOk(day: string, period: number) {
    return !!this.selected() && this.validTargetSet().has(`${day}|${period}`);
  }

  isPickedDest(day: string, period: number) {
    const d = this.pickedDest();
    return !!d && d.day === day && d.period === period;
  }

  isInPickedRange(day: string, period: number) {
    const d = this.pickedDest();
    const s = this.selected();
    if (!d || !s || d.day !== day) return false;
    return period > d.period && period < d.period + (s.span.span || 1);
  }

  clearSelection() {
    this.selected.set(null);
    this.pickedDest.set(null);
    this.validTargets.set([]);
    this.liveCheck.set(null);
    this.reqReason = '';
  }

  async selectSpan(day: string, dayLabel: string, dayIdx: number, span: GridSpan) {
    if (!this.isMovable(span)) return;
    this.selected.set({ day, dayLabel, dayIdx, span });
    this.pickedDest.set(null);
    this.liveCheck.set(null);
    this.validTargets.set([]);
    const tid = this.auth.user()?.teacher_id;
    if (!tid) return;
    this.loadingTargets.set(true);
    try {
      const res = await this.api.moveOptions({
        view: 'teacher',
        id: tid,
        fromDay: day,
        fromPeriod: span.start,
        length: span.span,
      });
      this.validTargets.set(res.targets || []);
    } catch {
      this.validTargets.set([]);
    } finally {
      this.loadingTargets.set(false);
    }
  }

  async onSpanClick(day: string, dayLabel: string, dayIdx: number, span: GridSpan) {
    const cur = this.selected();
    if (cur && cur.day === day && cur.span.start === span.start) {
      this.clearSelection();
      return;
    }
    if (cur && this.isTargetOk(day, span.start)) {
      await this.chooseDest(day, span.start);
      return;
    }
    await this.selectSpan(day, dayLabel, dayIdx, span);
  }

  async onEmptyClick(day: string, period: number) {
    if (!this.selected()) return;
    await this.chooseDest(day, period);
  }

  onDragStart(ev: DragEvent, day: string, dayLabel: string, dayIdx: number, span: GridSpan) {
    if (!this.isMovable(span)) {
      ev.preventDefault();
      return;
    }
    ev.dataTransfer?.setData('text/plain', `${day}|${span.start}`);
    this.selectSpan(day, dayLabel, dayIdx, span);
  }

  onDragOver(ev: DragEvent, _day: string, _period: number) {
    if (!this.selected()) return;
    ev.preventDefault();
  }

  async onDrop(ev: DragEvent, day: string, period: number) {
    ev.preventDefault();
    if (!this.selected()) return;
    await this.chooseDest(day, period);
  }

  async chooseDest(day: string, period: number) {
    const sel = this.selected();
    if (!sel) return;
    if (sel.day === day && sel.span.start === period) return;
    this.pickedDest.set({ day, period });
    this.checkingLive.set(true);
    try {
      const res = await this.api.checkTeacherRequest({
        kind: 'move',
        subject_id: sel.span.subject_id,
        fromDay: sel.day,
        fromPeriod: sel.span.start,
        length: sel.span.span,
        toDay: day,
        toPeriod: period,
        room_id: sel.span.room || '',
      });
      this.liveCheck.set({ feasible: Boolean(res.feasible), reasons: res.reasons || [] });
    } catch (err) {
      this.liveCheck.set({ feasible: false, reasons: [this.api.errorMessage(err)] });
    } finally {
      this.checkingLive.set(false);
    }
  }

  async submitRequest() {
    const sel = this.selected();
    const dest = this.pickedDest();
    if (!sel || !dest) return;
    if (!this.reqReason.trim()) {
      this.toasts.error('กรุณาระบุเหตุผลในการขอย้ายคาบสอน');
      return;
    }
    this.submittingReq.set(true);
    try {
      await this.api.createTeacherRequest({
        kind: 'move',
        subject_id: sel.span.subject_id,
        fromDay: sel.day,
        fromPeriod: sel.span.start,
        length: sel.span.span,
        toDay: dest.day,
        toPeriod: dest.period,
        room_id: sel.span.room || '',
        reason: this.reqReason.trim(),
      });
      this.clearSelection();
      await this.load();
      this.toasts.success('ส่งคำขออนุมัติถึงผู้ดูแลระบบเรียบร้อยแล้ว');
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

  setNoteMode(mode: 'general' | 'subject') {
    this.noteMode.set(mode);
    if (mode === 'general') this.noteSubjectId = '';
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
