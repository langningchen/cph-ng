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

import type { IWebviewStressTest, ProblemId } from '@cph-ng/core';
import CloseIcon from '@mui/icons-material/Close';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { SrcFileSelect } from '@/components/actions/srcFileSelect';
import { CphNgButton } from '@/components/base/cphNgButton';
import { CphNgFlex } from '@/components/base/cphNgFlex';
import { RunButtonGroup } from '@/components/runButtonGroup';
import { useProblemDispatch } from '@/context/ProblemContext';

interface StressTestDialogProps {
  open: boolean;
  onClose: () => void;
  problemId: ProblemId;
  stressTest: IWebviewStressTest;
}

export const StressTestDialog = memo(
  ({ open, onClose, problemId, stressTest }: StressTestDialogProps) => {
    const { t } = useTranslation();
    const dispatch = useProblemDispatch();

    return (
      <Dialog fullWidth maxWidth={false} open={open} onClose={onClose}>
        <DialogTitle>{t('problemActions.stressTestDialog.title')}</DialogTitle>
        <CphNgButton
          name={t('problemActions.stressTestDialog.close')}
          onClick={onClose}
          sx={(theme) => ({
            position: 'absolute',
            right: 8,
            top: 8,
            color: theme.palette.grey[500],
          })}
          icon={CloseIcon}
        />
        <DialogContent>
          <CphNgFlex column>
            <SrcFileSelect
              label={t('problemActions.stressTestDialog.generator')}
              file={stressTest.generator}
              problemId={problemId}
              fileType='generator'
            />
            <SrcFileSelect
              label={t('problemActions.stressTestDialog.bruteForce')}
              file={stressTest.bruteForce}
              problemId={problemId}
              fileType='bruteForce'
            />
            <CphNgFlex>{stressTest.msg}</CphNgFlex>
            {stressTest.isRunning ? (
              <CphNgButton
                name={t('problemActions.stressTestDialog.stop')}
                onClick={() =>
                  dispatch({
                    type: 'stopStressTest',
                    problemId,
                  })
                }
                icon={StopCircleIcon}
                color='warning'
              />
            ) : (
              <RunButtonGroup
                icon={PlayCircleIcon}
                name={t('problemActions.stressTestDialog.run')}
                color='success'
                disabled={!stressTest.generator || !stressTest.bruteForce}
                onRun={(forceCompile) => {
                  dispatch({ type: 'startStressTest', problemId, forceCompile });
                }}
              />
            )}
          </CphNgFlex>
        </DialogContent>
      </Dialog>
    );
  },
);
