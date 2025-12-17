export interface AppEvent<T = unknown> {
  type: string;
  payload?: T;
}

export interface IWebviewEventBus {
  publish<T = unknown>(event: AppEvent<T>): void;
}
export interface IWebviewEventBus {
  publish<T extends { type: string; payload?: unknown }>(event: T): void;
}
