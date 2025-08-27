// Script para depurar el estado de WhatsApp
console.log('=== Depurador de Estado de WhatsApp ===');

// Función para mostrar el estado actual en la consola
async function checkStatus() {
  try {
    // Obtener el estado desde el archivo
    const statusFile = await fetch('/admin/api/whatsapp/status')
      .then(res => res.json());
    
    console.log('Estado actual desde API:', statusFile);
    console.log('- Estado:', statusFile.status);
    console.log('- Cliente inicializado:', statusFile.clientInitialized);
    console.log('- Última actualización:', new Date(statusFile.lastUpdate).toLocaleString());
    
    // Actualizar el estado en la interfaz
    updateStatusInUI(statusFile);
    
    return statusFile;
  } catch (error) {
    console.error('Error al verificar estado:', error);
    showError('Error al verificar estado: ' + error.message);
  }
}

// Función para actualizar el estado en la interfaz directamente
function updateStatusInUI(statusData) {
  const statusDisplay = document.getElementById('statusDisplay');
  if (!statusDisplay) {
    console.error('Elemento statusDisplay no encontrado');
    return;
  }
  
  // Crear el HTML con el estado
  let html = `
    <div class="card">
      <div class="card-body">
        <h5 class="card-title">Estado de WhatsApp</h5>
        <p class="card-text">
          <strong>Estado:</strong> <span class="badge ${getStatusBadgeClass(statusData.status)}">${getStatusLabel(statusData.status)}</span><br>
          <strong>Actualizado:</strong> ${new Date(statusData.lastUpdate).toLocaleString()}<br>
          <strong>Cliente inicializado:</strong> ${statusData.clientInitialized ? 'Sí' : 'No'}<br>
        </p>
        <button class="btn btn-primary" onclick="forceRefresh()">Actualizar</button>
        <button class="btn btn-warning ms-2" onclick="restartWhatsapp()">Reiniciar Cliente</button>
      </div>
    </div>
  `;
  
  statusDisplay.innerHTML = html;
}

// Obtener la clase para el badge según el estado
function getStatusBadgeClass(status) {
  switch (status) {
    case 'ready': return 'bg-success';
    case 'authenticated': return 'bg-primary';
    case 'connecting': return 'bg-warning';
    case 'disconnected': return 'bg-danger';
    case 'auth_failure': return 'bg-danger';
    default: return 'bg-secondary';
  }
}

// Obtener etiqueta legible del estado
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

// Forzar actualización del estado
function forceRefresh() {
  showMessage('Actualizando estado...');
  checkStatus();
}

// Reiniciar cliente de WhatsApp
async function restartWhatsapp() {
  if (confirm('¿Está seguro que desea reiniciar la conexión de WhatsApp?')) {
    try {
      showMessage('Reiniciando cliente...');
      await fetch('/admin/api/whatsapp/restart', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            showMessage('Cliente reiniciado correctamente');
            setTimeout(checkStatus, 2000);
          } else {
            showError(data.message || 'Error al reiniciar');
          }
        });
    } catch (error) {
      showError('Error: ' + error.message);
    }
  }
}

// Forzar regeneración del código QR
async function forceQrRegeneration() {
  if (confirm('¿Está seguro que desea forzar la regeneración del código QR?')) {
    try {
      showMessage('Forzando regeneración de código QR...');
      await fetch('/admin/api/whatsapp/force-qr', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            showMessage('Regeneración de QR iniciada. Debería aparecer un nuevo código en breve.');
            setTimeout(checkStatus, 5000); // Esperar un poco más para que se genere el QR
          } else {
            showError(data.message || 'Error al regenerar el código QR');
          }
        });
    } catch (error) {
      showError('Error: ' + error.message);
    }
  }
}

// Mostrar mensaje en la interfaz
function showMessage(message) {
  const messages = document.getElementById('messages');
  if (!messages) return;
  
  const alertDiv = document.createElement('div');
  alertDiv.className = 'alert alert-info alert-dismissible fade show';
  alertDiv.innerHTML = message +
    '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';
  
  messages.appendChild(alertDiv);
  setTimeout(() => alertDiv.remove(), 5000);
}

// Mostrar error en la interfaz
function showError(message) {
  const messages = document.getElementById('messages');
  if (!messages) return;
  
  const alertDiv = document.createElement('div');
  alertDiv.className = 'alert alert-danger alert-dismissible fade show';
  alertDiv.innerHTML = message +
    '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';
  
  messages.appendChild(alertDiv);
  setTimeout(() => alertDiv.remove(), 8000);
}

// Verificar estado al cargar la página
document.addEventListener('DOMContentLoaded', function() {
  console.log('Comprobando estado inicial...');
  checkStatus();
  
  // Actualizar cada 30 segundos (optimizado para reducir carga en servidor)
  setInterval(checkStatus, 30000);
});
