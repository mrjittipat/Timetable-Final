import { Component, inject } from '@angular/core';
import { Toasts } from '../core/toast';

@Component({
  selector: 'app-toasts',
  standalone: true,
  template: `
    <div class="toasts">
      @for (t of toasts.items(); track t.id) {
        <div class="toast" [class]="t.kind" (click)="toasts.dismiss(t.id)">
          <span>{{ t.text }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed; right: 22px; bottom: 96px; z-index: 1500;
      display: flex; flex-direction: column; gap: 8px; max-width: 380px;
    }
    .toast {
      background: var(--surface); color: var(--text); padding: 11px 15px;
      border-radius: var(--radius); box-shadow: var(--shadow); border: 1px solid var(--border);
      border-left: 4px solid var(--maroon-700); font-size: 13.5px; cursor: pointer;
    }
    .toast.success { border-left-color: var(--success); }
    .toast.error { border-left-color: var(--danger); }
    .toast.info { border-left-color: #2563eb; }
  `,
})
export class ToastsComponent {
  toasts = inject(Toasts);
}
