'use strict';

// adaptador para inicializar y manejar el cliente de whatsapp-web.js
const { Client, LocalAuth } = require('whatsapp-web.js');

// funcion para crear el cliente de WhatsApp con suscriptores a eventos
function crearClienteWhatsApp(opciones = {}) {
  const {
    // identificador de cliente para la persistencia local
    clientId = 'glitch-bot',
    // callbacks de eventos
    onQr,
    onReady,
    onChangeState,
    onAuthenticated,
    onAuthFailure,
    onDisconnected,
    onMessage
  } = opciones;

  // configuracion de puppeteer por plataforma
  const IS_WINDOWS = process.platform === 'win32';
  const puppeteerConfig = IS_WINDOWS
    ? { headless: true }
    : {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      };

  // crear cliente con auth local y opciones recomendadas
  const client = new Client({
    authStrategy: new LocalAuth({ clientId }),
    restartOnAuthFail: true,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 5000,
    puppeteer: puppeteerConfig
  });

  // suscribirse a eventos, si hay callbacks definidos
  if (onQr) client.on('qr', (qr) => onQr(qr));
  if (onReady) client.on('ready', () => onReady());
  if (onChangeState) client.on('change_state', (state) => onChangeState(state));
  if (onAuthenticated) client.on('authenticated', () => onAuthenticated());
  if (onAuthFailure) client.on('auth_failure', (msg) => onAuthFailure(msg));
  if (onDisconnected) client.on('disconnected', (reason) => onDisconnected(reason, client));
  if (onMessage) client.on('message', (message) => onMessage(message));

  return client;
}

// funcion para iniciar el cliente (conectar y mostrar QR si aplica)
function iniciarCliente(client) {
  client.initialize();
}

module.exports = {
  crearClienteWhatsApp,
  iniciarCliente
};


