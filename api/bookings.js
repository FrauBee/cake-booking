import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const PENALTY_LABELS = { cake: 'Cake 🎂', essay: 'Essay ✍️', pushups: 'Push-ups 💪' };

async function notifyTeacher(booking) {
    if (!resend) return;

    const penaltyLabel = PENALTY_LABELS[booking.penalty_type] || booking.penalty_type;
    const dateFormatted = new Date(booking.date + 'T12:00:00').toLocaleDateString('de-DE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    try {
        await resend.emails.send({
            from: 'Cake Booking <onboarding@resend.dev>',
            to: process.env.TEACHER_EMAIL || 's.borgwardt@gso.schule.koeln',
            subject: `New Booking: ${booking.student_name} - ${penaltyLabel} (${booking.class})`,
            html: `
                <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
                    <h2 style="color: #7fb69a;">🎂 New Cake Booking!</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666;">Student:</td><td style="padding: 8px 0; font-weight: 600;">${booking.student_name}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;">Class:</td><td style="padding: 8px 0; font-weight: 600;">${booking.class}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;">Type:</td><td style="padding: 8px 0; font-weight: 600;">${penaltyLabel}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;">Date:</td><td style="padding: 8px 0; font-weight: 600;">${dateFormatted}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;">Time:</td><td style="padding: 8px 0; font-weight: 600;">${booking.time}</td></tr>
                    </table>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
                    <p style="color: #999; font-size: 13px;">Cake Distribution System</p>
                </div>
            `
        });
    } catch (e) {
        console.error('Email notification failed:', e);
    }
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
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

            notifyTeacher(data);

            return res.status(201).json(data);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
