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

import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { isRunningVerdict, TC } from '../../utils/types';
import {
    ChooseTcFileMsg,
    CompareTcMsg,
    DelTcMsg,
    RunTcMsg,
    ToggleTcFileMsg,
    UpdateTcMsg,
} from '../msgs';
import CphButton from './cphButton';
import CphFlex from './base/cphFlex';
import CphText from './base/cphText';
import TcDataView from './tcDataView';
import ErrorBoundary from './base/errorBoundary';

interface TcViewProp {
    tc: TC;
    idx: number;
}

const TcView = ({ tc, idx }: TcViewProp) => {
    const { t } = useTranslation();
    const running = isRunningVerdict(tc.result?.verdict);

    const emitUpdate = () =>
        vscode.postMessage({
            type: 'updateTc',
            idx,
            tc,
        } satisfies UpdateTcMsg);

    return (
        <ErrorBoundary>
            <Accordion
                expanded={tc.isExpand}
                disableGutters={true}
                onChange={(_, expanded) => {
                    tc.isExpand = expanded;
                    emitUpdate();
                }}
                sx={{
                    borderLeft: `4px solid`,
                    ...(tc.result?.verdict
                        ? {
                              borderLeftColor: `rgb(${tc.result.verdict.color})`,
                              backgroundColor: `rgba(${tc.result.verdict.color}, 0.1)`,
                          }
                        : {
                              borderLeftColor: 'transparent',
                          }),
                }}
            >
                <AccordionSummary
                    sx={{
                        '& > span': { margin: '0 !important' },
                    }}
                >
                    <CphFlex smallGap>
                        <CphFlex flex={1}>
                            <CphText fontWeight={'bold'}>#{idx + 1}</CphText>
                            <Tooltip title={tc.result?.verdict.fullName}>
                                <CphText>{tc.result?.verdict.name}</CphText>
                            </Tooltip>
                        </CphFlex>
                        {tc.result?.time ? (
                            <Chip
                                label={t('tcView.time', {
                                    time: tc.result.time.toFixed(1),
                                })}
                                size={'small'}
                                sx={{ marginLeft: 'auto', fontSize: '0.8rem' }}
                            />
                        ) : (
                            <></>
                        )}
                        <CphButton
                            name={t('tcView.run')}
                            icon={PlayArrowIcon}
                            color={'success'}
                            loading={running}
                            onClick={(e) => {
                                e.stopPropagation();
                                vscode.postMessage({
                                    type: 'runTc',
                                    idx,
                                    compile: e.altKey
                                        ? false
                                        : e.ctrlKey
                                          ? true
                                          : undefined,
                                } satisfies RunTcMsg);
                            }}
                        />
                        <CphButton
                            name={t('tcView.delete')}
                            icon={DeleteIcon}
                            color={'error'}
                            onClick={(e) => {
                                e.stopPropagation();
                                vscode.postMessage({
                                    type: 'delTc',
                                    idx,
                                } satisfies DelTcMsg);
                            }}
                        />
                    </CphFlex>
                </AccordionSummary>
                <AccordionDetails>
                    <CphFlex column>
                        <CphFlex
                            smallGap
                            column
                        >
                            <TcDataView
                                label={t('tcView.stdin')}
                                value={tc.stdin}
                                onBlur={(value) => {
                                    tc.stdin = {
                                        useFile: false,
                                        data: value,
                                    };
                                    emitUpdate();
                                }}
                                onChooseFile={() =>
                                    vscode.postMessage({
                                        type: 'chooseTcFile',
                                        idx,
                                        label: 'stdin',
                                    } satisfies ChooseTcFileMsg)
                                }
                                onToggleFile={() => {
                                    vscode.postMessage({
                                        type: 'toggleTcFile',
                                        idx,
                                        ext: 'in',
                                    } satisfies ToggleTcFileMsg);
                                }}
                            />
                            <TcDataView
                                label={t('tcView.answer')}
                                value={tc.answer}
                                onBlur={(value) => {
                                    tc.answer = {
                                        useFile: false,
                                        data: value,
                                    };
                                    emitUpdate();
                                }}
                                onChooseFile={() => {
                                    vscode.postMessage({
                                        type: 'chooseTcFile',
                                        idx,
                                        label: 'answer',
                                    } satisfies ChooseTcFileMsg);
                                }}
                                onToggleFile={() => {
                                    vscode.postMessage({
                                        type: 'toggleTcFile',
                                        idx,
                                        ext: 'ans',
                                    } satisfies ToggleTcFileMsg);
                                }}
                            />
                        </CphFlex>
                        {tc.result && (
                            <>
                                <Divider />
                                <CphFlex
                                    smallGap
                                    column
                                >
                                    <TcDataView
                                        label={t('tcView.stdout')}
                                        value={tc.result.stdout}
                                        readOnly={true}
                                        outputActions={{
                                            onSetAnswer: () => {
                                                tc.answer = tc.result!.stdout;
                                                tc.result = undefined;
                                                emitUpdate();
                                            },
                                            onCompare: () => {
                                                vscode.postMessage({
                                                    type: 'compareTc',
                                                    idx,
                                                } satisfies CompareTcMsg);
                                            },
                                        }}
                                        onToggleFile={() => {
                                            vscode.postMessage({
                                                type: 'toggleTcFile',
                                                idx,
                                                ext: 'out',
                                            } satisfies ToggleTcFileMsg);
                                        }}
                                    />
                                    <TcDataView
                                        label={t('tcView.stderr')}
                                        value={tc.result.stderr}
                                        readOnly={true}
                                        onToggleFile={() => {
                                            vscode.postMessage({
                                                type: 'toggleTcFile',
                                                idx,
                                                ext: 'err',
                                            } satisfies ToggleTcFileMsg);
                                        }}
                                    />
                                    <TcDataView
                                        label={t('tcView.message')}
                                        value={{
                                            useFile: false,
                                            data: tc.result.msg,
                                        }}
                                        readOnly={true}
                                    />
                                </CphFlex>
                            </>
                        )}
                    </CphFlex>
                </AccordionDetails>
            </Accordion>
        </ErrorBoundary>
    );
};

export default TcView;
