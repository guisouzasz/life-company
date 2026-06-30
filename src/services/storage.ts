/**
 * Adapter de armazenamento persistente.
 * Usa @react-native-async-storage/async-storage (funciona em iOS, Android e web).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const Storage = {
  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // silencioso: falha de storage não deve quebrar a UI
    }
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      return pairs.map(([k, v]) => [k, v ?? null]);
    } catch {
      return keys.map((k) => [k, null]);
    }
  },

  async multiSet(pairs: [string, string][]): Promise<void> {
    try {
      await AsyncStorage.multiSet(pairs);
    } catch {
      // silencioso
    }
  },

  async multiRemove(keys: string[]): Promise<void> {
    try {
      await AsyncStorage.multiRemove(keys);
    } catch {
      // silencioso
    }
  },
};
