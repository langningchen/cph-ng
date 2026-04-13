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

import { t } from '@b/i18n';
import { onMessage, type StatusResponse, sendMessage } from '@b/messaging';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';

const theme = createTheme({ palette: { mode: 'dark' } });

interface SubmitLog {
  submissionId: string;
  success: boolean;
  message: string;
  timestamp: number;
}

const PopupInner = () => {
  const [status, setStatus] = useState<StatusResponse>({
    connected: false,
    isActive: false,
    port: 27121,
  });
  const [portInput, setPortInput] = useState('27121');
  const [logs, setLogs] = useState<SubmitLog[]>([]);

  useEffect(() => {
    sendMessage('getStatus', undefined).then((res) => {
      setStatus(res);
      setPortInput(String(res.port));
    });

    const removeStatusUpdate = onMessage('statusUpdate', ({ data }) => {
      setStatus({ connected: data.connected, isActive: data.isActive, port: data.port });
    });
    const removeSubmitResult = onMessage('submitResult', ({ data }) => {
      setLogs((prev) =>
        [
          {
            submissionId: data.submissionId,
            success: data.success,
            message: data.message,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, 20),
      );
    });

    return () => {
      removeStatusUpdate();
      removeSubmitResult();
    };
  }, []);

  const handleConnect = useCallback(() => {
    sendMessage('connect', undefined);
  }, []);
  const handleDisconnect = useCallback(() => {
    sendMessage('disconnect', undefined);
  }, []);
  const handleActivate = useCallback(() => {
    sendMessage('setActive', undefined);
  }, []);

  const handleSetPort = useCallback(() => {
    const port = Number.parseInt(portInput, 10);
    if (port > 0 && port < 65536) {
      sendMessage('setPort', { port });
    }
  }, [portInput]);

  return (
    <Box sx={{ width: 320, p: 1.5 }}>
      <Box sx={{ pb: 2 }}>
        <Typography variant='h6'>
          {t('appTitle')}
          <Chip
            label={
              status.connected
                ? status.isActive
                  ? t('statusConnected')
                  : t('statusInactive')
                : t('statusDisconnected')
            }
            color={status.connected ? (status.isActive ? 'success' : 'warning') : 'error'}
            size='small'
            variant='outlined'
            sx={{ marginLeft: 2 }}
          />
        </Typography>
      </Box>

      <Box>
        <Stack direction='row' sx={{ gap: 1 }}>
          <TextField
            label={t('labelPort')}
            type='number'
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            size='small'
            slotProps={{ htmlInput: { min: 1, max: 65535 } }}
            sx={{ width: 110 }}
          />
          <Button variant='outlined' onClick={handleSetPort}>
            {t('btnSet')}
          </Button>
        </Stack>

        <Stack direction='row' spacing={1} sx={{ mt: 1 }}>
          {status.connected ? (
            <Button variant='contained' color='error' size='small' onClick={handleDisconnect}>
              {t('btnDisconnect')}
            </Button>
          ) : (
            <Button variant='contained' color='primary' size='small' onClick={handleConnect}>
              {t('btnConnect')}
            </Button>
          )}
          {status.connected && !status.isActive && (
            <Button variant='contained' color='warning' size='small' onClick={handleActivate}>
              {t('btnActivate')}
            </Button>
          )}
        </Stack>
      </Box>

      {logs.length > 0 && (
        <>
          <Divider />
          <Typography variant='subtitle2' sx={{ color: 'text.secondary' }}>
            {t('recentSubmissions')}
          </Typography>
          <List dense disablePadding>
            {logs.map((log) => (
              <ListItem
                key={`${log.submissionId}-${log.timestamp}`}
                disablePadding
                sx={{ py: 0.25 }}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  {log.success ? (
                    <CheckCircleIcon fontSize='small' color='success' />
                  ) : (
                    <ErrorIcon fontSize='small' color='error' />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={log.message}
                  slotProps={{
                    primary: {
                      variant: 'body2',
                      noWrap: true,
                      title: log.message,
                    },
                  }}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Box>
  );
};

export const Popup = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <PopupInner />
  </ThemeProvider>
);
