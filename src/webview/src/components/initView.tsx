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

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { useTranslation } from 'react-i18next';
import CphFlex from './base/cphFlex';
import CphText from './base/cphText';

const InitView = () => {
    const { t } = useTranslation();
    return (
        <Box
            flex={1}
            width={'100%'}
        >
            <CphFlex
                column
                height={'100%'}
                justifyContent={'center'}
                gap={2}
            >
                <CircularProgress />
                <CphText
                    fontWeight={'bold'}
                    fontSize={'bigger'}
                >
                    {t('initView.message')}
                </CphText>
            </CphFlex>
        </Box>
    );
};

export default InitView;
