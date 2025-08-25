const { esTextoValido, sanitizarTexto, esSoloDigitos } = require('./utils/validation');

// funcion para obtener la clave de fecha local en formato YYYY-MM-DD
function obtenerClaveFechaLocal(date = new Date()) {
  try {
    // Validar que date sea un objeto Date válido
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Fecha inválida proporcionada');
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error en obtenerClaveFechaLocal:', error);
    // En caso de error, devolver la fecha actual en formato YYYY-MM-DD
    const fallback = new Date();
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}`;
  }
}

// funcion para validar si corresponde enviar la bienvenida del día
function debeEnviarBienvenidaDiaria(state) {
  try {
    // Verificar que state sea un objeto válido
    if (!state || typeof state !== 'object') {
      return true; // Si no hay estado, mejor enviar la bienvenida
    }
    
    const today = obtenerClaveFechaLocal();
    if (state.lastWelcomeDay !== today) {
      state.lastWelcomeDay = today;
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error en debeEnviarBienvenidaDiaria:', error);
    return true; // En caso de error, mejor enviar la bienvenida
  }
}

// funcion para extraer el usuario del mensaje (formato: user TU_USUARIO)
function parseLoginUser(texto) {
  try {
    if (!esTextoValido(texto)) return null;
    
    const textoSeguro = sanitizarTexto(texto);
    const matchUser = textoSeguro.match(/^user\s+(.+)/i);
    
    if (!matchUser || !matchUser[1]) return null;
    
    // Limitar longitud del usuario para prevenir ataques
    const usuario = matchUser[1].trim().substring(0, 50);
    return usuario.length > 0 ? usuario : null;
  } catch (error) {
    console.error('Error en parseLoginUser:', error);
    return null;
  }
}

// funcion para extraer el password del mensaje (formato: pass TU_PASSWORD)
function parseLoginPass(texto) {
  try {
    if (!esTextoValido(texto)) return null;
    
    const textoSeguro = sanitizarTexto(texto);
    const matchPass = textoSeguro.match(/^pass\s+(.+)/i);
    
    if (!matchPass || !matchPass[1]) return null;
    
    // Limitar longitud de la contraseña para prevenir ataques
    const password = matchPass[1].trim().substring(0, 50);
    return password.length > 0 ? password : null;
  } catch (error) {
    console.error('Error en parseLoginPass:', error);
    return null;
  }
}

// funcion para detectar el comando de actualización del nombre de la tienda
function esComandoNombre(textoCrudo) {
  try {
    return esTextoValido(textoCrudo) && /^nombre\s*:/i.test(textoCrudo);
  } catch (error) {
    console.error('Error en esComandoNombre:', error);
    return false;
  }
}

// funcion para detectar el comando de actualización del horario
function esComandoHorario(textoCrudo) {
  try {
    return esTextoValido(textoCrudo) && /^horario\s*:/i.test(textoCrudo);
  } catch (error) {
    console.error('Error en esComandoHorario:', error);
    return false;
  }
}

// funcion para detectar el comando de actualización del envío
function esComandoEnvio(textoCrudo) {
  try {
    return esTextoValido(textoCrudo) && /^envio\s*:/i.test(textoCrudo);
  } catch (error) {
    console.error('Error en esComandoEnvio:', error);
    return false;
  }
}

// funcion para detectar el comando de actualización de direcciones
function esComandoDirecciones(textoCrudo) {
  try {
    return esTextoValido(textoCrudo) && /^direcciones\s*:/i.test(textoCrudo);
  } catch (error) {
    console.error('Error en esComandoDirecciones:', error);
    return false;
  }
}

// funcion para detectar el comando de actualización de precios
function esComandoPrecios(textoCrudo) {
  try {
    return esTextoValido(textoCrudo) && /^precios\s*:/i.test(textoCrudo);
  } catch (error) {
    console.error('Error en esComandoPrecios:', error);
    return false;
  }
}

// funcion para detectar el comando de actualización de contacto
function esComandoContacto(textoCrudo) {
  try {
    return esTextoValido(textoCrudo) && /^contacto\s*:/i.test(textoCrudo);
  } catch (error) {
    console.error('Error en esComandoContacto:', error);
    return false;
  }
}

// funcion para detectar el comando de actualización de los pagos
function esComandoPago(textoCrudo) {
  try {
    return esTextoValido(textoCrudo) && /^pago\s*:/i.test(textoCrudo);
  } catch (error) {
    console.error('Error en esComandoPago:', error);
    return false;
  }
}

// funcion para detectar el comando para ver la configuración
function esComandoConfig(texto) {
  try {
    return esTextoValido(texto) && /^config\s*\?/i.test(texto);
  } catch (error) {
    console.error('Error en esComandoConfig:', error);
    return false;
  }
}

// funcion para detectar el comando para cerrar sesión de administrador
function esComandoLogout(texto) {
  try {
    return esTextoValido(texto) && /^(logout|cerrarsesion)$/i.test(texto);
  } catch (error) {
    console.error('Error en esComandoLogout:', error);
    return false;
  }
}

// funcion para parsear el alta/actualización de comandos personalizados (cmd:add palabra: respuesta)
function parseCmdAdd(textoCrudo) {
  try {
    if (!esTextoValido(textoCrudo) || !/^cmd:add\s+[^:]+:/i.test(textoCrudo)) return null;
    
    const rest = textoCrudo.slice(8).trim();
    const [palabraRaw, ...respParts] = rest.split(':');
    
    // Sanitizar y validar la palabra clave
    const palabra = sanitizarTexto((palabraRaw || '').trim().toLowerCase(), 50);
    
    // Sanitizar y validar la respuesta
    const respuesta = sanitizarTexto(respParts.join(':').trim(), 500);
    
    if (!palabra || !respuesta) return null;
    return { palabra, respuesta };
  } catch (error) {
    console.error('Error en parseCmdAdd:', error);
    return null;
  }
}

// funcion para parsear la eliminación de un comando personalizado (cmd:del palabra)
function parseCmdDel(textoCrudo) {
  try {
    if (!esTextoValido(textoCrudo) || !/^cmd:del\s+.+/i.test(textoCrudo)) return null;
    
    return sanitizarTexto(textoCrudo.slice(8).trim().toLowerCase(), 50);
  } catch (error) {
    console.error('Error en parseCmdDel:', error);
    return null;
  }
}

// funcion para detectar el listado de comandos personalizados (cmd:list)
function esCmdList(texto) {
  try {
    return esTextoValido(texto) && /^cmd:list$/i.test(texto);
  } catch (error) {
    console.error('Error en esCmdList:', error);
    return false;
  }
}

// funcion para detectar comandos relacionados a precios y productos
function esComandoPedirPrecios(texto) {
  try {
    return esTextoValido(texto) && 
           /^(precios?|lista\s+de\s+precios|ver\s+precios)$/i.test(texto);
  } catch (error) {
    console.error('Error en esComandoPedirPrecios:', error);
    return false;
  }
}

// funcion para detectar comandos relacionados a catálogo/productos
function esComandoPedirCatalogo(texto) {
  try {
    return esTextoValido(texto) && 
           /^(catalogo|catálogo|productos|menu\s+completo|productos\s+completos)$/i.test(texto);
  } catch (error) {
    console.error('Error en esComandoPedirCatalogo:', error);
    return false;
  }
}

// funcion para detectar comandos de horario
function esComandoPedirHorario(texto) {
  try {
    return esTextoValido(texto) && 
           /^(horarios?|horas?|horario\s+de\s+atencion|cuando\s+abren|horario\s+de\s+atencion|hora\s+de\s+atencion|hora\s+de\s+apertura)$/i.test(texto);
  } catch (error) {
    console.error('Error en esComandoPedirHorario:', error);
    return false;
  }
}

// funcion para detectar comandos de direcciones
function esComandoPedirDirecciones(texto) {
  try {
    return esTextoValido(texto) && 
           /^(direccion(es)?|ubicacion(es)?|donde\s+estan|donde\s+están|ubicacion|ubicación|sucursales?|locales?|tiendas?)$/i.test(texto);
  } catch (error) {
    console.error('Error en esComandoPedirDirecciones:', error);
    return false;
  }
}

// funcion para detectar comandos de pago
function esComandoPedirPagos(texto) {
  try {
    return esTextoValido(texto) && 
           /^(pagos?|formas?\s+de\s+pago|metodos?\s+de\s+pago|como\s+pagar|pagos?\s+aceptados?|acepta\s+tarjeta|aceptas?\s+efectivo)$/i.test(texto);
  } catch (error) {
    console.error('Error en esComandoPedirPagos:', error);
    return false;
  }
}

// funcion para detectar petición de ayuda
function esComandoAyuda(texto) {
  try {
    return esTextoValido(texto) && 
           /^(ayuda|help|info|instrucciones|comandos|opciones|que\s+puedes\s+hacer)$/i.test(texto);
  } catch (error) {
    console.error('Error en esComandoAyuda:', error);
    return false;
  }
}

// funcion para detectar si el usuario envió una opcion numerica de 1 digito
// acepta formatos como: "1", "1.", "1)" o "1 texto..."
function obtenerOpcionNumerica(texto) {
  try {
    // Manejar casos de entrada no válida
    if (texto === undefined || texto === null) {
      return null;
    }
    
    // Convertir a string de forma segura y normalizar
    const raw = String(texto).trim();
    if (raw.length === 0) {
      return null;
    }
    
    // Limitar longitud para evitar regex DoS
    const textoLimitado = raw.substring(0, 100);
    
    // capturar dígito inicial si el mensaje comienza con él
    const match = textoLimitado.match(/^\s*([0-9])(?:[\.)]?\s*)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Error en obtenerOpcionNumerica:', error);
    return null;
  }
}

module.exports = {
  obtenerClaveFechaLocal,
  debeEnviarBienvenidaDiaria,
  parseLoginUser,
  parseLoginPass,
  esComandoNombre,
  esComandoHorario,
  esComandoEnvio,
  esComandoPago,
  esComandoDirecciones,
  esComandoPrecios,
  esComandoContacto,
  esComandoConfig,
  esComandoLogout,
  parseCmdAdd,
  parseCmdDel,
  esCmdList,
  obtenerOpcionNumerica,
  esComandoPedirPrecios,
  esComandoPedirCatalogo,
  esComandoPedirHorario,
  esComandoPedirDirecciones,
  esComandoPedirPagos,
  esComandoAyuda
};


