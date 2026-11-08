import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth.service';

export const soloInvitados: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.logueado() ? inject(Router).parseUrl(auth.inicio()) : true;
};

export const soloClientes: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!auth.logueado()) return router.parseUrl('/ingresar');
  return auth.usuario()?.rol === 'CLIENTE' ? true : router.parseUrl(auth.inicio());
};

export const soloProfesionales: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!auth.logueado()) return router.parseUrl('/ingresar');
  const u = auth.usuario();
  if (u?.rol !== 'PROFESIONAL') return router.parseUrl(auth.inicio());
  return u.perfil_completo ? true : router.parseUrl('/registro/profesional');
};

/** Pasos 4 a 6 del registro: sólo un profesional logueado con perfil incompleto. */
export const completarPerfilPro: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const u = auth.usuario();
  if (!auth.logueado() || u?.rol !== 'PROFESIONAL') return router.parseUrl('/registro');
  return u.perfil_completo ? router.parseUrl('/pro') : true;
};
