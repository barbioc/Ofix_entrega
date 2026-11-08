import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, mensajeError } from '../../core/api.service';
import { SolicitudPro } from '../../core/models';
import { Toasts } from '../../core/toast.service';
import { FechaPipe, OficioBadge, Stars } from '../../shared/ui';

@Component({
  selector: 'app-historial',
  imports: [RouterLink, OficioBadge, Stars, FechaPipe],
  template: `
    <div class="pro-page" style="max-width: 56rem">
      <h1 class="page-title">Historial de trabajos</h1>
      <p class="page-sub">Trabajos que marcaste como terminados, finalizados y cancelados.</p>
      @if (cargando()) {
        <p class="ofx-faint"><span class="spinner-border spinner-ofx me-2"></span>Cargando</p>
      } @else {
        <ul class="lista">
          @for (t of items(); track t.id) {
            <li>
              <a [routerLink]="['/pro/trabajos', t.id]" class="fila">
                <app-oficio [slug]="t.oficio_slug" />
                <span class="flex-grow-1 min-w-0">
                  <strong class="d-block text-truncate">{{ t.titulo }}</strong>
                  <span class="ofx-faint">{{ t.cliente_nombre }}, {{ (t.fecha_aceptacion || t.fecha_solicitud) | fecha: false }}</span>
                </span>
                @if (t.calificacion) { <app-stars [valor]="t.calificacion.puntaje" [mostrarNumero]="false" /> }
                <span class="chip" [class.chip-ok]="t.estado === 'FINALIZADA'" [class.chip-blue]="t.estado === 'ACEPTADA' || t.estado === 'EN_CURSO'">{{ etiqueta(t) }}</span>
              </a>
            </li>
          } @empty {
            <li class="empty-state"><i class="bi bi-clock-history"></i>Cuando termines tu primer trabajo, va a quedar registrado acá.</li>
          }
        </ul>
      }
    </div>`,
  styles: `
    .lista { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--ofx-line); }
    .fila { display: flex; align-items: center; gap: 1rem; padding: 1rem .25rem; border-bottom: 1px solid var(--ofx-line); color: var(--ofx-ink); text-decoration: none; flex-wrap: wrap; }
    .fila:hover { background: var(--ofx-surface); }
    .min-w-0 { min-width: 0; }
  `,
})
export class Historial implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  items = signal<SolicitudPro[]>([]);
  cargando = signal(true);

  etiqueta(t: SolicitudPro) {
    if (t.estado === 'FINALIZADA') return 'Finalizado';
    if (t.estado === 'CANCELADA') return 'Cancelado';
    return 'Esperando que el cliente confirme';
  }

  ngOnInit() {
    this.api.trabajos('historial').subscribe({
      next: t => { this.items.set(t); this.cargando.set(false); },
      error: e => { this.cargando.set(false); this.toasts.error(mensajeError(e)); },
    });
  }
}
