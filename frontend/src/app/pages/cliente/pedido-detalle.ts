import { Component, OnDestroy, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, mensajeError } from '../../core/api.service';
import { Notificaciones } from '../../core/notificaciones.service';
import { Solicitud } from '../../core/models';
import { ESTADOS_CLIENTE } from '../../core/oficios';
import { Toasts } from '../../core/toast.service';
import { Avatar, Countdown, FechaPipe, Galeria, HacePipe, OficioBadge, Stars } from '../../shared/ui';

@Component({
  selector: 'app-pedido-detalle',
  imports: [RouterLink, FormsModule, OficioBadge, Avatar, Stars, Countdown, Galeria, FechaPipe, HacePipe],
  templateUrl: './pedido-detalle.html',
  styles: `
    .estado-panel { border-radius: 1rem; padding: 1.5rem; border: 1px solid var(--ofx-line); background: var(--ofx-raised); }
    .estado-buscando { border-left: 5px solid var(--ofx-urgente); }
    .estado-aceptado { border-left: 5px solid var(--ofx-ok); }
    .buscando-reloj { font-size: 2.6rem; line-height: 1; color: var(--ofx-urgente); font-weight: 700; }
    .pasos-busqueda { display: flex; gap: .35rem; margin: 1rem 0 .4rem; }
    .pasos-busqueda span { flex: 1; height: .35rem; border-radius: 99px; background: var(--ofx-line); }
    .pasos-busqueda span.on { background: var(--ofx-urgente); }
    .pulso { width: .7rem; height: .7rem; border-radius: 999px; background: var(--ofx-urgente); display: inline-block; animation: pulso 1.6s ease-in-out infinite; }
    @keyframes pulso { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ofx-urgente) 50%, transparent); } 50% { box-shadow: 0 0 0 .45rem transparent; } }
    .dato { display: flex; gap: .75rem; align-items: center; }
    .dato i { color: var(--ofx-ink-3); font-size: 1.1rem; }
    .rate { display: flex; gap: .25rem; }
    .rate button { background: none; border: 0; font-size: 2rem; color: var(--ofx-line-strong); padding: 0 .1rem; line-height: 1; }
    .rate button.on { color: var(--ofx-luz); }
    dl.ficha { display: grid; grid-template-columns: max-content 1fr; gap: .5rem 1.25rem; margin: 0; }
    dl.ficha dt { font-weight: 600; color: var(--ofx-ink-2); }
    dl.ficha dd { margin: 0; }
  `,
})
export class PedidoDetalle implements OnInit, OnDestroy {
  private api = inject(Api);
  private router = inject(Router);
  private toasts = inject(Toasts);
  private notis = inject(Notificaciones);
  id = input.required<string>();

  s = signal<Solicitud | null>(null);
  error = signal('');
  accion = signal('');
  confirmarCancelar = signal(false);
  puntaje = signal(0);
  comentario = '';
  estados = ESTADOS_CLIENTE;
  private timer?: ReturnType<typeof setInterval>;

  /** Hay una oferta directa (elegida del catálogo) esperando respuesta. */
  private directaPendiente = computed(() => this.s()?.oferta_directa?.estado === 'PENDIENTE');
  buscando = computed(() => { const s = this.s(); return !!s && s.estado === 'NOTIFICANDO' && s.es_urgente && !this.directaPendiente(); });
  esperandoDirecta = computed(() => { const s = this.s(); return !!s && s.estado === 'NOTIFICANDO' && (!s.es_urgente || this.directaPendiente()); });
  sinRespuesta = computed(() => { const s = this.s(); return !!s && s.estado === 'CREADA' && s.busqueda_agotada; });
  guardada = computed(() => { const s = this.s(); return !!s && s.estado === 'CREADA' && !s.busqueda_agotada; });
  aceptada = computed(() => { const s = this.s(); return !!s && (s.estado === 'ACEPTADA' || s.estado === 'EN_CURSO'); });
  pasosBusqueda = computed(() => Array.from({ length: this.s()?.busqueda?.maximo ?? 5 }, (_, i) => i < (this.s()?.busqueda?.enviadas ?? 0)));

  constructor() {
    // recarga cuando llega una notificación (aceptó, rechazó, sin respuesta...)
    effect(() => { if (this.notis.pulso()) this.cargar(); });
  }

  ngOnInit() {
    this.cargar();
    this.timer = setInterval(() => { if (this.buscando() || this.esperandoDirecta()) this.cargar(); }, 6000);
  }
  ngOnDestroy() { clearInterval(this.timer); }

  cargar() {
    this.api.solicitud(+this.id()).subscribe({
      next: s => this.s.set(s),
      error: e => this.error.set(mensajeError(e, 'No encontramos este pedido.')),
    });
  }

  private ejecutar(nombre: string, obs: ReturnType<Api['reintentar']>, ok: string) {
    this.accion.set(nombre);
    obs.subscribe({
      next: s => { this.s.set(s); this.accion.set(''); this.toasts.ok(ok); },
      error: e => { this.accion.set(''); this.toasts.error(mensajeError(e)); },
    });
  }

  irAlCatalogo() {
    const s = this.s()!;
    this.router.navigate(['/app/catalogo'], { queryParams: { solicitud: s.id, oficio: s.oficio_slug } });
  }
  reintentar() { this.ejecutar('reintentar', this.api.reintentar(this.s()!.id), 'Volvimos a buscar profesionales disponibles.'); }
  cancelar() {
    this.confirmarCancelar.set(false);
    this.ejecutar('cancelar', this.api.cancelarSolicitud(this.s()!.id), 'Pedido cancelado.');
  }
  completar() { this.ejecutar('completar', this.api.completarSolicitud(this.s()!.id), 'Marcaste el trabajo como terminado.'); }
  calificar() {
    if (!this.puntaje()) { this.toasts.error('Elegí de 1 a 5 estrellas.'); return; }
    this.ejecutar('calificar', this.api.calificar(this.s()!.id, this.puntaje(), this.comentario.trim()), 'Gracias. Tu calificación ya figura en el perfil.');
  }
  recargarAlVencer() { setTimeout(() => this.cargar(), 1500); }
}
