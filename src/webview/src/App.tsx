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

import { createTheme, ThemeProvider } from '@mui/material/styles';
import i18n from 'i18next';
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { initReactI18next } from 'react-i18next';
import { CphFlex } from './components/base/cphFlex';
import { ErrorBoundary } from './components/base/errorBoundary';
import { BgProblemView } from './components/bgProblemView';
import { CreateProblemView } from './components/createProblemView';
import { DragOverlay } from './components/dragOverlay';
import { InitView } from './components/initView';
import { ProblemView } from './components/problemView';
import { ProblemProvider, useProblemContext } from './context/ProblemContext';
import langEn from './l10n/en.json';
import langZh from './l10n/zh.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: langEn },
    zh: { translation: langZh },
  },
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

const Main = () => {
  const { state } = useProblemContext();

  return (
    <>
      <ErrorBoundary>
        <DragOverlay />
      </ErrorBoundary>
      <ErrorBoundary>
        <CphFlex
          column
          smallGap
          height='100%'
          sx={{
            boxSizing: 'border-box',
          }}
          padding={1}
        >
          {state.isInitialized ? (
            <>
              {state.currentProblem.type === 'active' ? (
                <ProblemView {...state.currentProblem} />
              ) : (
                <CreateProblemView canImport={state.currentProblem.canImport} />
              )}
              <BgProblemView bgProblems={state.backgroundProblems} />
            </>
          ) : (
            <InitView />
          )}
        </CphFlex>
      </ErrorBoundary>
    </>
  );
};

const App = () => {
  useEffect(() => {
    i18n.changeLanguage(language);
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
      <ProblemProvider>
        <Main />
      </ProblemProvider>
    </ThemeProvider>
  );
};

const element = document.getElementById('root');
if (element) createRoot(element).render(<App />);
