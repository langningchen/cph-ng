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

import { createRoot, type Root } from 'react-dom/client';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { t } from '../src/i18n';
import { sendMessage } from '../src/messaging';
import { LoadingOverlay } from '../src/overlay';
import { findSubmitter } from '../src/submitters';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const showOverlay = (error?: string) => {
  if (!container) {
    container = document.createElement('div');
    const shadow = container.attachShadow({ mode: 'open' });
    document.body.appendChild(container);
    root = createRoot(shadow);
  }
  root?.render(<LoadingOverlay error={error} />);
};
const removeOverlay = () => {
  if (root) {
    root.unmount();
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
};

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    const submitter = findSubmitter(new URL(window.location.href));
    if (!submitter) return;

    const response = await sendMessage('pageReady', undefined);
    if (!response) return;

    showOverlay();

    const timer = setTimeout(() => {
      showOverlay(t('longTimeSubmission'));
    }, 10000);

    try {
      await submitter.fill(response);
      await sendMessage('submitDone', {
        success: true,
        message: '',
      });
      removeOverlay();
    } catch (e) {
      await sendMessage('submitDone', {
        success: false,
        message: String(e),
      });
      showOverlay(String(e));
    } finally {
      clearTimeout(timer);
    }
  },
});
