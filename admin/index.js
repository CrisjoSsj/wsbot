
require('dotenv').config();
'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const botConfig = require('../config/botConfig');

// Usar la clave Groq desde variable de entorno si está definida
if (process.env.GROQ_API_KEY) {
  const config = botConfig.obtenerConfiguracion();
  if (!config.ai) config.ai = {};
  config.ai.groqApiKey = process.env.GROQ_API_KEY;
}
const whatsappStatus = require('../services/whatsappStatus.service');

// Configuración del panel de administración
const ADMIN_PANEL_PORT = process.env.ADMIN_PANEL_PORT || 3001;
const SESSION_SECRET = process.env.SESSION_SECRET || 'bot-whatsapp-admin-secret-key';

// Crear la aplicación Express para el panel de administración
const helmet = require('helmet');
const cors = require('cors');
const adminApp = express();

// Seguridad HTTP y CORS
adminApp.use(helmet({
  contentSecurityPolicy: false // Desactivar CSP que puede interferir con algunos recursos
}));
adminApp.use(cors({
  origin: true, // Permitir todas las solicitudes CORS (ajustar en producción)
  credentials: true // Importante para permitir cookies en solicitudes CORS
}));
adminApp.use(express.json());
adminApp.use(express.urlencoded({ extended: true }));
adminApp.use(express.static(path.join(__dirname, 'public')));

// Configurar la sesión para permitir acceso tanto desde localhost como desde IP
adminApp.use(session({
  secret: SESSION_SECRET,
  resave: true, // Cambio a true para asegurar que la sesión se guarda
  saveUninitialized: true, // Cambio a true para crear sesión para todos los visitantes
  name: 'whatsapp_admin_sid', // Nombre específico para evitar conflictos
  cookie: {
    secure: false, // Permitir HTTP (cambiar a true solo si tienes HTTPS)
    httpOnly: true, // Mejor seguridad contra XSS
    sameSite: 'lax', // 'lax' es más compatible para acceso por diferentes dominios/IPs
    maxAge: 24 * 3600000 // 24 horas para dar más tiempo
  }
}));

// Montar todas las rutas bajo /admin
const router = express.Router();
adminApp.use('/admin', router);

// Configurar motor de vistas
adminApp.set('view engine', 'ejs');
adminApp.set('views', path.join(__dirname, 'views'));

// Middleware para variables globales
adminApp.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
});

// Middleware para variables globales en el router
router.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
});

// Middleware para verificar si el usuario está autenticado
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  
  // Si está solicitando una API, devolver error de autenticación
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ 
      error: 'No autenticado',
      timestamp: new Date().toISOString()
    });
  }
  
  // Redirigir a login para acceso web
  return res.redirect('/admin/login');
}

// Función para verificar/crear usuarios de administración
async function setupAdminUser() {
  try {
    const adminConfigPath = path.join(__dirname, '../config/admin.json');
    
    // Verificar si existe el directorio config
    const configDir = path.dirname(adminConfigPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Verificar si existe el archivo de configuración de administración
    let adminConfig;
    try {
      const configData = fs.readFileSync(adminConfigPath, 'utf8');
      adminConfig = JSON.parse(configData);
    } catch (error) {
      // Crear configuración por defecto
      adminConfig = {
        users: []
      };
    }
    
    // Verificar si hay usuarios existentes
    if (adminConfig.users.length === 0) {
      // Crear usuario admin por defecto con contraseña segura
      const hashedPassword = await bcrypt.hash('Courier2025@secure', 10);
      adminConfig.users.push({
        username: 'courierAdmin',
        password: hashedPassword,
        role: 'admin'
      });
      
      // Guardar configuración
      fs.writeFileSync(adminConfigPath, JSON.stringify(adminConfig, null, 2));
      console.log('Usuario administrador creado: courierAdmin / Courier2025@secure');
    }
  } catch (error) {
    console.error('Error al configurar usuarios de administración:', error);
  }
}

// Ruta de login
router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Cargar configuración de administración
    const adminConfigPath = path.join(__dirname, '../config/admin.json');
    const adminConfig = JSON.parse(fs.readFileSync(adminConfigPath, 'utf8'));
    
    // Buscar usuario
    const user = adminConfig.users.find(u => u.username === username);
    
    if (user && await bcrypt.compare(password, user.password)) {
      // Iniciar sesión
      req.session.user = {
        username: user.username,
        role: user.role || 'admin',
        loginTime: new Date().toISOString()
      };
      
      // Forzar guardado de sesión antes de redirección
      req.session.save(err => {
        if (err) {
          console.error('Error al guardar sesión:', err);
          return res.render('login', { error: 'Error al guardar la sesión' });
        }
        
        res.redirect('/admin/dashboard');
      });
    } else {
      res.render('login', { error: 'Usuario o contraseña incorrectos' });
    }
  } catch (error) {
    console.error('Error de autenticación:', error);
    res.render('login', { error: 'Error en el proceso de autenticación' });
  }
});

