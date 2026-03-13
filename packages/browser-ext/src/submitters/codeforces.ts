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
import { ExtractError } from '../errors';
import { BaseSubmitter } from './base';
import { submitterDomains } from './domains';

export class CodeforcesSubmitter extends BaseSubmitter {
  public readonly supportedDomains = submitterDomains.CODEFORCES;
  private readonly contestRegex = /^\/contest\/([0-9]+)\/problem\/([A-Z0-9]+)/;
  private readonly problemRegex = /^\/problemset\/problem\/([0-9]+)\/([A-Z0-9]+)/;

  public getSubmitUrl(data: SubmitData) {
    const url = new URL(data.url);
    const isContest = url.pathname.match(this.contestRegex);
    const isProblem = url.pathname.match(this.problemRegex);
    if (isContest) url.pathname = `/contest/${isContest[0]}/submit`;
    else if (isProblem) url.pathname = '/problemset/submit';
    else throw new ExtractError('type');
    return url.toString();
  }

  public async fill(data: SubmitData) {
    const languageEl = await this.waitForElement<HTMLSelectElement>('select[name="programTypeId"]');
    languageEl.value = '54'; // TO-DO
    const sourceCodeEl = await this.waitForElement<HTMLTextAreaElement>('#sourceCodeTextarea');
    sourceCodeEl.value = data.sourceCode;

    const url = new URL(data.url);
    const isContest = url.pathname.match(this.contestRegex);
    if (isContest) {
      const problemIndexEl = await this.waitForElement<HTMLSelectElement>(
        'select[name="submittedProblemIndex"]',
      );
      problemIndexEl.value = isContest[1];
    }

    const isProblem = url.pathname.match(this.problemRegex);
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
