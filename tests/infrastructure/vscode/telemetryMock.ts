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

import { mock } from 'vitest-mock-extended';
import type { ITelemetry } from '@/application/ports/vscode/ITelemetry';

export const telemetryMock = mock<ITelemetry>();
telemetryMock.start.mockImplementation((name, props) => {
  console.log(`[Telemetry Start] ${name}`, props ?? '');

  return (endProps?: Record<string, unknown>) => {
    console.log(`[Telemetry End] ${name}`, {
      ...props,
      ...endProps,
    });
  };
});
telemetryMock.event.mockImplementation((name, props) => {
  console.log(`[Telemetry Event] ${name}`, props ?? '');
});
telemetryMock.error.mockImplementation((name, error, props) => {
  console.error(`[Telemetry Error] ${name}`, {
    error,
    ...props,
  });
});
telemetryMock.dispose.mockImplementation(() => {
  console.log('[Telemetry] Disposed');
});
