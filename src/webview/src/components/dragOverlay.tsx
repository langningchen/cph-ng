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

import DownloadIcon from '@mui/icons-material/Download';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import Backdrop from '@mui/material/Backdrop';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { basename, msg } from '../utils';
import CphFlex from './base/cphFlex';

const DragOverlay = () => {
  const { t } = useTranslation();
  const [dragData, setDragData] = useState<string[] | null | undefined>(null);

  const onDragOver = (e: DragEvent) =>
    e.dataTransfer?.types.includes('text/uri-list') && setDragData(undefined);
  const onDrop = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('text/uri-list')) {
      return;
    }
    const items: string[] = [];
    for (const item of e.dataTransfer
      .getData('text/plain')
      .replaceAll('\r', '')
      .split('\n') || []) {
      items.push(item);
    }
    if (!items.length) {
      setDragData(null);
    } else {
      setDragData(items);
      msg({ type: 'dragDrop', items });
      setTimeout(() => setDragData(null), 1000);
    }
  };
  const onDragLeave = (e: DragEvent) =>
    (e.x >= 0 &&
      e.x <= window.innerWidth &&
      e.y >= 0 &&
      e.y <= window.innerHeight) ||
    setDragData(null);

  useEffect(() => {
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragleave', onDragLeave);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragleave', onDragLeave);
    };
  }, []);

  return (
    <Backdrop
      sx={(theme) => ({
        zIndex: theme.zIndex.drawer + 1,
      })}
      open={dragData !== null}
    >
      {dragData ? (
        <CphFlex
          width={'100%'}
          height={'100%'}
          column
          paddingX={2}
          justifyContent={'center'}
        >
          <List
            sx={{
              width: '100%',
              bgcolor: 'background.paper',
            }}
          >
            {dragData.map((path) => (
              <ListItem key={path}>
                <ListItemIcon>
                  <InsertDriveFileIcon />
                </ListItemIcon>
                <ListItemText primary={basename(path)} />
              </ListItem>
            ))}
          </List>
        </CphFlex>
      ) : (
        <CphFlex
          width={'100%'}
          height={'100%'}
          column
          gap={2}
          color='#ffffff'
          justifyContent={'center'}
        >
          <DownloadIcon sx={{ fontSize: 80 }} />
          <Typography variant='h5'>{t('dragOverlay.description')}</Typography>
        </CphFlex>
      )}
    </Backdrop>
  );
};

export default DragOverlay;
