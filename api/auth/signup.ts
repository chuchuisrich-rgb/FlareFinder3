// Use a runtime-resolvable JS module for serverless Node execution
// require the CommonJS build when running under Node
// lazily import the runtime redis module inside the handler to support ESM
let _redis: any = null;
async function getRedis() {
  if (_redis) return _redis;
  try {
    const mod: any = await import('../../lib/redis.js');
    _redis = mod.redis;
    return _redis;
  } catch (err) {
    console.error('Failed to import redis module', err);
    throw err;
  }
}

// Basic signup handler using Upstash Redis
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const key = `user:${email.toLowerCase()}`;
    try {
      const redis = await getRedis();
      const existing = await redis.get(key);
      if (existing) {
        return res.status(409).json({ error: 'Account already exists' });
      }
    } catch (e: any) {
      console.warn('redis.get failed', e?.message || e);
    }

    // attach a consent object for the current disclosure version
    // import the version constant from the centralized disclosure file
    let CURRENT_DISCLOSURE_VERSION = '1.0';
    try {
      // runtime import from the src content so future versions can be managed there
      // note: this is optional; fall back to literal above if import fails
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = await import('../../src/content/legal/disclosure_v1');
      if (mod && mod.CURRENT_DISCLOSURE_VERSION) CURRENT_DISCLOSURE_VERSION = mod.CURRENT_DISCLOSURE_VERSION;
    } catch (e) {
      // ignore - use fallback
    }

    // hash password before storing
    // import bcryptjs synchronously
    const bcrypt = (await import('bcryptjs')).default;
    const password_hash = bcrypt.hashSync(password, 10);

    const user = {
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      password_hash,
      pro_until: 0,
      onboardingCompleted: false,
      foodSensitivities: [],
      consent: {
        version: CURRENT_DISCLOSURE_VERSION,
        granted_at: new Date().toISOString(),
        disclosure_type: 'medical_privacy'
      }
    };

    try {
      const redis = await getRedis();
      await redis.set(key, user);
    } catch (e: any) {
      console.warn('redis.set failed', e?.message || e);
      return res.status(500).json({ error: 'failed to persist user' });
    }

    return res.status(201).json({ ok: true, user });
  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'internal' });
  }
}
