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
import type { TypographyProps } from '@mui/material/Typography';
import { CphNgButton } from '@w/components/base/cphNgButton';
import { CphNgFlex } from '@w/components/base/cphNgFlex';
import { CphNgLink } from '@w/components/base/cphNgLink';
import { CphNgMenu } from '@w/components/base/cphNgMenu';
import { CphNgText } from '@w/components/base/cphNgText';
import { CphNgTooltip } from '@w/components/base/cphNgTooltip';
import { useProblemDispatch } from '@w/context/ProblemContext';
import type { IWebviewFileWithHash, IWebviewOverrides } from '@w/types';
import React, { memo, type SyntheticEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ProblemTitleProps {
  problemId: ProblemId;
  name: string;
  url: string | null;
  checker: IWebviewFileWithHash | null;
  interactor: IWebviewFileWithHash | null;
  timeElapsedMs: number;
  overrides: IWebviewOverrides;
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

const Subtitle = memo<TypographyProps>((props) => {
  return (
    <CphNgText fontSize='0.8rem' paddingRight='4px' whiteSpace='normal' {...props}>
      {props.children}
    </CphNgText>
  );
});

export const ProblemTitle = memo(
  ({
    problemId,
    name,
    url,
    checker,
    interactor,
    timeElapsedMs,
    overrides,
    startTime,
  }: ProblemTitleProps) => {
    const { t } = useTranslation();
    const dispatch = useProblemDispatch();
    const [isEditDialogOpen, setEditDialogOpen] = useState(false);
    const [tabValue, setTabValue] = useState('basic');
    const [editedTitle, setEditedTitle] = useState('');
    const [editedUrl, setEditedUrl] = useState('');
    const [editedTimeLimitMs, setEditedTimeLimitMs] = useState<string | null>();
    const [editedMemoryLimitMb, setEditedMemoryLimitMb] = useState<string | null>();
    const [editedCompiler, setEditedCompiler] = useState<string | null | undefined>();
    const [editedCompilerArgs, setEditedCompilerArgs] = useState<string | null | undefined>();
    const [editedRunner, setEditedRunner] = useState<string | null | undefined>();
    const [editedRunnerArgs, setEditedRunnerArgs] = useState<string | null | undefined>();
    const [timeElapsed, setTimeElapsed] = useState(0);

    useEffect(() => {
      setEditedTitle(name);
      setEditedUrl(url || '');
      setEditedTimeLimitMs(overrides.timeLimitMs.override?.toString());
      setEditedMemoryLimitMb(overrides.memoryLimitMb.override?.toString());
      setEditedCompiler(overrides.compiler?.override);
      setEditedCompilerArgs(overrides.compilerArgs?.override);
      setEditedRunner(overrides.runner?.override);
      setEditedRunnerArgs(overrides.runnerArgs?.override);
    }, [name, url, overrides]);
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
      dispatch({
        type: 'editProblemDetails',
        problemId,
        name: editedTitle,
        url: editedUrl ? editedUrl : null,
        overrides: {
          timeLimitMs: editedTimeLimitMs ? parseInt(editedTimeLimitMs, 10) : null,
          memoryLimitMb: editedMemoryLimitMb ? parseInt(editedMemoryLimitMb, 10) : null,
          compiler: editedCompiler ?? null,
          compilerArgs: editedCompilerArgs ?? null,
          runner: editedRunner ?? null,
          runnerArgs: editedRunnerArgs ?? null,
        },
      });
    };

    return (
      <>
        <CphNgFlex>
          <CphNgFlex column alignStart flexShrink={1} width='unset'>
            <CphNgText sx={{ cursor: url ? 'pointer' : 'default' }} title={name} width='100%'>
              {url ? (
                <CphNgLink href={url} name={url}>
                  {name}
                </CphNgLink>
              ) : (
                name
              )}
            </CphNgText>
            <CphNgFlex>
              <Subtitle>
                {t('problemTitle.timeLimit', {
                  time: overrides.timeLimitMs.override ?? overrides.timeLimitMs.defaultValue,
                })}
              </Subtitle>
              <Subtitle>
                {t('problemTitle.memoryLimit', {
                  memory: overrides.memoryLimitMb.override ?? overrides.memoryLimitMb.defaultValue,
                })}
              </Subtitle>
              {!!checker && (
                <Subtitle>
                  <CphNgLink
                    name={checker.path}
                    onClick={() => {
                      if (checker)
                        dispatch({
                          type: 'openFile',
                          path: checker.path,
                        });
                    }}
                  >
                    {t('problemTitle.specialJudge')}
                  </CphNgLink>
                </Subtitle>
              )}
              {!!interactor && (
                <Subtitle>
                  <CphNgLink
                    name={interactor.path}
                    onClick={() => {
                      if (interactor)
                        dispatch({
                          type: 'openFile',
                          path: interactor.path,
                        });
                    }}
                  >
                    {t('problemTitle.interact')}
                  </CphNgLink>
                </Subtitle>
              )}
              <CphNgTooltip title={t('problemTitle.timeElapsed')}>
                <Subtitle className='defaultBlur' sx={{ display: { xs: 'none', md: 'inline' } }}>
                  {formatDuration(timeElapsedMs + timeElapsed)}
                </Subtitle>
              </CphNgTooltip>
            </CphNgFlex>
          </CphNgFlex>
          <CphNgMenu
            menu={{
              [t('problemTitle.menu.editRaw')]: () => {
                dispatch({
                  type: 'openFile',
                  problemId,
                  path: '/problem.cph-ng.json',
                });
              },
            }}
          >
            <CphNgButton
              sx={{ display: { xs: 'none', sm: 'inline' } }}
              name={t('problemTitle.editTitle')}
              icon={EditIcon}
              color='secondary'
              onClick={handleEditTitle}
            />
          </CphNgMenu>
        </CphNgFlex>
        <Dialog fullScreen open={isEditDialogOpen} onClose={handleEditDialogClose}>
          <DialogTitle>{t('problemTitle.dialog.title')}</DialogTitle>
          <DialogContent>
            <TabContext value={tabValue}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <TabList
                  variant='scrollable'
                  scrollButtons='auto'
                  onChange={(_event: SyntheticEvent, value: string) => setTabValue(value)}
                >
                  <Tab label={t('problemTitle.dialog.tab.basic')} value='basic' />
                  <Tab label={t('problemTitle.dialog.tab.environment')} value='environment' />
                  <Tab label={t('problemTitle.dialog.tab.advanced')} value='advanced' />
                </TabList>
              </Box>
              <TabPanel value='basic' sx={{ padding: '0' }}>
                <TextField
                  variant='outlined'
                  margin='normal'
                  label={t('problemTitle.dialog.field.title')}
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  fullWidth
                  autoFocus
                />
                <TextField
                  variant='outlined'
                  margin='normal'
                  label={t('problemTitle.dialog.field.url')}
                  value={editedUrl}
                  onChange={(e) => setEditedUrl(e.target.value)}
                  fullWidth
                />
                <TextField
                  variant='outlined'
                  margin='normal'
                  label={t('problemTitle.dialog.field.time')}
                  value={editedTimeLimitMs}
                  placeholder={overrides.timeLimitMs.defaultValue.toString()}
                  onChange={(e) => setEditedTimeLimitMs(e.target.value)}
                  fullWidth
                  slotProps={{
                    input: {
                      endAdornment: <InputAdornment position='end'>ms</InputAdornment>,
                    },
                  }}
                />
                <TextField
                  variant='outlined'
                  margin='normal'
                  label={t('problemTitle.dialog.field.memory')}
                  value={editedMemoryLimitMb}
                  placeholder={overrides.memoryLimitMb.defaultValue.toString()}
                  onChange={(e) => setEditedMemoryLimitMb(e.target.value)}
                  fullWidth
                  slotProps={{
                    input: {
                      endAdornment: <InputAdornment position='end'>MB</InputAdornment>,
                    },
                  }}
                />
              </TabPanel>
              <TabPanel value='environment' sx={{ padding: '0' }}>
                {!!overrides.compiler && (
                  <TextField
                    variant='outlined'
                    margin='normal'
                    label={t('problemTitle.dialog.field.compiler')}
                    value={editedCompiler}
                    placeholder={overrides.compiler.defaultValue.toString()}
                    onChange={(e) => setEditedCompiler(e.target.value)}
                    fullWidth
                  />
                )}
                {!!overrides.compilerArgs && (
                  <TextField
                    variant='outlined'
                    margin='normal'
                    label={t('problemTitle.dialog.field.compilerArgs')}
                    value={editedCompilerArgs}
                    placeholder={overrides.compilerArgs.defaultValue.toString()}
                    onChange={(e) => setEditedCompilerArgs(e.target.value)}
                    fullWidth
                  />
                )}
                {!!overrides.runner && (
                  <TextField
                    variant='outlined'
                    margin='normal'
                    label={t('problemTitle.dialog.field.runner')}
                    value={editedRunner}
                    placeholder={overrides.runner.defaultValue.toString()}
                    onChange={(e) => setEditedRunner(e.target.value)}
                    fullWidth
                  />
                )}
                {!!overrides.runnerArgs && (
                  <TextField
                    variant='outlined'
                    margin='normal'
                    label={t('problemTitle.dialog.field.runnerArgs')}
                    value={editedRunnerArgs}
                    placeholder={overrides.runnerArgs.defaultValue.toString()}
                    onChange={(e) => setEditedRunnerArgs(e.target.value)}
                    fullWidth
                  />
                )}
              </TabPanel>
              <TabPanel value='advanced' sx={{ padding: '0' }}>
                <CphNgFlex flexWrap='wrap' py={2}>
                  {checker ? (
                    <Chip
                      label={t('problemTitle.dialog.field.specialJudge')}
                      variant='outlined'
                      onClick={() => {
                        if (checker)
                          dispatch({
                            type: 'openFile',
                            path: checker.path,
                          });
                      }}
                      onDelete={() =>
                        dispatch({
                          type: 'removeSrcFile',
                          problemId,
                          fileType: 'checker',
                        })
                      }
                    />
                  ) : (
                    <Chip
                      label={t('problemTitle.dialog.field.specialJudge')}
                      onClick={() =>
                        dispatch({
                          type: 'chooseSrcFile',
                          problemId,
                          fileType: 'checker',
                        })
                      }
                    />
                  )}
                  {interactor ? (
                    <Chip
                      label={t('problemTitle.dialog.field.interact')}
                      variant='outlined'
                      onClick={() => {
                        if (interactor)
                          dispatch({
                            type: 'openFile',
                            path: interactor.path,
                          });
                      }}
                      onDelete={() =>
                        dispatch({
                          type: 'removeSrcFile',
                          problemId,
                          fileType: 'interactor',
                        })
                      }
                    />
                  ) : (
                    <Chip
                      label={t('problemTitle.dialog.field.interact')}
                      onClick={() =>
                        dispatch({
                          type: 'chooseSrcFile',
                          problemId,
                          fileType: 'interactor',
                        })
                      }
                    />
                  )}
                  <CphNgLink
                    name={t('problemTitle.dialog.testlib')}
                    onClick={() => {
                      dispatch({
                        type: 'openTestlib',
                      });
                    }}
                  >
                    {t('problemTitle.dialog.testlib')}
                  </CphNgLink>
                </CphNgFlex>
              </TabPanel>
            </TabContext>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)} color='primary'>
              {t('problemTitle.dialog.cancel')}
            </Button>
            <Button onClick={handleEditDialogClose} color='primary' autoFocus>
              {t('problemTitle.dialog.save')}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  },
);
