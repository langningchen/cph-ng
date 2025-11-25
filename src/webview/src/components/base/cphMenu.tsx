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

import Box, { BoxProps } from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { PopoverPosition } from '@mui/material/Popover';
import React, { useState } from 'react';
import { delProps } from '../../utils';

interface CphMenuProps extends BoxProps {
    children: React.ReactNode;
    menu: Record<string, () => void>;
}

const CphMenu = (props: CphMenuProps) => {
    const [contextMenu, setContextMenu] = useState<PopoverPosition>();
    return (
        <Box
            onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({
                    left: e.clientX + 2,
                    top: e.clientY - 6,
                });
            }}
            style={{ cursor: 'context-menu' }}
            {...delProps(props, ['children', 'menu'])}
        >
            {props.children}
            <Menu
                open={!!contextMenu}
                onClose={() => setContextMenu(undefined)}
                anchorReference='anchorPosition'
                anchorPosition={contextMenu}
            >
                {Object.entries(props.menu).map(([key, value]) => (
                    <MenuItem
                        dense
                        key={key}
                        onClick={() => {
                            value();
                            setContextMenu(undefined);
                        }}
                    >
                        {key}
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
};

export default CphMenu;
