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
import { produce } from 'immer';
import React, {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import type { WebviewEvent } from '@/application/ports/vscode/IWebviewEventBus';
import type { IWebviewBackgroundProblem, IWebviewProblem } from '@/domain/webviewTypes';
import type { WebviewMsg } from '../msgs';

interface CurrentProblemStateIdle {
  type: 'idle';
  canImport: boolean;
}
interface CurrentProblemStateActive {
  type: 'active';
  problemId: UUID;
  problem: IWebviewProblem;
  startTime: number;
}
type CurrentProblemState = CurrentProblemStateIdle | CurrentProblemStateActive;

type State = {
  isInitialized: boolean;
  currentProblem: CurrentProblemState;
  backgroundProblems: IWebviewBackgroundProblem[];
};

interface ProblemContextType {
  state: State;
  dispatch: (msg: WebviewMsg) => void;
}

const ProblemContext = createContext<ProblemContextType | undefined>(undefined);

const problemReducer = (state: State, action: WebviewEvent | WebviewMsg): State => {
  return produce(state, (draft) => {
    switch (action.type) {
      case 'FULL_PROBLEM': {
        draft.isInitialized = true;
        draft.currentProblem = {
          type: 'active',
          problemId: action.problemId,
          problem: action.payload,
          startTime: Date.now(),
        };
        break;
      }
      case 'PATCH_META': {
        if (draft.currentProblem.type !== 'active') return;
        const problem = draft.currentProblem.problem;
        const { checker, interactor } = action.payload;
        if (checker !== undefined) problem.checker = checker;
        if (interactor !== undefined) problem.interactor = interactor;
        break;
      }
      case 'PATCH_STRESS_TEST': {
        if (draft.currentProblem.type !== 'active') return;
        const stressTest = draft.currentProblem.problem.stressTest;
        const { generator, bruteForce, isRunning, msg } = action.payload;
        if (generator !== undefined) stressTest.generator = generator;
        if (bruteForce !== undefined) stressTest.bruteForce = bruteForce;
        if (isRunning !== undefined) stressTest.isRunning = isRunning;
        if (msg !== undefined) stressTest.msg = msg;
        return;
      }
      case 'ADD_TESTCASE': {
        if (draft.currentProblem.type !== 'active') return;
        draft.currentProblem.problem.testcases[action.testcaseId] = action.payload;
        draft.currentProblem.problem.testcaseOrder.push(action.testcaseId);
        break;
      }
      case 'DELETE_TESTCASE': {
        if (draft.currentProblem.type !== 'active') return;
        delete draft.currentProblem.problem.testcases[action.testcaseId];
        break;
      }
      case 'PATCH_TESTCASE': {
        if (draft.currentProblem.type !== 'active') return;
        const testcase = draft.currentProblem.problem.testcases[action.testcaseId];
        draft.currentProblem.problem.testcases[action.testcaseId] = {
          ...testcase,
          ...action.payload,
        };
        break;
      }
      case 'PATCH_TESTCASE_RESULT': {
        if (draft.currentProblem.type !== 'active') return;
        const testcase = draft.currentProblem.problem.testcases[action.testcaseId];
        if (testcase)
          testcase.result = {
            ...(testcase.result || {}),
            ...action.payload,
          };
        break;
      }
      case 'BACKGROUND': {
        draft.backgroundProblems = action.payload;
        break;
      }
      case 'NO_PROBLEM': {
        draft.isInitialized = true;
        draft.currentProblem = { type: 'idle', canImport: action.canImport };
        break;
      }

      case 'editProblemDetails': {
        if (draft.currentProblem.type !== 'active') return;
        const problem = draft.currentProblem.problem;
        problem.name = action.name;
        problem.url = action.url;
        if (action.overrides.timeLimitMs)
          problem.overrides.timeLimitMs.override = action.overrides.timeLimitMs;
        if (action.overrides.memoryLimitMb)
          problem.overrides.memoryLimitMb.override = action.overrides.memoryLimitMb;
        if (action.overrides.compiler && problem.overrides.compiler)
          problem.overrides.compiler.override = action.overrides.compiler;
        if (action.overrides.compilerArgs && problem.overrides.compilerArgs)
          problem.overrides.compilerArgs.override = action.overrides.compilerArgs;
        if (action.overrides.runner && problem.overrides.runner)
          problem.overrides.runner.override = action.overrides.runner;
        if (action.overrides.runnerArgs && problem.overrides.runnerArgs)
          problem.overrides.runnerArgs.override = action.overrides.runnerArgs;
        break;
      }
      case 'clearTestcaseStatus': {
        if (draft.currentProblem.type !== 'active') return;
        if (action.testcaseId)
          delete draft.currentProblem.problem.testcases[action.testcaseId].result;
        else
          for (const testcase of Object.values(draft.currentProblem.problem.testcases))
            delete testcase.result;
        break;
      }
      case 'setTestcaseString': {
        if (draft.currentProblem.type !== 'active') return;
        const testcase = draft.currentProblem.problem.testcases[action.testcaseId];
        if (action.label === 'stdin') testcase.stdin = { type: 'string', data: action.data };
        if (action.label === 'answer') testcase.answer = { type: 'string', data: action.data };
        break;
      }
      case 'updateTestcase': {
        if (draft.currentProblem.type !== 'active') return;
        const testcase = draft.currentProblem.problem.testcases[action.testcaseId];
        if (action.event === 'toggleDisable') testcase.isDisabled = !testcase.isDisabled;
        if (action.event === 'toggleExpand') testcase.isExpand = !testcase.isExpand;
        if (action.event === 'setAsAnswer' && testcase.result?.stdout)
          testcase.answer = testcase.result.stdout;
        break;
      }
      case 'deleteTestcase': {
        if (draft.currentProblem.type !== 'active') return;
        delete draft.currentProblem.problem.testcases[action.testcaseId];
        break;
      }
      case 'reorderTestcase': {
        if (draft.currentProblem.type !== 'active') return;
        const testcaseOrder = draft.currentProblem.problem.testcaseOrder;
        const [movedTestcase] = testcaseOrder.splice(action.fromIdx, 1);
        testcaseOrder.splice(action.toIdx, 0, movedTestcase);
        break;
      }
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

  const value = useMemo(
    () => ({
      state,
      dispatch: (msg: WebviewMsg) => {
        reactDispatch(msg);
        vscode.postMessage(msg);
      },
    }),
    [state],
  );

  return <ProblemContext.Provider value={value}>{children}</ProblemContext.Provider>;
};

export const useProblemContext = () => {
  const context = useContext(ProblemContext);
  if (!context) throw new Error('useProblemContext must be used within a ProblemProvider');
  return context;
};
