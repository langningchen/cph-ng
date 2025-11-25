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

import { isRunningVerdict, ITc } from '@/types/types';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import { UUID } from 'crypto';
import { MD5 } from 'crypto-js';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getCompile, msg } from '../utils';
import CphFlex from './base/cphFlex';
import CphMenu from './base/cphMenu';
import CphText from './base/cphText';
import ErrorBoundary from './base/errorBoundary';
import CphButton from './cphButton';
import TcDataView from './tcDataView';

interface TcViewProp {
    tc: ITc;
    idx: number;
    id: UUID;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
    isDragging?: boolean;
}

const TcView = ({
    tc,
    idx,
    id,
    onDragStart,
    onDragEnd,
    isDragging = false,
}: TcViewProp) => {
    const { t } = useTranslation();
    const running = isRunningVerdict(tc.result?.verdict);

    const emitUpdate = () => msg({ type: 'updateTc', id, tc });

    return (
        <CphMenu
            menu={
                tc.isDisabled
                    ? {
                          [t('tcView.menu.enableTc')]: () => {
                              msg({ type: 'toggleDisable', id });
                          },
                      }
                    : {
                          [t('tcView.menu.disableTc')]: () => {
                              msg({ type: 'toggleDisable', id });
                          },
                          [t('tcView.menu.clearTcStatus')]: () => {
                              msg({ type: 'clearTcStatus', id });
                          },
                          [t('tcView.menu.debug')]: () => {
                              msg({ type: 'debugTc', id });
                          },
                      }
            }
        >
            <Accordion
                expanded={tc.isDisabled ? false : tc.isExpand}
                disableGutters={true}
                onChange={(_, expanded) => {
                    if (tc.isDisabled) return;
                    tc.isExpand = expanded;
                    emitUpdate();
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
                                  (((color >> 16) & 0xff) << 16) |
                                  (((color >> 8) & 0xff) << 8) |
                                  (color & 0xff);
                              const colorStr = color
                                  .toString(16)
                                  .padStart(6, '0');
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
                        if (onDragStart) onDragStart(e);
                    }}
                    onDragEnd={(e) => {
                        e.stopPropagation();
                        if (onDragEnd) onDragEnd();
                    }}
                    onClick={(e) => {
                        if (tc.isDisabled) {
                            e.stopPropagation();
                            e.preventDefault();
                        }
                    }}
                    sx={{
                        '& > span': { margin: '0 !important' },
                        'cursor': isDragging
                            ? 'grabbing'
                            : tc.isDisabled
                              ? 'not-allowed'
                              : 'grab',
                        'pointerEvents': tc.isDisabled ? 'none' : 'auto',
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
                            <CphText fontWeight={'bold'}>#{idx + 1}</CphText>
                            <Tooltip
                                disableInteractive
                                title={tc.result?.verdict.fullName}
                            >
                                <CphText>{tc.result?.verdict.name}</CphText>
                            </Tooltip>
                        </CphFlex>
                        {tc.result?.memory !== undefined && (
                            <Chip
                                label={t('tcView.memory', {
                                    memory: tc.result.memory.toFixed(1),
                                })}
                                size={'small'}
                                sx={{
                                    marginLeft: 'auto',
                                    fontSize: '0.8rem',
                                }}
                            />
                        )}
                        {tc.result?.time !== undefined && (
                            <Chip
                                label={t('tcView.time', {
                                    time: tc.result.time.toFixed(1),
                                })}
                                size={'small'}
                                sx={{
                                    marginLeft: 'auto',
                                    fontSize: '0.8rem',
                                }}
                            />
                        )}
                        <CphMenu
                            menu={{
                                [t('tcView.run.menu.forceCompile')]: () => {
                                    msg({
                                        type: 'runTc',
                                        id,
                                        compile: true,
                                    });
                                },
                                [t('tcView.run.menu.skipCompile')]: () => {
                                    msg({
                                        type: 'runTc',
                                        id,
                                        compile: false,
                                    });
                                },
                            }}
                        >
                            <CphButton
                                name={t('tcView.run')}
                                icon={PlayArrowIcon}
                                color={'success'}
                                loading={running}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    msg({
                                        type: 'runTc',
                                        id,
                                        compile: getCompile(e),
                                    });
                                }}
                            />
                        </CphMenu>
                        <CphButton
                            name={t('tcView.delete')}
                            icon={DeleteIcon}
                            color={'error'}
                            onClick={(e) => {
                                e.stopPropagation();
                                msg({ type: 'delTc', id });
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
                        <CphFlex
                            smallGap
                            column
                        >
                            <ErrorBoundary>
                                <TcDataView
                                    label={t('tcView.stdin')}
                                    value={tc.stdin}
                                    onChange={(value) => {
                                        tc.stdin = {
                                            useFile: false,
                                            data: value,
                                        };
                                        emitUpdate();
                                    }}
                                    onChooseFile={() =>
                                        msg({
                                            type: 'chooseTcFile',
                                            label: 'stdin',
                                            id,
                                        })
                                    }
                                    onToggleFile={() => {
                                        msg({
                                            type: 'toggleTcFile',
                                            label: 'stdin',
                                            id,
                                        });
                                    }}
                                    onOpenVirtual={() => {
                                        msg({
                                            type: 'openFile',
                                            path: `/tcs/${id}/stdin`,
                                            isVirtual: true,
                                        });
                                    }}
                                    tabIndex={idx * 2 + 1}
                                />
                            </ErrorBoundary>
                            <ErrorBoundary>
                                <TcDataView
                                    label={t('tcView.answer')}
                                    value={tc.answer}
                                    onChange={(value) => {
                                        tc.answer = {
                                            useFile: false,
                                            data: value,
                                        };
                                        emitUpdate();
                                    }}
                                    onChooseFile={() => {
                                        msg({
                                            type: 'chooseTcFile',
                                            label: 'answer',
                                            id,
                                        });
                                    }}
                                    onToggleFile={() => {
                                        msg({
                                            type: 'toggleTcFile',
                                            label: 'answer',
                                            id,
                                        });
                                    }}
                                    onOpenVirtual={() => {
                                        msg({
                                            type: 'openFile',
                                            path: `/tcs/${id}/answer`,
                                            isVirtual: true,
                                        });
                                    }}
                                    tabIndex={idx * 2 + 2}
                                />
                            </ErrorBoundary>
                        </CphFlex>
                        {tc.result && (
                            <>
                                <Divider />
                                <CphFlex
                                    smallGap
                                    column
                                >
                                    <ErrorBoundary>
                                        <TcDataView
                                            label={t('tcView.stdout')}
                                            value={tc.result.stdout}
                                            readOnly={true}
                                            outputActions={{
                                                onSetAnswer: () => {
                                                    tc.answer =
                                                        tc.result!.stdout;
                                                    tc.result = undefined;
                                                    emitUpdate();
                                                },
                                                onCompare: () => {
                                                    msg({
                                                        type: 'compareTc',
                                                        id,
                                                    });
                                                },
                                            }}
                                            onOpenVirtual={() => {
                                                msg({
                                                    type: 'openFile',
                                                    path: `/tcs/${id}/stdout`,
                                                    isVirtual: true,
                                                });
                                            }}
                                        />
                                    </ErrorBoundary>
                                    <ErrorBoundary>
                                        <TcDataView
                                            label={t('tcView.stderr')}
                                            value={tc.result.stderr}
                                            readOnly={true}
                                            onOpenVirtual={() => {
                                                msg({
                                                    type: 'openFile',
                                                    path: `/tcs/${id}/stderr`,
                                                    isVirtual: true,
                                                });
                                            }}
                                        />
                                    </ErrorBoundary>
                                    <ErrorBoundary>
                                        <TcDataView
                                            label={t('tcView.message')}
                                            value={{
                                                useFile: false,
                                                data: tc.result.msg.join('\n'),
                                            }}
                                            readOnly={true}
                                        />
                                    </ErrorBoundary>
                                </CphFlex>
                            </>
                        )}
                    </CphFlex>
                </AccordionDetails>
            </Accordion>
        </CphMenu>
    );
};

export default TcView;
