import { doc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { DEFAULT_APP_STATE } from './defaults';
import { AppState } from '../types';
import { mergeConcurrentStates, hasSameTournamentData, StateConflictError } from './stateMerge';
import { validateAppState } from './validation';

const TOURNAMENT_DOC_PATH = 'tournaments/main';
const LOCAL_STORAGE_KEY = 'volleyball_tournament_main_state';
const PENDING_LOCAL_STORAGE_KEY = 'volleyball_tournament_main_pending_state';
const PENDING_TAB_ID_KEY = 'volleyball_tournament_main_pending_tab_id';
const DEVICE_LABEL_KEY = 'volleyball_device_label';

export interface PendingLocalSave {
  state: AppState;
  baseState: AppState | null;
}

function pendingLocalStorageKey(): string {
  try {
    let tabId = sessionStorage.getItem(PENDING_TAB_ID_KEY);
    if (!tabId) {
      tabId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(PENDING_TAB_ID_KEY, tabId);
    }
    return `${PENDING_LOCAL_STORAGE_KEY}:${tabId}`;
  } catch {
    // sessionStorage が使えない環境では、同じ端末の共有キーに退避する。
    return PENDING_LOCAL_STORAGE_KEY;
  }
}

function savePendingLocal(state: AppState, baseState: AppState | null): void {
  try {
    localStorage.setItem(
      pendingLocalStorageKey(),
      JSON.stringify({ version: 1, state, baseState })
    );
  } catch (error) {
    console.error('Failed to persist pending tournament state locally:', error);
    throw new Error('未同期データを端末内に保存できませんでした。入力内容を別途控えてください。');
  }
}

export function getPendingLocalSave(): PendingLocalSave | null {
  const raw = localStorage.getItem(pendingLocalStorageKey());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; state?: unknown; baseState?: unknown };
    if (parsed.version !== 1 || !parsed.state) throw new Error('形式が正しくありません。');
    const state = validateAppState(parsed.state, { strictResults: true });
    const baseState = parsed.baseState === null
      ? null
      : validateAppState(parsed.baseState);
    return { state, baseState };
  } catch (error) {
    console.error('Pending tournament state is invalid and was left untouched:', error);
    throw new Error('端末内の未同期データを読み込めません。データは削除していません。');
  }
}

export function clearPendingLocalSave(): void {
  try {
    localStorage.removeItem(pendingLocalStorageKey());
  } catch (error) {
    console.warn('Failed to clear pending tournament state:', error);
  }
}

export function getDeviceLabel(): string {
  try {
    return localStorage.getItem(DEVICE_LABEL_KEY) || '';
  } catch {
    return '';
  }
}

export function setDeviceLabel(label: string): void {
  try {
    localStorage.setItem(DEVICE_LABEL_KEY, label);
  } catch (e) {
    console.error('Failed to set device label', e);
  }
}

// ローカルフォールバック用の BroadcastChannel
const localBroadcast = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('volleyball_state_sync')
  : null;

/**
 * tournaments/main をリアルタイム購読し、解除関数を返す
 */
export function subscribe(
  callback: (state: AppState) => void,
  onError?: (message: string) => void
): () => void {
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'tournaments', 'main');
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          try {
            callback(validateAppState(snapshot.data()));
          } catch (error) {
            console.error('Invalid tournament document; it was left untouched:', error);
            onError?.('クラウド上の大会データに不整合があります。データは上書きしていません。');
            try {
              callback(loadLocal());
            } catch (localError) {
              console.error('No valid local recovery copy is available:', localError);
              onError?.('端末内にも読み込める保存データがありません。自動初期化は行っていません。');
            }
          }
        } else {
          // 初回保存は getOnce に一本化し、未同期の端末データを初期値で上書きしない。
          try {
            callback(loadLocal());
          } catch (error) {
            console.error('Local tournament fallback is invalid:', error);
            onError?.('端末内の大会データを読み込めません。自動初期化は行っていません。');
          }
        }
      },
      (error) => {
        console.error('Firestore snapshot error, falling back to local:', error);
        // エラー時はローカルからロード
        try {
          callback(loadLocal());
        } catch (localError) {
          console.error('Local fallback is also invalid:', localError);
          onError?.('クラウドと端末内のデータを読み込めません。自動初期化は行っていません。');
        }
      }
    );
    return unsubscribe;
  }

  // Firestore 未設定時のフォールバック (BroadcastChannel & storage イベント)
  const emitLocal = () => {
    try {
      callback(loadLocal());
    } catch (error) {
      console.error('Local tournament data is invalid:', error);
      onError?.('端末内の大会データを読み込めません。自動初期化は行っていません。');
    }
  };

  emitLocal();

  const handleBroadcast = (event: MessageEvent<AppState>) => {
    if (event.data) {
      try {
        callback(validateAppState(event.data));
      } catch (error) {
        console.error('Invalid local broadcast state:', error);
        onError?.('別の画面から受け取った大会データに不整合があります。');
      }
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === LOCAL_STORAGE_KEY && event.newValue) {
      try {
        const parsed = validateAppState(JSON.parse(event.newValue));
        callback(parsed);
      } catch (err) {
        console.error('Failed to parse storage event state', err);
        onError?.('ローカルに保存された大会データを読み込めませんでした。');
      }
    }
  };

  if (localBroadcast) {
    localBroadcast.addEventListener('message', handleBroadcast);
  }
  window.addEventListener('storage', handleStorage);

  return () => {
    if (localBroadcast) {
      localBroadcast.removeEventListener('message', handleBroadcast);
    }
    window.removeEventListener('storage', handleStorage);
  };
}

