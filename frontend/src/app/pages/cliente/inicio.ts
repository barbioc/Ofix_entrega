import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { OficioSlug, Solicitud } from '../../core/models';
import { ESTADOS_CLIENTE, OFICIOS } from '../../core/oficios';
import { NuevaSolicitud } from '../../shared/nueva-solicitud';
import { HacePipe, OficioBadge } from '../../shared/ui';

@Component({
  selector: 'app-cliente-inicio',
  imports: [RouterLink, NuevaSolicitud, OficioBadge, HacePipe],
  template: `
    <div class="container page inicio">
      <header class="text-center mb-4">
        <h1 class="urg-title">¿Tenés una urgencia?</h1>
        <p class="urg-sub">Elegí el tipo de profesional y publicá tu pedido. Lo enviamos al mejor profesional disponible cerca tuyo.</p>
      </header>

      <div class="urg-grid">
        @for (o of oficios; track o.slug) {
          <button type="button" class="urg-btn" [class]="'oficio-' + o.slug" (click)="abrir(o.slug)" [attr.aria-label]="'Pedir ' + o.nombre.toLowerCase() + ' de urgencia'">
            <i class="bi urg-ico" [class]="o.icono"></i>
            <span class="urg-name">{{ o.nombre }}</span>
          </button>
        }
      </div>

      <section class="manual" aria-labelledby="t-manual">
        <h2 id="t-manual" class="manual-title">Quiero buscar mi propio profesional, sin apuro</h2>
        <p class="ofx-muted mb-3">Mirá perfiles, calificaciones y opiniones. Después hablás con el profesional por chat para coordinar la visita cuando y como quieran.</p>
        <form class="manual-buscar" (submit)="$event.preventDefault(); buscar()">
          <label class="visually-hidden" for="m-q">Buscar profesional por nombre</label>
          <div class="buscar-input">
            <i class="bi bi-search"></i>
            <input id="m-q" name="q" class="form-control" placeholder="Buscá por nombre" [value]="q()" (input)="q.set($any($event.target).value)" />
          </div>
          <button class="btn btn-primary">Explorar catálogo completo</button>
        </form>
      </section>

      @if (activas().length) {
        <section class="activas-box" aria-labelledby="t-activas">
          <div class="d-flex align-items-baseline justify-content-between mb-2">
            <h2 id="t-activas" class="h4 mb-0">Tus pedidos en curso</h2>
            <a routerLink="/app/pedidos">Ver todos</a>
          </div>
          <ul class="activas">
            @for (s of activas(); track s.id) {
              <li>
                <a [routerLink]="['/app/pedidos', s.id]" class="activa">
                  <app-oficio [slug]="s.oficio_slug" />
                  <span class="flex-grow-1 min-w-0">
                    <strong class="d-block text-truncate">{{ s.titulo }}</strong>
                    <span class="ofx-faint">{{ s.fecha_solicitud | hace }}</span>
                  </span>
                  <span class="chip" [class.chip-urgente]="s.estado === 'NOTIFICANDO' && s.es_urgente" [class.chip-ok]="s.estado === 'ACEPTADA'" [class.chip-blue]="s.estado === 'CREADA'">
                    {{ s.busqueda_agotada ? 'Sin respuesta' : s.estado === 'NOTIFICANDO' && s.es_urgente && s.oferta_directa?.estado !== 'PENDIENTE' ? 'Buscando profesional' : estados[s.estado] }}
                  </span>
                </a>
              </li>
            }
          </ul>
        </section>
      }
    </div>

    @if (oficioAbierto(); as slug) {
      <app-nueva-solicitud [oficioInicial]="slug" [urgente]="true" (cerrar)="oficioAbierto.set(null)" (creada)="creada($event)" />
    }`,
  styles: `
    .inicio { max-width: 52rem; }
    .urg-title { font-size: clamp(2.1rem, 4.6vw, 3rem); margin: 1rem 0 .6rem; }
    .urg-sub { color: var(--ofx-ink-2); max-width: 26rem; margin: 0 auto; }
    .urg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .9rem; margin-bottom: 2.5rem; }
    @media (max-width: 575px) { .urg-grid { grid-template-columns: 1fr; } }
    .urg-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .9rem; padding: 2rem 1rem; min-height: 9rem;
      border: 1.5px solid var(--ofx-line); border-radius: 1.4rem; background: var(--ofx-raised); color: var(--ofx-ink);
      transition: border-color .15s, background .15s, box-shadow .15s, transform .15s;
    }
    .urg-btn:hover, .urg-btn:focus-visible { border-color: var(--of); background: var(--of-soft); box-shadow: 0 6px 20px -10px var(--of); }
    .urg-btn:active { transform: translateY(1px); }
    .urg-ico { color: var(--of); font-size: 2.1rem; line-height: 1; }
    .urg-name { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 1.15rem; }
    .manual { background: var(--ofx-raised); border: 1px solid var(--ofx-line); border-radius: 1.4rem; padding: 1.75rem; }
    .manual-title { font-size: 1.35rem; margin-bottom: .5rem; }
    .manual-buscar { display: flex; gap: .75rem; flex-wrap: wrap; }
    .buscar-input { position: relative; flex: 1; min-width: 14rem; }
    .buscar-input i { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--ofx-ink-3); }
    .buscar-input .form-control { border-radius: 999px; padding-left: 2.5rem; background: var(--ofx-surface); border-color: var(--ofx-line); }
    .activas-box { margin-top: 2.5rem; }
    .activas { list-style: none; padding: 0; margin: 0; background: var(--ofx-raised); border: 1px solid var(--ofx-line); border-radius: 1.25rem; overflow: hidden; }
    .activa { display: flex; align-items: center; gap: 1rem; padding: .9rem 1.1rem; color: var(--ofx-ink); text-decoration: none; }
    li + li .activa { border-top: 1px solid var(--ofx-line); }
    .activa:hover { background: var(--ofx-surface); }
    .min-w-0 { min-width: 0; }
  `,
})
export class ClienteInicio implements OnInit {
  auth = inject(Auth);
  private api = inject(Api);
  private router = inject(Router);
  /** Orden de Figma: gasista, plomero, electricista. */
  oficios = (['gasista', 'plomero', 'electricista'] as OficioSlug[]).map(slug => ({ slug, ...OFICIOS[slug] }));
  q = signal('');
  estados = ESTADOS_CLIENTE;
  oficioAbierto = signal<OficioSlug | null>(null);
  activas = signal<Solicitud[]>([]);

  ngOnInit() { this.api.solicitudes('activas').subscribe({ next: s => this.activas.set(s.slice(0, 4)), error: () => {} }); }

  abrir(slug: OficioSlug) { this.oficioAbierto.set(slug); }

  buscar() { this.router.navigate(['/app/catalogo'], { queryParams: this.q().trim() ? { q: this.q().trim() } : {} }); }

  creada(s: Solicitud) {
    this.oficioAbierto.set(null);
    this.router.navigate(['/app/pedidos', s.id]);
  }
}
