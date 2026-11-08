import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, erroresCampo, mensajeError } from '../core/api.service';
import { Auth } from '../core/auth.service';
import { Direccion } from '../core/models';
import { PROVINCIAS } from '../core/oficios';
import { Toasts } from '../core/toast.service';

/** Alta o edición de una dirección guardada. */
@Component({
  selector: 'app-direccion-form',
  imports: [FormsModule],
  template: `
    <form (ngSubmit)="guardar()" novalidate class="dir-form">
      <div class="row g-2">
        <div class="col-sm-4">
          <label class="form-label" for="d-alias">Nombre <span class="optional">(opcional)</span></label>
          <input id="d-alias" name="alias" class="form-control" placeholder="Casa, trabajo" [(ngModel)]="d.alias" />
        </div>
        <div class="col-sm-8">
          <label class="form-label" for="d-calle">Calle</label>
          <input id="d-calle" name="calle" class="form-control" [(ngModel)]="d.calle" [class.is-invalid]="e()['calle']" />
          @if (e()['calle']) { <div class="invalid-feedback">{{ e()['calle'] }}</div> }
        </div>
        <div class="col-6 col-sm-3">
          <label class="form-label" for="d-num">Número</label>
          <input id="d-num" name="numero" class="form-control" [(ngModel)]="d.numero" [class.is-invalid]="e()['numero']" />
          @if (e()['numero']) { <div class="invalid-feedback">{{ e()['numero'] }}</div> }
        </div>
        <div class="col-6 col-sm-3">
          <label class="form-label" for="d-depto">Depto. <span class="optional">(opc.)</span></label>
          <input id="d-depto" name="departamento" class="form-control" [(ngModel)]="d.departamento" />
        </div>
        <div class="col-sm-6">
          <label class="form-label" for="d-loc">Ciudad o localidad</label>
          <input id="d-loc" name="localidad" class="form-control" [(ngModel)]="d.localidad" [class.is-invalid]="e()['localidad']" />
          @if (e()['localidad']) { <div class="invalid-feedback">{{ e()['localidad'] }}</div> }
        </div>
        <div class="col-sm-6">
          <label class="form-label" for="d-prov">Provincia</label>
          <select id="d-prov" name="provincia" class="form-select" [(ngModel)]="d.provincia">
            @for (p of provincias; track p) { <option [value]="p">{{ p }}</option> }
          </select>
        </div>
        <div class="col-sm-6">
          <label class="form-label" for="d-cp">Código postal <span class="optional">(opcional)</span></label>
          <input id="d-cp" name="cp" class="form-control" [(ngModel)]="d.cod_postal" />
        </div>
        <div class="col-sm-6 d-flex align-items-end">
          <button type="button" class="btn btn-quiet w-100" (click)="ubicar()" [disabled]="ubicando()">
            @if (ubicando()) { <span class="spinner-border spinner-ofx me-1"></span> } @else { <i class="bi bi-crosshair me-1"></i> }
            {{ d.latitud !== null && d.latitud !== undefined ? 'Ubicación guardada' : 'Usar mi ubicación' }}
          </button>
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-quiet" (click)="cancelar.emit()">Cancelar</button>
        <button class="btn btn-primary" [disabled]="cargando()">@if (cargando()) { <span class="spinner-border spinner-ofx me-1"></span> }Guardar dirección</button>
      </div>
    </form>`,
})
export class DireccionForm implements OnInit {
  private api = inject(Api);
  private auth = inject(Auth);
  private toasts = inject(Toasts);
  editar = input<Direccion | null>(null);
  guardada = output<Direccion>();
  cancelar = output<void>();
  provincias = PROVINCIAS;
  d: Partial<Direccion> = {};
  e = signal<Record<string, string>>({});
  cargando = signal(false);
  ubicando = signal(false);

  ngOnInit() {
    const u = this.auth.usuario();
    this.d = this.editar()
      ? { ...this.editar()! }
      : { alias: '', calle: '', numero: '', departamento: '', localidad: u?.ciudad ?? '', provincia: u?.provincia || 'Buenos Aires', cod_postal: '', latitud: null, longitud: null };
  }

  ubicar() {
    if (!navigator.geolocation) return;
    this.ubicando.set(true);
    navigator.geolocation.getCurrentPosition(
      p => { this.d.latitud = +p.coords.latitude.toFixed(6); this.d.longitud = +p.coords.longitude.toFixed(6); this.ubicando.set(false); },
      () => { this.ubicando.set(false); this.toasts.error('No pudimos obtener tu ubicación. Usaremos la dirección escrita.'); },
      { timeout: 10000 },
    );
  }

  guardar() {
    const e: Record<string, string> = {};
    if (!this.d.calle?.trim()) e['calle'] = 'Ingresá la calle.';
    if (!this.d.numero?.trim()) e['numero'] = 'Ingresá el número.';
    if (!this.d.localidad?.trim()) e['localidad'] = 'Ingresá la localidad.';
    this.e.set(e);
    if (Object.keys(e).length) return;
    this.cargando.set(true);
    const { id, texto, ...body } = this.d as Direccion;
    const req = this.editar() ? this.api.editarDireccion(this.editar()!.id, body) : this.api.crearDireccion(body);
    req.subscribe({
      next: d => { this.cargando.set(false); this.guardada.emit(d); },
      error: err => { this.cargando.set(false); this.e.set(erroresCampo(err)); this.toasts.error(mensajeError(err)); },
    });
  }
}
