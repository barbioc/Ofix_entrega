# Ofix: webapp para conectar con profesionales del hogar

Frontend en **Angular 20 + Bootstrap 5.3** conectado al backend **Django 5 + DRF + MySQL (XAMPP)**.

```
ofix-webapp/
├── backend/    Django (el proyecto original, ampliado)
└── frontend/   Angular
```

## Cómo levantarlo

### 1. Base de datos (XAMPP)
Iniciá MySQL desde el panel de XAMPP. La base se llama `Ofix` (ya existe en tu MariaDB).

> **Antes de migrar tu base `Ofix`, hacé un backup desde phpMyAdmin.** La migración `0002` agrega
> columnas y tablas nuevas y pasa las direcciones existentes al usuario. No borra datos.

### 2. Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py cargar_demo      # oficios + usuarios de prueba (opcional)
python manage.py runserver        # http://localhost:8000
```
Para crear sólo los 3 oficios sin usuarios de prueba: `python manage.py cargar_demo --solo-oficios`.

### 3. Frontend
```bash
cd frontend
npm install
npm start                         # http://localhost:4200
```
La URL del backend está en `frontend/src/environments/environment.ts`.

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

### Probar la cascada sin esperar 30 minutos
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

## Qué se agregó al backend

El backend original tenía los modelos y ViewSets abiertos, sin autenticación. Para que el frontend funcione se agregó:

- **Autenticación por token** (DRF `authtoken`) y **CORS** para Angular.
- **Archivos subidos** (`media/`): foto de perfil, certificaciones, fotos y videos del pedido y del chat.
- **Modelos nuevos**: `OfertaTrabajo` (cada envío de una solicitud a un profesional) y `AdjuntoSolicitud`.
- **Campos nuevos**: DNI, ciudad, provincia y foto en `Usuario`; departamento y provincia en `Direccion`
  (que ahora pertenece al usuario, como en el diagrama E-R); título y `busqueda_agotada` en `SolicitudServicio`;
  horarios y conexión manual en `Profesional`; adjuntos en `Mensaje`.
- **Permisos por rol**: cada usuario sólo ve sus datos. El cliente nunca ve teléfono, email, DNI ni dirección del
  profesional en el catálogo; el profesional ve la dirección exacta y el contacto del cliente **sólo después de aceptar**.
- **Geolocalización**: si la dirección no trae coordenadas ("Usar mi ubicación"), se calculan con OpenStreetMap
  (Nominatim). Sin internet, la dirección se guarda igual pero sin distancia.

### Asignación de urgencias (`core/asignacion.py`)
Usa `calcular_score_emergencia` tal cual el archivo *algoritmo asignacion.py*, con el radio de cobertura de cada profesional.

1. Se arma la lista de profesionales del oficio que están **tomando trabajos**, con perfil completo y dentro de su radio.
2. El de mayor score recibe la oferta y tiene **30 minutos de prioridad**.
3. Si no responde (o la rechaza), la oferta se envía **también** al siguiente. La toma el primero que acepta.
4. Si ninguno de los **primeros 5** la toma, el pedido vuelve a "Guardado" y el cliente recibe el aviso
   *"Los profesionales cercanos no pudieron responder a tiempo…"*, con un botón al catálogo para elegir a alguien.

No necesita cron: un middleware revisa los pedidos urgentes como mucho cada 15 segundos.
También existe `python manage.py procesar_asignaciones --loop` para correrlo aparte.

**Tomando trabajos**: se activa sólo dentro del horario cargado. Si el profesional se conecta o desconecta a mano,
ese estado dura hasta que empieza o termina su próxima franja horaria.

### Estados del pedido (diagrama de estados)
`CREADA` = Guardada, `NOTIFICANDO` = Asignada, `ACEPTADA`, `FINALIZADA` (cuando cliente y profesional lo marcan
terminado; después se califica) y `CANCELADA`.

### Endpoints principales (`/api/`)
| | |
|---|---|
| `auth/registro/`, `auth/login/`, `auth/logout/`, `auth/yo/`, `auth/password/`, `auth/email-disponible/`, `auth/recuperar/`, `auth/restablecer/` | Cuenta |
| `oficios/`, `direcciones/` | Datos base |
| `profesionales/?oficio=&q=&orden=&direccion=&en_cobertura=1`, `profesionales/{id}/resenas/` | Catálogo |
| `solicitudes/` + `enviar/`, `reintentar/`, `cancelar/`, `completar/`, `calificar/` | Pedidos del cliente |
| `profesional/yo/`, `profesional/yo/disponibilidad/`, `profesional/yo/resumen/`, `certificaciones/` | Perfil profesional |
| `ofertas/` + `aceptar/`, `rechazar/` · `trabajos/` + `completar/`, `cancelar/` | Trabajo del profesional |
| `conversaciones/`, `conversaciones/{id}/mensajes/?desde=` | Chat (texto, fotos y videos) |
| `notificaciones/`, `notificaciones/{id}/leer/`, `notificaciones/leer_todas/` | Notificaciones |

## Frontend

- **Diseño** basado en Figma: Bricolage Grotesque (títulos) y Figtree (texto), azul `#1553e0`, naranja `#ff6a13`,
  botones redondeados. El logo «ofix.» es el botón de inicio en todas las pantallas.
- **Landing** con hero y foto, Sobre Ofix, Cómo funciona, la simulación del algoritmo de urgencias y Contacto
  (el correo `contacto@ofix.com.ar` es de ejemplo: cambialo en `pages/landing/landing.html`).
- **Iniciar sesión** eligiendo Cliente o Profesional, y recuperar contraseña.
- **Registro multipaso** con barra de progreso: 3 pasos para clientes, 6 para profesionales
  (oficios y años, radio de 1 a 150 km, horarios, certificaciones). Si un profesional abandona después del paso 3,
  al volver a iniciar sesión continúa desde el paso 4.
- **Cliente**: inicio con los 3 botones de urgencia, ventana de nuevo pedido, catálogo con filtros,
  perfil del profesional con opiniones, pedidos con su estado en vivo, chat, perfil y configuración.
- **Profesional**: panel lateral, interruptor "Tomando trabajos", ofertas (urgentes primero, con cuenta regresiva)
  y trabajos pendientes, ficha completa para aceptar o rechazar, puntaje y opiniones, historial, chat y configuración.
- **Modo claro y oscuro** (sigue al sistema o se elige en el menú). Paleta tomada del logo:
  azul de la gota, gris de la llama (gasista), amarillo del rayo (electricista), celeste (plomero)
  y el rojo-naranja del rayo reservado para urgencias.
- El chat y las ofertas se actualizan por consulta periódica (cada 3 y 10 segundos).
