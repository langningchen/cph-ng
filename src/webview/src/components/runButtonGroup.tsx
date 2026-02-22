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

import BoltIcon from '@mui/icons-material/Bolt';
import FastForwardIcon from '@mui/icons-material/FastForward';
import { type IconButtonProps, Popover } from '@mui/material';
import Box from '@mui/material/Box';
import type SvgIcon from '@mui/material/SvgIcon';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CphFlex } from '@/webview/src/components/base/cphFlex';
import { getCompile } from '../utils';
import { CphButton } from './cphButton';

interface RunButtonGroupProps {
  icon: typeof SvgIcon;
  name: string;
  larger?: boolean;
  color: IconButtonProps['color'];
  disabled?: boolean;
  onRun: (forceCompile: boolean | null) => void;
}

export const RunButtonGroup = ({
  icon,
  name,
  larger,
  color,
  disabled,
  onRun,
}: RunButtonGroupProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);

  const actions = [
    {
      icon: BoltIcon,
      label: t('runButtonGroup.forceCompile'),
      color: 'warning' as const,
      bgColor: 'warning.main',
      onClick: () => onRun(true),
    },
    {
      icon: FastForwardIcon,
      label: t('runButtonGroup.skipCompile'),
      color: 'info' as const,
      bgColor: 'info.main',
      onClick: () => onRun(false),
    },
  ];

  return (
    <Box
      ref={(el: HTMLDivElement | null) => setAnchorEl(el)}
      onMouseEnter={() => {
        if (!disabled) setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
      sx={{ display: 'inline-flex' }}
    >
      <CphButton
        icon={icon}
        name={name}
        larger={larger}
        color={color}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(false);
          onRun(getCompile(e));
        }}
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        sx={{ pointerEvents: 'none' }}
        slotProps={{ paper: { sx: { pointerEvents: 'auto' } } }}
      >
        <CphFlex>
          {actions.map((action) => (
            <CphButton
              key={action.label}
              icon={action.icon}
              name={action.label}
              larger={larger}
              color={action.color}
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
            />
          ))}
        </CphFlex>
      </Popover>
    </Box>
  );
};
