import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, mensajeError } from '../../core/api.service';
import { ProfesionalPublico, Resena, Solicitud } from '../../core/models';
import { Toasts } from '../../core/toast.service';
import { Horarios } from '../../shared/horarios';
import { NuevaSolicitud } from '../../shared/nueva-solicitud';
import { Avatar, FechaPipe, HacePipe, KmPipe, OficioBadge, Stars } from '../../shared/ui';

@Component({
  selector: 'app-profesional-detalle',
  imports: [RouterLink, Avatar, Stars, OficioBadge, KmPipe, FechaPipe, HacePipe, NuevaSolicitud, Horarios],
  template: `
    <div class="container page page-narrow">
      <a routerLink="/app/catalogo" [queryParams]="solicitudId() ? { solicitud: solicitudId() } : {}" class="back-link"><i class="bi bi-arrow-left"></i>Profesionales</a>
      @if (!p()) {
        <p class="ofx-faint"><span class="spinner-border spinner-ofx me-2"></span>Cargando perfil</p>
      } @else {
        @let pro = p()!;
        <header class="d-flex flex-wrap align-items-center gap-4 mb-4">
          <app-avatar [foto]="pro.foto_url" [nombre]="pro.nombre + ' ' + pro.apellido_inicial" [size]="96" />
          <div class="flex-grow-1">
            <h1 class="h2 mb-1">{{ pro.nombre }} {{ pro.apellido_inicial }}</h1>
            <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
              <app-stars [valor]="pro.puntaje_promedio" />
              @if (pro.verificado) { <span class="chip chip-ok"><i class="bi bi-patch-check-fill"></i>Verificado</span> }
              @if (pro.tomando_trabajos) { <span class="chip">Tomando trabajos ahora</span> }
            </div>
            <span class="ofx-muted">{{ pro.localidad_base }}{{ pro.provincia ? ', ' + pro.provincia : '' }}. En Ofix desde {{ pro.miembro_desde | fecha: false }}.</span>
          </div>
        </header>

        <dl class="stats">
          <div><dt>Trabajos</dt><dd class="ofx-num">{{ pro.servicios_realizados }}</dd></div>
          <div><dt>Opiniones</dt><dd class="ofx-num">{{ pro.cantidad_resenas }}</dd></div>
          <div><dt>Distancia</dt><dd class="ofx-num">{{ pro.distancia_km | km }}</dd></div>
          <div><dt>Cubre hasta</dt><dd class="ofx-num">{{ pro.radio_cobertura_km }} km</dd></div>
        </dl>

        <section class="mb-4">
          <h2 class="h4">Oficios</h2>
          <ul class="list-unstyled d-grid gap-2 mb-0">
            @for (e of pro.experiencias; track e.oficio) {
              <li class="d-flex align-items-center gap-2">@if (e.slug) { <app-oficio [slug]="e.slug" /> }<span class="ofx-muted">{{ e.anios_experiencia }} {{ e.anios_experiencia === 1 ? 'año' : 'años' }} de experiencia</span></li>
            }
          </ul>
          @if (pro.certificaciones_validadas) { <p class="ofx-faint mt-2 mb-0"><i class="bi bi-award me-1"></i>{{ pro.certificaciones_validadas }} {{ pro.certificaciones_validadas === 1 ? 'certificación validada' : 'certificaciones validadas' }} por Ofix.</p> }
        </section>

        @if (pro.descripcion) {
          <section class="mb-4"><h2 class="h4">Sobre su trabajo</h2><p class="ofx-measure mb-0">{{ pro.descripcion }}</p></section>
        }

        <section class="mb-4" style="max-width: 28rem">
          <h2 class="h4">Días y horarios de atención</h2>
          <app-horarios [horarios]="pro.horarios" />
        </section>

        <div class="cta mb-5">
          @if (solicitud(); as s) {
            <span class="flex-grow-1">Tu pedido guardado: <strong>«{{ s.titulo }}»</strong></span>
            <button class="btn btn-primary btn-lg" (click)="enviarGuardada()" [disabled]="enviando()">@if (enviando()) { <span class="spinner-border spinner-ofx me-1"></span> }Enviarle mi pedido</button>
          } @else {
            <span class="flex-grow-1">Contale qué necesitás. Si acepta, se abre el chat para coordinar.</span>
            <button class="btn btn-primary btn-lg" (click)="pedir.set(true)">Pedirle un trabajo</button>
          }
        </div>

        <section>
          <h2 class="h4 mb-3">Opiniones de clientes</h2>
          @for (r of resenas(); track r.id) {
            <article class="resena">
              <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                <app-stars [valor]="r.puntaje" [mostrarNumero]="false" />
                <strong>{{ r.cliente }}</strong>
                <span class="ofx-faint">{{ r.oficio }}, {{ r.fecha | hace }}</span>
              </div>
              @if (r.comentario) { <p class="mb-0 ofx-measure">{{ r.comentario }}</p> }
            </article>
          } @empty {
            <p class="ofx-muted">Todavía no tiene opiniones. Los perfiles nuevos suelen responder rápido para sumar sus primeras calificaciones.</p>
          }
        </section>
      }
    </div>
    @if (pedir() && p()) {
      <app-nueva-solicitud [profesional]="p()" [oficioInicial]="p()!.experiencias[0]?.slug || 'plomero'" (cerrar)="pedir.set(false)" (creada)="creada($event)" />
    }`,
  styles: `
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--ofx-line); border-bottom: 1px solid var(--ofx-line); margin-bottom: 2rem; }
    .stats > div { padding: 1rem 0; }
    .stats > div + div { border-left: 1px solid var(--ofx-line); padding-left: 1rem; }
    .stats dt { font-weight: 500; color: var(--ofx-ink-2); font-size: .88rem; }
    .stats dd { margin: 0; font-size: 1.5rem; }
    @media (max-width: 575px) { .stats { grid-template-columns: repeat(2, 1fr); } .stats > div:nth-child(3) { border-left: 0; padding-left: 0; } }
    .cta { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; padding: 1.25rem 1.5rem; border-radius: 1rem; background: var(--ofx-surface); border: 1px solid var(--ofx-line); }
    .resena { padding: 1rem 0; border-top: 1px solid var(--ofx-line); }
  `,
})
export class ProfesionalDetalle implements OnInit {
  private api = inject(Api);
  private router = inject(Router);
  private toasts = inject(Toasts);
  id = input.required<string>();
  solicitudId = input<string>('', { alias: 'solicitud' });

