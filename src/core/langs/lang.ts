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

import Result from '../../utils/result';

export type LangCompileResult = Result<
    { cmd: string } | { outputPath: string }
>;

export class Lang {
    public extensions: string[] = [];
    public compileHashSuffix(): string {
        throw new Error('Method not implemented.');
    }
    public async compile(_src: string): Promise<LangCompileResult> {
        throw new Error('Method not implemented.');
    }
    public runCommand(_target: string): string {
        throw new Error('Method not implemented.');
    }

    public static langs: Lang[] = [];
    public static getLang(filePath: string): Lang | null {
        const ext = filePath.split('.').pop();
        if (!ext) {
            return null;
        }
        return this.langs.find((lang) => lang.extensions.includes(ext)) || null;
    }
}
