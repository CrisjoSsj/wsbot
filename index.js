// Servidor Express básico para mantener el proyecto activo en Glitch
const express = require('express');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_WINDOWS = process.platform === 'win32';
const STORE_NAME = process.env.STORE_NAME || 'Tienda Demo';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '1234';
const ADMIN_TRIGGER = (process.env.ADMIN_TRIGGER || 'panel#admin').toLowerCase();
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, 'config.json');

// Configuración editable en caliente (en memoria)
const botConfig = {
  storeName: STORE_NAME,
  horarioText: '🕒 Horario: Lun-Vie 9:00-18:00, Sáb 10:00-14:00. Domingos cerrado.',
  envioText: '🚚 Envíos: 24-48h. Costo estándar: 4.99 USD, gratis en compras superiores a 60 USD.',
  pagoText: '💳 Métodos de pago: Efectivo a contraentrega (en zonas disponibles) y Transferencia bancaria.',
  // Comandos personalizados: { 'palabra clave en minúsculas': 'respuesta de texto' }
  customCommands: {}
};

/**
 * Carga la configuración desde disco si existe, fusionando con los valores por defecto.
 */
function cargarConfigDesdeDisco() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        const merged = {
          storeName: data.storeName ?? botConfig.storeName,
          horarioText: data.horarioText ?? botConfig.horarioText,
          envioText: data.envioText ?? botConfig.envioText,
          pagoText: data.pagoText ?? botConfig.pagoText,
          customCommands: {
            ...(botConfig.customCommands || {}),
            ...(data.customCommands || {})
          }
        };
        Object.assign(botConfig, merged);
        console.log('⚙️ Configuración cargada desde disco.');
      }
    }
  } catch (e) {
    console.error('No se pudo cargar config.json:', e);
  }
}

/**
 * Guarda la configuración actual en disco (formato JSON).
 */
function guardarConfigEnDisco() {
  try {
    const payload = {
      storeName: botConfig.storeName,
      horarioText: botConfig.horarioText,
      envioText: botConfig.envioText,
      pagoText: botConfig.pagoText,
      customCommands: botConfig.customCommands
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(payload, null, 2), 'utf8');
    console.log('💾 Configuración guardada en', CONFIG_PATH);
  } catch (e) {
    console.error('No se pudo guardar config.json:', e);
  }
}

// Cargar configuración al inicio
cargarConfigDesdeDisco();

// Mapa en memoria para guardar estado por chat (modo humano, última bienvenida, admin)
const chatIdToState = new Map();

/**
 * Obtiene (o inicializa) el estado del chat.
 * Contiene banderas como modo humano, último día de bienvenida y si el chat está autenticado como admin.
 */
function obtenerEstadoDelChat(chatId) {
  if (!chatIdToState.has(chatId)) {
    chatIdToState.set(chatId, {
      humanMode: false, // cuando está activado, el bot no responde automáticamente
      lastWelcomeDay: null, // YYYY-MM-DD del último mensaje de bienvenida
      isAdmin: false
    });
  }
  return chatIdToState.get(chatId);
}

/**
 * Construye el texto del menú principal mostrado a los usuarios.
 */
function generarTextoMenu() {
  return [
    '━━━━━━━━━━━━━━━━━━━━━━',
    `🤖 ${botConfig.storeName}`,
    'Tu asistente en WhatsApp',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '🧭 Menú principal',
    '- "ayuda": guía rápida de uso',
    '- "horario": horarios de atención',
    '- "envio": información de envíos',
    '- "pago": métodos de pago',
    '- "contacto": hablar con un asesor',
    '',
    '✉️ Escribe "asesor" para hablar con una persona real.'
  ].join('\n');
}

/**
 * Construye el texto de ayuda con indicaciones básicas.
 */
function generarTextoAyuda() {
  return [
    'ℹ️ Ayuda rápida:',
    '- Usa "menu" para ver las opciones disponibles.',
    '- Si necesitas atención humana, escribe "asesor".',
    '- Para volver al bot, escribe "bot".'
  ].join('\n');
}

/**
 * Construye el texto del menú de administración (visible solo para chats autenticados).
 */
function generarMenuAdmin() {
  return [
    '🛠️ Panel de administración',
    '',
    'Editar contenidos:',
    '- nombre: Nuevo Nombre de Tienda',
    '- horario: Texto de horarios',
    '- envio: Texto de envíos',
    '- pago: Texto de formas de pago',
    '',
    'Comandos personalizados:',
    '- cmd:add palabra: respuesta  → crea/actualiza',
    '- cmd:del palabra            → elimina',
    '- cmd:list                   → listar',
    '',
    'Otros:',
    '- config?     → ver configuración actual',
    '- cerrarsesion (o logout) → salir del modo admin'
  ].join('\n');
}

/**
 * Genera una clave de fecha local en formato YYYY-MM-DD.
 */
