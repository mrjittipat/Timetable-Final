import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './shared/confirm-dialog';
import { ToastsComponent } from './shared/toasts';
import { ThemeService } from './core/theme';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmDialogComponent, ToastsComponent],
  template: `
    <router-outlet />
    <app-confirm-dialog />
    <app-toasts />
  `,
})
export class App implements OnInit {
  private theme = inject(ThemeService);
  ngOnInit() {
    this.theme.load();
  }
}
