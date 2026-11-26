import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Grid, View } from '../../core/models';
import { TimetableSheetComponent } from '../../shared/timetable-sheet';
import { PdfPreviewComponent } from '../../shared/pdf-preview';

@Component({
  selector: 'app-public-view',
  standalone: true,
  imports: [RouterLink, TimetableSheetComponent, PdfPreviewComponent],
  template: `
    <div class="pub-wrap">
      <header class="pub-bar">
        <div class="pub-inner row" style="justify-content: space-between">
          <a routerLink="/p" class="btn sm ghost">← กลับหน้ารวมตาราง</a>
          <div class="row">
            <a class="btn sm" [href]="'/api/public/ics?view=' + view() + '&id=' + id()" download>เพิ่มลงปฏิทิน (.ics)</a>
            <button class="btn sm primary" type="button" (click)="pdfUrl.set('/api/public/pdf?view=' + view() + '&id=' + id() + '&inline=1')">PDF / พิมพ์</button>
          </div>
        </div>
      </header>

      <div class="pub-inner" style="padding: 20px 16px; display: flex; flex-direction: column; gap: 18px">
        @if (grid(); as g) {
          <div class="card">
            <div class="card-head">
              <div>
                <h2>{{ g.entity?.title }}</h2>
                <div class="small muted">{{ g.entity?.subtitle }} · รวม {{ g.total }} คาบ/สัปดาห์</div>
              </div>
            </div>
            <div class="card-body">
              <app-timetable-sheet [grid]="g" [view]="view()" />
            </div>
          </div>

          @if (g.subjects?.list?.length) {
            <div class="card">
              <div class="card-head"><h3>สรุปรายวิชา (น. บ. ป. ศ.)</h3></div>
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>รหัสวิชา</th><th>ชื่อรายวิชา</th><th>น.</th><th>บ.</th><th>ป.</th><th>ศ.</th></tr></thead>
                  <tbody>
                    @for (s of g.subjects!.list; track s.subject_id) {
                      <tr><td class="mono">{{ s.subject_id }}</td><td>{{ s.name }}</td><td>{{ s.n }}</td><td>{{ s.t }}</td><td>{{ s.p }}</td><td>{{ s.s }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        }
      </div>
    </div>

    <app-pdf-preview [url]="pdfUrl()" (closed)="pdfUrl.set(null)" />
  `,
  styles: `
    .pub-wrap { min-height: 100vh; background: var(--bg); }
    .pub-bar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 10px 16px; position: sticky; top: 0; z-index: 50; }
    .pub-inner { max-width: 1280px; margin: 0 auto; }
  `,
})
export class PublicViewPage implements OnInit {
  private api = inject(Api);
  view = input.required<View>();
  id = input.required<string>();

  grid = signal<Grid | null>(null);
  pdfUrl = signal<string | null>(null);

  async ngOnInit() {
    this.grid.set(await this.api.getPublicGrid(this.view(), this.id()));
  }
}
