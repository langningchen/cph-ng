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

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CphNgText } from '@/components/base/cphNgText';
import { OOBEPage } from '@/components/oobe/oobePage';
import { useOobe } from '@/context/OobeContext';
import Oobe1Svg from './oobe-1.svg';

export interface Step1Props {
  language: string;
  setLanguage: (language: string) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function OobeStep1({ language, setLanguage, onNext, onSkip }: Step1Props) {
  const { t } = useTranslation();
  const { state, getLanguageList } = useOobe();

  useEffect(() => {
    getLanguageList();
  }, [getLanguageList]);

  return (
    <OOBEPage
      svg={Oobe1Svg}
      title={t('oobe.step1.title')}
      subtitle={t('oobe.step1.subtitle')}
      step={1}
      totalSteps={4}
      onBack={onSkip}
      onNext={() => onNext()}
    >
      <Box>
        <CphNgText>{t('oobe.step1.description')}</CphNgText>
      </Box>
      <Paper>
        <RadioGroup value={language} onChange={(_, v) => setLanguage(v)}>
          {state.languages ? (
            <List disablePadding>
              {Object.entries(state.languages).map(([language, info]) => (
                <ListItem disablePadding key={language}>
                  <ListItemButton onClick={() => setLanguage(language)}>
                    <Radio value={language} size='small' sx={{ mr: 1 }} />
                    <ListItemText
                      primary={language}
                      secondary={[
                        info.configs.compiler ? t('oobe.step1.compiler') : '',
                        info.configs.interpreter ? t('oobe.step1.interpreter') : '',
                      ]
                        .join('  ')
                        .trim()}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ) : (
            <CircularProgress />
          )}
        </RadioGroup>
      </Paper>

      <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1.5 }}>
        {t('oobe.step1.addMoreLater')}
      </Typography>
    </OOBEPage>
  );
}
