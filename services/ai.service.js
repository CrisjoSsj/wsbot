'use strict';

// Servicio para integrar con Groq AI
const Groq = require('groq-sdk');
const botConfig = require('../config/botConfig');
const { obtenerEstadoDelChat } = require('../state/chatState');
const aiAnalytics = require('./aiAnalytics.service');

// Configuración del servicio
let config = {
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  aiEnabled: process.env.AI_ENABLED === 'true' || false,
  confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.7'),
  contextLength: parseInt(process.env.AI_CONTEXT_LENGTH || '5'),
  timeout: parseInt(process.env.AI_REQUEST_TIMEOUT || '10000'),
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1000'),
};

// Inicializar Groq AI
let groq = null;

function initializeGroq() {
  try {
    const botSettings = botConfig.obtenerConfiguracion();
    const apiKey = botSettings.ai?.groqApiKey || config.groqApiKey;
    
    if (!apiKey) {
      console.warn('⚠️ No se ha configurado la API key de Groq');
      return false;
    }
    
    groq = new Groq({
      apiKey: apiKey,
    });
    
    console.log('✅ Groq AI inicializado correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error al inicializar Groq AI:', error.message);
    return false;
  }
}

/**
 * Genera el prompt del sistema con el contexto del negocio y la intención detectada
 * @param {object} businessContext - Contexto del negocio
 * @param {object} userIntent - Intención detectada del usuario
 * @returns {string} - Prompt del sistema personalizado
 */
function generateSystemPrompt(businessContext, userIntent = null) {
  const { name, description, content, ai } = businessContext;
  
  // Determinar estrategia de respuesta según intención
  let strategySection = '';
  if (userIntent) {
    if (userIntent.type === 'buying' && userIntent.buyingInterest > 0.5) {
      strategySection = `
ESTRATEGIA COMERCIAL ACTIVA (Cliente con intención de compra detectada):
• 🎯 GENERA EXPECTATIVA antes de derivar al asesor
• 💫 Menciona brevemente lo atractivo de las camisetas
• 🏃‍♂️ Crea sensación de oportunidad
• 📞 Deriva con mensaje específico para ventas`;
    } else if (userIntent.type === 'info') {
      strategySection = `
ESTRATEGIA INFORMATIVA (Cliente busca info rápida):
• ⚡ Respuesta directa y concisa
• 📋 Solo la información solicitada
• 🤝 Si falta detalle, ofrece derivar con *4*`;
    } else if (userIntent.isFirstTime) {
      strategySection = `
ESTRATEGIA DE BIENVENIDA (Cliente nuevo):
• 🤗 Tono más acogedor y explicativo
• 🏪 Incluir breve presentación del negocio
• 🗺️ Orientar brevemente cómo obtener ayuda (puede enviar *4*)`;
    }
  }
  
  // Construir un resumen dinámico del contenido personalizado
  const custom = content && typeof content === 'object' ? content : {};
  const summarize = (val) => {
    try {
      if (val == null) return '';
      if (typeof val === 'string') return val.slice(0, 300);
      // Soportar estructura { value: 'texto' }
      if (typeof val === 'object' && typeof val.value === 'string') return val.value.slice(0, 300);
      if (Array.isArray(val)) return val.slice(0, 5).map(summarize).filter(Boolean).join(' | ').slice(0, 300);
      if (typeof val === 'object') {
        const fields = ['title', 'description', 'message', 'details', 'value', 'content'];
        for (const f of fields) {
          if (f in val) {
            const v = val[f];
            if (Array.isArray(v)) return v.map(summarize).filter(Boolean).join(' | ').slice(0, 300);
            if (typeof v === 'string') return v.slice(0, 300);
          }
        }
        const json = JSON.stringify(val);
        return json.slice(0, 300);
      }
      return String(val).slice(0, 300);
    } catch { return ''; }
  };
  const customEntries = Object.keys(custom).length
    ? Object.entries(custom).map(([k, v]) => `• ${k}: ${summarize(v)}`).join('\n')
    : '• (Sin contenido personalizado)';

  return `Eres un asistente súper amigable de "${name || 'nuestra tienda'}" - ${description || 'tienda de camisetas'}.
${strategySection}

INFORMACIÓN BÁSICA:
• Nombre de la tienda: ${name || 'Tienda Ssj'}
• Tipo de negocio: ${description || 'tienda de camisetas'}

CONTEXTO PERSONALIZADO (desde configuración):
${customEntries}

ESTILO DE COMUNICACIÓN:
${ai?.instructions || 'Responde de manera amigable, directa y profesional'}

REGLAS CRÍTICAS:
1. 🚫 NUNCA uses "Entiendo", "Comprendo", "Claro", "Por supuesto"
2. ⚡ MÁXIMO 2-3 líneas por respuesta - sé súper conciso
3. 😊 Habla como un amigo cercano, no como robot formal
4. 🎯 Ve directo al punto con calidez humana
5. Si no sabes algo específico o falta contexto, sugiere amablemente enviar *4* (asesor humano)
6. 🎈 Usa 1-2 emojis que aporten, no decoren
7. 🚫 SOLO puedes responder usando la información de este contexto. Si la respuesta no está aquí, responde exactamente: "No tengo esa información, por favor envía *4* para hablar con un asesor humano." No inventes respuestas ni respondas temas fuera de la tienda.

EJEMPLOS DE RESPUESTAS PERFECTAS:

Para nombre de tienda:
❌ MAL: "Nuestra empresa se denomina..."
✅ BIEN: "Somos ${name || 'Tienda Ssj'} 👕"

Para horarios:
❌ MAL: "Te informo que nuestros horarios de atención son..."
✅ BIEN: "🕒 Estamos abiertos todos los días de 9:00 a 18:00"

Para interés en productos:
❌ MAL: "Tenemos varios productos disponibles, te recomiendo que contactes..."
✅ BIEN: "¡Qué bueno que te gusten nuestras camisetas! 👕 Envía *4* para ver todos los modelos disponibles 😊"

Para consultas complejas o fuera de contexto:
❌ MAL: "No tengo esa información específica en este momento, pero puedes..."
✅ BIEN: "No tengo esa información, por favor envía *4* para hablar con un asesor humano."
`;
}

