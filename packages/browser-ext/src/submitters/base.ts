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

import type { CphSubmitData } from '@cph-ng/core';
import { ElementError } from '../errors';

// biome-ignore lint/style/useNamingConvention: CodeMirror is the external API's property name
export type CMWrapped = HTMLElement & { CodeMirror?: { setValue(v: string): void } };

export abstract class BaseSubmitter {
  public abstract readonly supportedDomains: readonly string[];
  public abstract getSubmitUrl(data: CphSubmitData): string;
  public abstract fill(data: CphSubmitData): Promise<void>;

  protected waitForElement<T extends Element>(selector: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const el = document.querySelector<T>(selector);
      if (el) {
        resolve(el);
        return;
      }

      const deadline = Date.now() + 15000;
      const check = setInterval(() => {
        const el = document.querySelector<T>(selector);
        if (el) {
          clearInterval(check);
          resolve(el);
          return;
        }
        if (Date.now() >= deadline) {
          clearInterval(check);
          reject(new ElementError(selector));
          return;
        }
      }, 100);
    });
  }

  protected setCodeMirrorOrTextarea(textarea: HTMLTextAreaElement, code: string): void {
    const cm = (textarea as CMWrapped).CodeMirror;
    if (cm) {
      cm.setValue(code);
      return;
    }
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    if (nativeSetter) nativeSetter.call(textarea, code);
    else textarea.value = code;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
