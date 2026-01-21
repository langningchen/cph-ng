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
import { VerdictName, Verdicts } from '@/domain/entities/verdict';
import type { IWebviewBackgroundProblem, IWebviewProblem } from '@/domain/webviewTypes';
import type { WebviewMsg } from '../msgs';

export interface CurrentProblemStateIdle {
  type: 'idle';
  canImport: boolean;
}
export interface CurrentProblemStateActive {
  type: 'active';
  problemId: UUID;
  problem: IWebviewProblem;
  startTime: number;
}
export type CurrentProblemState = CurrentProblemStateIdle | CurrentProblemStateActive;

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
      case 'PATCH_TC_RESULT': {
        if (draft.currentProblem.type !== 'active') return;
        const tc = draft.currentProblem.problem.tcs[action.tcId];
        if (tc)
          tc.result = {
            verdict: Verdicts[VerdictName.unknownError],
            ...(tc.result || {}),
            ...action.payload,
          };
        break;
      }
      case 'PATCH_TC': {
        if (draft.currentProblem.type !== 'active') return;
        const tc = draft.currentProblem.problem.tcs[action.tcId];
        draft.currentProblem.problem.tcs[action.tcId] = { ...tc, ...action.payload };
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

      case 'clearTcStatus': {
        if (draft.currentProblem.type !== 'active') return;
        if (action.id) delete draft.currentProblem.problem.tcs[action.id].result;
        else for (const tc of Object.values(draft.currentProblem.problem.tcs)) delete tc.result;
        break;
      }

      case 'setTcString': {
        if (draft.currentProblem.type !== 'active') return;
        const tc = draft.currentProblem.problem.tcs[action.id];
        if (action.label === 'stdin') tc.stdin = { type: 'string', data: action.data };
        if (action.label === 'answer') tc.answer = { type: 'string', data: action.data };
        break;
      }

      case 'updateTc': {
        if (draft.currentProblem.type !== 'active') return;
        const tc = draft.currentProblem.problem.tcs[action.id];
        if (action.event === 'toggleDisable') tc.isDisabled = !tc.isDisabled;
        if (action.event === 'toggleExpand') tc.isExpand = !tc.isExpand;
        if (action.event === 'setAsAnswer' && tc.result?.stdout) tc.answer = tc.result.stdout;
        break;
      }

      case 'reorderTc': {
        if (draft.currentProblem.type !== 'active') return;
        const tcOrder = draft.currentProblem.problem.tcOrder;
        const [movedTc] = tcOrder.splice(action.fromIdx, 1);
        tcOrder.splice(action.toIdx, 0, movedTc);
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
