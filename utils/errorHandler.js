'use strict';

/**
 * Función envoltorio (wrapper) para manejar errores en funciones asíncronas
 * Ejecuta la función y captura cualquier error, devolviendo un valor por defecto en caso de fallo
 * 
 * @param {Function} fn - Función a ejecutar
 * @param {string} errorMessage - Mensaje a mostrar en consola en caso de error
 * @param {*} defaultValue - Valor por defecto a devolver en caso de error
 * @returns {*} - Resultado de la función o el valor por defecto si hay error
 */
function safeExecute(fn, errorMessage, defaultValue) {
  try {
    return fn();
  } catch (error) {
    console.error(`${errorMessage}: ${error.message}`, error);
    return defaultValue;
  }
}

/**
 * Accede de forma segura a propiedades anidadas de un objeto
 * 
 * @param {Object} obj - Objeto a consultar
 * @param {string} path - Ruta de la propiedad (ej: "content.menu.options")
 * @param {*} defaultValue - Valor por defecto si la propiedad no existe
 * @returns {*} - Valor de la propiedad o el valor por defecto
 */
function safeGet(obj, path, defaultValue = undefined) {
  try {
    if (!obj) return defaultValue;
    
    const props = path.split('.');
    let current = obj;
    
    for (const prop of props) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[prop];
    }
    
    return current === undefined ? defaultValue : current;
  } catch (error) {
    console.error(`Error accediendo a la propiedad ${path}:`, error);
    return defaultValue;
  }
}

module.exports = {
  safeExecute,
  safeGet
};
