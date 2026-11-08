import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { Api } from './api.service';
import { Sesion, Usuario } from './models';

const KEY = 'ofix-sesion';

@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  private router = inject(Router);

  private _token = signal<string | null>(null);
  readonly usuario = signal<Usuario | null>(null);
  readonly logueado = computed(() => !!this._token());
  readonly esPro = computed(() => this.usuario()?.rol === 'PROFESIONAL');

  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null') as Sesion | null;
      if (s?.token) {
        this._token.set(s.token);
        this.usuario.set(s.usuario);
      }
    } catch {
      /* almacenamiento no disponible */
    }
  }

  get token() { return this._token(); }

  guardar(s: Sesion) {
    this._token.set(s.token);
    this.usuario.set(s.usuario);
    this.persistir();
  }

  setUsuario(u: Usuario) {
    this.usuario.set(u);
    this.persistir();
  }

  private persistir() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ token: this._token(), usuario: this.usuario() }));
    } catch {
      /* sin almacenamiento: la sesión dura lo que la pestaña */
    }
  }

  login(email: string, password: string) {
    return this.api.login(email, password).pipe(tap(s => this.guardar(s)));
  }

  refrescar() { return this.api.yo().pipe(tap(u => this.setUsuario(u))); }

  /** Ruta de inicio según el rol (y si el profesional terminó su registro). */
  inicio(u = this.usuario()): string {
    if (!u) return '/';
    if (u.rol === 'PROFESIONAL') return u.perfil_completo ? '/pro' : '/registro/profesional';
    return '/app';
  }

  salir(llamarApi = true) {
    if (llamarApi && this._token()) this.api.logout().subscribe({ error: () => {} });
    this._token.set(null);
    this.usuario.set(null);
    try { localStorage.removeItem(KEY); } catch { /* nada */ }
    this.router.navigateByUrl('/');
  }
}
