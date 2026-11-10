"""Genera el diagrama de casos de uso de Ofix en A4 apaisado (PNG + PDF).

Uso:  python docs/generar_casos_de_uso.py
Las posiciones están fijadas a mano (en milímetros) para que ninguna línea se cruce.
"""
import math
import textwrap
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, FancyArrowPatch, Rectangle, Polygon

ANCHO, ALTO = 297, 210          # A4 apaisado, en mm
UC_W, UC_H = 30, 10.5            # tamaño de cada caso de uso
FUENTE = 'Arial'
TINTA = '#222222'
RELLENO = '#f4f4f4'

plt.rcParams['font.family'] = [FUENTE, 'DejaVu Sans']

fig = plt.figure(figsize=(ANCHO / 25.4, ALTO / 25.4))
ax = fig.add_axes([0, 0, 1, 1])
ax.set_xlim(0, ANCHO)
ax.set_ylim(0, ALTO)
ax.set_aspect('equal')
ax.axis('off')

casos = {}
actores = {}


# ------------------------------------------------------------------ elementos
def caso(clave, x, y, texto, ancho=UC_W):
    ax.add_patch(Ellipse((x, y), ancho, UC_H, facecolor=RELLENO, edgecolor=TINTA, lw=0.8, zorder=3))
    ax.text(x, y, '\n'.join(textwrap.wrap(texto, 19)), ha='center', va='center',
            fontsize=6.6, color=TINTA, zorder=4, linespacing=1.15)
    casos[clave] = (x, y, ancho / 2, UC_H / 2)


def actor(clave, x, y, nombre, etiqueta='abajo'):
    """Muñeco UML. (x, y) es el centro del cuerpo."""
    k = dict(color=TINTA, lw=0.9, zorder=5)
    ax.add_patch(plt.Circle((x, y + 4.6), 1.7, facecolor='white', edgecolor=TINTA, lw=0.9, zorder=5))
    ax.plot([x, x], [y + 2.9, y - 1.6], **k)            # cuerpo
    ax.plot([x - 3, x + 3], [y + 1.6, y + 1.6], **k)    # brazos
    ax.plot([x, x - 2.6], [y - 1.6, y - 5.4], **k)      # piernas
    ax.plot([x, x + 2.6], [y - 1.6, y - 5.4], **k)
    if etiqueta == 'arriba':
        ax.text(x, y + 7.4, nombre, ha='center', va='bottom', fontsize=7.6, fontweight='bold', color=TINTA)
    elif etiqueta == 'abajo':
        ax.text(x, y - 7.2, nombre, ha='center', va='top', fontsize=7.6, fontweight='bold', color=TINTA)
    else:
        ax.text(x + 4.5, y, nombre, ha='left', va='center', fontsize=7.6, fontweight='bold', color=TINTA)
    actores[clave] = (x, y)


def borde_caso(clave, hacia):
    """Punto del borde de la elipse en dirección a `hacia`."""
    x, y, a, b = casos[clave]
    dx, dy = hacia[0] - x, hacia[1] - y
    t = 1 / math.sqrt((dx / a) ** 2 + (dy / b) ** 2)
    return x + dx * t, y + dy * t


def punto(clave, hacia):
    if clave in casos:
        return borde_caso(clave, hacia)
    x, y = actores[clave]
    return x, y


def centro(clave):
    return casos[clave][:2] if clave in casos else actores[clave]


def asociacion(a, c):
    p1 = punto(a, centro(c))
    p2 = punto(c, centro(a))
    ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=TINTA, lw=0.7, zorder=2)


def dependencia(desde, hasta, tipo, lado_etiqueta=0.0):
    """Flecha punteada «include» / «extend» (va de `desde` a `hasta`)."""
    p1 = borde_caso(desde, centro(hasta))
    p2 = borde_caso(hasta, centro(desde))
    ax.add_patch(FancyArrowPatch(p1, p2, arrowstyle='-|>,head_length=2.4,head_width=1.1',
                                 mutation_scale=1, color=TINTA, lw=0.7, linestyle=(0, (3, 2)), zorder=2,
                                 shrinkA=0, shrinkB=0))
    mx, my = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
    vertical = abs(p2[0] - p1[0]) < 1
    ax.text(mx + (lado_etiqueta if vertical else 0), my + (0 if vertical else 1.4),
            f'«{tipo}»', ha='left' if vertical and lado_etiqueta > 0 else 'center', va='center',
            fontsize=5.8, color='#444444', zorder=4,
            bbox=dict(boxstyle='square,pad=0.15', facecolor='white', edgecolor='none'))


def generalizacion(hijo, padre, codo_y):
    """Hijo ─┐ sube hasta codo_y y va horizontal hasta el padre (triángulo hueco)."""
    hx, hy = actores[hijo]
    px, py = actores[padre]
    lado = -1 if hx < px else 1
    fin_x = px + lado * 4.4
    ax.plot([hx, hx, fin_x + lado * 2.6], [hy + 7, codo_y, codo_y], color=TINTA, lw=0.7, zorder=2)
    ax.add_patch(Polygon([(fin_x, codo_y), (fin_x + lado * 2.6, codo_y + 1.3), (fin_x + lado * 2.6, codo_y - 1.3)],
                         closed=True, facecolor='white', edgecolor=TINTA, lw=0.7, zorder=3))


