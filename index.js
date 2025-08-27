require('dotenv').config();
// Servidor Express básico para mantener el proyecto activo en Glitch
const express = require('express');
const path = require('path');
const { printQr } = require('./prints');
const { crearClienteWhatsApp, iniciarCliente } = require('./adapters/whatsapp');
const botConfig = require('./config/botConfig');
const { obtenerEstadoDelChat } = require('./state/chatState');
// Se elimina el uso de contenidos y productos estáticos en favor de IA + asesor
const {
  iniciarConfigWatcher,
  recargarConfiguracion
} = require('./services/configWatcher.service');
const whatsappStatus = require('./services/whatsappStatus.service');

// Importar panel de administración
const { iniciarPanelAdmin } = require('./admin');

const helmet = require('helmet');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const IS_WINDOWS = process.platform === 'win32';

// Manejadores globales para evitar que el proceso se caiga por errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('[GLOBAL] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[GLOBAL] Uncaught Exception:', err);
});

// Activar gestión de memoria para entornos con recursos limitados
try {
  const memoryManagement = require('./utils/memory-management');
  memoryManagement.startMemoryMonitoring();
  console.log('✅ Sistema de gestión de memoria para recursos limitados iniciado');
} catch (memError) {
  console.error('❌ Error al iniciar sistema de gestión de memoria:', memError.message);
}

// Seguridad HTTP y CORS
app.use(helmet());
app.use(cors()); // Puedes personalizar los orígenes permitidos aquí

// Cargar configuración al inicio
botConfig.cargarConfigDesdeDisco();

// Iniciar el observador de cambios en el archivo de configuración
iniciarConfigWatcher();

// Funciones de impresión y parseo en `prints.js` e `inputs.js`

// Endpoint de salud y raíz
app.get('/', (_req, res) => {
  res.send('✅ Bot de WhatsApp activo.');
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'alive' });
});

// Importar servicio de AI
const aiService = require('./services/ai.service');



// Helper para enviar respuestas (sin añadir pista automática)
async function replyWithAdvisorHint(message, text) {
  try {
    const body = String(text || '');
    return await message.reply(body);
  } catch (e) {
    console.error('Error en replyWithAdvisorHint:', e);
    try {
      return await message.reply(String(text || ''));
    } catch (err) {
      console.error('Error enviando fallback en replyWithAdvisorHint:', err);
    }
  }
}

