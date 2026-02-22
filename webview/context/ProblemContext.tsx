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

import { produce } from 'immer';
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';
import type { WebviewEvent } from '@/application/ports/vscode/IWebviewEventBus';
import type { ProblemId } from '@/domain/types';
import type {
  IWebviewBackgroundProblem,
  IWebviewProblem,
  IWebviewTestcaseResult,
} from '@/domain/webviewTypes';
import type { WebviewMsg } from '../msgs';

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

type State = {
  isInitialized: boolean;
  currentProblem: CurrentProblemState;
  backgroundProblems: IWebviewBackgroundProblem[];
};

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<((msg: WebviewMsg) => void) | undefined>(undefined);

const problemReducer = (state: State, action: WebviewEvent | WebviewMsg): State => {
  return produce(state, (draft) => {
    if (action.type === 'FULL_PROBLEM') {
      draft.isInitialized = true;
      draft.currentProblem = {
        type: 'active',
        problemId: action.problemId,
        problem: action.payload,
        startTime: Date.now(),
      };
      return;
    }
    if (action.type === 'BACKGROUND') {
      draft.backgroundProblems = action.payload;
      return;
    }
    if (action.type === 'NO_PROBLEM') {
      draft.isInitialized = true;
      draft.currentProblem = { type: 'idle', canImport: action.canImport };
      return;
    }

    if (draft.currentProblem.type !== 'active') return;
    const problem = draft.currentProblem.problem;

    if ('payload' in action) {
      if (action.payload.revision <= problem.revision) return;
      problem.revision = action.payload.revision;
      if (action.type === 'PATCH_META') {
        const { checker, interactor } = action.payload;
        if (checker !== undefined) problem.checker = checker;
        if (interactor !== undefined) problem.interactor = interactor;
        return;
      }
      if (action.type === 'PATCH_STRESS_TEST') {
        const stressTest = problem.stressTest;
        const { generator, bruteForce, isRunning, msg } = action.payload;
        if (generator !== undefined) stressTest.generator = generator;
        if (bruteForce !== undefined) stressTest.bruteForce = bruteForce;
        if (isRunning !== undefined) stressTest.isRunning = isRunning;
        if (msg !== undefined) stressTest.msg = msg;
        return;
      }
      if (action.type === 'ADD_TESTCASE') {
        problem.testcases[action.testcaseId] = action.payload;
        problem.testcaseOrder.push(action.testcaseId);
        return;
      }
      if (action.type === 'DELETE_TESTCASE') {
        delete problem.testcases[action.testcaseId];
        problem.testcaseOrder = problem.testcaseOrder.filter((id) => id !== action.testcaseId);
        return;
      }
      if (action.type === 'PATCH_TESTCASE') {
        const testcase = problem.testcases[action.testcaseId];
        if (testcase)
          problem.testcases[action.testcaseId] = {
            ...testcase,
            ...action.payload,
          };
        return;
      }
      if (action.type === 'PATCH_TESTCASE_RESULT') {
        const testcase = problem.testcases[action.testcaseId];
        if (testcase) {
          const { revision: _, ...payload } = action.payload;
          if (testcase.result) testcase.result = { ...testcase.result, ...payload };
          else if (payload.verdict) testcase.result = payload as IWebviewTestcaseResult;
        }
        return;
      }
    }

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
        if (testcase) delete testcase.result;
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

export const ProblemProvider = ({ children }: { children: ReactNode }) => {
  const [state, reactDispatch] = useReducer(problemReducer, {
    currentProblem: { type: 'idle', canImport: false },
    backgroundProblems: [],
    isInitialized: false,
  });

  useEffect(() => {
    const handleMessage = ({ data }: MessageEvent<WebviewEvent>) => reactDispatch(data);
    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'init' });
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const dispatch = useCallback((msg: WebviewMsg) => {
    reactDispatch(msg);
    vscode.postMessage(msg);
  }, []);

  return (
    <DispatchContext.Provider value={dispatch}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </DispatchContext.Provider>
  );
};

export const useProblemState = () => {
  const state = useContext(StateContext);
  if (!state) throw new Error('useProblemState must be used within a ProblemProvider');
  return state;
};

export const useProblemDispatch = () => {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error('useProblemDispatch must be used within a ProblemProvider');
  return dispatch;
};
