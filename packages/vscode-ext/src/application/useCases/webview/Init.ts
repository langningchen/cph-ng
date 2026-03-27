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

import type { IProblemRepository } from '@v/application/ports/problems/IProblemRepository';
import type { IActiveProblemCoordinator } from '@v/application/ports/services/IActiveProblemCoordinator';
import type { ISidebarProvider } from '@v/application/ports/vscode/ISidebarProvider';
import type { IMsgHandle } from '@v/application/useCases/webview/msgHandle';
import { TOKENS } from '@v/composition/tokens';
import type { InitMsg } from '@w/msgs';
import { inject, injectable } from 'tsyringe';

@injectable()
export class Init implements IMsgHandle<InitMsg> {
  public constructor(
    @inject(TOKENS.problemRepository) private readonly repo: IProblemRepository,
    @inject(TOKENS.sidebarProvider)
    private readonly sidebarProvider: ISidebarProvider,
    @inject(TOKENS.activeProblemCoordinator)
    private readonly coordinator: IActiveProblemCoordinator,
  ) {}

  public async exec(_msg: InitMsg): Promise<void> {
    this.repo.fireBackgroundEvent();
    await this.coordinator.dispatchFullData();
    this.sidebarProvider.dispatchFullConfig();
  }
}
