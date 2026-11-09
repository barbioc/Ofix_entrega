from datetime import timedelta

from django.core.files.storage import default_storage
from django.db.models import Count, Q
from rest_framework import serializers

from . import asignacion
from .geo import geocodificar
from .models import (
    Usuario, Direccion, Oficio, Profesional, ExperienciaOficio, Certificacion,
    SolicitudServicio, OfertaTrabajo, Calificacion,
    Conversacion, Mensaje, Notificacion,
)


def nombre_corto(usuario):
    """'Laura G.' — para mostrar a otros usuarios sin exponer el apellido completo."""
    ape = usuario.user.last_name
    return f"{usuario.user.first_name} {ape[:1]}.".strip() if ape else usuario.user.first_name


class FotoMixin:
    def _url(self, f):
        if not f:
            return None
        req = self.context.get('request')
        return req.build_absolute_uri(f.url) if req else f.url


# ---------------------------------------------------------------- usuario
class UsuarioSerializer(FotoMixin, serializers.ModelSerializer):
    email = serializers.ReadOnlyField(source='user.email')
    nombre = serializers.CharField(source='user.first_name', required=False)
    apellido = serializers.CharField(source='user.last_name', required=False)
    rol = serializers.ReadOnlyField()
    foto_url = serializers.SerializerMethodField()
    perfil_completo = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ['id', 'email', 'nombre', 'apellido', 'telefono', 'dni', 'ciudad', 'provincia',
                  'foto', 'foto_url', 'rol', 'estado', 'fecha_alta', 'perfil_completo']
        read_only_fields = ['id', 'estado', 'fecha_alta']
        extra_kwargs = {'foto': {'write_only': True, 'required': False}}

    def get_foto_url(self, obj):
        return self._url(obj.foto)

    def get_perfil_completo(self, obj):
        return obj.profesional.perfil_completo if hasattr(obj, 'profesional') else True

    def update(self, instance, validated):
        user_data = validated.pop('user', {})
        for k, v in user_data.items():
            setattr(instance.user, k, v)
        instance.user.save()
        return super().update(instance, validated)


# ---------------------------------------------------------------- direcciones
class DireccionSerializer(serializers.ModelSerializer):
    texto = serializers.SerializerMethodField()

    class Meta:
        model = Direccion
        fields = ['id', 'alias', 'calle', 'numero', 'departamento', 'localidad', 'provincia',
                  'cod_postal', 'latitud', 'longitud', 'es_principal', 'texto']

    def get_texto(self, obj):
        return str(obj)

    def _geo(self, data, instance=None):
        cambia = any(k in data for k in ('calle', 'numero', 'localidad', 'provincia'))
        if data.get('latitud') is not None and data.get('longitud') is not None:
            return data
        if instance is None or cambia:
            g = lambda k: data.get(k, getattr(instance, k, '') if instance else '')
            punto = geocodificar(g('calle'), g('numero'), g('localidad'), g('provincia'))
            if punto:
                data['latitud'], data['longitud'] = punto
        return data

    def create(self, validated):
        return super().create(self._geo(validated))

    def update(self, instance, validated):
        return super().update(instance, self._geo(validated, instance))


# ---------------------------------------------------------------- oficios / profesionales
class OficioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Oficio
        fields = ['id', 'nombre', 'slug', 'descripcion']


class ExperienciaOficioSerializer(serializers.ModelSerializer):
    nombre_oficio = serializers.ReadOnlyField(source='oficio.nombre')
    slug = serializers.ReadOnlyField(source='oficio.slug')

    class Meta:
        model = ExperienciaOficio
        fields = ['id', 'oficio', 'nombre_oficio', 'slug', 'anios_experiencia']


class CertificacionSerializer(FotoMixin, serializers.ModelSerializer):
    archivo_link = serializers.SerializerMethodField()

    class Meta:
        model = Certificacion
        fields = ['id', 'nombre', 'entidad_emisora', 'fecha_emision', 'estado', 'archivo', 'archivo_link']
        read_only_fields = ['estado']
        extra_kwargs = {'archivo': {'write_only': True}}

    def get_archivo_link(self, obj):
        return self._url(obj.archivo) or obj.archivo_url or None


