from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class Usuario(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil_usuario')
    telefono = models.CharField(max_length=30)
    fecha_alta = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=50, default='ACTIVO')  # ACTIVO, INACTIVO, SUSPENDIDO
    foto = models.FileField(upload_to='fotos/', null=True, blank=True)
    dni = models.CharField(max_length=20, blank=True)
    ciudad = models.CharField(max_length=100, blank=True)
    provincia = models.CharField(max_length=100, blank=True)

    class Meta:
        verbose_name = "Usuario Base"
        verbose_name_plural = "Usuarios Base"

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name} ({self.user.email})"

    @property
    def rol(self):
        if hasattr(self, 'profesional'):
            return 'PROFESIONAL'
        return 'CLIENTE'

    @property
    def nombre_completo(self):
        return f"{self.user.first_name} {self.user.last_name}".strip()


class Cliente(models.Model):
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, primary_key=True, related_name='cliente')
    calificaciones_emitidas = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Cliente: {self.usuario}"


class Direccion(models.Model):
    # Según el diagrama E-R la dirección pertenece al usuario (cliente o profesional).
    # Se conserva `cliente` por compatibilidad con la versión anterior.
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='direcciones', null=True, blank=True)
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='direcciones', null=True, blank=True)
    calle = models.CharField(max_length=150)
    numero = models.CharField(max_length=20)
    departamento = models.CharField(max_length=30, blank=True)
    localidad = models.CharField(max_length=100)
    provincia = models.CharField(max_length=100, blank=True)
    cod_postal = models.CharField(max_length=20, blank=True)
    latitud = models.FloatField(null=True, blank=True)
    longitud = models.FloatField(null=True, blank=True)
    es_principal = models.BooleanField(default=False)
    alias = models.CharField(max_length=50, blank=True)  # "Casa", "Trabajo"...

    def __str__(self):
        depto = f" {self.departamento}" if self.departamento else ""
        return f"{self.calle} {self.numero}{depto}, {self.localidad}"


class Oficio(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True)
    slug = models.SlugField(max_length=30, blank=True)  # gasista, electricista, plomero

    def __str__(self):
        return self.nombre


class Profesional(models.Model):
    class EstadoValidacion(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        APROBADO = 'APROBADO', 'Aprobado'
        RECHAZADO = 'RECHAZADO', 'Rechazado'

    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, primary_key=True, related_name='profesional')
    estado_validacion = models.CharField(
        max_length=20,
        choices=EstadoValidacion.choices,
        default=EstadoValidacion.PENDIENTE
    )
    descripcion = models.TextField(blank=True)
    disponibilidad_horaria = models.CharField(max_length=100, blank=True)
    puntaje_promedio = models.FloatField(default=0.0)
    servicios_realizados = models.PositiveIntegerField(default=0)
    localidad_base = models.CharField(max_length=100)
    radio_cobertura_km = models.PositiveIntegerField(default=10)

    # Horarios de atención: [{"dia": 0..6 (0 = lunes), "desde": "08:00", "hasta": "18:00"}]
    horarios = models.JSONField(default=list, blank=True)
    # Conexión manual: si el profesional se conecta/desconecta a mano, el valor manual
    # rige hasta que el horario cargado cambie de estado (entra o sale de su franja).
    override_disponible = models.BooleanField(null=True, blank=True)
    override_estado_horario = models.BooleanField(null=True, blank=True)
    perfil_completo = models.BooleanField(default=False)

    def __str__(self):
        return f"Profesional: {self.usuario}"

    # ---- Disponibilidad -------------------------------------------------
    def en_horario(self, ahora=None):
        ahora = timezone.localtime(ahora or timezone.now())
        dia = ahora.weekday()
        hora = ahora.strftime('%H:%M')
        for franja in self.horarios or []:
            try:
                if int(franja.get('dia')) == dia and franja.get('desde', '') <= hora < franja.get('hasta', ''):
                    return True
            except (TypeError, ValueError):
                continue
        return False

    @property
    def tomando_trabajos(self):
        horario = self.en_horario()
        if self.override_disponible is not None and self.override_estado_horario == horario:
            return self.override_disponible
        return horario

    @property
    def modo_disponibilidad(self):
        horario = self.en_horario()
        if self.override_disponible is not None and self.override_estado_horario == horario:
            return 'MANUAL'
        return 'AUTOMATICO'

    @property
    def direccion_base(self):
        return self.usuario.direcciones.order_by('-es_principal', 'id').first()


class ExperienciaOficio(models.Model):
    profesional = models.ForeignKey(Profesional, on_delete=models.CASCADE, related_name='experiencias')
    oficio = models.ForeignKey(Oficio, on_delete=models.CASCADE, related_name='profesionales_con_experiencia')
    anios_experiencia = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('profesional', 'oficio')

    def __str__(self):
        return f"{self.profesional} - {self.oficio.nombre} ({self.anios_experiencia} años)"


class Certificacion(models.Model):
    class EstadoCert(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        VALIDADO = 'VALIDADO', 'Validado'
        RECHAZADO = 'RECHAZADO', 'Rechazado'

    profesional = models.ForeignKey(Profesional, on_delete=models.CASCADE, related_name='certificaciones')
    nombre = models.CharField(max_length=150, blank=True)
    entidad_emisora = models.CharField(max_length=150, blank=True)
    fecha_emision = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=EstadoCert.choices, default=EstadoCert.PENDIENTE)
    archivo_url = models.CharField(max_length=255, blank=True)
    archivo = models.FileField(upload_to='certificaciones/', null=True, blank=True)

    def __str__(self):
        return f"Certificación {self.nombre or self.entidad_emisora} - {self.profesional}"


