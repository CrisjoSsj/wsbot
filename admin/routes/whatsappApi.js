const express = require('express');
const router = express.Router();

const whatsappStatus = require('../../services/whatsappStatus.service');

// Ruta para cerrar sesión - delega en whatsappStatus.logout()
router.post('/logout', async (req, res) => {
    try {
        console.log('[WhatsApp API] Solicitud de cierre de sesión recibida');
        const result = await whatsappStatus.logout();
        if (result) {
            console.log('[WhatsApp API] Sesión cerrada correctamente');
            return res.json({ success: true, message: 'Sesión cerrada correctamente' });
        }
        console.log('[WhatsApp API] No se pudo cerrar la sesión');
        return res.status(500).json({ success: false, message: 'No se pudo cerrar la sesión de WhatsApp' });
    } catch (error) {
        console.error('[WhatsApp API] Error al cerrar sesión:', error);
        return res.status(500).json({ success: false, message: 'Error al cerrar sesión: ' + error.message });
    }
});

// Ruta para reiniciar el cliente de WhatsApp
router.post('/restart', async (req, res) => {
    try {
        console.log('[WhatsApp API] Solicitud de reinicio recibida');
        const result = whatsappStatus.restartClient();
        if (result) {
            console.log('[WhatsApp API] Cliente de WhatsApp reiniciado correctamente');
            return res.json({ success: true, message: 'Cliente de WhatsApp reiniciado correctamente' });
        }
        console.log('[WhatsApp API] No se pudo reiniciar el cliente');
        return res.status(500).json({ success: false, message: 'No se pudo reiniciar el cliente de WhatsApp' });
    } catch (error) {
        console.error('[WhatsApp API] Error al reiniciar el cliente:', error);
        return res.status(500).json({ success: false, message: 'Error al reiniciar el cliente: ' + error.message });
    }
});

// Ruta para reiniciar el cliente de WhatsApp con limpieza de sesión
router.post('/restart-clean', async (req, res) => {
    try {
        console.log('[WhatsApp API] Solicitud de reinicio con limpieza de sesión recibida');
        
        if (!whatsappStatus.reiniciarClienteConSesionLimpia) {
            console.error('[WhatsApp API] La función reiniciarClienteConSesionLimpia no está definida');
            return res.status(500).json({ 
                success: false, 
                message: 'Función de reinicio con limpieza de sesión no disponible' 
            });
        }
        
        const result = await whatsappStatus.reiniciarClienteConSesionLimpia();
        if (result) {
            console.log('[WhatsApp API] Cliente de WhatsApp reiniciado con limpieza de sesión correctamente');
            return res.json({ 
                success: true, 
                message: 'Cliente de WhatsApp reiniciado con limpieza de sesión correctamente' 
            });
        }
        
        console.log('[WhatsApp API] No se pudo reiniciar el cliente con limpieza');
        return res.status(500).json({ 
            success: false, 
            message: 'No se pudo reiniciar el cliente de WhatsApp con limpieza de sesión' 
        });
    } catch (error) {
        console.error('[WhatsApp API] Error al reiniciar el cliente con limpieza:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error al reiniciar el cliente con limpieza: ' + error.message 
        });
    }
});

// Ruta para obtener información de depuración de WhatsApp
router.get('/debug', (req, res) => {
    try {
        console.log('[WhatsApp API] Solicitud de información de depuración recibida');
        const statusInfo = whatsappStatus.getStatusInfo();
        const clientInfo = whatsappStatus.getClientInitializationStatus();
        
        // Crear objeto con información de depuración
        const debugInfo = {
            timestamp: new Date().toISOString(),
            statusInfo: { 
                ...statusInfo,
                // No enviar el código QR en la respuesta para evitar problemas de seguridad
                qrCode: statusInfo.qrCode ? `[QR disponible: ${statusInfo.qrCode.length} caracteres]` : null
            },
            clientInfo,
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime()
            }
        };
        
        console.log('[WhatsApp API] Información de depuración enviada');
        return res.json(debugInfo);
    } catch (error) {
        console.error('[WhatsApp API] Error al obtener información de depuración:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener información de depuración: ' + error.message });
    }
});

// Ruta para obtener el estado de WhatsApp
router.get('/status', (req, res) => {
    try {
        const statusInfo = whatsappStatus.getStatusInfo();
        // No enviar el código QR completo en el status
        const { qrCode, ...safeStatus } = statusInfo;
        return res.json(safeStatus);
    } catch (error) {
        console.error('[WhatsApp API] Error al obtener estado:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener estado: ' + error.message });
    }
});

// Ruta para obtener el código QR
router.get('/qr', (req, res) => {
    try {
        const qrCode = whatsappStatus.getQrCode();
        if (qrCode) {
            return res.json({ success: true, qrCode });
        }
        return res.json({ success: false, message: 'No hay código QR disponible' });
    } catch (error) {
        console.error('[WhatsApp API] Error al obtener QR:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener QR: ' + error.message });
    }
});

module.exports = router;