// Ruta de logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Dashboard principal
router.get('/dashboard', isAuthenticated, (req, res) => {
  const config = botConfig.obtenerConfiguracion();
  
  // Obtener información para el panel
  const comandosCount = Object.keys(config.commands?.definitions || {}).length;
  const opcionesCount = config.menu?.options?.length || 0;
  
  // Obtener la ruta del archivo de configuración
  const configPath = require('path').join(__dirname, '../config.json');
  
  res.render('dashboard', { 
    username: req.session.user.username,
    stats: {
      comandos: comandosCount,
      opciones: opcionesCount
    },
    config,
    configPath
  });
});

// La página de depuración de estado ha sido eliminada

// Rutas para cada sección de edición
router.get('/edit/general', isAuthenticated, (req, res) => {
  const config = botConfig.obtenerConfiguracion();
  res.render('edit-general', { 
    username: req.session.user.username,
    config
  });
});

router.get('/edit/welcome', isAuthenticated, (req, res) => {
  const config = botConfig.obtenerConfiguracion();
  res.render('edit-welcome', { 
    username: req.session.user.username,
    config
  });
});

router.get('/edit/menu', isAuthenticated, (req, res) => {
  const config = botConfig.obtenerConfiguracion();
  res.render('edit-menu', { 
    username: req.session.user.username,
    config
  });
});

router.get('/edit/ai', isAuthenticated, (req, res) => {
  const config = botConfig.obtenerConfiguracion();
  res.render('edit-ai', { 
    username: req.session.user.username,
    config
  });
});

// Editor de contexto IA
router.get('/edit/context', isAuthenticated, (req, res) => {
  const config = botConfig.obtenerConfiguracion();
  res.render('edit-context', {
    username: req.session.user.username,
    config
  });
});
// Editor unificado de contenido + menú
router.get('/edit/unified', isAuthenticated, (req, res) => {
  const config = botConfig.obtenerConfiguracion();
  res.render('edit-unified', {
    username: req.session.user.username,
    config
  });
});

router.get('/edit/content/:section', isAuthenticated, (req, res) => {
  const section = req.params.section;
  const validSections = ['horario', 'envio', 'pago', 'direcciones', 'precios', 'contacto', 'catalogo', 'listaPrecios'];
  
  if (!validSections.includes(section)) {
    return res.status(404).send('Sección no encontrada');
  }
  
  const config = botConfig.obtenerConfiguracion();
  res.render('edit-content', { 
    username: req.session.user.username,
    config,
    section
  });
});

// API para obtener la configuración actual
router.get('/api/config', isAuthenticated, (req, res) => {
  const config = botConfig.obtenerConfiguracion();
  res.json(config);
});

// API para guardar la configuración
router.post('/api/config', isAuthenticated, async (req, res) => {
  try {
    // Validar que el cuerpo de la solicitud sea un objeto JSON válido
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'La configuración debe ser un objeto JSON válido' });
    }
    
    // Obtener configuración actual
    const config = botConfig.obtenerConfiguracion();
    
    // Validación: si vienen opciones de menú, verificar números únicos
    if (req.body?.menu?.options && Array.isArray(req.body.menu.options)) {
      const numbers = req.body.menu.options.map(o => String(o.number ?? '').trim()).filter(Boolean);
      const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
      if (duplicates.length) {
        return res.status(400).json({ error: 'Números de opciones repetidos: ' + Array.from(new Set(duplicates)).join(', ') });
      }
    }

    // Actualizar la configuración
    Object.assign(config, req.body);
    
    // Guardar en disco
    await botConfig.guardarConfiguracion(config);
    
    return res.json({ success: true, message: 'Configuración guardada correctamente' });
  } catch (error) {
    console.error('Error al guardar la configuración:', error);
    return res.status(500).json({ error: 'Error al guardar la configuración', details: error.message });
  }
});