class SolicitudServicio(models.Model):
    # Mapeo con el diagrama de estados:
    # CREADA = Guardada, NOTIFICANDO = Asignada (esperando respuesta), ACEPTADA = Aceptada,
    # FINALIZADA = Completada (y luego Calificada cuando tiene calificación), CANCELADA = Cancelada.
    class EstadoSolicitud(models.TextChoices):
        CREADA = 'CREADA', 'Creada'
        NOTIFICANDO = 'NOTIFICANDO', 'Notificando'
        ACEPTADA = 'ACEPTADA', 'Aceptada'
        EN_CURSO = 'EN_CURSO', 'En curso'
        FINALIZADA = 'FINALIZADA', 'Finalizada'
        CANCELADA = 'CANCELADA', 'Cancelada'

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='solicitudes')
    profesional = models.ForeignKey(Profesional, on_delete=models.SET_NULL, null=True, blank=True, related_name='solicitudes_atendidas')
    oficio = models.ForeignKey(Oficio, on_delete=models.PROTECT, related_name='solicitudes')
    direccion = models.ForeignKey(Direccion, on_delete=models.PROTECT, related_name='solicitudes')
    titulo = models.CharField(max_length=120, blank=True)
    descripcion_problema = models.TextField()
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=20, choices=EstadoSolicitud.choices, default=EstadoSolicitud.CREADA)
    fecha_visita_acordada = models.DateTimeField(null=True, blank=True)
    es_urgente = models.BooleanField(default=False)
    completado_cliente = models.BooleanField(default=False)
    completado_profesional = models.BooleanField(default=False)
    # True cuando la asignación automática recorrió los primeros 5 sin respuesta.
    busqueda_agotada = models.BooleanField(default=False)
    fecha_aceptacion = models.DateTimeField(null=True, blank=True)
    # Fotos y videos del pedido, guardados en la misma fila (igual que el adjunto de un Mensaje).
    # Lista de {"archivo": "solicitudes/foto.jpg", "tipo": "imagen" | "video"}. Máximo 10.
    adjuntos = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"Solicitud #{self.id} - {self.oficio.nombre} ({self.estado})"


class OfertaTrabajo(models.Model):
    """Una solicitud enviada a un profesional (por asignación automática o elección del cliente)."""

    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        ACEPTADA = 'ACEPTADA', 'Aceptada'
        RECHAZADA = 'RECHAZADA', 'Rechazada'
        EXPIRADA = 'EXPIRADA', 'Expirada'
        TOMADA = 'TOMADA', 'Tomada por otro profesional'
        CANCELADA = 'CANCELADA', 'Cancelada por el cliente'

    solicitud = models.ForeignKey(SolicitudServicio, on_delete=models.CASCADE, related_name='ofertas')
    profesional = models.ForeignKey(Profesional, on_delete=models.CASCADE, related_name='ofertas')
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    es_urgente = models.BooleanField(default=False)
    posicion = models.PositiveSmallIntegerField(default=1)  # lugar en el ranking del algoritmo
    score = models.FloatField(null=True, blank=True)
    distancia_km = models.FloatField(null=True, blank=True)
    fecha_envio = models.DateTimeField(default=timezone.now)
    fecha_respuesta = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-es_urgente', '-fecha_envio']

    def __str__(self):
        return f"Oferta #{self.id} solicitud {self.solicitud_id} -> {self.profesional_id} ({self.estado})"


class Calificacion(models.Model):
    solicitud = models.OneToOneField(SolicitudServicio, on_delete=models.CASCADE, related_name='calificacion')
    puntaje = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comentario = models.TextField(blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Calificación {self.puntaje}★ - Solicitud #{self.solicitud.id}"


class Conversacion(models.Model):
    solicitud = models.OneToOneField(SolicitudServicio, on_delete=models.CASCADE, related_name='conversacion')
    fecha_apertura = models.DateTimeField(auto_now_add=True)
    activa = models.BooleanField(default=True)

    def __str__(self):
        return f"Conversación Solicitud #{self.solicitud.id}"


class Mensaje(models.Model):
    conversacion = models.ForeignKey(Conversacion, on_delete=models.CASCADE, related_name='mensajes')
    emisor = models.CharField(max_length=50)  # 'CLIENTE' o 'PROFESIONAL'
    texto = models.TextField(blank=True)
    adjunto = models.FileField(upload_to='chat/', null=True, blank=True)
    tipo_adjunto = models.CharField(max_length=10, blank=True)  # imagen | video | archivo
    fecha_envio = models.DateTimeField(auto_now_add=True)
    leido = models.BooleanField(default=False)

    def __str__(self):
        return f"Mensaje de {self.emisor} ({self.fecha_envio.strftime('%d/%m %H:%M')})"


class Notificacion(models.Model):
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='notificaciones')
    tipo = models.CharField(max_length=50)
    mensaje = models.TextField()
    fecha_envio = models.DateTimeField(auto_now_add=True)
    leida = models.BooleanField(default=False)
    solicitud = models.ForeignKey(SolicitudServicio, on_delete=models.CASCADE, null=True, blank=True, related_name='notificaciones')
    oferta = models.ForeignKey(OfertaTrabajo, on_delete=models.CASCADE, null=True, blank=True, related_name='notificaciones')

    def __str__(self):
        return f"Notificación para {self.usuario.user.email} - {self.tipo}"
