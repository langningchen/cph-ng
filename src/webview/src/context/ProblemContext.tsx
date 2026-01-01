import type { UUID } from 'node:crypto';
import React, { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import type { IProblem } from '@/types';
import type { ActivePathEvent, ProblemEvent, ProblemEventData } from '../../../modules/sidebar';
import type { ProblemMsgCore } from '../msgs';
import { msg as sendMsg } from '../utils';

interface ProblemContextType {
  problemData: ProblemEventData | undefined;
  dispatch: (msg: ProblemMsgCore) => void;
}

const ProblemContext = createContext<ProblemContextType | undefined>(undefined);

export const useProblemContext = () => {
  const context = useContext(ProblemContext);
  if (!context) {
    throw new Error('useProblemContext must be used within a ProblemProvider');
  }
  return context;
};

export const ProblemProvider = ({ children }: { children: ReactNode }) => {
  const [problemData, setProblemData] = useState<ProblemEventData | undefined>();

  useEffect(() => {
    const handleMessage = (e: MessageEvent<ProblemEvent | ActivePathEvent>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'activePath':
          window.activePath = msg.activePath;
          break;
        case 'problem':
          setProblemData(msg);
          break;
      }
    };
    window.addEventListener('message', handleMessage);
    sendMsg({ type: 'init' });
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const dispatch = (msg: ProblemMsgCore) => {
    sendMsg(msg);

    // Optimistic updates
    if (!problemData?.problem) return;

    const problemWrapper = { ...problemData.problem };
    const problem: IProblem = { ...problemWrapper.problem };
    problem.tcs = { ...problem.tcs };
    problemWrapper.problem = problem;

    let changed = false;

    switch (msg.type) {
      case 'editProblemDetails':
        problem.name = msg.title;
        problem.url = msg.url;
        problem.timeLimit = msg.timeLimit;
        problem.memoryLimit = msg.memoryLimit;
        problem.overwrites = msg.overwrites;
        changed = true;
        break;
      case 'removeSrcFile':
        if (msg.fileType === 'checker') {
          problem.checker = undefined;
        }
        if (msg.fileType === 'interactor') {
          problem.interactor = undefined;
        }
        if (msg.fileType === 'generator' && problem.bfCompare) {
          problem.bfCompare.generator = undefined;
        }
        if (msg.fileType === 'bruteForce' && problem.bfCompare) {
          problem.bfCompare.bruteForce = undefined;
        }
        changed = true;
        break;
      case 'updateTc':
        if (problem.tcs[msg.id]) {
          problem.tcs[msg.id] = msg.tc;
          changed = true;
        }
        break;
      case 'toggleDisable':
        if (problem.tcs[msg.id]) {
          problem.tcs[msg.id] = { ...problem.tcs[msg.id] };
          problem.tcs[msg.id].isDisabled = !problem.tcs[msg.id].isDisabled;
          changed = true;
        }
        break;
      case 'clearTcStatus':
        if (problem.tcs[msg.id]) {
          problem.tcs[msg.id] = { ...problem.tcs[msg.id] };
          problem.tcs[msg.id].result = undefined;
          changed = true;
        }
        break;
      case 'clearStatus':
        (Object.keys(problem.tcs) as UUID[]).forEach((id) => {
          problem.tcs[id] = { ...problem.tcs[id] };
          problem.tcs[id].result = undefined;
        });
        changed = true;
        break;
      case 'delTc':
        delete problem.tcs[msg.id];
        problem.tcOrder = problem.tcOrder.filter((id: string) => id !== msg.id);
        changed = true;
        break;
      case 'reorderTc': {
        const { fromIdx, toIdx } = msg;
        const tcOrder = [...problem.tcOrder];
        const [moved] = tcOrder.splice(fromIdx, 1);
        tcOrder.splice(toIdx, 0, moved);
        problem.tcOrder = tcOrder;
        changed = true;
        break;
      }
    }

    if (changed) {
      setProblemData({
        ...problemData,
        problem: problemWrapper,
      });
    }
  };

  return (
    <ProblemContext.Provider value={{ problemData, dispatch }}>{children}</ProblemContext.Provider>
  );
};
