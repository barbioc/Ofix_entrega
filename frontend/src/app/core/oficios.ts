import { OficioSlug } from './models';

/** Identidad de cada oficio: el mismo ícono y color en toda la app (ver logo). */
export const OFICIOS: Record<OficioSlug, { nombre: string; icono: string; problema: string }> = {
  gasista: { nombre: 'Gasista', icono: 'bi-fire', problema: 'Olor a gas, calefón, estufa o cocina' },
  electricista: { nombre: 'Electricista', icono: 'bi-lightning-charge-fill', problema: 'Cortes, enchufes, tablero o cableado' },
  plomero: { nombre: 'Plomero', icono: 'bi-droplet-fill', problema: 'Pérdidas, cañerías, desagües o tanque' },
};

export const ORDEN_OFICIOS: OficioSlug[] = ['gasista', 'electricista', 'plomero'];

export const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa',
  'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const ESTADOS_CLIENTE: Record<string, string> = {
  CREADA: 'Guardada',
  NOTIFICANDO: 'Esperando respuesta',
  ACEPTADA: 'Aceptada',
  EN_CURSO: 'En curso',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};
