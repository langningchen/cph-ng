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
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { CphNgFlex } from '@w/components/base/cphNgFlex';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'cph-ng-welcomed-version';

export const WelcomeDialog = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) !== version);

  return (
    <Dialog fullWidth maxWidth={false} open={open} disableEscapeKeyDown>
      <DialogTitle>
        <CphNgFlex alignItems='center' gap={1}>
          <CelebrationIcon color='primary' fontSize='small' />
          {t('welcomeDialog.title', { version })}
        </CphNgFlex>
      </DialogTitle>
      <DialogContent>
        <CphNgFlex column>
          <Typography variant='body2' color='primary' fontWeight='bold'>
            {t('welcomeDialog.subtitle')}
          </Typography>
          <Alert severity='warning' sx={{ width: '100%', boxSizing: 'border-box' }}>
            {t('welcomeDialog.refactorWarning')}
          </Alert>
          <Typography variant='body2'>{t('welcomeDialog.content')}</Typography>
          <Alert severity='info' sx={{ width: '100%', boxSizing: 'border-box' }}>
            {t('welcomeDialog.contactUs')}
          </Alert>
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
        </CphNgFlex>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, version);
            setOpen(false);
          }}
          variant='contained'
          size='small'
        >
          {t('welcomeDialog.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
