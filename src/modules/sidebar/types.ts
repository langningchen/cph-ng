import { Problem } from '@/types';

export interface ProblemEventData {
  canImport: boolean;
  problem: {
    problem: Problem;
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
