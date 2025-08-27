'use strict';

const fs = require('fs');
const path = require('path');

// Servicio para gestionar el estado de WhatsApp usando un archivo JSON para compartir estado
console.log('Inicializando servicio whatsappStatus (versión archivo)');

// Constantes
const STATUS_FILE_PATH = path.join(__dirname, '../config/whatsappStatus.json');
const QR_FILE_PATH = path.join(__dirname, '../config/whatsappQR.txt');
const SERVICE_ID = 'ws-file-' + Math.random().toString(36).substring(2, 9);

// Variables globales
let whatsappClient = null;

// Asegurarse de que el archivo de estado existe
function ensureStatusFile() {
  try {
    if (!fs.existsSync(STATUS_FILE_PATH)) {
      const initialStatus = {
        status: 'disconnected',
        lastUpdate: new Date().toISOString(),
        hasQrCode: false,
        clientInitialized: false,
        serviceId: SERVICE_ID
      };
      fs.writeFileSync(STATUS_FILE_PATH, JSON.stringify(initialStatus, null, 2));
      console.log(`[${SERVICE_ID}] Archivo de estado creado en: ${STATUS_FILE_PATH}`);
    }
  } catch (error) {
    console.error(`[${SERVICE_ID}] Error al crear archivo de estado:`, error);
  }
}

// Leer el estado actual desde el archivo
function readStatus() {
  try {
    ensureStatusFile();
    const statusData = fs.readFileSync(STATUS_FILE_PATH, 'utf8');
    const statusObj = JSON.parse(statusData);
    // Sincronizar hasQrCode con la presencia de qrCode
    if (statusObj.qrCode && statusObj.qrCode.length > 10) {
      statusObj.hasQrCode = true;
    } else {
      statusObj.hasQrCode = false;
    }
    return statusObj;
  } catch (error) {
    console.error(`[${SERVICE_ID}] Error al leer estado:`, error);
    return {
      status: 'disconnected',
      lastUpdate: new Date().toISOString(),
      hasQrCode: false,
      clientInitialized: false,
      serviceId: SERVICE_ID
    };
  }
}

// Escribir el estado actualizado al archivo
function writeStatus(status) {
  try {
    fs.writeFileSync(STATUS_FILE_PATH, JSON.stringify(status, null, 2));
  } catch (error) {
    console.error(`[${SERVICE_ID}] Error al escribir estado:`, error);
  }
}

// Configurar el cliente de WhatsApp
function setWhatsappClient(client) {
  console.log(`[${SERVICE_ID}] Configurando cliente de WhatsApp en servicio whatsappStatus`);
  whatsappClient = client;
  
  // Verificar que el cliente sea válido
  if (!client) {
    console.error(`[${SERVICE_ID}] ¡ADVERTENCIA! Se intentó configurar un cliente nulo`);
    return;
  }
  
  // Verificar que tenga los métodos esperados
  const hasMethods = typeof client.initialize === 'function' && 
                     typeof client.logout === 'function';
  
  console.log(`[${SERVICE_ID}] Cliente configurado correctamente:`, hasMethods ? 'Sí' : 'No');
  
  // Actualizar estado en el archivo
  const status = readStatus();
  status.clientInitialized = hasMethods;
  status.lastUpdate = new Date().toISOString();
  writeStatus(status);
}

// Obtener la instancia del cliente de WhatsApp
function getWhatsAppClient() {
  return whatsappClient;
}

