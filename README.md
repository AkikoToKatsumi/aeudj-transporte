# 🚌 AEUDJ Transporte - Sistema de Gestión

¡Bienvenido al repositorio oficial del **Sistema de Gestión de Transporte de AEUDJ** (Asociación de Estudiantes Universitarios de Jarabacoa)!

Esta aplicación web moderna, interactiva y responsiva optimiza la reserva de asientos y el control administrativo del transporte de estudiantes universitarios entre las ciudades de **Jarabacoa y La Vega** (República Dominicana). Fue migrada y rediseñada completamente desde un sistema heredado en PHP a una arquitectura sin servidor (*serverless*) basada en **HTML/CSS/JavaScript puro** y con **Supabase** como backend.

---

## 🎯 El Problema que Resuelve

El transporte estudiantil diario enfrenta múltiples desafíos que este sistema soluciona de raíz:

1. **Ineficiencia en la Reserva**: Anteriormente, la asignación de asientos se realizaba de manera informal o manual, provocando desorganización en los cupos del autobús.
2. **Asientos Vacíos por Inasistencia ("No-Show")**: Estudiantes que reservaban un cupo pero no se presentaban a la hora de salida dejaban asientos vacíos que otros compañeros necesitaban con urgencia.
3. **Falta de Control en Tiempo Real**: Los coordinadores y choferes no contaban con herramientas digitales para validar quién abordaba el vehículo y quién no.
4. **Sobrecarga de Trabajo Administrativo**: Llevar el control de voluntarios en cada viaje, las estadísticas de demanda y la recaudación económica diaria de forma manual resultaba insostenible.

---

## 💡 La Solución (Lo que Hace el Sistema)

Este sistema proporciona una plataforma centralizada y en tiempo real para todos los actores del servicio de transporte:

### 🎓 Para Estudiantes
- **Registro y Perfil**: Creación de cuenta utilizando su matrícula universitaria.
- **Reserva de Cupos**: Selección de horarios de ida y vuelta para cada ciclo de viaje de forma sencilla y visual.
- **Lista de Espera Inteligente**: Si un horario alcanza su capacidad máxima, el estudiante es colocado automáticamente en lista de espera. Si alguien cancela o es retirado, el sistema promueve al primer estudiante en espera.
- **Cambio de Planes**: Herramienta fácil para declarar cambios de horario o avisar si se viajará por otros medios.

### 🙋 Para Voluntarios
- **Asignación de Turnos**: Visualización de los voluntarios asignados al control de cada horario.
- **Control de Abordaje**: Herramienta rápida para marcar asistencia de los pasajeros en tiempo real al momento de abordar el autobús.

### 🚌 Para Choferes
- **Acceso Directo**: Interfaz simplificada para ver la lista de pasajeros confirmada para el viaje actual, garantizando que solo aborden los estudiantes autorizados.

### ⚙️ Para Administradores
- **Dashboard Analítico**: Métricas clave en tiempo real (total de pasajeros, lista de espera, estimación de cobro de caja).
- **Gráficos Estadísticos**: Gráficas dinámicas de demanda por horarios y distribución de viajes implementadas con **Chart.js**.
- **Pasar Lista y Penalidades**:
  - Control de asistencia interactivo (marcar como *Presente*, *Ausente*, *Tarde* o *No Subió*).
  - **Sistema de Sanciones Automático**: Si un estudiante acumula **3 inasistencias** (*faltas*), el sistema lo bloquea automáticamente (Penalizado), impidiéndole reservar nuevos cupos hasta que regularice su situación.
- **Directorio de Personal**: Creación, edición y control total de roles (Administradores, Voluntarios, Choferes, Estudiantes).
- **Logs y Auditoría**: Panel histórico de reservas, faltas registradas y penalidades activas por fecha.
- **Gestión de Ciclos**: Botón de reinicio diario para limpiar reservas y preparar el sistema para la jornada del día siguiente.

---

## 🛠️ Tecnologías Utilizadas

La aplicación está diseñada para ser extremadamente ligera, segura y rápida, prescindiendo de frameworks pesados de JavaScript:

*   **Frontend**:
    *   **HTML5**: Estructura semántica, optimizada para SEO y accesibilidad.
    *   **CSS3 (Vanilla)**: Diseño responsivo para móviles, interfaz con efecto *glassmorphism*, variables de color personalizadas y microanimaciones suaves.
    *   **JavaScript (ES6+)**: Modular, asíncrono y orientado a componentes sin dependencias de compilación.
    *   **Chart.js**: Renderizado de gráficos estadísticos en el panel de control administrativo.
    *   **Lucide Icons**: Conjunto de íconos vectoriales modernos y estilizados.
    *   **EmailJS**: Envío automático de notificaciones de alerta y estados por correo electrónico.
