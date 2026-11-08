import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, mensajeError } from '../../core/api.service';
import { Direccion, OficioSlug, ProfesionalPublico, Solicitud } from '../../core/models';
import { OFICIOS, ORDEN_OFICIOS } from '../../core/oficios';
import { Toasts } from '../../core/toast.service';
import { NuevaSolicitud } from '../../shared/nueva-solicitud';
import { Avatar, KmPipe, OficioBadge, Stars } from '../../shared/ui';

@Component({
  selector: 'app-catalogo',
  imports: [FormsModule, RouterLink, Avatar, Stars, OficioBadge, KmPipe, NuevaSolicitud],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.scss',
})
export class Catalogo implements OnInit {
  private api = inject(Api);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toasts = inject(Toasts);

  oficios = ORDEN_OFICIOS.map(slug => ({ slug, ...OFICIOS[slug] }));
  oficio = signal<OficioSlug | ''>('');
  q = '';
  orden = 'recomendados';
  soloCobertura = false;
  direccion: number | null = null;
  direcciones = signal<Direccion[]>([]);
  pros = signal<ProfesionalPublico[]>([]);
  cargando = signal(true);

  /** Pedido guardado que se quiere enviar (viene de "Elegir profesional"). */
  solicitud = signal<Solicitud | null>(null);
  confirmar = signal<ProfesionalPublico | null>(null);
  enviando = signal(false);
  pedirA = signal<ProfesionalPublico | null>(null);
  private buscarT?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    const of = qp.get('oficio') as OficioSlug | null;
    if (of && of in OFICIOS) this.oficio.set(of);
    this.q = qp.get('q') ?? '';
    const sid = qp.get('solicitud');
    if (sid) {
      this.api.solicitud(+sid).subscribe({
        next: s => {
          if (s.estado !== 'CREADA') return;
          this.solicitud.set(s);
          this.oficio.set(s.oficio_slug);
          this.direccion = s.direccion;
          this.buscar();
        },
        error: () => {},
      });
    }
    this.api.direcciones().subscribe({
      next: d => {
        this.direcciones.set(d);
        if (!this.direccion) this.direccion = d.find(x => x.es_principal)?.id ?? d[0]?.id ?? null;
        this.buscar();
      },
      error: () => this.buscar(),
    });
  }

  elegirOficio(s: OficioSlug | '') {
    if (this.solicitud()) return;
    this.oficio.set(s);
    this.buscar();
  }

  buscarLuego() {
    clearTimeout(this.buscarT);
    this.buscarT = setTimeout(() => this.buscar(), 300);
  }

  buscar() {
    this.cargando.set(true);
    this.api.profesionales({
      oficio: this.oficio(), q: this.q.trim(), orden: this.orden, direccion: this.direccion,
      en_cobertura: this.soloCobertura ? 1 : undefined,
    }).subscribe({
      next: p => { this.pros.set(p); this.cargando.set(false); },
      error: e => { this.cargando.set(false); this.toasts.error(mensajeError(e)); },
    });
  }

  aniosMax(p: ProfesionalPublico) { return Math.max(0, ...p.experiencias.map(e => e.anios_experiencia)); }
  fueraDeZona(p: ProfesionalPublico) { return p.distancia_km !== null && p.distancia_km > p.radio_cobertura_km; }

  accion(p: ProfesionalPublico) {
    if (this.solicitud()) this.confirmar.set(p);
    else this.pedirA.set(p);
  }

  enviar() {
    const p = this.confirmar();
    const s = this.solicitud();
    if (!p || !s) return;
    this.enviando.set(true);
    this.api.enviarSolicitud(s.id, p.id).subscribe({
      next: r => {
        this.enviando.set(false);
        this.toasts.ok(`Le enviamos tu pedido a ${p.nombre}.`);
        this.router.navigate(['/app/pedidos', r.id]);
      },
      error: e => { this.enviando.set(false); this.toasts.error(mensajeError(e)); },
    });
  }

  creada(s: Solicitud) {
    this.pedirA.set(null);
    this.toasts.ok('Pedido enviado.');
    this.router.navigate(['/app/pedidos', s.id]);
  }
}
