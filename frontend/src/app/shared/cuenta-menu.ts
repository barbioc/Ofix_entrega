import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../core/auth.service';
import { Avatar, ClickOutside, ThemeToggle } from './ui';

/** Burbuja con el avatar y el menú de cuenta. Es igual para clientes y profesionales. */
@Component({
  selector: 'app-cuenta-menu',
  imports: [RouterLink, Avatar, ClickOutside, ThemeToggle],
  template: `
    <app-click-outside (afuera)="abierto.set(false)" class="position-relative d-block">
      <button type="button" class="user-bubble" (click)="abierto.set(!abierto())" [attr.aria-expanded]="abierto()" aria-haspopup="menu" aria-label="Tu cuenta">
        <app-avatar [foto]="auth.usuario()?.foto_url" [nombre]="nombre()" [size]="32" />
        <span class="d-none d-sm-inline fw-semibold text-truncate nombre">{{ nombre() }}</span>
        <i class="bi bi-chevron-down small"></i>
      </button>
      @if (abierto()) {
        <div class="ofx-menu" role="menu">
          <div class="px-3 py-2">
            <strong class="d-block">{{ nombre() }}</strong>
            <span class="ofx-faint">{{ auth.usuario()?.email }}</span>
          </div>
          <div class="ofx-rule my-1"></div>
          <a class="ofx-menu-item" [routerLink]="base() + '/perfil'" (click)="abierto.set(false)" role="menuitem"><i class="bi bi-person"></i>Mi perfil</a>
          <a class="ofx-menu-item" [routerLink]="base() + '/config'" (click)="abierto.set(false)" role="menuitem"><i class="bi bi-gear"></i>Configuración</a>
          <div class="d-flex align-items-center justify-content-between px-2"><span class="ofx-muted ps-1">Tema</span><app-theme-toggle /></div>
          <div class="ofx-rule my-1"></div>
          <button class="ofx-menu-item" (click)="auth.salir()" role="menuitem"><i class="bi bi-box-arrow-right"></i>Cerrar sesión</button>
        </div>
      }
    </app-click-outside>`,
  styles: `
    .user-bubble { display: flex; align-items: center; gap: .5rem; border: 1px solid var(--ofx-line); background: var(--ofx-raised); color: var(--ofx-ink); border-radius: 999px; padding: .2rem .8rem .2rem .2rem; font-size: .92rem; }
    .user-bubble:hover { border-color: var(--ofx-line-strong); }
    .nombre { max-width: 12rem; }
  `,
})
export class CuentaMenu {
  auth = inject(Auth);
  abierto = signal(false);
  base = computed(() => (this.auth.esPro() ? '/pro' : '/app'));
  nombre = computed(() => {
    const u = this.auth.usuario();
    return u ? `${u.nombre} ${u.apellido}` : '';
  });
}
