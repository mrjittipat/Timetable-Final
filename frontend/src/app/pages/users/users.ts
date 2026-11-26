import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { AuthService, ROLE_TH } from '../../core/auth';
import { AppState } from '../../core/state';
import { Toasts } from '../../core/toast';
import { Confirm } from '../../core/confirm';
import { User } from '../../core/models';
import { AvatarComponent } from '../../shared/avatar';
import { IconComponent } from '../../shared/icon';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, AvatarComponent, IconComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">ผู้ดูแลระบบ</div>
          <h1>จัดการผู้ใช้งาน</h1>
        </div>
        <div class="row">
          <button class="btn primary" type="button" (click)="openDialog(null)">
            <app-icon name="plus" [size]="16" /> เพิ่มผู้ใช้
          </button>
        </div>
      </div>

      <div class="grid-4">
        <div class="card kpi"><small class="muted">ผู้ใช้ทั้งหมด</small><strong>{{ users().length }}</strong></div>
        <div class="card kpi"><small class="muted">ผู้ดูแลระบบ</small><strong>{{ countRole('admin') }}</strong></div>
        <div class="card kpi"><small class="muted">อาจารย์ผู้สอน</small><strong>{{ countRole('teacher') }}</strong></div>
        <div class="card kpi"><small class="muted">รออนุมัติ</small><strong>{{ pendingUsers().length }}</strong></div>
      </div>

      @if (pendingUsers().length > 0) {
        <div class="card">
          <div class="card-head"><h3>คำขอสมัครบัญชีอาจารย์รออนุมัติ ({{ pendingUsers().length }})</h3></div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 10px">
            @for (u of pendingUsers(); track u.username) {
              <div class="row" style="justify-content: space-between; border: 1px solid var(--border); padding: 10px 14px; border-radius: 10px">
                <div><strong>{{ u.name }}</strong> <span class="mono small muted">({{ u.username }})</span> · {{ u.teacher_id || 'ยังไม่ผูกอาจารย์' }}</div>
                <div class="row">
                  <button class="btn sm primary" type="button" (click)="approve(u)">อนุมัติ</button>
                  <button class="btn sm danger" type="button" (click)="reject(u)">ไม่อนุมัติ</button>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <div class="card">
        <div class="card-head">
          <input class="input" style="max-width: 280px" [(ngModel)]="search" placeholder="ค้นหาผู้ใช้…" />
          <div class="segmented">
            <button type="button" [class.active]="filter() === 'all'" (click)="filter.set('all')">ทั้งหมด</button>
            <button type="button" [class.active]="filter() === 'admin'" (click)="filter.set('admin')">ผู้ดูแลระบบ</button>
            <button type="button" [class.active]="filter() === 'teacher'" (click)="filter.set('teacher')">อาจารย์</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>ผู้ใช้</th><th>username</th><th>สิทธิ์</th><th>รหัสอาจารย์</th><th>สถานะ</th><th style="width: 96px">จัดการ</th></tr></thead>
            <tbody>
              @for (u of filtered(); track u.username) {
                <tr>
                  <td>
                    <div class="row" style="gap: 8px">
                      <app-avatar [src]="u.avatar" [name]="u.name" [size]="28" />
                      <span>{{ u.name }}</span>
                      @if (u.username === auth.user()?.username) { <span class="badge">คุณ</span> }
                    </div>
                  </td>
                  <td class="mono">{{ u.username }}</td>
                  <td><span class="badge neutral">{{ roleLabel(u.role) }}</span></td>
                  <td class="mono">{{ u.teacher_id || '-' }}</td>
                  <td><span class="badge" [class.success]="u.status === 'active'" [class.warning]="u.status === 'pending'">{{ u.status || 'active' }}</span></td>
                  <td>
                    <div class="row" style="gap: 4px; flex-wrap: nowrap">
                      <button class="btn icon ghost sm" type="button" (click)="openDialog(u)"><app-icon name="pencil" [size]="15" /></button>
                      <button class="btn icon ghost sm" style="color: var(--danger)" type="button" [disabled]="u.username === auth.user()?.username" (click)="remove(u)"><app-icon name="trash" [size]="15" /></button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (dialogOpen()) {
      <div class="scrim" (click)="dialogOpen.set(false)">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-head">
            <h3>{{ editing() ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่' }}</h3>
            <button class="btn icon ghost" type="button" (click)="dialogOpen.set(false)"><app-icon name="x" [size]="18" /></button>
          </div>
          <div class="dialog-body">
            <div class="field"><label>ชื่อผู้ใช้ (username)</label><input class="input" [disabled]="!!editing()" [(ngModel)]="form.username" /></div>
            <div class="field"><label>ชื่อที่แสดง</label><input class="input" [(ngModel)]="form.name" /></div>
            <div class="field">
              <label>สิทธิ์</label>
              <select class="input" [(ngModel)]="form.role">
                <option value="admin">ผู้ดูแลระบบ</option>
                <option value="teacher">อาจารย์ผู้สอน</option>
              </select>
            </div>
            <div class="field">
              <label>ผูกกับอาจารย์ (ถ้ามี)</label>
              <select class="input" [(ngModel)]="form.teacher_id">
                <option value="">— ไม่ผูก —</option>
                @for (t of teachers(); track t['teacher_id']) {
                  <option [value]="t['teacher_id']">{{ t['teacher_id'] }} {{ t['teacher_name'] }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label>รหัสผ่าน {{ editing() ? '(เว้นว่างหากไม่เปลี่ยน)' : '(อย่างน้อย 6 ตัวอักษร)' }}</label>
              <input class="input" type="password" [(ngModel)]="form.password" />
            </div>
          </div>
          <div class="dialog-foot">
            <button class="btn" type="button" (click)="dialogOpen.set(false)">ยกเลิก</button>
            <button class="btn primary" type="button" (click)="save()">บันทึก</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `.kpi { padding: 14px 18px; display: flex; flex-direction: column; } .kpi strong { font-size: 24px; color: var(--maroon-700); }`,
})
export class UsersPage implements OnInit {
  private api = inject(Api);
  auth = inject(AuthService);
  private state = inject(AppState);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);

  users = signal<User[]>([]);
  filter = signal<'all' | 'admin' | 'teacher'>('all');
  search = '';
  dialogOpen = signal(false);
  editing = signal<string | null>(null);
  form = { username: '', name: '', role: 'teacher', teacher_id: '', password: '' };

  teachers = computed(() => this.state.data()?.data?.['teacher'] || []);
  pendingUsers = computed(() => this.users().filter((u) => u.status === 'pending'));
  filtered = computed(() => {
    const q = this.search.trim().toLowerCase();
    return this.users().filter((u) => {
      if (this.filter() !== 'all' && u.role !== this.filter()) return false;
      if (q && !`${u.username} ${u.name} ${u.teacher_id || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  async ngOnInit() { await this.load(); }
  async load() { this.users.set((await this.api.getUsers()).users || []); }
  countRole(r: string) { return this.users().filter((u) => u.role === r && u.status !== 'pending').length; }
  roleLabel(r: string) { return ROLE_TH[r] || r; }

  openDialog(u: User | null) {
    if (u) {
      this.editing.set(u.username);
      this.form = { username: u.username, name: u.name, role: u.role, teacher_id: u.teacher_id || '', password: '' };
    } else {
      this.editing.set(null);
      this.form = { username: '', name: '', role: 'teacher', teacher_id: '', password: '' };
    }
    this.dialogOpen.set(true);
  }

  async save() {
    try {
      if (this.editing()) {
        await this.api.updateUser(this.editing()!, this.form);
        this.toasts.success('อัปเดตผู้ใช้แล้ว');
      } else {
        await this.api.createUser(this.form);
        this.toasts.success('สร้างบัญชีผู้ใช้แล้ว');
      }
      this.dialogOpen.set(false);
      await this.load();
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async remove(u: User) {
    const ok = await this.confirm.ask({ title: 'ลบผู้ใช้งาน', message: `ต้องการลบบัญชี "${u.username}" ใช่หรือไม่?`, danger: true });
    if (!ok) return;
    try {
      await this.api.deleteUser(u.username);
      await this.load();
      this.toasts.info('ลบผู้ใช้แล้ว');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async approve(u: User) {
    await this.api.approveUser(u.username, u.teacher_id);
    await this.load();
    this.toasts.success(`อนุมัติบัญชี ${u.username} แล้ว`);
  }

  async reject(u: User) {
    await this.api.rejectUser(u.username);
    await this.load();
    this.toasts.info(`ปฏิเสธคำขอ ${u.username} แล้ว`);
  }
}
