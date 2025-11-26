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

import Logger from '@/helpers/logger';
import { extname } from 'path';
import { LangC } from './c';
import { LangCpp } from './cpp';
import { LangJava } from './java';
import { LangJavascript } from './javascript';
import { Lang } from './lang';
import { LangPython } from './python';

export default class Langs {
    private static logger = new Logger('langs');
    public static langs: Lang[] = [
        new LangCpp(),
        new LangC(),
        new LangJava(),
        new LangPython(),
        new LangJavascript(),
    ];

    public static getLang(filePath: string): Lang | undefined {
        const ext = extname(filePath).toLowerCase().slice(1);
        const lang = this.langs.find((lang) => lang.extensions.includes(ext));
        lang
            ? this.logger.debug('Detected language for', filePath, lang.name)
            : this.logger.debug('No language detected for', filePath);
        return lang;
    }
}
