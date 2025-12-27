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

import { container } from 'tsyringe';
import { ILanguageRegistry } from '@/application/ports/services/ILanguageRegistry';
import { TOKENS } from '@/composition/tokens';
import { LangC } from './c';
import { LangCpp } from './cpp';
import { LangJava } from './java';
import { LangJavascript } from './javascript';
import type { Lang } from './lang';
import { LangPython } from './python';

/**
 * @deprecated Use ILanguageRegistry instead
 */
export default class Langs {
  public static langs: Lang[] = [
    new LangCpp(),
    new LangC(),
    new LangJava(),
    new LangPython(),
    new LangJavascript(),
  ];

  public static getLang(filePath: string): Lang | undefined {
    const registry = container.resolve<ILanguageRegistry>(
      TOKENS.LanguageRegistry,
    );
    return registry.getLang(filePath);
  }
}
