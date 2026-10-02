import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { DEFAULT_APP_STATE } from '../data/defaults';
import { getDeviceLabel, getOnce, save, setDeviceLabel, subscribe } from '../data/repository';
import { computeStandings } from '../logic/standings';
import { AppState, Standing } from '../types';
import { TournamentAction, tournamentReducer } from './reducer';
import { hasSameTournamentData, mergeConcurrentStates, StateConflictError } from '../data/stateMerge';

interface TournamentContextType {
  state: AppState;
  dispatch: React.Dispatch<TournamentAction>;
  standings: Standing[];
  isLoaded: boolean;
  deviceLabel: string;
  updateDeviceLabel: (label: string) => void;
  saveNow: () => Promise<void>;
  reloadLatest: () => Promise<void>;
  syncError: string | null;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(tournamentReducer, DEFAULT_APP_STATE);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [deviceLabel, setDeviceLabelState] = useState<string>('');
  const [syncError, setSyncError] = useState<string | null>(null);

  const currentStateRef = useRef<AppState>(state);
  currentStateRef.current = state;
  const lastPersistedStateRef = useRef<AppState | null>(null);
  const isSelfSavingRef = useRef<boolean>(false);
  const syncBlockedRef = useRef<boolean>(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // 端末ラベルの初期化
  useEffect(() => {
    setDeviceLabelState(getDeviceLabel());
  }, []);

  const updateDeviceLabel = (label: string) => {
    setDeviceLabel(label);
    setDeviceLabelState(label);
  };

  const persistState = useCallback((candidate: AppState, force = false): Promise<AppState> => {
    const operation = saveQueueRef.current.then(async () => {
      if (syncBlockedRef.current) {
        throw new StateConflictError('大会データ (再読み込みが必要です)');
      }
      const baseState = lastPersistedStateRef.current;
      if (!force && baseState && hasSameTournamentData(candidate, baseState)) return baseState;

      isSelfSavingRef.current = true;
      try {
        const savedState = await save(candidate, baseState);
        lastPersistedStateRef.current = savedState;
        setSyncError(null);
        if (currentStateRef.current === candidate) {
          dispatch({ type: 'INIT', payload: savedState });
        }
        return savedState;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'クラウド保存に失敗しました。';
        if (error instanceof StateConflictError) {
          syncBlockedRef.current = true;
          setSyncError(`${message} 入力内容を控え、最新データを再読み込みしてください。`);
        } else {
          setSyncError(message);
        }
        throw error;
      } finally {
        isSelfSavingRef.current = false;
      }
    });
    saveQueueRef.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, []);

  // 初回データ取得
  useEffect(() => {
    let isMounted = true;
    getOnce().then((initialState) => {
      if (isMounted) {
        const latest = lastPersistedStateRef.current;
        const selectedState = latest && new Date(latest.updatedAt).getTime() > new Date(initialState.updatedAt).getTime()
          ? latest
          : initialState;
        lastPersistedStateRef.current = selectedState;
        dispatch({ type: 'INIT', payload: selectedState });
        setIsLoaded(true);
      }
    }).catch((error) => {
      if (!isMounted) return;
      console.error('Initial tournament load failed:', error);
      syncBlockedRef.current = true;
      setSyncError(error instanceof Error ? error.message : '大会データを読み込めませんでした。');
      dispatch({ type: 'INIT', payload: DEFAULT_APP_STATE });
      setIsLoaded(true);
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

      const baseState = lastPersistedStateRef.current;
      const visibleState = currentStateRef.current;
      if (!baseState) {
        lastPersistedStateRef.current = remoteState;
        dispatch({ type: 'INIT', payload: remoteState });
        setIsLoaded(true);
        return;
      }

      if (hasSameTournamentData(remoteState, baseState)) {
        lastPersistedStateRef.current = remoteState;
        return;
      }

      if (hasSameTournamentData(visibleState, baseState)) {
        lastPersistedStateRef.current = remoteState;
        setSyncError(null);
        dispatch({ type: 'INIT', payload: remoteState });
        setIsLoaded(true);
      } else {
        try {
          const mergedState = mergeConcurrentStates(baseState, visibleState, remoteState);
          lastPersistedStateRef.current = remoteState;
          setSyncError(null);
          dispatch({ type: 'INIT', payload: mergedState });
          setIsLoaded(true);
        } catch (error) {
          syncBlockedRef.current = true;
          const message = error instanceof Error ? error.message : '同時更新を統合できませんでした。';
          setSyncError(`${message} 入力内容を控え、最新データを再読み込みしてください。`);
        }
      }
    }, setSyncError);

    return () => {
      unsubscribe();
    };
  }, []);

  // ローカルの state 変更を検知して自動保存 (save)
  useEffect(() => {
    if (!isLoaded || !lastPersistedStateRef.current || syncBlockedRef.current) return;
    if (hasSameTournamentData(state, lastPersistedStateRef.current)) return;
    void persistState(state).catch((error) => {
      console.error('Failed to auto-save tournament state:', error);
    });
  }, [state, isLoaded, persistState]);

  const saveNow = async () => {
    await persistState(currentStateRef.current, true);
  };

  const reloadLatest = async () => {
    try {
      const latest = await getOnce();
      lastPersistedStateRef.current = latest;
      syncBlockedRef.current = false;
      setSyncError(null);
      dispatch({ type: 'INIT', payload: latest });
      setIsLoaded(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '大会データを再読み込みできませんでした。';
      setSyncError(message);
      throw error;
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
      reloadLatest,
      syncError,
    }),
    [state, standings, isLoaded, deviceLabel, syncError]
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
