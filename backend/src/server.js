import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import appointmentRoutes from './routes/appointments.js';
import slotRoutes from './routes/slots.js';
import integrationRoutes from './routes/integrations.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/appointments', appointmentRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/integrations', integrationRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Appointment Booking API is running',
    endpoints: {
      health: '/health',
      appointments: '/api/appointments',
      slots: '/api/slots',
    },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});


