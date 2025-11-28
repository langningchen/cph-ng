// Copyright (C) 2025 Langning Chen
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

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import ErrorIcon from '@mui/icons-material/Error';
import ReplayIcon from '@mui/icons-material/Replay';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import CphButton from '../cphButton';
import CphFlex from './cphFlex';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

const ErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <CphFlex>
        <CphButton
          icon={ErrorIcon}
          name={'Error'}
          color={'error'}
          onClick={() => {
            setOpen(true);
          }}
        />
        <CphButton
          icon={ReplayIcon}
          name={'Retry'}
          color={'warning'}
          onClick={resetErrorBoundary}
        />
      </CphFlex>
      <Dialog
        fullWidth
        maxWidth={false}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        <DialogTitle>{t('errorBoundary.title')}</DialogTitle>
        <DialogContent>
          <CphFlex column>
            <Typography>{t('errorBoundary.description')}</Typography>
            <Accordion sx={{ width: '100%' }}>
              <AccordionSummary>{t('errorBoundary.details')}</AccordionSummary>
              <AccordionDetails>
                <Box
                  component='pre'
                  overflow={'scroll'}
                >
                  {error.stack}
                </Box>
              </AccordionDetails>
            </Accordion>
          </CphFlex>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDialog: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, showDialog: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  resetBoundary = () => {
    this.setState({ hasError: false, error: null }, () => {
      this.forceUpdate();
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetErrorBoundary={this.resetBoundary}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
