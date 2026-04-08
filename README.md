# 🚌 AEUDJ Transporte - Sistema de Gestión

Sistema de gestión de transporte para AEUDJ, convertido de PHP a HTML/CSS/JavaScript puro con Firebase como backend.

## 📋 Características

- ✅ Registro e inicio de sesión de usuarios
- ✅ Selección de horarios de transporte
- ✅ Lista pública de pasajeros organizada por horario
- ✅ Panel de administración
- ✅ Marcado de asistencia (subió/no subió/llegó tarde)
- ✅ Lista de espera automática
- ✅ Cambios de horario (antes/después/otros medios)
- ✅ Lista de quienes no subieron
- ✅ Diseño responsive para móviles

## 🚀 Instalación en GitHub Pages

### Paso 1: Crear proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto
3. Activa **Authentication**:
   - Ve a "Authentication" > "Sign-in method"
   - Habilita "Email/Password" (solo necesario si quieres autenticación adicional)
   
4. Activa **Firestore Database**:
   - Ve a "Firestore Database" > "Crear base de datos"
   - Selecciona "Iniciar en modo de prueba" (o configura reglas de seguridad)
   - Elige la región más cercana (us-east1 para República Dominicana)

### Paso 2: Obtener configuración de Firebase

1. Ve a "Configuración del proyecto" (icono de engranaje)
2. En "Tus apps", selecciona el icono `</>` para agregar una app web
3. Registra la app con un nombre (ej: "AEUDJ Web")
4. Copia el objeto `firebaseConfig`

### Paso 3: Configurar el proyecto

1. Edita el archivo `js/firebase-config.js`
2. Reemplaza los valores de `firebaseConfig` con los tuyos:

```javascript
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_MESSAGING_ID",
  appId: "TU_APP_ID"
};
```

### Paso 4: Subir a GitHub

1. Crea un nuevo repositorio en GitHub
2. Sube todos los archivos de esta carpeta
3. Ve a "Settings" > "Pages"
4. En "Source", selecciona "Deploy from a branch"
5. Selecciona la rama "main" y carpeta "/ (root)"
6. Guarda y espera unos minutos

### Paso 5: Configurar reglas de Firestore

Ve a Firestore Database > Reglas y configura:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ **Nota**: Estas reglas permiten acceso público. Para producción, configura reglas más restrictivas.

## 📁 Estructura del proyecto

```
aeudj-github/
├── index.html          # Login/Registro
├── votar.html          # Selector de horarios
├── lista.html          # Lista pública de pasajeros
├── admin.html          # Panel de administración
├── gracias.html        # Confirmación de voto
├── cambios.html        # Cambio de horarios
├── no-subieron.html    # Lista de quienes no subieron
├── css/
│   └── styles.css      # Estilos de la aplicación
├── js/
│   ├── firebase-config.js  # Configuración de Firebase
│   └── app.js              # Lógica de la aplicación
├── img/
│   └── comite.jpg      # Logo (opcional)
└── README.md           # Este archivo
```

## 🔑 Credenciales de Administrador

- **Usuario**: `admin`
- **Contraseña**: `aeudj2025`

## 🕐 Horarios de Transporte

| Hora | Ruta |
|------|------|
| 7:00 AM | Jarabacoa → La Vega |
| 9:00 AM | Jarabacoa → La Vega |
| 12:10 PM | La Vega → Jarabacoa |
| 1:00 PM | Jarabacoa → La Vega |
| 2:15 PM | La Vega → Jarabacoa |
| 3:00 PM | Jarabacoa → La Vega |
| 4:10 PM | La Vega → Jarabacoa |
| 5:00 PM | Jarabacoa → La Vega |
| 6:00 PM | La Vega → Jarabacoa |
| 8:00 PM | La Vega → Jarabacoa |
| 10:00 PM | La Vega → Jarabacoa |

## 📱 Uso

1. Los estudiantes se registran con su matrícula
2. Seleccionan sus horarios de ida y vuelta
3. El administrador marca quién subió al transporte
4. Si alguien no sube, el siguiente en lista de espera ocupa su lugar

## 🛠️ Tecnologías

- HTML5
- CSS3 (con diseño responsive)
- JavaScript (vanilla)
- Firebase (Firestore + Auth)

## 📄 Licencia

Proyecto para uso interno de AEUDJ.
