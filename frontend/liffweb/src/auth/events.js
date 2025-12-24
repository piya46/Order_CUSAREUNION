// src/auth/events.js
const listeners = new Set();

export function onAuthExpired(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyAuthExpired(reason = '401') {
  for (const fn of [...listeners]) {
    try { fn(reason); } catch {}
  }
}