/**
 * Detecta la intención del usuario para personalizar la respuesta
 * @param {string} userMessage - Mensaje del usuario
 * @returns {object} - Objeto con tipo de intención y nivel de interés
 */
function detectUserIntent(userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  
  // Intenciones de alta conversión (interés en comprar)
  const buyingIntent = [
    'comprar', 'precio', 'cuesta', 'vale', 'camisetas', 'modelos',
    'disponible', 'stock', 'catálogo', 'productos', 'tallas',
    'colores', 'diseños', 'ofertas', 'promociones', 'descuento'
  ];
  
  // Consultas informativas rápidas
  const infoIntent = [
    'horario', 'hora', 'abrir', 'cerrar', 'ubicación', 'dirección',
    'dónde', 'contacto', 'teléfono', 'email', 'envío', 'delivery',
    'nombre', 'llaman', 'tienda', 'empresa', 'negocio'
  ];
  
  // Cliente nuevo vs recurrente (palabras clave)
  const firstTimeIndicators = [
    'primera vez', 'nuevo', 'conocer', 'información', 'qué venden'
  ];
  
  let intent = {
    type: 'general',
    buyingInterest: 0,
    isFirstTime: false,
    isUrgent: false
  };
  
  // Detectar intención de compra
  const buyingMatches = buyingIntent.filter(word => lowerMessage.includes(word));
  intent.buyingInterest = buyingMatches.length > 0 ? Math.min(buyingMatches.length * 0.3, 1) : 0;
  
  // Detectar tipo de consulta
  if (buyingMatches.length > 0) {
    intent.type = 'buying';
  } else if (infoIntent.some(word => lowerMessage.includes(word))) {
    intent.type = 'info';
  }
  
  // Detectar si es primera vez
  intent.isFirstTime = firstTimeIndicators.some(phrase => lowerMessage.includes(phrase));
  
  // Detectar urgencia
  intent.isUrgent = /urgente|rápido|ya|ahora|hoy/i.test(lowerMessage);
  
  return intent;
}

