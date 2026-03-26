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

import BugReportIcon from '@mui/icons-material/BugReport';
import DescriptionIcon from '@mui/icons-material/Description';
import ExtensionIcon from '@mui/icons-material/Extension';
import GitHubIcon from '@mui/icons-material/GitHub';
import GroupIcon from '@mui/icons-material/Group';
import HelpIcon from '@mui/icons-material/Help';
import { Divider, ListItemIcon, Menu, MenuItem } from '@mui/material';
import { CphNgButton } from '@w/components/base/cphNgButton';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const openLink = (url: string) => () => {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const HelpButton = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    setOpen((prev) => !prev);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <CphNgButton
        ref={anchorRef}
        icon={HelpIcon}
        name={t('support.help')}
        onClick={handleClick}
        larger
      />

      <Menu anchorEl={anchorRef.current} open={open} onClose={handleClose}>
        <MenuItem onClick={openLink('https://github.com/langningchen/cph-ng')}>
          <ListItemIcon>
            <GitHubIcon fontSize='small' />
          </ListItemIcon>
          {t('support.github')}
        </MenuItem>
        <MenuItem onClick={openLink('https://github.com/langningchen/cph-ng/issues')}>
          <ListItemIcon>
            <BugReportIcon fontSize='small' />
          </ListItemIcon>
          {t('support.feedback')}
        </MenuItem>
        <MenuItem onClick={openLink('https://deepwiki.com/langningchen/cph-ng')}>
          <ListItemIcon>
            <DescriptionIcon fontSize='small' />
          </ListItemIcon>
          {t('support.docs')}
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={openLink(
            'https://microsoftedge.microsoft.com/addons/detail/cphng-submit/hfpfdaggmljfccmnfljldojbgfhpfomb',
          )}
        >
          <ListItemIcon>
            <ExtensionIcon fontSize='small' />
          </ListItemIcon>
          {t('support.edgeAddon')}
        </MenuItem>
        <MenuItem onClick={openLink('https://addons.mozilla.org/firefox/addon/cph-ng-submit/')}>
          <ListItemIcon>
            <ExtensionIcon fontSize='small' />
          </ListItemIcon>
          {t('support.firefoxAddon')}
        </MenuItem>
        <Divider />
        <MenuItem onClick={openLink('https://qm.qq.com/q/pXStina3jU')}>
          <ListItemIcon>
            <GroupIcon fontSize='small' />
          </ListItemIcon>
          {t('support.joinQQ')}
        </MenuItem>
      </Menu>
    </>
  );
};
