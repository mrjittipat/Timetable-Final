import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChatService } from '../core/chat';
import { AuthService } from '../core/auth';
import { IconComponent } from './icon';
import { PdfPreviewComponent } from './pdf-preview';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, PdfPreviewComponent],
  template: `
    @if (chat.open()) {
      <div class="chat-panel">
        <div class="chat-head">
          <div class="row" style="gap: 10px">
            <span class="bot-av"><app-icon name="bot" [size]="20" /></span>
            <div>
              <div class="bot-title">ผู้ช่วยจัดตาราง</div>
              <div class="bot-sub"><span class="dot"></span> ออฟไลน์ · ตอบทันที</div>
            </div>
          </div>
          <div class="row" style="gap: 4px">
            <button class="btn icon ghost" style="color:#fff" type="button" title="ล้างแชท" (click)="chat.clear()">
              <app-icon name="trash" [size]="16" />
            </button>
            <button class="btn icon ghost" style="color:#fff" type="button" title="พับลง" (click)="chat.toggle()">
              <app-icon name="minus" [size]="18" />
            </button>
          </div>
        </div>

        <div class="chat-msgs">
          @for (m of chat.messages(); track m.id) {
            <div class="msg" [class.user]="m.sender === 'user'">
              <div class="bubble" [innerHTML]="formatText(m.text)"></div>
              @for (c of m.cards || []; track $index; let ci = $index) {
                @if (c.type === 'table') {
                  <div class="c-card">
                    <div class="c-title">{{ c.title }}</div>
                    <div class="table-wrap">
                      <table class="c-table">
                        <thead><tr>@for (col of c.columns; track col) { <th>{{ col }}</th> }</tr></thead>
                        <tbody>
                          @for (r of c.rows; track $index) {
                            <tr>@for (cell of r; track $index) { <td>{{ cell }}</td> }</tr>
                          }
                        </tbody>
                      </table>
                    </div>
                    @if (c.link) {
                      <a [routerLink]="c.link" class="c-link" (click)="chat.toggle()">เปิดดูทั้งหมด →</a>
                    }
                  </div>
                } @else if (c.type === 'list') {
                  <div class="c-card">
                    <div class="c-title">{{ c.title }}</div>
                    <div class="c-list">
                      @for (it of c.items; track $index) {
                        @if (c.ask) {
                          <button type="button" class="c-ask" (click)="chat.send(it)">{{ it }}</button>
                        } @else {
                          <div class="c-item">• {{ it }}</div>
                        }
                      }
                    </div>
                  </div>
                } @else if (c.type === 'action') {
                  <div class="c-card">
                    <div class="c-title">{{ c.title }}</div>
                    @for (ln of c.lines || []; track $index) {
                      <div class="small muted">{{ ln }}</div>
                    }
                    <div style="margin-top: 8px">
                      @if (c.status === 'done') {
                        <span class="badge success">{{ c.resultText || 'ดำเนินการสำเร็จ' }}</span>
                      } @else if (c.status === 'error') {
                        <span class="badge danger">{{ c.resultText || 'เกิดข้อผิดพลาด' }}</span>
                      } @else if (c.status === 'running') {
                        <span class="badge neutral">กำลังทำงาน…</span>
                      } @else if (auth.isAdmin()) {
                        <button type="button" class="btn sm" [class.danger]="c.action?.danger" [class.primary]="!c.action?.danger"
                                (click)="chat.runCardAction(m.id, ci)">
                          {{ c.action?.label || 'ยืนยัน' }}
                        </button>
                      } @else {
                        <span class="small muted">เฉพาะผู้ดูแลระบบที่กดยืนยันคำสั่งนี้ได้</span>
                      }
                    </div>
                  </div>
                } @else if (c.type === 'buttons') {
                  <div class="row" style="margin-top: 6px">
                    @for (b of c.items || []; track $index) {
                      <button type="button" class="btn sm" (click)="chat.handleButtonAction(b.action)">{{ b.label }}</button>
                    }
                  </div>
                }
              }
              @if (m.suggestions?.length) {
                <div class="chips">
                  @for (s of m.suggestions; track s) {
                    <button type="button" class="chip" (click)="chat.send(s)">{{ s }}</button>
                  }
                </div>
              }
              <div class="time">{{ m.time }}</div>
            </div>
          }
          @if (chat.busy()) {
            <div class="msg"><div class="bubble muted">กำลังคิด…</div></div>
          }
        </div>

        <div class="chat-composer">
          <textarea [(ngModel)]="draft" rows="1" maxlength="500"
                    placeholder="พิมพ์คำถาม เช่น ตาราง Y1_1 วันจันทร์"
                    (keydown)="onKey($event)"></textarea>
          <button class="btn icon primary" type="button" [disabled]="!draft.trim() || chat.busy()" (click)="submit()">
            <app-icon name="send" [size]="16" />
          </button>
        </div>
      </div>
    }

    <button class="chat-fab" type="button" (click)="chat.toggle()" aria-label="ผู้ช่วยจัดตาราง">
      <app-icon [name]="chat.open() ? 'x' : 'chat'" [size]="26" />
      @if (chat.unread() > 0 && !chat.open()) {
        <span class="fab-badge">{{ chat.unread() }}</span>
      }
    </button>

    <app-pdf-preview [url]="chat.pdfUrl()" (closed)="chat.pdfUrl.set(null)" />
  `,
  styles: `
    .chat-fab {
      position: fixed; right: 22px; bottom: 22px; width: 60px; height: 60px;
      border-radius: 50%; background: var(--maroon-700); color: #fff; border: none;
      box-shadow: var(--shadow-lg); cursor: pointer; z-index: 1200;
      display: flex; align-items: center; justify-content: center;
    }
    .chat-fab:hover { background: var(--maroon-600); }
    .fab-badge {
      position: absolute; top: -2px; right: -2px; min-width: 20px; height: 20px;
      border-radius: 999px; background: var(--danger); color: #fff; font-size: 11px;
      font-weight: 700; display: flex; align-items: center; justify-content: center; padding: 0 5px;
    }
    .chat-panel {
      position: fixed; right: 22px; bottom: 92px; width: 400px; max-width: calc(100vw - 32px);
      height: 560px; max-height: calc(100vh - 120px); background: var(--surface);
      border-radius: 16px; box-shadow: var(--shadow-lg); border: 1px solid var(--border);
      display: flex; flex-direction: column; overflow: hidden; z-index: 1200;
    }
    .chat-head {
      background: linear-gradient(135deg, var(--maroon-700), var(--maroon-900));
      color: #fff; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between;
    }
    .bot-av { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; }
    .bot-title { font-weight: 600; font-size: 14px; }
    .bot-sub { font-size: 11.5px; opacity: 0.9; display: flex; align-items: center; gap: 5px; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; display: inline-block; }
    .chat-msgs { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; background: var(--bg); }
    .msg { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; }
    .msg.user { align-items: flex-end; }
    .bubble {
      max-width: 90%; padding: 9px 13px; border-radius: 14px; font-size: 13.5px;
      background: var(--surface); border: 1px solid var(--border); white-space: pre-wrap; word-break: break-word;
    }
    .msg.user .bubble { background: var(--maroon-700); color: #fff; border-color: var(--maroon-700); }
    .time { font-size: 10.5px; color: var(--text-muted); }
    .c-card { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: 12.5px; }
    .c-title { font-weight: 600; margin-bottom: 6px; color: var(--maroon-800); }
    .c-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    .c-table th, .c-table td { padding: 4px 6px; border-bottom: 1px solid var(--border); text-align: left; }
    .c-link { display: inline-block; margin-top: 6px; font-weight: 600; font-size: 12px; }
    .c-list { display: flex; flex-direction: column; gap: 4px; }
    .c-ask {
      text-align: left; border: 1px solid var(--border); background: var(--maroon-50);
      color: var(--maroon-800); padding: 5px 9px; border-radius: 8px; cursor: pointer; font: inherit; font-size: 12px;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .chip {
      border: 1px solid var(--maroon-200); background: var(--surface); color: var(--maroon-700);
      border-radius: 999px; padding: 3px 10px; font: inherit; font-size: 11.5px; cursor: pointer;
    }
    .chat-composer {
      padding: 10px; border-top: 1px solid var(--border); background: var(--surface);
      display: flex; gap: 8px; align-items: center;
    }
    .chat-composer textarea {
      flex: 1; resize: none; border: 1px solid var(--border-strong); border-radius: 10px;
      padding: 8px 10px; font: inherit; font-size: 13.5px; max-height: 90px;
    }

    @media (max-width: 640px) {
      .chat-fab { right: 14px; bottom: 14px; width: 52px; height: 52px; }
      .chat-panel {
        right: 8px; left: 8px; bottom: 74px; width: auto; max-width: none;
        height: 72dvh; max-height: calc(100dvh - 88px); border-radius: 14px;
      }
      .chat-msgs { padding: 10px; }
      .chat-composer textarea { font-size: 16px; }
    }
  `,
})
export class ChatWidgetComponent implements OnInit {
  chat = inject(ChatService);
  auth = inject(AuthService);
  draft = '';

  ngOnInit() {
    this.chat.loadHistory();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.chat.open()) this.chat.open.set(false);
  }

  onKey(ev: KeyboardEvent) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      this.submit();
    }
  }

  submit() {
    const t = this.draft.trim();
    if (!t) return;
    this.draft = '';
    this.chat.send(t);
  }

  formatText(text: string): string {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
}
