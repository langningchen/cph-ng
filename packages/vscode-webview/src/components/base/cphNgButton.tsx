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

import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import type SvgIcon from '@mui/material/SvgIcon';
import { CphNgTooltip } from '@w/components/base/cphNgTooltip';
import { deleteProps } from '@w/utils';
import React from 'react';

interface CphNgButtonProps extends IconButtonProps {
  icon: typeof SvgIcon;
  name: string;
  larger?: boolean;
}

export const CphNgButton = (props: CphNgButtonProps) => {
  return (
    <CphNgTooltip title={props.name}>
      <IconButton
        color='primary'
        size={props.larger ? 'medium' : 'small'}
        {...deleteProps(props, ['icon', 'name', 'larger'])}
      >
        <props.icon fontSize='small' />
      </IconButton>
    </CphNgTooltip>
  );
};
