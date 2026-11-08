import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Logo, ThemeToggle } from './ui';

/** Pantalla dividida de Figma: panel azul de marca a la izquierda, formulario a la derecha. */
@Component({
  selector: 'app-auth-shell',
  imports: [RouterLink, Logo, ThemeToggle],
  template: `
    <div class="shell">
      <aside class="marca" aria-hidden="true">
        <app-logo [claro]="true" />
        <div class="marca-texto">
          <p class="marca-titulo">El profesional que tu hogar necesita, <span>en tu puerta.</span></p>
          <ul>
            <li>★ Calificaciones de usuarios reales</li>
            <li>★ Identidad y certificaciones validadas</li>
            <li>★ Tus datos siempre protegidos</li>
          </ul>
        </div>
        <span class="circulo"></span>
      </aside>
      <main class="lado">
        <div class="lado-top">
          @if (volver()) { <a [routerLink]="volver()" class="btn btn-quiet btn-sm">← {{ textoVolver() }}</a> } @else { <span></span> }
          <app-theme-toggle />
        </div>
        <div class="lado-contenido" [class.ancho]="ancho()"><ng-content /></div>
      </main>
    </div>`,
  styles: `
    .shell { display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(0, 1fr); min-height: 100vh; }
    .marca {
      position: sticky; top: 0; height: 100vh; overflow: hidden; background: var(--ofx-blue); color: #fff;
      display: flex; flex-direction: column; justify-content: space-between; padding: 2rem 2.5rem 3rem;
    }
    :host-context([data-bs-theme='dark']) .marca { background: #1a3a9c; }
    .marca-texto { position: relative; z-index: 1; max-width: 30rem; }
    .marca-titulo { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: clamp(2rem, 3.2vw, 2.6rem); line-height: 1.08; letter-spacing: -.03em; margin-bottom: 1.5rem; }
    .marca-titulo span { color: var(--ofx-orange); }
    .marca ul { list-style: none; padding: 0; margin: 0; display: grid; gap: .6rem; font-size: .95rem; color: rgba(255, 255, 255, .92); }
    .circulo { position: absolute; width: 22rem; height: 22rem; border-radius: 999px; background: #e8682a; right: -7rem; bottom: -10rem; }
    .lado { display: flex; flex-direction: column; padding: 1.5rem 2rem 3rem; min-width: 0; }
    .lado-top { display: flex; justify-content: space-between; align-items: center; }
    .lado-contenido { width: 100%; max-width: 25rem; margin: auto; padding: 2rem 0; }
    .lado-contenido.ancho { max-width: 36rem; margin-top: 2rem; }
    @media (max-width: 991px) {
      .shell { grid-template-columns: 1fr; }
      .marca { display: none; }
      .lado { padding: 1rem 1rem 3rem; }
    }
  `,
})
export class AuthShell {
  volver = input<string | null>('/');
  textoVolver = input('Volver al inicio');
  /** Contenido más ancho (registro). */
  ancho = input(false);
}
