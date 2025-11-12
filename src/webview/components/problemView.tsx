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
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Problem } from '../../utils/types';
import { msg } from '../utils';
import CphMenu from './base/cphMenu';
import ErrorBoundary from './base/errorBoundary';
import ProblemActions from './problemActions';
import ProblemTitle from './problemTitle';
import TcsView from './tcsView';

interface ProblemViewProps {
    problem: Problem;
    startTime: number;
}

const ProblemView = ({ problem, startTime }: ProblemViewProps) => {
    const { t } = useTranslation();
    return (
        <>
            <ErrorBoundary>
                <ProblemTitle
                    problem={problem}
                    startTime={startTime}
                />
            </ErrorBoundary>
            <Box
                flex={1}
                width={'100%'}
                sx={{
                    overflowY: 'scroll',
                    scrollbarWidth: 'thin',
                    scrollbarGutter: 'stable',
                }}
                bgcolor={'rgba(127, 127, 127, 0.05)'}
                paddingY={2}
            >
                <ErrorBoundary>
                    <CphMenu
                        menu={{
                            [t('problemView.menu.clearStatus')]: () => {
                                msg({ type: 'clearStatus' });
                            },
                        }}
                    >
                        <TcsView problem={problem} />
                    </CphMenu>
                </ErrorBoundary>
            </Box>
            <ErrorBoundary>
                <ProblemActions problem={problem} />
            </ErrorBoundary>
        </>
    );
};

export default ProblemView;
