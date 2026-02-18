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

import { inject, injectable } from 'tsyringe';
import { commands, type ExtensionContext, env } from 'vscode';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { ISystem } from '@/application/ports/node/ISystem';
import type { ICphMigrationService } from '@/application/ports/problems/ICphMigrationService';
import type { IProblemRepository } from '@/application/ports/problems/IProblemRepository';
import type { IProblemService } from '@/application/ports/problems/IProblemService';
import type { IActivePathService } from '@/application/ports/vscode/IActivePathService';
import type { IExtensionModule } from '@/application/ports/vscode/IExtensionModule';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { CreateProblem } from '@/application/useCases/webview/CreateProblem';
import { ImportProblem } from '@/application/useCases/webview/ImportProblem';
import { RunAllTestcases } from '@/application/useCases/webview/RunAllTestcases';
import { StopTestcases } from '@/application/useCases/webview/StopTestcases';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class CommandModule implements IExtensionModule {
  public constructor(
    @inject(TOKENS.activePathService) private readonly activePath: IActivePathService,
    @inject(TOKENS.cphMigrationService) private readonly cph: ICphMigrationService,
    @inject(TOKENS.extensionPath) private readonly extPath: string,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.problemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.problemService) private readonly problemService: IProblemService,
    @inject(TOKENS.system) private readonly sys: ISystem,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.version) private readonly version: string,
    @inject(TOKENS.ui) private readonly ui: IUi,

    @inject(CreateProblem) private readonly createProblem: CreateProblem,
    @inject(ImportProblem) private readonly importProblem: ImportProblem,
    @inject(RunAllTestcases) private readonly runAllTestcases: RunAllTestcases,
    @inject(StopTestcases) private readonly stopTestcases: StopTestcases,
  ) {}

  private async getProblemId() {
    const activePath = this.activePath.getActivePath();
    if (!activePath) throw new Error('Active path is required');
    const backgroundProblem = await this.repo.loadByPath(activePath);
    if (!backgroundProblem) throw new Error('No problem found');
    return backgroundProblem.problemId;
  }

  public setup(context: ExtensionContext) {
    const cmdMap: Record<string, () => Promise<void>> = {
      'cph-ng.versionInfo': () => this.showVersionInfo(),
      'cph-ng.importFromCph': () => this.handleBatchImport(),
      'cph-ng.createProblem': async () => {
        this.ui.showSidebar();
        await this.createProblem.exec({ type: 'createProblem' });
      },
      'cph-ng.importProblem': async () => {
        this.ui.showSidebar();
        await this.importProblem.exec({ type: 'importProblem' });
      },
      'cph-ng.runTestcases': async () => {
        this.ui.showSidebar();
        await this.runAllTestcases.exec({
          type: 'runTestcases',
          problemId: await this.getProblemId(),
          forceCompile: null,
        });
      },
      'cph-ng.stopTestcases': async () => {
        this.ui.showSidebar();
        await this.stopTestcases.exec({
          type: 'stopTestcases',
          problemId: await this.getProblemId(),
        });
      },
    };

    for (const [command, func] of Object.entries(cmdMap)) {
      context.subscriptions.push(commands.registerCommand(command, func));
    }
  }

  private async showVersionInfo() {
    const generatedPath = this.path.resolve(this.extPath, 'dist', 'generated.json');
    const generated = JSON.parse(await this.fs.readFile(generatedPath, 'utf8'));
    const msg = [
      `Version: ${this.version}`,
      `Commit: ${generated.commitHash}`,
      `Date: ${generated.buildTime}`,
      `Build By: ${generated.buildBy}`,
      `Build Type: ${generated.buildType}`,
      `OS: ${this.sys.release()}`,
    ].join('\n');
    const copyMsg = this.translator.t('Copy');
    const res = await this.ui.alert('info', 'CPH-NG', { modal: true, detail: msg }, copyMsg);
    if (res === copyMsg) await env.clipboard.writeText(msg);
  }

  private async handleBatchImport() {
    const uri = await this.ui.chooseFolder(this.translator.t('Please select the .cph folder'));
    if (!uri) return;
    const problems = await this.cph.migrateFolder(uri);
    if (problems.length === 0) {
      this.ui.alert('info', this.translator.t('No CPH problem files found.'));
      return;
    }
    const chosen = await this.ui.quickPickMany(
      problems.map((p, idx) => ({ label: p.name, detail: p.url, value: idx })),
      { title: this.translator.t('Select problems') },
    );
    await Promise.all(chosen.map((item) => this.problemService.save(problems[item])));
  }
}
