import { Component, OnInit, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, mensajeError } from '../../core/api.service';
import { Notificaciones } from '../../core/notificaciones.service';
import { SolicitudPro } from '../../core/models';
import { Toasts } from '../../core/toast.service';
import { Avatar, FechaPipe, Galeria, KmPipe, OficioBadge, Stars } from '../../shared/ui';

/** Trabajo aceptado: dirección exacta, contacto del cliente, chat y cierre. */
@Component({
  selector: 'app-trabajo-detalle',
  imports: [RouterLink, Avatar, OficioBadge, Galeria, KmPipe, FechaPipe, Stars],
  template: `
    <div class="pro-page" style="max-width: 50rem">
      <a routerLink="/pro" class="back-link"><i class="bi bi-arrow-left"></i>Ofertas y trabajos</a>
      @if (error()) {
        <div class="empty-state"><i class="bi bi-exclamation-circle"></i>{{ error() }}</div>
      } @else if (!t()) {
        <p class="ofx-faint"><span class="spinner-border spinner-ofx me-2"></span>Cargando trabajo</p>
      } @else {
        @let w = t()!;
        <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
          <app-oficio [slug]="w.oficio_slug" />
          @if (w.es_urgente) { <span class="chip chip-urgente"><i class="bi bi-lightning-charge-fill"></i>Urgente</span> }
          <span class="chip" [class.chip-ok]="w.estado === 'ACEPTADA' || w.estado === 'FINALIZADA'">{{ estado(w) }}</span>
        </div>
        <h1 class="h2 mb-4">{{ w.titulo }}</h1>

        @if (w.cliente_contacto) {
          <section id="contacto" class="contacto mb-4">
            <div class="d-flex align-items-center gap-3 mb-3">
              <app-avatar [foto]="w.cliente_contacto.foto_url" [nombre]="w.cliente_contacto.nombre" [size]="52" />
              <div><strong class="d-block fs-5">{{ w.cliente_contacto.nombre }}</strong><span class="ofx-faint">Aceptado {{ w.fecha_aceptacion | fecha }}</span></div>
            </div>
            <div class="d-grid gap-2 mb-3">
              <span class="dato"><i class="bi bi-geo-alt-fill"></i><strong>{{ w.direccion_exacta?.texto }}</strong><span class="ofx-faint ofx-num">{{ w.distancia_km | km }}</span></span>
              <span class="dato"><i class="bi bi-telephone"></i><a [href]="'tel:' + w.cliente_contacto.telefono">{{ w.cliente_contacto.telefono }}</a></span>
              <span class="dato"><i class="bi bi-envelope"></i>{{ w.cliente_contacto.email }}</span>
            </div>
            <div class="d-flex flex-wrap gap-2">
              @if (w.conversacion_id) { <a class="btn btn-primary" [routerLink]="['/pro/chats', w.conversacion_id]"><i class="bi bi-chat-dots me-1"></i>Abrir chat</a> }
              @if ((w.estado === 'ACEPTADA' || w.estado === 'EN_CURSO') && !w.completado_profesional) {
                <button class="btn btn-quiet" (click)="completar()" [disabled]="!!accion()">@if (accion() === 'c') { <span class="spinner-border spinner-ofx me-1"></span> }Marcar como terminado</button>
              }
              @if (w.estado === 'ACEPTADA' || w.estado === 'EN_CURSO') { <button class="btn btn-quiet" (click)="confirmar.set(true)">Cancelar trabajo</button> }
            </div>
            @if (w.completado_profesional && !w.completado_cliente && w.estado !== 'FINALIZADA') {
              <p class="ofx-faint mt-3 mb-0">Lo marcaste como terminado. Falta que el cliente lo confirme.</p>
            } @else if (w.completado_cliente && !w.completado_profesional) {
              <p class="ofx-faint mt-3 mb-0">El cliente marcó el trabajo como terminado. Confirmalo para cerrarlo.</p>
            }
          </section>
        }

        @if (confirmar()) {
          <div class="alert alert-warning d-flex flex-wrap align-items-center gap-2 mb-4" role="alertdialog" aria-label="Confirmar cancelación">
            <span class="flex-grow-1">¿Cancelar este trabajo? Se cierra el chat y el cliente recibe un aviso.</span>
            <button class="btn btn-sm btn-urgente" (click)="cancelar()" [disabled]="!!accion()">Sí, cancelar</button>
            <button class="btn btn-sm btn-quiet" (click)="confirmar.set(false)">No</button>
          </div>
        }

        @if (w.calificacion) {
          <section class="ofx-panel ofx-panel-pad mb-4">
            <h2 class="h5 mb-2">Calificación del cliente</h2>
            <app-stars [valor]="w.calificacion.puntaje" />
            @if (w.calificacion.comentario) { <p class="mt-2 mb-0">“{{ w.calificacion.comentario }}”</p> }
          </section>
        }

        <section class="ofx-panel ofx-panel-pad">
          <h2 class="h4 mb-3">Lo que pidió el cliente</h2>
          <p class="ofx-measure" style="white-space: pre-line">{{ w.descripcion_problema }}</p>
          @if (w.adjuntos.length) { <app-galeria [items]="w.adjuntos" /> }
          <p class="ofx-faint mt-3 mb-0">Publicado {{ w.fecha_solicitud | fecha }}</p>
        </section>
      }
    </div>`,
  styles: `
    .contacto { padding: 1.5rem; border-radius: 1rem; border: 1px solid var(--ofx-line); border-left: 5px solid var(--ofx-ok); background: var(--ofx-raised); }
    .dato { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
    .dato > i { color: var(--ofx-ink-3); font-size: 1.1rem; }
  `,
})
export class TrabajoDetalle implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private notis = inject(Notificaciones);
  id = input.required<string>();
  t = signal<SolicitudPro | null>(null);
  error = signal('');
  accion = signal('');
  confirmar = signal(false);

  constructor() { effect(() => { if (this.notis.pulso()) this.cargar(); }); }

  ngOnInit() { this.cargar(); }

  cargar() {
    this.api.trabajo(+this.id()).subscribe({
      next: t => this.t.set(t),
      error: e => this.error.set(mensajeError(e, 'Este trabajo no está asignado a vos.')),
    });
  }

  estado(w: SolicitudPro) {
    if (w.estado === 'FINALIZADA') return 'Finalizado';
    if (w.estado === 'CANCELADA') return 'Cancelado';
    return w.completado_profesional ? 'Esperando que el cliente confirme' : 'Pendiente';
  }


  completar() {
    this.accion.set('c');
    this.api.completarTrabajo(this.t()!.id).subscribe({
      next: t => { this.accion.set(''); this.t.set(t); this.toasts.ok(t.estado === 'FINALIZADA' ? 'Trabajo finalizado.' : 'Marcado como terminado. Falta que el cliente lo confirme.'); },
      error: e => { this.accion.set(''); this.toasts.error(mensajeError(e)); },
    });
  }

  cancelar() {
    this.accion.set('x');
    this.api.cancelarTrabajo(this.t()!.id).subscribe({
      next: t => { this.accion.set(''); this.confirmar.set(false); this.t.set(t); this.toasts.ok('Trabajo cancelado.'); },
      error: e => { this.accion.set(''); this.toasts.error(mensajeError(e)); },
    });
  }
}
