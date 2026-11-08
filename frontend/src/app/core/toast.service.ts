import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; texto: string; tipo: 'ok' | 'error'; }

@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly items = signal<Toast[]>([]);
  private n = 0;

  ok(texto: string) { this.push(texto, 'ok'); }
  error(texto: string) { this.push(texto, 'error'); }

  private push(texto: string, tipo: Toast['tipo']) {
    const id = ++this.n;
    this.items.update(l => [...l, { id, texto, tipo }]);
    setTimeout(() => this.cerrar(id), tipo === 'error' ? 6000 : 3500);
  }

  cerrar(id: number) { this.items.update(l => l.filter(t => t.id !== id)); }
}
