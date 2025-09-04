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

import * as vscode from 'vscode';
import { io, Logger } from '../../utils/io';
import { basename, extname } from 'path';
import { Lang } from './lang';
import { LangCpp } from './cpp';
import { LangC } from './c';
import { LangJava } from './java';

const logger = new Logger('langs');

export class Langs {
    public static langs: Lang[] = [new LangCpp(), new LangC(), new LangJava()];
    public static getLang(
        filePath: string,
        ignoreError: boolean = false,
    ): Lang | null {
        logger.trace('getLang', { filePath });
        const ext = extname(filePath).toLowerCase().slice(1);
        const lang = this.langs.find((lang) => lang.extensions.includes(ext));
        if (!lang) {
            ignoreError ||
                io.error(
                    vscode.l10n.t(
                        'Cannot determine the programming language of the source file: {file}.',
                        { file: basename(filePath) },
                    ),
                );
            return null;
        }
        return lang;
    }
}
