/**
 * WhatsApp Controls - Sistema unificado para manejar todas las acciones de WhatsApp
 * 
 * Este archivo consolida todas las funciones relacionadas con el control de WhatsApp en un solo lugar,
 * eliminando la duplicación de código y mejorando la mantenibilidad.
 */

// Inicialización del sistema
console.log('[🚀] Inicializando sistema de controles de WhatsApp...');

// Función compartida para mostrar mensaje de estado
function showStatusMessage(type, message) {
  const manualStatus = document.getElementById('manualStatus');
  if (!manualStatus) {
    console.warn('[⚠️] Elemento manualStatus no encontrado');
    return;
  }
  
  let icon = 'info-circle';
  if (type === 'success') icon = 'check-circle-fill';
  else if (type === 'warning') icon = 'clock';
  else if (type === 'danger') icon = 'exclamation-triangle-fill';
  
  manualStatus.innerHTML = `
    <div class="alert alert-${type}">
      <i class="bi bi-${icon}"></i> ${message}
    </div>
  `;
}

/**
 * Cierra la sesión de WhatsApp
 */
async function logoutWhatsapp(e) {
  if (e) e.preventDefault();
  
  console.log('[🔑] Iniciando proceso de cierre de sesión de WhatsApp');
  
  if (!confirm('¿Está seguro que desea cerrar la sesión de WhatsApp? Necesitará escanear el código QR nuevamente para volver a conectarse.')) {
    console.log('[🔑] Cierre de sesión cancelado por el usuario');
    return;
  }
  
  try {
    // 1. Mostrar mensaje de espera
    showStatusMessage('warning', 'Cerrando sesión de WhatsApp...');
    
    // 2. Realizar la petición al servidor
    console.log('[🔑] Enviando petición al servidor');
    const response = await fetch('/admin/api/whatsapp/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // 3. Analizar la respuesta
    console.log('[🔑] Respuesta recibida, status:', response.status);
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('[🔑] Error al parsear la respuesta JSON:', parseError);
      data = { success: false, message: 'Formato de respuesta inválido' };
    }
    
    // 4. Manejar el resultado
    if (data && data.success) {
      // Éxito al cerrar sesión
      showStatusMessage('success', 'Sesión cerrada correctamente. Actualizando...');
      
      // 5. Mostrar el contenedor del QR
      const qrContainer = document.getElementById('qrCodeContainer');
      if (qrContainer) {
        qrContainer.classList.remove('d-none');
      }
      
      // 6. Esperar un momento y actualizar la página
      console.log('[🔑] Esperando 3 segundos antes de recargar...');
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } else {
      // Error al cerrar sesión
      const errorMsg = data && data.message ? data.message : 'Error desconocido';
      showStatusMessage('danger', `Error al cerrar sesión: ${errorMsg}`);
    }
  } catch (error) {
    // Error de conexión
    console.error('[🔑] Error de conexión:', error);
    showStatusMessage('danger', 'Error de conexión al intentar cerrar sesión');
  }
}

/**
 * Reinicia la conexión de WhatsApp
 */
async function restartWhatsapp(e) {
  if (e) e.preventDefault();
  
  console.log('[🔄] Iniciando proceso de reinicio de WhatsApp');
  
  if (!confirm('¿Está seguro que desea reiniciar la conexión de WhatsApp?')) {
    console.log('[🔄] Reinicio cancelado por el usuario');
    return;
  }
  
  try {
    // 1. Mostrar mensaje de espera
    showStatusMessage('warning', 'Reiniciando la conexión de WhatsApp...');
    
    // 2. Realizar la petición al servidor
    console.log('[🔄] Enviando petición al servidor');
    const response = await fetch('/admin/api/whatsapp/restart', {
      method: 'POST',
      credentials: 'same-origin'
    });
    
    // 3. Analizar la respuesta
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('[🔄] Error al parsear la respuesta JSON:', parseError);
      data = { success: false, message: 'Formato de respuesta inválido' };
    }
    
    // 4. Manejar el resultado
    if (data && data.success) {
      // Éxito al reiniciar
      showStatusMessage('success', 'Conexión reiniciada correctamente.');
      
      // 5. Esperar un momento y actualizar la página
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } else {
      // Error al reiniciar
      const errorMsg = data && data.message ? data.message : 'Error desconocido';
      showStatusMessage('danger', `Error al reiniciar: ${errorMsg}`);
    }
  } catch (error) {
    // Error de conexión
    console.error('[🔄] Error de conexión:', error);
    showStatusMessage('danger', 'Error de conexión al intentar reiniciar');
  }
}

