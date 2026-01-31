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

const LogLevels = ['info', 'warn', 'error', 'debug', 'trace'] as const;
type LogLevel = (typeof LogLevels)[number];
const consoleMap: Record<LogLevel, (...args: unknown[]) => void> = {
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  trace: console.debug,
};

interface MockContext {
  readonly root: MockProxy<ILogger>;
  isTracking: boolean;
}

const createLoggerMockInternal = (scope: string, context?: MockContext): MockProxy<ILogger> => {
  const logger = mock<ILogger>();
  const currentContext: MockContext = context ?? {
    root: logger,
    isTracking: false,
  };
  logger.withScope.mockImplementation((name: string) =>
    createLoggerMockInternal(name, currentContext),
  );
  LogLevels.forEach((level) => {
    logger[level].mockImplementation((message: string, ...args: unknown[]) => {
      if (currentContext.isTracking) return;
      consoleMap[level](`[${level.toUpperCase()}]`, `[${scope}]`, message, ...args);
      if (currentContext.root !== logger) {
        currentContext.isTracking = true;
        currentContext.root[level](message, ...args);
        currentContext.isTracking = false;
      }
    });
  });
  return logger;
};

export const loggerMock = createLoggerMockInternal('base');
