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

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import React, { useState } from 'react';
import CphButton from './cphButton';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import CphFlex from './base/cphFlex';
import CphText from './base/cphText';
import { OpenSettingsMsg, StartChatMsg } from '../msgs';
import TryIcon from '@mui/icons-material/Try';
import { useTranslation } from 'react-i18next';

type TipMessage = {
    msg: string;
    action?: () => void;
};

const Tips = () => {
    const { t } = useTranslation();
    const tipMessages: TipMessage[] = [
        { msg: t('tipMessage1') },
        { msg: t('tipMessage2') },
        { msg: t('tipMessage3') },
        {
            msg: t('tipMessage4'),
            action: () =>
                vscode.postMessage({ type: 'startChat' } as StartChatMsg),
        },
        { msg: t('tipMessage5') },
        {
            msg: t('tipMessage6'),
            action: () =>
                vscode.postMessage({
                    type: 'openSettings',
                    item: 'cph-ng.sidebar.showAcGif',
                } satisfies OpenSettingsMsg),
        },
        {
            msg: t('tipMessage7'),
            action: () =>
                vscode.postMessage({
                    type: 'openSettings',
                    item: 'cph-ng.sidebar.hiddenStatuses',
                } satisfies OpenSettingsMsg),
        },
        { msg: t('tipMessage8') },
        {
            msg: t('tipMessage9'),
            action: () =>
                vscode.postMessage({
                    type: 'openSettings',
                    item: 'cph-ng.compilation.useWrapper',
                } satisfies OpenSettingsMsg),
        },
    ];
    const [idx, setIdx] = useState(
        Math.floor(Math.random() * tipMessages.length),
    );
    return (
        <Alert
            sx={{
                'width': '100%',
                'boxSizing': 'border-box',
                '& > .MuiAlert-message': { flex: '1' },
            }}
            severity='info'
        >
            <AlertTitle>
                <CphFlex>
                    <CphText flex={1}>{t('tips.title')}</CphText>
                    <CphButton
                        icon={TryIcon}
                        name={t('tips.tryNow')}
                        disabled={!tipMessages[idx].action}
                        onClick={tipMessages[idx].action}
                    />
                    <CphButton
                        icon={NavigateBeforeIcon}
                        name={t('tips.previousTip')}
                        onClick={() =>
                            setIdx(
                                (idx - 1 + tipMessages.length) %
                                    tipMessages.length,
                            )
                        }
                    />
                    <CphButton
                        icon={ShuffleIcon}
                        name={t('tips.randomTip')}
                        onClick={() =>
                            setIdx(
                                Math.floor(Math.random() * tipMessages.length),
                            )
                        }
                    />
                    <CphButton
                        icon={NavigateNextIcon}
                        name={t('tips.nextTip')}
                        onClick={() => setIdx((idx + 1) % tipMessages.length)}
                    />
                </CphFlex>
            </AlertTitle>
            <CphText>
                #{idx + 1}. {tipMessages[idx].msg}
            </CphText>
        </Alert>
    );
};

export default Tips;