# ------------------------------------------------------------------ marco y título
ax.text(12, 200, 'Ofix — Diagrama de Casos de Uso', fontsize=13, fontweight='bold', color=TINTA, va='center')
ax.add_patch(Rectangle((33, 24), 233, 152, facecolor='none', edgecolor=TINTA, lw=0.9, zorder=1))
ax.text(35.5, 173, 'Sistema Ofix', fontsize=7.4, fontweight='bold', color=TINTA, va='center')

# ------------------------------------------------------------------ actores
actor('usuario', 148.5, 187, 'Usuario', etiqueta='arriba')
actor('cliente', 16, 92, 'Cliente')
actor('pro', 281, 92, 'Profesional')
actor('sistema', 148.5, 11, 'Temporizador', etiqueta='derecha')
actor('admin', 281, 36, 'Administrador')
generalizacion('cliente', 'usuario', 187)
generalizacion('pro', 'usuario', 187)

# ------------------------------------------------------------------ comunes (Usuario)
FILA = 161
comunes = [('login', 52, 'Iniciar sesión'),
           ('datos', 84, 'Modificar datos de la cuenta'),
           ('dirs', 116, 'Gestionar direcciones'),
           ('chat', 148.5, 'Chatear sobre el trabajo'),
           ('notis', 181, 'Ver notificaciones'),
           ('terminar', 213, 'Marcar trabajo como terminado'),
           ('cancelar_t', 245, 'Cancelar trabajo aceptado')]
for k, x, t in comunes:
    caso(k, x, FILA, t)
    asociacion('usuario', k)
caso('recuperar', 52, 145, 'Recuperar contraseña')
caso('ubicar', 116, 145, 'Ubicar dirección en el mapa')
dependencia('recuperar', 'login', 'extend', 1.5)
dependencia('dirs', 'ubicar', 'include', 1.5)

# ------------------------------------------------------------------ Cliente
CX, CX2 = 62, 106
caso('reg_cli', CX, 128, 'Registrarse como cliente')
caso('calificar', CX, 113, 'Calificar profesional')
caso('seguir', CX, 98, 'Seguir el estado del pedido')
caso('catalogo', CX, 83, 'Ver catálogo de profesionales')
caso('elegido', CX, 68, 'Solicitar servicio a un profesional elegido')
caso('urgente', CX, 53, 'Solicitar servicio urgente')
for k in ('reg_cli', 'calificar', 'seguir', 'catalogo', 'elegido', 'urgente'):
    asociacion('cliente', k)

caso('comentario', CX2, 113, 'Agregar comentario')
caso('cancelar_p', CX2, 98, 'Cancelar pedido')
caso('perfil_pro', CX2, 83, 'Ver perfil y reseñas del profesional')
dependencia('comentario', 'calificar', 'extend')
dependencia('cancelar_p', 'seguir', 'extend')
dependencia('perfil_pro', 'catalogo', 'extend')
dependencia('elegido', 'catalogo', 'include', 1.5)
dependencia('elegido', 'urgente', 'extend', 1.5)

# ------------------------------------------------------------------ Asignación automática (centro)
SX = 148.5
caso('puntaje', SX, 72, 'Calcular puntaje de candidatos')
caso('asignar', SX, 53, 'Asignar profesional automáticamente')
caso('siguiente', SX, 36, 'Ofrecer al siguiente profesional')
dependencia('urgente', 'asignar', 'include')
dependencia('asignar', 'puntaje', 'include', 1.5)
dependencia('siguiente', 'asignar', 'extend', 1.5)
asociacion('sistema', 'siguiente')

# ------------------------------------------------------------------ Profesional
PX, PX2 = 235, 191
caso('reg_pro', PX, 128, 'Registrarse como profesional')
caso('config', PX, 113, 'Configurar perfil profesional')
caso('certif', PX, 98, 'Cargar certificaciones')
caso('dispon', PX, 83, 'Cambiar disponibilidad')
caso('ofertas', PX, 68, 'Ver ofertas recibidas')
caso('historial', PX, 53, 'Ver historial y reseñas')
for k in ('reg_pro', 'config', 'certif', 'dispon', 'ofertas', 'historial'):
    asociacion('pro', k)
dependencia('reg_pro', 'config', 'include', -9.5)

caso('oficios', PX2, 126, 'Definir oficios y experiencia')
caso('horarios', PX2, 113, 'Definir horarios de atención')
caso('radio', PX2, 100, 'Definir radio de cobertura')
for k in ('oficios', 'horarios', 'radio'):
    dependencia('config', k, 'include')

caso('aceptar', PX2, 74, 'Aceptar oferta')
caso('rechazar', PX2, 61, 'Rechazar oferta')
dependencia('aceptar', 'ofertas', 'extend')
dependencia('rechazar', 'ofertas', 'extend')
dependencia('siguiente', 'rechazar', 'extend')

# ------------------------------------------------------------------ Administrador
caso('validar', PX, 36, 'Validar profesionales y certificaciones')
asociacion('admin', 'validar')

# ------------------------------------------------------------------ notas
ax.text(35.5, 29, 'Cliente y Profesional heredan los casos de uso de Usuario.\n'
                  'Temporizador: el reloj del sistema, que avanza la búsqueda\n'
                  'al vencer el tiempo de prioridad.',
        fontsize=5.6, color='#555555', va='center', linespacing=1.3)

salida = Path(__file__).with_name('diagrama-casos-de-uso')
fig.savefig(salida.with_suffix('.png'), dpi=300)
fig.savefig(salida.with_suffix('.pdf'))
print('Listo:', salida.with_suffix('.png'), salida.with_suffix('.pdf'))
