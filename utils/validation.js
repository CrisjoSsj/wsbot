'use strict';

/**
 * Valida si un texto es seguro (no está vacío y no supera cierta longitud)
 * @param {string} texto - Texto a validar
 * @param {number} maxLength - Longitud máxima permitida
 * @returns {boolean} - true si es válido, false si no lo es
 */
function esTextoValido(texto, maxLength = 1000) {
  if (texto === undefined || texto === null) {
    return false;
  }
  
  try {
    const textoNormalizado = String(texto).trim();
    return textoNormalizado.length > 0 && textoNormalizado.length <= maxLength;
  } catch (error) {
    console.error('Error en esTextoValido:', error);
    return false;
  }
}

/**
 * Sanitiza un texto para prevenir inyecciones o caracteres problemáticos
 * @param {string} texto - Texto a sanitizar
 * @param {number} maxLength - Longitud máxima permitida
 * @returns {string} - Texto sanitizado
 */
function sanitizarTexto(texto, maxLength = 1000) {
  if (texto === undefined || texto === null) {
    return '';
  }
  
  try {
    // Convertir a string y recortar espacios
    let resultado = String(texto).trim();
    
    // Limitar longitud
    if (resultado.length > maxLength) {
      resultado = resultado.substring(0, maxLength);
    }
    
    // Eliminar caracteres potencialmente peligrosos
    // Esta es una sanitización básica, puede ampliarse según las necesidades
    resultado = resultado.replace(/[^\w\s.,;:()¿?¡!áéíóúÁÉÍÓÚüÜñÑ@#$%&*+-]/g, '');
    
    return resultado;
  } catch (error) {
    console.error('Error en sanitizarTexto:', error);
    return '';
  }
}

/**
 * Validar si un número es un valor numérico válido
 * @param {any} valor - Valor a validar
 * @returns {boolean} - true si es un número válido
 */
function esNumeroValido(valor) {
  if (valor === undefined || valor === null) {
    return false;
  }
  
  try {
    const numero = Number(valor);
    return !isNaN(numero) && isFinite(numero);
  } catch (error) {
    console.error('Error en esNumeroValido:', error);
    return false;
  }
}

/**
 * Validar si una cadena contiene solo dígitos numéricos
 * @param {string} texto - El texto a validar
 * @returns {boolean} - true si solo contiene dígitos
 */
function esSoloDigitos(texto) {
  try {
    if (!esTextoValido(texto)) {
      return false;
    }
    
    return /^\d+$/.test(String(texto).trim());
  } catch (error) {
    console.error('Error en esSoloDigitos:', error);
    return false;
  }
}

/**
 * Validar un objeto para asegurarse de que tiene las propiedades requeridas
 * @param {object} objeto - Objeto a validar
 * @param {string[]} propiedadesRequeridas - Lista de propiedades que deben existir
 * @returns {boolean} - true si el objeto es válido
 */
function objetoTienePropiedades(objeto, propiedadesRequeridas) {
  if (!objeto || typeof objeto !== 'object') {
    return false;
  }
  
  try {
    return propiedadesRequeridas.every(prop => 
      Object.prototype.hasOwnProperty.call(objeto, prop) && 
      objeto[prop] !== undefined && 
      objeto[prop] !== null
    );
  } catch (error) {
    console.error('Error en objetoTienePropiedades:', error);
    return false;
  }
}

/**
 * Escapar caracteres especiales en texto para prevenir inyecciones
 * @param {string} texto - El texto a escapar
 * @returns {string} - Texto con caracteres especiales escapados
 */
function escaparTextoEspecial(texto) {
  try {
    if (!esTextoValido(texto)) {
      return '';
    }
    
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  } catch (error) {
    console.error('Error en escaparTextoEspecial:', error);
    return '';
  }
}

module.exports = {
  esTextoValido,
  sanitizarTexto,
  esNumeroValido,
  esSoloDigitos,
  objetoTienePropiedades,
  escaparTextoEspecial
};
