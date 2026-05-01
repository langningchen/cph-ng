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

import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { CphNgFlex } from '@/components/base/cphNgFlex';
import { CphNgLink } from '@/components/base/cphNgLink';
import { CphNgText } from '@/components/base/cphNgText';
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
      icon: <CloudDownloadIcon />,
      name: 'Competitive Companion',
      description: t('oobe.step3.cc.description'),
      links: [
        { label: 'Chrome / Edge', url: urls.companionChromeAddon },
        { label: 'Firefox', url: urls.companionFirefoxAddon },
      ],
    },
    {
      icon: <CloudUploadIcon />,
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
      <CphNgFlex column sx={{ gap: 0.5, alignItems: 'start' }}>
        <CphNgText>{t('oobe.step3.description')}</CphNgText>
        <CphNgLink name={t('oobe.step3.learnMore')} onClick={() => openLink(urls.addonDocs)}>
          {t('oobe.step3.learnMore')}
        </CphNgLink>
      </CphNgFlex>
      <CphNgFlex column sx={{ gap: 2, alignItems: 'stretch' }}>
        {extensions.map((ext) => (
          <Paper key={ext.name} sx={{ p: 2 }}>
            <CphNgFlex sx={{ gap: 2 }}>
              {ext.icon}
              <CphNgFlex column sx={{ alignItems: 'start', flexGrow: 1 }}>
                <CphNgText sx={{ fontWeight: 'bold' }}>{ext.name}</CphNgText>
                <CphNgText variant='caption'>{ext.description}</CphNgText>
                <CphNgFlex>
                  {ext.links.map((link) => (
                    <Chip
                      key={link.label}
                      label={link.label}
                      size='small'
                      variant='outlined'
                      onClick={() => {
                        openLink(link.url);
                      }}
                      icon={<OpenInNewIcon />}
                      clickable
                    />
                  ))}
                </CphNgFlex>
              </CphNgFlex>
            </CphNgFlex>
          </Paper>
        ))}
      </CphNgFlex>
      <Typography variant='caption'>{t('oobe.step3.bothOptional')}</Typography>

      <Alert severity='info' sx={{ mt: 2 }}>
        {t('oobe.step3.chromeNote')}
      </Alert>
    </OOBEPage>
  );
}
