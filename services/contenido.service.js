'use strict';

// Importamos directamente el módulo con los métodos
const botConfig = require('../config/botConfig');
const { safeExecute, safeGet } = require('../utils/errorHandler');

/**
 * Genera texto formateado para la sección de horarios
 * @returns {string} Texto con formato de horarios
 */
function generarTextoHorario() {
  return safeExecute(() => {
    const config = botConfig.obtenerConfiguracion();
    if (!config || !safeGet(config, 'content.horario')) {
      return safeGet(config, 'horarioText', 'Información de horarios no disponible');
    }
    const horario = safeGet(config, 'content.horario', {});
    
    const lineas = [
      '━━━━━━━━━━━━━━━━━━━━━━',
      `⏰ *${safeGet(horario, 'title', 'HORARIOS DE ATENCIÓN')}* ⏰`,
      '━━━━━━━━━━━━━━━━━━━━━━',
      ''
    ];
    
    // Añadir cada sección de horario
    const sections = safeGet(horario, 'sections', []);
    if (sections && sections.length > 0) {
      sections.forEach(seccion => {
        lineas.push(`*${safeGet(seccion, 'title', 'Horario')}*`);
        lineas.push(`${safeGet(seccion, 'content', 'No especificado')}`);
        lineas.push('');
      });
    } else {
      lineas.push('No hay información de horarios disponible');
      lineas.push('');
    }
    
    // Añadir pie si existe
    const footer = safeGet(horario, 'footer');
    if (footer) {
      lineas.push('━━━━━━━━━━━━━━━━━━━━━━');
      lineas.push(footer);
    }
    
    return lineas.join('\n');
  }, 'Error generando texto de horario', safeGet(botConfig.obtenerConfiguracion(), 'horarioText', 'Información de horarios no disponible'));
}

/**
 * Genera texto formateado para la sección de envíos
 * @returns {string} Texto con formato de información de envíos
 */
function generarTextoEnvio() {
  return safeExecute(() => {
    const config = botConfig.obtenerConfiguracion();
    if (!config || !safeGet(config, 'content.envio')) {
      return safeGet(config, 'envioText', 'Información de envíos no disponible');
    }
    const envio = safeGet(config, 'content.envio', {});
    
    const lineas = [
      '━━━━━━━━━━━━━━━━━━━━━━',
      `🚚 *${safeGet(envio, 'title', 'INFORMACIÓN DE ENVÍOS')}* 📦`,
      '━━━━━━━━━━━━━━━━━━━━━━',
      ''
    ];
    
    // Añadir cada sección de información de envío
    const sections = safeGet(envio, 'sections', []);
    if (sections && sections.length > 0) {
      sections.forEach(seccion => {
        lineas.push(`*${safeGet(seccion, 'title', '')}* ${safeGet(seccion, 'content', 'No especificado')}`);
      });
      lineas.push('');
    }
    
    // Añadir información extra si existe
    const extraInfo = safeGet(envio, 'extraInfo', []);
    if (extraInfo && extraInfo.length > 0) {
      extraInfo.forEach(extra => {
        lineas.push(`*${safeGet(extra, 'title', '')}*`);
        const content = safeGet(extra, 'content', '');
        if (Array.isArray(content)) {
          lineas.push(content.join('\n'));
        } else {
          lineas.push(content);
        }
        lineas.push('');
      });
    }
    
    // Añadir pie si existe
    const footer = safeGet(envio, 'footer');
    if (footer) {
      lineas.push('━━━━━━━━━━━━━━━━━━━━━━');
      lineas.push(footer);
    }
    
    return lineas.join('\n');
  }, 'Error generando texto de envío', safeGet(botConfig.obtenerConfiguracion(), 'envioText', 'Información de envíos no disponible'));
}

/**
 * Genera texto formateado para la sección de métodos de pago
 * @returns {string} Texto con formato de métodos de pago
 */
