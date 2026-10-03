import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { DEFAULT_APP_STATE } from '../data/defaults';
import {
  clearPendingLocalSave,
  getDeviceLabel,
  getOnce,
  getPendingLocalSave,
  save,
  setDeviceLabel,
  subscribe,
} from '../data/repository';
import { computeStandings } from '../logic/standings';
import { isFirebaseConfigured } from '../data/firebase';
import { AppState, Standing } from '../types';
import { TournamentAction, tournamentReducer } from './reducer';
import { hasSameTournamentData, mergeConcurrentStates, StateConflictError } from '../data/stateMerge';

export type SyncStatus = 'checking' | 'saving' | 'saved' | 'local' | 'error';

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
  syncStatus: SyncStatus;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(tournamentReducer, DEFAULT_APP_STATE);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [deviceLabel, setDeviceLabelState] = useState<string>('');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isFirebaseConfigured ? 'checking' : 'local');

  const currentStateRef = useRef<AppState>(state);
  currentStateRef.current = state;
  const lastPersistedStateRef = useRef<AppState | null>(null);
  const isSelfSavingRef = useRef<boolean>(false);
  const syncBlockedRef = useRef<boolean>(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSaveCountRef = useRef<number>(0);

  // 端末ラベルの初期化
  useEffect(() => {
    setDeviceLabelState(getDeviceLabel());
  }, []);

  const updateDeviceLabel = (label: string) => {
    setDeviceLabel(label);
    setDeviceLabelState(label);
  };

  const persistState = useCallback((candidate: AppState, force = false): Promise<AppState> => {
    pendingSaveCountRef.current += 1;
    setSyncStatus('saving');
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
        setSyncStatus('error');
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
    const trackedOperation = operation.finally(() => {
      pendingSaveCountRef.current = Math.max(0, pendingSaveCountRef.current - 1);
      if (pendingSaveCountRef.current > 0) {
        setSyncStatus((current) => current === 'error' ? current : 'saving');
      } else {
        setSyncStatus((current) => current === 'error' ? current : isFirebaseConfigured ? 'saved' : 'local');
      }
    });
    saveQueueRef.current = trackedOperation.then(() => undefined, () => undefined);
    return trackedOperation;
  }, []);

  // 初回データ取得
  useEffect(() => {
    let isMounted = true;
    getOnce().then((initialState) => {
      if (isMounted) {
        const latest = lastPersistedStateRef.current;
        const confirmedState = latest && new Date(latest.updatedAt).getTime() > new Date(initialState.updatedAt).getTime()
          ? latest
          : initialState;
        lastPersistedStateRef.current = confirmedState;
        let selectedState = confirmedState;
        let pendingState: ReturnType<typeof getPendingLocalSave> = null;
        try {
          pendingState = getPendingLocalSave();
          if (pendingState) {
            if (pendingState.baseState) {
              selectedState = mergeConcurrentStates(
                pendingState.baseState,
                pendingState.state,
                confirmedState
              );
            } else if (hasSameTournamentData(pendingState.state, confirmedState)) {
              selectedState = confirmedState;
            } else {
              throw new StateConflictError('未同期データ (保存元データが確認できません)');
            }

            if (hasSameTournamentData(selectedState, confirmedState)) {
              clearPendingLocalSave();
            }
          }
        } catch (error) {
          syncBlockedRef.current = true;
          const message = error instanceof Error ? error.message : '未同期データを復元できませんでした。';
          setSyncError(`${message} 未同期データは端末に残しています。最新データと照合してください。`);
          selectedState = pendingState?.state ?? confirmedState;
        }
        dispatch({ type: 'INIT', payload: selectedState });
        setIsLoaded(true);
      }
    }).catch((error) => {
      if (!isMounted) return;
      console.error('Initial tournament load failed:', error);
      syncBlockedRef.current = true;
      setSyncError(error instanceof Error ? error.message : '大会データを読み込めませんでした。');
      setSyncStatus('error');
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
    }, (message) => {
      setSyncError(message);
      setSyncStatus('error');
    }, () => {
      if (pendingSaveCountRef.current === 0) {
        setSyncStatus((current) => current === 'error' ? current : 'saved');
      }
    });

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
      const latest = await getOnce({ discardPending: true, requireRemote: true });
      lastPersistedStateRef.current = latest;
      syncBlockedRef.current = false;
      setSyncError(null);
      setSyncStatus(isFirebaseConfigured ? 'saved' : 'local');
      dispatch({ type: 'INIT', payload: latest });
      setIsLoaded(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '大会データを再読み込みできませんでした。';
      setSyncError(message);
      setSyncStatus('error');
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
      syncStatus,
    }),
    [state, standings, isLoaded, deviceLabel, syncError, syncStatus]
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
