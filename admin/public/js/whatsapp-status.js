// Función para cargar el estado de WhatsApp
function loadWhatsappStatus() {
    const timestamp = new Date().toLocaleTimeString();
    // Ya no mostramos spinner de carga, para evitar confusiones
    // El connectionStatus está oculto por diseño y utilizamos manualStatus
    
    fetch('/admin/api/whatsapp/status', { credentials: 'same-origin' })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Marcar que hemos cargado el estado al menos una vez
            window.whatsappStatusLoaded = true;
            
            // Verificación crítica: comprobar si el estado es válido
            if (!data || typeof data !== 'object' || !data.status) {
                console.error(`[${timestamp}] Los datos recibidos no tienen un estado válido:`, data);
                throw new Error('Datos de respuesta inválidos');
            }
            
            // Mostrar información importante en la consola
            console.log(`[${timestamp}] Estado: ${data.status} | QR disponible: ${data.hasQrCode}`);
            console.log(`[${timestamp}] Última actualización: ${new Date(data.lastUpdate).toLocaleString()}`);
            
            // Verificar que la última actualización no sea muy antigua
            const lastUpdateTime = new Date(data.lastUpdate).getTime();
            const now = new Date().getTime();
            const timeDiff = (now - lastUpdateTime) / 1000 / 60; // diferencia en minutos
            
            if (timeDiff > 5) {
                console.warn(`[${timestamp}] La información de estado es antigua (${Math.round(timeDiff)} minutos)`);
                // Añadir advertencia al objeto de datos
                data.warning = `Información de estado antigua (${Math.round(timeDiff)} minutos)`;
            }
            
            updateWhatsappStatusUI(data);
            
            // Si el estado es 'connecting' o 'disconnected', verificar si hay un QR disponible
            if (data.status === 'connecting' || data.status === 'disconnected') {
                if (data.hasQrCode) {
                    console.log(`[${timestamp}] QR disponible, verificando...`);
                    checkForQR();
                } else {
                    console.log(`[${timestamp}] No hay QR disponible`);
                    // Si está en estado connecting por más de 30 segundos sin QR, sugerir reinicio
                    if (data.status === 'connecting' && timeDiff > 0.5) {
                        showAlert('warning', 'La conexión está tardando más de lo esperado. Intente reiniciar el cliente.');
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error al obtener el estado de WhatsApp:', error);
            document.getElementById('connectionStatus').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle-fill"></i> Error al obtener el estado: ${error.message}
                </div>
            `;
        });
}

// Función para actualizar la UI de estado de WhatsApp
function updateWhatsappStatusUI(data) {
    const statusElement = document.getElementById('connectionStatus');
    const qrContainer = document.getElementById('qrCodeContainer');
    const qrPlaceholder = document.getElementById('qrPlaceholder');
    const qrCode = document.getElementById('qrCode');
    
    if (!statusElement) {
        console.error('Elemento connectionStatus no encontrado en el DOM');
        return;
    }
    
    if (!qrContainer || !qrPlaceholder || !qrCode) {
        console.error('Elementos de QR no encontrados en el DOM');
        return;
    }
    
    // El elemento connectionStatus ahora está oculto (display: none),
    // ya que estamos usando el manualStatus para mostrar el estado
    
    // Configuración del QR según el estado
    if (data.status === 'ready' || data.status === 'authenticated') {
        qrContainer.classList.add('d-none');
        console.log(`✅ Estado ${data.status.toUpperCase()} configurado - QR oculto`);
    } else {
        qrContainer.classList.remove('d-none');
        console.log(`⚠️ Estado ${data.status.toUpperCase()} configurado - QR visible`);
        
        // Mostrar QR si está disponible
        if (data.hasQrCode) {
            qrPlaceholder.classList.add('d-none');
            qrCode.classList.remove('d-none');
            
            if (qrCode.innerHTML.trim() === '') {
                console.log('Solicitando el código QR...');
                checkForQR();
            }
        } else {
            qrPlaceholder.classList.remove('d-none');
            qrCode.classList.add('d-none');
        }
    }
    
    // Agregar un atributo de datos con el estado actual
    statusElement.setAttribute('data-status', data.status);
    
    // Si está desconectado o en proceso de conexión, mostrar el contenedor de QR
    if (data.status === 'disconnected' || data.status === 'connecting' || data.status === 'auth_failure') {
        qrContainer.classList.remove('d-none');
        
        if (data.hasQrCode) {
            console.log('Mostrando QR existente');
            qrPlaceholder.classList.add('d-none');
            qrCode.classList.remove('d-none');
            
            // Verificar si ya tiene un QR generado
            if (qrCode.innerHTML.trim() === '') {
                console.log('Solicitando el código QR...');
                checkForQR();
            }
        } else {
            console.log('Mostrando placeholder de QR');
            qrPlaceholder.classList.remove('d-none');
            qrCode.classList.add('d-none');
        }
    } else {
        console.log('Ocultando contenedor de QR porque el estado es:', data.status);
        qrContainer.classList.add('d-none');
    }
}

// Función para obtener el QR
function checkForQR() {
    console.log('Verificando código QR...');
    fetch('/admin/api/whatsapp/qr', { credentials: 'same-origin' })
        .then(response => {
            console.log('Respuesta del servidor QR:', response.status);
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Respuesta de QR:', JSON.stringify(data));
            if (data.success && data.qrCode) {
                const qrPlaceholder = document.getElementById('qrPlaceholder');
                const qrCode = document.getElementById('qrCode');
                
                if (!qrPlaceholder || !qrCode) {
                    console.error('Elementos de QR no encontrados en el DOM');
                    return;
                }
                
                qrPlaceholder.classList.add('d-none');
                qrCode.classList.remove('d-none');
                
                try {
                    // Usar una librería para generar el QR en HTML
                    qrCode.innerHTML = '';
                    new QRCode(qrCode, {
                        text: data.qrCode,
                        width: 256,
                        height: 256,
                        colorDark: '#000000',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.H
                    });
                    
                    showAlert('success', 'Código QR generado. Escanéelo con WhatsApp.');
                } catch (qrError) {
                    console.error('Error al generar QR:', qrError);
                    qrCode.innerHTML = '<p class="text-danger">Error al generar QR. Vuelva a intentarlo.</p>';
                    showAlert('danger', 'Error al generar el código QR');
                }
            } else {
                console.log('No hay código QR disponible');
                showAlert('warning', 'No hay código QR disponible en este momento.');
            }
        })
        .catch(error => {
            console.error('Error al obtener el código QR:', error);
            showAlert('danger', `Error al obtener el código QR: ${error.message}`);
        });
}

// Función para reiniciar WhatsApp
function restartWhatsapp(e) {
    if (e) e.preventDefault();
    if (confirm('¿Está seguro que desea reiniciar la conexión de WhatsApp?')) {
    fetch('/admin/api/whatsapp/restart', { method: 'POST', credentials: 'same-origin' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('success', 'Conexión de WhatsApp reiniciada');
                    setTimeout(loadWhatsappStatus, 2000);
                } else {
                    showAlert('danger', data.message || 'Error al reiniciar WhatsApp');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert('danger', 'Error al reiniciar la conexión');
            });
    }
}

// Función para cerrar sesión de WhatsApp
async function logoutWhatsapp(e) {
    // Prevenir comportamiento por defecto si es un evento
    if (e) e.preventDefault();
    
    if (confirm('¿Está seguro que desea cerrar la sesión de WhatsApp? Necesitará escanear el código QR nuevamente para volver a conectarse.')) {
        try {
            showAlert('info', 'Cerrando sesión de WhatsApp...');
            
            const response = await fetch('/admin/api/whatsapp/logout', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            let data = null;
            try { data = await response.json(); } catch (e) { data = { success: false, message: 'Respuesta inválida del servidor' }; }

            if (response.ok && data && data.success) {
                showAlert('success', 'Sesión de WhatsApp cerrada correctamente');
                
                // Esperar un momento y actualizar el estado
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Actualizar el estado
                await loadWhatsappStatus();
                
                // Mostrar el contenedor del QR
                const qrContainer = document.getElementById('qrCodeContainer');
                if (qrContainer) {
                    qrContainer.classList.remove('d-none');
                }
                
                // Esperar a que aparezca el nuevo QR
                let attempts = 0;
                const checkForQRInterval = setInterval(async () => {
                    attempts++;
                    await checkForQR();
                    
                    // Si después de 10 intentos no hay QR, detener
                    if (attempts >= 10) {
                        clearInterval(checkForQRInterval);
                        showAlert('warning', 'Por favor, recargue la página si no ve el código QR');
                    }
                }, 2000);
                
                // Detener el intervalo después de 20 segundos
                setTimeout(() => clearInterval(checkForQRInterval), 20000);
            } else {
                const msg = data && data.message ? data.message : `Error HTTP ${response.status}`;
                showAlert('danger', msg || 'Error al cerrar sesión');
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('danger', 'Error al cerrar la sesión');
        }
    }
}

// Función auxiliar para formatear fechas
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
}

// Función auxiliar para mostrar el estado en español
function getStatusLabel(status) {
    const labels = {
        'disconnected': 'Desconectado',
        'connecting': 'Conectando...',
        'authenticated': 'Autenticado',
        'ready': 'Conectado',
        'auth_failure': 'Error de autenticación'
    };
    return labels[status] || status;
}

// Función para mostrar información de depuración
function showDebugInfo(e) {
    if (e) e.preventDefault();
    fetch('/admin/api/whatsapp/debug')
        .then(response => response.json())
        .then(data => {
            console.log('Información de depuración:', data);
            
            // Crear un modal con la información
            const modalHTML = `
                <div class="modal fade" id="debugModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Información de Depuración</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <pre class="bg-light p-3" style="max-height: 400px; overflow: auto;">${JSON.stringify(data, null, 2)}</pre>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Añadir el modal al DOM
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHTML;
            document.body.appendChild(modalContainer);
            
            // Mostrar el modal
            const modal = new bootstrap.Modal(document.getElementById('debugModal'));
            modal.show();
            
            // Eliminar el modal del DOM cuando se oculte
            document.getElementById('debugModal').addEventListener('hidden.bs.modal', function() {
                document.body.removeChild(modalContainer);
            });
        })
        .catch(error => {
            console.error('Error al obtener información de depuración:', error);
            showAlert('danger', 'Error al obtener información de depuración');
        });
}

// Inicializar cuando el documento esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('[🔧] Inicializando whatsapp-status.js...');
    
    // Verificar si tenemos el sistema unificado de botones
    if (window.whatsappTools) {
        console.log('[✅] Sistema unificado de WhatsApp detectado, omitiendo configuración de botones en whatsapp-status.js');
    } else {
        console.log('[⚠️] Sistema unificado de WhatsApp NO detectado, configurando botones desde whatsapp-status.js');
        console.log('[🔍] ADVERTENCIA: El sistema unificado debería estar cargado antes. Verificar orden de carga de scripts.');
        
        // Imprimir debug de botones
        console.log('[🔍] Buscando botones en el DOM desde whatsapp-status.js:');
        ['btnCheckForQR', 'btnRestartWhatsapp', 'btnLogoutWhatsapp', 'btnRefreshStatus', 'btnDebugInfo'].forEach(id => {
            const el = document.getElementById(id);
            console.log(`[${el ? '✓' : '❌'}] Elemento ${id}: ${el ? 'Encontrado' : 'NO encontrado'}`);
        });
        
        // Configurar los eventos de los botones solo si no está el sistema unificado
        setTimeout(function() {
            console.log('[⏱️] Configurando botones después de espera en whatsapp-status.js');
            
            // Intentar configurar todos los botones en el dropdown
            const dropdownItems = document.querySelectorAll('.dropdown-menu .dropdown-item');
            console.log(`[🔢] Elementos dropdown encontrados: ${dropdownItems.length}`);
            
            dropdownItems.forEach(item => {
                const text = item.innerText.trim();
                console.log(`[📝] Configurando elemento dropdown: ${text}`);
                
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log(`[👆] Clic en elemento dropdown: ${text}`);
                    
                    if (text.includes('Reiniciar')) {
                        restartWhatsapp(e);
                    } else if (text.includes('Cerrar Sesión')) {
                        logoutWhatsapp(e);
                    } else if (text.includes('Depuración')) {
                        showDebugInfo(e);
                    }
                });
            });
        }, 1000);
    }
    
    // Cargar el estado inicial
    loadWhatsappStatus();
    
    // Configurar la actualización automática - actualizamos cada 3 segundos
    setInterval(loadWhatsappStatus, 3000);
    
    console.log('[✅] WhatsApp Status JS inicializado - Versión 3.1');
});
