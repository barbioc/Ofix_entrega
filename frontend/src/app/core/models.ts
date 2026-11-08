export type Rol = 'CLIENTE' | 'PROFESIONAL';
export type OficioSlug = 'gasista' | 'electricista' | 'plomero';

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  telefono: string;
  dni: string;
  ciudad: string;
  provincia: string;
  foto_url: string | null;
  rol: Rol;
  estado: string;
  fecha_alta: string;
  perfil_completo: boolean;
}

export interface Sesion { token: string; usuario: Usuario; }

export interface Direccion {
  id: number;
  alias: string;
  calle: string;
  numero: string;
  departamento: string;
  localidad: string;
  provincia: string;
  cod_postal: string;
  latitud: number | null;
  longitud: number | null;
  es_principal: boolean;
  texto: string;
}

export interface Oficio { id: number; nombre: string; slug: OficioSlug; descripcion: string; }

export interface Experiencia { id?: number; oficio: number; nombre_oficio?: string; slug?: OficioSlug; anios_experiencia: number; }

export interface Certificacion { id: number; nombre: string; estado: string; archivo_link: string | null; }

export interface Horario { dia: number; desde: string; hasta: string; }

export interface ProfesionalPublico {
  id: number;
  nombre: string;
  apellido_inicial: string;
  foto_url: string | null;
  descripcion: string;
  puntaje_promedio: number;
  servicios_realizados: number;
  cantidad_resenas: number;
  localidad_base: string;
  provincia: string;
  radio_cobertura_km: number;
  experiencias: Experiencia[];
  verificado: boolean;
  certificaciones_validadas: number;
  distancia_km: number | null;
  tomando_trabajos: boolean;
  miembro_desde: string;
  horarios: Horario[];
}

export interface ProfesionalPrivado extends ProfesionalPublico {
  estado_validacion: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  modo_disponibilidad: 'AUTOMATICO' | 'MANUAL';
  perfil_completo: boolean;
  certificaciones: Certificacion[];
}

export interface Resena { id: number; puntaje: number; comentario: string; fecha: string; cliente: string; oficio: string; titulo: string; }

export interface Adjunto { id: number; tipo: 'imagen' | 'video'; url: string; }

export interface Contacto { id: number; nombre: string; telefono: string; email: string; foto_url: string | null; }

export type EstadoSolicitud = 'CREADA' | 'NOTIFICANDO' | 'ACEPTADA' | 'EN_CURSO' | 'FINALIZADA' | 'CANCELADA';

export interface Busqueda {
  enviadas: number;
  maximo: number;
  prioridad_minutos: number;
  ultima_envio: string;
  ultima_vence: string;
  rechazadas: number;
}

export interface Solicitud {
  id: number;
  titulo: string;
  descripcion_problema: string;
  oficio: number;
  oficio_nombre: string;
  oficio_slug: OficioSlug;
  direccion: number;
  direccion_detalle: Direccion;
  estado: EstadoSolicitud;
  es_urgente: boolean;
  busqueda_agotada: boolean;
  fecha_solicitud: string;
  fecha_aceptacion: string | null;
  completado_cliente: boolean;
  completado_profesional: boolean;
  adjuntos: Adjunto[];
  calificacion: { id: number; puntaje: number; comentario: string; fecha: string } | null;
  profesional_info: ProfesionalPublico | null;
  profesional_contacto: Contacto | null;
  conversacion_id: number | null;
  busqueda: Busqueda | null;
  oferta_directa: { id: number; estado: string; fecha_envio: string; profesional: string; profesional_id: number } | null;
}

export interface SolicitudPro {
  id: number;
  titulo: string;
  descripcion_problema: string;
  oficio_nombre: string;
  oficio_slug: OficioSlug;
  estado: EstadoSolicitud;
  es_urgente: boolean;
  fecha_solicitud: string;
  fecha_aceptacion: string | null;
  adjuntos: Adjunto[];
  zona: string;
  cliente_nombre: string;
  cliente_contacto: Contacto | null;
  direccion_exacta: Direccion | null;
  distancia_km: number | null;
  completado_cliente: boolean;
  completado_profesional: boolean;
  calificacion: { puntaje: number; comentario: string } | null;
  conversacion_id: number | null;
}

export interface Oferta {
  id: number;
  estado: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'EXPIRADA' | 'TOMADA' | 'CANCELADA';
  es_urgente: boolean;
  posicion: number;
  distancia_km: number | null;
  fecha_envio: string;
  fecha_respuesta: string | null;
  vence_prioridad: string | null;
  solicitud: SolicitudPro;
}

export interface Mensaje {
  id: number;
  emisor: 'CLIENTE' | 'PROFESIONAL' | 'SISTEMA';
  texto: string;
  adjunto_url: string | null;
  tipo_adjunto: '' | 'imagen' | 'video' | 'archivo';
  fecha_envio: string;
  leido: boolean;
  propio: boolean;
}

export interface Conversacion {
  id: number;
  solicitud_id: number;
  titulo: string;
  oficio_slug: OficioSlug;
  oficio_nombre: string;
  estado_solicitud: EstadoSolicitud;
  activa: boolean;
  fecha_apertura: string;
  contraparte: { nombre: string; foto_url: string | null; telefono: string };
  ultimo_mensaje: { texto: string; fecha_envio: string; emisor: string } | null;
  no_leidos: number;
}

export interface Notificacion {
  id: number;
  tipo: string;
  mensaje: string;
  fecha_envio: string;
  leida: boolean;
  solicitud: number | null;
  oferta: number | null;
}
