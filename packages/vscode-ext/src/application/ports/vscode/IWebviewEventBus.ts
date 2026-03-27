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

import type {
  IWebviewBackgroundProblem,
  IWebviewProblem,
  ProblemId,
  TestcaseId,
  WebviewAddTestcasePayload,
  WebviewConfig,
  WebviewDeleteTestcasePayload,
  WebviewEvent,
  WebviewPatchMetaPayload,
  WebviewPatchStressTestPayload,
  WebviewPatchTestcasePayload,
  WebviewPatchTestcaseResultPayload,
} from '@cph-ng/core';

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
  configChange(payload: Partial<WebviewConfig>): void;
}
