import { Routes } from '@angular/router';
import { completarPerfilPro, soloClientes, soloInvitados, soloProfesionales } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing/landing').then(m => m.Landing), title: 'Ofix · El profesional que tu hogar necesita' },
  { path: 'ingresar', canActivate: [soloInvitados], loadComponent: () => import('./pages/auth/login').then(m => m.Login), title: 'Iniciar sesión · Ofix' },
  { path: 'recuperar', canActivate: [soloInvitados], loadComponent: () => import('./pages/auth/recuperar').then(m => m.Recuperar), title: 'Recuperar contraseña · Ofix' },
  { path: 'restablecer', loadComponent: () => import('./pages/auth/recuperar').then(m => m.Restablecer), title: 'Contraseña nueva · Ofix' },
  { path: 'registro', canActivate: [soloInvitados], loadComponent: () => import('./pages/auth/registro').then(m => m.Registro), title: 'Crear cuenta · Ofix' },
  { path: 'registro/profesional', canActivate: [completarPerfilPro], loadComponent: () => import('./pages/auth/registro').then(m => m.Registro), title: 'Tu perfil profesional · Ofix' },
  {
    path: 'app', canActivate: [soloClientes],
    loadComponent: () => import('./pages/cliente/layout').then(m => m.ClienteLayout),
    children: [
      { path: '', loadComponent: () => import('./pages/cliente/inicio').then(m => m.ClienteInicio), title: 'Inicio · Ofix' },
      { path: 'catalogo', loadComponent: () => import('./pages/cliente/catalogo').then(m => m.Catalogo), title: 'Profesionales · Ofix' },
      { path: 'catalogo/:id', loadComponent: () => import('./pages/cliente/profesional-detalle').then(m => m.ProfesionalDetalle), title: 'Perfil profesional · Ofix' },
      { path: 'pedidos', loadComponent: () => import('./pages/cliente/pedidos').then(m => m.Pedidos), title: 'Mis pedidos · Ofix' },
      { path: 'pedidos/:id', loadComponent: () => import('./pages/cliente/pedido-detalle').then(m => m.PedidoDetalle), title: 'Pedido · Ofix' },
      { path: 'chats', loadComponent: () => import('./pages/chat/chat').then(m => m.Chat), title: 'Chats · Ofix' },
      { path: 'chats/:id', loadComponent: () => import('./pages/chat/chat').then(m => m.Chat), title: 'Chat · Ofix' },
      { path: 'perfil', loadComponent: () => import('./pages/cuenta/cuenta').then(m => m.Cuenta), data: { seccion: 'perfil' }, title: 'Mi perfil · Ofix' },
      { path: 'config', loadComponent: () => import('./pages/cuenta/cuenta').then(m => m.Cuenta), data: { seccion: 'config' }, title: 'Configuración · Ofix' },
    ],
  },
  {
    path: 'pro', canActivate: [soloProfesionales],
    loadComponent: () => import('./pages/pro/layout').then(m => m.ProLayout),
    children: [
      { path: '', loadComponent: () => import('./pages/pro/inicio').then(m => m.ProInicio), title: 'Ofertas de trabajo · Ofix' },
      { path: 'trabajos/:id', loadComponent: () => import('./pages/pro/trabajo-detalle').then(m => m.TrabajoDetalle), title: 'Trabajo · Ofix' },
      { path: 'historial', loadComponent: () => import('./pages/pro/historial').then(m => m.Historial), title: 'Historial · Ofix' },
      { path: 'perfil', loadComponent: () => import('./pages/pro/perfil').then(m => m.ProPerfil), title: 'Mi perfil · Ofix' },
      { path: 'chats', loadComponent: () => import('./pages/chat/chat').then(m => m.Chat), title: 'Chats · Ofix' },
      { path: 'chats/:id', loadComponent: () => import('./pages/chat/chat').then(m => m.Chat), title: 'Chat · Ofix' },
      { path: 'config', loadComponent: () => import('./pages/pro/config').then(m => m.ProConfig), title: 'Configuración · Ofix' },
    ],
  },
  { path: '**', redirectTo: '' },
];
