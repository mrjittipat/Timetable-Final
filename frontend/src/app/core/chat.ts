import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from './api';
import { AppState } from './state';
import { AuthService } from './auth';

export interface ChatMessage {
  id: number;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  cards?: any[];
  suggestions?: string[];
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private api = inject(Api);
  private state = inject(AppState);
  private auth = inject(AuthService);
  private router = inject(Router);

  open = signal(false);
  busy = signal(false);
  unread = signal(0);
  messages = signal<ChatMessage[]>([]);
  pdfUrl = signal<string | null>(null);

  private ctx: any = {};
  private seq = 1;

  private storageKey() {
    const u = this.auth.user()?.username || 'anon';
    return `tt-chat-v1:${u}`;
  }

  loadHistory() {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.messages)) {
          this.messages.set(parsed.messages.slice(-80));
          this.seq = (parsed.messages[parsed.messages.length - 1]?.id || 0) + 1;
        }
        this.ctx = parsed.context || {};
        return;
      }
    } catch {
      // ignore
    }
    this.messages.set([
      {
        id: this.seq++,
        sender: 'bot',
        text: 'สวัสดีครับ ผมคือ **ผู้ช่วยจัดตารางอัตโนมัติ** ถามตารางเรียน ห้องว่าง ตรวจเงื่อนไข หรือสั่งจัดตารางได้เลยครับ',
        time: this.nowTime(),
        suggestions: ['สรุปภาพรวม', 'ตาราง Y1_1 วันจันทร์', 'ห้องไหนว่าง วันพุธ คาบ 3', 'ผลตรวจเงื่อนไข'],
      },
    ]);
    this.ctx = {};
  }

  private saveHistory() {
    try {
      localStorage.setItem(
        this.storageKey(),
        JSON.stringify({ messages: this.messages().slice(-80), context: this.ctx })
      );
    } catch {
      // ignore
    }
  }

  private nowTime() {
    return new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(new Date());
  }

  toggle() {
    this.open.update((o) => !o);
    if (this.open()) this.unread.set(0);
  }

  clear() {
    this.messages.set([]);
    this.ctx = {};
    this.saveHistory();
  }

  async send(text: string) {
    const clean = text.trim();
    if (!clean || this.busy()) return;
    this.messages.update((m) => [
      ...m.slice(-79),
      { id: this.seq++, sender: 'user', text: clean, time: this.nowTime() },
    ]);
    this.busy.set(true);
    try {
      const res = await this.api.chat(clean, this.ctx);
      if (res.intent === 'clear') {
        this.clear();
        return;
      }
      this.ctx = res.context || {};
      this.messages.update((m) => [
        ...m.slice(-79),
        {
          id: this.seq++,
          sender: 'bot',
          text: res.text,
          cards: res.cards || [],
          suggestions: res.suggestions || [],
          time: this.nowTime(),
        },
      ]);
      if (!this.open()) this.unread.update((n) => n + 1);
      // Auto-navigate if requested
      for (const c of res.cards || []) {
        if (c.type === 'buttons') {
          for (const b of c.items || []) {
            if (b.action?.auto && b.action.kind === 'navigate') {
              this.router.navigateByUrl(b.action.payload);
            }
          }
        }
      }
      this.saveHistory();
    } catch (err) {
      this.messages.update((m) => [
        ...m,
        { id: this.seq++, sender: 'bot', text: `เกิดข้อผิดพลาด: ${this.api.errorMessage(err)}`, time: this.nowTime() },
      ]);
    } finally {
      this.busy.set(false);
    }
  }

  async runCardAction(msgId: number, cardIdx: number) {
    const msg = this.messages().find((m) => m.id === msgId);
    const card = msg?.cards?.[cardIdx];
    if (!card || card.status === 'running' || card.status === 'done') return;

    const patchCard = (patch: any) => {
      this.messages.update((list) =>
        list.map((m) =>
          m.id !== msgId
            ? m
            : { ...m, cards: m.cards?.map((c, i) => (i === cardIdx ? { ...c, ...patch } : c)) }
        )
      );
    };

    patchCard({ status: 'running' });
    try {
      const res = await this.api.chatAction(card.action.kind, card.action.payload);
      patchCard({ status: res.ok ? 'done' : 'error', resultText: res.text });
      if (res.refresh) await this.state.refresh();
      this.saveHistory();
    } catch (err) {
      patchCard({ status: 'error', resultText: this.api.errorMessage(err) });
    }
  }

  handleButtonAction(action: any) {
    if (!action) return;
    if (action.kind === 'ask') {
      this.send(action.payload);
    } else if (action.kind === 'navigate') {
      this.router.navigateByUrl(action.payload);
    } else if (action.kind === 'export') {
      const { format, view, id } = action.payload || {};
      if (format === 'pdf') {
        this.pdfUrl.set(this.api.exportUrl('pdf', view || 'group', id || '', true));
      } else {
        window.open(this.api.exportUrl(format || 'csv', view, id), '_blank');
      }
    }
  }
}
