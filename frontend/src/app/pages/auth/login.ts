import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, mensajeError } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Rol } from '../../core/models';
import { AuthShell } from '../../shared/auth-shell';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, AuthShell],
  template: `
    <app-auth-shell>
      <h1 class="titulo">Iniciar sesión</h1>
      <p class="ofx-muted mb-4">Elegí cómo querés ingresar.</p>
      @if (restablecida()) { <div class="alert alert-success py-2" role="status">Tu contraseña se actualizó. Ya podés iniciar sesión.</div> }

      <div class="roles" role="radiogroup" aria-label="Tipo de cuenta">
        <button type="button" role="radio" class="rol" [class.sel]="rol() === 'CLIENTE'" [attr.aria-checked]="rol() === 'CLIENTE'" (click)="elegir('CLIENTE')">
          <strong><span class="marca-rol"></span>Cliente</strong>
          <span>Busco un profesional para mi hogar</span>
        </button>
        <button type="button" role="radio" class="rol" [class.sel]="rol() === 'PROFESIONAL'" [attr.aria-checked]="rol() === 'PROFESIONAL'" (click)="elegir('PROFESIONAL')">
          <strong><span class="marca-rol"></span>Profesional</strong>
          <span>Quiero recibir órdenes de trabajo</span>
        </button>
      </div>

      <form (ngSubmit)="entrar()" novalidate>
        <div class="mb-3">
          <label class="form-label" for="email">Correo electrónico</label>
          <input id="email" name="email" type="email" class="form-control" autocomplete="email" [(ngModel)]="email" required />
        </div>
        <div class="mb-2">
          <label class="form-label" for="pass">Contraseña</label>
          <div class="position-relative">
            <input id="pass" name="pass" [type]="ver() ? 'text' : 'password'" class="form-control pe-5" autocomplete="current-password" [(ngModel)]="password" required />
            <button type="button" class="ver-pass" (click)="ver.set(!ver())" [attr.aria-label]="ver() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
              <i class="bi" [class.bi-eye]="!ver()" [class.bi-eye-slash]="ver()"></i>
            </button>
          </div>
        </div>
        <a routerLink="/recuperar" class="olvide">Olvidé mi contraseña</a>
        @if (error()) { <div class="alert alert-danger py-2 mt-3 mb-0" role="alert">{{ error() }}</div> }
        <button class="btn btn-orange btn-lg w-100 mt-4" [disabled]="cargando()">
          @if (cargando()) { <span class="spinner-border spinner-ofx me-2"></span> }
          Entrar como {{ rol() === 'PROFESIONAL' ? 'profesional' : 'cliente' }}
        </button>
      </form>
      <p class="mt-4 ofx-muted small">¿Sos nuevo en Ofix? <a routerLink="/registro" [queryParams]="rol() === 'PROFESIONAL' ? { rol: 'profesional' } : {}">Crear una cuenta</a></p>
    </app-auth-shell>`,
  styles: `
    .titulo { font-size: 2.1rem; margin-bottom: .35rem; }
    .roles { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; margin-bottom: 1.75rem; }
    .rol {
      text-align: left; padding: .85rem 1rem; border-radius: 1rem; border: 1.5px solid var(--ofx-line-strong);
      background: var(--ofx-raised); color: var(--ofx-ink); display: grid; gap: .2rem;
    }
    .rol strong { font-family: 'Bricolage Grotesque', sans-serif; font-size: 1.05rem; display: flex; align-items: center; gap: .4rem; }
    .rol > span { font-size: .8rem; color: var(--ofx-ink-2); line-height: 1.35; }
    .marca-rol { width: .45rem; height: .45rem; border-radius: 999px; border: 1.5px solid var(--ofx-ink-3); }
    .rol.sel { border-color: var(--ofx-blue); background: var(--ofx-blue-soft); }
    .rol.sel strong { color: var(--ofx-blue); }
    .rol.sel .marca-rol { background: var(--ofx-blue); border-color: var(--ofx-blue); }
    .ver-pass { position: absolute; right: .5rem; top: 50%; transform: translateY(-50%); border: 0; background: none; color: var(--ofx-ink-3); padding: .25rem .4rem; }
    .olvide { font-size: .88rem; font-weight: 600; text-decoration: none; }
    .olvide:hover { text-decoration: underline; }
  `,
})
export class Login implements OnInit {
  private api = inject(Api);
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  rol = signal<Rol>('CLIENTE');
  email = '';
  password = '';
  ver = signal(false);
  cargando = signal(false);
  error = signal('');
  restablecida = signal(false);

  ngOnInit() {
    this.restablecida.set(this.route.snapshot.queryParamMap.has('restablecida'));
    if (this.route.snapshot.queryParamMap.get('rol') === 'profesional') this.rol.set('PROFESIONAL');
  }

  elegir(r: Rol) {
    this.rol.set(r);
    this.error.set('');
  }

  entrar() {
    if (!this.email.trim() || !this.password) {
      this.error.set('Completá tu correo y tu contraseña.');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    this.api.login(this.email.trim(), this.password).subscribe({
      next: s => {
        this.cargando.set(false);
        if (s.usuario.rol !== this.rol()) {
          // La cuenta existe pero es del otro tipo: no se inicia la sesión hasta que lo elija.
          const es = s.usuario.rol === 'PROFESIONAL' ? 'profesional' : 'cliente';
          this.error.set(`Esta cuenta es de ${es}. Elegí «${es === 'profesional' ? 'Profesional' : 'Cliente'}» para entrar.`);
          return;
        }
        this.auth.guardar(s);
        this.router.navigateByUrl(this.auth.inicio(s.usuario));
      },
      error: e => { this.error.set(mensajeError(e)); this.cargando.set(false); },
    });
  }
}
