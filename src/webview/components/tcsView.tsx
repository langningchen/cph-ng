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

    const handleDragStart = (idx: number) => {
        // Save current expansion states
        const states = problem.tcs.map(tc => tc.isExpand);
        setExpandedStates(states);
        
        // Collapse all test cases
        problem.tcs.forEach(tc => {
            tc.isExpand = false;
        });
        
        setDraggedIdx(idx);
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedIdx !== null && draggedIdx !== idx) {
            setDragOverIdx(idx);
        }
    };

    const handleDragEnd = () => {
        if (draggedIdx !== null && dragOverIdx !== null) {
            // Calculate the actual target index
            let targetIdx = dragOverIdx;
            
            // If dragging down, and the target is after the dragged item,
            // we need to adjust because removing the item shifts indices
            if (draggedIdx < dragOverIdx) {
                targetIdx = dragOverIdx - 1;
            }
            
            if (draggedIdx !== targetIdx) {
                msg({ type: 'reorderTc', fromIdx: draggedIdx, toIdx: targetIdx });
            }
        }
        
        // Restore expansion states
        if (expandedStates.length > 0) {
            problem.tcs.forEach((tc, idx) => {
                if (idx < expandedStates.length) {
                    tc.isExpand = expandedStates[idx];
                }
            });
        }
        
        setDraggedIdx(null);
        setDragOverIdx(null);
        setExpandedStates([]);
    };

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
                            {problem.tcs.map((tc, idx) =>
                                tc.result?.verdict &&
                                hiddenStatuses.includes(
                                    tc.result?.verdict.name,
                                ) ? null : (
                                    <React.Fragment key={idx}>
                                        {/* Drop zone before each test case */}
                                        <Box
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (draggedIdx !== null && draggedIdx !== idx) {
                                                    setDragOverIdx(idx);
                                                }
                                            }}
                                            sx={{
                                                height: '4px',
                                                ...(dragOverIdx === idx && {
                                                    backgroundColor: '#2196f3',
                                                    height: '4px',
                                                }),
                                            }}
                                        />
                                        <TcView
                                            tc={tc}
                                            idx={idx}
                                            onDragStart={() => handleDragStart(idx)}
                                            onDragEnd={handleDragEnd}
                                            isDragging={draggedIdx === idx}
                                        />
                                    </React.Fragment>
                                ),
                            )}
                            {/* Drop zone after the last test case */}
                            {problem.tcs.length > 0 && (
                                <Box
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (draggedIdx !== null) {
                                            setDragOverIdx(problem.tcs.length);
                                        }
                                    }}
                                    sx={{
                                        height: '4px',
                                        ...(dragOverIdx === problem.tcs.length && {
                                            backgroundColor: '#2196f3',
                                            height: '4px',
                                        }),
                                    }}
                                />
                            )}
                            <Box
                                onClick={() => msg({ type: 'addTc' })}
                                sx={{
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
