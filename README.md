# Ofix: webapp para conectar con profesionales del hogar
## Proyecto Final de la materia desarollo de Software UTN-FRD de los alumnos Barbara M. Ocampo y Benajmin H. Romero.


Frontend en **Angular 20 + Bootstrap 5.3** conectado al backend **Django 5 + DRF + MySQL (XAMPP)**.

```
ofix-webapp/
├── backend/    Django 
└── frontend/   Angular
```

### Cuentas de prueba (`cargar_demo`)
Contraseña de todas: `Ofix2026!`

| Rol | Email |
|---|---|
| Cliente | `ana.cliente@ofix.test` |
| Profesional (plomero, gasista) | `martin.pro@ofix.test` |
| Profesional (electricista) | `lucia.pro@ofix.test` |
| Profesional (gasista) | `diego.pro@ofix.test` |
| Profesional nueva (plomera, electricista) | `sofia.pro@ofix.test` |
| Profesional (electricista, gasista) | `ramiro.pro@ofix.test` |

### Probar la cascada sin esperar 5 minutos
```bash
set OFIX_PRIORIDAD_MINUTOS=1
python manage.py runserver
```

### Recuperar contraseña
"Olvidé mi contraseña" envía un enlace de un solo uso. En desarrollo el correo **se imprime en la consola
del backend** (no hace falta configurar un servidor de correo) y la pantalla muestra el enlace directamente.
Para enviar correos reales, configurá `EMAIL_BACKEND`, `EMAIL_HOST`, etc. en `settings.py`.

### Tests del backend
```bash
python manage.py test core
```
Cubren el algoritmo de asignación, el paso al siguiente profesional, el aviso cuando ninguno de los 5 responde,
que una oferta tomada no se pueda aceptar dos veces, y que el profesional no vea la dirección antes de aceptar.

---
