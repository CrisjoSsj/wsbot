'use strict';

// Utilidad para mejorar la detección de comandos personalizados en el bot

/**
 * Verifica si un texto coincide con alguna de las variantes proporcionadas
 * @param {string} texto - El texto a verificar
 * @param {string[]} variantes - Lista de variantes de comandos a comparar
 * @returns {boolean} - True si hay coincidencia, false en caso contrario
 */
function coincideConVariantes(texto, variantes) {
  if (!texto || typeof texto !== 'string') return false;
  
  // Normalizar texto: convertir a minúsculas y eliminar acentos
  const textoNormalizado = texto.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
    
  // Verificar coincidencia con alguna variante
  return variantes.some(variante => {
    const varianteNormalizada = variante.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
      
    return textoNormalizado === varianteNormalizada;
  });
}

module.exports = {
  coincideConVariantes
};
