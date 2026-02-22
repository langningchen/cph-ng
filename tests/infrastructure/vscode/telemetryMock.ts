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

import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { mock } from '@t/mock';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';

const logger = loggerMock.withScope('TelemetryMock');
export const telemetryMock = mock<ITelemetry>();
telemetryMock.start.mockImplementation((name, props) => {
  logger.debug(`[Telemetry Start] ${name}`, props ?? '');

  return (endProps?: Record<string, unknown>) => {
    logger.debug(`[Telemetry End] ${name}`, {
      ...props,
      ...endProps,
    });
  };
});
telemetryMock.event.mockImplementation((name, props) => {
  logger.debug(`[Telemetry Event] ${name}`, props ?? '');
});
telemetryMock.error.mockImplementation((name, error, props) => {
  logger.error(`[Telemetry Error] ${name}`, {
    error,
    ...props,
  });
});
