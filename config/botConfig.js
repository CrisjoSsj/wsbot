'use strict';

const fs = require('fs');
const path = require('path');

// funcion para definir la ruta del archivo de configuración
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, '..', 'config.json');

// funcion para definir el nombre de la tienda por defecto desde variables de entorno
const STORE_NAME = process.env.STORE_NAME || 'Tienda Demo';

// funcion para mantener la configuración editable del bot
const botConfig = {
  // nombre de la tienda que se muestra en los mensajes
  storeName: STORE_NAME,
  // texto por defecto para horarios
  horarioText: '🕒 Horario: Lun-Vie 9:00-18:00, Sáb 10:00-14:00. Domingos cerrado.',
  // texto por defecto para envíos
  envioText: '🚚 Envíos: 24-48h. Costo estándar: 4.99 USD, gratis en compras superiores a 60 USD.',
  // texto por defecto para pagos
  pagoText: '💳 Métodos de pago: Efectivo a contraentrega (en zonas disponibles) y Transferencia bancaria.',
  // comandos personalizados definidos por el admin
  customCommands: {}
};

// funcion para cargar la configuración desde disco (si existe)
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

// funcion para guardar la configuración actual en disco
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

module.exports = {
  botConfig,
  cargarConfigDesdeDisco,
  guardarConfigEnDisco
};


