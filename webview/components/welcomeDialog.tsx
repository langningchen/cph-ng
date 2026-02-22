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

import CelebrationIcon from '@mui/icons-material/Celebration';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CphFlex } from './base/cphFlex';

const STORAGE_KEY = 'cph-ng-welcomed-version';
const COUNTDOWN_TOTAL = 10;

export const WelcomeDialog = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) !== version);
  const [countdown, setCountdown] = useState(COUNTDOWN_TOTAL);

  useEffect(() => {
    if (!open || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, countdown]);

  const canClose = countdown <= 0;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, version);
    setOpen(false);
  };

  return (
    <Dialog fullWidth maxWidth={false} open={open} disableEscapeKeyDown>
      {!canClose && (
        <LinearProgress
          variant='determinate'
          value={((COUNTDOWN_TOTAL - countdown) / COUNTDOWN_TOTAL) * 100}
        />
      )}
      <DialogTitle>
        <CphFlex alignItems='center' gap={1}>
          <CelebrationIcon color='primary' fontSize='small' />
          {t('welcomeDialog.title', { version })}
        </CphFlex>
      </DialogTitle>
      <DialogContent>
        <CphFlex column>
          <Typography variant='body2' color='primary' fontWeight='bold'>
            {t('welcomeDialog.subtitle')}
          </Typography>
          <Alert severity='warning' sx={{ width: '100%', boxSizing: 'border-box' }}>
            {t('welcomeDialog.refactorWarning')}
          </Alert>
          <Typography variant='body2'>{t('welcomeDialog.content')}</Typography>
          <Box>
            <Link
              href='https://github.com/langningchen/cph-ng/issues'
              target='_blank'
              rel='noreferrer'
              variant='body2'
            >
              {t('welcomeDialog.feedbackLink')}
            </Link>
          </Box>
        </CphFlex>
      </DialogContent>
      <DialogActions>
        <Button onClick={dismiss} disabled={!canClose} variant='contained' size='small'>
          {canClose
            ? t('welcomeDialog.close')
            : t('welcomeDialog.countdown', { seconds: countdown })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
