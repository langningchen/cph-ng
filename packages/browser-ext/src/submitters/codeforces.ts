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
import { ExtractError } from '../errors';
import { BaseSubmitter } from './base';

export class CodeforcesSubmitter extends BaseSubmitter {
  public readonly supportedDomains = ['codeforces.com'] as const;
  private readonly contestRegex =
    /^https?:\/\/codeforces\.com\/contest\/([0-9]+)\/problem\/([A-Z0-9]+)/;
  private readonly problemRegex =
    /^https?:\/\/codeforces\.com\/problemset\/problem\/([0-9]+)\/([A-Z0-9]+)/;

  public getSubmitUrl(data: CphSubmitData): string {
    const isContest = data.url.match(this.contestRegex);
    if (isContest) return `https://codeforces.com/contest/${isContest[0]}/submit`;
    const isProblem = data.url.match(this.problemRegex);
    if (isProblem) return 'https://codeforces.com/problemset/submit';
    throw new ExtractError('type');
  }

  public async fill(data: CphSubmitData): Promise<void> {
    const languageEl = await this.waitForElement<HTMLSelectElement>('select[name="programTypeId"]');
    languageEl.value = data.languageId.toString();
    const sourceCodeEl = await this.waitForElement<HTMLTextAreaElement>('#sourceCodeTextarea');
    sourceCodeEl.value = data.sourceCode;

    const isContest = data.url.match(this.contestRegex);
    if (isContest) {
      const problemIndexEl = await this.waitForElement<HTMLSelectElement>(
        'select[name="submittedProblemIndex"]',
      );
      problemIndexEl.value = isContest[1];
    }

    const isProblem = data.url.match(this.problemRegex);
    if (isProblem) {
      const problemNameEl = await this.waitForElement<HTMLInputElement>(
        'input[name="submittedProblemCode"]',
      );
      problemNameEl.value = `${isProblem[1]}${isProblem[2]}`;
    }

    const submitBtn = document.querySelector('.submit') as HTMLButtonElement;
    submitBtn.disabled = false;
    submitBtn.click();
  }
}
