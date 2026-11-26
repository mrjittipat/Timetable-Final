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
      <section class="left-pane">
        <div class="left-top">
          <div class="logo-tile">
            @if (theme.appearance()['logoDataUrl']) {
              <img [src]="theme.appearance()['logoDataUrl']" alt="logo" />
            } @else {
              <app-icon name="calendar" [size]="28" />
            }
          </div>
          <div>
            <div class="site-name">{{ theme.appearance()['siteName'] || 'คณะศึกษาศาสตร์ มกช. กระบี่' }}</div>
            <div class="site-org">{{ theme.appearance()['organization'] || 'มหาวิทยาลัยการกีฬาแห่งชาติ วิทยาเขตกระบี่' }}</div>
          </div>
        </div>

        <div class="left-mid">
          <span class="pill">{{ theme.appearance()['loginBadge'] || 'SMART TIMETABLE' }}</span>
          <h1>{{ theme.appearance()['loginHeading'] || 'ระบบจัดตารางเรียนอัตโนมัติ' }}</h1>
          <p>{{ theme.appearance()['loginDescription'] || 'หลักสูตรศึกษาศาสตรบัณฑิต สาขาพลศึกษา ชั้นปีที่ 1–4 ตรวจครบทุกเงื่อนไข พร้อมใช้งานทั้งคณะ' }}</p>
          <div class="chips">
            <span>{{ theme.appearance()['loginChip1'] || 'CSP Search + SA' }}</span>
            <span>{{ theme.appearance()['loginChip2'] || 'ตรวจครบ 13 เงื่อนไข' }}</span>
            <span>{{ theme.appearance()['loginChip3'] || 'ส่งออก CSV / Excel / PDF' }}</span>
          </div>
        </div>

        <div class="left-foot">{{ theme.appearance()['loginLeftFooter'] || 'ภาคเรียนที่ 2 ปีการศึกษา 2569 · คณะศึกษาศาสตร์ มกช. กระบี่' }}</div>
      </section>

      <section class="right-pane">
        <div class="auth-card">
          <div class="card-bar"></div>
          @if (!registerMode()) {
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

              <div class="reg-cta">
                <span class="muted small">ยังไม่มีบัญชีอาจารย์ผู้สอน?</span>
                <button type="button" class="btn ghost sm" (click)="openRegister()">สมัครบัญชีอาจารย์</button>
              </div>

              <div class="divider"><span>หรือ</span></div>
              <a routerLink="/p" class="btn" style="width: 100%">ดูตารางเรียนสาธารณะ (ไม่ต้องเข้าสู่ระบบ)</a>
            </div>
          } @else {
            <div class="auth-body">
              <div class="icon-tile"><app-icon name="users" [size]="24" /></div>
              <h2>สมัครบัญชีอาจารย์ผู้สอน</h2>
              <p class="muted small">สร้างบัญชีเพื่อดูตารางสอนและส่งคำขอปรับคาบ (รออนุมัติจาก Admin)</p>

              @if (regSuccess()) {
                <div class="alert success" style="margin-top: 12px">ส่งคำขอสมัครบัญชีแล้ว กรุณารอผู้ดูแลระบบอนุมัติ</div>
              }
              @if (error()) {
                <div class="alert danger" style="margin-top: 12px">{{ error() }}</div>
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
        <div class="right-foot muted small">{{ theme.appearance()['footerText'] || '© คณะศึกษาศาสตร์ มหาวิทยาลัยการกีฬาแห่งชาติ วิทยาเขตกระบี่' }}</div>
      </section>
    </div>
  `,
  styles: `
    .login-grid { display: grid; grid-template-columns: 1.15fr 1fr; min-height: 100vh; }
    .left-pane {
      background:
        radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12), transparent 45%),
        radial-gradient(circle at 80% 80%, rgba(255,255,255,0.08), transparent 40%),
        linear-gradient(155deg, var(--maroon-700) 0%, var(--maroon-950) 100%);
      color: #fff; padding: 40px 48px; display: flex; flex-direction: column; justify-content: space-between;
    }
    .left-top { display: flex; align-items: center; gap: 14px; }
    .logo-tile {
      width: 52px; height: 52px; border-radius: 14px; background: #fff; color: var(--maroon-700);
      display: flex; align-items: center; justify-content: center; overflow: hidden;
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
  regSuccess = signal(false);
  teachers = signal<any[]>([]);
  regTeacherId = '';
  regName = '';
  regUsername = '';
  regPassword = '';

  async ngOnInit() {
    await this.auth.ensureLoaded();
    if (this.auth.user()) this.router.navigate(['/']);
    if (this.route.snapshot.queryParamMap.get('mode') === 'register') {
      this.openRegister();
    }
  }

  async openRegister() {
    this.registerMode.set(true);
    this.error.set('');
    this.regSuccess.set(false);
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
      const next = this.route.snapshot.queryParamMap.get('next');
      if (next) {
        this.router.navigateByUrl(next);
      } else if (u.role === 'teacher' && u.teacher_id) {
        this.router.navigate(['/timetable'], { queryParams: { view: 'teacher', id: u.teacher_id } });
      } else {
        this.router.navigate(['/']);
      }
    } catch (err) {
      this.error.set(this.api.errorMessage(err));
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
      this.regSuccess.set(true);
    } catch (err) {
      this.error.set(this.api.errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