function generarTextoPago() {
  return safeExecute(() => {
    const config = botConfig.obtenerConfiguracion();
    if (!config || !safeGet(config, 'content.pago')) {
      return safeGet(config, 'pagoText', 'Información de métodos de pago no disponible');
    }
    const pago = safeGet(config, 'content.pago', {});
    
    const lineas = [
      '━━━━━━━━━━━━━━━━━━━━━━',
      `💳 *${safeGet(pago, 'title', 'MÉTODOS DE PAGO')}* 💸`,
      '━━━━━━━━━━━━━━━━━━━━━━',
      ''
    ];
    
    // Añadir cada método de pago
    const methods = safeGet(pago, 'methods', []);
    if (methods && methods.length > 0) {
      methods.forEach(metodo => {
        lineas.push(`*${safeGet(metodo, 'name', 'Método de pago')}*`);
        
        const details = safeGet(metodo, 'details', '');
        if (Array.isArray(details)) {
          lineas.push(details.join('\n'));
        } else {
          lineas.push(details);
        }
        
        lineas.push('');
      });
    }
    
    // Añadir pie si existe
    const footer = safeGet(pago, 'footer');
    if (footer) {
      lineas.push('━━━━━━━━━━━━━━━━━━━━━━');
      lineas.push(footer);
    }
    
    return lineas.join('\n');
  }, 'Error generando texto de métodos de pago', safeGet(botConfig.obtenerConfiguracion(), 'pagoText', 'Información de métodos de pago no disponible'));
}

/**
 * Genera texto formateado para la sección de direcciones
 * @returns {string} Texto con formato de direcciones
 */
function generarTextoDirecciones() {
  return safeExecute(() => {
    const config = botConfig.obtenerConfiguracion();
    if (!config || !safeGet(config, 'content.direcciones')) {
      return safeGet(config, 'direccionesText', 'Información de ubicaciones no disponible');
    }
    const direcciones = safeGet(config, 'content.direcciones', {});
    
    const lineas = [
      '━━━━━━━━━━━━━━━━━━━━━━',
      `📍 *${safeGet(direcciones, 'title', 'NUESTRAS UBICACIONES')}* 📍`,
      '━━━━━━━━━━━━━━━━━━━━━━',
      ''
    ];
    
    // Añadir cada ubicación
    const locations = safeGet(direcciones, 'locations', []);
    if (locations && locations.length > 0) {
      locations.forEach(ubicacion => {
        lineas.push(`*${safeGet(ubicacion, 'name', 'Ubicación')}*`);
        
        const details = safeGet(ubicacion, 'details', []);
        if (Array.isArray(details)) {
          lineas.push(details.join('\n'));
        } else {
          lineas.push(details);
        }
        
        lineas.push('');
      });
    }
    
    // Añadir recordatorio de horarios si existe
    const reminder = safeGet(direcciones, 'reminder');
    if (reminder) {
      lineas.push(reminder);
      lineas.push('');
    }
    
    // Añadir pie si existe
    const footer = safeGet(direcciones, 'footer');
    if (footer) {
      lineas.push('━━━━━━━━━━━━━━━━━━━━━━');
      lineas.push(footer);
    }
    
    return lineas.join('\n');
  }, 'Error generando texto de direcciones', safeGet(botConfig.obtenerConfiguracion(), 'direccionesText', 'Información de ubicaciones no disponible'));
}

/**
 * Genera texto formateado para la sección de precios
 * @returns {string} Texto con formato de información de precios
 */
function generarTextoPrecios() {
  return safeExecute(() => {
    const config = botConfig.obtenerConfiguracion();
    if (!config || !safeGet(config, 'content.precios')) {
      return safeGet(config, 'preciosText', 'Información de precios no disponible');
    }
    const precios = safeGet(config, 'content.precios', {});
    
    const lineas = [
      '━━━━━━━━━━━━━━━━━━━━━━',
      `💲 *${safeGet(precios, 'title', 'INFORMACIÓN DE PRECIOS')}* 💲`,
      '━━━━━━━━━━━━━━━━━━━━━━',
      '',
      safeGet(precios, 'message', 'Nuestros precios están siempre actualizados.'),
      ''
    ];
    
    // Añadir opciones disponibles
    const options = safeGet(precios, 'options', []);
    if (options && options.length > 0) {
      lineas.push(options.join('\n'));
      lineas.push('');
    }
    
    // Añadir promociones si existen
    const promotions = safeGet(precios, 'promotions');
    if (promotions) {
      lineas.push(`*${safeGet(promotions, 'title', 'PROMOCIONES ACTIVAS')}*`);
      const items = safeGet(promotions, 'items', []);
      if (items && items.length > 0) {
        lineas.push(items.join('\n'));
      }
      lineas.push('');
    }
    
    // Añadir pie si existe
    const footer = safeGet(precios, 'footer');
    if (footer) {
      lineas.push('━━━━━━━━━━━━━━━━━━━━━━');
      lineas.push(footer);
    }
    
    return lineas.join('\n');
  }, 'Error generando texto de precios', safeGet(botConfig.obtenerConfiguracion(), 'preciosText', 'Información de precios no disponible'));
}

