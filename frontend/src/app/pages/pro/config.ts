import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { concat, firstValueFrom, toArray } from 'rxjs';
import { Api, mensajeError } from '../../core/api.service';
import { Certificacion, Oficio, OficioSlug } from '../../core/models';
import { DIAS, OFICIOS } from '../../core/oficios';
import { Toasts } from '../../core/toast.service';
import { MediaPicker } from '../../shared/ui';
import { DatosPersonales, MisDirecciones, Seguridad } from '../cuenta/secciones';

interface Franja { activo: boolean; desde: string; hasta: string; }

@Component({
  selector: 'app-pro-config',
  imports: [FormsModule, DatosPersonales, MisDirecciones, Seguridad, MediaPicker],
  template: `
    <div class="pro-page" style="max-width: 52rem">
      <h1 class="page-title mb-3">Configuración</h1>
      <nav class="subnav mb-4" aria-label="Secciones">
        <a href="/pro/config#datos" (click)="ir($event, 'datos')">Datos</a>
        <a href="/pro/config#oficios" (click)="ir($event, 'oficios')">Oficios</a>
        <a href="/pro/config#cobertura" (click)="ir($event, 'cobertura')">Cobertura y horarios</a>
        <a href="/pro/config#certificaciones" (click)="ir($event, 'certificaciones')">Certificaciones</a>
        <a href="/pro/config#direccion" (click)="ir($event, 'direccion')">Dirección base</a>
        <a href="/pro/config#cuenta" (click)="ir($event, 'cuenta')">Cuenta</a>
      </nav>

      <section id="datos" class="sec">
        <h2 class="h4 mb-3">Datos personales</h2>
        <app-datos-personales />
        <div class="mt-4">
          <label class="form-label" for="pc-desc">Sobre tu trabajo <span class="optional">(lo ven los clientes)</span></label>
          <textarea id="pc-desc" class="form-control" rows="3" maxlength="600" [(ngModel)]="descripcion" placeholder="Zonas donde trabajás, especialidades, si das presupuesto sin cargo."></textarea>
          <button class="btn btn-quiet mt-2" (click)="guardar({ descripcion }, 'Descripción guardada.')">Guardar descripción</button>
        </div>
      </section>

      <section id="oficios" class="sec">
        <h2 class="h4 mb-3">Oficios y experiencia</h2>
        <div class="d-grid gap-2">
          @for (o of oficios(); track o.id) {
            <div class="of-row" [class]="'oficio-' + slug(o)">
              <div class="form-check m-0 flex-grow-1">
                <input class="form-check-input" type="checkbox" [id]="'of-' + o.id" [checked]="o.id in anios" (change)="alternar(o.id)" />
                <label class="form-check-label d-flex align-items-center gap-2" [for]="'of-' + o.id"><i class="bi" [class]="meta[slug(o)].icono" style="color: var(--of)"></i>{{ o.nombre }}</label>
              </div>
              @if (o.id in anios) {
                <label class="visually-hidden" [for]="'ofa-' + o.id">Años de experiencia en {{ o.nombre }}</label>
                <div class="input-group input-group-sm" style="width: 9rem">
                  <input [id]="'ofa-' + o.id" type="number" min="0" max="70" class="form-control" [(ngModel)]="anios[o.id]" />
                  <span class="input-group-text">años</span>
                </div>
              }
            </div>
          }
        </div>
        <button class="btn btn-quiet mt-3" (click)="guardarOficios()">Guardar oficios</button>
      </section>

      <section id="cobertura" class="sec">
        <h2 class="h4 mb-3">Cobertura y horarios</h2>
        <label class="form-label" for="pc-radio">Radio de cobertura: <span class="ofx-num">{{ radio }} km</span></label>
        <input id="pc-radio" type="range" class="form-range" min="1" max="150" [(ngModel)]="radio" [attr.aria-valuetext]="radio + ' kilómetros'" />
        <div class="d-flex justify-content-between ofx-faint mb-4"><span>1 km</span><span>150 km</span></div>
        <span class="form-label d-block">Horarios de atención</span>
        <div class="horarios">
          @for (f of franjas; track $index; let i = $index) {
            <div class="h-row">
              <div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" role="switch" [id]="'pd-' + i" [(ngModel)]="f.activo" /><label class="form-check-label" [for]="'pd-' + i">{{ dias[i] }}</label></div>
              @if (f.activo) {
                <div class="d-flex align-items-center gap-2">
                  <input type="time" class="form-control form-control-sm" [(ngModel)]="f.desde" [attr.aria-label]="dias[i] + ' desde'" />
                  <span class="ofx-faint">a</span>
                  <input type="time" class="form-control form-control-sm" [(ngModel)]="f.hasta" [attr.aria-label]="dias[i] + ' hasta'" />
                </div>
              } @else { <span class="ofx-faint">No atiendo</span> }
            </div>
          }
        </div>
        <button class="btn btn-quiet mt-3" (click)="guardarCobertura()">Guardar cobertura y horarios</button>
      </section>

      <section id="certificaciones" class="sec">
        <h2 class="h4 mb-2">Certificaciones</h2>
        <p class="ofx-muted">Matrícula, cursos o habilitaciones. Cada una queda en revisión hasta que la validemos.</p>
        <ul class="list-unstyled mb-3">
          @for (c of certs(); track c.id) {
            <li class="cert">
              <i class="bi bi-file-earmark-check"></i>
              <a class="flex-grow-1 text-truncate" [href]="c.archivo_link" target="_blank" rel="noopener">{{ c.nombre || 'Certificación' }}</a>
              <span class="chip" [class.chip-ok]="c.estado === 'VALIDADO'" [class.chip-urgente]="c.estado === 'RECHAZADO'">{{ c.estado === 'VALIDADO' ? 'Validada' : c.estado === 'RECHAZADO' ? 'Rechazada' : 'En revisión' }}</span>
              <button class="btn btn-sm btn-quiet" (click)="borrarCert(c)" [attr.aria-label]="'Borrar ' + c.nombre"><i class="bi bi-trash"></i></button>
            </li>
          } @empty { <li class="ofx-muted mb-2">Todavía no cargaste certificaciones.</li> }
        </ul>
        <app-media-picker #picker accept="image/*,application/pdf" etiqueta="Agregar certificados" ayuda="Fotos o PDF, hasta 15 MB cada uno." (cambio)="nuevos = $event" />
        @if (nuevos.length) { <button class="btn btn-primary mt-2" (click)="subir()" [disabled]="subiendo()">@if (subiendo()) { <span class="spinner-border spinner-ofx me-1"></span> }Subir {{ nuevos.length }} {{ nuevos.length === 1 ? 'archivo' : 'archivos' }}</button> }
      </section>

      <section id="direccion" class="sec">
        <h2 class="h4 mb-2">Dirección base</h2>
        <p class="ofx-muted">Desde tu dirección principal se calcula la distancia a cada trabajo. No se muestra a los clientes.</p>
        <app-mis-direcciones />
      </section>

      <section id="cuenta" class="sec">
        <h2 class="h4 mb-3">Contraseña y apariencia</h2>
        <app-seguridad />
      </section>
    </div>`,
  styles: `
    .subnav { display: flex; flex-wrap: wrap; gap: .25rem 1.25rem; padding-bottom: .75rem; border-bottom: 1px solid var(--ofx-line); }
    .subnav a { color: var(--ofx-ink-2); text-decoration: none; font-weight: 600; font-size: .92rem; }
    .subnav a:hover { color: var(--ofx-ink); }
    .sec { padding: 2rem 0; border-bottom: 1px solid var(--ofx-line); scroll-margin-top: 4.5rem; }
    .of-row { display: flex; align-items: center; gap: 1rem; padding: .7rem .9rem; border: 1px solid var(--ofx-line); border-radius: .6rem; }
    .horarios { border: 1px solid var(--ofx-line); border-radius: .75rem; }
    .h-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .5rem 1rem; padding: .55rem .9rem; }
    .h-row + .h-row { border-top: 1px solid var(--ofx-line); }
    .h-row .form-check-label { min-width: 6rem; font-weight: 550; }
    .h-row input[type='time'] { width: 7.2rem; }
    .cert { display: flex; align-items: center; gap: .75rem; padding: .6rem 0; border-bottom: 1px solid var(--ofx-line); min-width: 0; }
  `,
})
export class ProConfig implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private picker = viewChild<MediaPicker>('picker');
  meta = OFICIOS;
  dias = DIAS;
  oficios = signal<Oficio[]>([]);
  anios: Record<number, number> = {};
  radio = 15;
  descripcion = '';
  franjas: Franja[] = DIAS.map(() => ({ activo: false, desde: '08:00', hasta: '18:00' }));
  certs = signal<Certificacion[]>([]);
  nuevos: File[] = [];
  subiendo = signal(false);

  ngOnInit() {
    this.api.oficios().subscribe({ next: o => this.oficios.set(o) });
    this.api.proYo().subscribe({
      next: p => {
        this.radio = p.radio_cobertura_km;
        this.descripcion = p.descripcion;
        this.anios = {};
        p.experiencias.forEach(e => (this.anios[e.oficio] = e.anios_experiencia));
        this.franjas = DIAS.map((_, i) => {
          const h = p.horarios.find(x => x.dia === i);
          return h ? { activo: true, desde: h.desde, hasta: h.hasta } : { activo: false, desde: '08:00', hasta: '18:00' };
        });
        this.certs.set(p.certificaciones);
      },
      error: e => this.toasts.error(mensajeError(e)),
    });
  }

  slug(o: Oficio): OficioSlug { return (o.slug || 'plomero') as OficioSlug; }

  ir(ev: Event, id: string) {
    ev.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  alternar(id: number) {
    if (id in this.anios) delete this.anios[id];
    else this.anios[id] = 0;
  }

  guardar(body: unknown, ok: string) {
    this.api.proActualizar(body).subscribe({ next: () => this.toasts.ok(ok), error: e => this.toasts.error(mensajeError(e)) });
  }

  guardarOficios() {
    const exp = Object.entries(this.anios).map(([oficio, a]) => ({ oficio: +oficio, anios_experiencia: Number(a) || 0 }));
    if (!exp.length) { this.toasts.error('Elegí al menos un oficio.'); return; }
    this.guardar({ experiencias: exp }, 'Oficios guardados.');
  }

  guardarCobertura() {
    const hs = this.franjas.map((f, dia) => ({ ...f, dia })).filter(f => f.activo);
    if (hs.some(h => h.desde >= h.hasta)) { this.toasts.error('Revisá los horarios: la hora de fin tiene que ser posterior al inicio.'); return; }
    this.guardar({ radio_cobertura_km: this.radio, horarios: hs.map(({ dia, desde, hasta }) => ({ dia, desde, hasta })) }, 'Cobertura y horarios guardados.');
  }

  async subir() {
    this.subiendo.set(true);
    try {
      const reqs = this.nuevos.map(f => { const fd = new FormData(); fd.append('archivo', f); fd.append('nombre', f.name); return this.api.subirCertificacion(fd); });
      const nuevas = await firstValueFrom(concat(...reqs).pipe(toArray()));
      this.certs.update(l => [...l, ...nuevas]);
      this.picker()?.limpiar();
      this.toasts.ok('Certificaciones enviadas a revisión.');
    } catch (e) {
      this.toasts.error(mensajeError(e));
    } finally {
      this.subiendo.set(false);
    }
  }

  borrarCert(c: Certificacion) {
    if (!confirm(`¿Borrar ${c.nombre || 'esta certificación'}?`)) return;
    this.api.borrarCertificacion(c.id).subscribe({ next: () => this.certs.update(l => l.filter(x => x.id !== c.id)), error: e => this.toasts.error(mensajeError(e)) });
  }
}
