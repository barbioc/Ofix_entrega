"""Geocodificación de direcciones con OpenStreetMap (Nominatim).

Se usa sólo si la dirección no trae latitud/longitud (el frontend puede mandarlas
con "usar mi ubicación"). Si no hay internet o no se encuentra, la dirección se
guarda igual sin coordenadas.
"""
import logging

import requests
from django.conf import settings

log = logging.getLogger(__name__)
URL = 'https://nominatim.openstreetmap.org/search'


def _buscar(q):
    try:
        r = requests.get(URL, params={'q': q, 'format': 'json', 'limit': 1, 'countrycodes': 'ar'},
                         headers={'User-Agent': getattr(settings, 'OFIX_GEOCODER_UA', 'Ofix/1.0 (proyecto academico)')},
                         timeout=6)
        r.raise_for_status()
        data = r.json()
        if data:
            return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as exc:  # red caída, timeout, respuesta inválida
        log.warning('No se pudo geocodificar "%s": %s', q, exc)
    return None


def geocodificar(calle, numero, localidad, provincia=''):
    if not getattr(settings, 'OFIX_GEOCODIFICAR', True):
        return None
    partes = [f"{calle} {numero}".strip(), localidad, provincia, 'Argentina']
    return _buscar(', '.join(p for p in partes if p)) or _buscar(', '.join(p for p in [localidad, provincia, 'Argentina'] if p))
