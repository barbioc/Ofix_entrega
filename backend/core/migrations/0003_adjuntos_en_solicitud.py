"""Las fotos del pedido pasan a guardarse en la misma fila de la solicitud.

Antes vivían en la tabla core_adjuntosolicitud. Esta migración copia lo que haya
a la nueva columna `adjuntos` y después borra esa tabla.
"""
from django.db import migrations, models
import django.db.models.deletion


def copiar_adjuntos(apps, schema_editor):
    Solicitud = apps.get_model('core', 'SolicitudServicio')
    Adjunto = apps.get_model('core', 'AdjuntoSolicitud')
    por_solicitud = {}
    for a in Adjunto.objects.order_by('id'):
        por_solicitud.setdefault(a.solicitud_id, []).append({'archivo': a.archivo.name, 'tipo': a.tipo})
    for sid, lista in por_solicitud.items():
        Solicitud.objects.filter(pk=sid).update(adjuntos=lista)


def devolver_adjuntos(apps, schema_editor):
    Solicitud = apps.get_model('core', 'SolicitudServicio')
    Adjunto = apps.get_model('core', 'AdjuntoSolicitud')
    for s in Solicitud.objects.exclude(adjuntos=[]):
        for a in s.adjuntos or []:
            Adjunto.objects.create(solicitud_id=s.pk, archivo=a['archivo'], tipo=a.get('tipo', 'imagen'))


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_ampliacion_frontend'),
    ]

    operations = [
        # Libera el nombre "adjuntos", que usaba la relación inversa de la tabla vieja.
        migrations.AlterField(
            model_name='adjuntosolicitud',
            name='solicitud',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                    related_name='adjuntos_viejos', to='core.solicitudservicio'),
        ),
        migrations.AddField(
            model_name='solicitudservicio',
            name='adjuntos',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(copiar_adjuntos, devolver_adjuntos),
        migrations.DeleteModel(name='AdjuntoSolicitud'),
    ]
