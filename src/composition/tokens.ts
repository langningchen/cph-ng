// Centralized DI tokens for tsyringe registrations
// Keep these as string literals to avoid circular imports and enable tree-shaking

export const TOKENS = {
  // VS Code context and utilities
  ExtensionContext: 'vscode.ExtensionContext',

  // Core ports (to be implemented incrementally)
  FileSystem: 'ports.FileSystem',
  ProcessRunner: 'ports.ProcessRunner',
  Runner: 'ports.Runner',
  Compiler: 'ports.Compiler',
  ProblemRepository: 'ports.ProblemRepository',
  SettingsProvider: 'ports.SettingsProvider',
  WebviewEventBus: 'ports.WebviewEventBus',
  Logger: 'ports.Logger',
  Telemetry: 'ports.Telemetry',
  CacheStore: 'ports.CacheStore',
  Clock: 'ports.Clock',
  CompanionIntegration: 'ports.CompanionIntegration',
  CphImporter: 'ports.CphImporter',

  // Use cases
  RunSingleTc: 'usecases.RunSingleTc',
  RunAllTcs: 'usecases.RunAllTcs',
  CompileSolution: 'usecases.CompileSolution',
};

export type TokenKeys = keyof typeof TOKENS;