/**
 * AppStateを保存する。Firestoreでは変更差分をトランザクションで統合し、
 * 同じ値を別端末が同時に変更した場合は上書きせず競合として返す。
 */
export async function save(state: AppState, baseState: AppState | null = null): Promise<AppState> {
  validateAppState(state, { strictResults: true });
  const updatedBy = getDeviceLabel() || (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 24) : 'Browser');
  const enrichedState: AppState = {
    ...state,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, TOURNAMENT_DOC_PATH);
    // 通信断でも画面を閉じた後に復元できるよう、Firestore transaction より先に保留保存する。
    savePendingLocal(enrichedState, baseState);
    const savedState = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists()) {
        transaction.set(docRef, enrichedState);
        return enrichedState;
      }

      const remoteState = validateAppState(snapshot.data());
      let mergedState: AppState;
      if (baseState) {
        mergedState = mergeConcurrentStates(baseState, state, remoteState);
      } else if (hasSameTournamentData(state, remoteState)) {
        mergedState = remoteState;
      } else {
        throw new StateConflictError('大会全体 (保存元データが確認できません)');
      }

      const nextState: AppState = {
        ...mergedState,
        updatedAt: new Date().toISOString(),
        updatedBy,
      };
      validateAppState(nextState, { strictResults: true });
      transaction.set(docRef, nextState);
      return nextState;
    });
    saveLocal(savedState);
    clearPendingLocalSave();
    return savedState;
  } else {
    saveLocal(enrichedState);
    // ローカルブロードキャスト通知
    if (localBroadcast) {
      localBroadcast.postMessage(enrichedState);
    }
    return enrichedState;
  }
}

/**
 * 初回取得。無ければ defaults の AppState を作って書き込む。
 */
export async function getOnce(options: { discardPending?: boolean; requireRemote?: boolean } = {}): Promise<AppState> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'tournaments', 'main');
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = validateAppState(snapshot.data());
        saveLocal(data);
        if (options.discardPending) clearPendingLocalSave();
        return data;
      } else {
        if (options.discardPending) {
          // 共有データが存在しないことを確認できた場合のみ、明示的な再読込で保留分を破棄する。
          clearPendingLocalSave();
          saveLocal(DEFAULT_APP_STATE);
          return DEFAULT_APP_STATE;
        }
        const pending = getPendingLocalSave();
        if (pending) {
          return await save(pending.state, pending.baseState);
        }
        try {
          return await save(DEFAULT_APP_STATE, null);
        } catch (error) {
          // 初期化競合なら、今作成された共有データを読み直す。
          if (!(error instanceof StateConflictError)) throw error;
          const latest = await getDoc(docRef);
          if (latest.exists()) return validateAppState(latest.data());
          throw error;
        }
      }
    } catch (e) {
      if (options.requireRemote) throw e;
      console.warn('getDoc failed, reading from local', e);
      return loadLocal();
    }
  }

  return loadLocal();
}

/**
 * JSON文字列へエクスポート
 */
export function exportJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

/**
 * JSON文字列からインポート（最低限のスキーマ検証）
 */
export function importJson(jsonString: string): AppState {
  let parsed: Partial<AppState>;
  try {
    parsed = JSON.parse(jsonString) as Partial<AppState>;
  } catch {
    throw new Error('JSONの構文が正しくありません。');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('無効なJSONデータです。');
  }

  if (!parsed.settings || typeof parsed.settings !== 'object' || Array.isArray(parsed.settings)) {
    throw new Error('大会設定(settings)が含まれていません。');
  }

  if (!Array.isArray(parsed.teams)) {
    throw new Error('チーム情報(teams)の配列が見つかりません。');
  }

  if (!Array.isArray(parsed.matches)) throw new Error('試合データ(matches)の配列が見つかりません。');

  const imported = {
    schemaVersion: 1,
    settings: {
      ...DEFAULT_APP_STATE.settings,
      ...parsed.settings,
    },
    teams: parsed.teams.map((team, idx) => {
      if (!team || typeof team !== 'object' || Array.isArray(team)) {
        throw new Error(`チーム${idx + 1}の形式が正しくありません。`);
      }
      return {
        id: team.id || `team_${idx + 1}`,
        name: team.name || `チーム ${idx + 1}`,
        pool: team.pool,
        seed: team.seed,
      };
    }),
    matches: parsed.matches,
    updatedAt: new Date().toISOString(),
    updatedBy: getDeviceLabel() || 'Import',
  };
  return validateAppState(imported, { strictResults: true, strictTeamReferences: true });
}

function saveLocal(state: AppState): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save to local storage', e);
  }
}

function loadLocal(): AppState {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return DEFAULT_APP_STATE;
  try {
    return validateAppState(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to load local tournament state; it was left untouched:', error);
    throw new Error('ローカル保存データの形式が正しくありません。');
  }
}
