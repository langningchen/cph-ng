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

import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CphNgFlex } from '@/components/base/cphNgFlex';

export const oobe4 = () => {
  const { t } = useTranslation();
  const [value, setValue] = useState('edge');

  const handleChange = (_event: SyntheticEvent, newValue: string) => {
    setValue(newValue);
  };

  return (
    <CphNgFlex alignStart column sx={{ gap: 2, key: 4 }}>
      <Typography variant='h5'>{t('oobe.step4.title')}</Typography>
      <Typography variant='subtitle2'>{t('oobe.step4.subtitle')}</Typography>
      <Box>CPH-NG works with both CPH-NG Submit and Competitive Companion.</Box>
      <List sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }} dense>
        <ListSubheader>CPH-NG Submit</ListSubheader>
        <ListItemButton>
          <ListItemText primary='Edge' />
        </ListItemButton>
        <ListItemButton>
          <ListItemText primary='Firefox' />
        </ListItemButton>
        <ListSubheader>Competitive Companion</ListSubheader>
        <ListItemButton>
          <ListItemText primary='Chrome' />
        </ListItemButton>
        <ListItemButton>
          <ListItemText primary='Firefox' />
        </ListItemButton>
      </List>
      <TabContext value={value}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={handleChange} aria-label='lab API tabs example'>
            <Tab label={t('oobe.step4.edge')} value='edge' />
            <Tab label={t('oobe.step4.firefox')} value='firefox' />
            <Tab label={t('oobe.step4.chrome')} value='chrome' />
          </TabList>
        </Box>
        <TabPanel sx={{ p: 2 }} value='edge'>
          <Typography>{t('oobe.step4.edge.description')}</Typography>
        </TabPanel>
        <TabPanel sx={{ p: 2 }} value='firefox'>
          <Typography>{t('oobe.step4.firefox.description')}</Typography>
        </TabPanel>
        <TabPanel sx={{ p: 2 }} value='chrome'>
          <Typography>{t('oobe.step4.chrome.description')}</Typography>
        </TabPanel>
      </TabContext>
      <Card>
        <CardContent>
          <Typography variant='h6'>{t('oobe.step4.firefox')}</Typography>
          <Typography variant='body2'>{t('oobe.step4.firefox.description')}</Typography>
        </CardContent>
      </Card>
    </CphNgFlex>
  );
};
