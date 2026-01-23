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

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IWebviewBackgroundProblem } from '@/domain/webviewTypes';
import { useProblemContext } from '@/webview/src/context/ProblemContext';
import { CphFlex } from './base/cphFlex';
import { CphLink } from './base/cphLink';
import { CphText } from './base/cphText';

interface BgProblemViewProps {
  bgProblems: IWebviewBackgroundProblem[];
}

export const BgProblemView = ({ bgProblems }: BgProblemViewProps) => {
  const { t } = useTranslation();
  const { dispatch } = useProblemContext();
  const [open, setOpen] = useState(false);

  return (
    <>
      <CphText
        sx={{ cursor: 'pointer' }}
        fontSize='smaller'
        onClick={() => {
          setOpen(true);
        }}
      >
        {t('bgProblemView.message', {
          cnt: bgProblems.length,
        })}
      </CphText>
      <Dialog
        fullWidth
        maxWidth={false}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        <DialogTitle>{t('bgProblemView.title')}</DialogTitle>
        <DialogContent>
          {bgProblems.length ? (
            <CphFlex>
              {bgProblems.map((bgProblem) => (
                <CphLink
                  key={bgProblem.srcPath}
                  name={bgProblem.srcPath}
                  onClick={() => {
                    dispatch({
                      type: 'openFile',
                      path: bgProblem.srcPath,
                    });
                    setOpen(false);
                  }}
                >
                  {bgProblem.name}
                </CphLink>
              ))}
            </CphFlex>
          ) : (
            <CphText>{t('bgProblemView.empty')}</CphText>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
