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
import type { IWebviewTc } from '@/domain/webviewTypes';
import { useProblemContext } from '../context/ProblemContext';
import { AcCongrats } from './acCongrats';
import { CphFlex } from './base/cphFlex';
import { ErrorBoundary } from './base/errorBoundary';
import { NoTcs } from './noTcs';
import { TcView } from './tcView';

interface TcsViewProps {
  problemId: UUID;
  tcOrder: UUID[];
  tcs: Record<UUID, IWebviewTc>;
}

export const TcsView = memo(({ problemId, tcOrder, tcs }: TcsViewProps) => {
  const { t } = useTranslation();
  const { dispatch } = useProblemContext();
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [expandedStates, setExpandedStates] = useState<boolean[]>([]);

  const handleDragStart = (idx: number, e: React.DragEvent) => {
    const states = tcOrder.map((id) => tcs[id]?.isExpand || false);
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
      const [movedId] = tcOrder.splice(draggedIdx, 1);
      tcOrder.splice(dragOverIdx, 0, movedId);
      dispatch({ type: 'reorderTc', problemId, fromIdx: draggedIdx, toIdx: dragOverIdx });
    }

    if (expandedStates.length > 0) {
      const reorderedStates = [...expandedStates];
      if (draggedIdx !== null && dragOverIdx !== null && draggedIdx !== dragOverIdx) {
        const [movedState] = reorderedStates.splice(draggedIdx, 1);
        reorderedStates.splice(dragOverIdx, 0, movedState);
      }
      tcOrder.forEach((id, idx) => {
        const tc = tcs[id];
        if (tc && idx < reorderedStates.length) tc.isExpand = reorderedStates[idx];
      });
    }

    setDraggedIdx(null);
    setDragOverIdx(null);
    setExpandedStates([]);
  };

  const getDisplayOrder = () => {
    if (draggedIdx === null || dragOverIdx === null) return tcOrder.map((_, idx) => idx);
    const order = tcOrder.map((_, idx) => idx);
    const [removed] = order.splice(draggedIdx, 1);
    order.splice(dragOverIdx, 0, removed);
    return order;
  };

  const displayOrder = getDisplayOrder();

  return (
    <CphFlex column>
      {tcOrder.length ? (
        <>
          {partyUri &&
          tcOrder.every((id) => tcs[id]?.result?.verdict.name === VerdictName.accepted) ? (
            <AcCongrats />
          ) : null}
          <Box width='100%'>
            {displayOrder.map((originalIdx, displayIdx) => {
              const tcId = tcOrder[originalIdx];
              const tc = tcs[tcId];
              if (!tc || (tc.result?.verdict && hiddenStatuses.includes(tc.result?.verdict.name)))
                return null;

              return (
                <Box key={tcId} onDragOver={(e) => handleDragOver(e, displayIdx)}>
                  <ErrorBoundary>
                    <TcView
                      problemId={problemId}
                      tcId={tcId}
                      tc={tc}
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
        <NoTcs />
      )}
      <Box
        onClick={() => dispatch({ type: 'addTc', problemId })}
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
        {t('tcsView.addTcHint')}
      </Box>
    </CphFlex>
  );
});
