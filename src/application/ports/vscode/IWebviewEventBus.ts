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
import type {
  IWebviewBackgroundProblem,
  IWebviewBfCompare,
  IWebviewFileWithHash,
  IWebviewProblem,
  IWebviewTc,
  IWebviewTcResult,
} from '@/domain/webviewTypes';

export interface WebviewProblemMetaPayload {
  checker?: IWebviewFileWithHash | null;
  interactor?: IWebviewFileWithHash | null;
}
const WebviewEventName = {
  FULL_PROBLEM: 'FULL_PROBLEM',
  PATCH_META: 'PATCH_META',
  PATCH_BF_COMPARE: 'PATCH_BF_COMPARE',
  ADD_TC: 'ADD_TC',
  DELETE_TC: 'DELETE_TC',
  PATCH_TC: 'PATCH_TC',
  PATCH_TC_RESULT: 'PATCH_TC_RESULT',
  BACKGROUND: 'BACKGROUND',
  NO_PROBLEM: 'NO_PROBLEM',
} as const;
interface WebviewFullProblemEvent {
  type: typeof WebviewEventName.FULL_PROBLEM;
  problemId: UUID;
  payload: IWebviewProblem;
}
interface WebviewPatchMetaEvent {
  type: typeof WebviewEventName.PATCH_META;
  problemId: UUID;
  payload: WebviewProblemMetaPayload;
}
interface WebviewPatchBfCompareEvent {
  type: typeof WebviewEventName.PATCH_BF_COMPARE;
  problemId: UUID;
  payload: Partial<IWebviewBfCompare>;
}
interface WebviewAddTcEvent {
  type: typeof WebviewEventName.ADD_TC;
  problemId: UUID;
  tcId: UUID;
  payload: IWebviewTc;
}
interface WebviewDeleteTcEvent {
  type: typeof WebviewEventName.DELETE_TC;
  problemId: UUID;
  tcId: UUID;
}
interface WebviewPatchTcEvent {
  type: typeof WebviewEventName.PATCH_TC;
  problemId: UUID;
  tcId: UUID;
  payload: Partial<IWebviewTc>;
}
interface WebviewPatchTcResultEvent {
  type: typeof WebviewEventName.PATCH_TC_RESULT;
  problemId: UUID;
  tcId: UUID;
  payload: Partial<IWebviewTcResult>;
}
interface WebviewBackgroundEvent {
  type: typeof WebviewEventName.BACKGROUND;
  payload: IWebviewBackgroundProblem[];
}
interface WebviewNoProblemEvent {
  type: typeof WebviewEventName.NO_PROBLEM;
  canImport: boolean;
}
export type WebviewEvent =
  | WebviewFullProblemEvent
  | WebviewPatchMetaEvent
  | WebviewPatchBfCompareEvent
  | WebviewAddTcEvent
  | WebviewDeleteTcEvent
  | WebviewPatchTcEvent
  | WebviewPatchTcResultEvent
  | WebviewBackgroundEvent
  | WebviewNoProblemEvent;

export interface IWebviewEventBus {
  onMessage(callback: (data: WebviewEvent) => void): void;
  fullProblem(problemId: UUID, payload: IWebviewProblem): void;
  patchMeta(problemId: UUID, payload: WebviewProblemMetaPayload): void;
  patchBfCompare(problemId: UUID, payload: Partial<IWebviewBfCompare>): void;
  addTc(problemId: UUID, tcId: UUID, payload: IWebviewTc): void;
  deleteTc(problemId: UUID, tcId: UUID): void;
  patchTc(problemId: UUID, tcId: UUID, payload: Partial<IWebviewTc>): void;
  patchTcResult(problemId: UUID, tcId: UUID, payload: Partial<IWebviewTcResult>): void;
  background(payload: IWebviewBackgroundProblem[]): void;
  noProblem(canImport: boolean): void;
}
