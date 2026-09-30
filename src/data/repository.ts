import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { DEFAULT_APP_STATE } from './defaults';
import { AppState } from '../types';
import { ensureOfficialTournamentIntegrity } from '../logic/officialTournament';

const TOURNAMENT_DOC_PATH = 'tournaments/main';
const LOCAL_STORAGE_KEY = 'volleyball_tournament_main_state';
const DEVICE_LABEL_KEY = 'volleyball_device_label';

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

export function isLegacyDummyState(data: any): boolean {
  if (!data || !Array.isArray(data.teams) || data.teams.length === 0) return true;
  // ダミーチーム「営業部 A」などが含まれる、または公式チーム「遠目翼爆誕」が存在しない場合は移行対象
  const hasDummyTeam = data.teams.some((t: any) =>
    t.name && (t.name.includes('営業部 A') || t.name.includes('役員選抜'))
  );
  const hasOfficialTeam = data.teams.some((t: any) =>
    t.name && (t.name.includes('遠目翼爆誕') || t.name.includes('イナズマイレブン') || t.name.includes('PEC VOLTAGE'))
  );
  return hasDummyTeam || !hasOfficialTeam;
}

/**
 * tournaments/main をリアルタイム購読し、解除関数を返す
 */
export function subscribe(callback: (state: AppState) => void): () => void {
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'tournaments', 'main');
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as AppState;
          if (isLegacyDummyState(data)) {
            save(DEFAULT_APP_STATE).catch(console.error);
            callback(DEFAULT_APP_STATE);
          } else {
            const { state: verifiedState, upgraded } = ensureOfficialTournamentIntegrity(data);
            if (upgraded) {
              save(verifiedState).catch(console.error);
            }
            callback(verifiedState);
          }
        } else {
          // ドキュメントが存在しない場合はデフォルトで保存
          save(DEFAULT_APP_STATE).catch(console.error);
          callback(DEFAULT_APP_STATE);
        }
      },
      (error) => {
        console.error('Firestore snapshot error, falling back to local:', error);
        // エラー時はローカルからロード
        const local = loadLocal();
        callback(local);
      }
    );
    return unsubscribe;
  }

  // Firestore 未設定時のフォールバック (BroadcastChannel & storage イベント)
  const emitLocal = () => {
    const data = loadLocal();
    callback(data);
  };

  emitLocal();

  const handleBroadcast = (event: MessageEvent<AppState>) => {
    if (event.data) {
      if (isLegacyDummyState(event.data)) {
        save(DEFAULT_APP_STATE).catch(console.error);
        callback(DEFAULT_APP_STATE);
      } else {
        const { state: verifiedState, upgraded } = ensureOfficialTournamentIntegrity(event.data);
        if (upgraded) {
          save(verifiedState).catch(console.error);
        }
        callback(verifiedState);
      }
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === LOCAL_STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue) as AppState;
        if (isLegacyDummyState(parsed)) {
          save(DEFAULT_APP_STATE).catch(console.error);
          callback(DEFAULT_APP_STATE);
        } else {
          const { state: verifiedState, upgraded } = ensureOfficialTournamentIntegrity(parsed);
          if (upgraded) {
            save(verifiedState).catch(console.error);
          }
          callback(verifiedState);
        }
      } catch (err) {
        console.error('Failed to parse storage event state', err);
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
 * AppState を全体上書き保存。保存時に updatedAt=現在ISO, updatedBy=端末ラベルをセット。
 */
export async function save(state: AppState): Promise<AppState> {
  const updatedBy = getDeviceLabel() || (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 24) : 'Browser');
  const enrichedState: AppState = {
    ...state,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  // 常にローカルストレージにも保存
  saveLocal(enrichedState);

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'tournaments', 'main');
    await setDoc(docRef, enrichedState);
  } else {
    // ローカルブロードキャスト通知
    if (localBroadcast) {
      localBroadcast.postMessage(enrichedState);
    }
  }

  return enrichedState;
}

/**
 * 初回取得。無ければ defaults の AppState を作って書き込む。
 */
export async function getOnce(): Promise<AppState> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'tournaments', 'main');
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data() as AppState;
        if (isLegacyDummyState(data)) {
          await save(DEFAULT_APP_STATE);
          return DEFAULT_APP_STATE;
        }
        const { state: verifiedState, upgraded } = ensureOfficialTournamentIntegrity(data);
        if (upgraded) {
          await save(verifiedState);
        } else {
          saveLocal(verifiedState);
        }
        return verifiedState;
      } else {
        await save(DEFAULT_APP_STATE);
        return DEFAULT_APP_STATE;
      }
    } catch (e) {
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
  const parsed = JSON.parse(jsonString) as Partial<AppState>;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('無効なJSONデータです。');
  }

  if (!parsed.settings || typeof parsed.settings !== 'object') {
    throw new Error('大会設定(settings)が含まれていません。');
  }

  if (!Array.isArray(parsed.teams)) {
    throw new Error('チーム情報(teams)の配列が見つかりません。');
  }

  if (!Array.isArray(parsed.matches)) {
    throw new Error('試合データ(matches)の配列が見つかりません。');
  }

  return {
    schemaVersion: 1,
    settings: {
      ...DEFAULT_APP_STATE.settings,
      ...parsed.settings,
    },
    teams: parsed.teams.map((t, idx) => ({
      id: t.id || `team_${idx + 1}`,
      name: t.name || `チーム ${idx + 1}`,
      pool: t.pool,
      seed: t.seed,
    })),
    matches: parsed.matches,
    updatedAt: new Date().toISOString(),
    updatedBy: getDeviceLabel() || 'Import',
  };
}

function saveLocal(state: AppState): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save to local storage', e);
  }
}

function loadLocal(): AppState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.settings && parsed.teams && parsed.matches) {
        const { state: verifiedState } = ensureOfficialTournamentIntegrity(parsed as AppState);
        return verifiedState;
      }
    }
  } catch (e) {
    console.error('Failed to load from local storage', e);
  }
  return DEFAULT_APP_STATE;
}
