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
import Box from '@mui/material/Box';
import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VerdictName } from '@/domain/entities/verdict';
import type { IWebviewTestcase } from '@/domain/webviewTypes';
import { useProblemContext } from '../context/ProblemContext';
import { AcCongrats } from './acCongrats';
import { CphFlex } from './base/cphFlex';
import { ErrorBoundary } from './base/errorBoundary';
import { NoTestcases } from './noTestcases';
import { TestcaseView } from './testcaseView';

interface TestcasesViewProps {
  problemId: UUID;
  testcaseOrder: UUID[];
  testcases: Record<UUID, IWebviewTestcase>;
}

export const TestcasesView = memo(({ problemId, testcaseOrder, testcases }: TestcasesViewProps) => {
  const { t } = useTranslation();
  const { dispatch } = useProblemContext();
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [expandedStates, setExpandedStates] = useState<boolean[]>([]);

  const handleDragStart = (idx: number, e: React.DragEvent) => {
    const states = testcaseOrder.map((id) => testcases[id]?.isExpand || false);
    setExpandedStates(states);

    const dragImage = document.createElement('div');
    dragImage.style.opacity = '0';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);

    setDraggedIdx(idx);
    setDragOverIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx !== null) {
      setDragOverIdx(idx);
    }
  };

  const handleDragEnd = () => {
    if (draggedIdx !== null && dragOverIdx !== null && draggedIdx !== dragOverIdx) {
      const [movedId] = testcaseOrder.splice(draggedIdx, 1);
      testcaseOrder.splice(dragOverIdx, 0, movedId);
      dispatch({ type: 'reorderTestcase', problemId, fromIdx: draggedIdx, toIdx: dragOverIdx });
    }

    if (expandedStates.length > 0) {
      const reorderedStates = [...expandedStates];
      if (draggedIdx !== null && dragOverIdx !== null && draggedIdx !== dragOverIdx) {
        const [movedState] = reorderedStates.splice(draggedIdx, 1);
        reorderedStates.splice(dragOverIdx, 0, movedState);
      }
      testcaseOrder.forEach((id, idx) => {
        const testcase = testcases[id];
        if (testcase && idx < reorderedStates.length) testcase.isExpand = reorderedStates[idx];
      });
    }

    setDraggedIdx(null);
    setDragOverIdx(null);
    setExpandedStates([]);
  };

  const getDisplayOrder = () => {
    if (draggedIdx === null || dragOverIdx === null) return testcaseOrder.map((_, idx) => idx);
    const order = testcaseOrder.map((_, idx) => idx);
    const [removed] = order.splice(draggedIdx, 1);
    order.splice(dragOverIdx, 0, removed);
    return order;
  };

  const displayOrder = getDisplayOrder();

  return (
    <CphFlex column>
      {testcaseOrder.length ? (
        <>
          {partyUri &&
          testcaseOrder.every(
            (id) => testcases[id]?.result?.verdict.name === VerdictName.accepted,
          ) ? (
            <AcCongrats />
          ) : null}
          <Box width='100%'>
            {displayOrder.map((originalIdx, displayIdx) => {
              const testcaseId = testcaseOrder[originalIdx];
              const testcase = testcases[testcaseId];
              if (
                !testcase ||
                (testcase.result?.verdict && hiddenStatuses.includes(testcase.result?.verdict.name))
              )
                return null;

              return (
                <Box key={testcaseId} onDragOver={(e) => handleDragOver(e, displayIdx)}>
                  <ErrorBoundary>
                    <TestcaseView
                      problemId={problemId}
                      testcaseId={testcaseId}
                      testcase={testcase}
                      idx={originalIdx}
                      onDragStart={(e) => handleDragStart(originalIdx, e)}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedIdx === originalIdx}
                    />
                  </ErrorBoundary>
                </Box>
              );
            })}
          </Box>
        </>
      ) : (
        <NoTestcases />
      )}
      <Box
        onClick={() => dispatch({ type: 'addTestcase', problemId })}
        sx={{
          width: '100%',
          minHeight: '40px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.5,
          '&:hover': {
            opacity: 1,
            backgroundColor: 'rgba(127, 127, 127, 0.1)',
          },
          transition: 'all 0.2s',
        }}
      >
        {t('testcasesView.addTestcaseHint')}
      </Box>
    </CphFlex>
  );
});
