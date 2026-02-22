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

import type { TelemetryReporter } from '@vscode/extension-telemetry';
import type { InjectionToken } from 'tsyringe';
import type { LogOutputChannel, OutputChannel } from 'vscode';
import type { IBuildInfo } from '@/application/ports/node/IBuildInfo';
import type { IClock } from '@/application/ports/node/IClock';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { IProcessExecutor } from '@/application/ports/node/IProcessExecutor';
import type { ISystem } from '@/application/ports/node/ISystem';
import type { ITempStorage } from '@/application/ports/node/ITempStorage';
import type { ICphMigrationService } from '@/application/ports/problems/ICphMigrationService';
import type { IProblemMigrationService } from '@/application/ports/problems/IProblemMigrationService';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { ITestcaseIoService } from '@/application/ports/problems/ITestcaseIoService';
import type { ICheckerRunner } from '@/application/ports/problems/judge/ICheckerRunner';
import type { ICompilerService } from '@/application/ports/problems/judge/ICompilerService';
import type { IJudgeServiceFactory } from '@/application/ports/problems/judge/IJudgeServiceFactory';
import type { IResultEvaluator } from '@/application/ports/problems/judge/IResultEvaluator';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ILanguageStrategy } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IExecutionStrategyFactory } from '@/application/ports/problems/judge/runner/execution/IExecutionStrategyFactory';
import type { IRunnerProvider } from '@/application/ports/problems/judge/runner/execution/strategies/IRunnerProvider';
import type { ISolutionRunner } from '@/application/ports/problems/judge/runner/ISolutionRunner';
import type { IActiveProblemCoordinator } from '@/application/ports/services/IActiveProblemCoordinator';
import type { IArchive } from '@/application/ports/services/IArchive';
import type { ICompanion } from '@/application/ports/services/ICompanion';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { ITemplateRenderer } from '@/application/ports/services/ITemplateRenderer';
import type { IUserScriptService } from '@/application/ports/services/IUserScriptService';
import type { IActivePathService } from '@/application/ports/vscode/IActivePathService';
import type { IDocument } from '@/application/ports/vscode/IDocument';
import type { IExtensionContext } from '@/application/ports/vscode/IExtensionContext';
import type { IExtensionModule } from '@/application/ports/vscode/IExtensionModule';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { IProblemFs } from '@/application/ports/vscode/IProblemFs';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import type { IWebviewEventBus } from '@/application/ports/vscode/IWebviewEventBus';
import type { IWorkspace } from '@/application/ports/vscode/IWorkspace';

// Centralized DI tokens for tsyringe registrations
// Keep these as string literals to avoid circular imports and enable tree-shaking

export const TOKENS = {
  // VS Code context and utilities
  activePathService: 'vscode.ActivePathService' as InjectionToken<IActivePathService>,
  extensionModule: 'vscode.ExtensionModule' as InjectionToken<IExtensionModule>,
  document: 'vscode.Document' as InjectionToken<IDocument>,
  extensionContext: 'vscode.ExtensionContext' as InjectionToken<IExtensionContext>,
  extensionPath: 'vscode.ExtensionPath' as InjectionToken<string>,
  logOutputChannel: 'vscode.LogOutputChannel' as InjectionToken<LogOutputChannel>,
  compilationOutputChannel: 'vscode.CompilationOutputChannel' as InjectionToken<OutputChannel>,
  telemetryReporter: 'vscode.TelemetryReporter' as InjectionToken<TelemetryReporter>,
  version: 'vscode.Version' as InjectionToken<string>,

  // Core ports
  archive: 'ports.Archive' as InjectionToken<IArchive>,
  activeProblemCoordinator:
    'ports.ActiveProblemCoordinator' as InjectionToken<IActiveProblemCoordinator>,
  buildInfo: 'ports.BuildInfo' as InjectionToken<IBuildInfo>,
  checkerRunner: 'ports.CheckerRunner' as InjectionToken<ICheckerRunner>,
  clock: 'ports.Clock' as InjectionToken<IClock>,
  compilerService: 'ports.CompilerService' as InjectionToken<ICompilerService>,
  crypto: 'ports.Crypto' as InjectionToken<ICrypto>,
  fileSystem: 'ports.FileSystem' as InjectionToken<IFileSystem>,
  judgeServiceFactory: 'ports.JudgeServiceFactory' as InjectionToken<IJudgeServiceFactory>,
  languageRegistry: 'ports.LanguageRegistry' as InjectionToken<ILanguageRegistry>,
  languageStrategy: 'ports.LanguageStrategy' as InjectionToken<ILanguageStrategy>,
  logger: 'ports.Logger' as InjectionToken<ILogger>,
  cphMigrationService: 'ports.CphMigrationService' as InjectionToken<ICphMigrationService>,
  path: 'ports.Path' as InjectionToken<IPath>,
  pathResolver: 'ports.PathResolver' as InjectionToken<IPathResolver>,
  problemService: 'ports.ProblemService' as InjectionToken<IProblemService>,
  processExecutor: 'ports.ProcessExecutor' as InjectionToken<IProcessExecutor>,
  resultEvaluator: 'ports.ResultEvaluator' as InjectionToken<IResultEvaluator>,
  runnerProvider: 'ports.RunnerProvider' as InjectionToken<IRunnerProvider>,
  settings: 'ports.Settings' as InjectionToken<ISettings>,
  solutionRunner: 'ports.SolutionRunner' as InjectionToken<ISolutionRunner>,
  system: 'ports.System' as InjectionToken<ISystem>,
  templateRenderer: 'ports.TemplateRenderer' as InjectionToken<ITemplateRenderer>,
  testcaseIoService: 'ports.TestcaseIoService' as InjectionToken<ITestcaseIoService>,
  telemetry: 'ports.Telemetry' as InjectionToken<ITelemetry>,
  tempStorage: 'ports.TempStorage' as InjectionToken<ITempStorage>,
  translator: 'ports.Translator' as InjectionToken<ITranslator>,
  ui: 'ports.Ui' as InjectionToken<IUi>,
  userScriptService: 'ports.UserScriptService' as InjectionToken<IUserScriptService>,
  companion: 'ports.Companion' as InjectionToken<ICompanion>,
  webviewEventBus: 'ports.WebviewEventBus' as InjectionToken<IWebviewEventBus>,
  workspace: 'ports.Workspace' as InjectionToken<IWorkspace>,
  problemMigrationService:
    'ports.ProblemMigrationService' as InjectionToken<IProblemMigrationService>,
  executionStrategyFactory:
    'ports.ExecutionStrategyFactory' as InjectionToken<IExecutionStrategyFactory>,

  // Repositories
  problemRepository: 'repositories.ProblemRepository' as InjectionToken<IProblemRepository>,
  problemFs: 'repositories.ProblemFs' as InjectionToken<IProblemFs>,
};
