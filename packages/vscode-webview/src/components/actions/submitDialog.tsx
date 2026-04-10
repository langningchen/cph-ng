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

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface SubmitDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const SubmitDialog = memo(({ open, onClose, onConfirm }: SubmitDialogProps) => {
  const { t } = useTranslation();
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const frameId = requestAnimationFrame(() => {
      confirmButtonRef.current?.focus();
    });

    return () => cancelAnimationFrame(frameId);
  }, [open]);

  return (
    <Dialog fullWidth maxWidth={false} open={open} onClose={onClose}>
      <DialogTitle>{t('problemActions.submitDialog.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t('problemActions.submitDialog.content')}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color='primary'>
          {t('problemActions.submitDialog.cancel')}
        </Button>
        <Button ref={confirmButtonRef} onClick={onConfirm} color='primary' autoFocus>
          {t('problemActions.submitDialog.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
});
