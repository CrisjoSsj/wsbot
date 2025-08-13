// funcion para obtener la clave de fecha local en formato YYYY-MM-DD
function obtenerClaveFechaLocal(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// funcion para validar si corresponde enviar la bienvenida del día
function debeEnviarBienvenidaDiaria(state) {
  const today = obtenerClaveFechaLocal();
  if (state.lastWelcomeDay !== today) {
    state.lastWelcomeDay = today;
    return true;
  }
  return false;
}

// funcion para extraer el usuario del mensaje (formato: user TU_USUARIO)
function parseLoginUser(texto) {
  const matchUser = texto.match(/^user\s+(.+)/i);
  return matchUser ? matchUser[1].trim() : null;
}

// funcion para extraer el password del mensaje (formato: pass TU_PASSWORD)
function parseLoginPass(texto) {
  const matchPass = texto.match(/^pass\s+(.+)/i);
  return matchPass ? matchPass[1].trim() : null;
}

// funcion para detectar el comando de actualización del nombre de la tienda
function esComandoNombre(textoCrudo) {
  return /^nombre\s*:/i.test(textoCrudo);
}

// funcion para detectar el comando de actualización del horario
function esComandoHorario(textoCrudo) {
  return /^horario\s*:/i.test(textoCrudo);
}

// funcion para detectar el comando de actualización del envío
function esComandoEnvio(textoCrudo) {
  return /^envio\s*:/i.test(textoCrudo);
}

// funcion para detectar el comando de actualización de los pagos
function esComandoPago(textoCrudo) {
  return /^pago\s*:/i.test(textoCrudo);
}

// funcion para detectar el comando para ver la configuración
function esComandoConfig(texto) {
  return /^config\s*\?/i.test(texto);
}

// funcion para detectar el comando para cerrar sesión de administrador
function esComandoLogout(texto) {
  return /^(logout|cerrarsesion)$/i.test(texto);
}

// funcion para parsear el alta/actualización de comandos personalizados (cmd:add palabra: respuesta)
function parseCmdAdd(textoCrudo) {
  if (!/^cmd:add\s+[^:]+:/i.test(textoCrudo)) return null;
  const rest = textoCrudo.slice(8).trim();
  const [palabraRaw, ...respParts] = rest.split(':');
  const palabra = (palabraRaw || '').trim().toLowerCase();
  const respuesta = respParts.join(':').trim();
  if (!palabra || !respuesta) return null;
  return { palabra, respuesta };
}

// funcion para parsear la eliminación de un comando personalizado (cmd:del palabra)
function parseCmdDel(textoCrudo) {
  if (!/^cmd:del\s+.+/i.test(textoCrudo)) return null;
  return textoCrudo.slice(8).trim().toLowerCase();
}

// funcion para detectar el listado de comandos personalizados (cmd:list)
function esCmdList(texto) {
  return /^cmd:list$/i.test(texto);
}

// funcion para detectar si el usuario envió una opcion numerica de 1 digito
function obtenerOpcionNumerica(texto) {
  const match = String(texto || '').trim().match(/^([0-9])$/);
  return match ? match[1] : null;
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
  esComandoConfig,
  esComandoLogout,
  parseCmdAdd,
  parseCmdDel,
  esCmdList,
  obtenerOpcionNumerica
};


