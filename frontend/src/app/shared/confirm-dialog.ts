import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Confirm } from '../core/confirm';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (confirm.current(); as cur) {
      <div class="confirm-scrim" (click)="cancel()">
        <div class="confirm-box" [class.danger]="cur.danger" (click)="$event.stopPropagation()">
          <h3>{{ cur.title }}</h3>
          @if (cur.message) {
            <p class="muted">{{ cur.message }}</p>
          }
          @if (cur.isPrompt) {
            <div class="field" style="margin-top: 10px">
              @if (cur.inputLabel) { <label>{{ cur.inputLabel }}</label> }
              <input class="input" [(ngModel)]="val" [placeholder]="cur.inputPlaceholder || ''" (keydown.enter)="ok()" />
            </div>
          }
          <div class="confirm-foot">
            <button class="btn" type="button" (click)="cancel()">{{ cur.cancelText || 'ยกเลิก' }}</button>
            <button class="btn" [class.danger]="cur.danger" [class.primary]="!cur.danger" type="button" (click)="ok()">
              {{ cur.confirmText || 'ยืนยัน' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .confirm-scrim {
      position: fixed; inset: 0; background: rgba(28, 10, 15, 0.35);
      display: flex; align-items: flex-start; justify-content: center; padding-top: 16px; z-index: 2000;
    }
    .confirm-box {
      width: calc(100% - 32px); max-width: 460px; background: var(--surface);
      border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
      border: 1px solid var(--border); border-top: 4px solid var(--maroon-700);
      padding: 18px 20px;
    }
    .confirm-box.danger { border-top-color: var(--danger); }
    .confirm-box p { margin: 8px 0 0; font-size: 13.5px; }
    .confirm-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
  `,
})
export class ConfirmDialogComponent {
  confirm = inject(Confirm);
  val = '';

  constructor() {
    effect(() => {
      const cur = this.confirm.current();
      this.val = cur?.inputValue || '';
    });
  }

  ok() {
    const cur = this.confirm.current();
    this.confirm.finish(cur?.isPrompt ? this.val : true);
  }
  cancel() {
    const cur = this.confirm.current();
    this.confirm.finish(cur?.isPrompt ? null : false);
  }
}
