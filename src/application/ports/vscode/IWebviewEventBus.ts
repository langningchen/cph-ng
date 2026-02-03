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

import type { ProblemId, TestcaseId, WithRevision } from '@/domain/types';
import type {
  IWebviewBackgroundProblem,
  IWebviewFileWithHash,
  IWebviewProblem,
  IWebviewStressTest,
  IWebviewTestcase,
  IWebviewTestcaseResult,
} from '@/domain/webviewTypes';

const WebviewEventName = {
  FULL_PROBLEM: 'FULL_PROBLEM',
  PATCH_META: 'PATCH_META',
  PATCH_STRESS_TEST: 'PATCH_STRESS_TEST',
  ADD_TESTCASE: 'ADD_TESTCASE',
  DELETE_TESTCASE: 'DELETE_TESTCASE',
  PATCH_TESTCASE: 'PATCH_TESTCASE',
  PATCH_TESTCASE_RESULT: 'PATCH_TESTCASE_RESULT',
  BACKGROUND: 'BACKGROUND',
  NO_PROBLEM: 'NO_PROBLEM',
} as const;
interface WebviewFullProblemEvent {
  type: typeof WebviewEventName.FULL_PROBLEM;
  problemId: ProblemId;
  payload: IWebviewProblem;
}
export type WebviewPatchMetaPayload = WithRevision<{
  checker?: IWebviewFileWithHash | null;
  interactor?: IWebviewFileWithHash | null;
}>;
interface WebviewPatchMetaEvent {
  type: typeof WebviewEventName.PATCH_META;
  problemId: ProblemId;
  payload: WebviewPatchMetaPayload;
}
export type WebviewPatchStressTestPayload = WithRevision<Partial<IWebviewStressTest>>;
interface WebviewPatchStressTestEvent {
  type: typeof WebviewEventName.PATCH_STRESS_TEST;
  problemId: ProblemId;
  payload: WebviewPatchStressTestPayload;
}
export type WebviewAddTestcasePayload = WithRevision<IWebviewTestcase>;
interface WebviewAddTestcaseEvent {
  type: typeof WebviewEventName.ADD_TESTCASE;
  problemId: ProblemId;
  testcaseId: TestcaseId;
  payload: WebviewAddTestcasePayload;
}
export type WebviewDeleteTestcasePayload = WithRevision<NonNullable<unknown>>;
interface WebviewDeleteTestcaseEvent {
  type: typeof WebviewEventName.DELETE_TESTCASE;
  problemId: ProblemId;
  testcaseId: TestcaseId;
  payload: WebviewDeleteTestcasePayload;
}
export type WebviewPatchTestcasePayload = WithRevision<Partial<IWebviewTestcase>>;
interface WebviewPatchTestcaseEvent {
  type: typeof WebviewEventName.PATCH_TESTCASE;
  problemId: ProblemId;
  testcaseId: TestcaseId;
  payload: WebviewPatchTestcasePayload;
}
export type WebviewPatchTestcaseResultPayload = WithRevision<Partial<IWebviewTestcaseResult>>;
interface WebviewPatchTestcaseResultEvent {
  type: typeof WebviewEventName.PATCH_TESTCASE_RESULT;
  problemId: ProblemId;
  testcaseId: TestcaseId;
  payload: WebviewPatchTestcaseResultPayload;
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
  | WebviewPatchStressTestEvent
  | WebviewAddTestcaseEvent
  | WebviewDeleteTestcaseEvent
  | WebviewPatchTestcaseEvent
  | WebviewPatchTestcaseResultEvent
  | WebviewBackgroundEvent
  | WebviewNoProblemEvent;

export interface IWebviewEventBus {
  onMessage(callback: (data: WebviewEvent) => void): void;
  fullProblem(problemId: ProblemId, payload: IWebviewProblem): void;
  patchMeta(problemId: ProblemId, payload: WebviewPatchMetaPayload): void;
  patchStressTest(problemId: ProblemId, payload: WebviewPatchStressTestPayload): void;
  addTestcase(
    problemId: ProblemId,
    testcaseId: TestcaseId,
    payload: WebviewAddTestcasePayload,
  ): void;
  deleteTestcase(
    problemId: ProblemId,
    testcaseId: TestcaseId,
    payload: WebviewDeleteTestcasePayload,
  ): void;
  patchTestcase(
    problemId: ProblemId,
    testcaseId: TestcaseId,
    payload: WebviewPatchTestcasePayload,
  ): void;
  patchTestcaseResult(
    problemId: ProblemId,
    testcaseId: TestcaseId,
    payload: WebviewPatchTestcaseResultPayload,
  ): void;
  background(payload: IWebviewBackgroundProblem[]): void;
  noProblem(canImport: boolean): void;
}
