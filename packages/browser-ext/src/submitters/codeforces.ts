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

import { ExtractError } from '@b/errors';
import { BaseSubmitter } from '@b/submitters/base';
import { submitterDomains } from '@b/submitters/domains';
import type { SubmitData } from '@cph-ng/core';

export class CodeforcesSubmitter extends BaseSubmitter {
  public readonly supportedDomains = submitterDomains.codeforces;
  private readonly contestRegex = /^\/contest\/(?<contest>\d+)\/problem\/(?<problem>\w+)/;
  private readonly problemRegex = /^\/problemset\/problem\/(?<contest>\d+)\/(?<problem>\w+)/;

  public getSubmitUrl(data: SubmitData) {
    const url = new URL(data.url);
    const contest = url.pathname.match(this.contestRegex)?.groups;
    const problem = url.pathname.match(this.problemRegex)?.groups;
    if (contest) url.pathname = `/contest/${contest.contest}/submit`;
    else if (problem) url.pathname = `/problemset/submit`;
    else throw new ExtractError('type');
    return url.toString();
  }

  public async fill(data: SubmitData) {
    const sourceCodeEl = await this.waitForElement<HTMLTextAreaElement>('#sourceCodeTextarea');
    sourceCodeEl.value = data.sourceCode;

    const url = new URL(data.url);
    const contest = url.pathname.match(this.contestRegex)?.groups;
    if (contest) {
      const problemIndexEl = await this.waitForElement<HTMLSelectElement>(
        'select[name="submittedProblemIndex"]',
      );
      problemIndexEl.value = contest.problem;
    }

    const problem = url.pathname.match(this.problemRegex)?.groups;
    if (problem) {
      const problemNameEl = await this.waitForElement<HTMLInputElement>(
        'input[name="submittedProblemCode"]',
      );
      problemNameEl.value = `${problem.contest}${problem.problem}`;
    }

    const submitBtn = await this.waitForElement<HTMLButtonElement>('.submit');
    submitBtn.disabled = false;
    submitBtn.click();
  }
}
