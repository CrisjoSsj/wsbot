const express = require('express');
const router = express.Router();
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const fsSync = require('fs');
const { promisify } = require('util');
const readFile = promisify(fsSync.readFile);
const writeFile = promisify(fsSync.writeFile);

// Importar configuración
const botConfig = require('../config/botConfig');

// Middleware para verificar autenticación
const requireLogin = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    } else {
        return res.redirect('/admin/login');
    }
};

// Rutas de autenticación
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Cargar configuración de administración
        const adminConfigPath = path.join(__dirname, '../config/admin.json');
        const adminConfig = await readFile(adminConfigPath, 'utf8')
            .then(data => JSON.parse(data))
            .catch(() => ({ users: [] }));

        // Buscar usuario
        const user = adminConfig.users.find(u => u.username === username);

        if (user && await bcrypt.compare(password, user.password)) {
            // Iniciar sesión
            req.session.user = {
                username: user.username,
                role: user.role || 'admin'
            };
            res.redirect('/admin/dashboard');
        } else {
            res.render('login', { error: 'Usuario o contraseña incorrectos' });
        }
    } catch (error) {
        console.error('Error de autenticación:', error);
        res.render('login', { error: 'Error en el proceso de autenticación' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// Ruta principal del dashboard
router.get('/', requireLogin, (req, res) => {
    res.redirect('/admin/dashboard');
});

router.get('/dashboard', requireLogin, (req, res) => {
    const config = botConfig.obtenerConfiguracion();
    
    // Obtener información para el panel
    
    res.render('dashboard', { 
        username: req.session.user.username,
        stats: {},
        config
    });
});

// Rutas para editar secciones específicas
router.get('/edit/general', requireLogin, (req, res) => {
    const config = botConfig.obtenerConfiguracion();
    res.render('edit-general', { 
        username: req.session.user.username,
        config
    });
});

router.get('/edit/welcome', requireLogin, (req, res) => {
    const config = botConfig.obtenerConfiguracion();
    res.render('edit-welcome', { 
        username: req.session.user.username,
        config
    });
});

router.get('/edit/menu', requireLogin, (req, res) => {
    const config = botConfig.obtenerConfiguracion();
    res.render('edit-menu', { 
        username: req.session.user.username,
        config
    });
});
    // Vistas de bienvenida/menú deshabilitadas por eliminación del menú



// Rutas para editar contenido
router.get('/edit/content/:section', requireLogin, (req, res) => {
    const section = req.params.section;
    const config = botConfig.obtenerConfiguracion();
    
    // Validar que la sección existe
    const validSections = ['horario', 'pago', 'envio', 'direcciones', 'precios', 'info_precios', 'contacto', 'catalogo', 'listaPrecios'];
    
    // Para la nueva sección de información de precios
    if (section === 'info_precios') {
        // Recuperar el contenido existente o inicializar uno nuevo
        const content = config.content?.info_precios || {
            title: 'INFORMACIÓN DE PRECIOS',
            description: 'Precios: consulta nuestro catálogo en línea o pide una lista por mensaje para recibir los precios actualizados.',
            relatedOptions: [
                "Envía *3* para ver la lista de precios actual",
                "Envía *7* para ver el catálogo completo con detalles"
            ],
            promotions: [
                "10% de descuento en tu primera compra",
                "15% de descuento comprando 3 o más artículos",
                "Envío gratis en compras mayores a $60 USD"
            ],
            footer: "¿Tienes alguna pregunta sobre precios especiales? Envía *4* para contactar a un asesor."
        };
        
        return res.render('edit-content/info_precios', { 
            username: req.session.user.username,
            config,
            content
        });
    }
    
    if (!validSections.includes(section)) {
        return res.status(404).send('Sección no encontrada');
    }
    
    res.render('edit-content', { 
        username: req.session.user.username,
        config,
        section
    });
});

// API para modificar la configuración
router.post('/api/config/general', requireLogin, async (req, res) => {
    try {
        const { businessName, welcomeDelay, bypassWelcome } = req.body;
        const config = botConfig.obtenerConfiguracion();
        
        config.businessName = businessName;
        config.welcomeDelay = welcomeDelay;
        config.bypassWelcome = bypassWelcome;
        
        await botConfig.guardarConfiguracion(config);
        res.json({ success: true });
    } catch (error) {
        console.error('Error al guardar configuración general:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/api/config/welcome', requireLogin, async (req, res) => {
    try {
        const { welcomeMessage, welcomeEnabled } = req.body;
        const config = botConfig.obtenerConfiguracion();
        
        config.welcome = {
            ...(config.welcome || {}),
            message: welcomeMessage,
            enabled: welcomeEnabled
        };
        
        await botConfig.guardarConfiguracion(config);
        res.json({ success: true });
    } catch (error) {
        console.error('Error al guardar mensaje de bienvenida:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/api/config/menu', requireLogin, async (req, res) => {
    try {
        const { title, greeting, options, footer } = req.body;
        const config = botConfig.obtenerConfiguracion();

        // Validar números únicos y de un solo dígito
        if (!Array.isArray(options)) {
            return res.status(400).json({ success: false, error: 'Opciones de menú inválidas.' });
        }
        const numbers = options.map(op => String(op.number));
        const uniqueNumbers = new Set(numbers);
        const invalidNumbers = numbers.filter(n => !/^[1-9]$/.test(n));
        if (uniqueNumbers.size !== numbers.length) {
            return res.status(400).json({ success: false, error: 'Los números de opción deben ser únicos.' });
        }
        if (invalidNumbers.length > 0) {
            return res.status(400).json({ success: false, error: 'Los números de opción deben ser de un solo dígito (1-9).' });
        }

        // Normalizar las opciones recibidas y garantizar estructura mínima
        const normalizedOptions = options.map((op, idx) => ({
            number: String(op.number ?? (idx + 1)).trim(),
            text: String(op.text ?? '').trim(),
            key: op.key ? String(op.key).trim() : undefined,
            emoji: op.emoji ? String(op.emoji).trim() : undefined,
            response: op.response ? String(op.response) : undefined
        })).filter(o => o.number && o.text);

        // Reemplazar la sección `menu` por el nuevo formato limpio. Eliminamos claves legacy
        // Forzar que la opción 1 sea siempre el menú principal y no editable
        const forcedOption1 = { number: '1', text: 'Ver este menú', key: 'menu', emoji: null, response: '' };
        // Forzar que la opción 4 sea siempre Contactar asesor
        const forcedOption4 = { number: '4', text: 'Contactar asesor', key: 'contacto', emoji: null, response: '' };

        // Construir options respetando forced 1 y 4
        const cleaned = [];
        // Insert forced 1 first
        cleaned.push(forcedOption1);

        // Insert other normalized options skipping numbers 1 and 4
        normalizedOptions.forEach(op => {
            if (String(op.number) === '1' || String(op.number) === '4') return; // skip, forced
            cleaned.push(op);
        });

        // Ensure forced 4 exists at its appropriate place (after others or at position 2)
        // We'll append forcedOption4 if not already present
        if (!cleaned.find(o => String(o.number) === '4')) cleaned.push(forcedOption4);

        // Normalize numbers: keep their provided numbers except for forced positions
        // Final options array
        const finalOptions = cleaned.map(op => ({
            number: String(op.number),
            text: String(op.text),
            key: op.key || undefined,
            emoji: op.emoji || null,
            response: op.response || ''
        }));

        config.menu = {
            title: title || (config.menu && config.menu.title) || 'MENÚ',
            greeting: greeting || (config.menu && config.menu.greeting) || '',
            options: finalOptions,
            footer: footer || (config.menu && config.menu.footer) || ''
        };

        // Asegurar que no queden campos legacy que provoquen regeneración de bloques obsoletos
        try {
            if (config.menu.mainMenu) delete config.menu.mainMenu;
            if (config.menu.welcome) delete config.menu.welcome;
            if (config.menu.admin) delete config.menu.admin;
        } catch (e) {
            // No bloquear el guardado si algo falla al limpiar
            console.warn('Advertencia al limpiar claves legacy del menú:', e && e.message);
        }
        
        await botConfig.guardarConfiguracion(config);
        res.json({ success: true });
    } catch (error) {
        console.error('Error al guardar configuración del menú:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/api/config/submenu', requireLogin, async (req, res) => {
    try {
        const { submenu } = req.body;
        const config = botConfig.obtenerConfiguracion();
        
        config.menu = {
            ...(config.menu || {}),
            submenu: {
                ...(config.menu?.submenu || {}),
                ...submenu
            }
        };
        
        await botConfig.guardarConfiguracion(config);
        res.json({ success: true });
    } catch (error) {
        console.error('Error al guardar configuración del submenú:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
    // APIs de bienvenida/menú/submenú deshabilitadas



// Ruta para guardar contenido de información de precios
router.post('/api/content/info_precios', requireLogin, async (req, res) => {
    try {
        const { title, description, relatedOptions, promotions, footer } = req.body;
        const config = botConfig.obtenerConfiguracion();
        
        // Asegurarse de que el objeto content existe
        config.content = config.content || {};
        
        // Actualizar la sección de información de precios
        config.content.info_precios = {
            title,
            description,
            relatedOptions,
            promotions,
            footer
        };
        
        await botConfig.guardarConfiguracion(config);
        res.json({ success: true });
    } catch (error) {
        console.error('Error al guardar información de precios:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Ruta para guardar opciones de menú
router.post('/api/menu-option', requireLogin, async (req, res) => {
    try {
        const { key, enabled, number, text, emoji } = req.body;
        const config = botConfig.obtenerConfiguracion();
        
        // Asegurarse de que el objeto menu y options existe
        config.menu = config.menu || {};
        config.menu.options = config.menu.options || [];
        
        // Verificar si la opción ya existe
        const optionIndex = config.menu.options.findIndex(opt => opt.key === key);
        
        if (enabled) {
            // Si está habilitada, actualizamos o agregamos
            const optionData = {
                key,
                number,
                text,
                emoji
            };
            
            if (optionIndex >= 0) {
                // Actualizar opción existente
                config.menu.options[optionIndex] = optionData;
            } else {
                // Agregar nueva opción
                config.menu.options.push(optionData);
            }
        } else if (optionIndex >= 0) {
            // Si no está habilitada y existe, la eliminamos
            config.menu.options.splice(optionIndex, 1);
        }
        
        await botConfig.guardarConfiguracion(config);
        res.json({ success: true });
    } catch (error) {
        console.error('Error al guardar opción de menú:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
    // APIs de contenido y opciones de menú deshabilitadas

router.post('/api/config/:section', requireLogin, async (req, res) => {
    try {
        const section = req.params.section;
        const sectionData = req.body;
        const config = botConfig.obtenerConfiguracion();
        
        // Asegurarse de que el objeto content existe
        config.content = config.content || {};
        
        // Actualizar la sección específica
        config.content[section] = sectionData;
        
        await botConfig.guardarConfiguracion(config);
        res.json({ success: true });
    } catch (error) {
        console.error(`Error al guardar sección ${req.params.section}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
