import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Notificacion } from '../core/models';
import { Notificaciones } from '../core/notificaciones.service';
import { ClickOutside, HacePipe } from './ui';

const ICONOS: Record<string, string> = {
  OFERTA_URGENTE: 'bi-lightning-charge-fill text-danger',
  OFERTA: 'bi-inbox',
  ACEPTADA: 'bi-check-circle-fill text-success',
  RECHAZADA: 'bi-x-circle',
  SIN_RESPUESTA: 'bi-hourglass-bottom text-danger',
  MENSAJE: 'bi-chat-dots',
  CALIFICACION: 'bi-star-fill',
  FINALIZADA: 'bi-flag',
  COMPLETAR: 'bi-clipboard-check',
  CANCELACION: 'bi-slash-circle',
};

/** Campana de notificaciones con menú desplegable. */
@Component({
  selector: 'app-campana',
  imports: [ClickOutside, HacePipe],
  template: `
    <app-click-outside (afuera)="abierto.set(false)" class="position-relative d-inline-block">
      <button type="button" class="btn-icon btn-icon-ring" (click)="abierto.set(!abierto())" [attr.aria-expanded]="abierto()"
              [attr.aria-label]="'Notificaciones' + (notis.noLeidas() ? ', ' + notis.noLeidas() + ' sin leer' : '')">
        <i class="bi bi-bell fs-5"></i>
        @if (notis.noLeidas()) { <span class="dot-badge">{{ notis.noLeidas() > 9 ? '9+' : notis.noLeidas() }}</span> }
      </button>
      @if (abierto()) {
        <div class="ofx-menu campana-menu" role="menu">
          <div class="d-flex align-items-center justify-content-between px-2 pt-1 pb-2">
            <strong>Notificaciones</strong>
            @if (notis.noLeidas()) { <button class="btn-link-plain small" (click)="notis.leerTodas()">Marcar todas como leídas</button> }
          </div>
          @for (n of notis.items(); track n.id) {
            <button type="button" class="ofx-menu-item noti" [class.no-leida]="!n.leida" (click)="abrir(n)" role="menuitem">
              <i class="bi" [class]="icono(n.tipo)"></i>
              <span class="flex-grow-1">
                <span class="d-block">{{ n.mensaje }}</span>
                <span class="ofx-faint">{{ n.fecha_envio | hace }}</span>
              </span>
            </button>
          } @empty {
            <p class="ofx-faint px-2 py-3 mb-0">Cuando recibas {{ rol() === 'PROFESIONAL' ? 'ofertas de trabajo' : 'respuestas de profesionales' }} van a aparecer acá.</p>
          }
        </div>
      }
    </app-click-outside>`,
  styles: `
    .campana-menu { width: min(24rem, calc(100vw - 2rem)); max-height: 70vh; overflow-y: auto; }
    .noti { align-items: flex-start; font-size: .92rem; }
    .noti > i { margin-top: .2rem; }
    .no-leida { background: var(--ofx-blue-soft); }
    .no-leida:hover { background: var(--ofx-blue-soft); filter: brightness(.98); }
  `,
})
export class Campana {
  notis = inject(Notificaciones);
  private router = inject(Router);
  rol = input<'CLIENTE' | 'PROFESIONAL'>('CLIENTE');
  abierto = signal(false);

  icono(t: string) { return ICONOS[t] ?? 'bi-bell'; }

  abrir(n: Notificacion) {
    this.notis.leer(n);
    this.abierto.set(false);
    if (this.rol() === 'PROFESIONAL') {
      if (n.oferta && n.tipo.startsWith('OFERTA')) this.router.navigate(['/pro'], { queryParams: { oferta: n.oferta } });
      else if (n.solicitud) this.router.navigate(['/pro/trabajos', n.solicitud]);
      else this.router.navigate(['/pro']);
    } else if (n.solicitud) {
      this.router.navigate(['/app/pedidos', n.solicitud]);
    }
  }
}
