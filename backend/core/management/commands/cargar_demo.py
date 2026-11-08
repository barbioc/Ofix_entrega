"""Carga oficios y usuarios de prueba (contraseña de todos: Ofix2026!)."""
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Usuario, Cliente, Profesional, Direccion, Oficio, ExperienciaOficio

OFICIOS = [
    ('Gasista', 'gasista', 'Instalaciones y pérdidas de gas, calefones, estufas y cocinas.'),
    ('Electricista', 'electricista', 'Instalaciones eléctricas, tableros, cortes y cableado.'),
    ('Plomero', 'plomero', 'Pérdidas de agua, cañerías, desagües, tanques y sanitarios.'),
]
TODA_LA_SEMANA = [{'dia': d, 'desde': '00:00', 'hasta': '23:59'} for d in range(7)]
PASSWORD = 'Ofix2026!'

PROS = [
    # email, nombre, apellido, calle, nro, lat, lng, oficios {slug: años}, puntaje, servicios, radio, validado
    ('martin.pro@ofix.test', 'Martín', 'Rossi', 'Av. Corrientes', '3200', -34.6037, -58.4110, {'plomero': 12, 'gasista': 6}, 4.8, 37, 20, True),
    ('lucia.pro@ofix.test', 'Lucía', 'Fernández', 'Av. Cabildo', '1800', -34.5627, -58.4560, {'electricista': 9}, 4.6, 22, 25, True),
    ('diego.pro@ofix.test', 'Diego', 'Benítez', 'Av. Rivadavia', '6100', -34.6265, -58.4440, {'gasista': 15}, 4.9, 61, 15, True),
    ('sofia.pro@ofix.test', 'Sofía', 'Acosta', 'Av. Santa Fe', '2500', -34.5960, -58.4020, {'plomero': 3, 'electricista': 2}, 0, 0, 12, False),
    ('ramiro.pro@ofix.test', 'Ramiro', 'Quiroga', 'Av. San Juan', '1500', -34.6225, -58.3880, {'electricista': 20, 'gasista': 4}, 4.2, 14, 30, True),
]


class Command(BaseCommand):
    help = 'Carga oficios y datos de prueba.'

    def add_arguments(self, parser):
        parser.add_argument('--solo-oficios', action='store_true')

    @transaction.atomic
    def handle(self, *args, **opts):
        oficios = {}
        for nombre, slug, desc in OFICIOS:
            o, _ = Oficio.objects.update_or_create(nombre=nombre, defaults={'slug': slug, 'descripcion': desc})
            oficios[slug] = o
        self.stdout.write(self.style.SUCCESS('Oficios listos.'))
        if opts['solo_oficios']:
            return

        for email, nom, ape, calle, nro, lat, lng, ofs, punt, serv, radio, ok in PROS:
            if User.objects.filter(username=email).exists():
                continue
            user = User.objects.create_user(email, email, PASSWORD, first_name=nom, last_name=ape)
            u = Usuario.objects.create(user=user, telefono='11 5555-0' + str(len(nom)) + '00', dni='30111222',
                                       ciudad='CABA', provincia='Buenos Aires')
            pro = Profesional.objects.create(usuario=u, localidad_base='CABA', puntaje_promedio=punt,
                                             servicios_realizados=serv, radio_cobertura_km=radio,
                                             horarios=TODA_LA_SEMANA, perfil_completo=True,
                                             estado_validacion='APROBADO' if ok else 'PENDIENTE',
                                             descripcion=f'{nom} trabaja en CABA y alrededores. Presupuesto sin cargo.')
            Direccion.objects.create(usuario=u, calle=calle, numero=nro, localidad='CABA', provincia='Buenos Aires',
                                     latitud=lat, longitud=lng, es_principal=True, alias='Base')
            for slug, anios in ofs.items():
                ExperienciaOficio.objects.create(profesional=pro, oficio=oficios[slug], anios_experiencia=anios)

        if not User.objects.filter(username='ana.cliente@ofix.test').exists():
            user = User.objects.create_user('ana.cliente@ofix.test', 'ana.cliente@ofix.test', PASSWORD,
                                            first_name='Ana', last_name='Gómez')
            u = Usuario.objects.create(user=user, telefono='11 4444-1234', ciudad='CABA', provincia='Buenos Aires')
            c = Cliente.objects.create(usuario=u)
            Direccion.objects.create(usuario=u, cliente=c, calle='Av. Medrano', numero='950', departamento='4B',
                                     localidad='CABA', provincia='Buenos Aires', latitud=-34.5985, longitud=-58.4200,
                                     es_principal=True, alias='Casa')
        self.stdout.write(self.style.SUCCESS(f'Usuarios de prueba listos (contraseña: {PASSWORD}).'))
