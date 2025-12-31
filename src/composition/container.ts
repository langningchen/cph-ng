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

import { TelemetryReporter } from '@vscode/extension-telemetry';
import { container } from 'tsyringe';
import { type ExtensionContext, window } from 'vscode';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { RunAllTestCases } from '@/application/useCases/RunAllTestCases';
import { RunSingleTc } from '@/application/useCases/RunSingleTc';
import { BuildInfoAdapter } from '@/infrastructure/node/buildInfoAdapter';
import { ClockAdapter } from '@/infrastructure/node/clockAdapter';
import { CryptoAdapter } from '@/infrastructure/node/cryptoAdapter';
import { FileSystemAdapter } from '@/infrastructure/node/fileSystemAdapter';
import { ProcessExecutorAdapter } from '@/infrastructure/node/processExecutorAdapter';
import { SystemAdapter } from '@/infrastructure/node/systemAdapter';
import { TempStorageAdapter } from '@/infrastructure/node/tempStorageAdapter';
import { CheckerRunnerAdapter } from '@/infrastructure/problems/checkerRunnerAdapter';
import { CompilerService } from '@/infrastructure/problems/compilerService';
import { ExecutionStrategyFactoryAdapter } from '@/infrastructure/problems/runner/execution/executionStrategyFactoryAdapter';
import { RunnerProviderAdapter } from '@/infrastructure/problems/runner/execution/strategies/runnerProviderAdapter';
import { SolutionRunnerAdapter } from '@/infrastructure/problems/runner/solutionRunnerAdapter';
import { LanguageRegistry } from '@/infrastructure/services/languageRegistry';
import { PathRendererAdapter } from '@/infrastructure/services/pathRendererAdapter';
import { LoggerAdapter } from '@/infrastructure/vscode/loggerAdapter';
import { SettingsAdapter } from '@/infrastructure/vscode/settingsAdapter';
import { TelemetryAdapter } from '@/infrastructure/vscode/telemetryAdapter';
import { TranslatorAdapter } from '@/infrastructure/vscode/translatorAdapter';
import { WebviewEventBusAdapter } from '@/infrastructure/vscode/webviewEventBus';
import { TOKENS } from './tokens';

export async function setupContainer(context: ExtensionContext): Promise<void> {
  container.registerSingleton(TOKENS.BuildInfo, BuildInfoAdapter);
  container.registerSingleton(TOKENS.CheckerRunner, CheckerRunnerAdapter);
  container.registerSingleton(TOKENS.Clock, ClockAdapter);
  container.registerSingleton(TOKENS.Crypto, CryptoAdapter);
  container.registerSingleton(TOKENS.FileSystem, FileSystemAdapter);
  container.registerSingleton(TOKENS.Logger, LoggerAdapter);
  container.registerSingleton(TOKENS.PathRenderer, PathRendererAdapter);
  container.registerSingleton(TOKENS.ProcessExecutor, ProcessExecutorAdapter);
  container.registerSingleton(TOKENS.Runner, SolutionRunnerAdapter);
  container.registerSingleton(TOKENS.RunnerProvider, RunnerProviderAdapter);
  container.registerSingleton(TOKENS.RunSingleTc, RunSingleTc);
  container.registerSingleton(TOKENS.RunAllTestCases, RunAllTestCases);
  container.registerSingleton(TOKENS.Settings, SettingsAdapter);
  container.registerSingleton(TOKENS.SolutionRunner, SolutionRunnerAdapter);
  container.registerSingleton(TOKENS.System, SystemAdapter);
  container.registerSingleton(TOKENS.Telemetry, TelemetryAdapter);
  container.registerSingleton(TOKENS.TempStorage, TempStorageAdapter);
  container.registerSingleton(TOKENS.Translator, TranslatorAdapter);
  container.registerSingleton(TOKENS.WebviewEventBus, WebviewEventBusAdapter);
  container.registerSingleton(
    TOKENS.ExecutionStrategyFactory,
    ExecutionStrategyFactoryAdapter,
  );
  container.registerSingleton(TOKENS.LanguageRegistry, LanguageRegistry);
  container.registerSingleton(TOKENS.CompilerService, CompilerService);

  container.registerInstance(TOKENS.ExtensionPath, context.extensionPath);

  const logOutputChannel = window.createOutputChannel('CPH-NG', { log: true });
  container.registerInstance(TOKENS.LogOutputChannel, logOutputChannel);

  const buildInfo = container.resolve(TOKENS.BuildInfo);
  buildInfo.load && (await buildInfo.load());
  container.registerInstance(TOKENS.BuildInfo, buildInfo);

  const logger = container
    .resolve<ILogger>(TOKENS.Logger)
    .withScope('container');
  const connectionString =
    'InstrumentationKey=ee659d58-b2b5-48b3-b05b-48865365c0d1;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=6ff8b3ee-dc15-4a9b-bab8-ffaa956f1773';
  const commitHash = buildInfo.commitHash;
  const telemetryReporter = new TelemetryReporter(
    connectionString,
    [],
    { additionalCommonProperties: { commitHash } },
    async (url, init) => {
      logger.debug(`Telemetry sent to ${url}`);
      const res = await fetch(url, init);
      return {
        status: res.status,
        headers: res.headers as unknown as Iterable<[string, string]>,
        text: () => res.text(),
      };
    },
  );
  container.registerInstance(TOKENS.TelemetryReporter, telemetryReporter);

  for (const key of Object.values(TOKENS)) {
    try {
      container.resolve(key as string);
    } catch (err) {
      logger.error(`Failed to resolve token ${key as string}: ${err}`);
    }
  }
}
