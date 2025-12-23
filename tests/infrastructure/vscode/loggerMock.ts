// Copyright (C) 2025 Langning Chen
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

const createLoggerMock = (scope?: string): MockProxy<ILogger> => {
  const logger = mock<ILogger>();

  const prefix = scope ? `[${scope}]` : '';
  logger.withScope.mockImplementation((name: string) => createLoggerMock(name));

  logger.info.mockImplementation((...args) =>
    console.info('[INFO]', prefix, ...args),
  );
  logger.warn.mockImplementation((...args) =>
    console.warn('[WARN]', prefix, ...args),
  );
  logger.error.mockImplementation((...args) =>
    console.error('[ERROR]', prefix, ...args),
  );
  logger.debug.mockImplementation((...args) =>
    console.debug('[DEBUG]', prefix, ...args),
  );
  logger.trace.mockImplementation((...args) =>
    console.debug('[TRACE]', prefix, ...args),
  );

  return logger;
};

export const loggerMock = createLoggerMock();
