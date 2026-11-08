import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, mensajeError } from '../../core/api.service';
import { Notificaciones } from '../../core/notificaciones.service';
import { Horario, Oferta, SolicitudPro } from '../../core/models';
import { DIAS_CORTOS } from '../../core/oficios';
import { Toasts } from '../../core/toast.service';
import { Countdown, HacePipe, KmPipe, OficioBadge } from '../../shared/ui';
import { OfertaDetalle } from './oferta-detalle';

@Component({
  selector: 'app-pro-inicio',
  imports: [RouterLink, Countdown, HacePipe, KmPipe, OficioBadge, OfertaDetalle],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class ProInicio implements OnInit, OnDestroy {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private notis = inject(Notificaciones);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  tomando = signal(false);
  modo = signal<'AUTOMATICO' | 'MANUAL'>('AUTOMATICO');
  horarios = signal<Horario[]>([]);
  cambiando = signal(false);
  ofertas = signal<Oferta[]>([]);
  pendientes = signal<SolicitudPro[]>([]);
  cargando = signal(true);
  abierta = signal<Oferta | null>(null);
  private timer?: ReturnType<typeof setInterval>;

  urgentes = computed(() => this.ofertas().filter(o => o.es_urgente).length);

  horarioHoy = computed(() => {
    const hoy = (new Date().getDay() + 6) % 7; // 0 = lunes
    const f = this.horarios().filter(h => h.dia === hoy);
    if (!f.length) return 'Hoy no tenés horario de atención cargado';
    return 'Hoy atendés ' + f.map(h => (h.desde === '00:00' && h.hasta >= '23:59' ? 'todo el día' : `de ${h.desde} a ${h.hasta}`)).join(' y ');
  });
  resumenHorario = computed(() => {
    const dias = [...new Set(this.horarios().map(h => h.dia))].sort();
    return dias.map(d => DIAS_CORTOS[d]).join(', ');
  });

  constructor() {
    effect(() => { if (this.notis.pulso()) this.cargarOfertas(); });
  }

  ngOnInit() {
    this.api.proYo().subscribe({
      next: p => { this.tomando.set(p.tomando_trabajos); this.modo.set(p.modo_disponibilidad); this.horarios.set(p.horarios); },
      error: e => this.toasts.error(mensajeError(e)),
    });
    this.cargarOfertas();
    this.api.trabajos('pendientes').subscribe({ next: t => this.pendientes.set(t), error: () => {} });
    this.timer = setInterval(() => this.cargarOfertas(), 10000);

    this.route.queryParamMap.subscribe(q => { const o = q.get('oferta'); if (o) this.abrirPorId(+o); });
  }

  ngOnDestroy() { clearInterval(this.timer); }

  cargarOfertas() {
    this.api.ofertas().subscribe({
      next: o => { this.ofertas.set(o); this.cargando.set(false); },
      error: e => { this.cargando.set(false); this.toasts.error(mensajeError(e)); },
    });
  }

  abrirPorId(id: number) {
    this.api.oferta(id).subscribe({
      next: o => {
        if (o.estado === 'ACEPTADA') this.router.navigate(['/pro/trabajos', o.solicitud.id]);
        else this.abierta.set(o);
      },
      error: () => this.toasts.error('Esa oferta ya no está disponible.'),
    });
  }

  cerrarDetalle() {
    this.abierta.set(null);
    if (this.route.snapshot.queryParamMap.get('oferta')) this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  alternar() {
    this.cambiando.set(true);
    this.api.disponibilidad({ tomando_trabajos: !this.tomando() }).subscribe({
      next: r => {
        this.cambiando.set(false);
        this.tomando.set(r.tomando_trabajos);
        this.modo.set(r.modo);
        this.toasts.ok(r.tomando_trabajos ? 'Estás tomando trabajos. Te van a llegar urgencias de tu zona.' : 'Dejaste de tomar trabajos urgentes.');
      },
      error: e => { this.cambiando.set(false); this.toasts.error(mensajeError(e)); },
    });
  }

  automatico() {
    this.api.disponibilidad({ automatico: true }).subscribe({
      next: r => { this.tomando.set(r.tomando_trabajos); this.modo.set(r.modo); },
      error: e => this.toasts.error(mensajeError(e)),
    });
  }

  resuelta(o: Oferta, aceptada: boolean) {
    this.abierta.set(null);
    this.ofertas.update(l => l.filter(x => x.id !== o.id));
    if (aceptada) this.router.navigate(['/pro/trabajos', o.solicitud.id]);
  }

  vencio() { setTimeout(() => this.cargarOfertas(), 1500); }
}
