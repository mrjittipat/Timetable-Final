import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputValue?: string;
}

@Injectable({ providedIn: 'root' })
export class Confirm {
  current = signal<(ConfirmOptions & { isPrompt: boolean; resolve: (val: any) => void }) | null>(null);

  ask(opts: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.current.set({ ...opts, isPrompt: false, resolve });
    });
  }

  prompt(opts: ConfirmOptions): Promise<string | null> {
    return new Promise((resolve) => {
      this.current.set({ ...opts, isPrompt: true, resolve });
    });
  }

  finish(val: any) {
    const cur = this.current();
    this.current.set(null);
    cur?.resolve(val);
  }
}
