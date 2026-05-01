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

import Stack from '@mui/material/Stack';
import type { SxProps, Theme } from '@mui/material/styles';
import type { MouseEventHandler } from 'react';

interface CphNgFlexProps {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
  column?: boolean;
  onClick?: MouseEventHandler;
}

export const CphNgFlex = (props: CphNgFlexProps) => {
  return (
    <Stack
      onClick={props.onClick}
      sx={{
        alignItems: 'center',
        flexDirection: props.column ? 'column' : 'row',
        gap: 1,
        width: '100%',
        minWidth: 0,
        ...props.sx,
      }}
    >
      {props.children}
    </Stack>
  );
};
