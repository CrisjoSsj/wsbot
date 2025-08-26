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
    takeoverTimeoutMs: 30000,
    qrMaxRetries: 999,       // Aumentado para generar códigos QR indefinidamente
    qrRefreshIntervalMs: 60000, // Tiempo más largo entre generaciones de QR (60 segundos)
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
  const MAX_RECONNECT_ATTEMPTS = 999; // Prácticamente infinito para que siempre intente reconectarse
  let reconnectTimeout = null;

  // Función de reinicio con retardo exponencial (modificada para persistir)
  const scheduleReconnect = (reason) => {
    // Eliminar la condición de máximo número de intentos para seguir intentando siempre
    // if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    //   console.error('Máximo número de intentos de reconexión alcanzado');
    //   if (onDisconnected) onDisconnected(reason, client);
    //   return;
    // }

    // Usar un delay máximo de 30 segundos, pero seguir intentando
    const delay = Math.min(1000 * Math.pow(1.5, Math.min(reconnectAttempts, 8)), 30000);
    console.log(`🔄 Programando reconexión en ${delay/1000} segundos (intento ${reconnectAttempts + 1})`);
    
    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
      console.log('🔄 Intentando reconexión...');
      try {
        if (onChangeState) onChangeState('connecting');
        client.initialize();
        reconnectAttempts++;
        
        // Si los intentos son muchos, reseteamos el contador para evitar delays muy largos
        if (reconnectAttempts > 20) {
          console.log('🔄 Reseteando contador de intentos para mantener delays razonables');
          reconnectAttempts = 5;
        }
      } catch (error) {
        console.error('❌ Error durante la reconexión:', error);
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
    console.log('Cliente desconectado. Razón:', reason);
    const lowerReason = String(reason || '').toLowerCase();

    // Si la desconexión viene por cierre desde el teléfono (logout), delegar solamente
    // al callback superior para que ejecute exactamente el mismo flujo que el botón web
    const isPhoneLogout = reason === 'logout' || lowerReason.includes('logout') || lowerReason.includes('phone');
    if (isPhoneLogout) {
      console.log('📴 Cierre de sesión detectado desde teléfono. Delegando al manejador superior...');
      if (onDisconnected) onDisconnected('logout', client);
      return; // No hacer ninguna limpieza adicional aquí
    }

    // Para otras razones de desconexión, intentar reconectar normalmente
    if (onDisconnected) onDisconnected(reason, client);
    scheduleReconnect(reason);
  });

  // Capturar errores no manejados del cliente con mejor manejo de errores de sesión
  client.on('error', (error) => {
    console.error('❌ Error en el cliente de WhatsApp:', error.message || error);
    
    // Detectar errores relacionados con la sesión o el navegador
    const errorMsg = String(error.message || error).toLowerCase();
    
    // Lista de patrones de error que indican problemas con la sesión
    const sessionErrors = [
      'execution context was destroyed',
      'session',
      'protocol error',
      'browser closed',
      'connection closed',
      'not opened',
      'disconnected',
      'timeout',
      'cannot open browser',
      'browser crashed',
      'terminated',
      'failed to start browser',
      'was detached',
      'target closed',
      'remote object',
      'page crashed'
    ];
    
    // Verificar si el error está relacionado con la sesión
    const isSessionError = sessionErrors.some(pattern => errorMsg.includes(pattern));
    
    if (isSessionError) {
      console.log('🔍 Detectado error relacionado con la sesión/navegador');
      console.log('🔄 Programando reinicio con limpieza de sesión...');
      
      // Tratar como una desconexión con sesión inválida
      client.emit('disconnected', 'session_error_detected');
    } 
    else if (errorMsg.includes('context')) {
      console.log('🔍 Detectado error de contexto, intentando reconexión...');
      scheduleReconnect('context_destroyed');
    }
    else {
      // Para otros errores, intentar reconectar normalmente
      scheduleReconnect('client_error');
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
async function logoutClienteWhatsApp(client, cleanSession = true) {
  if (!client) return;
  
  try {
    console.log('🔑 Iniciando cierre de sesión de WhatsApp...');
    
    // Intentar logout si está disponible
    if (typeof client.logout === 'function') {
      try {
        await client.logout();
        console.log('✅ Logout ejecutado sobre el cliente.');
      } catch (logoutError) {
        console.error('❌ Error durante logout:', logoutError.message);
      }
    }
    
    // Destruir cliente para limpiar recursos locales
    if (typeof client.destroy === 'function') {
      try {
        await client.destroy();
        console.log('✅ Cliente destruido correctamente.');
      } catch (destroyError) {
        console.error('❌ Error al destruir cliente:', destroyError.message);
      }
    }
    
    // Limpiar almacenamiento local (LocalAuth) si se solicita
    if (cleanSession) {
      try {
        const fs = require('fs');
        const path = require('path');
        const authPath = path.join(process.cwd(), 'config', 'whatsapp-auth');
        
        if (fs.existsSync(authPath)) {
          console.log(`🧹 Limpiando datos de sesión en: ${authPath}`);
          
          // Función para eliminar directorio recursivamente
          const deleteFolderRecursive = (folderPath) => {
            if (fs.existsSync(folderPath)) {
              fs.readdirSync(folderPath).forEach((file) => {
                const curPath = path.join(folderPath, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                  deleteFolderRecursive(curPath);
                } else {
                  try { fs.unlinkSync(curPath); } catch (e) {}
                }
              });
              try { fs.rmdirSync(folderPath); } catch (e) {}
            }
          };
          
          // Solo eliminar los archivos de sesión, no toda la carpeta de autenticación
          const sessionFolders = fs.readdirSync(authPath)
                                 .filter(f => f.startsWith('session-'))
                                 .map(f => path.join(authPath, f));
          
          for (const folder of sessionFolders) {
            deleteFolderRecursive(folder);
          }
          
          console.log('✅ Datos de sesión limpiados correctamente');
        }
      } catch (cleanError) {
        console.error('❌ Error al limpiar archivos de sesión:', cleanError.message);
      }
    } else {
      console.log('ℹ️ No se ha solicitado limpieza de datos. La sesión permanecerá almacenada.');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error general cerrando sesión de WhatsApp:', error.message);
    return false;
  }
}

// Reiniciar el cliente con sesión limpia
async function reiniciarClienteConSesionLimpia(client) {
  if (!client) return false;
  
  try {
    console.log('🔄 Iniciando reinicio del cliente con limpieza de sesión...');
    
    // Cerrar sesión y limpiar datos
    await logoutClienteWhatsApp(client, true);
    
    // Esperar un momento antes de reiniciar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Reiniciar el cliente
    console.log('🔄 Reiniciando cliente de WhatsApp...');
    client.initialize();
    
    return true;
  } catch (error) {
    console.error('❌ Error reiniciando el cliente:', error.message);
    return false;
  }
}

module.exports = {
  crearClienteWhatsApp,
  iniciarCliente,
  logoutClienteWhatsApp,
  reiniciarClienteConSesionLimpia
};


