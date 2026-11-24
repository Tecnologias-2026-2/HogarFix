# 🌐 HogarFix
**Calidad en cada arreglo**

Proyecto enfocado en conectar a personas que necesitan servicios para el hogar con proveedores calificados, mediante una plataforma digital accesible, organizada y transparente que utiliza un modelo de tarifa fija por categoría de servicio.

## 📑 Contenido

1. [Objetivo general](#-1-objetivo-general)
2. [Contexto de uso](#-2-contexto-de-uso)
3. [Requerimientos del sistema](#-3-requerimientos-del-sistema)
4. [Diagramas UML](#-4-diagramas-uml)
5. [Prototipo en Figma](#-5-prototipo-en-figma)
6. [Modelo de datos](#%EF%B8%8F-6-modelo-de-datos)
7. [Documentación del sistema](#-7-documentación-del-sistema)
8. [Instalación y ejecución](#-8-instalación-y-ejecución)
9. [Despliegue](#-9-despliegue)
10. [Seguridad y archivos sensibles](#-10-seguridad-y-archivos-sensibles)
11. [Estado del proyecto](#-11-estado-del-proyecto)

## 👥 Integrantes

- Laura Valentina Bojacá Sánchez – 1202561
- Sebastián Gómez Ramírez – 1202821
- Juan José Gutiérrez – 1202997
- Sebastián Torres – 1202

## 🎯 1. Objetivo general

Desarrollar una plataforma digital que facilite la contratación de servicios para el hogar, como plomería, electricidad, jardinería y aseo general, conectando a clientes con proveedores calificados mediante un sistema de tarifas fijas por categoría. HogarFix busca solucionar los problemas de informalidad, falta de transparencia en los precios, incertidumbre sobre la disponibilidad de los proveedores y dificultades para encontrar personal de confianza. Para ello, permite consultar los precios antes de realizar una solicitud, programar los servicios, gestionar su aceptación y seguimiento, recibir notificaciones y calificar a los proveedores, mejorando así la confianza, la organización y la eficiencia durante el proceso de contratación.

## 🌍 2. Contexto de uso

HogarFix está dirigido a dos tipos principales de usuarios: los clientes que necesitan contratar servicios de reparación o mantenimiento para su hogar y los proveedores que ofrecen servicios técnicos u operativos, como plomería, electricidad, jardinería y aseo general.

Los clientes pueden utilizar la plataforma desde un dispositivo web o móvil para registrarse, consultar las categorías disponibles y sus tarifas fijas, solicitar un servicio indicando la fecha, hora, ubicación y descripción del trabajo, consultar los proveedores que aceptaron la solicitud, confirmar el servicio y calificar la atención recibida. Por su parte, los proveedores pueden gestionar su perfil, consultar las solicitudes correspondientes a sus especialidades, aceptarlas o rechazarlas, administrar sus servicios y consultar su historial e ingresos. Ambos usuarios pueden recibir notificaciones y acceder al módulo de soporte cuando necesiten ayuda.

## 📋 3. Requerimientos del sistema

### 3.1 Requerimientos funcionales

**RF01. Registro de usuarios:** El sistema debe permitir registrar usuarios con sus datos personales y seleccionar el tipo de cuenta: cliente o proveedor.

**RF02. Inicio de sesión:** El sistema debe permitir iniciar sesión mediante correo electrónico o número celular y contraseña.

**RF03. Recuperación de contraseña:** El sistema debe permitir solicitar por correo instrucciones para restablecer la contraseña mediante Firebase Authentication.

**RF04. Consulta de categorías y tarifas:** El sistema debe mostrar las categorías de servicios para el hogar y sus respectivas tarifas fijas.

**RF05. Solicitud de servicios:** El sistema debe permitir al cliente solicitar un servicio indicando la categoría, fecha, hora, ubicación y descripción del trabajo requerido.

**RF06. Visualización de proveedores:** El sistema debe permitir al cliente consultar los proveedores que aceptaron su solicitud y sus calificaciones promedio.

**RF07. Confirmación del servicio:** El sistema debe permitir al cliente confirmar un servicio aceptado por un proveedor y generar un resumen tipo factura con los datos de la contratación.

**RF08. Gestión de solicitudes:** El sistema debe permitir al proveedor consultar las solicitudes de sus categorías de servicio y aceptarlas o rechazarlas sin modificar la tarifa fija.

**RF09. Historial de servicios:** El sistema debe permitir a clientes y proveedores consultar el historial y el estado de los servicios.

**RF10. Calificación del proveedor:** El sistema debe permitir al cliente calificar al proveedor de una a cinco estrellas y dejar un comentario una vez finalizado el servicio.

**RF11. Notificaciones:** El sistema debe notificar a los usuarios sobre los cambios de estado de las solicitudes y los recordatorios de los servicios programados.

**RF12. Soporte:** El sistema debe ofrecer preguntas frecuentes y permitir enviar mensajes al equipo de soporte.

**RF13. Gestión del perfil:** El sistema debe permitir a los usuarios consultar y editar su información personal y, en el caso del proveedor, gestionar sus categorías y disponibilidad.

**RF14. Consulta de ingresos:** El sistema debe permitir al proveedor consultar sus ingresos acumulados y su desglose por periodo a partir de los servicios pagados.

### 3.2 Requerimientos no funcionales

**RNF01. Usabilidad:** La interfaz debe ser intuitiva y facilitar la navegación de clientes y proveedores.

**RNF02. Diseño adaptable:** La plataforma debe presentar una interfaz responsive que se adapte a diferentes tamaños de pantalla y dispositivos.

**RNF03. Seguridad:** El sistema debe proteger la información de los usuarios mediante autenticación y reglas de acceso según el rol y los permisos correspondientes.

**RNF04. Integridad de tarifas:** Las tarifas deben mantenerse fijas según la categoría del servicio y no deben poder ser modificadas por el cliente ni por el proveedor durante la solicitud.

**RNF05. Sincronización:** La información de las solicitudes, asignaciones, servicios y notificaciones debe mantenerse sincronizada en tiempo real mediante Firebase.

**RNF06. Persistencia:** Los datos registrados deben almacenarse de forma persistente en la base de datos para permitir su consulta posterior.

**RNF07. Organización modular:** El sistema debe separar las funcionalidades de autenticación, gestión del cliente, gestión del proveedor, servicios, notificaciones y soporte para facilitar su mantenimiento y evolución.

## 🧠 4. Diagramas UML

### 4.1 Diagrama de casos de uso

Representa las funcionalidades principales de HogarFix y cómo interactúan con ellas el cliente, el proveedor y el sistema (que envía las notificaciones automáticas).

```mermaid
flowchart LR
  Cliente((Cliente))
  Proveedor((Proveedor))
  Sistema((Sistema))

  subgraph HogarFix
    UC1([Registrarse / iniciar sesión])
    UC2([Consultar categorías y tarifas])
    UC3([Buscar y ver proveedores])
    UC4([Solicitar servicio])
    UC5([Confirmar servicio y ver resumen])
    UC6([Consultar historial])
    UC7([Calificar proveedor])
    UC8([Gestionar perfil y disponibilidad])
    UC9([Aceptar o rechazar solicitudes])
    UC10([Actualizar estado del servicio])
    UC11([Consultar ingresos])
    UC12([Enviar notificaciones])
    UC13([Chat y soporte])
  end

  Cliente --- UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7 & UC13
  Proveedor --- UC1 & UC8 & UC9 & UC10 & UC11 & UC6 & UC13
  Sistema --- UC12
```

### 4.2 Diagrama de secuencia: solicitud de un servicio a tarifa fija

```mermaid
sequenceDiagram
  actor C as Cliente
  participant F as Frontend
  participant B as Backend (Express)
  participant DB as Firestore
  actor P as Proveedor

  C->>F: Abre "Buscar" y elige categoría
  F->>B: GET /categorias
  B->>DB: Leer categorías y tarifas
  DB-->>B: Categorías
  B-->>F: Categorías con tarifa fija
  C->>F: Elige proveedor y llena el formulario
  F->>F: Valida campos obligatorios
  F->>B: POST /solicitudes (sin precio)
  B->>DB: Guardar solicitud con la tarifa de la categoría
  B-->>F: Solicitud creada (estado Pendiente)
  B-->>P: Notificación de nueva solicitud
  P->>B: Acepta la solicitud
  B->>DB: Estado = Aceptada
  B-->>C: Notificación "solicitud aceptada"
  C->>F: Confirma la contratación
  F->>B: PATCH /solicitudes/:id/confirmar
  B->>DB: Estado = Confirmada
  B-->>F: Resumen de contratación
```

### 4.3 Estados de una solicitud

```mermaid
stateDiagram-v2
  [*] --> Pendiente: el cliente envía la solicitud
  Pendiente --> Aceptada: el proveedor acepta
  Pendiente --> Rechazada: el proveedor rechaza
  Aceptada --> Confirmada: el cliente confirma
  Pendiente --> Cancelada: el cliente cancela
  Aceptada --> Cancelada: el cliente cancela
  Confirmada --> EnProceso: el proveedor inicia
  EnProceso --> Completada: el proveedor termina
  Completada --> [*]
  Rechazada --> [*]
  Cancelada --> [*]
```

## 🎨 5. Prototipo en Figma

[Prototipo público de HogarFix en Figma](https://www.figma.com/design/QyHoaWKuAh0UaloG1XTRh8/HogarFix?node-id=532-421&t=BvIlGCNIAR99rQAw-1)

## 🗄️ 6. Modelo de datos

HogarFix guarda la información en **Cloud Firestore**. El backend (Firebase Admin) es el único que escribe en las colecciones de solicitudes, calificaciones, notificaciones y soporte; el navegador solo lee y edita su propio documento en `users/{uid}` (ver `firestore.rules`). Los nombres de colecciones y campos de este diagrama son los mismos que usa el código en `backend/src/services/` y `js/services/auth.js`.

```mermaid
erDiagram
  users ||--o| providerProfiles : "si es Proveedor"
  users ||--o{ solicitudes : "crea (clientUid)"
  providerProfiles ||--o{ solicitudes : "atiende (providerUid)"
  providerCatalog ||--o{ solicitudes : "se elige en (providerCatalogId)"
  categories ||--o{ solicitudes : "fija la tarifa (categoryId)"
  providerProfiles ||--o{ providerCatalog : "aparece en"
  solicitudes ||--o{ events : "historial de estados"
  solicitudes ||--o{ reminders : "recordatorios"
  solicitudes ||--o| ratings : "recibe (mismo id)"
  solicitudes ||--o{ notifications : "genera"
  users ||--o{ notifications : "recibe (recipientUid)"
  users ||--o{ supportMessages : "envía (uid)"
  solicitudes ||--o| requestIdempotency : "evita duplicados"

  users {
    string uid PK "id del documento = UID de Firebase Auth"
    string email
    string firstName
    string lastName
    string phone
    string role "Cliente | Proveedor"
    timestamp createdAt
  }
  providerProfiles {
    string uid PK "mismo UID del usuario"
    string bio
    number experienceYears
    string coverageZone
    string availability
    string[] services "ids de categories"
    map automaticValidation "status, missingFields, checkedAt"
    map adminApproval "status, reviewedAt, reviewedBy"
    number ratingAverage
    number ratingCount
    timestamp updatedAt
  }
  categories {
    string id PK "plomeria, electricidad, jardineria, aseo-general"
    string name
    number fixedPriceCOP "tarifa fija"
    number durationMinutes
    boolean active
  }
  providerCatalog {
    string id PK
    string providerUid FK
    boolean active
  }
  solicitudes {
    string id PK
    number schemaVersion
    string clientUid FK
    string providerUid FK
    string providerCatalogId FK
    string categoryId FK
    map categorySnapshot "name, priceCOP, durationMinutes"
    map providerSnapshot "displayName"
    string clientDisplayName
    string date
    string time
    timestamp scheduledAt
    timestamp scheduledEndAt
    string timeZone
    string address
    string detail
    string status "Pendiente, Aceptada, Confirmada, En proceso, Completada, Rechazada, Cancelada"
    timestamp createdAt
    timestamp updatedAt
  }
  events {
    string type "created | status_changed"
    string actorUid
    string actorRole
    string fromStatus
    string toStatus
    timestamp createdAt
  }
  reminders {
    string id PK "cliente | proveedor"
    string requestId FK
    string recipientUid FK
    string recipientRole
    timestamp scheduledAt
    timestamp deliverAt "24 h antes"
    string status "pending | cancelled"
  }
  ratings {
    string id PK "= id de la solicitud (una por servicio)"
    string serviceId FK
    string clientUid FK
    string clientDisplayName
    string providerUid FK
    number rating "1 a 5"
    string comment
    timestamp createdAt
  }
  notifications {
    string id PK
    string recipientUid FK
    string type "request_status_changed"
    string requestId FK
    string fromStatus
    string toStatus
    string actorRole
    timestamp readAt
    timestamp createdAt
  }
  supportMessages {
    string id PK
    string uid FK
    string role
    string subject
    string message
    string status "open"
    timestamp createdAt
  }
  requestIdempotency {
    string id PK "clave Idempotency-Key"
    string requestId FK
    string payloadHash
    timestamp createdAt
  }
```

`events` y `reminders` son subcolecciones de cada documento de `solicitudes` (`solicitudes/{id}/events` y `solicitudes/{id}/reminders`). Las preguntas frecuentes del módulo de soporte son contenido fijo del backend y no se guardan en Firestore.

**Reglas del modelo**

- La tarifa no la envía el cliente: el backend copia `fixedPriceCOP` de `categories` en `categorySnapshot.priceCOP` al crear la solicitud.
- Un proveedor solo recibe solicitudes si su perfil está completo, pasó la validación automática, tiene aprobación administrativa y ofrece esa categoría en `services`.
- Cada servicio completado admite una sola calificación: el documento de `ratings` usa el mismo id de la solicitud.
- Cada cambio de estado guarda, en la misma transacción, un `event` y una `notification` para la otra persona.

**Modo demostración:** mientras `js/config.js` no tenga URL de backend, el frontend usa `data/data.js` y guarda solicitudes, perfiles y mensajes en el `localStorage` del navegador, con los nombres de campo de `data/schema.json`.

**Tarifas fijas actuales**

| Categoría | ID | Tarifa |
| --- | --- | --- |
| Plomería | `plomeria` | $35.000 |
| Electricidad | `electricidad` | $40.000 |
| Jardinería | `jardineria` | $40.000 |
| Aseo general | `aseo-general` | $35.000 |

## 🧩 7. Documentación del sistema

### 7.1 Tecnologías

| Capa | Tecnología |
| --- | --- |
| Frontend | HTML5, CSS3 (diseño responsive con media queries), JavaScript (módulos ES) |
| Backend | Node.js + Express: autenticación, perfiles, solicitudes, calificaciones, notificaciones, soporte e ingresos |
| Base de datos y autenticación | Firebase Authentication y Cloud Firestore (el catálogo de categorías y proveedores del frontend sigue en modo demostración) |
| Diseño | Figma |
| Control de versiones y publicación | Git, GitHub y GitHub Pages |
| Formato de código | Prettier (`.prettierrc.json`) |
| Pruebas | `node:test` (backend) y Firebase Emulator para pruebas de integración |

### 7.2 Arquitectura

```mermaid
flowchart LR
  subgraph Navegador
    HTML[Pantallas HTML] --> C[js/components/*]
    C --> API[js/services/api.js]
    C --> AUTHUI[js/services/auth.js]
  end
  API -- "PROFILE_API_BASE_URL definida" --> EXP[Backend Express]
  API -- "REQUESTS_API_BASE_URL definida" --> EXP
  API -- "solicitudes sin URL" --> DEMO[(data/data.js + localStorage)]
  API -- "categorías y proveedores" --> DEMO
  EXP -- "Firebase Admin: verificación de ID token" --> AUTH[Firebase Auth]
  EXP -- "datos personales propios" --> USERS[("Firestore: users/{uid}")]
  EXP -- "perfil profesional y estados" --> PROVIDERPROFILES[("Firestore: providerProfiles/{uid}")]
  EXP -- "solicitudes, calificaciones, notificaciones y soporte" --> BUSINESS[("Firestore: solicitudes, ratings, notifications, supportMessages")]
  AUTHUI --> AUTH
  AUTHUI --> USERS
```

- **Frontend:** cada pantalla es un archivo HTML que carga `js/main.js`. `main.js` importa los módulos de `js/components/`, y cada módulo actúa solo si encuentra sus elementos en la página.
- **Autenticación (`js/services/auth.js`):** el registro y el inicio de sesión usan Firebase Authentication. El perfil se guarda y consulta en `users/{uid}` con `createdAt`, `email`, `firstName`, `lastName` y `role`. La sesión persistente pertenece a Firebase Authentication.
- **Capa de servicios (`js/services/api.js`):** categorías y proveedores siguen en **modo demostración** con `data/data.js`. Las solicitudes usan `localStorage` mientras `REQUESTS_API_BASE_URL` esté vacía; al configurarla usan únicamente el backend. La gestión de perfiles requiere `PROFILE_API_BASE_URL` y usa rutas REST protegidas, sin alternativa local.
- **Backend (`backend/`):** Express expone `GET /api/health` y las rutas de identidad, perfiles, especialidades y disponibilidad, solicitudes (crear, confirmar, cancelar, aceptar, rechazar, iniciar y completar), calificaciones, notificaciones, soporte e ingresos del proveedor (sección 7.4). Firebase Admin verifica firma, vencimiento y revocación del ID token; el rol se obtiene del perfil `users/{uid}` usando el UID verificado. Los errores se responden con un formato común desde `middlewares/error-handler.js`.
- **Firebase:** Firebase Authentication gestiona las cuentas y la sesión; Firestore almacena datos personales en `users/{uid}` y datos profesionales/controlados por servidor en `providerProfiles/{uid}`. El backend usa Firebase Admin con Application Default Credentials, que omite las reglas de Firestore; por ello las rutas validan explícitamente sus campos y permisos.

### 7.3 Estructura de carpetas

```
HogarFix/
├── index.html                 Página pública (landing)
├── login.html, registro.html  Acceso
├── app.html                   Panel del cliente
├── buscar.html                Catálogo de categorías y búsqueda de proveedores
├── perfil-proveedor.html      Perfil del proveedor y formulario de solicitud
├── reserva.html               Resumen de contratación y confirmación
├── solicitudes.html           Historial de servicios del cliente
├── mi-perfil-cliente.html     Perfil editable del cliente
├── chat.html                  Chat del cliente
├── inicio-proveedor.html      Panel del proveedor
├── solicitudes-proveedor.html Solicitudes recibidas por el proveedor
├── detalle-proveedor.html     Detalle de una solicitud (proveedor)
├── mi-perfil-proveedor.html   Perfil editable del proveedor
├── ingresos-proveedor.html    Ingresos y calificación del proveedor
├── mensajes-proveedor.html    Chat del proveedor
├── prueba.html                Página de prueba de conexión con Firebase (usa js/prueba-firebase.js)
├── assets/                    Logos, íconos SVG e imágenes
├── css/styles.css             Estilos globales y media queries
├── data/
│   ├── data.js                Datos de demostración (categorías, proveedores, reseñas…)
│   └── schema.json            Esquema de los formularios y entidades
├── js/
│   ├── config.js              URL de la API backend
│   ├── firebase-config.js     Firebase web SDK (Authentication)
│   ├── prueba-firebase.js     Script de la página de prueba de Firebase
│   ├── main.js                Navegación, accesibilidad y sesión
│   ├── utils.js               Formato de precios y fechas, estados de carga y error
│   ├── services/
│   │   ├── api.js             Capa de servicios (backend o demostración)
│   │   └── auth.js            Firebase Authentication y perfiles de usuario
│   └── components/
│       ├── catalogo.js        Categorías y tarifas fijas (ISSUE 10)
│       ├── proveedores.js     Listado y perfil de proveedores (ISSUE 12)
│       ├── solicitud.js       Formulario de solicitud con validación y método de pago demo (ISSUE 11, #38)
│       ├── resumen.js         Resumen y confirmación de contratación (ISSUE 13)
│       ├── historial.js       Historial, filtros y calificación de servicios (ISSUE 14, 25)
│       ├── form-data.js       Lectura y validación de formularios contra schema.json
│       ├── panel-proveedor.js Panel, solicitudes, ingresos y calificación del proveedor (#29, 20, 25)
│       ├── perfil-cliente.js  Perfil del cliente (#30)
│       ├── perfil-proveedor.js Perfil, especialidades y disponibilidad del proveedor (#31, 19)
│       ├── password.js        Mostrar/ocultar y requisitos de contraseña (#32)
│       └── login.js, registro.js, buscar.js, chat.js
├── backend/
│   ├── README.md              Instalación, endpoints y pruebas del backend
│   ├── .env.example           Variables de entorno del backend
│   ├── package.json           Dependencias y comandos (start, test, test:emulator)
│   ├── package-lock.json      Versiones bloqueadas de dependencias
│   ├── scripts/run-emulator-tests.js  Ejecuta las pruebas con Firebase Emulator
│   ├── src/
│   │   ├── app.js             Aplicación Express y montaje de rutas
│   │   ├── server.js          Inicio del servidor y configuración del puerto
│   │   ├── config/firebase-admin.js  Inicialización diferida de Firebase Admin
│   │   ├── middlewares/       auth.js (token y rol), validate.js, error-handler.js
│   │   ├── controllers/       admin, earnings, profile y request
│   │   ├── routes/            access, admin, profile, requests, earnings y support
│   │   └── services/          perfiles, solicitudes, calificaciones, notificaciones, soporte e ingresos
│   └── test/
│       ├── app.test.js, error-handling.test.js           Aplicación y manejo de errores
│       ├── catalog-service.test.js                       Catálogo backend
│       ├── auth-middleware.test.js, profile-routes.test.js  Autenticación, roles y perfiles
│       ├── request-routes.test.js, request-service.test.js, request-validation.test.js  Solicitudes
│       ├── calificaciones-soporte.test.js                Calificaciones, notificaciones y soporte
│       ├── earnings-routes.test.js                       Ingresos del proveedor
│       └── integration/                                  Pruebas con Firebase Emulator
├── firebase.json              Reglas, índices y configuración de Emulator
├── firestore.indexes.json     Índices compuestos de solicitudes
├── firestore.rules            Reglas de seguridad de Firestore
├── render.yaml                Blueprint de despliegue del backend
├── .env.example               Variables de entorno de ejemplo
└── .prettierrc.json           Formato común del código
```

### 7.4 Endpoints principales

Todas las rutas llevan el prefijo `/api`. Las rutas de identidad `GET /api/client/me` y `GET /api/provider/me`, la gestión de perfiles y la elegibilidad de proveedores están protegidas por Firebase Admin. `GET /api/health` sigue siendo pública. Las pantallas de perfil requieren configurar `PROFILE_API_BASE_URL`; no guardan datos personales ni profesionales en `localStorage`.

| Método | Ruta | Uso | Respuesta |
| --- | --- | --- | --- |
| GET | `/solicitudes` | Solicitudes del cliente autenticado | `{ requests: [...] }` |
| GET | `/solicitudes/:id` | Detalle de una solicitud propia | `{ request: {...} }` |
| POST | `/solicitudes` | Crear solicitud con `providerCatalogId`, `categoryId`, fecha, hora, dirección y detalle; requiere `Idempotency-Key` | `{ request: {...} }` |
| PATCH | `/solicitudes/:id/confirmar` | El cliente confirma una solicitud aceptada | `{ request: {...} }` |
| PATCH | `/solicitudes/:id/cancelar` | El cliente cancela una solicitud pendiente o aceptada | `{ request: {...} }` |
| GET | `/solicitudes/:id/calificacion` | Consultar si el cliente ya calificó un servicio propio | `{ rating: {...} }` o `{ rating: null }` |
| POST | `/solicitudes/:id/calificacion` | Calificar un servicio completado (1–5 estrellas y comentario) | `{ rating: {...} }` |
| GET | `/provider/:uid/calificaciones` | Consultar promedio, cantidad y reseñas de un proveedor | `{ summary: { average, count, ratings } }` |
| GET | `/provider/solicitudes` | Solicitudes asignadas al proveedor autenticado | `{ requests: [...] }` |
| GET | `/provider/solicitudes/:id` | Detalle de una solicitud asignada | `{ request: {...} }` |
| PATCH | `/provider/solicitudes/:id/aceptar` | Aceptar solicitud si el proveedor es elegible | `{ request: {...} }` |
| PATCH | `/provider/solicitudes/:id/rechazar` | Rechazar solicitud asignada | `{ request: {...} }` |
| PATCH | `/provider/solicitudes/:id/iniciar` | Iniciar una solicitud confirmada | `{ request: {...} }` |
| PATCH | `/provider/solicitudes/:id/completar` | Finalizar una solicitud en proceso | `{ request: {...} }` |
| GET | `/notifications` | Notificaciones recientes del usuario autenticado | `{ notifications: [...] }` |
| PATCH | `/notifications/:id/read` | Marcar como leída una notificación propia | `{ notification: {...} }` |
| GET | `/support/faqs` | Consultar preguntas frecuentes | `{ faqs: [...] }` |
| POST | `/support/messages` | Crear un caso de soporte (`subject`, `message`) | `{ message: {...} }` |
| GET/PATCH | `/profile/me` | Consultar/actualizar datos personales propios | Perfil personal |
| GET/PATCH | `/provider/profile/me` | Consultar/actualizar datos profesionales propios | Perfil y estados de validación/aprobación |
| GET | `/provider/eligibility` | Verificar validación, aprobación y cuenta activa | `{ eligibility: {...} }` |
| GET/PATCH | `/provider/especialidades` | Consultar/actualizar las categorías que ofrece el proveedor | Especialidades del proveedor |
| GET/PATCH | `/provider/disponibilidad` | Consultar/actualizar días y horarios de atención | Disponibilidad del proveedor |
| GET | `/provider/earnings` | Ingresos del proveedor por servicios con pago confirmado, filtrables por fechas | Totales del periodo |
| GET | `/provider/earnings/breakdown` | Ingresos agrupados por día, mes o año | Desglose por periodo |
| PATCH | `/admin/providers/:uid/approval` | Decisión administrativa (claim `admin: true`) | Estado de aprobación actualizado |

Reglas importantes para el backend:

- `POST /solicitudes` **no recibe precio ni datos de pago**: el servidor obtiene la tarifa de la asociación de catálogo. Los identificadores deben corresponder a documentos reales del catálogo y la cabecera `Idempotency-Key` es obligatoria.
- Los métodos y estados de pago existen solo en las solicitudes de demostración. No hay endpoint ni pasarela de pago; el modo backend no envía datos de pago ni simula cobros.
- Las rutas de proveedor y perfil obtienen UID y rol del token Firebase verificado; un proveedor solo puede ver y cambiar solicitudes asignadas a su cuenta.
- Los perfiles se guardan en `users/{uid}` y `providerProfiles/{uid}`; el cliente no puede enviar UID, rol, validación automática ni aprobación.
- Los errores deben responder con un código HTTP y `{ "message": "texto para el usuario" }`; el frontend muestra ese mensaje.
- Las rutas de aprobación requieren un custom claim administrativo asignado fuera de la API. Las calificaciones se guardan una vez por servicio en `ratings/{serviceId}`; el promedio y la cantidad se mantienen en `providerProfiles/{uid}`.
- Al aceptar, el backend rechaza la solicitud si el proveedor ya tiene otro servicio asignado en ese horario (`PROVIDER_SCHEDULE_CONFLICT`).
- Cada transición válida de una solicitud escribe de forma atómica su evento y una notificación para la otra persona participante. Las notificaciones se consultan por el UID autenticado y solo su destinatario puede marcarlas como leídas. Al crear una solicitud se preparan recordatorios para cliente y proveedor, con entrega prevista 24 horas antes; cancelación, rechazo o finalización los marca como cancelados para que un worker pueda ignorarlos. Los mensajes de soporte se guardan en `supportMessages`; las preguntas frecuentes son contenido estático del backend.

### 7.5 Funcionalidades del frontend

- **Catálogo y tarifas:** `buscar.html` muestra las cuatro categorías con su tarifa fija; al elegir una se filtran los proveedores. La landing toma los mismos precios.
- **Proveedores:** tarjetas con especialidad, calificación, distancia y disponibilidad; filtros por texto, categoría y disponibilidad; perfil con reseñas.
- **Solicitud de servicio:** en modo demo permite elegir categoría, fecha, hora, dirección, descripción y método de pago informativo; la tarifa demo no se puede editar. En backend omite campos de pago y requiere identificadores reales e `Idempotency-Key`.
- **Resumen de contratación:** datos del cliente, del proveedor, del servicio y la tarifa, tipo factura, con opción de imprimir. Si el proveedor ya aceptó, el cliente confirma desde ahí.
- **Métodos de pago:** solo en modo demostración se elige efectivo, Nequi, PSE o tarjeta como opción informativa. La elección se conserva en solicitudes demo; no existe endpoint ni pasarela de pago.
- **Perfiles:** el cliente (`mi-perfil-cliente.html`) y el proveedor (`mi-perfil-proveedor.html`) editan campos admitidos por el backend. Foto y almacenamiento de archivos requieren integrar Firebase Storage.
- **Panel del proveedor:** en backend muestra solicitudes asignadas y bloquea aceptar si la elegibilidad no está confirmada. En demo muestra datos de ejemplo señalados como tales; sus tarifas no representan pagos.
- **Contraseñas:** botón de ojo para mostrar u ocultar; el mínimo de 8 caracteres y la coincidencia se validan para registrar. Los requisitos visuales adicionales son recomendaciones, no condiciones de Firebase Authentication.
- **Historial:** filtros por estado y rango de fechas, orden, detalles desplegables y actualización automática (cada 30 s, al volver a la pestaña o cuando cambia en otra pestaña).
- **Estados de carga y error** en todas las consultas, con botón para reintentar.
- **Diseño responsive** probado a 360 px (celular), 768 px (tablet) y 1280 px (escritorio), sin desbordamiento horizontal.
- **Accesibilidad:** enlace para saltar al contenido, botones para aumentar el texto y alto contraste, etiquetas ARIA y navegación por teclado.

## 🚀 8. Instalación y ejecución

**Requisitos:** un navegador actualizado y Visual Studio Code con la extensión **Live Server** (o cualquier servidor estático). No hace falta instalar dependencias.

1. Clona el repositorio:
   ```bash
   git clone https://github.com/Tecnologias-2026-2/HogarFix.git
   cd HogarFix
   ```
2. Abre la carpeta en Visual Studio Code.
3. Clic derecho en `index.html` → **Open with Live Server**. Se abre en `http://127.0.0.1:5500`.

> Abrir el HTML con doble clic (`file://`) no funciona: los módulos de JavaScript y `schema.json` necesitan un servidor.

Alternativa sin VS Code: `npx serve .` o `python -m http.server 5500` desde la carpeta del proyecto.

**Backend y pruebas (opcional, requiere Node.js 20 o superior):**

```bash
cd backend
npm install
npm test          # pruebas automatizadas (no necesitan Firebase)
npm start         # inicia la API en http://localhost:3000 (requiere backend/.env)
```

Las pruebas de integración con Firebase Emulator (`npm run test:emulator`) y la configuración de credenciales se explican en [`backend/README.md`](backend/README.md).

### Recorrido de demostración

1. En `index.html` elige **Soy Cliente**, regístrate con datos de prueba (no uses contraseñas reales).
2. En **Buscar** elige una categoría, abre un perfil y envía una solicitud.
3. Revisa el resumen y luego **Mis solicitudes**.
4. El catálogo y las solicitudes del panel de proveedor usan datos locales de demostración; no son perfiles reales ni asociaciones persistidas entre cuentas.
5. En el formulario demo puedes elegir un método de pago informativo y ver su estado en el resumen y el historial. No se realiza ningún cobro.
6. El flujo real entre cliente y proveedor requiere el catálogo de Firestore configurado para el backend.
7. Para mostrar los estados de error, agrega `?simularError=1` a la URL (por ejemplo `buscar.html?simularError=1`).

### Conectar el backend

Para usar las rutas de perfiles, configura `PROFILE_API_BASE_URL` en `js/config.js`:

```js
export const PROFILE_API_BASE_URL = "http://localhost:3000/api"; // o la URL publicada
```

`js/config.js` conecta perfiles y solicitudes a la API Node configurada. Para desarrollo local, reemplaza ambas URLs por `http://localhost:3000/api`. Configura `backend/.env` a partir de `backend/.env.example`, incluidas `FIREBASE_PROJECT_ID` y `CORS_ORIGINS`. Firebase Admin requiere Application Default Credentials. Las reglas e índices están declarados en `firebase.json`; el backend valida sus propias escrituras porque Admin SDK omite las reglas.

Los perfiles se guardan en `users/{uid}` (datos personales) y `providerProfiles/{uid}` (datos profesionales y estados controlados por servidor). Los usuarios no pueden cambiar correo, rol, UID, validación automática ni aprobación desde las rutas de perfil. Una edición profesional reinicia la aprobación a `pending`; el perfil completo puede superar la validación automática, pero solo una cuenta con claim administrativo puede aprobarlo. Foto y certificados quedan pendientes de configurar Firebase Storage.

### Modo demostración

Para probar en modo demostración, deja ambas URLs vacías; solicitudes, categorías y proveedores usan datos locales. Con la API configurada, el flujo real requiere categorías sembradas y asociaciones Firestore de proveedores aprobados. Las cuentas y la sesión se gestionan con Firebase Authentication.
En modo demostración, el formulario conserva la selección del método de pago y muestra su estado informativo, pero no procesa cobros. El servicio real de solicitudes no transmite campos de pago.

## 🌍 9. Despliegue

El frontend se publica en **GitHub Pages** directamente desde la rama `main`: cada push a `main` dispara el proceso automático de GitHub *"pages build and deployment"* (pestaña *Actions*) y en uno o dos minutos el sitio queda actualizado.

Configuración (ya está hecha; la cambia solo quien administra el repositorio): **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.

Como se publica la raíz del repositorio, la carpeta `backend/` también queda visible como archivos estáticos (sin ejecutarse). No contiene secretos: las credenciales van en `.env`, que está excluido por `.gitignore`.

El sitio queda en `https://tecnologias-2026-2.github.io/HogarFix/`.

## 🔒 10. Seguridad y archivos sensibles

- `.gitignore` excluye `.env` y sus variantes; usa `.env.example` como plantilla y nunca subas el `.env` real.
- Las contraseñas se gestionan mediante Firebase Authentication; Firestore solo recibe los campos del perfil y nunca la contraseña, su confirmación ni hashes.
- El formulario exige un mínimo de 8 caracteres; los requisitos visuales adicionales no sustituyen las reglas vigentes de Firebase Authentication.
- No se piden ni guardan datos de tarjetas. Los métodos y estados de pago son exclusivamente informativos en el modo demostración.
- La configuración web de Firebase (`apiKey`, `projectId`…) es pública por diseño, pero el acceso a los datos debe protegerse con **reglas de seguridad de Firestore** por usuario y rol.
- Firebase Admin usa Application Default Credentials y `FIREBASE_PROJECT_ID`; configura ADC en el entorno de ejecución. Las credenciales privadas deben permanecer fuera del repositorio y no subirse a GitHub.
- El control de acceso de las pantallas mejora la navegación, pero la autorización de los datos debe imponerse en el backend. La aprobación de proveedores requiere el claim administrativo; las reglas niegan operaciones directas del cliente y se publican junto con los índices mediante Firebase CLI.
- Lista de revisión antes de cada entrega: sin archivos `.env` ni credenciales de cuentas de servicio. Como GitHub Pages publica la raíz del repositorio, la página de prueba `prueba.html` (con `js/prueba-firebase.js`) también queda publicada; no contiene credenciales privadas.

### Backend en Render y datos iniciales

[`render.yaml`](render.yaml) define el servicio Node en la rama `Dev`, con raíz `backend/` y chequeo `/api/health`. En Render, crea el Blueprint y carga `firebase-service-account.json` como Secret File. Confirma la URL asignada y ajusta `js/config.js` si Render agrega un sufijo al subdominio.

Desde `backend/`, ejecuta `npm run deploy:firestore` con Firebase CLI autenticado para publicar reglas e índices. Ejecuta `npm run seed:catalog` para sembrar categorías; para asociar proveedores, configura UIDs reales y perfiles ya aprobados. `npm run admin:grant` asigna el claim inicial solo tras confirmar el UID autorizado. Estos pasos requieren credenciales Firebase y no se ejecutan automáticamente al desplegar.

## 📌 11. Estado del proyecto

Los números 01-28 reflejan el plan de trabajo anterior; las filas identificadas como `GitHub #...` indican el número real del Issue cuando la numeración difiere.

| Issue | Tema | Estado |
| --- | --- | --- |
| 01 | Estructura general del proyecto | ✅ Estructura y documentación base |
| 02 | Servidor Node.js + Express | ✅ Servidor, `GET /api/health` y rutas de negocio |
| 03-07 | Autenticación, autorización y perfiles | ✅ Firebase Authentication, autorización backend y edición de perfiles |
| 08 | Adaptación del diseño a HTML, CSS y JS | ✅ Código formateado y organizado, íconos de categorías corregidos |
| 09 | Diseño responsive | ✅ Probado en celular, tablet y escritorio |
| 10 | Catálogo de categorías y tarifas | ✅ Desde la capa de servicios |
| 11 | Formulario de solicitud | ✅ Validación y envío por la capa de servicios |
| 12 | Visualización de proveedores | ✅ Desde la capa de servicios, con carga y error |
| 13 | Confirmación y resumen de contratación | ✅ |
| 14 | Historial de servicios del cliente | ✅ Filtros por estado y fecha |
| Autenticación | Registro, inicio y cierre de sesión con Firebase; perfil `users/{uid}` | ✅ Etapa 1 |
| Administración de proveedores | Estados y aprobación administrativa segura | ✅ Ruta administrativa protegida por claim |
| GitHub #11 | Middleware de autenticación y autorización | ✅ Verificación de ID token y guards Cliente/Proveedor |
| 28 | Documentación y entrega final | ✅ Este README |
| #29 (34) | Solicitudes iniciales del panel del proveedor | ✅ Sin datos de prueba, solo las del proveedor autenticado |
| #30 (35) | Perfil del cliente | ✅ Consulta y edición de datos personales |
| #31 (36) | Perfil del proveedor | ✅ Edición, validación automática y aprobación administrativa |
| #32 (37) | Contraseñas en el registro | ✅ Mostrar/ocultar y requisitos en vivo |
| #32 (38) | Métodos de pago | ✅ Opciones informativas del modo demostración; integración de cobros pendiente |
| 15-18 | Rutas, controladores y gestión de solicitudes | ✅ Crear, confirmar, cancelar, aceptar, rechazar, iniciar y completar, con eventos de estado |
| 19 | Especialidades y disponibilidad del proveedor | ✅ Endpoints `/provider/especialidades` y `/provider/disponibilidad` |
| 20 | Ingresos del proveedor | ✅ Endpoints `/provider/earnings` y `/provider/earnings/breakdown` (cuentan solo pagos confirmados) |
| 21 | Validaciones y manejo de errores | ✅ Middleware `validate` y `error-handler` con formato común |
| 22 | Modelo de datos | ✅ Sección 6 de este README |
| 23-24 | Firebase Admin y operaciones en Firestore | ✅ Configuración centralizada y servicios del backend |
| 25 | Calificaciones de proveedores | ✅ 1 a 5 estrellas, una por servicio y promedio por proveedor |
| 26 | Notificaciones y soporte | ✅ API y pantallas de notificaciones y soporte; los recordatorios esperan un worker externo |
| 27 | Pruebas e integración | 🟡 En curso: pruebas automatizadas del backend en verde; falta la evidencia con Postman/Thunder Client |
