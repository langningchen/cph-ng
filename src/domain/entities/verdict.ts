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

export const VerdictName = {
  UKE: 'UKE',
  AC: 'AC',
  PC: 'PC',
  PE: 'PE',
  WA: 'WA',
  TLE: 'TLE',
  MLE: 'MLE',
  OLE: 'OLE',
  RE: 'RE',
  RF: 'RF',
  CE: 'CE',
  SE: 'SE',
  WT: 'WT',
  FC: 'FC',
  CP: 'CP',
  CPD: 'CPD',
  JG: 'JG',
  JGD: 'JGD',
  CMP: 'CMP',
  SK: 'SK',
  RJ: 'RJ',
} as const;
export type VerdictName = (typeof VerdictName)[keyof typeof VerdictName];

export interface Verdict {
  name: VerdictName;
  fullName: string;
  color: string;
}

export const VERDICTS: Record<VerdictName, Verdict> = {
  [VerdictName.UKE]: { name: VerdictName.UKE, fullName: 'Unknown Error', color: '#0000ff' },
  [VerdictName.AC]: { name: VerdictName.AC, fullName: 'Accepted', color: '#49cd32' },
  [VerdictName.PC]: { name: VerdictName.PC, fullName: 'Partially Correct', color: '#ed9813' },
  [VerdictName.PE]: { name: VerdictName.PE, fullName: 'Presentation Error', color: '#ff778e' },
  [VerdictName.WA]: { name: VerdictName.WA, fullName: 'Wrong Answer', color: '#d3140d' },
  [VerdictName.TLE]: { name: VerdictName.TLE, fullName: 'Time Limit Exceed', color: '#0c0066' },
  [VerdictName.MLE]: { name: VerdictName.MLE, fullName: 'Memory Limit Exceed', color: '#5300a7' },
  [VerdictName.OLE]: { name: VerdictName.OLE, fullName: 'Output Limit Exceed', color: '#8300a7' },
  [VerdictName.RE]: { name: VerdictName.RE, fullName: 'Runtime Error', color: '#1a26c8' },
  [VerdictName.RF]: { name: VerdictName.RF, fullName: 'Restricted Function', color: '#008f81' },
  [VerdictName.CE]: { name: VerdictName.CE, fullName: 'Compilation Error', color: '#8b7400' },
  [VerdictName.SE]: { name: VerdictName.SE, fullName: 'System Error', color: '#000000' },
  [VerdictName.WT]: { name: VerdictName.WT, fullName: 'Waiting', color: '#4100d9' },
  [VerdictName.FC]: { name: VerdictName.FC, fullName: 'Fetched', color: '#4c00ff' },
  [VerdictName.CP]: { name: VerdictName.CP, fullName: 'Compiling', color: '#5e19ff' },
  [VerdictName.CPD]: { name: VerdictName.CPD, fullName: 'Compiled', color: '#7340ff' },
  [VerdictName.JG]: { name: VerdictName.JG, fullName: 'Judging', color: '#844fff' },
  [VerdictName.JGD]: { name: VerdictName.JGD, fullName: 'Judged', color: '#967fff' },
  [VerdictName.CMP]: { name: VerdictName.CMP, fullName: 'Comparing', color: '#a87dff' },
  [VerdictName.SK]: { name: VerdictName.SK, fullName: 'Skipped', color: '#4b4b4b' },
  [VerdictName.RJ]: { name: VerdictName.RJ, fullName: 'Rejected', color: '#4e0000' },
};

const RUNNING_SET = new Set<VerdictName>([
  VerdictName.WT,
  VerdictName.CP,
  VerdictName.CPD,
  VerdictName.JG,
  VerdictName.JGD,
  VerdictName.CMP,
]);
export const isRunningVerdict = (verdict?: VerdictName): boolean => {
  return verdict !== undefined && RUNNING_SET.has(verdict);
};

const PASSED_SET = new Set<VerdictName>([VerdictName.AC, VerdictName.SK, VerdictName.RJ]);
export const isExpandVerdict = (verdict?: VerdictName): boolean => {
  return verdict !== undefined && !RUNNING_SET.has(verdict) && !PASSED_SET.has(verdict);
};
