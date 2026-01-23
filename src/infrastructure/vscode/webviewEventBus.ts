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
import { inject, injectable } from 'tsyringe';
import type TypedEventEmitter from 'typed-emitter';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import type {
  IWebviewEventBus,
  WebviewEvent,
  WebviewProblemMetaPayload,
} from '@/application/ports/vscode/IWebviewEventBus';
import { TOKENS } from '@/composition/tokens';
import type {
  IWebviewBackgroundProblem,
  IWebviewProblem,
  IWebviewStressTest,
  IWebviewTestcase,
  IWebviewTestcaseResult,
} from '@/domain/webviewTypes';

type WebviewEvents = {
  message: (payload: WebviewEvent) => void;
};

@injectable()
export class WebviewEventBusAdapter implements IWebviewEventBus {
  private readonly emitter: TypedEventEmitter<WebviewEvents> = new EventEmitter();

  public constructor(@inject(TOKENS.logger) private readonly logger: ILogger) {
    this.logger = this.logger.withScope('WebviewEventBusAdapter');
  }

  public onMessage(handler: (data: WebviewEvent) => void) {
    this.emitter.on('message', handler);
  }

  public fullProblem(problemId: UUID, payload: IWebviewProblem): void {
    this.logger.debug('Emitting fullProblem event', { problemId, payload });
    this.emitter.emit('message', {
      type: 'FULL_PROBLEM',
      problemId,
      payload,
    });
  }
  public patchMeta(problemId: UUID, payload: WebviewProblemMetaPayload): void {
    this.logger.debug('Emitting patchMeta event', { problemId, payload });
    this.emitter.emit('message', {
      type: 'PATCH_META',
      problemId,
      payload,
    });
  }
  public patchStressTest(problemId: UUID, payload: Partial<IWebviewStressTest>): void {
    this.logger.debug('Emitting patchStressTest event', { problemId, payload });
    this.emitter.emit('message', {
      type: 'PATCH_STRESS_TEST',
      problemId,
      payload,
    });
  }
  public addTestcase(problemId: UUID, testcaseId: UUID, payload: IWebviewTestcase): void {
    this.logger.debug('Emitting addTestcase event', { problemId, testcaseId, payload });
    this.emitter.emit('message', {
      type: 'ADD_TESTCASE',
      problemId,
      testcaseId,
      payload,
    });
  }
  public deleteTestcase(problemId: UUID, testcaseId: UUID): void {
    this.logger.debug('Emitting deleteTestcase event', { problemId, testcaseId });
    this.emitter.emit('message', {
      type: 'DELETE_TESTCASE',
      problemId,
      testcaseId,
    });
  }
  public patchTestcase(
    problemId: UUID,
    testcaseId: UUID,
    payload: Partial<IWebviewTestcase>,
  ): void {
    this.logger.debug('Emitting patchTestcase event', { problemId, testcaseId, payload });
    this.emitter.emit('message', {
      type: 'PATCH_TC',
      problemId,
      testcaseId,
      payload,
    });
  }
  public patchTestcaseResult(
    problemId: UUID,
    testcaseId: UUID,
    payload: Partial<IWebviewTestcaseResult>,
  ): void {
    this.logger.debug('Emitting patchTestcaseResult event', { problemId, testcaseId, payload });
    this.emitter.emit('message', {
      type: 'PATCH_TC_RESULT',
      problemId,
      testcaseId,
      payload,
    });
  }
  public background(payload: IWebviewBackgroundProblem[]): void {
    this.logger.debug('Emitting background event', { payload });
    this.emitter.emit('message', {
      type: 'BACKGROUND',
      payload,
    });
  }
  public noProblem(canImport: boolean): void {
    this.logger.debug('Emitting noProblem event', { canImport });
    this.emitter.emit('message', {
      type: 'NO_PROBLEM',
      canImport,
    });
  }
}
