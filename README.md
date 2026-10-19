# 🌐 HogarFix
**Calidad en cada arreglo**

Proyecto enfocado en conectar a personas que necesitan servicios para el hogar con proveedores calificados, mediante una plataforma digital accesible, organizada y transparente que utiliza un modelo de tarifa fija por categoría de servicio.

## 👥 Integrantes

- Laura Valentina Bojacá Sánchez – 1202561
- Sebastián Gómez Ramírez – 1202821
- Juan José Gutiérrez – 1202
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

**RF03. Recuperación de contraseña:** El sistema debe permitir recuperar la contraseña mediante un código de verificación enviado al correo registrado.

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

El diagrama de casos de uso representa las principales funcionalidades de HogarFix y la interacción de sus actores con el sistema. Identifica al cliente, quien puede registrarse, iniciar sesión, consultar tarifas, solicitar y confirmar servicios, consultar su historial y calificar a los proveedores; al proveedor, quien puede gestionar su perfil, revisar solicitudes, aceptarlas o rechazarlas y consultar sus servicios e ingresos; y al sistema, que participa en el envío automático de notificaciones.

### 4.2 Diagrama de secuencia

El diagrama de secuencia representa el orden en que interactúan los usuarios y los componentes del sistema durante un proceso específico. Para HogarFix, se propone representar el proceso de solicitud de un servicio a tarifa fija: el cliente consulta las categorías y sus precios, selecciona un servicio, completa y envía la solicitud, el sistema almacena la información en Firebase Firestore y notifica a los proveedores de la categoría correspondiente. Posteriormente, el proveedor acepta o rechaza la solicitud y el sistema actualiza su estado y notifica al cliente.

## 🎨 5. URL del prototipo

**Enlace público de Figma:**

[Agregar aquí el enlace público del prototipo de HogarFix en Figma](https://www.figma.com/design/QyHoaWKuAh0UaloG1XTRh8/HogarFix?node-id=532-421&t=BvIlGCNIAR99rQAw-1)

🗄️ 6. Diseño de Base de Datos

Agregar imagen del modelo.
Tablas principales

🧩 7. Documentación del Sistema
Estructura de Carpetas
/css
/assets

Explicar brevemente qué contiene cada carpeta.

🚀 8. Instalación y Ejecución

Explicar cómo correr el proyecto.
# Acceso de demostración

El registro y el inicio de sesión permiten recorrer el prototipo y entrar a `app.html`. Las cuentas de demostración se guardan en el almacenamiento local del navegador; no existe conexión a una base de datos ni un servidor de autenticación. Por eso una cuenta solo funciona en el mismo navegador y dispositivo donde se creó. No usar contraseñas reales.

## Pantallas implementadas de WEB FINAL

La navegación estática cubre los recorridos de cliente y proveedor del prototipo:

- **Acceso público:** `index.html`, `registro.html` y `login.html`.
- **Cliente:** `app.html` (inicio), `buscar.html`, `perfil-proveedor.html`, `reserva.html` (confirmación), `solicitudes.html` y `chat.html`.
- **Proveedor:** `inicio-proveedor.html`, `solicitudes-proveedor.html`, `detalle-proveedor.html`, `mi-perfil-proveedor.html`, `ingresos-proveedor.html` y `mensajes-proveedor.html`.
- Los ocho profesionales del prototipo se muestran mediante perfiles y conversaciones parametrizados; los estados de solicitudes se manejan desde las acciones de aceptar, rechazar, iniciar y completar.

Estas pantallas son una demostración de front-end para GitHub Pages. Registro, sesión, perfil, mensajes y solicitudes se guardan únicamente en el almacenamiento local del navegador; no se conectan a Firebase ni a un servicio de autenticación. Usa datos de prueba, no contraseñas reales.

### Ejecutar localmente

Abre la carpeta clonada en Visual Studio Code y ejecuta `index.html` con la extensión Live Server, o publica la rama `main` desde la raíz del repositorio con GitHub Pages.

## Estado de persistencia de la versión actual

Las solicitudes, sus estados y los mensajes se guardan en `localStorage` del navegador. Permanecen al navegar y recargar en el mismo navegador y sitio, pero no se comparten entre navegadores o dispositivos. La autenticación de esta versión también es una demostración local; no uses contraseñas reales. Para sincronización entre usuarios y dispositivos, hace falta configurar Firebase Authentication y Firestore con reglas de acceso por usuario/rol.
