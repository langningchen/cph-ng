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

export class AtCoderSubmitter extends BaseSubmitter {
  public readonly supportedDomains = submitterDomains.ATCODER;
  private readonly contestRegex = /^\/contests\/(?<contest>[\w-]+)\/tasks\/(?<problem>\w+)/;

  public getSubmitUrl(data: SubmitData) {
    const url = new URL(data.url);
    const isContest = url.pathname.match(this.contestRegex)?.groups;
    if (isContest) {
      url.pathname = `/contests/${isContest.contest}/submit`;
      url.searchParams.set('taskScreenName', isContest.problem);
    } else throw new ExtractError('type');
    return url.toString();
  }

  public async fill(data: SubmitData) {
    const languageEl = await this.waitForElement<HTMLSelectElement>('#select-lang > div > select');
    languageEl.value = '6017';

    const editorBtn = await this.waitForElement<HTMLButtonElement>(
      '.editor-buttons > button:nth-child(3)',
    );
    if (editorBtn.getAttribute('aria-pressed') !== 'true') editorBtn.click();

    const codeEl = await this.waitForElement<HTMLTextAreaElement>('#plain-textarea');
    await this.waitFor(() => codeEl.style.display !== 'none');
    codeEl.value = data.sourceCode;

    editorBtn.click();

    this.requireInteraction('.cf-challenge');
    const captchaEl = await this.waitForElement<HTMLInputElement>('.cf-challenge > div > input');
    await this.waitFor(() => captchaEl.value.trim() !== '');
    this.clearInteraction();

    const submitBtn = await this.waitForElement<HTMLButtonElement>('#submit');
    submitBtn.click();
  }
}
