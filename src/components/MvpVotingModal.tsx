import React, { useMemo, useState } from 'react';
import { useTournament } from '../state/TournamentContext';
import { Team } from '../types';

interface MvpVotingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MvpVotingModal: React.FC<MvpVotingModalProps> = ({ isOpen, onClose }) => {
  const { state, dispatch } = useTournament();
  const { teams, mvpVotes = [] } = state;

  const [activeTab, setActiveTab] = useState<'vote' | 'ranking'>('vote');
  const [nomineeName, setNomineeName] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');
  const [reason, setReason] = useState<string>('');
  const [voterName, setVoterName] = useState<string>('');
  const [submittedToast, setSubmittedToast] = useState<boolean>(false);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // 集計ランキング
  const rankingList = useMemo(() => {
    const counts: Record<string, { count: number; teamId?: string; reasons: string[] }> = {};

    mvpVotes.forEach((v) => {
      const key = v.nomineeName.trim();
      if (!key) return;
      if (!counts[key]) {
        counts[key] = { count: 0, teamId: v.nomineeTeamId, reasons: [] };
      }
      counts[key].count += 1;
      if (v.reason && v.reason.trim()) {
        counts[key].reasons.push(v.reason.trim());
      }
    });

    return Object.entries(counts)
      .map(([name, data]) => ({
        name,
        teamName: data.teamId ? teamMap.get(data.teamId)?.name || '' : '',
        count: data.count,
        reasons: data.reasons,
      }))
      .sort((a, b) => b.count - a.count);
  }, [mvpVotes, teamMap]);

  if (!isOpen) return null;

  const handleSubmitVote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomineeName.trim()) return;

    dispatch({
      type: 'ADD_MVP_VOTE',
      payload: {
        nomineeName: nomineeName.trim(),
        nomineeTeamId: selectedTeamId || undefined,
        reason: reason.trim() || undefined,
        voterName: voterName.trim() || undefined,
      },
    });

    setNomineeName('');
    setReason('');
    setSubmittedToast(true);
    setTimeout(() => {
      setSubmittedToast(false);
      setActiveTab('ranking');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⭐</span>
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-zinc-50">
                大会MVP ＆ 敢闘賞 投票
              </h2>
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                本日一番輝いていた選手・チームに投票しよう！
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-base font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* タブ切り替え */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 bg-zinc-100 dark:bg-zinc-800/60">
          <button
            onClick={() => setActiveTab('vote')}
            className={`py-3 px-4 text-xs font-black border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'vote'
                ? 'border-amber-500 text-amber-900 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20'
                : 'border-transparent text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white'
            }`}
          >
            <span>✍️</span>
            <span>MVPに投票する</span>
          </button>
          <button
            onClick={() => setActiveTab('ranking')}
            className={`py-3 px-4 text-xs font-black border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ranking'
                ? 'border-amber-500 text-amber-900 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20'
                : 'border-transparent text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white'
            }`}
          >
            <span>🏆</span>
            <span>投票ランキング・推薦文 ({mvpVotes.length}票)</span>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto flex-1">
          {submittedToast && (
            <div className="p-3 mb-4 rounded-xl bg-emerald-600 text-white text-xs font-bold text-center animate-bounce">
              ✓ 投票を受け付けました！ありがとうございます！🎉
            </div>
          )}

          {activeTab === 'vote' ? (
            <form onSubmit={handleSubmitVote} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100 font-semibold text-xs leading-relaxed">
                💡 バレー経験者はもちろん、「未経験なのにナイスプレーを連発した人」や「コートを最高に盛り上げたムードメーカー」など、誰でも大歓迎です！
              </div>

              <div>
                <label className="block font-extrabold text-zinc-900 dark:text-zinc-100 mb-1">
                  推薦する選手のお名前・ニックネーム <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  placeholder="例: 山田 太郎 さん / 開発チームのキャプテン"
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 text-xs font-medium focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-extrabold text-zinc-900 dark:text-zinc-100 mb-1">
                  所属チーム（または部署）
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 text-xs font-semibold focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                >
                  <option value="">（選択しない / 不明）</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (グループ {t.pool || 'A'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-extrabold text-zinc-900 dark:text-zinc-100 mb-1">
                  推薦理由・アピールポイント（表彰式で読み上げられます！）
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="例: 第2セットの終盤で神レシーブを連発して逆転勝ちに導いてくれた！声出しも一番すごかった！"
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 text-xs font-medium focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-extrabold text-zinc-900 dark:text-zinc-100 mb-1">
                  あなたの名前・部署（任意）
                </label>
                <input
                  type="text"
                  value={voterName}
                  onChange={(e) => setVoterName(e.target.value)}
                  placeholder="匿名でもOKです"
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 text-xs font-medium focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-zinc-950 font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>⭐</span>
                <span>この選手に投票する！</span>
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-xs">
              {rankingList.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  <span className="text-3xl block mb-2">🗳️</span>
                  <p className="font-extrabold text-zinc-800 dark:text-zinc-200">まだMVP投票がありません</p>
                  <p className="text-xs mt-1 text-zinc-600 dark:text-zinc-400 font-medium">「MVPに投票する」タブから最初の1票を投じてみましょう！</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300 text-xs font-bold">
                    <span>現在の総投票数: {mvpVotes.length} 票</span>
                    <span>得票順</span>
                  </div>

                  {rankingList.map((item, idx) => {
                    const isTop1 = idx === 0;
                    const isTop2 = idx === 1;
                    const isTop3 = idx === 2;

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition-all ${
                          isTop1
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 shadow-xs'
                            : isTop2
                            ? 'bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
                            : isTop3
                            ? 'bg-zinc-50/80 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-800'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                                isTop1
                                  ? 'bg-amber-500 text-zinc-950 shadow-xs'
                                  : isTop2
                                  ? 'bg-zinc-500 text-white'
                                  : isTop3
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div>
                              <span className="font-extrabold text-sm text-zinc-950 dark:text-zinc-50 mr-2">
                                {item.name}
                              </span>
                              {item.teamName && (
                                <span className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold">
                                  ({item.teamName})
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="font-mono font-black text-sm text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                            {item.count} 票
                          </span>
                        </div>

                        {/* 推薦コメント */}
                        {item.reasons.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-1">
                            <div className="text-xs text-zinc-700 dark:text-zinc-300 font-extrabold">推薦コメント:</div>
                            {item.reasons.map((r, rIdx) => (
                              <div
                                key={rIdx}
                                className="text-xs text-zinc-800 dark:text-zinc-200 font-medium bg-white dark:bg-zinc-800 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700"
                              >
                                「{r}」
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-700 dark:text-zinc-300 font-semibold">
            表彰式のMVP・敢闘賞発表で活用できます
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-colors cursor-pointer shadow-xs"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
