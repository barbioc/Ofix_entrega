import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toasts } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    <div class="ofx-toasts" aria-live="polite">
      @for (t of toasts.items(); track t.id) {
        <div class="ofx-toast" [class.error]="t.tipo === 'error'" role="status">
          <i class="bi" [class.bi-check-circle]="t.tipo === 'ok'" [class.bi-exclamation-circle]="t.tipo === 'error'"></i>
          <span class="flex-grow-1">{{ t.texto }}</span>
          <button type="button" class="btn-close btn-close-white btn-sm" aria-label="Cerrar" (click)="toasts.cerrar(t.id)"></button>
        </div>
      }
    </div>`,
})
export class App {
  toasts = inject(Toasts);
}
