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

import IconButton, { type IconButtonOwnProps } from '@mui/material/IconButton';
import type SvgIcon from '@mui/material/SvgIcon';
import type { SxProps, Theme } from '@mui/material/styles';
import { forwardRef, type MouseEventHandler } from 'react';
import { CphNgTooltip } from '@/components/base/cphNgTooltip';

interface CphNgButtonProps {
  sx?: SxProps<Theme>;
  icon: typeof SvgIcon;
  name: string;
  color?: IconButtonOwnProps['color'];
  larger?: boolean;
  onClick?: MouseEventHandler;
  disabled?: boolean;
}

export const CphNgButton = forwardRef<HTMLButtonElement, CphNgButtonProps>((props, ref) => (
  <CphNgTooltip title={props.name}>
    <IconButton
      ref={ref}
      color={props.color ?? 'primary'}
      size={props.larger ? 'medium' : 'small'}
      onClick={props.onClick}
      disabled={props.disabled}
      sx={props.sx}
    >
      <props.icon fontSize='small' />
    </IconButton>
  </CphNgTooltip>
));
