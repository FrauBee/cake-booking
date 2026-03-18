import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    try {
        if (req.method === 'PATCH') {
            const updates = req.body;
            const allowedFields = ['completed', 'deleted'];
            const sanitized = {};

            for (const key of allowedFields) {
                if (updates[key] !== undefined) {
                    sanitized[key] = updates[key];
                }
            }

            // If deleting, also clear personal data (GDPR)
            if (sanitized.deleted) {
                sanitized.student_email = '';
            }

            const { data, error } = await supabase
                .from('bookings')
                .update(sanitized)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === 'DELETE') {
            // Soft delete + GDPR cleanup
            const { data, error } = await supabase
                .from('bookings')
                .update({ deleted: true, student_email: '' })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return res.status(200).json(data);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
