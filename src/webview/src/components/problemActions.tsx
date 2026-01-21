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

import type { UUID } from 'node:crypto';
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
import type { IWebviewBfCompare } from '@/domain/webviewTypes';
import { useProblemContext } from '../context/ProblemContext';
import { getCompile } from '../utils';
import { CphFlex } from './base/cphFlex';
import { CphLink } from './base/cphLink';
import { CphMenu } from './base/cphMenu';
import { CphButton } from './cphButton';

interface ProblemActionsProps {
  problemId: UUID;
  url?: string;
  bfCompare: IWebviewBfCompare;
  hasRunning: boolean;
}

export const ProblemActions = memo(
  ({ problemId, url, bfCompare, hasRunning }: ProblemActionsProps) => {
    const { t } = useTranslation();
    const { dispatch } = useProblemContext();
    const [clickTime, setClickTime] = useState<number[]>([]);
    const [isDelDialogOpen, setDelDialogOpen] = useState(false);
    const [isBfCompareDialogOpen, setBfCompareDialogOpen] = useState(false);

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
          onClick={() => setClickTime((times) => [...times, Date.now()].slice(-10))}
        >
          <CphButton
            larger
            name={t('problemActions.addTc')}
            icon={AddIcon}
            onClick={() => dispatch({ type: 'addTc', problemId })}
          />
          <CphButton
            larger
            name={t('problemActions.loadTcs')}
            icon={FileCopyIcon}
            onClick={() => dispatch({ type: 'loadTcs', problemId })}
          />

          {hasRunning ? (
            <CphButton
              larger
              name={t('problemActions.stopTcs')}
              icon={PlaylistRemoveIcon}
              color='warning'
              onClick={(e) =>
                dispatch({
                  type: 'stopTcs',
                  problemId,
                  onlyOne: e.ctrlKey,
                })
              }
            />
          ) : (
            <CphMenu
              menu={{
                [t('problemActions.runTcs.menu.forceCompile')]: () =>
                  dispatch({
                    type: 'runTcs',
                    problemId,
                    forceCompile: true,
                  }),
                [t('problemActions.runTcs.menu.skipCompile')]: () =>
                  dispatch({
                    type: 'runTcs',
                    problemId,
                    forceCompile: false,
                  }),
              }}
            >
              <CphButton
                larger
                name={t('problemActions.runTcs')}
                icon={PlaylistPlayIcon}
                color='success'
                onClick={(e) =>
                  dispatch({
                    type: 'runTcs',
                    problemId,
                    forceCompile: getCompile(e),
                  })
                }
              />
            </CphMenu>
          )}
          <CphButton
            larger
            name={t('problemActions.bfCompare')}
            icon={CompareArrowsIcon}
            onClick={() => setBfCompareDialogOpen(true)}
            sx={bfCompare.isRunning ? pulseAnimation : undefined}
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
            onClick={() => setDelDialogOpen(true)}
          />
          {window.easterEgg && <div title={t('problemActions.easterEgg')}>🐰</div>}
        </CphFlex>
        <Dialog
          fullWidth
          maxWidth={false}
          open={isDelDialogOpen}
          onClose={() => setDelDialogOpen(false)}
        >
          <DialogTitle>{t('problemActions.delDialog.title')}</DialogTitle>
          <DialogContent>
            <DialogContentText>{t('problemActions.delDialog.content')}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDelDialogOpen(false)} color='primary'>
              {t('problemActions.delDialog.cancel')}
            </Button>
            <Button
              onClick={() => {
                dispatch({
                  type: 'delProblem',
                  problemId,
                });
                setDelDialogOpen(false);
              }}
              color='primary'
              autoFocus
            >
              {t('problemActions.delDialog.confirm')}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          fullWidth
          maxWidth={false}
          open={isBfCompareDialogOpen}
          onClose={() => setBfCompareDialogOpen(false)}
        >
          <DialogTitle>{t('problemActions.bfCompareDialog.title')}</DialogTitle>
          <CphButton
            name={t('problemActions.bfCompareDialog.close')}
            onClick={() => setBfCompareDialogOpen(false)}
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
                <Typography>{t('problemActions.bfCompareDialog.generator')}</Typography>
                {bfCompare.generator ? (
                  <>
                    <CphLink
                      name={bfCompare.generator.path}
                      onClick={() => {
                        if (bfCompare.generator)
                          dispatch({
                            type: 'openFile',
                            path: bfCompare.generator.path,
                          });
                      }}
                    >
                      {bfCompare.generator.base}
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
                      name={t('problemActions.bfCompareDialog.button.removeGenerator')}
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
                    name={t('problemActions.bfCompareDialog.button.chooseGenerator')}
                  />
                )}
              </CphFlex>
              <CphFlex>
                <Typography>{t('problemActions.bfCompareDialog.bruteForce')}</Typography>
                {bfCompare.bruteForce ? (
                  <>
                    <CphLink
                      name={bfCompare.bruteForce.path}
                      onClick={() => {
                        if (bfCompare.bruteForce)
                          dispatch({
                            type: 'openFile',
                            path: bfCompare.bruteForce.path,
                          });
                      }}
                    >
                      {bfCompare.bruteForce.base}
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
                      name={t('problemActions.bfCompareDialog.button.removeBruteForce')}
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
                    name={t('problemActions.bfCompareDialog.button.chooseBruteForce')}
                  />
                )}
              </CphFlex>
              <CphFlex>{bfCompare.msg}</CphFlex>
              {bfCompare.isRunning ? (
                <CphButton
                  name={t('problemActions.bfCompareDialog.stop')}
                  onClick={() =>
                    dispatch({
                      type: 'stopBfCompare',
                      problemId,
                    })
                  }
                  icon={StopCircleIcon}
                  color='warning'
                />
              ) : (
                <CphButton
                  name={t('problemActions.bfCompareDialog.run')}
                  onClick={(e) => {
                    dispatch({
                      type: 'startBfCompare',
                      problemId,
                      forceCompile: getCompile(e),
                    });
                  }}
                  icon={PlayCircleIcon}
                  color='success'
                  disabled={!bfCompare.generator || !bfCompare.bruteForce}
                />
              )}
            </CphFlex>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

const pulseAnimation = {
  animation: 'pulse 1s infinite',
  '@keyframes pulse': {
    '0%': { opacity: 1 },
    '50%': { opacity: 0.2 },
    '100%': { opacity: 1 },
  },
};
