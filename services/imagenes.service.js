'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Jimp = require('jimp');

// rutas base para almacenar datos y medios
const DATA_DIR = path.join(__dirname, '..', 'data');
const MEDIA_DIR = path.join(__dirname, '..', 'media');
const SOLICITUDES_DIR = path.join(MEDIA_DIR, 'solicitudes');
const CATALOGO_DIR = path.join(MEDIA_DIR, 'catalogo');
const SOLICITUDES_JSON = path.join(DATA_DIR, 'solicitudes.json');
const CATALOGO_JSON = path.join(DATA_DIR, 'catalogo.json');

// Configuración 
const PHASH_MAX_DISTANCE = Number(process.env.PHASH_MAX_DISTANCE || 10);

// funcion para asegurar que un directorio exista
function asegurarDirectorio(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

// funcion para cargar un arreglo desde un archivo json (o devolver arreglo vacio)
function cargarArregloJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) || [];
  } catch (e) {
    console.error(`Error al cargar archivo JSON ${filePath}:`, e.message);
    return [];
  }
}

// funcion para guardar un arreglo en un archivo json (con formato)
function guardarArregloJson(filePath, data) {
  try {
    // Asegurarse que el directorio existe
    const dirPath = path.dirname(filePath);
    asegurarDirectorio(dirPath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error al guardar archivo JSON ${filePath}:`, e.message);
    throw e; // Relanzar el error para que se pueda manejar más arriba
  }
}

// funcion para obtener la extension desde el mimetype
function obtenerExtensionDesdeMime(mime) {
  if (!mime) return 'bin';
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  return map[mime] || 'bin';
}

// funcion para calcular hash sha256 de un buffer
function calcularHashSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// funcion para calcular pHash (perceptual hash) en formato hexadecimal
async function calcularPHashHex(buffer) {
  try {
    const img = await Jimp.read(buffer);
    // Jimp.hash() devuelve un hash perceptual; por defecto longitud ~64 bits representado en hex
    // Devolvemos tal cual para comparaciones por distancia Hamming
    return img.hash();
  } catch (e) {
    console.error('Error al generar pHash para imagen:', e.message);
    return null; // Devolver null en caso de error para poder manejarlo adecuadamente
  }
}

// funcion para calcular la distancia de Hamming entre dos hashes hexadecimales
function distanciaHammingHex(hexA, hexB) {
  const a = Buffer.from(String(hexA || ''), 'hex');
  const b = Buffer.from(String(hexB || ''), 'hex');
  const len = Math.min(a.length, b.length);
  let dist = 0;
  for (let i = 0; i < len; i++) {
    let x = a[i] ^ b[i];
    // popcount 8 bits
    x = x - ((x >>> 1) & 0x55);
    x = (x & 0x33) + ((x >>> 2) & 0x33);
    dist += (((x + (x >>> 4)) & 0x0F) * 0x01) & 0xFF;
  }
  // contar bytes sobrantes como diferencia total (opcional); aquí ignoramos para evitar sesgos de longitud
  return dist;
}

// funcion para guardar una imagen de solicitud del usuario
async function guardarImagenDeSolicitud(chatId, media, caption) {
  try {
    if (!media || !media.data) {
      throw new Error('No se proporcionaron datos de media válidos');
    }
    
    // Asegurar directorios
    asegurarDirectorio(DATA_DIR);
    asegurarDirectorio(SOLICITUDES_DIR);
    
    const timestamp = Date.now();
    const ext = obtenerExtensionDesdeMime(media.mimetype);
    const nombre = `${timestamp}_${sanearId(chatId)}.${ext}`;
    const ruta = path.join(SOLICITUDES_DIR, nombre);
    
    // Convertir y guardar imagen
    const buffer = Buffer.from(media.data, 'base64');
    fs.writeFileSync(ruta, buffer);
    
    // Calcular hashes
    const hash = calcularHashSha256(buffer);
    const phash = await calcularPHashHex(buffer);

    // Guardar metadata
    const solicitudes = cargarArregloJson(SOLICITUDES_JSON);
    const meta = {
      id: `sol_${timestamp}`,
      chatId,
      timestamp,
      ruta,
      mimetype: media.mimetype,
      hash,
      phash,
      caption: caption || ''
    };
    solicitudes.push(meta);
    guardarArregloJson(SOLICITUDES_JSON, solicitudes);
    
    return meta;
  } catch (error) {
    console.error('Error al guardar imagen de solicitud:', error);
    throw error; // Re-lanzar para manejar en el nivel superior
  }
}

// funcion para guardar una imagen en el catálogo (admin)
async function guardarImagenEnCatalogo(etiqueta, chatId, media, caption) {
  try {
    if (!etiqueta) {
      throw new Error('Se requiere una etiqueta para la imagen del catálogo');
    }
    if (!media || !media.data) {
      throw new Error('No se proporcionaron datos de media válidos');
    }
    
    // Asegurar directorios
    asegurarDirectorio(DATA_DIR);
    asegurarDirectorio(CATALOGO_DIR);
    
    const timestamp = Date.now();
    const ext = obtenerExtensionDesdeMime(media.mimetype);
    const nombre = `${timestamp}_${slug(etiqueta)}.${ext}`;
    const ruta = path.join(CATALOGO_DIR, nombre);
    
    // Convertir y guardar imagen
    const buffer = Buffer.from(media.data, 'base64');
    fs.writeFileSync(ruta, buffer);
    
    // Calcular hashes
    const hash = calcularHashSha256(buffer);
    const phash = await calcularPHashHex(buffer);
    
    // Guardar metadata
    const catalogo = cargarArregloJson(CATALOGO_JSON);
    const meta = {
      id: `cat_${timestamp}`,
      etiqueta,
      chatId,
      timestamp,
      ruta,
      mimetype: media.mimetype,
      hash,
      phash,
      caption: caption || ''
    };
    catalogo.push(meta);
    guardarArregloJson(CATALOGO_JSON, catalogo);
    
    return meta;
  } catch (error) {
    console.error('Error al guardar imagen en catálogo:', error);
    throw error; // Re-lanzar para manejar en el nivel superior
  }
}

// funcion para buscar coincidencia exacta por hash en el catalogo
function buscarCoincidenciaExactaPorHash(hash) {
  const catalogo = cargarArregloJson(CATALOGO_JSON);
  return catalogo.find((item) => item.hash === hash) || null;
}

// funcion para buscar la mejor coincidencia por pHash segun umbral
function buscarCoincidenciaPorPHash(phash, umbral = PHASH_MAX_DISTANCE) {
  const catalogo = cargarArregloJson(CATALOGO_JSON);
  let mejor = null;
  let mejorDist = Infinity;

  // Validar que phash sea un valor válido
  if (!phash) {
    console.warn('Se intentó buscar con un phash vacío o inválido');
    return null;
  }

  for (const item of catalogo) {
    if (!item.phash) continue;
    const d = distanciaHammingHex(phash, item.phash);
    if (d < mejorDist) {
      mejorDist = d;
      mejor = item;
    }
  }
  if (mejor && mejorDist <= umbral) {
    return { item: mejor, distancia: mejorDist, umbral };
  }
  return null;
}

// util: sanear id para nombre de archivo
function sanearId(v) {
  return String(v || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

// util: slug para etiquetas
function slug(v) {
  return String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

/**
 * Elimina imágenes antiguas para optimizar el almacenamiento
 * @param {number} diasAntiguedad - Días de antigüedad para eliminar (por defecto 30)
 * @returns {Object} Resultado con las imágenes eliminadas
 */
async function limpiarImagenesAntiguas(diasAntiguedad = 30) {
  try {
    const tiempoLimite = Date.now() - (diasAntiguedad * 24 * 60 * 60 * 1000);
    let eliminadas = { solicitudes: 0, catalogo: 0 };
    
    // Limpiar solicitudes antiguas
    const solicitudes = cargarArregloJson(SOLICITUDES_JSON);
    const solicitudesActualizadas = solicitudes.filter(item => {
      if (item.timestamp < tiempoLimite) {
        if (fs.existsSync(item.ruta)) {
          try {
            fs.unlinkSync(item.ruta);
            eliminadas.solicitudes++;
            return false;
          } catch (e) {
            console.error(`Error al eliminar archivo ${item.ruta}:`, e.message);
          }
        }
      }
      return true;
    });
    
    if (solicitudes.length !== solicitudesActualizadas.length) {
      guardarArregloJson(SOLICITUDES_JSON, solicitudesActualizadas);
    }
    
    return { eliminadas, status: 'success' };
  } catch (error) {
    console.error('Error al limpiar imágenes antiguas:', error);
    return { 
      status: 'error', 
      message: error.message,
      eliminadas: { solicitudes: 0, catalogo: 0 }
    };
  }
}

/**
 * Obtiene estadísticas del almacenamiento de imágenes
 * @returns {Object} Estadísticas de imágenes
 */
function obtenerEstadisticasImagenes() {
  try {
    const solicitudes = cargarArregloJson(SOLICITUDES_JSON);
    const catalogo = cargarArregloJson(CATALOGO_JSON);
    
    let tamanoTotalSolicitudes = 0;
    let tamanoTotalCatalogo = 0;
    
    // Calcular tamaño de archivos de solicitudes
    solicitudes.forEach(item => {
      if (fs.existsSync(item.ruta)) {
        try {
          const stats = fs.statSync(item.ruta);
          tamanoTotalSolicitudes += stats.size;
        } catch (e) {}
      }
    });
    
    // Calcular tamaño de archivos de catálogo
    catalogo.forEach(item => {
      if (fs.existsSync(item.ruta)) {
        try {
          const stats = fs.statSync(item.ruta);
          tamanoTotalCatalogo += stats.size;
        } catch (e) {}
      }
    });
    
    return {
      solicitudes: {
        cantidad: solicitudes.length,
        tamanoTotal: tamanoTotalSolicitudes,
        tamanoMB: Math.round(tamanoTotalSolicitudes / (1024 * 1024) * 100) / 100
      },
      catalogo: {
        cantidad: catalogo.length,
        tamanoTotal: tamanoTotalCatalogo,
        tamanoMB: Math.round(tamanoTotalCatalogo / (1024 * 1024) * 100) / 100
      },
      total: {
        cantidad: solicitudes.length + catalogo.length,
        tamanoTotal: tamanoTotalSolicitudes + tamanoTotalCatalogo,
        tamanoMB: Math.round((tamanoTotalSolicitudes + tamanoTotalCatalogo) / (1024 * 1024) * 100) / 100
      }
    };
  } catch (error) {
    console.error('Error al obtener estadísticas de imágenes:', error);
    return { error: error.message };
  }
}

module.exports = {
  guardarImagenDeSolicitud,
  guardarImagenEnCatalogo,
  buscarCoincidenciaExactaPorHash,
  buscarCoincidenciaPorPHash,
  limpiarImagenesAntiguas,
  obtenerEstadisticasImagenes
};


