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
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { basename, msg } from '../utils';
import CphFlex from './base/cphFlex';

type DragItems = Map<string, 'folder' | 'file'>;

const DragOverlay = () => {
    const { t } = useTranslation();
    const [dragData, setDragData] = useState<DragItems | null | undefined>(
        null,
    );

    const onDragOver = (e: DragEvent) =>
        e.dataTransfer?.types.includes('text/uri-list') &&
        setDragData(undefined);
    const onDrop = (e: DragEvent) => {
        if (!e.dataTransfer?.types.includes('text/uri-list')) {
            return;
        }
        const dragItems: DragItems = new Map();
        for (const item of e.dataTransfer
            .getData('text/plain')
            .replaceAll('\r', '')
            .split('\n') || []) {
            dragItems.set(item, 'folder');
        }
        if (e.dataTransfer.types.includes('codeeditors')) {
            for (const item of JSON.parse(
                e.dataTransfer.getData('codeeditors'),
            )) {
                dragItems.set(item.resource.path, 'file');
            }
        }
        if (!dragItems.size) {
            setDragData(null);
        } else {
            setDragData(dragItems);
            msg({ type: 'dragDrop', items: Object.fromEntries(dragItems) });
            setTimeout(() => {
                setDragData(null);
            }, 1000);
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
        <CphFlex
            zIndex={10}
            position={'fixed'}
            top={0}
            left={0}
            width={'100%'}
            height={'100%'}
            column
            gap={5}
            paddingY={2}
            justifyContent={'center'}
            style={{
                opacity:
                    dragData === null ? 0 : dragData === undefined ? 0.8 : 1,
                pointerEvents: dragData === null ? 'none' : 'auto',
                transition: '500ms',
                background: '#000000',
                backdropFilter: 'blur(2px)',
            }}
        >
            {dragData ? (
                <List style={{ width: '100%' }}>
                    {[...dragData.entries()].map(([path, item]) => (
                        <ListItem key={path}>
                            <ListItemIcon>
                                {item === 'folder' ? (
                                    <FolderIcon />
                                ) : (
                                    <InsertDriveFileIcon />
                                )}
                            </ListItemIcon>
                            <ListItemText
                                primary={basename(path)}
                                secondary={path}
                            />
                        </ListItem>
                    ))}
                </List>
            ) : (
                <>
                    <DownloadIcon sx={{ fontSize: 80 }} />
                    <Typography variant='h5'>
                        {t('dragOverlay.description')}
                    </Typography>
                </>
            )}
        </CphFlex>
    );
};

export default DragOverlay;
