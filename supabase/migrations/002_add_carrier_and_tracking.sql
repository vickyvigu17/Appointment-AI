-- Add carrier_name column if it does not exist
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS carrier_name TEXT;

-- Add tracking_code column for human-friendly appointment identifiers
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(7);

-- Ensure tracking_code remains unique when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_tracking_code
ON appointments(tracking_code)
WHERE tracking_code IS NOT NULL;

