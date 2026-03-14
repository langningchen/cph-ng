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

import type { CompanionProblem, TestcaseId } from '@cph-ng/core';
import type { ICrypto } from '@v/application/ports/node/ICrypto';
import type { IFileSystem } from '@v/application/ports/node/IFileSystem';
import type { IPath } from '@v/application/ports/node/IPath';
import type { IProblemRepository } from '@v/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@v/application/ports/problems/IProblemService';
import type { IActiveProblemCoordinator } from '@v/application/ports/services/IActiveProblemCoordinator';
import type { ITemplateRenderer } from '@v/application/ports/services/ITemplateRenderer';
import type { IUserScriptService } from '@v/application/ports/services/IUserScriptService';
import type { ILogger } from '@v/application/ports/vscode/ILogger';
import type { ITranslator } from '@v/application/ports/vscode/ITranslator';
import type { IUi } from '@v/application/ports/vscode/IUi';
import type { IWorkspace } from '@v/application/ports/vscode/IWorkspace';
import { TOKENS } from '@v/composition/tokens';
import { Problem } from '@v/domain/entities/problem';
import { Testcase } from '@v/domain/entities/testcase';
import { TestcaseIo } from '@v/domain/entities/testcaseIo';
import { inject, injectable } from 'tsyringe';
import { Uri } from 'vscode';

@injectable()
export class ImportCompanionProblems {
  public constructor(
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.problemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
    @inject(TOKENS.templateRenderer) private readonly templateRenderer: ITemplateRenderer,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(TOKENS.userScriptService) private readonly userScript: IUserScriptService,
    @inject(TOKENS.workspace) private readonly workspace: IWorkspace,
    @inject(TOKENS.activeProblemCoordinator)
    private readonly coordinator: IActiveProblemCoordinator,
  ) {
    this.logger = this.logger.withScope('importCompanionProblems');
  }

  public async exec(companionProblems: CompanionProblem[]): Promise<void> {
    if (!companionProblems || companionProblems.length === 0) {
      this.ui.alert(
        'warn',
        this.translator.t('No problems were received from Companion. Nothing to import.'),
      );
      return;
    }

    // Resolve paths using user script
    const workspaceFolders = this.workspace
      .getWorkspaceFolders()
      .map((f: { index: number; name: string; uri: { fsPath: string } }) => ({
        index: f.index,
        name: f.name,
        path: f.uri.fsPath,
      }));

    const srcPaths = await this.userScript.resolvePaths(companionProblems, workspaceFolders);
    if (!srcPaths) {
      this.logger.info('User script did not return paths, import cancelled');
      return;
    }

    this.logger.debug('Resolved source paths', srcPaths);

    // Create problems and source files
    const createdPaths: string[] = [];
    for (let i = 0; i < companionProblems.length; i++) {
      const companionProblem = companionProblems[i];
      const srcPath = srcPaths[i];
      if (!srcPath) {
        this.logger.warn(`Skipping problem ${companionProblem.name} - no path resolved`);
        continue;
      }

      try {
        // Create the problem entity
        const problem = new Problem(companionProblem.name, srcPath);
        problem.url = companionProblem.url;
        problem.overrides = {
          timeLimitMs: companionProblem.timeLimit,
          memoryLimitMb: companionProblem.memoryLimit,
          compiler: null,
          compilerArgs: null,
          runner: null,
          runnerArgs: null,
        };

        // Add testcases
        for (let testIdx = 0; testIdx < companionProblem.tests.length; testIdx++) {
          const test = companionProblem.tests[testIdx];
          const testcaseId = this.crypto.randomUUID() as TestcaseId;
          const stdin = new TestcaseIo({ data: test.input });
          const answer = new TestcaseIo({ data: test.output });
          const testcase = new Testcase(stdin, answer);
          problem.addTestcase(testcaseId, testcase);
        }

        // Create source file directory if needed
        const srcDir = this.path.dirname(srcPath);
        await this.fs.mkdir(srcDir);

        // Create source file with template
        if (await this.fs.exists(srcPath)) {
          this.logger.debug('Source file already exists', srcPath);
        } else {
          this.logger.debug('Creating new source file', srcPath);
          const content = await this.templateRenderer.render(problem);
          await this.fs.safeWriteFile(srcPath, content);
        }

        // Save the problem
        await this.problemService.save(problem);
        await this.repo.loadByPath(srcPath);
        createdPaths.push(srcPath);

        this.logger.info(`Successfully imported problem: ${companionProblem.name}`);
      } catch (e) {
        this.logger.error(`Failed to import problem ${companionProblem.name}`, e);
        this.ui.alert(
          'error',
          this.translator.t('Failed to import problem {name}: {msg}', {
            name: companionProblem.name,
            msg: (e as Error).message,
          }),
        );
      }
    }

    // Open the first created file
    if (createdPaths.length > 0) {
      this.ui.openFile(Uri.file(createdPaths[0]));

      if (createdPaths.length > 1) {
        this.ui.alert(
          'info',
          this.translator.t('Created {count} problems', { count: createdPaths.length }),
        );
      }
    }

    // Refresh the coordinator
    await this.coordinator.dispatchFullData();
  }
}
