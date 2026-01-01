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

import { type MockProxy, mock } from 'vitest-mock-extended';
import type { ILogger } from '@/application/ports/vscode/ILogger';

const createLoggerMock = (
  scope?: string,
  rootInstance?: MockProxy<ILogger>,
): MockProxy<ILogger> => {
  const logger = mock<ILogger>();

  const root = rootInstance || logger;
  const prefix = scope ? `[${scope}]` : '';

  logger.withScope.mockImplementation((name: string) => createLoggerMock(name, root));

  const implementLog = (
    level: Exclude<keyof ILogger, 'withScope'>,
    consoleMethod: (...args: unknown[]) => void,
    tag: string,
  ) => {
    logger[level].mockImplementation((...args) => {
      consoleMethod(tag, prefix, ...args);
      logger !== root && root[level](...args);
    });
  };

  implementLog('info', console.info, '[INFO]');
  implementLog('warn', console.warn, '[WARN]');
  implementLog('error', console.error, '[ERROR]');
  implementLog('debug', console.debug, '[DEBUG]');
  implementLog('trace', console.debug, '[TRACE]');

  return logger;
};

export const loggerMock = createLoggerMock();
