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

import Link from '@mui/material/Link';
import type { SxProps, Theme } from '@mui/material/styles';
import type { MouseEventHandler } from 'react';
import { CphNgTooltip } from '@/components/base/cphNgTooltip';

interface CphNgLinkProps {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
  name: string;
  onClick?: MouseEventHandler;
}

export const CphNgLink = (props: CphNgLinkProps) => {
  return (
    <CphNgTooltip title={props.name}>
      <Link
        href='#'
        underline='hover'
        onClick={props.onClick}
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', ...props.sx }}
      >
        {props.children}
      </Link>
    </CphNgTooltip>
  );
};
