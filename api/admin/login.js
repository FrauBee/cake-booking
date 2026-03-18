export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { passwordHash } = req.body;
    const expectedHash = '95017ef92c621c2474a2d93d53c18d8e24a60e2aac993ccc5030a5dbd168c4ba';

    if (passwordHash === expectedHash) {
        return res.status(200).json({ success: true });
    }

    return res.status(401).json({ error: 'Invalid password' });
}
