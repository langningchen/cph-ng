// Copyright (C) 2025 Langning Chen
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

import { IProblem } from '@/types/types';
import Box from '@mui/material/Box';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { msg } from '../utils';
import AcCongrats from './acCongrats';
import CphFlex from './base/cphFlex';
import ErrorBoundary from './base/errorBoundary';
import NoTcs from './noTcs';
import TcView from './tcView';

interface TcsViewProps {
  problem: IProblem;
}

const TcsView = ({ problem }: TcsViewProps) => {
  const { t } = useTranslation();
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [expandedStates, setExpandedStates] = useState<boolean[]>([]);

  const handleDragStart = (idx: number, e: React.DragEvent) => {
    const states = problem.tcOrder.map((id) =>
      problem.tcs[id] ? problem.tcs[id].isExpand : false,
    );
    setExpandedStates(states);

    for (const tc of Object.values(problem.tcs)) {
      tc.isExpand = false;
    }

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
    if (
      draggedIdx !== null &&
      dragOverIdx !== null &&
      draggedIdx !== dragOverIdx
    ) {
      const [movedId] = problem.tcOrder.splice(draggedIdx, 1);
      problem.tcOrder.splice(dragOverIdx, 0, movedId);
      msg({ type: 'reorderTc', fromIdx: draggedIdx, toIdx: dragOverIdx });
    }

    if (expandedStates.length > 0) {
      const reorderedStates = [...expandedStates];
      if (
        draggedIdx !== null &&
        dragOverIdx !== null &&
        draggedIdx !== dragOverIdx
      ) {
        const [movedState] = reorderedStates.splice(draggedIdx, 1);
        reorderedStates.splice(dragOverIdx, 0, movedState);
      }
      problem.tcOrder.forEach((id, idx) => {
        const tc = problem.tcs[id];
        if (tc && idx < reorderedStates.length) {
          tc.isExpand = reorderedStates[idx];
        }
      });
    }

    setDraggedIdx(null);
    setDragOverIdx(null);
    setExpandedStates([]);
  };

  const getDisplayOrder = () => {
    if (draggedIdx === null || dragOverIdx === null) {
      return problem.tcOrder.map((_, idx) => idx);
    }
    const order = problem.tcOrder.map((_, idx) => idx);
    const [removed] = order.splice(draggedIdx, 1);
    order.splice(dragOverIdx, 0, removed);
    return order;
  };

  const displayOrder = getDisplayOrder();

  return (
    <CphFlex column>
      {problem.tcOrder.length ? (
        <>
          {partyUri &&
          problem.tcOrder.every(
            (id) => problem.tcs[id]?.result?.verdict.name === 'AC',
          ) ? (
            <AcCongrats />
          ) : null}
          <Box width={'100%'}>
            {displayOrder.map((originalIdx, displayIdx) => {
              const id = problem.tcOrder[originalIdx];
              const tc = problem.tcs[id];
              if (
                tc.result?.verdict &&
                hiddenStatuses.includes(tc.result?.verdict.name)
              ) {
                return null;
              }

              return (
                <Box
                  key={id}
                  onDragOver={(e) => handleDragOver(e, displayIdx)}
                >
                  <ErrorBoundary>
                    <TcView
                      tc={tc}
                      idx={originalIdx}
                      id={id}
                      onDragStart={(e) => handleDragStart(originalIdx, e)}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedIdx === originalIdx}
                    />
                  </ErrorBoundary>
                </Box>
              );
            })}
            <Box
              onClick={() => msg({ type: 'addTc' })}
              sx={{
                'minHeight': '40px',
                'cursor': 'pointer',
                'display': 'flex',
                'alignItems': 'center',
                'justifyContent': 'center',
                'opacity': 0.5,
                '&:hover': {
                  opacity: 1,
                  backgroundColor: 'rgba(127, 127, 127, 0.1)',
                },
                'transition': 'all 0.2s',
              }}
            >
              {t('tcsView.addTcHint')}
            </Box>
          </Box>
        </>
      ) : (
        <NoTcs />
      )}
    </CphFlex>
  );
};

export default TcsView;
