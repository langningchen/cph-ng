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

import type { IWebviewBackgroundProblem, IWebviewProblem, ProblemId } from '@cph-ng/core';
import { VerdictType } from '@cph-ng/core';
import { ProblemActions } from '@w/components/actions/problemActions';
import { CphNgFlex } from '@w/components/base/cphNgFlex';
import { CphNgMenu } from '@w/components/base/cphNgMenu';
import { ErrorBoundary } from '@w/components/base/errorBoundary';
import { ProblemTitle } from '@w/components/problemTitle';
import { TestcasesView } from '@w/components/testcasesView';
import { VerdictSummary } from '@w/components/verdictSummary';
import { useProblemDispatch } from '@w/context/ProblemContext';
import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface ProblemViewProps {
  problemId: ProblemId;
  problem: IWebviewProblem;
  startTime: number;
  backgroundProblems: IWebviewBackgroundProblem[];
}

export const ProblemView = memo(
  ({ problemId, problem, startTime, backgroundProblems }: ProblemViewProps) => {
    const { t } = useTranslation();
    const dispatch = useProblemDispatch();
    const hasRunning = useMemo(() => {
      for (const [_, testcase] of Object.entries(problem.testcases))
        if (testcase.result?.verdict.type === VerdictType.running) return true;
      return false;
    }, [problem.testcases]);

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
        <ErrorBoundary>
          <VerdictSummary testcaseOrder={problem.testcaseOrder} testcases={problem.testcases} />
        </ErrorBoundary>
        <CphNgFlex
          column
          flex={1}
          width='100%'
          sx={{
            overflowY: 'scroll',
            scrollbarWidth: 'none',
          }}
          paddingY={2}
        >
          <ErrorBoundary>
            <CphNgMenu
              menu={{
                [t('problemView.menu.clearStatus')]: () => {
                  dispatch({ type: 'clearTestcaseStatus', problemId });
                },
              }}
              flex={1}
              width='100%'
            >
              <TestcasesView
                problemId={problemId}
                testcaseOrder={problem.testcaseOrder}
                testcases={problem.testcases}
              />
            </CphNgMenu>
          </ErrorBoundary>
        </CphNgFlex>
        <ErrorBoundary>
          <ProblemActions
            problemId={problemId}
            url={problem.url}
            stressTest={problem.stressTest}
            hasRunning={hasRunning}
            backgroundProblems={backgroundProblems}
          />
        </ErrorBoundary>
      </>
    );
  },
);
