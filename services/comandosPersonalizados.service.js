'use strict';

const botConfig = require('../config/botConfig');

// funcion para agregar o actualizar un comando personalizado
function agregarComandoPersonalizado(palabra, respuesta) {
  if (!palabra || !respuesta) return false;
  const config = botConfig.obtenerConfiguracion();
  if (!config.customCommands) config.customCommands = {};
  config.customCommands[palabra] = respuesta;
  // Usar guardarConfiguracion para aplicar sanitización central antes de persistir
  botConfig.guardarConfiguracion(config);
  return true;
}

// funcion para eliminar un comando personalizado existente
function eliminarComandoPersonalizado(palabra) {
  if (!palabra) return false;
  const config = botConfig.obtenerConfiguracion();
  if (config.customCommands && config.customCommands[palabra]) {
  delete config.customCommands[palabra];
  // Usar guardarConfiguracion para aplicar sanitización central antes de persistir
  botConfig.guardarConfiguracion(config);
    return true;
  }
  return false;
}

// funcion para listar todos los comandos personalizados
function listarComandosPersonalizados() {
  const config = botConfig.obtenerConfiguracion();
  if (!config.customCommands) return [];
  return Object.entries(config.customCommands);
}

module.exports = {
  agregarComandoPersonalizado,
  eliminarComandoPersonalizado,
  listarComandosPersonalizados
};


