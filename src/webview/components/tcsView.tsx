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

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Problem } from '../../utils/types';
import { msg } from '../utils';
import AcCongrats from './acCongrats';
import CphFlex from './base/cphFlex';
import NoTcs from './noTcs';
import TcView from './tcView';

interface TcsViewProps {
    problem: Problem;
}

const TcsView = ({ problem }: TcsViewProps) => {
    const { t } = useTranslation();
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const [expandedStates, setExpandedStates] = useState<boolean[]>([]);

    const handleDragStart = (idx: number, e: React.DragEvent) => {
        // Save current expansion states mapped to test case objects
        const states = problem.tcs.map((tc) => ({ tc, isExpand: tc.isExpand }));
        setExpandedStates(states.map((s) => s.isExpand));

        // Collapse all test cases
        problem.tcs.forEach((tc) => {
            tc.isExpand = false;
        });

        // Create a transparent drag image to hide default ghost
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
            // Perform the actual reorder in the local array immediately
            const [movedTc] = problem.tcs.splice(draggedIdx, 1);
            problem.tcs.splice(dragOverIdx, 0, movedTc);

            // Send message to persist the change
            msg({ type: 'reorderTc', fromIdx: draggedIdx, toIdx: dragOverIdx });
        }

        // Restore expansion states by finding original indices before reorder
        if (expandedStates.length > 0) {
            // Calculate the reordered positions to restore correct states
            const reorderedStates = [...expandedStates];
            if (
                draggedIdx !== null &&
                dragOverIdx !== null &&
                draggedIdx !== dragOverIdx
            ) {
                const [movedState] = reorderedStates.splice(draggedIdx, 1);
                reorderedStates.splice(dragOverIdx, 0, movedState);
            }
            problem.tcs.forEach((tc, idx) => {
                if (idx < reorderedStates.length) {
                    tc.isExpand = reorderedStates[idx];
                }
            });
        }

        setDraggedIdx(null);
        setDragOverIdx(null);
        setExpandedStates([]);
    };

    // Calculate display order for preview
    const getDisplayOrder = () => {
        if (draggedIdx === null || dragOverIdx === null) {
            return problem.tcs.map((_, idx) => idx);
        }

        const order = problem.tcs.map((_, idx) => idx);
        const [removed] = order.splice(draggedIdx, 1);
        order.splice(dragOverIdx, 0, removed);
        return order;
    };

    const displayOrder = getDisplayOrder();

    return (
        <Container>
            <CphFlex column>
                {problem.tcs.length ? (
                    <>
                        {partyUri &&
                        problem.tcs.every(
                            (tc) => tc.result?.verdict.name === 'AC',
                        ) ? (
                            <AcCongrats />
                        ) : null}
                        <Box width={'100%'}>
                            {displayOrder.map((originalIdx, displayIdx) => {
                                const tc = problem.tcs[originalIdx];
                                if (
                                    tc.result?.verdict &&
                                    hiddenStatuses.includes(
                                        tc.result?.verdict.name,
                                    )
                                ) {
                                    return null;
                                }

                                return (
                                    <Box
                                        key={originalIdx}
                                        onDragOver={(e) =>
                                            handleDragOver(e, displayIdx)
                                        }
                                    >
                                        <TcView
                                            tc={tc}
                                            idx={originalIdx}
                                            onDragStart={(e) =>
                                                handleDragStart(originalIdx, e)
                                            }
                                            onDragEnd={handleDragEnd}
                                            isDragging={
                                                draggedIdx === originalIdx
                                            }
                                        />
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
                                        backgroundColor:
                                            'rgba(127, 127, 127, 0.1)',
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
        </Container>
    );
};

export default TcsView;
