import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_BASE_URL, STORAGE_KEYS } from './constants';
import type { SavedPlan } from './types';

export interface BriefDraft {
  originKey: string;
  origin: { lat: number; lng: number; label: string };
  budget: number;
  people: number;
  vibes: string[];
  nutrition: string;
  startKey: string;
  note: string;
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Không chặn UI nếu ghi lỗi.
  }
}

export const storage = {
  loadPlan: () => readJson<SavedPlan>(STORAGE_KEYS.savedPlan),
  savePlan: (plan: SavedPlan) => writeJson(STORAGE_KEYS.savedPlan, plan),
  clearPlan: () => AsyncStorage.removeItem(STORAGE_KEYS.savedPlan).catch(() => undefined),

  loadBrief: () => readJson<BriefDraft>(STORAGE_KEYS.lastBrief),
  saveBrief: (brief: BriefDraft) => writeJson(STORAGE_KEYS.lastBrief, brief),

  async loadApiBaseUrl(): Promise<string> {
    try {
      return (await AsyncStorage.getItem(STORAGE_KEYS.apiBaseUrl)) || DEFAULT_API_BASE_URL;
    } catch {
      return DEFAULT_API_BASE_URL;
    }
  },
  async saveApiBaseUrl(url: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.apiBaseUrl, url);
    } catch {
      // ignore
    }
  },
};
