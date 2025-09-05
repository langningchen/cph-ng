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

import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ClearIcon from '@mui/icons-material/Clear';
import ChangeCircleIcon from '@mui/icons-material/ChangeCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DifferenceIcon from '@mui/icons-material/Difference';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { AnserJsonEntry, ansiToJson } from 'anser';
import React, { CSSProperties, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TextareaAutosize from 'react-textarea-autosize';
import { OpenFileMsg } from '../msgs';
import { basename } from '../utils';
import CphButton from './cphButton';
import CphFlex from './base/cphFlex';
import CphLink from './base/cphLink';
import CphText from './base/cphText';
import { TCIO } from '../../utils/types';
import ErrorBoundary from './base/errorBoundary';

interface OutputActions {
    onSetAnswer: () => void;
    onCompare: () => void;
}

interface CodeMirrorSectionProps {
    label: string;
    value: TCIO;
    onBlur?: (value: string) => void;
    onChooseFile?: () => void;
    onToggleFile?: () => void;
    outputActions?: OutputActions;
    readOnly?: boolean;
}

const ansiToReact = (ansi: string) => {
    return (
        <div
            contentEditable
            suppressContentEditableWarning={true}
            onCut={(e) => e.preventDefault()}
            onPaste={(e) => e.preventDefault()}
            onBeforeInput={(e) => e.preventDefault()}
            style={{ cursor: 'text', outline: 'none' }}
        >
            {ansiToJson(ansi).map((entry: AnserJsonEntry, idx: number) => {
                const styles: CSSProperties = {
                    color: `rgb(${entry.fg})`,
                    backgroundColor: `rgb(${entry.bg})`,
                };
                for (const decoration of entry.decorations) {
                    if (decoration === 'bold') {
                        styles.fontWeight = 'bold';
                    } else if (decoration === 'dim') {
                        styles.opacity = 0.5;
                    } else if (decoration === 'italic') {
                        styles.fontStyle = 'italic';
                    } else if (decoration === 'underline') {
                        styles.textDecoration =
                            `${styles.textDecoration} underline`.trim();
                    } else if (decoration === 'blink') {
                        styles.animation = 'blink 1s infinite';
                    } else if (decoration === 'reverse') {
                        [styles.color, styles.backgroundColor] = [
                            styles.backgroundColor,
                            styles.color,
                        ];
                    } else if (decoration === 'hidden') {
                        styles.visibility = 'hidden';
                    } else if (decoration === 'strikethrough') {
                        styles.textDecoration =
                            `${styles.textDecoration} line-through`.trim();
                    }
                }
                return (
                    <span
                        key={idx}
                        style={styles}
                    >
                        {entry.content}
                    </span>
                );
            })}
        </div>
    );
};

const TcDataView = ({
    label,
    value,
    onBlur,
    onChooseFile,
    onToggleFile,
    outputActions,
    readOnly,
}: CodeMirrorSectionProps) => {
    const { t } = useTranslation();
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(value);

    useEffect(() => {
        setInternalValue(value);
    }, [value]);

    const handleCloseSnackbar = () => {
        setSnackbarOpen(false);
    };

    const commonStyle: CSSProperties = {
        fontFamily,
        width: '100%',
        overflow: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(127, 127, 127, 0.5) transparent',
        color: 'unset',
        backgroundColor: 'rgba(127, 127, 127, 0.1)',
        border: 'solid 2px rgba(127, 127, 127, 0.2)',
        borderRadius: '4px',
        padding: '4px',
        boxSizing: 'border-box',
        whiteSpace: 'pre',
        outline: 'none',
    };

    if (!value.useFile && !value.data && readOnly) {
        return <></>;
    }
    return (
        <ErrorBoundary>
            <CphFlex
                column
                smallGap
            >
                <CphFlex justifyContent={'space-between'}>
                    <CphFlex
                        flex={1}
                        flexWrap={'wrap'}
                    >
                        <CphText>{label}</CphText>
                        {internalValue.useFile && (
                            <CphLink
                                name={internalValue.path}
                                onClick={() => {
                                    vscode.postMessage({
                                        type: 'openFile',
                                        path: internalValue.path,
                                    } satisfies OpenFileMsg);
                                }}
                            >
                                {basename(internalValue.path)}
                            </CphLink>
                        )}
                    </CphFlex>
                    {outputActions && (
                        <CphButton
                            name={t('tcDataView.compare')}
                            icon={DifferenceIcon}
                            onClick={outputActions.onCompare}
                        />
                    )}
                    {onToggleFile && (
                        <CphButton
                            name={t('tcDataView.toggleFile')}
                            icon={ChangeCircleIcon}
                            onClick={onToggleFile}
                        />
                    )}
                    {internalValue.useFile ? (
                        readOnly || (
                            <CphButton
                                name={t('tcDataView.clearFile')}
                                icon={ClearIcon}
                                onClick={() => onBlur && onBlur('')}
                            />
                        )
                    ) : (
                        <>
                            {readOnly || (
                                <CphButton
                                    name={t('tcDataView.loadFile')}
                                    icon={FileOpenIcon}
                                    onClick={onChooseFile}
                                />
                            )}
                            {outputActions && (
                                <CphButton
                                    name={t('tcDataView.setAnswer')}
                                    icon={ArrowUpwardIcon}
                                    onClick={outputActions.onSetAnswer}
                                />
                            )}
                            <CphButton
                                name={t('tcDataView.copy')}
                                icon={ContentCopyIcon}
                                onClick={() => {
                                    navigator.clipboard
                                        .writeText(internalValue.data)
                                        .then(() => {
                                            setSnackbarOpen(true);
                                        })
                                        .catch((e) => {
                                            console.error(
                                                'Failed to copy code: ',
                                                e,
                                            );
                                        });
                                }}
                            />
                        </>
                    )}
                </CphFlex>
                {internalValue.useFile ||
                    (readOnly ? (
                        <div
                            style={{
                                ...commonStyle,
                                maxHeight: '20em',
                            }}
                        >
                            {ansiToReact(internalValue.data)}
                        </div>
                    ) : (
                        <TextareaAutosize
                            value={internalValue.data}
                            onChange={(e) =>
                                setInternalValue({
                                    useFile: false,
                                    data: e.target.value,
                                })
                            }
                            onBlur={(e) => onBlur && onBlur(e.target.value)}
                            maxRows={10}
                            style={
                                {
                                    ...commonStyle,
                                    resize: 'none',
                                } as any
                            }
                        />
                    ))}
                <Snackbar
                    open={snackbarOpen}
                    autoHideDuration={3000}
                    onClose={handleCloseSnackbar}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert
                        onClose={handleCloseSnackbar}
                        severity={'success'}
                        variant={'filled'}
                        sx={{ width: '100%' }}
                    >
                        {t('tcDataView.snackbar.message')}
                    </Alert>
                </Snackbar>
            </CphFlex>
        </ErrorBoundary>
    );
};

export default TcDataView;
