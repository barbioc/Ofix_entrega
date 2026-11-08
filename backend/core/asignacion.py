"""
Asignación automática de solicitudes urgentes.

Flujo:
1. Se arma la lista de profesionales disponibles para el oficio (tomando trabajos,
   con dirección base geolocalizada y dentro de su radio de cobertura).
2. Se ordenan por `calcular_score_emergencia` (cercanía + reputación bayesiana + boost nuevo).
3. El mejor recibe la oferta y tiene PRIORIDAD_MINUTOS para decidir.
   Pasado ese tiempo (o si la rechaza) la oferta se envía también al siguiente.
   Las ofertas anteriores siguen abiertas: la toma el primero que acepta.
4. Si ninguno de los primeros MAX_CANDIDATOS la toma, se avisa al cliente y la
   solicitud vuelve a "Guardada" para que pueda elegir un profesional del catálogo.

No hay un proceso programado: `procesar_pendientes()` se ejecuta desde un middleware
(como mucho cada pocos segundos) y desde el comando `manage.py procesar_asignaciones`.
"""
import math
import threading
import time
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

PRIORIDAD_MINUTOS = getattr(settings, 'OFIX_PRIORIDAD_MINUTOS', 30)
MAX_CANDIDATOS = getattr(settings, 'OFIX_MAX_CANDIDATOS', 5)

MENSAJE_SIN_RESPUESTA = (
    "Los profesionales cercanos no pudieron responder a tiempo. Puedes seleccionar "
    "manualmente a un profesional de la lista para enviarle la solicitud de forma directa."
)


# --- Algoritmo provisto por el equipo (algoritmo asignacion.py) ----------------
def calcular_score_emergencia(profesional, distancia_km, radio_max_km=15.0):
    if distancia_km > radio_max_km:
        return 0.0

    # 1. Normalización de distancia (0 a 1)
    s_dist = 1.0 - (distancia_km / radio_max_km)

    # 2. Suavizado Bayesiano para la reputación
    c_media_global = 4.0
    m_confianza = 5
    v_total_resenas = profesional.servicios_realizados
    r_promedio = profesional.puntaje_promedio or c_media_global

    rating_bayesiano = (
        (v_total_resenas * r_promedio) + (m_confianza * c_media_global)
    ) / (v_total_resenas + m_confianza)

    # Normalizar rating a escala 0 a 1
    s_rep = (rating_bayesiano - 1.0) / 4.0

    # 3. Ponderación base (60% distancia por ser urgencia, 40% reputación)
    score_base = (0.60 * s_dist) + (0.40 * s_rep)

    # 4. Boost temporal para perfiles nuevos (< 5 trabajos)
    boost = 0.0
    if v_total_resenas < 5:
        boost = 0.15 * (1.0 - (v_total_resenas / 5.0))

    return round(score_base + boost, 4)
# ------------------------------------------------------------------------------


def distancia_km(lat1, lon1, lat2, lon2):
    """Distancia haversine en km. Devuelve None si falta algún punto."""
    if None in (lat1, lon1, lat2, lon2):
        return None
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 2)


def distancia_a_profesional(profesional, direccion):
    base = profesional.direccion_base
    if not base or not direccion:
        return None
    return distancia_km(direccion.latitud, direccion.longitud, base.latitud, base.longitud)


def rankear_candidatos(solicitud, excluir_ids=()):
    """Lista [(profesional, distancia, score)] ordenada de mayor a menor score."""
    from .models import Profesional

    qs = (Profesional.objects
          .filter(experiencias__oficio=solicitud.oficio, perfil_completo=True, usuario__estado='ACTIVO')
          .exclude(estado_validacion=Profesional.EstadoValidacion.RECHAZADO)
          .exclude(pk__in=list(excluir_ids))
          .select_related('usuario__user')
          .prefetch_related('usuario__direcciones')
          .distinct())

    ranking = []
    for pro in qs:
        if not pro.tomando_trabajos:
            continue
        dist = distancia_a_profesional(pro, solicitud.direccion)
        if dist is None:
            continue
        score = calcular_score_emergencia(pro, dist, radio_max_km=float(pro.radio_cobertura_km or 15))
        if score <= 0:
            continue
        ranking.append((pro, dist, score))
    ranking.sort(key=lambda t: t[2], reverse=True)
    return ranking


def notificar(usuario, tipo, mensaje, solicitud=None, oferta=None):
    from .models import Notificacion
    return Notificacion.objects.create(usuario=usuario, tipo=tipo, mensaje=mensaje,
                                       solicitud=solicitud, oferta=oferta)


