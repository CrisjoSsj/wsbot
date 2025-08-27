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
    qrMaxRetries: 999999,    // Prácticamente infinito para generar códigos QR indefinidamente
    qrRefreshIntervalMs: 30000, // Aumentado a 30 segundos para reducir carga en sistemas de bajos recursos
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
        '--disable-extensions',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--mute-audio',
        '--disable-sync',
        '--js-flags=--expose-gc',
        '--disable-default-apps',
        '--aggressive-cache-discard',
        '--disable-background-networking',
        '--single-process', // Importante para entornos de muy baja memoria
        '--memory-pressure-off',
        '--renderer-process-limit=1'
      ],
      // Ajustes para minimizar uso de memoria
      defaultViewport: { width: 800, height: 600 }, // Viewport más pequeño
      browserWSEndpoint: null,
      navigationTimeout: 180000, // Timeout más largo para sistemas lentos
      waitUntil: 'networkidle2', // Menos estricto que networkidle0
      ignoreHTTPSErrors: true
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
  
  // Control de tiempo máximo sin recibir QR
  let lastQrTime = Date.now();
  
  // Función para verificar si el QR está tardando demasiado en actualizarse
  const startQrWatchdog = () => {
    if (client._qrWatchdogTimer) {
      clearTimeout(client._qrWatchdogTimer);
    }
    client._qrWatchdogTimer = setTimeout(() => {
      const now = Date.now();
      const elapsedSinceLastQr = now - lastQrTime;
      
      // Si han pasado más de 5 minutos sin recibir QR, verificar estado antes de forzar reinicio
      // Aumentado a 5 minutos para sistemas con recursos limitados
      if (elapsedSinceLastQr > 300000) {
        console.log('⚠️ QR no actualizado en 5+ minutos, verificando estado de conexión...');
        try {
          // Verificar si el cliente ya está conectado usando cliente._isReady como indicador
          // También usar cualquier otra propiedad que indique que ya tenemos sesión activa
          const isAuthenticated = client && (
            client._isReady || 
            client.info || 
            client.authState?.state === 'CONNECTED' ||
            client.pupPage !== undefined // Si tenemos página del navegador es que hay alguna sesión
          );
          
          if (!isAuthenticated) {
            console.log('🔄 Cliente no autenticado, reiniciando para forzar nuevo QR');
            client.initialize();
            console.log('🔄 Cliente reiniciado para forzar nuevo QR');
          } else {
            console.log('✅ Cliente ya está conectado, no se forzará nuevo QR');
            // Actualizar el tiempo del último QR para evitar verificaciones continuas
            lastQrTime = Date.now();
          }
        } catch (error) {
          console.error('❌ Error al verificar estado o forzar reinicio:', error);
          // No programar reconexión automática si hay errores, para evitar ciclos infinitos
        }
      }
      
      // Continuar verificando
      startQrWatchdog();
    }, 120000); // Verificar cada 2 minutos en vez de cada minuto
  };
  
  // Iniciar el watchdog para la primera ejecución
  startQrWatchdog();
  
  // Almacenar función de reinicio del watchdog en el cliente para uso futuro
  client._restartQrWatchdog = startQrWatchdog;
  
  if (onQr) {
    client.on('qr', (qr) => {
      reconnectAttempts = 0; // Resetear intentos cuando se obtiene QR
      lastQrTime = Date.now(); // Actualizar timestamp del último QR
      onQr(qr);
      console.log(`📱 Nuevo código QR generado (${new Date().toLocaleTimeString()})`);
    });
  }

  if (onReady) {
    client.on('ready', () => {
      reconnectAttempts = 0; // Resetear intentos cuando está listo
      
      // Detener el watchdog de QR cuando estamos listos
      if (client._qrWatchdogTimer) {
        console.log('🛑 Deteniendo watchdog de QR ya que el cliente está listo');
        clearTimeout(client._qrWatchdogTimer);
        client._qrWatchdogTimer = null;
      }
      
      // Marcar el cliente como listo para referencias futuras
      client._isReady = true;
      
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
      
      // Detener el watchdog de QR cuando ya estamos autenticados
      if (client._qrWatchdogTimer) {
        console.log('🛑 Deteniendo watchdog de QR ya que estamos autenticados');
        clearTimeout(client._qrWatchdogTimer);
        client._qrWatchdogTimer = null;
      }
      
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
    
    // Detectar casos especiales (UNPAIRED o RegistrationUtils)
    const isUnpaired = reason === 'UNPAIRED' || lowerReason.includes('unpaired');
    const isRegUtilsError = lowerReason.includes('registration') || 
                            reason === 'session_error_detected' || 
                            lowerReason.includes('registration_utils_error');
    
    if (isPhoneLogout) {
      console.log('📴 Cierre de sesión detectado desde teléfono. Delegando al manejador superior...');
      if (onDisconnected) onDisconnected('logout', client);
      return; // No hacer ninguna limpieza adicional aquí
    }
    
    // Si es UNPAIRED o error de RegistrationUtils, hacer una limpieza más profunda
    if (isUnpaired || isRegUtilsError) {
      console.log(`⚠️ Detectado ${isUnpaired ? 'estado UNPAIRED' : 'error de RegistrationUtils'}`);
      console.log('🧹 Iniciando limpieza profunda de sesión y reinicio...');
      
      // Limpiar watchdog si existe
      if (client._qrWatchdogTimer) {
        clearTimeout(client._qrWatchdogTimer);
        client._qrWatchdogTimer = null;
      }
      
      try {
        // Notificar al manejador superior con tipo de error específico
        if (onDisconnected) {
          onDisconnected(isUnpaired ? 'unpaired_error' : 'registration_utils_error', client);
        }
        
        // Esperar un momento para asegurarse de que se haya manejado la desconexión
        setTimeout(async () => {
          try {
            // Reiniciar con sesión limpia completa
            const { reiniciarClienteConSesionLimpia } = require('./whatsapp');
            await reiniciarClienteConSesionLimpia(client);
          } catch (innerError) {
            console.error('❌ Error durante reinicio especial post-desconexión:', innerError);
            // Último recurso: reconexión estándar
            scheduleReconnect('special_reconnect_fallback');
          }
        }, 3000);
      } catch (error) {
        console.error('❌ Error manejando desconexión especial:', error);
        scheduleReconnect(reason); // Fallback a reconexión estándar
      }
      
      return;
    }

    // Para otras razones de desconexión, intentar reconectar normalmente
    if (onDisconnected) onDisconnected(reason, client);
    scheduleReconnect(reason);
  });

  // Capturar errores no manejados del cliente con mejor manejo de errores de sesión
  client.on('error', (error) => {
    console.error('❌ Error en el cliente de WhatsApp:', error.message || error);
    
    // Almacenar el último error para referencia en otras funciones
    client._lastError = error.message || String(error);
    client._lastErrorTime = Date.now();
    
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
    
    // Error específico de RegistrationUtils (error común después de estado UNPAIRED)
    const isRegUtilsError = errorMsg.includes('registrationutils') || 
                            errorMsg.includes('cannot read properties of undefined') || 
                            (errorMsg.includes('evaluation failed') && errorMsg.includes('typeof'));
    
    // Verificar si el error está relacionado con la sesión
    const isSessionError = sessionErrors.some(pattern => errorMsg.includes(pattern));
    
    if (isRegUtilsError) {
      console.log('⚠️ Detectado error específico de RegistrationUtils tras estado UNPAIRED');
      console.log('🧹 Iniciando limpieza de sesión y reinicio completo...');
      
      // Para este error específico, necesitamos una limpieza más profunda
      try {
        // Limpiar watchdog si existe
        if (client._qrWatchdogTimer) {
          clearTimeout(client._qrWatchdogTimer);
          client._qrWatchdogTimer = null;
        }
        
        // Programar reinicio con sesión limpia tras un breve retraso
        setTimeout(async () => {
          try {
            // Reiniciar con sesión limpia completa
            const { reiniciarClienteConSesionLimpia } = require('./whatsapp');
            await reiniciarClienteConSesionLimpia(client);
            console.log('🔄 Cliente reiniciado completamente tras error de RegistrationUtils');
          } catch (innerError) {
            console.error('❌ Error durante reinicio especial:', innerError);
            // Último recurso: reconexión estándar
            scheduleReconnect('registration_utils_error_recovery');
          }
        }, 3000);
      } catch (err) {
        console.error('❌ Error durante manejo de RegistrationUtils:', err);
        scheduleReconnect('registration_utils_error_fallback');
      }
    }
    else if (isSessionError) {
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
    
    // Limpiar temporizadores asociados al cliente
    if (client._qrWatchdogTimer) {
      console.log('🧹 Limpiando temporizador de vigilancia QR...');
      clearTimeout(client._qrWatchdogTimer);
      client._qrWatchdogTimer = null;
    }
    
    // Detectar y manejar casos especiales como UNPAIRED o errores de registro
    const isSpecialCase = (client._lastError && 
                          (String(client._lastError).toLowerCase().includes('registrationutils') || 
                           String(client._lastError).toLowerCase().includes('unpaired'))) ||
                          (client.state && client.state === 'UNPAIRED');
                         
    if (isSpecialCase) {
      console.log('⚠️ Detectado caso especial durante logout. Forzando limpieza completa...');
      cleanSession = true; // Forzar limpieza completa
      
      // Registrar diagnóstico adicional para este caso
      console.log('📊 Diagnóstico de caso especial:');
      if (client._lastError) {
        console.log(`- Último error: ${client._lastError}`);
        console.log(`- Tiempo del error: ${new Date(client._lastErrorTime).toISOString()}`);
      }
      if (client.state) {
        console.log(`- Estado actual del cliente: ${client.state}`);
      }
    }
    
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
    
    // Verificar si es caso especial (UNPAIRED o error de RegistrationUtils)
    const isSpecialCase = (client._lastError && 
                          (String(client._lastError).toLowerCase().includes('registrationutils') || 
                           String(client._lastError).toLowerCase().includes('unpaired'))) ||
                          (client.state && client.state === 'UNPAIRED');
                           
    if (isSpecialCase) {
      console.log('⚠️ Detectado caso especial para reinicio. Realizando limpieza profunda...');
    }
    
    // Limpiar watchdog si existe
    if (client._qrWatchdogTimer) {
      clearTimeout(client._qrWatchdogTimer);
      client._qrWatchdogTimer = null;
    }
    
    // Cerrar sesión y limpiar datos
    await logoutClienteWhatsApp(client, true);
    
    // Limpiar explícitamente las sesiones del navegador
    try {
      // Intentar limpiar cualquier sesión de puppeteer residual
      if (client.pupBrowser && typeof client.pupBrowser.close === 'function') {
        await client.pupBrowser.close().catch(e => console.log('Ignorando error al cerrar navegador:', e.message));
      }
      
      if (client.pupPage && typeof client.pupPage.close === 'function') {
        await client.pupPage.close().catch(e => console.log('Ignorando error al cerrar página:', e.message));
      }
      
      // Limpieza adicional para casos especiales
      if (isSpecialCase) {
        console.log('🧹 Ejecutando limpieza adicional de procesos de Puppeteer...');
        
        // Intentar liberar memoria y forzar recolección de basura
        if (global.gc) {
          try {
            global.gc();
            console.log('✅ Recolección de basura manual ejecutada');
          } catch (e) {
            console.log('ℹ️ No se pudo forzar recolección de basura');
          }
        }
        
        // Liberar cualquier referencia al cliente
        if (client) {
          Object.keys(client).forEach(key => {
            if (key !== 'initialize' && typeof client[key] !== 'function') {
              try {
                client[key] = null;
              } catch (e) {}
            }
          });
        }
      }
    } catch (browserErr) {
      console.log('Ignorando error al cerrar navegador/página:', browserErr.message);
    }
    
    // Esperar un momento antes de reiniciar (un poco más para casos de UNPAIRED)
    console.log('⏳ Esperando 3 segundos antes de reiniciar el cliente...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Reiniciar el cliente
    console.log('🔄 Reiniciando cliente de WhatsApp...');
    client.initialize();
    
    // Reiniciar el watchdog si estaba configurado
    if (typeof client._restartQrWatchdog === 'function') {
      setTimeout(() => {
        try {
          client._restartQrWatchdog();
          console.log('🔍 Watchdog de QR reiniciado correctamente');
        } catch (e) {
          console.error('❌ Error al reiniciar watchdog de QR:', e.message);
        }
      }, 5000); // Dar tiempo para inicialización
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error reiniciando el cliente:', error.message);
    
    // Intento de recuperación final si todo falla
    try {
      console.log('🔄 Intentando recuperación final del cliente...');
      setTimeout(() => {
        if (client && typeof client.initialize === 'function') {
          client.initialize();
        }
      }, 5000);
    } catch (finalError) {
      console.error('❌ Error en recuperación final:', finalError.message);
    }
    
    return false;
  }
}

module.exports = {
  crearClienteWhatsApp,
  iniciarCliente,
  logoutClienteWhatsApp,
  reiniciarClienteConSesionLimpia
};


