import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { AuthService } from '../../core/auth';
import { Toasts } from '../../core/toast';

@Component({
  selector: 'app-teacher-hub',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">ศูนย์สื่อสารอาจารย์และผู้ดูแล</div>
          <h1>{{ auth.isAdmin() ? 'คำขอจากครู' : 'คำขอและบันทึกช่วยจำ' }}</h1>
        </div>
      </div>

      <div class="hub-stack">
        <div class="card">
          <div class="card-head"><h3>คำขอย้าย / เปลี่ยนคาบสอน ({{ requests().length }})</h3></div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 10px">
            @if (requests().length === 0) {
              <div class="muted small">ยังไม่มีคำขอ</div>
            }
            @for (r of requests(); track r.id) {
              <div class="req-box">
                <div class="row" style="justify-content: space-between">
                  <strong>{{ r.teacher_name }} ({{ r.subject_id || r.kind }})</strong>
                  <span class="badge" [class.success]="r.status === 'approved'" [class.danger]="r.status === 'rejected'" [class.warning]="r.status === 'pending'">
                    {{ r.status }}
                  </span>
                </div>
                <div class="small muted">จาก {{ r.fromDay }} คาบ {{ r.fromPeriod }} → {{ r.toDay }} คาบ {{ r.toPeriod }} · {{ r.reason }}</div>
                @if (auth.isAdmin() && r.status === 'pending') {
                  <div class="row" style="margin-top: 8px">
                    <button class="btn sm primary" type="button" (click)="approve(r.id)">อนุมัติและปรับตาราง</button>
                    <button class="btn sm danger" type="button" (click)="reject(r.id)">ไม่อนุมัติ</button>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        @if (!auth.isAdmin()) {
          <div class="card">
            <div class="card-head"><h3>บันทึกช่วยจำส่วนตัว ({{ notes().length }})</h3></div>
            <div class="card-body" style="display: flex; flex-direction: column; gap: 10px">
              <div class="row">
                <input class="input" style="flex: 1" [(ngModel)]="noteTitle" placeholder="หัวข้อบันทึก…" />
                <button class="btn sm primary" type="button" (click)="addNote()">เพิ่มบันทึก</button>
              </div>
              <textarea class="input" rows="2" [(ngModel)]="noteContent" placeholder="รายละเอียด…"></textarea>
              @for (n of notes(); track n.id) {
                <div class="req-box">
                  <div class="row" style="justify-content: space-between">
                    <strong>{{ n.title }}</strong>
                    <button class="btn sm ghost" style="color: var(--danger)" type="button" (click)="delNote(n.id)">ลบ</button>
                  </div>
                  <div class="small muted">{{ n.content }}</div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .hub-stack { display: flex; flex-direction: column; gap: 16px; }
    .req-box { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
  `,
})
export class TeacherHubPage implements OnInit {
  private api = inject(Api);
  auth = inject(AuthService);
  private toasts = inject(Toasts);

  requests = signal<any[]>([]);
  notes = signal<any[]>([]);
  noteTitle = '';
  noteContent = '';

  async ngOnInit() { await this.load(); }

  async load() {
    if (this.auth.isAdmin()) {
      const r = await this.api.getTeacherRequests();
      this.requests.set(r.requests || []);
      return;
    }
    const [r, n] = await Promise.all([this.api.getTeacherRequests(), this.api.getTeacherNotes()]);
    this.requests.set(r.requests || []);
    this.notes.set(n.notes || []);
  }

  async approve(id: string) {
    try {
      await this.api.approveTeacherRequest(id);
      await this.load();
      this.toasts.success('อนุมัติและปรับตารางเรียบร้อย');
    } catch (err) {
      this.toasts.error(this.api.errorMessage(err));
    }
  }

  async reject(id: string) {
    await this.api.rejectTeacherRequest(id);
    await this.load();
    this.toasts.info('ปฏิเสธคำขอแล้ว');
  }

  async addNote() {
    if (!this.noteTitle.trim()) return;
    await this.api.createTeacherNote({ title: this.noteTitle, content: this.noteContent });
    this.noteTitle = this.noteContent = '';
    await this.load();
  }

  async delNote(id: string) {
    await this.api.deleteTeacherNote(id);
    await this.load();
  }
}
