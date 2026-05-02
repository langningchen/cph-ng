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

import type { OobeDoneMsg } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { ISettings } from '@/application/ports/vscode/ISettings';
import type { IMsgHandle } from '@/application/useCases/webview/msgHandle';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class OobeDone implements IMsgHandle<OobeDoneMsg> {
  public constructor(@inject(TOKENS.settings) private settings: ISettings) {}

  public async exec(_msg: OobeDoneMsg): Promise<void> {
    this.settings.sidebar.showOobe = false;
  }
}
