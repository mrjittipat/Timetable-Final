import { Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { IconComponent } from './icon';

@Component({
  selector: 'app-pdf-preview',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (url()) {
      <div class="scrim" (click)="closed.emit()">
        <div class="pdf-modal" (click)="$event.stopPropagation()">
          <div class="pdf-head">
            <h3>ตัวอย่างเอกสาร PDF</h3>
            <div class="row">
              <button class="btn sm primary" type="button" (click)="printPdf()">พิมพ์</button>
              <a class="btn sm" [href]="downloadUrl()" download>
                <app-icon name="download" [size]="15" /> ดาวน์โหลด PDF
              </a>
              <button class="btn icon ghost" type="button" (click)="closed.emit()" aria-label="ปิด">
                <app-icon name="x" [size]="18" />
              </button>
            </div>
          </div>
          <div class="pdf-body">
            @if (loading()) {
              <div class="pdf-loading"><span class="spinner"></span> กำลังสร้างเอกสาร…</div>
            }
            <iframe #frame [src]="safeUrl()" (load)="loading.set(false)" title="ตัวอย่าง PDF"></iframe>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .pdf-modal {
      width: 100%; max-width: 1180px; height: 90vh; background: var(--surface);
      border-radius: var(--radius-lg); display: flex; flex-direction: column; overflow: hidden;
      box-shadow: var(--shadow-lg);
    }
    .pdf-head {
      padding: 12px 18px; border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .pdf-body { flex: 1; position: relative; background: #525659; }
    .pdf-body iframe { width: 100%; height: 100%; border: none; }
    .pdf-loading {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      gap: 10px; background: rgba(255,255,255,0.9); font-weight: 500; z-index: 2;
    }
  `,
})
export class PdfPreviewComponent {
  private sanitizer = inject(DomSanitizer);
  url = input<string | null>(null);
  closed = output<void>();
  frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  loading = signal(false);

  safeUrl = computed(() => {
    const u = this.url();
    return u ? this.sanitizer.bypassSecurityTrustResourceUrl(u) : null;
  });

  downloadUrl = computed(() => (this.url() || '').replace(/&?inline=1/, ''));

  constructor() {
    effect(() => {
      if (this.url()) this.loading.set(true);
    });
  }

  printPdf() {
    try {
      this.frame()?.nativeElement?.contentWindow?.print();
    } catch {
      window.open(this.url() || '', '_blank');
    }
  }
}
