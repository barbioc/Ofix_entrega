import { Injectable, signal } from '@angular/core';

export type Tema = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class Theme {
  readonly tema = signal<Tema>('system');
  readonly oscuro = signal(false);
  private mq = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    let t: Tema = 'system';
    try { t = (localStorage.getItem('ofix-tema') as Tema) || 'system'; } catch { /* nada */ }
    this.tema.set(t);
    this.aplicar();
    this.mq.addEventListener('change', () => this.aplicar());
  }

  set(t: Tema) {
    this.tema.set(t);
    try { localStorage.setItem('ofix-tema', t); } catch { /* nada */ }
    this.aplicar();
  }

  alternar() { this.set(this.oscuro() ? 'light' : 'dark'); }

  private aplicar() {
    const t = this.tema();
    const dark = t === 'dark' || (t === 'system' && this.mq.matches);
    this.oscuro.set(dark);
    document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
  }
}
