-- =====================================================
-- Cake Booking System - Supabase Database Setup
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- =====================================================

-- Create the bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_name TEXT NOT NULL,
    student_email TEXT DEFAULT '',
    class TEXT NOT NULL,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    penalty_type TEXT NOT NULL CHECK (penalty_type IN ('cake', 'essay', 'pushups')),
    completed BOOLEAN DEFAULT FALSE,
    deleted BOOLEAN DEFAULT FALSE,
    email_consent BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (date);
CREATE INDEX IF NOT EXISTS idx_bookings_class ON bookings (class);
CREATE INDEX IF NOT EXISTS idx_bookings_deleted ON bookings (deleted);

-- Enable Row Level Security (RLS)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Allow read access for everyone (students need to see available slots)
CREATE POLICY "Allow public read" ON bookings
    FOR SELECT USING (deleted = false);

-- Allow insert for everyone (students can book)
CREATE POLICY "Allow public insert" ON bookings
    FOR INSERT WITH CHECK (true);

-- Allow update/delete only via service key (admin only)
-- The service key bypasses RLS, so these are protected by default.

-- Optional: Auto-cleanup function (runs via Supabase cron or Vercel cron)
-- Uncomment if you want Supabase-side cleanup:
--
-- CREATE OR REPLACE FUNCTION cleanup_old_bookings()
-- RETURNS void AS $$
-- BEGIN
--     DELETE FROM bookings
--     WHERE date < CURRENT_DATE - INTERVAL '7 days'
--     AND completed = true;
--
--     UPDATE bookings SET student_email = ''
--     WHERE date < CURRENT_DATE - INTERVAL '7 days';
-- END;
-- $$ LANGUAGE plpgsql;
