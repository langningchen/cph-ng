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

import { IProblem } from '@/types/types';
import EditIcon from '@mui/icons-material/Edit';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import React, { SyntheticEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { msg } from '../utils';
import CphFlex from './base/cphFlex';
import CphLink from './base/cphLink';
import CphMenu from './base/cphMenu';
import CphText from './base/cphText';
import CphButton from './cphButton';

interface ProblemTitleProps {
  problem: IProblem;
  startTime: number;
}

const formatDuration = (ms: number) => {
  const totalSec = Math.floor(ms / 1000);
  const hh = Math.floor(totalSec / 3600)
    .toString()
    .padStart(2, '0');
  const mm = Math.floor((totalSec % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const ProblemTitle = ({ problem, startTime }: ProblemTitleProps) => {
  const { t } = useTranslation();
  const [isHoveringTitle, setHoveringTitle] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [tabValue, setTabValue] = useState('basic');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedUrl, setEditedUrl] = useState('');
  const [editedTimeLimit, setEditedTimeLimit] = useState('');
  const [editedMemoryLimit, setEditedMemoryLimit] = useState('');
  const [editedCompiler, setEditedCompiler] = useState('');
  const [editedCompilerArgs, setEditedCompilerArgs] = useState('');
  const [editedRunner, setEditedRunner] = useState('');
  const [editedRunnerArgs, setEditedRunnerArgs] = useState('');
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    setEditedTitle(problem.name);
    setEditedUrl(problem.url || '');
    setEditedTimeLimit(problem.timeLimit.toString());
    setEditedMemoryLimit(problem.memoryLimit.toString());
    setEditedCompiler(problem.compilationSettings?.compiler || '');
    setEditedCompilerArgs(problem.compilationSettings?.compilerArgs || '');
    setEditedRunner(problem.compilationSettings?.runner || '');
    setEditedRunnerArgs(problem.compilationSettings?.runnerArgs || '');
  }, [
    problem.name,
    problem.url,
    problem.timeLimit,
    problem.memoryLimit,
    problem.compilationSettings,
  ]);
  useEffect(() => {
    setTimeElapsed(Date.now() - startTime);
    const interval = setInterval(() => {
      setTimeElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const handleEditTitle = () => {
    setEditDialogOpen(true);
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    const compilationSettings =
      editedCompiler || editedCompilerArgs || editedRunner || editedRunnerArgs
        ? {
            compiler: editedCompiler || undefined,
            compilerArgs: editedCompilerArgs || undefined,
            runner: editedRunner || undefined,
            runnerArgs: editedRunnerArgs || undefined,
          }
        : undefined;
    msg({
      type: 'editProblemDetails',
      title: editedTitle,
      url: editedUrl,
      timeLimit: parseInt(editedTimeLimit),
      memoryLimit: parseInt(editedMemoryLimit),
      compilationSettings,
    });
  };

  return (
    <>
      <CphFlex
        onMouseEnter={() => setHoveringTitle(true)}
        onMouseLeave={() => setHoveringTitle(false)}
      >
        <CphFlex
          column
          alignStart
          flexShrink={1}
          width={'unset'}
        >
          <CphText
            whiteSpace={'nowrap'}
            sx={{ cursor: problem.url ? 'pointer' : 'default' }}
            title={problem.name}
            width={'100%'}
          >
            {problem.url ? (
              <CphLink
                href={problem.url}
                name={problem.url}
              >
                {problem.name}
              </CphLink>
            ) : (
              problem.name
            )}
          </CphText>
          <CphText
            fontSize={'0.8rem'}
            paddingRight={'4px'}
          >
            {t('problemTitle.timeLimit', {
              time: problem.timeLimit,
            })}
            &emsp;
            {t('problemTitle.memoryLimit', {
              memory: problem.memoryLimit,
            })}
            {problem.checker && (
              <>
                &emsp;
                <CphLink
                  name={problem.checker.path!}
                  onClick={() => {
                    msg({
                      type: 'openFile',
                      path: problem.checker!.path,
                    });
                  }}
                >
                  {t('problemTitle.specialJudge')}
                </CphLink>
              </>
            )}
            {problem.interactor && (
              <>
                &emsp;
                <CphLink
                  name={problem.interactor.path!}
                  onClick={() => {
                    msg({
                      type: 'openFile',
                      path: problem.interactor!.path,
                    });
                  }}
                >
                  {t('problemTitle.interact')}
                </CphLink>
              </>
            )}
            &emsp;
            <span
              title={t('problemTitle.timeElapsed')}
              className='defaultBlur'
            >
              {formatDuration(problem.timeElapsed + timeElapsed)}
            </span>
          </CphText>
        </CphFlex>
        {isHoveringTitle && (
          <CphMenu
            menu={{
              [t('problemTitle.menu.editRaw')]: () => {
                msg({
                  type: 'openFile',
                  path: '/problem.cph-ng.json',
                  isVirtual: true,
                });
              },
            }}
          >
            <CphButton
              name={t('problemTitle.editTitle')}
              icon={EditIcon}
              color={'secondary'}
              onClick={handleEditTitle}
            />
          </CphMenu>
        )}
      </CphFlex>
      <Dialog
        fullScreen
        open={isEditDialogOpen}
        onClose={handleEditDialogClose}
      >
        <DialogTitle>{t('problemTitle.dialog.title')}</DialogTitle>
        <DialogContent>
          <TabContext value={tabValue}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <TabList
                variant='scrollable'
                scrollButtons='auto'
                onChange={(_event: SyntheticEvent, value: string) =>
                  setTabValue(value)
                }
              >
                <Tab
                  label={t('problemTitle.dialog.tab.basic')}
                  value='basic'
                />
                <Tab
                  label={t('problemTitle.dialog.tab.environment')}
                  value='environment'
                />
                <Tab
                  label={t('problemTitle.dialog.tab.advanced')}
                  value='advanced'
                />
              </TabList>
            </Box>
            <TabPanel
              value='basic'
              sx={{ padding: '0' }}
            >
              <TextField
                variant={'outlined'}
                margin={'normal'}
                label={t('problemTitle.dialog.field.title')}
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                fullWidth
                autoFocus
              />
              <TextField
                variant={'outlined'}
                margin={'normal'}
                label={t('problemTitle.dialog.field.url')}
                value={editedUrl}
                onChange={(e) => setEditedUrl(e.target.value)}
                fullWidth
              />
              <TextField
                variant={'outlined'}
                margin={'normal'}
                label={t('problemTitle.dialog.field.time')}
                value={editedTimeLimit}
                onChange={(e) => setEditedTimeLimit(e.target.value)}
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position='end'>ms</InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                variant={'outlined'}
                margin={'normal'}
                label={t('problemTitle.dialog.field.memory')}
                value={editedMemoryLimit}
                onChange={(e) => setEditedMemoryLimit(e.target.value)}
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position='end'>MB</InputAdornment>
                    ),
                  },
                }}
              />
            </TabPanel>
            <TabPanel
              value='environment'
              sx={{ padding: '0' }}
            >
              <TextField
                variant={'outlined'}
                margin={'normal'}
                label={t('problemTitle.dialog.field.compiler')}
                value={editedCompiler}
                onChange={(e) => setEditedCompiler(e.target.value)}
                fullWidth
              />
              <TextField
                variant={'outlined'}
                margin={'normal'}
                label={t('problemTitle.dialog.field.compilerArgs')}
                value={editedCompilerArgs}
                onChange={(e) => setEditedCompilerArgs(e.target.value)}
                fullWidth
              />
              <TextField
                variant={'outlined'}
                margin={'normal'}
                label={t('problemTitle.dialog.field.runner')}
                value={editedRunner}
                onChange={(e) => setEditedRunner(e.target.value)}
                fullWidth
              />
              <TextField
                variant={'outlined'}
                margin={'normal'}
                label={t('problemTitle.dialog.field.runnerArgs')}
                value={editedRunnerArgs}
                onChange={(e) => setEditedRunnerArgs(e.target.value)}
                fullWidth
              />
            </TabPanel>
            <TabPanel
              value='advanced'
              sx={{ padding: '0' }}
            >
              <CphFlex
                flexWrap={'wrap'}
                py={2}
              >
                {problem.checker ? (
                  <Chip
                    label={t('problemTitle.dialog.field.specialJudge')}
                    variant='outlined'
                    onClick={() => {
                      msg({
                        type: 'openFile',
                        path: problem.checker!.path,
                      });
                    }}
                    onDelete={() => {
                      msg({
                        type: 'removeSrcFile',
                        fileType: 'checker',
                      });
                    }}
                  />
                ) : (
                  <Chip
                    label={t('problemTitle.dialog.field.specialJudge')}
                    onClick={() => {
                      msg({
                        type: 'chooseSrcFile',
                        fileType: 'checker',
                      });
                    }}
                  />
                )}
                {problem.interactor ? (
                  <Chip
                    label={t('problemTitle.dialog.field.interact')}
                    variant='outlined'
                    onClick={() => {
                      msg({
                        type: 'openFile',
                        path: problem.interactor!.path,
                      });
                    }}
                    onDelete={() => {
                      msg({
                        type: 'removeSrcFile',
                        fileType: 'interactor',
                      });
                    }}
                  />
                ) : (
                  <Chip
                    label={t('problemTitle.dialog.field.interact')}
                    onClick={() => {
                      msg({
                        type: 'chooseSrcFile',
                        fileType: 'interactor',
                      });
                    }}
                  />
                )}
                <CphLink
                  name={t('problemTitle.dialog.testlib')}
                  onClick={() => {
                    msg({
                      type: 'openTestlib',
                    });
                  }}
                >
                  {t('problemTitle.dialog.testlib')}
                </CphLink>
              </CphFlex>
            </TabPanel>
          </TabContext>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditDialogOpen(false)}
            color={'primary'}
          >
            {t('problemTitle.dialog.cancel')}
          </Button>
          <Button
            onClick={handleEditDialogClose}
            color={'primary'}
            autoFocus
          >
            {t('problemTitle.dialog.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProblemTitle;
