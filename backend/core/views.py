import json

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets, mixins
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response

from . import asignacion
from .asignacion import notificar
from .models import (
    Usuario, Cliente, Direccion, Oficio, Profesional, ExperienciaOficio, Certificacion,
    SolicitudServicio, OfertaTrabajo, Calificacion, Conversacion,
    Mensaje, Notificacion,
)
from .serializers import (
    UsuarioSerializer, DireccionSerializer, OficioSerializer, ProfesionalPublicoSerializer,
    ProfesionalPrivadoSerializer, CertificacionSerializer, ResenaSerializer, SolicitudSerializer,
    SolicitudParaProfesionalSerializer, OfertaSerializer, MensajeSerializer, ConversacionSerializer,
    NotificacionSerializer, CalificacionSerializer,
)

Estado = SolicitudServicio.EstadoSolicitud
EstadoOferta = OfertaTrabajo.Estado


# ---------------------------------------------------------------- helpers
def perfil(request):
    try:
        return request.user.perfil_usuario
    except Usuario.DoesNotExist:
        raise PermissionDenied('Tu cuenta no tiene perfil de Ofix.')


def rol(request):
    return perfil(request).rol


def tipo_archivo(f):
    ct = (getattr(f, 'content_type', '') or '').lower()
    if ct.startswith('image/'):
        return 'imagen'
    if ct.startswith('video/'):
        return 'video'
    return 'archivo'


MAX_MB = 50


def validar_archivo(f, permitidos=('imagen', 'video')):
    if f.size > MAX_MB * 1024 * 1024:
        raise ValidationError({'archivo': f'«{f.name}» supera los {MAX_MB} MB.'})
    t = tipo_archivo(f)
    if permitidos and t not in permitidos and not f.name.lower().endswith('.pdf'):
        raise ValidationError({'archivo': f'«{f.name}» no es una foto ni un video.'})
    return t


class EsCliente(BasePermission):
    message = 'Esta sección es sólo para clientes.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and hasattr(request.user, 'perfil_usuario') \
            and request.user.perfil_usuario.rol == 'CLIENTE'


class EsProfesional(BasePermission):
    message = 'Esta sección es sólo para profesionales.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and hasattr(request.user, 'perfil_usuario') \
            and request.user.perfil_usuario.rol == 'PROFESIONAL'


def respuesta_sesion(request, user):
    token, _ = Token.objects.get_or_create(user=user)
    return {'token': token.key, 'usuario': UsuarioSerializer(user.perfil_usuario, context={'request': request}).data}


# ---------------------------------------------------------------- auth
@api_view(['GET'])
@permission_classes([AllowAny])
def email_disponible(request):
    email = (request.query_params.get('email') or '').strip().lower()
    return Response({'disponible': bool(email) and not User.objects.filter(Q(email__iexact=email) | Q(username__iexact=email)).exists()})