// CRUD de Contexto IA (config.content)
router.get('/api/context', isAuthenticated, (req, res) => {
  const config = botConfig.obtenerConfiguracion();
  res.json({ content: config.content || {} });
});

router.post('/api/context/:section', isAuthenticated, async (req, res) => {
  try {
    const section = req.params.section;
    let data = req.body;
    if (!section) return res.status(400).json({ success: false, error: 'missing_section' });
    const config = botConfig.obtenerConfiguracion();
    if (!config.content) config.content = {};
    // Si viene { value: "texto" }, guardar como string plano para simplificar al cliente
    if (data && typeof data === 'object' && typeof data.value === 'string') {
      data = data.value;
    }
    config.content[section] = data;
    await botConfig.guardarConfiguracion(config);
    res.json({ success: true, section, data });
  } catch (e) {
    console.error('Error guardando contexto:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/api/context/:section', isAuthenticated, async (req, res) => {
  try {
    const section = req.params.section;
    if (!section) return res.status(400).json({ success: false, error: 'missing_section' });
    const config = botConfig.obtenerConfiguracion();
    if (config.content && Object.prototype.hasOwnProperty.call(config.content, section)) {
      delete config.content[section];
      await botConfig.guardarConfiguracion(config);
      return res.json({ success: true });
    }
    res.status(404).json({ success: false, error: 'not_found' });
  } catch (e) {
    console.error('Error eliminando contexto:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// API para actualizar secciones específicas de la configuración
router.post('/api/config/:section', isAuthenticated, async (req, res) => {
  try {
    const section = req.params.section;
    
    // Validar que el cuerpo de la solicitud sea un objeto JSON válido
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Los datos deben ser un objeto JSON válido' });
    }
    
    // Obtener configuración actual
    const config = botConfig.obtenerConfiguracion();
    
    // Mapear la sección al path correcto en config
    switch (section) {
      case 'general':
        // Para propiedades de nivel superior como businessName
        Object.assign(config, req.body);
        break;
      case 'welcome':
        config.welcome = { ...config.welcome, ...req.body };
        break;
      case 'menu':
        if (!config.menu) config.menu = {};
        // Validación de números duplicados si se envían opciones
        if (req.body?.options && Array.isArray(req.body.options)) {
          const numbers = req.body.options.map(o => String(o.number ?? '').trim()).filter(Boolean);
          const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
          if (duplicates.length) {
            return res.status(400).json({ error: 'Números de opciones repetidos: ' + Array.from(new Set(duplicates)).join(', ') });
          }
        }
        Object.assign(config.menu, req.body);
        break;
      case 'submenu':
        if (!config.menu) config.menu = {};
        config.menu.submenu = { ...config.menu?.submenu, ...req.body.submenu };
        break;
      case 'commands':
        config.commands = req.body;
        break;
      default:
        // Para secciones en content (horario, envio, etc)
        if (!config.content) config.content = {};
        config.content[section] = { ...config.content[section], ...req.body };
    }
    
    // Guardar en disco
    await botConfig.guardarConfiguracion(config);
    
    return res.json({ success: true, message: `Sección ${section} actualizada correctamente` });
  } catch (error) {
    console.error(`Error al actualizar sección ${req.params.section}:`, error);
    return res.status(500).json({ error: `Error al actualizar sección ${req.params.section}`, details: error.message });
  }
});

// API para recargar configuración desde el archivo
router.post('/api/reload', isAuthenticated, (req, res) => {
  try {
    botConfig.cargarConfigDesdeDisco();
    return res.json({ success: true, message: 'Configuración recargada desde el archivo' });
  } catch (error) {
    console.error('Error al recargar la configuración:', error);
    return res.status(500).json({ error: 'Error al recargar la configuración', details: error.message });
  }
});

// API para el estado de WhatsApp
router.get('/api/whatsapp/status', isAuthenticated, (req, res) => {
  try {
    // Intentar leer el archivo de estado directamente para evitar problemas con el servicio
    const fs = require('fs');
    const path = require('path');
    const statusFilePath = path.join(__dirname, '../config/whatsappStatus.json');
    
    // Verificar si el archivo existe
    if (fs.existsSync(statusFilePath)) {
      // Leer el archivo directamente
      const statusData = JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
      
      // Agregar timestamp de respuesta para verificar que la API está respondiendo
      return res.json({
        ...statusData,
        apiTimestamp: new Date().toISOString(),
        source: 'direct-file'
      });
    } else {
      // Si el archivo no existe, intentar usar el servicio como respaldo
      const statusInfo = whatsappStatus.getStatusInfo();
      
      // Responder con el estado, incluso si no está inicializado
      return res.json({
        ...statusInfo,
        apiTimestamp: new Date().toISOString(),
        source: 'service-fallback'
      });
    }
  } catch (error) {
    console.error('Error al obtener el estado de WhatsApp:', error);
    return res.status(500).json({ 
      error: 'Error al obtener el estado de WhatsApp', 
      details: error.message,
      status: 'error',
      timestamp: new Date().toISOString()
    });
  }
});

// API para obtener el código QR
router.get('/api/whatsapp/qr', isAuthenticated, (req, res) => {
  try {
    const qrCode = whatsappStatus.getQrCode();
    console.log(`API QR - Solicitando código QR por ${req.session.user?.username}, disponible:`, !!qrCode);
    
    if (qrCode) {
      // Solo mostrar los primeros 20 caracteres del QR en el log para no saturarlo
      const qrPreview = qrCode.substring(0, 20) + '...';
      console.log(`API QR - Código QR encontrado (preview): ${qrPreview}`);
      
      return res.json({ 
        success: true, 
        qrCode,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('API QR - No hay código QR disponible');
      
      // Obtener el estado actual para proporcionar más contexto
      const statusInfo = whatsappStatus.getStatusInfo();
      
      return res.status(404).json({ 
        success: false, 
        message: 'No hay código QR disponible',
        status: statusInfo.status,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error al obtener el código QR:', error);
    return res.status(500).json({ 
      error: 'Error al obtener el código QR', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API para reiniciar el cliente de WhatsApp
router.post('/api/whatsapp/restart', isAuthenticated, (req, res) => {
  try {
    const result = whatsappStatus.restartClient();
    console.log('Reiniciando cliente WhatsApp, resultado:', result);
    
    if (result) {
      return res.json({ success: true, message: 'Cliente de WhatsApp reiniciado' });
    } else {
      return res.status(500).json({ success: false, message: 'No se pudo reiniciar el cliente de WhatsApp' });
    }
  } catch (error) {
    console.error('Error al reiniciar el cliente de WhatsApp:', error);
    return res.status(500).json({ error: 'Error al reiniciar el cliente de WhatsApp', details: error.message });
  }
});

// API para reiniciar el cliente de WhatsApp con sesión limpia
router.post('/api/whatsapp/restart-clean', isAuthenticated, async (req, res) => {
  try {
    console.log('Solicitando reinicio con sesión limpia...');
    
    // Importar función del adaptador
    const { reiniciarClienteConSesionLimpia } = require('../adapters/whatsapp');
    const client = whatsappStatus.getWhatsAppClient();
    
    if (!client) {
      return res.status(500).json({ success: false, message: 'Cliente de WhatsApp no disponible' });
    }
    
    // Reiniciar con sesión limpia
    const result = await reiniciarClienteConSesionLimpia(client);
    
    if (result) {
      return res.json({ 
        success: true, 
        message: 'Cliente de WhatsApp reiniciado con sesión limpia',
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        message: 'No se pudo reiniciar el cliente con sesión limpia' 
      });
    }
  } catch (error) {
    console.error('Error al reiniciar el cliente con sesión limpia:', error);
    return res.status(500).json({ 
      error: 'Error al reiniciar con sesión limpia', 
      details: error.message 
    });
  }
});

// API para cerrar sesión de WhatsApp
router.post('/api/whatsapp/logout', isAuthenticated, async (req, res) => {
  try {
    const result = await whatsappStatus.logout();
    console.log('Cerrando sesión de WhatsApp, resultado:', result);
    
    if (result) {
      return res.json({ success: true, message: 'Sesión de WhatsApp cerrada' });
    } else {
      return res.status(500).json({ success: false, message: 'No se pudo cerrar la sesión de WhatsApp' });
    }
  } catch (error) {
    console.error('Error al cerrar sesión de WhatsApp:', error);
    return res.status(500).json({ error: 'Error al cerrar sesión de WhatsApp', details: error.message });
  }
});

// API para probar la IA
router.post('/api/ai/test', isAuthenticated, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, reason: 'missing_message' });
    }
    
    // Importar servicio de AI
    const aiService = require('../services/ai.service');
    
    // Crear un estado temporal para la prueba
    const testState = { messageHistory: [] };
    
    // Usar un chat ID ficticio para las pruebas
    const testChatId = 'admin_test_' + Date.now();
    
    // Procesar mensaje con IA
    const aiResponse = await aiService.processMessageWithAI(testChatId, message, testState);
    
    // Devolver resultado
    return res.json(aiResponse);
  } catch (error) {
    console.error('Error al probar la IA:', error);
    return res.status(500).json({ 
      success: false, 
      reason: 'error', 
      details: error.message 
    });
  }
});

// API para obtener el estado de la IA
router.get('/api/ai/status', isAuthenticated, (req, res) => {
  try {
    // Importar servicio de AI
    const aiService = require('../services/ai.service');
    
    // Obtener estadísticas del servicio
    const aiStats = aiService.getAIStats();
    
    return res.json(aiStats);
  } catch (error) {
    console.error('Error al obtener estado de la IA:', error);
    return res.status(500).json({ 
      error: 'Error al obtener estado de la IA', 
      details: error.message 
    });
  }
});

// API para depuración - obtener todos los detalles del sistema
router.get('/api/whatsapp/debug', isAuthenticated, (req, res) => {
  try {
    // Recopilamos información de depuración completa
    const statusInfo = whatsappStatus.getStatusInfo();
    const debugInfo = {
      status: statusInfo,
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      clientInfo: {
        isInitialized: !!whatsappStatus.getClientInitializationStatus()
      }
    };
    
    return res.json(debugInfo);
  } catch (error) {
    console.error('Error al obtener información de depuración:', error);
    return res.status(500).json({ 
      error: 'Error al obtener información de depuración', 
      details: error.message
    });
  }
});

// Redirigir la raíz del admin a la página de login o dashboard
router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  res.redirect('/admin/login');
});

// Manejar errores 404
router.use((req, res, next) => {
  res.status(404).render('error', {
    message: 'Página no encontrada',
    status: 404,
    error: {} // Añadir error vacío para evitar errores de undefined
  });
});

// Manejador de errores global
router.use((err, req, res, next) => {
  console.error('Error en panel admin:', err);
  res.status(500).render('error', {
    message: 'Error interno del servidor',
    status: 500,
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

// Función para iniciar el servidor admin
async function iniciarPanelAdmin() {
  try {
    // Configurar usuario admin si es necesario
    await setupAdminUser();
    
    // Iniciar servidor
    const os = require('os');
    adminApp.listen(ADMIN_PANEL_PORT, '0.0.0.0', () => {
      const nets = os.networkInterfaces();
      let addresses = [];
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            addresses.push(net.address);
          }
        }
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔐 Panel de administración disponible en:');
      addresses.forEach(ip => {
        console.log(`   → http://${ip}:${ADMIN_PANEL_PORT}/admin`);
      });
      console.log(`   (o http://localhost:${ADMIN_PANEL_PORT}/admin si es local)`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
  } catch (error) {
    console.error('Error al iniciar panel de administración:', error);
  }
}

module.exports = {
  adminApp,
  iniciarPanelAdmin
};
