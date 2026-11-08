from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'oficios', views.OficioViewSet, basename='oficio')
router.register(r'direcciones', views.DireccionViewSet, basename='direccion')
router.register(r'profesionales', views.ProfesionalViewSet, basename='profesional')
router.register(r'certificaciones', views.CertificacionViewSet, basename='certificacion')
router.register(r'solicitudes', views.SolicitudViewSet, basename='solicitud')
router.register(r'ofertas', views.OfertaViewSet, basename='oferta')
router.register(r'trabajos', views.TrabajoViewSet, basename='trabajo')
router.register(r'conversaciones', views.ConversacionViewSet, basename='conversacion')
router.register(r'notificaciones', views.NotificacionViewSet, basename='notificacion')

urlpatterns = [
    path('auth/registro/', views.registro),
    path('auth/login/', views.login),
    path('auth/logout/', views.logout),
    path('auth/email-disponible/', views.email_disponible),
    path('auth/yo/', views.yo),
    path('auth/password/', views.cambiar_password),
    path('auth/recuperar/', views.recuperar_password),
    path('auth/restablecer/', views.restablecer_password),
    path('profesional/yo/', views.profesional_yo),
    path('profesional/yo/disponibilidad/', views.disponibilidad),
    path('profesional/yo/resumen/', views.profesional_resumen),
    path('', include(router.urls)),
]
