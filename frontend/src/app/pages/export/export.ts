import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { AppState } from '../../core/state';
import { IconComponent } from '../../shared/icon';
import { PdfPreviewComponent } from '../../shared/pdf-preview';

@Component({
  selector: 'app-export',
  standalone: true,
  imports: [RouterLink, IconComponent, PdfPreviewComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">ขั้นตอนที่ 4</div>
          <h1>ส่งออกไฟล์</h1>
          <p>ดาวน์โหลดไฟล์มาตรฐาน output.csv, Excel (.xlsx), เอกสาร PDF (A4 แนวนอน) และ QR Code ติดหน้าห้อง</p>
        </div>
      </div>

      @if (!state.hasTimetable()) {
        <div class="card"><div class="empty">ยังไม่มีตารางเรียน กรุณากดจัดตารางก่อน <a routerLink="/solve" class="btn primary">ไปหน้าจัดตาราง</a></div></div>
      } @else {
        <div class="grid-2">
          <div class="card">
            <div class="card-head"><h3>output.csv</h3><span class="badge">5 คอลัมน์มาตรฐาน</span></div>
            <div class="card-body">
              <p class="small muted">รูปแบบ <code>group_id,timeslot_id,subject_id,teacher_id,room_id</code> (ไม่มี BOM, ใช้ <code>+</code> คั่น 2 อาจารย์ / 2 สถานที่)</p>
              <a class="btn primary" [href]="api.exportUrl('csv')" download="output.csv">
                <app-icon name="download" [size]="16" /> ดาวน์โหลด output.csv
              </a>
            </div>
          </div>

          <div class="card">
            <div class="card-head"><h3>Excel (.xlsx)</h3><span class="badge">TH SarabunPSK</span></div>
            <div class="card-body">
              <p class="small muted">รูปแบบตารางราชการ แยกชีตตามกลุ่มเรียน อาจารย์ ห้อง/สนาม และชีตข้อมูลดิบ output</p>
              <div class="row">
                <a class="btn primary sm" [href]="api.exportUrl('xlsx', 'all')" download>รวมทั้งหมด</a>
                <a class="btn sm" [href]="api.exportUrl('xlsx', 'group')" download>กลุ่มเรียน</a>
                <a class="btn sm" [href]="api.exportUrl('xlsx', 'teacher')" download>อาจารย์</a>
                <a class="btn sm" [href]="api.exportUrl('xlsx', 'room')" download>ห้อง/สนาม</a>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-head"><h3>PDF (A4 แนวนอน)</h3><span class="badge">พร้อมพิมพ์ 1 หน้า/คน</span></div>
            <div class="card-body">
              <p class="small muted">ฟอร์มทางการพร้อมโลโก้ ตารางสรุปรายวิชา ท. ป. น. ช. และช่องลายเซ็น 4 ตำแหน่ง</p>
              <div class="row">
                <button class="btn primary sm" type="button" (click)="pdfUrl.set(api.exportUrl('pdf', 'group', '', true))">กลุ่มเรียน</button>
                <button class="btn sm" type="button" (click)="pdfUrl.set(api.exportUrl('pdf', 'teacher', '', true))">อาจารย์ผู้สอน</button>
                <button class="btn sm" type="button" (click)="pdfUrl.set(api.exportUrl('pdf', 'room', '', true))">ห้องและสนาม</button>
                <button class="btn sm" type="button" (click)="pdfUrl.set(api.exportUrl('pdf', 'all', '', true))">รวมทั้งหมด</button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-head"><h3>QR code ติดหน้าห้อง</h3><span class="badge">2×3 การ์ด/หน้า</span></div>
            <div class="card-body">
              <p class="small muted">สร้างแผ่น QR Code สำหรับติดหน้าห้องเรียนและสนาม เพื่อให้สแกนดูตารางล่าสุดผ่านหน้าสาธารณะ</p>
              <div class="row">
                <button class="btn primary sm" type="button" (click)="pdfUrl.set(api.exportUrl('qr-pdf', 'group', '', true))">QR กลุ่มเรียน</button>
                <button class="btn sm" type="button" (click)="pdfUrl.set(api.exportUrl('qr-pdf', 'room', '', true))">QR ห้อง/สนาม</button>
                <a routerLink="/p" target="_blank" class="btn sm">เปิดหน้าตารางสาธารณะ</a>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>ตัวอย่างข้อมูล output.csv (12 แถวแรก จากทั้งหมด {{ state.timetable()?.rows?.length }} แถว)</h3>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>group_id</th><th>timeslot_id</th><th>subject_id</th><th>teacher_id</th><th>room_id</th></tr></thead>
              <tbody>
                @for (r of (state.timetable()?.rows || []).slice(0, 12); track $index) {
                  <tr class="mono">
                    <td>{{ r.group_id }}</td><td>{{ r.timeslot_id }}</td><td>{{ r.subject_id }}</td><td>{{ r.teacher_id }}</td><td>{{ r.room_id }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    <app-pdf-preview [url]="pdfUrl()" (closed)="pdfUrl.set(null)" />
  `,
})
export class ExportPage {
  api = inject(Api);
  state = inject(AppState);
  pdfUrl = signal<string | null>(null);
}
