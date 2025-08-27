'use strict';

/**
 * Utilidad para forzar la regeneración del código QR
 * 
 * Este script se utiliza para forzar la regeneración del código QR cuando
 * hay problemas con la sesión, como el estado UNPAIRED o errores de RegistrationUtils
 */

const path = require('path');

// Importar servicio de estado de WhatsApp
const whatsappStatus = require('../services/whatsappStatus.service');

// Función principal
async function forceQrRegeneration() {
    console.log('🔄 Iniciando utilidad para forzar regeneración de QR');
    
    try {
        // Obtener información del cliente actual
        const clientInfo = whatsappStatus.getClientInitializationStatus();
        
        if (!clientInfo.hasClient) {
            console.error('❌ No hay cliente disponible');
            process.exit(1);
        }
        
        console.log('ℹ️ Estado actual:', clientInfo.currentStatus.status);
        console.log('ℹ️ Cliente inicializado:', clientInfo.hasMethods ? 'Sí' : 'No');
        
        // Forzar reinicio con sesión limpia
        console.log('🧹 Iniciando reinicio con sesión limpia...');
        const result = await whatsappStatus.reiniciarClienteConSesionLimpia();
        
        if (result) {
            console.log('✅ Reinicio con sesión limpia completado');
            console.log('⏳ Espere unos momentos para que se genere el nuevo código QR');
            
            // Esperar un momento para que se genere el QR
            setTimeout(() => {
                console.log('🔍 Verificando si se generó un nuevo QR...');
                const statusInfo = whatsappStatus.getStatusInfo();
                
                if (statusInfo.hasQrCode && statusInfo.qrCode) {
                    console.log('✅ Nuevo código QR generado correctamente');
                    console.log(`⏱️ Generado a las: ${new Date(statusInfo.qrTimestamp || statusInfo.lastUpdate).toLocaleString()}`);
                    process.exit(0);
                } else {
                    console.log('❌ No se pudo generar un nuevo QR. Intente de nuevo en unos momentos.');
                    process.exit(1);
                }
            }, 10000);
        } else {
            console.error('❌ No se pudo reiniciar con sesión limpia');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error al forzar regeneración de QR:', error);
        process.exit(1);
    }
}

// Ejecutar la función principal
forceQrRegeneration();
