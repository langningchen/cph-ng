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

import { join } from 'node:path';
import { inject, injectable } from 'tsyringe';
import type { ICrypto } from '@/application/ports/node/ICrypto';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPath } from '@/application/ports/node/IPath';
import type { ISystem } from '@/application/ports/node/ISystem';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ICppHeaderExpander } from '@/application/ports/services/ICppHeaderExpander';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type { ITranslator } from '@/application/ports/vscode/ITranslator';
import type { IUi } from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';

const INCLUDE_REGEX = /^\s*#\s*include\s*"([^"]+)"\s*$/;
const BEGIN_MARKER = (name: string): string => `// --- Begin of ${name} ---`;
const END_MARKER = (name: string): string => `// --- End of ${name} ---`;
const SKIPPED_MARKER = (name: string): string => `// Skipped duplicate of ${name}`;
const NO_HEADER_LINE = (name: string): string => `// Header not found: ${name}`;

@injectable()
export class CppHeaderExpander implements ICppHeaderExpander {
  public constructor(
    @inject(TOKENS.crypto) private readonly crypto: ICrypto,
    @inject(TOKENS.fileSystem) private readonly fs: IFileSystem,
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @inject(TOKENS.path) private readonly path: IPath,
    @inject(TOKENS.system) private readonly sys: ISystem,
    @inject(TOKENS.translator) private readonly translator: ITranslator,
    @inject(TOKENS.ui) private readonly ui: IUi,
    @inject(TOKENS.languageRegistry) private readonly languageRegistry: ILanguageRegistry,
  ) {
    this.logger = this.logger.withScope('cppHeaderExpander');
  }

  public async expand(sourcePath: string): Promise<string | null> {
    const lang = this.languageRegistry.getLangByFile(sourcePath);
    if (lang?.name !== 'C++') {
      this.logger.debug('Source is not C++; skipping header expansion', { sourcePath });
      return null;
    }

    let source: string;
    try {
      source = await this.fs.readFile(sourcePath);
    } catch (e) {
      this.logger.error('Failed to read source file', { sourcePath, e });
      this.ui.alert(
        'error',
        this.translator.t('Failed to read source file: {msg}', {
          msg: (e as Error).message,
        }),
      );
      return null;
    }

    if (!/^\s*#\s*include\s*"/m.test(source)) {
      this.logger.debug('Source has no quote-style includes; nothing to expand', { sourcePath });
      return null;
    }

    const baseDir = this.path.dirname(sourcePath);
    const visited = new Set<string>();
    const expandedLines: string[] = [];
    const expandedSources = new Map<string, string>();
    const expandedNames: string[] = [];

    for (const rawLine of source.split(/\r?\n/)) {
      const match = INCLUDE_REGEX.exec(rawLine);
      if (!match) {
        expandedLines.push(rawLine);
        continue;
      }
      const headerName = match[1];
      const resolved = await this.resolveHeader(baseDir, headerName);
      if (!resolved) {
        this.logger.warn('Custom header not found', { headerName, baseDir });
        expandedLines.push(NO_HEADER_LINE(headerName));
        continue;
      }

      const key = this.path.resolve(resolved);
      if (visited.has(key)) {
        expandedLines.push(SKIPPED_MARKER(headerName));
        continue;
      }

      const headerContent = await this.expandFile(resolved, visited, expandedSources);
      expandedNames.push(headerName);
      expandedLines.push(BEGIN_MARKER(headerName));
      for (const line of headerContent) expandedLines.push(line);
      expandedLines.push(END_MARKER(headerName));
    }

    const expanded = expandedLines.join('\n');
    if (expanded === source) {
      this.logger.debug('No expansion produced (no resolvable headers)', { sourcePath });
      return null;
    }

    try {
      const projectDir = join(this.sys.tmpdir(), `cph-ng-cpp-${this.crypto.randomUUID()}`);
      await this.fs.mkdir(projectDir);
      const target = join(projectDir, this.path.basename(sourcePath));
      await this.fs.safeWriteFile(target, expanded);
      for (const [src, content] of expandedSources) {
        const mirrored = join(projectDir, src);
        await this.fs.safeWriteFile(mirrored, content);
      }
      this.logger.info('Expanded C++ headers into tmp project', {
        sourcePath,
        projectDir,
        headerCount: expandedNames.length,
        headers: expandedNames,
      });
    } catch (e) {
      this.logger.warn('Failed to write expanded source into tmp project', { sourcePath, e });
    }

    return expanded;
  }

  private async resolveHeader(baseDir: string, headerName: string): Promise<string | null> {
    const absolute = this.path.resolve(baseDir, headerName);
    if (await this.fs.exists(absolute)) return absolute;

    const normalized = headerName.replace(/\\/g, '/');
    if (normalized.startsWith('../') || normalized.startsWith('./')) {
      return null;
    }

    let dir = this.path.resolve(baseDir);
    while (true) {
      const candidate = this.path.join(dir, headerName);
      if (await this.fs.exists(candidate)) return candidate;
      const parent = this.path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }

  private async expandFile(
    filePath: string,
    visited: Set<string>,
    expandedSources: Map<string, string>,
  ): Promise<string[]> {
    const key = this.path.resolve(filePath);
    visited.add(key);

    let raw: string;
    try {
      raw = await this.fs.readFile(filePath);
    } catch (e) {
      this.logger.warn('Failed to read header while expanding', { filePath, e });
      return [`// Failed to read ${this.path.basename(filePath)}: ${(e as Error).message}`];
    }
    expandedSources.set(key, raw);

    const baseDir = this.path.dirname(filePath);
    const out: string[] = [];
    for (const rawLine of raw.split(/\r?\n/)) {
      const match = INCLUDE_REGEX.exec(rawLine);
      if (!match) {
        out.push(rawLine);
        continue;
      }
      const headerName = match[1];
      const resolved = await this.resolveHeader(baseDir, headerName);
      if (!resolved) {
        out.push(NO_HEADER_LINE(headerName));
        continue;
      }
      const childKey = this.path.resolve(resolved);
      if (visited.has(childKey) || expandedSources.has(childKey)) {
        out.push(SKIPPED_MARKER(headerName));
        continue;
      }
      const child = await this.expandFile(resolved, visited, expandedSources);
      out.push(BEGIN_MARKER(headerName));
      for (const line of child) out.push(line);
      out.push(END_MARKER(headerName));
    }
    return out;
  }
}
