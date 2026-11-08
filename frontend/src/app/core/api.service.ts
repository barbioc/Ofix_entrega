import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  Certificacion, Conversacion, Direccion, Mensaje, Notificacion, Oferta, Oficio, ProfesionalPrivado,
  ProfesionalPublico, Resena, Sesion, Solicitud, SolicitudPro, Usuario,
} from './models';

type Params = Record<string, string | number | boolean | undefined | null>;

export interface Disponibilidad { tomando_trabajos: boolean; modo: 'AUTOMATICO' | 'MANUAL'; en_horario: boolean; }

/** Todas las llamadas al backend Django en un solo lugar. */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private params(p?: Params) {
    let hp = new HttpParams();
    for (const [k, v] of Object.entries(p ?? {})) {
      if (v !== undefined && v !== null && v !== '') hp = hp.set(k, String(v));
    }
    return hp;
  }
  get<T>(url: string, p?: Params) { return this.http.get<T>(`${this.base}/${url}`, { params: this.params(p) }); }
  post<T>(url: string, body: unknown = {}) { return this.http.post<T>(`${this.base}/${url}`, body); }
  patch<T>(url: string, body: unknown) { return this.http.patch<T>(`${this.base}/${url}`, body); }
  delete<T>(url: string) { return this.http.delete<T>(`${this.base}/${url}`); }

  // auth
  login(email: string, password: string) { return this.post<Sesion>('auth/login/', { email, password }); }
  registro(fd: FormData) { return this.post<Sesion>('auth/registro/', fd); }
  logout() { return this.post<void>('auth/logout/'); }
  emailDisponible(email: string) { return this.get<{ disponible: boolean }>('auth/email-disponible/', { email }); }
  yo() { return this.get<Usuario>('auth/yo/'); }
  actualizarYo(body: FormData | Partial<Usuario>) { return this.patch<Usuario>('auth/yo/', body); }
  cambiarPassword(actual: string, nueva: string) { return this.post<Sesion>('auth/password/', { actual, nueva }); }

  // base
  oficios() { return this.get<Oficio[]>('oficios/'); }
  direcciones() { return this.get<Direccion[]>('direcciones/'); }
  crearDireccion(d: Partial<Direccion>) { return this.post<Direccion>('direcciones/', d); }
  editarDireccion(id: number, d: Partial<Direccion>) { return this.patch<Direccion>(`direcciones/${id}/`, d); }
  borrarDireccion(id: number) { return this.delete<void>(`direcciones/${id}/`); }

  // catálogo
  profesionales(p: Params) { return this.get<ProfesionalPublico[]>('profesionales/', p); }
  profesional(id: number, direccion?: number) { return this.get<ProfesionalPublico>(`profesionales/${id}/`, { direccion }); }
  resenas(id: number) { return this.get<Resena[]>(`profesionales/${id}/resenas/`); }

  // solicitudes (cliente)
  solicitudes(estado?: 'activas' | 'historial') { return this.get<Solicitud[]>('solicitudes/', { estado }); }
  solicitud(id: number) { return this.get<Solicitud>(`solicitudes/${id}/`); }
  crearSolicitud(fd: FormData) { return this.post<Solicitud>('solicitudes/', fd); }
  enviarSolicitud(id: number, profesional: number) { return this.post<Solicitud>(`solicitudes/${id}/enviar/`, { profesional }); }
  reintentar(id: number) { return this.post<Solicitud>(`solicitudes/${id}/reintentar/`); }
  cancelarSolicitud(id: number, motivo = '') { return this.post<Solicitud>(`solicitudes/${id}/cancelar/`, { motivo }); }
  completarSolicitud(id: number) { return this.post<Solicitud>(`solicitudes/${id}/completar/`); }
  calificar(id: number, puntaje: number, comentario: string) {
    return this.post<Solicitud>(`solicitudes/${id}/calificar/`, { puntaje, comentario });
  }

  // profesional
  proYo() { return this.get<ProfesionalPrivado>('profesional/yo/'); }
  proActualizar(body: unknown) { return this.patch<ProfesionalPrivado>('profesional/yo/', body); }
  proResumen() {
    return this.get<{ perfil: ProfesionalPrivado; resenas: Resena[]; distribucion: Record<string, number>; trabajos_finalizados: number }>(
      'profesional/yo/resumen/');
  }
  disponibilidad(body: { tomando_trabajos?: boolean; automatico?: boolean }) {
    return this.post<Disponibilidad>('profesional/yo/disponibilidad/', body);
  }
  certificaciones() { return this.get<Certificacion[]>('certificaciones/'); }
  subirCertificacion(fd: FormData) { return this.post<Certificacion>('certificaciones/', fd); }
  borrarCertificacion(id: number) { return this.delete<void>(`certificaciones/${id}/`); }
  ofertas(estado = 'PENDIENTE') { return this.get<Oferta[]>('ofertas/', { estado }); }
  oferta(id: number) { return this.get<Oferta>(`ofertas/${id}/`); }
  aceptarOferta(id: number) { return this.post<Oferta>(`ofertas/${id}/aceptar/`); }
  rechazarOferta(id: number) { return this.post<Oferta>(`ofertas/${id}/rechazar/`); }
  trabajos(estado?: 'pendientes' | 'historial') { return this.get<SolicitudPro[]>('trabajos/', { estado }); }
  trabajo(id: number) { return this.get<SolicitudPro>(`trabajos/${id}/`); }
  completarTrabajo(id: number) { return this.post<SolicitudPro>(`trabajos/${id}/completar/`); }
  cancelarTrabajo(id: number, motivo = '') { return this.post<SolicitudPro>(`trabajos/${id}/cancelar/`, { motivo }); }

  // chat
  conversaciones() { return this.get<Conversacion[]>('conversaciones/'); }
  conversacion(id: number) { return this.get<Conversacion>(`conversaciones/${id}/`); }
  mensajes(id: number, desde?: number) { return this.get<Mensaje[]>(`conversaciones/${id}/mensajes/`, { desde }); }
  enviarMensaje(id: number, fd: FormData) { return this.post<Mensaje>(`conversaciones/${id}/mensajes/`, fd); }

  // notificaciones
  notificaciones() { return this.get<{ no_leidas: number; items: Notificacion[] }>('notificaciones/'); }
  leerNotificacion(id: number) { return this.post<Notificacion>(`notificaciones/${id}/leer/`); }
  leerTodas() { return this.post<void>('notificaciones/leer_todas/'); }
}

/** Convierte la respuesta de error de DRF en un texto legible. */
export function mensajeError(err: any, porDefecto = 'No pudimos completar la acción. Intentá de nuevo.'): string {
  if (!err || err.status === 0) return 'No hay conexión con el servidor de Ofix. Verificá que el backend esté corriendo.';
  const e = err.error;
  if (typeof e === 'string') return porDefecto;
  if (e?.detail) return String(e.detail);
  if (e && typeof e === 'object') {
    const primero = Object.values(e)[0];
    if (Array.isArray(primero)) return String(primero[0]);
    if (typeof primero === 'string') return primero;
  }
  return porDefecto;
}

/** Errores por campo de DRF: { campo: 'mensaje' } */
export function erroresCampo(err: any): Record<string, string> {
  const out: Record<string, string> = {};
  const e = err?.error;
  if (e && typeof e === 'object') {
    for (const [k, v] of Object.entries(e)) out[k] = Array.isArray(v) ? String(v[0]) : String(v);
  }
  return out;
}