@api_view(['POST'])
@permission_classes([AllowAny])
def registro(request):
    """Crea la cuenta (pasos 1 a 3 del registro). Multipart para permitir la foto."""
    d = request.data
    rol_pedido = (d.get('rol') or '').upper()
    if rol_pedido not in ('CLIENTE', 'PROFESIONAL'):
        raise ValidationError({'rol': 'Elegí si te registrás como cliente o profesional.'})
    email = (d.get('email') or '').strip().lower()
    password = d.get('password') or ''
    errores = {}
    if not email or '@' not in email:
        errores['email'] = 'Ingresá un email válido.'
    elif User.objects.filter(Q(email__iexact=email) | Q(username__iexact=email)).exists():
        errores['email'] = 'Ya existe una cuenta con este email. Iniciá sesión.'
    try:
        validate_password(password, User(username=email, email=email))
    except DjangoValidationError as e:
        errores['password'] = ' '.join(e.messages)
    for campo, msg in [('nombre', 'Ingresá tu nombre.'), ('apellido', 'Ingresá tu apellido.'),
                       ('telefono', 'Ingresá un teléfono.'), ('ciudad', 'Ingresá tu ciudad.'),
                       ('provincia', 'Elegí tu provincia.')]:
        if not (d.get(campo) or '').strip():
            errores[campo] = msg
    es_pro = rol_pedido == 'PROFESIONAL'
    if es_pro and not (d.get('dni') or '').strip():
        errores['dni'] = 'El DNI es obligatorio para profesionales.'
    tiene_dir = any((d.get(k) or '').strip() for k in ('calle', 'numero'))
    if es_pro or tiene_dir:
        if not (d.get('calle') or '').strip():
            errores['calle'] = 'Ingresá la calle.'
        if not (d.get('numero') or '').strip():
            errores['numero'] = 'Ingresá el número.'
    foto = request.FILES.get('foto')
    if foto and tipo_archivo(foto) != 'imagen':
        errores['foto'] = 'La foto de perfil tiene que ser una imagen.'
    if errores:
        raise ValidationError(errores)

    with transaction.atomic():
        user = User.objects.create_user(username=email, email=email, password=password,
                                        first_name=d['nombre'].strip(), last_name=d['apellido'].strip())
        u = Usuario.objects.create(user=user, telefono=d['telefono'].strip(), dni=(d.get('dni') or '').strip(),
                                   ciudad=d['ciudad'].strip(), provincia=d['provincia'].strip(), foto=foto)
        if es_pro:
            Profesional.objects.create(usuario=u, localidad_base=u.ciudad, perfil_completo=False)
        else:
            Cliente.objects.create(usuario=u)
        if tiene_dir or es_pro:
            ser = DireccionSerializer(data={
                'alias': 'Principal', 'calle': d.get('calle'), 'numero': d.get('numero'),
                'departamento': d.get('departamento') or '', 'localidad': u.ciudad,
                'provincia': u.provincia, 'cod_postal': d.get('cod_postal') or '',
                'latitud': d.get('latitud') or None, 'longitud': d.get('longitud') or None,
                'es_principal': True,
            })
            ser.is_valid(raise_exception=True)
            ser.save(usuario=u, cliente=getattr(u, 'cliente', None))
    return Response(respuesta_sesion(request, user), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    email = (request.data.get('email') or '').strip().lower()
    user = authenticate(username=email, password=request.data.get('password') or '')
    if not user or not hasattr(user, 'perfil_usuario'):
        raise ValidationError({'detail': 'Email o contraseña incorrectos.'})
    if user.perfil_usuario.estado != 'ACTIVO':
        raise ValidationError({'detail': 'Tu cuenta está suspendida. Escribinos para reactivarla.'})
    return Response(respuesta_sesion(request, user))


@api_view(['POST'])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'PATCH'])
def yo(request):
    u = perfil(request)
    if request.method == 'PATCH':
        ser = UsuarioSerializer(u, data=request.data, partial=True, context={'request': request})
        ser.is_valid(raise_exception=True)
        ser.save()
    return Response(UsuarioSerializer(u, context={'request': request}).data)


@api_view(['POST'])
def cambiar_password(request):
    user = request.user
    if not user.check_password(request.data.get('actual') or ''):
        raise ValidationError({'actual': 'La contraseña actual no es correcta.'})
    nueva = request.data.get('nueva') or ''
    try:
        validate_password(nueva, user)
    except DjangoValidationError as e:
        raise ValidationError({'nueva': ' '.join(e.messages)})
    user.set_password(nueva)
    user.save()
    return Response(respuesta_sesion(request, user))


@api_view(['POST'])
@permission_classes([AllowAny])
def recuperar_password(request):
    """Envía un enlace para restablecer la contraseña. Responde igual exista o no la cuenta."""
    from django.conf import settings
    from django.contrib.auth.tokens import default_token_generator
    from django.core.mail import send_mail
    from django.utils.encoding import force_bytes
    from django.utils.http import urlsafe_base64_encode

    email = (request.data.get('email') or '').strip().lower()
    respuesta = {'detail': 'Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva.'}
    user = User.objects.filter(email__iexact=email, is_active=True).first() if email else None
    if user:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        link = f"{settings.OFIX_FRONTEND_URL}/restablecer?uid={uid}&token={token}"
        send_mail('Ofix: restablecer contraseña',
                  f"Hola {user.first_name}, para crear una contraseña nueva abrí este enlace:\n{link}\n\n"
                  "Si no lo pediste, ignorá este correo.",
                  None, [user.email])
        if settings.DEBUG:
            respuesta['link_dev'] = link  # sólo en desarrollo, para probar sin servidor de correo
    return Response(respuesta)


@api_view(['POST'])
@permission_classes([AllowAny])
def restablecer_password(request):
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.encoding import force_str
    from django.utils.http import urlsafe_base64_decode

    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(request.data.get('uid') or '')))
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        user = None
    if not user or not default_token_generator.check_token(user, request.data.get('token') or ''):
        raise ValidationError({'detail': 'El enlace venció o ya se usó. Pedí uno nuevo.'})
    nueva = request.data.get('password') or ''
    try:
        validate_password(nueva, user)
    except DjangoValidationError as e:
        raise ValidationError({'password': ' '.join(e.messages)})
    user.set_password(nueva)
    user.save()
    Token.objects.filter(user=user).delete()
    return Response({'detail': 'Listo, ya podés iniciar sesión con tu contraseña nueva.'})


