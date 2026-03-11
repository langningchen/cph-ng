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
import { CphNgFlex } from '@w/components/base/cphNgFlex';
import { CphNgLink } from '@w/components/base/cphNgLink';
import { CphNgText } from '@w/components/base/cphNgText';
import { useProblemDispatch } from '@w/context/ProblemContext';
import type { IWebviewBackgroundProblem } from '@w/types';
import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BgProblemViewProps {
  bgProblems: IWebviewBackgroundProblem[];
}

export const BgProblemView = memo(({ bgProblems }: BgProblemViewProps) => {
  const { t } = useTranslation();
  const dispatch = useProblemDispatch();
  const [open, setOpen] = useState(false);

  if (bgProblems.length === 0) return null;

  return (
    <>
      <CphNgText
        sx={{ cursor: 'pointer' }}
        fontSize='smaller'
        onClick={() => {
          setOpen(true);
        }}
      >
        {t('bgProblemView.message', {
          cnt: bgProblems.length,
        })}
      </CphNgText>
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
            <CphNgFlex>
              {bgProblems.map((bgProblem) => (
                <CphNgLink
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
                </CphNgLink>
              ))}
            </CphNgFlex>
          ) : (
            <CphNgText>{t('bgProblemView.empty')}</CphNgText>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});
