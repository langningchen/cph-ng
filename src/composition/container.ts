// Copyright (C) 2026 Langning Chen
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
import { BuildInfoAdapter } from '@/infrastructure/node/buildInfoAdapter';
import { ClockAdapter } from '@/infrastructure/node/clockAdapter';
import { CryptoAdapter } from '@/infrastructure/node/cryptoAdapter';
import { FileSystemAdapter } from '@/infrastructure/node/fileSystemAdapter';
import { PathAdapter } from '@/infrastructure/node/pathAdapter';
import { ProcessExecutorAdapter } from '@/infrastructure/node/processExecutorAdapter';
import { SystemAdapter } from '@/infrastructure/node/systemAdapter';
import { TempStorageAdapter } from '@/infrastructure/node/tempStorageAdapter';
import { CphMigrationService } from '@/infrastructure/problems/cphMigrationService';
import { CheckerRunnerAdapter } from '@/infrastructure/problems/judge/checkerRunnerAdapter';
import { CompilerService } from '@/infrastructure/problems/judge/compilerService';
import { JudgeServiceFactory } from '@/infrastructure/problems/judge/judgeServiceFactoryAdapter';
import { LangCpp } from '@/infrastructure/problems/judge/langs/cppStrategy';
import { LangC } from '@/infrastructure/problems/judge/langs/cStrategy';
import { LangJava } from '@/infrastructure/problems/judge/langs/javaStrategy';
import { LangJavascript } from '@/infrastructure/problems/judge/langs/javascriptStrategy';
import { LanguageRegistry } from '@/infrastructure/problems/judge/langs/languageRegistry';
import { LangPython } from '@/infrastructure/problems/judge/langs/pythonStrategy';
import { ResultEvaluatorAdaptor } from '@/infrastructure/problems/judge/resultEvaluatorAdaptor';
import { ExecutionStrategyFactoryAdapter } from '@/infrastructure/problems/judge/runner/executionStrategyFactoryAdapter';
import { SolutionRunnerAdapter } from '@/infrastructure/problems/judge/runner/solutionRunnerAdapter';
import { RunnerProviderAdapter } from '@/infrastructure/problems/judge/runner/strategies/runnerProviderAdapter';
import { ProblemMigrationService } from '@/infrastructure/problems/problemMigrationService';
import { ProblemRepository } from '@/infrastructure/problems/problemRepository';
import { ProblemService } from '@/infrastructure/problems/problemService';
import { TcIoService } from '@/infrastructure/problems/tcIoService';
import { TcService } from '@/infrastructure/problems/tcService';
import { ActiveProblemCoordinator } from '@/infrastructure/services/activeProblemCoordinator';
import { ArchiveAdapter } from '@/infrastructure/services/archiveAdapter';
import { PathResolverAdapter } from '@/infrastructure/services/pathResolverAdapter';
import { ActivePathService } from '@/infrastructure/vscode/activePathService';
import { DocumentAdapter } from '@/infrastructure/vscode/documentAdapter';
import { ExtensionContextAdapter } from '@/infrastructure/vscode/extensionContextAdapter';
import { CommandModule } from '@/infrastructure/vscode/extensionModule/commandModule';
import { EditorWatcherModule } from '@/infrastructure/vscode/extensionModule/editorWatcherModule';
import { EnvironmentModule } from '@/infrastructure/vscode/extensionModule/environmentModule';
import { LlmModule } from '@/infrastructure/vscode/extensionModule/llmModule';
import { ProviderModule } from '@/infrastructure/vscode/extensionModule/providerModule';
import { LoggerAdapter } from '@/infrastructure/vscode/loggerAdapter';
import { ProblemFs } from '@/infrastructure/vscode/problemFs';
import { SettingsAdapter } from '@/infrastructure/vscode/settingsAdapter';
import { TelemetryAdapter } from '@/infrastructure/vscode/telemetryAdapter';
import { TranslatorAdapter } from '@/infrastructure/vscode/translatorAdapter';
import { UiAdapter } from '@/infrastructure/vscode/uiAdapter';
import { WebviewEventBusAdapter } from '@/infrastructure/vscode/webviewEventBus';
import { TOKENS } from './tokens';