# ---------------------------------------------------------------- catálogo base
class OficioViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Oficio.objects.all().order_by('id')
    serializer_class = OficioSerializer
    permission_classes = [AllowAny]


class DireccionViewSet(viewsets.ModelViewSet):
    serializer_class = DireccionSerializer

    def get_queryset(self):
        return Direccion.objects.filter(usuario=perfil(self.request)).order_by('-es_principal', 'id')

    def perform_create(self, serializer):
        u = perfil(self.request)
        primera = not Direccion.objects.filter(usuario=u).exists()
        d = serializer.save(usuario=u, cliente=getattr(u, 'cliente', None),
                            es_principal=serializer.validated_data.get('es_principal', False) or primera)
        self._unica_principal(d)

    def perform_update(self, serializer):
        self._unica_principal(serializer.save())

    def _unica_principal(self, d):
        if d.es_principal:
            Direccion.objects.filter(usuario=d.usuario).exclude(pk=d.pk).update(es_principal=False)

    def perform_destroy(self, instance):
        if instance.solicitudes.exclude(estado__in=[Estado.FINALIZADA, Estado.CANCELADA]).exists():
            raise ValidationError({'detail': 'Esta dirección tiene un pedido en curso. Cancelalo o finalizalo antes de borrarla.'})
        if instance.solicitudes.exists():
            raise ValidationError({'detail': 'Esta dirección figura en pedidos anteriores y no se puede borrar.'})
        if rol(self.request) == 'PROFESIONAL' and self.get_queryset().count() <= 1:
            raise ValidationError({'detail': 'Necesitás al menos una dirección base para recibir trabajos.'})
        instance.delete()


# ---------------------------------------------------------------- profesionales
class ProfesionalViewSet(viewsets.ReadOnlyModelViewSet):
    """Catálogo público para clientes. Filtros: ?oficio=slug|id &q= &direccion=id &orden=puntaje|distancia|experiencia"""
    serializer_class = ProfesionalPublicoSerializer

    def get_queryset(self):
        qs = (Profesional.objects.filter(perfil_completo=True, usuario__estado='ACTIVO')
              .exclude(estado_validacion=Profesional.EstadoValidacion.RECHAZADO)
              .select_related('usuario__user').prefetch_related('experiencias__oficio', 'usuario__direcciones'))
        p = self.request.query_params
        oficio = p.get('oficio')
        if oficio:
            qs = qs.filter(experiencias__oficio__id=oficio) if oficio.isdigit() else qs.filter(experiencias__oficio__slug=oficio)
        q = (p.get('q') or '').strip()
        if q:
            qs = qs.filter(Q(usuario__user__first_name__icontains=q) | Q(usuario__user__last_name__icontains=q)
                           | Q(localidad_base__icontains=q) | Q(descripcion__icontains=q))
        return qs.distinct()

    def _direccion(self):
        did = self.request.query_params.get('direccion')
        u = perfil(self.request)
        qs = Direccion.objects.filter(usuario=u)
        return (qs.filter(pk=did).first() if did else None) or qs.order_by('-es_principal', 'id').first()

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'direccion': self._direccion()}

    def list(self, request, *args, **kwargs):
        ctx = self.get_serializer_context()
        data = ProfesionalPublicoSerializer(self.get_queryset(), many=True, context=ctx).data
        p = request.query_params
        solo_cerca = p.get('en_cobertura') == '1'
        if solo_cerca:
            data = [x for x in data if x['distancia_km'] is not None and x['distancia_km'] <= x['radio_cobertura_km']]
        orden = p.get('orden', 'recomendados')
        if orden == 'distancia':
            data.sort(key=lambda x: (x['distancia_km'] is None, x['distancia_km'] or 0))
        elif orden == 'puntaje':
            data.sort(key=lambda x: (-(x['puntaje_promedio'] or 0), -x['cantidad_resenas']))
        elif orden == 'experiencia':
            data.sort(key=lambda x: -max([e['anios_experiencia'] for e in x['experiencias']] or [0]))
        else:
            # "Recomendados": mismo criterio que la urgencia (cercanía + reputación + boost nuevo).
            pros = {p.pk: p for p in self.get_queryset()}
            def sc(x):
                if x['distancia_km'] is None:
                    return -1
                return asignacion.calcular_score_emergencia(pros[x['id']], x['distancia_km'],
                                                            radio_max_km=max(float(x['radio_cobertura_km']), x['distancia_km'] + 1))
            data.sort(key=sc, reverse=True)
        return Response(data)

    @action(detail=True)
    def resenas(self, request, pk=None):
        qs = Calificacion.objects.filter(solicitud__profesional_id=pk).select_related(
            'solicitud__cliente__usuario__user', 'solicitud__oficio').order_by('-fecha')
        return Response(ResenaSerializer(qs, many=True).data)


