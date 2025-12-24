// Copyright (C) 2025 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

import type { TelemetryReporter } from '@vscode/extension-telemetry';
import type { InjectionToken } from 'tsyringe';
import type { LogOutputChannel } from 'vscode';
import type { IBuildInfo } from '@/application/ports/node/IBuildInfo';
import type { IClock } from '@/application/ports/node/IClock';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ISystem } from '@/application/ports/node/ISystem';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { ICheckerRunner } from '@/application/ports/problems/ICheckerRunner';
import type { ICompiler } from '@/application/ports/problems/ICompiler';
import type { IRunnerProvider } from '@/application/ports/problems/IRunnerProvider';
import type { IRunStrategyFactory } from '@/application/ports/problems/IRunStrategyFactory';
import type { ISolutionRunner } from '@/application/ports/problems/ISolutionRunner';
import type { ICompilerService } from '@/application/ports/services/ICompilerService';
import type { ILanguageRegistry } from '@/application/ports/services/ILanguageRegistry';
import type { IPathRenderer } from '@/application/ports/services/IPathRenderer';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IWebviewEventBus } from '@/application/ports/vscode/IWebviewEventBus';
import type { RunAllTestCases } from '@/application/useCases/RunAllTestCases';
import type { RunSingleTc } from '@/application/useCases/RunSingleTc';

// Centralized DI tokens for tsyringe registrations
// Keep these as string literals to avoid circular imports and enable tree-shaking

export const TOKENS = {
  // VS Code context and utilities
  ExtensionPath: 'vscode.ExtensionPath' as InjectionToken<string>,
  LogOutputChannel:
    'vscode.LogOutputChannel' as InjectionToken<LogOutputChannel>,
  TelemetryReporter:
    'vscode.TelemetryReporter' as InjectionToken<TelemetryReporter>,

  // Core ports
  System: 'ports.System' as InjectionToken<ISystem>,
  FileSystem: 'ports.FileSystem' as InjectionToken<IFileSystem>,
  ProcessExecutor: 'ports.ProcessExecutor' as InjectionToken<IProcessExecutor>,
  Runner: 'ports.Runner' as InjectionToken<ISolutionRunner>,
  Compiler: 'ports.Compiler' as InjectionToken<ICompiler>,
  SolutionRunner: 'ports.SolutionRunner' as InjectionToken<ISolutionRunner>,
  CheckerRunner: 'ports.CheckerRunner' as InjectionToken<ICheckerRunner>,
  Settings: 'ports.Settings' as InjectionToken<ISettings>,
  WebviewEventBus: 'ports.WebviewEventBus' as InjectionToken<IWebviewEventBus>,
  Logger: 'ports.Logger' as InjectionToken<ILogger>,
  Translator: 'ports.Translator' as InjectionToken<ITranslator>,
  RunnerProvider: 'ports.RunnerProvider' as InjectionToken<IRunnerProvider>,
  Telemetry: 'ports.Telemetry' as InjectionToken<ITelemetry>,
  PathRenderer: 'ports.PathRenderer' as InjectionToken<IPathRenderer>,
  TempStorage: 'ports.TempStorage' as InjectionToken<ITempStorage>,
  Clock: 'ports.Clock' as InjectionToken<IClock>,
  Crypto: 'ports.Crypto' as InjectionToken<ICrypto>,
  BuildInfo: 'ports.BuildInfo' as InjectionToken<IBuildInfo>,
  RunStrategyFactory:
    'ports.RunStrategyFactory' as InjectionToken<IRunStrategyFactory>,
  LanguageRegistry:
    'ports.LanguageRegistry' as InjectionToken<ILanguageRegistry>,
  CompilerService: 'ports.CompilerService' as InjectionToken<ICompilerService>,

  // Use cases
  RunSingleTc: 'useCases.RunSingleTc' as InjectionToken<RunSingleTc>,
  RunAllTestCases:
    'useCases.RunAllTestCases' as InjectionToken<RunAllTestCases>,
};

export type TokenKeys = keyof typeof TOKENS;
