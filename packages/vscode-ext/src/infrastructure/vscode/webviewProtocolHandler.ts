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

import type { ILogger } from '@v/application/ports/vscode/ILogger';
import type { ITranslator } from '@v/application/ports/vscode/ITranslator';
import type { IUi } from '@v/application/ports/vscode/IUi';
import { AddTestcase } from '@v/application/useCases/webview/AddTestcase';
import { ChooseSrcFile } from '@v/application/useCases/webview/ChooseSrcFile';
import { ChooseTestcaseFile } from '@v/application/useCases/webview/ChooseTestcaseFile';
import { ClearTestcaseStatus } from '@v/application/useCases/webview/ClearTestcaseStatus';
import { CompareTestcase } from '@v/application/useCases/webview/CompareTestcase';
import { CreateProblem } from '@v/application/useCases/webview/CreateProblem';
import { DeleteProblem } from '@v/application/useCases/webview/DeleteProblem';
import { DeleteTestcase } from '@v/application/useCases/webview/DeleteTestcase';
import { DragDrop } from '@v/application/useCases/webview/DragDrop';
import { EditProblemDetails } from '@v/application/useCases/webview/EditProblemDetails';
import { ImportProblem } from '@v/application/useCases/webview/ImportProblem';
import { Init } from '@v/application/useCases/webview/Init';
import { LoadTestcases } from '@v/application/useCases/webview/LoadTestcases';
import type { IMsgHandle } from '@v/application/useCases/webview/msgHandle';
import { OpenFile } from '@v/application/useCases/webview/OpenFile';
import { OpenSettings } from '@v/application/useCases/webview/OpenSettings';
import { OpenTestlib } from '@v/application/useCases/webview/OpenTestlib';
import { RemoveSrcFile } from '@v/application/useCases/webview/RemoveSrcFile';
import { ReorderTestcase } from '@v/application/useCases/webview/ReorderTestcase';
import { RunAllTestcases } from '@v/application/useCases/webview/RunAllTestcases';
import { RunSingleTestcase } from '@v/application/useCases/webview/RunSingleTestcase';
import { SetTestcaseString } from '@v/application/useCases/webview/SetTestcaseString';
import { StartChat } from '@v/application/useCases/webview/StartChat';
import { StartStressTest } from '@v/application/useCases/webview/StartStressTest';
import { StopStressTest } from '@v/application/useCases/webview/StopStressTest';
import { StopTestcases } from '@v/application/useCases/webview/StopTestcases';
import { SubmitToCodeforces } from '@v/application/useCases/webview/SubmitToCodeforces';
import { ToggleTestcaseFile } from '@v/application/useCases/webview/ToggleTestcaseFile';
import { UpdateTestcase } from '@v/application/useCases/webview/UpdateTestcase';
import { TOKENS } from '@v/composition/tokens';
import type { WebviewMsg } from '@w/msgs';
import { container, type InjectionToken, inject, injectable } from 'tsyringe';

const UseCaseRegistry: Record<WebviewMsg['type'], InjectionToken<IMsgHandle<WebviewMsg>>> = {
  addTestcase: AddTestcase,
  chooseSrcFile: ChooseSrcFile,
  chooseTestcaseFile: ChooseTestcaseFile,
  clearTestcaseStatus: ClearTestcaseStatus,
  compareTestcase: CompareTestcase,
  createProblem: CreateProblem,
  deleteProblem: DeleteProblem,
  deleteTestcase: DeleteTestcase,
  dragDrop: DragDrop,
  editProblemDetails: EditProblemDetails,
  importProblem: ImportProblem,
  init: Init,
  loadTestcases: LoadTestcases,
  openFile: OpenFile,
  openSettings: OpenSettings,
  openTestlib: OpenTestlib,
  removeSrcFile: RemoveSrcFile,
  reorderTestcase: ReorderTestcase,
  runSingleTestcase: RunSingleTestcase,
  runAllTestcases: RunAllTestcases,
  setTestcaseString: SetTestcaseString,
  startStressTest: StartStressTest,
  startChat: StartChat,
  stopStressTest: StopStressTest,
  stopTestcases: StopTestcases,
  submitToCodeforces: SubmitToCodeforces,
  toggleTestcaseFile: ToggleTestcaseFile,
  updateTestcase: UpdateTestcase,
};

@injectable()
export class WebviewProtocolHandler {
  public constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
  ) {
    this.logger = this.logger.withScope('webviewProtocolHandler');
  }

  public async handle(msg: WebviewMsg): Promise<void> {
    this.logger.info('Received webview message', msg.type);
    this.logger.trace('Received webview message', { msg });
    try {
      const useCaseToken = UseCaseRegistry[msg.type];
      const useCase = container.resolve<IMsgHandle<WebviewMsg>>(useCaseToken);
      await useCase.exec(msg);
    } catch (e) {
      this.logger.error(`Handle message ${msg.type} failed`, e);
      this.ui.alert(
        'error',
        this.translator.t('Handle message failed: {msg}', { msg: (e as Error).message }),
      );
    }
  }
}
