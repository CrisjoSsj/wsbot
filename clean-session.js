const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('🧹 Limpiando datos de sesión antiguos...');

// Ruta a la carpeta de autenticación de WhatsApp
const authPath = path.join(__dirname, 'config', 'whatsapp-auth');

// Función para eliminar directorio recursivamente
function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // Recursivamente eliminar subdirectorio
        deleteFolderRecursive(curPath);
      } else {
        // Eliminar archivo
        try {
          fs.unlinkSync(curPath);
          console.log(`✓ Archivo eliminado: ${curPath}`);
        } catch (err) {
          console.error(`❌ Error eliminando archivo ${curPath}:`, err.message);
        }
      }
    });
    
    try {
      fs.rmdirSync(folderPath);
      console.log(`✓ Carpeta eliminada: ${folderPath}`);
    } catch (err) {
      console.error(`❌ Error eliminando carpeta ${folderPath}:`, err.message);
    }
  }
}

// Comprobar si la carpeta existe
if (fs.existsSync(authPath)) {
  console.log(`📁 Encontrada carpeta de autenticación: ${authPath}`);
  console.log('🔄 Eliminando datos antiguos...');
  
  try {
    deleteFolderRecursive(authPath);
    console.log('✅ Datos antiguos eliminados correctamente');
  } catch (error) {
    console.error('❌ Error eliminando datos antiguos:', error.message);
  }
} else {
  console.log('ℹ️ No se encontraron datos antiguos para limpiar');
}

console.log('\n✅ Proceso completado. Ahora ejecuta "npm start" para generar un nuevo código QR.\n');

// En Windows, mantener la consola abierta
if (process.platform === 'win32') {
  console.log('Presiona cualquier tecla para salir...');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', process.exit.bind(process, 0));
}