/**
 * Genera texto formateado para la sección de contacto
 * @returns {string} Texto con formato de información de contacto
 */
function generarTextoContacto() {
  return safeExecute(() => {
    const config = botConfig.obtenerConfiguracion();
    if (!config || !safeGet(config, 'content.contacto')) {
      return safeGet(config, 'contactoText', 'Información de contacto no disponible');
    }
    const contacto = safeGet(config, 'content.contacto', {});
    
    const lineas = [
      '━━━━━━━━━━━━━━━━━━━━━━',
      `📱 *${safeGet(contacto, 'title', 'CONTÁCTANOS')}* 📞`,
      '━━━━━━━━━━━━━━━━━━━━━━',
      ''
    ];
    
    // Añadir métodos de contacto
    const methods = safeGet(contacto, 'methods', []);
    if (methods && methods.length > 0) {
      methods.forEach(metodo => {
        lineas.push(`*${safeGet(metodo, 'type', 'Contacto')}:* ${safeGet(metodo, 'value', '')}`);
      });
      lineas.push('');
    }
    
    // Añadir redes sociales si existen
    const socialMedia = safeGet(contacto, 'socialMedia');
    if (socialMedia) {
      lineas.push(`*${safeGet(socialMedia, 'title', 'Redes sociales')}*`);
      const networks = safeGet(socialMedia, 'networks', []);
      if (networks && networks.length > 0) {
        networks.forEach(red => {
          lineas.push(`• *${safeGet(red, 'name', '')}:* ${safeGet(red, 'handle', '')}`);
        });
      }
      lineas.push('');
    }
    
    // Añadir mensaje si existe
    const message = safeGet(contacto, 'message');
    if (message) {
      lineas.push(message);
      lineas.push('');
    }
    
    // Añadir pie si existe
    const footer = safeGet(contacto, 'footer');
    if (footer) {
      lineas.push('━━━━━━━━━━━━━━━━━━━━━━');
      lineas.push(footer);
    }
    
    return lineas.join('\n');
  }, 'Error generando texto de contacto', safeGet(botConfig.obtenerConfiguracion(), 'contactoText', 'Información de contacto no disponible'));
}

/**
 * Genera texto formateado para la sección de información de precios
 * @returns {string} Texto con formato de información general de precios
 */
function generarTextoInfoPrecios() {
  return safeExecute(() => {
    const config = botConfig.obtenerConfiguracion();
    if (!config || !safeGet(config, 'content.info_precios')) {
      return "Información de precios no disponible";
    }
    const infoPrecios = safeGet(config, 'content.info_precios', {});
    
    const lineas = [
      '━━━━━━━━━━━━━━━━━━━━━━',
      `💲 *${safeGet(infoPrecios, 'title', 'INFORMACIÓN DE PRECIOS')}* 💲`,
      '━━━━━━━━━━━━━━━━━━━━━━',
      ''
    ];
    
    // Añadir descripción general
    const description = safeGet(infoPrecios, 'description');
    if (description) {
      lineas.push(description);
      lineas.push('');
    }
    
    // Añadir opciones relacionadas
    const relatedOptions = safeGet(infoPrecios, 'relatedOptions', []);
    if (relatedOptions && relatedOptions.length > 0) {
      relatedOptions.forEach(option => {
        lineas.push(option);
      });
      lineas.push('');
    }
    
    // Añadir promociones
    const promotions = safeGet(infoPrecios, 'promotions', []);
    if (promotions && promotions.length > 0) {
      lineas.push('*PROMOCIONES ACTIVAS:*');
      promotions.forEach(promo => {
        lineas.push('• ' + promo);
      });
      lineas.push('');
    }
    
    // Añadir pie si existe
    const footer = safeGet(infoPrecios, 'footer');
    if (footer) {
      lineas.push('━━━━━━━━━━━━━━━━━━━━━━');
      lineas.push(footer);
    }
    
    return lineas.join('\\n');
  }, 'Error generando texto de información de precios', "Información de precios no disponible");
}

module.exports = {
  generarTextoHorario,
  generarTextoEnvio,
  generarTextoPago,
  generarTextoDirecciones,
  generarTextoPrecios,
  generarTextoInfoPrecios,
  generarTextoContacto
};