/**
 * Analiza la confianza de la respuesta basándose en indicadores e intención
 * @param {string} response - Respuesta de la IA
 * @param {string} userMessage - Mensaje del usuario
 * @returns {number} - Nivel de confianza entre 0 y 1
 */
function analyzeConfidence(response, userMessage) {
  // Palabras clave de temas fuera de contexto (ejemplo: crédito, cuotas, financiamiento)
  const outOfContextKeywords = [
    'crédito', 'credito', 'financiamiento', 'financiar', 'cuotas', 'pago a plazos', 'pagar después', 'fiar', 'fiado', 'tarjeta de crédito', 'préstamo', 'prestamo', 'abono', 'abonar', 'plan de pago', 'plan de financiamiento'
  ];

  // Base de confianza más conservadora
  let confidence = 0.5;
  const lowerResponse = (response || '').toLowerCase();
  const userLower = (userMessage || '').toLowerCase();
  const intent = detectUserIntent(userMessage);

  // Extraer palabras del content de forma recursiva para tener más cobertura
  let contentKeywords = [];
  try {
    const botSettings = botConfig.obtenerConfiguracion();
    const contentObj = botSettings.content || {};

    const collectStrings = (val, out) => {
      if (val == null) return;
      if (typeof val === 'string') return out.push(val);
      if (Array.isArray(val)) return val.forEach(v => collectStrings(v, out));
      if (typeof val === 'object') return Object.values(val).forEach(v => collectStrings(v, out));
    };

    const strings = [];
    collectStrings(contentObj, strings);
    // Tokenizar contenido incluyendo números y horas; eliminar stopwords
    const stopwords = new Set(['el','la','los','las','un','una','y','o','en','de','del','con','por','para','que','se','su','sus','al','es','a','el','las','los']);
    contentKeywords = strings
      .flatMap(s => String(s).split(/\W+/).filter(Boolean))
      .map(w => w.toLowerCase())
      .filter(w => !stopwords.has(w));
    // Añadir patrones útiles (horas, precios) extraídos del corpus
    try {
      const corpus = strings.join(' ').toLowerCase();
      const timeRegex = /\b\d{1,2}:\d{2}\b/g;
      const priceRegex = /\$\s?\d+(?:[.,]\d+)?/g;
      const times = corpus.match(timeRegex) || [];
      const prices = corpus.match(priceRegex) || [];
      contentKeywords.push(...times.map(t => t.toLowerCase()));
      contentKeywords.push(...prices.map(p => p.toLowerCase()));
    } catch (e) {}
  } catch (e) {
    // si falla, seguir con lista vacía
  }

  // Contar coincidencias únicas de palabras del content dentro de la respuesta
  const matched = new Set();
  contentKeywords.forEach(keyword => {
    if (keyword && lowerResponse.includes(keyword)) matched.add(keyword);
  });
  const contentMatches = matched.size;

  // Bonificación por coincidencias con contenido conocido (más conservadora)
  if (contentMatches > 0) {
    confidence += Math.min(contentMatches * 0.12, 0.45);
  }

  // Penalizaciones y tope si no hay contenido coincidente
  let maxAllowed = 1.0;
  if (contentMatches === 0) {
    // Si no hay evidencia en el content, evitar confianza máxima
    maxAllowed = 0.65;
  }

  // Detectar preguntas fuera de contexto (financiero) y reducir mucho la confianza
  const preguntaFueraDeContexto = outOfContextKeywords.some(word => userLower.includes(word));
  const responseMentionsCuotas = /cuotas|financiamiento|pago a plazos|pagar después|fiar|fiado|tarjeta de crédito|préstamo|prestamo|abono|abonar|plan de pago|plan de financiamiento/i.test(lowerResponse);
  if (preguntaFueraDeContexto && contentMatches === 0) {
    maxAllowed = Math.min(maxAllowed, 0.2);
  } else if (responseMentionsCuotas) {
    maxAllowed = Math.min(maxAllowed, 0.7);
  }

  // BONIFICACIONES pequeñas y penalizaciones
  if (intent.type === 'buying' && intent.buyingInterest > 0.5) {
    if (lowerResponse.includes('catálogo') || lowerResponse.includes('camisetas') || lowerResponse.includes('modelos')) {
      confidence += 0.08;
    }
  }

  const badStarters = [
    'entiendo', 'comprendo', 'claro', 'por supuesto', 'perfecto',
    'muy bien', 'excelente', 'desde luego', 'efectivamente', 'correcto',
    'sin duda', 'absolutamente', 'ciertamente', 'naturalmente'
  ];
  const firstWords = lowerResponse.split(' ').slice(0, 3).join(' ');
  badStarters.forEach(starter => {
    if (firstWords.includes(starter)) {
      confidence -= 0.35;
    }
  });

  const uncertaintyIndicators = [
    'no tengo información', 'no estoy seguro', 'no puedo confirmar',
    'no dispongo de', 'no conozco', 'no sé', 'habla con un asesor',
    'contacta con', 'necesitas hablar', 'deriva', 'derivar',
    'no puedo ayudar', 'no tengo acceso', 'consulta con'
  ];
  let uncertaintyCount = 0;
  uncertaintyIndicators.forEach(indicator => {
    if (lowerResponse.includes(indicator)) uncertaintyCount++;
  });
  confidence -= (uncertaintyCount * 0.13);

  // Pequeñas bonificaciones por indicadores útiles
  const goodIndicators = [
    'enviamos', 'entregamos', 'costo de envío', 'métodos de pago', 'aceptamos', 'estamos en', 'tel:', 'email:'
  ];
  goodIndicators.forEach(indicator => {
    if (lowerResponse.includes(indicator)) confidence += 0.03;
  });

  // Bonus por concisión
  if (response.length > 50 && response.length < 300) confidence += 0.06;
  if (response.length > 500 || response.length < 20) confidence -= 0.18;

  // Penalización por consultas específicas sin respuesta concreta
  const specificQueries = ['precio', 'costo', 'cuánto', 'disponibilidad', 'stock', 'existencia', 'comprar', 'pedido', 'orden', 'catálogo específico'];
  let specificityCount = 0;
  specificQueries.forEach(q => { if (userLower.includes(q)) specificityCount++; });
  if (specificityCount > 0 && !lowerResponse.includes('$') && !lowerResponse.includes('precio')) confidence -= 0.18;

  // Regla fuerte: si la consulta es específica (precios, tallas, stock, modelos) y no hay evidencia en el content,
  // forzar un tope bajo para la confianza para asegurar derivación al asesor humano.
  try {
    const criticalSpecifics = ['precio','costo','cuánto','disponibilidad','stock','talla','tallas','modelo','modelos','medida','existencia'];
    const asksSpecific = criticalSpecifics.some(k => userLower.includes(k));
    if (asksSpecific && contentMatches === 0) {
      // Si ya existe un tope (maxAllowed) respetarlo y aplicar un tope adicional conservador
      confidence = Math.min(confidence, Math.min(maxAllowed, 0.45));
    }
  } catch (e) {}

  // Aplicar tope máximo si corresponde (para evitar confianza inflada)
  confidence = Math.min(confidence, maxAllowed);

  // ADICIONAL: medir solapamiento semántico simple entre respuesta y corpus conocido
  try {
    const botSettings = botConfig.obtenerConfiguracion();
    const menuOptions = Array.isArray(botSettings.menu?.options) ? botSettings.menu.options.map(o => String(o.text || '')) : [];
    const corpusStrings = [
      ...(Object.values(botSettings.content || {}).filter(v => typeof v === 'string')),
      ...menuOptions,
      botSettings.storeName || ''
    ].join(' ').toLowerCase();

    const tokenize = (s) => (s || '').split(/\W+/).filter(Boolean).map(w => w.toLowerCase());
    const respWords = new Set(tokenize(lowerResponse));
    const corpusWords = new Set(tokenize(corpusStrings));
    if (respWords.size > 0 && corpusWords.size > 0) {
      let common = 0;
      respWords.forEach(w => { if (corpusWords.has(w)) common++; });
      const overlapRatio = common / respWords.size;
      // Si solapamiento muy bajo (respuesta inventada), bajar fuerte el tope
      if (overlapRatio < 0.05 && contentMatches === 0) {
        confidence = Math.min(confidence, 0.4);
      }
      // Si la respuesta incluye horas explícitas que coinciden con el corpus, aumentar confianza
      try {
        const timeRegex = /\b\d{1,2}:\d{2}\b/g;
        const respTimes = (lowerResponse.match(timeRegex) || []);
        const corpusTimes = (corpusStrings.match(timeRegex) || []);
        if (respTimes.length && corpusTimes.length) {
          const shared = respTimes.filter(t => corpusTimes.includes(t));
          if (shared.length) {
            confidence = Math.min(1.0, confidence + 0.45); // boost mayor para horarios exactos
          }
        }
      } catch (e) {}

      // BONIFICACIÓN por coincidencia exacta de frases largas en el corpus
      try {
        const corpusSentences = corpusStrings.split(/[\.\n\!\?]+/).map(s => s.trim()).filter(s => s.length > 15);
        for (const s of corpusSentences) {
          const snippet = s.toLowerCase();
          if (snippet && lowerResponse.includes(snippet)) {
            confidence = Math.min(1.0, confidence + 0.35);
            break;
          }
        }
      } catch (e) {}

      // Boost por tokens clave tipo stock/tallas/stock words si aparecen en ambos
      try {
        const stockKeys = ['talla', 'tallas', 'stock', 'disponible', 'disponibilidad', 'existencia'];
        let stockMatches = 0;
        stockMatches += stockKeys.filter(k => lowerResponse.includes(k)).length;
        stockMatches += stockKeys.filter(k => corpusStrings.includes(k)).length;
        if (stockMatches >= 2) {
          confidence = Math.min(1.0, confidence + 0.25);
        }
      } catch (e) {}

      // Boost si respuesta contiene teléfono o "tel" y corpus también
      try {
        if (lowerResponse.includes('tel') || /\+?\d{2,3}[\s-]?\(?\d{2,3}\)?[\s-]?\d{3,4}/.test(lowerResponse)) {
          if (/tel|telefono|tel:|\+\d{1,3}/i.test(corpusStrings)) {
            confidence = Math.min(1.0, confidence + 0.25);
          }
        }
      } catch (e) {}
    }
  } catch (e) {
    // si falla, no bloquear flujo
  }

  // Asegurar que la confianza esté entre 0 y 1
  let finalConfidence = Math.max(0, Math.min(1, confidence));

  // Seguridad adicional: evitar devolver 1.0 a menos que haya evidencia clara
  try {
    const botSettings = botConfig.obtenerConfiguracion();
    const corpusStrings = [
      ...(Object.values(botSettings.content || {}).filter(v => typeof v === 'string')),
      ...(Array.isArray(botSettings.menu?.options) ? botSettings.menu.options.map(o => String(o.text || '')) : []),
      botSettings.storeName || ''
    ].join(' ').toLowerCase();
    const tokenize = (s) => (s || '').split(/\W+/).filter(Boolean).map(w => w.toLowerCase());
    const respWords = new Set(tokenize(lowerResponse));
    const corpusWords = new Set(tokenize(corpusStrings));
    let common = 0;
    respWords.forEach(w => { if (corpusWords.has(w)) common++; });
    const overlapRatio = respWords.size > 0 ? (common / respWords.size) : 0;

    const hasPrice = /\$\s?\d+/.test(lowerResponse);
    const hasTime = /\b\d{1,2}:\d{2}\b/.test(lowerResponse);

    const strongEvidence = (contentMatches >= 3) || hasPrice || hasTime || overlapRatio >= 0.18;
    if (finalConfidence >= 0.99 && !strongEvidence) {
      // reducir a un valor conservador pero por encima del umbral si corresponde
      finalConfidence = Math.min(finalConfidence, 0.92);
    }
  } catch (e) {
    // no bloquear en caso de error
  }

  return finalConfidence;
}

