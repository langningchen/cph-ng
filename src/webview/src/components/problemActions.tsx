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

import AddIcon from '@mui/icons-material/Add';
import BackupIcon from '@mui/icons-material/Backup';
import CloseIcon from '@mui/icons-material/Close';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import FileCopyIcon from '@mui/icons-material/FileCopy';
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
import React, { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProblemId } from '@/domain/types';
import type { IWebviewStressTest } from '@/domain/webviewTypes';
import { useProblemContext } from '../context/ProblemContext';
import { getCompile } from '../utils';
import { CphFlex } from './base/cphFlex';
import { CphLink } from './base/cphLink';
import { CphMenu } from './base/cphMenu';
import { CphButton } from './cphButton';

interface ProblemActionsProps {
  problemId: ProblemId;
  url?: string;
  stressTest: IWebviewStressTest;
  hasRunning: boolean;
}

export const ProblemActions = memo(
  ({ problemId, url, stressTest, hasRunning }: ProblemActionsProps) => {
    const { t } = useTranslation();
    const { dispatch } = useProblemContext();
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
        <CphFlex
          smallGap
          flexWrap='wrap'
          justifyContent='center'
          onClick={() => setClickTime((times) => [...times, Date.now()].slice(-10))}
        >
          <CphButton
            larger
            name={t('problemActions.addTestcase')}
            icon={AddIcon}
            onClick={() => dispatch({ type: 'addTestcase', problemId })}
          />
          <CphButton
            larger
            name={t('problemActions.loadTestcases')}
            icon={FileCopyIcon}
            onClick={() => dispatch({ type: 'loadTestcases', problemId })}
          />

          {hasRunning ? (
            <CphButton
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
            <CphMenu
              menu={{
                [t('problemActions.runTestcases.menu.forceCompile')]: () =>
                  dispatch({
                    type: 'runTestcases',
                    problemId,
                    forceCompile: true,
                  }),
                [t('problemActions.runTestcases.menu.skipCompile')]: () =>
                  dispatch({
                    type: 'runTestcases',
                    problemId,
                    forceCompile: false,
                  }),
              }}
            >
              <CphButton
                larger
                name={`${t('problemActions.runTestcases')} (Ctrl: ${t('problemActions.runTestcases.forceCompile')}, Alt: ${t('problemActions.runTestcases.skipCompile')})`}
                icon={PlaylistPlayIcon}
                color='success'
                onClick={(e) =>
                  dispatch({
                    type: 'runTestcases',
                    problemId,
                    forceCompile: getCompile(e),
                  })
                }
              />
            </CphMenu>
          )}
          <CphButton
            larger
            name={t('problemActions.stressTest')}
            icon={CompareArrowsIcon}
            onClick={() => setStressTestDialogOpen(true)}
            sx={stressTest.isRunning ? { animation: 'pulse 1s infinite' } : undefined}
          />
          {(() => {
            if (!url) {
              return null;
            }
            try {
              if (new URL(url).hostname === 'codeforces.com') {
                return (
                  <CphButton
                    larger
                    name={t('problemActions.submitToCodeforces')}
                    icon={BackupIcon}
                    color='success'
                    onClick={() =>
                      dispatch({
                        type: 'submitToCodeforces',
                        problemId,
                      })
                    }
                  />
                );
              }
            } catch {}
            return null;
          })()}
          <CphButton
            larger
            name={t('problemActions.deleteProblem')}
            icon={DeleteForeverIcon}
            color='error'
            onClick={() => setDeleteDialogOpen(true)}
          />
          {!!window.easterEgg && <div title={t('problemActions.easterEgg')}>🐰</div>}
        </CphFlex>
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
          <CphButton
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
            <CphFlex column>
              <CphFlex>
                <Typography>{t('problemActions.stressTestDialog.generator')}</Typography>
                {stressTest.generator ? (
                  <>
                    <CphLink
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
                    </CphLink>
                    <CphButton
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
                  <CphButton
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
              </CphFlex>
              <CphFlex>
                <Typography>{t('problemActions.stressTestDialog.bruteForce')}</Typography>
                {stressTest.bruteForce ? (
                  <>
                    <CphLink
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
                    </CphLink>
                    <CphButton
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
                  <CphButton
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
              </CphFlex>
              <CphFlex>{stressTest.msg}</CphFlex>
              {stressTest.isRunning ? (
                <CphButton
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
                <CphButton
                  name={t('problemActions.stressTestDialog.run')}
                  onClick={(e) => {
                    dispatch({
                      type: 'startStressTest',
                      problemId,
                      forceCompile: getCompile(e),
                    });
                  }}
                  icon={PlayCircleIcon}
                  color='success'
                  disabled={!stressTest.generator || !stressTest.bruteForce}
                />
              )}
            </CphFlex>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);
