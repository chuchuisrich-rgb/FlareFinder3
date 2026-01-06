import fs from 'fs/promises';
import path from 'path';

// This file provides a local file-backed store for development only.
// It does not depend on any external KV provider; used only for local dev.
const kv: any = null;

const DEV_STORE = path.resolve(process.cwd(), '.vercel_kv_dev.json');

async function readDevStore() {
  try {
    const raw = await fs.readFile(DEV_STORE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e: any) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

async function writeDevStore(obj: any) {
  await fs.writeFile(DEV_STORE, JSON.stringify(obj, null, 2), 'utf8');
}

export async function kvGet(key: string) {
  if (kv) {
    return await kv.get(key);
  }
  const store = await readDevStore();
  return store[key];
}

export async function kvSet(key: string, value: any) {
  if (kv) {
    return await kv.set(key, value);
  }
  const store = await readDevStore();
  store[key] = value;
  await writeDevStore(store);
  return true;
}

export async function kvDel(key: string) {
  if (kv) {
    return await kv.del(key);
  }
  const store = await readDevStore();
  delete store[key];
  await writeDevStore(store);
  return true;
}

export function hasKV() {
  return Boolean(kv);
}