// Evento: Recepción de mensajes y respuestas automáticas
async function onMessageHandler(message) {
  try {
    // Ignorar mensajes vacíos, undefined o null
    if (!message || !message.body) {
      console.log('Mensaje ignorado: contenido vacío o indefinido');
      return;
    }
    // Ignorar mensajes del sistema o con remitente vacío
    if (!message.from || message.from === 'status@broadcast') {
      console.log('Mensaje ignorado: remitente indefinido o mensaje de estado');
      return;
    }
    // Verificar si el mensaje viene de un chat archivado o de un grupo
    try {
      const chat = await message.getChat();
      if (chat.archived) {
        console.log(`Mensaje ignorado de chat archivado: ${message.from}`);
        return; // No responder a chats archivados
      }
      
      // Verificar si es un grupo y no responder
      if (chat.isGroup) {
        console.log(`Mensaje ignorado de grupo: ${message.from}`);
        return; // No responder a mensajes de grupos
      }
    } catch (error) {
      console.error('Error al verificar el tipo de chat:', error);
      // Continuar procesando el mensaje aunque no podamos verificar el tipo de chat
    }
    // Limitar longitud del mensaje para evitar desbordamientos
    const rawText = (message.body || '').trim().substring(0, 1000); // Limitar a 1000 caracteres
    const texto = rawText.toLowerCase();
    const chatId = message.from;
    // Inicializar o recuperar estado del chat de forma segura
    const state = obtenerEstadoDelChat(chatId);

  // --- BUFFER DE MENSAJES POR USUARIO ---
    if (!global.userMessageBuffers) global.userMessageBuffers = {};
    if (!global.userMessageTimers) global.userMessageTimers = {};
    if (!global.userMessageBuffers[chatId]) global.userMessageBuffers[chatId] = [];

    // Si está en modo asesor humano, no usar buffer
      if (state.humanMode) {
      // Si el usuario quiere volver al asistente virtual
      if (['bot'].includes(texto)) {
        state.humanMode = false;
        // Reactivar IA cuando el admin/usuario escribe 'bot'
        state.aiMode = true;
        await replyWithAdvisorHint(message, [
          '🤖 Asistente activado',
          '━━━━━━━━━━━━━━━━━━━━━━',
          '',
          'El asistente virtual está listo. Escribe tu pregunta y te responderé. 😊',
          '',
          'Envía *menu1* para volver al menú en cualquier momento.'
        ].join('\n'));
        return;
      }

  // Si quiere volver al menú estático desde la conversación con el asesor
  // Solo permitimos el comando exacto 'menu1' desde humanMode
  if (texto === 'menu1') {
        // Limpiar buffers y timers
        global.userMessageBuffers[chatId] = [];
        if (global.userMessageTimers[chatId]) {
          clearTimeout(global.userMessageTimers[chatId]);
          delete global.userMessageTimers[chatId];
        }
  state.humanMode = false;
  state.aiMode = false;
  // Log de auditoría: salida de humanMode
  console.log(`[AUDIT] ${new Date().toISOString()} - Chat ${chatId} - SALIDA humanMode (volviendo al menú)`);
  const { generarTextoMenu } = require('./prints');
  await replyWithAdvisorHint(message, generarTextoMenu());
        return;
      }

      // Si no es comando relevante, no interferir con la conversación humana
      return;
    }
    
  // Comando para volver al menú estático y desactivar IA (menu1)
  if (texto === 'menu1') {
      // Limpiar buffers y timers
      global.userMessageBuffers[chatId] = [];
      if (global.userMessageTimers[chatId]) {
        clearTimeout(global.userMessageTimers[chatId]);
        delete global.userMessageTimers[chatId];
      }
      state.aiMode = false;
      state.humanMode = false;
  const { generarTextoMenu } = require('./prints');
  await replyWithAdvisorHint(message, generarTextoMenu());
      return;
    }

    // Si el usuario envía '4' mientras la IA está activa, derivar inmediatamente a asesor humano
  if (texto === '4' && state.aiMode) {
      // Limpiar buffers y timers
      global.userMessageBuffers[chatId] = [];
      if (global.userMessageTimers[chatId]) {
        clearTimeout(global.userMessageTimers[chatId]);
        delete global.userMessageTimers[chatId];
      }
      // Cambiar a modo humano
      state.aiMode = false;
      state.humanMode = true;
      await replyWithAdvisorHint(message, [

        '👩‍💼 Te conectamos con un asesor',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        'Gracias — en breve un asesor humano te atenderá. 😊',
        '',
        'Puedes escribir *bot* para volver al asistente o *menu1* para ver el menú.'
      ].join('\n'));
      return;
    }

    // Si la IA está activa para este chat, usar buffer de 10s para agrupar mensajes
    if (state.aiMode) {
      try {
        // Push al buffer del chat
        global.userMessageBuffers[chatId].push(rawText);

        // Reiniciar timer de 10s
        if (global.userMessageTimers[chatId]) clearTimeout(global.userMessageTimers[chatId]);
        global.userMessageTimers[chatId] = setTimeout(async () => {
          try {
            const messages = global.userMessageBuffers[chatId].filter(Boolean);
            const combined = messages.join('\n');

            // Limpiar buffer y timer
            global.userMessageBuffers[chatId] = [];
            clearTimeout(global.userMessageTimers[chatId]);
            delete global.userMessageTimers[chatId];

            const aiResponse = await aiService.processMessageWithAI(chatId, combined, state);
            if (aiResponse && aiResponse.success) {
              await replyWithAdvisorHint(message, aiResponse.text);
              return;
            } else {
              // IA no puede responder -> derivar a asesor humano y desactivar IA
              state.aiMode = false;
              state.humanMode = true;
              console.log(`[AUDIT] ${new Date().toISOString()} - Chat ${chatId} - ENTRADA humanMode (IA no pudo responder)`);
              await replyWithAdvisorHint(message, [
                '👩‍💼 Te conectamos con un asesor',
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                '',
                'No tengo una respuesta clara para esto; te paso con un asesor humano. 👩‍💼',
                '',
                'Envía *bot* para volver al asistente o *menu1* para ver el menú.'
              ].join('\n'));
              return;
            }
          } catch (aiError) {
            console.error('Error procesando IA en buffer:', aiError);
            state.aiMode = false;
            state.humanMode = true;
            console.log(`[AUDIT] ${new Date().toISOString()} - Chat ${chatId} - ENTRADA humanMode (error en IA)`);
              try {
              await replyWithAdvisorHint(message, [
                '🔄 Ups — tuvimos un problema técnico procesando tu solicitud. Te conecto con un asesor humano.',
                '',
                'Disculpa la molestia; puedes escribir *bot* para intentar volver al asistente o *menu1* para ver el menú.'
              ].join('\n'));
            } catch (replyErr) {
              console.error('Error enviando mensaje tras fallo de IA buffered:', replyErr);
            }
            return;
          }
        }, 10000);

        // Acknowledgement opcional (no enviar respuesta inmediata para no romper conversación), simplemente esperar al timer
        return;
      } catch (aiError) {
        console.error('Error iniciando buffer de IA:', aiError);
        state.aiMode = false;
        state.humanMode = true;
        console.log(`[AUDIT] ${new Date().toISOString()} - Chat ${chatId} - ENTRADA humanMode (error iniciando buffer)`);
        await replyWithAdvisorHint(message, [
          '🔄 Ups — tuvimos un problema técnico iniciando el asistente. Te conecto con un asesor humano.',
          '',
          'Puedes escribir *bot* para intentar volver al asistente o *menu1* para ver el menú.'
        ].join('\n'));
        return;
      }
    }

    // Determinar si es una opción numérica (1 dígito)
    const isNumericOption = /^[1-9]$/.test(texto);

  // Protección extra: si por alguna razón seguimos en humanMode, no procesar opciones numéricas
      if (state.humanMode && isNumericOption) {
      await replyWithAdvisorHint(message, [
        'Estás en conversación con un asesor humano. Sólo están activos los comandos:',
        '- *bot* → volver al asistente virtual',
    '- *menu1* → volver al menú estático'
      ].join('\n'));
      return;
    }

    // Si el usuario manda el comando para asesor (4), activar asistente virtual (IA)
    if (isNumericOption && texto === '4') {
      // Limpiar buffers
      global.userMessageBuffers[chatId] = [];
      clearTimeout(global.userMessageTimers[chatId]);
  // Activar IA (asistente virtual)
      state.aiMode = true;
      state.humanMode = false;
      const cfg = botConfig.obtenerConfiguracion();
      await replyWithAdvisorHint(message, [
        '🤖 *Asistente Virtual*',
        '━━━━━━━━━━━━━━━━━━━━━━',
        '',
        `Hola, soy tu asistente virtual de ${cfg.storeName || 'la tienda'}. ¿En qué puedo ayudarte?`,
        '',
        'Escribe tu consulta y te responderé. Si necesitas un asesor humano, vuelve a enviar *4*.'
      ].join('\n'));
      return;
    }

    // Manejo de opciones numéricas y texto libre

    if (isNumericOption) {
      // Opción 1: mostrar menú siempre, sin depender del JSON
      if (texto === '1') {
        const { generarTextoMenu } = require('./prints');
        await replyWithAdvisorHint(message, generarTextoMenu());
        return;
      }
      try {
        const cfg = botConfig.obtenerConfiguracion();
        const opts = Array.isArray(cfg.menu?.options) ? cfg.menu.options : [];
        const found = opts.find(o => String(o.number) === texto || (o.key && String(o.key) === texto));

        if (found) {
          // Opción 4: activar asistente virtual (IA)
          if (String(found.number) === '4') {
            state.aiMode = true;
            state.humanMode = false;
            const cfg = botConfig.obtenerConfiguracion();
            await replyWithAdvisorHint(message, [
              '🤖 *Asistente Virtual*',
              '━━━━━━━━━━━━━━━━━━━━━━',
              '',
              `Hola, soy tu asistente virtual de ${cfg.storeName || 'la tienda'}. ¿En qué puedo ayudarte?`,
              '',
              'Escribe tu consulta y te responderé. Si necesitas un asesor humano, vuelve a enviar *4*.'
            ].join('\n'));
            return;
          }

          // Si la opción tiene respuesta estática, enviar y no usar IA
          if (found.response && String(found.response).trim()) {
            await replyWithAdvisorHint(message, String(found.response));
            return;
          }

          // Si la opción no tiene respuesta (vacía), derivar a asesor humano
          state.humanMode = true;
          console.log(`[AUDIT] ${new Date().toISOString()} - Chat ${chatId} - ENTRADA humanMode (opción sin respuesta)`);
          await message.reply([
            '👩‍💼 Te conectamos con un asesor',
            '━━━━━━━━━━━━━━━━━━━━━━',
            '',
            'Esa opción requiere atención humana. Un asesor te atenderá en breve. 😊',
            '',
            'Escribe *bot* para volver al asistente o *menu1* para ver el menú.'
          ].join('\n'));
          return;
        }
      } catch (err) {
        console.error('Error buscando opción en config.menu.options:', err);
        // Derivar a asesor si hay error
        state.humanMode = true;
        console.log(`[AUDIT] ${new Date().toISOString()} - Chat ${chatId} - ENTRADA humanMode (error buscando opción)`);
        await message.reply('Hubo un error al procesar tu solicitud; te conectamos con un asesor.');
        return;
      }

      // Si no se encuentra la opción numérica, dar guía y derivar
      await replyWithAdvisorHint(message, [
        'No reconozco esa opción. 🙃',
        '',
        'Por favor envía *1* para ver el menú o *4* para pedir ayuda humana.',
      ].join('\n'));
      return;
    }

    // Mensaje libre (no numérico)
    try {
      const cfg = botConfig.obtenerConfiguracion();
      const opts = Array.isArray(cfg.menu?.options) ? cfg.menu.options : [];
      const today = new Date().toISOString().slice(0,10);

      // Enviar saludo diario la primera vez que el usuario escribe en el día
      if (!state.lastWelcomeDay || state.lastWelcomeDay !== today) {
        state.lastWelcomeDay = today;
        let lines = ['━━━━━━━━━━━━━━━━━━━━━━', `👋 ${cfg.menu?.greeting || `¡Hola! Somos ${cfg.storeName || 'la tienda'}.`}`, '━━━━━━━━━━━━━━━━━━━━━━', ''];
        lines.push('Preguntas frecuentes:');
        
        // Opciones base obligatorias
        const baseOptions = [
          { number: '1', text: 'Ver este menú' },
          { number: '4', text: 'Contactar asesor' }
        ];
        
        // Unir opciones base con las del config, evitando duplicados
        const allNumbers = opts.map(o => String(o.number));
        const allOptions = [
          ...baseOptions.filter(base => !allNumbers.includes(base.number)),
          ...opts
        ];
        
        // Ordenar por número
        allOptions.sort((a, b) => Number(a.number) - Number(b.number));
        
        // Añadir al mensaje
        allOptions.forEach(o => lines.push(`${o.number}. ${o.text}`));
        lines.push('\nEnvía el número de la opción para continuar.');
        await replyWithAdvisorHint(message, lines.join('\n'));
        return;
      }

  // (IA inactiva en este punto) Si no está en aiMode, explicar cómo usar el menú

      // Si no está en aiMode, explicar cómo usar el menú
      await replyWithAdvisorHint(message, [
        'No entendí eso. 🤔',
        '',
        'Puedes enviar *1* para ver el menú o *4* para hablar con un asesor.',
      ].join('\n'));
      return;
    } catch (e) {
      console.error('Error manejando mensaje libre:', e);
      return;
    }
  return;
  } catch (error) {
    console.error('Error procesando mensaje:', error);
    
    try {
      // Evitar bucles de error - guardar el último error para este chat
      const errorTime = new Date().getTime();
      const chatId = message?.from;
      
      if (chatId) {
        const state = obtenerEstadoDelChat(chatId);
        
        // Evitar enviar múltiples mensajes de error al mismo chat
        if (!state.lastErrorTime || (errorTime - state.lastErrorTime > 60000)) { // 1 minuto entre mensajes de error
          state.lastErrorTime = errorTime;
          state.errorCount = (state.errorCount || 0) + 1;
          
          // Solo enviar mensaje de error si no hay demasiados errores recientes
          if (state.errorCount < 5) { // Máximo 5 mensajes de error por chat
            // Derivar a asesor automáticamente en caso de error
            state.humanMode = true;
            console.log(`[AUDIT] ${new Date().toISOString()} - Chat ${chatId} - ENTRADA humanMode (error general)`);
            await message.reply([
              '👩‍💼 *CONECTANDO CON ASESOR*',
              '',
              'Hubo un problema procesando tu mensaje, un asesor humano te atenderá en breve.',
              '',
              'Escribe *bot* cuando quieras volver al asistente virtual.'
            ].join('\n'));
          }
        }
      }
    } catch (secondaryError) {
      console.error('Error al manejar el error original:', secondaryError);
    }
  }
}

