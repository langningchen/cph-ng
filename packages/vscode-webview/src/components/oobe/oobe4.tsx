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

import type { ILanguageDefaultValues } from '@cph-ng/core';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { OOBEPage } from '@/components/oobe/oobePage';
import { openLink, urls } from '@/utils';
import Oobe4Svg from './oobe-4.svg';

export interface Step4Props {
  config: {
    language: string;
    languageConfig: ILanguageDefaultValues;
  };
  onDone: () => void;
  onBack: () => void;
}

export function OobeStep4({ config, onBack, onDone }: Step4Props) {
  const { t } = useTranslation();

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
      <Stack spacing={2}>
        <Paper variant='outlined' sx={{ p: 2, borderRadius: 2 }}>
          <Stack spacing={1}>
            <SummaryRow label={t('oobe.step4.language')} value={config.language} />
            <SummaryRow
              label={t('oobe.step4.compiler')}
              value={config.languageConfig.compiler || ''}
            />
            <SummaryRow
              label={t('oobe.step4.flags')}
              value={config.languageConfig.compilerArgs || ''}
              mono
            />
          </Stack>
        </Paper>

        <Paper variant='outlined' sx={{ borderRadius: 2 }}>
          <List disablePadding>
            <LinkItem
              icon='📖'
              primary={t('oobe.step4.docs')}
              secondary={t('oobe.step4.docs.description')}
              url={urls.docs}
            />
            <Divider />
            <LinkItem
              icon='⚙️'
              primary={t('oobe.step4.openSettings')}
              secondary={t('oobe.step4.openSettings.description')}
              url={urls.settings}
            />
            <Divider />
            <LinkItem
              icon='💬'
              primary={t('oobe.step4.joinQQ')}
              secondary={t('oobe.step4.joinQQ.description')}
              url={urls.joinQQ}
            />
            <Divider />
            <LinkItem
              icon='⭐'
              primary={t('oobe.step4.source')}
              secondary={t('oobe.step4.source.description')}
              url={urls.github}
            />
          </List>
        </Paper>
      </Stack>
    </OOBEPage>
  );
}

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Stack direction='row' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant='caption' color='text.secondary'>
        {label}
      </Typography>
      <Typography
        variant='caption'
        sx={{
          fontWeight: 600,
          ...(mono && {
            fontFamily: 'var(--vscode-editor-font-family)',
          }),
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function LinkItem({
  icon,
  primary,
  secondary,
  url,
}: {
  icon: string;
  primary: string;
  secondary: string;
  url: string;
}) {
  return (
    <ListItem disablePadding>
      <ListItemButton onClick={() => openLink(url)}>
        <Typography sx={{ mr: 1.5, fontSize: 18 }}>{icon}</Typography>
        <ListItemText
          primary={primary}
          secondary={secondary}
          slotProps={{
            primary: { sx: { variant: 'body2', fontWeight: 600 } },
            secondary: { sx: { variant: 'caption' } },
          }}
        />
      </ListItemButton>
    </ListItem>
  );
}
