import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from './api';
import { DataResponse, TimetableResponse } from './models';

@Injectable({ providedIn: 'root' })
export class AppState {
  private api = inject(Api);

  data = signal<DataResponse | null>(null);
  timetable = signal<TimetableResponse | null>(null);
  loading = signal(false);
  version = signal(0);

  hasTimetable = computed(() => (this.timetable()?.rows?.length || 0) > 0);
  validationPassed = computed(() => Boolean(this.timetable()?.validation?.passed));

  bump() {
    this.version.update((v) => v + 1);
  }

  async refreshData() {
    const d = await this.api.getData();
    this.data.set(d);
    return d;
  }

  async refreshTimetable() {
    const tt = await this.api.getTimetable();
    this.timetable.set(tt);
    return tt;
  }

  async refresh() {
    this.loading.set(true);
    try {
      await Promise.all([this.refreshData(), this.refreshTimetable()]);
      this.bump();
    } finally {
      this.loading.set(false);
    }
  }
}
