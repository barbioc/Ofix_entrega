import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Notificaciones } from '../../core/notificaciones.service';
import { Campana } from '../../shared/campana';
import { CuentaMenu } from '../../shared/cuenta-menu';
import { Logo } from '../../shared/ui';

@Component({
  selector: 'app-cliente-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo, Campana, CuentaMenu],
  template: `
    <header class="app-top">
      <div class="container app-top-in">
        <app-logo link="/app" />
        <nav class="ms-auto d-flex align-items-center gap-1 gap-md-3" aria-label="Principal">
          <a routerLink="/app/pedidos" routerLinkActive="act" class="top-link" aria-label="Pedidos"><i class="bi bi-card-checklist d-md-none fs-5"></i><span class="d-none d-md-inline">Pedidos</span></a>
          <a routerLink="/app/chats" routerLinkActive="act" class="top-link" [attr.aria-label]="chatsSinLeer() ? 'Chats, hay mensajes sin leer' : 'Chats'">
            <i class="bi bi-chat-dots d-md-none fs-5"></i><span class="d-none d-md-inline">Chats</span>
            @if (chatsSinLeer()) { <span class="punto-nuevo" aria-hidden="true"></span> }
          </a>
        </nav>
        <span class="app-top-sep d-none d-md-block" aria-hidden="true"></span>
        <div class="app-top-cuenta">
          <app-campana rol="CLIENTE" />
          <app-cuenta-menu />
        </div>
      </div>
    </header>
    <main class="app-bg"><router-outlet /></main>`,
  styles: `
    .top-link { position: relative; color: var(--ofx-ink); text-decoration: none; font-weight: 500; font-size: .95rem; padding: .45rem .5rem; display: inline-flex; align-items: center; gap: .35rem; }
    .top-link:hover { color: var(--ofx-blue); }
    .top-link.act { color: var(--ofx-blue); font-weight: 600; }
  `,
})
export class ClienteLayout implements OnInit, OnDestroy {
  private notis = inject(Notificaciones);
  /** Punto naranja en "Chats" cuando hay un aviso de mensaje sin leer. */
  chatsSinLeer = computed(() => this.notis.items().some(n => n.tipo === 'MENSAJE' && !n.leida));

  ngOnInit() { this.notis.iniciar(); }
  ngOnDestroy() { this.notis.detener(); }
}
