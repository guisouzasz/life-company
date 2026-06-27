/**
 * Storage adapter simples usando expo-file-system
 * Substitui AsyncStorage sem precisar de instalação extra
 */
import * as FileSystem from 'expo-file-system';

const DIR = FileSystem.documentDirectory + 'studio/';
const FILE = DIR + 'auth.json';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

export const Storage = {
  async get(key: string): Promise<string | null> {
    try {
      await ensureDir();
      const info = await FileSystem.getInfoAsync(FILE);
      if (!info.exists) return null;
      const raw = await FileSystem.readAsStringAsync(FILE);
      const obj = JSON.parse(raw);
      return obj[key] ?? null;
    } catch { return null; }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      await ensureDir();
      let obj: Record<string, string> = {};
      const info = await FileSystem.getInfoAsync(FILE);
      if (info.exists) {
        const raw = await FileSystem.readAsStringAsync(FILE);
        obj = JSON.parse(raw);
      }
      obj[key] = value;
      await FileSystem.writeAsStringAsync(FILE, JSON.stringify(obj));
    } catch {}
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    try {
      await ensureDir();
      const info = await FileSystem.getInfoAsync(FILE);
      if (!info.exists) return keys.map(k => [k, null]);
      const raw = await FileSystem.readAsStringAsync(FILE);
      const obj = JSON.parse(raw);
      return keys.map(k => [k, obj[k] ?? null]);
    } catch { return keys.map(k => [k, null]); }
  },

  async multiSet(pairs: [string, string][]): Promise<void> {
    try {
      await ensureDir();
      let obj: Record<string, string> = {};
      const info = await FileSystem.getInfoAsync(FILE);
      if (info.exists) {
        const raw = await FileSystem.readAsStringAsync(FILE);
        obj = JSON.parse(raw);
      }
      pairs.forEach(([k, v]) => { obj[k] = v; });
      await FileSystem.writeAsStringAsync(FILE, JSON.stringify(obj));
    } catch {}
  },

  async multiRemove(keys: string[]): Promise<void> {
    try {
      await ensureDir();
      const info = await FileSystem.getInfoAsync(FILE);
      if (!info.exists) return;
      const raw = await FileSystem.readAsStringAsync(FILE);
      const obj = JSON.parse(raw);
      keys.forEach(k => delete obj[k]);
      await FileSystem.writeAsStringAsync(FILE, JSON.stringify(obj));
    } catch {}
  },
};
