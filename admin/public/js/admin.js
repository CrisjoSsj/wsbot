/**
 * Funciones comunes para el panel administrativo
 */

// Función para mostrar alertas
function showAlert(type, message, duration = 5000) {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = 
        message +
        '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';
    alertContainer.appendChild(alertDiv);

    // Auto-cerrar después del tiempo especificado
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => {
            if (alertContainer.contains(alertDiv)) {
                alertContainer.removeChild(alertDiv);
            }
        }, 150);
    }, duration);
}

// Función para cargar contenido dinámico en una sección
function loadContent(url, targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            return response.text();
        })
        .then(html => {
            target.innerHTML = html;
        })
        .catch(error => {
            console.error('Error cargando contenido:', error);
            target.innerHTML = `<div class="alert alert-danger">Error cargando el contenido: ${error.message}</div>`;
        });
}

// Función para confirmar acciones
function confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

// Función para formatear texto con markdown básico
function formatMarkdown(text) {
    if (!text) return '';
    
    // Convertir saltos de línea a <br>
    text = text.replace(/\n/g, '<br>');
    
    // Convertir negrita: *texto* a <strong>texto</strong>
    text = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    
    return text;
}

// Función para abrir/cerrar sidebar en móviles
document.addEventListener('DOMContentLoaded', function() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            document.body.classList.toggle('sidebar-toggled');
            document.querySelector('.sidebar').classList.toggle('toggled');
        });
    }
    
    // Cerrar sidebar en ventanas pequeñas al cargar
    if (window.innerWidth < 768) {
        document.querySelector('.sidebar')?.classList.add('toggled');
    }
    
    // Prevenir que el menú desplegable se cierre al hacer click dentro
    const dropdownMenus = document.querySelectorAll('.dropdown-menu');
    dropdownMenus.forEach(function(dropdown) {
        dropdown.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    });
});
