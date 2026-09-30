import React, { useEffect, useState } from 'react';
import { isSessionUnlocked, setSessionUnlocked, verifyPassword } from '../auth/gate';

interface PasswordGateProps {
  children: React.ReactNode;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ children }) => {
  const [unlocked, setUnlocked] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    setUnlocked(isSessionUnlocked());

    const handleAuthChange = () => setUnlocked(isSessionUnlocked());
    window.addEventListener('admin_auth_change', handleAuthChange);
    return () => window.removeEventListener('admin_auth_change', handleAuthChange);
  }, []);

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setIsVerifying(true);

    try {
      if (await verifyPassword(inputPassword)) {
        setSessionUnlocked(true);
        setUnlocked(true);
        setInputPassword('');
      } else {
        setErrorMessage('パスワードが正しくありません。');
      }
    } catch (error) {
      setErrorMessage('照合中にエラーが発生しました。');
      console.error(error);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLock = () => {
    setSessionUnlocked(false);
    setUnlocked(false);
    setInputPassword('');
  };

  if (!unlocked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div
          id="admin-auth-gate-card"
          className="w-full max-w-md p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl text-center"
        >
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-2xl">
            🔒
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            管理者パスワード認証
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 mb-6">
            大会設定やスコア登録を行うには、管理者用の共有パスワードを入力してください。
          </p>

          <form onSubmit={handleUnlock} className="space-y-4 text-left">
            <div>
              <label
                htmlFor="admin-password-input"
                className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                パスワード
              </label>
              <input
                id="admin-password-input"
                type="password"
                placeholder="共有パスワードを入力"
                value={inputPassword}
                onChange={(event) => setInputPassword(event.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-base focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                autoComplete="current-password"
                autoFocus
              />
            </div>

            {errorMessage && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400 font-medium">
                {errorMessage}
              </p>
            )}

            <button
              id="admin-unlock-btn"
              type="submit"
              disabled={isVerifying || !inputPassword}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-base shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isVerifying ? '照合中...' : '管理画面を開く'}
            </button>
          </form>

          <p className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
            閲覧のみの場合は、閲覧用URLをご利用ください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-bold text-zinc-700 dark:text-zinc-300">
            管理画面を利用中
          </span>
          <span className="text-xs text-zinc-500 hidden sm:inline">
            （タブを閉じるまで有効）
          </span>
        </div>
        <button
          type="button"
          onClick={handleLock}
          className="text-sm text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 py-1.5 px-3 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 font-bold transition-colors cursor-pointer"
        >
          🔒 ロックする
        </button>
      </div>
      {children}
    </div>
  );
};
