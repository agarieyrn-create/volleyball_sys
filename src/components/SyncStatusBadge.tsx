import React, { useState } from 'react';
import { useTournament } from '../state/TournamentContext';
import { isFirebaseConfigured } from '../data/firebase';

interface SyncStatusBadgeProps {
  showDeviceModal?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = () => {
  const { state, deviceLabel, updateDeviceLabel, saveNow } = useTournament();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [tempLabel, setTempLabel] = useState<string>(deviceLabel);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleOpenModal = () => {
    setTempLabel(deviceLabel);
    setIsModalOpen(true);
  };

  const handleSaveLabel = (e: React.FormEvent) => {
    e.preventDefault();
    updateDeviceLabel(tempLabel.trim());
    setIsModalOpen(false);
  };

  const handleManualSync = async () => {
    setIsSaving(true);
    try {
      await saveNow();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error('Manual sync failed', e);
    } finally {
      setIsSaving(false);
    }
  };

  // 最終更新時刻のフォーマット
  const lastUpdatedTime = state.updatedAt
    ? new Date(state.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  return (
    <>
      <div className="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap">
        <button
          type="button"
          onClick={handleOpenModal}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          title="複数端末のクラウド同期状況を確認・端末名を変更"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="whitespace-nowrap shrink-0">{isFirebaseConfigured ? 'クラウド同期中' : 'ローカル同期'}</span>
          {deviceLabel && (
            <span className="hidden sm:inline text-[10px] px-1.5 py-0.2 rounded bg-emerald-600/20 text-emerald-800 dark:text-emerald-200 font-mono shrink-0 whitespace-nowrap">
              {deviceLabel}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleManualSync}
          disabled={isSaving}
          className="p-1 rounded-lg text-xs opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer shrink-0 whitespace-nowrap"
          title="今すぐクラウドに手動保存・再同期"
        >
          <span className={isSaving ? 'animate-spin inline-block' : ''}>🔄</span>
          {saveSuccess && <span className="ml-1 text-[10px] text-emerald-500 font-bold">済</span>}
        </button>
      </div>

      {/* 端末識別・同期モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">☁️</span>
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                  リアルタイムクラウド同期
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Cloud Firestore リアルタイム接続中</span>
              </div>
              <p className="opacity-90 leading-relaxed">
                審判スマホの得点入力、本部管理画面の変更、観客スマホの応援スタンプが、全ての端末・大型モニターにリアルタイム（約0.1〜0.3秒）で自動反映されます。
              </p>
            </div>

            <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span>最終更新時刻:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-200">{lastUpdatedTime}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span>直近の更新者:</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-200 truncate max-w-[200px]">
                  {state.updatedBy || 'システム初期化'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span>同期方式:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {isFirebaseConfigured ? 'Firebase Firestore (全端末同期)' : 'ローカル (同一ブラウザ)'}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveLabel} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                  この端末の識別ネーム（任意）:
                </label>
                <input
                  type="text"
                  value={tempLabel}
                  onChange={(e) => setTempLabel(e.target.value)}
                  placeholder="例: Aコート審判スマホ / 本部PC"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  誰がスコアを更新したか履歴で判別しやすくなります。
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  閉じる
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  端末名を保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
