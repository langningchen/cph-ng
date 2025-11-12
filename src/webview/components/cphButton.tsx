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

import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import SvgIcon from '@mui/material/SvgIcon';
import Tooltip from '@mui/material/Tooltip';
import React from 'react';
import { delProps } from '../utils';

interface CphButtonProps extends IconButtonProps {
    icon: typeof SvgIcon;
    name: string;
    larger?: boolean;
}

const CphButton = (props: CphButtonProps) => {
    return (
        <Tooltip title={props.name}>
            <IconButton
                color={'primary'}
                size={props.larger ? 'medium' : 'small'}
                {...delProps(props, ['icon', 'name', 'larger'])}
            >
                <props.icon fontSize={'small'} />
            </IconButton>
        </Tooltip>
    );
};

export default CphButton;
