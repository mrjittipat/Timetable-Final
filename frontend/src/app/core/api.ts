import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Config, DataResponse, EntityRef, Grid, OutputRow, SolveResponse, TimetableResponse, View } from './models';

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  errorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจว่า backend ทำงานอยู่ (พอร์ต 3000)';
      return err.error?.message || err.message || 'เกิดข้อผิดพลาด';
    }
    return (err as any)?.message || 'เกิดข้อผิดพลาด';
  }

  getData() { return firstValueFrom(this.http.get<DataResponse>('/api/data')); }
  resetData() { return firstValueFrom(this.http.post<any>('/api/data/reset', {})); }
  autoAssignAdvisors() { return firstValueFrom(this.http.post<any>('/api/data/auto-advisors', {})); }
  addRow(entity: string, row: Record<string, any>) { return firstValueFrom(this.http.post<any>(`/api/data/${entity}`, row)); }
  updateRow(entity: string, key: string, row: Record<string, any>) { return firstValueFrom(this.http.put<any>(`/api/data/${entity}/${encodeURIComponent(key)}`, row)); }
  deleteRow(entity: string, key: string) { return firstValueFrom(this.http.delete<any>(`/api/data/${entity}/${encodeURIComponent(key)}`)); }

  importFiles(files: File[]) {
    const fd = new FormData();
    for (const f of files) fd.append('files', f, f.name);
    return firstValueFrom(this.http.post<any>('/api/import', fd));
  }

  getConfig() { return firstValueFrom(this.http.get<{ config: Config; defaults: Config }>('/api/config')); }
  saveConfig(body: Partial<Config>) { return firstValueFrom(this.http.put<{ config: Config }>('/api/config', body)); }
  resetConfig() { return firstValueFrom(this.http.post<{ config: Config }>('/api/config/reset', {})); }

  getSeeds() { return firstValueFrom(this.http.get<{ seeds: any[] }>('/api/seeds')); }
  saveSeed(body: any) { return firstValueFrom(this.http.post<any>('/api/seeds', body)); }
  updateSeed(id: string, body: any) { return firstValueFrom(this.http.put<any>(`/api/seeds/${id}`, body)); }
  deleteSeed(id: string) { return firstValueFrom(this.http.delete<any>(`/api/seeds/${id}`)); }
  applySeed(id: string) { return firstValueFrom(this.http.post<SolveResponse>(`/api/seeds/${id}/apply`, {})); }

  solve(body: any = {}) { return firstValueFrom(this.http.post<SolveResponse>('/api/solve', body)); }
  diagnose() { return firstValueFrom(this.http.post<any>('/api/diagnose', {})); }
  bestSeed(count = 20) { return firstValueFrom(this.http.post<any>('/api/solve/best', { count })); }
  getStats() { return firstValueFrom(this.http.get<any>('/api/stats')); }

  getTimetable() { return firstValueFrom(this.http.get<TimetableResponse>('/api/timetable')); }
  saveTimetable(rows: OutputRow[]) { return firstValueFrom(this.http.put<TimetableResponse>('/api/timetable', { rows })); }
  validateRows(rows: OutputRow[]) { return firstValueFrom(this.http.post<any>('/api/timetable/validate', { rows })); }
  moveOptions(body: any) { return firstValueFrom(this.http.post<{ targets: any[] }>('/api/timetable/move-options', body)); }
  moveSpan(body: any) { return firstValueFrom(this.http.post<TimetableResponse>('/api/timetable/move', body)); }
  editSpan(body: any) { return firstValueFrom(this.http.post<TimetableResponse>('/api/timetable/edit', body)); }

  getEntities() { return firstValueFrom(this.http.get<Record<View, EntityRef[]>>('/api/timetable/entities')); }
  getGrid(view: View, id: string) { return firstValueFrom(this.http.get<Grid>(`/api/timetable/grid?view=${view}&id=${encodeURIComponent(id)}`)); }
  getGrids(view: View) { return firstValueFrom(this.http.get<{ grids: Grid[] }>(`/api/timetable/grids?view=${view}`)); }
  getShare(view: View, id: string) { return firstValueFrom(this.http.get<any>(`/api/share?view=${view}&id=${encodeURIComponent(id)}`)); }

  getUsers() { return firstValueFrom(this.http.get<{ users: any[] }>('/api/users')); }
  createUser(body: any) { return firstValueFrom(this.http.post<any>('/api/users', body)); }
  updateUser(username: string, body: any) { return firstValueFrom(this.http.put<any>(`/api/users/${encodeURIComponent(username)}`, body)); }
  deleteUser(username: string) { return firstValueFrom(this.http.delete<any>(`/api/users/${encodeURIComponent(username)}`)); }
  approveUser(username: string, teacher_id?: string) { return firstValueFrom(this.http.post<any>(`/api/users/${encodeURIComponent(username)}/approve`, { teacher_id })); }
  rejectUser(username: string) { return firstValueFrom(this.http.post<any>(`/api/users/${encodeURIComponent(username)}/reject`, {})); }
  getAdminBadges() { return firstValueFrom(this.http.get<any>('/api/admin/badges')); }

  getMyGroups() { return firstValueFrom(this.http.get<any>('/api/teacher/my-groups')); }
  getTeacherRequests() { return firstValueFrom(this.http.get<any>('/api/teacher/requests')); }
  createTeacherRequest(body: any) { return firstValueFrom(this.http.post<any>('/api/teacher/requests', body)); }
  checkTeacherRequest(body: any) { return firstValueFrom(this.http.post<any>('/api/teacher/requests/check', body)); }
  deleteTeacherRequest(id: string) { return firstValueFrom(this.http.delete<any>(`/api/teacher/requests/${id}`)); }
  approveTeacherRequest(id: string, adminNote = '') { return firstValueFrom(this.http.post<any>(`/api/teacher/requests/${id}/approve`, { adminNote })); }
  rejectTeacherRequest(id: string, adminNote = '') { return firstValueFrom(this.http.post<any>(`/api/teacher/requests/${id}/reject`, { adminNote })); }
  getTeacherNotes() { return firstValueFrom(this.http.get<any>('/api/teacher/notes')); }
  createTeacherNote(body: any) { return firstValueFrom(this.http.post<any>('/api/teacher/notes', body)); }
  deleteTeacherNote(id: string) { return firstValueFrom(this.http.delete<any>(`/api/teacher/notes/${id}`)); }

  getPublicInfo() { return firstValueFrom(this.http.get<any>('/api/public/info')); }
  getPublicEntities() { return firstValueFrom(this.http.get<Record<View, EntityRef[]>>('/api/public/entities')); }
  getPublicGrid(view: View, id: string) { return firstValueFrom(this.http.get<Grid>(`/api/public/grid?view=${view}&id=${encodeURIComponent(id)}`)); }
  getPublicAppearance() { return firstValueFrom(this.http.get<any>('/api/public/appearance')); }
  saveAppearance(body: any) { return firstValueFrom(this.http.put<any>('/api/appearance', body)); }
  resetAppearance() { return firstValueFrom(this.http.post<any>('/api/appearance/reset', {})); }

  chat(message: string, context: any = {}) { return firstValueFrom(this.http.post<any>('/api/chat', { message, context })); }
  chatAction(kind: string, payload: any = {}) { return firstValueFrom(this.http.post<any>('/api/chat/action', { kind, payload })); }

  exportUrl(kind: 'csv' | 'xlsx' | 'pdf' | 'qr-pdf', view?: string, id?: string, inline = false): string {
    const qs = new URLSearchParams();
    if (view) qs.set('view', view);
    if (id) qs.set('id', id);
    if (inline) qs.set('inline', '1');
    const q = qs.toString();
    return `/api/export/${kind}${q ? '?' + q : ''}`;
  }
}
