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

import { cryptoMock } from '@t/infrastructure/node/cryptoMock';
import { createFileSystemMock } from '@t/infrastructure/node/fileSystemMock';
import { pathMock } from '@t/infrastructure/node/pathMock';
import { systemMock } from '@t/infrastructure/node/systemMock';
import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { translatorMock } from '@t/infrastructure/vscode/translatorMock';
import { mock } from '@t/mock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ILanguageStrategy } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { IUi } from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';
import { CppHeaderExpander } from '@/infrastructure/services/cppHeaderExpander';

describe('CppHeaderExpander', () => {
  let expander: CppHeaderExpander;
  let fileSystemMock: MockProxy<IFileSystem>;
  let langRegistryMock: MockProxy<ILanguageRegistry>;
  let uiMock: MockProxy<IUi>;
  let vol: ReturnType<typeof createFileSystemMock>['vol'];

  beforeEach(() => {
    ({ fileSystemMock, vol } = createFileSystemMock());
    langRegistryMock = mock<ILanguageRegistry>();
    uiMock = mock<IUi>();
    uiMock.alert.mockResolvedValue(undefined);

    container.registerInstance(TOKENS.crypto, cryptoMock);
    container.registerInstance(TOKENS.fileSystem, fileSystemMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.path, pathMock);
    container.registerInstance(TOKENS.system, systemMock);
    container.registerInstance(TOKENS.translator, translatorMock);
    container.registerInstance(TOKENS.ui, uiMock);
    container.registerInstance(TOKENS.languageRegistry, langRegistryMock);

    expander = container.resolve(CppHeaderExpander);
  });

  const makeCppLang = (): MockProxy<ILanguageStrategy> => {
    const lang = mock<ILanguageStrategy>({ name: 'C++' });
    langRegistryMock.getLangByFile.mockReturnValue(lang);
    return lang;
  };

  const makeOtherLang = (): MockProxy<ILanguageStrategy> => {
    const lang = mock<ILanguageStrategy>({ name: 'Python' });
    langRegistryMock.getLangByFile.mockReturnValue(lang);
    return lang;
  };

  it('returns null and does not read file when source is not C++', async () => {
    makeOtherLang();
    const result = await expander.expand('/src/main.py');
    expect(result).toBeNull();
    expect(fileSystemMock.readFile).not.toHaveBeenCalled();
  });

  it('returns null when C++ source has no quote-style includes', async () => {
    makeCppLang();
    vol.fromJSON({
      '/src/main.cpp': 'int main() { return 0; }\n#include <bits/stdc++.h>\n',
    });
    const result = await expander.expand('/src/main.cpp');
    expect(result).toBeNull();
  });

  it('returns null when source file cannot be read', async () => {
    makeCppLang();
    fileSystemMock.readFile.mockRejectedValue(new Error('ENOENT'));
    const result = await expander.expand('/src/missing.cpp');
    expect(result).toBeNull();
    expect(uiMock.alert).toHaveBeenCalledWith('error', expect.stringContaining('ENOENT'));
  });

  it('expands a single custom header with begin/end markers', async () => {
    makeCppLang();
    vol.fromJSON({
      '/src/main.cpp': '#include "qio.hpp"\nint main() { return 0; }\n',
      '/src/qio.hpp': 'void hello() {}\n',
    });
    const result = await expander.expand('/src/main.cpp');
    expect(result).not.toBeNull();
    expect(result).toContain('// --- Begin of qio.hpp ---');
    expect(result).toContain('void hello() {}');
    expect(result).toContain('// --- End of qio.hpp ---');
    expect(result).toContain('int main() { return 0; }');
  });

  it('returns null (no expansion) when all headers are missing/unresolved', async () => {
    makeCppLang();
    vol.fromJSON({
      '/src/main.cpp': '#include "ghost.hpp"\nint main() { return 0; }\n',
    });
    const result = await expander.expand('/src/main.cpp');
    expect(result).toBeNull();
  });

  it('keeps missing header unchanged while expanding others in a mixed source', async () => {
    makeCppLang();
    vol.fromJSON({
      '/src/main.cpp': '#include "qio.hpp"\n#include "ghost.hpp"\nint main() { return 0; }\n',
      '/src/qio.hpp': 'void hello() {}\n',
    });
    const result = await expander.expand('/src/main.cpp');
    expect(result).not.toBeNull();
    expect(result).toContain('// --- Begin of qio.hpp ---');
    expect(result).toContain('void hello() {}');
    expect(result).toContain('#include "ghost.hpp"');
  });

  it('expands headers transitively', async () => {
    makeCppLang();
    vol.fromJSON({
      '/src/main.cpp': '#include "a.hpp"\nint main() { return 0; }\n',
      '/src/a.hpp': 'inline void a() {}\n#include "b.hpp"\n',
      '/src/b.hpp': 'inline void b() {}\n',
    });
    const result = await expander.expand('/src/main.cpp');
    expect(result).not.toBeNull();
    expect(result).toContain('// --- Begin of a.hpp ---');
    expect(result).toContain('// --- Begin of b.hpp ---');
    expect(result).toContain('// --- End of a.hpp ---');
    expect(result).toContain('// --- End of b.hpp ---');
    expect(result).toContain('inline void a() {}');
    expect(result).toContain('inline void b() {}');
  });

  it('skips the second occurrence of the same header (cycle / duplicate)', async () => {
    makeCppLang();
    vol.fromJSON({
      '/src/main.cpp': '#include "loop.hpp"\n#include "loop.hpp"\nint main() { return 0; }\n',
      '/src/loop.hpp': '// header body\n',
    });
    const result = await expander.expand('/src/main.cpp');
    expect(result).not.toBeNull();
    expect(result).toContain('// --- Begin of loop.hpp ---');
    expect(result).toContain('// Skipped duplicate of loop.hpp');
  });

  it('skips a header that recursively includes itself', async () => {
    makeCppLang();
    vol.fromJSON({
      '/src/main.cpp': '#include "self.hpp"\nint main() { return 0; }\n',
      '/src/self.hpp': 'inline void f() {}\n#include "self.hpp"\n',
    });
    const result = await expander.expand('/src/main.cpp');
    expect(result).not.toBeNull();
    expect(result).toContain('// --- Begin of self.hpp ---');
    expect(result).toContain('// Skipped duplicate of self.hpp');
    expect(result).toContain('// --- End of self.hpp ---');
    const beginCount = (result?.match(/--- Begin of self\.hpp ---/g) || []).length;
    const skipCount = (result?.match(/Skipped duplicate of self\.hpp/g) || []).length;
    expect(beginCount).toBe(1);
    expect(skipCount).toBe(1);
  });

  it('leaves angle-bracket includes untouched', async () => {
    makeCppLang();
    vol.fromJSON({
      '/src/main.cpp': '#include <bits/stdc++.h>\n#include "qio.hpp"\nint main() { return 0; }\n',
      '/src/qio.hpp': 'inline void q() {}\n',
    });
    const result = await expander.expand('/src/main.cpp');
    expect(result).not.toBeNull();
    expect(result).toContain('#include <bits/stdc++.h>');
    expect(result).toContain('// --- Begin of qio.hpp ---');
  });

  it('resolves headers walking up parent directories', async () => {
    makeCppLang();
    vol.fromJSON({
      '/proj/src/main.cpp': '#include "shared/util.hpp"\nint main() { return 0; }\n',
      '/proj/shared/util.hpp': 'inline void u() {}\n',
    });
    const result = await expander.expand('/proj/src/main.cpp');
    expect(result).not.toBeNull();
    expect(result).toContain('// --- Begin of shared/util.hpp ---');
    expect(result).toContain('inline void u() {}');
    expect(result).toContain('// --- End of shared/util.hpp ---');
  });

  it('does not walk up parent directories for relative paths with ../ or ./', async () => {
    makeCppLang();
    vol.fromJSON({
      '/proj/src/main.cpp': '#include "./qio.hpp"\nint main() { return 0; }\n',
    });
    const result = await expander.expand('/proj/src/main.cpp');
    expect(result).toBeNull();
  });

  it('writes the expanded source to a temporary project directory', async () => {
    makeCppLang();
    vol.fromJSON({
      '/src/main.cpp': '#include "qio.hpp"\nint main() { return 0; }\n',
      '/src/qio.hpp': 'inline void q() {}\n',
    });
    const result = await expander.expand('/src/main.cpp');
    expect(result).not.toBeNull();

    const projectDir = '/tmp/cph-ng-cpp-u-u-i-d-0';
    const expectedMain = `${projectDir}/main.cpp`;
    const expectedHeader = `${projectDir}/src/qio.hpp`;

    const written = vol.toJSON();
    expect(written[expectedMain]).toBeDefined();
    expect(written[expectedMain]).toContain('// --- Begin of qio.hpp ---');
    expect(written[expectedHeader]).toBeDefined();
    expect(written[expectedHeader]).toBe('inline void q() {}\n');
  });
});
