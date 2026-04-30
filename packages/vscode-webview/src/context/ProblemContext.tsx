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
  IWebviewTestcaseResult,
  ProblemId,
  WebviewHostEvent,
  WebviewMsg,
} from '@cph-ng/core';
import { produce } from 'immer';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';

interface CurrentProblemStateIdle {
  type: 'idle';
  canImport: boolean;
}
interface CurrentProblemStateActive {
  type: 'active';
  problemId: ProblemId;
  problem: IWebviewProblem;
  startTime: number;
}
type CurrentProblemState = CurrentProblemStateIdle | CurrentProblemStateActive;

type ProblemState = {
  isReady: boolean;
  currentProblem: CurrentProblemState;
  backgroundProblems: IWebviewBackgroundProblem[];
};

const StateContext = createContext<
  { state: ProblemState; dispatch: (msg: WebviewMsg) => void } | undefined
>(undefined);

const HostEventReducer = (state: ProblemState, action: WebviewHostEvent): ProblemState => {
  return produce(state, (draft) => {
    if (action.type === 'fullProblem') {
      draft.isReady = true;
      draft.currentProblem = {
        type: 'active',
        problemId: action.problemId,
        problem: action.payload,
        startTime: Date.now(),
      };
      return;
    }
    if (action.type === 'background') {
      draft.backgroundProblems = action.payload;
      return;
    }
    if (action.type === 'noProblem') {
      draft.isReady = true;
      draft.currentProblem = { type: 'idle', canImport: action.canImport };
      return;
    }
    if (action.type === 'configChange') return; // Handled in ConfigContext
    if (action.type === 'languageList') return; // Handled in OobeContext
    if (action.type === 'languageInfo') return; // Handled in OobeContext
    if (action.type === 'checkedLanguageInfo') return; // Handled in OobeContext

    if (draft.currentProblem.type !== 'active') return;
    const problem = draft.currentProblem.problem;

    if (action.payload.revision <= problem.revision) return;
    problem.revision = action.payload.revision;
    if (action.type === 'patchMeta') {
      const { checker, interactor } = action.payload;
      if (checker !== undefined) problem.checker = checker;
      if (interactor !== undefined) problem.interactor = interactor;
      return;
    }
    if (action.type === 'patchStressTest') {
      const stressTest = problem.stressTest;
      const { generator, bruteForce, isRunning, msg } = action.payload;
      if (generator !== undefined) stressTest.generator = generator;
      if (bruteForce !== undefined) stressTest.bruteForce = bruteForce;
      if (isRunning !== undefined) stressTest.isRunning = isRunning;
      if (msg !== undefined) stressTest.msg = msg;
      return;
    }
    if (action.type === 'addTestcase') {
      problem.testcases[action.testcaseId] = action.payload;
      problem.testcaseOrder.push(action.testcaseId);
      return;
    }
    if (action.type === 'deleteTestcase') {
      delete problem.testcases[action.testcaseId];
      problem.testcaseOrder = problem.testcaseOrder.filter((id) => id !== action.testcaseId);
      return;
    }
    if (action.type === 'patchTestcase') {
      const testcase = problem.testcases[action.testcaseId];
      if (testcase)
        problem.testcases[action.testcaseId] = {
          ...testcase,
          ...action.payload,
        };
      return;
    }
    if (action.type === 'patchTestcaseResult') {
      const testcase = problem.testcases[action.testcaseId];
      if (testcase) {
        const { revision: _, ...payload } = action.payload;
        if (testcase.result) testcase.result = { ...testcase.result, ...payload };
        else if (payload.verdict) testcase.result = payload as IWebviewTestcaseResult;
      }
      return;
    }
  });
};

const WebviewMsgReducer = (state: ProblemState, action: WebviewMsg): ProblemState => {
  return produce(state, (draft) => {
    if (draft.currentProblem.type !== 'active') return;
    const problem = draft.currentProblem.problem;

    if (action.type === 'editProblemDetails') {
      problem.name = action.name;
      problem.url = action.url;
      for (const [key, val] of Object.entries(action.overrides)) {
        const k = key as keyof IWebviewProblem['overrides'];
        const overrideObj = problem.overrides[k];
        if (val !== undefined && overrideObj) overrideObj.override = val;
      }
      return;
    }
    if (action.type === 'clearTestcaseStatus') {
      const targets = action.testcaseId
        ? [problem.testcases[action.testcaseId]]
        : Object.values(problem.testcases);
      targets.forEach((testcase) => {
        testcase.result = null;
      });
      return;
    }
    if (action.type === 'setTestcaseString') {
      const testcase = problem.testcases[action.testcaseId];
      if (testcase) testcase[action.label] = { type: 'string', data: action.data };
      return;
    }
    if (action.type === 'updateTestcase') {
      const testcase = problem.testcases[action.testcaseId];
      if (!testcase) return;
      if (action.event === 'setDisable') testcase.isDisabled = action.value;
      else if (action.event === 'setExpand') testcase.isExpand = action.value;
      else if (action.event === 'setAsAnswer' && testcase.result?.stdout)
        testcase.answer = testcase.result.stdout;
      return;
    }
    if (action.type === 'deleteTestcase') {
      delete problem.testcases[action.testcaseId];
      return;
    }
    if (action.type === 'reorderTestcase') {
      const testcaseOrder = problem.testcaseOrder;
      const [movedTestcase] = testcaseOrder.splice(action.fromIdx, 1);
      testcaseOrder.splice(action.toIdx, 0, movedTestcase);
      return;
    }
  });
};

type ProblemReducerType =
  | { type: 'WebviewHostEvent'; action: WebviewHostEvent }
  | { type: 'WebviewMsg'; action: WebviewMsg };
const ProblemReducer = (
  state: ProblemState,
  { type, action }: ProblemReducerType,
): ProblemState => {
  if (type === 'WebviewHostEvent') return HostEventReducer(state, action);
  return WebviewMsgReducer(state, action);
};

export const ProblemProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatchState] = useReducer(ProblemReducer, {
    currentProblem: { type: 'idle', canImport: false },
    backgroundProblems: [],
    isReady: false,
  });

  useEffect(() => {
    const handleMessage = ({ data }: MessageEvent<WebviewHostEvent>) =>
      dispatchState({ type: 'WebviewHostEvent', action: data });
    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'init' });
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const dispatch = useCallback((msg: WebviewMsg) => {
    dispatchState({ type: 'WebviewMsg', action: msg });
    vscode.postMessage(msg);
  }, []);

  return <StateContext.Provider value={{ state, dispatch }}>{children}</StateContext.Provider>;
};

export const useProblem = () => {
  const context = useContext(StateContext);
  if (!context) throw new Error('useProblem must be used within a ProblemProvider');
  return context;
};
