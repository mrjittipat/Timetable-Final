import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { Api } from '../../core/api';
import { ThemeService } from '../../core/theme';
import { IconComponent } from '../../shared/icon';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <div class="login-grid">
      <section class="left-pane" [style.background-image]="leftBg()">
        <div class="login-pat" [class]="theme.appearance().loginPattern || 'grid'"></div>
        <div class="left-top">
          <div class="logo-tile" [class]="theme.appearance().logoShape || 'rounded'">
            @if (theme.appearance().logoDataUrl) {
              <img [src]="theme.appearance().logoDataUrl" alt="logo" />
            } @else {
              <app-icon name="calendar" [size]="28" />
            }
          </div>
          <div>
            <div class="site-name">{{ theme.appearance().siteName || 'วิทยาลัยเทคนิคพังงา' }}</div>
            <div class="site-org">{{ theme.appearance().organization || 'สำนักงานคณะกรรมการการอาชีวศึกษา' }}</div>
          </div>
        </div>

        <div class="left-mid">
          @if (theme.appearance().loginBadge) {
            <span class="pill">{{ theme.appearance().loginBadge }}</span>
          }
          <h1>{{ theme.appearance().loginHeading || 'ระบบจัดตารางเรียนอัตโนมัติ' }}</h1>
          <p>{{ theme.appearance().loginDescription }}</p>
          @if (theme.appearance().loginShowChips) {
            <div class="chips">
              @if (theme.appearance().loginChip1) { <span>{{ theme.appearance().loginChip1 }}</span> }
              @if (theme.appearance().loginChip2) { <span>{{ theme.appearance().loginChip2 }}</span> }
              @if (theme.appearance().loginChip3) { <span>{{ theme.appearance().loginChip3 }}</span> }
            </div>
          }
        </div>

        <div class="left-foot">{{ theme.appearance().loginLeftFooter }}</div>
      </section>

      <section class="right-pane">
        <div class="auth-card">
          <div class="card-bar"></div>
          @if (pendingAccount(); as pend) {
            <div class="auth-body">
              <div class="icon-tile" [class.success-tile]="!pendingFromLogin()" [class.warn-tile]="pendingFromLogin()">
                <app-icon [name]="pendingFromLogin() ? 'clock' : 'check'" [size]="24" />
              </div>
              <h2>{{ pendingFromLogin() ? 'บัญชีนี้อยู่ระหว่างรออนุมัติ' : (theme.appearance().registerPendingTitle || 'ส่งคำขอสมัครบัญชีครูแล้ว') }}</h2>
              <p class="muted small">
                บัญชี <strong>{{ pend.name || pend.username }}</strong> (<span class="mono">{{ pend.username }}</span>)
                {{ pendingFromLogin() ? 'ยังไม่สามารถเข้าสู่ระบบได้จนกว่าผู้ดูแลระบบจะอนุมัติ' : 'ถูกส่งเข้าสู่ระบบเรียบร้อยแล้ว' }}
              </p>

              <div class="reg-steps">
                <div class="reg-step done">
                  <div class="rs-dot">✓</div>
                  <div class="rs-body">
                    <div class="rs-title">ส่งคำขอไปแล้ว</div>
                    <div class="rs-sub">บันทึกคำขอสมัครบัญชีอาจารย์เข้าสู่ระบบแล้ว</div>
                  </div>
                  <span class="badge success">เสร็จสิ้น</span>
                </div>
                <div class="reg-step active">
                  <div class="rs-dot">2</div>
                  <div class="rs-body">
                    <div class="rs-title">รอแอดมินอนุมัติ</div>
                    <div class="rs-sub">ผู้ดูแลระบบจะตรวจสอบและกดอนุมัติในหน้าจัดการผู้ใช้งาน</div>
                  </div>
                  <span class="badge warning">กำลังรอ</span>
                </div>
                <div class="reg-step">
                  <div class="rs-dot">3</div>
                  <div class="rs-body">
                    <div class="rs-title">ยืนยันเรียบร้อย</div>
                    <div class="rs-sub">เมื่อได้รับอนุมัติแล้ว สามารถเข้าสู่ระบบใช้งานได้ทันที</div>
                  </div>
                  <span class="badge">ถัดไป</span>
                </div>
              </div>

              <div class="form" style="margin-top: 18px">
                @if (pendingFromLogin()) {
                  <button class="btn primary lg" type="button" [disabled]="busy()" (click)="submitLogin()" style="width: 100%">
                    {{ busy() ? 'กำลังตรวจสอบ…' : 'ลองเข้าสู่ระบบอีกครั้ง' }}
                  </button>
                  <button class="btn" type="button" (click)="backToLogin()" style="width: 100%">เปลี่ยนบัญชี / กลับหน้าเข้าสู่ระบบ</button>
                } @else {
                  <button class="btn primary lg" type="button" (click)="backToLogin()" style="width: 100%">กลับหน้าเข้าสู่ระบบ</button>
                }
                @if (theme.appearance().loginShowPublicLink !== false) {
                  <a routerLink="/p" class="btn ghost" style="width: 100%">{{ theme.appearance().loginPublicLinkText || 'ดูตารางเรียนสาธารณะ' }}</a>
                }
              </div>
            </div>
          } @else if (!registerMode()) {
            <div class="auth-body">
              <div class="icon-tile"><app-icon name="shield" [size]="24" /></div>
              <h2>{{ theme.appearance()['loginCardTitle'] || 'เข้าสู่ระบบ' }}</h2>
              <p class="muted small">{{ theme.appearance()['loginCardSubtitle'] || 'กรอกชื่อผู้ใช้และรหัสผ่านเพื่อจัดการตารางเรียน' }}</p>

              @if (error()) {
                <div class="alert danger" style="margin-top: 12px">{{ error() }}</div>
              }

              <form (ngSubmit)="submitLogin()" class="form">
                <div class="field">
                  <label>ชื่อผู้ใช้</label>
                  <input class="input" name="username" [(ngModel)]="username" required autocomplete="username" />
                </div>
                <div class="field">
                  <label>รหัสผ่าน</label>
                  <div class="pw-row">
                    <input class="input" name="password" [type]="showPw() ? 'text' : 'password'" [(ngModel)]="password" required autocomplete="current-password" />
                    <button type="button" class="btn sm" (click)="showPw.update(v => !v)">{{ showPw() ? 'ซ่อน' : 'แสดง' }}</button>
                  </div>
                </div>
                <button class="btn primary lg" type="submit" [disabled]="busy()" style="width: 100%; margin-top: 6px">
                  {{ busy() ? 'กำลังเข้าสู่ระบบ…' : (theme.appearance()['loginButtonText'] || 'เข้าสู่ระบบ') }}
                </button>
              </form>

              @if (auth.defaultAdmin(); as def) {
                <div class="alert info" style="margin-top: 14px; font-size: 12.5px">
                  <div>
                    <strong>บัญชีเริ่มต้น:</strong> <code>{{ def.username }}</code> / <code>{{ def.password }}</code>
                  </div>
                </div>
              }

              @if (theme.appearance().registerEnabled !== false) {
                <div class="reg-cta">
                  <span class="muted small">{{ theme.appearance().registerPromptText }}</span>
                  <button type="button" class="btn ghost sm" (click)="openRegister()">{{ theme.appearance().registerLinkText }}</button>
                </div>
              }

              @if (theme.appearance().loginShowPublicLink !== false) {
                <div class="divider"><span>หรือ</span></div>
                <a routerLink="/p" class="btn" style="width: 100%">{{ theme.appearance().loginPublicLinkText }}</a>
              }
            </div>
          } @else {
            <div class="auth-body">
              <div class="icon-tile"><app-icon name="users" [size]="24" /></div>
              <h2>{{ theme.appearance().registerTitle }}</h2>
              <p class="muted small">{{ theme.appearance().registerSubtitle }}</p>

              @if (error()) {
                <div class="alert danger" style="margin-top: 12px">{{ error() }}</div>
              }

              <div class="role-card">
                <div class="row" style="justify-content: space-between">
                  <strong>{{ theme.appearance().registerTeacherLabel }}</strong>
                  <span class="badge warning">รออนุมัติจาก Admin</span>
                </div>
                <div class="small muted">{{ theme.appearance().registerTeacherDesc }}</div>
              </div>
              @if (theme.appearance().registerAdminNotice) {
                <div class="admin-notice">{{ theme.appearance().registerAdminNotice }}</div>
              }

              <form (ngSubmit)="submitRegister()" class="form">
                <div class="field">
                  <label>เลือกชื่ออาจารย์</label>
                  <select class="input" name="regTeacher" [(ngModel)]="regTeacherId" (ngModelChange)="onPickTeacher($event)">
                    <option value="">— เลือกอาจารย์ —</option>
                    @for (t of teachers(); track t.teacher_id) {
                      <option [value]="t.teacher_id">{{ t.teacher_id }} {{ t.teacher_name }}</option>
                    }
                  </select>
                </div>
                <div class="field">
                  <label>ชื่อที่แสดง</label>
                  <input class="input" name="regName" [(ngModel)]="regName" required />
                </div>
                <div class="field">
                  <label>ชื่อผู้ใช้ (username)</label>
                  <input class="input" name="regUser" [(ngModel)]="regUsername" required />
                </div>
                <div class="field">
                  <label>รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label>
                  <input class="input" name="regPass" type="password" [(ngModel)]="regPassword" required />
                </div>
                <button class="btn primary lg" type="submit" [disabled]="busy()" style="width: 100%">ส่งคำขอสมัครบัญชี</button>
                <button class="btn ghost" type="button" (click)="registerMode.set(false); error.set('')" style="width: 100%">กลับหน้าเข้าสู่ระบบ</button>
              </form>
            </div>
          }
        </div>
        <div class="right-foot muted small">{{ theme.appearance().footerText || '© วิทยาลัยเทคนิคพังงา · ระบบจัดตารางเรียนอัตโนมัติ' }}</div>
      </section>
    </div>
  `,
  styles: `
    .login-grid { display: grid; grid-template-columns: 1.15fr 1fr; min-height: 100vh; }
    .left-pane {
      position: relative; overflow: hidden;
      background:
        radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12), transparent 45%),
        radial-gradient(circle at 80% 80%, rgba(255,255,255,0.08), transparent 40%),
        linear-gradient(155deg, var(--maroon-700) 0%, var(--maroon-600) 45%, var(--maroon-950) 100%);
      background-size: cover; background-position: center;
      color: #fff; padding: 40px 48px; display: flex; flex-direction: column; justify-content: space-between;
    }
    .login-pat { position: absolute; inset: 0; pointer-events: none; opacity: 0.14; }
    .login-pat.grid { background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px); background-size: 24px 24px; }
    .login-pat.dots { background-image: radial-gradient(#fff 1.5px, transparent 1.5px); background-size: 16px 16px; }
    .login-pat.waves { background-image: repeating-radial-gradient(circle at 0 100%, transparent 0 14px, rgba(255,255,255,0.5) 15px 16px); }
    .login-pat.none { display: none; }
    .left-top, .left-mid, .left-foot { position: relative; z-index: 1; }
    .left-top { display: flex; align-items: center; gap: 14px; }
    .logo-tile {
      width: 52px; height: 52px; border-radius: 14px; background: #fff; color: var(--maroon-700);
      display: flex; align-items: center; justify-content: center; overflow: hidden;
    }
    .logo-tile.circle { border-radius: 50%; }
    .logo-tile.square { border-radius: 4px; }
    .role-card {
      margin-top: 12px; padding: 10px 12px; border-radius: 10px;
      border: 1.5px solid var(--maroon-700); background: var(--maroon-50);
      display: flex; flex-direction: column; gap: 4px;
    }
    .admin-notice {
      margin-top: 8px; padding: 8px 10px; border-radius: 8px;
      border: 1px dashed var(--border-strong); font-size: 12px; color: var(--text-muted);
    }
    .logo-tile img { width: 100%; height: 100%; object-fit: cover; }
    .site-name { font-size: 17px; font-weight: 700; }
    .site-org { font-size: 12.5px; opacity: 0.85; }
    .left-mid { max-width: 520px; }
    .pill {
      display: inline-block; padding: 4px 12px; border-radius: 999px;
      background: rgba(255,255,255,0.16); font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em;
    }
    .left-mid h1 { font-size: 34px; margin: 14px 0 10px; line-height: 1.25; }
    .left-mid p { font-size: 15px; opacity: 0.9; margin: 0 0 22px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chips span {
      padding: 6px 13px; border-radius: 999px; background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.22); font-size: 12.5px;
    }
    .left-foot { font-size: 12.5px; opacity: 0.78; }

    .right-pane {
      background: radial-gradient(var(--border) 1px, transparent 1px), var(--bg);
      background-size: 20px 20px; padding: 32px 24px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
    }
    .auth-card {
      width: 100%; max-width: 420px; background: var(--surface); border-radius: 16px;
      box-shadow: var(--shadow-lg); border: 1px solid var(--border); overflow: hidden;
    }
    .card-bar { height: 4px; background: var(--maroon-700); }
    .auth-body { padding: 28px; }
    .icon-tile {
      width: 46px; height: 46px; border-radius: 12px; background: var(--maroon-100);
      color: var(--maroon-700); display: flex; align-items: center; justify-content: center; margin-bottom: 12px;
    }
    .icon-tile.success-tile { background: #e8f8ee; color: #16803d; }
    .icon-tile.warn-tile { background: #fff4d6; color: #b45309; }
    .reg-steps { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
    .reg-step {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px;
      border-radius: 12px; border: 1px solid var(--border); background: var(--bg);
    }
    .reg-step.done { border-color: #a7e3be; background: #f2fbf5; }
    .reg-step.active { border-color: #f3c969; background: #fffaf0; }
    .rs-dot {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px; background: var(--border); color: var(--text-muted);
    }
    .reg-step.done .rs-dot { background: #16803d; color: #fff; }
    .reg-step.active .rs-dot { background: #d97706; color: #fff; }
    .rs-body { flex: 1; min-width: 0; }
    .rs-title { font-weight: 700; font-size: 13.5px; }
    .rs-sub { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }
    .form { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
    .pw-row { display: flex; gap: 8px; }
    .reg-cta { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 14px; }
    .divider { display: flex; align-items: center; gap: 10px; margin: 16px 0 12px; color: var(--text-muted); font-size: 12px; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }

    @media (max-width: 860px) {
      .login-grid { grid-template-columns: 1fr; }
      .left-pane { padding: 28px 24px; gap: 24px; }
      .left-mid h1 { font-size: 26px; }
    }
  `,
})
export class LoginPage implements OnInit {
  auth = inject(AuthService);
  theme = inject(ThemeService);
  private api = inject(Api);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  username = '';
  password = '';
  showPw = signal(false);
  busy = signal(false);
  error = signal('');

  registerMode = signal(false);
  pendingAccount = signal<{ username: string; name: string } | null>(null);
  pendingFromLogin = signal(false);
  teachers = signal<any[]>([]);
  regTeacherId = '';
  regName = '';
  regUsername = '';
  regPassword = '';

  leftBg() {
    const bg = this.theme.appearance().loginBgDataUrl;
    if (bg) return `linear-gradient(180deg, rgba(30,0,10,0.45), rgba(30,0,10,0.75)), url(${bg})`;
    return '';
  }

  async ngOnInit() {
    await Promise.all([this.theme.load(), this.auth.ensureLoaded()]);
    if (this.auth.user()) this.router.navigate(['/']);
    if (this.route.snapshot.queryParamMap.get('mode') === 'register') {
      this.openRegister();
    }
  }

  backToLogin() {
    this.registerMode.set(false);
    this.pendingAccount.set(null);
    this.pendingFromLogin.set(false);
    this.error.set('');
    this.regTeacherId = '';
    this.regName = '';
    this.regUsername = '';
    this.regPassword = '';
  }

  async openRegister() {
    this.registerMode.set(true);
    this.error.set('');
    this.pendingAccount.set(null);
    this.pendingFromLogin.set(false);
    try {
      const res = await this.auth.registerOptions();
      this.teachers.set(res.teachers || []);
    } catch {
      // ignore
    }
  }

  onPickTeacher(tid: string) {
    const t = this.teachers().find((x) => x.teacher_id === tid);
    if (t) {
      this.regName = t.teacher_name;
      if (!this.regUsername) this.regUsername = tid.toLowerCase();
    }
  }

  async submitLogin() {
    this.error.set('');
    this.busy.set(true);
    try {
      const u = await this.auth.login(this.username, this.password);
      this.pendingAccount.set(null);
      this.pendingFromLogin.set(false);
      const next = this.route.snapshot.queryParamMap.get('next');
      if (next) {
        this.router.navigateByUrl(next);
      } else if (u.role === 'teacher' && u.teacher_id) {
        this.router.navigate(['/timetable'], { queryParams: { view: 'teacher', id: u.teacher_id } });
      } else {
        this.router.navigate(['/']);
      }
    } catch (err: any) {
      const body = err?.error;
      if (body?.code === 'PENDING_APPROVAL' || String(body?.message || '').includes('รออนุมัติ')) {
        this.pendingFromLogin.set(true);
        this.pendingAccount.set({
          username: body?.pendingUser?.username || this.username,
          name: body?.pendingUser?.name || this.username,
        });
      } else {
        this.pendingAccount.set(null);
        this.pendingFromLogin.set(false);
        this.error.set(this.api.errorMessage(err));
      }
    } finally {
      this.busy.set(false);
    }
  }

  async submitRegister() {
    this.error.set('');
    this.busy.set(true);
    try {
      await this.auth.register({
        username: this.regUsername,
        name: this.regName,
        password: this.regPassword,
        teacher_id: this.regTeacherId,
        role: 'teacher',
      });
      this.pendingFromLogin.set(false);
      this.pendingAccount.set({ username: this.regUsername, name: this.regName || this.regUsername });
    } catch (err) {
      this.error.set(this.api.errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
