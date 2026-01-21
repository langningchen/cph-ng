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
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import { MD5 } from 'crypto-js';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { VerdictType } from '@/domain/entities/verdict';
import type { IWebviewTc } from '@/domain/webviewTypes';
import { useProblemContext } from '../context/ProblemContext';
import { getCompile } from '../utils';
import { CphFlex } from './base/cphFlex';
import { CphMenu } from './base/cphMenu';
import { CphText } from './base/cphText';
import { ErrorBoundary } from './base/errorBoundary';
import { CphButton } from './cphButton';
import { TcDataView } from './tcDataView';

interface TcViewProp {
  problemId: UUID;
  tcId: UUID;
  tc: IWebviewTc;
  idx: number;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  autoFocus?: boolean;
}

export const TcView = ({
  problemId,
  tcId,
  tc,
  idx,
  onDragStart,
  onDragEnd,
  isDragging = false,
  autoFocus = false,
}: TcViewProp) => {
  const { t } = useTranslation();
  const { dispatch } = useProblemContext();

  return (
    <CphMenu
      menu={
        tc.isDisabled
          ? {
              [t('tcView.menu.enableTc')]: () =>
                dispatch({ type: 'updateTc', problemId, id: tcId, event: 'toggleDisable' }),
            }
          : {
              [t('tcView.menu.disableTc')]: () =>
                dispatch({ type: 'updateTc', problemId, id: tcId, event: 'toggleDisable' }),
              [t('tcView.menu.clearTcStatus')]: () =>
                dispatch({ type: 'clearTcStatus', problemId, id: tcId }),
            }
      }
    >
      <Accordion
        expanded={tc.isDisabled ? false : tc.isExpand}
        disableGutters
        onChange={() => {
          if (tc.isDisabled) return;
          dispatch({ type: 'updateTc', problemId, id: tcId, event: 'toggleExpand' });
        }}
        sx={{
          borderLeft: `4px solid`,
          transition: 'all 0.2s',
          opacity: isDragging || tc.isDisabled ? 0.5 : 1,
          filter: tc.isDisabled ? 'grayscale(100%)' : 'none',
          ...(window.easterEgg
            ? (() => {
                const hash = MD5(JSON.stringify(tc)).words;
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
            : tc.result?.verdict
              ? {
                  borderLeftColor: tc.result.verdict.color,
                  backgroundColor: `${tc.result.verdict.color}20`,
                }
              : {
                  borderLeftColor: 'transparent',
                }),
        }}
      >
        <AccordionSummary
          disabled={tc.isDisabled}
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
            if (tc.isDisabled) {
              e.stopPropagation();
              e.preventDefault();
            }
          }}
          sx={{
            '& > span': { margin: '0 !important' },
            cursor: isDragging ? 'grabbing' : tc.isDisabled ? 'not-allowed' : 'grab',
            pointerEvents: tc.isDisabled ? 'none' : 'auto',
            '&[draggable="true"]': {
              pointerEvents: 'auto',
            },
            '& *': tc.isDisabled
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
              <Tooltip disableInteractive title={tc.result?.verdict.fullName}>
                <CphText>{tc.result?.verdict.name}</CphText>
              </Tooltip>
            </CphFlex>
            {tc.result?.memoryMb !== undefined && (
              <Chip
                label={t('tcView.memory', {
                  memory: tc.result.memoryMb.toFixed(1),
                })}
                size='small'
                sx={{
                  marginLeft: 'auto',
                  fontSize: '0.8rem',
                }}
              />
            )}
            {tc.result?.timeMs !== undefined && (
              <Chip
                label={t('tcView.time', {
                  time: tc.result.timeMs.toFixed(1),
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
                [t('tcView.run.menu.forceCompile')]: () =>
                  dispatch({
                    type: 'runTc',
                    problemId,
                    id: tcId,
                    forceCompile: true,
                  }),
                [t('tcView.run.menu.skipCompile')]: () =>
                  dispatch({
                    type: 'runTc',
                    problemId,
                    id: tcId,
                    forceCompile: false,
                  }),
              }}
            >
              <CphButton
                name={t('tcView.run')}
                icon={PlayArrowIcon}
                color='success'
                loading={tc.result?.verdict.type === VerdictType.running}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({
                    type: 'runTc',
                    problemId,
                    id: tcId,
                    forceCompile: getCompile(e),
                  });
                }}
              />
            </CphMenu>
            <CphButton
              name={t('tcView.delete')}
              icon={DeleteIcon}
              color='error'
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'delTc', problemId, id: tcId });
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
                <TcDataView
                  label={t('tcView.stdin')}
                  value={tc.stdin}
                  onChange={(data) =>
                    dispatch({ type: 'setTcString', problemId, id: tcId, label: 'stdin', data })
                  }
                  onChooseFile={() =>
                    dispatch({
                      type: 'chooseTcFile',
                      problemId,
                      label: 'stdin',
                      id: tcId,
                    })
                  }
                  onToggleFile={() => {
                    dispatch({
                      type: 'toggleTcFile',
                      problemId,
                      label: 'stdin',
                      id: tcId,
                    });
                  }}
                  onOpenVirtual={() => {
                    dispatch({
                      type: 'openFile',
                      path: `/tcs/${tcId}/stdin`,
                      isVirtual: true,
                    });
                  }}
                  autoFocus={autoFocus}
                  tabIndex={idx * 2 + 1}
                />
              </ErrorBoundary>
              <ErrorBoundary>
                <TcDataView
                  label={t('tcView.answer')}
                  value={tc.answer}
                  onChange={(data) =>
                    dispatch({ type: 'setTcString', problemId, id: tcId, label: 'answer', data })
                  }
                  onChooseFile={() =>
                    dispatch({
                      type: 'chooseTcFile',
                      problemId,
                      label: 'answer',
                      id: tcId,
                    })
                  }
                  onToggleFile={() =>
                    dispatch({
                      type: 'toggleTcFile',
                      problemId,
                      label: 'answer',
                      id: tcId,
                    })
                  }
                  onOpenVirtual={() =>
                    dispatch({
                      type: 'openFile',
                      path: `/tcs/${tcId}/answer`,
                      isVirtual: true,
                    })
                  }
                  tabIndex={idx * 2 + 2}
                />
              </ErrorBoundary>
            </CphFlex>
            {tc.result && (
              <>
                <Divider />
                <CphFlex smallGap column>
                  {tc.result.stdout && (
                    <ErrorBoundary>
                      <TcDataView
                        label={t('tcView.stdout')}
                        value={tc.result.stdout}
                        readOnly
                        outputActions={{
                          onSetAnswer: () =>
                            dispatch({
                              type: 'updateTc',
                              problemId,
                              id: tcId,
                              event: 'setAsAnswer',
                            }),
                          onCompare: () =>
                            dispatch({
                              type: 'compareTc',
                              problemId,
                              id: tcId,
                            }),
                        }}
                        onOpenVirtual={() => {
                          dispatch({
                            type: 'openFile',
                            path: `/tcs/${tcId}/stdout`,
                            isVirtual: true,
                          });
                        }}
                      />
                    </ErrorBoundary>
                  )}
                  {tc.result.stderr && (
                    <ErrorBoundary>
                      <TcDataView
                        label={t('tcView.stderr')}
                        value={tc.result.stderr}
                        readOnly
                        onOpenVirtual={() => {
                          dispatch({
                            type: 'openFile',
                            path: `/tcs/${tcId}/stderr`,
                            isVirtual: true,
                          });
                        }}
                      />
                    </ErrorBoundary>
                  )}
                  {tc.result.msg && (
                    <ErrorBoundary>
                      <TcDataView
                        label={t('tcView.message')}
                        value={{ type: 'string', data: tc.result.msg }}
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
};
