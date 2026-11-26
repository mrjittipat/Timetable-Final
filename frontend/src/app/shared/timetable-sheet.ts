import { Component, HostListener, computed, input, output, signal } from '@angular/core';
import { Grid, GridSpan, View } from '../core/models';

@Component({
  selector: 'app-timetable-sheet',
  standalone: true,
  template: `
    @if (grid(); as g) {
      @if (useCards()) {
        <div class="day-pills">
          @for (d of g.days; track d.key; let i = $index) {
            <button type="button" [class.active]="selectedDay() === i" (click)="selectedDay.set(i)">
              {{ d.label }} ({{ g.cells[i]?.length || 0 }})
            </button>
          }
          <button type="button" [class.active]="selectedDay() === -1" (click)="selectedDay.set(-1)">ทุกวัน</button>
        </div>
        <div class="agenda-list">
          @for (d of g.days; track d.key; let di = $index) {
            @if (selectedDay() === -1 || selectedDay() === di) {
              <div class="agenda-day">
                <div class="agenda-day-head">วัน{{ d.label }}</div>
                @if ((g.cells[di]?.length || 0) === 0) {
                  <div class="muted small" style="padding: 10px 14px">ไม่มีคาบเรียน</div>
                }
                @for (sp of g.cells[di]; track sp.start + '-' + sp.subject_id) {
                  <button type="button" class="agenda-card" [class.hl]="isMatch(sp)" [class.dim]="hasSearch() && !isMatch(sp)"
                          [class.clash]="sp.clash" (click)="spanClick.emit({ day: d.key, dayLabel: d.label, span: sp })">
                    <div class="agenda-time">คาบ {{ sp.span > 1 ? sp.start + '–' + (sp.start + sp.span - 1) : sp.start }}</div>
                    <div class="agenda-info">
                      <div class="code">{{ sp.display_code || sp.subject_id }}@if (sp.subject_name && sp.subject_name !== (sp.display_code || sp.subject_id)) { · {{ sp.subject_name }} }</div>
                      <div class="meta">{{ whoText(sp) }} @if (view() !== 'room') { @if (whoText(sp)) { · } {{ sp.room_name || sp.room }} }</div>
                    </div>
                  </button>
                }
              </div>
            }
          }
        </div>
      } @else {
        <div class="sheet-wrap">
          <table class="tt-table">
            <thead>
              <tr>
                <th class="day-col">วัน / เวลา</th>
                @for (p of g.periods; track p.period) {
                  <th [class.break-hdr]="p.isBreak">
                    <div class="p-num">คาบ {{ p.period }}</div>
                    <div class="p-time">{{ p.start }}-{{ p.end }}</div>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (d of g.days; track d.key; let di = $index) {
                <tr>
                  <td class="day-cell">{{ d.label }}</td>
                  @for (cell of rowCells(g, di); track $index) {
                    @if (cell.isBreak) {
                      <td class="break-cell">พัก</td>
                    } @else if (cell.span) {
                      <td [attr.colspan]="cell.span.span" class="span-td">
                        <button type="button" class="span-btn"
                                [class.clash]="cell.span.clash"
                                [class.hl]="isMatch(cell.span)"
                                [class.dim]="hasSearch() && !isMatch(cell.span)"
                                (click)="spanClick.emit({ day: d.key, dayLabel: d.label, span: cell.span })">
                          <span class="s-code">{{ cell.span.display_code || cell.span.subject_id }}</span>
                          @if (cell.span.span > 1 && cell.span.subject_name !== (cell.span.display_code || cell.span.subject_id)) {
                            <span class="s-name">{{ cell.span.subject_name }}</span>
                          }
                          @if (whoText(cell.span)) {
                            <span class="s-meta">{{ whoText(cell.span) }}</span>
                          }
                          @if (view() !== 'room') {
                            <span class="s-room">{{ cell.span.room_name || cell.span.room }}</span>
                          }
                        </button>
                      </td>
                    } @else if (isExecMeetingCell(d.key, cell.period)) {
                      <td class="exec-cell" title="เวลาประชุมอาจารย์ฝ่ายบริหาร (อังคาร คาบ 1–4)">ประชุมผู้บริหาร</td>
                    } @else {
                      <td class="empty-td"></td>
                    }
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
  `,
  styles: `
    .sheet-wrap { width: 100%; overflow-x: auto; }
    .tt-table { width: 100%; border-collapse: collapse; table-layout: fixed; min-width: 780px; }
    .tt-table th, .tt-table td { border: 1px solid var(--border-strong); text-align: center; vertical-align: middle; }
    .tt-table thead th { background: var(--maroon-700); color: #fff; padding: 7px 4px; font-weight: 600; }
    .tt-table thead th.break-hdr { background: var(--maroon-600); width: 54px; }
    .tt-table thead th.day-col { width: 82px; }
    .p-num { font-size: 13px; }
    .p-time { font-size: 10.5px; opacity: 0.88; font-weight: 400; }
    .day-cell { background: var(--maroon-50); font-weight: 600; color: var(--maroon-900); padding: 8px 4px; height: 74px; }
    .break-cell { background: #f6f1f2; color: var(--text-muted); font-weight: 600; font-size: 12.5px; }
    .exec-cell {
      background: repeating-linear-gradient(45deg, #fff8e6, #fff8e6 6px, #fef0c7 6px, #fef0c7 12px);
      color: #9a5b00; font-weight: 600; font-size: 11px; height: 74px;
    }
    .empty-td { background: var(--surface); height: 74px; }
    .span-td { padding: 0; height: 74px; }
    .span-btn {
      width: 100%; height: 100%; min-height: 74px; border: none; border-radius: 0;
      background: #fffafb; padding: 5px 6px; cursor: pointer; font: inherit;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
      transition: background 0.12s;
    }
    .span-btn:hover { background: var(--maroon-50); }
    .span-btn.clash { outline: 2px dashed var(--danger); outline-offset: -2px; background: var(--danger-bg); }
    .span-btn.hl { background: #fff6db; box-shadow: inset 0 0 0 2px #d97706; }
    .span-btn.dim { opacity: 0.35; }
    .s-code { font-weight: 700; color: var(--maroon-700); font-size: 12.5px; line-height: 1.2; }
    .s-name { font-size: 11px; color: var(--text); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .s-meta { font-size: 11px; color: var(--text-muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .s-room { font-size: 10.5px; color: var(--maroon-600); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .day-pills { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 10px; }
    .day-pills button {
      border: 1px solid var(--border-strong); background: var(--surface); border-radius: 999px;
      padding: 6px 12px; font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap;
    }
    .day-pills button.active { background: var(--maroon-700); color: #fff; border-color: var(--maroon-700); }
    .agenda-list { display: flex; flex-direction: column; gap: 12px; }
    .agenda-day { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--surface); }
    .agenda-day-head { background: var(--maroon-50); color: var(--maroon-900); font-weight: 600; padding: 8px 14px; font-size: 13.5px; }
    .agenda-card {
      width: 100%; text-align: left; border: none; border-top: 1px solid var(--border);
      background: var(--surface); padding: 10px 14px; display: flex; gap: 12px; align-items: center;
      cursor: pointer; font: inherit;
    }
    .agenda-card.hl { background: #fff6db; }
    .agenda-card.dim { opacity: 0.35; }
    .agenda-time { min-width: 72px; font-weight: 700; color: var(--maroon-700); font-size: 13px; }
    .agenda-info .code { font-weight: 600; font-size: 13.5px; }
    .agenda-info .meta { font-size: 12px; color: var(--text-muted); }
  `,
})
export class TimetableSheetComponent {
  grid = input<Grid | null>(null);
  view = input<View>('group');
  displayMode = input<'auto' | 'table' | 'cards'>('auto');
  search = input<string>('');
  highlightExecMeeting = input<boolean>(false);
  spanClick = output<{ day: string; dayLabel: string; span: GridSpan }>();

