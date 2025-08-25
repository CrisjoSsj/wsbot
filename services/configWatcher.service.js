'use strict';

const fs = require('fs');
const path = require('path');
const { botConfig, cargarConfigDesdeDisco } = require('../config/botConfig');

// Ruta del archivo de configuración
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, '..', 'config.json');

// Variables para el control del watcher
let configWatcher = null;
let lastWatcherError = 0;
let watcherActive = false;

/**
 * Inicia el observador de cambios en el archivo de configuración
 * @returns {boolean} - True si se inició correctamente, false si ya estaba activo
 */
function iniciarConfigWatcher() {
  if (watcherActive) {
    console.log('⚙️ El observador de configuración ya está activo');
    return false;
  }

  try {
    // Verificar si el archivo existe antes de intentar observarlo
    if (!fs.existsSync(CONFIG_PATH)) {
      console.error(`❌ No se puede observar ${CONFIG_PATH}: el archivo no existe`);
      return false;
    }

    // Crear el watcher para el archivo de configuración
    configWatcher = fs.watch(CONFIG_PATH, { persistent: true }, (eventType) => {
      // Solo nos interesa cuando el archivo se modifica
      if (eventType === 'change') {
        const now = Date.now();
        
        // Evitar recargar múltiples veces en un periodo corto (debounce)
        if (now - lastWatcherError > 1000) {
          lastWatcherError = now;
          
          console.log('🔄 Detectado cambio en config.json, recargando configuración...');
          
          // Pequeño timeout para asegurarse que el archivo se haya escrito completamente
          setTimeout(() => {
            try {
              // Recargar la configuración desde el disco
              cargarConfigDesdeDisco();
              console.log('✅ Configuración recargada automáticamente');
            } catch (error) {
              console.error('❌ Error al recargar la configuración:', error.message);
            }
          }, 100);
        }
      }
    });

    watcherActive = true;
    console.log('👀 Observador de cambios en config.json iniciado');
    return true;
  } catch (error) {
    console.error('❌ Error al iniciar el observador de configuración:', error.message);
    return false;
  }
}

/**
 * Detiene el observador de cambios en el archivo de configuración
 * @returns {boolean} - True si se detuvo correctamente, false si no estaba activo
 */
function detenerConfigWatcher() {
  if (!watcherActive || !configWatcher) {
    console.log('ℹ️ El observador de configuración no está activo');
    return false;
  }

  try {
    configWatcher.close();
    watcherActive = false;
    configWatcher = null;
    console.log('🛑 Observador de cambios en config.json detenido');
    return true;
  } catch (error) {
    console.error('❌ Error al detener el observador de configuración:', error.message);
    return false;
  }
}

/**
 * Verifica si el observador está activo
 * @returns {boolean} - Estado actual del observador
 */
function isWatcherActive() {
  return watcherActive;
}

/**
 * Recarga manualmente la configuración desde el disco
 * @returns {boolean} - True si se recargó correctamente
 */
function recargarConfiguracion() {
  try {
    cargarConfigDesdeDisco();
    console.log('✅ Configuración recargada manualmente');
    return true;
  } catch (error) {
    console.error('❌ Error al recargar la configuración manualmente:', error.message);
    return false;
  }
}

module.exports = {
  iniciarConfigWatcher,
  detenerConfigWatcher,
  isWatcherActive,
  recargarConfiguracion
};
