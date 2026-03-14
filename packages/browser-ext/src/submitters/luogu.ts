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
import { env, InferenceSession, Tensor } from 'onnxruntime-web';
import { browser } from 'wxt/browser';

export class LuoguSubmitter extends BaseSubmitter {
  public readonly supportedDomains = submitterDomains.luogu;
  private session: Promise<InferenceSession>;
  public constructor() {
    super();
    const wasmFile = browser.runtime.getURL(
      // biome-ignore lint/suspicious/noExplicitAny: getURL does not accept dirname
      '/assets/onnx-wasm/ort-wasm-simd-threaded.wasm' as any,
    );
    const wasmPath = `${wasmFile.split('/').slice(0, -1).join('/')}/`;
    console.log(wasmPath);
    env.wasm.wasmPaths = wasmPath;
    this.session = InferenceSession.create(browser.runtime.getURL('/assets/model.onnx'));
  }

  public getSubmitUrl(data: SubmitData) {
    return data.url;
  }

  private async predict(captchaImg: HTMLImageElement): Promise<string> {
    const encodeInput = (captchaImg: HTMLImageElement) => {
      const width = 90;
      const height = 35;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.drawImage(captchaImg, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;

      const floatData = new Float32Array(1 * height * width * 1);
      for (let i = 0; i < height * width; i++) {
        const r = pixels[i * 4];
        const g = pixels[i * 4 + 1];
        const b = pixels[i * 4 + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        floatData[i] = gray / 255.0;
      }
      return new Tensor('float32', floatData, [1, height, width, 1]);
    };

    const session = await this.session;
    const results = await session.run({ [session.inputNames[0]]: encodeInput(captchaImg) });

    const outputData = results[session.outputNames[0]].data as Float32Array;
    let answer = '';
    for (let i = 0; i < 4; i++) {
      let maxVal = -Infinity;
      let maxIdx = 0;
      for (let j = 0; j < 256; j++) {
        const val = outputData[i * 256 + j];
        if (val > maxVal) {
          maxVal = val;
          maxIdx = j;
        }
      }
      answer += String.fromCharCode(maxIdx);
    }
    return answer;
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
