# Express Courier International - Bot de WhatsApp

Bot de WhatsApp para servicio de mensajería automatizada de Express Courier International, con panel administrativo e integración con IA.

## 📋 Características

- **Servicio automatizado**: Respuestas automáticas basadas en IA para consultas comunes
- **Panel administrativo**: Gestión completa de contenidos, opciones y configuración
- **Integración con IA**: Utiliza Groq AI para respuestas naturales y contextuales
- **Menú interactivo**: Navegación sencilla por opciones con números
- **Tracking de envíos**: Consultas automatizadas de estado de paquetes
- **Múltiples servicios**: Cotizaciones, ubicaciones, métodos de pago y más

## 🚀 Instalación

### Requisitos previos
- Node.js v14 o superior
- NPM v6 o superior
- Cuenta de WhatsApp activa

### Pasos de instalación

1. **Instalar dependencias**
```bash
npm install
```

2. **Configurar variables de entorno**
   - Crea un archivo `.env` en la raíz del proyecto
   - Añade las siguientes variables:
```
PORT=3000
ADMIN_PANEL_PORT=3001
GROQ_API_KEY=tu_clave_api_de_groq
```

3. **Iniciar el bot**
```bash
npm start
```

## 🔧 Configuración Inicial

Al iniciar el bot por primera vez:

1. Escanea el código QR mostrado en consola con WhatsApp para iniciar sesión
2. Accede al panel de administración:
   - URL: `http://localhost:3001/admin`
   - Usuario: `courierAdmin`
   - Contraseña: `Courier2025@secure`
3. Personaliza los mensajes y opciones desde el panel

## 📱 Funcionalidades

### Panel Administrativo
- **Dashboard**: Vista general del sistema
- **Edición de contenido**: Personalizar textos informativos
- **Configuración de menú**: Gestión de opciones interactivas
- **Configuración de IA**: Ajuste de parámetros y contexto
- **Control de WhatsApp**: Reconexión y gestión de sesión

### Bot de WhatsApp
- **Menú interactivo**: Navegación por opciones numéricas
- **Respuestas automáticas**: Para consultas frecuentes
- **Asistente IA**: Para consultas más complejas
- **Derivación a asesores**: Para casos que requieren atención humana
- **Tracking automático**: Reconoce números de seguimiento

##  Tecnologías Utilizadas

### Backend
- **Node.js**: Entorno de ejecución para JavaScript en el servidor
- **Express.js**: Framework web para crear el servidor y APIs
- **Whatsapp-web.js**: Librería para interactuar con WhatsApp Web
- **Groq AI**: API de inteligencia artificial para procesamiento de lenguaje natural
- **Bcrypt**: Para encriptación de contraseñas
- **Express-session**: Gestión de sesiones de usuario
- **FS (File System)**: Para lectura y escritura de archivos de configuración
- **Dotenv**: Carga de variables de entorno

### Frontend
- **EJS (Embedded JavaScript)**: Motor de plantillas para generar HTML dinámico
- **Bootstrap 5**: Framework CSS para diseño responsivo
- **jQuery**: Biblioteca de JavaScript para manipulación del DOM
- **Font Awesome**: Iconos vectoriales y estilos CSS
- **Chart.js**: Biblioteca para visualización de datos y estadísticas
- **SweetAlert2**: Para mostrar alertas y diálogos modernos
- **AJAX**: Para comunicación asíncrona con el servidor

## �📚 Estructura del Proyecto

```
c/
├── adapters/          # Adaptadores para servicios externos
├── admin/             # Panel de administración
│   ├── public/        # Archivos estáticos (CSS, JS)
│   ├── routes/        # Rutas de la API
│   └── views/         # Plantillas EJS
├── config/            # Archivos de configuración
├── data/              # Datos persistentes
├── services/          # Servicios principales
├── state/             # Gestión de estado
└── utils/             # Utilidades
```


### Reiniciar configuración
Si necesitas reiniciar toda la configuración:
1. Detén el bot
2. Elimina la carpeta `config/whatsapp-auth/`
3. Elimina `config/admin.json` y `config/whatsappStatus.json`
4. Elimina `.wwebjs_cache`
5. Reinicia el bot

## 🛠️ Personalización

### Modificar respuestas
1. Accede al panel de administración
2. Ve a "Editar Contexto IA" 
3. Actualiza las respuestas para cada categoría

### Cambiar opciones del menú
1. Accede al panel de administración
2. Ve a "Editar Menú"
3. Añade, modifica o elimina opciones

## 📈 Análisis y Métricas

El bot guarda métricas sobre:
- Consultas procesadas por la IA
- Tasa de respuestas exitosas
- Derivaciones a atención humana

Estas métricas se pueden consultar en `data/ai-metrics.json`

## Solución de Problemas

### El bot no se conecta a WhatsApp
1. Verifica tu conexión a internet
2. Asegúrate que tu sesión de WhatsApp no esté abierta en otro dispositivo
3. Elimina la carpeta `config/whatsapp-auth/` y vuelve a escanear el código QR

### Error en el panel de administración
1. Verifica que el puerto 3001 esté disponible
2. Comprueba que los archivos de configuración tengan permisos de escritura


## Licencia
Hecho por @Crisjo