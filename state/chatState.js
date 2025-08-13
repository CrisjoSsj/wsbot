'use strict';

// funcion para mantener un mapa de estado por chat en memoria
const chatIdToState = new Map();

// funcion para obtener (o inicializar) el estado del chat
function obtenerEstadoDelChat(chatId) {
  if (!chatIdToState.has(chatId)) {
    chatIdToState.set(chatId, {
      // cuando está activado, el bot no responde automáticamente
      humanMode: false,
      // YYYY-MM-DD del último mensaje de bienvenida enviado
      lastWelcomeDay: null,
      // indica si el chat está autenticado como admin
      isAdmin: false
    });
  }
  return chatIdToState.get(chatId);
}

module.exports = {
  obtenerEstadoDelChat
};


