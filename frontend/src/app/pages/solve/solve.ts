import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { AppState } from '../../core/state';
import { AuthService } from '../../core/auth';
import { Toasts } from '../../core/toast';
import { Confirm } from '../../core/confirm';
import { Config, SavedSeed, SolveResponse } from '../../core/models';
import { IconComponent } from '../../shared/icon';

const SPECIALS = [
  { key: 'r5_theoryRoom', no: 5, title: 'วิชาภาษา/สังคม/วิชาชีพครู/บังคับ/คณิต/วิทย์ เรียนห้องทฤษฎี', detail: 'เงื่อนไขข้อ 1 — จัดชั่วโมงบรรยายและปฏิบัติในห้องเรียนทฤษฎี (ห้องประจำกลุ่ม/ห้องประชุม)' },
  { key: 'r6_computerLab', no: 6, title: 'วิชานวัตกรรมและเทคโนโลยีเรียนห้องคอม', detail: 'เงื่อนไขข้อ 2 — จัดชั่วโมงบรรยายและภาคปฏิบัติในห้องคอมพิวเตอร์ 1 หรือ 2' },
  { key: 'r7_coTeach', no: 7, title: 'วิชาที่มีครู 2 คน ครูทั้งคู่ต้องสอนพร้อมกัน', detail: 'เงื่อนไขข้อ 3 — จัดผู้สอนทั้ง 2 คนมีคาบสอนพร้อมกัน และนับคาบสอนให้ทั้ง 2 คน' },
  { key: 'r8_sportDualRoom', no: 8, title: 'วิชากีฬาต้องจองห้องทฤษฎีกับสนามพร้อมกัน', detail: 'เงื่อนไขข้อ 4 — กลุ่มทักษะและการสอนกีฬาจองทั้งห้องทฤษฎีและโรงยิม/สนามในช่วงเวลาเดียวกัน' },
  { key: 'r9_electiveSync', no: 9, title: 'วิชาเลือกกีฬาในชุดเดียวกันต้องเรียนเวลาเดียวกัน', detail: 'เงื่อนไขข้อ 5 — กลุ่มกีฬาขั้นสูง / การตัดสินกีฬา / กลวิธีการฝึกกีฬา จัดทุกวิชาในชุดเดียวกันเวลาเดียวกัน' },
  { key: 'r10_year4NoSchedule', no: 10, title: 'ปี 4 ไม่ต้องจัดตาราง', detail: 'เงื่อนไขข้อ 6 — กศ 021037 ปฏิบัติการสอนในสถานศึกษา 4 ไม่มีตารางเรียนและผู้สอนไม่มีคาบสอน' },
];

const BASICS = [
  'ข้อ 1 — คาบ 5 ทุกวันเป็นพักเที่ยง ห้ามจัดเรียน (ข้อ 1.2)',
  'ข้อ 2 — วันพุธคาบ 8 พบอาจารย์ที่ปรึกษา คาบ 9 กิจกรรม (ข้อ 1.2)',
  'ข้อ 3 — ผู้บริหาร 7 คนห้ามสอนวันอังคารคาบ 1–4 (ข้อ 1.3)',
  'ข้อ 4 — จำนวนคาบของวิชา = ชั่วโมงบรรยาย + ชั่วโมงปฏิบัติ (ส่วนที่ 4)',
];

