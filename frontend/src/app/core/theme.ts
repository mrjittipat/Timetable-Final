import { Injectable, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Api } from './api';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private api = inject(Api);
  appearance = signal<Record<string, any>>({
    siteName: 'คณะศึกษาศาสตร์ มกช. กระบี่',
    siteSubtitle: 'ระบบจัดตารางเรียนอัตโนมัติ',
    topBarTitle: 'ระบบจัดตารางเรียนด้วยอัลกอริทึมปัญญาประดิษฐ์',
    organization: 'มหาวิทยาลัยการกีฬาแห่งชาติ วิทยาเขตกระบี่',
    primaryColor: '#800020',
    accentColor: '#9b1b30',
    bgColor: '#faf7f7',
    surfaceColor: '#ffffff',
    textColor: '#22161a',
    sidebarStyle: 'gradient',
    sidebarWidth: 248,
    fontSize: 14,
    borderRadius: 14,
    darkMode: false,
    pdf: {},
    public: {},
  });

  async load() {
    try {
      const res = await this.api.getPublicAppearance();
      if (res?.appearance) this.apply(res.appearance);
    } catch {
      // use defaults
    }
  }

  apply(app: Record<string, any>) {
    this.appearance.set(app);
    const root = document.documentElement;
    if (app['primaryColor']) {
      root.style.setProperty('--maroon-700', app['primaryColor']);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', app['primaryColor']);
    }
    if (app['accentColor']) root.style.setProperty('--maroon-600', app['accentColor']);
    if (app['bgColor']) root.style.setProperty('--bg', app['darkMode'] ? '#151013' : app['bgColor']);
    if (app['surfaceColor']) root.style.setProperty('--surface', app['darkMode'] ? '#21181c' : app['surfaceColor']);
    if (app['textColor']) root.style.setProperty('--text', app['darkMode'] ? '#f5ecef' : app['textColor']);
    if (app['fontSize']) root.style.setProperty('--font-size', `${app['fontSize']}px`);
    if (app['borderRadius'] != null) root.style.setProperty('--radius-lg', `${app['borderRadius']}px`);
    if (app['sidebarWidth']) root.style.setProperty('--sidebar-w', `${app['sidebarWidth']}px`);

    let styleEl = document.getElementById('tt-custom-css') as HTMLStyleElement | null;
    if (app['customCss']) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'tt-custom-css';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = app['customCss'];
    } else if (styleEl) {
      styleEl.remove();
    }
  }
}

@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private title = inject(Title);
  private theme = inject(ThemeService);

  override updateTitle(snapshot: RouterStateSnapshot) {
    const pageTitle = this.buildTitle(snapshot);
    const site = this.theme.appearance()['siteName'] || 'ระบบจัดตารางเรียนอัตโนมัติ';
    this.title.setTitle(pageTitle ? `${pageTitle} · ${site}` : site);
  }
}
