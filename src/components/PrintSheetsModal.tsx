import html2canvas from 'html2canvas';
import React, { useMemo, useRef, useState } from 'react';
import { TOURNAMENT_RULES } from '../data/rules';
import { getCourtName } from '../logic/court';
import { BracketView } from './BracketView';
import { StandingsTable } from './StandingsTable';
import { Match, Settings, Standing, Team } from '../types';

interface PrintSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  matches: Match[];
  settings: Settings;
  standings: Standing[];
}

type PrintTarget = 'schedule' | 'league' | 'tournament' | 'rules';

export const PrintSheetsModal: React.FC<PrintSheetsModalProps> = ({
  isOpen,
  onClose,
  teams,
  matches,
  settings,
  standings,
}) => {
  const [printTarget, setPrintTarget] = useState<PrintTarget>('schedule');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>('');

  const sheetRef = useRef<HTMLDivElement>(null);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // スロット（巡目）・コート・試合順にソートされた全試合
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      if (a.slot && b.slot && a.slot !== b.slot) {
        return a.slot - b.slot;
      }
      if (a.roundOrder !== b.roundOrder) {
        return a.roundOrder - b.roundOrder;
      }
      if ((a.court || 1) !== (b.court || 1)) {
        return (a.court || 1) - (b.court || 1);
      }
      return a.matchNumber - b.matchNumber;
    });
  }, [matches]);

  if (!isOpen) return null;

  const targetTitles: Record<PrintTarget, { name: string; orientation: '縦' | '横' }> = {
    schedule: { name: '試合進行・審判割当表', orientation: '縦' },
    league: { name: '予選リーグ星取・順位表', orientation: '横' },
    tournament: { name: '決勝トーナメント表', orientation: '横' },
    rules: { name: '公式ルール・注意事項ポスター', orientation: '縦' },
  };

  const handlePrint = () => {
    window.print();
  };

  // A4高解像度PNG画像の自動生成 & ダウンロード
  const handleExportImage = async () => {
    if (!sheetRef.current || isExporting) return;
    setIsExporting(true);
    setToastMsg('📸 A4高解像度画像を生成しています...');

    try {
      const element = sheetRef.current;
      const targetInfo = targetTitles[printTarget];

      // html2canvasで2倍スケール（鮮明な印刷用レティナ解像度）レンダリング
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: element.scrollWidth > 800 ? element.scrollWidth : 880,
      });

      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      const dateStr = settings.date ? `_${settings.date}` : '';
      link.download = `${settings.name || 'バレーボール大会'}_${targetInfo.name}${dateStr}_A4${targetInfo.orientation}.png`;
      link.href = image;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToastMsg('✓ A4画像(PNG)をダウンロードしました！');
      setTimeout(() => setToastMsg(''), 4000);
    } catch (err) {
      console.error('Failed to export A4 image', err);
      setToastMsg('⚠️ 画像生成に失敗しました');
      setTimeout(() => setToastMsg(''), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in print:p-0 print:static print:bg-white print:z-auto">
      <div
        className="bg-white text-zinc-900 rounded-2xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden print:w-full print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:border-none"
        role="dialog"
        aria-modal="true"
      >
        {/* モーダルヘッダー (印刷時は非表示) */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-zinc-100 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🖨️</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-zinc-950">
                  体育館掲示用・A4用紙印刷 ＆ 高画質画像保存
                </h2>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-300">
                  A4{targetTitles[printTarget].orientation}推奨
                </span>
              </div>
              <p className="text-xs font-semibold text-zinc-700 mt-0.5">
                LINE・Slack配布用PNG画像保存や、壁への貼り出し用シートをA4サイズで出力できます
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* A4画像保存ボタン */}
            <button
              type="button"
              onClick={handleExportImage}
              disabled={isExporting}
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px]"
              title="このシートをA4高画質PNG画像としてダウンロード"
            >
              <span>{isExporting ? '⏳' : '📸'}</span>
              <span>{isExporting ? '画像生成中...' : 'A4画像(PNG)で保存'}</span>
            </button>

            {/* 印刷・PDF保存ボタン */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px]"
            >
              <span>🖨️</span>
              <span>A4印刷 / PDF保存</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200 transition-colors cursor-pointer text-base font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 通知トースト */}
        {toastMsg && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-black text-center animate-fade-in print:hidden">
            {toastMsg}
          </div>
        )}

        {/* シート切り替えタブ (印刷時は非表示) */}
        <div className="flex border-b border-zinc-200 px-4 sm:px-6 bg-zinc-200 print:hidden overflow-x-auto gap-2 py-2 shrink-0 no-scrollbar">
          {[
            { key: 'schedule', label: '① 試合進行・審判割当表 (A4縦)', icon: '📋' },
            { key: 'league', label: '② 予選リーグ星取・順位表 (A4横)', icon: '📊' },
            { key: 'tournament', label: '③ 決勝トーナメント表 (A4横)', icon: '🏆' },
            { key: 'rules', label: '④ 公式ルール・注意事項ポスター (A4縦)', icon: '📌' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPrintTarget(tab.key as PrintTarget)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                printTarget === tab.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-zinc-800 hover:bg-zinc-100 border border-zinc-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 印刷可能コンテンツ領域 */}
        <div className="p-3 sm:p-6 overflow-y-auto overflow-x-auto flex-1 bg-zinc-100/70 print:p-0 print:overflow-visible print:bg-white">
          <div
            ref={sheetRef}
            id="print-sheet-content"
            className={`mx-auto bg-white text-black p-6 sm:p-8 rounded-2xl shadow-sm border border-zinc-200 print:border-none print:shadow-none print:p-0 print:m-0 ${
              printTarget === 'league' || printTarget === 'tournament'
                ? 'min-w-[840px] max-w-5xl'
                : 'min-w-[700px] max-w-4xl'
            }`}
          >
          {/* ① 全試合進行・審判割当表 */}
          {printTarget === 'schedule' && (
            <div className="space-y-4 font-sans text-xs">
              <div className="border-b-2 border-black pb-2 flex items-end justify-between">
                <div>
                  <h1 className="text-xl font-bold tracking-tight">
                    {settings.name || '社内バレーボール大会'} 試合進行・審判割当表
                  </h1>
                  <p className="text-[11px] text-zinc-600 mt-0.5">
                    開催日: {settings.date} / 会場: {settings.venue}
                  </p>
                </div>
                <div className="text-right text-[10px] text-zinc-500">
                  全{settings.courtCount || 4}コート同時進行（{settings.set12Points || 15}点先取）
                </div>
              </div>

              <table className="w-full border-collapse border border-black text-left text-[11px]">
                <thead>
                  <tr className="bg-zinc-100 border-b border-black">
                    <th className="p-2 border border-black text-center w-16">進行順</th>
                    <th className="p-2 border border-black text-center w-16">コート</th>
                    <th className="p-2 border border-black text-center w-14">試合番</th>
                    <th className="p-2 border border-black w-24">ステージ</th>
                    <th className="p-2 border border-black text-right font-bold w-40">チーム1</th>
                    <th className="p-2 border border-black text-center w-20">スコア</th>
                    <th className="p-2 border border-black font-bold w-40">チーム2</th>
                    <th className="p-2 border border-black text-center font-bold w-36">主審・得点板担当</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMatches.map((m) => {
                    const t1 = m.team1Id ? teamMap.get(m.team1Id)?.name || '未定' : '未定';
                    const t2 = m.team2Id ? teamMap.get(m.team2Id)?.name || '未定' : '未定';
                    const isDone = m.status === 'completed';

                    return (
                      <tr key={m.id} className="border-b border-zinc-300 hover:bg-zinc-50">
                        <td className="p-1.5 border border-black text-center font-bold font-mono text-zinc-700 bg-zinc-50">
                          {m.slot ? `第${m.slot}試合` : '-'}
                        </td>
                        <td className="p-1.5 border border-black text-center font-bold">
                          {getCourtName(m.court)}
                        </td>
                        <td className="p-1.5 border border-black text-center font-mono font-bold">
                          #{m.matchNumber}
                        </td>
                        <td className="p-1.5 border border-black text-zinc-600">
                          {m.roundName}
                        </td>
                        <td className="p-1.5 border border-black text-right font-bold break-words leading-tight max-w-[130px]">
                          {t1}
                        </td>
                        <td className="p-1.5 border border-black text-center font-mono font-bold whitespace-nowrap">
                          {isDone ? `${m.team1Sets} - ${m.team2Sets}` : 'vs'}
                        </td>
                        <td className="p-1.5 border border-black font-bold break-words leading-tight max-w-[130px]">
                          {t2}
                        </td>
                        <td className="p-1.5 border border-black text-center bg-zinc-50 font-semibold break-words leading-tight max-w-[110px]">
                          {m.referee || '本部調整'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="pt-2 text-[10px] text-zinc-500 flex justify-between border-t border-zinc-200">
                <span>※待機チームは指定のコートで得点板のめくりをお願いいたします。</span>
                <span>大会運営本部</span>
              </div>
            </div>
          )}

          {/* ② 予選リーグ星取・順位表 */}
          {printTarget === 'league' && (
            <div className="space-y-4 font-sans text-xs">
              <div className="border-b-2 border-black pb-2 flex items-end justify-between">
                <div>
                  <h1 className="text-xl font-bold tracking-tight">
                    {settings.name || '社内バレーボール大会'} 予選リーグ星取表・順位
                  </h1>
                  <p className="text-[11px] text-zinc-600 mt-0.5">
                    予選リーグ結果に応じて決勝トーナメント・順位決定戦へ進出
                  </p>
                </div>
                <div className="text-right text-[10px] text-zinc-500">
                  全{settings.leagueCount || 5}グループ (A〜{String.fromCharCode(64 + (settings.leagueCount || 5))})
                </div>
              </div>

              <StandingsTable standings={standings} />
            </div>
          )}

          {/* ③ 決勝トーナメント表 */}
          {printTarget === 'tournament' && (
            <div className="space-y-4 font-sans text-xs">
              <div className="border-b-2 border-black pb-2 flex items-end justify-between">
                <div>
                  <h1 className="text-xl font-bold tracking-tight">
                    {settings.name || '社内バレーボール大会'} 決勝トーナメント
                  </h1>
                  <p className="text-[11px] text-zinc-600 mt-0.5">
                    上ブロック（A5〜A8）および下ブロック（C4〜C6, D4〜E6）トーナメント
                  </p>
                </div>
                <div className="text-right text-[10px] text-zinc-500">
                  決勝トーナメント表
                </div>
              </div>

              <div className="border border-zinc-300 p-4 rounded-xl">
                <BracketView matches={matches} teams={teams} hideControls={true} defaultView="tree" />
              </div>
            </div>
          )}

          {/* ④ 大会ルール・注意事項ポスター */}
          {printTarget === 'rules' && (
            <div className="space-y-4 font-sans text-xs p-2">
              <div className="text-center border-b-2 border-black pb-3">
                <h1 className="text-2xl font-black tracking-wider">
                  {TOURNAMENT_RULES.title}
                </h1>
                <p className="text-sm font-bold text-zinc-700 mt-1">
                  【大会公式ルール ＆ 会場注意事項】
                </p>
              </div>

              {/* スケジュール */}
              <div className="border border-black p-3 bg-zinc-50">
                <h3 className="font-bold text-sm mb-1.5">🕒 当日進行スケジュール</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {TOURNAMENT_RULES.schedule.items.map((it, i) => (
                    <div key={i} className="font-semibold">• {it}</div>
                  ))}
                </div>
              </div>

              {/* 基本ルール & 特別ルール */}
              <div>
                <h3 className="font-bold text-sm mb-2 border-b border-black pb-0.5">
                  🏐 今大会の特別ルール（エンジョイ＆安全第一！）
                </h3>
                <div className="space-y-1.5 text-[11px] leading-relaxed">
                  {TOURNAMENT_RULES.specialRules.map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="font-bold font-mono">[{i + 1}]</span>
                      <span className={r.includes('2点') ? 'font-bold underline' : ''}>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 会場注意事項 */}
              <div className="border-2 border-black p-3 bg-zinc-100">
                <h3 className="font-bold text-sm mb-1 text-red-700">⚠️ 会場利用の注意事項</h3>
                <ul className="space-y-1 text-[11px]">
                  {TOURNAMENT_RULES.notes.map((n, i) => (
                    <li key={i} className="font-medium">• {n}</li>
                  ))}
                </ul>
              </div>

              <div className="text-center text-[10px] text-zinc-500 pt-2">
                2026年度 新入社員歓迎バレーボール大会 実行委員会 本部
              </div>
            </div>
          )}
          </div>
        </div>

        {/* モーダルフッター (印刷時は非表示) */}
        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between print:hidden shrink-0">
          <span className="text-xs text-zinc-500">
            用紙サイズ: A4（プリンタ設定で「ヘッダーとフッター」をOFFにすると綺麗に出力できます）
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
