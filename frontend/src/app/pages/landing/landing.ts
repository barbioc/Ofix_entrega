import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth.service';
import { Avatar, Logo, OficioBadge, ThemeToggle } from '../../shared/ui';

/** Mismo cálculo que el backend (core/asignacion.py), para la demo del hero. */
function score(dist: number, radio: number, trabajos: number, promedio: number) {
  if (dist > radio) return 0;
  const sDist = 1 - dist / radio;
  const r = promedio || 4;
  const bayes = (trabajos * r + 5 * 4) / (trabajos + 5);
  const sRep = (bayes - 1) / 4;
  const boost = trabajos < 5 ? 0.15 * (1 - trabajos / 5) : 0;
  return Math.round((0.6 * sDist + 0.4 * sRep + boost) * 1000) / 1000;
}

interface Candidato { nombre: string; dist: number; radio: number; trabajos: number; promedio: number; score: number; }

const CANDIDATOS: Candidato[] = [
  { nombre: 'Carlos M.', dist: 4.5, radio: 15, trabajos: 80, promedio: 4.9 },
  { nombre: 'Julieta P.', dist: 0.9, radio: 10, trabajos: 12, promedio: 3.9 },
  { nombre: 'Martín R.', dist: 1.8, radio: 20, trabajos: 37, promedio: 4.8 },
  { nombre: 'Hernán T.', dist: 7.0, radio: 25, trabajos: 25, promedio: 4.7 },
  { nombre: 'Sofía A.', dist: 1.2, radio: 12, trabajos: 2, promedio: 5 },
].map(c => ({ ...c, score: score(c.dist, c.radio, c.trabajos, c.promedio) }));

@Component({
  selector: 'app-landing',
  imports: [RouterLink, Logo, ThemeToggle, Avatar, OficioBadge],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements OnInit, OnDestroy {
  auth = inject(Auth);
  foto = 'https://images.unsplash.com/photo-1787166025559-fa9627be160b?w=1000&h=1200&fit=crop&auto=format';
  candidatos = CANDIDATOS;
  maxScore = Math.max(...CANDIDATOS.map(c => c.score));

  /** 0: ticket, 1: lista, 2: puntajes, 3: ordenado, 4: oferta enviada */
  fase = signal(0);
  segundos = signal(30 * 60);
  orden = computed(() => {
    const lista = this.candidatos.map((c, i) => ({ c, i }));
    if (this.fase() >= 3) lista.sort((a, b) => b.c.score - a.c.score);
    const pos = new Array(lista.length);
    lista.forEach((x, idx) => (pos[x.i] = idx));
    return pos as number[];
  });
  ganador = computed(() => this.candidatos.reduce((a, b) => (b.score > a.score ? b : a)));
  reloj = computed(() => {
    const s = this.segundos();
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  private timers: ReturnType<typeof setTimeout>[] = [];
  private tick?: ReturnType<typeof setInterval>;

  ngOnInit() {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducido) {
      this.fase.set(4);
      return;
    }
    [[1, 700], [2, 1500], [3, 3100], [4, 4200]].forEach(([f, ms]) =>
      this.timers.push(setTimeout(() => this.fase.set(f), ms)));
    this.timers.push(setTimeout(() => {
      this.tick = setInterval(() => this.segundos.update(s => Math.max(0, s - 1)), 1000);
    }, 4200));
  }

  repetir() {
    this.ngOnDestroy();
    this.fase.set(0);
    this.segundos.set(30 * 60);
    this.ngOnInit();
  }

  ngOnDestroy() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    clearInterval(this.tick);
  }
}
