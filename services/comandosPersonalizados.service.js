'use strict';

const { botConfig, guardarConfigEnDisco } = require('../config/botConfig');

// funcion para agregar o actualizar un comando personalizado
function agregarComandoPersonalizado(palabra, respuesta) {
  if (!palabra || !respuesta) return false;
  botConfig.customCommands[palabra] = respuesta;
  guardarConfigEnDisco();
  return true;
}

// funcion para eliminar un comando personalizado existente
function eliminarComandoPersonalizado(palabra) {
  if (!palabra) return false;
  if (botConfig.customCommands[palabra]) {
    delete botConfig.customCommands[palabra];
    guardarConfigEnDisco();
    return true;
  }
  return false;
}

// funcion para listar todos los comandos personalizados
function listarComandosPersonalizados() {
  return Object.entries(botConfig.customCommands);
}

module.exports = {
  agregarComandoPersonalizado,
  eliminarComandoPersonalizado,
  listarComandosPersonalizados
};


