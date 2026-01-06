import { Redis } from '@upstash/redis';
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

// Fail fast in production when Upstash envs are not provided
if (isProduction && (!upstashUrl || !upstashToken)) {
  throw new Error('Missing Upstash Redis configuration in production. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
}

if (upstashUrl && upstashToken) {
  try {
    const client = new Redis({ url: upstashUrl, token: upstashToken });
    usingUpstash = true;
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
  } catch (e) {
    // In production, fail loudly so deployments are fixed instead of silently falling back
    if (isProduction) {
      console.error('lib/redis: Upstash client initialization failed in production:', e && e.message ? e.message : e);
      throw e;
    }
    // In dev, log and fall back to the file-backed or in-memory dev store
    console.error('lib/redis: failed to initialize Upstash client - falling back to dev store.', e && e.message ? e.message : e);
  }
}

// If Upstash is not available or initialization failed, use file-backed (or in-memory) dev store
if (!redisClient) {
  if (isProduction) {
    throw new Error('Upstash Redis not available in production; set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  }
  redisClient = {
    async get(key) {
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
      const store = await readDev();
      store[key] = typeof value === 'string' ? value : JSON.stringify(value);
      await writeDev(store);
      return 'OK';
    }
  };
}

export const redis = redisClient;
export const _usingUpstash = usingUpstash;