*   **Backend & Base de Datos**:
    *   **Supabase (PostgreSQL)**: Gestión relacional de datos y almacenamiento persistente.
    *   **Supabase Auth**: Autenticación segura de usuarios (estudiantes y personal) mediante correo y contraseña.
    *   **Supabase Edge Functions**: Lógica de servidor segura (ej. función `obtener-lista-segura`) para proteger datos confidenciales del lado del cliente.
*   **Configuración y Despliegue**:
    *   **Vercel / GitHub Pages**: Configurado con políticas de cabecera HTTP seguras y redirecciones controladas en [vercel.json](file:///d:/Datos/Documents/GitHub/AEUDJ-HTML.github.io/vercel.json) (incluyendo una política estricta de *Content Security Policy* - CSP).

---

## 📁 Estructura del Proyecto

El código está organizado de manera limpia y modular:

```text
aeudj-transporte/
├── index.html            # Pantalla de inicio de sesión y registro de estudiantes
├── votar.html            # Selector de horarios y reserva de cupos
├── lista.html            # Visualización pública y en tiempo real de pasajeros asignados
├── admin.html            # Panel de control administrativo y dashboard
├── choferes.html         # Interfaz móvil para conductores de autobuses
├── voluntario.html       # Panel operativo para voluntarios de turno
├── gracias.html          # Pantalla de confirmación de reserva exitosa
├── no-subieron.html      # Listado rápido de pasajeros suspendidos o que no abordaron
├── supabase-config.js    # Inicialización del cliente de Supabase y constantes del sistema
├── vercel.json           # Configuración de seguridad (CSP, X-Frame-Options, STS, etc.)
├── package.json          # Dependencias del entorno de desarrollo local
├── css/
│   ├── styles.css        # Hoja de estilos principal y tokens de diseño
│   └── admin_screens.css # Diseño de pantallas administrativas
└── js/
    ├── app.js            # Lógica central del negocio e interactividad general
    ├── admin_page.js     # Lógica detallada del panel de administración
    ├── votar_page.js     # Lógica del flujo de reservas de estudiantes
    ├── lista_page.js     # Sincronización y filtros de las listas de pasajeros
    ├── voluntario_page.js # Funcionalidad del perfil voluntario
    ├── choferes_page.js  # Interfaz del conductor
    ├── custom-alert.js   # Sistema personalizado de modales y notificaciones in-app
    └── email-init.js     # Inicialización del cliente EmailJS
```

---

## 🚀 Instalación y Configuración

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/AkikoToKatsumi/aeudj-transporte.git
cd aeudj-transporte
```

### Paso 2: Configurar Supabase
1. Ve a [Supabase Console](https://supabase.com) y crea un nuevo proyecto.
2. Crea las tablas necesarias en la base de datos (PostgreSQL) mediante el editor de SQL:
   - `profiles`: Datos de estudiantes y personal (id, nombre, matricula, telefono, rol, etc.).
   - `votos`: Registros de reserva diarios (id, email, nombre, horario, fecha, se_monto, en_espera, etc.).
   - `voting_config`: Configuración global del sistema.
   - `faltas`: Registro de inasistencias de estudiantes.
   - `penalidades`: Estudiantes inhabilitados temporalmente.
3. Configura las reglas de acceso (RLS - *Row Level Security*) correspondientes a cada tabla.
4. Habilita los proveedores de autenticación en **Authentication** > **Providers** (Email).
5. Despliega la Edge Function `obtener-lista-segura` en tu proyecto de Supabase si deseas contar con filtros de acceso seguros.

### Paso 3: Vincular Credenciales del Backend
Edita el archivo [supabase-config.js](file:///d:/Datos/Documents/GitHub/AEUDJ-HTML.github.io/supabase-config.js) en la raíz del proyecto y reemplaza las constantes con los valores proporcionados en la configuración de tu proyecto Supabase:

```javascript
const SUPABASE_URL = 'https://TU_PROYECTO_ID.supabase.co';
const SUPABASE_KEY = 'TU_SUPABASE_ANON_KEY';
```

### Paso 4: Pruebas Locales y Despliegue
*   **Desarrollo Local**: Puedes levantar un servidor web local simple (por ejemplo, con la extensión *Live Server* de VS Code o ejecutando `npm install` y `npm run dev` si cuentas con scripts de inicio).
*   **Producción**: Puedes subir el proyecto a **GitHub Pages** (configurando la rama `main` como origen en la pestaña *Settings > Pages* de tu repositorio de GitHub) o importarlo directamente en **Vercel** para beneficiarte de la seguridad configurada en `vercel.json`.

---

## 📄 Licencia

Este proyecto es propiedad de la **Asociación de Estudiantes Universitarios de Jarabacoa (AEUDJ)** y está destinado exclusivamente para uso interno y de soporte al transporte estudiantil. Todos los derechos reservados.
