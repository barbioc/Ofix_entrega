import { Component, computed, input } from '@angular/core';
import { Horario } from '../core/models';
import { DIAS } from '../core/oficios';

/** Días y horarios de atención de un profesional, con el día de hoy resaltado. */
@Component({
  selector: 'app-horarios',
  template: `
    @if (!horarios().length) {
      <p class="ofx-muted mb-0">Todavía no cargó sus horarios de atención.</p>
    } @else {
      <p class="estado" [class.abierto]="estado().abierto">
        <span class="punto" aria-hidden="true"></span>{{ estado().texto }}
      </p>
      <ul class="semana">
        @for (d of semana(); track d.dia) {
          <li [class.hoy]="d.hoy" [class.cerrado]="!d.franjas.length">
            <span class="dia">{{ d.nombre }}@if (d.hoy) { <span class="hoy-tag">Hoy</span> }</span>
            <span class="horas ofx-num">{{ d.franjas.length ? d.franjas.join(' y ') : 'No atiende' }}</span>
          </li>
        }
      </ul>
    }`,
  styles: `
    .estado { display: flex; align-items: center; gap: .5rem; font-weight: 600; margin-bottom: .75rem; color: var(--ofx-ink-2); }
    .punto { width: .55rem; height: .55rem; border-radius: 999px; background: var(--ofx-ink-3); flex: none; }
    .estado.abierto { color: var(--ofx-ok); }
    .estado.abierto .punto { background: var(--ofx-ok); box-shadow: 0 0 0 .25rem color-mix(in srgb, var(--ofx-ok) 20%, transparent); }
    .semana { list-style: none; margin: 0; padding: 0; border: 1px solid var(--ofx-line); border-radius: 1rem; overflow: hidden; background: var(--ofx-raised); }
    .semana li { display: flex; justify-content: space-between; gap: 1rem; padding: .6rem 1rem; }
    .semana li + li { border-top: 1px solid var(--ofx-line); }
    .dia { font-weight: 500; display: inline-flex; align-items: center; gap: .5rem; }
    .horas { color: var(--ofx-ink); }
    .cerrado .dia, .cerrado .horas { color: var(--ofx-ink-3); font-weight: 400; }
    .hoy { background: var(--ofx-blue-soft); }
    .hoy .dia { font-weight: 700; }
    .hoy-tag { font-size: .72rem; font-weight: 600; color: var(--ofx-blue); background: var(--ofx-raised); border-radius: 999px; padding: .05rem .5rem; }
  `,
})
export class Horarios {
  horarios = input<Horario[]>([]);

  /** Lunes = 0, como en el backend. */
  private hoy = (new Date().getDay() + 6) % 7;

  private texto(h: Horario) {
    return h.desde === '00:00' && h.hasta >= '23:59' ? 'Todo el día' : `${h.desde} a ${h.hasta}`;
  }

  semana = computed(() => DIAS.map((nombre, dia) => {
    const del = this.horarios().filter(h => h.dia === dia).sort((a, b) => a.desde.localeCompare(b.desde));
    return { dia, nombre, hoy: dia === this.hoy, franjas: del.map(h => this.texto(h)) };
  }));

  estado = computed(() => {
    const ahora = new Date();
    const hhmm = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
    const hoy = this.horarios().filter(h => h.dia === this.hoy).sort((a, b) => a.desde.localeCompare(b.desde));
    const actual = hoy.find(h => h.desde <= hhmm && hhmm < h.hasta);
    if (actual) {
      return { abierto: true, texto: actual.hasta >= '23:59' ? 'Atiende ahora, todo el día' : `Atiende ahora, hasta las ${actual.hasta}` };
    }
    const luego = hoy.find(h => h.desde > hhmm);
    if (luego) return { abierto: false, texto: `Hoy atiende desde las ${luego.desde}` };
    // próximo día con horario
    for (let i = 1; i <= 7; i++) {
      const d = (this.hoy + i) % 7;
      const f = this.horarios().filter(h => h.dia === d).sort((a, b) => a.desde.localeCompare(b.desde))[0];
      if (f) return { abierto: false, texto: `Fuera de horario. Vuelve a atender ${i === 1 ? 'mañana' : 'el ' + DIAS[d].toLowerCase()} a las ${f.desde}` };
    }
    return { abierto: false, texto: 'Fuera de horario' };
  });
}
