import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./firebase', () => ({ db: {}, isFirebaseConfigured: true }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  runTransaction: vi.fn(),
}));

import { runTransaction } from 'firebase/firestore';
import { DEFAULT_APP_STATE } from './defaults';
import { getPendingLocalSave, save } from './repository';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

describe('repository offline save recovery', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('sessionStorage', new MemoryStorage());
    vi.stubGlobal('crypto', { randomUUID: () => 'test-tab' });
    vi.mocked(runTransaction).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists a pending copy before the Firestore transaction can fail', async () => {
    vi.mocked(runTransaction).mockImplementation(async () => {
      expect(getPendingLocalSave()?.state.settings).toEqual(DEFAULT_APP_STATE.settings);
      throw new Error('offline');
    });

    await expect(save(DEFAULT_APP_STATE, null)).rejects.toThrow('offline');

    const pending = getPendingLocalSave();
    expect(pending?.state.matches).toEqual(DEFAULT_APP_STATE.matches);
    expect(pending?.baseState).toBeNull();
  });
});
