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

import type * as msgs from '@w/msgs';
import { container, injectable } from 'tsyringe';
import type { IProblemsManager } from '@/application/ports/problems/IProblemsManager';
import { AddTc } from '@/application/useCases/webview/AddTc';
import { ChooseTcFile } from '@/application/useCases/webview/ChooseTcFile';
import { ClearTcStatus } from '@/application/useCases/webview/ClearTcStatus';
import { CompareTc } from '@/application/useCases/webview/CompareTc';
import { CreateProblem } from '@/application/useCases/webview/CreateProblem';
import { DelTc } from '@/application/useCases/webview/DelTc';
import { DragDrop } from '@/application/useCases/webview/DragDrop';
import { EditProblemDetails } from '@/application/useCases/webview/EditProblemDetails';
import { LoadTcs } from '@/application/useCases/webview/LoadTcs';
import { ReorderTc } from '@/application/useCases/webview/ReorderTc';
import { RunAllTcs } from '@/application/useCases/webview/RunAllTcs';
import { RunSingleTc } from '@/application/useCases/webview/RunSingleTc';
import { StopTcs } from '@/application/useCases/webview/StopTcs';
import { ToggleDisable } from '@/application/useCases/webview/ToggleDisable';
import { ToggleTcFile } from '@/application/useCases/webview/ToggleTcFile';
import { UpdateTc } from '@/application/useCases/webview/UpdateTc';
import { BfCompare } from '../../modules/problems/manager/bfCompare';
import { ProblemActions } from '../../modules/problems/manager/problemActions';

@injectable()
export class ProblemsManager implements IProblemsManager {
  async createProblem(msg: msgs.CreateProblemMsg): Promise<void> {
    await container.resolve(CreateProblem).exec(msg);
  }
  async importProblem(msg: msgs.ImportProblemMsg): Promise<void> {
    return ProblemActions.importProblem(msg);
  }
  async editProblemDetails(msg: msgs.EditProblemDetailsMsg): Promise<void> {
    await container.resolve(EditProblemDetails).exec(msg);
  }
  async delProblem(msg: msgs.DelProblemMsg): Promise<void> {
    return ProblemActions.delProblem(msg);
  }
  async chooseSrcFile(msg: msgs.ChooseSrcFileMsg): Promise<void> {
    return ProblemActions.chooseSrcFile(msg);
  }
  async removeSrcFile(msg: msgs.RemoveSrcFileMsg): Promise<void> {
    return ProblemActions.removeSrcFile(msg);
  }
  async submitToCodeforces(msg: msgs.SubmitToCodeforcesMsg): Promise<void> {
    return ProblemActions.submitToCodeforces(msg);
  }
  async openFile(msg: msgs.OpenFileMsg): Promise<void> {
    return ProblemActions.openFile(msg);
  }
  async openTestlib(msg: msgs.OpenTestlibMsg): Promise<void> {
    return ProblemActions.openTestlib(msg);
  }

  async addTc(msg: msgs.AddTcMsg): Promise<void> {
    await container.resolve(AddTc).exec(msg);
  }
  async loadTcs(msg: msgs.LoadTcsMsg): Promise<void> {
    await container.resolve(LoadTcs).exec(msg);
  }
  async updateTc(msg: msgs.UpdateTcMsg): Promise<void> {
    await container.resolve(UpdateTc).exec(msg);
  }
  async toggleDisable(msg: msgs.ToggleDisableMsg): Promise<void> {
    await container.resolve(ToggleDisable).exec(msg);
  }
  async clearTcStatus(msg: msgs.ClearTcStatusMsg): Promise<void> {
    await container.resolve(ClearTcStatus).exec(msg);
  }
  async chooseTcFile(msg: msgs.ChooseTcFileMsg): Promise<void> {
    await container.resolve(ChooseTcFile).exec(msg);
  }
  async compareTc(msg: msgs.CompareTcMsg): Promise<void> {
    await container.resolve(CompareTc).exec(msg);
  }
  async toggleTcFile(msg: msgs.ToggleTcFileMsg): Promise<void> {
    await container.resolve(ToggleTcFile).exec(msg);
  }
  async delTc(msg: msgs.DelTcMsg): Promise<void> {
    await container.resolve(DelTc).exec(msg);
  }
  async reorderTc(msg: msgs.ReorderTcMsg): Promise<void> {
    await container.resolve(ReorderTc).exec(msg);
  }
  async dragDrop(msg: msgs.DragDropMsg): Promise<void> {
    await container.resolve(DragDrop).exec(msg);
  }

  async runTc(msg: msgs.RunTcMsg): Promise<void> {
    await container.resolve(RunSingleTc).exec(msg);
  }
  async runTcs(msg: msgs.RunTcsMsg): Promise<void> {
    await container.resolve(RunAllTcs).exec(msg);
  }
  async stopTcs(msg: msgs.StopTcsMsg): Promise<void> {
    await container.resolve(StopTcs).exec(msg);
  }

  async startBfCompare(msg: msgs.StartBfCompareMsg): Promise<void> {
    return BfCompare.startBfCompare(msg);
  }
  async stopBfCompare(msg: msgs.StopBfCompareMsg): Promise<void> {
    return BfCompare.stopBfCompare(msg);
  }
}