function obtenerClaveFechaLocal(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Indica si debe enviarse la bienvenida diaria (máximo una vez al día por chat).
 */
function debeEnviarBienvenidaDiaria(state) {
  const today = obtenerClaveFechaLocal();
  if (state.lastWelcomeDay !== today) {
    state.lastWelcomeDay = today;
    return true;
  }
  return false;
}

/**
 * Construye el texto de bienvenida inicial.
 */
function generarTextoBienvenida() {
  return [
    `¡Hola! 👋 Soy ${botConfig.storeName}.`,
    'Para ayudarte puedes escribir:',
    '- "menu" para ver opciones',
    '- "asesor" para hablar con una persona real'
  ].join('\n');
}

// Endpoint de salud y raíz
app.get('/', (_req, res) => {
  res.send('✅ Bot de WhatsApp activo.');
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'alive' });
});

// Configuración de Puppeteer por plataforma
const puppeteerConfig = IS_WINDOWS
  ? {
      headless: true
    }
  : {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    };

// Inicialización del cliente de WhatsApp con persistencia de sesión local
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'glitch-bot' }),
  restartOnAuthFail: true,
  takeoverOnConflict: true,
  takeoverTimeoutMs: 5000,
  puppeteer: puppeteerConfig
});

// Evento: Mostrar QR en consola
client.on('qr', (qr) => {
  console.log('Escanea este QR para autenticar:');
  qrcode.generate(qr, { small: true });
});

// Evento: Cliente listo
client.on('ready', () => {
  console.log('🤖 Cliente de WhatsApp listo.');
});

client.on('change_state', (state) => {
  console.log('🔄 Estado del cliente:', state);
});

// Evento: Autenticación exitosa
client.on('authenticated', () => {
  console.log('🔐 Autenticado con éxito.');
});

// Evento: Autenticación fallida
client.on('auth_failure', (msg) => {
  console.error('❌ Falla de autenticación:', msg);
});

// Evento: Manejo de desconexión y reintento automático
client.on('disconnected', (reason) => {
  console.error('🔌 Desconectado:', reason);
  // Reintento básico de inicialización
  setTimeout(() => {
    try {
      console.log('🔁 Reintentando inicializar cliente...');
      client.initialize();
    } catch (e) {
      console.error('Error reintentando inicializar:', e);
    }
  }, 3000);
});