/**
 * Limpia y mejora la respuesta de la IA eliminando muletillas
 * @param {string} response - Respuesta original de la IA
 * @returns {string} - Respuesta limpia y mejorada
 */
function cleanResponse(response) {
  if (!response || typeof response !== 'string') {
    return response;
  }

  let cleaned = response.trim();
  
  // Eliminar frases robóticas y formales al inicio
  const roboticStarters = [
    /^¡?hola!?\s+/i,
    /^entiendo que\s+/i,
    /^entiendo[,.]?\s+/i,
    /^comprendo que\s+/i,
    /^comprendo[,.]?\s+/i,
    /^claro que\s+/i,
    /^claro[,.]?\s+/i,
    /^por supuesto que\s+/i,
    /^por supuesto[,!.]?\s+/i,
    /^desde luego[,.]?\s+/i,
    /^efectivamente[,.]?\s+/i,
    /^sin duda[,.]?\s+/i,
    /^ciertamente[,.]?\s+/i,
    /^te informo que\s+/i,
    /^me complace informarte que\s+/i,
    /^permíteme decirte que\s+/i,
    /^déjame decirte que\s+/i,
    /^con gusto te informo que\s+/i
  ];
  
  // Aplicar limpieza de frases robóticas
  roboticStarters.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Eliminar conectores innecesarios que hacen respuestas largas
  const verboseConnectors = [
    /^en relación a tu consulta[,.]?\s+/i,
    /^respecto a tu pregunta[,.]?\s+/i,
    /^para responder a tu consulta[,.]?\s+/i,
    /^con respecto a lo que preguntas[,.]?\s+/i,
    /^en cuanto a lo que solicitas[,.]?\s+/i
  ];
  
  verboseConnectors.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Corregir frases que quedaron mal después de la limpieza
  cleaned = cleaned.replace(/^que\s+/i, ''); // "que necesitas..." -> "necesitas..."
  cleaned = cleaned.replace(/^[,!.]\s*/, ''); // Eliminar puntuación inicial suelta
  
  // Asegurar que empiece con mayúscula
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  // Eliminar espacios múltiples
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Si la respuesta quedó muy corta, agregar emoji contextual
  if (cleaned.length > 5 && cleaned.length < 15) {
    if (response.toLowerCase().includes('horario')) {
      cleaned = '🕒 ' + cleaned;
    } else if (response.toLowerCase().includes('envío') || response.toLowerCase().includes('envio')) {
      cleaned = '📦 ' + cleaned;
    } else if (response.toLowerCase().includes('pago')) {
      cleaned = '💳 ' + cleaned;
    } else if (response.toLowerCase().includes('ubicac') || response.toLowerCase().includes('direcc')) {
      cleaned = '📍 ' + cleaned;
    } else if (response.toLowerCase().includes('camiseta') || response.toLowerCase().includes('producto')) {
      cleaned = '👕 ' + cleaned;
    }
  }
  
  return cleaned || response; // Si todo falla, devolver la original
}

