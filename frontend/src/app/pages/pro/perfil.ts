import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, mensajeError } from '../../core/api.service';
import { ProfesionalPrivado, Resena } from '../../core/models';
import { Toasts } from '../../core/toast.service';
import { Horarios } from '../../shared/horarios';
import { Avatar, FechaPipe, HacePipe, OficioBadge, Stars } from '../../shared/ui';

/** Puntaje y opiniones del profesional. */
@Component({
  selector: 'app-pro-perfil',
  imports: [RouterLink, Avatar, Stars, OficioBadge, HacePipe, FechaPipe, Horarios],
  template: `
    <div class="pro-page" style="max-width: 60rem">
      @if (!p()) {
        <p class="ofx-faint"><span class="spinner-border spinner-ofx me-2"></span>Cargando perfil</p>
      } @else {
        @let pro = p()!;
        <header class="d-flex flex-wrap align-items-center gap-4 mb-4">
          <app-avatar [foto]="pro.foto_url" [nombre]="pro.nombre" [size]="88" />
          <div class="flex-grow-1">
            <h1 class="h2 mb-1">{{ pro.nombre }} {{ pro.apellido_inicial }}</h1>
            <div class="d-flex flex-wrap gap-2 align-items-center">
              @for (e of pro.experiencias; track e.oficio) { @if (e.slug) { <app-oficio [slug]="e.slug" /> } }
              @if (pro.estado_validacion === 'APROBADO') { <span class="chip chip-ok"><i class="bi bi-patch-check-fill"></i>Verificado</span> }
              @else if (pro.estado_validacion === 'PENDIENTE') { <span class="chip">Verificación en revisión</span> }
              @else { <span class="chip chip-urgente">Verificación rechazada</span> }
            </div>
            <p class="ofx-faint mt-2 mb-0">Así te ven los clientes en el catálogo, sin tu apellido completo, teléfono ni dirección.</p>
          </div>
          <a routerLink="/pro/config" class="btn btn-quiet">Editar perfil</a>
        </header>

        <div class="puntaje">
          <div class="puntaje-big">
            <span class="ofx-num big">{{ pro.puntaje_promedio ? pro.puntaje_promedio.toFixed(1) : '–' }}</span>
            <app-stars [valor]="pro.puntaje_promedio" [mostrarNumero]="false" />
            <span class="ofx-faint d-block mt-1">{{ resenas().length }} {{ resenas().length === 1 ? 'opinión' : 'opiniones' }}, {{ finalizados() }} trabajos finalizados</span>
          </div>
          <ul class="barras" aria-label="Distribución de calificaciones">
            @for (i of [5, 4, 3, 2, 1]; track i) {
              <li><span class="ofx-num">{{ i }}</span><i class="bi bi-star-fill stars"></i>
                <span class="barra"><span [style.width.%]="pct(i)"></span></span><span class="ofx-num ofx-faint">{{ dist()[i] || 0 }}</span></li>
            }
          </ul>
        </div>
        @if (pro.servicios_realizados < 5) {
          <p class="ofx-muted mt-3">Tenés impulso de perfil nuevo: hasta tus primeros 5 trabajos subís en el orden de asignación de urgencias.</p>
        }

        <section class="mt-5" style="max-width: 28rem">
          <div class="d-flex align-items-baseline justify-content-between mb-2">
            <h2 class="h4 mb-0">Días y horarios de atención</h2>
            <a routerLink="/pro/config" fragment="cobertura" class="small">Editar</a>
          </div>
          <p class="ofx-faint">Así los ven los clientes en tu perfil.</p>
          <app-horarios [horarios]="pro.horarios" />
        </section>

        <h2 class="h4 mt-5 mb-3">Opiniones</h2>
        @for (r of resenas(); track r.id) {
          <article class="resena">
            <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
              <app-stars [valor]="r.puntaje" [mostrarNumero]="false" />
              <strong>{{ r.cliente }}</strong>
              <span class="ofx-faint">{{ r.titulo }}, {{ r.fecha | hace }}</span>
            </div>
            @if (r.comentario) { <p class="mb-0 ofx-measure">{{ r.comentario }}</p> }
          </article>
        } @empty {
          <p class="ofx-muted">Cuando un cliente califique un trabajo tuyo, su opinión va a aparecer acá.</p>
        }
        <p class="ofx-faint mt-4">En Ofix desde {{ pro.miembro_desde | fecha: false }}.</p>
      }
    </div>`,
  styles: `
    .puntaje { display: grid; grid-template-columns: auto 1fr; gap: 3rem; align-items: center; padding: 1.5rem; border: 1px solid var(--ofx-line); border-radius: 1rem; background: var(--ofx-raised); }
    @media (max-width: 575px) { .puntaje { grid-template-columns: 1fr; gap: 1.5rem; } }
    .big { font-size: 3.6rem; line-height: 1; display: block; font-weight: 700; }
    .barras { list-style: none; margin: 0; padding: 0; display: grid; gap: .4rem; }
    .barras li { display: grid; grid-template-columns: 1rem 1rem 1fr 2rem; gap: .5rem; align-items: center; }
    .barra { height: .5rem; border-radius: 99px; background: var(--ofx-surface); overflow: hidden; }
    .barra span { display: block; height: 100%; background: var(--ofx-luz); border-radius: 99px; }
    .resena { padding: 1rem 0; border-top: 1px solid var(--ofx-line); }
  `,
})
export class ProPerfil implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  p = signal<ProfesionalPrivado | null>(null);
  resenas = signal<Resena[]>([]);
  dist = signal<Record<string, number>>({});
  finalizados = signal(0);
  private total = computed(() => Object.values(this.dist()).reduce((a, b) => a + b, 0));

  ngOnInit() {
    this.api.proResumen().subscribe({
      next: r => { this.p.set(r.perfil); this.resenas.set(r.resenas); this.dist.set(r.distribucion); this.finalizados.set(r.trabajos_finalizados); },
      error: e => this.toasts.error(mensajeError(e)),
    });
  }

  pct(i: number) { return this.total() ? ((this.dist()[i] || 0) / this.total()) * 100 : 0; }
}
