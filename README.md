## Bot de WhatsApp en Glitch con whatsapp-web.js

Proyecto base en Node.js con Express y `whatsapp-web.js` para un bot de tienda. Incluye:
- Servidor HTTP (`/` y `/health`) para mantenerlo activo en Glitch
- Saludo automático 1 vez al día por chat
- Menú simple (horario, envío, pago, contacto, asesor)
- Modo asesor humano (pausa respuestas del bot)
- Administración por chat (usuario/contraseña) para cambiar textos sin tocar código
- Disparador secreto para abrir el panel admin y gestionar comandos personalizados
- Persistencia de configuración en `config.json` (se guarda automáticamente al editar desde admin)

### Requisitos
- Node.js 18+

### Instalación local (Windows/PowerShell)
```powershell
cd "C:\Users\Crisjo Ssj\Downloads\bigdateros-whatsappbot-python-main\bot\bot"
npm install
npm start
```
Escanea el QR en la consola: WhatsApp > Dispositivos vinculados > Vincular dispositivo.

### Despliegue en Glitch
1) Crea un proyecto Node.js en Glitch.  
2) Copia los archivos de `bot/` (incluye `package.json`, `index.js`, `watch.json`).  
3) En la consola de Glitch: `npm install` y `npm start`.  
4) Escanea el QR que aparece en los logs.

### Mantener activo con UptimeRobot
1) Crea un monitor HTTP(s) apuntando a: `https://TU-PROYECTO.glitch.me/health`  
2) Intervalo: cada 5 minutos.

## Uso del bot (usuario)
- `hola` (y variantes): envía bienvenida solo una vez al día por chat.
- `menu`: muestra el menú principal.
- `ayuda`: guía rápida.
- `horario`: horarios de atención.
- `envio`: información de envíos.
- `pago`: métodos de pago.
- `contacto`: indica cómo hablar con un asesor.
- `asesor`: activa modo humano (el bot deja de responder). Para volver al bot: `bot`.

Notas:
- Si el mensaje no está en el menú, el bot lo ignora (no responde).
- El saludo solo se manda una vez al día por chat.

## Administración por chat (oculto al usuario)
Permite cambiar textos sin editar código. No aparece en el menú.

0) Abrir panel (disparador secreto): envía el texto configurado en `ADMIN_TRIGGER` (por defecto `panel#admin`).

1) Iniciar sesión admin (solo por chat de WhatsApp):
```
user TU_USUARIO
pass TU_PASSWORD
```
Si las credenciales son correctas, el chat entra en modo admin.

2) Comandos de administración:
```
nombre: Nuevo nombre de tienda
horario: Texto de horarios
envio: Texto de envíos
pago: Texto de métodos de pago
config?
logout
cerrarsesion

# Comandos personalizados
cmd:add palabra: respuesta
cmd:del palabra
cmd:list
```
Detalles:
- `nombre:` cambia el nombre mostrado en la bienvenida/menú.
- `horario:` cambia la respuesta de horarios.
- `envio:` cambia la respuesta de envíos.
- `pago:` cambia la respuesta de pagos.
- `config?` muestra la configuración actual.
- `logout` o `cerrarsesion` cierra la sesión admin en ese chat.
- `cmd:add` crea/actualiza un comando personalizado (palabra exacta en minúsculas → respuesta).
- `cmd:del` elimina un comando personalizado por su palabra.
- `cmd:list` lista los comandos personalizados actuales.

Advertencia: estos cambios se guardan en memoria. Si el proceso se reinicia, se pierden. Puedes fijar valores por defecto con variables de entorno (abajo).
Ahora la configuración se guarda también en `config.json`, por lo que persiste entre reinicios. Puedes cambiar la ruta con `CONFIG_PATH`.

## Variables de entorno
- `STORE_NAME`: nombre de la tienda mostrado en mensajes.  
- `ADMIN_USER`: usuario para login admin por chat (por defecto `admin`).  
- `ADMIN_PASS`: contraseña para login admin por chat (por defecto `1234`).
- `ADMIN_TRIGGER`: disparador secreto para iniciar el login admin (por defecto `panel#admin`).
- `CONFIG_PATH`: ruta del archivo de configuración persistente (por defecto `./config.json`).

Ejemplo (Glitch > .env):
```
STORE_NAME="Mi Tienda"
ADMIN_USER="miusuario"
ADMIN_PASS="miclave"
```

## Endpoints HTTP
- `/` devuelve un texto de estado simple.
- `/health` devuelve `{ ok: true }` para monitores.

## Estructura
- `index.js`: servidor Express + cliente WhatsApp + lógica de menús y admin.
- `package.json`: dependencias (`express`, `whatsapp-web.js`, `qrcode-terminal`, `puppeteer`).
- `watch.json`: evita reinicios por cambios en sesión (`.wwebjs_auth`).

## Problemas comunes
- Si cerraste sesión en el teléfono y falla la conexión, borra `.wwebjs_auth/` y arranca de nuevo para forzar nuevo QR.
- Puppeteer descarga Chromium la primera vez (puede tardar). En Glitch se usan flags `--no-sandbox`.


