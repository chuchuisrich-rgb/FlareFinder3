let _redis: any = null;
async function getRedis() {
  if (_redis) return _redis;
  try {
    const mod = await import('../../lib/redis.js');
    _redis = mod.redis;
    return _redis;
  } catch (err) {
    console.error('Failed to import redis module', err);
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'email and password required' });
      }

      const key = `user:${email.toLowerCase()}`;
      try {
        const redis = await getRedis();
        const raw = await redis.get(key);
        if (!raw) {
          return res.status(404).json({ error: 'User not present. Please create an account.' });
        }

        const user: any = raw; // lib/redis returns parsed objects when possible

        // use bcrypt to compare provided password with stored hash
        const bcrypt = (await import('bcryptjs')).default;
        const match = bcrypt.compareSync(password, String(user.password_hash));
        if (!match) {
          return res.status(401).json({ error: 'Invalid credentials. Please try again.' });
        }

        return res.status(200).json({ ok: true, user });
      } catch (e: any) {
        console.warn('redis.get failed', e?.message || e);
        return res.status(500).json({ error: 'internal' });
      }
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'internal' });
  }
}
