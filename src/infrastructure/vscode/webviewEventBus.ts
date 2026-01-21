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

import type { UUID } from 'node:crypto';
import { EventEmitter } from 'node:stream';
import type TypedEventEmitter from 'typed-emitter';
import type {
  IWebviewEventBus,
  WebviewEvent,
  WebviewProblemMetaPayload,
} from '@/application/ports/vscode/IWebviewEventBus';
import type {
  IWebviewBackgroundProblem,
  IWebviewBfCompare,
  IWebviewProblem,
  IWebviewTc,
  IWebviewTcResult,
} from '@/domain/webviewTypes';

type WebviewEvents = {
  message: (payload: WebviewEvent) => void;
};

export class WebviewEventBusAdapter implements IWebviewEventBus {
  private readonly emitter: TypedEventEmitter<WebviewEvents> = new EventEmitter();

  public onMessage(handler: (data: WebviewEvent) => void) {
    this.emitter.on('message', handler);
  }

  public fullProblem(problemId: UUID, payload: IWebviewProblem): void {
    this.emitter.emit('message', {
      type: 'FULL_PROBLEM',
      problemId,
      payload,
    });
  }
  public patchMeta(problemId: UUID, payload: WebviewProblemMetaPayload): void {
    this.emitter.emit('message', {
      type: 'PATCH_META',
      problemId,
      payload,
    });
  }
  public patchBfCompare(problemId: UUID, payload: Partial<IWebviewBfCompare>): void {
    this.emitter.emit('message', {
      type: 'PATCH_BF_COMPARE',
      problemId,
      payload,
    });
  }
  public patchTc(problemId: UUID, tcId: UUID, payload: Partial<IWebviewTc>): void {
    this.emitter.emit('message', {
      type: 'PATCH_TC',
      problemId,
      tcId,
      payload,
    });
  }
  public patchTcResult(problemId: UUID, tcId: UUID, payload: Partial<IWebviewTcResult>): void {
    this.emitter.emit('message', {
      type: 'PATCH_TC_RESULT',
      problemId,
      tcId,
      payload,
    });
  }
  public deleteTc(problemId: UUID, tcId: UUID): void {
    this.emitter.emit('message', {
      type: 'DELETE_TC',
      problemId,
      tcId,
    });
  }
  public background(payload: IWebviewBackgroundProblem[]): void {
    this.emitter.emit('message', {
      type: 'BACKGROUND',
      payload,
    });
  }
  public noProblem(canImport: boolean): void {
    this.emitter.emit('message', {
      type: 'NO_PROBLEM',
      canImport,
    });
  }
}
