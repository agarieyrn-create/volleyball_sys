// デフォルトパスワード 'admin' の SHA-256 ハッシュ値
// 平文はコード内に保持しない
export const DEFAULT_ADMIN_PASSWORD_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
export const ADMIN_PASSWORD_HASH = DEFAULT_ADMIN_PASSWORD_HASH;

const SESSION_AUTH_KEY = 'volleyball_admin_unlocked';
const CUSTOM_HASH_KEY = 'volleyball_admin_password_hash';

/**
 * 現在設定されている管理者パスワードのSHA-256ハッシュを取得
 */
export function getCurrentAdminHash(): string {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_PASSWORD_HASH;
  try {
    const custom = localStorage.getItem(CUSTOM_HASH_KEY);
    return custom && custom.length === 64 ? custom : DEFAULT_ADMIN_PASSWORD_HASH;
  } catch {
    return DEFAULT_ADMIN_PASSWORD_HASH;
  }
}

/**
 * カスタムパスワードが設定されているか
 */
export function isCustomPasswordSet(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!localStorage.getItem(CUSTOM_HASH_KEY);
  } catch {
    return false;
  }
}

/**
 * 管理者パスワードを新規設定・変更する
 */
export async function updateAdminPassword(newPassword: string): Promise<void> {
  if (!newPassword || newPassword.trim().length === 0) {
    throw new Error('パスワードを入力してください');
  }
  const hash = await hashPassword(newPassword.trim());
  localStorage.setItem(CUSTOM_HASH_KEY, hash);
}

/**
 * パスワードを初期値('admin')にリセットする
 */
export function resetAdminPasswordToDefault(): void {
  localStorage.removeItem(CUSTOM_HASH_KEY);
}

/**
 * 入力文字列の SHA-256 16進ハッシュを計算する
 */
export async function hashPassword(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * 入力パスワードが設定ハッシュ値と一致するか検証
 */
export async function verifyPassword(input: string): Promise<boolean> {
  if (!input) return false;
  const hash = await hashPassword(input.trim());
  const expected = getCurrentAdminHash();
  return hash.toLowerCase() === expected.toLowerCase();
}

/**
 * 開発・管理者用: 任意文字列のハッシュ値をコンソールに出力する関数
 */
export async function logPasswordHashForDev(plainPassword: string): Promise<string> {
  const hash = await hashPassword(plainPassword);
  console.info(`[Dev Password Hash Generator] "${plainPassword}" -> ${hash}`);
  return hash;
}

/**
 * 現在のセッションで管理権限が解除されているか確認
 */
export function isSessionUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SESSION_AUTH_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * セッションのロック解除状態を更新
 */
export function setSessionUnlocked(unlocked: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (unlocked) {
      sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
    } else {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
    }
    // 状態同期用イベント発火
    window.dispatchEvent(new Event('admin_auth_change'));
  } catch (e) {
    console.error('Failed to set session auth state', e);
  }
}
