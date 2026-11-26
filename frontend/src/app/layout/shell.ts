import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { Api } from '../core/api';
import { AuthService, ROLE_TH } from '../core/auth';
import { AppState } from '../core/state';
import { ThemeService } from '../core/theme';
import { Toasts } from '../core/toast';
import { IconComponent } from '../shared/icon';
import { AvatarComponent } from '../shared/avatar';
import { ChatWidgetComponent } from '../shared/chat-widget';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, AvatarComponent, ChatWidgetComponent],
  template: `
    <a class="sr-only" href="#main">ข้ามไปยังเนื้อหา</a>
    <div class="shell" [class.collapsed]="collapsed()" [class.mobile-open]="mobileOpen()">
      <aside class="sidebar" [class]="'sidebar style-' + (theme.appearance()['sidebarStyle'] || 'gradient')">
        <div class="brand">
          <div class="brand-logo" [class]="theme.appearance()['logoShape'] || 'rounded'">
            @if (theme.appearance()['logoDataUrl']) {
              <img [src]="theme.appearance()['logoDataUrl']" alt="logo" />
            } @else {
              <app-icon name="calendar" [size]="20" />
            }
          </div>
          @if (!collapsed()) {
            <div class="brand-text">
              <div class="b-name">{{ theme.appearance()['siteName'] || 'วิทยาลัยเทคนิคพังงา' }}</div>
              <div class="b-sub">{{ theme.appearance()['siteSubtitle'] || 'ระบบจัดตารางเรียนอัตโนมัติ' }}</div>
            </div>
          }
        </div>

        <nav class="nav">
          @if (auth.isTeacher()) {
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="mobileOpen.set(false)">
              <app-icon name="dashboard" [size]="18" /> @if (!collapsed()) { <span>ภาพรวม</span> }
            </a>
            <a routerLink="/my-groups" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <app-icon name="users" [size]="18" /> @if (!collapsed()) { <span>กลุ่มเรียนที่รับผิดชอบ</span> }
            </a>
            <a routerLink="/teacher-hub" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <app-icon name="sliders" [size]="18" /> @if (!collapsed()) { <span>คำขอและบันทึกครู</span> }
            </a>
            <a routerLink="/timetable" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <app-icon name="calendar" [size]="18" /> @if (!collapsed()) { <span>ตารางเรียน</span> }
            </a>
            <a routerLink="/export" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <app-icon name="download" [size]="18" /> @if (!collapsed()) { <span>ส่งออกไฟล์</span> }
            </a>
          } @else {
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="mobileOpen.set(false)">
              <app-icon name="dashboard" [size]="18" /> @if (!collapsed()) { <span>ภาพรวม</span> }
            </a>
            <a routerLink="/data" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <app-icon name="database" [size]="18" /> @if (!collapsed()) { <span>จัดการข้อมูล</span> }
            </a>
            <button type="button" class="nav-group" (click)="toggleScheduleMenu()">
              <app-icon name="sliders" [size]="18" />
              @if (!collapsed()) {
                <span>จัดตารางสอน</span>
                <span class="spacer"></span>
                <app-icon name="chevron" [size]="15" [style.transform]="scheduleOpen() ? 'rotate(180deg)' : ''" />
              }
            </button>
            @if (scheduleOpen() && !collapsed()) {
              <div class="sub-nav">
                <a routerLink="/solve" routerLinkActive="active" (click)="mobileOpen.set(false)">จัดตารางสอนอัตโนมัติ</a>
                <a routerLink="/manual" routerLinkActive="active" (click)="mobileOpen.set(false)">จัดตารางสอนด้วยมือ</a>
              </div>
            }
            <a routerLink="/timetable" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <app-icon name="calendar" [size]="18" /> @if (!collapsed()) { <span>ตารางเรียน</span> }
            </a>
            <a routerLink="/report" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <app-icon name="shield" [size]="18" /> @if (!collapsed()) { <span>ผลตรวจเงื่อนไข</span> }
            </a>
            <a routerLink="/export" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <app-icon name="download" [size]="18" /> @if (!collapsed()) { <span>ส่งออกไฟล์</span> }
            </a>
            <a routerLink="/appearance" routerLinkActive="active" (click)="mobileOpen.set(false)">
              <app-icon name="palette" [size]="18" /> @if (!collapsed()) { <span>ตกแต่งหน้าเว็บ</span> }
            </a>
            @if (auth.isAdmin()) {
              <a routerLink="/teacher-hub" routerLinkActive="active" (click)="mobileOpen.set(false)">
                <app-icon name="layers" [size]="18" />
                @if (!collapsed()) {
                  <span style="flex: 1">คำขอจากครู</span>
                  @if (badges().pendingRequests > 0) {
                    <span class="nav-badge">{{ badges().pendingRequests }}</span>
                  }
                } @else if (badges().pendingRequests > 0) {
                  <span class="nav-dot"></span>
                }
              </a>
              <a routerLink="/users" routerLinkActive="active" (click)="mobileOpen.set(false)">
                <app-icon name="users" [size]="18" />
                @if (!collapsed()) {
                  <span style="flex: 1">จัดการผู้ใช้งาน</span>
                  @if (badges().pendingUsers > 0) {
                    <span class="nav-badge">{{ badges().pendingUsers }}</span>
                  }
                } @else if (badges().pendingUsers > 0) {
                  <span class="nav-dot"></span>
                }
              </a>
            }
          }
        </nav>

        @if (!collapsed()) {
          <a routerLink="/report" class="status-card">
            <div class="st-label">สถานะตารางล่าสุด</div>
            @if (!state.hasTimetable()) {
              <div class="st-val">ยังไม่ได้จัดตาราง</div>
              <div class="st-hint">กดจัดตารางอัตโนมัติเพื่อเริ่ม</div>
            } @else if (state.validationPassed()) {
              <div class="st-val">ผ่านทุกเงื่อนไข</div>
              <div class="st-hint">{{ state.timetable()?.rows?.length }} คาบในตาราง</div>
            } @else {
              <div class="st-val">มีเงื่อนไขไม่ผ่าน</div>
              <div class="st-hint">ดูรายละเอียดที่ผลตรวจเงื่อนไข</div>
            }
          </a>
        }
      </aside>

      <div class="main-wrap">
        <header class="topbar">
          <div class="row">
            <button class="btn icon ghost" type="button" (click)="toggleSidebar()" aria-label="สลับเมนู">
              <app-icon name="menu" [size]="20" />
            </button>
            <span class="top-title">{{ theme.appearance()['topBarTitle'] || 'ระบบจัดตารางเรียนด้วยอัลกอริทึมปัญญาประดิษฐ์' }}</span>
          </div>
          <div class="row">
            <button class="btn sm" type="button" [disabled]="state.loading()" (click)="reload()">
              <app-icon name="refresh" [size]="15" /> โหลดข้อมูลใหม่
            </button>
            <div class="profile-wrap">
              <button class="profile-btn" type="button" (click)="menuOpen.update(v => !v)">
                <app-avatar [src]="auth.user()?.avatar" [name]="auth.user()?.name || 'U'" [size]="32" />
                <div class="p-meta">
                  <span class="p-name">{{ auth.user()?.name }}</span>
                  <span class="p-role">{{ roleLabel(auth.user()?.role) }}</span>
                </div>
                <app-icon name="chevron" [size]="15" />
              </button>
              @if (menuOpen()) {
                <div class="profile-menu" (click)="menuOpen.set(false)">
                  <div class="pm-head">
                    <app-avatar [src]="auth.user()?.avatar" [name]="auth.user()?.name || 'U'" [size]="40" />
                    <div>
                      <div style="font-weight: 600">{{ auth.user()?.name }}</div>
                      <div class="small muted">{{ auth.user()?.username }} · {{ roleLabel(auth.user()?.role) }}</div>
                    </div>
                  </div>
                  <a routerLink="/settings" class="pm-item">ตั้งค่าโปรไฟล์</a>
                  <button type="button" class="pm-item danger" (click)="doLogout()">ออกจากระบบ</button>
                </div>
              }
            </div>
          </div>
        </header>

        @if (auth.user()?.mustChangePassword) {
          <div class="banner warn">
            <span>บัญชีนี้ยังใช้รหัสผ่านเริ่มต้นหรือรหัสที่ผู้ดูแลตั้งให้ กรุณาเปลี่ยนรหัสผ่านเพื่อความปลอดภัย</span>
            <a routerLink="/settings" class="btn sm">เปลี่ยนรหัสผ่าน</a>
          </div>
        }
        @if (!auth.isAdmin()) {
          <div class="banner info">
            <span>บัญชี{{ roleLabel(auth.user()?.role) }} ดูข้อมูลได้อย่างเดียว การแก้ไขทำได้เฉพาะผู้ดูแลระบบ</span>
          </div>
        }

        <main id="main" class="content">
          <router-outlet />
        </main>
      </div>
    </div>

    <app-chat-widget />
  `,
  styles: `
    .shell { display: flex; min-height: 100vh; }
    .sidebar {
      width: var(--sidebar-w); flex-shrink: 0; color: #fff;
      background: linear-gradient(180deg, var(--maroon-800) 0%, var(--maroon-950) 100%);
      display: flex; flex-direction: column; padding: 14px 12px; gap: 14px;
      position: sticky; top: 0; height: 100vh; overflow-y: auto; transition: width 0.2s var(--ease);
    }
    .sidebar.style-solid { background: var(--maroon-700); }
    .sidebar.style-dark { background: #1a1215; }
    .sidebar.style-light { background: var(--surface); color: var(--text); border-right: 1px solid var(--border); }
    .shell.collapsed .sidebar { width: 72px; }

    .brand { display: flex; align-items: center; gap: 10px; padding: 4px; }
    .brand-logo {
      width: 38px; height: 38px; border-radius: 10px; background: #fff; color: var(--maroon-700);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden;
    }
    .brand-logo.circle { border-radius: 50%; }
    .brand-logo.square { border-radius: 3px; }
    .brand-logo img { width: 100%; height: 100%; object-fit: cover; }
    .b-name { font-weight: 700; font-size: 13.5px; line-height: 1.25; }
    .b-sub { font-size: 11px; opacity: 0.8; }

    .nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .nav a, .nav-group {
      position: relative;
      display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 10px;
      color: inherit; text-decoration: none; font-size: 13.5px; font-weight: 500;
      border: none; background: transparent; width: 100%; cursor: pointer; font-family: inherit;
    }
    .nav-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
      background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; line-height: 1;
    }
    .nav-dot {
      position: absolute; top: 7px; right: 10px; width: 8px; height: 8px; border-radius: 50%;
      background: #ef4444;
    }
    .nav a:hover, .nav-group:hover { background: rgba(255,255,255,0.12); }
    .nav a.active { background: #fff; color: var(--maroon-700); font-weight: 600; }
    .style-light .nav a.active { background: var(--maroon-700); color: #fff; }
    .sub-nav { display: flex; flex-direction: column; gap: 2px; padding-left: 34px; }
    .sub-nav a { font-size: 13px; padding: 7px 10px; opacity: 0.92; }

    .status-card {
      background: rgba(255,255,255,0.12); color: inherit; border-radius: 12px;
      padding: 12px; text-decoration: none; display: block;
    }
    .style-light .status-card { background: var(--maroon-50); }
    .st-label { font-size: 11px; opacity: 0.8; }
    .st-val { font-weight: 700; font-size: 14px; margin-top: 2px; }
    .st-hint { font-size: 11.5px; opacity: 0.85; }

    .main-wrap { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .topbar {
      height: var(--header-h); background: var(--surface); border-bottom: 1px solid var(--border);
      padding: 0 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
      position: sticky; top: 0; z-index: 100;
    }
    .top-title { font-weight: 600; font-size: 15px; }
    .profile-wrap { position: relative; }
    .profile-btn {
      display: flex; align-items: center; gap: 8px; border: 1px solid var(--border);
      background: var(--surface); border-radius: 999px; padding: 3px 10px 3px 4px; cursor: pointer; font: inherit;
    }
    .p-meta { display: flex; flex-direction: column; text-align: left; line-height: 1.2; }
    .p-name { font-size: 13px; font-weight: 600; }
    .p-role { font-size: 11px; color: var(--text-muted); }
    .profile-menu {
      position: absolute; right: 0; top: 46px; width: 230px; background: var(--surface);
      border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-lg); overflow: hidden; z-index: 200;
    }
    .pm-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
    .pm-item {
      display: block; width: 100%; text-align: left; padding: 10px 14px; border: none;
      background: transparent; font: inherit; font-size: 13.5px; color: var(--text); cursor: pointer;
    }
    .pm-item:hover { background: var(--maroon-50); text-decoration: none; }
    .pm-item.danger { color: var(--danger); }

    .banner {
      padding: 9px 20px; font-size: 13px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .banner.warn { background: var(--warning-bg); color: var(--warning); border-bottom: 1px solid #f3d69d; }
    .banner.info { background: #eef4ff; color: #1d4ed8; border-bottom: 1px solid #c8dcff; }
    .content { flex: 1; }

    @media (max-width: 960px) {
      .sidebar { position: fixed; left: -280px; z-index: 300; transition: left 0.2s; }
      .shell.mobile-open .sidebar { left: 0; }
      .top-title { display: none; }
    }
  `,
})
export class ShellComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  state = inject(AppState);
  theme = inject(ThemeService);
  private api = inject(Api);
  private toasts = inject(Toasts);
  private router = inject(Router);

  collapsed = signal(localStorage.getItem('tt-sidebar-collapsed-v1') === '1');
  mobileOpen = signal(false);
  scheduleOpen = signal(true);
  menuOpen = signal(false);
  badges = signal<{ pendingUsers: number; pendingRequests: number }>({ pendingUsers: 0, pendingRequests: 0 });

  private navSub?: Subscription;
  private badgeTimer: any = null;

  ngOnInit() {
    this.state.refresh();
    this.refreshBadges();
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.refreshBadges());
    this.badgeTimer = setInterval(() => this.refreshBadges(), 20000);
  }

  ngOnDestroy() {
    this.navSub?.unsubscribe();
    if (this.badgeTimer) clearInterval(this.badgeTimer);
  }

  async refreshBadges() {
    if (!this.auth.isAdmin()) return;
    try {
      const b = await this.api.getAdminBadges();
      this.badges.set({
        pendingUsers: Number(b?.pendingUsers) || 0,
        pendingRequests: Number(b?.pendingRequests) || 0,
      });
    } catch {
      // ignore
    }
  }

  roleLabel(role?: string) {
    return ROLE_TH[role || ''] || role || '';
  }

  toggleSidebar() {
    if (window.innerWidth <= 960) {
      this.mobileOpen.update((v) => !v);
    } else {
      const next = !this.collapsed();
      this.collapsed.set(next);
      localStorage.setItem('tt-sidebar-collapsed-v1', next ? '1' : '0');
    }
  }

  toggleScheduleMenu() {
    if (this.collapsed()) {
      this.collapsed.set(false);
      this.scheduleOpen.set(true);
    } else {
      this.scheduleOpen.update((v) => !v);
    }
  }

  async reload() {
    await Promise.all([this.state.refresh(), this.refreshBadges()]);
    this.toasts.info('โหลดข้อมูลล่าสุดแล้ว');
  }

  async doLogout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}
