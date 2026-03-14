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

import { BuildInfoAdapter } from '@v/infrastructure/node/buildInfoAdapter';
import { ClockAdapter } from '@v/infrastructure/node/clockAdapter';
import { CryptoAdapter } from '@v/infrastructure/node/cryptoAdapter';
import { FileSystemAdapter } from '@v/infrastructure/node/fileSystemAdapter';
import { PathAdapter } from '@v/infrastructure/node/pathAdapter';
import { ProcessExecutorAdapter } from '@v/infrastructure/node/processExecutorAdapter';
import { SystemAdapter } from '@v/infrastructure/node/systemAdapter';
import { TempStorageAdapter } from '@v/infrastructure/node/tempStorageAdapter';
import { CphMigrationService } from '@v/infrastructure/problems/cphMigrationService';
import { CheckerRunnerAdapter } from '@v/infrastructure/problems/judge/checkerRunnerAdapter';
import { CompilerService } from '@v/infrastructure/problems/judge/compilerService';
import { JudgeServiceFactory } from '@v/infrastructure/problems/judge/judgeServiceFactoryAdapter';
import { LangCpp } from '@v/infrastructure/problems/judge/langs/cppStrategy';
import { LangC } from '@v/infrastructure/problems/judge/langs/cStrategy';
import { LangJava } from '@v/infrastructure/problems/judge/langs/javaStrategy';
import { LangJavascript } from '@v/infrastructure/problems/judge/langs/javascriptStrategy';
import { LanguageRegistry } from '@v/infrastructure/problems/judge/langs/languageRegistry';
import { LangPython } from '@v/infrastructure/problems/judge/langs/pythonStrategy';
import { LangRust } from '@v/infrastructure/problems/judge/langs/rustStrategy';
import { ResultEvaluatorAdaptor } from '@v/infrastructure/problems/judge/resultEvaluatorAdaptor';
import { ExecutionStrategyFactoryAdapter } from '@v/infrastructure/problems/judge/runner/executionStrategyFactoryAdapter';
import { SolutionRunnerAdapter } from '@v/infrastructure/problems/judge/runner/solutionRunnerAdapter';
import { RunnerProviderAdapter } from '@v/infrastructure/problems/judge/runner/strategies/runnerProviderAdapter';
import { ProblemMigrationService } from '@v/infrastructure/problems/problemMigrationService';
import { ProblemRepository } from '@v/infrastructure/problems/problemRepository';
import { ProblemService } from '@v/infrastructure/problems/problemService';
import { TestcaseIoService } from '@v/infrastructure/problems/testcaseIoService';
import { ActiveProblemCoordinator } from '@v/infrastructure/services/activeProblemCoordinator';
import { ArchiveAdapter } from '@v/infrastructure/services/archiveAdapter';
import { Companion } from '@v/infrastructure/services/companion/companion';
import { PathResolverAdapter } from '@v/infrastructure/services/pathResolverAdapter';
import { TemplateRenderer } from '@v/infrastructure/services/templateRenderer';
import { UserScriptService } from '@v/infrastructure/services/userScriptService';
import { ActivePathService } from '@v/infrastructure/vscode/activePathService';
import { DocumentAdapter } from '@v/infrastructure/vscode/documentAdapter';
import { ExtensionContextAdapter } from '@v/infrastructure/vscode/extensionContextAdapter';
import { CommandModule } from '@v/infrastructure/vscode/extensionModule/commandModule';
import { EditorWatcherModule } from '@v/infrastructure/vscode/extensionModule/editorWatcherModule';
import { EnvironmentModule } from '@v/infrastructure/vscode/extensionModule/environmentModule';
import { LlmModule } from '@v/infrastructure/vscode/extensionModule/llmModule';
import { ProviderModule } from '@v/infrastructure/vscode/extensionModule/providerModule';
import { LlmDataInspector } from '@v/infrastructure/vscode/llmTools/llmDataInspector';
import { LlmProblemContext } from '@v/infrastructure/vscode/llmTools/llmProblemContext';
import { LlmTestcaseRunner } from '@v/infrastructure/vscode/llmTools/llmTcRunner';
import { LlmTestcaseEditor } from '@v/infrastructure/vscode/llmTools/llmTestCaseEditor';
import { LoggerAdapter } from '@v/infrastructure/vscode/loggerAdapter';
import { ProblemFs } from '@v/infrastructure/vscode/problemFs';
import { SettingsAdapter } from '@v/infrastructure/vscode/settingsAdapter';
import { SidebarProvider } from '@v/infrastructure/vscode/sidebarProvider';
import { TelemetryAdapter } from '@v/infrastructure/vscode/telemetryAdapter';
import { TranslatorAdapter } from '@v/infrastructure/vscode/translatorAdapter';
import { UiAdapter } from '@v/infrastructure/vscode/uiAdapter';
import { WebviewEventBusAdapter } from '@v/infrastructure/vscode/webviewEventBus';
import { WorkspaceAdapter } from '@v/infrastructure/vscode/workspaceAdapter';
import { TelemetryReporter } from '@vscode/extension-telemetry';
import { container } from 'tsyringe';
import { type ExtensionContext, window } from 'vscode';
import { TOKENS } from './tokens';