class ProfesionalPublicoSerializer(FotoMixin, serializers.ModelSerializer):
    """Lo que ve un cliente en el catálogo: sin email, teléfono, DNI ni dirección."""
    id = serializers.ReadOnlyField(source='usuario_id')
    nombre = serializers.ReadOnlyField(source='usuario.user.first_name')
    apellido_inicial = serializers.SerializerMethodField()
    foto_url = serializers.SerializerMethodField()
    experiencias = ExperienciaOficioSerializer(many=True, read_only=True)
    verificado = serializers.SerializerMethodField()
    cantidad_resenas = serializers.SerializerMethodField()
    certificaciones_validadas = serializers.SerializerMethodField()
    provincia = serializers.ReadOnlyField(source='usuario.provincia')
    distancia_km = serializers.SerializerMethodField()
    tomando_trabajos = serializers.ReadOnlyField()
    miembro_desde = serializers.ReadOnlyField(source='usuario.fecha_alta')

    class Meta:
        model = Profesional
        fields = ['id', 'nombre', 'apellido_inicial', 'foto_url', 'descripcion', 'puntaje_promedio',
                  'servicios_realizados', 'cantidad_resenas', 'localidad_base', 'provincia',
                  'radio_cobertura_km', 'experiencias', 'verificado', 'certificaciones_validadas',
                  'distancia_km', 'tomando_trabajos', 'miembro_desde', 'horarios']
        read_only_fields = ['horarios']

    def get_apellido_inicial(self, obj):
        a = obj.usuario.user.last_name
        return f"{a[:1]}." if a else ''

    def get_foto_url(self, obj):
        return self._url(obj.usuario.foto)

    def get_verificado(self, obj):
        return obj.estado_validacion == Profesional.EstadoValidacion.APROBADO

    def get_cantidad_resenas(self, obj):
        return Calificacion.objects.filter(solicitud__profesional=obj).count()

    def get_certificaciones_validadas(self, obj):
        return obj.certificaciones.filter(estado='VALIDADO').count()

    def get_distancia_km(self, obj):
        dirc = self.context.get('direccion')
        return asignacion.distancia_a_profesional(obj, dirc) if dirc else None


