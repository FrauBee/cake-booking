export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { passwordHash } = req.body;
    const expectedHash = '4885d164710a85a004e2187881233a7aa4459170209dd9938759e70aa9dd0c0d';

    if (passwordHash === expectedHash) {
        return res.status(200).json({ success: true });
    }

    return res.status(401).json({ error: 'Invalid password' });
}
