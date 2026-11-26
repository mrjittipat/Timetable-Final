import { Component, HostListener, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { AppState } from '../../core/state';
import { AuthService } from '../../core/auth';
import { Toasts } from '../../core/toast';
import { EntityRef, Grid, GridSpan, OutputRow, View } from '../../core/models';
import { IconComponent } from '../../shared/icon';
import { TimetableSheetComponent } from '../../shared/timetable-sheet';
import { PdfPreviewComponent } from '../../shared/pdf-preview';

@Component({
  selector: 'app-timetable',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, TimetableSheetComponent, PdfPreviewComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">ขั้นตอนที่ 3</div>
          <h1>ตารางเรียน</h1>
          <p>ดูตารางแยกตามกลุ่มเรียน อาจารย์ผู้สอน หรือห้องเรียน/สนามกีฬา พร้อมส่งออก PDF, Excel และ QR Code</p>
        </div>
        <div class="row">
          @if (auth.isAdmin() && undoStack().length > 0) {
            <button class="btn" type="button" (click)="undo()">
              <app-icon name="undo" [size]="16" /> ย้อนกลับ ({{ undoStack().length }})
            </button>
          }
          @if (auth.isAdmin() && view() === 'group' && selectedId() !== '__all__') {
            <a [routerLink]="['/manual']" [queryParams]="{ group: selectedId() }" class="btn">
              <app-icon name="move" [size]="16" /> แก้ไข / ย้ายคาบ
            </a>
          }
          @if (selectedId() !== '__all__') {
            <button class="btn" type="button" (click)="openShare()">แชร์ / QR</button>
          }
          <a class="btn" [href]="excelUrl()" download><app-icon name="download" [size]="16" /> Excel</a>
          <button class="btn primary" type="button" [disabled]="!state.hasTimetable()" (click)="openPdf()">
            <app-icon name="file" [size]="16" /> PDF / พิมพ์
          </button>
        </div>
      </div>

      <div class="card" style="overflow: visible">
        <div class="card-body" style="display: flex; flex-direction: column; gap: 12px">
          <div class="row">
            <div class="segmented">
              <button type="button" [class.active]="view() === 'group'" (click)="switchView('group')">กลุ่มเรียน</button>
              <button type="button" [class.active]="view() === 'teacher'" (click)="switchView('teacher')">อาจารย์ผู้สอน</button>
              <button type="button" [class.active]="view() === 'room'" (click)="switchView('room')">ห้อง / สนาม</button>
            </div>

            <!-- Searchable Entity Combobox -->
            <div class="row" style="flex: 1; min-width: 260px; flex-wrap: nowrap">
              <button class="btn icon sm" type="button" (click)="stepEntity(-1)" aria-label="ก่อนหน้า">‹</button>
              <div class="combo" (click)="$event.stopPropagation()">
                <button type="button" class="combo-trigger" [class.exec-selected]="selectedEntity()?.isLeader" (click)="toggleDropdown()">
                  <span class="combo-label">
                    @if (selectedId() === '__all__') {
                      — แสดงทั้งหมด ({{ allLabel() }}) —
                    } @else if (selectedEntity(); as sel) {
                      <span>{{ sel.title }}</span>
                      @if (sel.isLeader) {
                        <span class="exec-pill">ผู้บริหาร</span>
                      }
                    } @else {
                      เลือก{{ allLabel() }}
                    }
                  </span>
                  <app-icon name="chevron" [size]="16" [style.transform]="dropdownOpen() ? 'rotate(180deg)' : ''" />
                </button>

                @if (dropdownOpen()) {
                  <div class="combo-menu">
                    <div class="combo-search">
                      <app-icon name="search" [size]="15" />
                      <input type="text"
                             [ngModel]="entityQuery()"
                             (ngModelChange)="entityQuery.set($event)"
                             [placeholder]="'พิมพ์ค้นหา' + viewLabel() + (view() === 'teacher' ? ' หรือพิมพ์ ผู้บริหาร…' : '…')"
                             autofocus />
                      @if (entityQuery()) {
                        <button type="button" class="combo-clear" (click)="entityQuery.set('')" aria-label="ล้างคำค้น">×</button>
                      }
                    </div>
                    <div class="combo-list">
                      @if (!entityQuery().trim()) {
                        <button type="button" class="combo-opt" [class.active]="selectedId() === '__all__'" (click)="pickEntity('__all__')">
                          <span>— แสดงทั้งหมด ({{ allLabel() }}) —</span>
                        </button>
                      }
                      @for (e of filteredEntities(); track e.id) {
                        <button type="button" class="combo-opt"
                                [class.active]="selectedId() === e.id"
                                [class.exec-opt]="e.isLeader"
                                (click)="pickEntity(e.id)">
                          <div class="opt-main">
                            <span class="opt-title">{{ e.title }}</span>
                            @if (e.isLeader) {
                              <span class="exec-pill">ผู้บริหาร</span>
                            }
                          </div>
                          <div class="opt-sub">{{ e.subtitle }}</div>
                        </button>
                      } @empty {
                        <div class="combo-empty">ไม่พบรายการที่ตรงกับ "{{ entityQuery() }}"</div>
                      }
                    </div>
                  </div>
                }
              </div>
              <button class="btn icon sm" type="button" (click)="stepEntity(1)" aria-label="ถัดไป">›</button>
            </div>

            @if (state.timetable()?.validation; as val) {
              <a routerLink="/report" class="badge" [class.success]="val.passed" [class.danger]="!val.passed">
                {{ val.passed ? 'ผ่านทุกเงื่อนไข' : 'ไม่ผ่าน ' + failedCount(val) + ' เงื่อนไข' }}
              </a>
            }
          </div>

          <div class="row">
            <input class="input" style="max-width: 320px" [(ngModel)]="search" placeholder="ค้นหา/ไฮไลต์ วิชา อาจารย์ ห้อง สนาม ในตาราง…" />
            @if (view() === 'teacher') {
              <button type="button" class="btn sm" [class.primary]="onlyExec()" (click)="onlyExec.update(v => !v)">
                ★ เฉพาะอาจารย์ฝ่ายบริหาร (7 คน)
              </button>
            }
            <span class="spacer"></span>
            <div class="segmented">
              <button type="button" [class.active]="displayMode() === 'auto'" (click)="displayMode.set('auto')">อัตโนมัติ</button>
              <button type="button" [class.active]="displayMode() === 'table'" (click)="displayMode.set('table')">ตาราง</button>
              <button type="button" [class.active]="displayMode() === 'cards'" (click)="displayMode.set('cards')">การ์ด</button>
            </div>
          </div>
        </div>
      </div>

      @if (!state.hasTimetable() && !state.loading()) {
        <div class="card">
          <div class="empty">
            <app-icon name="calendar" [size]="36" />
            <strong>ยังไม่มีตารางเรียนในระบบ</strong>
            <a routerLink="/solve" class="btn primary">ไปหน้าจัดตารางอัตโนมัติ</a>
          </div>
        </div>
      } @else if (selectedId() === '__all__') {
        @for (g of visibleAllGrids(); track g.entity?.id) {
          <div class="card" [class.exec-card]="g.entity?.isLeader">
            <div class="card-head" [class.exec-head]="g.entity?.isLeader">
              <div>
                <div class="row" style="gap: 8px">
                  <h3>{{ g.entity?.title }}</h3>
                  @if (g.entity?.isLeader) {
                    <span class="exec-pill">ผู้บริหาร · ประชุมอังคาร คาบ 1–4</span>
                  }
                </div>
                <div class="small muted">{{ g.entity?.subtitle }} · รวม {{ g.total }} คาบ/สัปดาห์</div>
              </div>
              <button class="btn sm" type="button" (click)="pdfUrl.set(api.exportUrl('pdf', view(), g.entity?.id || '', true))">PDF</button>
            </div>
            <div class="card-body">
              <app-timetable-sheet [grid]="g" [view]="view()" [displayMode]="displayMode()" [search]="search"
                                   [highlightExecMeeting]="view() === 'teacher' && !!g.entity?.isLeader"
                                   (spanClick)="onSpanClick($event)" />
            </div>
          </div>
        }
      } @else if (singleGrid(); as g) {
        <div class="card" [class.exec-card]="g.entity?.isLeader">
          <div class="card-head" [class.exec-head]="g.entity?.isLeader">
            <div>
              <div class="row" style="gap: 8px">
                <h3>{{ g.entity?.title }}</h3>
                @if (g.entity?.isLeader) {
                  <span class="exec-pill">ผู้บริหาร · ประชุมอังคาร คาบ 1–4</span>
                }
              </div>
              <div class="small muted">{{ g.entity?.subtitle }} · รวม {{ g.total }} คาบ/สัปดาห์</div>
            </div>
          </div>
          <div class="card-body">
            <app-timetable-sheet [grid]="g" [view]="view()" [displayMode]="displayMode()" [search]="search"
                                 [highlightExecMeeting]="view() === 'teacher' && !!g.entity?.isLeader"
                                 (spanClick)="onSpanClick($event)" />
          </div>
        </div>
      }
    </div>

    <!-- Detail Modal -->
    @if (activeSpan(); as detail) {
      <div class="scrim" (click)="activeSpan.set(null)">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-head">
            <h3>รายละเอียดคาบเรียน</h3>
            <button class="btn icon ghost" type="button" (click)="activeSpan.set(null)"><app-icon name="x" [size]="18" /></button>
          </div>
          <div class="dialog-body">
            <div><strong>รายวิชา:</strong> {{ detail.span.subject_id }} {{ detail.span.subject_name }}</div>
            <div><strong>เวลา:</strong> วัน{{ detail.dayLabel }} คาบ {{ detail.span.start }}@if (detail.span.span > 1) { –{{ detail.span.start + detail.span.span - 1 }} } ({{ detail.span.span }} คาบ)</div>
            <div><strong>อาจารย์ผู้สอน:</strong> {{ detail.span.teacher }}</div>
            <div><strong>ห้อง/สนาม:</strong> {{ detail.span.room_name || detail.span.room }}</div>
            <div><strong>กลุ่มเรียน:</strong> {{ (detail.span.group_labels || detail.span.groups).join(', ') }}</div>

            @if (auth.isAdmin() && selectedId() !== '__all__' && detail.span.subject_id !== 'ADVISOR' && detail.span.subject_id !== 'ACTIVITY') {
              <div class="move-box">
                <div style="font-weight: 600; margin-bottom: 8px">ย้ายคาบไปยังช่องที่ว่าง (ไม่ผิดเงื่อนไข):</div>
                @if (loadingTargets()) {
                  <span class="small muted">กำลังค้นหาช่องที่ย้ายได้…</span>
                } @else if (moveTargets().length === 0) {
                  <span class="small muted">ไม่พบช่องว่างที่ย้ายได้โดยไม่ละเมิดเงื่อนไข</span>
                } @else {
                  <div class="row">
                    @for (t of moveTargets().slice(0, 12); track t.day + '-' + t.period) {
                      <button class="btn sm" type="button" (click)="doMove(t)">
                        วัน{{ t.dayLabel }} คาบ {{ t.period }}@if (t.isSwap) { (สลับ) }
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>
          <div class="dialog-foot">
            <button class="btn" type="button" (click)="activeSpan.set(null)">ปิด</button>
          </div>
        </div>
      </div>
    }

    <!-- Share / QR Modal -->
    @if (shareInfo(); as sh) {
      <div class="scrim" (click)="shareInfo.set(null)">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-head">
            <h3>แชร์ / QR Code</h3>
            <button class="btn icon ghost" type="button" (click)="shareInfo.set(null)"><app-icon name="x" [size]="18" /></button>
          </div>
          <div class="dialog-body" style="align-items: center; text-align: center">
            @if (!sh.enabled) {
              <div class="alert warning" style="width: 100%">การเผยแพร่ตารางสาธารณะถูกปิดอยู่ (เปิดได้ในหน้าจัดตารางอัตโนมัติ)</div>
            }
            <img [src]="'/api/public/qr?view=' + view() + '&id=' + selectedId()" alt="QR Code" style="width: 200px; height: 200px" />
            <div class="row" style="width: 100%">
              <input class="input" [value]="sh.url" readonly />
              <button class="btn primary sm" type="button" (click)="copyUrl(sh.url)">คัดลอก</button>
            </div>
          </div>
          <div class="dialog-foot">
            <a class="btn" [href]="sh.url" target="_blank">เปิดดู</a>
            <button class="btn primary" type="button" (click)="pdfUrl.set(api.exportUrl('qr-pdf', view(), '', true)); shareInfo.set(null)">
              พิมพ์ QR ทุก{{ allLabel() }}
            </button>
          </div>
        </div>
      </div>
    }

    <app-pdf-preview [url]="pdfUrl()" (closed)="pdfUrl.set(null)" />
  `,
  styles: `
    .combo { position: relative; flex: 1; min-width: 0; }
    .combo-trigger {
      width: 100%; min-height: 38px; padding: 6px 12px; border-radius: var(--radius);
      border: 1px solid var(--border-strong); background: var(--surface); color: var(--text);
      font: inherit; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px;
      text-align: left;
    }
    .combo-trigger:hover { border-color: var(--maroon-700); }
    .combo-trigger.exec-selected { background: #fffbeb; border-color: #d97706; }
    .combo-label { display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .combo-menu {
      position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 300;
      background: var(--surface); border: 1px solid var(--border-strong); border-radius: 12px;
      box-shadow: var(--shadow-lg); overflow: hidden;
    }
    .combo-search {
      display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      border-bottom: 1px solid var(--border); background: var(--maroon-50); color: var(--text-muted);
    }
    .combo-search input {
      flex: 1; border: none; background: transparent; outline: none; font: inherit; font-size: 13.5px; color: var(--text);
    }
    .combo-clear {
      border: none; background: transparent; font-size: 18px; line-height: 1; cursor: pointer; color: var(--text-muted); padding: 0 4px;
    }
    .combo-list { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; }
    .combo-opt {
      width: 100%; text-align: left; border: none; border-bottom: 1px solid var(--border);
      background: var(--surface); padding: 9px 12px; cursor: pointer; font: inherit;
      display: flex; flex-direction: column; gap: 2px;
    }
    .combo-opt:last-child { border-bottom: none; }
    .combo-opt:hover { background: var(--maroon-50); }
    .combo-opt.exec-opt { background: #fffbeb; border-left: 3px solid #d97706; }
    .combo-opt.exec-opt:hover { background: #fef3c7; }
    .combo-opt.active { background: var(--maroon-100); font-weight: 600; }
    .opt-main { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .opt-title { font-size: 13.5px; color: var(--text); }
    .opt-sub { font-size: 11.5px; color: var(--text-muted); }
    .combo-empty { padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px; }

    .exec-pill {
      display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px;
      background: #fef3c7; color: #92400e; border: 1px solid #f59e0b;
      font-size: 11px; font-weight: 700; white-space: nowrap; flex-shrink: 0;
    }
    .exec-card { border-color: #f59e0b; }
    .exec-head { background: linear-gradient(90deg, #fffbeb 0%, #ffffff 70%); }
    .move-box { margin-top: 10px; padding: 12px; background: var(--maroon-50); border: 1px solid var(--border); border-radius: 10px; }
  `,
})
export class TimetablePage implements OnInit {
  api = inject(Api);
  state = inject(AppState);
  auth = inject(AuthService);
  private toasts = inject(Toasts);

  qView = input<View | undefined>(undefined, { alias: 'view' });
  qId = input<string | undefined>(undefined, { alias: 'id' });

  view = signal<View>('group');
  entities = signal<Record<View, EntityRef[]>>({ group: [], teacher: [], room: [] });
  selectedId = signal<string>('');
  singleGrid = signal<Grid | null>(null);
  allGrids = signal<Grid[]>([]);
  displayMode = signal<'auto' | 'table' | 'cards'>('auto');
  search = '';

  dropdownOpen = signal(false);
  entityQuery = signal('');
  onlyExec = signal(false);

  activeSpan = signal<{ day: string; dayLabel: string; span: GridSpan } | null>(null);
  moveTargets = signal<any[]>([]);
  loadingTargets = signal(false);
  undoStack = signal<OutputRow[][]>([]);
  pdfUrl = signal<string | null>(null);
  shareInfo = signal<any>(null);

  currentEntities = computed(() => {
    const list = this.entities()[this.view()] || [];
    if (this.view() === 'teacher' && this.onlyExec()) {
      return list.filter((e) => e.isLeader);
    }
    return list;
  });

  filteredEntities = computed(() => {
    const list = this.currentEntities();
    const q = this.entityQuery().trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) =>
      `${e.id} ${e.title} ${e.subtitle} ${e.isLeader ? 'ผู้บริหาร leader' : ''}`.toLowerCase().includes(q)
    );
  });

  selectedEntity = computed(() =>
    (this.entities()[this.view()] || []).find((e) => e.id === this.selectedId()) || null
  );

  visibleAllGrids = computed(() => {
    const list = this.allGrids();
    if (this.view() === 'teacher' && this.onlyExec()) {
      return list.filter((g) => g.entity?.isLeader);
    }
    return list;
  });

  viewLabel = computed(() => (this.view() === 'group' ? 'กลุ่มเรียน' : this.view() === 'teacher' ? 'อาจารย์ผู้สอน' : 'ห้อง/สนาม'));
  allLabel = computed(() => (this.view() === 'group' ? 'ทุกกลุ่มเรียน' : this.view() === 'teacher' ? 'อาจารย์ทุกคน' : 'ทุกห้อง/สนาม'));
  excelUrl = computed(() => this.api.exportUrl('xlsx', this.view(), this.selectedId() === '__all__' ? '' : this.selectedId()));

  constructor() {
    effect(() => {
      this.state.version();
      if (this.selectedId()) this.loadGrids();
    });
  }

  @HostListener('document:click')
  onDocClick() {
    if (this.dropdownOpen()) this.dropdownOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.dropdownOpen()) this.dropdownOpen.set(false);
  }

  async ngOnInit() {
    if (this.qView()) this.view.set(this.qView()!);
    const ents = await this.api.getEntities();
    this.entities.set(ents);
    const list = ents[this.view()] || [];
    const pick = this.qId() && list.some((e) => e.id === this.qId()) ? this.qId()! : (list[0]?.id || '__all__');
    this.selectedId.set(pick);
    await this.loadGrids();
  }

  toggleDropdown() {
    this.dropdownOpen.update((v) => !v);
    if (this.dropdownOpen()) this.entityQuery.set('');
  }

  async pickEntity(id: string) {
    this.dropdownOpen.set(false);
    this.entityQuery.set('');
    await this.selectEntity(id);
  }

  async switchView(v: View) {
    this.view.set(v);
    this.onlyExec.set(false);
    this.dropdownOpen.set(false);
    this.entityQuery.set('');
    const list = this.entities()[v] || [];
    this.selectedId.set(list[0]?.id || '__all__');
    await this.loadGrids();
  }

  async selectEntity(id: string) {
    this.selectedId.set(id);
    await this.loadGrids();
  }

  stepEntity(delta: number) {
    const list = this.currentEntities();
    if (!list.length) return;
    const idx = list.findIndex((e) => e.id === this.selectedId());
    const nextIdx = (idx + delta + list.length) % list.length;
    this.selectEntity(list[nextIdx].id);
  }

  async loadGrids() {
    if (this.selectedId() === '__all__') {
      const res = await this.api.getGrids(this.view());
      this.allGrids.set(res.grids || []);
      this.singleGrid.set(null);
    } else if (this.selectedId()) {
      const g = await this.api.getGrid(this.view(), this.selectedId());
      this.singleGrid.set(g);
      this.allGrids.set([]);
    }
  }

  failedCount(val: any) {
    return (val?.checks || []).filter((c: any) => c.enabled && !c.passed).length;
  }

  openPdf() {
    const id = this.selectedId() === '__all__' ? '' : this.selectedId();
    this.pdfUrl.set(this.api.exportUrl('pdf', this.view(), id, true));
  }

  async openShare() {
    try {
      this.shareInfo.set(await this.api.getShare(this.view(), this.selectedId()));
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  copyUrl(url: string) {
    navigator.clipboard?.writeText(url);
    this.toasts.success('คัดลอกลิงก์แล้ว');
  }

  async onSpanClick(ev: { day: string; dayLabel: string; span: GridSpan }) {
    this.activeSpan.set(ev);
    this.moveTargets.set([]);
    if (!this.auth.isAdmin() || this.selectedId() === '__all__') return;
    if (ev.span.subject_id === 'ADVISOR' || ev.span.subject_id === 'ACTIVITY') return;
    this.loadingTargets.set(true);
    try {
      const res = await this.api.moveOptions({
        view: this.view(),
        id: this.selectedId(),
        fromDay: ev.day,
        fromPeriod: ev.span.start,
        length: ev.span.span,
      });
      this.moveTargets.set(res.targets || []);
    } finally {
      this.loadingTargets.set(false);
    }
  }

  async doMove(target: any) {
    const detail = this.activeSpan();
    if (!detail) return;
    const prevRows = (this.state.timetable()?.rows || []).map((r) => ({ ...r }));
    try {
      await this.api.moveSpan({
        view: this.view(),
        id: this.selectedId(),
        fromDay: detail.day,
        fromPeriod: detail.span.start,
        length: detail.span.span,
        toDay: target.day,
        toPeriod: target.period,
      });
      this.undoStack.update((s) => [...s.slice(-19), prevRows]);
      this.activeSpan.set(null);
      await this.state.refreshTimetable();
      await this.loadGrids();
      this.toasts.success('ย้ายคาบเรียบร้อยแล้ว');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async undo() {
    const stack = this.undoStack();
    if (!stack.length) return;
    const prev = stack[stack.length - 1];
    try {
      await this.api.saveTimetable(prev);
      this.undoStack.set(stack.slice(0, -1));
      await this.state.refreshTimetable();
      await this.loadGrids();
      this.toasts.info('ย้อนกลับตารางก่อนหน้าแล้ว');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }
}
