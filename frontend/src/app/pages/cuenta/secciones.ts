import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, erroresCampo, mensajeError } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Direccion } from '../../core/models';
import { PROVINCIAS } from '../../core/oficios';
import { Tema, Theme } from '../../core/theme.service';
import { Toasts } from '../../core/toast.service';
import { DireccionForm } from '../../shared/direccion-form';
import { Avatar } from '../../shared/ui';

/* ------------------------------------------------------------ Datos personales */
@Component({
  selector: 'app-datos-personales',
  imports: [FormsModule, Avatar],
  template: `
    <form (ngSubmit)="guardar()" novalidate>
      <div class="d-flex align-items-center gap-3 mb-4">
        <app-avatar [foto]="fotoUrl() || auth.usuario()?.foto_url" [nombre]="nombre + ' ' + apellido" [size]="72" />
        <div>
          <label class="btn btn-quiet btn-sm mb-0" for="dp-foto">Cambiar foto</label>
          <input id="dp-foto" type="file" accept="image/*" class="visually-hidden" (change)="elegirFoto($event)" />
          <p class="ofx-faint mb-0 mt-1">JPG o PNG.</p>
        </div>
      </div>
      <div class="row g-3">
        <div class="col-sm-6"><label class="form-label" for="dp-n">Nombre</label><input id="dp-n" name="n" class="form-control" [(ngModel)]="nombre" [class.is-invalid]="e()['nombre']" /></div>
        <div class="col-sm-6"><label class="form-label" for="dp-a">Apellido</label><input id="dp-a" name="a" class="form-control" [(ngModel)]="apellido" /></div>
        <div class="col-sm-6"><label class="form-label" for="dp-c">Ciudad</label><input id="dp-c" name="c" class="form-control" [(ngModel)]="ciudad" /></div>
        <div class="col-sm-6"><label class="form-label" for="dp-p">Provincia</label>
          <select id="dp-p" name="p" class="form-select" [(ngModel)]="provincia">@for (p of provincias; track p) { <option [value]="p">{{ p }}</option> }</select></div>
        <div class="col-sm-6"><label class="form-label" for="dp-t">Teléfono</label><input id="dp-t" name="t" type="tel" class="form-control" [(ngModel)]="telefono" /></div>
        <div class="col-sm-6"><label class="form-label" for="dp-e">Email</label><input id="dp-e" class="form-control" [value]="auth.usuario()?.email" disabled /><div class="form-text">El email no se puede cambiar.</div></div>
      </div>
      @if (e()['detail']) { <p class="text-danger mt-2">{{ e()['detail'] }}</p> }
      <button class="btn btn-primary mt-3" [disabled]="cargando()">@if (cargando()) { <span class="spinner-border spinner-ofx me-1"></span> }Guardar cambios</button>
    </form>`,
})
export class DatosPersonales implements OnInit {
  auth = inject(Auth);
  private api = inject(Api);
  private toasts = inject(Toasts);
  provincias = PROVINCIAS;
  nombre = ''; apellido = ''; ciudad = ''; provincia = ''; telefono = '';
  foto: File | null = null;
  fotoUrl = signal<string | null>(null);
  cargando = signal(false);
  e = signal<Record<string, string>>({});

  ngOnInit() {
    const u = this.auth.usuario()!;
    Object.assign(this, { nombre: u.nombre, apellido: u.apellido, ciudad: u.ciudad, provincia: u.provincia, telefono: u.telefono });
  }

  elegirFoto(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    this.foto = f;
    this.fotoUrl.set(URL.createObjectURL(f));
  }

  guardar() {
    if (!this.nombre.trim() || !this.telefono.trim()) { this.e.set({ detail: 'El nombre y el teléfono son obligatorios.' }); return; }
    const fd = new FormData();
    fd.append('nombre', this.nombre.trim());
    fd.append('apellido', this.apellido.trim());
    fd.append('ciudad', this.ciudad.trim());
    fd.append('provincia', this.provincia);
    fd.append('telefono', this.telefono.trim());
    if (this.foto) fd.append('foto', this.foto);
    this.cargando.set(true);
    this.api.actualizarYo(fd).subscribe({
      next: u => { this.cargando.set(false); this.auth.setUsuario(u); this.e.set({}); this.toasts.ok('Datos guardados.'); },
      error: err => { this.cargando.set(false); this.e.set(erroresCampo(err)); this.toasts.error(mensajeError(err)); },
    });
  }
}

