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
import { Problem } from '../utils/types';
import ErrorBoundary from './components/base/errorBoundary';
import CreateProblemView from './components/createProblemView';
import ProblemView from './components/problemView';
import langEn from './l10n/en.json';
import langZh from './l10n/zh.json';
import { GetProblemMsg } from './msgs';

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: langEn },
        zh: { translation: langZh },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});

const App = () => {
    const [problem, setProblem] = useState<Problem | undefined>();
    const [canImport, setCanImport] = useState<boolean>(false);
    const [startTime, setStartTime] = useState<number | undefined>();
    useEffect(() => {
        i18n.changeLanguage(language);
        window.onmessage = (e) => {
            const msg = e.data;
            switch (msg.type) {
                case 'problem':
                    setProblem(msg.problem);
                    setCanImport(msg.canImport);
                    setStartTime(msg.startTime);
                    break;
                default:
                    console.error('Unknown message type:', msg.type);
                    break;
            }
        };
        vscode.postMessage({ type: 'getProblem' } as GetProblemMsg);
    }, []);

    const theme = createTheme({
        palette: {
            mode: isDarkMode ? 'dark' : 'light',
        },
    });
    return (
        <ThemeProvider theme={theme}>
            <ErrorBoundary>
                {problem ? (
                    <ProblemView
                        problem={problem}
                        startTime={startTime!}
                    />
                ) : (
                    <CreateProblemView canImport={canImport} />
                )}
            </ErrorBoundary>
        </ThemeProvider>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
