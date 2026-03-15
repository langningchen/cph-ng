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

import type { ProblemId } from '@cph-ng/core';
import BackupIcon from '@mui/icons-material/Backup';
import CloseIcon from '@mui/icons-material/Close';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import PlaylistRemoveIcon from '@mui/icons-material/PlaylistRemove';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { BackgroundProblemView } from '@w/components/backggroundProblemView';
import { CphNgButton } from '@w/components/base/cphNgButton';
import { CphNgFlex } from '@w/components/base/cphNgFlex';
import { CphNgLink } from '@w/components/base/cphNgLink';
import { RunButtonGroup } from '@w/components/runButtonGroup';
import { useProblemDispatch } from '@w/context/ProblemContext';
import type { IWebviewBackgroundProblem, IWebviewStressTest } from '@w/types';
import React, { memo, useEffect, useState } from 'react';
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
    const dispatch = useProblemDispatch();
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
              sx={stressTest.isRunning ? { animation: 'pulse 1s infinite' } : undefined}
            />
            {!!url && (
              <CphNgButton
                larger
                name={t('problemActions.submit')}
                icon={BackupIcon}
                color='secondary'
                onClick={() => dispatch({ type: 'submitToCodeforces', problemId })}
              />
            )}
            <CphNgButton
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
        <Dialog
          fullWidth
          maxWidth={false}
          open={isDeleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>{t('problemActions.deleteDialog.title')}</DialogTitle>
          <DialogContent>
            <DialogContentText>{t('problemActions.deleteDialog.content')}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} color='primary'>
              {t('problemActions.deleteDialog.cancel')}
            </Button>
            <Button
              onClick={() => {
                dispatch({
                  type: 'deleteProblem',
                  problemId,
                });
                setDeleteDialogOpen(false);
              }}
              color='primary'
              autoFocus
            >
              {t('problemActions.deleteDialog.confirm')}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          fullWidth
          maxWidth={false}
          open={isStressTestDialogOpen}
          onClose={() => setStressTestDialogOpen(false)}
        >
          <DialogTitle>{t('problemActions.stressTestDialog.title')}</DialogTitle>
          <CphNgButton
            name={t('problemActions.stressTestDialog.close')}
            onClick={() => setStressTestDialogOpen(false)}
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
              <CphNgFlex>
                <Typography>{t('problemActions.stressTestDialog.generator')}</Typography>
                {stressTest.generator ? (
                  <>
                    <CphNgLink
                      name={stressTest.generator.path}
                      onClick={() => {
                        if (stressTest.generator)
                          dispatch({
                            type: 'openFile',
                            path: stressTest.generator.path,
                          });
                      }}
                    >
                      {stressTest.generator.base}
                    </CphNgLink>
                    <CphNgButton
                      icon={CloseIcon}
                      onClick={() =>
                        dispatch({
                          type: 'removeSrcFile',
                          problemId,
                          fileType: 'generator',
                        })
                      }
                      name={t('problemActions.stressTestDialog.button.removeGenerator')}
                    />
                  </>
                ) : (
                  <CphNgButton
                    icon={FileOpenIcon}
                    onClick={() =>
                      dispatch({
                        type: 'chooseSrcFile',
                        problemId,
                        fileType: 'generator',
                      })
                    }
                    name={t('problemActions.stressTestDialog.button.chooseGenerator')}
                  />
                )}
              </CphNgFlex>
              <CphNgFlex>
                <Typography>{t('problemActions.stressTestDialog.bruteForce')}</Typography>
                {stressTest.bruteForce ? (
                  <>
                    <CphNgLink
                      name={stressTest.bruteForce.path}
                      onClick={() => {
                        if (stressTest.bruteForce)
                          dispatch({
                            type: 'openFile',
                            path: stressTest.bruteForce.path,
                          });
                      }}
                    >
                      {stressTest.bruteForce.base}
                    </CphNgLink>
                    <CphNgButton
                      icon={CloseIcon}
                      onClick={() =>
                        dispatch({
                          type: 'removeSrcFile',
                          problemId,
                          fileType: 'bruteForce',
                        })
                      }
                      name={t('problemActions.stressTestDialog.button.removeBruteForce')}
                    />
                  </>
                ) : (
                  <CphNgButton
                    icon={FileOpenIcon}
                    onClick={() =>
                      dispatch({
                        type: 'chooseSrcFile',
                        problemId,
                        fileType: 'bruteForce',
                      })
                    }
                    name={t('problemActions.stressTestDialog.button.chooseBruteForce')}
                  />
                )}
              </CphNgFlex>
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
      </>
    );
  },
);