  p = signal<ProfesionalPublico | null>(null);
  resenas = signal<Resena[]>([]);
  solicitud = signal<Solicitud | null>(null);
  pedir = signal(false);
  enviando = signal(false);

  ngOnInit() {
    this.api.profesional(+this.id()).subscribe({ next: p => this.p.set(p), error: e => this.toasts.error(mensajeError(e)) });
    this.api.resenas(+this.id()).subscribe({ next: r => this.resenas.set(r), error: () => {} });
    if (this.solicitudId()) {
      this.api.solicitud(+this.solicitudId()).subscribe({ next: s => s.estado === 'CREADA' && this.solicitud.set(s), error: () => {} });
    }
  }

  enviarGuardada() {
    const s = this.solicitud();
    if (!s) return;
    this.enviando.set(true);
    this.api.enviarSolicitud(s.id, +this.id()).subscribe({
      next: r => { this.toasts.ok(`Le enviamos tu pedido a ${this.p()?.nombre}.`); this.router.navigate(['/app/pedidos', r.id]); },
      error: e => { this.enviando.set(false); this.toasts.error(mensajeError(e)); },
    });
  }

  creada(s: Solicitud) {
    this.pedir.set(false);
    this.toasts.ok('Pedido enviado.');
    this.router.navigate(['/app/pedidos', s.id]);
  }
}
