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

import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import { MD5 } from 'crypto-js';
import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { VerdictType } from '@/domain/entities/verdict';
import type { ProblemId, TestcaseId } from '@/domain/types';
import type { IWebviewTestcase } from '@/domain/webviewTypes';
import { useProblemContext } from '../context/ProblemContext';
import { getCompile } from '../utils';
import { CphFlex } from './base/cphFlex';
import { CphMenu } from './base/cphMenu';
import { CphText } from './base/cphText';
import { ErrorBoundary } from './base/errorBoundary';
import { CphButton } from './cphButton';
import { TestcaseDataView } from './testcaseDataView';

interface TestcaseViewProp {
  problemId: ProblemId;
  testcaseId: TestcaseId;
  testcase: IWebviewTestcase;
  isExpand: boolean;
  idx: number;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  autoFocus?: boolean;
}

export const TestcaseView = memo(
  ({
    problemId,
    testcaseId,
    testcase,
    isExpand,
    idx,
    onDragStart,
    onDragEnd,
    isDragging = false,
    autoFocus = false,
  }: TestcaseViewProp) => {
    const { t } = useTranslation();
    const { dispatch } = useProblemContext();
    const isRunning = testcase.result?.verdict.type === VerdictType.running;
    const expanded = testcase.isDisabled ? false : isExpand;
    const details = useMemo(
      () => (
        <CphFlex column>
          <CphFlex smallGap column>
            <ErrorBoundary>
              <TestcaseDataView
                label={t('testcaseView.stdin')}
                value={testcase.stdin}
                onChange={(data) =>
                  dispatch({
                    type: 'setTestcaseString',
                    problemId,
                    testcaseId,
                    label: 'stdin',
                    data,
                  })
                }
                onChooseFile={() =>
                  dispatch({
                    type: 'chooseTestcaseFile',
                    problemId,
                    label: 'stdin',
                    testcaseId,
                  })
                }
                onToggleFile={() => {
                  dispatch({
                    type: 'toggleTestcaseFile',
                    problemId,
                    label: 'stdin',
                    testcaseId,
                  });
                }}
                onOpenVirtual={() => {
                  dispatch({
                    type: 'openFile',
                    problemId,
                    path: `/testcases/${testcaseId}/stdin`,
                  });
                }}
                autoFocus={autoFocus}
                tabIndex={idx * 2 + 1}
              />
            </ErrorBoundary>
            <ErrorBoundary>
              <TestcaseDataView
                label={t('testcaseView.answer')}
                value={testcase.answer}
                onChange={(data) =>
                  dispatch({
                    type: 'setTestcaseString',
                    problemId,
                    testcaseId,
                    label: 'answer',
                    data,
                  })
                }
                onChooseFile={() =>
                  dispatch({
                    type: 'chooseTestcaseFile',
                    problemId,
                    label: 'answer',
                    testcaseId,
                  })
                }
                onToggleFile={() =>
                  dispatch({
                    type: 'toggleTestcaseFile',
                    problemId,
                    label: 'answer',
                    testcaseId,
                  })
                }
                onOpenVirtual={() =>
                  dispatch({
                    type: 'openFile',
                    problemId,
                    path: `/testcases/${testcaseId}/answer`,
                  })
                }
                tabIndex={idx * 2 + 2}
              />
            </ErrorBoundary>
          </CphFlex>
          <Divider />
          <CphFlex smallGap column>
            {!!testcase.result?.stdout && (
              <ErrorBoundary>
                <TestcaseDataView
                  label={t('testcaseView.stdout')}
                  value={testcase.result.stdout}
                  readOnly
                  outputActions={{
                    onSetAnswer: () =>
                      dispatch({
                        type: 'updateTestcase',
                        problemId,
                        testcaseId,
                        event: 'setAsAnswer',
                        value: true,
                      }),
                    onCompare: () =>
                      dispatch({
                        type: 'compareTestcase',
                        problemId,
                        testcaseId,
                      }),
                  }}
                  onOpenVirtual={() => {
                    dispatch({
                      type: 'openFile',
                      problemId,
                      path: `/testcases/${testcaseId}/stdout`,
                    });
                  }}
                />
              </ErrorBoundary>
            )}
            {!!testcase.result?.stderr && (
              <ErrorBoundary>
                <TestcaseDataView
                  label={t('testcaseView.stderr')}
                  value={testcase.result.stderr}
                  readOnly
                  onOpenVirtual={() => {
                    dispatch({
                      type: 'openFile',
                      problemId,
                      path: `/testcases/${testcaseId}/stderr`,
                    });
                  }}
                />
              </ErrorBoundary>
            )}
            {!!testcase.result?.msg && (
              <ErrorBoundary>
                <TestcaseDataView
                  label={t('testcaseView.message')}
                  value={{ type: 'string', data: testcase.result.msg }}
                  readOnly
                />
              </ErrorBoundary>
            )}
          </CphFlex>
        </CphFlex>
      ),
      [
        autoFocus,
        dispatch,
        idx,
        problemId,
        testcase.answer,
        testcase.result?.stdout,
        testcase.result?.stderr,
        testcase.result?.msg,
        testcase.stdin,
        testcaseId,
        t,
      ],
    );

    const verdictColor = window.easterEgg
      ? (() => {
          const hash = MD5(JSON.stringify(testcase)).words;
          let color = 0;
          for (let i = 0; i < hash.length; i++) {
            color = (color << 4) + hash[i];
          }
          color = (((color >> 16) & 0xff) << 16) | (((color >> 8) & 0xff) << 8) | (color & 0xff);
          return `#${color.toString(16).padStart(6, '0')}`;
        })()
      : testcase.result?.verdict?.color;

    return (
      <CphMenu
        menu={
          testcase.isDisabled
            ? {
                [t('testcaseView.menu.enableTestcase')]: () =>
                  dispatch({
                    type: 'updateTestcase',
                    problemId,
                    testcaseId,
                    event: 'setDisable',
                    value: false,
                  }),
              }
            : {
                [t('testcaseView.menu.disableTestcase')]: () =>
                  dispatch({
                    type: 'updateTestcase',
                    problemId,
                    testcaseId,
                    event: 'setDisable',
                    value: true,
                  }),
                [t('testcaseView.menu.clearTestcaseStatus')]: () =>
                  dispatch({ type: 'clearTestcaseStatus', problemId, testcaseId }),
              }
        }
      >
        <Accordion
          slotProps={{ transition: { unmountOnExit: true } }}
          expanded={expanded}
          disableGutters
          onChange={() => {
            if (testcase.isDisabled) return;
            dispatch({
              type: 'updateTestcase',
              problemId,
              testcaseId,
              event: 'setExpand',
              value: !isExpand,
            });
          }}
          sx={{
            borderLeft: `4px solid ${verdictColor || 'transparent'}`,
            backgroundColor: verdictColor ? `${verdictColor}10` : undefined,
            transition: 'all 0.2s',
            opacity: isDragging || testcase.isDisabled ? 0.5 : 1,
            filter: testcase.isDisabled ? 'grayscale(100%)' : 'none',
          }}
        >
          <AccordionSummary
            disabled={testcase.isDisabled}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              onDragStart?.(e);
            }}
            onDragEnd={(e) => {
              e.stopPropagation();
              onDragEnd?.();
            }}
            onClick={(e) => {
              if (testcase.isDisabled) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            sx={{
              '& > span': { margin: '0 !important' },
              cursor: isDragging ? 'grabbing' : testcase.isDisabled ? 'not-allowed' : 'grab',
              pointerEvents: testcase.isDisabled ? 'none' : 'auto',
              '&[draggable="true"]': {
                pointerEvents: 'auto',
              },
              '& *': testcase.isDisabled
                ? {
                    cursor: 'not-allowed !important',
                    pointerEvents: 'none !important',
                  }
                : {},
            }}
          >
            <CphFlex smallGap>
              <CphFlex flex={1}>
                <CphText fontWeight='bold'>#{idx + 1}</CphText>
                {!!testcase.result?.verdict && (
                  <Tooltip disableInteractive title={testcase.result.verdict.fullName}>
                    <Chip
                      label={testcase.result.verdict.name}
                      size='small'
                      sx={{
                        backgroundColor: testcase.result.verdict.color,
                        color: '#fff',
                        fontWeight: 700,
                        height: '22px',
                        fontSize: '0.75rem',
                      }}
                    />
                  </Tooltip>
                )}
              </CphFlex>
              {testcase.result?.memoryMb !== undefined && (
                <Chip
                  label={t('testcaseView.memory', {
                    memory: testcase.result.memoryMb.toFixed(1),
                  })}
                  size='small'
                  variant='outlined'
                  sx={{
                    fontSize: '0.8rem',
                    display: { xs: 'none', xl: 'flex' },
                  }}
                />
              )}
              {testcase.result?.timeMs !== undefined && (
                <Chip
                  label={t('testcaseView.time', {
                    time: testcase.result.timeMs.toFixed(1),
                  })}
                  size='small'
                  variant='outlined'
                  sx={{
                    fontSize: '0.8rem',
                    display: { xs: 'none', lg: 'flex' },
                  }}
                />
              )}
              <CphMenu
                menu={{
                  [t('testcaseView.run.menu.forceCompile')]: () =>
                    dispatch({
                      type: 'runTestcase',
                      problemId,
                      testcaseId,
                      forceCompile: true,
                    }),
                  [t('testcaseView.run.menu.skipCompile')]: () =>
                    dispatch({
                      type: 'runTestcase',
                      problemId,
                      testcaseId,
                      forceCompile: false,
                    }),
                }}
              >
                <CphButton
                  name={isRunning ? t('testcaseView.stop') : t('testcaseView.run')}
                  icon={isRunning ? StopIcon : PlayArrowIcon}
                  color={isRunning ? 'warning' : 'success'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isRunning) {
                      dispatch({
                        type: 'stopTestcases',
                        problemId,
                        testcaseId,
                      });
                    } else {
                      dispatch({
                        type: 'runTestcase',
                        problemId,
                        testcaseId,
                        forceCompile: getCompile(e),
                      });
                    }
                  }}
                />
              </CphMenu>
              <CphButton
                name={t('testcaseView.delete')}
                icon={DeleteIcon}
                color='error'
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'deleteTestcase', problemId, testcaseId });
                }}
                sx={{ display: { xs: 'none', md: 'flex' } }}
              />
            </CphFlex>
          </AccordionSummary>
          <AccordionDetails
            sx={{
              padding: { xs: '8px 8px', md: '8px 16px' },
            }}
          >
            {details}
          </AccordionDetails>
        </Accordion>
      </CphMenu>
    );
  },
);
