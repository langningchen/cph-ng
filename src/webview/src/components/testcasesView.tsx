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

import Box from '@mui/material/Box';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VerdictName } from '@/domain/entities/verdict';
import type { ProblemId, TestcaseId } from '@/domain/types';
import type { IWebviewTestcase } from '@/domain/webviewTypes';
import { useProblemDispatch } from '../context/ProblemContext';
import { AcCongrats } from './acCongrats';
import { CphFlex } from './base/cphFlex';
import { ErrorBoundary } from './base/errorBoundary';
import { NoTestcases } from './noTestcases';
import { TestcaseView } from './testcaseView';

interface TestcasesViewProps {
  problemId: ProblemId;
  testcaseOrder: TestcaseId[];
  testcases: Record<TestcaseId, IWebviewTestcase>;
}

export const TestcasesView = memo(({ problemId, testcaseOrder, testcases }: TestcasesViewProps) => {
  const { t } = useTranslation();
  const dispatch = useProblemDispatch();
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const draggedIdxRef = useRef<number | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);

  const isAllAccepted = useMemo(() => {
    return (
      testcaseOrder.length > 0 &&
      testcaseOrder.every(
        (testcaseId) => testcases[testcaseId]?.result?.verdict.name === VerdictName.accepted,
      )
    );
  }, [testcaseOrder, testcases]);

  const handleDragStart = useCallback((idx: number, e: React.DragEvent) => {
    const dragImage = document.createElement('div');
    dragImage.style.opacity = '0';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);

    draggedIdxRef.current = idx;
    dragOverIdxRef.current = idx;
    setDraggedIdx(idx);
    setDragOverIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragOverIdxRef.current !== idx) {
      dragOverIdxRef.current = idx;
      setDragOverIdx(idx);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    const dragged = draggedIdxRef.current;
    const over = dragOverIdxRef.current;
    if (dragged !== null && over !== null && dragged !== over)
      dispatch({ type: 'reorderTestcase', problemId, fromIdx: dragged, toIdx: over });

    draggedIdxRef.current = null;
    dragOverIdxRef.current = null;
    setDraggedIdx(null);
    setDragOverIdx(null);
  }, [dispatch, problemId]);

  const displayOrder = useMemo(() => {
    const order = testcaseOrder.map((_, idx) => idx);
    if (draggedIdx === null || dragOverIdx === null) return order;

    const [removed] = order.splice(draggedIdx, 1);
    order.splice(dragOverIdx, 0, removed);
    return order;
  }, [testcaseOrder, draggedIdx, dragOverIdx]);

  return (
    <CphFlex column>
      {testcaseOrder.length ? (
        <>
          {partyUri && isAllAccepted ? <AcCongrats /> : null}
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
                      isExpand={testcase.isExpand && draggedIdx === null}
                      idx={originalIdx}
                      onDragStart={handleDragStart}
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
