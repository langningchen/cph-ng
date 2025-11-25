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

import { createTheme, ThemeProvider } from '@mui/material/styles';
import i18n from 'i18next';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initReactI18next } from 'react-i18next';
import {
    ActivePathEvent,
    ProblemEvent,
    ProblemEventData,
} from '../../modules/sidebar';
import CphFlex from './components/base/cphFlex';
import ErrorBoundary from './components/base/errorBoundary';
import BgProblemView from './components/bgProblemView';
import CreateProblemView from './components/createProblemView';
import DragOverlay from './components/dragOverlay';
import InitView from './components/initView';
import ProblemView from './components/problemView';
import langEn from './l10n/en.json';
import langZh from './l10n/zh.json';
import { msg } from './utils';

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: langEn },
        zh: { translation: langZh },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

const App = () => {
    const [problemData, setProblemData] = useState<
        ProblemEventData | undefined
    >();
    useEffect(() => {
        i18n.changeLanguage(language);
        window.onmessage = (
            e: MessageEvent<ProblemEvent | ActivePathEvent>,
        ) => {
            const msg = e.data;
            switch (msg.type) {
                case 'activePath':
                    window.activePath = msg.activePath;
                    break;
                case 'problem':
                    setProblemData(msg);
                    break;
            }
        };
        msg({ type: 'init' });
    }, []);

    const theme = createTheme({
        palette: {
            mode: isDarkMode ? 'dark' : 'light',
        },
        breakpoints: {
            values: {
                xs: 0,
                sm: 170,
                md: 260,
                lg: 360,
                xl: 480,
            },
        },
    });
    return (
        <ThemeProvider theme={theme}>
            <ErrorBoundary>
                <DragOverlay />
            </ErrorBoundary>
            <ErrorBoundary>
                <CphFlex
                    column
                    smallGap
                    height={'100%'}
                    sx={{
                        boxSizing: 'border-box',
                    }}
                    padding={1}
                >
                    {problemData ? (
                        <>
                            {problemData.problem ? (
                                <ProblemView {...problemData.problem} />
                            ) : (
                                <CreateProblemView
                                    canImport={problemData.canImport || false}
                                />
                            )}
                            <BgProblemView
                                bgProblems={problemData.bgProblems || []}
                            />
                        </>
                    ) : (
                        <InitView />
                    )}
                </CphFlex>
            </ErrorBoundary>
        </ThemeProvider>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
