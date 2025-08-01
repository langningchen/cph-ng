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

import { homedir, tmpdir } from 'os';
import * as vscode from 'vscode';
import { renderTemplate } from './strTemplate';
import { Logger } from './io';

class SettingsSection {
    private name: string;
    protected logger: Logger = new Logger('settings');
    constructor(name: string) {
        this.name = name;
        this.logger.trace(`Created SettingsSection: ${name}`);
    }
    protected get(key: string): unknown {
        this.logger.trace(`Getting setting: ${this.name}.${key}`);
        const value = vscode.workspace
            .getConfiguration('cph-ng')
            .get(`${this.name}.${key}`);
        this.logger.debug(`Setting value for ${this.name}.${key}:`, value);
        return value;
    }
}

class CompilationSection extends SettingsSection {
    constructor() {
        super('compilation');
    }
    get cCompiler(): string {
        return this.get('cCompiler') as string;
    }
    get cArgs(): string {
        return this.get('cArgs') as string;
    }
    get cppCompiler(): string {
        return this.get('cppCompiler') as string;
    }
    get cppArgs(): string {
        return this.get('cppArgs') as string;
    }
    get timeout(): number {
        return this.get('timeout') as number;
    }
}

class CacheSection extends SettingsSection {
    constructor() {
        super('cache');
    }
    get directory(): string {
        const directory = renderTemplate(this.get('directory') as string, [
            ['tmp', tmpdir()],
            ['home', homedir()],
        ]);
        this.logger.debug('Cache directory resolved:', directory);
        return directory;
    }
    get cleanOnStartup(): boolean {
        return this.get('cleanOnStartup') as boolean;
    }
}

class CphCapableSection extends SettingsSection {
    constructor() {
        super('cphCapable');
    }
    get autoImport(): boolean {
        return this.get('autoImport') as boolean;
    }
}

class CompanionSection extends SettingsSection {
    constructor() {
        super('companion');
    }
    get listenPort(): number {
        return this.get('listenPort') as number;
    }
}

class RunnerSection extends SettingsSection {
    constructor() {
        super('runner');
    }
    get timeAddition(): number {
        return this.get('timeAddition') as number;
    }
}

class ComparingSection extends SettingsSection {
    constructor() {
        super('comparing');
    }
    get oleSize(): number {
        return this.get('oleSize') as number;
    }
    get regardPEAsAC(): boolean {
        return this.get('regardPEAsAC') as boolean;
    }
    get ignoreError(): boolean {
        return this.get('ignoreError') as boolean;
    }
}

class ProblemSection extends SettingsSection {
    constructor() {
        super('problem');
    }
    get defaultTimeLimit(): number {
        return this.get('defaultTimeLimit') as number;
    }
    get foundMatchTestCaseBehavior(): 'ask' | 'always' | 'never' {
        return this.get('foundMatchTestCaseBehavior') as
            | 'ask'
            | 'always'
            | 'never';
    }
    get templateFile(): string {
        return this.get('templateFile') as string;
    }
    get problemFilePath(): string {
        return this.get('problemFilePath') as string;
    }
}

class SidebarSection extends SettingsSection {
    constructor() {
        super('sidebar');
    }
    get retainWhenHidden(): boolean {
        return this.get('retainWhenHidden') as boolean;
    }
    get showAcGif(): boolean {
        return this.get('showAcGif') as boolean;
    }
    get colorTheme(): string {
        return this.get('colorTheme') as string;
    }
    get hiddenStatuses(): string[] {
        return this.get('hiddenStatuses') as string[];
    }
}

export default class Settings {
    static compilation = new CompilationSection();
    static cache = new CacheSection();
    static cphCapable = new CphCapableSection();
    static companion = new CompanionSection();
    static runner = new RunnerSection();
    static comparing = new ComparingSection();
    static problem = new ProblemSection();
    static sidebar = new SidebarSection();
}
