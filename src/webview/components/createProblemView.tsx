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

import SendIcon from '@mui/icons-material/Send';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CreateProblemMessage } from '../messages';
import CphFlex from './cphFlex';

const CreateProblemView = () => {
    const { t } = useTranslation();
    return (
        <Container>
            <CphFlex
                column
                paddingY={2}
            >
                <Alert
                    sx={{ width: '100%', boxSizing: 'border-box' }}
                    variant={'outlined'}
                    severity={'warning'}
                >
                    {t('createProblemView.alert')}
                </Alert>
                <Button
                    fullWidth
                    variant={'contained'}
                    endIcon={<SendIcon />}
                    onClick={() => {
                        vscode.postMessage({
                            type: 'createProblem',
                        } as CreateProblemMessage);
                    }}
                >
                    {t('createProblemView.button')}
                </Button>
            </CphFlex>
        </Container>
    );
};

export default CreateProblemView;
