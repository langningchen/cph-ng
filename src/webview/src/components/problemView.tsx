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
import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { VerdictType } from '@/domain/entities/verdict';
import type { IWebviewProblem } from '@/domain/webviewTypes';
import { useProblemContext } from '../context/ProblemContext';
import { CphFlex } from './base/cphFlex';
import { CphMenu } from './base/cphMenu';
import { ErrorBoundary } from './base/errorBoundary';
import { ProblemActions } from './problemActions';
import { ProblemTitle } from './problemTitle';
import { TcsView } from './tcsView';

interface ProblemViewProps {
  problemId: UUID;
  problem: IWebviewProblem;
  startTime: number;
}

export const ProblemView = memo(({ problemId, problem, startTime }: ProblemViewProps) => {
  const { t } = useTranslation();
  const { dispatch } = useProblemContext();
  const hasRunning = useMemo(() => {
    for (const [_, tc] of problem.tcs)
      if (tc.result?.verdict.type === VerdictType.running) return true;
    return false;
  }, [problem.tcs]);

  return (
    <>
      <ErrorBoundary>
        <ProblemTitle
          problemId={problemId}
          name={problem.name}
          url={problem.url}
          checker={problem.checker}
          interactor={problem.interactor}
          timeElapsedMs={problem.timeElapsedMs}
          overrides={problem.overrides}
          startTime={startTime}
        />
      </ErrorBoundary>
      <CphFlex
        column
        flex={1}
        width='100%'
        sx={{
          overflowY: 'scroll',
          scrollbarWidth: 'thin',
          scrollbarGutter: 'stable',
        }}
        bgcolor='rgba(127, 127, 127, 0.05)'
        paddingY={2}
      >
        <ErrorBoundary>
          <CphMenu
            menu={{
              [t('problemView.menu.clearStatus')]: () => {
                dispatch({ type: 'clearTcStatus', problemId });
              },
            }}
            flex={1}
            width='100%'
          >
            <TcsView problemId={problemId} tcOrder={problem.tcOrder} tcs={problem.tcs} />
          </CphMenu>
        </ErrorBoundary>
      </CphFlex>
      <ErrorBoundary>
        <ProblemActions
          problemId={problemId}
          url={problem.url}
          bfCompare={problem.bfCompare}
          hasRunning={hasRunning}
        />
      </ErrorBoundary>
    </>
  );
});