/**
 * Procesa un mensaje a través de Groq AI
 * @param {string} chatId - ID del chat de WhatsApp
 * @param {string} message - Texto del mensaje a procesar
 * @param {object} state - Estado actual del chat
 * @returns {Promise<object>} - Respuesta con texto y nivel de confianza
 */
async function processMessageWithAI(chatId, message, state) {
  try {
    // Verificar si la IA está habilitada
    const botSettings = botConfig.obtenerConfiguracion();
    if (!botSettings.ai?.enabled && !config.aiEnabled) {
      return { success: false, reason: 'ai_disabled' };
    }

    // Inicializar Groq si no está inicializado
    if (!groq) {
      const initialized = initializeGroq();
      if (!initialized) {
        return { success: false, reason: 'groq_not_initialized' };
      }
    }

    // Detectar intención del usuario
    const userIntent = detectUserIntent(message);
    console.log(`🎯 Intención detectada: ${userIntent.type}, interés de compra: ${(userIntent.buyingInterest * 100).toFixed(0)}%`);

    // Construir el contexto de los últimos mensajes
    const contextHistory = (state.messageHistory || [])
      .slice(-config.contextLength)
      .map(m => `${m.isBot ? 'Asistente' : 'Cliente'}: ${m.text}`)
      .join('\n');

    // Generar el prompt del sistema con intención
    const systemPrompt = generateSystemPrompt(botSettings, userIntent);
    
    // Construir el prompt completo
    let fullPrompt = systemPrompt + '\n\n';
    
    if (contextHistory) {
      fullPrompt += 'HISTORIAL DE CONVERSACIÓN:\n' + contextHistory + '\n\n';
    }
    
    fullPrompt += `NUEVO MENSAJE DEL CLIENTE: ${message}\n\nRESPUESTA:`;

    console.log('🤖 Enviando mensaje a Groq AI...');
    
    // Crear la solicitud con timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), config.timeout);
    });
    
    const aiPromise = groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: fullPrompt
        }
      ],
      model: botSettings.ai?.groqModel || config.groqModel,
      max_tokens: config.maxTokens,
      temperature: 0.7,
      top_p: 0.8,
    });
    
    // Ejecutar con timeout
    const result = await Promise.race([aiPromise, timeoutPromise]);
    const aiText = result.choices[0]?.message?.content;

    if (!aiText || aiText.trim().length === 0) {
      return { success: false, reason: 'empty_response' };
    }

    // Limpiar la respuesta eliminando muletillas
    const cleanedText = cleanResponse(aiText);
    const wasResponseCleaned = cleanedText !== aiText;
    
    // Analizar la confianza de la respuesta original (usando userIntent)
    const confidence = analyzeConfidence(aiText, message);
    
    console.log(`🤖 Groq respondió con confianza: ${confidence.toFixed(2)}`);
    console.log(`🧹 Respuesta limpiada: "${cleanedText}"`);

    // Registrar métricas de analytics
    try {
      await aiAnalytics.logInteraction({
        userMessage: message,
        aiResponse: cleanedText,
        confidence: confidence,
        userIntent: userIntent,
        wasDerivated: false,
        responseWasCleaned: wasResponseCleaned
      });
    } catch (analyticsError) {
      console.warn('⚠️ Error al registrar analytics:', analyticsError.message);
    }

    // Si la confianza es menor al umbral, generar respuesta contextual
    if (confidence < (botSettings.ai?.confidenceThreshold || config.confidenceThreshold)) {
      console.log(`⚠️ Confianza baja (${confidence.toFixed(2)}), generando respuesta contextual`);
      
      // Registrar derivación en analytics
      try {
        await aiAnalytics.logInteraction({
          userMessage: message,
          aiResponse: 'DERIVATED_TO_HUMAN',
          confidence: confidence,
          userIntent: userIntent,
          wasDerivated: true,
          responseWasCleaned: false
        });
      } catch (analyticsError) {
        console.warn('⚠️ Error al registrar analytics de derivación:', analyticsError.message);
      }
      
      // Generar respuesta de derivación contextual según intención
      let fallbackResponse = '';
      
      if (userIntent.type === 'buying' && userIntent.buyingInterest > 0.3) {
        fallbackResponse = `¡Genial que te interesen nuestras camisetas! 👕✨\nEnvía *4* para que te muestren todos los modelos y precios súper rápido 😊`;
      } else if (userIntent.type === 'info') {
        fallbackResponse = `¡Te ayudo al toque! Envía *4* para info actualizada �`;
      } else if (userIntent.isFirstTime) {
        fallbackResponse = `¡Bienvenido! 👋 Somos expertos en camisetas\nEnvía *4* para que te cuenten todo 😊`;
      } else {
        fallbackResponse = `¡Te conectamos con alguien que te ayude al instante! 👩‍💼\nEnvía *4* para hablar con un asesor`;
      }
      
      return {
        success: false,
        reason: 'low_confidence_contextual',
        confidence: confidence,
        suggestedResponse: fallbackResponse,
        userIntent: userIntent
      };
    }

    // Actualizar historial de mensajes
    if (!state.messageHistory) state.messageHistory = [];
    
    // Guardar mensaje del usuario
    state.messageHistory.push({
      isBot: false,
      text: message,
      timestamp: new Date().toISOString()
    });
    
    // Guardar respuesta de la IA (usando el texto limpio)
    state.messageHistory.push({
      isBot: true,
      text: cleanedText,
      timestamp: new Date().toISOString(),
      fromAI: true,
      confidence: confidence,
  model: 'groq',
      originalText: aiText // Guardamos también el texto original por si acaso
    });
    
    // Limitar el historial
    if (state.messageHistory.length > 20) {
      state.messageHistory = state.messageHistory.slice(-20);
    }
    
    // Retornar respuesta exitosa con texto limpio
    return {
      success: true,
      text: cleanedText,
      confidence: confidence,
      model: 'groq'
    };

  } catch (error) {
    console.error('❌ Error al procesar mensaje con Groq AI:', error.message);
    
    if (error.message === 'Timeout') {
      return { success: false, reason: 'timeout' };
    }
    
    return { success: false, reason: 'error', details: error.message };
  }
}

