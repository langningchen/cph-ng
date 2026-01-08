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

export interface IProblemsManager {
  // Problem Actions
  createProblem(msg: msgs.CreateProblemMsg): Promise<void>;
  importProblem(msg: msgs.ImportProblemMsg): Promise<void>;
  editProblemDetails(msg: msgs.EditProblemDetailsMsg): Promise<void>;
  delProblem(msg: msgs.DelProblemMsg): Promise<void>;
  chooseSrcFile(msg: msgs.ChooseSrcFileMsg): Promise<void>;
  removeSrcFile(msg: msgs.RemoveSrcFileMsg): Promise<void>;
  submitToCodeforces(msg: msgs.SubmitToCodeforcesMsg): Promise<void>;
  openFile(msg: msgs.OpenFileMsg): Promise<void>;
  openTestlib(msg: msgs.OpenTestlibMsg): Promise<void>;

  // Test Case Actions
  addTc(msg: msgs.AddTcMsg): Promise<void>;
  loadTcs(msg: msgs.LoadTcsMsg): Promise<void>;
  updateTc(msg: msgs.UpdateTcMsg): Promise<void>;
  toggleDisable(msg: msgs.ToggleDisableMsg): Promise<void>;
  clearTcStatus(msg: msgs.ClearTcStatusMsg): Promise<void>;
  clearStatus(msg: msgs.ClearStatusMsg): Promise<void>;
  chooseTcFile(msg: msgs.ChooseTcFileMsg): Promise<void>;
  compareTc(msg: msgs.CompareTcMsg): Promise<void>;
  toggleTcFile(msg: msgs.ToggleTcFileMsg): Promise<void>;
  delTc(msg: msgs.DelTcMsg): Promise<void>;
  reorderTc(msg: msgs.ReorderTcMsg): Promise<void>;
  dragDrop(msg: msgs.DragDropMsg): Promise<void>;

  // Runner Operations
  runTc(msg: msgs.RunTcMsg): Promise<void>;
  runTcs(msg: msgs.RunTcsMsg): Promise<void>;
  stopTcs(msg: msgs.StopTcsMsg): Promise<void>;

  // Brute Force Compare
  startBfCompare(msg: msgs.StartBfCompareMsg): Promise<void>;
  stopBfCompare(msg: msgs.StopBfCompareMsg): Promise<void>;
}
