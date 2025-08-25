'use strict';

// funcion para mantener un mapa de estado por chat en memoria
const chatIdToState = new Map();

// Límite de entradas para evitar desbordamiento de memoria
const MAX_CHATS = 1000;

// Estructura de estado por defecto
const DEFAULT_STATE = {
  // cuando está activado, el bot no responde automáticamente
  humanMode: false,
  // indica si la IA está activa para este chat (cuando true, se usa IA como asistente virtual)
  aiMode: false,
  // YYYY-MM-DD del último mensaje de bienvenida enviado
  lastWelcomeDay: null,
  // indica si el chat está autenticado como admin
  isAdmin: false,
  // timestamp del último error para este chat (para evitar spam de errores)
  lastErrorTime: null,
  // contador de errores para limitar mensajes de error
  errorCount: 0,
  // timestamp de último mensaje
  lastMessageTime: null,
  // timestamp para resetear contadores
  lastResetTime: Date.now()
};

// Limpiar estados antiguos periódicamente (cada hora)
setInterval(() => {
  const now = Date.now();
  const inactiveThreshold = 7 * 24 * 60 * 60 * 1000; // 7 días en ms
  
  chatIdToState.forEach((state, chatId) => {
    if (state.lastMessageTime && (now - state.lastMessageTime > inactiveThreshold)) {
      chatIdToState.delete(chatId);
    }
  });
  
  console.log(`Limpieza de estados: ${chatIdToState.size} chats activos`);
}, 60 * 60 * 1000); // Cada hora

// funcion para obtener (o inicializar) el estado del chat de forma segura
function obtenerEstadoDelChat(chatId) {
  // Validar el chatId
  if (!chatId || typeof chatId !== 'string') {
    console.error(`chatId inválido: ${chatId}, usando ID genérico`);
    chatId = 'default-chat-id';
  }
  
  // Limpiar si hay demasiados chats (prevenir ataques DoS)
  if (!chatIdToState.has(chatId) && chatIdToState.size >= MAX_CHATS) {
    // Encontrar y eliminar el chat más antiguo
    let oldestTime = Date.now();
    let oldestChatId = null;
    
    chatIdToState.forEach((state, id) => {
      if (state.lastMessageTime && state.lastMessageTime < oldestTime) {
        oldestTime = state.lastMessageTime;
        oldestChatId = id;
      }
    });
    
    if (oldestChatId) {
      chatIdToState.delete(oldestChatId);
      console.log(`Eliminado chat antiguo: ${oldestChatId} para liberar memoria`);
    }
  }
  
  // Crear o actualizar el estado
  if (!chatIdToState.has(chatId)) {
    chatIdToState.set(chatId, { ...DEFAULT_STATE });
  }
  
  const state = chatIdToState.get(chatId);
  
  // Actualizar timestamp para este chat
  state.lastMessageTime = Date.now();
  
  // Resetear contadores diariamente
  const oneDayMs = 24 * 60 * 60 * 1000;
  if ((state.lastMessageTime - state.lastResetTime) > oneDayMs) {
    state.errorCount = 0;
    state.lastResetTime = state.lastMessageTime;
  }
  
  return state;
}

module.exports = {
  obtenerEstadoDelChat
};
