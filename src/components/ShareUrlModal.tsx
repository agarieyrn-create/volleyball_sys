import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useTournament } from '../state/TournamentContext';

interface ShareUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTeamId?: string;
}

export const ShareUrlModal: React.FC<ShareUrlModalProps> = ({
  isOpen,
  onClose,
  defaultTeamId,
}) => {
  const { state } = useTournament();
  const { teams, settings } = state;

  const [selectedTeamId, setSelectedTeamId] = useState<string>(defaultTeamId || '');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ベースURL取得 (環境に応じたオリジン)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // 共有用URLの生成
  const generalViewerUrl = `${baseUrl}/viewer`;
  const teamViewerUrl = selectedTeamId ? `${baseUrl}/viewer?team=${selectedTeamId}` : generalViewerUrl;

  const currentShareUrl = selectedTeamId ? teamViewerUrl : generalViewerUrl;

  // QRコードの再描画
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    QRCode.toCanvas(
      canvasRef.current,
      currentShareUrl,
      {
        width: 200,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      },
      (err) => {
        if (err) console.error('QR code generation error:', err);
      }
    );
  }, [isOpen, currentShareUrl]);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      // フォールバック
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  const selectedTeamName = teams.find((t) => t.id === selectedTeamId)?.name;

  const shareMessage = `【${settings.name || '社内バレーボール大会'} リアルタイム閲覧専用ページ】
試合速報、コート状況、マイチームの次の対戦・審判、順位表はこちらから確認できます！
（※管理画面等の操作はできない閲覧専用ページです）
▼ 閲覧URL
${currentShareUrl}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base">
              🔗
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                閲覧専用URL / QRコード発行
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                管理画面や編集ボタンが一切見えない安全な共有リンクです
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          {/* 説明バナー */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5 leading-relaxed">
            <span className="text-base shrink-0">🔒</span>
            <div>
              <span className="font-bold">閲覧専用ガード適用済み</span>:
              このURLでアクセスした閲覧者は「コート進行モニター」「自分たちの試合（マイチーム）」「全体の試合状況・トーナメント」のみを閲覧できます。管理設定やスコア入力・審判画面へのリンクは一切表示されません。
            </div>
          </div>

          {/* チーム絞り込み選択 (任意) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              対象チームの指定（任意）
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="">全チーム共通（総合モニター・全試合状況）</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    【{t.pool ? `グループ${t.pool}` : 'チーム'}】 {t.name} 専用リンク
                  </option>
                ))}
              </select>
              {selectedTeamId && (
                <button
                  type="button"
                  onClick={() => setSelectedTeamId('')}
                  className="px-2.5 py-2 text-xs font-semibold rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 shrink-0"
                >
                  解除
                </button>
              )}
            </div>
            <p className="text-[11px] text-zinc-500">
              {selectedTeamId
                ? `👉 「${selectedTeamName}」のLINEや参加者に送ると、開いた瞬間にそのチームの次の試合・審判が表示されます。`
                : '👉 体育館の全体プロジェクターや、全参加者・観客共通で使えるURLです。'}
            </p>
          </div>

          {/* QRコード & URLコピー領域 */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center gap-4">
            {/* QRコード */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="p-2 bg-white rounded-2xl shadow-xs border border-zinc-200 dark:border-zinc-700">
                <canvas ref={canvasRef} className="w-[140px] h-[140px] block" />
              </div>
              <span className="text-[10px] font-bold text-zinc-500">スマホで読み取り</span>
            </div>

            {/* URL表示とコピーボタン */}
            <div className="flex-1 min-w-0 w-full space-y-2.5">
              <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                発行された閲覧専用URL
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 font-mono text-xs text-zinc-800 dark:text-zinc-200 break-all select-all shadow-2xs">
                {currentShareUrl}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => copyToClipboard(currentShareUrl, 'url')}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                    copiedType === 'url'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <span>{copiedType === 'url' ? '✓' : '📋'}</span>
                  <span>{copiedType === 'url' ? 'URLをコピーしました！' : 'URLをコピー'}</span>
                </button>

                <a
                  href={currentShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2.5 rounded-xl font-bold text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 text-zinc-800 dark:text-zinc-200 flex items-center gap-1 shrink-0"
                >
                  <span>別タブで確認</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>

          {/* LINE・チャット送信用メッセージ一括コピー */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                LINE / Slack / メール共有用テキスト
              </label>
              <button
                type="button"
                onClick={() => copyToClipboard(shareMessage, 'message')}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {copiedType === 'message' ? '✓ コピー完了！' : '文面を一括コピー'}
              </button>
            </div>
            <textarea
              readOnly
              rows={3}
              value={shareMessage}
              className="w-full p-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 font-mono resize-none"
            />
          </div>
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
