// src/lib/session.ts
export const TOKEN_KEY = "aw_token";
export const USER_KEY  = "admin_user";

export type UserPayload = {
  username?: string;
  name?: string;
  roles?: string[];
  permissions?: string[];
};

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getUser(): UserPayload {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "{}"); }
  catch { return {}; }
}

export function setSession(token: string, user: UserPayload) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
}

export function clearSession(broadcast = true) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (broadcast) localStorage.setItem("aw_logout", String(Date.now())); // cross-tab notify
}

export function bindCrossTabLogout(handler: () => void) {
  window.addEventListener("storage", (e) => {
    if (e.key === "aw_logout") handler();
  });
}