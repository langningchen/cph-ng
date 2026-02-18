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

import type { IOverrides, ProblemId, TestcaseId } from '@/domain/types';

interface BaseMsg {
  type: string;
  problemId?: ProblemId;
}
interface ProblemBaseMsg extends BaseMsg {
  problemId: ProblemId;
}

export interface CreateProblemMsg extends BaseMsg {
  type: 'createProblem';
}
export interface ImportProblemMsg extends BaseMsg {
  type: 'importProblem';
}
export interface InitMsg extends BaseMsg {
  type: 'init';
}
export interface EditProblemDetailsMsg extends ProblemBaseMsg {
  type: 'editProblemDetails';
  name: string;
  url?: string;
  overrides: IOverrides;
}
export interface DeleteProblemMsg extends ProblemBaseMsg {
  type: 'deleteProblem';
}
export interface RunTestcasesMsg extends ProblemBaseMsg {
  type: 'runTestcases';
  forceCompile: boolean | null;
}
export interface StopTestcasesMsg extends ProblemBaseMsg {
  type: 'stopTestcases';
  testcaseId?: TestcaseId;
}
export interface AddTestcaseMsg extends ProblemBaseMsg {
  type: 'addTestcase';
}
export interface LoadTestcasesMsg extends ProblemBaseMsg {
  type: 'loadTestcases';
}
export interface RunTestcaseMsg extends ProblemBaseMsg {
  type: 'runTestcase';
  testcaseId: TestcaseId;
  forceCompile: boolean | null;
}
export interface ClearTestcaseStatusMsg extends ProblemBaseMsg {
  type: 'clearTestcaseStatus';
  testcaseId?: TestcaseId;
}
export type WebviewTestcaseFileTypes = 'stdin' | 'answer';
export interface ChooseTestcaseFileMsg extends ProblemBaseMsg {
  type: 'chooseTestcaseFile';
  testcaseId: TestcaseId;
  label: WebviewTestcaseFileTypes;
}
export interface SetTestcaseStringMsg extends ProblemBaseMsg {
  type: 'setTestcaseString';
  testcaseId: TestcaseId;
  label: WebviewTestcaseFileTypes;
  data: string;
}
export interface UpdateTestcaseMsg extends ProblemBaseMsg {
  type: 'updateTestcase';
  testcaseId: TestcaseId;
  event: 'setDisable' | 'setExpand' | 'setAsAnswer';
  value: boolean; // ignored when set as answer
}
export interface CompareTestcaseMsg extends ProblemBaseMsg {
  type: 'compareTestcase';
  testcaseId: TestcaseId;
}
export interface ToggleTestcaseFileMsg extends ProblemBaseMsg {
  type: 'toggleTestcaseFile';
  testcaseId: TestcaseId;
  label: WebviewTestcaseFileTypes;
}
export interface DeleteTestcaseMsg extends ProblemBaseMsg {
  type: 'deleteTestcase';
  testcaseId: TestcaseId;
}
export interface ReorderTestcaseMsg extends ProblemBaseMsg {
  type: 'reorderTestcase';
  fromIdx: number;
  toIdx: number;
}
export interface OpenFileMsg extends BaseMsg {
  type: 'openFile';
  path: string;
}
export interface OpenTestlibMsg extends BaseMsg {
  type: 'openTestlib';
}
export type WebviewSrcFileTypes = 'checker' | 'interactor' | 'generator' | 'bruteForce';
export interface ChooseSrcFileMsg extends ProblemBaseMsg {
  type: 'chooseSrcFile';
  fileType: WebviewSrcFileTypes;
}
export interface RemoveSrcFileMsg extends ProblemBaseMsg {
  type: 'removeSrcFile';
  fileType: WebviewSrcFileTypes;
}
export interface StartStressTestMsg extends ProblemBaseMsg {
  type: 'startStressTest';
  forceCompile: boolean | null;
}
export interface StopStressTestMsg extends ProblemBaseMsg {
  type: 'stopStressTest';
}
export interface SubmitToCodeforcesMsg extends ProblemBaseMsg {
  type: 'submitToCodeforces';
}
export interface DragDropMsg extends BaseMsg {
  type: 'dragDrop';
  items: string[];
}

export interface StartChatMsg extends BaseMsg {
  type: 'startChat';
}
export interface OpenSettingsMsg extends BaseMsg {
  type: 'openSettings';
  item: string;
}

export type ProblemMsg =
  | EditProblemDetailsMsg
  | DeleteProblemMsg
  | RunTestcasesMsg
  | StopTestcasesMsg
  | AddTestcaseMsg
  | LoadTestcasesMsg
  | RunTestcaseMsg
  | ClearTestcaseStatusMsg
  | ChooseTestcaseFileMsg
  | SetTestcaseStringMsg
  | UpdateTestcaseMsg
  | CompareTestcaseMsg
  | ToggleTestcaseFileMsg
  | DeleteTestcaseMsg
  | ReorderTestcaseMsg
  | ChooseSrcFileMsg
  | RemoveSrcFileMsg
  | StartStressTestMsg
  | StopStressTestMsg
  | SubmitToCodeforcesMsg
  | DragDropMsg;

export type WebviewMsg =
  | ProblemMsg
  | CreateProblemMsg
  | ImportProblemMsg
  | InitMsg
  | OpenFileMsg
  | OpenTestlibMsg
  | StartChatMsg
  | OpenSettingsMsg;
