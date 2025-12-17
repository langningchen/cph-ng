import type { ISettingsProvider } from '@/application/ports/ISettingsProvider';
import Settings from '@/helpers/settings';

export class SettingsAdapter implements ISettingsProvider {
  get<T = unknown>(key: string, defaultValue?: T): T {
    // Settings is currently a static helper; delegate directly.
    const value = (Settings as unknown as Record<string, unknown>)[key];
    if (value === undefined) {
      return defaultValue as T;
    }
    return value as T;
  }
}

export default SettingsAdapter;
