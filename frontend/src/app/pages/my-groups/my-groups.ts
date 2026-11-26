import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';

@Component({
  selector: 'app-my-groups',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">สำหรับอาจารย์ผู้สอน</div>
          <h1>กลุ่มเรียนที่รับผิดชอบ</h1>
        </div>
      </div>
      @if (info(); as d) {
        <div class="grid-4">
          <div class="card kpi"><small class="muted">อาจารย์</small><strong>{{ d.teacher?.teacher_name || '-' }}</strong></div>
          <div class="card kpi"><small class="muted">กลุ่มที่สอน</small><strong>{{ d.responsibleGroups?.length || 0 }}</strong></div>
          <div class="card kpi"><small class="muted">ภาระสอนรวม</small><strong>{{ d.totalPeriods || 0 }} คาบ</strong></div>
          <div class="card kpi"><small class="muted">จำนวนวิชา</small><strong>{{ d.subjectsCount || 0 }} วิชา</strong></div>
        </div>
        <div class="grid-3">
          @for (g of d.responsibleGroups || []; track g.group_id) {
            <div class="card">
              <div class="card-head"><h3>{{ g.group_name }} ({{ g.group_id }})</h3><span class="badge">{{ g.periods }} คาบ</span></div>
              <div class="card-body">
                <ul style="margin: 0 0 12px; padding-left: 18px; font-size: 13px">
                  @for (s of g.subjects; track s.subject_id) { <li>{{ s.subject_id }} {{ s.subject_name }}</li> }
                </ul>
                <a [routerLink]="['/timetable']" [queryParams]="{ view: 'group', id: g.group_id }" class="btn sm primary">ดูตารางเรียนกลุ่มนี้</a>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `.kpi { padding: 16px; display: flex; flex-direction: column; gap: 4px; } .kpi strong { font-size: 20px; color: var(--maroon-700); }`,
})
export class MyGroupsPage implements OnInit {
  private api = inject(Api);
  info = signal<any>(null);
  async ngOnInit() { this.info.set(await this.api.getMyGroups()); }
}
