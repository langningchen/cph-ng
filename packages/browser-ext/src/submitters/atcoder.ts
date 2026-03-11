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
import { BaseSubmitter, type CMWrapped } from './base';
import { submitterDomains } from './domains';

export class AtCoderSubmitter extends BaseSubmitter {
  public readonly supportedDomains = submitterDomains.ATCODER;

  public getSubmitUrl(data: CphSubmitData): string {
    try {
      const url = new URL(data.url);
      const parts = url.pathname.split('/').filter(Boolean);
      const contestsIdx = parts.indexOf('contests');
      if (contestsIdx !== -1 && parts[contestsIdx + 2] === 'tasks') {
        const contest = parts[contestsIdx + 1];
        const task = parts[contestsIdx + 3];
        return `${url.origin}/contests/${contest}/submit?taskScreen=${task}`;
      }
    } catch {}
    return data.url;
  }

  public async fill(data: CphSubmitData): Promise<void> {
    const cmWrapper = await this.waitForElement<CMWrapped>('.CodeMirror');

    if (cmWrapper.CodeMirror) {
      cmWrapper.CodeMirror.setValue(data.sourceCode);
    } else {
      const textarea = await this.waitForElement<HTMLTextAreaElement>('#sourceCode');
      this.setCodeMirrorOrTextarea(textarea, data.sourceCode);
    }

    const submitBtn = await this.waitForElement<HTMLElement>(
      '#submit, input[type="submit"], button[type="submit"]',
    );
    submitBtn.click();
  }
}
