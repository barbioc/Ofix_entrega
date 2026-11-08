import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Solicitud } from '../../core/models';
import { Avatar, FechaPipe } from '../../shared/ui';
import { DatosPersonales, MisDirecciones, Seguridad } from './secciones';

/** Mi perfil y Configuración del cliente. */
@Component({
  selector: 'app-cuenta',
  imports: [RouterLink, Avatar, FechaPipe, DatosPersonales, MisDirecciones, Seguridad],
  template: `
    <div class="container page page-narrow">
      @if (seccion() === 'perfil') {
        <header class="d-flex align-items-center gap-3 mb-4">
          <app-avatar [foto]="auth.usuario()?.foto_url" [nombre]="(auth.usuario()?.nombre ?? '') + ' ' + (auth.usuario()?.apellido ?? '')" [size]="88" />
          <div>
            <h1 class="h2 mb-1">{{ auth.usuario()?.nombre }} {{ auth.usuario()?.apellido }}</h1>
            <p class="ofx-muted mb-0">Cliente desde {{ auth.usuario()?.fecha_alta | fecha: false }}</p>
          </div>
        </header>
        <dl class="stats mb-4">
          <div><dt>Pedidos</dt><dd class="ofx-num">{{ total() }}</dd></div>
          <div><dt>Finalizados</dt><dd class="ofx-num">{{ finalizados() }}</dd></div>
          <div><dt>Calificaciones dadas</dt><dd class="ofx-num">{{ calificados() }}</dd></div>
        </dl>
        <section class="mb-5">
          <h2 class="h4 mb-3">Tus datos</h2>
          <app-datos-personales />
        </section>
        <p class="ofx-muted">Direcciones, contraseña y apariencia: <a routerLink="/app/config">Configuración</a>.</p>
      } @else {
        <h1 class="page-title mb-4">Configuración</h1>
        <section class="mb-5"><h2 class="h4 mb-2">Direcciones guardadas</h2><p class="ofx-muted">Las usás para elegir dónde se hace cada trabajo.</p><app-mis-direcciones /></section>
        <section class="mb-5"><h2 class="h4 mb-3">Contraseña y apariencia</h2><app-seguridad /></section>
        <section><h2 class="h4 mb-2">Datos personales</h2><p class="ofx-muted">Nombre, teléfono y foto se editan en <a routerLink="/app/perfil">Mi perfil</a>.</p></section>
      }
    </div>`,
  styles: `
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--ofx-line); border-bottom: 1px solid var(--ofx-line); }
    .stats > div { padding: 1rem 0; }
    .stats > div + div { border-left: 1px solid var(--ofx-line); padding-left: 1rem; }
    .stats dt { font-weight: 500; color: var(--ofx-ink-2); font-size: .88rem; }
    .stats dd { margin: 0; font-size: 1.5rem; }
  `,
})
export class Cuenta implements OnInit {
  auth = inject(Auth);
  private api = inject(Api);
  seccion = input<'perfil' | 'config'>('perfil');
  total = signal(0);
  finalizados = signal(0);
  calificados = signal(0);

  ngOnInit() {
    this.api.solicitudes().subscribe({
      next: (s: Solicitud[]) => {
        this.total.set(s.length);
        this.finalizados.set(s.filter(x => x.estado === 'FINALIZADA').length);
        this.calificados.set(s.filter(x => x.calificacion).length);
      },
      error: () => {},
    });
  }
}
