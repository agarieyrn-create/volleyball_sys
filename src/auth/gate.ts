/**
 * Shared tournament administrator password.
 * Only the SHA-256 hash is stored in the client bundle.
 */
export const ADMIN_PASSWORD_HASH =
  'dd7a54c0713185482950f511af353155946925a6c9a5943c1b3abbaef8f25430';
export const DEFAULT_ADMIN_PASSWORD_HASH = ADMIN_PASSWORD_HASH;

const SESSION_AUTH_KEY = 'volleyball_admin_unlocked';

export async function hashPassword(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(input: string): Promise<boolean> {
  if (!input) return false;
  const hash = await hashPassword(input.trim());
  return hash.toLowerCase() === ADMIN_PASSWORD_HASH.toLowerCase();
}

export function isSessionUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SESSION_AUTH_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSessionUnlocked(unlocked: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (unlocked) {
      sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
    } else {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
    }
    window.dispatchEvent(new Event('admin_auth_change'));
  } catch (error) {
    console.error('Failed to set session auth state', error);
  }
}
