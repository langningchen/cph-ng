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
import { BackgroundProblemView } from '@w/components/actions/backgroundProblemView';
import { DeleteProblemDialog } from '@w/components/actions/deleteProblemDialog';
import { StressTestDialog } from '@w/components/actions/stressTestDialog';
import { SubmitDialog } from '@w/components/actions/submitDialog';
import { HelpButton } from '@w/components/actions/support';
import { CphNgButton } from '@w/components/base/cphNgButton';
import { CphNgFlex } from '@w/components/base/cphNgFlex';
import { RunButtonGroup } from '@w/components/runButtonGroup';
import { useConfigState } from '@w/context/ConfigContext';
import { useProblemDispatch } from '@w/context/ProblemContext';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
    const dispatch = useProblemDispatch();
    const [clickTime, setClickTime] = useState<number[]>([]);
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isSubmitDialogOpen, setSubmitDialogOpen] = useState(false);
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
                onClick={() =>
                  config.confirmSubmit
                    ? setSubmitDialogOpen(true)
                    : dispatch({ type: 'submit', problemId })
                }
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
          open={isSubmitDialogOpen}
          onClose={() => setSubmitDialogOpen(false)}
          onConfirm={() => {
            dispatch({ type: 'submit', problemId });
            setSubmitDialogOpen(false);
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
