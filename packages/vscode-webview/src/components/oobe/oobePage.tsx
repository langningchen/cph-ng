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
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { CphNgFlex } from '@/components/base/cphNgFlex';

interface OOBEPageProps {
  svg: string;
  title: string;
  subtitle: string;
  step: number;
  totalSteps: number;
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  onDone?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}

export function OOBEPage({
  svg,
  title,
  subtitle,
  step,
  totalSteps,
  children,
  onBack,
  onNext,
}: OOBEPageProps) {
  const { t } = useTranslation();

  return (
    <CphNgFlex column sx={{ height: '100%', boxSizing: 'border-box', p: 2, gap: 2 }}>
      <Box sx={{ flexGrow: 1, width: '100%', overflowY: 'auto' }}>
        <Typography variant='h5' sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
          {subtitle}
        </Typography>
        <CphNgFlex column>
          <img src={svg} alt={title} style={{ width: '100%', maxWidth: '400px' }} />
        </CphNgFlex>
        {children}
      </Box>

      <CphNgFlex sx={{ width: '100%' }}>
        <Button onClick={onBack}>{step === 1 ? t('oobe.skip') : t('oobe.back')}</Button>
        <LinearProgress variant='determinate' value={(step / totalSteps) * 100} sx={{ flex: 1 }} />
        <Button onClick={onNext}>{step === totalSteps ? t('oobe.done') : t('oobe.next')}</Button>
      </CphNgFlex>
    </CphNgFlex>
  );
}
