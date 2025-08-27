const qrcode = require('qrcode-terminal');
const botConfig = require('./config/botConfig');

// funcion para generar el texto del menú principal
function generarTextoMenu() {
  try {
    const config = botConfig.obtenerConfiguracion();
    let title = 'MENÚ PRINCIPAL';
    let footerLines = ['📝 Envía el número de la opción que necesitas', '📲 También puedes escribir *precios*, *horarios*, etc.'];
    let options = [];

    // Nuevo formato: config.menu.options
    if (config.menu && Array.isArray(config.menu.options)) {
      title = config.menu.title || title;
      // Opciones base obligatorias (1 y 4)
      const baseOptions = [
        { number: '1', text: 'Ver este menú', emoji: '' },
        { number: '4', text: 'Contactar asesor', emoji: '' }
      ];
      // Unir opciones base con las del config, evitando duplicados
      const configOptions = config.menu.options.map(op => ({
        number: String(op.number ?? '').trim(),
        text: String(op.text ?? '').trim(),
        emoji: (op.emoji || '').trim()
      })).filter(op => op.number && op.text);
      // Si ya existen 1 o 4 en config, no duplicar
      const allNumbers = configOptions.map(op => op.number);
      const mergedOptions = [
        ...baseOptions.filter(base => !allNumbers.includes(base.number)),
        ...configOptions
      ];
      // Ordenar opciones por número
      options = mergedOptions.sort((a, b) => {
        return parseInt(a.number) - parseInt(b.number);
      });
      if (typeof config.menu.footer === 'string' && config.menu.footer.trim()) {
        footerLines = [config.menu.footer.trim()];
      }
    }
    // Formato legacy: config.menu.mainMenu
    else if (config.menu && config.menu.mainMenu) {
      const menu = config.menu.mainMenu;
      title = menu.title || title;
      options = (menu.options || []).map(op => ({ number: String(op.number), text: String(op.text), emoji: '' }));
      if (Array.isArray(menu.footer) && menu.footer.length) footerLines = menu.footer;
    }

    if (!options.length) throw new Error('No hay opciones configuradas');

    const opciones = options.map(op => {
      const prefix = op.number + '. ';
      const text = op.emoji ? `${op.emoji} *${op.text}*` : `*${op.text}*`;
      return prefix + text;
    });

    const lineas = [

      `🛍️ *${title}*`,
      '',
      ...opciones,
      '',
      ...footerLines
    ];

    return lineas.join('\n');
  } catch (error) {
    console.error('Error generando texto del menú:', error);
    // Fallback a un menú básico si hay error
    return [
      '━━━━━━━━━━━━━━━━━━━━━━',
      '🛍️ *MENÚ PRINCIPAL*',
      '━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '1️⃣  *Ver este menú*',
      '2️⃣  *Ver direcciones*',
      '3️⃣  *Lista de precios*',
      '4️⃣  *Contactar asesor*',
      '5️⃣  *Horarios de atención*',
      '6️⃣  *Métodos de pago*',
      '7️⃣  *Catálogo completo*',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━',
      'Envía el número de la opción para continuar o escribe palabras como *precios* o *horarios*.'
    ].join('\n');
  }
}

// Función de ayuda rápida eliminada (integrada en el menú principal)

// La función para generar el menú de administración por chat ha sido eliminada

// funcion para generar el texto de bienvenida diaria
// funcion para generar el texto de bienvenida
function generarTextoBienvenida() {
  try {
    const config = botConfig.obtenerConfiguracion();
    const welcome = config.menu.welcome;
    const quickOptions = welcome.quickOptions.map(op => `   👉 ${op}`);
    const storeName = config.storeName || 'Tienda';
    
    const lineas = [
      '━━━━━━━━━━━━━━━━━━━━━━',
      `👋 *${welcome.title.replace('NUESTRA TIENDA', storeName)}* 🛒`,
      '━━━━━━━━━━━━━━━━━━━━━━',
      '',
      `✨ ${welcome.message}`,
      '',
      '📌 *OPCIONES RÁPIDAS:*',
      ...quickOptions,
      '',
      `🙏 ${welcome.footer}`
    ];
    
    return lineas.join('\n');
  } catch (error) {
    console.error('Error generando texto de bienvenida:', error);
    // Fallback a un texto básico si hay error
    const config = botConfig.obtenerConfiguracion();
    const storeName = config.storeName || 'Tienda';
    return [
      '━━━━━━━━━━━━━━━━━━━━━━',
      `👋 *¡Bienvenido/a a ${storeName}!* 🛒`,
      '━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '✨ Estamos aquí para ayudarte. Elige una opción o escribe tu pregunta.',
      '',
      '📌 *Atajos:*',
      '   👉 Envía *1* para ver el menú',
      '   👉 Envía *3* para ver precios',
      '   👉 Envía *7* para ver el catálogo',
      '   👉 Envía *4* para hablar con un asesor humano',
      '',
      '🙏 ¡Gracias por contactarnos!'
    ].join('\n');
  }
}

// funcion para imprimir el QR de autenticación en consola
function printQr(qr) {
  console.log('\n======================================');
  console.log('📱 NUEVO CÓDIGO QR GENERADO');
  console.log('======================================');
  console.log('👉 Escanea este QR con WhatsApp para autenticar');
  console.log('⏱️ Tienes aproximadamente 60 segundos antes de que cambie');
  console.log('======================================\n');
  qrcode.generate(qr, { small: true });
  console.log('\n======================================');
}

module.exports = {
  generarTextoMenu,
  generarTextoBienvenida,
  printQr
};