  winWidth = signal(typeof window !== 'undefined' ? window.innerWidth : 1200);
  selectedDay = signal(0);

  @HostListener('window:resize')
  onResize() {
    this.winWidth.set(window.innerWidth);
  }

  useCards = computed(() => {
    const m = this.displayMode();
    return m === 'cards' || (m === 'auto' && this.winWidth() <= 768);
  });

  hasSearch = computed(() => this.search().trim().length > 0);

  isMatch(sp: GridSpan): boolean {
    const q = this.search().trim().toLowerCase();
    if (!q) return false;
    const hay = `${sp.subject_id} ${sp.subject_name} ${sp.teacher} ${sp.room} ${sp.room_name || ''} ${(sp.group_labels || []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  }

  whoText(sp: GridSpan): string {
    const v = this.view();
    if (v === 'group') return sp.teacher;
    if (v === 'teacher') return (sp.group_labels || sp.groups).join('+');
    return `${(sp.group_labels || sp.groups).join('+')} · ${sp.teacher}`;
  }

  isExecMeetingCell(dayKey: string, period?: number): boolean {
    return this.highlightExecMeeting() && dayKey === 'Tue' && period != null && period >= 1 && period <= 4;
  }

  rowCells(g: Grid, dayIdx: number) {
    const map = new Map<number, GridSpan>();
    const covered = new Set<number>();
    for (const sp of g.cells[dayIdx] || []) {
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
}