// Actualizar el estado de la conexión
function updateStatus(newStatus) {
  // Estado UNPAIRED es un caso especial (desvinculado)
  if (newStatus === 'UNPAIRED') {
    console.log(`[${SERVICE_ID}] 📵 Detectado estado UNPAIRED (dispositivo desvinculado)`);
    
    // Registrar evento específico para seguimiento del error
    console.log(`[${SERVICE_ID}] 📊 EVENTO CRÍTICO: Estado UNPAIRED detectado a las ${new Date().toLocaleString()}`);
    
    try {
      // Guardar información sobre el evento en un archivo de registro especial
      const logData = {
        timestamp: new Date().toISOString(),
        event: 'UNPAIRED_STATE_DETECTED',
        description: 'El dispositivo se ha desvinculado de WhatsApp Web',
        action: 'Se procederá a limpiar la sesión y forzar regeneración del QR',
        clientInfo: whatsappClient ? {
          hasState: !!whatsappClient.state,
          state: whatsappClient.state || 'unknown',
          hasInfo: !!whatsappClient.info
        } : 'no_client'
      };
      
      try {
        const logFilePath = path.join(__dirname, '../logs/whatsapp-critical-events.json');
        const logDir = path.dirname(logFilePath);
        
        // Crear directorio de logs si no existe
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        
        // Leer log actual si existe o crear nuevo
        let logs = [];
        if (fs.existsSync(logFilePath)) {
          logs = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
        }
        
        // Agregar nuevo evento y guardar
        logs.push(logData);
        fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2));
      } catch (logError) {
        console.error(`[${SERVICE_ID}] Error al registrar evento crítico:`, logError.message);
      }
      
      // En caso de UNPAIRED, usar auth_failure para reiniciar correctamente
      newStatus = 'auth_failure';
      
      // Limpiar el código QR actual y forzar regeneración
      clearQrCode();
      console.log(`[${SERVICE_ID}] 🧹 QR limpiado debido a estado UNPAIRED`);
      
      // Iniciar limpieza completa de sesión en lugar de simple reinicio
      setTimeout(() => {
        try {
          reiniciarClienteConSesionLimpia().then(result => {
            console.log(`[${SERVICE_ID}] 🔄 Reinicio completo con resultado: ${result ? 'exitoso' : 'fallido'}`);
          });
        } catch (e) {
          console.error(`[${SERVICE_ID}] Error al programar reinicio completo tras UNPAIRED:`, e.message);
        }
      }, 1000);
      
    } catch (err) {
      console.error(`[${SERVICE_ID}] Error manejando estado UNPAIRED:`, err.message);
    }
  }
  
  // Manejar caso especial de errores de RegistrationUtils (reportados en estado)
  if (typeof newStatus === 'string' && newStatus.toLowerCase().includes('registrationutils')) {
    console.log(`[${SERVICE_ID}] ⚠️ Detectado error de RegistrationUtils en estado`);
    
    // Tratar como fallo de autenticación para reiniciar correctamente
    newStatus = 'auth_failure';
    
    // También limpiar QR y forzar sesión limpia
    try {
      clearQrCode();
      console.log(`[${SERVICE_ID}] 🧹 QR limpiado debido a error de RegistrationUtils`);
      
      // Programar reinicio completo tras un breve retraso
      setTimeout(() => {
        try {
          reiniciarClienteConSesionLimpia().then(result => {
            console.log(`[${SERVICE_ID}] 🔄 Reinicio completo con resultado: ${result ? 'exitoso' : 'fallido'}`);
          });
        } catch (e) {
          console.error(`[${SERVICE_ID}] Error al programar reinicio completo:`, e.message);
        }
      }, 1000);
    } catch (err) {
      console.error(`[${SERVICE_ID}] Error manejando error de RegistrationUtils:`, err.message);
    }
  }
  
  // Validar que el estado sea uno de los valores esperados
  const validStates = ['disconnected', 'connecting', 'authenticated', 'ready', 'auth_failure'];
  if (!validStates.includes(newStatus)) {
    console.warn(`[${SERVICE_ID}] Estado de WhatsApp no reconocido: ${newStatus}, usando "disconnected" como valor predeterminado`);
    newStatus = 'disconnected';
  }
  
  // Leer estado actual
  const status = readStatus();
  
  // Solo actualizar si el estado ha cambiado
  if (status.status !== newStatus) {
    const oldStatus = status.status;
    status.status = newStatus;
    status.lastUpdate = new Date().toISOString();
    // Mensajes claros y amigables
    switch (newStatus) {
      case 'authenticated':
        console.log('🔐 Sesión autenticada correctamente.');
        break;
      case 'ready':
        console.log('🤖 Cliente de WhatsApp listo.');
        break;
      case 'connecting':
        console.log('⏳ Conectando a WhatsApp...');
        break;
      case 'disconnected':
        console.log('⚠️ WhatsApp desconectado.');
        break;
      case 'auth_failure':
        console.log('❌ Fallo de autenticación en WhatsApp.');
        break;
      default:
        console.log(`ℹ️ Estado de WhatsApp: ${newStatus}`);
    }
    writeStatus(status);
  }
}

