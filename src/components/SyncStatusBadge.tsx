import React, { useState } from 'react';
import { useTournament } from '../state/TournamentContext';
import { isFirebaseConfigured } from '../data/firebase';

interface SyncStatusBadgeProps {
  showDeviceModal?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = () => {
  const { state, deviceLabel, updateDeviceLabel, saveNow, reloadLatest, syncError, syncStatus } = useTournament();
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

  const statusLabels = {
    checking: '同期確認中',
    saving: 'クラウド保存中',
    saved: 'クラウド保存済み',
    local: '端末内保存',
    error: '同期エラー',
  } as const;
  const statusStyles = {
    checking: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20',
    saving: 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30 hover:bg-sky-500/20',
    saved: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20',
    local: 'bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-700 dark:text-zinc-300 border-zinc-500/30 hover:bg-zinc-500/20',
    error: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/20',
  } as const;
  const statusDotStyles = {
    checking: 'bg-amber-500 animate-pulse',
    saving: 'bg-sky-500 animate-pulse',
    saved: 'bg-emerald-500',
    local: 'bg-zinc-500',
    error: 'bg-rose-500',
  } as const;
  const statusMessages = {
    checking: '共有データの接続状態を確認しています。',
    saving: '入力した内容をクラウドに保存しています。保存完了まで画面を閉じずにお待ちください。',
    saved: '変更はクラウドに保存済みです。閲覧ページにも自動反映されます。',
    local: 'クラウド未設定のため、このブラウザー内だけに保存しています。',
    error: 'クラウド保存を確認できていません。未同期データはこの端末に保持しています。',
  } as const;
  const statusTone = {
    checking: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200',
    saving: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200',
    saved: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200',
    local: 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200',
    error: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200',
  } as const;

  return (
    <>
      <div className="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap">
        <button
          type="button"
          onClick={handleOpenModal}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer shrink-0 whitespace-nowrap ${statusStyles[syncError ? 'error' : syncStatus]}`}
          title="保存状況と最終更新時刻を確認・端末名を変更"
        >
          <span className={`relative inline-flex h-2 w-2 shrink-0 rounded-full ${statusDotStyles[syncError ? 'error' : syncStatus]}`} />
          <span className="whitespace-nowrap shrink-0">{statusLabels[syncError ? 'error' : syncStatus]}</span>
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
          title={isFirebaseConfigured ? '今すぐクラウドに手動保存・再同期' : '端末内データを再保存'}
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

            <div role="status" aria-live="polite" className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${statusTone[syncError ? 'error' : syncStatus]}`}>
              <div className="font-bold flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${statusDotStyles[syncError ? 'error' : syncStatus]}`} />
                <span>{statusLabels[syncError ? 'error' : syncStatus]}</span>
              </div>
              <p className="opacity-90 leading-relaxed">
                {statusMessages[syncError ? 'error' : syncStatus]}
              </p>
            </div>

            <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              {syncError && (
                <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                  <p className="font-bold">同期を停止しました</p>
                  <p className="mt-1 leading-relaxed">{syncError}</p>
                  <button
                    type="button"
                    onClick={() => void reloadLatest().catch((error) => console.error('Failed to reload shared state:', error))}
                    className="mt-2 rounded-lg bg-rose-700 px-3 py-1.5 font-bold text-white hover:bg-rose-800"
                  >
                    最新データを読み込む
                  </button>
                  <p className="mt-1 text-[10px]">未保存の入力は再読み込みで破棄されます。必要な点数を控えてから押してください。</p>
                </div>
              )}
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