@Component({
  selector: 'app-solve',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">ขั้นตอนที่ 2</div>
          <h1>จัดตารางอัตโนมัติ</h1>
          <p>กำหนดเงื่อนไขพิเศษ พารามิเตอร์ CSP + Simulated Annealing และค้นหา Seed ที่ดีที่สุด</p>
        </div>
      </div>

      @if (cfg(); as c) {
        <div class="solve-cols">
          <!-- Left Column -->
          <div class="col">
            <div class="card">
              <div class="card-head">
                <div class="row">
                  <h3>เงื่อนไขการจัดรายวิชา และห้องเรียน</h3>
                  <span class="badge">เปิด {{ enabledCount() }}/{{ specials.length }}</span>
                </div>
                @if (auth.isAdmin()) {
                  <div class="row">
                    <button class="btn sm ghost" type="button" (click)="setAllSpecials(true)">เปิดทั้งหมด</button>
                    <button class="btn sm ghost" type="button" (click)="setAllSpecials(false)">ปิดทั้งหมด</button>
                  </div>
                }
              </div>
              <div class="card-body sp-list">
                @for (sp of specials; track sp.key) {
                  <label class="sp-row" [class.on]="c.constraints[sp.key]">
                    <span class="no-tile">{{ sp.no }}</span>
                    <div style="flex: 1">
                      <div style="font-weight: 600">{{ sp.title }}</div>
                      <div class="small muted">{{ sp.detail }}</div>
                    </div>
                    <span class="switch">
                      <input type="checkbox" [disabled]="!auth.isAdmin()" [(ngModel)]="c.constraints[sp.key]" (ngModelChange)="persistConfig()" />
                      <span></span>
                    </span>
                  </label>
                }
              </div>
            </div>

            <div class="card">
              <div class="card-head">
                <h3>เงื่อนไขพื้นฐาน (บังคับ)</h3>
                <span class="badge success">เปิดเสมอ</span>
              </div>
              <div class="card-body">
                <ul class="basic-list">
                  @for (b of basics; track b) { <li>{{ b }}</li> }
                </ul>
              </div>
            </div>

            <div class="card grow">
              <div class="card-head">
                <h3>Seed ที่บันทึกไว้ ({{ seeds().length }})</h3>
                @if (auth.isAdmin() && state.hasTimetable()) {
                  <button class="btn sm" type="button" (click)="saveCurrentSeed()">+ บันทึก Seed ปัจจุบัน</button>
                }
              </div>
              <div class="card-body">
                @if (seeds().length === 0) {
                  <div class="muted small">ยังไม่มี Seed ที่บันทึกไว้</div>
                } @else {
                  <div class="seed-list">
                    @for (s of seeds(); track s.id) {
                      <div class="seed-item">
                        <span class="seed-num">{{ s.seed }}</span>
                        <div style="flex: 1">
                          <div style="font-weight: 600">{{ s.name }}</div>
                          <div class="small muted">Soft cost: {{ s.softCost ?? '-' }} · {{ s.rowsCount ?? '-' }} แถว</div>
                        </div>
                        @if (auth.isAdmin()) {
                          <button class="btn sm primary" type="button" (click)="applySavedSeed(s)">ใช้ทันที</button>
                          <button class="btn icon ghost sm" style="color: var(--danger)" type="button" (click)="removeSeed(s)">
                            <app-icon name="trash" [size]="15" />
                          </button>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Right Column -->
          <div class="col">
            <div class="card">
              <div class="card-head">
                <h3>พารามิเตอร์อัลกอริทึม</h3>
                @if (auth.isAdmin()) {
                  <button class="btn sm" type="button" (click)="persistConfig(true)">บันทึก Config</button>
                }
              </div>
              <div class="card-body grid-2">
                <div class="field">
                  <label>Random Seed</label>
                  <div class="row" style="flex-wrap: nowrap">
                    <input class="input" type="number" [disabled]="!auth.isAdmin()" [(ngModel)]="c.params['seed']" />
                    <button class="btn sm" type="button" [disabled]="!auth.isAdmin()" (click)="shuffleSeed()">สุ่ม</button>
                  </div>
                </div>
                <div class="field">
                  <label>เวลาสูงสุด (วินาที)</label>
                  <input class="input" type="number" min="1" max="120" [disabled]="!auth.isAdmin()" [(ngModel)]="c.params['timeLimitSec']" />
                </div>
                <div class="field">
                  <label>คาบติดกันสูงสุดต่อบล็อก</label>
                  <input class="input" type="number" min="1" max="4" [disabled]="!auth.isAdmin()" [(ngModel)]="c.params['maxBlock']" />
                </div>
                <div class="field">
                  <label>คาบสูงสุดต่อวัน</label>
                  <input class="input" type="number" min="4" max="9" [disabled]="!auth.isAdmin()" [(ngModel)]="c.params['maxPeriodsPerDay']" />
                </div>
              </div>
            </div>

            <div class="card grow">
              <div class="card-head">
                <h3>ข้อมูลหัวกระดาษตาราง (PDF / Excel)</h3>
                @if (auth.isAdmin()) {
                  <button class="btn sm" type="button" (click)="persistConfig(true)">บันทึก</button>
                }
              </div>
              <div class="card-body" style="display: flex; flex-direction: column; gap: 12px">
                <div class="field">
                  <label>ชื่อสถาบัน / คณะ</label>
                  <input class="input" [disabled]="!auth.isAdmin()" [(ngModel)]="c.document.college" />
                </div>
                <div class="grid-2">
                  <div class="field"><label>ภาคเรียน</label><input class="input" [disabled]="!auth.isAdmin()" [(ngModel)]="c.document.semester" /></div>
                  <div class="field"><label>ปีการศึกษา</label><input class="input" [disabled]="!auth.isAdmin()" [(ngModel)]="c.document.year" /></div>
                </div>
                <div class="field"><label>หัวหน้างานพัฒนาหลักสูตร</label><input class="input" [disabled]="!auth.isAdmin()" [(ngModel)]="c.document.curriculumHeadName" /></div>
                <div class="grid-2">
                  <div class="field"><label>รองคณบดีฝ่ายวิชาการ</label><input class="input" [disabled]="!auth.isAdmin()" [(ngModel)]="c.document.deputyName" /></div>
                  <div class="field"><label>คณบดี</label><input class="input" [disabled]="!auth.isAdmin()" [(ngModel)]="c.document.directorName" /></div>
                </div>
                <label class="row" style="justify-content: space-between; margin-top: 4px">
                  <span>เผยแพร่ตารางสาธารณะ (/p)</span>
                  <span class="switch"><input type="checkbox" [disabled]="!auth.isAdmin()" [(ngModel)]="c.document.publicEnabled" /><span></span></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Run Row (same column split, equal height) -->
        <div class="solve-cols">
          <div class="card">
            <div class="card-head">
              <h3>ค้นหา seed ที่ดีที่สุด</h3>
              <div class="row">
                <select class="input" style="width: 110px; min-height: 32px" [(ngModel)]="bestCount">
                  <option [ngValue]="10">10 seed</option>
                  <option [ngValue]="20">20 seed</option>
                  <option [ngValue]="30">30 seed</option>
                  <option [ngValue]="50">50 seed</option>
                </select>
                <button class="btn sm primary" type="button" [disabled]="!auth.isAdmin() || busy()" (click)="runBest()">
                  <app-icon name="sparkles" [size]="15" /> เริ่มค้นหา
                </button>
              </div>
            </div>
            <div class="card-body">
              @if (!bestResult()) {
                <p class="small muted">ทดลองจัดตารางหลาย Seed แล้วเลือกตารางที่ได้ Soft cost ต่ำที่สุด (คาบโหว่น้อยและกระจายวันสมดุลที่สุด)</p>
              } @else {
                <div class="table-wrap" style="max-height: 220px">
                  <table class="table">
                    <thead><tr><th>อันดับ</th><th>Seed</th><th>Soft cost</th><th>เวลา</th><th></th></tr></thead>
                    <tbody>
                      @for (r of bestResult()!.results.slice(0, 10); track r.seed; let i = $index) {
                        <tr>
                          <td>{{ i + 1 }}</td>
                          <td class="mono"><strong>{{ r.seed }}</strong></td>
                          <td>{{ r.ok ? r.softCost : 'ไม่สำเร็จ' }}</td>
                          <td>{{ r.seconds }}s</td>
                          <td>
                            @if (r.seed === c.params['seed']) {
                              <span class="badge success">ใช้อยู่</span>
                            } @else if (r.ok && auth.isAdmin()) {
                              <button class="btn sm ghost" type="button" (click)="useSeed(r.seed)">ใช้ seed นี้</button>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>

          <div class="card">
            <div class="card-head"><h3>เริ่มจัดตารางสอน</h3></div>
            <div class="card-body" style="display: flex; flex-direction: column; justify-content: space-between; gap: 14px">
              <div class="algo-steps">
                <span>1. CSP Search (MRV + Restarts)</span>
                <span>2. Simulated Annealing (20,000 รอบ)</span>
                <span>3. Independent Validator (14 ข้อ)</span>
              </div>
              <div class="row">
                <button class="btn primary lg" type="button" [disabled]="!auth.isAdmin() || busy()" (click)="runSolve()">
                  <app-icon name="play" [size]="18" />
                  {{ solving() ? 'กำลังจัดตาราง… (' + elapsed() + 's)' : 'เริ่มจัดตาราง' }}
                </button>
                <button class="btn" type="button" [disabled]="!auth.isAdmin() || busy()" (click)="runDiagnose()">
                  วิเคราะห์สาเหตุ (เมื่อจัดตารางไม่ได้)
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Diagnosis Card -->
      @if (diagResult(); as dg) {
        <div class="card">
          <div class="card-head">
            <h3>ผลวิเคราะห์สาเหตุ</h3>
            <span class="badge" [class.success]="dg.feasible" [class.danger]="!dg.feasible">
              {{ dg.feasible ? 'จัดตารางได้' : 'พบอุปสรรค' }}
            </span>
          </div>
          <div class="card-body">
            @for (f of dg.findings; track $index) {
              <div class="alert" [class.success]="f.level === 'ok'" [class.danger]="f.level === 'error'" [class.warning]="f.level === 'warn'" style="margin-bottom: 8px">
                <strong>[{{ f.area }}]</strong> {{ f.message }}
              </div>
            }
            <div class="row" style="margin-top: 10px">
              @for (pr of dg.probes; track pr.label) {
                <span class="badge" [class.success]="pr.ok" [class.danger]="!pr.ok">{{ pr.ok ? '✓' : '✗' }} {{ pr.label }} ({{ pr.seconds }}s)</span>
              }
            </div>
          </div>
        </div>
      }

      <!-- Solve Result Card -->
      @if (solveResult(); as sr) {
        <div class="card">
          <div class="card-head">
            <h3>ผลลัพธ์: {{ sr.message }}</h3>
            @if (sr.validation) {
              <span class="badge" [class.success]="sr.validation.passed" [class.danger]="!sr.validation.passed">
                {{ sr.validation.passed ? 'Validator: ผ่านทุกข้อ' : 'Validator: พบข้อผิดพลาด' }}
              </span>
            }
          </div>
          <div class="card-body">
            @if (sr.status === 'success' && sr.stats) {
              <div class="grid-4" style="margin-bottom: 16px">
                <div class="stat-box"><small>แถว output</small><strong>{{ sr.rows.length }}</strong></div>
                <div class="stat-box"><small>บล็อกที่จัด</small><strong>{{ sr.stats.blocks }}</strong></div>
                <div class="stat-box"><small>รอบค้นหา (Restarts)</small><strong>{{ sr.stats.restarts }}</strong></div>
                <div class="stat-box"><small>Node ที่สำรวจ</small><strong>{{ sr.stats.nodes }}</strong></div>
                <div class="stat-box"><small>SA iterations</small><strong>{{ sr.stats.saIterations }}</strong></div>
                <div class="stat-box"><small>Soft cost</small><strong>{{ sr.stats.softCostBefore }} → {{ sr.stats.softCostAfter }}</strong></div>
                <div class="stat-box"><small>เวลาที่ใช้</small><strong>{{ sr.stats.seconds }} วินาที</strong></div>
                <div class="stat-box"><small>Seed</small><strong>{{ sr.stats.seed }}</strong></div>
              </div>
              @if (saPath()) {
                <div class="sa-box">
                  <div class="small muted" style="margin-bottom: 6px">กราฟการลด Soft Cost ด้วย Simulated Annealing</div>
                  <svg viewBox="0 0 600 120" class="sa-svg">
                    <path [attr.d]="saPath()" fill="none" stroke="var(--maroon-700)" stroke-width="2.5" />
                  </svg>
                </div>
              }
              <div class="row" style="margin-top: 14px">
                <a routerLink="/timetable" class="btn primary">เปิดดูตารางเรียน</a>
                <a routerLink="/report" class="btn">ดูผลตรวจเงื่อนไข</a>
                <a routerLink="/export" class="btn">ส่งออกไฟล์</a>
              </div>
            } @else {
              @for (e of sr.errors || []; track $index) {
                <div class="alert danger" style="margin-bottom: 8px">{{ e }}</div>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .solve-cols { display: grid; grid-template-columns: 1.1fr 1fr; gap: 18px; align-items: stretch; }
    .col { display: flex; flex-direction: column; gap: 18px; }
    .grow { flex: 1; }
    .sp-list { display: flex; flex-direction: column; gap: 8px; }
    .sp-row {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px;
      border: 1px solid var(--border); cursor: pointer;
    }
    .sp-row.on { background: var(--maroon-50); border-color: var(--maroon-200); }
    .no-tile {
      width: 28px; height: 28px; border-radius: 8px; background: var(--maroon-700); color: #fff;
      font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .basic-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
    .seed-list { display: flex; flex-direction: column; gap: 8px; }
    .seed-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; }
    .seed-num { background: var(--maroon-100); color: var(--maroon-700); font-weight: 700; padding: 4px 9px; border-radius: 8px; font-family: monospace; }
    .algo-steps { display: flex; flex-wrap: wrap; gap: 8px; }
    .algo-steps span { background: var(--maroon-50); border: 1px solid var(--border); padding: 5px 10px; border-radius: 8px; font-size: 12.5px; font-weight: 500; }
    .stat-box { background: var(--maroon-50); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; }
    .stat-box small { color: var(--text-muted); font-size: 12px; }
    .stat-box strong { font-size: 17px; color: var(--maroon-800); }
    .sa-box { border: 1px solid var(--border); border-radius: 10px; padding: 12px; background: #fff; }
    .sa-svg { width: 100%; height: 110px; display: block; }
    @media (max-width: 960px) { .solve-cols { grid-template-columns: 1fr; } }
  `,
})
export class SolvePage implements OnInit {
  private api = inject(Api);
  state = inject(AppState);
  auth = inject(AuthService);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);

  specials = SPECIALS;
  basics = BASICS;

  cfg = signal<Config | null>(null);
  seeds = signal<SavedSeed[]>([]);
  bestCount = 20;
  busy = signal(false);
  solving = signal(false);
  elapsed = signal(0);
  solveResult = signal<SolveResponse | null>(null);
  bestResult = signal<any>(null);
  diagResult = signal<any>(null);

  enabledCount = computed(() => {
    const c = this.cfg()?.constraints;
    return c ? SPECIALS.filter((s) => c[s.key]).length : 0;
  });

  saPath = computed(() => {
    const curve = this.solveResult()?.stats?.saCurve;
    if (!curve || curve.length < 2) return '';
    const maxI = curve[curve.length - 1].iter || 1;
    const ys = curve.map((p) => p.cost);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = Math.max(1, maxY - minY);
    return curve
      .map((p, i) => {
        const x = (p.iter / maxI) * 580 + 10;
        const y = 110 - ((p.cost - minY) / span) * 95;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  async ngOnInit() {
    const [cRes, sRes] = await Promise.all([this.api.getConfig(), this.api.getSeeds()]);
    this.cfg.set(cRes.config);
    this.seeds.set(sRes.seeds || []);
  }

  setAllSpecials(val: boolean) {
    const c = this.cfg();
    if (!c) return;
    for (const sp of SPECIALS) c.constraints[sp.key] = val;
    this.persistConfig();
  }

  shuffleSeed() {
    const c = this.cfg();
    if (!c) return;
    c.params['seed'] = Math.floor(1 + Math.random() * 99999);
    this.persistConfig();
  }

  async persistConfig(notify = false) {
    const c = this.cfg();
    if (!c || !this.auth.isAdmin()) return;
    try {
      const res = await this.api.saveConfig({ constraints: c.constraints, params: c.params, document: c.document });
      this.cfg.set(res.config);
      if (notify) this.toasts.success('บันทึกการตั้งค่าแล้ว');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async runSolve() {
    const c = this.cfg();
    if (!c) return;
    this.busy.set(true);
    this.solving.set(true);
    this.elapsed.set(0);
    const timer = setInterval(() => this.elapsed.update((v) => v + 1), 1000);
    try {
      const res = await this.api.solve({ constraints: c.constraints, params: c.params, document: c.document });
      this.solveResult.set(res);
      if (res.status === 'success') {
        await this.state.refreshTimetable();
        this.toasts.success('จัดตารางสำเร็จ');
      } else {
        this.toasts.error(res.message);
      }
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    } finally {
      clearInterval(timer);
      this.busy.set(false);
      this.solving.set(false);
    }
  }

  async runBest() {
    this.busy.set(true);
    try {
      const res = await this.api.bestSeed(this.bestCount);
      this.bestResult.set(res);
      if (res.status === 'success') {
        const cRes = await this.api.getConfig();
        this.cfg.set(cRes.config);
        await this.state.refreshTimetable();
        this.toasts.success(res.message);
      } else {
        this.toasts.error(res.message);
      }
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  async useSeed(seed: number) {
    const c = this.cfg();
    if (!c) return;
    c.params['seed'] = seed;
    await this.runSolve();
  }

  async runDiagnose() {
    this.busy.set(true);
    try {
      this.diagResult.set(await this.api.diagnose());
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  async saveCurrentSeed() {
    const name = await this.confirm.prompt({
      title: 'บันทึก Seed ปัจจุบัน',
      inputLabel: 'ชื่อ Seed',
      inputValue: `Seed ${this.state.timetable()?.meta?.stats?.seed || this.cfg()?.params['seed']}`,
    });
    if (!name) return;
    try {
      const res = await this.api.saveSeed({ name });
      this.seeds.set(res.seeds || []);
      this.toasts.success('บันทึก Seed แล้ว');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async applySavedSeed(s: SavedSeed) {
    this.busy.set(true);
    try {
      const res = await this.api.applySeed(s.id);
      this.solveResult.set(res);
      const cRes = await this.api.getConfig();
      this.cfg.set(cRes.config);
      await this.state.refreshTimetable();
      this.toasts.success(`ใช้งาน Seed ${s.seed} แล้ว`);
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  async removeSeed(s: SavedSeed) {
    const ok = await this.confirm.ask({ title: 'ลบ Seed', message: `ต้องการลบ "${s.name}" ใช่หรือไม่?`, danger: true });
    if (!ok) return;
    const res = await this.api.deleteSeed(s.id);
    this.seeds.set(res.seeds || []);
    this.toasts.info('ลบ Seed แล้ว');
  }
}
