const express = require('express');
const router = express.Router();
const aiService = require('../../services/ai.service');
const aiAnalytics = require('../../services/aiAnalytics.service');
const botConfig = require('../../config/botConfig');

// Endpoint para obtener métricas de IA
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await aiAnalytics.getMetricsSummary();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error al obtener métricas de IA:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cargar métricas'
    });
  }
});

// Endpoint para probar detección de intención
router.post('/test-intent', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Mensaje requerido'
      });
    }

    const intent = aiService.detectUserIntent(message);
    
    res.json({
      success: true,
      data: {
        message,
        intent
      }
    });
  } catch (error) {
    console.error('Error al detectar intención:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar intención'
    });
  }
});

module.exports = router;