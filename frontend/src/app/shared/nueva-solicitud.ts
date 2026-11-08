import { Component, HostListener, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Api, erroresCampo, mensajeError } from '../core/api.service';
import { Direccion, Oficio, OficioSlug, ProfesionalPublico, Solicitud } from '../core/models';
import { OFICIOS } from '../core/oficios';
import { Toasts } from '../core/toast.service';
import { DireccionForm } from './direccion-form';
import { MediaPicker } from './ui';

/**
 * Ventana para crear una solicitud de trabajo.
 * - urgente: dispara la asignación automática ("Encontrar profesional ahora").
 * - profesional: se envía directo a ese profesional después de crearla.
 * - ninguno de los dos: queda guardada para elegir a quién mandarla.
 */
@Component({
  selector: 'app-nueva-solicitud',
  imports: [FormsModule, MediaPicker, DireccionForm],
  template: `
    <div class="ofx-backdrop" (click)="fondo($event)">
      <div class="ofx-modal ofx-modal-lg" role="dialog" aria-modal="true" aria-labelledby="ns-title">
        <div class="ofx-modal-head">
          <div class="flex-grow-1">
            <h2 id="ns-title" class="ns-title">{{ titulo() }}</h2>
            @if (!urgente()) { <p class="ofx-muted mb-0 small">{{ bajada() }}</p> }
          </div>
          <button type="button" class="btn-close" aria-label="Cerrar" (click)="cerrar.emit()"></button>
        </div>

        <form class="ofx-modal-body" (ngSubmit)="enviar()" novalidate id="form-solicitud">
          <fieldset class="mb-3">
            <legend class="form-label fs-6">Servicio</legend>
            <div class="servicios">
              @for (o of opciones(); track o.slug) {
                <button type="button" class="serv" [class]="'oficio-' + o.slug" [class.sel]="slug() === o.slug" (click)="slug.set(o.slug)" [attr.aria-pressed]="slug() === o.slug">
                  <i class="bi" [class]="o.icono"></i>{{ o.nombre }}
                </button>
              }
            </div>
          </fieldset>

          <div class="mb-3">
            <label class="form-label" for="ns-t">Título</label>
            <input id="ns-t" name="titulo" class="form-control" maxlength="120" placeholder="Ej.: Pérdida de agua debajo de la bacha" [(ngModel)]="tituloTxt" [class.is-invalid]="err()['titulo']" />
            @if (err()['titulo']) { <div class="invalid-feedback">{{ err()['titulo'] }}</div> }
            <div class="form-text">Una frase breve. Es lo primero que lee el profesional.</div>
          </div>
          <div class="mb-3">
            <label class="form-label" for="ns-d">Descripción detallada</label>
            <textarea id="ns-d" name="descripcion" class="form-control" rows="4" placeholder="Qué pasa, desde cuándo, qué ya probaste, si hay que llevar algún repuesto." [(ngModel)]="descripcion" [class.is-invalid]="err()['descripcion_problema']"></textarea>
            @if (err()['descripcion_problema']) { <div class="invalid-feedback">{{ err()['descripcion_problema'] }}</div> }
          </div>
          <div class="mb-3">
            <span class="form-label d-block">Fotos y videos <span class="optional">(opcional)</span></span>
            <app-media-picker class="compacto" etiqueta="Subir fotos o videos" ayuda="" (cambio)="archivos = $event" />
          </div>

          <fieldset>
            <legend class="form-label fs-6">Dirección del trabajo</legend>
            @if (cargandoDirs()) {
              <p class="ofx-faint"><span class="spinner-border spinner-ofx me-2"></span>Cargando tus direcciones</p>
            } @else {
              <div class="dirs">
                @for (d of direcciones(); track d.id) {
                  <label class="dir" [class.sel]="direccion() === d.id">
                    <input type="radio" name="direccion" class="visually-hidden" [value]="d.id" [checked]="direccion() === d.id" (change)="direccion.set(d.id)" />
                    <i class="bi bi-geo-alt"></i>
                    <span><strong class="d-block">{{ d.alias || 'Dirección' }}</strong><span class="ofx-muted">{{ d.texto }}</span></span>
                  </label>
                }
              </div>
              @if (agregando()) {
                <div class="ofx-panel ofx-panel-pad mt-2"><app-direccion-form (guardada)="nuevaDir($event)" (cancelar)="agregando.set(false)" /></div>
              } @else {
                <button type="button" class="btn btn-quiet btn-sm mt-2" (click)="agregando.set(true)"><i class="bi bi-plus-lg me-1"></i>Agregar otra dirección</button>
              }
              @if (err()['direccion']) { <div class="text-danger small mt-2">{{ err()['direccion'] }}</div> }
            }
          </fieldset>
        </form>

        <div class="ofx-modal-foot">
          <button type="button" class="btn btn-quiet btn-lg" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" form="form-solicitud" class="btn btn-lg flex-grow-1" [class.btn-orange]="urgente()" [class.btn-primary]="!urgente()" [disabled]="enviando()">
            @if (enviando()) { <span class="spinner-border spinner-ofx me-2"></span> }
            {{ textoBoton() }}
          </button>
        </div>
      </div>
    </div>`,
  styles: `
    .ns-title { font-size: 1.75rem; margin: 0 0 .25rem; }
    .servicios { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; }
    @media (max-width: 480px) { .servicios { grid-template-columns: 1fr; } }
    .serv { display: flex; align-items: center; justify-content: center; gap: .45rem; padding: .6rem; border-radius: .8rem; border: 1.5px solid var(--ofx-line-strong); background: var(--ofx-raised); color: var(--ofx-ink); font-weight: 500; font-size: .92rem; }
    .serv i { font-size: 1rem; }
    .serv.sel { border-color: var(--of); background: var(--of-soft); font-weight: 600; box-shadow: 0 0 0 1px var(--of); }
    .serv.sel i { color: var(--of); }
    .dirs { display: grid; gap: .5rem; }
    .dir { display: flex; gap: .75rem; align-items: flex-start; padding: .8rem 1rem; border: 1.5px solid var(--ofx-line); border-radius: .9rem; cursor: pointer; font-size: .92rem; }
    .dir > i { margin-top: .1rem; color: var(--ofx-ink); }
    .dir.sel { border-color: var(--ofx-blue); background: var(--ofx-blue-soft); }
    .dir.sel > i { color: var(--ofx-blue); }
    .dir:focus-within { outline: 3px solid var(--bs-focus-ring-color); }
    :host ::ng-deep .compacto .dropzone { padding: .85rem; background: transparent; color: var(--ofx-blue); font-size: .92rem; }
    :host ::ng-deep .compacto .dropzone .bi { display: inline !important; font-size: 1rem !important; margin-right: .35rem; }
    :host ::ng-deep .compacto .dropzone .ofx-faint { display: none !important; }
  `,
})
export class NuevaSolicitud implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);

  oficioInicial = input<OficioSlug>('plomero');
  urgente = input(false);
  profesional = input<ProfesionalPublico | null>(null);
  creada = output<Solicitud>();
  cerrar = output<void>();

  slug = signal<OficioSlug>('plomero');
  oficios = signal<Oficio[]>([]);
  direcciones = signal<Direccion[]>([]);
  direccion = signal<number | null>(null);
  cargandoDirs = signal(true);
  agregando = signal(false);
  enviando = signal(false);
  err = signal<Record<string, string>>({});
  tituloTxt = '';
  descripcion = '';
  archivos: File[] = [];

  /** Si se pide a un profesional puntual, sólo se ofrecen sus oficios. */
  opciones = computed(() => {
    const pro = this.profesional();
    const orden: OficioSlug[] = ['gasista', 'plomero', 'electricista'];
    const slugs = pro ? orden.filter(s => pro.experiencias.some(e => e.slug === s)) : orden;
    return slugs.map(s => ({ slug: s, ...OFICIOS[s] }));
  });
  titulo = computed(() => this.urgente() ? 'Nueva solicitud de trabajo' : this.profesional() ? `Pedido para ${this.profesional()!.nombre}` : 'Nuevo pedido');
  bajada = computed(() => this.urgente()
    ? 'Le avisamos al profesional disponible con mejor puntaje cerca de la dirección que elijas.'
    : this.profesional() ? 'Cuando lo acepte, se abre el chat para coordinar la visita.' : 'Lo guardamos y después elegís a qué profesional enviárselo.');
  textoBoton = computed(() => this.urgente() ? 'Encontrar profesional ahora' : this.profesional() ? `Enviar a ${this.profesional()!.nombre}` : 'Guardar y elegir profesional');

  ngOnInit() {
    const ops = this.opciones();
    this.slug.set(ops.some(o => o.slug === this.oficioInicial()) ? this.oficioInicial() : ops[0]?.slug ?? 'plomero');
    this.api.oficios().subscribe({ next: o => this.oficios.set(o) });
    this.api.direcciones().subscribe({
      next: d => {
        this.direcciones.set(d);
        this.direccion.set(d.find(x => x.es_principal)?.id ?? d[0]?.id ?? null);
        this.agregando.set(!d.length);
        this.cargandoDirs.set(false);
      },
      error: e => { this.cargandoDirs.set(false); this.toasts.error(mensajeError(e)); },
    });
  }

  nuevaDir(d: Direccion) {
    this.direcciones.update(l => [...l, d]);
    this.direccion.set(d.id);
    this.agregando.set(false);
  }

  @HostListener('document:keydown.escape')
  esc() { if (!this.enviando()) this.cerrar.emit(); }

  fondo(ev: MouseEvent) { if (ev.target === ev.currentTarget && !this.enviando()) this.cerrar.emit(); }

  async enviar() {
    const e: Record<string, string> = {};
    if (!this.tituloTxt.trim()) e['titulo'] = 'Escribí un título breve.';
    if (this.descripcion.trim().length < 10) e['descripcion_problema'] = 'Contá un poco más (al menos 10 caracteres).';
    if (!this.direccion()) e['direccion'] = 'Elegí o agregá la dirección del trabajo.';
    const oficio = this.oficios().find(o => o.slug === this.slug());
    if (!oficio) e['oficio'] = 'No pudimos cargar los oficios. Recargá la página.';
    this.err.set(e);
    if (Object.keys(e).length) return;

    const fd = new FormData();
    fd.append('titulo', this.tituloTxt.trim());
    fd.append('descripcion_problema', this.descripcion.trim());
    fd.append('oficio', String(oficio!.id));
    fd.append('direccion', String(this.direccion()));
    fd.append('es_urgente', String(this.urgente()));
    this.archivos.forEach(f => fd.append('adjuntos', f));

    this.enviando.set(true);
    try {
      let s = await firstValueFrom(this.api.crearSolicitud(fd));
      const pro = this.profesional();
      if (pro) s = await firstValueFrom(this.api.enviarSolicitud(s.id, pro.id));
      this.creada.emit(s);
    } catch (err) {
      this.err.set(erroresCampo(err));
      this.toasts.error(mensajeError(err, 'No pudimos crear el pedido. Revisá los datos.'));
    } finally {
      this.enviando.set(false);
    }
  }
}
