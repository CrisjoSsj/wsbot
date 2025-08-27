'use strict';

/**
 * Utilidad para gestión de memoria en entornos con recursos limitados
 * Este script implementa un recolector de basura periódico y monitoreo de memoria
 */

// Configuración
const LOW_MEMORY_THRESHOLD_MB = 150; // Umbral de memoria baja en MB
const CRITICAL_MEMORY_THRESHOLD_MB = 80; // Umbral crítico de memoria en MB
const CHECK_INTERVAL = 5 * 60 * 1000; // Verificar cada 5 minutos

// Función para mostrar uso de memoria en formato amigable
function printMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;

    console.log('📊 Uso de memoria:');
    console.log(`RSS: ${formatMemoryUsage(memoryUsage.rss)} | Heap: ${formatMemoryUsage(memoryUsage.heapUsed)}/${formatMemoryUsage(memoryUsage.heapTotal)}`);
    
    // Calcular memoria del sistema (solo funciona en Linux)
    if (process.platform === 'linux') {
        try {
            const fs = require('fs');
            const os = require('os');
            
            const totalMem = os.totalmem() / 1024 / 1024;
            const freeMem = os.freemem() / 1024 / 1024;
            const usedMem = totalMem - freeMem;
            
            console.log(`💻 Memoria del sistema: ${Math.round(usedMem)} MB / ${Math.round(totalMem)} MB (${Math.round(usedMem/totalMem*100)}%)`);
            
            return { free: freeMem, total: totalMem };
        } catch (e) {
            console.log('No se pudo determinar memoria del sistema');
        }
    }
    
    return { free: 0, total: 0 };
}

// Función para forzar recolección de basura
function attemptGarbageCollection() {
    try {
        if (global.gc) {
            console.log('🧹 Forzando recolección de basura...');
            global.gc();
            console.log('✅ Recolección de basura completada');
        } else {
            console.log('⚠️ Recolección de basura no disponible. Ejecute Node.js con --expose-gc');
        }
    } catch (e) {
        console.log('❌ Error al forzar recolección de basura:', e.message);
    }
}

// Función para verificar si hay memoria baja
function checkLowMemory() {
    const memUsage = printMemoryUsage();
    
    // En sistemas Linux podemos verificar la memoria libre del sistema
    if (process.platform === 'linux' && memUsage.free > 0) {
        if (memUsage.free < CRITICAL_MEMORY_THRESHOLD_MB) {
            console.log(`⚠️ ¡ADVERTENCIA! Memoria del sistema criticamente baja: ${Math.round(memUsage.free)} MB libre`);
            attemptGarbageCollection();
            
            // Liberar caché del require
            console.log('🧹 Limpiando caché de módulos...');
            Object.keys(require.cache).forEach(function(key) {
                if (key.indexOf('node_modules') > -1) {
                    delete require.cache[key];
                }
            });
            
            return true;
        } else if (memUsage.free < LOW_MEMORY_THRESHOLD_MB) {
            console.log(`⚠️ Memoria del sistema baja: ${Math.round(memUsage.free)} MB libre`);
            attemptGarbageCollection();
            return true;
        }
    }
    
    return false;
}

// Iniciar monitoreo periódico
function startMemoryMonitoring() {
    console.log('🔍 Iniciando monitoreo de memoria para entorno de recursos limitados');
    printMemoryUsage();
    
    // Verificar si estamos ejecutando con --expose-gc
    if (!global.gc) {
        console.log('⚠️ Para mejor gestión de memoria, ejecute Node.js con: node --expose-gc index.js');
    }
    
    // Configurar verificación periódica
    setInterval(() => {
        const isLow = checkLowMemory();
        if (!isLow) {
            console.log('✅ Nivel de memoria adecuado');
        }
    }, CHECK_INTERVAL);
    
    // También realizar recolección periódica en sistemas con recursos limitados
    if (global.gc) {
        setInterval(() => {
            console.log('🔄 Recolección de basura programada');
            attemptGarbageCollection();
        }, 30 * 60 * 1000); // Cada 30 minutos
    }
}

module.exports = {
    startMemoryMonitoring,
    checkLowMemory,
    attemptGarbageCollection,
    printMemoryUsage
};

// Si se ejecuta directamente, mostrar uso de memoria
if (require.main === module) {
    console.log('Ejecutando diagnóstico de memoria');
    printMemoryUsage();
    attemptGarbageCollection();
}
