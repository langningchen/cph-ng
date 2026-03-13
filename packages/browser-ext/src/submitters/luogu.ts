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

import type { SubmitData } from '@cph-ng/core';
import { BaseSubmitter, type CMWrapped } from './base';
import { submitterDomains } from './domains';

export class LuoguSubmitter extends BaseSubmitter {
  public readonly supportedDomains = submitterDomains.LUOGU;

  public getSubmitUrl(data: SubmitData) {
    return data.url;
  }

  public async fill(data: SubmitData) {
    const showSubmit = await this.waitForElement<HTMLButtonElement>(
      '#app > div.main-container > header > div > div > div > div:nth-child(1) > button.solid.lform-size-middle',
    );
    showSubmit.click();

    const cmWrapper = await this.waitForElement<CMWrapped>('v-codemirror');
    if (cmWrapper.CodeMirror) {
      cmWrapper.CodeMirror.setValue(data.sourceCode);
    } else {
      const textarea = await this.waitForElement<HTMLTextAreaElement>(
        'textarea.source-code, textarea#code, textarea[name="code"]',
      );
      this.setCodeMirrorOrTextarea(textarea, data.sourceCode);
    }

    const submitBtn = await this.waitForElement<HTMLButtonElement>(
      '#app > div.main-container > main > div > div > div.main > div > div.body > button',
    );
    submitBtn.click();
  }
}
