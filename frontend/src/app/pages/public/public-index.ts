import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { ThemeService } from '../../core/theme';
import { EntityRef, View } from '../../core/models';

@Component({
  selector: 'app-public-index',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="pub-wrap">
      <header class="pub-hero">
        <div class="pub-inner">
          <div class="row" style="justify-content: space-between; width: 100%">
            <div>
              <div class="eyebrow-w">{{ info()?.college || theme.appearance()['siteName'] }}</div>
              <h1>{{ theme.appearance()['public']?.['heroTitle'] || 'ตารางเรียนสาธารณะ' }}</h1>
              <p>{{ theme.appearance()['public']?.['heroSubtitle'] || 'ภาคเรียนที่ ' + (info()?.semester || '2') + '/' + (info()?.year || '2569') }}</p>
            </div>
            <a routerLink="/login" class="btn">เข้าสู่ระบบผู้ดูแล</a>
          </div>
        </div>
      </header>

      <div class="pub-inner" style="padding: 24px 16px">
        @if (info() && !info()!.enabled) {
          <div class="card"><div class="empty">ยังไม่มีการเผยแพร่ตารางเรียน</div></div>
        } @else {
          <div class="row" style="margin-bottom: 16px; justify-content: space-between">
            <div class="segmented">
              <button type="button" [class.active]="view() === 'group'" (click)="view.set('group')">กลุ่มเรียน ({{ entities().group.length }})</button>
              <button type="button" [class.active]="view() === 'teacher'" (click)="view.set('teacher')">อาจารย์ ({{ entities().teacher.length }})</button>
              <button type="button" [class.active]="view() === 'room'" (click)="view.set('room')">ห้อง/สนาม ({{ entities().room.length }})</button>
            </div>
            <input class="input" style="max-width: 280px" [(ngModel)]="search" placeholder="ค้นหา…" />
          </div>

          <div class="grid-3">
            @for (e of filtered(); track e.id) {
              <a [routerLink]="['/p', view(), e.id]" class="card pub-card">
                <div style="font-weight: 600; color: var(--maroon-700)">{{ e.title }}</div>
                <div class="small muted" style="margin-top: 4px">{{ e.subtitle }}</div>
              </a>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .pub-wrap { min-height: 100vh; background: var(--bg); }
    .pub-hero { background: linear-gradient(135deg, var(--maroon-700), var(--maroon-950)); color: #fff; padding: 28px 16px; }
    .pub-inner { max-width: 1240px; margin: 0 auto; }
    .eyebrow-w { font-size: 12.5px; opacity: 0.85; font-weight: 600; margin-bottom: 4px; }
    .pub-hero p { margin: 6px 0 0; opacity: 0.9; font-size: 14px; }
    .pub-card { padding: 16px 18px; display: block; text-decoration: none; color: inherit; transition: transform 0.12s, box-shadow 0.12s; }
    .pub-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); text-decoration: none; }
  `,
})
export class PublicIndexPage implements OnInit {
  private api = inject(Api);
  theme = inject(ThemeService);

  info = signal<any>(null);
  entities = signal<Record<View, EntityRef[]>>({ group: [], teacher: [], room: [] });
  view = signal<View>('group');
  search = '';

  filtered = computed(() => {
    const list = this.entities()[this.view()] || [];
    const q = this.search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => `${e.id} ${e.title} ${e.subtitle}`.toLowerCase().includes(q));
  });

  async ngOnInit() {
    const inf = await this.api.getPublicInfo();
    this.info.set(inf);
    if (inf.enabled) {
      this.entities.set(await this.api.getPublicEntities());
    }
  }
}
