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

import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { CphNgFlex } from '@/components/base/cphNgFlex';
import { openLink, urls } from '@/utils';

export const oobe5 = () => {
  const { t } = useTranslation();

  return (
    <CphNgFlex alignStart column sx={{ gap: 2, key: 5 }}>
      <Typography variant='h5'>{t('oobe.step5.title')}</Typography>
      <Typography variant='subtitle2'>{t('oobe.step5.subtitle')}</Typography>
      <Paper>
        <List>
          <ListItem disablePadding onClick={openLink(urls.joinQQ)}>
            <ListItemButton>
              <ListItemText
                primary={t('oobe.step5.joinQQ')}
                secondary={t('oobe.step5.joinQQ.description')}
              />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding onClick={openLink(urls.github)}>
            <ListItemButton>
              <ListItemText
                primary={t('oobe.step5.source')}
                secondary={t('oobe.step5.source.description')}
              />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding onClick={openLink(urls.settings)}>
            <ListItemButton>
              <ListItemText
                primary={t('oobe.step5.openSettings')}
                secondary={t('oobe.step5.openSettings.description')}
              />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding onClick={openLink(urls.docs)}>
            <ListItemButton>
              <ListItemText
                primary={t('oobe.step5.docs')}
                secondary={t('oobe.step5.docs.description')}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Paper>
    </CphNgFlex>
  );
};