/**
 * Muestra información de depuración
 */
function showDebugInfo(e) {
  if (e) e.preventDefault();
  
  console.log('[🐞] Solicitando información de depuración');
  showStatusMessage('info', 'Cargando información de depuración...');
  
  fetch('/admin/api/whatsapp/debug')
    .then(response => response.json())
    .then(data => {
      console.log('[🐞] Información recibida');
      
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
      
      // Limpiar el mensaje de estado
      showStatusMessage('success', 'Información de depuración cargada');
    })
    .catch(error => {
      console.error('[🐞] Error al obtener información:', error);
      showStatusMessage('danger', 'Error al obtener información de depuración');
    });
}

/**
 * Función para configurar botones de forma robusta
 */
function setupButtonWithId(elementId, handler) {
  console.log(`[🔎] Buscando elemento con ID: ${elementId}`);
  const element = document.getElementById(elementId);
  
  if (element) {
    console.log(`[✓] Elemento encontrado: ${elementId}`);
    
    // Configurar evento
    element.addEventListener('click', handler);
    element.setAttribute('data-configured', 'true');
    
    return true;
  } 
  
  console.warn(`[❌] Elemento no encontrado: ${elementId}`);
  return false;
}

/**
 * Configura todos los botones de WhatsApp en el documento
 */
function configureAllButtons() {
  console.log('[🔧] Configurando todos los botones de WhatsApp...');
  
  // 1. Configurar por ID (método principal)
  const buttonSetup = [
    {id: 'btnLogoutWhatsapp', handler: logoutWhatsapp, label: 'Cerrar Sesión'},
    {id: 'btnRestartWhatsapp', handler: restartWhatsapp, label: 'Reiniciar'},
    {id: 'btnDebugInfo', handler: showDebugInfo, label: 'Depuración'},
    {id: 'btnRefreshStatus', handler: (e) => { 
      e.preventDefault(); 
      showStatusMessage('info', 'Actualizando estado...'); 
      window.location.reload(); 
    }, label: 'Refrescar'}
  ];
  
  // Configurar cada botón por ID
  buttonSetup.forEach(btn => {
    setupButtonWithId(btn.id, btn.handler);
  });
  
  // 2. Configurar por selector de texto (método alternativo)
  document.querySelectorAll('.dropdown-menu .dropdown-item').forEach(item => {
    const text = item.innerText.trim();
    
    if (text.includes('Cerrar Sesión')) {
      item.addEventListener('click', logoutWhatsapp);
    } else if (text.includes('Reiniciar')) {
      item.addEventListener('click', restartWhatsapp);
    } else if (text.includes('Depuración') || text.includes('Debug')) {
      item.addEventListener('click', showDebugInfo);
    }
  });
  
  console.log('[✅] Configuración de botones completada');
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  // Esperar un momento para asegurarnos que todo el DOM está completamente cargado
  setTimeout(() => {
    configureAllButtons();
    
    // Exponer funciones globalmente para acceso desde otras partes
    window.whatsappTools = {
      logout: logoutWhatsapp,
      restart: restartWhatsapp,
      debug: showDebugInfo,
      showStatus: showStatusMessage
    };
  }, 500);
});
