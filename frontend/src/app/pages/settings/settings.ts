import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, ROLE_TH } from '../../core/auth';
import { Api } from '../../core/api';
import { Toasts } from '../../core/toast';
import { AvatarComponent } from '../../shared/avatar';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, AvatarComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">บัญชีของฉัน</div>
          <h1>ตั้งค่าโปรไฟล์</h1>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-head"><h3>ข้อมูลโปรไฟล์</h3></div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 14px">
            <div class="row">
              <app-avatar [src]="avatar()" [name]="name || auth.user()?.name || 'U'" [size]="96" />
              <div class="row" style="flex-direction: column; align-items: flex-start">
                <input #avInput type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" hidden (change)="onAvatarPick($event)" />
                <button class="btn sm" type="button" (click)="avInput.click()">เปลี่ยนรูป</button>
                @if (avatar()) {
                  <button class="btn sm ghost" style="color: var(--danger)" type="button" (click)="avatar.set('')">ลบรูป</button>
                }
              </div>
            </div>
            <div class="field">
              <label>ชื่อที่แสดง</label>
              <input class="input" [(ngModel)]="name" maxlength="80" />
            </div>
            <div class="small muted">
              ชื่อผู้ใช้: <strong class="mono">{{ auth.user()?.username }}</strong> ·
              สิทธิ์: <strong>{{ roleLabel(auth.user()?.role) }}</strong>
              @if (auth.user()?.teacher_id) { · รหัสอาจารย์: <strong class="mono">{{ auth.user()?.teacher_id }}</strong> }
            </div>
            <div><button class="btn primary" type="button" (click)="saveProfile()">บันทึกโปรไฟล์</button></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>เปลี่ยนรหัสผ่าน</h3></div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 12px">
            <div class="field"><label>รหัสผ่านเดิม</label><input class="input" [type]="showPw ? 'text' : 'password'" [(ngModel)]="curPw" /></div>
            <div class="field"><label>รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label><input class="input" [type]="showPw ? 'text' : 'password'" [(ngModel)]="newPw" /></div>
            <div class="field"><label>ยืนยันรหัสผ่านใหม่</label><input class="input" [type]="showPw ? 'text' : 'password'" [(ngModel)]="confirmPw" /></div>
            <label class="row small"><input type="checkbox" [(ngModel)]="showPw" /> แสดงรหัสผ่าน</label>
            @if (pwError()) { <div class="alert danger">{{ pwError() }}</div> }
            <div><button class="btn primary" type="button" (click)="changePw()">เปลี่ยนรหัสผ่าน</button></div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SettingsPage implements OnInit {
  auth = inject(AuthService);
  private api = inject(Api);
  private toasts = inject(Toasts);

  name = '';
  avatar = signal('');
  curPw = '';
  newPw = '';
  confirmPw = '';
  showPw = false;
  pwError = signal('');

  ngOnInit() {
    this.name = this.auth.user()?.name || '';
    this.avatar.set(this.auth.user()?.avatar || '');
  }

  roleLabel(role?: string) { return ROLE_TH[role || ''] || role || ''; }

  onAvatarPick(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 256;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 256, 256);
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
        this.avatar.set(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async saveProfile() {
    try {
      await this.auth.updateProfile({ name: this.name, avatar: this.avatar() });
      this.toasts.success('อัปเดตโปรไฟล์แล้ว');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async changePw() {
    this.pwError.set('');
    if (this.newPw.length < 6) { this.pwError.set('รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร'); return; }
    if (this.newPw !== this.confirmPw) { this.pwError.set('ยืนยันรหัสผ่านไม่ตรงกัน'); return; }
    try {
      await this.auth.changePassword(this.curPw, this.newPw);
      this.curPw = this.newPw = this.confirmPw = '';
      this.toasts.success('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
    } catch (err) {
      this.pwError.set(this.api.errorMessage(err));
    }
  }
}
