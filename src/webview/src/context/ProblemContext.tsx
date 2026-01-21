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

const sendMsg = window.postMessage;
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
        const tc = draft.currentProblem.problem.tcs.get(action.tcId);
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
        const tc = draft.currentProblem.problem.tcs.get(action.tcId);
        if (tc) draft.currentProblem.problem.tcs.set(action.tcId, { ...tc, ...action.payload });
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

      // --- 前端乐观更新（还没写） ---
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
    sendMsg({ type: 'init' });
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const value = useMemo(
    () => ({
      state,
      dispatch: (msg: WebviewMsg) => {
        reactDispatch(msg);
        sendMsg(msg);
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
