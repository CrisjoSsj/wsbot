// Servidor Express básico para mantener el proyecto activo en Glitch
const express = require('express');
const {
  generarTextoMenu,
  generarTextoAyuda,
  generarMenuAdmin,
  generarTextoBienvenida,
  printQr
} = require('./prints');
const {
  debeEnviarBienvenidaDiaria,
  parseLoginUser,
  parseLoginPass,
  esComandoNombre,
  esComandoHorario,
  esComandoEnvio,
  esComandoPago,
  esComandoConfig,
  esComandoLogout,
  parseCmdAdd,
  parseCmdDel,
  esCmdList,
  obtenerOpcionNumerica
} = require('./inputs');
const { crearClienteWhatsApp, iniciarCliente } = require('./adapters/whatsapp');
const { botConfig, cargarConfigDesdeDisco, guardarConfigEnDisco } = require('./config/botConfig');
const { obtenerEstadoDelChat } = require('./state/chatState');
const {
  agregarComandoPersonalizado,
  eliminarComandoPersonalizado,
  listarComandosPersonalizados
} = require('./services/comandosPersonalizados.service');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_WINDOWS = process.platform === 'win32';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '1234';
const ADMIN_TRIGGER = (process.env.ADMIN_TRIGGER || 'panel#admin').toLowerCase();

// Cargar configuración al inicio
cargarConfigDesdeDisco();

// Funciones de impresión y parseo en `prints.js` e `inputs.js`

// Endpoint de salud y raíz
app.get('/', (_req, res) => {
  res.send('✅ Bot de WhatsApp activo.');
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'alive' });
});

// Evento: Recepción de mensajes y respuestas automáticas
async function onMessageHandler(message) {
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
    const userFromMsg = parseLoginUser(rawText);
    if (userFromMsg) {
      state.pendingUser = userFromMsg;
      await message.reply('Usuario recibido. Ahora escribe: pass TU_PASSWORD');
      return;
    }

    const passFromMsg = parseLoginPass(rawText);
    if (passFromMsg) {
      const pass = passFromMsg;
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
      if (esComandoNombre(rawText)) {
        botConfig.storeName = rawText.split(':').slice(1).join(':').trim() || botConfig.storeName;
        guardarConfigEnDisco();
        await message.reply(`✔️ Nombre actualizado: ${botConfig.storeName}`);
        return;
      }
      if (esComandoHorario(rawText)) {
        botConfig.horarioText = rawText.split(':').slice(1).join(':').trim() || botConfig.horarioText;
        guardarConfigEnDisco();
        await message.reply('✔️ Horario actualizado.');
        return;
      }
      if (esComandoEnvio(rawText)) {
        botConfig.envioText = rawText.split(':').slice(1).join(':').trim() || botConfig.envioText;
        guardarConfigEnDisco();
        await message.reply('✔️ Envío actualizado.');
        return;
      }
      if (esComandoPago(rawText)) {
        botConfig.pagoText = rawText.split(':').slice(1).join(':').trim() || botConfig.pagoText;
        guardarConfigEnDisco();
        await message.reply('✔️ Pago actualizado.');
        return;
      }
      if (esComandoConfig(texto)) {
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
      if (esComandoLogout(texto)) {
        state.isAdmin = false;
        await message.reply('🔒 Sesión admin cerrada.');
        return;
      }

      // Gestión de comandos personalizados
      // cmd:add palabra: respuesta
      const addCmd = parseCmdAdd(rawText);
      if (addCmd) {
        const { palabra, respuesta } = addCmd;
        agregarComandoPersonalizado(palabra, respuesta);
        await message.reply(`✔️ Comando "${palabra}" guardado.`);
        return;
      }

      // cmd:del palabra
      const delPalabra = parseCmdDel(rawText);
      if (delPalabra !== null) {
        const palabra = delPalabra;
        if (!palabra) {
          await message.reply('Formato inválido. Usa: cmd:del palabra');
          return;
        }
        const eliminado = eliminarComandoPersonalizado(palabra);
        if (eliminado) {
          await message.reply(`🗑️ Comando "${palabra}" eliminado.`);
        } else {
          await message.reply('Ese comando no existe.');
        }
        return;
      }

      // cmd:list
      if (esCmdList(texto)) {
        const entries = listarComandosPersonalizados();
        if (!entries.length) {
          await message.reply('No hay comandos personalizados definidos.');
          return;
        }
        const listado = entries.map(([k, v]) => `- ${k}: ${v}`).join('\n');
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
      if (debeEnviarBienvenidaDiaria(state)) await message.reply(generarTextoBienvenida(botConfig.storeName));
      // Si ya se envió el saludo hoy, no responder más al saludo (ignorar)
      return;
    }

    // Menú por número 1
    const opcion = obtenerOpcionNumerica(texto);
    if (opcion === '1') {
      await message.reply(generarTextoMenu(botConfig.storeName));
      return;
    }

    // Información general
    if (opcion === '2') {
      await message.reply(generarTextoAyuda());
      return;
    }

    if (opcion === '3') {
      await message.reply(botConfig.horarioText);
      return;
    }

    if (opcion === '4') {
      await message.reply(botConfig.envioText);
      return;
    }

    if (opcion === '5') {
      await message.reply(botConfig.pagoText);
      return;
    }

    if (opcion === '0') {
      state.humanMode = true;
      await message.reply('👩‍💼 Te conectaremos con un asesor humano. El bot dejará de responder automáticamente. Escribe "bot" cuando quieras volver al modo automático. Tu proceso de compra, si estaba en curso, quedará pausado.');
      return;
    }

    if (opcion === '9') {
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

    // Si no coincide con ningún comando, sugerir menú numérico
    await message.reply('No te entendí. Envía 1 para ver el menú.');
    return;
  } catch (error) {
    console.error('Error procesando mensaje:', error);
  }
}

// Crear cliente desde el adaptador y pasar callbacks
const client = crearClienteWhatsApp({
  clientId: 'glitch-bot',
  onQr: (qr) => printQr(qr),
  onReady: () => console.log('🤖 Cliente de WhatsApp listo.'),
  onChangeState: (state) => console.log('🔄 Estado del cliente:', state),
  onAuthenticated: () => console.log('🔐 Autenticado con éxito.'),
  onAuthFailure: (msg) => console.error('❌ Falla de autenticación:', msg),
  onDisconnected: (reason, cli) => {
    console.error('🔌 Desconectado:', reason);
    setTimeout(() => {
      try {
        console.log('🔁 Reintentando inicializar cliente...');
        cli.initialize();
      } catch (e) {
        console.error('Error reintentando inicializar:', e);
      }
    }, 3000);
  },
  onMessage: onMessageHandler
});

// Iniciar cliente y servidor web
client.initialize();

app.listen(PORT, () => {
  console.log(`Servidor web escuchando en puerto ${PORT}`);
});


