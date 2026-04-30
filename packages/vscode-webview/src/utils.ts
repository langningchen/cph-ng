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

import type { MouseEvent } from 'react';

export const getCompile = (e: MouseEvent) => {
  if (e.ctrlKey) {
    return true;
  }
  if (e.altKey) {
    return false;
  }
  return null;
};

export const openLink = (url: string) => () => {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const urls = {
  settings: 'command:workbench.action.openSettings?%5B%22%40ext%3Alangningchen.cph-ng%22%5D',
  github: 'https://github.com/langningchen/cph-ng',
  feedback: 'https://github.com/langningchen/cph-ng/issues',
  docs: 'https://deepwiki.com/langningchen/cph-ng',
  companionChromeAddon:
    'https://chromewebstore.google.com/detail/competitive-companion/cjnmckjndlpiamhfimnnjmnckgghkjbl',
  companionFirefoxAddon: 'https://addons.mozilla.org/en-US/firefox/addon/competitive-companion/',
  edgeAddon:
    'https://microsoftedge.microsoft.com/addons/detail/cphng-submit/hfpfdaggmljfccmnfljldojbgfhpfomb',
  firefoxAddon: 'https://addons.mozilla.org/firefox/addon/cph-ng-submit/',
  joinQQ: 'https://qm.qq.com/q/pXStina3jU',
};
