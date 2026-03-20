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

import { onMessage } from '@b/messaging';

import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm';
import { browser } from 'wxt/browser';

let sessionPromise: Promise<InferenceSession> | null = null;

const getSession = (): Promise<InferenceSession> => {
  if (sessionPromise) return sessionPromise;

  const wasmFile = browser.runtime.getURL('/assets/onnx-wasm/ort-wasm-simd-threaded.wasm');
  const wasmPath = `${wasmFile.split('/').slice(0, -1).join('/')}/`;
  env.wasm.wasmPaths = wasmPath;
  env.wasm.numThreads = 1;

  sessionPromise = InferenceSession.create(browser.runtime.getURL('/assets/model.onnx'));
  return sessionPromise;
};

const decodeImage = async (imageDataUrl: string): Promise<ImageBitmap> => {
  const response = await fetch(imageDataUrl);
  const blob = await response.blob();
  return await createImageBitmap(blob);
};

const encodeInput = async (imageDataUrl: string): Promise<Tensor> => {
  const width = 90;
  const height = 35;
  const bitmap = await decodeImage(imageDataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  const floatData = new Float32Array(height * width);
  for (let i = 0; i < height * width; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    floatData[i] = gray / 255.0;
  }

  return new Tensor('float32', floatData, [1, height, width, 1]);
};

onMessage('solveLuoguCaptcha', async ({ data }) => {
  const session = await getSession();
  const inputTensor = await encodeInput(data);
  const results = await session.run({ [session.inputNames[0]]: inputTensor });

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
});
