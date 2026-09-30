import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { DEFAULT_APP_STATE } from '../data/defaults';
import { getDeviceLabel, getOnce, save, setDeviceLabel, subscribe } from '../data/repository';
import { computeStandings } from '../logic/standings';
import { AppState, Standing } from '../types';
import { TournamentAction, tournamentReducer } from './reducer';

interface TournamentContextType {
  state: AppState;
  dispatch: React.Dispatch<TournamentAction>;
  standings: Standing[];
  isLoaded: boolean;
  deviceLabel: string;
  updateDeviceLabel: (label: string) => void;
  saveNow: () => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(tournamentReducer, DEFAULT_APP_STATE);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [deviceLabel, setDeviceLabelState] = useState<string>('');

  // 最後に保存または受信した updatedAt を保持（エコー防止）
  const lastKnownUpdatedAtRef = useRef<string>(state.updatedAt);
  const isInitialLoadDoneRef = useRef<boolean>(false);
  const isSelfSavingRef = useRef<boolean>(false);

  // 端末ラベルの初期化
  useEffect(() => {
    setDeviceLabelState(getDeviceLabel());
  }, []);

  const updateDeviceLabel = (label: string) => {
    setDeviceLabel(label);
    setDeviceLabelState(label);
  };

  // 初回データ取得
  useEffect(() => {
    let isMounted = true;
    getOnce().then((initialState) => {
      if (isMounted) {
        lastKnownUpdatedAtRef.current = initialState.updatedAt;
        dispatch({ type: 'INIT', payload: initialState });
        setIsLoaded(true);
        isInitialLoadDoneRef.current = true;
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // 外部変更の購読（subscribe）
  useEffect(() => {
    const unsubscribe = subscribe((remoteState) => {
      if (!remoteState || !remoteState.updatedAt) return;

      // 自分が保存中のエコーをスキップ
      if (isSelfSavingRef.current) return;

      const remoteTime = new Date(remoteState.updatedAt).getTime();
      const localTime = new Date(lastKnownUpdatedAtRef.current).getTime();

      // 受信データの updatedAt が自分より新しいときのみ INIT で取り込む
      if (remoteTime > localTime) {
        lastKnownUpdatedAtRef.current = remoteState.updatedAt;
        dispatch({ type: 'INIT', payload: remoteState });
        setIsLoaded(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // ローカルの state 変更を検知して自動保存 (save)
  useEffect(() => {
    // 初回ロード完了前は自動保存を抑制
    if (!isInitialLoadDoneRef.current) return;

    // updatedAt が一致している場合は、外部同期による反映なので再保存しない
    if (state.updatedAt === lastKnownUpdatedAtRef.current) return;

    let isCanceled = false;
    const saveState = async () => {
      isSelfSavingRef.current = true;
      try {
        const savedState = await save(state);
        if (!isCanceled) {
          lastKnownUpdatedAtRef.current = savedState.updatedAt;
        }
      } catch (err) {
        console.error('Failed to auto-save tournament state:', err);
      } finally {
        setTimeout(() => {
          isSelfSavingRef.current = false;
        }, 100);
      }
    };

    saveState();

    return () => {
      isCanceled = true;
    };
  }, [state]);

  const saveNow = async () => {
    isSelfSavingRef.current = true;
    try {
      const savedState = await save(state);
      lastKnownUpdatedAtRef.current = savedState.updatedAt;
    } finally {
      isSelfSavingRef.current = false;
    }
  };

  // 順位は保存せず、teams と matches から常に動的導出
  const standings = useMemo(() => {
    return computeStandings(state.teams, state.matches, state.settings);
  }, [state.teams, state.matches, state.settings]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      standings,
      isLoaded,
      deviceLabel,
      updateDeviceLabel,
      saveNow,
    }),
    [state, standings, isLoaded, deviceLabel]
  );

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
};

export function useTournament(): TournamentContextType {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
}