// Actualizar el código QR
function updateQrCode(qrCode) {
  if (!qrCode) {
    console.warn(`[${SERVICE_ID}] Se recibió un código QR vacío o nulo, ignorando.`);
    return;
  }
  
  try {
    // Guardar el QR en un archivo separado y también en el estado
    fs.writeFileSync(QR_FILE_PATH, qrCode);
    
    // Actualizar el estado para incluir el QR directamente
    const status = readStatus();
    const now = new Date().toISOString();
    
    // Verificar si este QR es diferente al anterior
    const isNewQr = status.qrCode !== qrCode;
    
    // Actualizar estado con nuevo QR
    status.hasQrCode = true;
    status.qrCode = qrCode;
    status.qrTimestamp = now;
    status.lastUpdate = now;
    
    // Guardar cambios
    writeStatus(status);
    
    // Registrar evento de QR con timestamp visible
    console.log(`[${SERVICE_ID}] 📱 Código QR ${isNewQr ? 'nuevo' : 'actualizado'} generado: ${new Date().toLocaleString()}`);
  } catch (error) {
    console.error(`[${SERVICE_ID}] Error al guardar código QR:`, error);
  }
}

// Obtener información del estado
function getStatusInfo() {
  const status = readStatus();
  return status;
}

// Obtener el código QR
function getQrCode() {
  try {
    // Primero intentar obtener desde el estado
    const status = readStatus();
    if (status.qrCode) {
      return status.qrCode;
    }
    
    // Si no está en el estado, intentar leer del archivo
    if (fs.existsSync(QR_FILE_PATH)) {
      const qrCode = fs.readFileSync(QR_FILE_PATH, 'utf8');
      // Actualizar el estado con el QR del archivo
      if (qrCode) {
        status.qrCode = qrCode;
        status.hasQrCode = true;
        status.qrTimestamp = new Date().toISOString();
        writeStatus(status);
      }
      return qrCode;
    }
  } catch (error) {
    console.error(`[${SERVICE_ID}] Error al leer código QR:`, error);
  }
  return null;
}

// Limpiar el código QR
function clearQrCode() {
  try {
    // Eliminar el archivo de QR si existe
    if (fs.existsSync(QR_FILE_PATH)) {
      fs.unlinkSync(QR_FILE_PATH);
    }
    // Actualizar el estado para indicar que no hay QR
    const status = readStatus();
    status.hasQrCode = false;
    status.qrTimestamp = null;
    writeStatus(status);
    console.log('🗑️ Código QR eliminado');
  } catch (error) {
    // Error al limpiar QR (no mostrar en producción)
  }
}

