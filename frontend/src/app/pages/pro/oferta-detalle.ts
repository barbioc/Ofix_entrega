import { Component, HostListener, inject, input, output, signal } from '@angular/core';
import { Api, mensajeError } from '../../core/api.service';
import { Oferta } from '../../core/models';
import { Toasts } from '../../core/toast.service';
import { Countdown, FechaPipe, Galeria, KmPipe, OficioBadge } from '../../shared/ui';

/** Ficha completa de una oferta, con Aceptar / Rechazar. */
@Component({
  selector: 'app-oferta-detalle',
  imports: [OficioBadge, Countdown, Galeria, KmPipe, FechaPipe],
  template: `
    <div class="ofx-backdrop" (click)="$event.target === $event.currentTarget && cerrar.emit()">
      <div class="ofx-modal ofx-modal-lg" role="dialog" aria-modal="true" aria-labelledby="of-t">
        @let s = oferta().solicitud;
        <div class="ofx-modal-head">
          <div class="flex-grow-1">
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
              <app-oficio [slug]="s.oficio_slug" />
              @if (oferta().es_urgente) { <span class="chip chip-urgente"><i class="bi bi-lightning-charge-fill"></i>Urgente</span> }
              @else { <span class="chip chip-blue">Te eligió a vos</span> }
            </div>
            <h2 id="of-t" class="h3 mb-0">{{ s.titulo }}</h2>
          </div>
          <button type="button" class="btn-close" aria-label="Cerrar" (click)="cerrar.emit()"></button>
        </div>
        <div class="ofx-modal-body">
          @if (oferta().es_urgente && oferta().vence_prioridad) {
            <div class="prio mb-3">
              <i class="bi bi-hourglass-split"></i>
              <span class="flex-grow-1">Tenés prioridad sobre este trabajo durante</span>
              <app-countdown class="prio-reloj" [hasta]="oferta().vence_prioridad!" />
            </div>
          }
          <dl class="ficha">
            <dt>Distancia</dt><dd class="ofx-num">{{ oferta().distancia_km | km }}</dd>
            <dt>Zona</dt><dd>{{ s.zona }}</dd>
            <dt>Cliente</dt><dd>{{ s.cliente_nombre }}</dd>
            <dt>Publicado</dt><dd>{{ s.fecha_solicitud | fecha }}</dd>
          </dl>
          <h3 class="h6 mt-4 mb-2">Descripción</h3>
          <p class="ofx-measure" style="white-space: pre-line">{{ s.descripcion_problema }}</p>
          @if (s.adjuntos.length) {
            <h3 class="h6 mt-3 mb-2">Fotos y videos del cliente</h3>
            <app-galeria [items]="s.adjuntos" />
          }
          <p class="ofx-faint mt-4 mb-0"><i class="bi bi-shield-lock me-1"></i>La dirección exacta, el nombre completo y el teléfono del cliente se muestran cuando aceptás.</p>
        </div>
        <div class="ofx-modal-foot">
          <button type="button" class="btn btn-quiet" (click)="rechazar()" [disabled]="!!accion()">@if (accion() === 'r') { <span class="spinner-border spinner-ofx me-1"></span> }Rechazar</button>
          <button type="button" class="btn btn-primary" (click)="aceptar()" [disabled]="!!accion()">@if (accion() === 'a') { <span class="spinner-border spinner-ofx me-1"></span> }Aceptar trabajo</button>
        </div>
      </div>
    </div>`,
  styles: `
    .prio { display: flex; align-items: center; gap: .75rem; padding: .75rem 1rem; border-radius: .65rem; background: var(--ofx-urgente-soft); }
    .prio > i { color: var(--ofx-urgente); }
    .prio-reloj { font-size: 1.5rem; color: var(--ofx-urgente); }
    dl.ficha { display: grid; grid-template-columns: max-content 1fr; gap: .45rem 1.5rem; margin: 0; }
    dl.ficha dt { font-weight: 600; color: var(--ofx-ink-2); }
    dl.ficha dd { margin: 0; }
  `,
})
export class OfertaDetalle {
  private api = inject(Api);
  private toasts = inject(Toasts);
  oferta = input.required<Oferta>();
  cerrar = output<void>();
  /** true = aceptada, false = rechazada o ya no disponible */
  resuelta = output<boolean>();
  accion = signal<'' | 'a' | 'r'>('');

  @HostListener('document:keydown.escape')
  esc() { if (!this.accion()) this.cerrar.emit(); }

  aceptar() {
    this.accion.set('a');
    this.api.aceptarOferta(this.oferta().id).subscribe({
      next: () => { this.toasts.ok('Aceptaste el trabajo. Ya podés escribirle al cliente.'); this.resuelta.emit(true); },
      error: e => {
        this.accion.set('');
        this.toasts.error(mensajeError(e));
        if (e.status === 400) this.resuelta.emit(false);
      },
    });
  }

  rechazar() {
    this.accion.set('r');
    this.api.rechazarOferta(this.oferta().id).subscribe({
      next: () => { this.toasts.ok('Rechazaste la oferta.'); this.resuelta.emit(false); },
      error: e => { this.accion.set(''); this.toasts.error(mensajeError(e)); },
    });
  }
}
