from . import asignacion


class AsignacionMiddleware:
    """Avanza la cascada de ofertas urgentes sin necesidad de cron.
    Se ejecuta como mucho una vez cada 15 segundos, después de responder."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith('/api/'):
            try:
                asignacion.procesar_pendientes()
            except Exception:
                pass
        return response
