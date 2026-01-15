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

import { inject, injectable } from 'tsyringe';
import type { LogOutputChannel } from 'vscode';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class LoggerAdapter implements ILogger {
  public constructor(
    @inject(TOKENS.logOutputChannel) private readonly logger: LogOutputChannel,
    private readonly module = 'base',
  ) {}

  public info(message: string, ...args: unknown[]): void {
    this.logger.info(`[${this.module}]`, message, ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.logger.warn(`[${this.module}]`, message, ...args);
  }

  public error(message: string, ...args: unknown[]): void {
    this.logger.error(`[${this.module}]`, message, ...args);
  }

  public debug(message: string, ...args: unknown[]): void {
    this.logger.debug(`[${this.module}]`, message, ...args);
  }

  public trace(message: string, ...args: unknown[]): void {
    this.logger.trace(`[${this.module}]`, message, ...args);
  }

  public withScope(module: string): ILogger {
    return new LoggerAdapter(this.logger, module);
  }
}
