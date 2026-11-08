import { Injectable, inject, signal } from '@angular/core';
import { Api } from './api.service';
import { Notificacion } from './models';

/** Consulta las notificaciones cada 15 s mientras haya sesión. */
@Injectable({ providedIn: 'root' })
export class Notificaciones {
  private api = inject(Api);
  readonly items = signal<Notificacion[]>([]);
  readonly noLeidas = signal(0);
  /** Se incrementa cuando llega algo nuevo, para que las pantallas abiertas recarguen. */
  readonly pulso = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ultimoId = 0;

  iniciar() {
    if (this.timer) return;
    this.cargar();
    this.timer = setInterval(() => this.cargar(), 15000);
  }

  detener() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.items.set([]);
    this.noLeidas.set(0);
    this.ultimoId = 0;
  }

  cargar() {
    this.api.notificaciones().subscribe({
      next: r => {
        this.items.set(r.items);
        this.noLeidas.set(r.no_leidas);
        const max = r.items[0]?.id ?? 0;
        if (max > this.ultimoId) {
          if (this.ultimoId) this.pulso.update(n => n + 1);
          this.ultimoId = max;
        }
      },
      error: () => {},
    });
  }

  leer(n: Notificacion) {
    if (n.leida) return;
    this.items.update(l => l.map(x => (x.id === n.id ? { ...x, leida: true } : x)));
    this.noLeidas.update(c => Math.max(0, c - 1));
    this.api.leerNotificacion(n.id).subscribe({ error: () => {} });
  }

  leerTodas() {
    this.items.update(l => l.map(x => ({ ...x, leida: true })));
    this.noLeidas.set(0);
    this.api.leerTodas().subscribe({ error: () => {} });
  }
}
