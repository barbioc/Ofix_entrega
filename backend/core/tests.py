from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from . import asignacion
from .models import (Cliente, Direccion, ExperienciaOficio, Notificacion, OfertaTrabajo, Oficio,
                     Profesional, SolicitudServicio, Usuario)

SIEMPRE = [{'dia': d, 'desde': '00:00', 'hasta': '23:59'} for d in range(7)]


@override_settings(OFIX_GEOCODIFICAR=False)
class AsignacionTests(TestCase):
    def setUp(self):
        self.plomero = Oficio.objects.create(nombre='Plomero', slug='plomero')
        u = Usuario.objects.create(user=User.objects.create_user('c@t.test', 'c@t.test', 'x'), telefono='1')
        self.cliente = Cliente.objects.create(usuario=u)
        self.dir = Direccion.objects.create(usuario=u, cliente=self.cliente, calle='A', numero='1', localidad='CABA',
                                            latitud=-34.60, longitud=-58.42, es_principal=True)
        # 6 profesionales a distancias crecientes (todos veteranos, sin boost)
        self.pros = [self._pro(i, -34.60 - 0.005 * (i + 1)) for i in range(6)]

    def _pro(self, i, lat, trabajos=20, puntaje=4.5):
        u = Usuario.objects.create(user=User.objects.create_user(f'p{i}@t.test', f'p{i}@t.test', 'x', first_name=f'P{i}'), telefono='1')
        p = Profesional.objects.create(usuario=u, localidad_base='CABA', radio_cobertura_km=20, horarios=SIEMPRE,
                                       perfil_completo=True, servicios_realizados=trabajos, puntaje_promedio=puntaje)
        Direccion.objects.create(usuario=u, calle='B', numero='2', localidad='CABA', latitud=lat, longitud=-58.42, es_principal=True)
        ExperienciaOficio.objects.create(profesional=p, oficio=self.plomero, anios_experiencia=3)
        return p

    def _solicitud(self):
        s = SolicitudServicio.objects.create(cliente=self.cliente, oficio=self.plomero, direccion=self.dir,
                                             titulo='Pérdida', descripcion_problema='Gotea', es_urgente=True)
        asignacion.iniciar_asignacion(s)
        return s

    def _vencer_ultima(self, s):
        o = s.ofertas.order_by('-posicion').first()
        o.fecha_envio = timezone.now() - timedelta(minutes=asignacion.PRIORIDAD_MINUTOS + 1)
        o.save()

    def test_score_del_equipo(self):
        nuevo = Profesional(servicios_realizados=0, puntaje_promedio=0)
        veterano = Profesional(servicios_realizados=40, puntaje_promedio=4.9)
        self.assertEqual(asignacion.calcular_score_emergencia(veterano, 20, 15), 0.0)  # fuera de radio
        self.assertGreater(asignacion.calcular_score_emergencia(nuevo, 2, 15), asignacion.calcular_score_emergencia(nuevo, 10, 15))
        self.assertGreater(asignacion.calcular_score_emergencia(veterano, 2, 15), asignacion.calcular_score_emergencia(Profesional(servicios_realizados=40, puntaje_promedio=2), 2, 15))

    def test_primero_el_mas_cercano(self):
        s = self._solicitud()
        o = s.ofertas.get()
        self.assertEqual(o.profesional, self.pros[0])
        self.assertEqual(s.estado, 'NOTIFICANDO')

    def test_pasa_al_siguiente_al_vencer_y_la_anterior_sigue_abierta(self):
        s = self._solicitud()
        self._vencer_ultima(s)
        asignacion.avanzar(s)
        self.assertEqual(s.ofertas.count(), 2)
        self.assertEqual(s.ofertas.filter(estado='PENDIENTE').count(), 2)

    def test_rechazo_avanza_inmediatamente(self):
        s = self._solicitud()
        o = s.ofertas.get()
        o.estado = 'RECHAZADA'
        o.save()
        asignacion.avanzar(s)
        self.assertEqual(s.ofertas.order_by('-posicion').first().profesional, self.pros[1])

    def test_ninguno_de_los_5_responde(self):
        s = self._solicitud()
        for _ in range(5):
            self._vencer_ultima(s)
            asignacion.avanzar(s)
        s.refresh_from_db()
        self.assertEqual(s.ofertas.count(), 5)  # el sexto nunca la recibe
        self.assertEqual(s.estado, 'CREADA')
        self.assertTrue(s.busqueda_agotada)
        self.assertFalse(s.ofertas.filter(estado='PENDIENTE').exists())
        self.assertTrue(Notificacion.objects.filter(usuario=self.cliente.usuario, tipo='SIN_RESPUESTA').exists())

    def test_desconectado_no_recibe_urgencias(self):
        p = self.pros[0]
        p.override_disponible = False
        p.override_estado_horario = p.en_horario()
        p.save()
        s = self._solicitud()
        self.assertEqual(s.ofertas.get().profesional, self.pros[1])

    def test_oferta_directa_no_la_pisa_la_cascada(self):
        s = self._solicitud()
        for _ in range(5):
            self._vencer_ultima(s)
            asignacion.avanzar(s)
        directa = OfertaTrabajo.objects.create(solicitud=s, profesional=self.pros[5], es_urgente=False)
        s.estado = 'NOTIFICANDO'
        s.save()
        asignacion.avanzar(s, forzar=True)
        directa.refresh_from_db()
        s.refresh_from_db()
        self.assertEqual(directa.estado, 'PENDIENTE')
        self.assertEqual(s.estado, 'NOTIFICANDO')

    def test_aceptar_cierra_las_demas_y_abre_chat(self):
        s = self._solicitud()
        self._vencer_ultima(s)
        asignacion.avanzar(s)
        segunda = s.ofertas.order_by('-posicion').first()
        api = APIClient(SERVER_NAME='localhost')
        api.force_authenticate(segunda.profesional.usuario.user)
        r = api.post(f'/api/ofertas/{segunda.id}/aceptar/')
        self.assertEqual(r.status_code, 200)
        s.refresh_from_db()
        self.assertEqual(s.profesional, segunda.profesional)
        self.assertTrue(hasattr(s, 'conversacion'))
        self.assertEqual(s.ofertas.filter(estado='TOMADA').count(), 1)
        # el primero llega tarde
        primera = s.ofertas.get(posicion=1)
        api.force_authenticate(primera.profesional.usuario.user)
        self.assertEqual(api.post(f'/api/ofertas/{primera.id}/aceptar/').status_code, 400)


