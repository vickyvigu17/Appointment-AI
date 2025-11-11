import express from 'express';
import * as appointmentService from '../services/appointmentService.js';
import * as llmService from '../services/llmService.js';

const router = express.Router();

// Store conversation history per user (in production, use Redis/DB)
const conversationHistory = new Map();

// Chat endpoint - LLM integration
router.post('/chat', async (req, res) => {
  try {
    const { message, vendor_name, vendor_email } = req.body;

    if (!vendor_name || !vendor_email) {
      return res.status(400).json({ 
        error: 'Vendor name and email are required' 
      });
    }

    const vendorInfo = { name: vendor_name, email: vendor_email };
    const historyKey = vendor_email;
    
    // Get conversation history
    const history = conversationHistory.get(historyKey) || [];
    
    // Process with LLM
    const response = await llmService.processUserMessage(
      message,
      history,
      vendorInfo
    );

    // Update conversation history
    history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: JSON.stringify(response) }
    );
    conversationHistory.set(historyKey, history.slice(-10)); // Keep last 10 messages

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      message: error.message 
    });
  }
});

// Get user's appointments
router.get('/my-appointments', async (req, res) => {
  try {
    const { vendor_email } = req.query;
    if (!vendor_email) {
      return res.status(400).json({ error: 'vendor_email is required' });
    }
    const appointments = await appointmentService.getUserAppointments(vendor_email);
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Direct API endpoints (for testing/evaluation)
router.post('/', async (req, res) => {
  try {
    const appointment = await appointmentService.createAppointment(req.body);
    res.status(201).json(appointment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { date, hour } = req.body;
    const appointment = await appointmentService.updateAppointment(
      req.params.id,
      date,
      hour
    );
    res.json(appointment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const appointment = await appointmentService.deleteAppointment(req.params.id);
    res.json(appointment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;


