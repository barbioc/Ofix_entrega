import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Auth } from '../../core/auth.service';
import { Notificaciones } from '../../core/notificaciones.service';
import { Campana } from '../../shared/campana';
import { CuentaMenu } from '../../shared/cuenta-menu';
import { Avatar, Logo } from '../../shared/ui';

/**
 * Escritorio: barra lateral con las secciones de trabajo.
 * Celular: barra inferior con las mismas secciones, al alcance del pulgar.
 * En los dos casos, arriba a la derecha van la campana y el menú de cuenta, igual que para el cliente.
 */
@Component({
  selector: 'app-pro-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar, Logo, Campana, CuentaMenu],
  template: `
    <div class="pro-shell">
      <aside class="side d-none d-lg-flex" aria-label="Secciones">
        <div class="side-logo"><app-logo link="/pro" /></div>
        <div class="me">
          <app-avatar [foto]="auth.usuario()?.foto_url" [nombre]="nombre()" [size]="40" />
          <span class="min-w-0"><strong class="d-block text-truncate">{{ nombre() }}</strong><span class="ofx-faint">Profesional</span></span>
        </div>
        <nav class="side-nav">
          <a routerLink="/pro/chats" routerLinkActive="act">
            <i class="bi bi-chat-dots"></i>Chats
            @if (chatsSinLeer()) { <span class="punto-nuevo ms-auto" aria-label="Hay mensajes sin leer"></span> }
          </a>
          <a routerLink="/pro/historial" routerLinkActive="act"><i class="bi bi-clock-history"></i>Historial de trabajos</a>
        </nav>
      </aside>

      <div class="pro-main">
        <header class="app-top">
          <div class="app-top-in px-3 px-lg-4">
            <span class="d-lg-none"><app-logo link="/pro" /></span>
            <div class="app-top-cuenta ms-auto">
              <app-campana rol="PROFESIONAL" />
              <app-cuenta-menu />
            </div>
          </div>
        </header>
        <router-outlet />
      </div>
    </div>

    <nav class="tabbar d-lg-none" aria-label="Secciones">
      <a routerLink="/pro" [class.act]="enOfertas()"><i class="bi bi-lightning-charge"></i><span>Ofertas</span></a>
      <a routerLink="/pro/historial" routerLinkActive="act"><i class="bi bi-clock-history"></i><span>Historial</span></a>
      <a routerLink="/pro/chats" routerLinkActive="act">
        <span class="tab-ico"><i class="bi bi-chat-dots"></i>@if (chatsSinLeer()) { <span class="punto-nuevo tab-punto" aria-hidden="true"></span> }</span>
        <span>Chats</span>
      </a>
    </nav>`,
  styles: `
    .pro-shell { display: grid; grid-template-columns: 17rem 1fr; min-height: 100vh; }
    .side { border-right: 1px solid var(--ofx-line); background: var(--ofx-surface); flex-direction: column; padding: 0 1rem 1.25rem; position: sticky; top: 0; height: 100vh; }
    .side-logo { height: 4.25rem; display: flex; align-items: center; padding: 0 .4rem; margin-bottom: .75rem; }
    .me { display: flex; gap: .7rem; align-items: center; padding: .7rem; border-radius: .75rem; background: var(--ofx-raised); border: 1px solid var(--ofx-line); color: var(--ofx-ink); margin-bottom: 1.25rem; }
    .side-nav { display: grid; gap: .15rem; }
    .side-nav a { display: flex; gap: .7rem; align-items: center; padding: .6rem .75rem; border-radius: .55rem; color: var(--ofx-ink-2); text-decoration: none; font-weight: 600; }
    .side-nav a:hover { background: var(--ofx-raised); color: var(--ofx-ink); }
    .side-nav a.act { background: var(--ofx-raised); color: var(--ofx-ink); box-shadow: inset 3px 0 0 var(--ofx-blue); }
    .side-nav i { font-size: 1.1rem; }
    .pro-main { min-width: 0; position: relative; }
    .min-w-0 { min-width: 0; }

    .tabbar {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; display: grid; grid-template-columns: repeat(3, 1fr);
      background: var(--ofx-bg); border-top: 1px solid var(--ofx-line); padding-bottom: env(safe-area-inset-bottom);
    }
    .tabbar a { display: flex; flex-direction: column; align-items: center; gap: .1rem; padding: .5rem 0 .55rem; color: var(--ofx-ink-2); text-decoration: none; font-size: .74rem; font-weight: 600; }
    .tabbar i { font-size: 1.3rem; line-height: 1; }
    .tabbar a.act { color: var(--ofx-blue); }
    .tab-ico { position: relative; display: block; line-height: 1; }
    .tab-punto { position: absolute; top: -.1rem; right: -.35rem; }
    @media (max-width: 991px) { .pro-shell { grid-template-columns: 1fr; } }
  `,
  host: { class: 'pro-host' },
})
export class ProLayout implements OnInit, OnDestroy {
  auth = inject(Auth);
  private notis = inject(Notificaciones);
  private router = inject(Router);

  private url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );
  /** La pestaña "Ofertas" abarca la pantalla principal y el detalle de cada trabajo. */
  enOfertas = computed(() => {
    const u = this.url().split(/[?#]/)[0];
    return u === '/pro' || u.startsWith('/pro/trabajos');
  });
  chatsSinLeer = computed(() => this.notis.items().some(n => n.tipo === 'MENSAJE' && !n.leida));

  nombre() {
    const u = this.auth.usuario();
    return u ? `${u.nombre} ${u.apellido}` : '';
  }

  ngOnInit() { this.notis.iniciar(); }
  ngOnDestroy() { this.notis.detener(); }
}
