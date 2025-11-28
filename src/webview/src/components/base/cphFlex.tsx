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

import { BoxProps } from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import React from 'react';
import { delProps } from '../../utils';

interface CphFlexProps extends BoxProps {
  smallGap?: boolean;
  column?: boolean;
  alignStart?: boolean;
}

const CphFlex = (props: CphFlexProps) => {
  return (
    <Stack
      alignItems={props.alignStart ? 'flex-start' : 'center'}
      flexDirection={props.column ? 'column' : 'row'}
      gap={props.smallGap ? 0.5 : 1}
      width={'100%'}
      minWidth={0}
      {...delProps(props, ['smallGap', 'column', 'alignStart'])}
    >
      {props.children}
    </Stack>
  );
};

export default CphFlex;
