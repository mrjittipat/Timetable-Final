import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { AppState } from '../../core/state';
import { AuthService } from '../../core/auth';
import { Toasts } from '../../core/toast';
import { EntityRef, Grid, GridSpan, OutputRow } from '../../core/models';
import { IconComponent } from '../../shared/icon';

@Component({
  selector: 'app-manual',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">จัดตารางสอนด้วยมือ</div>
          <h1>สตูดิโอปรับแต่งตารางด้วยมือ</h1>
          <p>ลากวางบล็อกคาบเรียนไปยังช่องสีเขียวที่ผ่านทุกเงื่อนไข หรือกดย้อนกลับได้ทันที (บันทึกเป็น Snapshot Seed อัตโนมัติ)</p>
        </div>
        <div class="row">
          <select class="input" style="width: 240px" [ngModel]="groupId()" (ngModelChange)="pickGroup($event)">
            @for (g of groups(); track g.id) {
              <option [value]="g.id">{{ g.title }}</option>
            }
          </select>
          <button class="btn" type="button" [disabled]="undoStack().length === 0" (click)="undo()">
            <app-icon name="undo" [size]="15" /> ย้อนกลับ ({{ undoStack().length }})
          </button>
          <button class="btn" type="button" (click)="checkNow()">ตรวจเงื่อนไข (10 ข้อ)</button>
        </div>
      </div>

      @if (state.timetable()?.validation; as val) {
        <div class="alert" [class.success]="val.passed" [class.danger]="!val.passed">
          <strong>{{ val.passed ? '✓ ตารางปัจจุบันผ่านครบทุกเงื่อนไข' : '✗ พบเงื่อนไขไม่ผ่าน' }}</strong>
          <span class="spacer"></span>
          <span class="mono small">Seed ปัจจุบัน: {{ state.timetable()?.meta?.stats?.seed ?? '-' }}</span>
        </div>
      }

      @if (grid(); as g) {
        <div class="card">
          <div class="card-head">
            <h3>{{ g.entity?.title }}</h3>
            <span class="small muted">ลากบล็อกคาบเพื่อย้าย/สลับ (ช่องสีเขียว = ย้ายได้โดยไม่ผิดเงื่อนไข)</span>
          </div>
          <div class="card-body">
            <div class="table-wrap">
              <table class="m-table">
                <thead>
                  <tr>
                    <th style="width: 82px">วัน / คาบ</th>
                    @for (p of g.periods; track p.period) {
                      <th [class.brk]="p.isBreak">{{ p.period }}<div class="small" style="font-weight: 400">{{ p.start }}</div></th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (d of g.days; track d.key; let di = $index) {
                    <tr>
                      <td class="m-day">{{ d.label }}</td>
                      @for (cell of rowCells(g, di); track $index) {
                        @if (cell.isBreak) {
                          <td class="m-brk">พัก</td>
                        } @else if (cell.span) {
                          <td [attr.colspan]="cell.span.span" class="m-span-td"
                              [class.drop-ok]="isTarget(d.key, cell.period)"
                              (dragover)="$event.preventDefault()"
                              (drop)="onDrop(d.key, cell.period)">
                            <div class="m-span" [class.dragging]="isDragging(d.key, cell.span.start)"
                                 [attr.draggable]="auth.isAdmin() && cell.span.subject_id !== 'ADVISOR' && cell.span.subject_id !== 'ACTIVITY'"
                                 (dragstart)="onDragStart(d.key, cell.span)"
                                 (dragend)="onDragEnd()">
                              <div class="code">{{ cell.span.subject_id }}</div>
                              <div class="meta">{{ cell.span.teacher }}</div>
                              <div class="room">{{ cell.span.room_name || cell.span.room }}</div>
                            </div>
                          </td>
                        } @else {
                          <td class="m-empty" [class.drop-ok]="isTarget(d.key, cell.period)"
                              (dragover)="$event.preventDefault()"
                              (drop)="onDrop(d.key, cell.period)">
                          </td>
                        }
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .m-table { width: 100%; border-collapse: collapse; table-layout: fixed; min-width: 780px; }
    .m-table th, .m-table td { border: 1px solid var(--border-strong); text-align: center; vertical-align: middle; }
    .m-table thead th { background: var(--maroon-700); color: #fff; padding: 7px 4px; }
    .m-table thead th.brk { background: var(--maroon-600); width: 52px; }
    .m-day { background: var(--maroon-50); font-weight: 600; height: 74px; }
    .m-brk { background: #f6f1f2; color: var(--text-muted); font-weight: 600; }
    .m-empty { height: 74px; background: var(--surface); }
    .m-span-td { padding: 0; height: 74px; }
    .m-span {
      height: 100%; min-height: 74px; padding: 5px; background: #fffafb; cursor: grab;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .m-span.dragging { opacity: 0.45; }
    .m-span .code { font-weight: 700; color: var(--maroon-700); font-size: 12.5px; }
    .m-span .meta { font-size: 11px; color: var(--text-muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .m-span .room { font-size: 10.5px; color: var(--maroon-600); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .drop-ok { background: #dcfce7 !important; box-shadow: inset 0 0 0 2px #16a34a; }
  `,
})
export class ManualPage implements OnInit {
  private api = inject(Api);
  state = inject(AppState);
  auth = inject(AuthService);
  private toasts = inject(Toasts);

  qGroup = input<string | undefined>(undefined, { alias: 'group' });
  groups = signal<EntityRef[]>([]);
  groupId = signal('');
  grid = signal<Grid | null>(null);
  undoStack = signal<OutputRow[][]>([]);

  dragged = signal<{ day: string; span: GridSpan } | null>(null);
  validTargets = signal<Set<string>>(new Set());

  async ngOnInit() {
    const ents = await this.api.getEntities();
    const gList = (ents.group || []).filter((g) => !g.id.startsWith('Y4_'));
    this.groups.set(gList);
    const pick = this.qGroup() && gList.some((g) => g.id === this.qGroup()) ? this.qGroup()! : (gList[0]?.id || '');
    this.groupId.set(pick);
    if (pick) await this.loadGrid();
  }

  async pickGroup(id: string) {
    this.groupId.set(id);
    await this.loadGrid();
  }

  async loadGrid() {
    this.grid.set(await this.api.getGrid('group', this.groupId()));
  }

  rowCells(g: Grid, di: number) {
    const map = new Map<number, GridSpan>();
    const covered = new Set<number>();
    for (const sp of g.cells[di] || []) {
      map.set(sp.start, sp);
      for (let k = 0; k < sp.span; k++) covered.add(sp.start + k);
    }
    const out: { period: number; isBreak?: boolean; span?: GridSpan }[] = [];
    for (const p of g.periods) {
      if (p.isBreak) out.push({ period: p.period, isBreak: true });
      else if (map.has(p.period)) out.push({ period: p.period, span: map.get(p.period) });
      else if (!covered.has(p.period)) out.push({ period: p.period });
    }
    return out;
  }

  isDragging(day: string, start: number) {
    const d = this.dragged();
    return Boolean(d && d.day === day && d.span.start === start);
  }

  isTarget(day: string, period: number) {
    return this.validTargets().has(`${day}|${period}`);
  }

  async onDragStart(day: string, span: GridSpan) {
    this.dragged.set({ day, span });
    try {
      const res = await this.api.moveOptions({
        view: 'group',
        id: this.groupId(),
        fromDay: day,
        fromPeriod: span.start,
        length: span.span,
      });
      this.validTargets.set(new Set((res.targets || []).map((t) => `${t.day}|${t.period}`)));
    } catch {
      this.validTargets.set(new Set());
    }
  }

  onDragEnd() {
    this.dragged.set(null);
    this.validTargets.set(new Set());
  }

  async onDrop(toDay: string, toPeriod: number) {
    const d = this.dragged();
    this.onDragEnd();
    if (!d) return;
    const prevRows = (this.state.timetable()?.rows || []).map((r) => ({ ...r }));
    try {
      await this.api.moveSpan({
        view: 'group',
        id: this.groupId(),
        fromDay: d.day,
        fromPeriod: d.span.start,
        length: d.span.span,
        toDay,
        toPeriod,
      });
      this.undoStack.update((s) => [...s.slice(-29), prevRows]);
      await this.state.refreshTimetable();
      await this.loadGrid();
      this.toasts.success('ย้ายคาบและบันทึก Snapshot Seed แล้ว');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async undo() {
    const s = this.undoStack();
    if (!s.length) return;
    await this.api.saveTimetable(s[s.length - 1]);
    this.undoStack.set(s.slice(0, -1));
    await this.state.refreshTimetable();
    await this.loadGrid();
    this.toasts.info('ย้อนกลับแล้ว');
  }

  async checkNow() {
    await this.state.refreshTimetable();
    const passed = this.state.validationPassed();
    if (passed) this.toasts.success('ผ่านครบทุกเงื่อนไข');
    else this.toasts.error('พบเงื่อนไขที่ไม่ผ่าน');
  }
}
