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
  checker?: IWebviewFileWithHash;
  interactor?: IWebviewFileWithHash;
}
export const WebviewEventName = {
  FULL_PROBLEM: 'FULL_PROBLEM',
  PATCH_META: 'PATCH_META',
  PATCH_BF_COMPARE: 'PATCH_BF_COMPARE',
  PATCH_TC: 'PATCH_TC',
  PATCH_TC_RESULT: 'PATCH_TC_RESULT',
  DELETE_TC: 'DELETE_TC',
  BACKGROUND: 'BACKGROUND',
  NO_PROBLEM: 'NO_PROBLEM',
} as const;
export type WebviewEventName = (typeof WebviewEventName)[keyof typeof WebviewEventName];
interface WebviewFullProblemEvent {
  name: typeof WebviewEventName.FULL_PROBLEM;
  problemId: UUID;
  payload: IWebviewProblem;
}
interface WebviewPatchMetaEvent {
  name: typeof WebviewEventName.PATCH_META;
  problemId: UUID;
  payload: WebviewProblemMetaPayload;
}
interface WebviewPatchBfCompareEvent {
  name: typeof WebviewEventName.PATCH_BF_COMPARE;
  problemId: UUID;
  payload: Partial<IWebviewBfCompare>;
}
interface WebviewPatchTcEvent {
  name: typeof WebviewEventName.PATCH_TC;
  problemId: UUID;
  tcId: UUID;
  payload: Partial<IWebviewTc>;
}
interface WebviewPatchTcResultEvent {
  name: typeof WebviewEventName.PATCH_TC_RESULT;
  problemId: UUID;
  tcId: UUID;
  payload: Partial<IWebviewTcResult>;
}
interface WebviewDeleteTcEvent {
  name: typeof WebviewEventName.DELETE_TC;
  problemId: UUID;
  tcId: UUID;
}
interface WebviewBackgroundEvent {
  name: typeof WebviewEventName.BACKGROUND;
  payload: IWebviewBackgroundProblem[];
}
interface WebviewNoProblemEvent {
  name: typeof WebviewEventName.NO_PROBLEM;
  canImport: boolean;
}
export type WebviewEvent =
  | WebviewFullProblemEvent
  | WebviewPatchMetaEvent
  | WebviewPatchBfCompareEvent
  | WebviewPatchTcEvent
  | WebviewPatchTcResultEvent
  | WebviewDeleteTcEvent
  | WebviewBackgroundEvent
  | WebviewNoProblemEvent;

export interface IWebviewEventBus {
  onMessage(callback: (data: WebviewEvent) => void): void;
  fullProblem(problemId: UUID, payload: IWebviewProblem): void;
  patchMeta(problemId: UUID, payload: WebviewProblemMetaPayload): void;
  patchBfCompare(problemId: UUID, payload: Partial<IWebviewBfCompare>): void;
  patchTc(problemId: UUID, tcId: UUID, payload: Partial<IWebviewTc>): void;
  patchTcResult(problemId: UUID, tcId: UUID, payload: Partial<IWebviewTcResult>): void;
  deleteTc(problemId: UUID, tcId: UUID): void;
  background(payload: IWebviewBackgroundProblem[]): void;
  noProblem(canImport: boolean): void;
}
