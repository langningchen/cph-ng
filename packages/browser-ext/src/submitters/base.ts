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

import { ElementError, InternalError } from '@b/errors';
import type { SubmitData } from '@cph-ng/core';

// biome-ignore lint/style/useNamingConvention: CodeMirror is the external API's property name
export type CMWrapped = HTMLElement & { CodeMirror?: { setValue(v: string): void } };

export abstract class BaseSubmitter {
  public abstract readonly supportedDomains: readonly string[];
  public abstract getSubmitUrl(data: SubmitData): string;
  public abstract fill(data: SubmitData): Promise<void>;

  protected waitFor(condition: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const result = condition();
      if (result) {
        resolve();
        return;
      }

      const deadline = Date.now() + 30000;
      const check = setInterval(() => {
        const result = condition();
        if (result) {
          clearInterval(check);
          resolve();
          return;
        }
        if (Date.now() >= deadline) {
          clearInterval(check);
          reject();
          return;
        }
      }, 100);
    });
  }

  protected async waitForElement<T extends Element>(selector: string): Promise<T> {
    let element: T | null = null;
    return this.waitFor(() => {
      element = document.querySelector<T>(selector);
      return !!element;
    })
      .then(() => {
        if (!element) throw new Error();
        console.log(`Element found for selector: ${selector}`, element);
        return element;
      })
      .catch(() => {
        throw new ElementError(selector);
      });
  }

  public requireInteraction: (selector: string | null) => void = () => {
    throw new InternalError('This submitter does not support interaction');
  };
  protected clearInteraction() {
    this.requireInteraction(null);
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
