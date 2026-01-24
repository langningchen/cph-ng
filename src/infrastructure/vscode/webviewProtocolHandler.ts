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

import { container, type InjectionToken, inject, injectable } from 'tsyringe';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';
import { AddTestcase } from '@/application/useCases/webview/AddTestcase';
import { ChooseSrcFile } from '@/application/useCases/webview/ChooseSrcFile';
import { ChooseTestcaseFile } from '@/application/useCases/webview/ChooseTestcaseFile';
import { ClearTestcaseStatus } from '@/application/useCases/webview/ClearTestcaseStatus';
import { CompareTestcase } from '@/application/useCases/webview/CompareTestcase';
import { CreateProblem } from '@/application/useCases/webview/CreateProblem';
import { DeleteProblem } from '@/application/useCases/webview/DeleteProblem';
import { DeleteTestcase } from '@/application/useCases/webview/DeleteTestcase';
import { DragDrop } from '@/application/useCases/webview/DragDrop';
import { EditProblemDetails } from '@/application/useCases/webview/EditProblemDetails';
import { ImportProblem } from '@/application/useCases/webview/ImportProblem';
import { Init } from '@/application/useCases/webview/Init';
import { LoadTestcases } from '@/application/useCases/webview/LoadTestcases';
import type { IMsgHandle } from '@/application/useCases/webview/msgHandle';
import { OpenFile } from '@/application/useCases/webview/OpenFile';
import { OpenSettings } from '@/application/useCases/webview/OpenSettings';
import { OpenTestlib } from '@/application/useCases/webview/OpenTestlib';
import { RemoveSrcFile } from '@/application/useCases/webview/RemoveSrcFile';
import { ReorderTestcase } from '@/application/useCases/webview/ReorderTestcase';
import { RunAllTestcases } from '@/application/useCases/webview/RunAllTestcases';
import { RunSingleTestcase } from '@/application/useCases/webview/RunSingleTestcase';
import { SetTestcaseString } from '@/application/useCases/webview/SetTestcaseString';
import { StartChat } from '@/application/useCases/webview/StartChat';
import { StartStressTest } from '@/application/useCases/webview/StartStressTest';
import { StopStressTest } from '@/application/useCases/webview/StopStressTest';
import { StopTestcases } from '@/application/useCases/webview/StopTestcases';
import { SubmitToCodeforces } from '@/application/useCases/webview/SubmitToCodeforces';
import { ToggleTestcaseFile } from '@/application/useCases/webview/ToggleTestcaseFile';
import { UpdateTestcase } from '@/application/useCases/webview/UpdateTestcase';
import { TOKENS } from '@/composition/tokens';
import type { WebviewMsg } from '@/webview/src/msgs';

const UseCaseRegistry: Record<WebviewMsg['type'], InjectionToken<IMsgHandle<WebviewMsg>>> = {
  addTestcase: AddTestcase,
  chooseSrcFile: ChooseSrcFile,
  chooseTestcaseFile: ChooseTestcaseFile,
  clearTestcaseStatus: ClearTestcaseStatus,
  compareTestcase: CompareTestcase,
  createProblem: CreateProblem,
  delProblem: DeleteProblem,
  delTestcase: DeleteTestcase,
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
  runTestcase: RunSingleTestcase,
  runTestcases: RunAllTestcases,
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
    @inject(TOKENS.telemetry) private readonly telemetry: ITelemetry,
  ) {
    this.logger = this.logger.withScope('WebviewProtocolHandler');
  }

  public async handle(msg: WebviewMsg): Promise<void> {
    this.logger.info('Received webview message', msg.type);
    this.logger.trace('Received webview message', { msg });
    const stopTrace = this.telemetry.start('webviewMessage', { type: msg.type });

    try {
      const useCaseToken = UseCaseRegistry[msg.type];
      const useCase = container.resolve<IMsgHandle<WebviewMsg>>(useCaseToken);
      await useCase.exec(msg);
    } catch (e) {
      this.logger.error(`Handle message ${msg.type} failed`, e);
    } finally {
      stopTrace();
    }
  }
}
