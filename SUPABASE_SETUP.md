# 🗄️ Supabase Setup Guide

Follow these steps to set up your Supabase database:

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Click **"New Project"**
4. Fill in:
   - **Project Name**: `appointment-booking-system` (or any name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is fine for prototype
5. Click **"Create new project"**
6. Wait 2-3 minutes for project to initialize

## Step 2: Run Database Migration

1. In your Supabase project dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste it into the SQL Editor
5. Click **"Run"** (or press Ctrl+Enter)
6. You should see: **"Success. No rows returned"**

✅ **Tables Created:**
- `appointments` - Stores all appointments
- `blocked_slots` - Stores blocked time slots

## Step 3: Get Your Credentials

1. In Supabase dashboard, click **"Settings"** (gear icon) in left sidebar
2. Click **"API"** under Project Settings
3. You'll see:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (keep this secret!)

## Step 4: Update Backend .env File

1. Go to your project:
   ```bash
   cd /home/vickyvigu17/appointment-booking-system/backend
   ```

2. Create `.env` file:
   ```bash
   cp .env.example .env
   # OR create manually:
   touch .env
   ```

3. Edit `.env` file with your Supabase credentials:
   ```env
   PORT=3001
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   OPENAI_API_KEY=your_openai_api_key_here
   NODE_ENV=development
   ```

   **Replace:**
   - `SUPABASE_URL` with your Project URL
   - `SUPABASE_KEY` with your anon/public key
   - `OPENAI_API_KEY` with your OpenAI API key

## Step 5: Verify Tables

1. In Supabase dashboard, click **"Table Editor"** in left sidebar
2. You should see:
   - ✅ `appointments` table
   - ✅ `blocked_slots` table

## Step 6: Test Connection (Optional)

You can test if your connection works by running:

```bash
cd /home/vickyvigu17/appointment-booking-system/backend
npm install
node -e "
import('dotenv').then(dotenv => {
  dotenv.config();
  import('@supabase/supabase-js').then(({ createClient }) => {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    supabase.from('appointments').select('count').then(r => {
      console.log('✅ Connection successful!', r);
    }).catch(e => {
      console.error('❌ Connection failed:', e.message);
    });
  });
});
"
```

## 🎯 Quick Checklist

- [ ] Supabase project created
- [ ] Migration script executed successfully
- [ ] Tables visible in Table Editor
- [ ] Credentials copied (URL and anon key)
- [ ] `.env` file created with correct values
- [ ] OpenAI API key added to `.env`

## 🔒 Security Notes

- **Never commit `.env` file to Git** (it's in `.gitignore`)
- Use **anon/public key** for client-side operations
- Use **service_role key** only for server-side admin operations (not needed for this prototype)
- Keep your database password safe

## 📝 Next Steps

After Supabase is set up:
1. Make sure you have OpenAI API key
2. Update `.env` file with all credentials
3. Start backend: `cd backend && npm install && npm start`
4. Start frontend: `cd frontend && npm install && npm start`

## 🆘 Troubleshooting

**Error: "relation does not exist"**
- Make sure you ran the migration script completely
- Check that tables appear in Table Editor

**Error: "Invalid API key"**
- Verify you're using the **anon/public key**, not service_role key
- Check that URL and key are correct in `.env`

**Error: "permission denied"**
- Check that RLS policies were created (they're in the migration script)
- Verify you're using the anon key, not service_role key




