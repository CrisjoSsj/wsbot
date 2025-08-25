/**
 * Administrador de temas para el panel de administración
 * Versión: 2.0
 */

const ThemeManager = {
    /**
     * Inicializa el administrador de temas
     */
    init() {
        this.themeToggle = document.getElementById('themeToggle');
        this.themeIcon = document.getElementById('themeIcon');
        
        // Aplicar tema actual
        this.applyTheme();
        
        // Configurar evento de cambio
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        } else {
            console.error('ThemeManager: Elemento themeToggle no encontrado');
        }
        
        console.log('ThemeManager: Inicializado');
    },
    
    /**
     * Aplica el tema según la configuración guardada
     */
    applyTheme() {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        
        // Aplicar clase al body
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        // Actualizar icono
        if (this.themeIcon) {
            this.themeIcon.className = isDarkMode ? 'bi bi-sun' : 'bi bi-moon-stars';
        }
        
        console.log('ThemeManager: Tema aplicado -', isDarkMode ? 'oscuro' : 'claro');
    },
    
    /**
     * Cambia entre tema oscuro y claro
     */
    toggleTheme() {
        // Obtener estado actual
        const isDarkMode = document.body.classList.contains('dark-mode');
        
        // Guardar nuevo estado
        localStorage.setItem('darkMode', !isDarkMode);
        
        // Aplicar nuevo tema
        this.applyTheme();
        
        // Mostrar notificación
        if (typeof window.showAlert === 'function') {
            window.showAlert('success', `Tema ${!isDarkMode ? 'oscuro' : 'claro'} activado`);
        }
    }
};

// Inicializar cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
});
