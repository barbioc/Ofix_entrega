import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, erroresCampo, mensajeError } from '../../core/api.service';
import { AuthShell } from '../../shared/auth-shell';

/** Pedir el enlace para restablecer la contraseña. */
@Component({
  selector: 'app-recuperar',
  imports: [FormsModule, RouterLink, AuthShell],
  template: `
    <app-auth-shell volver="/ingresar" textoVolver="Volver a iniciar sesión">
      <h1 class="titulo">Recuperar contraseña</h1>
      @if (!enviado()) {
        <p class="ofx-muted mb-4">Ingresá el correo de tu cuenta y te enviamos un enlace para crear una contraseña nueva.</p>
        <form (ngSubmit)="enviar()" novalidate>
          <label class="form-label" for="r-email">Correo electrónico</label>
          <input id="r-email" name="email" type="email" class="form-control" autocomplete="email" [(ngModel)]="email" />
          @if (error()) { <div class="text-danger small mt-2">{{ error() }}</div> }
          <button class="btn btn-orange btn-lg w-100 mt-4" [disabled]="cargando()">@if (cargando()) { <span class="spinner-border spinner-ofx me-2"></span> }Enviar enlace</button>
        </form>
      } @else {
        <p class="ofx-muted">{{ mensaje() }}</p>
        <p class="ofx-faint">Revisá también la carpeta de spam. El enlace sirve una sola vez.</p>
        @if (linkDev()) {
          <div class="alert alert-info small mt-3">Modo desarrollo: el correo se imprimió en la consola del backend.
            <a [href]="linkDev()">Abrir el enlace</a>.</div>
        }
        <a routerLink="/ingresar" class="btn btn-quiet mt-2">Volver a iniciar sesión</a>
      }
    </app-auth-shell>`,
  styles: `.titulo { font-size: 2.1rem; margin-bottom: .5rem; }`,
})
export class Recuperar {
  private api = inject(Api);
  email = '';
  cargando = signal(false);
  enviado = signal(false);
  error = signal('');
  mensaje = signal('');
  linkDev = signal<string | null>(null);

  enviar() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email.trim())) {
      this.error.set('Ingresá un correo válido.');
      return;
    }
    this.cargando.set(true);
    this.api.post<{ detail: string; link_dev?: string }>('auth/recuperar/', { email: this.email.trim() }).subscribe({
      next: r => { this.cargando.set(false); this.mensaje.set(r.detail); this.linkDev.set(r.link_dev ?? null); this.enviado.set(true); },
      error: e => { this.cargando.set(false); this.error.set(mensajeError(e)); },
    });
  }
}

/** Crear la contraseña nueva desde el enlace del correo. */
@Component({
  selector: 'app-restablecer',
  imports: [FormsModule, RouterLink, AuthShell],
  template: `
    <app-auth-shell volver="/ingresar" textoVolver="Volver a iniciar sesión">
      <h1 class="titulo">Contraseña nueva</h1>
      @if (!uid() || !token()) {
        <p class="ofx-muted">El enlace está incompleto. <a routerLink="/recuperar">Pedí uno nuevo</a>.</p>
      } @else {
        <p class="ofx-muted mb-4">Elegí una contraseña de al menos 8 caracteres, con letras y números.</p>
        <form (ngSubmit)="guardar()" novalidate>
          <div class="mb-3">
            <label class="form-label" for="n-1">Contraseña nueva</label>
            <input id="n-1" name="p1" type="password" class="form-control" autocomplete="new-password" [(ngModel)]="p1" [class.is-invalid]="e()['password']" />
            @if (e()['password']) { <div class="invalid-feedback">{{ e()['password'] }}</div> }
          </div>
          <div class="mb-2">
            <label class="form-label" for="n-2">Repetí la contraseña</label>
            <input id="n-2" name="p2" type="password" class="form-control" autocomplete="new-password" [(ngModel)]="p2" [class.is-invalid]="e()['p2']" />
            @if (e()['p2']) { <div class="invalid-feedback">{{ e()['p2'] }}</div> }
          </div>
          @if (e()['detail']) { <div class="alert alert-danger py-2 mt-3 mb-0">{{ e()['detail'] }} <a routerLink="/recuperar">Pedir otro enlace</a></div> }
          <button class="btn btn-orange btn-lg w-100 mt-4" [disabled]="cargando()">@if (cargando()) { <span class="spinner-border spinner-ofx me-2"></span> }Guardar contraseña</button>
        </form>
      }
    </app-auth-shell>`,
  styles: `.titulo { font-size: 2.1rem; margin-bottom: .5rem; }`,
})
export class Restablecer {
  private api = inject(Api);
  private router = inject(Router);
  uid = input<string>('');
  token = input<string>('');
  p1 = '';
  p2 = '';
  cargando = signal(false);
  e = signal<Record<string, string>>({});

  guardar() {
    if (this.p1.length < 8) { this.e.set({ password: 'Usá al menos 8 caracteres.' }); return; }
    if (this.p1 !== this.p2) { this.e.set({ p2: 'Las contraseñas no coinciden.' }); return; }
    this.cargando.set(true);
    this.api.post<{ detail: string }>('auth/restablecer/', { uid: this.uid(), token: this.token(), password: this.p1 }).subscribe({
      next: () => this.router.navigate(['/ingresar'], { queryParams: { restablecida: 1 } }),
      error: err => { this.cargando.set(false); this.e.set(erroresCampo(err)); },
    });
  }
}
