# Backend de HogarFix

Backend independiente del frontend, desarrollado con Node.js y Express.

## Estructura y responsabilidades

- `src/config/`: inicialización diferida de Firebase Admin mediante Application Default Credentials.
- `src/routes/`: rutas de identidad, perfiles, aprobación administrativa y solicitudes; `GET /api/health` está montada directamente en `src/app.js`.
- `src/controllers/`: adaptación entre las rutas HTTP y los servicios.
- `src/services/`: validación y persistencia de perfiles y solicitudes, y elegibilidad profesional.
- `src/middlewares/`: verificación de Firebase ID tokens, rol de perfil y claim administrativo.

## Credenciales

El puerto se configura mediante la variable de entorno `PORT` (predeterminado: `3000`). Firebase Admin utiliza Application Default Credentials (ADC); define `FIREBASE_PROJECT_ID` en `.env` y proporciona credenciales ADC al entorno. En desarrollo local puedes autenticarte con `gcloud auth application-default login` o configurar `GOOGLE_APPLICATION_CREDENTIALS` con una ruta a una clave almacenada fuera del repositorio.

Nunca copies una clave de servicio al repositorio ni la incluyas en una imagen o artefacto. Usa una identidad administrada/ADC en producción y guarda cualquier secreto de desarrollo fuera de Git.

Configura `CORS_ORIGINS` como una lista separada por comas con los orígenes permitidos para el frontend. La plantilla incluye Live Server y el origen de GitHub Pages.

## Instalación y ejecución

Desde esta carpeta:

```powershell
npm install
npm start
```

El servidor inicia en el puerto `3000` por defecto. Para usar otro puerto, define `PORT` en el entorno o en `.env`.

## Comprobación de salud

Con el servidor en ejecución, consulta:

```text
GET http://localhost:3000/api/health
```

La respuesta correcta es HTTP 200:

```json
{
  "status": "ok",
  "message": "Servidor de HogarFix funcionando correctamente"
}
```

Las rutas inexistentes responden HTTP 404 en JSON.

## Autenticación y autorización

## Documentación de endpoints

Todas las rutas utilizan el prefijo `/api`.

| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/health` | Público | Comprueba el estado del servidor |
| GET | `/api/client/me` | Cliente autenticado | Consulta la identidad del cliente |
| GET | `/api/provider/me` | Proveedor autenticado | Consulta la identidad del proveedor |
| GET | `/api/profile/me` | Usuario autenticado | Consulta el perfil propio |
| PATCH | `/api/profile/me` | Usuario autenticado | Actualiza el perfil propio |
| GET | `/api/provider/profile/me` | Proveedor autenticado | Consulta el perfil profesional |
| PATCH | `/api/provider/profile/me` | Proveedor autenticado | Actualiza el perfil profesional |
| GET | `/api/provider/eligibility` | Proveedor autenticado | Consulta su elegibilidad |
| PATCH | `/api/admin/providers/:uid/approval` | Administrador | Actualiza la aprobación de un proveedor |
| POST | `/api/solicitudes` | Cliente autenticado | Crea una solicitud de servicio |
| GET | `/api/solicitudes` | Cliente autenticado | Lista las solicitudes propias |
| GET | `/api/solicitudes/:id` | Cliente autenticado | Consulta una solicitud propia |
| PATCH | `/api/solicitudes/:id/confirmar` | Cliente autenticado | Confirma una solicitud |
| PATCH | `/api/solicitudes/:id/cancelar` | Cliente autenticado | Cancela una solicitud |
| GET | `/api/provider/solicitudes` | Proveedor autenticado | Lista solicitudes asignadas |
| GET | `/api/provider/solicitudes/:id` | Proveedor autenticado | Consulta una solicitud asignada |
| PATCH | `/api/provider/solicitudes/:id/aceptar` | Proveedor autenticado | Acepta una solicitud |
| PATCH | `/api/provider/solicitudes/:id/rechazar` | Proveedor autenticado | Rechaza una solicitud |
| PATCH | `/api/provider/solicitudes/:id/iniciar` | Proveedor autenticado | Inicia un servicio |
| PATCH | `/api/provider/solicitudes/:id/completar` | Proveedor autenticado | Marca un servicio como completado |
| GET/PATCH | `/api/provider/especialidades` | Proveedor autenticado | Consulta/actualiza las categorías que ofrece |
| GET/PATCH | `/api/provider/disponibilidad` | Proveedor autenticado | Consulta/actualiza días y horarios de atención |
| GET | `/api/provider/earnings` | Proveedor autenticado | Resumen de ingresos estimados |
| GET | `/api/provider/earnings/breakdown` | Proveedor autenticado | Detalle de ingresos por servicio |
| GET | `/api/solicitudes/:id/calificacion` | Cliente autenticado | Consulta la calificación de un servicio propio |
| POST | `/api/solicitudes/:id/calificacion` | Cliente autenticado | Califica un servicio completado (1 a 5) |
| GET | `/api/provider/:uid/calificaciones` | Usuario autenticado | Promedio y reseñas de un proveedor |
| GET | `/api/notifications` | Usuario autenticado | Lista las notificaciones propias |
| PATCH | `/api/notifications/:id/read` | Usuario autenticado | Marca como leída una notificación propia |
| GET | `/api/support/faqs` | Usuario autenticado | Preguntas frecuentes |
| POST | `/api/support/messages` | Usuario autenticado | Crea un caso de soporte |

### Convenciones de la API

- `GET`: consultar información.
- `POST`: crear recursos.
- `PATCH`: actualizar parcialmente un recurso o cambiar su estado.
- Los identificadores dinámicos se representan con parámetros como `:id` y `:uid`.
- Las rutas privadas requieren un token Firebase en la cabecera `Authorization`.
- Las respuestas se entregan en formato JSON.
- Los errores utilizan códigos HTTP apropiados y una respuesta con `status: "error"` y `message`.
- Las respuestas exitosas utilizan `status: "ok"`.


Las rutas privadas requieren `Authorization: Bearer <Firebase ID token>`. El middleware verifica firma, vencimiento y revocación mediante Firebase Admin y obtiene el rol desde `users/{uid}` en Firestore; nunca confía en un rol enviado por el cliente.

- `GET /api/client/me`: requiere el rol `Cliente`.
- `GET /api/provider/me`: requiere el rol `Proveedor`.
- `GET/PATCH /api/profile/me`: consulta y actualiza datos personales propios.
- `GET/PATCH /api/provider/profile/me`: consulta y actualiza el perfil profesional propio; conserva la aprobación bajo control administrativo.
- `GET /api/provider/eligibility`: informa si el proveedor puede ofrecer servicios.
- `PATCH /api/admin/providers/:uid/approval`: requiere el custom claim `admin: true` del token Firebase y solo permite decidir sobre perfiles completos con validación automática aprobada. No existe una ruta para otorgar este claim.
- `POST /api/solicitudes`: requiere el rol `Cliente` y `Idempotency-Key`; el UID del cliente procede del token verificado.
- `GET /api/solicitudes` y `GET /api/solicitudes/:id`: consulta las solicitudes del cliente autenticado y su detalle propio.
- `PATCH /api/solicitudes/:id/confirmar` y `/cancelar`: confirma solicitudes aceptadas o cancela solicitudes pendientes/aceptadas.
- `GET /api/provider/solicitudes` y `GET /api/provider/solicitudes/:id`: consulta las solicitudes asignadas al proveedor autenticado.
- `PATCH /api/provider/solicitudes/:id/aceptar`, `/rechazar`, `/iniciar` y `/completar`: aplica únicamente la transición correspondiente al estado actual.
- `GET /api/notifications` y `PATCH /api/notifications/:id/read`: lista notificaciones propias y permite marcarlas como leídas.
- `GET /api/support/faqs` y `POST /api/support/messages`: consulta preguntas frecuentes estáticas y registra un mensaje de soporte (`subject` de 3–120 caracteres y `message` de 10–3000).

Las rutas de identidad devuelven únicamente la identidad asociada al token verificado. Las rutas de perfil devuelven solo los datos del usuario autenticado. Un token ausente/inválido responde 401; un rol o perfil no autorizado responde 403; un fallo de Firebase responde 503.

Las rutas de solicitudes pasan al servicio únicamente `request.auth.uid` y `request.auth.role`; no toman identidad ni rol del body, query o ruta. El servicio verifica la propiedad/asignación y responde 404 para solicitudes ajenas. La creación usa `providerCatalog/{catalogId}` y `categories/{categoryId}` administrados en Firestore; no hay asociaciones ni categorías sembradas por estas rutas.

La elegibilidad consulta el perfil/estado de Firebase Authentication fuera de la transacción Firestore. Firebase Authentication y Firestore no comparten una transacción atómica; una cuenta podría deshabilitarse entre esa comprobación y el commit. La aceptación vuelve a comprobar elegibilidad antes de la transacción y vuelve a validar el perfil dentro de ella, pero no elimina esa ventana para el estado de Authentication. Al aceptar, el servicio rechaza la solicitud si el proveedor ya tiene otro servicio asignado en ese horario (`PROVIDER_SCHEDULE_CONFLICT`).

## Pruebas automatizadas

Desde esta carpeta, ejecuta `npm test` para correr explícitamente los 9 archivos de pruebas automatizadas `test/*.test.js`: aplicación, manejo de errores, autenticación, perfiles, rutas y servicio de solicitudes, validación, calificaciones y soporte, e ingresos del proveedor. La lista explícita mantiene separadas las pruebas de integración que están dentro de `test/integration/`.

Las pruebas HTTP de solicitudes levantan Express localmente y usan verificadores de token, perfiles y servicios simulados. Las pruebas del servicio de solicitudes usan un doble `MemoryFirestore` y un servicio de elegibilidad simulado; las de validación ejercitan funciones sin Firebase. Estos dobles permiten probar el mapeo de rutas, las reglas de negocio y las respuestas previstas, pero no demuestran atomicidad, concurrencia, reintentos ni comportamiento de índices de Firebase real.

Las transiciones guardan la notificación de estado junto con el cambio y el evento de auditoría en la misma transacción. El destinatario es el otro participante de la solicitud. Las notificaciones se leen filtrando `recipientUid`; el servicio no acepta un UID objetivo del cliente. Los casos de soporte se escriben en `supportMessages` y las FAQs del backend no requieren persistencia.

La creación de una solicitud deja dos documentos `reminders` (uno por participante) bajo la solicitud, con `deliverAt` 24 horas antes del servicio y estado `pending`. Cancelación, rechazo y finalización cambian los recordatorios pendientes a `cancelled`. Esto deja la cola preparada para un worker programado; el backend actual no envía push ni ejecuta un scheduler.

Antes de una integración real, las operaciones de Firestore deben validarse con Firebase Emulator: transacciones y sus reintentos, concurrencia de claves de idempotencia, consultas e índices y persistencia de eventos. Las pruebas del middleware y de autenticación con Firebase también deben verificarse en el entorno de Emulator. Firebase Admin SDK omite Firestore Rules, por lo que las reglas requieren pruebas separadas con un cliente Firebase no administrativo. No se afirma que las pruebas actuales sustituyan esas verificaciones.

## Firestore Emulator local

El entorno local usa exclusivamente el proyecto de demostración `demo-hogarfix`. Desde esta carpeta, ejecuta `npm install` una vez y luego:

```powershell
npm.cmd test
npm.cmd run test:emulator
```

`npm test` conserva la suite actual. `test:emulator` usa Firebase CLI con `--config ..\firebase.json` (la configuración está en la raíz del repositorio), `--project demo-hogarfix` y solo inicia Firestore Emulator en `127.0.0.1:8080`. La interfaz de Emulator, si se necesita, queda limitada a `127.0.0.1:4000`. Tras la prueba de humo, el runner ejecuta `test/integration/request-service.integration.js`.

Antes de probar, `scripts/run-emulator-tests.js` exige que el proyecto informado por Firebase CLI y cualquier variable de proyecto adicional coincidan exactamente con `demo-hogarfix`. También exige `FIRESTORE_EMULATOR_HOST` en `localhost`, `127.0.0.1` o `::1` y puerto `8080`; rechaza configuración contradictoria y la presencia de `GOOGLE_APPLICATION_CREDENTIALS` o `FIREBASE_TOKEN`. La prueba de humo usa HTTP directamente contra ese host local, no importa Firebase Admin, ADC ni credenciales. Crea un documento temporal con ID aleatorio, comprueba escritura y lectura y lo elimina en un bloque `finally`.

Las pruebas de integración de solicitudes usan `@google-cloud/firestore` conectado explícitamente al host local validado, con proyecto `demo-hogarfix`; no usan un doble de Firestore. El transporte recibe un proveedor de autenticación vacío, porque el emulador local no requiere credenciales; esto evita que el cliente busque ADC y no sustituye operaciones de Firestore. El servicio real de perfiles consulta los documentos del emulador al comprobar la elegibilidad. Se sustituye únicamente `auth.getUser`, porque Authentication Emulator no forma parte de esta etapa; esa sustitución controla el estado externo de la cuenta y no simula datos ni operaciones de Firestore. Los fixtures registran la limpieza con `testContext.after()`, que invoca `cleanup()` al terminar cada prueba. Los documentos creados directamente por el fixture usan `create()` y solo se registran para limpieza tras crearse; para la categoría, el fixture prueba los IDs admitidos y crea una categoría únicamente si encuentra un documento inexistente, sin sobrescribir ni borrar categorías preexistentes. Si todos los IDs admitidos ya existen, la preparación falla de forma segura. La limpieza elimina las referencias creadas por el fixture y las subcolecciones de sus solicitudes. El emulador también se cierra al terminar y no se exportan datos.

Esta ejecución no prueba Firebase Authentication Emulator ni Firestore Rules. Como `firebase.json` no carga un archivo de reglas en esta etapa, Firestore Emulator permite lecturas y escrituras abiertas; su host está limitado a loopback y el proyecto es de demostración. Las pruebas de transacciones y concurrencia verifican el comportamiento observado en el emulador, no garantizan la semántica o el rendimiento de producción. No se ejecutan despliegues ni se contacta Firebase real.

Para comprobar solo las condiciones del guard, sin conectarse ni escribir datos:

```powershell
$env:GCLOUD_PROJECT = "demo-hogarfix"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
node scripts/run-emulator-tests.js --check
```

El emulador se configura sin cargar `firestore.rules`; esta etapa no valida reglas ni solicitudes. No copies credenciales de producción al entorno local.

Antes de usar el panel administrativo, un administrador confiable debe asignar `admin: true` mediante un flujo seguro de Firebase Admin fuera de este backend.

El backend escribe con Firebase Admin SDK y por ello omite las reglas de Firestore. Las rutas aplican allowlists de campos y usan el UID del token; las reglas desplegadas siguen siendo necesarias para las escrituras directas desde el frontend.

El frontend actual y su despliegue en GitHub Pages permanecen en la raíz del repositorio. Esta carpeta no forma parte del artefacto publicado por Pages.
