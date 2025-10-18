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
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isRunningVerdict, Problem } from '../../utils/types';
import { basename, getCompile, msg } from '../utils';
import CphFlex from './base/cphFlex';
import CphLink from './base/cphLink';
import CphMenu from './base/cphMenu';
import CphButton from './cphButton';

interface ProblemActionsProps {
    problem: Problem;
}

const ProblemActions = ({ problem }: ProblemActionsProps) => {
    const { t } = useTranslation();
    const [clickTime, setClickTime] = useState<number[]>([]);
    const [isDelDialogOpen, setDelDialogOpen] = useState(false);
    const [isBfCompareDialogOpen, setBfCompareDialogOpen] = useState(false);
    const hasRunning = problem.tcs.some((tc) =>
        isRunningVerdict(tc.result?.verdict),
    );
    useEffect(() => {
        if (clickTime.length == 10 && clickTime.at(-1)! - clickTime[0] < 2000) {
            window.easterEgg = !window.easterEgg;
            setClickTime([]);
        }
    }, [clickTime]);
    return (
        <>
            <Container>
                <CphFlex
                    smallGap
                    onClick={() => {
                        setClickTime((times) => {
                            const now = Date.now();
                            const newTimes = [...times, now];
                            if (newTimes.length > 10) newTimes.shift();
                            return newTimes;
                        });
                    }}
                >
                    <CphButton
                        larger={true}
                        name={t('problemActions.addTc')}
                        icon={AddIcon}
                        onClick={() => {
                            msg({ type: 'addTc' });
                        }}
                    />
                    <CphButton
                        larger={true}
                        name={t('problemActions.loadTcs')}
                        icon={FileCopyIcon}
                        onClick={() => {
                            msg({ type: 'loadTcs' });
                        }}
                    />
                    {hasRunning ? (
                        <CphButton
                            larger={true}
                            name={t('problemActions.stopTcs')}
                            icon={PlaylistRemoveIcon}
                            color={'warning'}
                            onClick={(e) => {
                                msg({
                                    type: 'stopTcs',
                                    onlyOne: e.ctrlKey,
                                });
                            }}
                        />
                    ) : (
                        <CphMenu
                            menu={{
                                [t('problemActions.runTcs.menu.forceCompile')]:
                                    () => {
                                        msg({
                                            type: 'runTcs',
                                            compile: true,
                                        });
                                    },
                                [t('problemActions.runTcs.menu.skipCompile')]:
                                    () => {
                                        msg({
                                            type: 'runTcs',
                                            compile: false,
                                        });
                                    },
                            }}
                        >
                            <CphButton
                                larger={true}
                                name={t('problemActions.runTcs')}
                                icon={PlaylistPlayIcon}
                                color={'success'}
                                onClick={(e) => {
                                    msg({
                                        type: 'runTcs',
                                        compile: getCompile(e),
                                    });
                                }}
                            />
                        </CphMenu>
                    )}
                    <CphButton
                        larger={true}
                        name={t('problemActions.bfCompare')}
                        icon={CompareArrowsIcon}
                        onClick={() => setBfCompareDialogOpen(true)}
                        sx={
                            problem.bfCompare?.running
                                ? {
                                      'animation': 'pulse 1s infinite',
                                      '@keyframes pulse': {
                                          '0%': {
                                              opacity: 1,
                                          },
                                          '50%': {
                                              opacity: 0.2,
                                          },
                                          '100%': {
                                              opacity: 1,
                                          },
                                      },
                                  }
                                : undefined
                        }
                    />
                    {(() => {
                        if (!problem.url) return null;
                        try {
                            if (
                                new URL(problem.url).hostname ===
                                'codeforces.com'
                            ) {
                                return (
                                    <CphButton
                                        larger={true}
                                        name={t(
                                            'problemActions.submitToCodeforces',
                                        )}
                                        icon={BackupIcon}
                                        color={'success'}
                                        onClick={() => {
                                            msg({
                                                type: 'submitToCodeforces',
                                            });
                                        }}
                                    />
                                );
                            }
                        } catch {}
                        return null;
                    })()}
                    <CphButton
                        larger={true}
                        name={t('problemActions.deleteProblem')}
                        icon={DeleteForeverIcon}
                        color={'error'}
                        onClick={() => setDelDialogOpen(true)}
                    />
                    {window.easterEgg && (
                        <div title={t('problemActions.easterEgg')}>🐰</div>
                    )}
                </CphFlex>
            </Container>
            <Dialog
                open={isDelDialogOpen}
                onClose={() => setDelDialogOpen(false)}
            >
                <DialogTitle>{t('problemActions.delDialog.title')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('problemActions.delDialog.content')}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDelDialogOpen(false)}
                        color={'primary'}
                    >
                        {t('problemActions.delDialog.cancel')}
                    </Button>
                    <Button
                        onClick={() => {
                            msg({
                                type: 'delProblem',
                            });
                            setDelDialogOpen(false);
                        }}
                        color={'primary'}
                        autoFocus
                    >
                        {t('problemActions.delDialog.confirm')}
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog
                fullWidth
                maxWidth='lg'
                open={isBfCompareDialogOpen}
                onClose={() => setBfCompareDialogOpen(false)}
            >
                <DialogTitle>
                    {t('problemActions.bfCompareDialog.title')}
                </DialogTitle>
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
                            <Typography>
                                {t('problemActions.bfCompareDialog.generator')}
                            </Typography>
                            {problem.bfCompare?.generator ? (
                                <>
                                    <CphLink
                                        name={problem.bfCompare.generator.path}
                                        onClick={() => {
                                            msg({
                                                type: 'openFile',
                                                path: problem.bfCompare!
                                                    .generator!.path,
                                            });
                                        }}
                                    >
                                        {basename(
                                            problem.bfCompare.generator.path,
                                        )}
                                    </CphLink>
                                    <CphButton
                                        icon={CloseIcon}
                                        onClick={() => {
                                            msg({
                                                type: 'removeSrcFile',
                                                fileType: 'generator',
                                            });
                                        }}
                                        name={t(
                                            'problemActions.bfCompareDialog.button.removeGenerator',
                                        )}
                                    />
                                </>
                            ) : (
                                <CphButton
                                    icon={FileOpenIcon}
                                    onClick={() => {
                                        msg({
                                            type: 'chooseSrcFile',
                                            fileType: 'generator',
                                        });
                                    }}
                                    name={t(
                                        'problemActions.bfCompareDialog.button.chooseGenerator',
                                    )}
                                />
                            )}
                        </CphFlex>
                        <CphFlex>
                            <Typography>
                                {t('problemActions.bfCompareDialog.bruteForce')}
                            </Typography>
                            {problem.bfCompare?.bruteForce ? (
                                <>
                                    <CphLink
                                        name={problem.bfCompare.bruteForce.path}
                                        onClick={() => {
                                            msg({
                                                type: 'openFile',
                                                path: problem.bfCompare!
                                                    .bruteForce!.path,
                                            });
                                        }}
                                    >
                                        {basename(
                                            problem.bfCompare.bruteForce.path,
                                        )}
                                    </CphLink>
                                    <CphButton
                                        icon={CloseIcon}
                                        onClick={() => {
                                            msg({
                                                type: 'removeSrcFile',
                                                fileType: 'bruteForce',
                                            });
                                        }}
                                        name={t(
                                            'problemActions.bfCompareDialog.button.removeBruteForce',
                                        )}
                                    />
                                </>
                            ) : (
                                <CphButton
                                    icon={FileOpenIcon}
                                    onClick={() => {
                                        msg({
                                            type: 'chooseSrcFile',
                                            fileType: 'bruteForce',
                                        });
                                    }}
                                    name={t(
                                        'problemActions.bfCompareDialog.button.chooseBruteForce',
                                    )}
                                />
                            )}
                        </CphFlex>
                        <CphFlex>{problem.bfCompare?.msg}</CphFlex>
                        {problem.bfCompare?.running ? (
                            <CphButton
                                name={t('problemActions.bfCompareDialog.stop')}
                                onClick={() => {
                                    msg({
                                        type: 'stopBfCompare',
                                    });
                                }}
                                icon={StopCircleIcon}
                                color={'warning'}
                            />
                        ) : (
                            <CphButton
                                name={t('problemActions.bfCompareDialog.run')}
                                onClick={(e) => {
                                    msg({
                                        type: 'startBfCompare',
                                        compile: getCompile(e),
                                    });
                                }}
                                icon={PlayCircleIcon}
                                color={'success'}
                                disabled={
                                    !problem.bfCompare?.generator ||
                                    !problem.bfCompare?.bruteForce
                                }
                            />
                        )}
                    </CphFlex>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ProblemActions;
