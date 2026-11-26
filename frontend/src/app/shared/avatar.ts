import { Component, input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    @if (src()) {
      <img [src]="src()" [alt]="name()" [style.width.px]="size()" [style.height.px]="size()" class="av-img" />
    } @else {
      <span class="av-fallback" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.44">
        {{ initial() }}
      </span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .av-img { border-radius: 50%; object-fit: cover; border: 1px solid var(--border); }
    .av-fallback {
      border-radius: 50%; background: var(--maroon-700); color: #fff; font-weight: 600;
      display: inline-flex; align-items: center; justify-content: center; user-select: none;
    }
  `,
})
export class AvatarComponent {
  src = input<string | undefined>('');
  name = input<string>('U');
  size = input<number>(32);
  initial() {
    const n = (this.name() || 'U').trim();
    return n.charAt(0).toUpperCase();
  }
}
