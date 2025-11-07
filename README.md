# 🤖 AI-Assisted Appointment Booking System

A full-stack prototype for DC (Distribution Center) inbound appointment booking with AI-powered natural language interface.

## 🎯 Features

- **AI Chat Interface**: Book, reschedule, or cancel appointments using natural language
- **Smart Slot Management**: Enforces business rules (max 1 live, max 10 drop per slot)
- **Real-time Calendar**: Visual representation of slot availability
- **Alternative Suggestions**: LLM suggests next available slots when requested slot is unavailable
- **IST Timezone**: All times are in Indian Standard Time

## 🏗️ Architecture

- **Frontend**: React with chat UI and calendar view
- **Backend**: Node.js + Express REST API
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4 for natural language understanding

## 📦 Project Structure

```
appointment-booking-system/
├── backend/          # Node.js + Express API
├── frontend/         # React application
├── supabase/         # Database migrations
└── README.md
```

## 🚀 Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key

### 1. Database Setup (Supabase)

1. Create a new Supabase project
2. Go to SQL Editor
3. Run the migration script: `supabase/migrations/001_initial_schema.sql`
4. Note your Supabase URL and anon key from Settings > API

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` with your credentials:
```env
PORT=3001
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=development
```

Start the server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env` file (optional, defaults to localhost:3001):
```env
REACT_APP_API_URL=http://localhost:3001/api
```

Start the frontend:
```bash
npm start
```

The app will open at `http://localhost:3000`

## 📡 API Endpoints

### Chat (LLM Integration)
- `POST /api/appointments/chat` - Send natural language message

### Appointments
- `GET /api/appointments/my-appointments?vendor_email=...` - Get user's appointments
- `POST /api/appointments` - Create appointment (direct API)
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Cancel appointment

### Slots
- `GET /api/slots?date=YYYY-MM-DD` - Get slot availability for a date

## 🧠 LLM Integration

The system uses OpenAI GPT-4 to:
1. Parse natural language requests
2. Extract structured intent (action, date, hour, type)
3. Handle ambiguous requests with clarifying questions
4. Suggest alternatives when slots are unavailable

### Example Interactions

**Booking:**
- User: "Book a live appointment tomorrow at 8 AM"
- LLM extracts: `{action: "create", date: "2025-01-15", hour: 8, type: "live"}`

**Rescheduling:**
- User: "Move my appointment to 2 PM"
- LLM extracts: `{action: "update", hour: 14}`

**Canceling:**
- User: "Cancel my appointment"
- LLM extracts: `{action: "delete"}`

## 📋 Business Rules

1. **Timeslots**: 24 hourly slots (0-23) per day
2. **Appointment Types**:
   - `live`: Max 1 per slot
   - `drop`: Max 10 per slot
   - Both can coexist in the same slot
3. **Blocked Slots**: Cannot book if slot is blocked
4. **Past Dates**: Cannot book appointments in the past
5. **Timezone**: All times in IST (Asia/Kolkata)

## 🧪 Testing

### Test the LLM Integration

1. Start backend and frontend
2. Open the chat interface
3. Provide vendor name and email when prompted
4. Try natural language commands:
   - "Book a drop appointment today at 3 PM"
   - "What are my appointments?"
   - "Cancel my appointment"
   - "Reschedule to tomorrow at 10 AM"

### Direct API Testing

```bash
# Get slots for a date
curl "http://localhost:3001/api/slots?date=2025-01-15"

# Create appointment (direct)
curl -X POST http://localhost:3001/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-15",
    "hour": 10,
    "type": "live",
    "vendor_name": "Test Vendor",
    "vendor_email": "test@example.com"
  }'
```

## 🔍 LLM Evaluation

The system logs LLM interactions for evaluation. Check backend console for:
- User messages
- Extracted intents
- LLM responses
- Execution results

## 📝 Environment Variables

### Backend (.env)
- `PORT` - Server port (default: 3001)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Supabase anon key
- `OPENAI_API_KEY` - OpenAI API key
- `NODE_ENV` - Environment (development/production)

### Frontend (.env)
- `REACT_APP_API_URL` - Backend API URL (default: http://localhost:3001/api)

## 🛠️ Development

### Backend
- Uses ES6 modules (`type: "module"`)
- Conversation history stored in memory (use Redis/DB in production)
- Error handling with business rule validation

### Frontend
- React 18 with functional components
- Axios for API calls
- date-fns for date manipulation
- Responsive design with CSS Grid

## 📄 License

MIT

## 🤝 Contributing

This is a prototype. For production use, consider:
- Authentication & authorization
- Persistent conversation history (Redis/DB)
- Rate limiting
- Input validation & sanitization
- Error monitoring
- Unit & integration tests