class ProfesionalPrivadoSerializer(ProfesionalPublicoSerializer):
    """Perfil propio del profesional (configuración)."""
    certificaciones = CertificacionSerializer(many=True, read_only=True)
    modo_disponibilidad = serializers.ReadOnlyField()

    class Meta(ProfesionalPublicoSerializer.Meta):
        fields = ProfesionalPublicoSerializer.Meta.fields + [
            'estado_validacion', 'modo_disponibilidad', 'perfil_completo', 'certificaciones',
        ]
        read_only_fields = ['estado_validacion', 'puntaje_promedio', 'servicios_realizados']

    def validate_horarios(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Formato de horarios inválido.')
        limpio = []
        for f in value:
            try:
                dia = int(f['dia'])
                desde, hasta = str(f['desde'])[:5], str(f['hasta'])[:5]
            except (KeyError, TypeError, ValueError):
                raise serializers.ValidationError('Cada franja necesita día, desde y hasta.')
            if not 0 <= dia <= 6 or desde >= hasta:
                raise serializers.ValidationError('Revisá los horarios: la hora de fin debe ser posterior a la de inicio.')
            limpio.append({'dia': dia, 'desde': desde, 'hasta': hasta})
        return limpio


class ResenaSerializer(serializers.ModelSerializer):
    cliente = serializers.SerializerMethodField()
    oficio = serializers.ReadOnlyField(source='solicitud.oficio.nombre')
    titulo = serializers.ReadOnlyField(source='solicitud.titulo')

    class Meta:
        model = Calificacion
        fields = ['id', 'puntaje', 'comentario', 'fecha', 'cliente', 'oficio', 'titulo']

    def get_cliente(self, obj):
        return nombre_corto(obj.solicitud.cliente.usuario)


# ---------------------------------------------------------------- solicitudes
def adjuntos_de(solicitud, request):
    """Convierte la lista guardada en la solicitud en [{id, tipo, url}] para el frontend."""
    out = []
    for i, a in enumerate(solicitud.adjuntos or []):
        url = default_storage.url(a['archivo'])
        out.append({'id': i, 'tipo': a.get('tipo', 'imagen'),
                    'url': request.build_absolute_uri(url) if request else url})
    return out


class CalificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Calificacion
        fields = ['id', 'puntaje', 'comentario', 'fecha']


class ContactoSerializer(FotoMixin, serializers.Serializer):
    """Datos de contacto: sólo se envían cuando la solicitud fue aceptada."""
    id = serializers.IntegerField()
    nombre = serializers.SerializerMethodField()
    telefono = serializers.CharField()
    email = serializers.CharField(source='user.email')
    foto_url = serializers.SerializerMethodField()

    def get_nombre(self, obj):
        return obj.nombre_completo

    def get_foto_url(self, obj):
        return self._url(obj.foto)


def resumen_busqueda(s):
    ofertas = list(s.ofertas.filter(es_urgente=True).order_by('posicion'))
    if not s.es_urgente or not ofertas:
        return None
    ultima = ofertas[-1]
    return {
        'enviadas': len(ofertas),
        'maximo': asignacion.MAX_CANDIDATOS,
        'prioridad_minutos': asignacion.PRIORIDAD_MINUTOS,
        'ultima_envio': ultima.fecha_envio,
        'ultima_vence': ultima.fecha_envio + timedelta(minutes=asignacion.PRIORIDAD_MINUTOS),
        'rechazadas': sum(1 for o in ofertas if o.estado == 'RECHAZADA'),
    }


class SolicitudSerializer(FotoMixin, serializers.ModelSerializer):
    oficio_nombre = serializers.ReadOnlyField(source='oficio.nombre')
    oficio_slug = serializers.ReadOnlyField(source='oficio.slug')
    direccion_detalle = DireccionSerializer(source='direccion', read_only=True)
    adjuntos = serializers.SerializerMethodField()
    calificacion = CalificacionSerializer(read_only=True)
    profesional_info = serializers.SerializerMethodField()
    profesional_contacto = serializers.SerializerMethodField()
    conversacion_id = serializers.SerializerMethodField()
    busqueda = serializers.SerializerMethodField()
    oferta_directa = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudServicio
        fields = ['id', 'titulo', 'descripcion_problema', 'oficio', 'oficio_nombre', 'oficio_slug',
                  'direccion', 'direccion_detalle', 'estado', 'es_urgente', 'busqueda_agotada',
                  'fecha_solicitud', 'fecha_aceptacion', 'completado_cliente', 'completado_profesional',
                  'adjuntos', 'calificacion', 'profesional_info', 'profesional_contacto',
                  'conversacion_id', 'busqueda', 'oferta_directa']
        read_only_fields = ['estado', 'busqueda_agotada', 'fecha_solicitud', 'fecha_aceptacion',
                            'completado_cliente', 'completado_profesional']

    def validate(self, attrs):
        req = self.context['request']
        dirc = attrs.get('direccion')
        if dirc and dirc.usuario_id != req.user.perfil_usuario.id:
            raise serializers.ValidationError({'direccion': 'Elegí una de tus direcciones guardadas.'})
        if not (attrs.get('titulo') or '').strip() and not self.instance:
            raise serializers.ValidationError({'titulo': 'Escribí un título breve.'})
        return attrs

    def get_adjuntos(self, obj):
        return adjuntos_de(obj, self.context.get('request'))

    def get_profesional_info(self, obj):
        if not obj.profesional:
            return None
        return ProfesionalPublicoSerializer(obj.profesional, context={**self.context, 'direccion': obj.direccion}).data

    def get_profesional_contacto(self, obj):
        if obj.profesional and obj.estado in ('ACEPTADA', 'EN_CURSO', 'FINALIZADA'):
            return ContactoSerializer(obj.profesional.usuario, context=self.context).data
        return None

    def get_conversacion_id(self, obj):
        c = getattr(obj, 'conversacion', None)
        return c.id if c else None

    def get_busqueda(self, obj):
        return resumen_busqueda(obj)

    def get_oferta_directa(self, obj):
        o = obj.ofertas.filter(es_urgente=False).order_by('-fecha_envio').first()
        if not o:
            return None
        return {'id': o.id, 'estado': o.estado, 'fecha_envio': o.fecha_envio,
                'profesional': nombre_corto(o.profesional.usuario), 'profesional_id': o.profesional_id}


class SolicitudParaProfesionalSerializer(FotoMixin, serializers.ModelSerializer):
    """Vista del profesional. La dirección exacta y el contacto sólo si la aceptó."""
    oficio_nombre = serializers.ReadOnlyField(source='oficio.nombre')
    oficio_slug = serializers.ReadOnlyField(source='oficio.slug')
    adjuntos = serializers.SerializerMethodField()
    zona = serializers.SerializerMethodField()
    cliente_nombre = serializers.SerializerMethodField()
    cliente_contacto = serializers.SerializerMethodField()
    direccion_exacta = serializers.SerializerMethodField()
    distancia_km = serializers.SerializerMethodField()
    calificacion = CalificacionSerializer(read_only=True)
    conversacion_id = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudServicio
        fields = ['id', 'titulo', 'descripcion_problema', 'oficio_nombre', 'oficio_slug', 'estado',
                  'es_urgente', 'fecha_solicitud', 'fecha_aceptacion', 'adjuntos', 'zona',
                  'cliente_nombre', 'cliente_contacto', 'direccion_exacta', 'distancia_km',
                  'completado_cliente', 'completado_profesional', 'calificacion', 'conversacion_id']

    def get_adjuntos(self, obj):
        return adjuntos_de(obj, self.context.get('request'))

    def _es_mio(self, obj):
        pro = self.context.get('profesional')
        return pro is not None and obj.profesional_id == pro.pk

    def get_zona(self, obj):
        d = obj.direccion
        return ', '.join(x for x in [d.localidad, d.provincia] if x)

    def get_cliente_nombre(self, obj):
        u = obj.cliente.usuario
        return u.nombre_completo if self._es_mio(obj) else nombre_corto(u)

    def get_cliente_contacto(self, obj):
        return ContactoSerializer(obj.cliente.usuario, context=self.context).data if self._es_mio(obj) else None

    def get_direccion_exacta(self, obj):
        return DireccionSerializer(obj.direccion).data if self._es_mio(obj) else None

    def get_distancia_km(self, obj):
        pro = self.context.get('profesional')
        return asignacion.distancia_a_profesional(pro, obj.direccion) if pro else None

    def get_conversacion_id(self, obj):
        c = getattr(obj, 'conversacion', None)
        return c.id if c and self._es_mio(obj) else None


class OfertaSerializer(serializers.ModelSerializer):
    solicitud = serializers.SerializerMethodField()
    vence_prioridad = serializers.SerializerMethodField()

    class Meta:
        model = OfertaTrabajo
        fields = ['id', 'estado', 'es_urgente', 'posicion', 'distancia_km', 'fecha_envio',
                  'fecha_respuesta', 'vence_prioridad', 'solicitud']

    def get_vence_prioridad(self, obj):
        if not obj.es_urgente:
            return None
        return obj.fecha_envio + timedelta(minutes=asignacion.PRIORIDAD_MINUTOS)

    def get_solicitud(self, obj):
        return SolicitudParaProfesionalSerializer(obj.solicitud, context=self.context).data


# ---------------------------------------------------------------- chat
class MensajeSerializer(FotoMixin, serializers.ModelSerializer):
    adjunto_url = serializers.SerializerMethodField()
    propio = serializers.SerializerMethodField()

    class Meta:
        model = Mensaje
        fields = ['id', 'emisor', 'texto', 'adjunto_url', 'tipo_adjunto', 'fecha_envio', 'leido', 'propio']

    def get_adjunto_url(self, obj):
        return self._url(obj.adjunto)

    def get_propio(self, obj):
        return obj.emisor == self.context.get('rol')


class ConversacionSerializer(FotoMixin, serializers.ModelSerializer):
    solicitud_id = serializers.ReadOnlyField(source='solicitud.id')
    titulo = serializers.ReadOnlyField(source='solicitud.titulo')
    oficio_slug = serializers.ReadOnlyField(source='solicitud.oficio.slug')
    oficio_nombre = serializers.ReadOnlyField(source='solicitud.oficio.nombre')
    estado_solicitud = serializers.ReadOnlyField(source='solicitud.estado')
    contraparte = serializers.SerializerMethodField()
    ultimo_mensaje = serializers.SerializerMethodField()
    no_leidos = serializers.SerializerMethodField()

    class Meta:
        model = Conversacion
        fields = ['id', 'solicitud_id', 'titulo', 'oficio_slug', 'oficio_nombre', 'estado_solicitud',
                  'activa', 'fecha_apertura', 'contraparte', 'ultimo_mensaje', 'no_leidos']

    def get_contraparte(self, obj):
        rol = self.context.get('rol')
        s = obj.solicitud
        u = s.profesional.usuario if rol == 'CLIENTE' and s.profesional else s.cliente.usuario
        return {'nombre': u.nombre_completo, 'foto_url': self._url(u.foto), 'telefono': u.telefono}

    def get_ultimo_mensaje(self, obj):
        m = obj.mensajes.order_by('-fecha_envio').first()
        if not m:
            return None
        return {'texto': m.texto or ('Foto' if m.tipo_adjunto == 'imagen' else 'Video' if m.tipo_adjunto == 'video' else 'Archivo'),
                'fecha_envio': m.fecha_envio, 'emisor': m.emisor}

    def get_no_leidos(self, obj):
        rol = self.context.get('rol')
        return obj.mensajes.filter(leido=False).exclude(emisor=rol).exclude(emisor='SISTEMA').count()


class NotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacion
        fields = ['id', 'tipo', 'mensaje', 'fecha_envio', 'leida', 'solicitud', 'oferta']
