import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, mensajeError } from '../../core/api.service';
import { Solicitud } from '../../core/models';
import { ESTADOS_CLIENTE } from '../../core/oficios';
import { Toasts } from '../../core/toast.service';
import { FechaPipe, OficioBadge } from '../../shared/ui';

@Component({
  selector: 'app-pedidos',
  imports: [RouterLink, OficioBadge, FechaPipe],
  template: `
    <div class="container page">
      <div class="d-flex align-items-end justify-content-between flex-wrap gap-3 mb-4">
        <div><h1 class="page-title">Mis pedidos</h1><p class="page-sub mb-0">Seguí cada pedido y confirmá cuando el trabajo esté terminado.</p></div>
        <a routerLink="/app" class="btn btn-primary">Nuevo pedido</a>
      </div>
      <div class="tabs" role="tablist">
        <button role="tab" [attr.aria-selected]="tab() === 'activas'" [class.act]="tab() === 'activas'" (click)="cargar('activas')">En curso</button>
        <button role="tab" [attr.aria-selected]="tab() === 'historial'" [class.act]="tab() === 'historial'" (click)="cargar('historial')">Historial</button>
      </div>
      @if (cargando()) {
        <p class="ofx-faint py-4"><span class="spinner-border spinner-ofx me-2"></span>Cargando pedidos</p>
      } @else {
        <ul class="lista">
          @for (s of items(); track s.id) {
            <li>
              <a [routerLink]="['/app/pedidos', s.id]" class="fila">
                <app-oficio [slug]="s.oficio_slug" />
                <span class="flex-grow-1 min-w-0">
                  <strong class="d-block text-truncate">{{ s.titulo }}</strong>
                  <span class="ofx-faint">{{ s.fecha_solicitud | fecha }}
                    @if (s.profesional_info) { <span>, con {{ s.profesional_info.nombre }} {{ s.profesional_info.apellido_inicial }}</span> }
                  </span>
                </span>
                @if (s.es_urgente) { <span class="chip chip-urgente d-none d-sm-inline-flex"><i class="bi bi-lightning-charge-fill"></i>Urgente</span> }
                <span class="chip" [class.chip-ok]="s.estado === 'ACEPTADA' || s.estado === 'FINALIZADA'">{{ etiqueta(s) }}</span>
                <i class="bi bi-chevron-right ofx-faint"></i>
              </a>
            </li>
          } @empty {
            <li class="empty-state mt-3">
              <i class="bi bi-inbox"></i>
              @if (tab() === 'activas') { No tenés pedidos en curso. <a routerLink="/app">Pedí un profesional</a> cuando lo necesites. }
              @else { Acá vas a ver los trabajos que marcaste como terminados, los finalizados y los cancelados. }
            </li>
          }
        </ul>
      }
    </div>`,
  styles: `
    .tabs { display: flex; gap: 1.5rem; border-bottom: 1px solid var(--ofx-line); margin-bottom: .5rem; }
    .tabs button { background: none; border: 0; padding: .6rem 0; font-weight: 650; color: var(--ofx-ink-2); border-bottom: 2px solid transparent; margin-bottom: -1px; }
    .tabs button.act { color: var(--ofx-ink); border-color: var(--ofx-blue); }
    .lista { list-style: none; padding: 0; margin: 0; }
    .fila { display: flex; align-items: center; gap: 1rem; padding: 1rem .25rem; border-bottom: 1px solid var(--ofx-line); color: var(--ofx-ink); text-decoration: none; }
    .fila:hover { background: var(--ofx-surface); }
    .min-w-0 { min-width: 0; }
  `,
})
export class Pedidos implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  tab = signal<'activas' | 'historial'>('activas');
  items = signal<Solicitud[]>([]);
  cargando = signal(true);

  ngOnInit() { this.cargar('activas'); }

  cargar(t: 'activas' | 'historial') {
    this.tab.set(t);
    this.cargando.set(true);
    this.api.solicitudes(t).subscribe({
      next: s => { this.items.set(s); this.cargando.set(false); },
      error: e => { this.cargando.set(false); this.toasts.error(mensajeError(e)); },
    });
  }

  etiqueta(s: Solicitud) {
    if (s.busqueda_agotada && s.estado === 'CREADA') return 'Sin respuesta';
    if (s.estado === 'NOTIFICANDO') return s.es_urgente && s.oferta_directa?.estado !== 'PENDIENTE' ? 'Buscando profesional' : 'Esperando respuesta';
    if (s.estado === 'FINALIZADA' && !s.calificacion) return 'Para calificar';
    if (s.estado === 'ACEPTADA' && s.completado_profesional && !s.completado_cliente) return 'Confirmá que terminó';
    if (s.estado === 'ACEPTADA' && s.completado_cliente) return 'Esperando que el profesional confirme';
    return ESTADOS_CLIENTE[s.estado];
  }
}