export async function setupContainer(context: ExtensionContext): Promise<void> {
  container.registerSingleton(TOKENS.activePathService, ActivePathService);
  container.registerSingleton(TOKENS.activeProblemCoordinator, ActiveProblemCoordinator);
  container.registerSingleton(TOKENS.archive, ArchiveAdapter);
  container.registerSingleton(TOKENS.buildInfo, BuildInfoAdapter);
  container.registerSingleton(TOKENS.checkerRunner, CheckerRunnerAdapter);
  container.registerSingleton(TOKENS.clock, ClockAdapter);
  container.registerSingleton(TOKENS.compilerService, CompilerService);
  container.registerSingleton(TOKENS.cphMigrationService, CphMigrationService);
  container.registerSingleton(TOKENS.crypto, CryptoAdapter);
  container.registerSingleton(TOKENS.document, DocumentAdapter);
  container.registerSingleton(TOKENS.executionStrategyFactory, ExecutionStrategyFactoryAdapter);
  container.registerSingleton(TOKENS.extensionContext, ExtensionContextAdapter);
  container.registerSingleton(TOKENS.fileSystem, FileSystemAdapter);
  container.registerSingleton(TOKENS.judgeServiceFactory, JudgeServiceFactory);
  container.registerSingleton(TOKENS.languageRegistry, LanguageRegistry);
  container.registerSingleton(TOKENS.logger, LoggerAdapter);
  container.registerSingleton(TOKENS.path, PathAdapter);
  container.registerSingleton(TOKENS.pathResolver, PathResolverAdapter);
  container.registerSingleton(TOKENS.problemFs, ProblemFs);
  container.registerSingleton(TOKENS.problemMigrationService, ProblemMigrationService);
  container.registerSingleton(TOKENS.problemRepository, ProblemRepository);
  container.registerSingleton(TOKENS.problemService, ProblemService);
  container.registerSingleton(TOKENS.processExecutor, ProcessExecutorAdapter);
  container.registerSingleton(TOKENS.resultEvaluator, ResultEvaluatorAdaptor);
  container.registerSingleton(TOKENS.runner, SolutionRunnerAdapter);
  container.registerSingleton(TOKENS.runnerProvider, RunnerProviderAdapter);
  container.registerSingleton(TOKENS.settings, SettingsAdapter);
  container.registerSingleton(TOKENS.solutionRunner, SolutionRunnerAdapter);
  container.registerSingleton(TOKENS.system, SystemAdapter);
  container.registerSingleton(TOKENS.tcIoService, TcIoService);
  container.registerSingleton(TOKENS.tcService, TcService);
  container.registerSingleton(TOKENS.telemetry, TelemetryAdapter);
  container.registerSingleton(TOKENS.tempStorage, TempStorageAdapter);
  container.registerSingleton(TOKENS.translator, TranslatorAdapter);
  container.registerSingleton(TOKENS.ui, UiAdapter);
  container.registerSingleton(TOKENS.webviewEventBus, WebviewEventBusAdapter);

  container.register(TOKENS.languageStrategy, { useClass: LangC });
  container.register(TOKENS.languageStrategy, { useClass: LangCpp });
  container.register(TOKENS.languageStrategy, { useClass: LangJava });
  container.register(TOKENS.languageStrategy, { useClass: LangJavascript });
  container.register(TOKENS.languageStrategy, { useClass: LangPython });

  container.register(TOKENS.extensionModule, { useClass: ProviderModule });
  container.register(TOKENS.extensionModule, { useClass: CommandModule });
  container.register(TOKENS.extensionModule, { useClass: EnvironmentModule });
  container.register(TOKENS.extensionModule, { useClass: EditorWatcherModule });
  container.register(TOKENS.extensionModule, { useClass: LlmModule });

  container.registerInstance(TOKENS.version, context.extension.packageJSON.version);
  container.registerInstance(TOKENS.extensionPath, context.extensionPath);

  const logOutputChannel = window.createOutputChannel('CPH-NG', { log: true });
  container.registerInstance(TOKENS.logOutputChannel, logOutputChannel);

  const compilationOutputChannel = window.createOutputChannel('CPH-NG Compilation');
  container.registerInstance(TOKENS.compilationOutputChannel, compilationOutputChannel);

  const buildInfo = container.resolve(TOKENS.buildInfo);
  if (buildInfo.load) await buildInfo.load();
  container.registerInstance(TOKENS.buildInfo, buildInfo);

  const logger = container.resolve<ILogger>(TOKENS.logger).withScope('container');
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
  container.registerInstance(TOKENS.telemetryReporter, telemetryReporter);
}
