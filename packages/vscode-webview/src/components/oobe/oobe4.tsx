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

import ChatIcon from '@mui/icons-material/Chat';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SettingsIcon from '@mui/icons-material/Settings';
import StarIcon from '@mui/icons-material/Star';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import { useTranslation } from 'react-i18next';
import { OOBEPage } from '@/components/oobe/oobePage';
import { openLink, urls } from '@/utils';
import Oobe4Svg from './oobe-4.svg';

export interface Step4Props {
  onDone: () => void;
  onBack: () => void;
}

export function OobeStep4({ onBack, onDone }: Step4Props) {
  const { t } = useTranslation();

  const menus = [
    {
      icon: <MenuBookIcon />,
      label: t('oobe.step4.docs'),
      description: t('oobe.step4.docs.description'),
      url: urls.docs,
    },
    {
      icon: <SettingsIcon />,
      label: t('oobe.step4.openSettings'),
      description: t('oobe.step4.openSettings.description'),
      url: urls.settings,
    },
    {
      icon: <ChatIcon />,
      label: t('oobe.step4.joinQQ'),
      description: t('oobe.step4.joinQQ.description'),
      url: urls.joinQQ,
    },
    {
      icon: <StarIcon />,
      label: t('oobe.step4.source'),
      description: t('oobe.step4.source.description'),
      url: urls.github,
    },
  ];

  return (
    <OOBEPage
      svg={Oobe4Svg}
      title={t('oobe.step4.title')}
      subtitle={t('oobe.step4.subtitle')}
      step={4}
      totalSteps={4}
      onBack={onBack}
      onNext={onDone}
    >
      <Paper>
        <List disablePadding>
          {menus.map((menu) => (
            <ListItem key={menu.label} disablePadding>
              <ListItemButton onClick={() => openLink(menu.url)}>
                <ListItemIcon>{menu.icon}</ListItemIcon>
                <ListItemText primary={menu.label} secondary={menu.description} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Paper>
    </OOBEPage>
  );
}
