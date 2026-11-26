import { Component, HostListener, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { AppState } from '../../core/state';
import { AuthService } from '../../core/auth';
import { Toasts } from '../../core/toast';
import { Confirm } from '../../core/confirm';
import { EntityRef, OutputRow, ValidationResult } from '../../core/models';
import { IconComponent } from '../../shared/icon';

interface DraftSpan {
  start: number;
  span: number;
  subject_id: string;
  display_code: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  room_id: string;
  room_name: string;
  isElectiveCohort?: boolean;
}

interface PaletteItem {
  subject_id: string;
  display_code: string;
  subject_name: string;
  required: number;
  placed: number;
  defaultTeacherId: string;
  defaultRoomId: string;
  group_type: string;
  special_mode: string;
}

const DAYS = [
  { key: 'Mon', label: 'จันทร์' },
  { key: 'Tue', label: 'อังคาร' },
  { key: 'Wed', label: 'พุธ' },
  { key: 'Thu', label: 'พฤหัสบดี' },
  { key: 'Fri', label: 'ศุกร์' },
];

const PERIODS = [
  { period: 1, start: '08:00', end: '09:00', isBreak: false },
  { period: 2, start: '09:00', end: '10:00', isBreak: false },
  { period: 3, start: '10:00', end: '11:00', isBreak: false },
  { period: 4, start: '11:00', end: '12:00', isBreak: false },
  { period: 5, start: '12:00', end: '13:00', isBreak: true },
  { period: 6, start: '13:00', end: '14:00', isBreak: false },
  { period: 7, start: '14:00', end: '15:00', isBreak: false },
  { period: 8, start: '15:00', end: '16:00', isBreak: false },
  { period: 9, start: '16:00', end: '17:00', isBreak: false },
];

@Component({
  selector: 'app-manual',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="page">
      <!-- Page Header + Seed Bar -->
      <div class="page-head">
        <div>
          <div class="eyebrow">จัดตารางสอนด้วยมือ (อิสระ)</div>
          <h1>สตูดิโอจัดตารางสอนด้วยมือ</h1>
          <p>เลือกรายวิชาจากฝั่งขวาเพื่อลากวางหรือคลิกวางลงตาราง (สีเขียว = วางได้ไม่ผิดเงื่อนไข · สีส้ม/แดง = เตือนข้อขัดแย้ง)</p>
        </div>
        <div class="row">
          <select class="input" style="width: 220px" [ngModel]="groupId()" (ngModelChange)="pickGroup($event)">
            @for (g of groups(); track g.id) {
              <option [value]="g.id">{{ g.title }}</option>
            }
          </select>
          <button class="btn sm" type="button" [disabled]="undoStack().length === 0" (click)="undo()">
            <app-icon name="undo" [size]="15" /> ย้อนกลับ ({{ undoStack().length }})
          </button>
          <button class="btn sm" type="button" (click)="validateDraft()">ตรวจเงื่อนไข (10 ข้อ)</button>
          @if (auth.isAdmin()) {
            <button class="btn primary" type="button" [disabled]="saving()" (click)="saveDraft()">
              <app-icon name="check" [size]="16" /> {{ saving() ? 'กำลังบันทึก…' : 'บันทึกตารางใช้งานจริง' }}
            </button>
          }
        </div>
      </div>

      <!-- Top Seed & Status Strip -->
      <div class="seed-bar card">
        <div class="row" style="gap: 12px; width: 100%">
          <div class="seed-chip">
            <span class="small muted">Seed ตารางปัจจุบัน</span>
            <strong class="mono seed-val">{{ currentSeed() ?? '-' }}</strong>
            @if (isSnapshot()) {
              <span class="badge">Snapshot จากการแก้ไข</span>
            }
            @if (dirty()) {
              <span class="badge warning">มีการแก้ไขใหม่ (กดบันทึกเพื่ออัปเดต Seed)</span>
            }
          </div>
          <button class="btn sm ghost" type="button" [disabled]="!currentSeed()" (click)="copySeed()">คัดลอก Seed</button>
          @if (auth.isAdmin() && currentSeed()) {
            <button class="btn sm" type="button" (click)="saveCurrentSeed()">+ บันทึก Seed</button>
          }
          <span class="spacer"></span>
          @if (validation(); as val) {
            <span class="badge" [class.success]="val.passed" [class.danger]="!val.passed">
              {{ val.passed ? '✓ ผ่านครบทุกเงื่อนไข' : '✗ ไม่ผ่าน ' + failedCount(val) + ' เงื่อนไข' }}
            </span>
          }
          @if (auth.isAdmin()) {
            <button class="btn sm ghost" type="button" (click)="reloadSaved()">โหลดตารางที่บันทึกไว้</button>
            <button class="btn sm ghost" style="color: var(--danger)" type="button" (click)="clearCurrentGroup()">ล้างเฉพาะกลุ่มนี้</button>
            <button class="btn sm ghost" style="color: var(--danger)" type="button" (click)="clearAll()">เริ่มจากตารางเปล่า</button>
          }
        </div>
      </div>

      <!-- 2-Column Workspace: Grid Left, Subject Palette Right -->
      <div class="manual-layout">
        <!-- LEFT: Interactive Timetable Grid -->
        <div class="grid-col">
          <div class="card">
            <div class="card-head">
              <div>
                <h3>{{ currentGroupTitle() }}</h3>
                <div class="small muted">
                  @if (selectedSub(); as sb) {
                    กำลังถือวิชา: <strong style="color: var(--maroon-700)">{{ sb.display_code }} {{ sb.subject_name }}</strong> ({{ brushSpan() }} คาบ) — คลิกหรือวางลงช่องตารางได้เลย
                    <button type="button" class="btn sm ghost" style="margin-left: 6px" (click)="selectedSubId.set(null)">ยกเลิกการเลือก</button>
                  } @else {
                    เลือกวิชาฝั่งขวาเพื่อวางลงตาราง หรือลากบล็อกคาบในตารางเพื่อย้าย/สลับ
                  }
                </div>
              </div>
              <div class="legend">
                <span class="lg-dot ok"></span> วางได้ไม่ผิดเงื่อนไข
                <span class="lg-dot warn"></span> ผิดเงื่อนไข/ชน
              </div>
            </div>

            <div class="card-body" style="padding: 12px">
              <div class="table-wrap">
                <table class="m-table">
                  <thead>
                    <tr>
                      <th>วัน / เวลา</th>
                      @for (p of periods; track p.period) {
                        <th [class.brk]="p.isBreak">
                          <div>คาบ {{ p.period }}</div>
                          <div class="p-time">{{ p.start }}-{{ p.end }}</div>
                        </th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (d of days; track d.key; let di = $index) {
                      <tr>
                        <td class="m-day">{{ d.label }}</td>
                        @for (cell of rowCells(di); track $index) {
                          @if (cell.isBreak) {
                            <td class="m-brk">พัก</td>
                          } @else if (cell.span) {
                            <td [attr.colspan]="cell.span.span" class="m-span-td"
                                [class.cell-ok]="cellStatus(d.key, cell.period) === 'ok'"
                                [class.cell-bad]="cellStatus(d.key, cell.period) === 'bad'"
                                [title]="cellConflictText(d.key, cell.period)"
                                (dragover)="$event.preventDefault()"
                                (drop)="onCellDrop(d.key, cell.period)"
                                (click)="onSpanClick(d.key, d.label, cell.span)">
                              <div class="m-span"
                                   [class.dragging]="isDraggingSpan(d.key, cell.span.start)"
                                   [attr.draggable]="auth.isAdmin() && !cell.span.isElectiveCohort"
                                   (dragstart)="onSpanDragStart($event, d.key, cell.span)"
                                   (dragend)="onDragEnd()">
                                @if (auth.isAdmin() && !cell.span.isElectiveCohort) {
                                  <button type="button" class="del-x" title="ลบช่วงคาบนี้"
                                          (click)="$event.stopPropagation(); removeSpan(d.key, cell.span)">×</button>
                                }
                                <div class="code">{{ cell.span.display_code }}</div>
                                @if (cell.span.span > 1 && cell.span.subject_name !== cell.span.display_code) {
                                  <div class="name">{{ cell.span.subject_name }}</div>
                                }
                                @if (cell.span.teacher_name) {
                                  <div class="meta">{{ cell.span.teacher_name }}</div>
                                }
                                <div class="room">{{ cell.span.room_name }}</div>
                              </div>
                            </td>
                          } @else {
                            <td class="m-empty"
                                [class.cell-ok]="cellStatus(d.key, cell.period) === 'ok'"
                                [class.cell-bad]="cellStatus(d.key, cell.period) === 'bad'"
                                [title]="cellConflictText(d.key, cell.period)"
                                (dragover)="$event.preventDefault()"
                                (drop)="onCellDrop(d.key, cell.period)"
                                (click)="onCellClick(d.key, cell.period)">
                              @if (cellStatus(d.key, cell.period) === 'ok') {
                                <span class="hint-ok">วางได้ ✓</span>
                              } @else if (cellStatus(d.key, cell.period) === 'bad') {
                                <span class="hint-bad">ชน ✗</span>
                              }
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

          <!-- Live Validation Details -->
          @if (validation(); as val) {
            <div class="card">
              <div class="card-head">
                <h3>ผลตรวจเงื่อนไขแบบเรียลไทม์</h3>
                <span class="badge" [class.success]="val.passed" [class.danger]="!val.passed">
                  {{ val.passed ? 'ผ่านครบทุกข้อ' : 'ไม่ผ่าน ' + failedCount(val) + ' ข้อ' }}
                </span>
              </div>
              <div class="card-body" style="display: flex; flex-direction: column; gap: 6px">
                @for (ch of val.checks; track ch.id) {
                  @if (ch.enabled && !ch.passed) {
                    <div class="alert danger" style="padding: 8px 12px; font-size: 12.5px">
                      <div>
                        <strong>{{ ch.id }} — {{ ch.name }} ({{ ch.violationCount }})</strong>
                        @for (v of ch.violations.slice(0, 5); track $index) {
                          <div>• {{ v }}</div>
                        }
                      </div>
                    </div>
                  }
                }
                @if (val.passed) {
                  <div class="alert success" style="padding: 8px 12px; font-size: 13px">
                    ตารางฉบับร่างผ่านครบทุกเงื่อนไข (I0 และ ข้อ 1–10) พร้อมบันทึกใช้งานจริง
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- RIGHT: Subject Palette & Brush Controls -->
        <aside class="palette-col">
          <div class="card palette-card">
            <div class="card-head">
              <div>
                <h3>รายวิชาของกลุ่มนี้</h3>
                <div class="small muted">จัดแล้ว {{ groupPlacedTotal() }} / {{ groupRequiredTotal() }} คาบ</div>
              </div>
            </div>

            <div class="card-body" style="display: flex; flex-direction: column; gap: 10px; padding: 14px">
              <!-- Brush Controls when a subject is selected -->
              @if (selectedSub(); as sb) {
                <div class="brush-box">
                  <div class="row" style="justify-content: space-between">
                    <strong style="color: var(--maroon-700); font-size: 13px">{{ sb.display_code }}</strong>
                    <span class="badge" [class.success]="sb.placed >= sb.required" [class.warning]="sb.placed < sb.required">
                      {{ sb.placed }}/{{ sb.required }} คาบ
                    </span>
                  </div>
                  <div class="small" style="margin-bottom: 6px">{{ sb.subject_name }}</div>

                  <div class="field">
                    <label class="small">จำนวนคาบติดกันที่วาง</label>
                    <div class="segmented">
                      @for (n of [1, 2, 3, 4]; track n) {
                        <button type="button" [class.active]="brushSpan() === n" (click)="brushSpan.set(n)">{{ n }} คาบ</button>
                      }
                    </div>
                  </div>

                  <div class="field">
                    <label class="small">อาจารย์ผู้สอน</label>
                    <select class="input" style="min-height: 32px; font-size: 12.5px" [(ngModel)]="brushTeacherId">
                      @if (sb.defaultTeacherId && sb.defaultTeacherId.includes('+')) {
                        <option [value]="sb.defaultTeacherId">สอนร่วม: {{ teacherLabel(sb.defaultTeacherId) }}</option>
                      }
                      <option value="-">— ไม่ระบุ —</option>
                      @for (t of allTeachers(); track t['teacher_id']) {
                        <option [value]="t['teacher_id']">{{ t['teacher_id'] }} {{ t['teacher_name'] }}</option>
                      }
                    </select>
                  </div>

                  <div class="field">
                    <label class="small">ห้องเรียน / สนาม</label>
                    <select class="input" style="min-height: 32px; font-size: 12.5px" [(ngModel)]="brushRoomId">
                      @if (sb.defaultRoomId && sb.defaultRoomId.includes('+')) {
                        <option [value]="sb.defaultRoomId">ควบคู่: {{ roomLabel(sb.defaultRoomId) }}</option>
                      }
                      @for (r of allRooms(); track r['room_id']) {
                        <option [value]="r['room_id']">{{ r['room_id'] }} {{ r['room_name'] }} ({{ r['room_type'] }})</option>
                      }
                    </select>
                  </div>
                </div>
              }

              <input class="input" style="min-height: 34px; font-size: 13px" [(ngModel)]="palSearch" placeholder="ค้นหารายวิชา…" />
              <div class="segmented" style="width: 100%">
                <button type="button" style="flex: 1" [class.active]="palFilter() === 'all'" (click)="palFilter.set('all')">ทั้งหมด</button>
                <button type="button" style="flex: 1" [class.active]="palFilter() === 'todo'" (click)="palFilter.set('todo')">ยังไม่ครบ</button>
                <button type="button" style="flex: 1" [class.active]="palFilter() === 'done'" (click)="palFilter.set('done')">ครบแล้ว</button>
              </div>

              <div class="pal-list">
                @for (item of filteredPalette(); track item.subject_id) {
                  <div class="pal-item"
                       [class.selected]="selectedSubId() === item.subject_id"
                       [class.done]="item.placed >= item.required"
                       [attr.draggable]="auth.isAdmin()"
                       (click)="selectPaletteItem(item)"
                       (dragstart)="onPaletteDragStart($event, item)"
                       (dragend)="onDragEnd()">
                    <div class="row" style="justify-content: space-between; gap: 6px">
                      <span class="pal-code">{{ item.display_code }}</span>
                      <span class="badge" [class.success]="item.placed === item.required" [class.warning]="item.placed < item.required" [class.danger]="item.placed > item.required">
                        {{ item.placed }}/{{ item.required }}
                      </span>
                    </div>
                    <div class="pal-name">{{ item.subject_name }}</div>
                    <div class="pal-meta">{{ teacherLabel(item.defaultTeacherId) }} · {{ roomLabel(item.defaultRoomId) }}</div>
                  </div>
                }
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <!-- Span Detail & Edit Modal -->
    @if (activeSpan(); as detail) {
      <div class="scrim" (click)="activeSpan.set(null)">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-head">
            <h3>รายละเอียดคาบเรียน</h3>
            <button class="btn icon ghost" type="button" (click)="activeSpan.set(null)"><app-icon name="x" [size]="18" /></button>
          </div>
          <div class="dialog-body">
            <div><strong>รายวิชา:</strong> {{ detail.span.display_code }}@if (detail.span.subject_name && detail.span.subject_name !== detail.span.display_code) { — {{ detail.span.subject_name }} }</div>
            <div><strong>เวลา:</strong> วัน{{ detail.dayLabel }} คาบ {{ detail.span.start }}@if (detail.span.span > 1) { –{{ detail.span.start + detail.span.span - 1 }} } ({{ detail.span.span }} คาบ)</div>
            <div><strong>อาจารย์ผู้สอน:</strong> {{ detail.span.teacher_name }}</div>

            @if (auth.isAdmin() && detail.span.isElectiveCohort && electiveEditItems().length > 0) {
              <div class="edit-box">
                <div style="font-weight: 600; margin-bottom: 8px">แก้ไขห้อง/สนามของรายวิชาทางเลือกในชุดนี้ ({{ electiveEditItems().length }} วิชา)</div>
                <div style="display: flex; flex-direction: column; gap: 10px; max-height: 280px; overflow-y: auto; padding-right: 4px">
                  @for (el of electiveEditItems(); track el.subject_id) {
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px">
                      <div style="font-weight: 600; font-size: 12.5px; margin-bottom: 6px">{{ el.subject_id }} {{ el.subject_name }}</div>
                      <div class="grid-2">
                        <div class="field">
                          <label>ห้องหลัก</label>
                          <select class="input" [(ngModel)]="el.room1">
                            @for (r of allRooms(); track r['room_id']) {
                              <option [value]="r['room_id']">{{ r['room_name'] }} ({{ r['room_id'] }})</option>
                            }
                          </select>
                        </div>
                        <div class="field">
                          <label>สนาม / ห้องเสริม</label>
                          <select class="input" [(ngModel)]="el.room2">
                            <option value="">— ไม่มี —</option>
                            @for (r of allRooms(); track r['room_id']) {
                              <option [value]="r['room_id']">{{ r['room_name'] }} ({{ r['room_id'] }})</option>
                            }
                          </select>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            } @else if (auth.isAdmin() && !detail.span.isElectiveCohort) {
              <div class="edit-box">
                <div style="font-weight: 600; margin-bottom: 8px">แก้ไขข้อมูลคาบเรียน</div>
                <div class="grid-2">
                  <div class="field">
                    <label>ห้อง / สนามหลัก</label>
                    <select class="input" [(ngModel)]="editRoom1">
                      @for (r of allRooms(); track r['room_id']) {
                        <option [value]="r['room_id']">{{ r['room_name'] }} ({{ r['room_id'] }})</option>
                      }
                    </select>
                  </div>
                  <div class="field">
                    <label>สนาม / ห้องเสริม (ถ้ามี)</label>
                    <select class="input" [(ngModel)]="editRoom2">
                      <option value="">— ไม่มี —</option>
                      @for (r of allRooms(); track r['room_id']) {
                        <option [value]="r['room_id']">{{ r['room_name'] }} ({{ r['room_id'] }})</option>
                      }
                    </select>
                  </div>
                  <div class="field" style="grid-column: 1 / -1">
                    <label>กลุ่มเรียน</label>
                    <select class="input" [(ngModel)]="editGroupId">
                      @for (g of groups(); track g.id) {
                        <option [value]="g.id">{{ g.title }}</option>
                      }
                    </select>
                  </div>
                </div>
              </div>
            } @else {
              <div><strong>ห้อง/สนาม:</strong> {{ detail.span.room_name }}</div>
              <div><strong>กลุ่มเรียน:</strong> {{ currentGroupTitle() }}</div>
            }
          </div>
          <div class="dialog-foot">
            @if (auth.isAdmin() && detail.span.isElectiveCohort && electiveEditItems().length > 0) {
              <button class="btn" type="button" (click)="activeSpan.set(null)">ปิด</button>
              <button class="btn primary" type="button" (click)="saveElectiveEdit()">บันทึกการแก้ไขชุดวิชาทางเลือก</button>
            } @else if (auth.isAdmin() && !detail.span.isElectiveCohort) {
              <button class="btn danger sm" type="button" (click)="removeSpan(detail.day, detail.span); activeSpan.set(null)">ลบคาบนี้</button>
              <span class="spacer"></span>
              <button class="btn" type="button" (click)="activeSpan.set(null)">ปิด</button>
              <button class="btn primary" type="button" (click)="saveSpanEdit()">บันทึกการแก้ไข</button>
            } @else {
              <button class="btn" type="button" (click)="activeSpan.set(null)">ปิด</button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .seed-bar { padding: 12px 16px; }
    .seed-chip { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .seed-val { font-size: 16px; background: var(--maroon-100); color: var(--maroon-700); padding: 2px 10px; border-radius: 8px; }

    .manual-layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; }
    .grid-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .palette-col { position: sticky; top: calc(var(--header-h) + 14px); }
    .palette-card { max-height: calc(100vh - var(--header-h) - 28px); display: flex; flex-direction: column; }
    .pal-list { display: flex; flex-direction: column; gap: 7px; overflow-y: auto; max-height: 440px; padding-right: 2px; }
    .pal-item {
      border: 1.5px solid var(--border); border-radius: 10px; padding: 9px 11px;
      background: var(--surface); cursor: pointer; transition: border-color 0.14s, background 0.14s;
    }
    .pal-item:hover { border-color: var(--maroon-600); background: var(--maroon-50); }
    .pal-item.selected { border-color: var(--maroon-700); background: var(--maroon-50); box-shadow: 0 0 0 2px rgba(128, 0, 32, 0.15); }
    .pal-item.done { opacity: 0.78; }
    .pal-code { font-weight: 700; color: var(--maroon-700); font-size: 12.5px; }
    .pal-name { font-size: 12.5px; font-weight: 500; margin-top: 2px; }
    .pal-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .brush-box {
      background: var(--maroon-50); border: 1.5px solid var(--maroon-200); border-radius: 10px;
      padding: 10px 12px; display: flex; flex-direction: column; gap: 8px;
    }

    .legend { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--text-muted); }
    .lg-dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
    .lg-dot.ok { background: #dcfce7; border: 1.5px solid #16a34a; }
    .lg-dot.warn { background: #fef3c7; border: 1.5px solid #d97706; }

    .m-table { width: 100%; border-collapse: collapse; table-layout: fixed; min-width: 740px; }
    .m-table th, .m-table td { border: 1px solid var(--border-strong); text-align: center; vertical-align: middle; }
    .m-table thead th { background: var(--maroon-700); color: #fff; padding: 7px 4px; width: 10%; font-size: 12.5px; }
    .m-table thead th.brk { background: var(--maroon-600); }
    .p-time { font-size: 10px; font-weight: 400; opacity: 0.88; }
    .m-day { background: var(--maroon-50); font-weight: 600; height: 76px; font-size: 13px; }
    .m-brk { background: #f6f1f2; color: var(--text-muted); font-weight: 600; font-size: 12px; }
    .m-empty { height: 76px; background: var(--surface); cursor: pointer; position: relative; transition: background 0.12s; }
    .m-span-td { padding: 0; height: 76px; position: relative; }
    .m-span {
      height: 100%; min-height: 76px; padding: 5px 6px; background: #fffafb; cursor: grab;
      display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;
    }
    .m-span.dragging { opacity: 0.4; }
    .m-span .code { font-weight: 700; color: var(--maroon-700); font-size: 12px; line-height: 1.2; }
    .m-span .name { font-size: 10.5px; color: var(--text); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .m-span .meta { font-size: 10.5px; color: var(--text-muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .m-span .room { font-size: 10px; color: var(--maroon-600); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .del-x {
      position: absolute; top: 2px; right: 3px; width: 18px; height: 18px; border-radius: 50%;
      border: none; background: rgba(180, 35, 24, 0.12); color: var(--danger);
      font-size: 13px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .del-x:hover { background: var(--danger); color: #fff; }

    .cell-ok { background: #dcfce7 !important; box-shadow: inset 0 0 0 2px #16a34a; }
    .cell-bad { background: #fef3c7 !important; box-shadow: inset 0 0 0 1.5px #d97706; }
    .hint-ok { font-size: 10.5px; font-weight: 700; color: #15803d; }
    .hint-bad { font-size: 10.5px; font-weight: 700; color: #b45309; }

    @media (max-width: 1120px) {
      .manual-layout { grid-template-columns: 1fr; }
      .palette-col { position: static; }
    }
  `,
})
export class ManualPage implements OnInit {
  private api = inject(Api);
  state = inject(AppState);
  auth = inject(AuthService);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);

  qGroup = input<string | undefined>(undefined, { alias: 'group' });

  days = DAYS;
  periods = PERIODS;

  groups = signal<EntityRef[]>([]);
  groupId = signal('');
  draftRows = signal<OutputRow[]>([]);
  undoStack = signal<OutputRow[][]>([]);
  validation = signal<ValidationResult | null>(null);
  draftSeed = signal<number | null>(null);
  dirty = signal(false);
  saving = signal(false);

  // Brush & Palette state
  selectedSubId = signal<string | null>(null);
  brushSpan = signal<number>(1);
  brushTeacherId = '-';
  brushRoomId = '';
  palSearch = '';
  palFilter = signal<'all' | 'todo' | 'done'>('all');

  // Dragging state (either from palette or an existing span on the grid)
  dragMode = signal<'none' | 'palette' | 'span'>('none');
  dragSpanInfo = signal<{ day: string; span: DraftSpan } | null>(null);

  // Span detail/edit modal state
  activeSpan = signal<{ day: string; dayLabel: string; span: DraftSpan } | null>(null);
  editRoom1 = '';
  editRoom2 = '';
  editGroupId = '';
  electiveEditItems = signal<{ subject_id: string; subject_name: string; room1: string; room2: string }[]>([]);

  currentSeed = computed(() =>
    this.dirty() && this.draftSeed() !== null
      ? this.draftSeed()
      : (this.state.timetable()?.meta?.stats?.seed ?? null)
  );
  isSnapshot = computed(() => Boolean(this.dirty() || this.state.timetable()?.meta?.stats?.isSnapshot));
  currentGroupTitle = computed(() => this.groups().find((g) => g.id === this.groupId())?.title || this.groupId());

  allTeachers = computed(() => this.state.data()?.data?.['teacher'] || []);
  allRooms = computed(() => this.state.data()?.data?.['room'] || []);
  allSubjects = computed(() => this.state.data()?.data?.['subject'] || []);
  allTimeslots = computed(() => this.state.data()?.data?.['timeslot'] || []);

  private slotByDayPeriod = computed(() => {
    const m = new Map<string, string>();
    for (const ts of this.allTimeslots()) m.set(`${ts['day']}|${ts['period']}`, ts['timeslot_id']);
    return m;
  });

  private slotInfoById = computed(() => {
    const m = new Map<string, { day: string; period: number }>();
    for (const ts of this.allTimeslots()) m.set(ts['timeslot_id'], { day: ts['day'], period: Number(ts['period']) });
    return m;
  });

  private teacherMap = computed(() => new Map(this.allTeachers().map((t) => [t['teacher_id'], t])));
  private roomMap = computed(() => new Map(this.allRooms().map((r) => [r['room_id'], r])));
  private subjectMap = computed(() => new Map(this.allSubjects().map((s) => [s['subject_id'], s])));
  private groupMap = computed(() => new Map((this.state.data()?.data?.['student_group'] || []).map((g) => [g['group_id'], g])));

  private teachBySubject = computed(() => {
    const m = new Map<string, string[]>();
    for (const row of this.state.data()?.data?.['teach'] || []) {
      const sid = row['subject_id'];
      if (!m.has(sid)) m.set(sid, []);
      m.get(sid)!.push(row['teacher_id']);
    }
    return m;
  });

  paletteItems = computed<PaletteItem[]>(() => {
    const gid = this.groupId();
    const g = this.groupMap().get(gid);
    if (!g) return [];
    const regs = (this.state.data()?.data?.['register'] || []).filter((r) => r['group_id'] === gid);
    const rows = this.draftRows().filter((r) => r.group_id === gid);

    const countOf = (sid: string) => rows.filter((r) => r.subject_id === sid).length;
    const sportByTag = new Map<string, string>();
    for (const rm of this.allRooms()) {
      if (rm['room_type'] === 'Sport' && rm['sport_tag']) sportByTag.set(rm['sport_tag'], rm['room_id']);
    }

    const items: PaletteItem[] = [];
    for (const reg of regs) {
      const sub = this.subjectMap().get(reg['subject_id']);
      if (!sub || sub['special_mode'] === 'practicum_y4') continue;
      const req = (Number(sub['theory']) || 0) + (Number(sub['practice']) || 0);
      const tIds = this.teachBySubject().get(sub['subject_id']) || [];
      let defRoom = g['home_room'] || 'R321';
      if (sub['group_type'] === 'นวัตกรรมและเทคโนโลยี') defRoom = 'COMP1';
      else if (sub['special_mode'] === 'combined_year') defRoom = 'HALL1';
      else if (sub['group_type'] === 'ทักษะและการสอนกีฬา' && sub['sport_tag']) {
        const sp = sportByTag.get(sub['sport_tag']);
        if (sp) defRoom = `${defRoom}+${sp}`;
      }
      items.push({
        subject_id: sub['subject_id'],
        display_code: sub['subject_id'],
        subject_name: sub['subject_name'],
        required: req,
        placed: countOf(sub['subject_id']),
        defaultTeacherId: tIds.join('+') || '-',
        defaultRoomId: defRoom,
        group_type: sub['group_type'] || '',
        special_mode: sub['special_mode'] || 'normal',
      });
    }

    // Add ADVISOR & ACTIVITY
    const advName = String(g['advisor'] || '').split('/')[0].trim();
    const advT = this.allTeachers().find((t) => t['teacher_name'] === advName)?.['teacher_id'] || '-';
    items.push({
      subject_id: 'ADVISOR',
      display_code: 'พบครูที่ปรึกษา',
      subject_name: 'พบครูที่ปรึกษา (พุธ คาบ 8)',
      required: 1,
      placed: countOf('ADVISOR'),
      defaultTeacherId: advT,
      defaultRoomId: g['home_room'] || 'R321',
      group_type: 'fixed',
      special_mode: 'fixed',
    });
    items.push({
      subject_id: 'ACTIVITY',
      display_code: 'คาบกิจกรรม',
      subject_name: 'คาบกิจกรรม (พุธ คาบ 9)',
      required: 1,
      placed: countOf('ACTIVITY'),
      defaultTeacherId: advT,
      defaultRoomId: g['home_room'] || 'R321',
      group_type: 'fixed',
      special_mode: 'fixed',
    });

    return items;
  });

  filteredPalette = computed(() => {
    const q = this.palSearch.trim().toLowerCase();
    return this.paletteItems().filter((it) => {
      if (this.palFilter() === 'todo' && it.placed >= it.required) return false;
      if (this.palFilter() === 'done' && it.placed < it.required) return false;
      if (q && !`${it.subject_id} ${it.subject_name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  selectedSub = computed(() => this.paletteItems().find((i) => i.subject_id === this.selectedSubId()) || null);
  groupPlacedTotal = computed(() => this.paletteItems().reduce((s, i) => s + i.placed, 0));
  groupRequiredTotal = computed(() => this.paletteItems().reduce((s, i) => s + i.required, 0));

  @HostListener('document:dragend')
  onDocDragEnd() {
    this.onDragEnd();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.selectedSubId.set(null);
    this.onDragEnd();
  }

  async ngOnInit() {
    if (!this.state.data()) await this.state.refresh();
    const ents = await this.api.getEntities();
    const gList = (ents.group || []).filter((g) => !g.id.startsWith('Y4_'));
    this.groups.set(gList);
    const pick = this.qGroup() && gList.some((g) => g.id === this.qGroup()) ? this.qGroup()! : (gList[0]?.id || '');
    this.groupId.set(pick);
    this.syncFromStore();
  }

  syncFromStore() {
    const rows = (this.state.timetable()?.rows || []).map((r) => ({ ...r }));
    this.draftRows.set(rows);
    this.validation.set(this.state.timetable()?.validation || null);
    this.draftSeed.set(null);
    this.dirty.set(false);
    this.undoStack.set([]);
  }

  pickGroup(id: string) {
    this.groupId.set(id);
    this.selectedSubId.set(null);
  }

  teacherLabel(raw: string) {
    if (!raw || raw === '-') return '-';
    return raw.split('+').map((id) => this.teacherMap().get(id)?.['teacher_name'] || id).join(' / ');
  }

  roomLabel(raw: string) {
    if (!raw || raw === '-') return '-';
    return raw.split('+').map((id) => this.roomMap().get(id)?.['room_name'] || id).join(' + ');
  }

  private displayCode(sid: string) {
    if (sid === 'ADVISOR') return 'พบครูที่ปรึกษา';
    if (sid === 'ACTIVITY') return 'คาบกิจกรรม';
    if (sid === 'Y2_EL') return 'วิชาทางเลือก';
    if (sid === 'Y3_EL1') return 'วิชาทางเลือก (การตัดสิน)';
    if (sid === 'Y3_EL2') return 'วิชาทางเลือก (กลวิธีการฝึก)';
    return sid;
  }

  private displaySubName(sid: string) {
    if (sid === 'ADVISOR') return 'พบครูที่ปรึกษา';
    if (sid === 'ACTIVITY') return 'คาบกิจกรรม';
    if (sid === 'Y2_EL') return 'ทักษะและการสอนกีฬาขั้นสูง';
    if (sid === 'Y3_EL1') return 'การตัดสินกีฬา';
    if (sid === 'Y3_EL2') return 'กลวิธีการฝึกกีฬา';
    return this.subjectMap().get(sid)?.['subject_name'] || sid;
  }

  private cohortBelongsToGroup(cohortId: string, gid: string) {
    const yr = this.groupMap().get(gid)?.['year'];
    if (cohortId === 'Y2_EL') return yr === 2;
    if (cohortId === 'Y3_EL1' || cohortId === 'Y3_EL2') return yr === 3;
    return false;
  }

  rowCells(dayIdx: number) {
    const dayKey = this.days[dayIdx].key;
    const gid = this.groupId();
    const byPeriod = new Map<number, DraftSpan>();

    for (const r of this.draftRows()) {
      const info = this.slotInfoById().get(r.timeslot_id);
      if (!info || info.day !== dayKey) continue;
      if (r.group_id === gid) {
        byPeriod.set(info.period, {
          start: info.period,
          span: 1,
          subject_id: r.subject_id,
          display_code: this.displayCode(r.subject_id),
          subject_name: this.displaySubName(r.subject_id),
          teacher_id: r.teacher_id,
          teacher_name: this.teacherLabel(r.teacher_id),
          room_id: r.room_id,
          room_name: this.roomLabel(r.room_id),
        });
      } else if (this.cohortBelongsToGroup(r.group_id, gid) && !byPeriod.has(info.period)) {
        byPeriod.set(info.period, {
          start: info.period,
          span: 1,
          subject_id: r.group_id,
          display_code: this.displayCode(r.group_id),
          subject_name: this.displaySubName(r.group_id),
          teacher_id: '-',
          teacher_name: 'วิชาเลือกทั้งชั้นปี',
          room_id: '-',
          room_name: 'ห้องทฤษฎี + สนามกีฬา',
          isElectiveCohort: true,
        });
      }
    }

    // Merge consecutive identical spans (never crossing break period 5)
    const spans: DraftSpan[] = [];
    for (const p of this.periods) {
      if (p.isBreak) continue;
      const cur = byPeriod.get(p.period);
      if (!cur) continue;
      const prev = spans[spans.length - 1];
      if (
        prev &&
        prev.start + prev.span === cur.start &&
        prev.subject_id === cur.subject_id &&
        prev.teacher_id === cur.teacher_id &&
        prev.room_id === cur.room_id
      ) {
        prev.span += 1;
      } else {
        spans.push(cur);
      }
    }

    const spanByStart = new Map(spans.map((s) => [s.start, s]));
    const covered = new Set<number>();
    for (const s of spans) for (let k = 0; k < s.span; k++) covered.add(s.start + k);

    const out: { period: number; isBreak?: boolean; span?: DraftSpan }[] = [];
    for (const p of this.periods) {
      if (p.isBreak) out.push({ period: p.period, isBreak: true });
      else if (spanByStart.has(p.period)) out.push({ period: p.period, span: spanByStart.get(p.period) });
      else if (!covered.has(p.period)) out.push({ period: p.period });
    }
    return out;
  }

  selectPaletteItem(item: PaletteItem) {
    this.selectedSubId.set(item.subject_id);
    const rem = Math.max(1, item.required - item.placed);
    this.brushSpan.set(Math.min(4, rem));
    this.brushTeacherId = item.defaultTeacherId;
    this.brushRoomId = item.defaultRoomId;
  }

  onPaletteDragStart(ev: DragEvent, item: PaletteItem) {
    this.selectPaletteItem(item);
    this.dragMode.set('palette');
    ev.dataTransfer?.setData('text/plain', item.subject_id);
  }

  onSpanDragStart(ev: DragEvent, day: string, span: DraftSpan) {
    this.selectedSubId.set(null);
    this.dragMode.set('span');
    this.dragSpanInfo.set({ day, span });
    ev.dataTransfer?.setData('text/plain', span.subject_id);
  }

  onDragEnd() {
    this.dragMode.set('none');
    this.dragSpanInfo.set(null);
  }

  isDraggingSpan(day: string, start: number) {
    const d = this.dragSpanInfo();
    return Boolean(this.dragMode() === 'span' && d && d.day === day && d.span.start === start);
  }

  // Real-time conflict check for placing the active brush or dragged span at (day, startPeriod)
  private checkPlacement(day: string, startPeriod: number): { ok: boolean; reasons: string[] } | null {
    const gid = this.groupId();
    let sid = '';
    let len = 1;
    let tRaw = '-';
    let rRaw = '';
    let ignoreSlotIds = new Set<string>();

    if (this.dragMode() === 'span' && this.dragSpanInfo()) {
      const info = this.dragSpanInfo()!;
      sid = info.span.subject_id;
      len = info.span.span;
      tRaw = info.span.teacher_id;
      rRaw = info.span.room_id;
      for (let k = 0; k < len; k++) {
        const ts = this.slotByDayPeriod().get(`${info.day}|${info.span.start + k}`);
        if (ts) ignoreSlotIds.add(ts);
      }
    } else if (this.selectedSub()) {
      const sb = this.selectedSub()!;
      sid = sb.subject_id;
      len = this.brushSpan();
      tRaw = this.brushTeacherId;
      rRaw = this.brushRoomId;
    } else {
      return null;
    }

    const reasons: string[] = [];
    const targetSlotIds: string[] = [];
    const isFixed = sid === 'ADVISOR' || sid === 'ACTIVITY';

    for (let k = 0; k < len; k++) {
      const p = startPeriod + k;
      if (p > 9) { reasons.push('เกินคาบที่ 9'); break; }
      if (p === 5) { reasons.push('ทับคาบพักเที่ยง (คาบ 5)'); break; }
      if (!isFixed && day === 'Wed' && (p === 8 || p === 9)) {
        reasons.push('ทับคาบพบครูที่ปรึกษา/กิจกรรม (พุธ คาบ 8–9)');
      }
      if (sid === 'ADVISOR' && !(day === 'Wed' && p === 8)) reasons.push('พบครูที่ปรึกษาต้องอยู่พุธ คาบ 8');
      if (sid === 'ACTIVITY' && !(day === 'Wed' && p === 9)) reasons.push('คาบกิจกรรมต้องอยู่พุธ คาบ 9');
      const ts = this.slotByDayPeriod().get(`${day}|${p}`);
      if (ts) targetSlotIds.push(ts);
    }

    const tIds = tRaw.split('+').map((s) => s.trim()).filter((s) => s && s !== '-');
    const rIds = rRaw.split('+').map((s) => s.trim()).filter((s) => s && s !== '-');

    // Executive meeting check (Tue P1-4)
    if (day === 'Tue') {
      for (let k = 0; k < len; k++) {
        const p = startPeriod + k;
        if (p >= 1 && p <= 4) {
          for (const tid of tIds) {
            if (this.teacherMap().get(tid)?.['role'] === 'Leader') {
              reasons.push(`ผู้บริหาร ${this.teacherLabel(tid)} ประชุมอังคาร คาบ 1–4`);
            }
          }
        }
      }
    }

    // Check clashes against existing draftRows
    const targetSet = new Set(targetSlotIds);
    for (const r of this.draftRows()) {
      if (!targetSet.has(r.timeslot_id)) continue;
      if (r.group_id === gid && ignoreSlotIds.has(r.timeslot_id)) continue;

      if (r.group_id === gid || this.cohortBelongsToGroup(r.group_id, gid)) {
        reasons.push(`กลุ่มนี้มีวิชา ${this.displayCode(r.subject_id)} อยู่แล้ว`);
      }
      if (!isFixed) {
        const rtIds = r.teacher_id.split('+').map((s) => s.trim()).filter((s) => s && s !== '-');
        for (const tid of tIds) {
          if (rtIds.includes(tid)) reasons.push(`${this.teacherLabel(tid)} ติดสอน ${r.group_id}`);
        }
        const rrIds = r.room_id.split('+').map((s) => s.trim()).filter((s) => s && s !== '-');
        for (const rid of rIds) {
          if (rrIds.includes(rid)) reasons.push(`ห้อง ${this.roomLabel(rid)} ถูกใช้งานโดย ${r.group_id}`);
        }
      }
    }

    const uniq = [...new Set(reasons)];
    return { ok: uniq.length === 0, reasons: uniq };
  }

  cellStatus(day: string, period: number): '' | 'ok' | 'bad' {
    const res = this.checkPlacement(day, period);
    if (!res) return '';
    return res.ok ? 'ok' : 'bad';
  }

  cellConflictText(day: string, period: number): string {
    const res = this.checkPlacement(day, period);
    if (!res) return '';
    return res.ok ? 'วางได้ ไม่ผิดเงื่อนไข' : 'ข้อขัดแย้ง: ' + res.reasons.join(' | ');
  }

  private pushUndo() {
    const snap = this.draftRows().map((r) => ({ ...r }));
    this.undoStack.update((s) => [...s.slice(-29), snap]);
  }

  onSpanClick(day: string, dayLabel: string, span: DraftSpan) {
    if (this.auth.isAdmin() && this.selectedSub()) {
      this.placeBrushAt(day, span.start);
      return;
    }
    const rParts = String(span.room_id || '').split('+').map((s) => s.trim()).filter((s) => s && s !== '-');
    this.editRoom1 = rParts[0] || '';
    this.editRoom2 = rParts[1] || '';
    this.editGroupId = this.groupId();
    if (span.isElectiveCohort) {
      const slotSet = new Set<string>();
      for (let k = 0; k < span.span; k++) {
        const ts = this.slotByDayPeriod().get(`${day}|${span.start + k}`);
        if (ts) slotSet.add(ts);
      }
      const seen = new Set<string>();
      const out: { subject_id: string; subject_name: string; room1: string; room2: string }[] = [];
      for (const r of this.draftRows()) {
        if (r.group_id !== span.subject_id || !slotSet.has(r.timeslot_id) || seen.has(r.subject_id)) continue;
        seen.add(r.subject_id);
        const rp = String(r.room_id || '').split('+').map((s) => s.trim()).filter((s) => s && s !== '-');
        out.push({
          subject_id: r.subject_id,
          subject_name: this.displaySubName(r.subject_id),
          room1: rp[0] || '',
          room2: rp[1] || '',
        });
      }
      this.electiveEditItems.set(out);
    } else {
      this.electiveEditItems.set([]);
    }
    this.activeSpan.set({ day, dayLabel, span });
  }

  saveElectiveEdit() {
    const d = this.activeSpan();
    const items = this.electiveEditItems();
    if (!d || !items.length) return;
    const slotSet = new Set<string>();
    for (let k = 0; k < d.span.span; k++) {
      const ts = this.slotByDayPeriod().get(`${d.day}|${d.span.start + k}`);
      if (ts) slotSet.add(ts);
    }
    const bySub = new Map(
      items.map((el) => [el.subject_id, [...new Set([el.room1, el.room2].filter(Boolean))].join('+')])
    );
    this.pushUndo();
    const next = this.draftRows().map((r) => {
      if (r.group_id === d.span.subject_id && slotSet.has(r.timeslot_id) && bySub.has(r.subject_id)) {
        const nr = bySub.get(r.subject_id);
        if (nr) return { ...r, room_id: nr };
      }
      return r;
    });
    this.draftRows.set(next);
    this.dirty.set(true);
    this.activeSpan.set(null);
    this.validateDraft(true);
    this.toasts.success('อัปเดตห้อง/สนามของชุดวิชาทางเลือกแล้ว (อย่าลืมกดบันทึกตารางใช้งานจริง)');
  }

  saveSpanEdit() {
    const d = this.activeSpan();
    if (!d) return;
    const roomIds = [this.editRoom1, this.editRoom2].filter(Boolean);
    if (roomIds.length === 0) {
      this.toasts.error('กรุณาเลือกห้อง/สนามอย่างน้อย 1 แห่ง');
      return;
    }
    const newRoom = [...new Set(roomIds)].join('+');
    const newGroup = this.editGroupId || this.groupId();
    const curGroup = this.groupId();
    const slotSet = new Set<string>();
    for (let k = 0; k < d.span.span; k++) {
      const ts = this.slotByDayPeriod().get(`${d.day}|${d.span.start + k}`);
      if (ts) slotSet.add(ts);
    }
    this.pushUndo();
    const next = this.draftRows().map((r) => {
      if (r.group_id === curGroup && slotSet.has(r.timeslot_id) && r.subject_id === d.span.subject_id) {
        return { ...r, room_id: newRoom, group_id: newGroup };
      }
      return r;
    });
    this.draftRows.set(next);
    this.dirty.set(true);
    this.activeSpan.set(null);
    this.validateDraft(true);
    this.toasts.success('อัปเดตข้อมูลคาบเรียนแล้ว (อย่าลืมกดบันทึกตารางใช้งานจริง)');
  }

  onCellClick(day: string, period: number) {
    if (!this.auth.isAdmin() || !this.selectedSub()) return;
    this.placeBrushAt(day, period);
  }

  onCellDrop(day: string, period: number) {
    if (!this.auth.isAdmin()) return;
    if (this.dragMode() === 'palette' && this.selectedSub()) {
      this.placeBrushAt(day, period);
    } else if (this.dragMode() === 'span' && this.dragSpanInfo()) {
      this.moveDraftSpan(this.dragSpanInfo()!, day, period);
    }
    this.onDragEnd();
  }

  private placeBrushAt(day: string, startPeriod: number) {
    const sb = this.selectedSub();
    if (!sb) return;
    const len = this.brushSpan();
    const slotIds: string[] = [];
    for (let k = 0; k < len; k++) {
      const p = startPeriod + k;
      if (p === 5 || p > 9) {
        this.toasts.error('ไม่สามารถวางคร่อมคาบพักเที่ยงหรือเกินคาบ 9 ได้');
        return;
      }
      const ts = this.slotByDayPeriod().get(`${day}|${p}`);
      if (ts) slotIds.push(ts);
    }
    this.pushUndo();
    const gid = this.groupId();
    const targetSet = new Set(slotIds);
    // Replace any existing rows of this group in the target slots
    const kept = this.draftRows().filter((r) => !(r.group_id === gid && targetSet.has(r.timeslot_id)));
    const added: OutputRow[] = slotIds.map((ts) => ({
      group_id: gid,
      timeslot_id: ts,
      subject_id: sb.subject_id,
      teacher_id: this.brushTeacherId || '-',
      room_id: this.brushRoomId || 'R321',
    }));
    this.draftRows.set([...kept, ...added]);
    this.dirty.set(true);
    this.validateDraft(true);
  }

  private moveDraftSpan(src: { day: string; span: DraftSpan }, toDay: string, toPeriod: number) {
    const len = src.span.span;
    const srcSlots: string[] = [];
    const dstSlots: string[] = [];
    for (let k = 0; k < len; k++) {
      const p1 = src.span.start + k;
      const p2 = toPeriod + k;
      if (p2 === 5 || p2 > 9) {
        this.toasts.error('ปลายทางคร่อมคาบพักเที่ยงหรือเกินคาบ 9');
        return;
      }
      const s1 = this.slotByDayPeriod().get(`${src.day}|${p1}`);
      const s2 = this.slotByDayPeriod().get(`${toDay}|${p2}`);
      if (s1) srcSlots.push(s1);
      if (s2) dstSlots.push(s2);
    }
    if (srcSlots.every((s, i) => s === dstSlots[i])) return;
    const dstSet = new Set(dstSlots);
    if (srcSlots.some((s) => dstSet.has(s))) {
      this.toasts.error('ช่วงต้นทางและปลายทางซ้อนกัน');
      return;
    }

    this.pushUndo();
    const gid = this.groupId();
    const srcToDst = new Map(srcSlots.map((s, i) => [s, dstSlots[i]]));
    const dstToSrc = new Map(dstSlots.map((s, i) => [s, srcSlots[i]]));

    const next = this.draftRows().map((r) => {
      if (r.group_id !== gid) return r;
      if (srcToDst.has(r.timeslot_id)) return { ...r, timeslot_id: srcToDst.get(r.timeslot_id)! };
      if (dstToSrc.has(r.timeslot_id)) return { ...r, timeslot_id: dstToSrc.get(r.timeslot_id)! };
      return r;
    });
    this.draftRows.set(next);
    this.dirty.set(true);
    this.validateDraft(true);
  }

  removeSpan(day: string, span: DraftSpan) {
    this.pushUndo();
    const gid = this.groupId();
    const dropSet = new Set<string>();
    for (let k = 0; k < span.span; k++) {
      const ts = this.slotByDayPeriod().get(`${day}|${span.start + k}`);
      if (ts) dropSet.add(ts);
    }
    this.draftRows.set(this.draftRows().filter((r) => !(r.group_id === gid && dropSet.has(r.timeslot_id))));
    this.dirty.set(true);
    this.validateDraft(true);
  }

  undo() {
    const stack = this.undoStack();
    if (!stack.length) return;
    this.draftRows.set(stack[stack.length - 1]);
    this.undoStack.set(stack.slice(0, -1));
    this.dirty.set(true);
    this.validateDraft(true);
  }

  async validateDraft(silent = false) {
    try {
      const res = await this.api.validateRows(this.draftRows());
      this.validation.set(res);
      if (res.draftSeed != null) this.draftSeed.set(res.draftSeed);
      if (!silent) {
        if (res.passed) this.toasts.success('ผ่านครบทุกเงื่อนไข');
        else this.toasts.error(`พบเงื่อนไขไม่ผ่าน ${this.failedCount(res)} ข้อ`);
      }
    } catch (err) {
      if (!silent) this.toasts.error(this.api.errorMessage(err));
    }
  }

  async saveDraft() {
    this.saving.set(true);
    try {
      const res = await this.api.saveTimetable(this.draftRows());
      await this.state.refreshTimetable();
      this.validation.set(res.validation);
      this.draftSeed.set(null);
      this.dirty.set(false);
      const newSeed = res.meta?.stats?.seed;
      this.toasts.success(`บันทึกตารางแล้ว (Snapshot Seed ใหม่: ${newSeed ?? '-'})`);
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  async reloadSaved() {
    await this.state.refreshTimetable();
    this.syncFromStore();
    this.toasts.info('โหลดตารางที่บันทึกไว้ล่าสุดแล้ว');
  }

  async clearCurrentGroup() {
    const ok = await this.confirm.ask({ title: 'ล้างตารางเฉพาะกลุ่มนี้', message: `ต้องการล้างคาบเรียนทั้งหมดของ ${this.currentGroupTitle()}?`, danger: true });
    if (!ok) return;
    this.pushUndo();
    const gid = this.groupId();
    this.draftRows.set(this.draftRows().filter((r) => r.group_id !== gid));
    this.dirty.set(true);
    this.validateDraft(true);
  }

  async clearAll() {
    const ok = await this.confirm.ask({ title: 'เริ่มจากตารางเปล่า', message: 'ล้างคาบเรียนของทุกกลุ่มเพื่อจัดใหม่ด้วยมือ?', danger: true });
    if (!ok) return;
    this.pushUndo();
    this.draftRows.set([]);
    this.dirty.set(true);
    this.validateDraft(true);
  }

  copySeed() {
    const s = this.currentSeed();
    if (!s) return;
    navigator.clipboard?.writeText(String(s));
    this.toasts.success(`คัดลอก Seed ${s} แล้ว`);
  }

  async saveCurrentSeed() {
    const s = this.currentSeed();
    const name = await this.confirm.prompt({ title: 'บันทึก Seed ปัจจุบัน', inputLabel: 'ชื่อ Seed', inputValue: `Manual Seed ${s}` });
    if (!name) return;
    try {
      await this.api.saveSeed({ name, seed: s });
      this.toasts.success(`บันทึก Seed ${s} เก็บไว้แล้ว`);
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  failedCount(val: ValidationResult) {
    return val.checks.filter((c) => c.enabled && !c.passed).length;
  }
}
