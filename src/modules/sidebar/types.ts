import type { IProblem } from '@/types';

export interface ProblemEventData {
  canImport: boolean;
  problem: {
    problem: IProblem;
    startTime: number;
  } | null;
  bgProblems: {
    name: string;
    srcPath: string;
  }[];
}
export interface ProblemEvent extends ProblemEventData {
  type: 'problem';
}
export interface ActivePathEventData {
  activePath?: string;
}
export interface ActivePathEvent extends ActivePathEventData {
  type: 'activePath';
}
