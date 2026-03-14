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

export class HydroSubmitter extends BaseSubmitter {
  public readonly supportedDomains = submitterDomains.hydro;

  public getSubmitUrl(data: SubmitData) {
    const url = new URL(data.url);
    url.pathname += '/submit';
    return url.toString();
  }

  public async fill({ sourceCode }: SubmitData): Promise<void> {
    const sourceCodeEl = await this.waitForElement<HTMLTextAreaElement>('textarea');
    sourceCodeEl.value = sourceCode;

    const submitBtn = await this.waitForElement<HTMLButtonElement>('input[type="submit"]');
    submitBtn.click();
  }
}
