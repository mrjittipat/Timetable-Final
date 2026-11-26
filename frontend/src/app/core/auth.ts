import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { User } from './models';

export const ROLE_TH: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  teacher: 'อาจารย์ผู้สอน',
  viewer: 'ผู้ชม',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  user = signal<User | null>(null);
  defaultAdmin = signal<{ username: string; password: string } | null>(null);
  loaded = signal(false);
  isAdmin = computed(() => this.user()?.role === 'admin');
  isTeacher = computed(() => this.user()?.role === 'teacher');

  async me() {
    const res = await firstValueFrom(
      this.http.get<{ user: User | null; defaultPassword: boolean; defaultAdmin: { username: string; password: string } | null }>('/api/auth/me')
    );
    this.user.set(res.user);
    this.defaultAdmin.set(res.defaultAdmin);
    this.loaded.set(true);
    return res.user;
  }

  async ensureLoaded() {
    if (!this.loaded()) {
      try {
        await this.me();
      } catch {
        this.user.set(null);
        this.loaded.set(true);
      }
    }
    return this.user();
  }

  async login(username: string, password: string) {
    const res = await firstValueFrom(this.http.post<{ user: User }>('/api/auth/login', { username, password }));
    this.user.set(res.user);
    this.loaded.set(true);
    return res.user;
  }

  async register(body: any) {
    return firstValueFrom(this.http.post<{ user: User }>('/api/auth/register', body));
  }

  async registerOptions() {
    return firstValueFrom(this.http.get<{ teachers: any[] }>('/api/auth/register-options'));
  }

  async logout() {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.user.set(null);
    }
  }

  async updateProfile(body: { name?: string; avatar?: string }) {
    const res = await firstValueFrom(this.http.put<{ user: User }>('/api/auth/profile', body));
    this.user.set(res.user);
    return res.user;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const res = await firstValueFrom(
      this.http.post<{ user: User }>('/api/auth/password', { currentPassword, newPassword })
    );
    this.user.set(res.user);
    this.defaultAdmin.set(null);
    return res.user;
  }
}

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const u = await auth.ensureLoaded();
  if (u) return true;
  return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const u = await auth.ensureLoaded();
  if (u?.role === 'admin') return true;
  return router.createUrlTree(['/']);
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((err) => {
      if (
        err?.status === 401 &&
        !req.url.includes('/api/auth/') &&
        !req.url.includes('/api/public/')
      ) {
        auth.user.set(null);
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
