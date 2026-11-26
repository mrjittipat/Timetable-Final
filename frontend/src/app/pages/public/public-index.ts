import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { ThemeService } from '../../core/theme';
import { EntityRef, View } from '../../core/models';
import { IconComponent } from '../../shared/icon';

@Component({
  selector: 'app-public-index',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <div class="pub-wrap">
      <header class="pub-hero" [style.background]="heroBg()">
        <div class="pub-pat" [class]="pub().heroPattern || 'grid'"></div>
        <div class="pub-inner" style="position: relative; z-index: 1">
          <div class="row" style="justify-content: space-between; width: 100%; align-items: center; gap: 16px">
            <div class="row" style="gap: 14px; align-items: center">
              @if (pub().showLogo !== false) {
                <div class="pub-logo" [class]="theme.appearance().logoShape || 'rounded'">
                  @if (theme.appearance().logoDataUrl) {
                    <img [src]="theme.appearance().logoDataUrl" alt="logo" />
                  } @else {
                    <app-icon name="calendar" [size]="26" />
                  }
                </div>
              }
              <div>
                <div class="eyebrow-w">{{ theme.appearance().siteName || info()?.college }}</div>
                <h1>{{ pub().heroTitle || 'ตารางเรียนสาธารณะ' }}</h1>
                <p>{{ pub().heroSubtitle || 'ภาคเรียนที่ ' + (info()?.semester || '2') + '/' + (info()?.year || '2569') }}</p>
              </div>
            </div>
            @if (pub().showLoginButton !== false) {
              <a routerLink="/login" class="btn pub-login-btn">{{ pub().loginButtonText || 'เข้าสู่ระบบผู้ดูแล' }}</a>
            }
          </div>
        </div>
      </header>

      <div class="pub-inner pub-main">
        @if (pub().announcementEnabled && pub().announcementText) {
          <div class="alert" [class]="pub().announcementTone || 'info'">
            {{ pub().announcementText }}
          </div>
        }

        @if (pub().carouselEnabled && slides().length > 0) {
          <section class="carousel-box"
                   [style.border-radius]="carouselRadius()"
                   [style.height]="carouselHeight()"
                   [style.background]="carouselBg()">
            @if (activeSlide(); as sl) {
              @if ((pub().carouselBgMode || 'blur') === 'blur') {
                <img [src]="sl.imageDataUrl" alt="" aria-hidden="true" class="carousel-blur-bg" />
              }
              <img [src]="sl.imageDataUrl"
                   [alt]="sl.title || 'ประชาสัมพันธ์'"
                   class="carousel-img"
                   [style.object-fit]="pub().carouselFit || 'cover'"
                   [style.object-position]="pub().carouselPosition || 'center'"
                   [style.height]="pub().carouselHeight === 'auto' ? 'auto' : '100%'" />
              @if (sl.title || sl.caption) {
                <div class="carousel-caption">
                  @if (sl.title) { <div class="cc-title">{{ sl.title }}</div> }
                  @if (sl.caption) { <div class="cc-sub">{{ sl.caption }}</div> }
                </div>
              }
            }
            @if (slides().length > 1) {
              <button type="button" class="car-nav prev" (click)="stepSlide(-1)" aria-label="ภาพก่อนหน้า">‹</button>
              <button type="button" class="car-nav next" (click)="stepSlide(1)" aria-label="ภาพถัดไป">›</button>
              <div class="car-dots">
                @for (sl of slides(); track sl.id; let i = $index) {
                  <button type="button" class="car-dot" [class.active]="slideIndex() === i" (click)="goSlide(i)" [attr.aria-label]="'สไลด์ ' + (i + 1)"></button>
                }
              </div>
            }
          </section>
        }

        @if (pub().showStats !== false && info()?.enabled) {
          <div class="pub-stats">
            <div class="card stat-tile">
              <div class="st-lbl">กลุ่มเรียน</div>
              <div class="st-val">{{ entities().group.length }}</div>
            </div>
            <div class="card stat-tile">
              <div class="st-lbl">อาจารย์ผู้สอน</div>
              <div class="st-val">{{ entities().teacher.length }}</div>
            </div>
            <div class="card stat-tile">
              <div class="st-lbl">ห้องเรียน / สนาม</div>
              <div class="st-val">{{ entities().room.length }}</div>
            </div>
          </div>
        }

        @if (info() && !info()!.enabled) {
          <div class="card"><div class="empty">ยังไม่มีการเผยแพร่ตารางเรียน</div></div>
        } @else {
          <div class="row" style="justify-content: space-between; gap: 12px">
            <div class="segmented">
              <button type="button" [class.active]="view() === 'group'" (click)="view.set('group')">กลุ่มเรียน ({{ entities().group.length }})</button>
              <button type="button" [class.active]="view() === 'teacher'" (click)="view.set('teacher')">อาจารย์ ({{ entities().teacher.length }})</button>
              <button type="button" [class.active]="view() === 'room'" (click)="view.set('room')">ห้อง/สนาม ({{ entities().room.length }})</button>
            </div>
            <input class="input" style="max-width: 280px" [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="ค้นหา…" />
          </div>

          <div class="pub-cards" [style.grid-template-columns]="'repeat(' + (pub().cardColumns || 3) + ', minmax(0, 1fr))'">
            @for (e of filtered(); track e.id) {
              <a [routerLink]="['/p', view(), e.id]" class="card pub-card">
                <div style="font-weight: 600; color: var(--maroon-700)">{{ e.title }}</div>
                <div class="small muted" style="margin-top: 4px">{{ e.subtitle }}</div>
              </a>
            }
          </div>
        }
      </div>

      @if (pub().showFooter !== false) {
        <footer class="pub-footer">
          {{ pub().footerNote || theme.appearance().footerText || '© วิทยาลัยเทคนิคพังงา · ระบบจัดตารางเรียนอัตโนมัติ' }}
        </footer>
      }
    </div>
  `,
  styles: `
    .pub-wrap { min-height: 100vh; background: var(--bg); display: flex; flex-direction: column; }
    .pub-hero {
      position: relative; overflow: hidden;
      color: #fff; padding: 28px 16px;
      background-size: cover !important; background-position: center !important;
    }
    .pub-pat { position: absolute; inset: 0; pointer-events: none; opacity: 0.14; }
    .pub-pat.grid { background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px); background-size: 24px 24px; }
    .pub-pat.dots { background-image: radial-gradient(#fff 1.5px, transparent 1.5px); background-size: 16px 16px; }
    .pub-pat.waves { background-image: repeating-radial-gradient(circle at 0 100%, transparent 0 14px, rgba(255,255,255,0.5) 15px 16px); }
    .pub-pat.none { display: none; }
    .pub-inner { max-width: 1240px; margin: 0 auto; width: 100%; }
    .pub-main { padding: 24px 16px; display: flex; flex-direction: column; gap: 18px; flex: 1; }

    .pub-logo {
      width: 52px; height: 52px; border-radius: 14px; background: #fff; color: var(--maroon-700);
      display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;
    }
    .pub-logo.circle { border-radius: 50%; }
    .pub-logo.square { border-radius: 4px; }
    .pub-logo img { width: 100%; height: 100%; object-fit: cover; }
    .eyebrow-w { font-size: 12.5px; opacity: 0.85; font-weight: 600; margin-bottom: 4px; }
    .pub-hero p { margin: 6px 0 0; opacity: 0.9; font-size: 14px; }
    .pub-login-btn { background: rgba(255,255,255,0.18); color: #fff; border-color: rgba(255,255,255,0.35); }
    .pub-login-btn:hover { background: rgba(255,255,255,0.28); color: #fff; }

    .carousel-box {
      position: relative; width: 100%; overflow: hidden;
      background: #141418; border: 1px solid var(--border); box-shadow: var(--shadow-sm);
    }
    .carousel-blur-bg {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: cover; filter: blur(22px) brightness(0.72);
      transform: scale(1.14); pointer-events: none;
    }
    .carousel-img { position: relative; z-index: 1; width: 100%; display: block; }
    .carousel-caption {
      position: absolute; z-index: 2; left: 0; right: 0; bottom: 0;
      padding: 16px 20px; background: linear-gradient(180deg, transparent, rgba(0,0,0,0.68));
      color: #fff;
    }
    .cc-title { font-weight: 700; font-size: 16px; }
    .cc-sub { font-size: 13px; opacity: 0.9; margin-top: 2px; }
    .car-nav {
      position: absolute; z-index: 3; top: 50%; transform: translateY(-50%);
      width: 38px; height: 38px; border-radius: 50%; border: none;
      background: rgba(0,0,0,0.45); color: #fff; font-size: 24px; line-height: 1;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .car-nav:hover { background: rgba(0,0,0,0.68); }
    .car-nav.prev { left: 12px; }
    .car-nav.next { right: 12px; }
    .car-dots {
      position: absolute; z-index: 3; left: 50%; bottom: 10px; transform: translateX(-50%);
      display: flex; gap: 6px; padding: 4px 8px; border-radius: 999px; background: rgba(0,0,0,0.35);
    }
    .car-dot {
      width: 8px; height: 8px; border-radius: 50%; border: none; padding: 0;
      background: rgba(255,255,255,0.5); cursor: pointer;
    }
    .car-dot.active { background: #fff; width: 20px; border-radius: 999px; }

    .pub-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .stat-tile { padding: 14px 18px; }
    .st-lbl { font-size: 12.5px; color: var(--text-muted); }
    .st-val { font-size: 24px; font-weight: 700; color: var(--maroon-700); margin-top: 2px; }

    .pub-cards { display: grid; gap: 12px; }
    .pub-card { padding: 16px 18px; display: block; text-decoration: none; color: inherit; transition: transform 0.12s, box-shadow 0.12s; }
    .pub-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); text-decoration: none; }

    .pub-footer {
      text-align: center; padding: 18px 16px; font-size: 12.5px; color: var(--text-muted);
      border-top: 1px solid var(--border); background: var(--surface); margin-top: 24px;
    }

    @media (max-width: 900px) {
      .pub-cards { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 600px) {
      .pub-cards, .pub-stats { grid-template-columns: 1fr !important; }
    }
  `,
})
export class PublicIndexPage implements OnInit, OnDestroy {
  private api = inject(Api);
  theme = inject(ThemeService);

  info = signal<any>(null);
  entities = signal<Record<View, EntityRef[]>>({ group: [], teacher: [], room: [] });
  view = signal<View>('group');
  search = signal('');
  slideIndex = signal(0);

  private timer: any = null;

  pub = computed(() => this.theme.appearance().public);
  slides = computed(() => this.pub().carouselSlides || []);
  activeSlide = computed(() => {
    const list = this.slides();
    if (!list.length) return null;
    return list[this.slideIndex() % list.length];
  });

  filtered = computed(() => {
    const list = this.entities()[this.view()] || [];
    const q = this.search().trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => `${e.id} ${e.title} ${e.subtitle}`.toLowerCase().includes(q));
  });

  constructor() {
    effect(() => {
      const p = this.pub();
      const count = (p.carouselSlides || []).length;
      this.clearTimer();
      if (p.carouselEnabled && p.carouselAutoplay && count > 1) {
        const ms = Math.max(2000, (Number(p.carouselIntervalSec) || 5) * 1000);
        this.timer = setInterval(() => {
          this.slideIndex.update((i) => (i + 1) % count);
        }, ms);
      }
    });
  }

  heroBg() {
    const p = this.pub();
    if (p.heroStyle === 'image' && p.heroBgDataUrl) {
      return `linear-gradient(180deg, rgba(20,0,8,0.48), rgba(20,0,8,0.72)), url(${p.heroBgDataUrl})`;
    }
    if (p.heroStyle === 'solid') return 'var(--maroon-700)';
    return 'linear-gradient(135deg, var(--maroon-700), var(--maroon-950))';
  }

  carouselHeight() {
    const h = this.pub().carouselHeight || 'md';
    if (h === 'sm') return '200px';
    if (h === 'lg') return '420px';
    if (h === 'xl') return '540px';
    if (h === 'auto') return 'auto';
    return '300px';
  }

  carouselRadius() {
    const r = this.pub().carouselRadius || 'md';
    if (r === 'none') return '0px';
    if (r === 'sm') return '8px';
    if (r === 'lg') return '24px';
    return '14px';
  }

  carouselBg() {
    const p = this.pub();
    const m = p.carouselBgMode || 'blur';
    if (m === 'gradient') return 'linear-gradient(135deg, var(--maroon-700), var(--maroon-950))';
    if (m === 'dark') return '#141418';
    if (m === 'solid') return p.carouselBgColor || '#1a1a2e';
    return '#141418';
  }

  stepSlide(delta: number) {
    const n = this.slides().length;
    if (n <= 1) return;
    this.slideIndex.update((i) => (i + delta + n) % n);
  }

  goSlide(idx: number) {
    this.slideIndex.set(idx);
  }

  private clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async ngOnInit() {
    await this.theme.load();
    const inf = await this.api.getPublicInfo();
    this.info.set(inf);
    if (inf.enabled) {
      this.entities.set(await this.api.getPublicEntities());
    }
  }

  ngOnDestroy() {
    this.clearTimer();
  }
}
