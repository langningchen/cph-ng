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

import type { UUID } from 'node:crypto';
import type { IOverrides } from '@/domain/types';
import type { DistributiveOmit } from '@/webview/src/utils';

export interface BaseMsg {
  type: string;
  problemId?: UUID;
}
export interface ProblemBaseMsg extends BaseMsg {
  problemId: UUID;
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
export interface DelProblemMsg extends ProblemBaseMsg {
  type: 'delProblem';
}
export interface RunTcsMsg extends ProblemBaseMsg {
  type: 'runTcs';
  forceCompile: boolean | null;
}
export interface StopTcsMsg extends ProblemBaseMsg {
  type: 'stopTcs';
  onlyOne: boolean;
}
export interface AddTcMsg extends ProblemBaseMsg {
  type: 'addTc';
}
export interface LoadTcsMsg extends ProblemBaseMsg {
  type: 'loadTcs';
}
export interface RunTcMsg extends ProblemBaseMsg {
  type: 'runTc';
  id: UUID;
  forceCompile: boolean | null;
}
export interface ClearTcStatusMsg extends ProblemBaseMsg {
  type: 'clearTcStatus';
  id?: UUID;
}
export type WebviewTcFileTypes = 'stdin' | 'answer';
export interface ChooseTcFileMsg extends ProblemBaseMsg {
  type: 'chooseTcFile';
  id: UUID;
  label: WebviewTcFileTypes;
}
export interface SetTcStringMsg extends ProblemBaseMsg {
  type: 'setTcString';
  id: UUID;
  label: WebviewTcFileTypes;
  data: string;
}
export interface UpdateTcMsg extends ProblemBaseMsg {
  type: 'updateTc';
  id: UUID;
  event: 'toggleDisable' | 'toggleExpand' | 'setAsAnswer';
}
export interface CompareTcMsg extends ProblemBaseMsg {
  type: 'compareTc';
  id: UUID;
}
export interface ToggleTcFileMsg extends ProblemBaseMsg {
  type: 'toggleTcFile';
  id: UUID;
  label: WebviewTcFileTypes;
}
export interface DelTcMsg extends ProblemBaseMsg {
  type: 'delTc';
  id: UUID;
}
export interface ReorderTcMsg extends ProblemBaseMsg {
  type: 'reorderTc';
  fromIdx: number;
  toIdx: number;
}
export interface OpenFileMsg extends BaseMsg {
  type: 'openFile';
  path: string;
  isVirtual?: boolean;
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
export interface StartBfCompareMsg extends ProblemBaseMsg {
  type: 'startBfCompare';
  forceCompile: boolean | null;
}
export interface StopBfCompareMsg extends ProblemBaseMsg {
  type: 'stopBfCompare';
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
  | DelProblemMsg
  | RunTcsMsg
  | StopTcsMsg
  | AddTcMsg
  | LoadTcsMsg
  | RunTcMsg
  | ClearTcStatusMsg
  | ChooseTcFileMsg
  | SetTcStringMsg
  | UpdateTcMsg
  | CompareTcMsg
  | ToggleTcFileMsg
  | DelTcMsg
  | ReorderTcMsg
  | ChooseSrcFileMsg
  | RemoveSrcFileMsg
  | StartBfCompareMsg
  | StopBfCompareMsg
  | SubmitToCodeforcesMsg
  | DragDropMsg;

export type ProblemMsgCore = DistributiveOmit<ProblemMsg, 'problemId'>;

export type WebviewMsg =
  | ProblemMsg
  | CreateProblemMsg
  | ImportProblemMsg
  | InitMsg
  | OpenFileMsg
  | OpenTestlibMsg
  | StartChatMsg
  | OpenSettingsMsg;