// Cerrar sesión
async function logout() {
  console.log('🔐 Iniciando cierre de sesión de WhatsApp...');
  
  if (!whatsappClient) {
    console.warn(`[${SERVICE_ID}] No se puede cerrar sesión: cliente no disponible`);
    updateStatus('disconnected'); // Forzar estado desconectado
    clearQrCode(); // Limpiar cualquier QR antiguo
    return false;
  }
  
  try {
    // 1. Actualizar el estado a desconectando
    updateStatus('disconnecting');
    
    // 2. Intentar cerrar sesión si el método está disponible
    if (typeof whatsappClient.logout === 'function') {
      console.log(`[${SERVICE_ID}] Ejecutando método logout()`);
      await whatsappClient.logout();
      console.log(`[${SERVICE_ID}] Logout exitoso`);
    } else {
      console.warn(`[${SERVICE_ID}] Método logout() no disponible en el cliente`);
    }
    
    // 3. Destruir el cliente si el método está disponible
    if (typeof whatsappClient.destroy === 'function') {
      console.log(`[${SERVICE_ID}] Destruyendo cliente...`);
      await whatsappClient.destroy();
      console.log(`[${SERVICE_ID}] Cliente destruido correctamente`);
    } else {
      console.warn(`[${SERVICE_ID}] Método destroy() no disponible en el cliente`);
    }
    
    // 4. Limpiar archivos de sesión (opcional, ya no lo hacemos automáticamente)
    
    // 5. Actualizar estado final y limpiar QR
    updateStatus('disconnected');
    clearQrCode();
    
    // 6. Esperar un momento y reiniciar el cliente para generar un nuevo QR
    console.log(`[${SERVICE_ID}] Programando reinicio del cliente en 3 segundos...`);
    setTimeout(() => {
      try {
        console.log(`[${SERVICE_ID}] Reiniciando cliente después del logout...`);
        if (whatsappClient && typeof whatsappClient.initialize === 'function') {
          try {
            whatsappClient.initialize();
            updateStatus('connecting');
          } catch (initErr) {
            console.warn(`[${SERVICE_ID}] Falló initialize() tras logout (posible navegador cerrado):`, initErr.message);
            updateStatus('disconnected');
          }
        } else {
          console.error(`[${SERVICE_ID}] Cliente no disponible para reiniciar`);
          updateStatus('error');
        }
      } catch (error) {
        console.error(`[${SERVICE_ID}] Error al reiniciar cliente:`, error);
        updateStatus('error');
      }
    }, 3000); // Reducir a 3 segundos para una experiencia más fluida
    
    return true;
  } catch (error) {
    console.error(`[${SERVICE_ID}] Error al cerrar sesión de WhatsApp:`, error);
    
    // Incluso en caso de error, tratamos de forzar un estado desconectado
    try {
      updateStatus('disconnected');
      clearQrCode();
      
      // Intentar reiniciar el cliente de todos modos
      setTimeout(() => {
        try {
          console.log(`[${SERVICE_ID}] Intentando reiniciar cliente después de error...`);
          if (whatsappClient && typeof whatsappClient.initialize === 'function') {
            whatsappClient.initialize();
            updateStatus('connecting');
          }
        } catch (innerError) {
          console.error(`[${SERVICE_ID}] Error al reiniciar cliente después de error:`, innerError);
        }
      }, 3000);
    } catch (finalError) {
      console.error(`[${SERVICE_ID}] Error crítico en el proceso de logout:`, finalError);
    }
    
    return false;
  }
}

// Reiniciar el cliente
function restartClient() {
  if (whatsappClient && typeof whatsappClient.initialize === 'function') {
    try {
      console.log(`[${SERVICE_ID}] Reiniciando cliente de WhatsApp...`);
      updateStatus('connecting');
      whatsappClient.initialize();
      return true;
    } catch (error) {
      console.error(`[${SERVICE_ID}] Error al reiniciar el cliente de WhatsApp:`, error);
      return false;
    }
  }
  console.warn(`[${SERVICE_ID}] No se puede reiniciar: cliente no disponible`);
  return false;
}

// Obtener el estado de inicialización del cliente
function getClientInitializationStatus() {
  const hasMethods = whatsappClient && typeof whatsappClient.initialize === 'function' &&
                     typeof whatsappClient.logout === 'function';
                     
  return {
    serviceId: SERVICE_ID,
    hasClient: !!whatsappClient,
    hasMethods,
    currentStatus: readStatus()
  };
}

// Inicializar el servicio
ensureStatusFile();

