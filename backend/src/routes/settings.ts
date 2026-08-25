
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

// Get user settings
router.get('/', async (req, res) => {
  try {
    // Por enquanto, retornar configurações padrão
    const settings = {
      theme: 'dark',
      notifications: {
        push: true,
        email: true,
        sms: false
      },
      system: {
        version: '1.0.0',
        lastUpdate: new Date().toISOString().split('T')[0],
        autoBackup: true,
        maintenance_alerts: true
      },
      preferences: {
        language: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        currency: 'BRL'
      }
    };

    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

// Update user settings
router.put('/', async (req, res) => {
  try {
    const { theme, notifications, preferences } = req.body;
    
    // Por enquanto, apenas simular a atualização
    console.log('📝 Configurações atualizadas:', { theme, notifications, preferences });
    
    res.json({ 
      success: true, 
      message: 'Configurações atualizadas com sucesso',
      settings: req.body
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
});

export default router;
