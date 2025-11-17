import express from 'express';
import * as appointmentService from '../services/appointmentService.js';
import * as llmService from '../services/llmService.js';

const router = express.Router();

// Store conversation history per user (in production, use Redis/DB)
const conversationHistory = new Map();

// Chat endpoint - LLM integration
router.post('/chat', async (req, res) => {
  try {
    const { message, vendor_name, vendor_email, carrier_name } = req.body;

    if (!vendor_name || !vendor_email) {
      return res.status(400).json({ 
        type: 'error',
        error: 'Vendor name and email are required',
        message: 'Vendor name and email are required' 
      });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        type: 'error',
        error: 'Message is required',
        message: 'Please provide a message'
      });
    }

    const vendorInfo = { name: vendor_name, email: vendor_email, carrier_name };
    const historyKey = vendor_email;
    
    // Get conversation history
    const history = conversationHistory.get(historyKey) || [];
    
    // Process with LLM
    const response = await llmService.processUserMessage(
      message,
      history,
      vendorInfo
    );

    // Ensure response has the expected structure
    if (!response || typeof response !== 'object') {
      console.error('Invalid response from LLM service:', response);
      return res.status(500).json({
        type: 'error',
        error: 'Invalid response from AI service',
        message: 'Failed to process chat message. Please try again.'
      });
    }

    // Update conversation history
    // Store both the structured response and the human-readable message for better context
    const assistantContent = response.message || JSON.stringify(response);
    history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: assistantContent }
    );
    conversationHistory.set(historyKey, history.slice(-10)); // Keep last 10 messages

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    
    // Return error in the expected format
    res.status(500).json({ 
      type: 'error',
      error: 'Failed to process chat message',
      message: error.message || 'An unexpected error occurred. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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