// Evento: Recepción de mensajes y respuestas automáticas
client.on('message', async (message) => {
  try {
    const rawText = (message.body || '').trim();
    const texto = rawText.toLowerCase();
    const chatId = message.from;
    const state = obtenerEstadoDelChat(chatId);

    // =========================
    // Bloque: Autenticación admin
    // Dos formas de entrar: (1) disparador secreto ADMIN_TRIGGER, (2) user/pass
    // =========================

    // (1) Disparador secreto para iniciar flujo de login sin ser predecible
    if (texto === ADMIN_TRIGGER) {
      await message.reply('🔐 Acceso administrativo. Escribe: user TU_USUARIO');
      return;
    }
    const matchUser = texto.match(/^user\s+(.+)/i);
    if (matchUser) {
      const user = matchUser[1].trim();
      state.pendingUser = user;
      await message.reply('Usuario recibido. Ahora escribe: pass TU_PASSWORD');
      return;
    }

    const matchPass = texto.match(/^pass\s+(.+)/i);
    if (matchPass) {
      const pass = matchPass[1].trim();
      const user = state.pendingUser || '';
      if (user === ADMIN_USER && pass === ADMIN_PASS) {
        state.isAdmin = true;
        delete state.pendingUser;
        await message.reply('✅ Autenticación correcta. Modo admin activo en este chat.\n\n' + generarMenuAdmin());
      } else {
        state.isAdmin = false;
        delete state.pendingUser;
        await message.reply('❌ Credenciales inválidas.');
      }
      return;
    }

    // =========================
    // Bloque: Comandos admin para personalizar textos (no listados en menú)
    // Formato: "nombre: Tienda X", "horario: ...", "envio: ...", "pago: ...", "config?", "logout"
    // =========================
    if (state.isAdmin) {
      if (/^nombre\s*:/i.test(rawText)) {
        botConfig.storeName = rawText.split(':').slice(1).join(':').trim() || botConfig.storeName;
        guardarConfigEnDisco();
        await message.reply(`✔️ Nombre actualizado: ${botConfig.storeName}`);
        return;
      }
      if (/^horario\s*:/i.test(rawText)) {
        botConfig.horarioText = rawText.split(':').slice(1).join(':').trim() || botConfig.horarioText;
        guardarConfigEnDisco();
        await message.reply('✔️ Horario actualizado.');
        return;
      }
      if (/^envio\s*:/i.test(rawText)) {
        botConfig.envioText = rawText.split(':').slice(1).join(':').trim() || botConfig.envioText;
        guardarConfigEnDisco();
        await message.reply('✔️ Envío actualizado.');
        return;
      }
      if (/^pago\s*:/i.test(rawText)) {
        botConfig.pagoText = rawText.split(':').slice(1).join(':').trim() || botConfig.pagoText;
        guardarConfigEnDisco();
        await message.reply('✔️ Pago actualizado.');
        return;
      }
      if (/^config\s*\?/i.test(texto)) {
        await message.reply(
          [
            '⚙️ Config actual:',
            `- nombre: ${botConfig.storeName}`,
            `- horario: ${botConfig.horarioText}`,
            `- envio: ${botConfig.envioText}`,
            `- pago: ${botConfig.pagoText}`,
            `- comandos: ${Object.keys(botConfig.customCommands).length} definidos`
          ].join('\n')
        );
        return;
      }
      if (/^(logout|cerrarsesion)$/i.test(texto)) {
        state.isAdmin = false;
        await message.reply('🔒 Sesión admin cerrada.');
        return;
      }

      // Gestión de comandos personalizados
      // cmd:add palabra: respuesta
      if (/^cmd:add\s+[^:]+:/i.test(rawText)) {
        const rest = rawText.slice(8).trim();
        const [palabraRaw, ...respParts] = rest.split(':');
        const palabra = (palabraRaw || '').trim().toLowerCase();
        const respuesta = respParts.join(':').trim();
        if (!palabra || !respuesta) {
          await message.reply('Formato inválido. Usa: cmd:add palabra: respuesta');
          return;
        }
        botConfig.customCommands[palabra] = respuesta;
        guardarConfigEnDisco();
        await message.reply(`✔️ Comando "${palabra}" guardado.`);
        return;
      }

      // cmd:del palabra
      if (/^cmd:del\s+.+/i.test(rawText)) {
        const palabra = rawText.slice(8).trim().toLowerCase();
        if (!palabra) {
          await message.reply('Formato inválido. Usa: cmd:del palabra');
          return;
        }
        if (botConfig.customCommands[palabra]) {
          delete botConfig.customCommands[palabra];
          guardarConfigEnDisco();
          await message.reply(`🗑️ Comando "${palabra}" eliminado.`);
        } else {
          await message.reply('Ese comando no existe.');
        }
        return;
      }

      // cmd:list
      if (/^cmd:list$/i.test(texto)) {
        const keys = Object.keys(botConfig.customCommands);
        if (!keys.length) {
          await message.reply('No hay comandos personalizados definidos.');
          return;
        }
        const listado = keys.map((k) => `- ${k}: ${botConfig.customCommands[k]}`).join('\n');
        await message.reply('📋 Comandos personalizados:\n' + listado);
        return;
      }
      // Si es admin y escribe algo no reconocido, no respondemos (o podríamos enviar una ayuda admin)
    }

    // Modo asesor (humano): silenciar respuestas automáticas
    if (state.humanMode) {
      if (['bot', 'salir asesor', 'salir', 'cancelar asesor', 'reanudar'].includes(texto)) {
        state.humanMode = false;
        await message.reply('✅ Modo bot reactivado. Puedes escribir "menu", "catalogo" o continuar con "comprar".');
      } else {
        // No responder para no interferir con el asesor humano
        // Puedes integrar aquí un reenvío a un panel interno si lo deseas
      }
      return;
    }

    // Respuestas automáticas principales
    if ([
      'hola', 'hello', 'buenas', 'buenos dias', 'buenos días', 'buenas tardes', 'buenas noches'
    ].includes(texto)) {
      if (debeEnviarBienvenidaDiaria(state)) await message.reply(generarTextoBienvenida());
      // Si ya se envió el saludo hoy, no responder más al saludo (ignorar)
      return;
    }

    if (texto === 'menu') {
      await message.reply(generarTextoMenu());
      return;
    }

    // Información general
    if (texto === 'ayuda') {
      await message.reply(generarTextoAyuda());
      return;
    }

    if (texto === 'horario' || texto === 'horarios') {
      await message.reply(botConfig.horarioText);
      return;
    }

    if (texto === 'envio' || texto === 'envíos') {
      await message.reply(botConfig.envioText);
      return;
    }

    if (texto === 'pago' || texto === 'pagos' || texto === 'metodos de pago') {
      await message.reply(botConfig.pagoText);
      return;
    }

    if (texto === 'asesor' || texto === 'humano' || texto === 'agente' || texto === 'persona') {
      state.humanMode = true;
      await message.reply('👩‍💼 Te conectaremos con un asesor humano. El bot dejará de responder automáticamente. Escribe "bot" cuando quieras volver al modo automático. Tu proceso de compra, si estaba en curso, quedará pausado.');
      return;
    }

    if (texto === 'contacto') {
      await message.reply('📞 Para hablar con una persona real, escribe "asesor".');
      return;
    }

    // Comandos personalizados (si no es admin y coincide, responder)
    const custom = botConfig.customCommands[texto];
    if (custom) {
      await message.reply(custom);
      return;
    }

    // Se removió flujo de catálogo/carrito/checkout

    // Si no coincide con ningún comando y NO está en checkout, ignorar
    return;
  } catch (error) {
    console.error('Error procesando mensaje:', error);
  }
});

// Iniciar cliente y servidor web
client.initialize();

app.listen(PORT, () => {
  console.log(`Servidor web escuchando en puerto ${PORT}`);
});


