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

import type { OpenSettingsMsg } from '@w/msgs';
import { inject, injectable } from 'tsyringe';
import type { IUi } from '@/application/ports/vscode/IUi';
import type { IMsgHandle } from '@/application/useCases/webview/msgHandle';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class OpenSettings implements IMsgHandle<OpenSettingsMsg> {
  public constructor(@inject(TOKENS.ui) private readonly ui: IUi) {}

  public async exec(msg: OpenSettingsMsg): Promise<void> {
    this.ui.openSettings(msg.item);
  }
}
