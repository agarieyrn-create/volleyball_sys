import { AppState } from '../types';

export class StateConflictError extends Error {
  constructor(public readonly path: string) {
    super(`別の端末でも同じデータが更新されました: ${path}`);
    this.name = 'StateConflictError';
  }
}

type JsonValue = unknown;

function clone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function equal(a: JsonValue, b: JsonValue): boolean {
  if (Object.is(a, b)) return true;
  if (a === undefined || b === undefined || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => equal(value, b[index]));
  }
  if (isRecord(a) || isRecord(b)) {
    if (!isRecord(a) || !isRecord(b)) return false;
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    return equal(keysA, keysB) && keysA.every((key) => equal(a[key], b[key]));
  }
  return false;
}

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasSameTournamentData(a: AppState, b: AppState): boolean {
  return (
    equal(a.settings, b.settings) &&
    equal(a.teams, b.teams) &&
    equal(a.matches, b.matches) &&
    equal(a.mvpVotes ?? [], b.mvpVotes ?? [])
  );
}

/**
 * 3-way merge for Firestore transactions. Independent match edits are kept;
 * conflicting edits to the same value are rejected instead of silently lost.
 */
export function mergeConcurrentStates(base: AppState, local: AppState, remote: AppState): AppState {
  const merged: Record<string, JsonValue> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);

  for (const key of keys) {
    if (key === 'updatedAt' || key === 'updatedBy') continue;
    const baseValue = key === 'mvpVotes' ? (base.mvpVotes ?? []) : base[key as keyof AppState];
    const localValue = key === 'mvpVotes' ? (local.mvpVotes ?? []) : local[key as keyof AppState];
    const remoteValue = key === 'mvpVotes' ? (remote.mvpVotes ?? []) : remote[key as keyof AppState];
    const value = mergeValue(baseValue, localValue, remoteValue, key);
    if (value !== undefined) merged[key] = value;
  }

  return {
    ...merged,
    updatedAt: remote.updatedAt,
    updatedBy: remote.updatedBy,
  } as AppState;
}

function mergeValue(base: JsonValue, local: JsonValue, remote: JsonValue, path: string): JsonValue {
  if (equal(local, base)) return clone(remote);
  if (equal(remote, base) || equal(local, remote)) return clone(local);

  if (isRecord(base) && isRecord(local) && isRecord(remote)) {
    const merged: Record<string, JsonValue> = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    for (const key of keys) {
      const value = mergeValue(base[key], local[key], remote[key], `${path}.${key}`);
      if (value !== undefined) merged[key] = value;
    }
    return merged;
  }

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    if (path === 'teams' || path === 'matches' || path === 'mvpVotes') {
      return mergeEntityArrays(base, local, remote, path);
    }
    if (path.endsWith('.sets')) {
      return mergeIndexedArrays(base, local, remote, path);
    }
  }

  throw new StateConflictError(path);
}

function mergeEntityArrays(
  base: JsonValue[],
  local: JsonValue[],
  remote: JsonValue[],
  path: string
): JsonValue[] {
  const asMap = (items: JsonValue[]) => {
    const map = new Map<string, JsonValue>();
    for (const item of items) {
      if (!isRecord(item) || typeof item.id !== 'string' || map.has(item.id)) {
        throw new StateConflictError(path);
      }
      map.set(item.id, item);
    }
    return map;
  };

  const baseMap = asMap(base);
  const localMap = asMap(local);
  const remoteMap = asMap(remote);
  const ids = new Set([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()]);
  const mergedMap = new Map<string, JsonValue>();

  for (const id of ids) {
    const value = mergeValue(baseMap.get(id), localMap.get(id), remoteMap.get(id), `${path}.${id}`);
    if (value !== undefined) mergedMap.set(id, value);
  }

  const baseOrder = base.map((item) => (item as Record<string, JsonValue>).id as string);
  const localOrder = local.map((item) => (item as Record<string, JsonValue>).id as string);
  const remoteOrder = remote.map((item) => (item as Record<string, JsonValue>).id as string);
  const baseIds = new Set(baseOrder);
  const localBaseOrder = localOrder.filter((id) => baseIds.has(id));
  const remoteBaseOrder = remoteOrder.filter((id) => baseIds.has(id));
  const localReordered = !equal(localBaseOrder, baseOrder.filter((id) => localBaseOrder.includes(id)));
  const remoteReordered = !equal(remoteBaseOrder, baseOrder.filter((id) => remoteBaseOrder.includes(id)));

  if (localReordered && remoteReordered && !equal(localBaseOrder, remoteBaseOrder)) {
    throw new StateConflictError(`${path}.order`);
  }

  const preferredOrder = localReordered ? localOrder : remoteOrder;
  const orderedIds = [...preferredOrder, ...localOrder, ...remoteOrder].filter(
    (id, index, all) => mergedMap.has(id) && all.indexOf(id) === index
  );
  return orderedIds.map((id) => mergedMap.get(id)!);
}

function mergeIndexedArrays(
  base: JsonValue[],
  local: JsonValue[],
  remote: JsonValue[],
  path: string
): JsonValue[] {
  const maxLength = Math.max(base.length, local.length, remote.length);
  const merged: JsonValue[] = [];
  for (let index = 0; index < maxLength; index++) {
    const value = mergeValue(base[index], local[index], remote[index], `${path}[${index}]`);
    if (value !== undefined) merged[index] = value;
  }
  while (merged.length > 0 && merged[merged.length - 1] === undefined) merged.pop();
  return merged;
}
