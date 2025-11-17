import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import appointmentRoutes from './routes/appointments.js';
import slotRoutes from './routes/slots.js';
import integrationRoutes from './routes/integrations.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Log environment variable status on startup (without exposing keys)
console.log('🔧 Environment Configuration:');
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? `✅ SET (${process.env.OPENAI_API_KEY.substring(0, 7)}...)` : '❌ MISSING');
console.log('  OPENAI_MODEL:', process.env.OPENAI_MODEL || 'gpt-3.5-turbo (default)');
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ SET' : '❌ MISSING');
console.log('  SUPABASE_KEY:', process.env.SUPABASE_KEY ? '✅ SET' : '❌ MISSING');
console.log('  BREVO_API_KEY:', process.env.BREVO_API_KEY ? '✅ SET' : '⚠️  MISSING (emails will be skipped)');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('  PORT:', PORT);

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
      diagnostics: '/api/diagnostics',
      appointments: '/api/appointments',
      slots: '/api/slots',
    },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Diagnostic endpoint (for debugging on Render)
app.get('/api/diagnostics', (req, res) => {
  const diagnostics = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'not set',
      port: process.env.PORT || 3001,
      openaiApiKey: process.env.OPENAI_API_KEY ? 'SET' : 'MISSING',
      openaiModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo (default)',
      supabaseUrl: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
      supabaseKey: process.env.SUPABASE_KEY ? 'SET' : 'MISSING',
      brevoApiKey: process.env.BREVO_API_KEY ? 'SET' : 'MISSING',
      langfuseConfigured: !!(process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY)
    },
    services: {
      chat: process.env.OPENAI_API_KEY ? 'ready' : 'not configured',
      database: (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) ? 'ready' : 'not configured',
      email: process.env.BREVO_API_KEY ? 'ready' : 'not configured'
    }
  };
  
  res.json(diagnostics);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Diagnostic endpoint: http://localhost:${PORT}/api/diagnostics`);
  
  // Warn if critical env vars are missing
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  WARNING: OPENAI_API_KEY is not set. Chat functionality will not work.');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.warn('⚠️  WARNING: Supabase credentials are missing. Database operations will fail.');
  }
});