/**
 * Actualiza la configuración del servicio de IA
 * @param {object} newConfig - Nueva configuración
 */
function updateConfig(newConfig) {
  config = { ...config, ...newConfig };
  
  // Reinicializar Groq si cambia la API key o el modelo
  if (newConfig.groqApiKey || newConfig.groqModel) {
    initializeGroq();
  }
}

/**
 * Retorna la configuración actual del servicio de IA
 * @returns {object} - Configuración actual
 */
function getConfig() {
  return { ...config };
}

/**
 * Verifica si Gemini AI está disponible
 * @returns {boolean} - True si está disponible
 */
function isGeminiAvailable() {
  return model !== null;
}

/**
 * Verifica si Groq está disponible
 * @returns {boolean} - True si Groq está inicializado
 */
function isGroqAvailable() {
  return groq !== null;
}

/**
 * Obtiene estadísticas del servicio de IA
 * @returns {object} - Estadísticas del servicio
 */
function getAIStats() {
  return {
    isInitialized: groq !== null,
    model: config.groqModel,
    hasApiKey: !!(botConfig.obtenerConfiguracion().ai?.groqApiKey || config.groqApiKey),
    confidenceThreshold: config.confidenceThreshold,
    contextLength: config.contextLength,
    timeout: config.timeout
  };
}

// Inicializar Groq al cargar el módulo (omitible para pruebas si se define SKIP_GROQ_INIT=true)
if (!process.env.SKIP_GROQ_INIT) {
  initializeGroq();
}

module.exports = {
  processMessageWithAI,
  updateConfig,
  getConfig,
  isGroqAvailable,
  getAIStats,
  initializeGroq,
  detectUserIntent,
  cleanResponse,
  analyzeConfidence
};
