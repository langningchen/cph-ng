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

import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { OOBEPage } from '@/components/oobe/oobePage';
import { openLink, urls } from '@/utils';
import Oobe3Svg from './oobe-3.svg';

export interface Step3Props {
  onNext: () => void;
  onBack: () => void;
}

export function OobeStep3({ onBack, onNext }: Step3Props) {
  const { t } = useTranslation();

  const extensions = [
    {
      emoji: '📥',
      name: 'Competitive Companion',
      description: t('oobe.step3.cc.description'),
      links: [
        { label: 'Chrome / Edge', url: urls.companionChromeAddon },
        { label: 'Firefox', url: urls.companionFirefoxAddon },
      ],
    },
    {
      emoji: '📤',
      name: 'CPH-NG Submit',
      description: t('oobe.step3.submit.description'),
      links: [
        { label: 'Edge', url: urls.edgeAddon },
        { label: 'Firefox', url: urls.firefoxAddon },
      ],
    },
  ];

  return (
    <OOBEPage
      svg={Oobe3Svg}
      title={t('oobe.step3.title')}
      subtitle={t('oobe.step3.subtitle')}
      step={3}
      totalSteps={4}
      onBack={onBack}
      onNext={onNext}
    >
      <Stack spacing={2}>
        {extensions.map((ext) => (
          <Paper key={ext.name} variant='outlined' sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction='row' spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <Typography variant='h6'>{ext.emoji}</Typography>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
                  {ext.name}
                </Typography>
                <Typography
                  variant='caption'
                  color='text.secondary'
                  sx={{ display: 'block', mt: 0.5, mb: 1 }}
                >
                  {ext.description}
                </Typography>
                <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {ext.links.map((link) => (
                    <Chip
                      key={link.label}
                      label={link.label}
                      size='small'
                      variant='outlined'
                      onClick={() => {
                        openLink(link.url);
                      }}
                      icon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                      clickable
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Paper>
        ))}

        <Typography variant='caption' color='text.secondary' sx={{ textAlign: 'center' }}>
          {t('oobe.step3.bothOptional')}
        </Typography>
      </Stack>
    </OOBEPage>
  );
}