// Crear cliente desde el adaptador y pasar callbacks
const client = crearClienteWhatsApp({
  clientId: 'glitch-bot',
  onQr: (qr) => {
    printQr(qr);
    whatsappStatus.updateQrCode(qr);
  },
  onReady: () => {
    console.log('🤖 Cliente de WhatsApp listo.');
    whatsappStatus.updateStatus('ready');
    whatsappStatus.clearQrCode();
  },
  onChangeState: (state) => {
    console.log('🔄 Estado del cliente:', state);
    whatsappStatus.updateStatus(state);
  },
  onAuthenticated: () => {
    console.log('🔐 Autenticado con éxito.');
    whatsappStatus.updateStatus('authenticated');
  },
  onAuthFailure: (msg) => {
    console.error('❌ Falla de autenticación:', msg);
    whatsappStatus.updateStatus('auth_failure');
    // NO limpiamos el código QR para mantenerlo visible: whatsappStatus.clearQrCode();
    
    // Forzar reinicio para nuevo QR en caso necesario
    setTimeout(() => {
      try {
        console.log('🔄 Reiniciando cliente después de falla de autenticación...');
        client.initialize();
      } catch (error) {
        console.error('❌ Error al reinicializar tras auth_failure:', error);
        // En caso de error, programar otro intento en 5 segundos
        setTimeout(() => {
          try {
            console.log('🔄 Reintentando inicialización del cliente...');
            client.initialize();
          } catch (innerError) {
            console.error('❌ Error en segundo intento de inicialización:', innerError);
          }
        }, 5000);
      }
    }, 2000);
  },
  onDisconnected: async (reason, cli) => {
    console.log('🔌 Desconectado:', reason);
    whatsappStatus.updateStatus('disconnected');

    // Si la desconexión fue un logout (p.ej., desde el teléfono), ejecutar exactamente el mismo flujo
    // que el botón de "Cerrar Sesión" del panel: whatsappStatus.logout()
    const lowerReason = String(reason || '').toLowerCase();
    const isLogout = reason === 'logout' || lowerReason.includes('logout') || lowerReason.includes('phone');
    if (isLogout) {
      try {
        console.log('📴 Ejecutando flujo estándar de logout (equivalente al botón web)...');
        await whatsappStatus.logout();
      } catch (e) {
        console.error('Error ejecutando logout estándar:', e);
      }
      return; // No programar reconexión manual aquí
    }

    // Para otros casos, mantener la reconexión automática
    const reconnectTime = 3000; // 3 segundos
    console.log(`🔄 Programando reconexión en ${reconnectTime/1000} segundos...`);

    setTimeout(() => {
      try {
        console.log('🔄 Intentando reconectar a WhatsApp...');
        whatsappStatus.updateStatus('connecting');
        cli.initialize();
      } catch (error) {
        console.error('❌ Error reintentando inicializar:', error);
        whatsappStatus.updateStatus('error');

        // Si falla, programar otro intento en 5 segundos
        console.log('🔄 Programando nuevo intento en 5 segundos...');
        setTimeout(() => {
          try {
            console.log('🔄 Reintentando inicialización...');
            whatsappStatus.updateStatus('connecting');
            cli.initialize();
          } catch (innerError) {
            console.error('❌ Error en segundo intento:', innerError);
            whatsappStatus.updateStatus('error');
          }
        }, 5000);
      }
    }, reconnectTime);
  },
  onMessage: onMessageHandler
});

// Configurar el cliente en el servicio de estado
whatsappStatus.setWhatsappClient(client);
whatsappStatus.updateStatus('connecting');

// Iniciar cliente y servidor web
client.initialize();

const os = require('os');
app.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  let addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Servidor web escuchando en:`);
  addresses.forEach(ip => {
    console.log(`   → http://${ip}:${PORT}/`);
  });
  console.log(`   (o http://localhost:${PORT}/ si es local)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// Iniciar el panel de administración
iniciarPanelAdmin().catch(error => {
  console.error('Error al iniciar el panel de administración:', error);
});


