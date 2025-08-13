const qrcode = require('qrcode-terminal');

// funcion para generar el texto del menú principal
function generarTextoMenu(storeName) {
  return [
    '━━━━━━━━━━━━━━━━━━━━━━',
    `🤖 ${storeName}`,
    'Tu asistente en WhatsApp',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '🧭 Menú principal (elige un número):',
    '1) Ver menú principal',
    '2) Ayuda rápida',
    '3) Horarios de atención',
    '4) Información de envíos',
    '5) Métodos de pago',
    '0) Hablar con un asesor',
    '9) Información de contacto'
  ].join('\n');
}

// funcion para generar el texto de ayuda rápida
function generarTextoAyuda() {
  return [
    'ℹ️ Ayuda rápida:',
    '- Envía 1 para ver el menú principal.',
    '- Envía 0 para hablar con un asesor humano.',
    '- Para volver al bot, escribe "bot".'
  ].join('\n');
}

// funcion para generar el menú del panel de administración
function generarMenuAdmin() {
  return [
    '🛠️ Panel de administración',
    '',
    'Editar contenidos:',
    '- nombre: Nuevo Nombre de Tienda',
    '- horario: Texto de horarios',
    '- envio: Texto de envíos',
    '- pago: Texto de formas de pago',
    '',
    'Comandos personalizados:',
    '- cmd:add palabra: respuesta  → crea/actualiza',
    '- cmd:del palabra            → elimina',
    '- cmd:list                   → listar',
    '',
    'Otros:',
    '- config?     → ver configuración actual',
    '- cerrarsesion (o logout) → salir del modo admin'
  ].join('\n');
}

// funcion para generar el texto de bienvenida diaria
function generarTextoBienvenida(storeName) {
  return [
    `¡Hola! 👋 Soy ${storeName}.`,
    'Para empezar:',
    '- Envía 1 para ver el menú de opciones',
    '- Envía 0 para hablar con una persona real'
  ].join('\n');
}

// funcion para imprimir el QR de autenticación en consola
function printQr(qr) {
  console.log('Escanea este QR para autenticar:');
  qrcode.generate(qr, { small: true });
}

module.exports = {
  generarTextoMenu,
  generarTextoAyuda,
  generarMenuAdmin,
  generarTextoBienvenida,
  printQr
};


