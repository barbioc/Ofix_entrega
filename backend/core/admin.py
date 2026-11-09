from django.contrib import admin
from .models import (
    Usuario, Cliente, Direccion, Oficio, Profesional,
    ExperienciaOficio, Certificacion, SolicitudServicio,
    Calificacion, Conversacion, Mensaje, Notificacion
)

@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'telefono', 'estado', 'fecha_alta')
    search_fields = ('user__first_name', 'user__last_name', 'user__email', 'telefono')

@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'calificaciones_emitidas')

@admin.register(Direccion)
class DireccionAdmin(admin.ModelAdmin):
    list_display = ('calle', 'numero', 'localidad', 'cod_postal', 'cliente', 'es_principal')
    list_filter = ('localidad', 'es_principal')

@admin.register(Oficio)
class OficioAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre')

@admin.register(Profesional)
class ProfesionalAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'estado_validacion', 'localidad_base', 'radio_cobertura_km', 'puntaje_promedio', 'servicios_realizados')
    list_filter = ('estado_validacion', 'localidad_base')

@admin.register(ExperienciaOficio)
class ExperienciaOficioAdmin(admin.ModelAdmin):
    list_display = ('profesional', 'oficio', 'anios_experiencia')

@admin.register(Certificacion)
class CertificacionAdmin(admin.ModelAdmin):
    list_display = ('profesional', 'entidad_emisora', 'fecha_emision', 'estado')
    list_filter = ('estado',)

@admin.register(SolicitudServicio)
class SolicitudServicioAdmin(admin.ModelAdmin):
    list_display = ('id', 'cliente', 'profesional', 'oficio', 'estado', 'es_urgente', 'fecha_solicitud')
    list_filter = ('estado', 'es_urgente', 'oficio')

@admin.register(Calificacion)
class CalificacionAdmin(admin.ModelAdmin):
    list_display = ('solicitud', 'puntaje', 'fecha')

@admin.register(Conversacion)
class ConversacionAdmin(admin.ModelAdmin):
    list_display = ('id', 'solicitud', 'fecha_apertura', 'activa')

@admin.register(Mensaje)
class MensajeAdmin(admin.ModelAdmin):
    list_display = ('conversacion', 'emisor', 'fecha_envio', 'leido')
    list_filter = ('emisor', 'leido')

@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'tipo', 'fecha_envio', 'leida')
    list_filter = ('leida', 'tipo')

from .models import OfertaTrabajo


@admin.register(OfertaTrabajo)
class OfertaTrabajoAdmin(admin.ModelAdmin):
    list_display = ('id', 'solicitud', 'profesional', 'estado', 'es_urgente', 'posicion', 'score', 'distancia_km', 'fecha_envio')
    list_filter = ('estado', 'es_urgente')

