export interface ISettingsProvider {
  get<T = unknown>(key: string, defaultValue?: T): T;
  // Commonly used shortcuts can be added later, e.g., timeouts, paths, flags
}
