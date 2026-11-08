import time

from django.core.management.base import BaseCommand

from core import asignacion


class Command(BaseCommand):
    help = 'Avanza las asignaciones urgentes vencidas. Con --loop queda corriendo.'

    def add_arguments(self, parser):
        parser.add_argument('--loop', action='store_true')

    def handle(self, *args, **opts):
        while True:
            asignacion.procesar_pendientes(intervalo_seg=0)
            if not opts['loop']:
                break
            time.sleep(20)