@api_view(['GET', 'PATCH'])
@permission_classes([EsProfesional])
def profesional_yo(request):
    pro = perfil(request).profesional
    ctx = {'request': request, 'direccion': None}
    if request.method == 'PATCH':
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        experiencias = data.pop('experiencias', None)
        if isinstance(experiencias, list) and len(experiencias) == 1 and isinstance(experiencias[0], str):
            experiencias = experiencias[0]
        if isinstance(experiencias, str):
            experiencias = json.loads(experiencias)
        if 'horarios' in data and isinstance(data['horarios'], str):
            data['horarios'] = json.loads(data['horarios'])
        ser = ProfesionalPrivadoSerializer(pro, data={k: data[k] for k in data
                                                      if k in ('descripcion', 'radio_cobertura_km', 'horarios', 'localidad_base')},
                                           partial=True, context=ctx)
        ser.is_valid(raise_exception=True)
        radio = ser.validated_data.get('radio_cobertura_km')
        if radio is not None and not 1 <= radio <= 150:
            raise ValidationError({'radio_cobertura_km': 'El radio va de 1 a 150 km.'})
        with transaction.atomic():
            ser.save()
            if experiencias is not None:
                if not experiencias:
                    raise ValidationError({'experiencias': 'Elegí al menos un oficio.'})
                ids = []
                for e in experiencias:
                    of = Oficio.objects.filter(pk=e.get('oficio')).first()
                    if not of:
                        raise ValidationError({'experiencias': 'Oficio inválido.'})
                    anios = int(e.get('anios_experiencia') or 0)
                    if not 0 <= anios <= 70:
                        raise ValidationError({'experiencias': 'Revisá los años de experiencia.'})
                    ExperienciaOficio.objects.update_or_create(profesional=pro, oficio=of,
                                                               defaults={'anios_experiencia': anios})
                    ids.append(of.pk)
                pro.experiencias.exclude(oficio_id__in=ids).delete()
            if data.get('finalizar') in (True, 'true', '1', 1) or pro.perfil_completo:
                if not pro.experiencias.exists():
                    raise ValidationError({'experiencias': 'Elegí al menos un oficio.'})
                pro.perfil_completo = True
                pro.save(update_fields=['perfil_completo'])
        pro.refresh_from_db()
    return Response(ProfesionalPrivadoSerializer(pro, context=ctx).data)


@api_view(['POST'])
@permission_classes([EsProfesional])
def disponibilidad(request):
    """Conectar/desconectar manualmente. {'tomando_trabajos': bool} o {'automatico': true}."""
    pro = perfil(request).profesional
    if request.data.get('automatico'):
        pro.override_disponible = None
        pro.override_estado_horario = None
    else:
        valor = request.data.get('tomando_trabajos') in (True, 'true', '1', 1)
        horario = pro.en_horario()
        if valor == horario:
            pro.override_disponible = None  # coincide con el horario: vuelve a automático
            pro.override_estado_horario = None
        else:
            pro.override_disponible = valor
            pro.override_estado_horario = horario
    pro.save(update_fields=['override_disponible', 'override_estado_horario'])
    return Response({'tomando_trabajos': pro.tomando_trabajos, 'modo': pro.modo_disponibilidad,
                     'en_horario': pro.en_horario()})


@api_view(['GET'])
@permission_classes([EsProfesional])
def profesional_resumen(request):
    pro = perfil(request).profesional
    resenas = Calificacion.objects.filter(solicitud__profesional=pro).select_related(
        'solicitud__cliente__usuario__user', 'solicitud__oficio').order_by('-fecha')
    dist = {i: resenas.filter(puntaje=i).count() for i in range(1, 6)}
    return Response({
        'perfil': ProfesionalPrivadoSerializer(pro, context={'request': request}).data,
        'resenas': ResenaSerializer(resenas, many=True).data,
        'distribucion': dist,
        'trabajos_finalizados': pro.solicitudes_atendidas.filter(estado=Estado.FINALIZADA).count(),
    })


class CertificacionViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin,
                           viewsets.GenericViewSet):
    serializer_class = CertificacionSerializer
    permission_classes = [EsProfesional]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Certificacion.objects.filter(profesional=perfil(self.request).profesional)

    def perform_create(self, serializer):
        f = self.request.FILES.get('archivo')
        if not f:
            raise ValidationError({'archivo': 'Adjuntá una foto o un PDF del certificado.'})
        if f.size > 15 * 1024 * 1024:
            raise ValidationError({'archivo': 'El archivo supera los 15 MB.'})
        if tipo_archivo(f) != 'imagen' and not f.name.lower().endswith('.pdf'):
            raise ValidationError({'archivo': 'Subí una imagen o un PDF.'})
        serializer.save(profesional=perfil(self.request).profesional,
                        nombre=serializer.validated_data.get('nombre') or f.name)


# ---------------------------------------------------------------- solicitudes (cliente)
class SolicitudViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                       viewsets.GenericViewSet):
    serializer_class = SolicitudSerializer
    permission_classes = [EsCliente]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = (SolicitudServicio.objects.filter(cliente=perfil(self.request).cliente)
              .select_related('oficio', 'direccion', 'profesional__usuario__user')
              .prefetch_related('ofertas').order_by('-fecha_solicitud'))
        estado = self.request.query_params.get('estado')
        # Un trabajo que el cliente ya marcó como terminado pasa a su historial
        # (aunque falte la confirmación del profesional).
        en_curso = Q(estado__in=[Estado.ACEPTADA, Estado.EN_CURSO])
        if estado == 'activas':
            qs = qs.filter(Q(estado__in=[Estado.CREADA, Estado.NOTIFICANDO]) | (en_curso & Q(completado_cliente=False)))
        elif estado == 'historial':
            qs = qs.filter(Q(estado__in=[Estado.FINALIZADA, Estado.CANCELADA]) | (en_curso & Q(completado_cliente=True)))
        return qs

    def retrieve(self, request, *args, **kwargs):
        s = self.get_object()
        asignacion.avanzar(s)  # mantiene la cascada al día mientras el cliente espera
        s.refresh_from_db()
        return Response(self.get_serializer(s).data)

    def perform_create(self, serializer):
        archivos = self.request.FILES.getlist('adjuntos')
        if len(archivos) > 10:
            raise ValidationError({'adjuntos': 'Podés adjuntar hasta 10 archivos.'})
        tipos = [validar_archivo(f) for f in archivos]
        urgente = str(self.request.data.get('es_urgente', '')).lower() in ('true', '1')
        with transaction.atomic():
            adjuntos = [{'archivo': default_storage.save(f'solicitudes/{f.name}', f), 'tipo': t}
                        for f, t in zip(archivos, tipos)]
            s = serializer.save(cliente=perfil(self.request).cliente, es_urgente=urgente,
                                estado=Estado.CREADA, adjuntos=adjuntos)
        if urgente:
            asignacion.iniciar_asignacion(s)
        self._creada = s

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        self.perform_create(ser)
        self._creada.refresh_from_db()
        return Response(self.get_serializer(self._creada).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def enviar(self, request, pk=None):
        """Envía la solicitud guardada a un profesional elegido del catálogo."""
        s = self.get_object()
        if s.estado != Estado.CREADA:
            raise ValidationError({'detail': 'Esta solicitud ya fue enviada a un profesional. Esperá su respuesta o cancelala.'})
        pro = Profesional.objects.filter(pk=request.data.get('profesional'), perfil_completo=True,
                                         experiencias__oficio=s.oficio).first()
        if not pro:
            raise ValidationError({'profesional': 'Ese profesional no trabaja este oficio.'})
        if s.ofertas.filter(profesional=pro, estado=EstadoOferta.RECHAZADA).exists():
            raise ValidationError({'profesional': 'Este profesional ya rechazó esta solicitud. Elegí otro.'})
        with transaction.atomic():
            s.ofertas.filter(estado=EstadoOferta.PENDIENTE).update(estado=EstadoOferta.CANCELADA)
            s.estado = Estado.NOTIFICANDO
            s.busqueda_agotada = False
            s.save(update_fields=['estado', 'busqueda_agotada'])
            dist = asignacion.distancia_a_profesional(pro, s.direccion)
            o = OfertaTrabajo.objects.create(solicitud=s, profesional=pro, es_urgente=False, distancia_km=dist)
            notificar(pro.usuario, 'OFERTA', f"{s.cliente.usuario.user.first_name} te eligió para «{s.titulo}».", s, o)
        return Response(self.get_serializer(s).data)

    @action(detail=True, methods=['post'])
    def reintentar(self, request, pk=None):
        """Vuelve a correr la asignación automática con la misma solicitud."""
        s = self.get_object()
        if s.estado != Estado.CREADA:
            raise ValidationError({'detail': 'La solicitud no está disponible para reasignar.'})
        s.es_urgente = True
        s.save(update_fields=['es_urgente'])
        s.ofertas.filter(es_urgente=True).exclude(estado=EstadoOferta.RECHAZADA).delete()
        asignacion.iniciar_asignacion(s)
        s.refresh_from_db()
        return Response(self.get_serializer(s).data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        s = self.get_object()
        if s.estado in (Estado.FINALIZADA, Estado.CANCELADA):
            raise ValidationError({'detail': 'Esta solicitud ya está cerrada.'})
        cancelar_solicitud(s, 'CLIENTE', request.data.get('motivo', ''))
        return Response(self.get_serializer(s).data)

    @action(detail=True, methods=['post'])
    def completar(self, request, pk=None):
        s = self.get_object()
        marcar_completado(s, 'CLIENTE')
        return Response(self.get_serializer(s).data)

    @action(detail=True, methods=['post'])
    def calificar(self, request, pk=None):
        s = self.get_object()
        if s.estado != Estado.FINALIZADA:
            raise ValidationError({'detail': 'Podés calificar cuando los dos confirmen que el trabajo terminó.'})
        if hasattr(s, 'calificacion'):
            raise ValidationError({'detail': 'Ya calificaste este trabajo.'})
        ser = CalificacionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        with transaction.atomic():
            ser.save(solicitud=s)
            pro = s.profesional
            notas = Calificacion.objects.filter(solicitud__profesional=pro).values_list('puntaje', flat=True)
            pro.puntaje_promedio = round(sum(notas) / len(notas), 2) if notas else 0
            pro.save(update_fields=['puntaje_promedio'])
            cli = s.cliente
            cli.calificaciones_emitidas += 1
            cli.save(update_fields=['calificaciones_emitidas'])
            notificar(pro.usuario, 'CALIFICACION', f"Recibiste {ser.validated_data['puntaje']} estrellas por «{s.titulo}».", s)
        s.refresh_from_db()
        return Response(self.get_serializer(s).data)


def cancelar_solicitud(s, quien, motivo=''):
    with transaction.atomic():
        s.ofertas.filter(estado=EstadoOferta.PENDIENTE).update(estado=EstadoOferta.CANCELADA, fecha_respuesta=timezone.now())
        estaba_aceptada = s.estado in (Estado.ACEPTADA, Estado.EN_CURSO)
        s.estado = Estado.CANCELADA
        s.save(update_fields=['estado'])
        conv = getattr(s, 'conversacion', None)
        if conv:
            Mensaje.objects.create(conversacion=conv, emisor='SISTEMA',
                                   texto=f"{'El cliente' if quien == 'CLIENTE' else 'El profesional'} canceló el trabajo."
                                         + (f" Motivo: {motivo}" if motivo else ''))
            conv.activa = False
            conv.save(update_fields=['activa'])
        if estaba_aceptada and s.profesional:
            otro = s.profesional.usuario if quien == 'CLIENTE' else s.cliente.usuario
            notificar(otro, 'CANCELACION', f"Se canceló el trabajo «{s.titulo}».", s)


def marcar_completado(s, quien):
    if s.estado not in (Estado.ACEPTADA, Estado.EN_CURSO):
        raise ValidationError({'detail': 'Sólo se puede completar un trabajo aceptado.'})
    with transaction.atomic():
        if quien == 'CLIENTE':
            s.completado_cliente = True
        else:
            s.completado_profesional = True
        otro = s.profesional.usuario if quien == 'CLIENTE' else s.cliente.usuario
        if s.completado_cliente and s.completado_profesional:
            s.estado = Estado.FINALIZADA
            pro = s.profesional
            pro.servicios_realizados += 1
            pro.save(update_fields=['servicios_realizados'])
            notificar(s.cliente.usuario, 'FINALIZADA', f"«{s.titulo}» quedó finalizado. Ya podés calificar a {pro.usuario.user.first_name}.", s)
            if quien == 'CLIENTE':
                notificar(otro, 'FINALIZADA', f"El cliente confirmó que «{s.titulo}» está terminado.", s)
        else:
            notificar(otro, 'COMPLETAR', f"{'El cliente' if quien == 'CLIENTE' else 'El profesional'} marcó «{s.titulo}» como terminado. Confirmalo para cerrarlo.", s)
        s.save()
        conv = getattr(s, 'conversacion', None)
        if conv:
            Mensaje.objects.create(conversacion=conv, emisor='SISTEMA',
                                   texto='Trabajo finalizado por ambas partes.' if s.estado == Estado.FINALIZADA
                                   else f"{'El cliente' if quien == 'CLIENTE' else 'El profesional'} marcó el trabajo como terminado.")


# ---------------------------------------------------------------- ofertas y trabajos (profesional)
class OfertaViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = OfertaSerializer
    permission_classes = [EsProfesional]

    def get_queryset(self):
        qs = (OfertaTrabajo.objects.filter(profesional=perfil(self.request).profesional)
              .select_related('solicitud__oficio', 'solicitud__direccion', 'solicitud__cliente__usuario__user'))
        if self.request.query_params.get('estado', 'PENDIENTE') == 'PENDIENTE' and self.action == 'list':
            qs = qs.filter(estado=EstadoOferta.PENDIENTE)
        return qs.order_by('-es_urgente', '-fecha_envio')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.user.is_authenticated and hasattr(self.request.user, 'perfil_usuario'):
            ctx['profesional'] = getattr(self.request.user.perfil_usuario, 'profesional', None)
        return ctx

    def list(self, request, *args, **kwargs):
        asignacion.procesar_pendientes(intervalo_seg=5)
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def aceptar(self, request, pk=None):
        oferta = self.get_object()
        with transaction.atomic():
            s = SolicitudServicio.objects.select_for_update().get(pk=oferta.solicitud_id)
            oferta.refresh_from_db()
            if s.estado != Estado.NOTIFICANDO or s.profesional_id or oferta.estado != EstadoOferta.PENDIENTE:
                if oferta.estado == EstadoOferta.PENDIENTE:
                    oferta.estado = EstadoOferta.TOMADA
                    oferta.save(update_fields=['estado'])
                raise ValidationError({'detail': 'Otro profesional tomó este trabajo antes, dentro de su tiempo de prioridad.'})
            ahora = timezone.now()
            oferta.estado = EstadoOferta.ACEPTADA
            oferta.fecha_respuesta = ahora
            oferta.save()
            s.ofertas.filter(estado=EstadoOferta.PENDIENTE).exclude(pk=oferta.pk).update(
                estado=EstadoOferta.TOMADA, fecha_respuesta=ahora)
            pro = oferta.profesional
            s.profesional = pro
            s.estado = Estado.ACEPTADA
            s.fecha_aceptacion = ahora
            s.busqueda_agotada = False
            s.save()
            conv, _ = Conversacion.objects.get_or_create(solicitud=s)
            Mensaje.objects.create(conversacion=conv, emisor='SISTEMA',
                                   texto=f"{pro.usuario.user.first_name} aceptó el trabajo. Usen este chat para coordinar la visita.")
            notificar(s.cliente.usuario, 'ACEPTADA',
                      f"{pro.usuario.user.first_name} aceptó «{s.titulo}». Ya pueden coordinar por chat.", s)
        return Response(self.get_serializer(oferta).data)

    @action(detail=True, methods=['post'])
    def rechazar(self, request, pk=None):
        oferta = self.get_object()
        if oferta.estado != EstadoOferta.PENDIENTE:
            raise ValidationError({'detail': 'Esta oferta ya no está disponible.'})
        with transaction.atomic():
            oferta.estado = EstadoOferta.RECHAZADA
            oferta.fecha_respuesta = timezone.now()
            oferta.save()
            s = oferta.solicitud
            if not oferta.es_urgente and s.estado == Estado.NOTIFICANDO:
                s.estado = Estado.CREADA
                s.save(update_fields=['estado'])
                notificar(s.cliente.usuario, 'RECHAZADA',
                          f"{oferta.profesional.usuario.user.first_name} no puede tomar «{s.titulo}». Elegí otro profesional del catálogo.", s)
        if oferta.es_urgente:
            asignacion.avanzar(oferta.solicitud)
        return Response(self.get_serializer(oferta).data)


class TrabajoViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Solicitudes aceptadas por el profesional. ?estado=pendientes|historial"""
    serializer_class = SolicitudParaProfesionalSerializer
    permission_classes = [EsProfesional]

    def get_queryset(self):
        qs = (SolicitudServicio.objects.filter(profesional=perfil(self.request).profesional)
              .select_related('oficio', 'direccion', 'cliente__usuario__user')
              .order_by('-fecha_aceptacion', '-fecha_solicitud'))
        e = self.request.query_params.get('estado')
        # Apenas el profesional lo marca como terminado sale de "pendientes" y pasa al
        # historial, aunque todavía falte la confirmación del cliente.
        en_curso = Q(estado__in=[Estado.ACEPTADA, Estado.EN_CURSO])
        if e == 'pendientes':
            qs = qs.filter(en_curso & Q(completado_profesional=False))
        elif e == 'historial':
            qs = qs.filter(Q(estado__in=[Estado.FINALIZADA, Estado.CANCELADA]) | (en_curso & Q(completado_profesional=True)))
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.user.is_authenticated and hasattr(self.request.user, 'perfil_usuario'):
            ctx['profesional'] = getattr(self.request.user.perfil_usuario, 'profesional', None)
        return ctx

    @action(detail=True, methods=['post'])
    def completar(self, request, pk=None):
        s = self.get_object()
        marcar_completado(s, 'PROFESIONAL')
        return Response(self.get_serializer(s).data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        s = self.get_object()
        if s.estado not in (Estado.ACEPTADA, Estado.EN_CURSO):
            raise ValidationError({'detail': 'Este trabajo ya está cerrado.'})
        cancelar_solicitud(s, 'PROFESIONAL', request.data.get('motivo', ''))
        return Response(self.get_serializer(s).data)


# ---------------------------------------------------------------- chat
class ConversacionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ConversacionSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        u = perfil(self.request)
        if u.rol == 'CLIENTE':
            qs = Conversacion.objects.filter(solicitud__cliente=u.cliente)
        else:
            qs = Conversacion.objects.filter(solicitud__profesional=u.profesional)
        return qs.select_related('solicitud__oficio', 'solicitud__cliente__usuario__user',
                                 'solicitud__profesional__usuario__user').order_by('-fecha_apertura')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.user.is_authenticated:
            ctx['rol'] = rol(self.request)
        return ctx

    def list(self, request, *args, **kwargs):
        data = self.get_serializer(self.get_queryset(), many=True).data
        data.sort(key=lambda c: (c['ultimo_mensaje'] or {}).get('fecha_envio') or c['fecha_apertura'], reverse=True)
        return Response(data)

    @action(detail=True, methods=['get', 'post'])
    def mensajes(self, request, pk=None):
        conv = self.get_object()
        r = rol(request)
        ctx = self.get_serializer_context()
        if request.method == 'POST':
            if not conv.activa:
                raise ValidationError({'detail': 'Este chat está cerrado porque el trabajo se canceló.'})
            texto = (request.data.get('texto') or '').strip()
            f = request.FILES.get('adjunto')
            if not texto and not f:
                raise ValidationError({'texto': 'Escribí un mensaje o adjuntá un archivo.'})
            t = validar_archivo(f) if f else ''
            m = Mensaje.objects.create(conversacion=conv, emisor=r, texto=texto[:4000], adjunto=f, tipo_adjunto=t)
            s = conv.solicitud
            otro = s.profesional.usuario if r == 'CLIENTE' else s.cliente.usuario
            # una sola notificación sin leer por conversación, para no inundar la campana
            if not Notificacion.objects.filter(usuario=otro, tipo='MENSAJE', solicitud=s, leida=False).exists():
                notificar(otro, 'MENSAJE', f"Nuevo mensaje sobre «{s.titulo}».", s)
            return Response(MensajeSerializer(m, context=ctx).data, status=status.HTTP_201_CREATED)
        desde = request.query_params.get('desde')
        qs = conv.mensajes.order_by('fecha_envio', 'id')
        if desde and desde.isdigit():
            qs = qs.filter(id__gt=int(desde))
        conv.mensajes.filter(leido=False).exclude(emisor=r).update(leido=True)
        Notificacion.objects.filter(usuario=perfil(request), tipo='MENSAJE', solicitud=conv.solicitud, leida=False).update(leida=True)
        return Response(MensajeSerializer(qs, many=True, context=ctx).data)


# ---------------------------------------------------------------- notificaciones
class NotificacionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificacionSerializer

    def get_queryset(self):
        return Notificacion.objects.filter(usuario=perfil(self.request)).order_by('-fecha_envio')

    def list(self, request, *args, **kwargs):
        asignacion.procesar_pendientes(intervalo_seg=5)
        qs = self.get_queryset()
        return Response({'no_leidas': qs.filter(leida=False).count(),
                         'items': self.get_serializer(qs[:30], many=True).data})

    @action(detail=True, methods=['post'])
    def leer(self, request, pk=None):
        n = self.get_queryset().filter(pk=pk).first()
        if not n:
            raise NotFound()
        n.leida = True
        n.save(update_fields=['leida'])
        return Response(self.get_serializer(n).data)

    @action(detail=False, methods=['post'])
    def leer_todas(self, request):
        self.get_queryset().filter(leida=False).update(leida=True)
        return Response(status=status.HTTP_204_NO_CONTENT)
