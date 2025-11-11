-- ============================================
-- QUICK START: Copy and paste this entire file
-- into Supabase SQL Editor and click "Run"
-- ============================================

-- Create enum type for appointment types
CREATE TYPE appointment_type AS ENUM ('live', 'drop');

-- Create appointments table
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    type appointment_type NOT NULL,
    vendor_name TEXT NOT NULL,
    vendor_email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, hour, type, vendor_email) -- Prevent duplicate bookings
);

-- Create blocked_slots table
CREATE TABLE blocked_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, hour) -- One block per slot
);

-- Create indexes for performance
CREATE INDEX idx_appointments_date_hour ON appointments(date, hour);
CREATE INDEX idx_appointments_vendor_email ON appointments(vendor_email);
CREATE INDEX idx_blocked_slots_date_hour ON blocked_slots(date, hour);

-- Enable Row Level Security (optional, but good practice)
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for prototype)
CREATE POLICY "Allow all operations on appointments" ON appointments
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on blocked_slots" ON blocked_slots
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- ✅ Done! Your tables are ready.
-- ============================================




