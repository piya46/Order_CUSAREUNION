// src/utils/profileCache.js
const PROFILE_KEY = 'aw_profile_v1';
const ALLOW_KEY   = 'aw_profile_allow_v1';

export function isProfileCacheAllowed() {
  try { return localStorage.getItem(ALLOW_KEY) === '1'; } catch { return false; }
}
export function setProfileCacheAllowed(v) {
  try { localStorage.setItem(ALLOW_KEY, v ? '1' : '0'); } catch {}
}
export function getSavedProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch { return {}; }
}
export function saveProfile(obj) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(obj || {})); } catch {}
}
export function clearProfile() {
  try { localStorage.removeItem(PROFILE_KEY); } catch {}
}