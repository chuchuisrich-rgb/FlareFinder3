import { Redis } from '@upstash/redis';
import fs from 'fs/promises';
import path from 'path';

const DEV_STORE = path.resolve(process.cwd(), '.upstash_dev.json');

async function readDev() {
  try {
    const raw = await fs.readFile(DEV_STORE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}
async function writeDev(obj) {
  await fs.writeFile(DEV_STORE, JSON.stringify(obj, null, 2), 'utf8');
}

let redisClient = null;
let usingUpstash = false;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const client = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  usingUpstash = true;
  // normalize interface so get returns parsed objects when possible and set accepts objects
  redisClient = {
    async get(key) {
      const v = await client.get(key);
      if (v === null || v === undefined) return null;
      // if Upstash returned a string that encodes JSON, try parse, otherwise return raw
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
      // ensure we store strings for objects to be consistent
      const toStore = typeof value === 'string' ? value : JSON.stringify(value);
      return await client.set(key, toStore);
    }
  };
} else {
  // local file-backed fallback for development
  redisClient = {
    async get(key) {
      const store = await readDev();
      // store contains string values (we write JSON strings below)
      const raw = store[key];
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
