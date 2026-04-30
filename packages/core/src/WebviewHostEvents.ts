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

import type { WithRevision } from './interfaces';
import type {
  ILanguageDefaultValues,
  ProblemId,
  TestcaseId,
  ToolchainInfo,
  ToolchainItem,
} from './types';
import type {
  IWebviewBackgroundProblem,
  IWebviewFileWithHash,
  IWebviewProblem,
  IWebviewStressTest,
  IWebviewTestcase,
  IWebviewTestcaseResult,
} from './webview';
import type { LanguageExecutable } from './webviewMessages';

export interface WebviewConfig {
  confirmSubmit: boolean;
  showAcGif: boolean;
  showOobe: boolean;
  hiddenStatuses: string[];
}

export type WebviewHostPayloads = {
  fullProblem: { problemId: ProblemId; payload: IWebviewProblem };
  patchMeta: { problemId: ProblemId; payload: WebviewPatchMetaPayload };
  patchStressTest: { problemId: ProblemId; payload: WebviewPatchStressTestPayload };
  addTestcase: {
    problemId: ProblemId;
    testcaseId: TestcaseId;
    payload: WebviewAddTestcasePayload;
  };
  deleteTestcase: {
    problemId: ProblemId;
    testcaseId: TestcaseId;
    payload: WebviewDeleteTestcasePayload;
  };
  patchTestcase: {
    problemId: ProblemId;
    testcaseId: TestcaseId;
    payload: WebviewPatchTestcasePayload;
  };
  patchTestcaseResult: {
    problemId: ProblemId;
    testcaseId: TestcaseId;
    payload: WebviewPatchTestcaseResultPayload;
  };
  background: { payload: IWebviewBackgroundProblem[] };
  noProblem: { canImport: boolean };

  languageList: { payload: WebviewLanguageListPayload };
  languageInfo: WebviewLanguageInfoPayload;
  checkedLanguageInfo: WebviewCheckedLanguageInfoPayload;
  configChange: { payload: Partial<WebviewConfig> };
};

export type WebviewPatchMetaPayload = WithRevision<{
  checker?: IWebviewFileWithHash | null;
  interactor?: IWebviewFileWithHash | null;
}>;
export type WebviewPatchStressTestPayload = WithRevision<Partial<IWebviewStressTest>>;
export type WebviewAddTestcasePayload = WithRevision<IWebviewTestcase>;
export type WebviewDeleteTestcasePayload = WithRevision<NonNullable<unknown>>;
export type WebviewPatchTestcasePayload = WithRevision<Partial<IWebviewTestcase>>;
export type WebviewPatchTestcaseResultPayload = WithRevision<Partial<IWebviewTestcaseResult>>;
export type WebviewLanguageListPayload = Record<string, ILanguageDefaultValues>;
export type WebviewLanguageInfoPayload = {
  language: string;
  compilers?: ToolchainInfo;
  interpreters?: ToolchainInfo;
};
export type WebviewCheckedLanguageInfoPayload = {
  language: string;
  executable: LanguageExecutable;
  path: string;
  item: ToolchainItem | null;
};

export type WebviewHostEvent = {
  [K in keyof WebviewHostPayloads]: { type: K } & WebviewHostPayloads[K];
}[keyof WebviewHostPayloads];
