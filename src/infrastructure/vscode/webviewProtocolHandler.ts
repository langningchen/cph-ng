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
import { AddTc } from '@/application/useCases/webview/AddTc';
import { ChooseSrcFile } from '@/application/useCases/webview/ChooseSrcFile';
import { ChooseTcFile } from '@/application/useCases/webview/ChooseTcFile';
import { ClearTcStatus } from '@/application/useCases/webview/ClearTcStatus';
import { CompareTc } from '@/application/useCases/webview/CompareTc';
import { CreateProblem } from '@/application/useCases/webview/CreateProblem';
import { DelProblem } from '@/application/useCases/webview/DelProblem';
import { DelTc } from '@/application/useCases/webview/DelTc';
import { DragDrop } from '@/application/useCases/webview/DragDrop';
import { EditProblemDetails } from '@/application/useCases/webview/EditProblemDetails';
import { ImportProblem } from '@/application/useCases/webview/ImportProblem';
import { Init } from '@/application/useCases/webview/Init';
import { LoadTcs } from '@/application/useCases/webview/LoadTcs';
import type { IMsgHandle } from '@/application/useCases/webview/msgHandle';
import { OpenFile } from '@/application/useCases/webview/OpenFile';
import { OpenSettings } from '@/application/useCases/webview/OpenSettings';
import { OpenTestlib } from '@/application/useCases/webview/OpenTestlib';
import { RemoveSrcFile } from '@/application/useCases/webview/RemoveSrcFile';
import { ReorderTc } from '@/application/useCases/webview/ReorderTc';
import { RunAllTcs } from '@/application/useCases/webview/RunAllTcs';
import { RunSingleTc } from '@/application/useCases/webview/RunSingleTc';
import { StartBfCompare } from '@/application/useCases/webview/StartBfCompare';
import { StartChat } from '@/application/useCases/webview/StartChat';
import { StopBfCompare } from '@/application/useCases/webview/StopBfCompare';
import { StopTcs } from '@/application/useCases/webview/StopTcs';
import { SubmitToCodeforces } from '@/application/useCases/webview/SubmitToCodeforces';
import { ToggleDisable } from '@/application/useCases/webview/ToggleDisable';
import { ToggleTcFile } from '@/application/useCases/webview/ToggleTcFile';
import { UpdateTc } from '@/application/useCases/webview/UpdateTc';
import { TOKENS } from '@/composition/tokens';
import type { WebviewMsg } from '@/webview/src/msgs';

const UseCaseRegistry: Record<WebviewMsg['type'], InjectionToken<IMsgHandle<WebviewMsg>>> = {
  addTc: AddTc,
  chooseSrcFile: ChooseSrcFile,
  chooseTcFile: ChooseTcFile,
  clearTcStatus: ClearTcStatus,
  compareTc: CompareTc,
  createProblem: CreateProblem,
  delProblem: DelProblem,
  delTc: DelTc,
  dragDrop: DragDrop,
  editProblemDetails: EditProblemDetails,
  importProblem: ImportProblem,
  init: Init,
  loadTcs: LoadTcs,
  openFile: OpenFile,
  openSettings: OpenSettings,
  openTestlib: OpenTestlib,
  removeSrcFile: RemoveSrcFile,
  reorderTc: ReorderTc,
  runTc: RunSingleTc,
  runTcs: RunAllTcs,
  startBfCompare: StartBfCompare,
  startChat: StartChat,
  stopBfCompare: StopBfCompare,
  stopTcs: StopTcs,
  submitToCodeforces: SubmitToCodeforces,
  toggleDisable: ToggleDisable,
  toggleTcFile: ToggleTcFile,
  updateTc: UpdateTc,
};

@injectable()
export class WebviewProtocolHandler {
  public constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.telemetry) private readonly telemetry: ITelemetry,
  ) {
    this.logger = this.logger.withScope('ProtocolHandler');
  }

  public async handle(msg: WebviewMsg): Promise<void> {
    this.logger.info('Received Webview Message:', msg.type);
    const stopTrace = this.telemetry.start('webviewMessage', { type: msg.type });

    try {
      const useCaseToken = UseCaseRegistry[msg.type];
      const useCase = container.resolve<IMsgHandle<WebviewMsg>>(useCaseToken);
      await useCase.exec(msg);
    } catch (e) {
      this.logger.error(`Handler error [${msg.type}]:`, e);
    } finally {
      stopTrace();
    }
  }
}