@override_settings(OFIX_GEOCODIFICAR=False)
class TerminarTrabajoTests(TestCase):
    """Marcar como terminado: el trabajo pasa al historial de quien lo marcó y se
    finaliza cuando confirman los dos."""

    def setUp(self):
        of = Oficio.objects.create(nombre='Plomero', slug='plomero')
        cu = Usuario.objects.create(user=User.objects.create_user('c@t.test', 'c@t.test', 'x'), telefono='1')
        self.cli = Cliente.objects.create(usuario=cu)
        d = Direccion.objects.create(usuario=cu, cliente=self.cli, calle='A', numero='1', localidad='CABA')
        pu = Usuario.objects.create(user=User.objects.create_user('p@t.test', 'p@t.test', 'x'), telefono='2')
        self.pro = Profesional.objects.create(usuario=pu, localidad_base='CABA', perfil_completo=True)
        self.s = SolicitudServicio.objects.create(cliente=self.cli, profesional=self.pro, oficio=of, direccion=d,
                                                  titulo='Pérdida', descripcion_problema='...', estado='ACEPTADA')
        self.api_pro = APIClient(SERVER_NAME='localhost')
        self.api_pro.force_authenticate(pu.user)
        self.api_cli = APIClient(SERVER_NAME='localhost')
        self.api_cli.force_authenticate(cu.user)

    def ids(self, api, url):
        return [x['id'] for x in api.get(url).data]

    def test_profesional_marca_terminado_pasa_al_historial(self):
        self.assertEqual(self.ids(self.api_pro, '/api/trabajos/?estado=pendientes'), [self.s.id])
        self.api_pro.post(f'/api/trabajos/{self.s.id}/completar/')
        self.assertEqual(self.ids(self.api_pro, '/api/trabajos/?estado=pendientes'), [])
        self.assertEqual(self.ids(self.api_pro, '/api/trabajos/?estado=historial'), [self.s.id])
        # al cliente todavía le queda confirmar: sigue en curso
        self.assertEqual(self.ids(self.api_cli, '/api/solicitudes/?estado=activas'), [self.s.id])

    def test_confirman_los_dos_queda_finalizado(self):
        self.api_pro.post(f'/api/trabajos/{self.s.id}/completar/')
        r = self.api_cli.post(f'/api/solicitudes/{self.s.id}/completar/')
        self.assertEqual(r.data['estado'], 'FINALIZADA')
        self.assertEqual(self.ids(self.api_cli, '/api/solicitudes/?estado=historial'), [self.s.id])
        self.assertEqual(self.ids(self.api_pro, '/api/trabajos/?estado=historial'), [self.s.id])
        self.pro.refresh_from_db()
        self.assertEqual(self.pro.servicios_realizados, 1)


@override_settings(OFIX_GEOCODIFICAR=False)
class PrivacidadTests(TestCase):
    def test_profesional_no_ve_direccion_antes_de_aceptar(self):
        of = Oficio.objects.create(nombre='Gasista', slug='gasista')
        cu = Usuario.objects.create(user=User.objects.create_user('c@t.test', 'c@t.test', 'x', first_name='Ana', last_name='Gómez'), telefono='111')
        cli = Cliente.objects.create(usuario=cu)
        d = Direccion.objects.create(usuario=cu, cliente=cli, calle='Secreta', numero='9', localidad='CABA', latitud=-34.6, longitud=-58.4)
        pu = Usuario.objects.create(user=User.objects.create_user('p@t.test', 'p@t.test', 'x'), telefono='2')
        pro = Profesional.objects.create(usuario=pu, localidad_base='CABA', perfil_completo=True)
        s = SolicitudServicio.objects.create(cliente=cli, oficio=of, direccion=d, titulo='Olor a gas', descripcion_problema='...')
        o = OfertaTrabajo.objects.create(solicitud=s, profesional=pro)
        api = APIClient(SERVER_NAME='localhost')
        api.force_authenticate(pu.user)
        data = api.get(f'/api/ofertas/{o.id}/').data['solicitud']
        self.assertIsNone(data['direccion_exacta'])
        self.assertIsNone(data['cliente_contacto'])
        self.assertEqual(data['cliente_nombre'], 'Ana G.')
