export interface ITelemetry {
  init(): Promise<void>;
  start(name: string): () => void; // returns end() function
  error(name: string, error: unknown): void;
  event?(name: string, props?: Record<string, string | number | boolean>): void;
}