// Reiniciar el cliente con limpieza de sesión
async function reiniciarClienteConSesionLimpia() {
  console.log(`[${SERVICE_ID}] 🧹 Iniciando reinicio con limpieza de sesión...`);
  
  if (!whatsappClient) {
    console.warn(`[${SERVICE_ID}] No se puede reiniciar: cliente no disponible`);
    return false;
  }
  
  try {
    // 1. Actualizar estado
    updateStatus('disconnecting');
    
    // 2. Intentar cerrar sesión primero si el método está disponible
    if (typeof whatsappClient.logout === 'function') {
      console.log(`[${SERVICE_ID}] Ejecutando logout() previo a la limpieza`);
      try {
        await whatsappClient.logout();
      } catch (logoutError) {
        console.warn(`[${SERVICE_ID}] Error en logout, continuando con limpieza:`, logoutError.message);
      }
    }
    
    // 3. Destruir el cliente si el método está disponible
    if (typeof whatsappClient.destroy === 'function') {
      console.log(`[${SERVICE_ID}] Destruyendo cliente...`);
      try {
        await whatsappClient.destroy();
      } catch (destroyError) {
        console.warn(`[${SERVICE_ID}] Error al destruir cliente, continuando:`, destroyError.message);
      }
    }
    
    // 4. Limpiar archivos de sesión (ahora sí lo hacemos)
    try {
      // Ruta a la carpeta de sesión
      const sessionFolderPath = path.join(__dirname, '../config/whatsapp-auth');
      
      console.log(`[${SERVICE_ID}] 🗑️ Limpiando datos de sesión en: ${sessionFolderPath}`);
      
      // Comprobar si la carpeta existe
      if (fs.existsSync(sessionFolderPath)) {
        // Usar método recursivo para eliminar la carpeta y su contenido
        const { exec } = require('child_process');
        
        // En Windows usamos comando para eliminar directorios recursivamente
        if (process.platform === 'win32') {
          exec(`rmdir /s /q "${sessionFolderPath}"`, (error) => {
            if (error) {
              console.error(`[${SERVICE_ID}] Error al eliminar carpeta de sesión:`, error);
            } else {
              console.log(`[${SERVICE_ID}] Carpeta de sesión eliminada correctamente`);
            }
          });
        } else {
          // En Linux/Mac usamos rm -rf
          exec(`rm -rf "${sessionFolderPath}"`, (error) => {
            if (error) {
              console.error(`[${SERVICE_ID}] Error al eliminar carpeta de sesión:`, error);
            } else {
              console.log(`[${SERVICE_ID}] Carpeta de sesión eliminada correctamente`);
            }
          });
        }
      } else {
        console.log(`[${SERVICE_ID}] No existe carpeta de sesión para eliminar`);
      }
    } catch (cleanError) {
      console.error(`[${SERVICE_ID}] Error al limpiar carpeta de sesión:`, cleanError);
    }
    
    // 5. Actualizar estado y limpiar QR
    updateStatus('disconnected');
    clearQrCode();
    
    // 6. Esperar un momento y reiniciar el cliente para generar un nuevo QR
    console.log(`[${SERVICE_ID}] Esperando 3 segundos antes de reiniciar cliente...`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          console.log(`[${SERVICE_ID}] Reiniciando cliente después de limpieza...`);
          if (whatsappClient && typeof whatsappClient.initialize === 'function') {
            whatsappClient.initialize();
            updateStatus('connecting');
            resolve(true);
          } else {
            console.error(`[${SERVICE_ID}] Cliente no disponible para reiniciar`);
            updateStatus('error');
            resolve(false);
          }
        } catch (error) {
          console.error(`[${SERVICE_ID}] Error al reiniciar cliente después de limpieza:`, error);
          updateStatus('error');
          resolve(false);
        }
      }, 3000);
    });
  } catch (error) {
    console.error(`[${SERVICE_ID}] Error crítico en el reinicio con limpieza:`, error);
    return false;
  }
}

module.exports = {
  setWhatsappClient,
  getWhatsAppClient,
  updateStatus,
  updateQrCode,
  getStatusInfo,
  getQrCode,
  clearQrCode,
  logout,
  restartClient,
  reiniciarClienteConSesionLimpia,  // Añadimos el nuevo método
  getClientInitializationStatus
};