export async function setupContainer(context: ExtensionContext): Promise<void> {
  container.registerSingleton(TOKENS.activePathService, ActivePathService);
  container.registerSingleton(TOKENS.activeProblemCoordinator, ActiveProblemCoordinator);
  container.registerSingleton(TOKENS.archive, ArchiveAdapter);
  container.registerSingleton(TOKENS.buildInfo, BuildInfoAdapter);
  container.registerSingleton(TOKENS.checkerRunner, CheckerRunnerAdapter);
  container.registerSingleton(TOKENS.clock, ClockAdapter);
  container.registerSingleton(TOKENS.companion, Companion);
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
  container.registerSingleton(TOKENS.runnerProvider, RunnerProviderAdapter);
  container.registerSingleton(TOKENS.settings, SettingsAdapter);
  container.registerSingleton(TOKENS.sidebarProvider, SidebarProvider);
  container.registerSingleton(TOKENS.solutionRunner, SolutionRunnerAdapter);
  container.registerSingleton(TOKENS.system, SystemAdapter);
  container.registerSingleton(TOKENS.telemetry, TelemetryAdapter);
  container.registerSingleton(TOKENS.templateRenderer, TemplateRenderer);
  container.registerSingleton(TOKENS.tempStorage, TempStorageAdapter);
  container.registerSingleton(TOKENS.testcaseIoService, TestcaseIoService);
  container.registerSingleton(TOKENS.translator, TranslatorAdapter);
  container.registerSingleton(TOKENS.ui, UiAdapter);
  container.registerSingleton(TOKENS.userScriptService, UserScriptService);
  container.registerSingleton(TOKENS.webviewEventBus, WebviewEventBusAdapter);
  container.registerSingleton(TOKENS.workspace, WorkspaceAdapter);

  container.registerSingleton(LlmTestcaseRunner);
  container.registerSingleton(LlmDataInspector);
  container.registerSingleton(LlmTestcaseEditor);
  container.registerSingleton(LlmProblemContext);

  container.register(TOKENS.languageStrategy, { useClass: LangC });
  container.register(TOKENS.languageStrategy, { useClass: LangCpp });
  container.register(TOKENS.languageStrategy, { useClass: LangJava });
  container.register(TOKENS.languageStrategy, { useClass: LangJavascript });
  container.register(TOKENS.languageStrategy, { useClass: LangPython });
  container.register(TOKENS.languageStrategy, { useClass: LangRust });

  container.register(TOKENS.extensionModule, { useClass: ProviderModule });
  container.register(TOKENS.extensionModule, { useClass: CommandModule });
  container.register(TOKENS.extensionModule, { useClass: EnvironmentModule });
  container.register(TOKENS.extensionModule, { useClass: EditorWatcherModule });
  container.register(TOKENS.extensionModule, { useClass: LlmModule });

  container.registerInstance(TOKENS.version, context.extension.packageJSON.version);
  container.registerInstance(TOKENS.extensionPath, context.extensionPath);

  const logOutputChannel = window.createOutputChannel('CPH-NG', { log: true });
  container.registerInstance(TOKENS.logOutputChannel, logOutputChannel);

  const translator = container.resolve(TOKENS.translator);
  const compilationOutputChannel = window.createOutputChannel(translator.t('CPH-NG Compilation'));
  container.registerInstance(TOKENS.compilationOutputChannel, compilationOutputChannel);

  const buildInfo = container.resolve(TOKENS.buildInfo);
  if (buildInfo.load) await buildInfo.load();
  container.registerInstance(TOKENS.buildInfo, buildInfo);

  const logger = container.resolve(TOKENS.logger).withScope('container');
  const connectionString =
    'InstrumentationKey=ee659d58-b2b5-48b3-b05b-48865365c0d1;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=6ff8b3ee-dc15-4a9b-bab8-ffaa956f1773';
  const commitHash = buildInfo.commitHash;
  const telemetryReporter = new TelemetryReporter(
    connectionString,
    [],
    { additionalCommonProperties: { commitHash } },
    async (url, init) => {
      logger.trace('Telemetry sent', { url, init });
      const res = await fetch(url, init);
      return {
        status: res.status,
        headers: res.headers as unknown as Iterable<[string, string]>,
        text: () => res.text(),
      };
    },
  );
  container.registerInstance(TOKENS.telemetryReporter, telemetryReporter);

  let failed = false;
  const multiInstanceTokens = new Set<string>([
    TOKENS.extensionModule as string,
    TOKENS.languageStrategy as string,
  ]);
  for (const key of Object.values(TOKENS) as string[]) {
    try {
      if (multiInstanceTokens.has(key)) container.resolveAll(key);
      else container.resolve(key);
    } catch (e) {
      logger.error(`Resolve dependency ${key} failed`, { e });
      failed = true;
    }
  }
  const ui = container.resolve(TOKENS.ui);
  if (failed) ui.alert('error', `One or more dependencies resolved failed`);
  else logger.debug('Dependencies resolve test succeeded');
}
