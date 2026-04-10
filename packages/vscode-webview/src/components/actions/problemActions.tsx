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

import type { IWebviewBackgroundProblem, IWebviewStressTest, ProblemId } from '@cph-ng/core';
import BackupIcon from '@mui/icons-material/Backup';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import PlaylistRemoveIcon from '@mui/icons-material/PlaylistRemove';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackgroundProblemView } from '@/components/actions/backgroundProblemView';
import { DeleteProblemDialog } from '@/components/actions/deleteProblemDialog';
import { StressTestDialog } from '@/components/actions/stressTestDialog';
import { SubmitDialog } from '@/components/actions/submitDialog';
import { HelpButton } from '@/components/actions/support';
import { CphNgButton } from '@/components/base/cphNgButton';
import { CphNgFlex } from '@/components/base/cphNgFlex';
import { RunButtonGroup } from '@/components/runButtonGroup';
import { useConfigState } from '@/context/ConfigContext';
import {
  useProblemDispatch,
  useProblemState,
  useProblemUiDispatch,
} from '@/context/ProblemContext';

interface ProblemActionsProps {
  problemId: ProblemId;
  url: string | null;
  stressTest: IWebviewStressTest;
  hasRunning: boolean;
  backgroundProblems: IWebviewBackgroundProblem[];
}

export const ProblemActions = memo(
  ({ problemId, url, stressTest, hasRunning, backgroundProblems }: ProblemActionsProps) => {
    const { t } = useTranslation();
    const { config } = useConfigState();
    const { submitDialogProblemId } = useProblemState();
    const dispatch = useProblemDispatch();
    const uiDispatch = useProblemUiDispatch();
    const [clickTime, setClickTime] = useState<number[]>([]);
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isStressTestDialogOpen, setStressTestDialogOpen] = useState(false);

    useEffect(() => {
      if (clickTime.length === 10 && clickTime[9] - clickTime[0] < 2000) {
        window.easterEgg = !window.easterEgg;
        setClickTime([]);
      }
    }, [clickTime]);
    return (
      <>
        <CphNgFlex
          smallGap
          justifyContent='center'
          onClick={() => setClickTime((times) => [...times, Date.now()].slice(-10))}
        >
          <HelpButton />
          <CphNgFlex flex={1} smallGap flexWrap='wrap' justifyContent='center'>
            {hasRunning ? (
              <CphNgButton
                larger
                name={t('problemActions.stopTestcases')}
                icon={PlaylistRemoveIcon}
                color='warning'
                onClick={() =>
                  dispatch({
                    type: 'stopTestcases',
                    problemId,
                  })
                }
              />
            ) : (
              <RunButtonGroup
                larger
                icon={PlaylistPlayIcon}
                name={t('problemActions.runAllTestcases')}
                color='success'
                onRun={(forceCompile) =>
                  dispatch({ type: 'runAllTestcases', problemId, forceCompile })
                }
              />
            )}
            <CphNgButton
              larger
              name={t('problemActions.stressTest')}
              icon={CompareArrowsIcon}
              onClick={() => setStressTestDialogOpen(true)}
              sx={{
                display: { xs: 'none', sm: 'block' },
                animation: stressTest.isRunning ? 'pulse 1s infinite' : undefined,
              }}
            />
            {!!url && (
              <CphNgButton
                larger
                name={t('problemActions.submit')}
                icon={BackupIcon}
                color='secondary'
                onClick={() => {
                  if (config.confirmSubmit) uiDispatch({ type: 'openSubmitDialog', problemId });
                  else dispatch({ type: 'submit', problemId });
                }}
              />
            )}
            <CphNgButton
              sx={{ display: { xs: 'none', sm: 'block' } }}
              larger
              name={t('problemActions.deleteProblem')}
              icon={DeleteForeverIcon}
              color='error'
              onClick={() => setDeleteDialogOpen(true)}
            />
            {!!window.easterEgg && <div title={t('problemActions.easterEgg')}>🐰</div>}
          </CphNgFlex>
          <BackgroundProblemView backgroundProblems={backgroundProblems} />
        </CphNgFlex>

        <DeleteProblemDialog
          open={isDeleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={() => {
            dispatch({ type: 'deleteProblem', problemId });
            setDeleteDialogOpen(false);
          }}
        />

        <SubmitDialog
          open={submitDialogProblemId === problemId}
          onClose={() => uiDispatch({ type: 'closeSubmitDialog' })}
          onConfirm={() => {
            dispatch({ type: 'submit', problemId });
            uiDispatch({ type: 'closeSubmitDialog' });
          }}
        />

        <StressTestDialog
          open={isStressTestDialogOpen}
          onClose={() => setStressTestDialogOpen(false)}
          problemId={problemId}
          stressTest={stressTest}
        />
      </>
    );
  },
);
