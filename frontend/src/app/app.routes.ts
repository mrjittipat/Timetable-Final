import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/auth';

export const routes: Routes = [
  {
    path: 'login',
    title: 'เข้าสู่ระบบ',
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
  },
  {
    path: 'p',
    title: 'ตารางเรียนสาธารณะ',
    loadComponent: () => import('./pages/public/public-index').then((m) => m.PublicIndexPage),
  },
  {
    path: 'p/:view/:id',
    title: 'ตารางเรียนสาธารณะ',
    loadComponent: () => import('./pages/public/public-view').then((m) => m.PublicViewPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.ShellComponent),
    children: [
      { path: '', title: 'ภาพรวม', loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.DashboardPage) },
      { path: 'data', title: 'จัดการข้อมูล', loadComponent: () => import('./pages/data/data').then((m) => m.DataPage) },
      { path: 'solve', title: 'จัดตารางสอนอัตโนมัติ', loadComponent: () => import('./pages/solve/solve').then((m) => m.SolvePage) },
      { path: 'manual', title: 'จัดตารางสอนด้วยมือ', loadComponent: () => import('./pages/manual/manual').then((m) => m.ManualPage) },
      { path: 'my-groups', title: 'กลุ่มเรียนที่รับผิดชอบ', loadComponent: () => import('./pages/my-groups/my-groups').then((m) => m.MyGroupsPage) },
      { path: 'teacher-hub', title: 'คำขอและบันทึกครู', loadComponent: () => import('./pages/teacher-hub/teacher-hub').then((m) => m.TeacherHubPage) },
      { path: 'timetable', title: 'ตารางเรียน', loadComponent: () => import('./pages/timetable/timetable').then((m) => m.TimetablePage) },
      { path: 'report', title: 'ผลตรวจเงื่อนไข', loadComponent: () => import('./pages/report/report').then((m) => m.ReportPage) },
      { path: 'export', title: 'ส่งออกไฟล์', loadComponent: () => import('./pages/export/export').then((m) => m.ExportPage) },
      { path: 'appearance', title: 'ตกแต่งหน้าเว็บ', loadComponent: () => import('./pages/appearance/appearance').then((m) => m.AppearancePage) },
      { path: 'settings', title: 'ตั้งค่าโปรไฟล์', loadComponent: () => import('./pages/settings/settings').then((m) => m.SettingsPage) },
      { path: 'users', title: 'จัดการผู้ใช้งาน', canActivate: [adminGuard], loadComponent: () => import('./pages/users/users').then((m) => m.UsersPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
