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
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import { MD5 } from 'crypto-js';
import React, { memo } from 'react';
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
          expanded={testcase.isDisabled ? false : isExpand}
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
            borderLeft: `4px solid`,
            transition: 'all 0.2s',
            opacity: isDragging || testcase.isDisabled ? 0.5 : 1,
            filter: testcase.isDisabled ? 'grayscale(100%)' : 'none',
            ...(window.easterEgg
              ? (() => {
                  const hash = MD5(JSON.stringify(testcase)).words;
                  let color = 0;
                  for (let i = 0; i < hash.length; i++) {
                    color = (color << 4) + hash[i];
                  }
                  color =
                    (((color >> 16) & 0xff) << 16) | (((color >> 8) & 0xff) << 8) | (color & 0xff);
                  const colorStr = color.toString(16).padStart(6, '0');
                  return {
                    borderLeftColor: `#${colorStr}`,
                    backgroundColor: `#${colorStr}20`,
                  };
                })()
              : testcase.result?.verdict
                ? {
                    borderLeftColor: testcase.result.verdict.color,
                    backgroundColor: `${testcase.result.verdict.color}20`,
                  }
                : {
                    borderLeftColor: 'transparent',
                  }),
          }}
        >
          <AccordionSummary
            disabled={testcase.isDisabled}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              if (onDragStart) {
                onDragStart(e);
              }
            }}
            onDragEnd={(e) => {
              e.stopPropagation();
              if (onDragEnd) {
                onDragEnd();
              }
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
                <Tooltip disableInteractive title={testcase.result?.verdict.fullName}>
                  <CphText>{testcase.result?.verdict.name}</CphText>
                </Tooltip>
              </CphFlex>
              {testcase.result?.memoryMb !== undefined && (
                <Chip
                  label={t('testcaseView.memory', {
                    memory: testcase.result.memoryMb.toFixed(1),
                  })}
                  size='small'
                  sx={{
                    marginLeft: 'auto',
                    fontSize: '0.8rem',
                  }}
                />
              )}
              {testcase.result?.timeMs !== undefined && (
                <Chip
                  label={t('testcaseView.time', {
                    time: testcase.result.timeMs.toFixed(1),
                  })}
                  size='small'
                  sx={{
                    marginLeft: 'auto',
                    fontSize: '0.8rem',
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
                  name={t('testcaseView.run')}
                  icon={PlayArrowIcon}
                  color='success'
                  loading={testcase.result?.verdict.type === VerdictType.running}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({
                      type: 'runTestcase',
                      problemId,
                      testcaseId,
                      forceCompile: getCompile(e),
                    });
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
              />
            </CphFlex>
          </AccordionSummary>
          <AccordionDetails
            sx={{
              padding: '8px 16px',
            }}
          >
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
              {!!testcase.result && (
                <>
                  <Divider />
                  <CphFlex smallGap column>
                    {!!testcase.result.stdout && (
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
                    {!!testcase.result.stderr && (
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
                    {!!testcase.result.msg && (
                      <ErrorBoundary>
                        <TestcaseDataView
                          label={t('testcaseView.message')}
                          value={{ type: 'string', data: testcase.result.msg }}
                          readOnly
                        />
                      </ErrorBoundary>
                    )}
                  </CphFlex>
                </>
              )}
            </CphFlex>
          </AccordionDetails>
        </Accordion>
      </CphMenu>
    );
  },
);
