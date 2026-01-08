import fs from 'fs/promises';
import path from 'path';

const DEV_STORE = path.resolve(process.cwd(), '.upstash_dev.json');

// in-memory fallback state
let inMemoryStore = {};
let useInMemory = false;

async function readDev() {
  if (useInMemory) return inMemoryStore;
  try {
    const raw = await fs.readFile(DEV_STORE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    // missing file -> empty
    if (e && e.code === 'ENOENT') return {};
    // read-only or permission errors -> switch to in-memory
    if (e && (e.code === 'EROFS' || e.code === 'EACCES' || e.code === 'EPERM')) {
      useInMemory = true;
      inMemoryStore = {};
      console.warn('lib/redis: filesystem not writable/readable, switching to in-memory dev store', e.code);
      return inMemoryStore;
    }
    throw e;
  }
}

async function writeDev(obj) {
  if (useInMemory) {
    inMemoryStore = obj || {};
    return;
  }
  try {
    await fs.writeFile(DEV_STORE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    if (e && (e.code === 'EROFS' || e.code === 'EACCES' || e.code === 'EPERM')) {
      useInMemory = true;
      inMemoryStore = obj || {};
      console.warn('lib/redis: switched to in-memory store due to write error', e.code);
      return;
    }
    throw e;
  }
}

let redisClient = null;
let usingUpstash = false;

// Accept multiple env var names (some deployments use different names)
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_API_URL || process.env.REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_SECRET || process.env.UPSTASH_REDIS_TOKEN;

// Consider Vercel and NODE_ENV to determine production mode
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL) || process.env.VERCEL_ENV === 'production';

// In production we want to fail fast, but throw only when the store is actually
// used. Log diagnostics here so we can see what envs are present in Vercel logs.
if (isProduction && (!upstashUrl || !upstashToken)) {
  console.error('lib/redis: production mode; Upstash env presence:', {
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    VERCEL: !!process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV || null,
  });
}

if (upstashUrl && upstashToken) {
  // If envs are present, proactively initialize the Upstash client now so
  // failures surface early. We use top-level await here (this module is ESM)
  // so that initialization errors will fail the import in production.
  try {
    await ensureUpstashClient();
  } catch (e) {
    // rethrow so import fails in production; in dev ensureUpstashClient
    // will not throw (it logs and returns false)
    throw e;
  }
}

// If Upstash is not available or initialization failed, use file-backed (or in-memory) dev store
if (!redisClient) {
  if (isProduction) {
    throw new Error('Upstash Redis not available in production; set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  }
  redisClient = {
    async get(key) {
      // Try to initialize Upstash if configured. In production, this will
      // throw if envs are missing.
      try {
        const ok = await ensureUpstashClient();
        if (ok && usingUpstash) {
          // ensureUpstashClient replaced redisClient with Upstash-backed methods
          return await redisClient.get(key);
        }
      } catch (e) {
        // Rethrow in production so callers see the configuration error
        throw e;
      }

      const store = await readDev();
      const raw = store ? store[key] : undefined;
      if (raw === undefined) return null;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch (e) {
          return raw;
        }
      }
      return raw;
    },
    async set(key, value) {
      try {
        const ok = await ensureUpstashClient();
        if (ok && usingUpstash) {
          return await redisClient.set(key, value);
        }
      } catch (e) {
        throw e;
      }

      const store = await readDev();
      store[key] = typeof value === 'string' ? value : JSON.stringify(value);
      await writeDev(store);
      return 'OK';
    }
  };
}

// Lazy initializer for Upstash client to avoid import-time env parsing in the
// upstream library. If Upstash is configured and initialization succeeds, we
// swap the runtime methods to use the real client.
async function ensureUpstashClient() {
  if (usingUpstash) return true;
  if (!upstashUrl || !upstashToken) {
    if (isProduction) {
      // fail when the store is actually required in production
      throw new Error('Missing Upstash Redis configuration in production. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
    }
    return false;
  }
  try {
    const mod = await import('@upstash/redis');
    const Redis = mod.Redis || mod.default?.Redis || mod.default;
    if (!Redis) throw new Error('Upstash Redis export not found');
    const client = new Redis({ url: upstashUrl, token: upstashToken });
    // replace redisClient methods to route to Upstash
    redisClient = {
      async get(key) {
        const v = await client.get(key);
        if (v === null || v === undefined) return null;
        if (typeof v === 'string') {
          try {
            return JSON.parse(v);
          } catch (e) {
            return v;
          }
        }
        return v;
      },
      async set(key, value) {
        const toStore = typeof value === 'string' ? value : JSON.stringify(value);
        return await client.set(key, toStore);
      }
    };
    usingUpstash = true;
    return true;
  } catch (e) {
    // If production, surface the error. In dev, just log and keep dev store.
    if (isProduction) {
      console.error('lib/redis: failed to initialize Upstash client in production:', e && e.message ? e.message : e);
      throw e;
    }
    console.error('lib/redis: lazy Upstash init failed, remaining on dev store:', e && e.message ? e.message : e);
    return false;
  }
}

export const redis = redisClient;
export const _usingUpstash = usingUpstash;
