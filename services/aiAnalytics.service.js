// Analytics y métricas de rendimiento de IA
'use strict';

const fs = require('fs').promises;
const path = require('path');

class AIAnalytics {
  constructor() {
    this.metricsFile = path.join(__dirname, '../data/ai-metrics.json');
    this.dailyStats = {
      date: new Date().toISOString().split('T')[0],
      totalInteractions: 0,
      successfulResponses: 0,
      lowConfidenceResponses: 0,
      intentDetection: {
        buying: 0,
        info: 0,
        general: 0,
        firstTime: 0,
        urgent: 0
      },
      averageConfidence: 0,
      derivationsToHuman: 0,
      responseQuality: {
        cleanedResponses: 0,
        muletillasRemoved: 0
      }
    };
  }

  /**
   * Registra una interacción de IA
   * @param {object} interaction - Datos de la interacción
   */
  async logInteraction(interaction) {
    try {
      const {
        userMessage,
        aiResponse,
        confidence,
        userIntent,
        wasDerivated,
        responseWasCleaned
      } = interaction;

      // Actualizar estadísticas diarias
      this.dailyStats.totalInteractions++;
      
      if (confidence >= 0.7) {
        this.dailyStats.successfulResponses++;
      } else {
        this.dailyStats.lowConfidenceResponses++;
      }

      if (wasDerivated) {
        this.dailyStats.derivationsToHuman++;
      }

      if (responseWasCleaned) {
        this.dailyStats.responseQuality.cleanedResponses++;
      }

      // Registrar detección de intención
      if (userIntent) {
        if (userIntent.type in this.dailyStats.intentDetection) {
          this.dailyStats.intentDetection[userIntent.type]++;
        }
        
        if (userIntent.isFirstTime) {
          this.dailyStats.intentDetection.firstTime++;
        }
        
        if (userIntent.isUrgent) {
          this.dailyStats.intentDetection.urgent++;
        }
      }

      // Calcular confianza promedio
      const currentTotal = this.dailyStats.averageConfidence * (this.dailyStats.totalInteractions - 1);
      this.dailyStats.averageConfidence = (currentTotal + confidence) / this.dailyStats.totalInteractions;

      // Guardar métricas cada 10 interacciones
      if (this.dailyStats.totalInteractions % 10 === 0) {
        await this.saveMetrics();
      }

      console.log(`📊 IA Analytics: ${this.dailyStats.totalInteractions} interacciones | Confianza promedio: ${this.dailyStats.averageConfidence.toFixed(2)}`);
      
    } catch (error) {
      console.error('❌ Error al registrar métricas de IA:', error.message);
    }
  }

  /**
   * Guarda las métricas en archivo
   */
  async saveMetrics() {
    try {
      await fs.mkdir(path.dirname(this.metricsFile), { recursive: true });
      
      let allMetrics = [];
      
      // Cargar métricas existentes
      try {
        const existingData = await fs.readFile(this.metricsFile, 'utf8');
        allMetrics = JSON.parse(existingData);
      } catch (error) {
        // Archivo no existe, crear nuevo
        allMetrics = [];
      }

      // Actualizar o agregar métricas del día actual
      const todayIndex = allMetrics.findIndex(m => m.date === this.dailyStats.date);
      
      if (todayIndex >= 0) {
        allMetrics[todayIndex] = { ...this.dailyStats };
      } else {
        allMetrics.push({ ...this.dailyStats });
      }

      // Mantener solo los últimos 30 días
      if (allMetrics.length > 30) {
        allMetrics = allMetrics.slice(-30);
      }

      await fs.writeFile(this.metricsFile, JSON.stringify(allMetrics, null, 2));
      
    } catch (error) {
      console.error('❌ Error al guardar métricas:', error.message);
    }
  }

  /**
   * Obtiene resumen de métricas recientes
   * @returns {object} - Resumen de métricas
   */
  async getMetricsSummary() {
    try {
      const data = await fs.readFile(this.metricsFile, 'utf8');
      const allMetrics = JSON.parse(data);
      
      if (allMetrics.length === 0) {
        return { message: 'No hay métricas disponibles aún' };
      }

      const recent = allMetrics.slice(-7); // Últimos 7 días
      const totalInteractions = recent.reduce((sum, day) => sum + day.totalInteractions, 0);
      const avgConfidence = recent.reduce((sum, day) => sum + day.averageConfidence, 0) / recent.length;
      
      return {
        period: '7 días',
        totalInteractions,
        averageConfidence: avgConfidence.toFixed(2),
        successRate: `${((recent.reduce((sum, day) => sum + day.successfulResponses, 0) / totalInteractions) * 100).toFixed(1)}%`,
        humanDerivations: recent.reduce((sum, day) => sum + day.derivationsToHuman, 0),
        mostCommonIntent: this.getMostCommonIntent(recent),
        today: this.dailyStats
      };
      
    } catch (error) {
      return { error: 'No se pudieron cargar las métricas' };
    }
  }

  /**
   * Determina la intención más común
   * @param {array} metrics - Array de métricas
   * @returns {string} - Intención más común
   */
  getMostCommonIntent(metrics) {
    const intentTotals = {
      buying: 0,
      info: 0,
      general: 0
    };

    metrics.forEach(day => {
      intentTotals.buying += day.intentDetection.buying;
      intentTotals.info += day.intentDetection.info;
      intentTotals.general += day.intentDetection.general;
    });

    return Object.keys(intentTotals).reduce((a, b) => 
      intentTotals[a] > intentTotals[b] ? a : b
    );
  }
}

// Instancia singleton
const analytics = new AIAnalytics();

module.exports = {
  logInteraction: (interaction) => analytics.logInteraction(interaction),
  getMetricsSummary: () => analytics.getMetricsSummary(),
  saveMetrics: () => analytics.saveMetrics()
};
