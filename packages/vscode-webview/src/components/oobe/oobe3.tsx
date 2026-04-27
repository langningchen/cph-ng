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

import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CphNgFlex } from '@/components/base/cphNgFlex';

const languageList = ['C++', 'Java', 'Python', 'JavaScript', 'Go'];
type Language = (typeof languageList)[number];
const languages: Language[] = languageList;

export const oobe3 = () => {
  const { t } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(languages[0]);

  return (
    <CphNgFlex alignStart column sx={{ gap: 2, key: 4 }}>
      <Typography variant='h5'>{t('oobe.step3.title')}</Typography>
      <Typography variant='subtitle2'>{t('oobe.step3.subtitle')}</Typography>
      <FormControl fullWidth>
        <InputLabel>{t('oobe.step3.language')}</InputLabel>
        <Select
          value={selectedLanguage}
          label={t('oobe.step3.language')}
          onChange={(e) => setSelectedLanguage(e.target.value as Language)}
        >
          {languages.map((language) => (
            <MenuItem key={language} value={language}>
              {language}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Typography variant='caption'>{t('oobe.step3.notFound')}</Typography>
    </CphNgFlex>
  );
};
