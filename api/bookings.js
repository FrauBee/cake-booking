import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            // Get all non-deleted bookings
            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('deleted', false)
                .order('date', { ascending: true });

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === 'POST') {
            const booking = req.body;

            // Validate required fields
            if (!booking.studentName || !booking.class || !booking.date || !booking.penaltyType) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const newBooking = {
                student_name: booking.studentName,
                student_email: booking.studentEmail || '',
                class: booking.class,
                date: booking.date,
                time: booking.time,
                penalty_type: booking.penaltyType,
                completed: false,
                deleted: false,
                email_consent: booking.emailConsent || false,
                consent_timestamp: booking.consentTimestamp || null
            };

            const { data, error } = await supabase
                .from('bookings')
                .insert([newBooking])
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json(data);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
