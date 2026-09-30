import React, { useEffect, useState } from 'react';
import {
  isCustomPasswordSet,
  isSessionUnlocked,
  resetAdminPasswordToDefault,
  setSessionUnlocked,
  updateAdminPassword,
  verifyPassword,
} from '../auth/gate';

interface PasswordGateProps {
  children: React.ReactNode;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ children }) => {
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [inputPassword, setInputPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // パスワード変更モーダル/パネル状態
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [changeMsg, setChangeMsg] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    setUnlocked(isSessionUnlocked());

    const handleAuthChange = () => {
      setUnlocked(isSessionUnlocked());
    };
    window.addEventListener('admin_auth_change', handleAuthChange);
    return () => {
      window.removeEventListener('admin_auth_change', handleAuthChange);
    };
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsVerifying(true);

    try {
      const isValid = await verifyPassword(inputPassword);
      if (isValid) {
        setSessionUnlocked(true);
        setUnlocked(true);
      } else {
        setErrorMessage('パスワードが正しくありません。');
      }
    } catch (err) {
      setErrorMessage('照合中にエラーが発生しました。');
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLock = () => {
    setSessionUnlocked(false);
    setUnlocked(false);
    setInputPassword('');
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeMsg(null);

    if (!newPassword || newPassword.length < 4) {
      setChangeMsg({ text: '新しいパスワードは4文字以上で入力してください。', isError: true });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangeMsg({ text: '確認用パスワードが一致しません。', isError: true });
      return;
    }

    try {
      await updateAdminPassword(newPassword);
      setChangeMsg({ text: '管理者パスワードを変更しました。次回以降新しいパスワードで認証します。', isError: false });
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setIsChangingPassword(false);
        setChangeMsg(null);
      }, 2000);
    } catch (err) {
      setChangeMsg({ text: '変更に失敗しました。', isError: true });
      console.error(err);
    }
  };

  const handleResetPassword = () => {
    if (window.confirm('管理者パスワードを初期値「admin」に戻しますか？')) {
      resetAdminPasswordToDefault();
      setChangeMsg({ text: '初期パスワード「admin」にリセットしました。', isError: false });
      setTimeout(() => {
        setIsChangingPassword(false);
        setChangeMsg(null);
      }, 1500);
    }
  };

  if (!unlocked) {
    const hasCustom = isCustomPasswordSet();

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
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 mb-6">
            大会設定・スコア登録・トーナメント進行を操作するには認証が必要です。
          </p>

          <form onSubmit={handleUnlock} className="space-y-4 text-left">
            <div>
              <label
                htmlFor="admin-password-input"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                パスワード
              </label>
              <input
                id="admin-password-input"
                type="password"
                placeholder={hasCustom ? 'パスワードを入力' : 'パスワードを入力 (初期値: admin)'}
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                autoFocus
              />
            </div>

            {errorMessage && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                {errorMessage}
              </p>
            )}

            <button
              id="admin-unlock-btn"
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isVerifying ? '照合中...' : 'ロック解除'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1.5 text-left">
            <div className="flex items-center gap-1.5">
              <span>ℹ️</span>
              <span>
                {hasCustom ? (
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">独自パスワード設定中</span>
                ) : (
                  <span>初期パスワードは <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-bold text-zinc-800 dark:text-zinc-200">admin</code> です。</span>
                )}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              ※一度ログインすると、ブラウザタブを閉じるまで認証状態が保持されます。席を離れる際は「🔒 ロックする」を押してください。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 px-2 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-bold text-zinc-700 dark:text-zinc-300">
            管理者として認証済み
          </span>
          <span className="text-[11px] text-zinc-500 hidden sm:inline">
            （タブを閉じるまで有効）
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsChangingPassword(!isChangingPassword)}
            className="text-xs text-zinc-600 hover:text-zinc-800 dark:text-zinc-300 dark:hover:text-white px-2.5 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-semibold cursor-pointer"
          >
            🔑 パスワード変更
          </button>
          <button
            type="button"
            onClick={handleLock}
            className="text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 flex items-center gap-1.5 py-1 px-3 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 font-bold transition-colors cursor-pointer"
            title="今すぐログアウトしてパスワードロック状態に戻す"
          >
            🔒 ロックする（ログアウト）
          </button>
        </div>
      </div>

      {/* パスワード変更パネル */}
      {isChangingPassword && (
        <div className="mb-4 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>🔑</span>
              <span>管理者パスワードの変更</span>
            </h4>
            <button
              type="button"
              onClick={() => setIsChangingPassword(false)}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              ✕ 閉じる
            </button>
          </div>

          <form onSubmit={handleChangePasswordSubmit} className="space-y-3 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                新しいパスワード（4文字以上）
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="新しいパスワード"
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                新しいパスワード（確認用）
              </label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="もう一度入力"
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
              />
            </div>

            {changeMsg && (
              <p className={`text-xs font-bold ${changeMsg.isError ? 'text-red-500' : 'text-emerald-500'}`}>
                {changeMsg.text}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                パスワードを保存
              </button>
              {isCustomPasswordSet() && (
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  初期値(admin)にリセット
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {children}
    </div>
  );
};
