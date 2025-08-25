'use strict';

// adaptador para inicializar y manejar el cliente de whatsapp-web.js
const { Client, LocalAuth } = require('whatsapp-web.js');

// funcion para crear el cliente de WhatsApp con suscriptores a eventos
function crearClienteWhatsApp(opciones = {}) {
  const {
    // identificador de cliente para la persistencia local
    clientId = 'glitch-bot',
    // callbacks de eventos
    onQr,
    onReady,
    onChangeState,
    onAuthenticated,
    onAuthFailure,
    onDisconnected,
    onMessage
  } = opciones;

  // configuracion de puppeteer por plataforma
  const IS_WINDOWS = process.platform === 'win32';
  const puppeteerConfig = IS_WINDOWS
    ? { headless: true }
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

  // crear cliente con auth local y opciones recomendadas
  const client = new Client({
    authStrategy: new LocalAuth({ 
      clientId,
      dataPath: './config/whatsapp-auth'
    }),
    restartOnAuthFail: true,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 10000,
    qrMaxRetries: 5,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials'
      ],
      // Timeouts más largos
      defaultViewport: null,
      browserWSEndpoint: null,
      navigationTimeout: 120000,
      waitUntil: 'networkidle0'
    }
  });

  // Variables para control de reconexión
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  let reconnectTimeout = null;

  // Función de reinicio con retardo exponencial
  const scheduleReconnect = (reason) => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Máximo número de intentos de reconexión alcanzado');
      if (onDisconnected) onDisconnected(reason, client);
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    console.log(`Programando reconexión en ${delay}ms (intento ${reconnectAttempts + 1})`);
    
    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
      console.log('Intentando reconexión...');
      try {
        if (onChangeState) onChangeState('connecting');
        client.initialize();
        reconnectAttempts++;
      } catch (error) {
        console.error('Error durante la reconexión:', error);
        scheduleReconnect('error durante reconexión');
      }
    }, delay);
  };

  // Suscribirse a eventos con manejo mejorado de errores
  if (onQr) {
    client.on('qr', (qr) => {
      reconnectAttempts = 0; // Resetear intentos cuando se obtiene QR
      onQr(qr);
    });
  }

  if (onReady) {
    client.on('ready', () => {
      reconnectAttempts = 0; // Resetear intentos cuando está listo
      onReady();
    });
  }

  if (onChangeState) {
    client.on('change_state', (state) => {
      console.log('Cambio de estado WhatsApp:', state);
      onChangeState(state);
    });
  }

  if (onAuthenticated) {
    client.on('authenticated', () => {
      reconnectAttempts = 0; // Resetear intentos al autenticar
      onAuthenticated();
    });
  }

  if (onAuthFailure) {
    client.on('auth_failure', (msg) => {
      console.error('Fallo de autenticación:', msg);
      onAuthFailure(msg);
      scheduleReconnect('auth_failure');
    });
  }

  // Manejar desconexiones y errores
  client.on('disconnected', async (reason) => {
    console.log('Cliente desconectado:', reason);
    // Si la razón es "logout", no intentar reconectar inmediatamente
    if (reason === 'logout') {
      if (onDisconnected) onDisconnected(reason, client);
      // Limpiar la sesión de WhatsApp
      try {
        await client.destroy();
        console.log('Sesión limpiada correctamente después de logout');
        // Esperar más tiempo antes de reiniciar en caso de logout
        setTimeout(() => {
          console.log('Reiniciando cliente después de logout...');
          try {
            if (onChangeState) onChangeState('connecting');
            client.initialize();
          } catch (error) {
            console.error('Error al reinicializar después de logout:', error);
            if (onChangeState) onChangeState('error');
          }
        }, 5000); // Esperar 5 segundos antes de reiniciar
      } catch (error) {
        console.error('Error al limpiar sesión:', error);
        if (onChangeState) onChangeState('error');
      }
    } else {
      if (onDisconnected) onDisconnected(reason, client);
      scheduleReconnect(reason);
    }
  });

  // Capturar errores no manejados del cliente
  client.on('error', (error) => {
    console.error('Error en el cliente de WhatsApp:', error);
    if (error.message.includes('Execution context was destroyed')) {
      console.log('Detectado error de contexto destruido, intentando reconexión...');
      scheduleReconnect('context_destroyed');
    }
  });

  if (onMessage) {
    client.on('message', async (message) => {
      try {
        await onMessage(message);
      } catch (error) {
        console.error('Error procesando mensaje:', error);
      }
    });
  }

  return client;
}

// funcion para iniciar el cliente (conectar y mostrar QR si aplica)
function iniciarCliente(client) {
  client.initialize();
}

// Cerrar sesión y destruir el cliente de WhatsApp de forma segura
async function logoutClienteWhatsApp(client) {
  if (!client) return;
  try {
    console.log('Iniciando cierre de sesión de WhatsApp...');
    // Intentar logout si está disponible
    if (typeof client.logout === 'function') {
      await client.logout();
      console.log('Logout ejecutado sobre el cliente.');
    }
    // Destruir cliente para limpiar recursos locales
    if (typeof client.destroy === 'function') {
      await client.destroy();
      console.log('Cliente destruido correctamente.');
    }
    // Intentar limpiar almacenamiento local (LocalAuth) si aplica
    try {
      const fs = require('fs');
      const authPath = './config/whatsapp-auth';
      if (fs.existsSync(authPath)) {
        // No eliminamos automáticamente por seguridad, pero dejamos nota
        console.log(`Nota: las credenciales locales permanecen en ${authPath}. Elimina manualmente si deseas limpiar totalmente la sesión.`);
      }
    } catch (e) {}
  } catch (error) {
    console.error('Error cerrando sesión de WhatsApp:', error);
  }
}

module.exports = {
  crearClienteWhatsApp,
  iniciarCliente,
  logoutClienteWhatsApp
};


