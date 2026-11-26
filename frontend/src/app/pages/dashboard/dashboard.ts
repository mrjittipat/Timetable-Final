import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppState } from '../../core/state';
import { AuthService } from '../../core/auth';
import { Api } from '../../core/api';
import { ThemeService, hexToRgb } from '../../core/theme';
import { IconComponent } from '../../shared/icon';
import { Grid } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="page">
      <div class="hero">
        <div>
          <div class="eyebrow-w">{{ theme.appearance()['siteName'] || 'วิทยาลัยเทคนิคพังงา' }}</div>
          <h1>{{ theme.appearance()['heroTitle'] || 'ระบบจัดตารางเรียนอัตโนมัติ' }}</h1>
          <p>{{ theme.appearance()['heroSubtitle'] || 'CSP Search + Simulated Annealing พร้อมตัวตรวจเงื่อนไขแบบอิสระ' }}</p>
        </div>
        <div class="row">
          @if (auth.isTeacher()) {
            <a routerLink="/my-groups" class="btn primary">กลุ่มเรียนที่รับผิดชอบ</a>
            <a routerLink="/timetable" class="btn">ตารางสอนของฉัน</a>
            <a routerLink="/teacher-hub" class="btn">คำขอและบันทึกครู</a>
          } @else {
            <a routerLink="/solve" class="btn primary"><app-icon name="play" [size]="16" /> จัดตารางอัตโนมัติ</a>
            <a routerLink="/timetable" class="btn"><app-icon name="calendar" [size]="16" /> ดูตารางเรียน</a>
          }
        </div>
      </div>

      @if (auth.isTeacher()) {
        <div class="grid-4">
          <div class="card kpi">
            <div class="kpi-label">อาจารย์ผู้สอน</div>
            <div class="kpi-val" style="font-size: 18px">{{ myInfo()?.teacher?.teacher_name || auth.user()?.name || '-' }}</div>
            <div class="kpi-hint">{{ myInfo()?.teacher?.role === 'Leader' ? 'อาจารย์ฝ่ายบริหาร (ประชุมอังคาร 1–4)' : 'อาจารย์ประจำ' }}</div>
          </div>
          <div class="card kpi">
            <div class="kpi-label">ภาระสอนของฉัน</div>
            <div class="kpi-val">{{ myGrid()?.total ?? myInfo()?.totalPeriods ?? 0 }}</div>
            <div class="kpi-hint">คาบ / สัปดาห์</div>
          </div>
          <div class="card kpi">
            <div class="kpi-label">กลุ่มเรียนที่รับผิดชอบ</div>
            <div class="kpi-val">{{ myInfo()?.responsibleGroups?.length ?? 0 }}</div>
            <div class="kpi-hint">กลุ่มเรียนที่สอนในภาคเรียนนี้</div>
          </div>
          <div class="card kpi">
            <div class="kpi-label">รายวิชาที่รับผิดชอบ</div>
            <div class="kpi-val">{{ myGrid()?.subjects?.list?.length ?? myInfo()?.subjectsCount ?? 0 }}</div>
            <div class="kpi-hint">คำขอรออนุมัติ {{ pendingRequestsCount() }} รายการ</div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Teacher Chart 1: Daily Teaching Load -->
          <div class="card">
            <div class="card-head">
              <h3>ภาระสอนรายวันของฉัน (คาบ/วัน)</h3>
              <button class="btn sm ghost" type="button" (click)="tblMyDay.update(v => !v)">
                {{ tblMyDay() ? 'กราฟ' : 'ตาราง' }}
              </button>
            </div>
            <div class="card-body">
              @if (tblMyDay()) {
                <div class="table-wrap">
                  <table class="table">
                    <thead><tr><th>วัน</th><th>จำนวนคาบสอน</th><th>สัดส่วน</th></tr></thead>
                    <tbody>
                      @for (d of myDailyLoad(); track d.key) {
                        <tr>
                          <td><strong>วัน{{ d.label }}</strong></td>
                          <td>{{ d.periods }} คาบ</td>
                          <td>{{ d.pct }}%</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <div class="bars" role="img" aria-label="ภาระสอนรายวันของฉัน">
                  @for (d of myDailyLoad(); track d.key) {
                    <div class="bar-row" [title]="'วัน' + d.label + ': ' + d.periods + ' คาบ'">
                      <div class="bar-lbl">วัน{{ d.label }}</div>
                      <div class="bar-track">
                        <div class="bar-fill" [style.width.%]="(d.periods / maxMyDaily()) * 100"></div>
                      </div>
                      <div class="bar-num">{{ d.periods }}</div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Teacher Chart 2: Load by Responsible Group -->
          <div class="card">
            <div class="card-head">
              <h3>ภาระสอนแยกตามกลุ่มเรียน (คาบ/สัปดาห์)</h3>
              <button class="btn sm ghost" type="button" (click)="tblMyGroup.update(v => !v)">
                {{ tblMyGroup() ? 'กราฟ' : 'ตาราง' }}
              </button>
            </div>
            <div class="card-body">
              @if (tblMyGroup()) {
                <div class="table-wrap" style="max-height: 260px">
                  <table class="table">
                    <thead><tr><th>กลุ่มเรียน</th><th>จำนวนวิชา</th><th>คาบ/สัปดาห์</th></tr></thead>
                    <tbody>
                      @for (grp of myInfo()?.responsibleGroups || []; track grp.group_id) {
                        <tr>
                          <td><strong>{{ grp.group_name }}</strong> <span class="mono small muted">({{ grp.group_id }})</span></td>
                          <td>{{ grp.subjects?.length || 0 }}</td>
                          <td><strong>{{ grp.periods }}</strong></td>
                        </tr>
                      } @empty {
                        <tr><td colspan="3" class="muted small" style="text-align: center">ยังไม่มีข้อมูล</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <div class="bars scroll-bars" role="img" aria-label="ภาระสอนแยกตามกลุ่มเรียน">
                  @for (grp of myInfo()?.responsibleGroups || []; track grp.group_id) {
                    <div class="bar-row" [title]="grp.group_name + ': ' + grp.periods + ' คาบ'">
                      <div class="bar-lbl">{{ grp.group_name }} ({{ grp.group_id }})</div>
                      <div class="bar-track">
                        <div class="bar-fill" [style.width.%]="(grp.periods / maxMyGroup()) * 100"></div>
                      </div>
                      <div class="bar-num">{{ grp.periods }}</div>
                    </div>
                  } @empty {
                    <div class="muted small">ยังไม่มีข้อมูลในตารางล่าสุด</div>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Teacher Chart 3: Subjects Summary -->
        <div class="card">
          <div class="card-head">
            <h3>สรุปรายวิชาที่รับผิดชอบ (น. บ. ป. ศ.)</h3>
            <button class="btn sm ghost" type="button" (click)="tblMySubject.update(v => !v)">
              {{ tblMySubject() ? 'ตาราง' : 'กราฟ' }}
            </button>
          </div>
          @if (!tblMySubject()) {
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>รหัสวิชา</th><th>ชื่อรายวิชา</th><th>น.</th><th>บ.</th><th>ป.</th><th>ศ.</th></tr></thead>
                <tbody>
                  @for (s of myGrid()?.subjects?.list || []; track s.subject_id) {
                    <tr>
                      <td class="mono">{{ s.subject_id }}</td>
                      <td>{{ s.name }}</td>
                      <td>{{ s.n }}</td>
                      <td>{{ s.t }}</td>
                      <td>{{ s.p }}</td>
                      <td>{{ s.s }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="muted small" style="text-align: center">ยังไม่มีรายวิชาในตารางสอน</td></tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="card-body">
              <div class="bars scroll-bars" role="img" aria-label="ชั่วโมงสอนแยกรายวิชา">
                @for (s of myGrid()?.subjects?.list || []; track s.subject_id) {
                  <div class="bar-row" [title]="s.subject_id + ' ' + s.name + ': ' + (s.t + s.p) + ' คาบ'">
                    <div class="bar-lbl">{{ s.subject_id }} {{ s.name }}</div>
                    <div class="bar-track">
                      <div class="bar-fill" [style.width.%]="((s.t + s.p) / maxMySubject()) * 100"></div>
                    </div>
                    <div class="bar-num">{{ s.t + s.p }}</div>
                  </div>
                } @empty {
                  <div class="muted small">ยังไม่มีรายวิชาในตารางสอน</div>
                }
              </div>
            </div>
          }
        </div>
      } @else {
      @if (state.data(); as d) {
        <div class="grid-5">
          <div class="card kpi">
            <div class="kpi-label">กลุ่มเรียน</div>
            <div class="kpi-val">{{ d.summary.groups }}</div>
            <div class="kpi-hint">จัดตาราง {{ d.summary.activeGroups }} กลุ่ม (ปี 4 ฝึกสอน)</div>
          </div>
          <div class="card kpi">
            <div class="kpi-label">อาจารย์ผู้สอน</div>
            <div class="kpi-val">{{ d.summary.teachers }}</div>
            <div class="kpi-hint">ฝ่ายบริหาร {{ d.summary.leaders }} คน</div>
          </div>
          <div class="card kpi">
            <div class="kpi-label">ห้องเรียน / สนาม</div>
            <div class="kpi-val">{{ d.summary.rooms }}</div>
            <div class="kpi-hint">ห้องเรียน ห้องคอม และสนามกีฬา</div>
          </div>
          <div class="card kpi">
            <div class="kpi-label">รายวิชา</div>
            <div class="kpi-val">{{ d.summary.subjects }}</div>
            <div class="kpi-hint">ลงทะเบียน {{ d.summary.registrations }} รายการ</div>
          </div>
          <div class="card kpi">
            <div class="kpi-label">คาบที่ต้องจัด</div>
            <div class="kpi-val">{{ d.summary.totalPeriods }}</div>
            <div class="kpi-hint">{{ d.summary.timeslots }} ช่วงเวลา/สัปดาห์</div>
          </div>
        </div>
      }

      @if (stats(); as st) {
        <div class="grid-2">
          <!-- Chart 1: Teacher Load -->
          <div class="card">
            <div class="card-head">
              <h3>ภาระสอนของอาจารย์ (คาบ/สัปดาห์)</h3>
              <button class="btn sm ghost" type="button" (click)="tblTeacher.update(v => !v)">
                {{ tblTeacher() ? 'กราฟ' : 'ตาราง' }}
              </button>
            </div>
            <div class="card-body">
              @if (tblTeacher()) {
                <div class="table-wrap" style="max-height: 320px">
                  <table class="table">
                    <thead><tr><th>รหัส</th><th>ชื่ออาจารย์</th><th>คาบ</th></tr></thead>
                    <tbody>
                      @for (t of st.teacherLoad; track t.id) {
                        <tr>
                          <td class="mono">{{ t.id }}</td>
                          <td>
                            @if (t.role === 'Leader') { <span class="l-tag" title="ผู้บริหาร">L</span> }
                            {{ t.name }}
                          </td>
                          <td><strong>{{ t.periods }}</strong></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <div class="bars scroll-bars" role="img" aria-label="ภาระสอนของอาจารย์">
                  @for (t of st.teacherLoad; track t.id) {
                    <div class="bar-row" [title]="(t.role === 'Leader' ? '[ผู้บริหาร] ' : '') + t.name + ': ' + t.periods + ' คาบ'">
                      <div class="bar-lbl">
                        @if (t.role === 'Leader') { <span class="l-tag" title="ผู้บริหาร">L</span> }
                        {{ t.name }}
                      </div>
                      <div class="bar-track">
                        <div class="bar-fill" [style.width.%]="(t.periods / maxTeacherLoad()) * 100"></div>
                      </div>
                      <div class="bar-num">{{ t.periods }}</div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Chart 2: Heat map -->
          <div class="card">
            <div class="card-head">
              <h3>ความหนาแน่นของการเรียน (จำนวนกลุ่มต่อคาบ)</h3>
              <button class="btn sm ghost" type="button" (click)="tblHeat.update(v => !v)">
                {{ tblHeat() ? 'กราฟ' : 'ตาราง' }}
              </button>
            </div>
            <div class="card-body">
              <div class="table-wrap">
                <table class="heat-table" role="img" aria-label="ความหนาแน่นของการเรียน">
                  <thead>
                    <tr>
                      <th>วัน</th>
                      @for (p of st.periods; track p) { <th>{{ p }}</th> }
                    </tr>
                  </thead>
                  <tbody>
                    @for (d of st.days; track d.key; let di = $index) {
                      <tr>
                        <td class="h-day">{{ d.label }}</td>
                        @for (val of st.heat[di]; track $index; let pi = $index) {
                          @if (val === null) {
                            <td class="h-break">พัก</td>
                          } @else {
                            <td [style.background]="tblHeat() ? '' : heatBg(val, st.groups)"
                                [style.color]="!tblHeat() && val > st.groups * 0.55 ? '#fff' : ''">
                              {{ val }}
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
        </div>

        <!-- Chart 3: Room Usage -->
        <div class="card">
          <div class="card-head">
            <h3>การใช้ห้องเรียนและสนามกีฬา (% ของคาบที่ใช้ได้)</h3>
            <button class="btn sm ghost" type="button" (click)="tblRoom.update(v => !v)">
              {{ tblRoom() ? 'กราฟ' : 'ตาราง' }}
            </button>
          </div>
          <div class="card-body">
            @if (tblRoom()) {
              <div class="table-wrap" style="max-height: 280px">
                <table class="table">
                  <thead><tr><th>รหัส</th><th>สถานที่</th><th>ประเภท</th><th>คาบ</th><th>%</th></tr></thead>
                  <tbody>
                    @for (r of st.roomUsage; track r.id) {
                      <tr><td class="mono">{{ r.id }}</td><td>{{ r.name }}</td><td>{{ r.type }}</td><td>{{ r.periods }}</td><td>{{ r.pct }}%</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <div class="bars-grid scroll-bars" role="img" aria-label="การใช้ห้องเรียนและสนาม">
                @for (r of st.roomUsage; track r.id) {
                  <div class="bar-row" [title]="r.name + ': ' + r.periods + ' คาบ (' + r.pct + '%)'">
                    <div class="bar-lbl">{{ r.name }}</div>
                    <div class="bar-track"><div class="bar-fill" [style.width.%]="r.pct"></div></div>
                    <div class="bar-num">{{ r.pct }}%</div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }

      <div class="grid-2">
        <!-- Latest Result -->
        <div class="card">
          <div class="card-head">
            <h3>ผลการจัดตารางล่าสุด</h3>
            <a routerLink="/report" class="btn sm ghost">ดูรายงานทั้งหมด →</a>
          </div>
          <div class="card-body">
            @if (state.timetable(); as tt) {
              @if (tt.validation; as val) {
                <div class="row" style="margin-bottom: 14px">
                  <div class="ring" [class.ok]="val.passed">
                    <span>{{ passedCount(val) }}/{{ val.checks.length }}</span>
                    <small>เงื่อนไขผ่าน</small>
                  </div>
                  <div>
                    <div style="font-weight: 600">{{ val.passed ? 'ผ่านครบทุกเงื่อนไข' : 'พบเงื่อนไขที่ไม่ผ่าน' }}</div>
                    <div class="small muted">จำนวนแถว: {{ tt.rows.length }} · Seed: {{ tt.meta?.stats?.seed ?? '-' }} · Soft cost: {{ tt.meta?.stats?.softCostAfter ?? '-' }}</div>
                  </div>
                </div>
                <div class="check-mini">
                  @for (ch of val.checks; track ch.id) {
                    <div class="cm-row">
                      <span [class]="ch.passed ? 'ok-mark' : 'bad-mark'">{{ ch.passed ? '✓' : '✗' }}</span>
                      <span class="mono small">{{ ch.id }}</span>
                      <span class="small" style="flex: 1">{{ ch.name }}</span>
                      @if (!ch.passed) { <span class="badge danger">{{ ch.violationCount }}</span> }
                    </div>
                  }
                </div>
              } @else {
                <div class="empty">ยังไม่ได้จัดตาราง <a routerLink="/solve" class="btn sm primary">ไปหน้าจัดตาราง</a></div>
              }
            }
          </div>
        </div>

        <!-- Warnings -->
        <div class="card">
          <div class="card-head">
            <h3>ข้อสังเกตจากข้อมูล</h3>
            <a routerLink="/data" class="btn sm ghost">จัดการข้อมูล →</a>
          </div>
          <div class="card-body">
            @if ((state.data()?.warnings?.length || 0) === 0) {
              <div class="alert success">ข้อมูลพร้อมสำหรับการจัดตาราง ไม่พบข้อผิดพลาดหรือคำเตือน</div>
            } @else {
              @for (w of state.data()?.warnings || []; track $index) {
                <div class="alert" [class.danger]="w.level === 'error'" [class.warning]="w.level !== 'error'" style="margin-bottom: 8px">
                  {{ w.message }}
                </div>
              }
            }
            <div class="guide-grid">
              <div class="g-step"><strong>1. ข้อมูล</strong><span>ตรวจ 7 ตารางจากชุดข้อมูลชั้นปี 1–4</span></div>
              <div class="g-step"><strong>2. จัดตาราง</strong><span>รัน CSP + SA และค้นหา Seed ดีที่สุด</span></div>
              <div class="g-step"><strong>3. ตรวจสอบ</strong><span>ดูตาราง 3 มุมมองและปรับแต่งด้วยมือ</span></div>
              <div class="g-step"><strong>4. ส่งออก</strong><span>ดาวน์โหลด CSV, Excel, PDF และ QR</span></div>
            </div>
          </div>
        </div>
      </div>
      }
    </div>
  `,
  styles: `
    .hero {
      background: linear-gradient(135deg, var(--maroon-700), var(--maroon-950));
      color: #fff; border-radius: var(--radius-lg); padding: 24px 28px;
      display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap;
    }
    .eyebrow-w { font-size: 12px; opacity: 0.85; font-weight: 600; margin-bottom: 4px; }
    .hero p { margin: 6px 0 0; opacity: 0.9; font-size: 13.5px; }
    .kpi { padding: 16px 18px; }
    .kpi-label { font-size: 12.5px; color: var(--text-muted); font-weight: 500; }
    .kpi-val { font-size: 28px; font-weight: 700; color: var(--maroon-700); line-height: 1.2; margin: 4px 0; }
    .kpi-hint { font-size: 12px; color: var(--text-muted); }

    .bars { display: flex; flex-direction: column; gap: 8px; }
    .bars-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 20px; align-content: start; }
    .scroll-bars { max-height: 320px; overflow-y: auto; padding-right: 6px; }
    .bars-grid.scroll-bars { max-height: 290px; }
    .bar-row { display: grid; grid-template-columns: 165px 1fr 44px; align-items: center; gap: 8px; font-size: 12.5px; }
    .bar-lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .l-tag { display: inline-block; background: var(--maroon-700); color: #fff; font-size: 10px; font-weight: 700; padding: 0 5px; border-radius: 4px; margin-right: 4px; }
    .bar-track { height: 10px; background: var(--maroon-100); border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--maroon-700); border-radius: 999px; }
    .bar-num { text-align: right; font-weight: 600; color: var(--maroon-800); }

    .heat-table { width: 100%; border-collapse: collapse; text-align: center; font-size: 12.5px; }
    .heat-table th, .heat-table td { border: 1px solid var(--border); padding: 7px 4px; }
    .heat-table th { background: var(--maroon-50); color: var(--maroon-900); }
    .h-day { font-weight: 600; background: var(--maroon-50); }
    .h-break { background: repeating-linear-gradient(45deg, #f3ecee, #f3ecee 5px, #e6dcdf 5px, #e6dcdf 10px); color: var(--text-muted); font-size: 11px; }

    .ring {
      width: 78px; height: 78px; border-radius: 50%; border: 6px solid var(--danger);
      display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .ring.ok { border-color: var(--success); }
    .ring span { font-weight: 700; font-size: 16px; line-height: 1.1; }
    .ring small { font-size: 10px; color: var(--text-muted); }
    .check-mini { display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow-y: auto; }
    .cm-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; border-bottom: 1px dashed var(--border); }
    .ok-mark { color: var(--success); font-weight: 700; }
    .bad-mark { color: var(--danger); font-weight: 700; }

    .guide-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 16px; }
    .g-step { background: var(--maroon-50); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; }
    @media (max-width: 960px) { .bars-grid { grid-template-columns: 1fr; } }
  `,
})
export class DashboardPage implements OnInit {
  state = inject(AppState);
  auth = inject(AuthService);
  theme = inject(ThemeService);
  private api = inject(Api);

  stats = signal<any>(null);
  myInfo = signal<any>(null);
  myGrid = signal<Grid | null>(null);
  myRequests = signal<any[]>([]);
  tblTeacher = signal(false);
  tblHeat = signal(false);
  tblRoom = signal(false);
  tblMyDay = signal(false);
  tblMyGroup = signal(false);
  tblMySubject = signal(false);

  pendingRequestsCount = computed(() =>
    this.myRequests().filter((r) => r.status === 'pending').length
  );

  myDailyLoad = computed(() => {
    const g = this.myGrid();
    const days = g?.days || [
      { key: 'Mon', label: 'จันทร์' },
      { key: 'Tue', label: 'อังคาร' },
      { key: 'Wed', label: 'พุธ' },
      { key: 'Thu', label: 'พฤหัสบดี' },
      { key: 'Fri', label: 'ศุกร์' },
    ];
    const total = Math.max(1, g?.total || 0);
    return days.map((d, di) => {
      const periods = (g?.cells?.[di] || []).reduce((sum, sp) => sum + (sp.span || 1), 0);
      return {
        key: d.key,
        label: d.label,
        periods,
        pct: g?.total ? Math.round((periods / total) * 100) : 0,
      };
    });
  });

  maxMyDaily = computed(() => Math.max(1, ...this.myDailyLoad().map((d) => d.periods)));
  maxMyGroup = computed(() => {
    const list = this.myInfo()?.responsibleGroups || [];
    return Math.max(1, ...list.map((g: any) => Number(g.periods) || 0));
  });
  maxMySubject = computed(() => {
    const list = this.myGrid()?.subjects?.list || [];
    return Math.max(1, ...list.map((s) => (Number(s.t) || 0) + (Number(s.p) || 0)));
  });

  maxTeacherLoad = computed(() => {
    const list = this.stats()?.teacherLoad || [];
    return Math.max(1, ...list.map((t: any) => t.periods));
  });

  constructor() {
    effect(() => {
      this.state.version();
      this.loadStats();
    });
  }

  ngOnInit() {
    this.loadStats();
  }

  async loadStats() {
    if (this.auth.isTeacher()) {
      try {
        const [info, reqs] = await Promise.all([
          this.api.getMyGroups(),
          this.api.getTeacherRequests(),
        ]);
        this.myInfo.set(info);
        this.myRequests.set(reqs.requests || []);
        const tid = this.auth.user()?.teacher_id;
        if (tid && this.state.hasTimetable()) {
          this.myGrid.set(await this.api.getGrid('teacher', tid));
        } else {
          this.myGrid.set(null);
        }
      } catch {
        // ignore
      }
      return;
    }
    try {
      this.stats.set(await this.api.getStats());
    } catch {
      // ignore
    }
  }

  passedCount(val: any) {
    return (val?.checks || []).filter((c: any) => c.passed).length;
  }

  heatBg(val: number, max: number) {
    const ratio = max > 0 ? Math.min(1, val / max) : 0;
    const alpha = 0.08 + ratio * 0.82;
    const [r, g, b] = hexToRgb(this.theme.appearance().primaryColor || '#800020');
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  }
}
