import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

/**
 * GDPR Auto-Cleanup: Delete bookings older than 7 days past their date.
 * Set this up as a Vercel Cron Job (vercel.json) to run daily.
 */
export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        // Delete (hard delete) old completed bookings
        const { data, error } = await supabase
            .from('bookings')
            .delete()
            .lt('date', cutoffStr)
            .eq('completed', true);

        if (error) throw error;

        // Also clear emails from old non-completed bookings
        const { error: updateError } = await supabase
            .from('bookings')
            .update({ student_email: '' })
            .lt('date', cutoffStr);

        if (updateError) throw updateError;

        return res.status(200).json({
            message: 'Cleanup complete',
            cutoff: cutoffStr,
            deleted: data?.length || 0
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        return res.status(500).json({ error: 'Cleanup failed' });
    }
}
