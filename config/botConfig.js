'use strict';

const fs = require('fs');
const path = require('path');

// funcion para definir la ruta del archivo de configuración
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, '..', 'config.json');

// funcion para definir el nombre de la tienda por defecto desde variables de entorno
const STORE_NAME = process.env.STORE_NAME || 'Tienda Demo';

// Valores predeterminados para la configuración del bot
const DEFAULT_CONFIG = {
  storeName: STORE_NAME,
  content: {},
  customCommands: {}
};

// funcion para mantener la configuración editable del bot
const botConfig = { ...DEFAULT_CONFIG };

// Función recursiva para fusionar objetos anidados
function mergeDeep(target, source) {
  if (typeof source !== 'object' || source === null) {
    return source;
  }
  
  if (typeof target !== 'object' || target === null) {
    if (Array.isArray(source)) {
      return [...source];
    }
    return {...source};
  }

  if (Array.isArray(source)) {
    return [...source]; // Para arrays, reemplazar completamente
  }

  const output = {...target};
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (typeof source[key] === 'object' && source[key] !== null &&
          typeof output[key] === 'object' && output[key] !== null) {
        output[key] = mergeDeep(output[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
  }
  
  return output;
}

// funcion para cargar la configuración desde disco (si existe)
function cargarConfigDesdeDisco() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      const data = JSON.parse(raw);
      
      if (data && typeof data === 'object') {
        // Manejar compatibilidad con formato anterior
        if (data.horarioText || data.envioText || data.pagoText || 
            data.direccionesText || data.preciosText || data.contactoText) {
          
          // Convertir formato antiguo al nuevo formato
          const nuevoFormato = {
            storeName: data.storeName || botConfig.storeName,
            content: {
              horario: {
                sections: [{title: "Horario", content: data.horarioText || ""}]
              },
              envio: {
                sections: [{title: "Envíos", content: data.envioText || ""}]
              },
              pago: {
                methods: [{name: "Métodos de pago", details: data.pagoText || ""}]
              },
              direcciones: {
                locations: [{name: "Ubicación", details: [data.direccionesText || ""]}]
              },
              precios: {
                message: data.preciosText || ""
              },
              contacto: {
                methods: [{type: "Contacto", value: data.contactoText || ""}]
              }
            },
            customCommands: data.customCommands || {}
          };
          
          // Fusionar con la configuración actual
          Object.assign(botConfig, mergeDeep(botConfig, nuevoFormato));
        } else {
          // Formato nuevo, fusionar directamente
          Object.assign(botConfig, mergeDeep(botConfig, data));
        }
        
        console.log('⚙️ Configuración cargada desde disco.');
      }
    }
  } catch (e) {
    console.error('No se pudo cargar config.json:', e);
  }
}

// Función para sanitizar configuración y eliminar formatos legacy
function sanitizeConfig(cfg) {
  try {
    if (!cfg || typeof cfg !== 'object') return;

    // Limpiar menu legacy
    if (cfg.menu && typeof cfg.menu === 'object') {
      if (cfg.menu.mainMenu) delete cfg.menu.mainMenu;
      if (cfg.menu.welcome) delete cfg.menu.welcome;
      if (cfg.menu.admin) delete cfg.menu.admin;
    }

    // Eliminar textos legacy de nivel superior si existen
    const legacyTextKeys = ['horarioText','envioText','pagoText','direccionesText','preciosText','contactoText'];
    legacyTextKeys.forEach(k => { if (Object.prototype.hasOwnProperty.call(cfg, k)) delete cfg[k]; });

    // Normalizar options
    if (cfg.menu && Array.isArray(cfg.menu.options)) {
      cfg.menu.options = cfg.menu.options.map(op => ({
        number: op.number != null ? String(op.number).trim() : undefined,
        text: op.text != null ? String(op.text).trim() : undefined,
        key: op.key != null ? String(op.key).trim() : undefined,
        emoji: op.emoji != null ? String(op.emoji).trim() : undefined,
        response: op.response != null ? String(op.response) : undefined
      })).filter(o => o.number && o.text);
    }
  } catch (e) {
    console.warn('sanitizeConfig failed:', e && e.message);
  }
}

// funcion para guardar la configuración actual en disco
function guardarConfigEnDisco() {
  try {
    // Crear una copia del ejemplo si no existe ya
    const configExamplePath = `${CONFIG_PATH}.example`;
    if (!fs.existsSync(configExamplePath)) {
      fs.writeFileSync(configExamplePath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
      console.log('📄 Archivo de ejemplo config.json.example creado');
    }
    
    // Guardar la configuración actual
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(botConfig, null, 2), 'utf8');
    console.log('💾 Configuración guardada en', CONFIG_PATH);
  } catch (e) {
    console.error('No se pudo guardar config.json:', e);
        // Sanitizar y reescribir config para eliminar bloques legacy persistentes
        try {
          sanitizeConfig(botConfig);
          guardarConfigEnDisco();
          console.log('🔧 Configuración sanitizada y reescrita en disco');
        } catch (e) {
          console.warn('No se pudo sanitizar/reescribir config en disco:', e && e.message);
        }
  }
}

// Exportamos un objeto con métodos para manejar la configuración
module.exports = {
  obtenerConfiguracion: function() {
    return botConfig;
  },
  // Antes de persistir, sanitizamos la configuración para eliminar formatos legacy
  guardarConfiguracion: async function(config) {
    try {
      // Aplicar cambios sobre el objeto global botConfig
      Object.assign(botConfig, config);

      // Sanitizar usando la función compartida
      sanitizeConfig(botConfig);

      guardarConfigEnDisco();
      return true;
    } catch (e) {
      console.error('Error en guardarConfiguracion:', e && e.message);
      throw e;
    }
  },
  cargarConfigDesdeDisco,
  guardarConfigEnDisco
};