/* ------------------------------------------------------------ Direcciones */
@Component({
  selector: 'app-mis-direcciones',
  imports: [DireccionForm],
  template: `
    <ul class="list-unstyled mb-3 dirs">
      @for (d of dirs(); track d.id) {
        <li class="dir-row">
          @if (editando() === d.id) {
            <app-direccion-form class="w-100" [editar]="d" (guardada)="actualizada($event)" (cancelar)="editando.set(null)" />
          } @else {
            <i class="bi bi-geo-alt"></i>
            <div class="flex-grow-1">
              <strong>{{ d.alias || 'Dirección' }}</strong>
              @if (d.es_principal) { <span class="chip chip-blue ms-2">Principal</span> }
              <span class="d-block ofx-muted">{{ d.texto }}</span>
              @if (d.latitud === null) { <span class="ofx-faint">No pudimos ubicar esta dirección. Revisá la calle, el número y la localidad.</span> }
            </div>
            <div class="d-flex gap-1 flex-wrap justify-content-end">
              @if (!d.es_principal) { <button class="btn btn-sm btn-quiet" (click)="principal(d)">Hacer principal</button> }
              <button class="btn btn-sm btn-quiet" (click)="editando.set(d.id)">Editar</button>
              <button class="btn btn-sm btn-quiet" (click)="borrar(d)" [attr.aria-label]="'Borrar ' + d.texto"><i class="bi bi-trash"></i></button>
            </div>
          }
        </li>
      } @empty {
        <li class="ofx-muted">Todavía no guardaste direcciones.</li>
      }
    </ul>
    @if (agregando()) {
      <div class="ofx-panel ofx-panel-pad"><app-direccion-form (guardada)="agregada($event)" (cancelar)="agregando.set(false)" /></div>
    } @else {
      <button class="btn btn-quiet" (click)="agregando.set(true)"><i class="bi bi-plus-lg me-1"></i>Agregar dirección</button>
    }`,
  styles: `
    .dir-row { display: flex; gap: .9rem; align-items: flex-start; padding: .9rem 0; border-bottom: 1px solid var(--ofx-line); flex-wrap: wrap; }
    .dir-row > i { color: var(--ofx-ink-3); font-size: 1.2rem; }
  `,
})
export class MisDirecciones implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  dirs = signal<Direccion[]>([]);
  agregando = signal(false);
  editando = signal<number | null>(null);

  ngOnInit() { this.cargar(); }
  cargar() { this.api.direcciones().subscribe({ next: d => this.dirs.set(d), error: e => this.toasts.error(mensajeError(e)) }); }
  agregada(_: Direccion) { this.agregando.set(false); this.cargar(); this.toasts.ok('Dirección guardada.'); }
  actualizada(_: Direccion) { this.editando.set(null); this.cargar(); this.toasts.ok('Dirección actualizada.'); }
  principal(d: Direccion) { this.api.editarDireccion(d.id, { es_principal: true }).subscribe({ next: () => this.cargar(), error: e => this.toasts.error(mensajeError(e)) }); }
  borrar(d: Direccion) {
    if (!confirm(`¿Borrar ${d.texto}?`)) return;
    this.api.borrarDireccion(d.id).subscribe({ next: () => { this.cargar(); this.toasts.ok('Dirección borrada.'); }, error: e => this.toasts.error(mensajeError(e)) });
  }
}

/* ------------------------------------------------------------ Contraseña y tema */
@Component({
  selector: 'app-seguridad',
  imports: [FormsModule],
  template: `
    <form (ngSubmit)="cambiar()" novalidate class="mb-4" style="max-width: 26rem">
      <div class="mb-3"><label class="form-label" for="pw-a">Contraseña actual</label><input id="pw-a" name="a" type="password" class="form-control" autocomplete="current-password" [(ngModel)]="actual" [class.is-invalid]="e()['actual']" />
        @if (e()['actual']) { <div class="invalid-feedback">{{ e()['actual'] }}</div> }</div>
      <div class="mb-3"><label class="form-label" for="pw-n">Contraseña nueva</label><input id="pw-n" name="n" type="password" class="form-control" autocomplete="new-password" [(ngModel)]="nueva" [class.is-invalid]="e()['nueva']" />
        @if (e()['nueva']) { <div class="invalid-feedback">{{ e()['nueva'] }}</div> }</div>
      <button class="btn btn-quiet" [disabled]="cargando()">Cambiar contraseña</button>
    </form>
    <fieldset>
      <legend class="form-label fs-6">Apariencia</legend>
      <div class="d-flex flex-wrap gap-2">
        @for (t of temas; track t.v) {
          <input type="radio" class="btn-check" name="tema" [id]="'tema-' + t.v" [checked]="theme.tema() === t.v" (change)="theme.set(t.v)" />
          <label class="btn btn-quiet" [for]="'tema-' + t.v"><i class="bi me-1" [class]="t.i"></i>{{ t.l }}</label>
        }
      </div>
    </fieldset>`,
  styles: `.btn-check:checked + .btn { border-color: var(--ofx-blue); background: var(--ofx-blue-soft); color: var(--ofx-ink); }`,
})
export class Seguridad {
  private api = inject(Api);
  private auth = inject(Auth);
  private toasts = inject(Toasts);
  theme = inject(Theme);
  temas: { v: Tema; l: string; i: string }[] = [
    { v: 'light', l: 'Claro', i: 'bi-sun' }, { v: 'dark', l: 'Oscuro', i: 'bi-moon-stars' }, { v: 'system', l: 'Como el sistema', i: 'bi-circle-half' },
  ];
  actual = ''; nueva = '';
  cargando = signal(false);
  e = signal<Record<string, string>>({});

  cambiar() {
    this.cargando.set(true);
    this.api.cambiarPassword(this.actual, this.nueva).subscribe({
      next: s => { this.cargando.set(false); this.auth.guardar(s); this.actual = ''; this.nueva = ''; this.e.set({}); this.toasts.ok('Contraseña actualizada.'); },
      error: err => { this.cargando.set(false); this.e.set(erroresCampo(err)); },
    });
  }
}
