// Archivo principal de JavaScript para el panel administrativo
document.addEventListener('DOMContentLoaded', function() {
    console.log('Panel administrativo inicializado');

    // Sistema de notificaciones mejorado
    window.showAlert = function(type, message, autoDismiss = true, dismissTime = 5000) {
        const alertContainer = document.getElementById('alertContainer') || createAlertContainer();
        const id = 'alert-' + Date.now();

        const alertHTML = `
            <div id="${id}" class="alert alert-${type} alert-dismissible fade show" role="alert">
                <div class="d-flex align-items-center">
                    <i class="bi bi-${getAlertIcon(type)} me-2"></i>
                    <div>${message}</div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        alertContainer.insertAdjacentHTML('afterbegin', alertHTML);
        
        if (autoDismiss) {
            setTimeout(() => {
                const alertElement = document.getElementById(id);
                if (alertElement) {
                    // Usar el sistema de Bootstrap para eliminar la alerta
                    bootstrap.Alert.getOrCreateInstance(alertElement).close();
                }
            }, dismissTime);
        }

        return id;
    };

    function createAlertContainer() {
        const container = document.createElement('div');
        container.id = 'alertContainer';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        container.style.width = '350px';
        document.body.appendChild(container);
        return container;
    }

    function getAlertIcon(type) {
        const icons = {
            'success': 'check-circle-fill',
            'danger': 'exclamation-triangle-fill',
            'warning': 'exclamation-circle-fill',
            'info': 'info-circle-fill'
        };
        return icons[type] || 'info-circle-fill';
    }

    // El tema ahora se gestiona directamente en layout.ejs para garantizar su funcionamiento

    // Efecto de carga para operaciones AJAX
    window.showLoading = function(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('loading');
            element.setAttribute('disabled', true);
            // Guardar el texto original
            const originalText = element.innerHTML;
            element.setAttribute('data-original-text', originalText);
            element.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Cargando...';
        }
    };

    window.hideLoading = function(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('loading');
            element.removeAttribute('disabled');
            // Restaurar el texto original
            const originalText = element.getAttribute('data-original-text');
            if (originalText) {
                element.innerHTML = originalText;
            }
        }
    };

    // Funciones para actualizar datos en tiempo real
    window.updateConfigSection = function(section, data, successCallback, errorCallback) {
        showLoading('saveButton');
        
        fetch(`/admin/api/config/${section}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            hideLoading('saveButton');
            if (result.success) {
                showAlert('success', `Configuración de ${section} actualizada correctamente`);
                if (typeof successCallback === 'function') {
                    successCallback(result);
                }
            } else {
                showAlert('danger', `Error: ${result.error || 'No se pudo guardar la configuración'}`);
                if (typeof errorCallback === 'function') {
                    errorCallback(result);
                }
            }
        })
        .catch(error => {
            hideLoading('saveButton');
            showAlert('danger', `Error: ${error.message}`);
            if (typeof errorCallback === 'function') {
                errorCallback(error);
            }
        });
    };

    // Formato de fecha amigable
    window.formatDate = function(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    // Expandir/colapsar secciones
    const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
    collapsibleHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const target = document.getElementById(this.getAttribute('data-target'));
            if (target) {
                const isCollapsed = target.classList.contains('show');
                
                if (isCollapsed) {
                    target.classList.remove('show');
                    this.querySelector('i.toggle-icon').classList.replace('bi-chevron-up', 'bi-chevron-down');
                } else {
                    target.classList.add('show');
                    this.querySelector('i.toggle-icon').classList.replace('bi-chevron-down', 'bi-chevron-up');
                }
            }
        });
    });

    // Verificar errores en los formularios
    const forms = document.querySelectorAll('form.needs-validation');
    forms.forEach(form => {
        form.addEventListener('submit', function(event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
                showAlert('warning', 'Por favor complete todos los campos obligatorios.');
            }
            form.classList.add('was-validated');
        });
    });
});
