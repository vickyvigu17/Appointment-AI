import express from 'express';
import * as appointmentService from '../services/appointmentService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date parameter is required (YYYY-MM-DD)' });
    }
    const slots = await appointmentService.getSlotsForDate(date);
    res.json({ date, slots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

