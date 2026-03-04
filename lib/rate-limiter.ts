/**
 * Server-side rate limiter — file-backed so it persists across dev restarts.
 *
 * Stores data in .rate-limit.json at the project root.
 * Each entry: { count: number, firstSeen: ISO string }
 */

import fs   from 'fs';
import path from 'path';

const MAX_REQUESTS = 20;
const DB_PATH      = path.join(process.cwd(), '.rate-limit.json');

type Store = Record<string, { count: number; firstSeen: string }>;

function read(): Store {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as Store;
    }
  } catch {/* corrupted — start fresh */}
  return {};
}

function write(store: Store): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch { /* non-fatal */ }
}

export interface RateLimitResult {
  allowed:   boolean;
  count:     number;   // current usage (after this request if allowed)
  remaining: number;   // how many left after this request
  limit:     number;
}

/**
 * Check and increment the counter for a fingerprint.
 * Returns { allowed: false } when the limit is already reached.
 */
export function checkRateLimit(fingerprint: string): RateLimitResult {
  const store = read();
  const entry = store[fingerprint] ?? { count: 0, firstSeen: new Date().toISOString() };

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, count: entry.count, remaining: 0, limit: MAX_REQUESTS };
  }

  entry.count += 1;
  store[fingerprint] = entry;
  write(store);

  return {
    allowed:   true,
    count:     entry.count,
    remaining: MAX_REQUESTS - entry.count,
    limit:     MAX_REQUESTS,
  };
}

/** Admin helper — reset a specific fingerprint (for testing) */
export function resetFingerprint(fingerprint: string): void {
  const store = read();
  delete store[fingerprint];
  write(store);
}

/** Admin helper — get all usage data */
export function getAllUsage(): Store {
  return read();
}
