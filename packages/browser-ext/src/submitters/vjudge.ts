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

import { BaseSubmitter } from '@b/submitters/base';
import { submitterDomains } from '@b/submitters/domains';
import type { SubmitData } from '@cph-ng/core';

export class VjudgeSubmitter extends BaseSubmitter {
  public readonly supportedDomains = submitterDomains.vjudge;

  public getSubmitUrl(data: SubmitData) {
    return data.url;
  }

  public async fill({ sourceCode }: SubmitData): Promise<void> {
    const openSubmitBtn = await this.waitForElement<HTMLButtonElement>('#btn-submit');
    openSubmitBtn.click();

    const sourceCodeEl = await this.waitForElement<HTMLTextAreaElement>('#submit-solution');
    sourceCodeEl.value = sourceCode;

    const submitBtn = await this.waitForElement<HTMLButtonElement>('.modal #btn-submit');
    submitBtn.click();
  }
}
