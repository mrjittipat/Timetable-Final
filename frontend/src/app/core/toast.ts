import { Injectable, signal } from '@angular/core';

export interface ToastItem {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class Toasts {
  items = signal<ToastItem[]>([]);
  private seq = 1;

  private push(kind: ToastItem['kind'], text: string, ms: number) {
    const id = this.seq++;
    this.items.update((list) => [...list, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  success(text: string) { this.push('success', text, 4000); }
  error(text: string) { this.push('error', text, 8000); }
  info(text: string) { this.push('info', text, 4000); }
  dismiss(id: number) { this.items.update((list) => list.filter((x) => x.id !== id)); }
}
