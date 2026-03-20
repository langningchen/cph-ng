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

import { sendMessage } from '@b/messaging';
import { BaseSubmitter } from '@b/submitters/base';
import { submitterDomains } from '@b/submitters/domains';
import type { SubmitData } from '@cph-ng/core';

export class LuoguSubmitter extends BaseSubmitter {
  public readonly supportedDomains = submitterDomains.luogu;

  public getSubmitUrl(data: SubmitData) {
    return data.url;
  }

  private async predict(captchaImg: HTMLImageElement): Promise<string> {
    if (captchaImg.loading)
      await new Promise((resolve) => captchaImg.addEventListener('load', resolve, { once: true }));
    const canvas = document.createElement('canvas');
    canvas.width = captchaImg.naturalWidth || captchaImg.width;
    canvas.height = captchaImg.naturalHeight || captchaImg.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    ctx.drawImage(captchaImg, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL('image/png');
    return await sendMessage('solveLuoguCaptcha', imageDataUrl);
  }

  public async fill({ sourceCode }: SubmitData): Promise<void> {
    const showSubmit = await this.waitForElement<HTMLButtonElement>(
      '#app > div.main-container > header > div > div > div > div:nth-child(1) > button.solid.lform-size-middle',
    );
    showSubmit.click();

    const cmContent = await this.waitForElement<HTMLElement>('.cm-content');
    cmContent.innerText = sourceCode;

    const submitBtn = await this.waitForElement<HTMLButtonElement>(
      '#app > div.main-container > main > div > div > div.main > div > div.body > button',
    );
    submitBtn.click();

    // The following code is used to handle the captcha that may appear after clicking the submit button.
    // Whether there is a captcha or not, we must return immediately after clicking the submit button.
    // Otherwise the `submitDone` event will never be emitted, and the extension will be stuck in the "Submitting..." state.
    (async () => {
      const captcha = await this.waitForElement<HTMLImageElement>('#--swal-problem-submit-captcha');
      const captchaCode = await this.predict(captcha);

      const captchaInput = await this.waitForElement<HTMLInputElement>('.swal2-modal > input');
      captchaInput.value = captchaCode;

      const captchaSubmitBtn = await this.waitForElement<HTMLButtonElement>('.swal2-confirm');
      captchaSubmitBtn.click();
    })();
  }
}