def _enviar_oferta(solicitud, pro, dist, score, posicion, urgente=True):
    from .models import OfertaTrabajo
    oferta = OfertaTrabajo.objects.create(
        solicitud=solicitud, profesional=pro, es_urgente=urgente,
        posicion=posicion, score=score, distancia_km=dist,
    )
    texto = (f"Urgencia de {solicitud.oficio.nombre.lower()}: «{solicitud.titulo}» a {dist:.1f} km. "
             f"Tenés {PRIORIDAD_MINUTOS} minutos de prioridad." if urgente and dist is not None
             else f"Nueva solicitud: «{solicitud.titulo}».")
    notificar(pro.usuario, 'OFERTA_URGENTE' if urgente else 'OFERTA', texto, solicitud, oferta)
    return oferta


def _agotar(solicitud):
    from .models import OfertaTrabajo, SolicitudServicio
    solicitud.ofertas.filter(estado=OfertaTrabajo.Estado.PENDIENTE, es_urgente=True).update(
        estado=OfertaTrabajo.Estado.EXPIRADA, fecha_respuesta=timezone.now())
    solicitud.estado = SolicitudServicio.EstadoSolicitud.CREADA
    solicitud.busqueda_agotada = True
    solicitud.save(update_fields=['estado', 'busqueda_agotada'])
    notificar(solicitud.cliente.usuario, 'SIN_RESPUESTA', MENSAJE_SIN_RESPUESTA, solicitud)


def iniciar_asignacion(solicitud):
    """Arranca la búsqueda urgente. Devuelve la primera oferta o None si no hay candidatos."""
    from .models import SolicitudServicio
    with transaction.atomic():
        solicitud.estado = SolicitudServicio.EstadoSolicitud.NOTIFICANDO
        solicitud.busqueda_agotada = False
        solicitud.save(update_fields=['estado', 'busqueda_agotada'])
        ranking = rankear_candidatos(solicitud)
        if not ranking:
            _agotar(solicitud)
            return None
        pro, dist, score = ranking[0]
        return _enviar_oferta(solicitud, pro, dist, score, posicion=1)


def avanzar(solicitud, forzar=False):
    """Envía la oferta al siguiente profesional si venció la prioridad del último
    (o si todos los que la recibieron la rechazaron). `forzar` ignora el tiempo."""
    from .models import OfertaTrabajo, SolicitudServicio
    if solicitud.estado != SolicitudServicio.EstadoSolicitud.NOTIFICANDO or not solicitud.es_urgente:
        return
    with transaction.atomic():
        s = SolicitudServicio.objects.select_for_update().get(pk=solicitud.pk)
        if s.estado != SolicitudServicio.EstadoSolicitud.NOTIFICANDO:
            return
        # Si el cliente ya eligió a alguien del catálogo, la cascada automática no interviene.
        if s.ofertas.filter(es_urgente=False, estado=OfertaTrabajo.Estado.PENDIENTE).exists():
            return
        ofertas = list(s.ofertas.filter(es_urgente=True).order_by('posicion'))
        if not ofertas:
            return
        ultima = ofertas[-1]
        hay_pendientes = any(o.estado == OfertaTrabajo.Estado.PENDIENTE for o in ofertas)
        vencio = timezone.now() >= ultima.fecha_envio + timedelta(minutes=PRIORIDAD_MINUTOS)
        # Se avanza cuando termina la prioridad del último o cuando éste la rechazó.
        if not (forzar or vencio or ultima.estado != OfertaTrabajo.Estado.PENDIENTE):
            return
        if len(ofertas) >= MAX_CANDIDATOS:
            _agotar(s)
            return
        ranking = rankear_candidatos(s, excluir_ids=[o.profesional_id for o in ofertas])
        if not ranking:
            if vencio or not hay_pendientes:
                _agotar(s)
            return
        pro, dist, score = ranking[0]
        _enviar_oferta(s, pro, dist, score, posicion=len(ofertas) + 1)


_ultimo_proceso = {'t': 0.0}
_lock = threading.Lock()


def procesar_pendientes(intervalo_seg=15):
    """Revisa todas las solicitudes urgentes en curso. Limitado a una vez cada `intervalo_seg`."""
    from .models import SolicitudServicio
    ahora = time.monotonic()
    with _lock:
        if ahora - _ultimo_proceso['t'] < intervalo_seg:
            return
        _ultimo_proceso['t'] = ahora
    for s in SolicitudServicio.objects.filter(estado='NOTIFICANDO', es_urgente=True):
        try:
            avanzar(s)
        except Exception:  # un error en una solicitud no debe frenar al resto
            import logging
            logging.getLogger(__name__).exception('Error avanzando solicitud %s', s.pk)
