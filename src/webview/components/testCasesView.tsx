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
import React from 'react';
import { Problem } from '../../types';
import AcCongrats from './acCongrats';
import CphFlex from './cphFlex';
import NoTestCases from './noTestCases';
import TestCaseView from './testCaseView';

interface TestCasesViewProps {
    problem: Problem;
}

const TestCasesView = ({ problem }: TestCasesViewProps) => {
    return (
        <Container>
            <CphFlex column>
                {problem.testCases.length ? (
                    <>
                        {partyUri &&
                        problem.testCases.every(
                            (tc) => tc.result?.verdict.name === 'AC',
                        ) ? (
                            <AcCongrats />
                        ) : null}
                        <Box width={'100%'}>
                            {problem.testCases.map((tc, index) =>
                                tc.result?.verdict &&
                                hiddenStatuses.includes(
                                    tc.result?.verdict.name,
                                ) ? null : (
                                    <TestCaseView
                                        testCase={tc}
                                        index={index}
                                        key={index}
                                    />
                                ),
                            )}
                        </Box>
                    </>
                ) : (
                    <NoTestCases />
                )}
            </CphFlex>
        </Container>
    );
};

export default TestCasesView;
