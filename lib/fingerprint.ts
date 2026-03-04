/**
 * Device fingerprint — client side only.
 *
 * Generates a stable ~40-char hex ID from browser properties and caches it
 * in localStorage so it survives page refreshes but is unique per device/browser.
 */

const LS_KEY = 'lipsync_fp';

/** Simple non-crypto hash (djb2) over a string */
function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h.toString(16).padStart(8, '0');
}

/** Collect stable-ish browser signals */
function collect(): string {
  const nav = navigator;
  const scr = screen;
  const parts = [
    nav.userAgent,
    nav.language,
    nav.languages?.join(',') ?? '',
    String(nav.hardwareConcurrency ?? ''),
    String(nav.maxTouchPoints ?? ''),
    String(scr.width),
    String(scr.height),
    String(scr.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    Intl.DateTimeFormat().resolvedOptions().locale,
  ];
  return parts.join('|');
}

export function getFingerprint(): string {
  if (typeof window === 'undefined') return 'ssr';

  const cached = localStorage.getItem(LS_KEY);
  if (cached) return cached;

  const raw    = collect();
  const fp     = hash(raw) + hash(raw.split('').reverse().join('')) + hash(navigator.userAgent ?? raw);
  const result = fp.slice(0, 24); // 24-char hex

  localStorage.setItem(LS_KEY, result);
  return result;
}
