import html2canvas from 'html2canvas';
import React, { useMemo, useRef, useState } from 'react';
import { Match, Settings, Standing, Team } from '../types';

interface AwardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  matches: Match[];
  settings: Settings;
  standings: Standing[];
}

export const AwardsModal: React.FC<AwardsModalProps> = ({
  isOpen,
  onClose,
  teams,
  matches,
  settings,
  standings,
}) => {
  const [activeAward, setActiveAward] = useState<'1st' | '2nd' | '3rd' | '4th'>('1st');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [imageToast, setImageToast] = useState<string>('');

  const certificateRef = useRef<HTMLDivElement>(null);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // 決勝・3位決定戦または準決勝から最終成績を抽出
  const finalMatch = matches.find((m) => m.round === 'final' || m.matchCode === 'A8' || m.id === 'final_fn' || m.id === 'match_A8');
  const thirdMatch = matches.find((m) => m.round === 'third_place' || m.matchCode === 'B8' || m.id === 'match_B8' || m.id === 'final_3rd');

  const winnerTeam = finalMatch?.winnerId ? teamMap.get(finalMatch.winnerId) : null;
  const runnerUpTeam =
    finalMatch?.winnerId && finalMatch.team1Id && finalMatch.team2Id
      ? teamMap.get(finalMatch.winnerId === finalMatch.team1Id ? finalMatch.team2Id : finalMatch.team1Id)
      : null;

  // 準決勝（A7・B7）
  const semiA7 = matches.find((m) => m.matchCode === 'A7' || m.id === 'match_A7');
  const semiB7 = matches.find((m) => m.matchCode === 'B7' || m.id === 'match_B7');

  // 3位決定戦がある場合はその勝敗、ない場合は準決勝敗退チーム（ベスト4）
  let thirdTeam = thirdMatch?.winnerId ? teamMap.get(thirdMatch.winnerId) : null;
  let fourthTeam =
    thirdMatch?.winnerId && thirdMatch.team1Id && thirdMatch.team2Id
      ? teamMap.get(thirdMatch.winnerId === thirdMatch.team1Id ? thirdMatch.team2Id : thirdMatch.team1Id)
      : null;

  if (!thirdTeam && semiA7?.winnerId && semiB7?.winnerId) {
    const loserA7Id = semiA7.winnerId === semiA7.team1Id ? semiA7.team2Id : semiA7.team1Id;
    const loserB7Id = semiB7.winnerId === semiB7.team1Id ? semiB7.team2Id : semiB7.team1Id;
    const rankA = standings.findIndex((s) => s.teamId === loserA7Id);
    const rankB = standings.findIndex((s) => s.teamId === loserB7Id);
    if (rankA !== -1 && rankB !== -1) {
      thirdTeam = rankA <= rankB ? teamMap.get(loserA7Id!) || null : teamMap.get(loserB7Id!) || null;
      fourthTeam = rankA <= rankB ? teamMap.get(loserB7Id!) || null : teamMap.get(loserA7Id!) || null;
    } else {
      thirdTeam = teamMap.get(loserA7Id!) || null;
      fourthTeam = teamMap.get(loserB7Id!) || null;
    }
  }

  // 選択された表彰チーム
  const currentAwardInfo = useMemo(() => {
    switch (activeAward) {
      case '1st':
        return {
          title: '優　勝',
          badge: '🥇 優勝',
          team: winnerTeam,
          color: 'text-amber-600 dark:text-amber-400',
          borderColor: 'border-amber-400 dark:border-amber-500',
          bgGradient: 'from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-zinc-900',
          text: `貴チームは「${settings.name}」において頭書の通り卓越したチームワークと卓越した技量を発揮し見事栄冠を勝ち取られました\nここにその栄誉を讃えこれを賞します`,
        };
      case '2nd':
        return {
          title: '準 優 勝',
          badge: '🥈 準優勝',
          team: runnerUpTeam,
          color: 'text-slate-600 dark:text-slate-300',
          borderColor: 'border-slate-300 dark:border-slate-600',
          bgGradient: 'from-slate-50 to-slate-100/50 dark:from-slate-900/40 dark:to-zinc-900',
          text: `貴チームは「${settings.name}」において頭書の通り最後まで諦めない粘り強い闘志を発揮し優秀な成績を収められました\nここにその健闘を讃えこれを賞します`,
        };
      case '3rd':
        return {
          title: '第 三 位',
          badge: '🥉 第3位',
          team: thirdTeam,
          color: 'text-amber-800 dark:text-amber-600',
          borderColor: 'border-amber-700/60 dark:border-amber-800',
          bgGradient: 'from-orange-50 to-orange-100/50 dark:from-orange-950/40 dark:to-zinc-900',
          text: `貴チームは「${settings.name}」において頭書の通り優れたチームプレーを発揮し頭書の好成績を収められました\nここにその栄誉を讃えこれを賞します`,
        };
      case '4th':
        return {
          title: '敢 闘 賞',
          badge: '🎖️ 敢闘賞（ベスト4）',
          team: fourthTeam,
          color: 'text-indigo-600 dark:text-indigo-400',
          borderColor: 'border-indigo-300 dark:border-indigo-700',
          bgGradient: 'from-indigo-50 to-indigo-100/50 dark:from-indigo-950/40 dark:to-zinc-900',
          text: `貴チームは「${settings.name}」において頭書の通り大会を大いに盛り上げ観衆に感動を与える素晴らしいプレーを展開されました\nここにその敢闘を讃えこれを賞します`,
        };
    }
  }, [activeAward, winnerTeam, runnerUpTeam, thirdTeam, fourthTeam, settings.name]);

  // 社内Slack / Teams用サマリー生成
  const summaryText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`🏆━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🏆 【大会結果速報】${settings.name}`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📅 開催日時: ${settings.date || '本日'}`);
    lines.push(`📍 会場: ${settings.venue || '社内体育館'}`);
    lines.push(``);
    lines.push(`【👑 最終表彰結果】`);
    lines.push(`🥇 優勝: ${winnerTeam ? winnerTeam.name : '（決勝進行中）'}`);
    lines.push(`🥈 準優勝: ${runnerUpTeam ? runnerUpTeam.name : '（決勝進行中）'}`);
    lines.push(`🥉 第3位: ${thirdTeam ? thirdTeam.name : '（準決勝終了後に確定）'}`);
    lines.push(`🎖️ 敢闘賞: ${fourthTeam ? fourthTeam.name : '（準決勝終了後に確定）'}`);
    lines.push(``);
    lines.push(`【📊 予選リーグ上位通過チーム】`);

    const pools = Array.from(new Set(standings.map((s) => s.pool).filter(Boolean))).sort();
    if (pools.length === 0) pools.push('A', 'B', 'C', 'D', 'E');
    pools.forEach((p) => {
      const poolStandings = standings.filter((s) => s.pool === p);
      if (poolStandings.length > 0) {
        const top1 = poolStandings[0] ? poolStandings[0].teamName : '-';
        const top2 = poolStandings[1] ? poolStandings[1].teamName : '-';
        lines.push(`・グループ${p}: 1位 ${top1} / 2位 ${top2}`);
      }
    });

    lines.push(``);
    lines.push(`出場された選手の皆様、審判・運営にご協力いただいた皆様、`);
    lines.push(`そして熱い声援を送ってくださった皆様、本当にありがとうございました！🏐✨`);

    return lines.join('\n');
  }, [settings, winnerTeam, runnerUpTeam, thirdTeam, fourthTeam, standings]);

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch {
      // フォールバック
      const textarea = document.createElement('textarea');
      textarea.value = summaryText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // 賞状のA4高解像度PNG画像ダウンロード
  const handleExportCertificateImage = async () => {
    if (!certificateRef.current || isExporting) return;
    setIsExporting(true);
    setImageToast('📸 表彰状のA4高解像度画像を生成中...');
    try {
      const element = certificateRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // 鮮明な印刷用レティナ画質
        useCORS: true,
        backgroundColor: '#fffdfa',
        logging: false,
        windowWidth: element.scrollWidth > 750 ? element.scrollWidth : 800,
      });

      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      const teamName = currentAwardInfo.team ? `_${currentAwardInfo.team.name}` : '';
      link.download = `${settings.name || 'バレーボール大会'}_${currentAwardInfo.badge}${teamName}_表彰状_A4横.png`;
      link.href = image;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setImageToast('✓ 表彰状のA4画像(PNG)をダウンロードしました！');
      setTimeout(() => setImageToast(''), 4000);
    } catch (err) {
      console.error('Failed to export certificate image', err);
      setImageToast('⚠️ 画像の生成に失敗しました');
      setTimeout(() => setImageToast(''), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div
        className="w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-7 shadow-2xl space-y-6 my-auto max-h-[95vh] overflow-y-auto print:border-none print:shadow-none print:p-0 print:max-h-none print:w-full print:max-w-none"
        role="dialog"
        aria-modal="true"
      >
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <h3 className="font-black text-lg sm:text-xl text-zinc-900 dark:text-zinc-50">
                表彰状 ＆ 大会結果サマリー
              </h3>
            </div>
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 mt-0.5">
              大会の最終結果の表彰状画像保存・印刷と、社内Slack/Teams連絡用テキストを生成します。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 画像保存トースト */}
        {imageToast && (
          <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-black text-center animate-fade-in print:hidden">
            {imageToast}
          </div>
        )}

        {/* 表彰タブ */}
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 flex-wrap print:hidden">
          {(['1st', '2nd', '3rd', '4th'] as const).map((key) => {
            const labels = {
              '1st': '🥇 優勝 賞状',
              '2nd': '🥈 準優勝 賞状',
              '3rd': '🥉 第3位 賞状',
              '4th': '🎖️ 敢闘賞 賞状',
            };
            const isSelected = activeAward === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveAward(key)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs scale-102'
                    : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {labels[key]}
              </button>
            );
          })}
        </div>

        {/* 賞状プレビューエリア（印刷および画像保存対象） */}
        <div
          ref={certificateRef}
          id="certificate-print-area"
          className="relative rounded-2xl border-4 border-double border-amber-400 dark:border-amber-600 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/40 dark:from-zinc-900 dark:via-zinc-900 dark:to-amber-950/30 p-6 sm:p-10 shadow-md text-center space-y-6 print:border-4 print:shadow-none print:m-0"
        >
          {/* 四隅の飾り */}
          <div className="absolute top-3 left-3 text-amber-500 text-xl select-none">❖</div>
          <div className="absolute top-3 right-3 text-amber-500 text-xl select-none">❖</div>
          <div className="absolute bottom-3 left-3 text-amber-500 text-xl select-none">❖</div>
          <div className="absolute bottom-3 right-3 text-amber-500 text-xl select-none">❖</div>

          {/* 表彰タイトル */}
          <div>
            <div className="text-xs uppercase tracking-widest text-amber-700 dark:text-amber-400 font-black mb-1">
              Certificate of Award
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-black tracking-widest text-zinc-950 dark:text-zinc-50">
              表　彰　状
            </h2>
            <div className="mt-2 inline-block px-4 py-1 rounded-full border border-amber-400 bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 font-extrabold text-sm">
              {currentAwardInfo.badge}
            </div>
          </div>

          {/* 受賞チーム名 */}
          <div className="py-3 border-b-2 border-zinc-300 dark:border-zinc-700 max-w-lg mx-auto">
            <div className="text-xl sm:text-2xl md:text-3xl font-extrabold font-serif text-zinc-950 dark:text-white break-words leading-snug px-2">
              {currentAwardInfo.team ? currentAwardInfo.team.name : '（決勝トーナメント進行中）'}
              {currentAwardInfo.team && <span className="text-base sm:text-lg font-bold ml-2 inline-block">殿</span>}
            </div>
            {currentAwardInfo.team?.pool && (
              <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mt-1">
                予選グループ {currentAwardInfo.team.pool}
              </div>
            )}
          </div>

          {/* 賞状本文 */}
          <div className="max-w-xl mx-auto text-xs sm:text-sm text-zinc-950 dark:text-zinc-100 leading-loose whitespace-pre-line font-serif font-bold">
            {currentAwardInfo.text}
          </div>

          {/* 日付・発行者 */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 max-w-lg mx-auto gap-2">
            <div>{settings.date || new Date().toLocaleDateString('ja-JP')}</div>
            <div className="font-extrabold text-sm text-zinc-950 dark:text-zinc-50">
              {settings.name} 運営本部
            </div>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 print:hidden">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* A4画像保存ボタン */}
            <button
              type="button"
              onClick={handleExportCertificateImage}
              disabled={isExporting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[38px]"
              title="この賞状をA4高画質PNG画像として保存"
            >
              <span>{isExporting ? '⏳' : '📸'}</span>
              <span>{isExporting ? '画像生成中...' : '賞状をA4画像(PNG)で保存'}</span>
            </button>

            {/* A4印刷ボタン */}
            <button
              type="button"
              onClick={handlePrint}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[38px]"
            >
              <span>🖨️</span>
              <span>印刷 / PDF出力 (A4横)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopySummary}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[38px]"
          >
            <span>{copySuccess ? '✅' : '📋'}</span>
            <span>{copySuccess ? 'コピーしました！' : 'Slack / Teams報告用テキストをコピー'}</span>
          </button>
        </div>

        {/* 社内連絡用テキストのプレビュー */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <span>💬</span>
              <span>社内連絡用テキスト プレビュー (Slack / Teamsにそのまま貼り付け可能)</span>
            </span>
            <button
              type="button"
              onClick={handleCopySummary}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              テキストをコピー
            </button>
          </div>
          <pre className="text-[11px] font-mono p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl overflow-x-auto text-zinc-700 dark:text-zinc-300 leading-relaxed max-h-44">
            {summaryText}
          </pre>
        </div>
      </div>
    </div>
  );
};
