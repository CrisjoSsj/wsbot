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
  } catch (_e) {
    return [];
  }
}

// funcion para guardar un arreglo en un archivo json (con formato)
function guardarArregloJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
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
  const img = await Jimp.read(buffer);
  // Jimp.hash() devuelve un hash perceptual; por defecto longitud ~64 bits representado en hex
  // Devolvemos tal cual para comparaciones por distancia Hamming
  return img.hash();
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
  asegurarDirectorio(DATA_DIR);
  asegurarDirectorio(SOLICITUDES_DIR);
  const timestamp = Date.now();
  const ext = obtenerExtensionDesdeMime(media.mimetype);
  const nombre = `${timestamp}_${sanearId(chatId)}.${ext}`;
  const ruta = path.join(SOLICITUDES_DIR, nombre);
  const buffer = Buffer.from(media.data, 'base64');
  fs.writeFileSync(ruta, buffer);
  const hash = calcularHashSha256(buffer);
  const phash = await calcularPHashHex(buffer);

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
}

// funcion para guardar una imagen en el catálogo (admin)
async function guardarImagenEnCatalogo(etiqueta, chatId, media, caption) {
  asegurarDirectorio(DATA_DIR);
  asegurarDirectorio(CATALOGO_DIR);
  const timestamp = Date.now();
  const ext = obtenerExtensionDesdeMime(media.mimetype);
  const nombre = `${timestamp}_${slug(etiqueta)}.${ext}`;
  const ruta = path.join(CATALOGO_DIR, nombre);
  const buffer = Buffer.from(media.data, 'base64');
  fs.writeFileSync(ruta, buffer);
  const hash = calcularHashSha256(buffer);
  const phash = await calcularPHashHex(buffer);

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
}

// funcion para buscar coincidencia exacta por hash en el catalogo
function buscarCoincidenciaExactaPorHash(hash) {
  const catalogo = cargarArregloJson(CATALOGO_JSON);
  return catalogo.find((item) => item.hash === hash) || null;
}

// funcion para buscar la mejor coincidencia por pHash segun umbral
function buscarCoincidenciaPorPHash(phash, umbral = Number(process.env.PHASH_MAX_DISTANCE || 10)) {
  const catalogo = cargarArregloJson(CATALOGO_JSON);
  let mejor = null;
  let mejorDist = Infinity;
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

module.exports = {
  guardarImagenDeSolicitud,
  guardarImagenEnCatalogo,
  buscarCoincidenciaExactaPorHash,
  buscarCoincidenciaPorPHash
};


