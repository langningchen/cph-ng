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

import type { WebviewMsg } from '@cph-ng/core';
import { container, type InjectionToken, inject, injectable } from 'tsyringe';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { DragDrop } from '@/application/useCases/webview/DragDrop';
import { Init } from '@/application/useCases/webview/Init';
import type { IMsgHandle } from '@/application/useCases/webview/msgHandle';
import { OpenFile } from '@/application/useCases/webview/OpenFile';
import { OpenTestlib } from '@/application/useCases/webview/OpenTestlib';
import { CheckLanguageInfo } from '@/application/useCases/webview/oobe/CheckLanguageInfo';
import { GetLanguageInfo } from '@/application/useCases/webview/oobe/GetLanguageInfo';
import { GetLanguageList } from '@/application/useCases/webview/oobe/GetLanguageList';
import { OobeDone } from '@/application/useCases/webview/oobe/OobeDone';
import { UpdateSettings } from '@/application/useCases/webview/oobe/UpdateSettings';
import { ChooseSrcFile } from '@/application/useCases/webview/problem/ChooseSrcFile';
import { EditProblemDetails } from '@/application/useCases/webview/problem/EditProblemDetails';
import { CreateProblem } from '@/application/useCases/webview/problem/manage/CreateProblem';
import { DeleteProblem } from '@/application/useCases/webview/problem/manage/DeleteProblem';
import { ImportProblem } from '@/application/useCases/webview/problem/manage/ImportProblem';
import { RemoveSrcFile } from '@/application/useCases/webview/problem/RemoveSrcFile';
import { Submit } from '@/application/useCases/webview/problem/Submit';
import { StartStressTest } from '@/application/useCases/webview/problem/stressTest/StartStressTest';
import { StopStressTest } from '@/application/useCases/webview/problem/stressTest/StopStressTest';
import { ChooseTestcaseFile } from '@/application/useCases/webview/problem/testcase/ChooseTestcaseFile';
import { ClearTestcaseStatus } from '@/application/useCases/webview/problem/testcase/ClearTestcaseStatus';
import { CompareTestcase } from '@/application/useCases/webview/problem/testcase/CompareTestcase';
import { AddTestcase } from '@/application/useCases/webview/problem/testcase/manage/AddTestcase';
import { DeleteTestcase } from '@/application/useCases/webview/problem/testcase/manage/DeleteTestcase';
import { LoadTestcases } from '@/application/useCases/webview/problem/testcase/manage/LoadTestcases';
import { ReorderTestcase } from '@/application/useCases/webview/problem/testcase/manage/ReorderTestcase';
import { RunAllTestcases } from '@/application/useCases/webview/problem/testcase/run/RunAllTestcases';
import { RunSingleTestcase } from '@/application/useCases/webview/problem/testcase/run/RunSingleTestcase';
import { StopTestcases } from '@/application/useCases/webview/problem/testcase/run/StopTestcases';
import { SetTestcaseString } from '@/application/useCases/webview/problem/testcase/SetTestcaseString';
import { ToggleTestcaseFile } from '@/application/useCases/webview/problem/testcase/ToggleTestcaseFile';
import { UpdateTestcase } from '@/application/useCases/webview/problem/testcase/UpdateTestcase';
import { TOKENS } from '@/composition/tokens';

const UseCaseRegistry: Record<WebviewMsg['type'], InjectionToken<IMsgHandle<WebviewMsg>>> = {
  addTestcase: AddTestcase,
  checkLanguageInfo: CheckLanguageInfo,
  chooseSrcFile: ChooseSrcFile,
  chooseTestcaseFile: ChooseTestcaseFile,
  clearTestcaseStatus: ClearTestcaseStatus,
  compareTestcase: CompareTestcase,
  createProblem: CreateProblem,
  deleteProblem: DeleteProblem,
  deleteTestcase: DeleteTestcase,
  dragDrop: DragDrop,
  editProblemDetails: EditProblemDetails,
  getLanguageInfo: GetLanguageInfo,
  getLanguageList: GetLanguageList,
  importProblem: ImportProblem,
  init: Init,
  loadTestcases: LoadTestcases,
  oobeDone: OobeDone,
  openFile: OpenFile,
  openTestlib: OpenTestlib,
  removeSrcFile: RemoveSrcFile,
  reorderTestcase: ReorderTestcase,
  runAllTestcases: RunAllTestcases,
  runSingleTestcase: RunSingleTestcase,
  setTestcaseString: SetTestcaseString,
  startStressTest: StartStressTest,
  stopStressTest: StopStressTest,
  stopTestcases: StopTestcases,
  submit: Submit,
  toggleTestcaseFile: ToggleTestcaseFile,
  updateSettings: UpdateSettings,
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
      if (!useCaseToken) {
        throw new Error(`Unsupported webview message type: ${msg.type}`);
      }
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
